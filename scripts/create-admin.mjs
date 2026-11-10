// Run locally in Codespaces; never import this into the mobile app.
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.CORIDE_ADMIN_PASSWORD;
if (!url || !key || !password)
  throw new Error(
    "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and CORIDE_ADMIN_PASSWORD privately in the terminal. See README.",
  );
if (password.length < 8)
  throw new Error("Admin password must have at least 8 characters.");
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await db.auth.admin.createUser({
  email: "admin@coride.com",
  password,
  email_confirm: true,
  user_metadata: { name: "CoRide Admin" },
});
if (error) throw error;
const result = await db
  .from("profiles")
  .update({ role: "admin" })
  .eq("id", data.user.id);
if (result.error) throw result.error;
console.log("Admin account created. Sign in through the separate Admin page.");
