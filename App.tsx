import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking as NativeLinking,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Linking from "expo-linking";
import type { User } from "@supabase/supabase-js";
import AddressPicker from "./src/AddressPicker";
import Account from "./src/Account";
import { authRedirectUrl } from "./src/authRedirect";
import { parseAuthCallback } from "./src/authLinks";
import Admin from "./src/Admin";
import Trip from "./src/Trip";
import { db, deliverNotifications } from "./src/backend";
import { cityPoints, type Pickup } from "./src/locations";
import {
  type Booking,
  type Driver,
  type Review,
  type Ride,
  type Sort,
  sorts,
  score,
  sortRides,
} from "./src/model";
import { Avatar, Button, Field, RatingInput, Stars, ui } from "./src/ui";
import { registerPush } from "./src/notifications";
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(8, 30, 0, 0);
const pickup = (city: string): Pickup => ({
  ...cityPoints[city],
  city,
  address: `${city} city centre`,
});
const demoDrivers: Driver[] = [
  {
    id: "andreas",
    name: "Andreas Georgiou",
    vehicle: "Toyota Corolla · Silver",
    driver_approved: true,
  },
  {
    id: "maria",
    name: "Maria Nicolaou",
    vehicle: "Volkswagen Golf · Blue",
    driver_approved: true,
  },
  {
    id: "elena",
    name: "Elena Petrou",
    vehicle: "Kia Ceed · White",
    driver_approved: true,
  },
  { id: "demo", name: "You · demo driver", vehicle: "Demo vehicle" },
];
const demoRides: Ride[] = [
  ["1", "andreas", "Nicosia", "Limassol", 8, 65],
  ["2", "maria", "Larnaca", "Nicosia", 6, 45],
  ["3", "elena", "Limassol", "Paphos", 9, 60],
].map(([id, driver, from, to, price, duration], i) => ({
  id: String(id),
  driver_id: String(driver),
  from_city: String(from),
  to_city: String(to),
  pickup: pickup(String(from)),
  dropoff: pickup(String(to)),
  departure: new Date(tomorrow.getTime() + i * 3600000).toISOString(),
  duration: Number(duration),
  price: Number(price),
  seats: 3,
  status: "scheduled",
}));
const demoReviews: Review[] = [
  {
    id: "seed1",
    booking_id: "seed1",
    driver_id: "andreas",
    author_id: "sample",
    rating: 5,
    driving: 5,
    chatty: 2,
    comment: "Sample review: calm driving and an easy pickup.",
  },
  {
    id: "seed2",
    booking_id: "seed2",
    driver_id: "maria",
    author_id: "sample",
    rating: 4,
    driving: 5,
    chatty: 5,
    comment: "Sample review: friendly conversation throughout.",
  },
  {
    id: "seed3",
    booking_id: "seed3",
    driver_id: "elena",
    author_id: "sample",
    rating: 5,
    driving: 4,
    chatty: 3,
    comment: "Sample review: punctual and comfortable.",
  },
];
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [recovery, setRecovery] = useState(false),
    [ready, setReady] = useState(!db);
  const [authPopup, setAuthPopup] = useState<
    "member" | "admin" | "password" | null
  >(null);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [tab, setTab] = useState("Find"),
    [rides, setRides] = useState<Ride[]>(db ? [] : demoRides),
    [drivers, setDrivers] = useState<Driver[]>(db ? [] : demoDrivers),
    [reviews, setReviews] = useState<Review[]>(db ? [] : demoReviews),
    [bookings, setBookings] = useState<Booking[]>([]);
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [origin, setOrigin] = useState<Pickup | undefined>(),
    [destination, setDestination] = useState<Pickup | undefined>(),
    [map, setMap] = useState<"from" | "to" | null>(null);
  const [driverQuery, setDriverQuery] = useState(""),
    [sort, setSort] = useState<Sort>("Departure"),
    [date, setDate] = useState(new Date(tomorrow)),
    [dateFilter, setDateFilter] = useState<Date | null>(null),
    [picker, setPicker] = useState<"date" | "time" | "filter" | null>(null);
  const [price, setPrice] = useState("8"),
    [duration, setDuration] = useState("60"),
    [seats, setSeats] = useState("3");
  const [selectedId, setSelectedId] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState<string[]>([]),
    [notifications, setNotifications] = useState<any[]>([]);
  const [rating, setRating] = useState(5),
    [driving, setDriving] = useState(5),
    [chatty, setChatty] = useState(3),
    [comment, setComment] = useState(""),
    [report, setReport] = useState("");
  const uid = user?.id ?? "demo",
    profile = drivers.find((d) => d.id === uid),
    selected = rides.find((r) => r.id === selectedId);
  async function refresh() {
    if (!db) return;
    const {
      data: { user: current },
    } = await db.auth.getUser();
    if (!current) return;
    const result = await Promise.all([
      db.from("rides").select("*").order("departure"),
      db.from("profiles").select("*"),
      db.from("reviews").select("*"),
      db.from("bookings").select("*"),
      db.from("blocks").select("blocked_id"),
      db
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    const error = result.find((r) => r.error)?.error;
    if (error) throw error;
    setRides(result[0].data ?? []);
    setDrivers(result[1].data ?? []);
    setReviews(result[2].data ?? []);
    setBookings(result[3].data ?? []);
    setBlocked((result[4].data ?? []).map((b) => b.blocked_id));
    setNotifications(result[5].data ?? []);
  }
  useEffect(() => {
    if (!db) return;
    let alive = true;
    db.auth.getSession().then(({ data, error }) => {
      if (alive) {
        setUser(data.session?.user ?? null);
        setReady(true);
        if (error) setNotice(error.message);
      }
    });
    const { data } = db.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        setAuthPopup("password");
      }
      if (event === "SIGNED_OUT") {
        setAuthPopup(null);
        setPendingTab(null);
        setRecovery(false);
        setTab("Find");
        setRides([]);
        setDrivers([]);
        setBookings([]);
        setReviews([]);
        setNotifications([]);
        setSelectedId(null);
      }
    });
    const handledCodes = new Set<string>();
    async function handleUrl(url: string) {
      try {
        const callback = parseAuthCallback(url, authRedirectUrl());
        if (!callback) return;
        if (callback.error) throw new Error(callback.error);
        const code = callback.code;
        if (code && !handledCodes.has(code)) {
          handledCodes.add(code);
          const { error } = await db!.auth.exchangeCodeForSession(code);
          if (error) {
            handledCodes.delete(code);
            throw error;
          }
          setNotice("Account link verified. You are back in CoRide.");
        }
      } catch (e) {
        setNotice(
          e instanceof Error ? e.message : "Could not open account link.",
        );
      }
    }
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const links = Linking.addEventListener("url", (e) => handleUrl(e.url));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
      links.remove();
    };
  }, []);
  useEffect(() => {
    if (!user || !db) return;
    refresh().catch((e) => setNotice(e.message));
    const timer = setInterval(() => refresh().catch(() => null), 15000);
    const channel = db
      .channel(`account-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => refresh().catch(() => null),
      )
      .subscribe();
    return () => {
      clearInterval(timer);
      db?.removeChannel(channel);
    };
  }, [user?.id]);
  useEffect(() => {
    if (profile?.role === "admin") setTab("Admin");
  }, [profile?.role]);
  useEffect(() => {
    if (
      user &&
      (authPopup === "member" || authPopup === "admin") &&
      !recovery
    ) {
      setAuthPopup(null);
      if (pendingTab) setTab(pendingTab);
      setPendingTab(null);
    }
  }, [user?.id, authPopup, recovery, pendingTab]);
  function navigate(next: string) {
    if (
      !user &&
      (next === "Profile" || next === "Admin" || (!!db && next !== "Find"))
    ) {
      setPendingTab(next);
      setAuthPopup(next === "Admin" ? "admin" : "member");
      return;
    }
    setTab(next);
    setNotice("");
  }
  function closeAuth() {
    setAuthPopup(null);
    setPendingTab(null);
  }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await action();
      if (db) {
        await refresh();
        deliverNotifications();
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (db && !profile?.driver_approved)
      throw new Error(
        "Register as a driver and submit your driving licence in Profile. An admin must approve it before you publish.",
      );
    const a =
        origin ?? (cityPoints[from.trim()] ? pickup(from.trim()) : undefined),
      b =
        destination ?? (cityPoints[to.trim()] ? pickup(to.trim()) : undefined);
    if (!a || !b || a.city === b.city)
      throw new Error(
        "Choose two different supported cities or addresses using the map.",
      );
    if (date.getTime() <= Date.now())
      throw new Error("Choose a future departure date and time.");
    if (
      !Number.isFinite(Number(price)) ||
      Number(price) <= 0 ||
      Number(price) > 1000 ||
      !Number.isInteger(Number(duration)) ||
      Number(duration) < 1 ||
      Number(duration) > 1440 ||
      !Number.isInteger(Number(seats)) ||
      Number(seats) < 1 ||
      Number(seats) > 8
    )
      throw new Error(
        "Enter a price up to €1000, duration of 1–1440 minutes and 1–8 seats.",
      );
    const ride: Omit<Ride, "id"> = {
      driver_id: uid,
      from_city: a.city,
      to_city: b.city,
      pickup: a,
      dropoff: b,
      departure: date.toISOString(),
      duration: Number(duration),
      price: Number(price),
      seats: Number(seats),
      status: "scheduled",
    };
    if (db) {
      const { error } = await db.from("rides").insert(ride);
      if (error) throw error;
    } else setRides((old) => [...old, { ...ride, id: String(Date.now()) }]);
    setNotice(db ? "Ride published." : "Demo ride published for this session.");
    setTab("Find");
    setFrom("");
    setTo("");
    setOrigin(undefined);
    setDestination(undefined);
  }
  async function request(ride: Ride) {
    if (db) {
      const { error } = await db.rpc("request_booking", { trip: ride.id });
      if (error) throw error;
      setNotice(
        "Booking requested. A seat is confirmed when the driver accepts.",
      );
    } else {
      setBookings((old) => [
        ...old.filter(
          (b) => !(b.ride_id === ride.id && b.passenger_id === uid),
        ),
        {
          id: String(Date.now()),
          ride_id: ride.id,
          passenger_id: uid,
          status: "accepted",
        },
      ]);
      setRides((old) =>
        old.map((r) => (r.id === ride.id ? { ...r, seats: r.seats - 1 } : r)),
      );
      setNotice(
        "Demo seat accepted automatically. Live bookings require driver approval.",
      );
    }
  }
  async function cancel(booking: Booking) {
    if (db) {
      const { error } = await db.rpc("cancel_booking", { booking: booking.id });
      if (error) throw error;
    } else {
      setBookings((old) =>
        old.map((b) =>
          b.id === booking.id ? { ...b, status: "cancelled" } : b,
        ),
      );
      if (booking.status === "accepted")
        setRides((old) =>
          old.map((r) =>
            r.id === booking.ride_id ? { ...r, seats: r.seats + 1 } : r,
          ),
        );
    }
    setNotice("Booking cancelled. No payment or fee taken.");
  }
  async function status(ride: Ride, next: Ride["status"]) {
    if (db) {
      const { error } = await db.rpc("set_trip_status", {
        trip: ride.id,
        next_status: next,
      });
      if (error) throw error;
    } else {
      setRides((old) =>
        old.map((r) => (r.id === ride.id ? { ...r, status: next } : r)),
      );
      setBookings((old) =>
        old.map((b) =>
          b.ride_id === ride.id
            ? {
                ...b,
                status:
                  next === "completed"
                    ? "completed"
                    : next === "cancelled"
                      ? "cancelled"
                      : b.status,
              }
            : b,
        ),
      );
    }
  }
  const day = (d: string | Date) =>
    new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Nicosia" });
  const dateLabel = (d: string | Date) =>
    new Date(d).toLocaleString("en-GB", {
      timeZone: "Asia/Nicosia",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  const filtered = sortRides(
    rides.filter(
      (r) =>
        !blocked.includes(r.driver_id) &&
        (tab === "My rides"
          ? r.driver_id === uid ||
            bookings.some((b) => b.ride_id === r.id && b.passenger_id === uid)
          : ["scheduled", "active"].includes(r.status) &&
            Date.parse(r.departure) > Date.now() &&
            r.from_city.toLowerCase().includes(from.toLowerCase().trim()) &&
            r.to_city.toLowerCase().includes(to.toLowerCase().trim()) &&
            (drivers.find((d) => d.id === r.driver_id)?.name ?? "")
              .toLowerCase()
              .includes(driverQuery.toLowerCase().trim()) &&
            (!dateFilter || day(r.departure) === day(dateFilter))),
    ),
    reviews,
    sort,
  );
  const selectedDriver = drivers.find((d) => d.id === selected?.driver_id),
    myBooking = bookings.find(
      (b) => b.ride_id === selected?.id && b.passenger_id === uid,
    ),
    mine = selected?.driver_id === uid;
  const canChat =
    !!selected &&
    (mine ||
      (!!myBooking && ["accepted", "completed"].includes(myBooking.status)));
  if (!ready)
    return (
      <SafeAreaView style={ui.screen}>
        <Text style={ui.notice}>Loading CoRide…</Text>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={ui.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={ui.row}>
          <Text style={{ fontSize: 32, fontWeight: "900", color: "#153f36" }}>
            co<Text style={{ color: "#178168" }}>ride</Text> ●
          </Text>
          <Text style={ui.small}>CYPRUS · EUR</Text>
        </View>
        <Text style={[ui.title, { fontSize: 36, marginTop: 28 }]}>
          Your island.{"\n"}Your way together.
        </Text>
        <Text style={ui.text}>Share the journey across Cyprus.</Text>
        <Text style={[ui.small, { marginTop: 10 }]}>
          {db
            ? user
              ? "Connected · live account"
              : "Sign in to browse and book rides"
            : "DEMO MODE · sample drivers and reviews · temporary data"}
        </Text>
        {!user && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setPendingTab(null);
              setAuthPopup("member");
            }}
          >
            <Text style={ui.link}>Sign in / Create account</Text>
          </Pressable>
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginVertical: 22 }}
        >
          {["Find", "Publish", "My rides", "Alerts", "Profile", "Admin"].map(
            (t) => (
              <Pressable
                key={t}
                style={[ui.chip, tab === t && ui.selected]}
                onPress={() => {
                  navigate(t);
                }}
              >
                <Text style={[ui.chipText, tab === t && { color: "white" }]}>
                  {t}
                </Text>
              </Pressable>
            ),
          )}
        </ScrollView>
        {!!notice && (
          <Text accessibilityRole="alert" style={ui.notice}>
            {notice}
          </Text>
        )}
        {tab === "Admin" ? (
          <Admin
            user={user}
            role={profile?.role}
            onRefresh={() => refresh().catch((e) => setNotice(e.message))}
          />
        ) : tab === "Profile" && user ? (
          <Account
            key={user?.id ?? "guest"}
            user={user}
            profile={profile}
            onSaved={() => refresh().catch((e) => setNotice(e.message))}
            recovery={recovery}
            onRecoveryDone={() => setRecovery(false)}
            onChangePassword={() => setAuthPopup("password")}
          />
        ) : tab === "Alerts" ? (
          <>
            <Text style={ui.heading}>Notifications</Text>
            <Button
              title="Enable phone push notifications"
              onPress={() =>
                run(async () => {
                  await registerPush();
                  setNotice("Phone notifications enabled.");
                })
              }
            />
            {notifications.length === 0 && (
              <Text style={ui.notice}>
                {db
                  ? "No notifications yet."
                  : "Notifications become live after connecting Supabase."}
              </Text>
            )}
            {notifications.map((n) => (
              <Pressable
                key={n.id}
                style={ui.card}
                onPress={() =>
                  run(async () => {
                    const { error } = await db!
                      .from("notifications")
                      .update({ read: true })
                      .eq("id", n.id);
                    if (error) throw error;
                  })
                }
              >
                <Text style={ui.text}>
                  {n.read ? "" : "● "}
                  {n.body}
                </Text>
                <Text style={ui.small}>
                  {dateLabel(n.created_at)} · tap to mark read
                </Text>
              </Pressable>
            ))}
          </>
        ) : (
          <>
            {(tab === "Find" || tab === "Publish") && (
              <View style={ui.card}>
                <Text style={ui.heading}>
                  {tab === "Publish"
                    ? "Publish your journey"
                    : "Where are you heading?"}
                </Text>
                <Field
                  label="From · city or choose an address"
                  value={from}
                  onChangeText={(v) => {
                    setFrom(v);
                    setOrigin(undefined);
                  }}
                />
                <Pressable onPress={() => setMap("from")}>
                  <Text style={ui.link}>
                    ⌖ Search address / choose on Google Maps
                  </Text>
                </Pressable>
                {origin && (
                  <Text style={ui.small}>
                    {origin.address}
                    {"\n"}
                    {origin.latitude.toFixed(5)}, {origin.longitude.toFixed(5)}
                  </Text>
                )}
                <Field
                  label="To · city or choose an address"
                  value={to}
                  onChangeText={(v) => {
                    setTo(v);
                    setDestination(undefined);
                  }}
                />
                <Pressable onPress={() => setMap("to")}>
                  <Text style={ui.link}>⌖ Choose destination address</Text>
                </Pressable>
                {destination && (
                  <Text style={ui.small}>{destination.address}</Text>
                )}
                {tab === "Find" ? (
                  <>
                    <Pressable
                      onPress={() => {
                        setFrom(to);
                        setTo(from);
                        setOrigin(destination);
                        setDestination(origin);
                      }}
                    >
                      <Text style={ui.link}>↑↓ Swap route</Text>
                    </Pressable>
                    <Field
                      label="Search by driver name"
                      value={driverQuery}
                      onChangeText={setDriverQuery}
                    />
                    <Button
                      title={
                        dateFilter
                          ? `Travel date: ${day(dateFilter)}`
                          : "Any date · choose travel date"
                      }
                      onPress={() => setPicker("filter")}
                    />
                    {dateFilter && (
                      <Pressable onPress={() => setDateFilter(null)}>
                        <Text style={ui.link}>Clear date filter</Text>
                      </Pressable>
                    )}
                    <Text style={ui.label}>SORT BY</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                      {sorts.map((item) => (
                        <Pressable
                          key={item}
                          style={[ui.chip, sort === item && ui.selected]}
                          onPress={() => setSort(item)}
                        >
                          <Text
                            style={[
                              ui.chipText,
                              sort === item && { color: "white" },
                            ]}
                          >
                            {item}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={ui.label}>DEPARTURE · DEVICE LOCAL TIME</Text>
                    <View style={ui.row}>
                      <Button
                        title={date.toLocaleDateString()}
                        onPress={() => setPicker("date")}
                      />
                      <Button
                        title={date.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        onPress={() => setPicker("time")}
                      />
                    </View>
                    <Text style={ui.small}>
                      Cyprus departure: {dateLabel(date)}
                    </Text>
                    <Field
                      label="Estimated journey time (minutes)"
                      value={duration}
                      onChangeText={setDuration}
                      keyboardType="numeric"
                    />
                    <Field
                      label="Price per seat (€)"
                      value={price}
                      onChangeText={setPrice}
                      keyboardType="decimal-pad"
                    />
                    <Field
                      label="Available seats"
                      value={seats}
                      onChangeText={setSeats}
                      keyboardType="numeric"
                    />
                    {db && !profile?.driver_approved && (
                      <Text style={ui.notice}>
                        Driver approval required. Submit your licence and
                        vehicle details in Profile.
                      </Text>
                    )}
                    <Button
                      title={db ? "Publish ride" : "Publish demo ride"}
                      disabled={busy}
                      onPress={() => run(publish)}
                    />
                  </>
                )}
              </View>
            )}
            {(tab === "Find" || tab === "My rides") && (
              <>
                <Text style={[ui.heading, { marginTop: 24 }]}>
                  {tab === "My rides"
                    ? "Your bookings & published rides"
                    : "Island connections"}{" "}
                  · {filtered.length}
                </Text>
                {filtered.map((ride) => {
                  const driver = drivers.find((d) => d.id === ride.driver_id);
                  const value = score(reviews, ride.driver_id, "rating");
                  return (
                    <Pressable
                      key={ride.id}
                      style={ui.card}
                      onPress={() => {
                        setSelectedId(ride.id);
                        setComment("");
                        setReport("");
                        setRating(5);
                        setDriving(5);
                        setChatty(3);
                      }}
                    >
                      <View style={ui.row}>
                        <Text style={ui.small}>
                          {dateLabel(ride.departure)} · {ride.duration} min
                        </Text>
                        <Text style={ui.heading}>
                          €{Number(ride.price).toFixed(2)} / seat
                        </Text>
                      </View>
                      <Text style={ui.heading}>
                        {ride.from_city} → {ride.to_city}
                      </Text>
                      <View style={ui.row}>
                        <Avatar
                          name={driver?.name ?? "Driver"}
                          url={driver?.avatar_url}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={ui.text}>
                            {driver?.name ?? "Driver"}
                          </Text>
                          <Stars value={value} />
                        </View>
                        <Text style={ui.small}>
                          {ride.seats} seats{"\n"}
                          {ride.status}
                        </Text>
                      </View>
                      <Text style={ui.small}>
                        Driving:{" "}
                        {score(reviews, ride.driver_id, "driving")?.toFixed(
                          1,
                        ) ?? "—"}
                        /5 · Chatty:{" "}
                        {score(reviews, ride.driver_id, "chatty")?.toFixed(1) ??
                          "—"}
                        /5
                      </Text>
                    </Pressable>
                  );
                })}
                {!filtered.length && (
                  <Text style={ui.notice}>
                    {tab === "My rides"
                      ? "Your bookings and published rides appear here."
                      : "No matching rides. Try different filters or publish a journey."}
                  </Text>
                )}
              </>
            )}
          </>
        )}
        <Text style={[ui.small, { marginVertical: 30 }]}>
          Cancellation: scheduled bookings may be cancelled before the trip
          starts. No payments or cancellation fees are collected in this
          version. Driver location is shared only during an active trip with
          accepted participants.
        </Text>
      </ScrollView>
      {picker && (
        <Modal
          transparent
          visible
          animationType="slide"
          onRequestClose={() => setPicker(null)}
        >
          <View style={ui.overlay}>
            <View style={ui.sheet}>
              <Text style={ui.heading}>
                {picker === "time"
                  ? "Choose departure time"
                  : "Choose travel date"}
              </Text>
              <DateTimePicker
                value={picker === "filter" ? (dateFilter ?? new Date()) : date}
                mode={picker === "time" ? "time" : "date"}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={picker === "time" ? undefined : new Date()}
                onChange={(event, value) => {
                  if (event.type === "set" && value) {
                    if (picker === "filter") setDateFilter(value);
                    else setDate(value);
                  }
                  if (Platform.OS === "android") setPicker(null);
                }}
              />
              <Button title="Done" onPress={() => setPicker(null)} />
            </View>
          </View>
        </Modal>
      )}
      <AddressPicker
        visible={!!map}
        initial={map === "to" ? destination : origin}
        onClose={() => setMap(null)}
        onSelect={(point) => {
          if (map === "from") {
            setOrigin(point);
            setFrom(point.city);
          } else {
            setDestination(point);
            setTo(point.city);
          }
        }}
      />
      <Modal
        visible={!!selected}
        animationType="slide"
        onRequestClose={() => setSelectedId(null)}
      >
        <SafeAreaView style={ui.screen}>
          <ScrollView
            contentContainerStyle={ui.content}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable onPress={() => setSelectedId(null)}>
              <Text style={ui.link}>← Back to rides</Text>
            </Pressable>
            {!!notice && (
              <Text accessibilityRole="alert" style={ui.notice}>
                {notice}
              </Text>
            )}
            {selected && (
              <>
                <Text style={ui.title}>
                  {selected.from_city} → {selected.to_city}
                </Text>
                <Text style={ui.text}>
                  {dateLabel(selected.departure)} Cyprus time ·{" "}
                  {selected.duration} min{"\n"}€
                  {Number(selected.price).toFixed(2)} per seat ·{" "}
                  {selected.seats} seats · {selected.status}
                </Text>
                <Text style={ui.label}>PICKUP</Text>
                <Text style={ui.text}>{selected.pickup.address}</Text>
                <Text style={ui.label}>DROP-OFF</Text>
                <Text style={ui.text}>{selected.dropoff.address}</Text>
                <View style={[ui.row, { marginTop: 24 }]}>
                  <Avatar
                    name={selectedDriver?.name ?? "Driver"}
                    url={selectedDriver?.avatar_url}
                    size={64}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={ui.heading}>{selectedDriver?.name}</Text>
                    <Stars
                      value={score(reviews, selected.driver_id, "rating")}
                    />
                    <Text style={ui.small}>
                      {selectedDriver?.vehicle}
                      {"\n"}
                      {selectedDriver?.driver_approved
                        ? "Approved driver"
                        : "Unverified / demo driver"}
                    </Text>
                  </View>
                </View>
                <Text style={ui.small}>
                  Driving quality:{" "}
                  {score(reviews, selected.driver_id, "driving")?.toFixed(1) ??
                    "No reviews"}{" "}
                  · Chatty:{" "}
                  {score(reviews, selected.driver_id, "chatty")?.toFixed(1) ??
                    "No reviews"}{" "}
                  (1 = quiet, 5 = very chatty)
                </Text>
                {!mine &&
                  (!myBooking ||
                    ["cancelled", "rejected"].includes(myBooking.status)) &&
                  selected.status === "scheduled" && (
                    <Button
                      title={db ? "Request a seat" : "Reserve a demo seat"}
                      disabled={
                        busy ||
                        selected.seats < 1 ||
                        Date.parse(selected.departure) <= Date.now()
                      }
                      onPress={() => run(() => request(selected))}
                    />
                  )}
                {myBooking && (
                  <Text style={ui.notice}>
                    Booking status: {myBooking.status}
                  </Text>
                )}
                {myBooking &&
                  ["pending", "accepted"].includes(myBooking.status) &&
                  selected.status === "scheduled" && (
                    <Button
                      title="Cancel booking"
                      disabled={busy}
                      onPress={() => run(() => cancel(myBooking))}
                    />
                  )}
                {mine && (
                  <>
                    <Text style={[ui.heading, { marginTop: 24 }]}>
                      Manage your trip
                    </Text>
                    {bookings
                      .filter((b) => b.ride_id === selected.id)
                      .map((booking) => (
                        <View key={booking.id} style={ui.card}>
                          <Text style={ui.text}>
                            {drivers.find((d) => d.id === booking.passenger_id)
                              ?.name ?? "Passenger"}{" "}
                            · {booking.status}
                          </Text>
                          {booking.status === "pending" &&
                            ["accepted", "rejected"].map((decision) => (
                              <Button
                                key={decision}
                                title={
                                  decision === "accepted"
                                    ? "Accept passenger"
                                    : "Reject request"
                                }
                                disabled={busy}
                                onPress={() =>
                                  run(async () => {
                                    const { error } = await db!.rpc(
                                      "respond_booking",
                                      { booking: booking.id, decision },
                                    );
                                    if (error) throw error;
                                  })
                                }
                              />
                            ))}
                          {booking.status === "accepted" &&
                            selected.status === "scheduled" && (
                              <Button
                                title="Cancel passenger booking"
                                onPress={() => run(() => cancel(booking))}
                              />
                            )}
                        </View>
                      ))}
                    {selected.status === "scheduled" && (
                      <>
                        <Button
                          title="Start trip"
                          disabled={busy}
                          onPress={() => run(() => status(selected, "active"))}
                        />
                        <Button
                          title="Cancel ride and notify passengers"
                          disabled={busy}
                          onPress={() =>
                            Alert.alert(
                              "Cancel ride?",
                              "All pending and accepted bookings will be cancelled.",
                              [
                                { text: "Keep ride", style: "cancel" },
                                {
                                  text: "Cancel ride",
                                  style: "destructive",
                                  onPress: () =>
                                    run(() => status(selected, "cancelled")),
                                },
                              ],
                            )
                          }
                        />
                      </>
                    )}
                    {selected.status === "active" && (
                      <Button
                        title="Complete trip"
                        disabled={busy}
                        onPress={() => run(() => status(selected, "completed"))}
                      />
                    )}
                  </>
                )}
                {!db && myBooking?.status === "accepted" && (
                  <Button
                    title="Simulate completed demo trip"
                    onPress={() => run(() => status(selected, "completed"))}
                  />
                )}
                {canChat && db && (
                  <View style={{ marginTop: 25 }}>
                    <Trip
                      key={selected.id}
                      ride={selected}
                      userId={uid}
                      profiles={drivers}
                    />
                  </View>
                )}
                {!canChat && (
                  <Button
                    title="Open pickup in Google Maps"
                    onPress={() =>
                      NativeLinking.openURL(
                        `https://www.google.com/maps/search/?api=1&query=${selected.pickup.latitude},${selected.pickup.longitude}`,
                      )
                    }
                  />
                )}
                <Text style={[ui.heading, { marginTop: 25 }]}>
                  Driver reviews
                </Text>
                {reviews
                  .filter((r) => r.driver_id === selected.driver_id)
                  .map((review) => (
                    <View key={review.id} style={ui.card}>
                      <View style={ui.row}>
                        <Avatar
                          name={
                            drivers.find((d) => d.id === review.author_id)
                              ?.name ?? "Passenger"
                          }
                        />
                        <Stars value={review.rating} />
                      </View>
                      <Text style={ui.text}>{review.comment}</Text>
                      <Text style={ui.small}>
                        Driving {review.driving}/5 · Chatty {review.chatty}/5
                      </Text>
                    </View>
                  ))}
                {myBooking?.status === "completed" &&
                  !reviews.some((r) => r.booking_id === myBooking.id) && (
                    <View style={ui.card}>
                      <Text style={ui.heading}>
                        Review your completed journey
                      </Text>
                      <RatingInput
                        label="Overall rating"
                        value={rating}
                        onChange={setRating}
                      />
                      <RatingInput
                        label="Driving quality"
                        value={driving}
                        onChange={setDriving}
                      />
                      <RatingInput
                        label="Chatty · 1 quiet, 5 very chatty"
                        value={chatty}
                        onChange={setChatty}
                      />
                      <Field
                        label="Your review"
                        value={comment}
                        onChangeText={setComment}
                      />
                      <Button
                        title="Submit review"
                        disabled={busy}
                        onPress={() =>
                          run(async () => {
                            const review = {
                              booking_id: myBooking.id,
                              driver_id: selected.driver_id,
                              author_id: uid,
                              rating,
                              driving,
                              chatty,
                              comment: comment.trim(),
                            };
                            if (db) {
                              const { error } = await db
                                .from("reviews")
                                .insert(review);
                              if (error) throw error;
                            } else
                              setReviews((old) => [
                                ...old,
                                { ...review, id: String(Date.now()) },
                              ]);
                            setNotice("Review submitted.");
                          })
                        }
                      />
                    </View>
                  )}
                {!mine && (
                  <View style={ui.card}>
                    <Text style={ui.heading}>Report or block</Text>
                    <Field
                      label="Reason for reporting"
                      value={report}
                      onChangeText={setReport}
                    />
                    <Button
                      title="Submit report"
                      disabled={busy || report.trim().length < 3}
                      onPress={() =>
                        run(async () => {
                          if (!db)
                            throw new Error(
                              "Reporting needs a connected account.",
                            );
                          const { error } = await db.from("reports").insert({
                            reported_id: selected.driver_id,
                            reason: report.trim(),
                          });
                          if (error) throw error;
                          setReport("");
                          setNotice("Report sent to administrators.");
                        })
                      }
                    />
                    <Button
                      title="Block this driver"
                      disabled={busy}
                      onPress={() =>
                        Alert.alert(
                          "Block driver?",
                          "Their rides will be hidden and new bookings prevented. Existing accepted bookings remain; cancel those separately if needed.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Block",
                              onPress: () =>
                                run(async () => {
                                  if (db) {
                                    const { error } = await db
                                      .from("blocks")
                                      .upsert({
                                        blocked_id: selected.driver_id,
                                      });
                                    if (error) throw error;
                                  } else
                                    setBlocked((old) => [
                                      ...old,
                                      selected.driver_id,
                                    ]);
                                  setSelectedId(null);
                                  setNotice("Driver blocked.");
                                }),
                            },
                          ],
                        )
                      }
                    />
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={!!authPopup}
        transparent
        animationType="fade"
        onRequestClose={closeAuth}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[ui.overlay, { justifyContent: "center", padding: 20 }]}>
            <View
              accessibilityViewIsModal
              style={[
                ui.sheet,
                {
                  borderRadius: 24,
                  width: "100%",
                  maxWidth: 520,
                  alignSelf: "center",
                  padding: 0,
                },
              ]}
            >
              <View
                style={{
                  alignItems: "flex-end",
                  paddingHorizontal: 20,
                  paddingTop: 10,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close authentication popup"
                  onPress={closeAuth}
                >
                  <Text style={ui.link}>Close ✕</Text>
                </Pressable>
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 22, paddingTop: 0 }}
              >
                {authPopup === "admin" ? (
                  <Admin
                    user={user}
                    role={profile?.role}
                    onRefresh={() =>
                      refresh().catch((e) => setNotice(e.message))
                    }
                  />
                ) : (
                  !!authPopup && (
                    <Account
                      key={`${authPopup}-${user?.id ?? "guest"}`}
                      user={authPopup === "password" ? user : null}
                      profile={profile}
                      passwordOnly={authPopup === "password"}
                      recovery={recovery}
                      onSaved={() =>
                        refresh().catch((e) => setNotice(e.message))
                      }
                      onRecoveryDone={() => {
                        setRecovery(false);
                        setAuthPopup(null);
                        setNotice("Password updated.");
                      }}
                    />
                  )
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
