-- SangSafar v1 schema.
--
-- Privacy model (PRODUCT.md §Privacy): RLS filters rows, it cannot hide columns.
-- So every base table is owner-only (or participant-only) under RLS, private fields
-- live in separate tables, and every cross-user read goes through a
-- security-definer RPC below that checks match / block / suspension / women-only
-- state before returning anything. anon and authenticated get no direct grants
-- beyond what is listed at the bottom of this file.

create schema if not exists app; -- internal helpers, NOT exposed through the Data API
grant usage on schema app to anon, authenticated, service_role;

-- ======================================================================
-- Tables
-- ======================================================================

-- College registry: adding a college is one row, no code change.
create table public.colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  email_domains text[] not null default '{}',   -- lowercase, exact match
  city text,
  hubs text[] not null default '{}',            -- route endpoints students pick from
  timezone text not null default 'Asia/Kolkata',
  academic_calendar jsonb,
  status text not null default 'requested' check (status in ('active', 'requested')),
  created_at timestamptz not null default now()
);
create index colleges_domains_idx on public.colleges using gin (email_domains);

-- Tunables (single row). Change values here, not in code.
create table public.app_settings (
  id boolean primary key default true check (id),
  connect_daily_limit int not null default 10,
  report_daily_limit int not null default 5,
  suspend_threshold int not null default 3,     -- distinct open reporters
  request_expiry_hours int not null default 48
);
insert into public.app_settings default values;

create table public.admins (
  user_id uuid primary key references auth.users on delete cascade
);

-- Card-safe profile fields. Never readable anonymously; other users only see
-- these through RPCs that check same-college + block + suspension state.
create table public.public_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 40),
  college_id uuid not null references public.colleges,
  year smallint check (year between 1 and 7),
  email_verified boolean not null default false,
  id_checked boolean not null default false,   -- manual admin review only
  id_checked_on date,
  created_at timestamptz not null default now()
);

-- Owner + service role only. Email is never returned by any RPC.
create table public.private_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text check (char_length(full_name) <= 80),
  branch text check (char_length(branch) <= 60),
  gender text check (gender in ('woman', 'man', 'non_binary', 'prefer_not_to_say')),
  -- Comfort-filter consent. Self-declared data, not verified gender, not a safety feature.
  women_only_optin boolean not null default false
    check (not women_only_optin or gender = 'woman'),
  is_suspended boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  college_id uuid not null references public.colleges,
  mode text not null check (mode in ('train', 'bus', 'flight', 'cab')),
  from_hub text not null,
  from_point text check (char_length(from_point) <= 60),
  to_hub text not null,
  to_point text check (char_length(to_point) <= 60),
  travel_date date not null,
  depart_start time not null,
  depart_end time not null,
  women_only boolean not null default false,
  status text not null default 'live' check (status in ('draft', 'live', 'archived')),
  share_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  check (from_hub <> to_hub),
  check (depart_end > depart_start)  -- v1 rejects overnight windows
);
create index trips_lookup_idx on public.trips (college_id, travel_date, from_hub, to_hub) where status = 'live';
create index trips_owner_idx on public.trips (owner_id);

-- Unlocked only for the owner and for an accepted, unblocked match.
create table public.private_trip_details (
  trip_id uuid primary key references public.trips on delete cascade,
  vehicle_no text check (char_length(vehicle_no) <= 20),
  meetup_point text check (char_length(meetup_point) <= 120),
  notes text check (char_length(notes) <= 500)
);

-- A connect request binds two specific trips.
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  requester_trip_id uuid references public.trips on delete set null,
  addressee_trip_id uuid references public.trips on delete set null,
  requester_id uuid references auth.users on delete set null,
  addressee_id uuid references auth.users on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled', 'closed')),
  closed_reason text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null
);
-- One open request/connection per unordered trip pair.
create unique index matches_one_open_per_pair on public.matches
  (least(requester_trip_id, addressee_trip_id), greatest(requester_trip_id, addressee_trip_id))
  where status in ('pending', 'accepted');
create index matches_requester_idx on public.matches (requester_id, created_at);
create index matches_addressee_idx on public.matches (addressee_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users on delete cascade,
  client_id uuid not null unique,  -- idempotency key: a retried send never duplicates
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_match_idx on public.messages (match_id, created_at);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users on delete cascade,
  reported_user_id uuid not null references auth.users on delete cascade,
  context text not null check (char_length(context) <= 80),  -- 'profile' or 'match:<id>'
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'reviewed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, reported_user_id, context)
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users on delete cascade,
  blocked_user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_user_id),
  check (blocker_id <> blocked_user_id)
);

create table public.travel_confirmations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches on delete cascade,
  confirmer_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  unique (match_id, confirmer_id)
);

-- v1.5 reservation only (hub cab pools). No UI, no RPC, no grants.
create table public.cab_pools (
  id uuid primary key default gen_random_uuid(),
  college_id uuid references public.colleges,
  created_at timestamptz not null default now()
);

