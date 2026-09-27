import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { ClaimComposer } from "../../../src/components/ClaimComposer";
import { Muted, Screen } from "../../../src/components/ui";

export default function NewClaim() {
  const { document } = useLocalSearchParams<{ document?: string }>();
  return (
    <Screen>
      <View style={{ gap: 20 }}>
        <ClaimComposer documentId={document} />
        <View style={{ gap: 4 }}>
          <Muted>1. Claim. The statement under test.</Muted>
          <Muted>2. Evidence. PDFs, files, or pasted passages.</Muted>
          <Muted>3. Verdict. With the source page one tap away.</Muted>
        </View>
      </View>
    </Screen>
  );
}
