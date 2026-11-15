-- Dealora database. Run this whole file in Supabase: SQL Editor > New query > paste > Run.
-- It is safe to run again later (it only adds or replaces things). Security rules live here
-- (Row Level Security), so they hold even if someone edits the website code in their browser.
--
-- Rules in short:
--   * Signed out: sees deals WITHOUT the code and link.
--   * Registered (confirmed email): sees codes and links, adds coupons, writes reviews (all need admin approval).
--   * Verified (paid once): everything above + Verified User badge, real-time deal emails, personal page.

create extension if not exists pgcrypto;

-- ============ members ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('member','admin')),
  paid boolean not null default false,          -- Verified User
  paid_at timestamptz,
  paypal_order_id text unique,
  created_at timestamptz not null default now()
);
-- consents and preferences (added with "if not exists" so this file also upgrades an older database)
alter table public.profiles add column if not exists marketing boolean not null default false;
alter table public.profiles add column if not exists marketing_consent_at timestamptz;
alter table public.profiles add column if not exists magazine boolean not null default false;
alter table public.profiles add column if not exists magazine_consent_at timestamptz;
alter table public.profiles add column if not exists realtime_off boolean not null default false; -- Verified user paused real-time emails
alter table public.profiles add column if not exists interests jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists country text check (country is null or country ~ '^[A-Z]{2}$'); -- where the member lives, used to segment emails

alter table public.profiles add column if not exists username text check (username is null or username ~ '^[A-Za-z0-9_]{3,20}$');
alter table public.profiles add column if not exists username_changed_at timestamptz; -- last time the name was changed (limit: once a month)
alter table public.profiles add column if not exists points int not null default 0 check (points >= 0);
create unique index if not exists profiles_username_lower on public.profiles (lower(username));
-- Chat limit: when true, every chat message of this member waits for the admin's approval (set by the admin, or automatically after flooding).
alter table public.profiles add column if not exists board_restricted boolean not null default false;

-- Emails of members the admin removed for bad behaviour. They cannot join again with the same email.
create table if not exists public.removed_members (
  email text primary key,
  reason text check (char_length(reason) <= 300),
  removed_at timestamptz not null default now()
);
alter table public.removed_members enable row level security;

-- Usernames: 3-20 letters, numbers or underscore; a few names are reserved.
create or replace function public.username_ok(u text) returns boolean
language sql immutable as $$
  select u ~ '^[A-Za-z0-9_]{3,20}$'
     and lower(u) not in ('admin','administrator','dealora','support','staff','moderator','mod','team','official','root','system','help','info','contact','owner','verified','security','billing');
$$;

-- Lets the sign-up form check a name before submitting (works for signed-out visitors).
create or replace function public.username_available(u text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.username_ok(u) and not exists (select 1 from public.profiles where lower(username) = lower(u));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Verified (paid) member or admin
create or replace function public.is_paid() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and (paid or role = 'admin'));
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  mk boolean := coalesce((new.raw_user_meta_data->>'marketing')::boolean, false);
  mg boolean := coalesce((new.raw_user_meta_data->>'magazine')::boolean, false);
  cc text := upper(nullif(new.raw_user_meta_data->>'country', ''));
  un text := nullif(trim(new.raw_user_meta_data->>'username'), '');
begin
  if exists (select 1 from public.removed_members where email = lower(new.email)) then
    raise exception 'This email address cannot be used to join Dealora.';
  end if;
  if cc is not null and cc !~ '^[A-Z]{2}$' then cc := null; end if;
  if un is not null and not public.username_ok(un) then un := null; end if;
  begin
    insert into public.profiles (id, email, marketing, marketing_consent_at, magazine, magazine_consent_at, country, username)
    values (new.id, new.email, mk, case when mk then now() end, mg, case when mg then now() end, cc, un);
  exception when unique_violation then
    -- someone took the name a moment earlier: sign-up still works, the member can pick a name later
    insert into public.profiles (id, email, marketing, marketing_consent_at, magazine, magazine_consent_at, country)
    values (new.id, new.email, mk, case when mk then now() end, mg, case when mg then now() end, cc);
  end;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Members can never change paid / role / email / payment fields themselves.
