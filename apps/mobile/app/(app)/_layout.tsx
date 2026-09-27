import { Redirect, Stack } from "expo-router";
import { useSession } from "../../src/lib/session";
import { font, useTheme } from "../../src/lib/theme";

export default function AppLayout() {
  const { ready, user } = useSession();
  const t = useTheme();
  if (ready && !user) return <Redirect href="/(auth)/login" />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.canvas },
        headerTintColor: t.ink,
        headerTitleStyle: { fontFamily: font.displaySemi, fontSize: 18 },
        headerTitleAlign: "center",
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.canvas },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="claims/new" options={{ title: "New check" }} />
      <Stack.Screen name="claims/[id]" options={{ title: "Evidence" }} />
      <Stack.Screen name="documents/[id]" options={{ title: "Source" }} />
      <Stack.Screen name="verifications/[id]" options={{ title: "Verdict" }} />
      <Stack.Screen name="guide" options={{ title: "Guide" }} />
    </Stack>
  );
}
