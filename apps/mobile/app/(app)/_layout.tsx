import { Redirect, Stack } from "expo-router";
import { useSession } from "../../src/lib/session";
import { useTheme } from "../../src/lib/theme";

export default function AppLayout() {
  const { ready, user } = useSession();
  const t = useTheme();
  if (ready && !user) return <Redirect href="/(auth)/login" />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.canvas },
        headerTintColor: t.ink,
        headerTitleStyle: { fontWeight: "600" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.canvas },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="claims/new" options={{ title: "New verification" }} />
      <Stack.Screen name="claims/[id]" options={{ title: "Claim" }} />
      <Stack.Screen name="documents/[id]" options={{ title: "Document" }} />
      <Stack.Screen name="verifications/[id]" options={{ title: "Result" }} />
    </Stack>
  );
}