create or replace function public.protect_profile() returns trigger
language plpgsql as $$
begin
  if current_user not in ('postgres','supabase_admin','service_role') and not public.is_admin() then
    if new.paid is distinct from old.paid or new.role is distinct from old.role
       or new.email is distinct from old.email or new.paid_at is distinct from old.paid_at
       or new.paypal_order_id is distinct from old.paypal_order_id or new.points is distinct from old.points
       or new.board_restricted is distinct from old.board_restricted
       or new.magazine_last_sent_at is distinct from old.magazine_last_sent_at then
      raise exception 'not allowed';
    end if;
    if new.username_changed_at is distinct from old.username_changed_at then
      new.username_changed_at := old.username_changed_at; -- only this trigger sets it
    end if;
    if new.username is distinct from old.username and new.username is not null and not public.username_ok(new.username) then
      raise exception 'username not allowed';
    end if;
    -- A member may change an existing username once a month (choosing a first name, or only changing letter case, is free).
    if old.username is not null and new.username is distinct from old.username and lower(coalesce(new.username, '')) <> lower(old.username) then
      if old.username_changed_at is not null and now() < old.username_changed_at + interval '30 days' then
        raise exception 'username can be changed once a month';
      end if;
      new.username_changed_at := now();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_trg on public.profiles;
create trigger protect_profile_trg before update on public.profiles
  for each row execute function public.protect_profile();

alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles for delete using (public.is_admin());

-- ============ collections ============
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) <= 60),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.collections enable row level security;
drop policy if exists collections_read on public.collections;
create policy collections_read on public.collections for select using (true);
drop policy if exists collections_admin on public.collections;
create policy collections_admin on public.collections for all using (public.is_admin()) with check (public.is_admin());

-- ============ coupons (only the admin writes) ============
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  store text not null check (char_length(store) <= 60),
  discount_text text not null check (char_length(discount_text) <= 30),
  description text not null check (char_length(description) <= 140),
  code text check (char_length(code) <= 40),
  url text check (url is null or url ~* '^https?://'),
  category text not null default 'Fashion',
  type text not null default 'verified' check (type in ('verified','community')),
  used_text text,
  expires_on date,
  country text not null default 'WW',
  area text check (char_length(area) <= 120),
  collection_ids uuid[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.coupons add column if not exists image_path text;
alter table public.coupons enable row level security;
-- Full coupon (code + link): any signed-in, email-confirmed member.
drop policy if exists coupons_paid_read on public.coupons;
drop policy if exists coupons_member_read on public.coupons;
create policy coupons_member_read on public.coupons for select to authenticated
  using (active and (expires_on is null or expires_on >= current_date));
drop policy if exists coupons_admin on public.coupons;
create policy coupons_admin on public.coupons for all using (public.is_admin()) with check (public.is_admin());

-- Everyone (even signed out) sees a teaser WITHOUT the code and the link.
-- the picture column is last, so this also upgrades an older database
create or replace view public.coupons_public as
  select id, store, discount_text, description, category, type, used_text, expires_on, country, area, collection_ids, created_at, image_path
  from public.coupons
  where active and (expires_on is null or expires_on >= current_date);
grant select on public.coupons_public to anon, authenticated;

-- ============ categories (the row of icons on the home page; the admin manages them) ============
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 30),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists categories_name_lower on public.categories (lower(name));
alter table public.categories enable row level security;
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using (true);
drop policy if exists categories_admin on public.categories;
create policy categories_admin on public.categories for all using (public.is_admin()) with check (public.is_admin());
insert into public.categories (name, sort) values ('Fashion',1),('Electronics',2),('Travel',3),('Food',4),('Home',5),('Beauty',6)
  on conflict do nothing;

