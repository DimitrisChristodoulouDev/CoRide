import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import Constants from "expo-constants";
import { db } from "./backend";
import { cityPoints, nearbyCity, type Pickup, type Point } from "./locations";

type Place = {
  id: string;
  formattedAddress: string;
  displayName?: { text: string };
  location: Point;
};
const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
export default function AddressPicker({
  visible,
  initial,
  onClose,
  onSelect,
}: {
  visible: boolean;
  initial?: Pickup;
  onClose: () => void;
  onSelect: (pickup: Pickup) => void;
}) {
  const map = useRef<MapView>(null);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [point, setPoint] = useState<Point | null>(null);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function close() {
    generation.current++;
    controller.current?.abort();
    setBusy(false);
    onClose();
  }
  function choose(next: Point, label: string) {
    generation.current++;
    controller.current?.abort();
    setBusy(false);
    setError("");
    setPoint(next);
    setAddress(label);
    setResults([]);
    map.current?.animateToRegion(
      { ...next, latitudeDelta: 0.025, longitudeDelta: 0.025 },
      450,
    );
  }
  async function search() {
    if (!query.trim()) {
      setError("Enter a street, address or place name.");
      return;
    }
    if (!key && !db) {
      setError(
        "Google address search needs a Google Places API key. See the project README for setup. You can still select a map point or use your location.",
      );
      return;
    }
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const id = ++generation.current;
    setBusy(true);
    setError("");
    setResults([]);
    const timeout = setTimeout(() => request.abort(), 15000);
    try {
      let data: any;
      if (db) {
        const result = await db.functions.invoke("search-address", {
          body: { query: query.trim() },
          signal: request.signal,
        });
        if (result.error)
          throw new Error(
            "Google address search is unavailable. Check the search-address function and Google Places setup.",
          );
        data = result.data;
        if (data?.error) throw new Error(data.error);
      } else {
        const response = await fetch(
          "https://places.googleapis.com/v1/places:searchText",
          {
            method: "POST",
            signal: request.signal,
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": key!,
              "X-Goog-FieldMask":
                "places.id,places.formattedAddress,places.displayName,places.location",
            },
            body: JSON.stringify({
              textQuery: `${query.trim()}, Cyprus`,
              regionCode: "CY",
              languageCode: "en",
              pageSize: 8,
              locationBias: {
                rectangle: {
                  low: { latitude: 34.5, longitude: 32.2 },
                  high: { latitude: 35.7, longitude: 34.6 },
                },
              },
            }),
          },
        );
        data = await response.json();
        if (!response.ok)
          throw new Error(
            "Google address search is unavailable. Check Places API (New), billing and the key.",
          );
      }
      if (id !== generation.current) return;
      const places: Place[] = (data.places ?? [])
        .map((p: any) => ({
          ...p,
          location: {
            latitude: p.location?.latitude,
            longitude: p.location?.longitude,
          },
        }))
        .filter((p: Place) => nearbyCity(p.location));
      setResults(places);
      if (!places.length)
        setError(
          "No addresses found in our supported Cyprus areas. Try a street and city.",
        );
    } catch (e) {
      if (id === generation.current)
        setError(
          e instanceof Error && e.name !== "AbortError"
            ? e.message
            : "Search timed out. Please try again.",
        );
    } finally {
      clearTimeout(timeout);
      if (id === generation.current) setBusy(false);
    }
  }
  async function locate() {
    controller.current?.abort();
    const id = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (id !== generation.current) return;
      if (permission.status !== "granted") {
        setError(
          "Location permission was denied. Search an address or tap the map instead.",
        );
        return;
      }
      const position = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "Location timed out. Check GPS or choose a point on the map.",
                ),
              ),
            20000,
          ),
        ),
      ]);
      if (id !== generation.current) return;
      const next = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      if (!nearbyCity(next)) {
        setError(
          "Your location is outside our supported Cyprus areas. Choose a pickup point on the map.",
        );
        return;
      }
      choose(next, "Current location");
    } catch (e) {
      if (id === generation.current)
        setError(
          e instanceof Error
            ? e.message
            : "Unable to get your location. Check GPS and try again.",
        );
    } finally {
      if (id === generation.current) setBusy(false);
    }
  }
  const selected = point ?? initial;
  const city = selected ? nearbyCity(selected) : null;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={close}
      onShow={() => {
        generation.current++;
        setPoint(initial ?? null);
        setAddress(initial?.address ?? "");
        setQuery("");
        setResults([]);
        setError("");
        setBusy(false);
      }}
    >
      <SafeAreaView style={s.screen}>
        <View style={s.header}>
          <Text style={s.title}>Choose an address</Text>
          <Pressable onPress={close}>
            <Text style={s.link}>Cancel</Text>
          </Pressable>
        </View>
        <View style={s.search}>
          <TextInput
            accessibilityLabel="Search full address"
            value={query}
            onChangeText={(text) => {
              controller.current?.abort();
              generation.current++;
              setBusy(false);
              setQuery(text);
              setResults([]);
            }}
            placeholder="Street, number, city or place"
            style={s.input}
            returnKeyType="search"
            onSubmitEditing={search}
          />
          <Pressable
            accessibilityRole="button"
            onPress={search}
            style={s.searchButton}
          >
            <Text style={{ color: "white" }}>Search</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={locate}
          disabled={busy}
          style={{ paddingHorizontal: 20, paddingBottom: 10 }}
        >
          <Text style={s.link}>◎ Use current location</Text>
        </Pressable>
        {busy && (
          <ActivityIndicator
            accessibilityLabel="Finding location"
            color="#178168"
          />
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
        {!!results.length && (
          <ScrollView
            style={{ maxHeight: 190 }}
            keyboardShouldPersistTaps="handled"
          >
            {results.map((place) => (
              <Pressable
                key={place.id}
                style={s.result}
                onPress={() => choose(place.location, place.formattedAddress)}
              >
                <Text style={{ fontWeight: "700", color: "#153f36" }}>
                  {place.displayName?.text}
                </Text>
                <Text>{place.formattedAddress}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <MapView
          ref={map}
          provider={
            Platform.OS === "ios" &&
            Constants.executionEnvironment === "storeClient"
              ? undefined
              : PROVIDER_GOOGLE
          }
          style={{ flex: 1 }}
          initialRegion={{
            ...(initial ?? cityPoints.Nicosia),
            latitudeDelta: 0.9,
            longitudeDelta: 0.9,
          }}
          onPress={(e) =>
            choose(e.nativeEvent.coordinate, "Selected map point")
          }
        >
          {selected && (
            <Marker
              coordinate={selected}
              title={address || initial?.address || "Pickup point"}
              draggable
              onDragEnd={(e) =>
                choose(e.nativeEvent.coordinate, "Selected map point")
              }
            />
          )}
        </MapView>
        <View style={s.bottom}>
          <Text style={s.detail}>Google Maps · address results by Google</Text>
          <Text style={s.title}>{address || "Tap the map to drop a pin"}</Text>
          {selected && (
            <Text style={s.detail}>
              {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)} ·{" "}
              {city ? `Matches rides from ${city}` : "Outside supported area"}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={!selected || !city || busy}
            style={[s.button, (!selected || !city || busy) && { opacity: 0.4 }]}
            onPress={() => {
              if (selected && city) {
                onSelect({
                  ...selected,
                  address: address || initial?.address || "Selected map point",
                  city,
                });
                close();
              }
            }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>
              Use this pickup point
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f7f2" },
  header: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#153f36" },
  link: { fontWeight: "700", color: "#178168" },
  search: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 14,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d3dfd2",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "white",
  },
  searchButton: {
    backgroundColor: "#178168",
    padding: 13,
    borderRadius: 12,
    justifyContent: "center",
  },
  result: { padding: 14, borderBottomWidth: 1, borderColor: "#d3dfd2" },
  error: { padding: 16, color: "#8a3d28" },
  bottom: { padding: 20, gap: 12 },
  detail: { fontSize: 12, color: "#627970" },
  button: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#178168",
    alignItems: "center",
  },
});