-- ======================================================================
-- Internal helpers (schema app)
-- ======================================================================

create function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Verified, not suspended, not deleted.
create function app.is_active(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.private_profiles p
    join public.public_profiles q using (user_id)
    where p.user_id = u and not p.is_suspended and q.email_verified
  );
$$;

create function app.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_user_id = b) or (blocker_id = b and blocked_user_id = a)
  );
$$;

-- Self-declared woman AND explicitly opted in to the comfort filter.
create function app.women_ok(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.private_profiles
    where user_id = u and gender = 'woman' and women_only_optin
  );
$$;

create function app.my_college() returns uuid
language sql stable security definer set search_path = '' as $$
  select college_id from public.public_profiles where user_id = auth.uid();
$$;

-- Wall-clock time on campus (dates are validated in the college's timezone, not UTC).
create function app.local_now(c uuid) returns timestamp
language sql stable security definer set search_path = '' as $$
  select now() at time zone timezone from public.colleges where id = c;
$$;

create function app.trip_upcoming(t public.trips) returns boolean
language sql stable security definer set search_path = '' as $$
  select t.status = 'live' and (t.travel_date + t.depart_end) > app.local_now(t.college_id);
$$;

-- Hard matching gates (PRODUCT.md §Matching). Scoring happens in lib/matching.ts;
-- these gates are what make a pair exist at all.
create function app.pair_eligible(a public.trips, b public.trips) returns boolean
language sql stable security definer set search_path = '' as $$
  select a.owner_id <> b.owner_id
     and a.college_id = b.college_id                       -- same campus (v1)
     and a.travel_date = b.travel_date
     and a.from_hub = b.from_hub and a.to_hub = b.to_hub   -- route gate: unrelated routes never match
     and app.trip_upcoming(a) and app.trip_upcoming(b)
     and app.is_active(a.owner_id) and app.is_active(b.owner_id)
     and not app.is_blocked(a.owner_id, b.owner_id)
     -- Women-only is bidirectional: if either trip uses it, both owners must qualify.
     and (not (a.women_only or b.women_only)
          or (app.women_ok(a.owner_id) and app.women_ok(b.owner_id)));
$$;

-- Chat (and private detail) access: accepted, both present + active, no block.
create function app.can_chat(p_match uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match and m.status = 'accepted'
      and auth.uid() in (m.requester_id, m.addressee_id)
      and m.requester_id is not null and m.addressee_id is not null
      and not app.is_blocked(m.requester_id, m.addressee_id)
      and app.is_active(m.requester_id) and app.is_active(m.addressee_id)
  );
$$;

create function app.validate_trip(
  p_college uuid, p_mode text, p_from text, p_to text, p_date date, p_start time, p_end time
) returns void
language plpgsql stable security definer set search_path = '' as $$
declare c public.colleges;
begin
  select * into c from public.colleges where id = p_college;
  if p_mode is null or p_mode not in ('train', 'bus', 'flight', 'cab') then raise exception 'bad_mode'; end if;
  if not (p_from = any (c.hubs) and p_to = any (c.hubs)) then raise exception 'unknown_hub'; end if;
  if p_from = p_to then raise exception 'same_route'; end if;
  if p_start is null or p_end is null or p_end <= p_start then raise exception 'window_order'; end if;
  if (p_date + p_end) <= app.local_now(p_college) then raise exception 'in_past'; end if;
  if p_date > (app.local_now(p_college))::date + 180 then raise exception 'too_far'; end if;
end $$;

-- Close every open request/connection touching a trip.
create function app.close_trip_matches(p_trip uuid, p_reason text) returns void
language sql security definer set search_path = '' as $$
  update public.matches
     set status = case status when 'pending' then 'cancelled' else 'closed' end,
         closed_reason = p_reason,
         responded_at = coalesce(responded_at, now())
   where status in ('pending', 'accepted')
     and p_trip in (requester_trip_id, addressee_trip_id);
$$;

-- ======================================================================
-- Signup: college from email domain; email changes are blocked.
-- ======================================================================

create function app.on_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_college uuid;
begin
  if tg_op = 'INSERT' then
    select id into v_college from public.colleges
     where status = 'active' and lower(split_part(new.email, '@', 2)) = any (email_domains);
    if v_college is null then
      raise exception 'college_domain_not_active'; -- fail closed: no account without a registered campus
    end if;
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

create trigger on_auth_user_insert after insert on auth.users
  for each row execute function app.on_auth_user();
create trigger on_auth_user_update before update of email, email_confirmed_at on auth.users
  for each row execute function app.on_auth_user();

-- ======================================================================
-- Public RPCs: colleges, demand, share links
-- ======================================================================

-- 'active' | 'requested' | 'unknown', plus the college name when active.
create function public.college_for_email(p_email text)
returns table (status text, name text)
language sql stable security definer set search_path = '' as $$
  select coalesce(c.status, 'unknown'), case when c.status = 'active' then c.name end
  from (select 1) x
  left join public.colleges c on lower(split_part(trim(p_email), '@', 2)) = any (c.email_domains);
$$;

-- Queues an unknown domain for admin review. Stores the domain only, never the email.
create function public.request_college(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_domain text := lower(split_part(trim(p_email), '@', 2));
begin
  if v_domain !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' or char_length(v_domain) > 100 then
    raise exception 'bad_domain';
  end if;
  if exists (select 1 from public.colleges where v_domain = any (email_domains)) then
    return 'exists';
  end if;
  insert into public.colleges (name, code, email_domains, status)
  values (v_domain, v_domain, array[v_domain], 'requested')
  on conflict (code) do nothing;
  return 'requested';
end $$;

create function public.active_colleges()
returns table (id uuid, name text, code text, hubs text[], timezone text)
language sql stable security definer set search_path = '' as $$
  select id, name, code, hubs, timezone from public.colleges where status = 'active' order by name;
$$;

-- 7-day demand strip. Counts distinct eligible students (not trip rows) on one
-- exact route; anything under 5, including zero, comes back NULL ("low demand").
-- Women-only trips and suspended users are never counted. The only filters are
-- college + route + a fixed 7-day window, so no narrower slice exists to subtract.
create function public.demand_strip(p_college uuid, p_from text, p_to text, p_start date)
returns table (day date, students int)
language plpgsql stable security definer set search_path = '' as $$
declare v_today date;
begin
  v_today := (app.local_now(p_college))::date;
  if v_today is null or p_start is null or p_start < v_today or p_start > v_today + 60 then
    raise exception 'bad_range';
  end if;
  return query
  select d::date,
         case when count(distinct t.owner_id) >= 5 then count(distinct t.owner_id)::int end
  from generate_series(p_start, p_start + 6, interval '1 day') d
  left join public.trips t
    on t.travel_date = d::date and t.college_id = p_college
   and t.from_hub = p_from and t.to_hub = p_to
   and t.status = 'live' and not t.women_only
   and app.is_active(t.owner_id)
  group by d order by d;
end $$;

-- Share link. Logged out: generic route, date, mode only. A verified same-college
-- viewer also gets the card (first name, year, badge, window). Women-only trips
-- are invisible to anyone ineligible, logged out included.
create function public.share_card(p_token uuid)
returns table (
  trip_id uuid, mode text, from_hub text, to_hub text, travel_date date,
  college_name text, first_name text, year smallint, id_checked boolean,
  depart_start time, depart_end time, is_own boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare t public.trips; v_uid uuid := auth.uid(); v_full boolean;
begin
  select * into t from public.trips where share_token = p_token;
  if not found or not app.trip_upcoming(t) or not app.is_active(t.owner_id) then return; end if;
  if v_uid is not null and v_uid <> t.owner_id and app.is_blocked(v_uid, t.owner_id) then return; end if;
  if t.women_only and v_uid is distinct from t.owner_id
     and not (v_uid is not null and app.women_ok(v_uid) and app.my_college() = t.college_id) then
    return;
  end if;
  v_full := v_uid is not null and (v_uid = t.owner_id
            or (app.is_active(v_uid) and app.my_college() = t.college_id));
  return query
  select case when v_full then t.id end, t.mode, t.from_hub, t.to_hub, t.travel_date,
         case when v_full then c.name end,
         case when v_full then p.first_name end,
         case when v_full then p.year end,
         case when v_full then p.id_checked end,
         case when v_full then t.depart_start end,
         case when v_full then t.depart_end end,
         coalesce(v_uid = t.owner_id, false)
  from public.colleges c, public.public_profiles p
  where c.id = t.college_id and p.user_id = t.owner_id;
end $$;

-- ======================================================================
-- Own trips
-- ======================================================================

create function public.create_trip(
  p_mode text, p_from_hub text, p_from_point text, p_to_hub text, p_to_point text,
  p_date date, p_start time, p_end time, p_women_only boolean,
  p_vehicle_no text, p_meetup text, p_notes text
) returns public.trips
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_college uuid := app.my_college(); v_trip public.trips;
begin
  if v_uid is null or not app.is_active(v_uid) then raise exception 'not_allowed'; end if;
  perform app.validate_trip(v_college, p_mode, p_from_hub, p_to_hub, p_date, p_start, p_end);
  if coalesce(p_women_only, false) and not app.women_ok(v_uid) then raise exception 'women_only_not_eligible'; end if;
  insert into public.trips (owner_id, college_id, mode, from_hub, from_point, to_hub, to_point,
                            travel_date, depart_start, depart_end, women_only)
  values (v_uid, v_college, p_mode, p_from_hub, nullif(trim(p_from_point), ''), p_to_hub,
          nullif(trim(p_to_point), ''), p_date, p_start, p_end, coalesce(p_women_only, false))
  returning * into v_trip;
  insert into public.private_trip_details (trip_id, vehicle_no, meetup_point, notes)
  values (v_trip.id, nullif(upper(trim(p_vehicle_no)), ''), nullif(trim(p_meetup), ''), nullif(trim(p_notes), ''));
  return v_trip;
end $$;

-- Any real change cancels pending requests and closes connections on this trip,
-- so newly changed private details are never shared without renewed consent.
create function public.update_trip(
  p_trip uuid, p_mode text, p_from_hub text, p_from_point text, p_to_hub text, p_to_point text,
  p_date date, p_start time, p_end time, p_women_only boolean,
  p_vehicle_no text, p_meetup text, p_notes text
) returns public.trips
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); old_t public.trips; old_d public.private_trip_details; v_trip public.trips;
begin
  select * into old_t from public.trips where id = p_trip and owner_id = v_uid for update;
  if not found or not app.is_active(v_uid) then raise exception 'not_allowed'; end if;
  select * into old_d from public.private_trip_details where trip_id = p_trip;
  perform app.validate_trip(old_t.college_id, p_mode, p_from_hub, p_to_hub, p_date, p_start, p_end);
  if coalesce(p_women_only, false) and not app.women_ok(v_uid) then raise exception 'women_only_not_eligible'; end if;

  update public.trips set
    mode = p_mode, from_hub = p_from_hub, from_point = nullif(trim(p_from_point), ''),
    to_hub = p_to_hub, to_point = nullif(trim(p_to_point), ''), travel_date = p_date,
    depart_start = p_start, depart_end = p_end, women_only = coalesce(p_women_only, false),
    status = 'live'
  where id = p_trip returning * into v_trip;
  insert into public.private_trip_details (trip_id, vehicle_no, meetup_point, notes)
  values (p_trip, nullif(upper(trim(p_vehicle_no)), ''), nullif(trim(p_meetup), ''), nullif(trim(p_notes), ''))
  on conflict (trip_id) do update set vehicle_no = excluded.vehicle_no,
    meetup_point = excluded.meetup_point, notes = excluded.notes;

  if (old_t.mode, old_t.from_hub, old_t.from_point, old_t.to_hub, old_t.to_point, old_t.travel_date,
      old_t.depart_start, old_t.depart_end, old_t.women_only)
     is distinct from
     (v_trip.mode, v_trip.from_hub, v_trip.from_point, v_trip.to_hub, v_trip.to_point, v_trip.travel_date,
      v_trip.depart_start, v_trip.depart_end, v_trip.women_only)
  or (old_d.vehicle_no, old_d.meetup_point, old_d.notes) is distinct from
     (nullif(upper(trim(p_vehicle_no)), ''), nullif(trim(p_meetup), ''), nullif(trim(p_notes), ''))
  then
    perform app.close_trip_matches(p_trip, 'trip_edited');
  end if;
  return v_trip;
end $$;

-- 'draft' hides the trip (and cancels pending requests); 'live' re-publishes it.
create function public.set_trip_status(p_trip uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.trips;
begin
  select * into t from public.trips where id = p_trip and owner_id = auth.uid() for update;
  if not found or p_status not in ('draft', 'live') then raise exception 'not_allowed'; end if;
  if p_status = 'live' then
    perform app.validate_trip(t.college_id, t.mode, t.from_hub, t.to_hub, t.travel_date, t.depart_start, t.depart_end);
  else
    update public.matches set status = 'cancelled', closed_reason = 'trip_hidden', responded_at = now()
     where status = 'pending' and p_trip in (requester_trip_id, addressee_trip_id);
  end if;
  update public.trips set status = p_status where id = p_trip;
end $$;

create function public.delete_trip(p_trip uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.trips where id = p_trip and owner_id = auth.uid()) then
    raise exception 'not_allowed';
  end if;
  perform app.close_trip_matches(p_trip, 'trip_deleted');
  delete from public.trips where id = p_trip;
end $$;

create function public.my_trips()
returns table (
  id uuid, mode text, from_hub text, from_point text, to_hub text, to_point text,
  travel_date date, depart_start time, depart_end time, women_only boolean,
  status text, share_token uuid, vehicle_no text, meetup_point text, notes text,
  incoming_pending int, connected int, travelled_together boolean
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.mode, t.from_hub, t.from_point, t.to_hub, t.to_point,
         t.travel_date, t.depart_start, t.depart_end, t.women_only,
         case when t.status = 'live' and not app.trip_upcoming(t) then 'archived' else t.status end,
         t.share_token, d.vehicle_no, d.meetup_point, d.notes,
         (select count(*)::int from public.matches m where m.addressee_trip_id = t.id
            and m.status = 'pending' and m.expires_at > now()),
         (select count(*)::int from public.matches m where t.id in (m.requester_trip_id, m.addressee_trip_id)
            and m.status = 'accepted'),
         exists (select 1 from public.matches m where t.id in (m.requester_trip_id, m.addressee_trip_id)
            and (select count(distinct confirmer_id) from public.travel_confirmations c where c.match_id = m.id) = 2)
  from public.trips t
  left join public.private_trip_details d on d.trip_id = t.id
  where t.owner_id = auth.uid()
  order by t.travel_date desc, t.depart_start;
$$;

-- ======================================================================
-- Matching + connect requests
-- ======================================================================

-- Server-only (service role): candidates that pass every hard gate. Returns
-- same_vehicle as a boolean for ranking; the vehicle number itself never leaves
-- the database, and the server strips the boolean before rendering.
create function public.match_candidates(p_viewer uuid, p_trip uuid)
returns table (
  trip_id uuid, owner_id uuid, first_name text, year smallint, college_name text,
  id_checked boolean, mode text, from_point text, to_point text, travel_date date,
  depart_start time, depart_end time, same_vehicle boolean, same_college boolean,
  match_id uuid, match_status text, i_requested boolean, women_only boolean
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.owner_id, p.first_name, p.year, c.name, p.id_checked, t.mode, t.from_point, t.to_point,
         t.travel_date, t.depart_start, t.depart_end,
         coalesce(dm.vehicle_no is not null and dm.vehicle_no = dt.vehicle_no, false),
         t.college_id = mine.college_id,
         m.id, case when m.status = 'pending' and m.expires_at <= now() then 'expired' else m.status end,
         m.requester_id = p_viewer, t.women_only
  from public.trips mine
  join public.trips t
    on t.college_id = mine.college_id and t.travel_date = mine.travel_date
   and t.from_hub = mine.from_hub and t.to_hub = mine.to_hub and t.id <> mine.id
  join public.public_profiles p on p.user_id = t.owner_id
  join public.colleges c on c.id = t.college_id
  left join public.private_trip_details dm on dm.trip_id = mine.id
  left join public.private_trip_details dt on dt.trip_id = t.id
  left join lateral (
    select x.id, x.status, x.expires_at, x.requester_id from public.matches x
    where least(x.requester_trip_id, x.addressee_trip_id) = least(mine.id, t.id)
      and greatest(x.requester_trip_id, x.addressee_trip_id) = greatest(mine.id, t.id)
    order by x.created_at desc limit 1
  ) m on true
  where mine.id = p_trip and mine.owner_id = p_viewer
    and app.pair_eligible(mine, t)
    and coalesce(m.status, '') <> 'declined';  -- a declined pair never resurfaces
$$;

create function public.send_connect_request(p_my_trip uuid, p_their_trip uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); a public.trips; b public.trips; s public.app_settings;
  v_id uuid; v_tz text;
begin
  select * into a from public.trips where id = p_my_trip and owner_id = v_uid;
  if not found then raise exception 'not_allowed'; end if;
  select * into b from public.trips where id = p_their_trip;
  if not found or not app.pair_eligible(a, b) then raise exception 'not_eligible'; end if;
  if exists (select 1 from public.matches x where x.status = 'declined'
             and least(x.requester_trip_id, x.addressee_trip_id) = least(a.id, b.id)
             and greatest(x.requester_trip_id, x.addressee_trip_id) = greatest(a.id, b.id)) then
    raise exception 'not_eligible';
  end if;
  select * into s from public.app_settings;
  if (select count(*) from public.matches where requester_id = v_uid
      and created_at > now() - interval '1 day') >= s.connect_daily_limit then
    raise exception 'rate_limited';
  end if;
  select timezone into v_tz from public.colleges where id = a.college_id;
  insert into public.matches (requester_trip_id, addressee_trip_id, requester_id, addressee_id, expires_at)
  values (a.id, b.id, v_uid, b.owner_id,
          -- 48h or the end of the earlier departure window, whichever comes first
          least(now() + make_interval(hours => s.request_expiry_hours),
                (a.travel_date + least(a.depart_end, b.depart_end)) at time zone v_tz))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'duplicate_request';
end $$;

-- Returns the requester id so the server can send the "accepted" email.
create function public.respond_to_request(p_match uuid, p_accept boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare m public.matches; a public.trips; b public.trips;
begin
  select * into m from public.matches where id = p_match and addressee_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if m.status <> 'pending' then raise exception 'not_pending'; end if;
  if m.expires_at <= now() then raise exception 'expired'; end if;
  if p_accept then
    select * into a from public.trips where id = m.requester_trip_id;
    select * into b from public.trips where id = m.addressee_trip_id;
    if a.id is null or b.id is null or not app.pair_eligible(a, b) then raise exception 'not_eligible'; end if;
  end if;
  update public.matches set status = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now() where id = p_match;
  return m.requester_id;
end $$;

create function public.cancel_request(p_match uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.matches set status = 'cancelled', closed_reason = 'requester_cancelled', responded_at = now()
   where id = p_match and requester_id = auth.uid() and status = 'pending';
  if not found then raise exception 'not_pending'; end if;
end $$;

-- Inbox: every request/connection I'm part of, except with people I blocked or who blocked me.
create function public.my_inbox()
returns table (
  match_id uuid, direction text, status text, closed_reason text,
  other_user_id uuid, other_first_name text, other_year smallint, other_id_checked boolean,
  mode text, from_hub text, from_point text, to_hub text, to_point text, travel_date date,
  my_trip_id uuid, my_start time, my_end time, their_start time, their_end time,
  expires_at timestamptz, created_at timestamptz, last_message_at timestamptz,
  me_confirmed boolean, them_confirmed boolean, can_confirm boolean
)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select m.*,
      case when m.requester_id = auth.uid() then 'outgoing' else 'incoming' end as dir,
      case when m.requester_id = auth.uid() then m.addressee_id else m.requester_id end as other_id,
      case when m.requester_id = auth.uid() then m.requester_trip_id else m.addressee_trip_id end as my_tid,
      case when m.requester_id = auth.uid() then m.addressee_trip_id else m.requester_trip_id end as their_tid
    from public.matches m
    where auth.uid() in (m.requester_id, m.addressee_id)
  ), shaped as (
    select x.*,
      case
        when x.status = 'pending' and x.expires_at <= now() then 'expired'
        when x.status = 'accepted' and (x.other_id is null or not app.is_active(x.other_id)) then 'closed'
        else x.status
      end as shown_status
    from mine x
    where x.other_id is null or not app.is_blocked(auth.uid(), x.other_id)
  )
  select s.id, s.dir, s.shown_status, s.closed_reason,
         s.other_id, p.first_name, p.year, p.id_checked,
         coalesce(tt.mode, mt.mode), coalesce(tt.from_hub, mt.from_hub), tt.from_point,
         coalesce(tt.to_hub, mt.to_hub), tt.to_point, coalesce(tt.travel_date, mt.travel_date),
         mt.id, mt.depart_start, mt.depart_end, tt.depart_start, tt.depart_end,
         s.expires_at, s.created_at,
         (select max(g.created_at) from public.messages g where g.match_id = s.id),
         exists (select 1 from public.travel_confirmations c where c.match_id = s.id and c.confirmer_id = auth.uid()),
         exists (select 1 from public.travel_confirmations c where c.match_id = s.id and c.confirmer_id = s.other_id),
         s.shown_status = 'accepted'
           and coalesce(tt.travel_date, mt.travel_date) <= (app.local_now(coalesce(tt.college_id, mt.college_id)))::date
  from shaped s
  left join public.public_profiles p on p.user_id = s.other_id
  left join public.trips mt on mt.id = s.my_tid
  left join public.trips tt on tt.id = s.their_tid
  order by coalesce((select max(g.created_at) from public.messages g where g.match_id = s.id), s.created_at) desc;
$$;

-- Unlocked trip details for both sides. Zero rows unless the chat is open.
create function public.match_details(p_match uuid)
returns table (
  side text, first_name text, mode text, from_hub text, from_point text, to_hub text, to_point text,
  travel_date date, depart_start time, depart_end time, vehicle_no text, meetup_point text, notes text
)
language sql stable security definer set search_path = '' as $$
  select case when t.owner_id = auth.uid() then 'me' else 'them' end, p.first_name,
         t.mode, t.from_hub, t.from_point, t.to_hub, t.to_point, t.travel_date, t.depart_start, t.depart_end,
         d.vehicle_no, d.meetup_point, d.notes
  from public.matches m
  join public.trips t on t.id in (m.requester_trip_id, m.addressee_trip_id)
  join public.public_profiles p on p.user_id = t.owner_id
  left join public.private_trip_details d on d.trip_id = t.id
  where m.id = p_match and app.can_chat(p_match)
  order by 1;
$$;

create function public.confirm_travelled(p_match uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.trips;
begin
  select tr.* into t from public.matches m join public.trips tr on tr.id = m.requester_trip_id
   where m.id = p_match and app.can_chat(p_match);
  if not found then raise exception 'not_allowed'; end if;
  if t.travel_date > (app.local_now(t.college_id))::date then raise exception 'too_early'; end if;
  insert into public.travel_confirmations (match_id, confirmer_id) values (p_match, auth.uid())
  on conflict do nothing;
end $$;

-- ======================================================================
-- Safety: block, report, auto-suspend
-- ======================================================================

create function public.block_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or p_user is null or p_user = v_uid then raise exception 'not_allowed'; end if;
  insert into public.blocks (blocker_id, blocked_user_id) values (v_uid, p_user) on conflict do nothing;
  -- Revoke immediately: open requests cancel, connections close, chat + details vanish.
  update public.matches
     set status = case status when 'pending' then 'cancelled' else 'closed' end,
         closed_reason = 'blocked', responded_at = coalesce(responded_at, now())
   where status in ('pending', 'accepted')
     and ((requester_id = v_uid and addressee_id = p_user) or (requester_id = p_user and addressee_id = v_uid));
end $$;

create function public.report_user(p_user uuid, p_context text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); s public.app_settings;
begin
  if v_uid is null or p_user is null or p_user = v_uid or not app.is_active(v_uid) then
    raise exception 'not_allowed';
  end if;
  select * into s from public.app_settings;
  if (select count(*) from public.reports where reporter_id = v_uid
      and created_at > now() - interval '1 day') >= s.report_daily_limit then
    raise exception 'rate_limited';
  end if;
  insert into public.reports (reporter_id, reported_user_id, context, reason)
  values (v_uid, p_user, coalesce(nullif(trim(p_context), ''), 'profile'), trim(p_reason))
  on conflict (reporter_id, reported_user_id, context) do nothing;
  -- Distinct reporters only; duplicates from one reporter never add up.
  if (select count(distinct reporter_id) from public.reports
      where reported_user_id = p_user and status = 'open') >= s.suspend_threshold then
    update public.private_profiles set is_suspended = true where user_id = p_user;
  end if;
end $$;

-- ======================================================================
-- Admin (role checked on the server inside every function)
-- ======================================================================

create function public.admin_report_queue()
returns table (
  user_id uuid, first_name text, college_code text, is_suspended boolean,
  distinct_reporters int, last_report_at timestamptz, reports jsonb
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_admin() then raise exception 'not_allowed'; end if;
  return query
  select r.reported_user_id, p.first_name, c.code, pp.is_suspended,
         count(distinct r.reporter_id)::int, max(r.created_at),
         jsonb_agg(jsonb_build_object('reason', r.reason, 'context', r.context, 'at', r.created_at)
                   order by r.created_at desc)
  from public.reports r
  join public.public_profiles p on p.user_id = r.reported_user_id
  join public.private_profiles pp on pp.user_id = r.reported_user_id
  join public.colleges c on c.id = p.college_id
  where r.status = 'open'
  group by r.reported_user_id, p.first_name, c.code, pp.is_suspended
  order by pp.is_suspended desc, count(distinct r.reporter_id) desc;
end $$;

-- Suspend or restore. Either decision closes the open reports it reviewed.
create function public.admin_set_suspended(p_user uuid, p_suspended boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then raise exception 'not_allowed'; end if;
  update public.private_profiles set is_suspended = p_suspended where user_id = p_user;
  update public.reports set status = 'reviewed' where reported_user_id = p_user and status = 'open';
end $$;

create function public.admin_requested_colleges()
returns table (id uuid, domain text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_admin() then raise exception 'not_allowed'; end if;
  return query select c.id, c.email_domains[1], c.created_at from public.colleges c
               where c.status = 'requested' order by c.created_at;
end $$;

create function public.admin_activate_college(
  p_id uuid, p_name text, p_code text, p_city text, p_hubs text[], p_timezone text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then raise exception 'not_allowed'; end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_code), '') = '' or coalesce(array_length(p_hubs, 1), 0) < 2 then
    raise exception 'bad_college';
  end if;
  perform now() at time zone p_timezone; -- raises on an unknown timezone
  update public.colleges set name = trim(p_name), code = upper(trim(p_code)), city = nullif(trim(p_city), ''),
         hubs = p_hubs, timezone = p_timezone, status = 'active'
   where id = p_id and status = 'requested';
end $$;

create function public.admin_users(p_query text)
returns table (user_id uuid, first_name text, college_code text, year smallint,
               id_checked boolean, id_checked_on date, is_suspended boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_admin() then raise exception 'not_allowed'; end if;
  return query
  select p.user_id, p.first_name, c.code, p.year, p.id_checked, p.id_checked_on, pp.is_suspended
  from public.public_profiles p
  join public.private_profiles pp using (user_id)
  join public.colleges c on c.id = p.college_id
  where coalesce(p_query, '') = '' or p.first_name ilike '%' || p_query || '%'
  order by p.first_name limit 50;
end $$;

-- Manual ID review records only checked / not checked + a date. No documents stored.
create function public.admin_set_id_checked(p_user uuid, p_checked boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then raise exception 'not_allowed'; end if;
  update public.public_profiles
     set id_checked = p_checked, id_checked_on = case when p_checked then (now() at time zone 'utc')::date end
   where user_id = p_user;
end $$;

-- ======================================================================
-- Service-role jobs
-- ======================================================================

-- Delete-my-data, step 1 (step 2 is auth.admin.deleteUser on the server).
-- Real deletion, nothing retained. Counterparts keep a closed thread that shows
-- "Deleted user" with no messages. Idempotent, so a failed run can be retried.
create function public.purge_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.messages where match_id in
    (select id from public.matches where p_user in (requester_id, addressee_id));
  delete from public.travel_confirmations where match_id in
    (select id from public.matches where p_user in (requester_id, addressee_id));
  update public.matches set
    status = case status when 'pending' then 'cancelled' when 'accepted' then 'closed' else status end,
    closed_reason = 'user_deleted',
    requester_trip_id = case when requester_id = p_user then null else requester_trip_id end,
    addressee_trip_id = case when addressee_id = p_user then null else addressee_trip_id end,
    requester_id = nullif(requester_id, p_user),
    addressee_id = nullif(addressee_id, p_user)
  where p_user in (requester_id, addressee_id);
  delete from public.matches where requester_id is null and addressee_id is null;
  delete from public.reports where p_user in (reporter_id, reported_user_id);
  delete from public.blocks where p_user in (blocker_id, blocked_user_id);
  delete from public.trips where owner_id = p_user;          -- private_trip_details cascade
  delete from public.admins where user_id = p_user;
  delete from public.public_profiles where user_id = p_user;
  delete from public.private_profiles where user_id = p_user;
end $$;

-- Lifecycle: archive past trips, expire stale requests (reads never depend on this running).
create function public.run_housekeeping() returns void
language sql security definer set search_path = '' as $$
  update public.trips t set status = 'archived'
   where t.status in ('live', 'draft') and t.travel_date < (app.local_now(t.college_id))::date;
  update public.matches set status = 'expired', responded_at = now()
   where status = 'pending' and expires_at <= now();
$$;

-- ======================================================================
-- RLS + grants
-- ======================================================================

alter table public.colleges enable row level security;
alter table public.app_settings enable row level security;
alter table public.admins enable row level security;
alter table public.public_profiles enable row level security;
alter table public.private_profiles enable row level security;
alter table public.trips enable row level security;
alter table public.private_trip_details enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
alter table public.travel_confirmations enable row level security;
alter table public.cab_pools enable row level security;

-- Start from nothing, then grant the minimum.
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema app from public, anon, authenticated;

-- Owner-only reads.
grant select on public.public_profiles, public.private_profiles, public.trips, public.private_trip_details,
  public.matches, public.messages, public.reports, public.blocks, public.travel_confirmations to authenticated;

create policy own_public_profile on public.public_profiles for select to authenticated using (user_id = auth.uid());
create policy own_private_profile on public.private_profiles for select to authenticated using (user_id = auth.uid());
create policy own_trips on public.trips for select to authenticated using (owner_id = auth.uid());
create policy own_trip_details on public.private_trip_details for select to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy participant_matches on public.matches for select to authenticated
  using (auth.uid() in (requester_id, addressee_id)
         and not app.is_blocked(requester_id, addressee_id));
create policy own_reports on public.reports for select to authenticated using (reporter_id = auth.uid());
create policy own_blocks on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy participant_confirmations on public.travel_confirmations for select to authenticated
  using (exists (select 1 from public.matches m where m.id = match_id and auth.uid() in (m.requester_id, m.addressee_id)));

-- Owner-editable columns only. Badges, suspension, email and college are server-written.
grant update (first_name, year) on public.public_profiles to authenticated;
grant update (full_name, branch, gender, women_only_optin) on public.private_profiles to authenticated;
create policy edit_public_profile on public.public_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy edit_private_profile on public.private_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Chat: only inside an accepted, unblocked match between two active users.
grant insert (match_id, body, client_id) on public.messages to authenticated;
create policy read_messages on public.messages for select to authenticated using (app.can_chat(match_id));
create policy send_messages on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and app.can_chat(match_id));

grant execute on all functions in schema app to authenticated; -- used inside policies; schema not API-exposed

grant execute on function
  public.college_for_email(text), public.request_college(text), public.active_colleges(),
  public.demand_strip(uuid, text, text, date), public.share_card(uuid)
to anon, authenticated;

grant execute on function
  public.create_trip(text, text, text, text, text, date, time, time, boolean, text, text, text),
  public.update_trip(uuid, text, text, text, text, text, date, time, time, boolean, text, text, text),
  public.set_trip_status(uuid, text), public.delete_trip(uuid), public.my_trips(),
  public.send_connect_request(uuid, uuid), public.respond_to_request(uuid, boolean),
  public.cancel_request(uuid), public.my_inbox(), public.match_details(uuid),
  public.confirm_travelled(uuid), public.block_user(uuid), public.report_user(uuid, text, text),
  public.admin_report_queue(), public.admin_set_suspended(uuid, boolean),
  public.admin_requested_colleges(), public.admin_activate_college(uuid, text, text, text, text[], text),
  public.admin_users(text), public.admin_set_id_checked(uuid, boolean)
to authenticated;

-- match_candidates, purge_user, run_housekeeping: service role only (default grant kept).

alter publication supabase_realtime add table public.messages;