-- ============ community submissions: recommendations and reviews ============
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('rec','review')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  store text not null check (char_length(store) <= 60),
  description text check (char_length(description) <= 140),
  code text check (char_length(code) <= 40),
  url text check (url is null or url ~* '^https?://'),
  original_url text,
  category text,
  country text not null default 'WW',
  area text check (char_length(area) <= 60),
  collection_id uuid references public.collections(id) on delete set null,
  collection_other text check (char_length(collection_other) <= 120),
  image_path text,
  coupon_id uuid references public.coupons(id) on delete cascade,
  rating int check (rating between 1 and 5),
  report text check (report in ('worked','failed','expired')),
  body text check (char_length(body) <= 500),
  terms_version text,
  terms_at timestamptz,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  -- A link can only be stored together with the accepted Link Submission Terms.
  constraint link_needs_terms check (url is null or (terms_version is not null and terms_at is not null))
);
alter table public.submissions add column if not exists category_other text check (char_length(category_other) <= 30);
-- Automatic link check (filled in by the server, never by members or the browser).
alter table public.submissions add column if not exists link_check text not null default 'none'
  check (link_check in ('none','pending','safe','unsafe','broken','unverified'));
alter table public.submissions add column if not exists link_check_note text;
alter table public.submissions add column if not exists link_checked_url text;
alter table public.submissions add column if not exists link_checked_at timestamptz;

create or replace function public.guard_submission_link() returns trigger
language plpgsql as $$
begin
  if current_user not in ('postgres','supabase_admin','service_role') then
    if tg_op = 'INSERT' then
      new.link_check := case when new.url is null then 'none' else 'pending' end;
      new.link_check_note := null; new.link_checked_url := null; new.link_checked_at := null;
    elsif new.url is distinct from old.url then
      new.link_check := case when new.url is null then 'none' else 'pending' end;
      new.link_check_note := null; new.link_checked_url := null; new.link_checked_at := null;
    else
      new.link_check := old.link_check; new.link_check_note := old.link_check_note;
      new.link_checked_url := old.link_checked_url; new.link_checked_at := old.link_checked_at;
    end if;
  end if;
  -- Nothing with a link goes live unless that exact link was checked and found safe.
  if new.status = 'approved' and new.url is not null and (tg_op = 'INSERT' or old.status is distinct from 'approved')
     and not (new.link_check = 'safe' and new.link_checked_url = new.url) then
    raise exception 'link not verified safe';
  end if;
  return new;
end $$;
drop trigger if exists guard_submission_link_trg on public.submissions;
create trigger guard_submission_link_trg before insert or update on public.submissions
  for each row execute function public.guard_submission_link();
-- Links that existed before this check was added must be checked again.
update public.submissions set link_check = 'pending' where url is not null and link_check = 'none';

alter table public.submissions enable row level security;
-- Any signed-in member may submit. Nothing shows publicly until the admin approves it.
drop policy if exists submissions_insert on public.submissions;
create policy submissions_insert on public.submissions for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
drop policy if exists submissions_read on public.submissions;
create policy submissions_read on public.submissions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists submissions_admin on public.submissions;
create policy submissions_admin on public.submissions for all using (public.is_admin()) with check (public.is_admin());

-- Approved content for signed-out visitors: no code, no link.
create or replace view public.community_public as
  select id, kind, store, description, category, country, area, image_path, coupon_id, rating, report, body, created_at,
         (select p.paid or p.role = 'admin' from public.profiles p where p.id = submissions.user_id) as author_verified,
         (select p.username from public.profiles p where p.id = submissions.user_id) as author_name
  from public.submissions where status = 'approved';
grant select on public.community_public to anon, authenticated;

-- Approved content for signed-in members: with code and link. A link is only shown if it passed the safety check.
create or replace view public.community_members as
  select id, kind, store, description, code,
         case when link_check = 'safe' and link_checked_url = url then url end as url,
         category, country, area, image_path, coupon_id, rating, report, body, created_at,
         (select p.paid or p.role = 'admin' from public.profiles p where p.id = submissions.user_id) as author_verified,
         (select p.username from public.profiles p where p.id = submissions.user_id) as author_name
  from public.submissions where status = 'approved';
