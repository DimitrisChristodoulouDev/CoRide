import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import { supabaseProject } from "./project";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || supabaseProject.url,
  key =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    supabaseProject.publishableKey;
// Chunk encrypted sessions so large JWTs fit native SecureStore limits.
const storage = {
  async getItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(`${key}.count`));
    if (!count) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(`${key}.${i}`),
      ),
    );
    return parts.some((p) => p === null) ? null : parts.join("");
  },
  async setItem(key: string, value: string) {
    await this.removeItem(key);
    const chunks = value.match(/.{1,1500}/gs) ?? [];
    for (let i = 0; i < chunks.length; i++)
      await SecureStore.setItemAsync(`${key}.${i}`, chunks[i]);
    await SecureStore.setItemAsync(`${key}.count`, String(chunks.length));
  },
  async removeItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(`${key}.count`));
    await SecureStore.deleteItemAsync(`${key}.count`);
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.deleteItemAsync(`${key}.${i}`),
      ),
    );
  },
};
export const db =
  process.env.EXPO_PUBLIC_DEMO_MODE !== "true" && url && key
    ? createClient(url, key, {
        auth: {
          storage: Platform.OS === "web" ? undefined : storage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      })
    : null;
if (db && Platform.OS !== "web")
  AppState.addEventListener("change", (state) => {
    if (state === "active") db.auth.startAutoRefresh();
    else db.auth.stopAutoRefresh();
  });
export async function deliverNotifications() {
  if (db) await db.functions.invoke("deliver-notifications").catch(() => null);
}

export async function signOut() {
  if (!db) return;
  const token = await db
    .from("push_tokens")
    .delete()
    .eq(
      "user_id",
      (await db.auth.getUser()).data.user?.id ??
        "00000000-0000-0000-0000-000000000000",
    );
  if (token.error) throw token.error;
  const { error } = await db.auth.signOut();
  if (error) throw error;
}
