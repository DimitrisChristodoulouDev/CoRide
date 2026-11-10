import React, { useEffect, useState } from "react";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { authRedirectUrl } from "./authRedirect";
import type { User } from "@supabase/supabase-js";
import { db, signOut } from "./backend";
import { Avatar, Button, Field, ui } from "./ui";
import type { Driver } from "./model";
export default function Account({
  user,
  profile,
  onSaved,
  recovery,
  onRecoveryDone,
  passwordOnly = false,
  onChangePassword,
}: {
  user: User | null;
  profile?: Driver;
  onSaved: () => void;
  recovery: boolean;
  onRecoveryDone: () => void;
  passwordOnly?: boolean;
  onChangePassword?: () => void;
}) {
  const [mode, setMode] = useState<"Sign in" | "Sign up" | "Forgot password">(
    "Sign in",
  );
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [name, setName] = useState(profile?.name ?? ""),
    [vehicle, setVehicle] = useState(profile?.vehicle ?? "");
  const [wantsDriver, setWantsDriver] = useState(false),
    [licence, setLicence] = useState(""),
    [expiry, setExpiry] = useState("");
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [current, setCurrent] = useState("");
  useEffect(() => {
    setName(profile?.name ?? "");
    setVehicle(profile?.vehicle ?? "");
  }, [profile?.name, profile?.vehicle]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    await run(async () => {
      if (!db)
        throw new Error(
          "Connect Supabase using the README setup to enable accounts.",
        );
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        throw new Error("Enter a valid email address.");
      const redirect = authRedirectUrl();
      if (mode === "Forgot password") {
        const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: redirect,
        });
        if (error) throw error;
        setNotice(
          "If the account exists, a reset link has been sent. Open it on this phone.",
        );
        return;
      }
      if (password.length < 8)
        throw new Error("Use at least 8 characters for your password.");
      if (mode === "Sign up") {
        if (!name.trim()) throw new Error("Enter your name.");
        if (password !== confirm) throw new Error("Passwords do not match.");
        const { error, data } = await db.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim(), wants_driver: wantsDriver },
            emailRedirectTo: redirect,
          },
        });
        if (error) throw error;
        setNotice(
          data.session
            ? "Account created."
            : "Check your email to confirm your account, then sign in.",
        );
      } else {
        const { error } = await db.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
      setPassword("");
      setConfirm("");
    });
  }
  async function changePassword() {
    await run(async () => {
      if (!db || !user) return;
      if (password.length < 8 || password !== confirm)
        throw new Error(
          "New passwords must match and contain at least 8 characters.",
        );
      if (!recovery) {
        const { error } = await db.auth.signInWithPassword({
          email: user.email!,
          password: current,
        });
        if (error) throw new Error("Current password is incorrect.");
      }
      const { error } = await db.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirm("");
      setCurrent("");
      onRecoveryDone();
      setNotice("Password updated.");
    });
  }
  async function uploadAvatar() {
    await run(async () => {
      if (!db || !user) return;
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        throw new Error("Allow photo access to select an avatar.");
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (!asset.base64)
        throw new Error(
          "Unable to read the selected image. Please choose another photo.",
        );
      const bytes = decode(asset.base64);
      if (bytes.byteLength > 5 * 1024 * 1024)
        throw new Error("Choose a photo under 5 MB.");
      const ext = asset.mimeType === "image/png" ? "png" : "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await db.storage
        .from("avatars")
        .upload(path, bytes, { contentType: asset.mimeType ?? "image/jpeg" });
      if (error) throw error;
      const { data } = db.storage.from("avatars").getPublicUrl(path);
      const result = await db
        .from("profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("id", user.id);
      if (result.error) throw result.error;
      onSaved();
      setNotice("Profile picture updated.");
    });
  }
  async function verification() {
    await run(async () => {
      if (!db || !user) return;
      if (
        !vehicle.trim() ||
        !licence.trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(expiry) ||
        !Number.isFinite(Date.parse(expiry)) ||
        new Date(expiry) <= new Date()
      )
        throw new Error(
          "Enter your vehicle, licence number and a future expiry date (YYYY-MM-DD).",
        );
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        throw new Error("Allow photo access to upload a document.");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64)
        throw new Error(
          "Unable to read the selected image. Please choose another photo.",
        );
      const bytes = decode(asset.base64);
      if (bytes.byteLength > 10 * 1024 * 1024)
        throw new Error("Choose a document image under 10 MB.");
      const path = `${user.id}/${Date.now()}.jpg`;
      const upload = await db.storage
        .from("verification")
        .upload(path, bytes, { contentType: asset.mimeType ?? "image/jpeg" });
      if (upload.error) throw upload.error;
      const { error } = await db.from("verification_requests").insert({
        user_id: user.id,
        document_path: path,
        vehicle: vehicle.trim(),
        licence_number: licence.trim(),
        expires_on: expiry,
      });
      if (error) throw error;
      setNotice(
        "Verification submitted for manual review. Submission does not mean approval.",
      );
    });
  }
  if (passwordOnly && user)
    return (
      <View>
        {!!notice && (
          <Text accessibilityRole="alert" style={ui.notice}>
            {notice}
          </Text>
        )}
        <Text style={[ui.heading, { marginTop: 25 }]}>
          {recovery ? "Reset your password" : "Change password"}
        </Text>
        {!recovery && (
          <Field
            label="Current password"
            secure
            value={current}
            onChangeText={setCurrent}
          />
        )}
        <Field
          label="New password"
          secure
          value={password}
          onChangeText={setPassword}
        />
        <Field
          label="Confirm new password"
          secure
          value={confirm}
          onChangeText={setConfirm}
        />
        <Button
          title="Update password"
          disabled={busy}
          onPress={changePassword}
        />
      </View>
    );
  return (
    <View>
      <Text style={ui.title}>{user ? "Your profile" : mode}</Text>
      {!db && (
        <Text style={ui.notice}>
          Demo mode · Account features need Supabase configuration.
        </Text>
      )}
      {!!notice && (
        <Text accessibilityRole="alert" style={ui.notice}>
          {notice}
        </Text>
      )}
      {user ? (
        <>
          <Avatar
            name={profile?.name ?? "You"}
            url={profile?.avatar_url}
            size={80}
          />
          <Text style={ui.text}>{user.email}</Text>
          <Button
            title="Update profile picture"
            onPress={uploadAvatar}
            disabled={busy}
          />
          <Field label="Name" value={name} onChangeText={setName} />
          <Field
            label="Vehicle · make, model, colour and plate"
            value={vehicle}
            onChangeText={setVehicle}
          />
          <Button
            title="Save profile"
            disabled={busy}
            onPress={() =>
              run(async () => {
                if (!name.trim()) throw new Error("Name is required.");
                const { error } = await db!
                  .from("profiles")
                  .update({ name: name.trim(), vehicle: vehicle.trim() })
                  .eq("id", user.id);
                if (error) throw error;
                onSaved();
                setNotice("Profile saved.");
              })
            }
          />
          <Text style={[ui.heading, { marginTop: 25 }]}>
            Driver verification
          </Text>
          <Text style={ui.text}>
            Status: {profile?.verification_status ?? "unverified"}. Upload your
            driving licence for manual review. Only authorised reviewers can
            access verification documents.
          </Text>
          <Field
            label="Driving licence number"
            value={licence}
            onChangeText={setLicence}
          />
          <Field
            label="Licence expiry (YYYY-MM-DD)"
            value={expiry}
            onChangeText={setExpiry}
          />
          <Button
            title="Submit licence for review"
            disabled={busy}
            onPress={() =>
              Alert.alert(
                "Submit driving licence",
                "This uploads a private document to the app operator for manual verification. Continue?",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Choose document", onPress: verification },
                ],
              )
            }
          />
          <Button
            title="Change password"
            onPress={() => onChangePassword?.()}
          />
          <Button
            title="Sign out"
            disabled={busy}
            onPress={() =>
              run(async () => {
                await signOut();
              })
            }
          />
        </>
      ) : (
        <>
          <View style={[ui.row, { flexWrap: "wrap" }]}>
            {(["Sign in", "Sign up", "Forgot password"] as const).map(
              (item) => (
                <Pressable
                  key={item}
                  onPress={() => {
                    setMode(item);
                    setNotice("");
                    setPassword("");
                    setConfirm("");
                  }}
                >
                  <Text style={ui.link}>{item}</Text>
                </Pressable>
              ),
            )}
          </View>
          {mode === "Sign up" && (
            <>
              <Field label="Name" value={name} onChangeText={setName} />
              <View style={ui.row}>
                <Text style={ui.text}>Register as a driver</Text>
                <Switch
                  accessibilityLabel="Register as a driver"
                  value={wantsDriver}
                  onValueChange={setWantsDriver}
                />
              </View>
              {wantsDriver && (
                <Text style={ui.notice}>
                  After confirming your email, sign in and submit your licence,
                  expiry date and vehicle in Profile. Publishing is unlocked
                  only after admin approval.
                </Text>
              )}
            </>
          )}
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
          {mode !== "Forgot password" && (
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secure
            />
          )}
          {mode === "Sign up" && (
            <Field
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              secure
            />
          )}
          <Button
            title={
              busy
                ? "Please wait…"
                : mode === "Forgot password"
                  ? "Send reset link"
                  : mode
            }
            disabled={busy}
            onPress={submit}
          />
        </>
      )}
    </View>
  );
}