revoke all on public.community_members from anon;
grant select on public.community_members to authenticated;

-- ============ personal page picks for Verified users (written by the admin, monthly) ============
create table if not exists public.personal_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  coupon_ids uuid[] not null default '{}',
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id, month)
);
alter table public.personal_picks enable row level security;
drop policy if exists picks_own on public.personal_picks;
create policy picks_own on public.personal_picks for select using (user_id = auth.uid() and public.is_paid());
drop policy if exists picks_admin on public.personal_picks;
create policy picks_admin on public.personal_picks for all using (public.is_admin()) with check (public.is_admin());

-- ============ member activity (searches, codes revealed/copied, links opened) ============
-- Members write only their own rows. Only the admin can read them.
create table if not exists public.member_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('search','category','region','reveal','copy','open')),
  coupon_id uuid references public.coupons(id) on delete set null,
  store text check (char_length(store) <= 80),
  detail text check (char_length(detail) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists member_activity_user_idx on public.member_activity (user_id, created_at desc);
alter table public.member_activity enable row level security;
drop policy if exists activity_insert on public.member_activity;
create policy activity_insert on public.member_activity for insert to authenticated with check (user_id = auth.uid());
drop policy if exists activity_admin on public.member_activity;
create policy activity_admin on public.member_activity for select using (public.is_admin());

-- ============ rewards points (the admin adds or removes points; each change is logged) ============
create table if not exists public.points_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta int not null check (delta <> 0 and abs(delta) <= 100000),
  reason text check (char_length(reason) <= 200),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists points_log_user_idx on public.points_log (user_id, created_at desc);
-- Automatic points: 1 point when a shared coupon is approved, 1 point when a review is approved.
-- submission_id is only a note (no link), so the points stay if the coupon or review is deleted later.
-- The unique index gives a submission its point only once, even if it is approved again.
alter table public.points_log add column if not exists submission_id uuid;
create unique index if not exists points_log_sub_uq on public.points_log (submission_id) where submission_id is not null;
create or replace function public.apply_points() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set points = points + new.delta where id = new.user_id;
  return new;
end $$;
create or replace function public.award_submission_points() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    insert into public.points_log (user_id, delta, reason, submission_id)
    values (new.user_id, 1, left(case when new.kind = 'review' then 'Review approved: ' else 'Shared coupon approved: ' end || new.store, 200), new.id)
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists award_submission_points_trg on public.submissions;
create trigger award_submission_points_trg after insert or update of status on public.submissions for each row execute function public.award_submission_points();
drop trigger if exists apply_points_trg on public.points_log;
create trigger apply_points_trg after insert on public.points_log for each row execute function public.apply_points();
alter table public.points_log enable row level security;
drop policy if exists points_own on public.points_log;
create policy points_own on public.points_log for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists points_admin_insert on public.points_log;
create policy points_admin_insert on public.points_log for insert with check (public.is_admin());

-- ============ staff admins (limited helpers) ============
-- role 'admin' = the main admin (owner): can do everything and is the only one who can create or limit staff.
-- role 'staff' = a limited admin. What a staff member may do is set in staff_access:
--   countries: the countries they work on ('*' = all countries, 'WW' = worldwide deals); empty = none yet.
--   perm_*: what they may do. Everything defaults to off.
-- These limits are enforced here in the database, not only in the admin screen.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('member','admin','staff'));

create table if not exists public.staff_access (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  countries text[] not null default '{}',
  perm_coupons boolean not null default false,      -- add/edit/hide coupons
  perm_collections boolean not null default false,  -- manage collections
  perm_approve boolean not null default false,      -- approve / reject member submissions
  perm_links boolean not null default false,        -- replace links members sent
  perm_members boolean not null default false,      -- see members, activity and email lists
  perm_points boolean not null default false,       -- add points (needs perm_members to open the member)
  perm_picks boolean not null default false,        -- prepare personal pages (needs perm_members)
  updated_at timestamptz not null default now()
);
alter table public.staff_access add column if not exists perm_delete_coupons boolean not null default false; -- delete coupons of their countries
alter table public.staff_access add column if not exists perm_stores boolean not null default false; -- add / edit stores, their pictures and their order
alter table public.staff_access enable row level security;
drop policy if exists staff_access_select on public.staff_access;
create policy staff_access_select on public.staff_access for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists staff_access_owner on public.staff_access;
create policy staff_access_owner on public.staff_access for all using (public.is_admin()) with check (public.is_admin());

