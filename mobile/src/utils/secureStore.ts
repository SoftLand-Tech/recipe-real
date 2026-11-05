import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Platform-gated drop-in for expo-secure-store. On iOS/Android it IS
 * expo-secure-store (keystore-backed). On web expo-secure-store has no
 * implementation — its native module is a stub whose methods throw — so the
 * web export is dev-only: reads return null and writes are a no-op. We
 * never persist bearer tokens in localStorage (AsyncStorage).
 */
export const secureStore = {
  getItemAsync(key: string): Promise<string | null> {
    return Platform.OS === "web"
      ? Promise.resolve(null)
      : SecureStore.getItemAsync(key);
  },
  setItemAsync(key: string, value: string): Promise<void> {
    return Platform.OS === "web"
      ? Promise.resolve()
      : SecureStore.setItemAsync(key, value);
  },
  deleteItemAsync(key: string): Promise<void> {
    return Platform.OS === "web"
      ? AsyncStorage.removeItem(key)
      : SecureStore.deleteItemAsync(key);
  },
};
