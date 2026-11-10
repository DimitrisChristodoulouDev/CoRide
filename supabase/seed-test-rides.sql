-- Fictional fixtures only. No email is sent, no login credentials are created.
-- Auth users are permanently banned and have no identities/passwords.
-- Re-running does not duplicate the fixture drivers or rides.
begin;
insert into auth.users(id,instance_id,aud,role,email,banned_until,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'test-driver-'||n||'@fixtures.coride.invalid','infinity'::timestamptz,
 jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'coride_test_fixture',true,'fixture_number',n),
 jsonb_build_object('name','[TEST] '||(array['Andreas','Maria','Elena','Nikos','Sofia','Giorgos','Anna','Petros','Christina','Marios','Eleni','Stelios','Georgia','Kostas','Dimitra','Pavlos','Irene','Michalis','Alexandra','Theodoros'])[n],'wants_driver',true),now(),now()
from generate_series(1,20) n where not exists(select 1 from auth.users where email='test-driver-'||n||'@fixtures.coride.invalid');
update public.profiles p set wants_driver=true,driver_approved=true,verification_status='approved',vehicle='[TEST VEHICLE] '||(array['Toyota Corolla','Kia Ceed','VW Golf','Honda Civic','Nissan Note'])[((u.raw_app_meta_data->>'fixture_number')::int-1)%5+1]
from auth.users u where p.id=u.id and u.raw_app_meta_data->>'coride_test_fixture'='true';
insert into public.verification_requests(user_id,document_path,vehicle,licence_number,expires_on,status,review_note)
select p.id,p.id||'/TEST-NO-REAL-DOCUMENT',p.vehicle,'TEST-ONLY-NOT-A-REAL-LICENCE',current_date+730,'approved','SYNTHETIC FIXTURE: not an actual licence or verification.'
from public.profiles p join auth.users u on u.id=p.id where u.raw_app_meta_data->>'coride_test_fixture'='true' and not exists(select 1 from public.verification_requests v where v.user_id=p.id);
with cities as (
 select * from (values('Nicosia',35.1856,33.3823),('Limassol',34.6786,33.0413),('Larnaca',34.9182,33.6232),('Paphos',34.7754,32.4218),('Ayia Napa',34.9888,34.0018)) c(city,lat,lon)
), routes as (
 select row_number() over(order by a.city,b.city)::int as route,a.city as origin,b.city as destination,a.lat as alat,a.lon as alon,b.lat as blat,b.lon as blon
 from cities a cross join cities b where a.city<>b.city
), fixtures as (
 select n,r.*,u.id as driver,
 greatest(25,round(sqrt(power((r.alat-r.blat)*111,2)+power((r.alon-r.blon)*91,2))*1.1)::int) as minutes
 from generate_series(1,240) n join routes r on r.route=(n-1)%20+1
 join auth.users u on u.raw_app_meta_data->>'coride_test_fixture'='true' and (u.raw_app_meta_data->>'fixture_number')::int=((n-1)%20+(n-1)/20)%20+1
)
insert into public.rides(driver_id,from_city,to_city,pickup,dropoff,departure,duration,price,seats,status)
select driver,origin,destination,
 jsonb_build_object('latitude',alat,'longitude',alon,'city',origin,'address','[TEST] '||origin||' city centre — no real pickup','fixture_batch','coride-test-v1','fixture_number',n),
 jsonb_build_object('latitude',blat,'longitude',blon,'city',destination,'address','[TEST] '||destination||' city centre'),
 (((now() at time zone 'Asia/Nicosia')::date+1+(n-1)/20)::timestamp + interval '6 hours' + ((n-1)%12)*interval '1 hour' + (n%2)*interval '30 minutes') at time zone 'Asia/Nicosia',
 minutes+(n%4)*5,4+(n%15),case when n%17=0 then 0 else 1+n%4 end,'scheduled'
from fixtures f where not exists(select 1 from public.rides r where r.pickup->>'fixture_batch'='coride-test-v1' and (r.pickup->>'fixture_number')::int=f.n);
-- Completed fictional journeys provide varied, explicitly labelled review data.
insert into public.rides(driver_id,from_city,to_city,pickup,dropoff,departure,duration,price,seats,status)
select u.id,'Nicosia','Limassol',jsonb_build_object('latitude',35.1856,'longitude',33.3823,'city','Nicosia','address','[TEST HISTORY] Nicosia','fixture_batch','coride-test-history'),jsonb_build_object('latitude',34.6786,'longitude',33.0413,'city','Limassol','address','[TEST] Limassol'),now()-interval '7 days',65,8,0,'completed'
from auth.users u where u.raw_app_meta_data->>'coride_test_fixture'='true' and not exists(select 1 from public.rides r where r.driver_id=u.id and r.pickup->>'fixture_batch'='coride-test-history');
insert into public.bookings(ride_id,passenger_id,status)
select r.id,p.id,'completed' from public.rides r join auth.users d on d.id=r.driver_id cross join generate_series(1,3) n
join auth.users p on p.raw_app_meta_data->>'coride_test_fixture'='true' and (p.raw_app_meta_data->>'fixture_number')::int=((d.raw_app_meta_data->>'fixture_number')::int+n-1)%20+1
where r.pickup->>'fixture_batch'='coride-test-history' on conflict(ride_id,passenger_id) do nothing;
insert into public.reviews(booking_id,driver_id,author_id,rating,driving,chatty,comment)
select b.id,r.driver_id,b.passenger_id,3+(u.raw_app_meta_data->>'fixture_number')::int%3,3+((u.raw_app_meta_data->>'fixture_number')::int+1)%3,1+(u.raw_app_meta_data->>'fixture_number')::int%5,'[TEST REVIEW] Fictional completed journey for testing ratings and sorting.'
from public.bookings b join public.rides r on r.id=b.ride_id join auth.users u on u.id=r.driver_id
where r.pickup->>'fixture_batch'='coride-test-history' on conflict(booking_id) do nothing;
commit;
