-- Run once in a new Supabase project using the SQL editor.
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 name text not null default 'Member' check(length(name) between 1 and 100),
 avatar_url text, vehicle text not null default '', wants_driver boolean not null default false,
 driver_approved boolean not null default false, role text not null default 'member' check(role in ('member','admin')),
 verification_status text not null default 'unverified' check(verification_status in ('unverified','pending','approved','rejected'))
);
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,name,wants_driver) values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'name',''),'Member'),100),coalesce(new.raw_user_meta_data->>'wants_driver'='true',false));return new;end;$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and role='admin');$$;
create table public.rides (
 id uuid primary key default gen_random_uuid(), driver_id uuid not null references profiles,
 from_city text not null, to_city text not null, pickup jsonb not null, dropoff jsonb not null,
 departure timestamptz not null, duration integer not null check(duration between 1 and 1440),
 price numeric(8,2) not null check(price>0 and price<=1000), seats integer not null check(seats between 0 and 8),
 status text not null default 'scheduled' check(status in ('scheduled','active','completed','cancelled')),
 check(from_city<>to_city)
);
create table public.bookings (
 id uuid primary key default gen_random_uuid(), ride_id uuid not null references rides on delete cascade,
 passenger_id uuid not null references profiles, status text not null default 'pending' check(status in ('pending','accepted','rejected','cancelled','completed')),
 created_at timestamptz not null default now(), unique(ride_id,passenger_id)
);
create table public.reviews (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null unique references bookings,
 driver_id uuid not null references profiles, author_id uuid not null default auth.uid() references profiles,
 rating integer not null check(rating between 1 and 5), driving integer not null check(driving between 1 and 5),
 chatty integer not null check(chatty between 1 and 5), comment text not null default '' check(length(comment)<=1500)
);
create table public.blocks (blocker_id uuid not null default auth.uid() references profiles, blocked_id uuid not null references profiles, primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id));
create table public.reports (id uuid primary key default gen_random_uuid(),reporter_id uuid not null default auth.uid() references profiles,reported_id uuid not null references profiles,reason text not null check(length(reason) between 3 and 1500),status text not null default 'open' check(status in ('open','resolved')),created_at timestamptz not null default now());
create table public.verification_requests (id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles,document_path text not null,vehicle text not null,licence_number text not null,expires_on date not null,status text not null default 'pending' check(status in ('pending','approved','rejected')),review_note text,created_at timestamptz not null default now());
create unique index one_pending_verification on verification_requests(user_id) where status='pending';
create table public.messages (id uuid primary key default gen_random_uuid(),ride_id uuid not null references rides,sender_id uuid not null default auth.uid() references profiles,body text not null check(length(body) between 1 and 1500),created_at timestamptz not null default now());
create table public.driver_locations (ride_id uuid primary key references rides on delete cascade,driver_id uuid not null references profiles,latitude double precision not null check(latitude between -90 and 90),longitude double precision not null check(longitude between -180 and 180),updated_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles,actor_id uuid references profiles,body text not null,read boolean not null default false,push_sent boolean not null default false,created_at timestamptz not null default now());
create table public.push_tokens (user_id uuid primary key default auth.uid() references profiles,token text not null);
create function public.is_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));$$;
create function public.trip_member(trip uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from rides where id=trip and driver_id=auth.uid()) or exists(select 1 from bookings where ride_id=trip and passenger_id=auth.uid() and status in ('accepted','completed'));$$;
alter table profiles enable row level security;alter table rides enable row level security;alter table bookings enable row level security;alter table reviews enable row level security;alter table blocks enable row level security;alter table reports enable row level security;alter table verification_requests enable row level security;alter table messages enable row level security;alter table driver_locations enable row level security;alter table notifications enable row level security;alter table push_tokens enable row level security;
revoke all on profiles,rides,bookings,reviews,blocks,reports,verification_requests,messages,driver_locations,notifications,push_tokens from anon;
revoke update on profiles from authenticated;
grant update(name,avatar_url,vehicle) on profiles to authenticated;
revoke insert,update,delete on bookings from authenticated;
revoke update,delete on rides from authenticated;
revoke update,delete on verification_requests from authenticated;
revoke update,delete on reviews from authenticated;
revoke update,delete on messages from authenticated;
revoke insert,delete,update on notifications from authenticated;
grant update(read) on notifications to authenticated;
create policy profiles_read on profiles for select to authenticated using(true);
create policy profiles_update on profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy rides_read on rides for select to authenticated using(not is_blocked(auth.uid(),driver_id) or is_admin());
create policy rides_insert on rides for insert to authenticated with check(driver_id=auth.uid() and status='scheduled' and departure>now() and exists(select 1 from profiles where id=auth.uid() and driver_approved) and exists(select 1 from verification_requests where user_id=auth.uid() and status='approved' and expires_on>current_date));
create policy bookings_read on bookings for select to authenticated using(passenger_id=auth.uid() or exists(select 1 from rides where id=ride_id and driver_id=auth.uid()) or is_admin());
create policy reviews_read on reviews for select to authenticated using(true);
create policy reviews_insert on reviews for insert to authenticated with check(author_id=auth.uid() and exists(select 1 from bookings b join rides r on r.id=b.ride_id where b.id=booking_id and b.passenger_id=auth.uid() and b.status='completed' and r.driver_id=reviews.driver_id));
create policy blocks_own on blocks for all to authenticated using(blocker_id=auth.uid()) with check(blocker_id=auth.uid());
create policy reports_read on reports for select to authenticated using(reporter_id=auth.uid() or is_admin());
create policy reports_insert on reports for insert to authenticated with check(reporter_id=auth.uid());
create policy reports_admin on reports for update to authenticated using(is_admin()) with check(is_admin());
create policy verification_read on verification_requests for select to authenticated using(user_id=auth.uid() or is_admin());
create policy verification_insert on verification_requests for insert to authenticated with check(user_id=auth.uid() and status='pending' and review_note is null and expires_on>current_date and document_path like auth.uid()::text||'/%');
create policy messages_read on messages for select to authenticated using(trip_member(ride_id) and not is_blocked(auth.uid(),sender_id));
create policy messages_insert on messages for insert to authenticated with check(sender_id=auth.uid() and trip_member(ride_id) and exists(select 1 from rides where id=ride_id and status in ('scheduled','active')));
create function public.stamp_driver_location() returns trigger language plpgsql set search_path=public as $$begin new.updated_at=now();return new;end;$$;
create trigger stamp_location before insert or update on driver_locations for each row execute function public.stamp_driver_location();
create policy locations_read on driver_locations for select to authenticated using(trip_member(ride_id) and exists(select 1 from rides where id=ride_id and status='active'));
create policy locations_insert on driver_locations for insert to authenticated with check(driver_id=auth.uid() and exists(select 1 from rides where id=ride_id and driver_id=auth.uid() and status='active'));
create policy locations_update on driver_locations for update to authenticated using(driver_id=auth.uid()) with check(driver_id=auth.uid() and exists(select 1 from rides where id=ride_id and driver_id=auth.uid() and status='active'));
create policy locations_delete on driver_locations for delete to authenticated using(driver_id=auth.uid());
create policy notifications_read on notifications for select to authenticated using(user_id=auth.uid());
create policy notifications_update on notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy tokens_own on push_tokens for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
-- All seat changes use a ride-level lock; clients cannot update seat counts directly.
create function public.request_booking(trip uuid) returns void language plpgsql security definer set search_path=public as $$
declare r rides;begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 select * into r from rides where id=trip for update;
 if r.id is null or not exists(select 1 from profiles where id=r.driver_id and driver_approved) or not exists(select 1 from verification_requests where user_id=r.driver_id and status='approved' and expires_on>current_date) or r.driver_id=auth.uid() or r.status<>'scheduled' or r.departure<=now() or r.seats<1 or is_blocked(auth.uid(),r.driver_id) then raise exception 'Ride unavailable';end if;
 if exists(select 1 from bookings where ride_id=trip and passenger_id=auth.uid() and status not in ('cancelled','rejected')) then raise exception 'You already have a booking';end if;
 insert into bookings(ride_id,passenger_id) values(trip,auth.uid()) on conflict(ride_id,passenger_id) do update set status='pending',created_at=now();
 insert into notifications(user_id,actor_id,body) values(r.driver_id,auth.uid(),'New booking request for your ride');
