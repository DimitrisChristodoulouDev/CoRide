import React, { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import type { User } from "@supabase/supabase-js";
import { db, signOut } from "./backend";
import { Avatar, Button, Field, ui } from "./ui";
import type { Driver } from "./model";
type Request = {
  id: string;
  user_id: string;
  document_path: string;
  vehicle: string;
  licence_number: string;
  expires_on: string;
  status: string;
};
export default function Admin({
  user,
  role,
  onRefresh,
}: {
  user: User | null;
  role?: string;
  onRefresh: () => void;
}) {
  const [email, setEmail] = useState("admin@coride.com"),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [stats, setStats] = useState<Record<string, number>>({}),
    [drivers, setDrivers] = useState<Driver[]>([]),
    [requests, setRequests] = useState<Request[]>([]),
    [reports, setReports] = useState<any[]>([]);
  const [editing, setEditing] = useState<Driver | null>(null),
    [name, setName] = useState(""),
    [vehicle, setVehicle] = useState(""),
    [note, setNote] = useState("");
  async function load() {
    if (!db || role !== "admin") return;
    const values = await Promise.all([
      db.rpc("admin_stats"),
      db.from("profiles").select("*").eq("wants_driver", true),
      db.from("verification_requests").select("*").eq("status", "pending"),
      db.from("reports").select("*").eq("status", "open"),
    ]);
    const error = values.find((r) => r.error)?.error;
    if (error) throw error;
    setStats(values[0].data ?? {});
    setDrivers(values[1].data ?? []);
    setRequests(values[2].data ?? []);
    setReports(values[3].data ?? []);
  }
  useEffect(() => {
    load().catch((e) => setNotice(e.message));
  }, [role]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (!user)
    return (
      <View>
        <Text style={ui.title}>Admin sign in</Text>
        <Text style={ui.text}>Authorised CoRide administrators only.</Text>
        {!db && (
          <Text style={ui.notice}>
            Connect Supabase and run the private admin setup script first.
          </Text>
        )}
        {!!notice && <Text style={ui.notice}>{notice}</Text>}
        <Field
          label="Admin email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <Field
          label="Admin password"
          value={password}
          onChangeText={setPassword}
          secure
        />
        <Button
          title="Open admin dashboard"
          disabled={busy || !db}
          onPress={() =>
            run(async () => {
              const result = await db!.auth.signInWithPassword({
                email: email.trim(),
                password,
              });
              if (result.error) throw result.error;
              setPassword("");
              onRefresh();
            })
          }
        />
      </View>
    );
  if (role !== "admin")
    return (
      <View>
        <Text style={ui.title}>Admin access required</Text>
        <Text style={ui.text}>
          Your account does not have an administrator role.
        </Text>
        <Button
          title="Sign out to use an admin account"
          onPress={() =>
            run(async () => {
              await signOut();
            })
          }
        />
        {!!notice && <Text style={ui.notice}>{notice}</Text>}
      </View>
    );
  return (
    <View>
      <Text style={ui.title}>Admin dashboard</Text>
      <Text style={ui.text}>
        Manage drivers, review licences and handle reports.
      </Text>
      {!!notice && (
        <Text accessibilityRole="alert" style={ui.notice}>
          {notice}
        </Text>
      )}
      <Button
        title="Refresh statistics"
        disabled={busy}
        onPress={() => run(load)}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
        {Object.entries(stats).map(([label, value]) => (
          <View key={label} style={[ui.card, { width: "47%" }]}>
            <Text style={ui.title}>{value}</Text>
            <Text style={ui.small}>{label.replaceAll("_", " ")}</Text>
          </View>
        ))}
      </View>
      <Text style={[ui.heading, { marginTop: 25 }]}>
        Pending driver approvals
      </Text>
      <Field
        label="Reviewer note (included with the decision)"
        value={note}
        onChangeText={setNote}
      />
      {requests.length === 0 && (
        <Text style={ui.text}>No pending applications.</Text>
      )}
      {requests.map((request) => (
        <View key={request.id} style={ui.card}>
          <Text style={ui.heading}>
            {drivers.find((d) => d.id === request.user_id)?.name ??
              request.user_id}
          </Text>
          <Text style={ui.text}>
            {request.vehicle}
            {"\n"}Licence: {request.licence_number}
            {"\n"}Expires: {request.expires_on}
          </Text>
          <Button
            title="View private licence image"
            disabled={busy}
            onPress={() =>
              run(async () => {
                const { data, error } = await db!.storage
                  .from("verification")
                  .createSignedUrl(request.document_path, 120);
                if (error) throw error;
                await Linking.openURL(data.signedUrl);
              })
            }
          />
          <Text style={ui.small}>
            Check identity, document authenticity, licence category and expiry
            before approval.
          </Text>
          <Button
            title="Approve driver"
            disabled={busy}
            onPress={() =>
              run(async () => {
                const { error } = await db!.rpc("admin_review_driver", {
                  request: request.id,
                  approve: true,
                  note,
                });
                if (error) throw error;
                await load();
                onRefresh();
              })
            }
          />
          <Button
            title="Reject application"
            disabled={busy}
            onPress={() =>
              run(async () => {
                const { error } = await db!.rpc("admin_review_driver", {
                  request: request.id,
                  approve: false,
                  note,
                });
                if (error) throw error;
                await load();
                onRefresh();
              })
            }
          />
        </View>
      ))}
      <Text style={[ui.heading, { marginTop: 25 }]}>Drivers</Text>
      {drivers.map((driver) => (
        <Pressable
          key={driver.id}
          style={ui.card}
          onPress={() => {
            setEditing(driver);
            setName(driver.name);
            setVehicle(driver.vehicle ?? "");
          }}
        >
          <View style={ui.row}>
            <Avatar name={driver.name} url={driver.avatar_url} />
            <View style={{ flex: 1 }}>
              <Text style={ui.heading}>{driver.name}</Text>
              <Text style={ui.small}>
                {driver.vehicle} · {driver.verification_status}
              </Text>
            </View>
            <Text style={ui.link}>Edit</Text>
          </View>
        </Pressable>
      ))}
      {editing && (
        <View style={ui.card}>
          <Text style={ui.heading}>Edit {editing.name}</Text>
          <Field label="Driver name" value={name} onChangeText={setName} />
          <Field label="Vehicle" value={vehicle} onChangeText={setVehicle} />
          <Button
            title="Save driver"
            disabled={busy}
            onPress={() =>
              run(async () => {
                const { error } = await db!.rpc("admin_edit_driver", {
                  driver: editing.id,
                  new_name: name,
                  new_vehicle: vehicle,
                  approved: !!(editing as any).driver_approved,
                });
                if (error) throw error;
                setEditing(null);
                await load();
                onRefresh();
              })
            }
          />
          <Button
            title="Suspend publishing access"
            disabled={busy}
            onPress={() =>
              run(async () => {
                const { error } = await db!.rpc("admin_edit_driver", {
                  driver: editing.id,
                  new_name: name,
                  new_vehicle: vehicle,
                  approved: false,
                });
                if (error) throw error;
                setEditing(null);
                await load();
                onRefresh();
              })
            }
          />
          <Pressable onPress={() => setEditing(null)}>
            <Text style={ui.link}>Close editor</Text>
          </Pressable>
        </View>
      )}
      <Text style={[ui.heading, { marginTop: 25 }]}>Open reports</Text>
      {reports.map((report) => (
        <View key={report.id} style={ui.card}>
          <Text style={ui.text}>{report.reason}</Text>
          <Text style={ui.small}>Reported account: {report.reported_id}</Text>
          <Button
            title="Mark resolved"
            disabled={busy}
            onPress={() =>
              run(async () => {
                const { error } = await db!
                  .from("reports")
                  .update({ status: "resolved" })
                  .eq("id", report.id);
                if (error) throw error;
                await load();
              })
            }
          />
        </View>
      ))}
      <Button
        title="Sign out of admin"
        onPress={() =>
          run(async () => {
            await signOut();
          })
        }
      />
    </View>
  );
}
