import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useSession } from "../../../src/lib/session";
import { Body, Button, Heading, Mono, Muted, Screen } from "../../../src/components/ui";
import { radius, useTheme, useThemeState, type ThemePreference } from "../../../src/lib/theme";

export default function Account() {
  const { user, signOut, signOutEverywhere } = useSession();
  const router = useRouter();
  const t = useTheme();
  const { preference, setPreference } = useThemeState();
  const options: { value: ThemePreference; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];
  const [busy, setBusy] = useState<"logout" | "revoke" | null>(null);

  const logout = async () => {
    setBusy("logout");
    await signOut();
    router.replace("/(auth)/login");
  };

  const revoke = () => {
    Alert.alert("Sign out everywhere?", "Every active session, including this one, will be signed out.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out everywhere",
        style: "destructive",
        onPress: async () => {
          setBusy("revoke");
          await signOutEverywhere();
          router.replace({ pathname: "/(auth)/login", params: { reason: "revoked" } });
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={{ gap: 24 }}>
        <View style={{ gap: 12, borderBottomWidth: 1, borderBottomColor: t.line, paddingBottom: 20 }}>
          <View>
            <Muted>Email</Muted>
            <Body>{user?.email}</Body>
          </View>
          <View>
            <Muted>Account ID</Muted>
            <Mono style={{ fontSize: 13 }}>{user?.user_id}</Mono>
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Heading>Appearance</Heading>
          <Muted>Follow the system setting, or pick light or dark.</Muted>
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", borderWidth: 1, borderColor: t.lineStrong, borderRadius: radius.pill, padding: 4, alignSelf: "flex-start" }}>
            {options.map((o) => {
              const on = preference === o.value;
              return (
                <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setPreference(o.value)} style={{ height: 36, paddingHorizontal: 16, borderRadius: radius.pill, justifyContent: "center", backgroundColor: on ? t.ink : "transparent" }}>
                  <Text style={{ color: on ? t.onInk : t.inkSecondary, fontSize: 14, fontWeight: "500" }}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Heading>This session</Heading>
          <Muted>Sign out on this device only.</Muted>
          <Button title={busy === "logout" ? "Logging out…" : "Log out"} variant="secondary" loading={busy === "logout"} onPress={logout} />
        </View>
        <View style={{ gap: 8 }}>
          <Heading>All sessions</Heading>
          <Muted>Sign out everywhere, including this device. Use this if a session was left open somewhere else.</Muted>
          <Button title={busy === "revoke" ? "Signing out everywhere…" : "Sign out everywhere"} variant="danger" loading={busy === "revoke"} onPress={revoke} />
        </View>
        <Muted style={{ fontSize: 12 }}>Sessions expire after 24 hours. Up to 5 can be active at once. Password changes and a per-device session list are not available yet.</Muted>
      </View>
    </Screen>
  );
}