end;$$;
create function public.respond_booking(booking uuid,decision text) returns void language plpgsql security definer set search_path=public as $$
declare b bookings;r rides;begin
 select * into b from bookings where id=booking;
 select * into r from rides where id=b.ride_id for update;
 select * into b from bookings where id=booking for update;
 if b.id is null or auth.uid()<>r.driver_id or b.status<>'pending' or decision not in ('accepted','rejected') or r.status<>'scheduled' then raise exception 'Invalid booking decision';end if;
 if decision='accepted' then
  if r.seats<1 or r.departure<=now() or is_blocked(auth.uid(),b.passenger_id) then raise exception 'Ride unavailable';end if;
  update rides set seats=seats-1 where id=r.id;
 end if;
 update bookings set status=decision where id=booking;
 insert into notifications(user_id,actor_id,body) values(b.passenger_id,auth.uid(),'Your booking was '||decision);
end;$$;
create function public.cancel_booking(booking uuid) returns void language plpgsql security definer set search_path=public as $$
declare b bookings;r rides;begin
 select * into b from bookings where id=booking;select * into r from rides where id=b.ride_id for update;select * into b from bookings where id=booking for update;
 if b.id is null or (auth.uid()<>b.passenger_id and auth.uid()<>r.driver_id) or b.status not in ('pending','accepted') or r.status<>'scheduled' then raise exception 'This booking cannot be cancelled';end if;
 if b.status='accepted' then update rides set seats=seats+1 where id=r.id;end if;
 update bookings set status='cancelled' where id=booking;
 insert into notifications(user_id,actor_id,body) values(case when auth.uid()=b.passenger_id then r.driver_id else b.passenger_id end,auth.uid(),'A booking was cancelled. No payment or cancellation fee was taken.');
