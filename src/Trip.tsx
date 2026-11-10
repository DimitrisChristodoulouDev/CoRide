import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  Platform,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import NativeMap from "./NativeMap";
import * as Location from "expo-location";
import Constants from "expo-constants";
import { db, deliverNotifications } from "./backend";
import type { Driver, Ride } from "./model";
import { Button, ui } from "./ui";
type LiveLocation = { latitude: number; longitude: number; updated_at: string };
export default function Trip({
  ride,
  userId,
  profiles,
}: {
  ride: Ride;
  userId: string;
  profiles: Driver[];
}) {
  const [messages, setMessages] = useState<any[]>([]),
    [body, setBody] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [location, setLocation] = useState<LiveLocation | null>(null),
    [sharing, setSharing] = useState(false),
    [clock, setClock] = useState(Date.now());
  const subscription = useRef<Location.LocationSubscription | null>(null),
    active = useRef(false),
    mounted = useRef(true),
    starting = useRef(false);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const driver = ride.driver_id === userId;
  async function refresh() {
    if (!db) return;
    const results = await Promise.all([
      db
        .from("messages")
        .select("*")
        .eq("ride_id", ride.id)
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("driver_locations")
        .select("*")
        .eq("ride_id", ride.id)
        .maybeSingle(),
    ]);
    if (!mounted.current) return;
    if (results[0].error) setNotice(results[0].error.message);
    else setMessages([...(results[0].data ?? [])].reverse());
    if (results[1].error) setNotice(results[1].error.message);
    else setLocation(results[1].data);
  }
  async function stop() {
    active.current = false;
    subscription.current?.remove();
    subscription.current = null;
    if (mounted.current) setSharing(false);
    await writes.current.catch(() => undefined);
    if (db && driver)
      await db.from("driver_locations").delete().eq("ride_id", ride.id);
    if (mounted.current) setLocation(null);
  }
  useEffect(() => {
    mounted.current = true;
    refresh();
    const timer = setInterval(() => {
      setClock(Date.now());
      refresh();
    }, 10000);
    const state = AppState.addEventListener("change", (s) => {
      if (s !== "active") stop();
    });
    return () => {
      mounted.current = false;
      clearInterval(timer);
      state.remove();
      stop();
    };
  }, [ride.id]);
  useEffect(() => {
    if (ride.status !== "active") stop();
  }, [ride.status]);
  async function share() {
    if (!db || starting.current) return;
    starting.current = true;
    setNotice("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!mounted.current) return;
      if (permission.status !== "granted")
        throw new Error(
          "Location permission is required to share your position.",
        );
      active.current = true;
      setSharing(true);
      const watch = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (position) => {
          if (!active.current || !mounted.current) return;
          const next = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            updated_at: new Date().toISOString(),
          };
          setLocation(next);
          writes.current = writes.current
            .then(async () => {
              if (!active.current || !mounted.current) return;
              const { error } = await db!
                .from("driver_locations")
                .upsert({ ride_id: ride.id, driver_id: userId, ...next });
              if (error && mounted.current) {
                setNotice(error.message);
                void stop();
              }
            })
            .catch(() => {
              if (mounted.current) {
                setNotice(
                  "Location update failed. Please check your connection.",
                );
                void stop();
              }
            });
        },
      );
      if (!active.current || !mounted.current) watch.remove();
      else subscription.current = watch;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to share location.");
      stop();
    } finally {
      starting.current = false;
    }
  }
  const stale = !location || clock - Date.parse(location.updated_at) > 30000;
  return (
    <View>
      <Text style={ui.heading}>Trip map & navigation</Text>
      <NativeMap
        provider={
          Platform.OS === "ios" &&
          Constants.executionEnvironment === "storeClient"
            ? undefined
            : PROVIDER_GOOGLE
        }
        style={{ height: 240, borderRadius: 14 }}
        initialRegion={{
          ...ride.pickup,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
      >
        <Marker coordinate={ride.pickup} title="Pickup" pinColor="green" />
        <Marker coordinate={ride.dropoff} title="Drop-off" pinColor="red" />
        {location && ride.status === "active" && (
          <Marker
            coordinate={location}
            title={stale ? "Last known driver position" : "Driver location"}
            pinColor="blue"
          />
        )}
      </NativeMap>
      <Button
        title="Navigate to pickup in Google Maps"
        onPress={() =>
          Linking.openURL(
            `https://www.google.com/maps/dir/?api=1&destination=${ride.pickup.latitude},${ride.pickup.longitude}&travelmode=driving`,
          )
        }
      />
      <Button
        title="Navigate to drop-off"
        onPress={() =>
          Linking.openURL(
            `https://www.google.com/maps/dir/?api=1&destination=${ride.dropoff.latitude},${ride.dropoff.longitude}&travelmode=driving`,
          )
        }
      />
      {ride.status === "active" && (
        <>
          <Text style={ui.notice}>
            {location
              ? `${stale ? "Last known position · updates paused" : "Live driver position"} · updated ${new Date(location.updated_at).toLocaleTimeString()}`
              : "Driver location is not being shared."}
          </Text>
          {driver && (
            <>
              <Text style={ui.small}>
                Accepted passengers can view your position. Sharing stops when
                you leave this screen, background the app or finish the trip.
                Keep this screen open for updates.
              </Text>
              <Button
                title={
                  sharing
                    ? "Stop location sharing"
                    : "Share live driver location"
                }
                onPress={sharing ? stop : share}
              />
            </>
          )}
        </>
      )}
      {!!notice && (
        <Text accessibilityRole="alert" style={ui.notice}>
          {notice}
        </Text>
      )}
      <Text style={[ui.heading, { marginTop: 24 }]}>Trip group chat</Text>
      <Text style={ui.small}>
        Visible to the driver and accepted passengers.
      </Text>
      {messages.map((message) => (
        <View key={message.id} style={ui.card}>
          <Text style={ui.link}>
            {profiles.find((p) => p.id === message.sender_id)?.name ?? "Member"}
          </Text>
          <Text style={ui.text}>{message.body}</Text>
          <Text style={ui.small}>
            {new Date(message.created_at).toLocaleString()}
          </Text>
        </View>
      ))}
      {["scheduled", "active"].includes(ride.status) && (
        <>
          <TextInput
            accessibilityLabel="Trip message"
            maxLength={1500}
            style={[ui.input, { marginTop: 15 }]}
            value={body}
            onChangeText={setBody}
            placeholder="Message your trip…"
            multiline
          />
          <Button
            title="Send message"
            disabled={busy || !body.trim()}
            onPress={async () => {
              if (!db) return;
              setBusy(true);
              const { error } = await db.from("messages").insert({
                ride_id: ride.id,
                sender_id: userId,
                body: body.trim(),
              });
              if (error) setNotice(error.message);
              else {
                setBody("");
                await refresh();
                deliverNotifications();
              }
              setBusy(false);
            }}
          />
        </>
      )}
    </View>
  );
}
