import { Redirect, Stack } from "expo-router";
import { useSession } from "../../src/lib/session";
import { useTheme } from "../../src/lib/theme";

export default function AuthLayout() {
  const { ready, user } = useSession();
  const t = useTheme();
  if (ready && user) return <Redirect href="/(app)/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.canvas } }} />;
}
