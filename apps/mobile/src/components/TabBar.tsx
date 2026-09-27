import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { font, useTheme } from "../lib/theme";
import { tap, type IconName } from "./ui";

const TABS: Record<string, { label: string; icon: IconName; iconOn: IconName }> = {
  index: { label: "Home", icon: "home-outline", iconOn: "home" },
  history: { label: "Activity", icon: "time-outline", iconOn: "time" },
  documents: { label: "Library", icon: "folder-open-outline", iconOn: "folder-open" },
  more: { label: "More", icon: "grid-outline", iconOn: "grid" },
};

interface Props {
  state: { index: number; routes: { key: string; name: string }[] };
  // The navigator's own object; only emit and navigate are used.
  navigation: { emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean }; navigate: (name: string) => void };
}

/** Four destinations. Everything else lives under More. */
export function TabBar({ state, navigation }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", alignItems: "center", backgroundColor: t.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.lineStrong, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10), paddingHorizontal: 8 }}>
      {state.routes
        .filter((r) => TABS[r.name])
        .map((route) => {
          const meta = TABS[route.name];
          const focused = state.routes[state.index]?.key === route.key;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  tap();
                  navigation.navigate(route.name);
                }
              }}
              style={({ pressed }) => ({ flex: 1, alignItems: "center", justifyContent: "center", gap: 4, minHeight: 54, opacity: pressed ? 0.6 : 1 })}
            >
              <View style={{ width: 58, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: focused ? t.accentSoft : "transparent" }}>
                <Ionicons name={focused ? meta.iconOn : meta.icon} size={21} color={focused ? t.accent : t.inkTertiary} />
              </View>
              <Text style={{ fontFamily: focused ? font.semi : font.medium, fontSize: 11.5, color: focused ? t.ink : t.inkTertiary }}>{meta.label}</Text>
            </Pressable>
          );
        })}
    </View>
  );
}