-- true for the main admin, or for a staff member who has this permission for this country.
-- ctry = null means "no country check" (used for collections only).
create or replace function public.staff_can(perm text, ctry text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.staff_access sa join public.profiles p on p.id = sa.user_id
    where sa.user_id = auth.uid() and p.role = 'staff'
      and case perm when 'coupons' then sa.perm_coupons when 'delete_coupons' then sa.perm_delete_coupons when 'collections' then sa.perm_collections
                    when 'approve' then sa.perm_approve when 'links' then sa.perm_links when 'stores' then sa.perm_stores
                    when 'members' then sa.perm_members when 'points' then sa.perm_points
                    when 'picks' then sa.perm_picks else false end
      and (ctry is null or '*' = any (sa.countries) or ctry = any (sa.countries))
  );
$$;
-- a member's country ('??' when not set: only staff with all countries match)
create or replace function public.profile_country(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select country from public.profiles where id = uid), '??');
$$;
-- the country a submission belongs to (a review belongs to its coupon's country)
create or replace function public.sub_country(cid uuid, ctry text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select country from public.coupons where id = cid), ctry, 'WW');
$$;

-- coupons: staff may see, add and edit coupons of their countries; deleting needs its own permission
drop policy if exists coupons_staff_select on public.coupons;
create policy coupons_staff_select on public.coupons for select using (public.staff_can('coupons', country));
drop policy if exists coupons_staff_insert on public.coupons;
create policy coupons_staff_insert on public.coupons for insert with check (public.staff_can('coupons', country));
drop policy if exists coupons_staff_update on public.coupons;
create policy coupons_staff_update on public.coupons for update using (public.staff_can('coupons', country)) with check (public.staff_can('coupons', country));

drop policy if exists coupons_staff_delete on public.coupons;
create policy coupons_staff_delete on public.coupons for delete using (public.staff_can('delete_coupons', country));

-- ============ stores (picture, text and order of the "Popular Stores" area) ============
-- sort is empty for the automatic order (most coupons first). The admin can put stores in their own order and go back to automatic.
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  description text check (char_length(description) <= 300),
  image_path text,
  sort int,
  created_at timestamptz not null default now()
);
create unique index if not exists stores_name_lower on public.stores (lower(name));
alter table public.stores enable row level security;
drop policy if exists stores_read on public.stores;
create policy stores_read on public.stores for select using (true);
drop policy if exists stores_admin on public.stores;
create policy stores_admin on public.stores for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists stores_staff_ins on public.stores;
create policy stores_staff_ins on public.stores for insert with check (public.staff_can('stores', null));
drop policy if exists stores_staff_upd on public.stores;
create policy stores_staff_upd on public.stores for update using (public.staff_can('stores', null)) with check (public.staff_can('stores', null));

drop policy if exists collections_staff on public.collections;
create policy collections_staff on public.collections for all using (public.staff_can('collections', null)) with check (public.staff_can('collections', null));

-- submissions: staff see and change only the submissions of their countries, and only what their permissions allow
drop policy if exists submissions_staff_select on public.submissions;
create policy submissions_staff_select on public.submissions for select
  using (public.staff_can('approve', public.sub_country(coupon_id, country)) or public.staff_can('links', public.sub_country(coupon_id, country)));
drop policy if exists submissions_staff_update on public.submissions;
create policy submissions_staff_update on public.submissions for update
  using (public.staff_can('approve', public.sub_country(coupon_id, country)) or public.staff_can('links', public.sub_country(coupon_id, country)))
  with check (public.staff_can('approve', public.sub_country(coupon_id, country)) or public.staff_can('links', public.sub_country(coupon_id, country)));

