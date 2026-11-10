import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { db } from "./backend";
export async function registerPush() {
  if (!db) throw new Error("Connect Supabase first.");
  if (Constants.executionEnvironment === "storeClient")
    throw new Error(
      "Remote push notifications require an Expo development build. In-app notifications are available in Expo Go.",
    );
  if (!Device.isDevice)
    throw new Error("Use a physical device for push notifications.");
  const Notifications = await import("expo-notifications");
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("bookings", {
      name: "Bookings & messages",
      importance: Notifications.AndroidImportance.HIGH,
    });
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error("Notification permission was not granted.");
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId)
    throw new Error(
      "Configure an EAS project ID before enabling push notifications.",
    );
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await db.from("push_tokens").upsert({ token });
  if (error) throw error;
}
