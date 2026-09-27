import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useTheme } from "../../../src/lib/theme";

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.canvas },
        headerTintColor: t.ink,
        headerTitleStyle: { fontWeight: "600" },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.line },
        tabBarActiveTintColor: t.ink,
        tabBarInactiveTintColor: t.inkTertiary,
        sceneStyle: { backgroundColor: t.canvas },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color ?? undefined} size={size} /> }} />
      <Tabs.Screen name="claims" options={{ title: "Claims", tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done-outline" color={color ?? undefined} size={size} /> }} />
      <Tabs.Screen name="documents" options={{ title: "Documents", tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" color={color ?? undefined} size={size} /> }} />
      <Tabs.Screen name="history" options={{ title: "History", tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" color={color ?? undefined} size={size} /> }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color ?? undefined} size={size} /> }} />
    </Tabs>
  );
}