create or replace function public.guard_staff_submission() returns trigger
language plpgsql as $$
declare
  skip text[] := array['status','reviewed_at','url','original_url','terms_version','terms_at','link_check','link_check_note','link_checked_url','link_checked_at'];
  sc text := public.sub_country(old.coupon_id, old.country);
begin
  if current_user in ('postgres','supabase_admin','service_role') or public.is_admin() then return new; end if;
  if (to_jsonb(new) - skip) is distinct from (to_jsonb(old) - skip) then
    raise exception 'staff may only change the status or the link';
  end if;
  if new.status is distinct from old.status and not public.staff_can('approve', sc) then
    raise exception 'no permission to approve or reject';
  end if;
  if (new.url is distinct from old.url or new.original_url is distinct from old.original_url) and not public.staff_can('links', sc) then
    raise exception 'no permission to replace links';
  end if;
  return new;
end $$;
drop trigger if exists guard_staff_submission_trg on public.submissions;
create trigger guard_staff_submission_trg before update on public.submissions
  for each row execute function public.guard_staff_submission();

-- members: staff with the members permission see members of their countries (not other admins)
drop policy if exists profiles_staff_select on public.profiles;
create policy profiles_staff_select on public.profiles for select
  using (role = 'member' and public.staff_can('members', coalesce(country, '??')));
drop policy if exists activity_staff on public.member_activity;
create policy activity_staff on public.member_activity for select using (public.staff_can('members', public.profile_country(user_id)));
drop policy if exists picks_staff on public.personal_picks;
create policy picks_staff on public.personal_picks for all
  using (public.staff_can('picks', public.profile_country(user_id))) with check (public.staff_can('picks', public.profile_country(user_id)));
drop policy if exists points_staff_select on public.points_log;
create policy points_staff_select on public.points_log for select using (public.staff_can('points', public.profile_country(user_id)));
drop policy if exists points_staff_insert on public.points_log;
create policy points_staff_insert on public.points_log for insert with check (public.staff_can('points', public.profile_country(user_id)));

-- ============ community board (a bulletin board the admin controls) ============
-- Only the admin writes posts. Posts never contain coupon codes or links (those stay for members).
-- Members can reply or vote only where the admin opened a post, and replies appear only after approval.
create or replace function public.site_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'members', (select count(*) from public.profiles where role <> 'admin'),
    'verified', (select count(*) from public.profiles where paid));
$$;
grant execute on function public.site_stats() to anon, authenticated;

create table if not exists public.board_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'announcement' check (kind in ('announcement','coupon','review','member','question','poll')),
  title text not null check (char_length(title) between 1 and 100),
  body text check (char_length(body) <= 1000),
  store text check (char_length(store) <= 60),
  coupon_id uuid references public.coupons(id) on delete set null,   -- "see this deal" jump (the deal itself stays gated)
  pinned boolean not null default false,
  replies_open boolean not null default false,
  poll_options text[] check (poll_options is null or cardinality(poll_options) between 2 and 6),
  status text not null default 'published' check (status in ('published','closed','hidden')), -- closed = visible, no new replies or votes
  created_at timestamptz not null default now()
);
create index if not exists board_posts_idx on public.board_posts (pinned desc, created_at desc);
-- Chat mode: 'moderated' = every reply waits for your approval; 'free' = replies show at once (members you restrict, and anyone who floods, still wait).
alter table public.board_posts add column if not exists chat_mode text not null default 'moderated' check (chat_mode in ('moderated','free'));
-- Posts that point at site content: a coupon (coupon_id), or a member's shared coupon / review (submission_id).
-- The content itself is read from its own table, so the code and link stay hidden from visitors exactly as on the site.
alter table public.board_posts add column if not exists submission_id uuid references public.submissions(id) on delete cascade;
alter table public.board_posts drop constraint if exists board_posts_kind_check;
alter table public.board_posts add constraint board_posts_kind_check check (kind in ('announcement','coupon','rec','review','member','question','poll'));
create unique index if not exists board_posts_coupon_uq on public.board_posts (coupon_id) where coupon_id is not null and kind = 'coupon';
create unique index if not exists board_posts_sub_uq on public.board_posts (submission_id) where submission_id is not null;
alter table public.board_posts enable row level security;
drop policy if exists board_posts_read on public.board_posts;
create policy board_posts_read on public.board_posts for select using (status in ('published','closed') or public.is_admin());
drop policy if exists board_posts_admin on public.board_posts;
create policy board_posts_admin on public.board_posts for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.board_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.board_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists board_comments_post_idx on public.board_comments (post_id, created_at);

