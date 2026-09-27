import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { Button, Card, IconTile, Muted, Screen, SectionHeader, Title, verdictIcon, type IconName } from "../../src/components/ui";
import { VERDICT_DESCRIPTION, VERDICT_LABEL, verdictColors } from "../../src/lib/format";
import { font, radius, useTheme } from "../../src/lib/theme";
import type { Verdict } from "../../src/lib/types";

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: "create-outline", title: "Write the claim", body: "One plain statement, up to 10,000 characters. ProofLens notes how strongly it is worded, whether it asserts causation, and the numbers, dates and names in it." },
  { icon: "document-attach-outline", title: "Attach the evidence", body: "Upload a PDF, TXT, MD or CSV file, paste a passage, or reuse a document from your library. You choose the page and trim the text to what matters." },
  { icon: "git-compare-outline", title: "Rule checks run first", body: "Numbers, dates, names, negation, causation versus association and hedged language are compared directly, with no model involved." },
  { icon: "sparkles-outline", title: "Reasoning over your passages only", body: "The model sees the claim, the rule findings and your passages. It cannot bring in outside sources." },
  { icon: "shield-checkmark-outline", title: "The result is validated", body: "A quote must appear word for word in the stored passage or it is cleared. Document and page always come from your library, never from the model." },
];

const NOT: string[] = ["A chatbot", "A web search", "A universal truth detector"];
const VERDICTS: Verdict[] = ["supported", "partially_supported", "contradicted", "insufficient_evidence"];

export default function Guide() {
  const t = useTheme();
  const router = useRouter();
  return (
    <Screen footer={<Button title="Start a check" size="lg" icon="add" onPress={() => router.push("/(app)/claims/new")} />}>
      <View style={{ gap: 28 }}>
        <View style={{ gap: 8 }}>
          <Title>How ProofLens works</Title>
          <Muted style={{ fontSize: 15.5, lineHeight: 22 }}>It answers one question: does the evidence you supplied support the claim you are making?</Muted>
        </View>

        <Card style={{ gap: 20 }}>
          {STEPS.map((s, i) => (
            <View key={s.title} style={{ flexDirection: "row", gap: 14 }}>
              <IconTile icon={s.icon} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: font.semi, fontSize: 15.5, color: t.ink }}>
                  <Text style={{ fontFamily: font.monoMedium, color: t.accent }}>{i + 1}  </Text>
                  {s.title}
                </Text>
                <Muted>{s.body}</Muted>
              </View>
            </View>
          ))}
        </Card>

        <View>
          <SectionHeader title="What the verdicts mean" />
          <View style={{ gap: 10 }}>
            {VERDICTS.map((v) => {
              const c = verdictColors(t, v);
              return (
                <View key={v} style={{ backgroundColor: c.bg, borderRadius: radius.panel, padding: 16, gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name={verdictIcon(v)} size={20} color={c.fg} />
                    <Text style={{ fontFamily: font.displaySemi, fontSize: 16.5, color: c.fg }}>{VERDICT_LABEL[v]}</Text>
                  </View>
                  <Text style={{ fontFamily: font.body, fontSize: 14.5, lineHeight: 22, color: t.ink }}>{VERDICT_DESCRIPTION[v]}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View>
          <SectionHeader title="What it is not" />
          <Card style={{ gap: 12 }}>
            {NOT.map((n) => (
              <View key={n} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="close-circle-outline" size={19} color={t.inkTertiary} />
                <Text style={{ fontFamily: font.medium, fontSize: 15, color: t.ink }}>{n}</Text>
              </View>
            ))}
            <Muted>Every verdict is a statement about the evidence you attached, not about the world.</Muted>
          </Card>
        </View>
      </View>
    </Screen>
  );
}
