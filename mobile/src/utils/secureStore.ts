import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Platform-gated drop-in for expo-secure-store. On iOS/Android it IS
 * expo-secure-store (keystore-backed). On web expo-secure-store has no
 * implementation — its native module is a stub whose methods throw — so
 * calls fall back to AsyncStorage (localStorage). Web sessions then keep
 * working for dev/preview; the token is not more exposed than any other
 * browser-stored bearer.
 */
export const secureStore = {
  getItemAsync(key: string): Promise<string | null> {
    return Platform.OS === "web"
      ? AsyncStorage.getItem(key)
      : SecureStore.getItemAsync(key);
  },
  setItemAsync(key: string, value: string): Promise<void> {
    return Platform.OS === "web"
      ? AsyncStorage.setItem(key, value)
      : SecureStore.setItemAsync(key, value);
  },
  deleteItemAsync(key: string): Promise<void> {
    return Platform.OS === "web"
      ? AsyncStorage.removeItem(key)
      : SecureStore.deleteItemAsync(key);
  },
};
