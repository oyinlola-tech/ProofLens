import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/** Small key-value preferences. SecureStore on devices, localStorage on Expo Web. Failures read as "not set". */
export async function getPref(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setPref(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    // The preference simply will not persist.
  }
}

export const ONBOARDED_KEY = "prooflens.onboarded";
