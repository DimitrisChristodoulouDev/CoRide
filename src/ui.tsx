import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f7f2" },
  content: {
    padding: 22,
    paddingTop: 42,
    maxWidth: 700,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 29,
    fontWeight: "800",
    color: "#153f36",
    marginBottom: 12,
  },
  heading: {
    fontSize: 19,
    fontWeight: "700",
    color: "#153f36",
    marginBottom: 10,
  },
  text: { color: "#536b60", lineHeight: 22 },
  small: { fontSize: 12, color: "#6b8174", lineHeight: 19 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#627970",
    marginTop: 16,
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: "#dce5d9",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#153f36",
    backgroundColor: "white",
  },
  card: {
    padding: 19,
    borderWidth: 1,
    borderColor: "#e0e7db",
    backgroundColor: "white",
    borderRadius: 18,
    marginTop: 13,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  button: {
    backgroundColor: "#178168",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: { fontWeight: "700", color: "white" },
  link: { color: "#168568", fontWeight: "700", paddingVertical: 10 },
  notice: {
    color: "#284f3e",
    backgroundColor: "#e1ecdf",
    padding: 14,
    borderRadius: 12,
    marginVertical: 12,
    lineHeight: 21,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#e5ece2",
    marginRight: 7,
    marginBottom: 7,
  },
  selected: { backgroundColor: "#153f36" },
  chipText: { color: "#426052", fontSize: 12, fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "#0008", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "94%",
    backgroundColor: "#f5f7f2",
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  stars: { color: "#c79328", fontSize: 17 },
});
export function Button({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[ui.button, disabled && { opacity: 0.4 }]}
    >
      <Text style={ui.buttonText}>{title}</Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  secure = false,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  secure?: boolean;
  keyboardType?: "default" | "email-address" | "decimal-pad" | "numeric";
}) {
  return (
    <>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={ui.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        autoCapitalize={
          keyboardType === "email-address" || secure ? "none" : "sentences"
        }
        keyboardType={keyboardType}
      />
    </>
  );
}
export function Avatar({
  name,
  url,
  size = 42,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  return url ? (
    <Image
      accessibilityLabel={`${name}'s avatar`}
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#dbece0",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{ color: "#205a45", fontWeight: "800", fontSize: size * 0.35 }}
      >
        {name
          .split(" ")
          .map((s) => s[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()}
      </Text>
    </View>
  );
}
export function Stars({ value }: { value: number | null }) {
  return (
    <Text style={ui.stars}>
      {value === null
        ? "No reviews"
        : `${"★".repeat(Math.round(value))}${"☆".repeat(5 - Math.round(value))} ${value.toFixed(1)}`}
    </Text>
  );
}
export function RatingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View>
      <Text style={ui.label}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 13 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityLabel={`${label}: ${n} of 5`}
            onPress={() => onChange(n)}
          >
            <Text style={{ fontSize: 32, color: "#c79328" }}>
              {n <= value ? "★" : "☆"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