end;$$;
create function public.set_trip_status(trip uuid,next_status text) returns void language plpgsql security definer set search_path=public as $$
declare r rides;begin
 select * into r from rides where id=trip for update;
 if r.id is null or auth.uid()<>r.driver_id then raise exception 'Only the driver can manage this ride';end if;
 if not ((r.status='scheduled' and next_status in ('active','cancelled')) or (r.status='active' and next_status='completed')) then raise exception 'Invalid trip transition';end if;
 update rides set status=next_status where id=trip;
 if next_status='completed' then update bookings set status='completed' where ride_id=trip and status='accepted';end if;
 if next_status='cancelled' then update bookings set status='cancelled' where ride_id=trip and status in ('accepted','pending');end if;
 if next_status in ('active','completed') then update bookings set status='rejected' where ride_id=trip and status='pending';end if;
 if next_status<>'active' then delete from driver_locations where ride_id=trip;end if;
 insert into notifications(user_id,actor_id,body) select passenger_id,auth.uid(),'Ride is now '||next_status from bookings where ride_id=trip;
end;$$;
create function public.admin_edit_driver(driver uuid,new_name text,new_vehicle text,approved boolean) returns void language plpgsql security definer set search_path=public as $$
begin if not is_admin() then raise exception 'Admin access required';end if;
 if length(trim(new_name))=0 then raise exception 'Name required';end if;
 if approved and not exists(select 1 from verification_requests where user_id=driver and status='approved' and expires_on>current_date) then raise exception 'Approve a valid licence first';end if;
 update profiles set name=left(trim(new_name),100),vehicle=new_vehicle,driver_approved=approved where id=driver and role<>'admin';