create or replace function public.board_replies_open(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.board_posts where id = pid and status = 'published' and replies_open);
$$;
-- The database decides whether a reply shows at once or waits for approval. The browser cannot choose.
--   * Admin replies: shown at once.
--   * A restricted member, or a post in 'moderated' mode: waits for approval.
--   * A post in 'free' mode: shown at once, but a member may not send more than 3 messages in a row
--     (nobody else writing in between). The next message waits for approval and the member becomes restricted.
create or replace function public.guard_board_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare m text; r boolean; rl text; n int;
begin
  select chat_mode into m from public.board_posts where id = new.post_id;
  select board_restricted, role into r, rl from public.profiles where id = new.user_id;
  new.status := 'pending';
  if rl = 'admin' then
    new.status := 'approved';
  elsif not coalesce(r, false) and m = 'free' then
    select count(*) into n from (
      select user_id from public.board_comments where post_id = new.post_id and status <> 'rejected' order by created_at desc limit 3
    ) t where t.user_id = new.user_id;
    if n >= 3 then
      update public.profiles set board_restricted = true where id = new.user_id;
    else
      new.status := 'approved';
    end if;
  end if;
  if new.status = 'pending' and (select count(*) from public.board_comments where user_id = new.user_id and status = 'pending') >= 5 then
    raise exception 'too many replies waiting for approval';
  end if;
  return new;
end $$;
drop trigger if exists guard_board_comment_trg on public.board_comments;
create trigger guard_board_comment_trg before insert on public.board_comments for each row execute function public.guard_board_comment();

alter table public.board_comments enable row level security;
drop policy if exists board_comments_insert on public.board_comments;
create policy board_comments_insert on public.board_comments for insert to authenticated
  with check (user_id = auth.uid() and public.board_replies_open(post_id));
drop policy if exists board_comments_own on public.board_comments;
create policy board_comments_own on public.board_comments for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists board_comments_admin on public.board_comments;
create policy board_comments_admin on public.board_comments for all using (public.is_admin()) with check (public.is_admin());

-- Approved replies for everyone (with the author's username, never their id or email).
create or replace view public.board_comments_public as
  select c.id, c.post_id, c.body, c.created_at, p.username as author_name, (p.paid or p.role = 'admin') as author_verified
  from public.board_comments c join public.profiles p on p.id = c.user_id
  where c.status = 'approved';
grant select on public.board_comments_public to anon, authenticated;

create table if not exists public.board_votes (
  post_id uuid not null references public.board_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  choice int not null check (choice between 0 and 5),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create or replace function public.board_poll_open(pid uuid, ch int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.board_posts where id = pid and status = 'published' and poll_options is not null and ch < cardinality(poll_options));
$$;
alter table public.board_votes enable row level security;
drop policy if exists board_votes_own on public.board_votes;
create policy board_votes_own on public.board_votes for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists board_votes_insert on public.board_votes;
create policy board_votes_insert on public.board_votes for insert to authenticated with check (user_id = auth.uid() and public.board_poll_open(post_id, choice));
drop policy if exists board_votes_update on public.board_votes;
create policy board_votes_update on public.board_votes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.board_poll_open(post_id, choice));
create or replace view public.board_poll_counts as
  select post_id, choice, count(*)::int as votes from public.board_votes group by post_id, choice;
grant select on public.board_poll_counts to anon, authenticated;

drop policy if exists removed_members_admin on public.removed_members;
create policy removed_members_admin on public.removed_members for all using (public.is_admin()) with check (public.is_admin());

-- ============ link pre-check rate limit (used by the server only) ============
create table if not exists public.link_check_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists link_check_log_idx on public.link_check_log (user_id, created_at desc);
alter table public.link_check_log enable row level security; -- no policies: only the server (service role) can use it

-- ============ image storage ============
insert into storage.buckets (id, name, public) values ('deal-images', 'deal-images', true) on conflict (id) do nothing;
drop policy if exists deal_images_upload on storage.objects;
create policy deal_images_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'deal-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists deal_images_admin_delete on storage.objects;
create policy deal_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'deal-images' and public.is_admin());

