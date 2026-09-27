import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform, useColorScheme } from "react-native";
import { ThemeContext, type ThemePreference } from "./theme";

const KEY = "prooflens.theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>("system");

  useEffect(() => {
    if (Platform.OS === "web") {
      try {
        const v = localStorage.getItem(KEY);
        if (v === "light" || v === "dark" || v === "system") setPref(v);
      } catch {
        // Follow the system.
      }
      return;
    }
    SecureStore.getItemAsync(KEY)
      .then((v) => {
        if (v === "light" || v === "dark" || v === "system") setPref(v);
      })
      .catch(() => {
        // No stored preference; follow the system.
      });
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    if (Platform.OS === "web") {
      try {
        localStorage.setItem(KEY, p);
      } catch {
        // Preference simply will not persist.
      }
      return;
    }
    SecureStore.setItemAsync(KEY, p).catch(() => {
      // Preference simply will not persist.
    });
  }, []);

  const scheme = preference === "system" ? (system === "dark" ? "dark" : "light") : preference;
  const value = useMemo(() => ({ preference, scheme, setPreference }), [preference, scheme, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
