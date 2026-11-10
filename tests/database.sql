\set ON_ERROR_STOP on
insert into auth.users(id,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000001','{"name":"Driver","wants_driver":true}'),
 ('00000000-0000-0000-0000-000000000002','{"name":"Passenger"}'),
 ('00000000-0000-0000-0000-000000000003','{"name":"Outsider"}'),
 ('00000000-0000-0000-0000-000000000004','{"name":"Admin"}');
update profiles set role='admin' where id='00000000-0000-0000-0000-000000000004';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$begin
 begin update profiles set driver_approved=true where id=auth.uid();raise exception 'FAIL: user escalated approval';exception when insufficient_privilege then null;end;
 begin insert into rides(driver_id,from_city,to_city,pickup,dropoff,departure,duration,price,seats) values(auth.uid(),'Nicosia','Limassol','{}','{}',now()+interval '1 day',60,8,1);raise exception 'FAIL: unapproved driver published';exception when insufficient_privilege then null;end;
end;$$;
insert into verification_requests(id,user_id,document_path,vehicle,licence_number,expires_on) values('10000000-0000-0000-0000-000000000001',auth.uid(),auth.uid()::text||'/licence.jpg','Toyota','LIC123',current_date+365);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$begin
 begin perform admin_review_driver('10000000-0000-0000-0000-000000000001',true,'Forged approval');raise exception 'FAIL: passenger approved driver';exception when raise_exception then if sqlerrm not like 'Admin access required%' then raise;end if;end;
end;$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select admin_review_driver('10000000-0000-0000-0000-000000000001',true,'Licence checked');
select admin_stats();
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into rides(id,driver_id,from_city,to_city,pickup,dropoff,departure,duration,price,seats) values('20000000-0000-0000-0000-000000000001',auth.uid(),'Nicosia','Limassol','{}','{}',now()+interval '1 day',60,8,1);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select request_booking('20000000-0000-0000-0000-000000000001');
do $$begin
 begin insert into reviews(booking_id,driver_id,rating,driving,chatty) select id,'00000000-0000-0000-0000-000000000001',5,5,5 from bookings;raise exception 'FAIL: pending passenger reviewed';exception when insufficient_privilege then null;end;
 begin insert into messages(ride_id,body) values('20000000-0000-0000-0000-000000000001','Not accepted');raise exception 'FAIL: pending passenger accessed chat';exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select request_booking('20000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select respond_booking(id,'accepted') from bookings where passenger_id='00000000-0000-0000-0000-000000000002';
do $$begin
 begin perform respond_booking((select id from bookings where passenger_id='00000000-0000-0000-0000-000000000003'),'accepted');raise exception 'FAIL: overbooked seat';exception when raise_exception then if sqlerrm not like 'Ride unavailable%' then raise;end if;end;
 if (select seats from rides limit 1)<>0 then raise exception 'FAIL: seat count';end if;
end;$$;
select set_trip_status('20000000-0000-0000-0000-000000000001','active');
insert into driver_locations(ride_id,driver_id,latitude,longitude,updated_at) values('20000000-0000-0000-0000-000000000001',auth.uid(),35.1856,33.3823,'2099-01-01');
do $$begin if (select updated_at from driver_locations limit 1)>now()+interval '1 minute' then raise exception 'FAIL: forged freshness';end if;end;$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$begin if exists(select 1 from driver_locations) then raise exception 'FAIL: outsider location access';end if;end;$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$begin if not exists(select 1 from driver_locations) then raise exception 'FAIL: accepted passenger cannot track';end if;end;$$;
insert into messages(ride_id,body) values('20000000-0000-0000-0000-000000000001','At the pickup point');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_trip_status('20000000-0000-0000-0000-000000000001','completed');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
insert into reviews(booking_id,driver_id,rating,driving,chatty,comment) select id,'00000000-0000-0000-0000-000000000001',5,4,2,'Verified completed journey' from bookings where passenger_id=auth.uid();
do $$begin
 if exists(select 1 from driver_locations) then raise exception 'FAIL: location retained after completion';end if;
 begin insert into reviews(booking_id,driver_id,rating,driving,chatty) select id,'00000000-0000-0000-0000-000000000001',5,5,5 from bookings where passenger_id=auth.uid();raise exception 'FAIL: duplicate review';exception when unique_violation then null;end;
end;$$;
reset role;
select 'Database permission and booking checks passed' as result;
