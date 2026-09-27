import { useRouter } from "expo-router";
import { type ReactNode } from "react";
import { View } from "react-native";
import { FadeIn, IconButton, Muted, Screen, Title, Wordmark } from "./ui";

/** Shared frame for the sign-in screens: brand on the left, then the title and the form. */
export function AuthShell({ title, subtitle, children, fallback = "/(auth)/welcome" }: { title: string; subtitle?: ReactNode; children: ReactNode; fallback?: "/(auth)/welcome" | "/(auth)/login" }) {
  const router = useRouter();
  return (
    <Screen top>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 36 }}>
        <IconButton icon="chevron-back" label="Go back" onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))} />
        <Wordmark size={30} />
      </View>
      <FadeIn style={{ gap: 22 }}>
        <View style={{ gap: 8 }}>
          <Title style={{ fontSize: 32, lineHeight: 36 }}>{title}</Title>
          {typeof subtitle === "string" ? <Muted style={{ fontSize: 15.5, lineHeight: 22 }}>{subtitle}</Muted> : subtitle}
        </View>
        {children}
      </FadeIn>
    </Screen>
  );
}
