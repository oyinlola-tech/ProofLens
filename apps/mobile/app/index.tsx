import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Loading, LogoMark, Screen } from "../src/components/ui";
import { useSession } from "../src/lib/session";
import { getPref, ONBOARDED_KEY } from "../src/lib/storage";

export default function Index() {
  const { ready, user } = useSession();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPref(ONBOARDED_KEY).then((v) => !cancelled && setOnboarded(v === "1"));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || onboarded === null) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
          <LogoMark size={56} />
          <Loading label="Opening ProofLens…" />
        </View>
      </Screen>
    );
  }
  if (user) return <Redirect href="/(app)/(tabs)" />;
  // The introduction is shown once; after that a signed-out person lands on log in.
  return <Redirect href={onboarded ? "/(auth)/login" : "/(auth)/welcome"} />;
}