end;$$;
create function public.admin_review_driver(request uuid,approve boolean,note text) returns void language plpgsql security definer set search_path=public as $$
declare v verification_requests;begin
 if not is_admin() then raise exception 'Admin access required';end if;
 select * into v from verification_requests where id=request for update;
 if v.id is null or v.status<>'pending' then raise exception 'Request already reviewed';end if;
 if approve and v.expires_on<=current_date then raise exception 'Licence is expired';end if;
 update verification_requests set status=case when approve then 'approved' else 'rejected' end,review_note=note where id=request;
 update profiles set driver_approved=approve,verification_status=case when approve then 'approved' else 'rejected' end,vehicle=v.vehicle,wants_driver=true where id=v.user_id;
end;$$;
create function public.admin_stats() returns jsonb language plpgsql security definer set search_path=public as $$
begin if not is_admin() then raise exception 'Admin access required';end if;
 return jsonb_build_object('members',(select count(*) from profiles),'approved_drivers',(select count(*) from profiles where driver_approved),'rides',(select count(*) from rides),'active_rides',(select count(*) from rides where status='active'),'bookings',(select count(*) from bookings),'completed_bookings',(select count(*) from bookings where status='completed'),'pending_licences',(select count(*) from verification_requests where status='pending'),'open_reports',(select count(*) from reports where status='open'),'reviews',(select count(*) from reviews));end;$$;
create function public.notify_message() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into notifications(user_id,actor_id,body) select id,new.sender_id,'New message in your CoRide trip' from profiles where id<>new.sender_id and not is_blocked(id,new.sender_id) and (id=(select driver_id from rides where id=new.ride_id) or id in (select passenger_id from bookings where ride_id=new.ride_id and status='accepted'));
 return new;end;$$;
create trigger message_notification after insert on messages for each row execute function public.notify_message();
create function public.verification_pending() returns trigger language plpgsql security definer set search_path=public as $$begin update profiles set wants_driver=true,verification_status='pending' where id=new.user_id;return new;end;$$;
create trigger verification_submitted after insert on verification_requests for each row execute function public.verification_pending();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp']),('verification','verification',false,10485760,array['image/jpeg','image/png','image/webp']);
create policy avatar_upload on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_read on storage.objects for select to public using(bucket_id='avatars');
create policy verification_upload on storage.objects for insert to authenticated with check(bucket_id='verification' and (storage.foldername(name))[1]=auth.uid()::text);
create policy verification_documents on storage.objects for select to authenticated using(bucket_id='verification' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
-- Postgres functions are executable by PUBLIC by default. Restrict entry points.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_admin(),public.is_blocked(uuid,uuid),public.trip_member(uuid),public.request_booking(uuid),public.respond_booking(uuid,text),public.cancel_booking(uuid),public.set_trip_status(uuid,text),public.admin_edit_driver(uuid,text,text,boolean),public.admin_review_driver(uuid,boolean,text),public.admin_stats() to authenticated;
alter publication supabase_realtime add table public.rides,public.bookings,public.messages,public.driver_locations,public.notifications;
-- Atomic per-user Google search allowance; clients cannot edit counters.
create table public.address_search_limits(user_id uuid primary key references profiles,window_start timestamptz not null,requests integer not null);
alter table address_search_limits enable row level security;
revoke all on address_search_limits from anon,authenticated;
create function public.consume_address_search() returns boolean language plpgsql security definer set search_path=public as $$
declare used integer;begin
 if auth.uid() is null then return false;end if;
 insert into address_search_limits(user_id,window_start,requests) values(auth.uid(),now(),1)
 on conflict(user_id) do update set window_start=case when address_search_limits.window_start<now()-interval '1 minute' then now() else address_search_limits.window_start end,requests=case when address_search_limits.window_start<now()-interval '1 minute' then 1 else address_search_limits.requests+1 end returning requests into used;
 return used<=30;end;$$;
revoke execute on function public.consume_address_search() from public,anon;
grant execute on function public.consume_address_search() to authenticated;
-- Remove Supabase's explicit default grants on trigger-only functions.
revoke execute on function public.handle_new_user(), public.notify_message(), public.verification_pending(), public.stamp_driver_location() from authenticated;
