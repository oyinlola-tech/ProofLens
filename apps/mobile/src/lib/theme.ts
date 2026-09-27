import { createContext, useContext } from "react";
import { useColorScheme } from "react-native";

const light = {
  canvas: "#F7F7F5",
  surface: "#FFFFFF",
  surfaceMuted: "#F1F1EE",
  ink: "#17171A",
  inkSecondary: "#5C5C66",
  inkTertiary: "#8A8A94",
  line: "rgba(23,23,26,0.10)",
  lineStrong: "rgba(23,23,26,0.22)",
  accent: "#E5502A",
  accentSoft: "rgba(229,80,42,0.12)",
  supported: "#1D7A4C",
  supportedSoft: "#E4F4EA",
  partial: "#9A6A06",
  partialSoft: "#FBF1D6",
  contradicted: "#B42B2B",
  contradictedSoft: "#FBE6E6",
  insufficient: "#5C5C66",
  insufficientSoft: "#ECECEA",
  onInk: "#F7F7F5",
  onAccent: "#FFFFFF",
};

const dark: typeof light = {
  canvas: "#0F0F11",
  surface: "#161619",
  surfaceMuted: "#1C1C20",
  ink: "#F2F2F0",
  inkSecondary: "#A9A9B2",
  inkTertiary: "#74747E",
  line: "rgba(242,242,240,0.10)",
  lineStrong: "rgba(242,242,240,0.22)",
  accent: "#FF6A3D",
  accentSoft: "rgba(255,106,61,0.16)",
  supported: "#5FD08F",
  supportedSoft: "rgba(95,208,143,0.16)",
  partial: "#E9B949",
  partialSoft: "rgba(233,185,73,0.16)",
  contradicted: "#F07171",
  contradictedSoft: "rgba(240,113,113,0.16)",
  insufficient: "#A9A9B2",
  insufficientSoft: "rgba(169,169,178,0.16)",
  onInk: "#0F0F11",
  onAccent: "#0F0F11",
};

export type Theme = typeof light;
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedScheme = "light" | "dark";

export interface ThemeState {
  preference: ThemePreference;
  scheme: ResolvedScheme;
  setPreference: (p: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeState | null>(null);
export const themes = { light, dark };

/** Resolved colour tokens for the active scheme. Falls back to the system scheme outside a provider. */
export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  const system = useColorScheme();
  const scheme = ctx?.scheme ?? (system === "dark" ? "dark" : "light");
  return themes[scheme];
}

export function useThemeState(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeState must be used inside ThemeProvider");
  return ctx;
}

export const radius = { control: 10, panel: 16, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
