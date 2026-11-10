-- Minimal Supabase primitives for local PostgreSQL permission tests only.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/');$$;
grant usage on schema storage to authenticated,anon;
grant all on storage.objects to authenticated;
grant select on storage.objects to anon;
alter default privileges in schema public grant all on tables to anon,authenticated;
create publication supabase_realtime;
