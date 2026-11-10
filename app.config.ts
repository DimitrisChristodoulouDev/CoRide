import type { ExpoConfig, ConfigContext } from "expo/config";
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "CoRide",
  slug: "coride",
  scheme: "coride",
  ios: { ...config.ios, bundleIdentifier: "com.coride.app" },
  android: { ...config.android, package: "com.coride.app" },
  plugins: [
    "@react-native-community/datetimepicker",
    "expo-secure-store",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "CoRide uses your location to select a pickup point and, only when you choose to share it, show your position to trip participants.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Choose your profile picture or a driving licence image for review.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    ["expo-notifications", { defaultChannel: "bookings" }],
    [
      "react-native-maps",
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? "",
        iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY ?? "",
      },
    ],
  ],
  extra: {
    ...config.extra,
    nativeMaps: {
      android: !!process.env.GOOGLE_MAPS_ANDROID_API_KEY,
      ios: !!process.env.GOOGLE_MAPS_IOS_API_KEY,
    },
    ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID
      ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } }
      : {}),
  },
});
