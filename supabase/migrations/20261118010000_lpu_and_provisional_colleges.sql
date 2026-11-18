-- Owner decisions, 18 Nov 2026:
--  1. First launch campus: Lovely Professional University (@lpu.in).
--  2. Unlisted college domains get provisional access straight away and wait in
--     the admin queue. Admin activates (sets the real name + hubs) or rejects.
--     Guardrails: OTP still proves inbox control; public webmail is never accepted;
--     a provisional campus only ever matches students from the same domain
--     (same-campus rule); a rejected domain loses access immediately.

alter table public.colleges drop constraint colleges_status_check;
alter table public.colleges add constraint colleges_status_check check (status in ('active', 'requested', 'rejected'));

insert into public.colleges (name, code, email_domains, city, hubs, timezone, status) values
  ('Lovely Professional University', 'LPU', '{lpu.in}', 'Phagwara',
   '{LPU Campus,Phagwara,Jalandhar,Ludhiana,Amritsar,Chandigarh,Delhi,Amritsar Airport,Chandigarh Airport,Delhi Airport}',
   'Asia/Kolkata', 'active')
on conflict (code) do nothing;

-- Webmail proves nothing about being a student, so it never gets provisional access.
create function app.is_public_email_domain(d text) returns boolean
language sql immutable set search_path = '' as $$
  select lower(d) = any (array[
    'gmail.com','googlemail.com','yahoo.com','yahoo.co.in','yahoo.in','ymail.com','rocketmail.com',
    'outlook.com','outlook.in','hotmail.com','hotmail.co.in','live.com','live.in','msn.com',
    'icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','pm.me',
    'rediffmail.com','zoho.com','zohomail.in','yandex.com','yandex.ru','mail.com','gmx.com','gmx.net',
    'tutanota.com','tuta.io','fastmail.com','hey.com','duck.com','mailinator.com','guerrillamail.com','tempmail.com'
  ]);
$$;

-- Until an admin sets real hubs, a provisional campus gets a generic set so trips can be posted.
create function app.default_hubs() returns text[]
language sql immutable set search_path = '' as $$
  select array['Campus','Nearest railway station','Nearest airport','Delhi','Mumbai','Bengaluru',
               'Chennai','Kolkata','Hyderabad','Pune','Chandigarh','Jaipur','Lucknow'];
$$;

-- Find-or-queue the college for a domain. Raises for webmail and rejected domains.
create function app.college_for_domain(p_domain text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_domain text := lower(trim(p_domain)); v_id uuid; v_status text;
begin
  if v_domain !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' or char_length(v_domain) > 100 then raise exception 'bad_domain'; end if;
  if app.is_public_email_domain(v_domain) then raise exception 'public_email_domain'; end if;
  select id, status into v_id, v_status from public.colleges where v_domain = any (email_domains);
  if v_status = 'rejected' then raise exception 'college_rejected'; end if;
  if v_id is null then
    insert into public.colleges (name, code, email_domains, hubs, status)
    values (v_domain, v_domain, array[v_domain], app.default_hubs(), 'requested')
    on conflict (code) do update set code = excluded.code
    returning id into v_id;
  end if;
  return v_id;
end $$;

-- Signup now admits active AND provisional (requested) colleges.
create or replace function app.on_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_college uuid;
begin
  if tg_op = 'INSERT' then
    v_college := app.college_for_domain(split_part(new.email, '@', 2)); -- fails closed for webmail/rejected
    insert into public.public_profiles (user_id, first_name, college_id, email_verified)
    values (
      new.id,
      left(initcap(split_part(split_part(new.email, '@', 1), '.', 1)), 40),
      v_college,
      new.email_confirmed_at is not null
    );
    insert into public.private_profiles (user_id, email) values (new.id, lower(new.email));
  else
    if new.email is distinct from old.email then
      raise exception 'email_change_not_allowed';
    end if;
    if new.email_confirmed_at is not null and old.email_confirmed_at is null then
      update public.public_profiles set email_verified = true where user_id = new.id;
    end if;
  end if;
  return new;
end $$;

-- A rejected college switches off every account on it, everywhere (matching, chat, demand, share links).
create or replace function app.is_active(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.private_profiles p
    join public.public_profiles q using (user_id)
    join public.colleges c on c.id = q.college_id
    where p.user_id = u and not p.is_suspended and q.email_verified and c.status <> 'rejected'
  );
$$;

-- status: active | requested | rejected | public | unknown. Name is the college name, or the domain while provisional.
create or replace function public.college_for_email(p_email text)
returns table (status text, name text)
language sql stable security definer set search_path = '' as $$
  select case when app.is_public_email_domain(split_part(trim(p_email), '@', 2)) then 'public'
              else coalesce(c.status, 'unknown') end,
         c.name
  from (select 1) x
  left join public.colleges c on lower(split_part(trim(p_email), '@', 2)) = any (c.email_domains);
$$;

create or replace function public.request_college(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  perform app.college_for_domain(split_part(trim(p_email), '@', 2));
  return 'requested';
end $$;

-- The viewer's own college, whatever its review status.
create function public.my_college()
returns table (id uuid, name text, code text, hubs text[], timezone text, status text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.code, c.hubs, c.timezone, c.status
  from public.colleges c join public.public_profiles p on p.college_id = c.id
  where p.user_id = auth.uid();
$$;

drop function public.admin_requested_colleges();
create function public.admin_requested_colleges()
returns table (id uuid, domain text, created_at timestamptz, students int, hubs text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_admin() then raise exception 'not_allowed'; end if;
  return query
  select c.id, c.email_domains[1], c.created_at,
         (select count(*)::int from public.public_profiles p where p.college_id = c.id and p.email_verified),
         c.hubs
  from public.colleges c where c.status = 'requested' order by c.created_at;
end $$;

create function public.admin_reject_college(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then raise exception 'not_allowed'; end if;
  update public.colleges set status = 'rejected' where id = p_id and status = 'requested';
  -- Close open requests and chats involving its students, so nothing stays reachable.
  update public.matches m set status = case m.status when 'pending' then 'cancelled' else 'closed' end,
         closed_reason = 'college_rejected', responded_at = coalesce(m.responded_at, now())
   where m.status in ('pending', 'accepted')
     and exists (select 1 from public.public_profiles p where p.college_id = p_id
                 and p.user_id in (m.requester_id, m.addressee_id));
end $$;

revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on all functions in schema app to authenticated;
revoke execute on function public.my_college(), public.admin_requested_colleges(), public.admin_reject_college(uuid) from public, anon;
grant execute on function public.my_college(), public.admin_requested_colleges(), public.admin_reject_college(uuid) to authenticated;
