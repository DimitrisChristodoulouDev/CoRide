import * as Linking from "expo-linking";
import Constants from "expo-constants";
export function authRedirectUrl() {
  return Constants.executionEnvironment === "storeClient"
    ? Linking.createURL("auth/callback")
    : Linking.createURL("auth/callback", { scheme: "coride" });
}
