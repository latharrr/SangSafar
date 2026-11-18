-- FICTIONAL DEMO DATA. Every person, email and trip below is made up.
-- Placeholder campus only: the real first launch campus is undecided (see PRODUCT.md, OPEN).
-- Dates are relative to "today" on campus so the demo never goes stale.
-- Sign in locally as any of these emails; the OTP lands in Mailpit (http://127.0.0.1:55324).

insert into public.colleges (id, name, code, email_domains, city, hubs, timezone, status) values
  ('00000000-0000-4000-8000-0000000000c1', 'Demo Institute of Technology', 'CAMPUS1', '{example.edu}',
   'Demo Campus City', '{Demo Campus,Delhi,Chandigarh,Demo Airport}', 'Asia/Kolkata', 'active'),
  ('00000000-0000-4000-8000-0000000000c2', 'sample-college.edu', 'sample-college.edu', '{sample-college.edu}',
   null, app.default_hubs(), 'Asia/Kolkata', 'requested');

-- 12 students. (n, first name, year, branch, gender, women-only opt-in)
create temporary table seed_people (n int, first_name text, year int, branch text, gender text, optin boolean);
insert into seed_people values
  (1,  'Aarav',   2, 'Computer Science',   'man',   false),
  (2,  'Ananya',  3, 'Electronics',        'woman', true),
  (3,  'Ishaan',  1, 'Mechanical',         'man',   false),
  (4,  'Diya',    2, 'Computer Science',   'woman', true),
  (5,  'Kabir',   4, 'Civil',              'man',   false),
  (6,  'Meera',   3, 'Chemical',           'woman', false),
  (7,  'Rohan',   2, 'Electrical',         'man',   false),
  (8,  'Saanvi',  1, 'Biotechnology',      'woman', false),
  (9,  'Arjun',   3, 'Computer Science',   'man',   false),
  (10, 'Tanvi',   4, 'Engineering Physics','woman', false),
  (11, 'Vihaan',  2, 'Mathematics',        'man',   false),
  (12, 'Kavya',   4, 'Humanities',         'woman', false);

create function pg_temp.uid(n int) returns uuid language sql immutable as
  $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(n), 'authenticated', 'authenticated',
       lower(first_name) || '@example.edu', '', now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now(),
       '', '', '', '', '', '', '', ''
from seed_people;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select pg_temp.uid(n)::text, pg_temp.uid(n),
       jsonb_build_object('sub', pg_temp.uid(n)::text, 'email', lower(first_name) || '@example.edu', 'email_verified', true),
       'email', now(), now(), now()
from seed_people;

-- The auth trigger created both profile rows; fill in the optional fields.
update public.public_profiles p set first_name = s.first_name, year = s.year
  from seed_people s where p.user_id = pg_temp.uid(s.n);
update public.private_profiles p set full_name = s.first_name || ' (fictional)', branch = s.branch,
       gender = s.gender, women_only_optin = s.optin
  from seed_people s where p.user_id = pg_temp.uid(s.n);
update public.public_profiles set id_checked = true, id_checked_on = current_date - 3
 where user_id in (pg_temp.uid(2), pg_temp.uid(5));

insert into public.admins values (pg_temp.uid(12));  -- Kavya moderates the demo

-- Trips. t(n): trip uuid; day offsets from today on campus.
create function pg_temp.tid(n int) returns uuid language sql immutable as
  $$ select ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid $$;

do $$
declare d date := (now() at time zone 'Asia/Kolkata')::date; c uuid := '00000000-0000-4000-8000-0000000000c1';
begin
  insert into public.trips (id, owner_id, college_id, mode, from_hub, from_point, to_hub, to_point,
                            travel_date, depart_start, depart_end, women_only, status) values
  -- Campus -> Delhi, day +2: dense (7 students, shows a real count)
  (pg_temp.tid(1),  pg_temp.uid(1),  c, 'train', 'Demo Campus', 'Main Gate',  'Delhi', 'New Delhi Rly Stn',  d+2, '18:00', '19:30', false, 'live'),
  (pg_temp.tid(2),  pg_temp.uid(3),  c, 'train', 'Demo Campus', 'Main Gate',  'Delhi', 'New Delhi Rly Stn',  d+2, '18:15', '19:00', false, 'live'),
  (pg_temp.tid(3),  pg_temp.uid(5),  c, 'bus',   'Demo Campus', 'North Gate', 'Delhi', 'ISBT Kashmere Gate', d+2, '17:00', '18:00', false, 'live'),
  (pg_temp.tid(4),  pg_temp.uid(7),  c, 'cab',   'Demo Campus', 'Hostel 4',   'Delhi', 'Anand Vihar',        d+2, '18:30', '20:00', false, 'live'),
  (pg_temp.tid(5),  pg_temp.uid(9),  c, 'train', 'Demo Campus', 'Main Gate',  'Delhi', 'New Delhi Rly Stn',  d+2, '21:00', '22:00', false, 'live'),
  (pg_temp.tid(6),  pg_temp.uid(11), c, 'bus',   'Demo Campus', 'North Gate', 'Delhi', 'ISBT Kashmere Gate', d+2, '08:00', '09:00', false, 'live'),
  (pg_temp.tid(7),  pg_temp.uid(6),  c, 'train', 'Demo Campus', 'Main Gate',  'Delhi', 'New Delhi Rly Stn',  d+2, '18:00', '19:30', false, 'live'),
  -- Campus -> Delhi, day +3: 2 students (suppressed as "low demand")
  (pg_temp.tid(8),  pg_temp.uid(2),  c, 'train', 'Demo Campus', 'Main Gate',  'Delhi', 'New Delhi Rly Stn',  d+3, '10:00', '11:30', false, 'live'),
  (pg_temp.tid(9),  pg_temp.uid(10), c, 'bus',   'Demo Campus', 'North Gate', 'Delhi', 'ISBT Kashmere Gate', d+3, '14:00', '15:00', false, 'live'),
  -- Campus -> Chandigarh, day +4: 5 counted + 2 women-only (never counted)
  (pg_temp.tid(10), pg_temp.uid(4),  c, 'bus',   'Demo Campus', 'Main Gate',  'Chandigarh', 'ISBT Sector 43', d+4, '09:00', '10:30', true,  'live'),
  (pg_temp.tid(11), pg_temp.uid(2),  c, 'bus',   'Demo Campus', 'Main Gate',  'Chandigarh', 'ISBT Sector 43', d+4, '09:30', '10:30', true,  'live'),
  (pg_temp.tid(12), pg_temp.uid(8),  c, 'train', 'Demo Campus', 'Main Gate',  'Chandigarh', 'Chandigarh Jn',  d+4, '07:00', '08:00', false, 'live'),
  (pg_temp.tid(13), pg_temp.uid(10), c, 'train', 'Demo Campus', 'Main Gate',  'Chandigarh', 'Chandigarh Jn',  d+4, '07:15', '08:00', false, 'live'),
  (pg_temp.tid(14), pg_temp.uid(12), c, 'bus',   'Demo Campus', 'North Gate', 'Chandigarh', 'ISBT Sector 43', d+4, '09:00', '10:00', false, 'live'),
  (pg_temp.tid(15), pg_temp.uid(6),  c, 'cab',   'Demo Campus', 'Hostel 4',   'Chandigarh', 'Sector 17',      d+4, '11:00', '12:00', false, 'live'),
  (pg_temp.tid(16), pg_temp.uid(1),  c, 'bus',   'Demo Campus', 'North Gate', 'Chandigarh', 'ISBT Sector 43', d+4, '16:00', '17:00', false, 'live'),
  -- Campus -> airport, day +1
  (pg_temp.tid(17), pg_temp.uid(9),  c, 'flight','Demo Campus', 'Main Gate',  'Demo Airport', 'Departures T1', d+1, '05:00', '06:00', false, 'live'),
  (pg_temp.tid(18), pg_temp.uid(11), c, 'cab',   'Demo Campus', 'Main Gate',  'Demo Airport', 'Departures T1', d+1, '05:30', '06:30', false, 'live'),
  (pg_temp.tid(19), pg_temp.uid(3),  c, 'cab',   'Demo Campus', 'Hostel 4',   'Demo Airport', 'Departures T1', d+1, '13:00', '14:00', false, 'live'),
  -- Return leg, day +8
  (pg_temp.tid(20), pg_temp.uid(5),  c, 'bus',   'Delhi', 'ISBT Kashmere Gate', 'Demo Campus', 'North Gate', d+8, '06:00', '07:00', false, 'live'),
  -- Last week's trip that Aarav and Kabir took together
  (pg_temp.tid(21), pg_temp.uid(1),  c, 'bus',   'Demo Campus', 'North Gate', 'Delhi', 'ISBT Kashmere Gate', d-5, '17:00', '18:00', false, 'archived'),
  (pg_temp.tid(22), pg_temp.uid(5),  c, 'bus',   'Demo Campus', 'North Gate', 'Delhi', 'ISBT Kashmere Gate', d-5, '17:15', '18:00', false, 'archived');
end $$;

insert into public.private_trip_details (trip_id, vehicle_no, meetup_point, notes) values
  (pg_temp.tid(1),  '12046', 'Main Gate auto stand', 'Carrying one big suitcase.'),
  (pg_temp.tid(2),  '12046', 'Main Gate', null),
  (pg_temp.tid(3),  null, 'North Gate tea stall', null),
  (pg_temp.tid(4),  null, 'Hostel 4 parking', 'Happy to split the cab with up to two people.'),
  (pg_temp.tid(5),  '12458', null, null),
  (pg_temp.tid(6),  null, null, null),
  (pg_temp.tid(7),  '12046', null, 'Coach B2 if anyone is nearby.'),
  (pg_temp.tid(8),  '12058', null, null),
  (pg_temp.tid(9),  null, null, null),
  (pg_temp.tid(10), null, 'Main Gate', null),
  (pg_temp.tid(11), null, 'Main Gate', 'Leaving straight after the 8:30 lab.'),
  (pg_temp.tid(12), '12011', 'Main Gate', null),
  (pg_temp.tid(13), '12011', 'Main Gate', 'Can share the auto to the station.'),
  (pg_temp.tid(14), null, null, null),
  (pg_temp.tid(15), null, 'Hostel 4', null),
  (pg_temp.tid(16), null, null, null),
  (pg_temp.tid(17), '6E 2134', 'Main Gate', 'Early flight - booking a cab at 4:45.'),
  (pg_temp.tid(18), null, 'Main Gate', null),
  (pg_temp.tid(19), null, null, null),
  (pg_temp.tid(20), null, null, null),
  (pg_temp.tid(21), null, 'North Gate tea stall', null),
  (pg_temp.tid(22), null, 'North Gate tea stall', null);

-- Connections and requests.
insert into public.matches (id, requester_trip_id, addressee_trip_id, requester_id, addressee_id, status,
                            created_at, responded_at, expires_at) values
  -- Aarav <-> Ishaan, same train, accepted
  ('00000000-0000-4000-a000-000000000001', pg_temp.tid(2), pg_temp.tid(1), pg_temp.uid(3), pg_temp.uid(1),
   'accepted', now() - interval '20 hours', now() - interval '18 hours', now() + interval '28 hours'),
  -- Saanvi <-> Tanvi, same train to Chandigarh, accepted
  ('00000000-0000-4000-a000-000000000002', pg_temp.tid(12), pg_temp.tid(13), pg_temp.uid(8), pg_temp.uid(10),
   'accepted', now() - interval '30 hours', now() - interval '29 hours', now() + interval '18 hours'),
  -- Meera -> Aarav, pending (Aarav sees an incoming request)
  ('00000000-0000-4000-a000-000000000003', pg_temp.tid(7), pg_temp.tid(1), pg_temp.uid(6), pg_temp.uid(1),
   'pending', now() - interval '5 hours', null, now() + interval '43 hours'),
  -- Kabir -> Rohan, pending (Kabir sees an outgoing request)
  ('00000000-0000-4000-a000-000000000004', pg_temp.tid(3), pg_temp.tid(4), pg_temp.uid(5), pg_temp.uid(7),
   'pending', now() - interval '17 hours', null, now() + interval '31 hours'),
  -- Aarav <-> Kabir, last week, both confirmed "we travelled together"
  ('00000000-0000-4000-a000-000000000005', pg_temp.tid(21), pg_temp.tid(22), pg_temp.uid(1), pg_temp.uid(5),
   'accepted', now() - interval '8 days', now() - interval '8 days', now() - interval '6 days');

insert into public.messages (match_id, sender_id, client_id, body, created_at) values
  ('00000000-0000-4000-a000-000000000001', pg_temp.uid(3), gen_random_uuid(), 'Hey! Saw we''re on the same train on Friday.', now() - interval '17 hours'),
  ('00000000-0000-4000-a000-000000000001', pg_temp.uid(1), gen_random_uuid(), 'Nice. Want to share an auto to the station? I''m leaving from Main Gate around 5:15.', now() - interval '16 hours'),
  ('00000000-0000-4000-a000-000000000001', pg_temp.uid(3), gen_random_uuid(), 'Works for me. Are you at the north gate or main?', now() - interval '15 hours'),
  ('00000000-0000-4000-a000-000000000001', pg_temp.uid(1), gen_random_uuid(), 'Main gate, by the auto stand.', now() - interval '15 hours'),
  ('00000000-0000-4000-a000-000000000002', pg_temp.uid(8), gen_random_uuid(), 'Hi Tanvi, I''m in coach C1 on the 12011.', now() - interval '28 hours'),
  ('00000000-0000-4000-a000-000000000002', pg_temp.uid(10), gen_random_uuid(), 'Same coach, I think. Meet at Main Gate at 6:15?', now() - interval '27 hours'),
  ('00000000-0000-4000-a000-000000000002', pg_temp.uid(8), gen_random_uuid(), 'Train''s 20 min late btw, just checked.', now() - interval '3 hours');

insert into public.travel_confirmations (match_id, confirmer_id) values
  ('00000000-0000-4000-a000-000000000005', pg_temp.uid(1)),
  ('00000000-0000-4000-a000-000000000005', pg_temp.uid(5));

-- One open report so the admin queue has a real state.
insert into public.reports (reporter_id, reported_user_id, context, reason) values
  (pg_temp.uid(7), pg_temp.uid(11), 'profile', 'Kept messaging after I said I''d already found someone.');
