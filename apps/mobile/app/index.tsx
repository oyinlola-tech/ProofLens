import { Redirect } from "expo-router";
import { useSession } from "../src/lib/session";
import { Loading, Screen } from "../src/components/ui";

export default function Index() {
  const { ready, user } = useSession();
  if (!ready) {
    return (
      <Screen scroll={false}>
        <Loading label="Opening ProofLens…" />
      </Screen>
    );
  }
  return <Redirect href={user ? "/(app)/(tabs)" : "/(auth)/login"} />;
}
