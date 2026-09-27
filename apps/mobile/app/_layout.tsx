import { BricolageGrotesque_600SemiBold } from "@expo-google-fonts/bricolage-grotesque/600SemiBold";
import { BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque/700Bold";
import { GeistMono_400Regular } from "@expo-google-fonts/geist-mono/400Regular";
import { GeistMono_500Medium } from "@expo-google-fonts/geist-mono/500Medium";
import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { useFonts } from "expo-font";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "../src/lib/session";
import { useTheme, useThemeState } from "../src/lib/theme";
import { ThemeProvider } from "../src/lib/ThemeProvider";

function Root() {
  const t = useTheme();
  const { scheme } = useThemeState();
  // A font that fails to load falls back to the system face; the app still opens.
  const [loaded, fontError] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });
  if (!loaded && !fontError) return <View style={{ flex: 1, backgroundColor: t.canvas }} />;
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.canvas } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="verify-email" />
      </Stack>
    </>
  );
}

/** Rendered by the router in place of the app when a screen throws while rendering. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.canvas, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}>
      <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "700", color: t.ink, textAlign: "center" }}>Something went wrong</Text>
      <Text style={{ fontSize: 15, lineHeight: 22, color: t.inkSecondary, textAlign: "center" }}>This screen could not be shown. Your claims and documents are safe on the server.</Text>
      {__DEV__ ? <Text selectable style={{ fontSize: 12, color: t.inkTertiary, textAlign: "center" }}>{error.message}</Text> : null}
      <Pressable accessibilityRole="button" onPress={retry} style={{ minHeight: 50, paddingHorizontal: 24, borderRadius: 14, backgroundColor: t.accent, alignItems: "center", justifyContent: "center", marginTop: 6 }}>
        <Text style={{ fontSize: 15.5, fontWeight: "600", color: t.onAccent }}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          <Root />
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