-- ============ starter collections ============
insert into public.collections (name, sort)
select * from (values ('Trending Deals', 1), ('New This Week', 2), ('Staff Picks', 3)) v(name, sort)
where not exists (select 1 from public.collections);


-- ============ visitor counter, numbers shown on the site, monthly magazine ============
alter table public.profiles add column if not exists magazine_last_sent_at timestamptz;

-- One row per visitor per day. Nobody can read or write this table directly; only the functions below.
create table if not exists public.site_visits (
  day date not null,
  visitor text not null check (char_length(visitor) between 8 and 64),
  primary key (day, visitor)
);
alter table public.site_visits enable row level security;

create or replace function public.record_visit(v text) returns void
language sql security definer set search_path = public as $$
  insert into public.site_visits (day, visitor)
  select (now() at time zone 'Asia/Jerusalem')::date, v
  where v is not null and char_length(v) between 8 and 64
  on conflict do nothing;
$$;
grant execute on function public.record_visit(text) to anon, authenticated;

create or replace function public.visit_stats() returns json
language plpgsql stable security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return json_build_object(
    'today', (select count(*) from public.site_visits where day = d),
    'month', (select count(distinct visitor) from public.site_visits where day >= date_trunc('month', d)::date),
    'year',  (select count(distinct visitor) from public.site_visits where day >= date_trunc('year', d)::date),
    'all',   (select count(distinct visitor) from public.site_visits),
    'days',  (select coalesce(json_agg(json_build_object('day', g.day, 'n', coalesce(c.n, 0)) order by g.day desc), '[]'::json)
              from generate_series(d - 29, d, interval '1 day') as g(day)
              left join (select day, count(*) n from public.site_visits group by day) c on c.day = g.day::date));
end $$;
grant execute on function public.visit_stats() to authenticated;

-- Settings the admin edits (for example the member numbers shown on the site).
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists site_settings_admin on public.site_settings;
create policy site_settings_admin on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

-- The numbers visitors see. If you typed a number in the admin, it is shown instead of the real count.
create or replace function public.site_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'members', coalesce((select (value->>'members')::bigint from public.site_settings where key = 'display_numbers' and value->>'members' ~ '^[0-9]{1,9}$'),
                        (select count(*) from public.profiles where role <> 'admin')),
    'verified', coalesce((select (value->>'verified')::bigint from public.site_settings where key = 'display_numbers' and value->>'verified' ~ '^[0-9]{1,9}$'),
                         (select count(*) from public.profiles where paid)));
$$;
grant execute on function public.site_stats() to anon, authenticated;

-- The monthly magazine: one draft you edit, and published issues that get emailed.
create table if not exists public.magazine_issues (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Dealora Monthly' check (char_length(title) <= 80),
  intro text check (char_length(intro) <= 600),
  items jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists magazine_one_draft on public.magazine_issues (status) where status = 'draft';
alter table public.magazine_issues enable row level security;
drop policy if exists magazine_admin on public.magazine_issues;
create policy magazine_admin on public.magazine_issues for all using (public.is_admin()) with check (public.is_admin());

-- ============ make yourself admin (run AFTER you signed up on the site) ============
-- update public.profiles set role = 'admin' where email = 'YOUR_EMAIL_HERE';
