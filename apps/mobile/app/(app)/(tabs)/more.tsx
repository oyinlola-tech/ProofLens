import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { Card, Eyebrow, Mono, Muted, PageHeader, Screen, Segmented, tap, type IconName } from "../../../src/components/ui";
import { useSession } from "../../../src/lib/session";
import { font, useTheme, useThemeState, type ThemePreference } from "../../../src/lib/theme";

function ActionRow({ icon, title, body, onPress, busy, danger, last }: { icon: IconName; title: string; body: string; onPress: () => void; busy?: boolean; danger?: boolean; last?: boolean }) {
  const t = useTheme();
  const fg = danger ? t.contradicted : t.ink;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line, backgroundColor: pressed ? t.surfaceMuted : "transparent" })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: danger ? t.contradictedSoft : t.surfaceMuted, alignItems: "center", justifyContent: "center" }}>
        {busy ? <ActivityIndicator size="small" color={fg} /> : <Ionicons name={icon} size={19} color={fg} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: font.semi, fontSize: 15.5, color: fg }}>{title}</Text>
        <Muted style={{ fontSize: 13, lineHeight: 18 }}>{body}</Muted>
      </View>
      <Ionicons name="chevron-forward" size={16} color={t.inkTertiary} />
    </Pressable>
  );
}

export default function More() {
  const { user, signOut, signOutEverywhere } = useSession();
  const router = useRouter();
  const t = useTheme();
  const { preference, setPreference } = useThemeState();
  const [busy, setBusy] = useState<"logout" | "revoke" | null>(null);
  const email = user?.email ?? "";

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
    <Screen top insideTabs>
      <PageHeader title="More" subtitle="Your account, appearance and help." />
      <View style={{ gap: 26 }}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: font.display, fontSize: 26, color: t.onAccent }}>{email.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text numberOfLines={1} style={{ fontFamily: font.displaySemi, fontSize: 18, color: t.ink }}>{email}</Text>
            <Mono numberOfLines={1}>ID {user?.user_id}</Mono>
          </View>
        </Card>

        <View style={{ gap: 10 }}>
          <Eyebrow>Appearance</Eyebrow>
          <Segmented<ThemePreference>
            stretch
            value={preference}
            onChange={setPreference}
            options={[
              { value: "system", label: "System", icon: "phone-portrait-outline" },
              { value: "light", label: "Light", icon: "sunny-outline" },
              { value: "dark", label: "Dark", icon: "moon-outline" },
            ]}
          />
        </View>

        <View style={{ gap: 10 }}>
          <Eyebrow>Learn</Eyebrow>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <ActionRow icon="compass-outline" title="How ProofLens works" body="The five steps behind every verdict." onPress={() => router.push("/(app)/guide")} />
            <ActionRow icon="ribbon-outline" title="What the verdicts mean" body="Supported, partial, contradicted, insufficient." last onPress={() => router.push("/(app)/guide")} />
          </Card>
        </View>

        <View style={{ gap: 10 }}>
          <Eyebrow>Sessions</Eyebrow>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <ActionRow icon="log-out-outline" title={busy === "logout" ? "Logging out…" : "Log out"} body="Sign out on this device only." busy={busy === "logout"} onPress={logout} />
            <ActionRow icon="shield-outline" title={busy === "revoke" ? "Signing out everywhere…" : "Sign out everywhere"} body="Use this if a session was left open somewhere else." busy={busy === "revoke"} danger last onPress={revoke} />
          </Card>
          <Muted style={{ fontSize: 12.5, lineHeight: 18 }}>Sessions expire after 24 hours. Up to 5 can be active at once. Password changes and a per-device session list are not available yet.</Muted>
        </View>

        <Mono style={{ textAlign: "center" }}>ProofLens {Constants.expoConfig?.version ?? ""}</Mono>
      </View>
    </Screen>
  );
}
