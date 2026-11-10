import React, { forwardRef } from "react";
import { Platform, Text, View } from "react-native";
import Constants from "expo-constants";
import MapView, { type MapViewProps } from "react-native-maps";
// Expo Go supplies its map credentials. Standalone builds need their own key.
const configured =
  Constants.executionEnvironment === "storeClient" ||
  !!Constants.expoConfig?.extra?.nativeMaps?.[Platform.OS];
export default forwardRef<MapView, MapViewProps>(
  function NativeMap(props, ref) {
    if (!configured)
      return (
        <View
          style={[
            props.style,
            {
              backgroundColor: "#e4ece2",
              padding: 22,
              justifyContent: "center",
              minHeight: 160,
            },
          ]}
        >
          <Text style={{ color: "#153f36", fontWeight: "700" }}>
            Map setup pending
          </Text>
          <Text style={{ color: "#536b60", marginTop: 10 }}>
            This test build needs a Google Maps SDK key. Address search, GPS
            selection and Google Maps navigation links are still available when
            configured.
          </Text>
        </View>
      );
    return <MapView {...props} ref={ref} />;
  },
);
