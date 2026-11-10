-- Supabase grants functions to authenticated explicitly by default.
-- Trigger-only functions must not be exposed as RPC entrypoints.
revoke execute on function public.handle_new_user(), public.notify_message(), public.verification_pending(), public.stamp_driver_location() from authenticated;
