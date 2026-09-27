import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { DocumentCard, ResultCard } from "../../../src/components/cards";
import { Button, Card, ClaimStatusBadge, Eyebrow, FadeIn, Heading, IconTile, Muted, Notice, ProcessingBadge, Screen, SectionHeader, SkeletonList, Wordmark, tap, verdictIcon, type IconName } from "../../../src/components/ui";
import { api } from "../../../src/lib/api";
import { greeting, VERDICT_LABEL, verdictColors } from "../../../src/lib/format";
import { useSession } from "../../../src/lib/session";
import { font, radius, useTheme } from "../../../src/lib/theme";
import type { Claim, Document, Verdict, VerificationSummary } from "../../../src/lib/types";
import { useAsync, useRefreshOnFocus } from "../../../src/lib/useAsync";

const TALLY_LIMIT = 100;
const VERDICTS: Verdict[] = ["supported", "partially_supported", "contradicted", "insufficient_evidence"];
const SHORT_LABEL: Record<Verdict, string> = { supported: "Supported", partially_supported: "Partial", contradicted: "Contradicted", insufficient_evidence: "Unclear" };

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: "create-outline", title: "Write the claim", body: "One plain statement you want tested." },
  { icon: "document-attach-outline", title: "Attach the evidence", body: "A PDF, a text file, or a pasted passage." },
  { icon: "search-outline", title: "Read the verdict", body: "With the page and sentence it rests on." },
];

export default function Home() {
  const router = useRouter();
  const t = useTheme();
  const { user } = useSession();
  const { data, error, loading, refreshing, refresh, reload, silentRefresh } = useAsync(async () => {
    const [claims, verifications, documents] = await Promise.all([
      api<Claim[]>("/claims/?limit=20"),
      api<VerificationSummary[]>(`/verification/?limit=${TALLY_LIMIT}`),
      api<Document[]>("/documents/?limit=8"),
    ]);
    return { claims, verifications, documents };
  });
  useRefreshOnFocus(silentRefresh);

  const analyzing = data?.claims.filter((c) => c.status === "analyzing") ?? [];
  const pendingDocs = data?.documents.filter((d) => d.processing_status === "processing" || d.processing_status === "uploaded") ?? [];
  const drafts = data?.claims.filter((c) => c.status === "pending").slice(0, 2) ?? [];
  const tally = VERDICTS.map((v) => ({ verdict: v, count: data?.verifications.filter((x) => x.verdict === v).length ?? 0 }));
  const firstRun = Boolean(data) && data!.verifications.length === 0 && data!.claims.length === 0;
  const initial = (user?.email ?? "?").slice(0, 1).toUpperCase();

  const openClaim = (id: string) => router.push({ pathname: "/(app)/claims/[id]", params: { id } });

  return (
    <Screen top insideTabs refreshing={refreshing} onRefresh={refresh}>
      <View style={{ gap: 26 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Wordmark size={28} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open account and settings"
            hitSlop={6}
            onPress={() => {
              tap();
              router.push("/(app)/(tabs)/more");
            }}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.ink, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontFamily: font.displaySemi, fontSize: 17, color: t.onInk }}>{initial}</Text>
          </Pressable>
        </View>

        <FadeIn>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start a new check"
            onPress={() => {
              tap();
              router.push("/(app)/claims/new");
            }}
            style={({ pressed }) => ({ borderRadius: radius.hero, overflow: "hidden", minHeight: 250, justifyContent: "flex-end", boxShadow: t.shadowLift, transform: [{ scale: pressed ? 0.99 : 1 }] })}
          >
            <Image source={require("../../../assets/images/lens.jpg")} contentFit="cover" transition={250} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <LinearGradient colors={["rgba(15,15,17,0.30)", "rgba(15,15,17,0.72)", "rgba(15,15,17,0.96)"]} locations={[0, 0.5, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ padding: 22, gap: 10 }}>
              <Eyebrow style={{ color: "rgba(255,255,255,0.7)" }}>{greeting()}</Eyebrow>
              <Text accessibilityRole="header" style={{ fontFamily: font.display, fontSize: 30, lineHeight: 33, letterSpacing: -0.9, color: "#FFFFFF" }}>
                Does the source really say that?
              </Text>
              <Text style={{ fontFamily: font.body, fontSize: 15, lineHeight: 22, color: "rgba(255,255,255,0.78)" }}>Test a claim against the evidence behind it.</Text>
              <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 8, backgroundColor: "#FF6A3D", borderRadius: radius.pill, paddingHorizontal: 18, height: 46, marginTop: 6 }}>
                <Text style={{ fontFamily: font.semi, fontSize: 15.5, color: "#0F0F11" }}>Start a check</Text>
                <Ionicons name="arrow-forward" size={18} color="#0F0F11" />
              </View>
            </View>
          </Pressable>
        </FadeIn>

        {error ? <Notice title="Could not load your workspace" action={<Button title="Try again" icon="refresh" variant="secondary" onPress={reload} />}>{error}</Notice> : null}
        {loading && !data ? <SkeletonList count={3} /> : null}

        {firstRun ? (
          <FadeIn delay={80}>
            <SectionHeader title="How a check works" />
            <Card style={{ gap: 18 }}>
              {STEPS.map((s, i) => (
                <View key={s.title} style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
                  <IconTile icon={s.icon} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: font.semi, fontSize: 15.5, color: t.ink }}>
                      <Text style={{ fontFamily: font.monoMedium, color: t.accent }}>{i + 1}  </Text>
                      {s.title}
                    </Text>
                    <Muted>{s.body}</Muted>
                  </View>
                </View>
              ))}
            </Card>
          </FadeIn>
        ) : null}

        {data && data.verifications.length > 0 ? (
          <FadeIn delay={60}>
            <SectionHeader title="Your verdicts" count={data.verifications.length} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              {tally.map(({ verdict, count }) => {
                const c = verdictColors(t, verdict);
                return (
                  <View key={verdict} accessible accessibilityLabel={`${count} ${VERDICT_LABEL[verdict]}`} style={{ flex: 1, backgroundColor: c.bg, borderRadius: radius.control + 4, paddingVertical: 14, paddingHorizontal: 6, alignItems: "center", gap: 4 }}>
                    <Ionicons name={verdictIcon(verdict)} size={20} color={c.fg} />
                    <Text style={{ fontFamily: font.display, fontSize: 24, lineHeight: 28, color: c.fg, fontVariant: ["tabular-nums"] }}>{count}</Text>
                    <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 11, color: c.fg }}>{SHORT_LABEL[verdict]}</Text>
                  </View>
                );
              })}
            </View>
            {data.verifications.length === TALLY_LIMIT ? <Muted style={{ fontSize: 12.5, marginTop: 8 }}>Counted from your {TALLY_LIMIT} most recent checks.</Muted> : null}
          </FadeIn>
        ) : null}

        {analyzing.length > 0 || pendingDocs.length > 0 ? (
          <View>
            <SectionHeader title="In progress" count={analyzing.length + pendingDocs.length} />
            <View style={{ gap: 10 }}>
              {analyzing.map((c) => (
                <Card key={c.id} onPress={() => openClaim(c.id)} style={{ gap: 10 }}>
                  <Text numberOfLines={2} style={{ fontFamily: font.medium, fontSize: 15.5, lineHeight: 22, color: t.ink }}>{c.text}</Text>
                  <ClaimStatusBadge status={c.status} />
                </Card>
              ))}
              {pendingDocs.map((d) => (
                <Card key={d.id} onPress={() => router.push({ pathname: "/(app)/documents/[id]", params: { id: d.id } })} style={{ gap: 10 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 15.5, color: t.ink }}>{d.filename}</Text>
                  <ProcessingBadge status={d.processing_status} />
                </Card>
              ))}
            </View>
          </View>
        ) : null}

        {drafts.length > 0 ? (
          <View>
            <SectionHeader title="Pick up where you left off" />
            <View style={{ gap: 10 }}>
              {drafts.map((c) => (
                <Card key={c.id} onPress={() => openClaim(c.id)} style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
                  <IconTile icon="hourglass-outline" fg={t.inkSecondary} bg={t.surfaceMuted} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text numberOfLines={2} style={{ fontFamily: font.medium, fontSize: 15, lineHeight: 21, color: t.ink }}>{c.text}</Text>
                    <Muted style={{ fontSize: 13 }}>Waiting for evidence or a verdict</Muted>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={t.inkTertiary} />
                </Card>
              ))}
            </View>
          </View>
        ) : null}

        {data && data.verifications.length > 0 ? (
          <View>
            <SectionHeader title="Recent results" action="See all" onAction={() => router.push("/(app)/(tabs)/history")} />
            <View style={{ gap: 12 }}>
              {data.verifications.slice(0, 3).map((v) => (
                <ResultCard key={v.id} v={v} onPress={() => router.push({ pathname: "/(app)/verifications/[id]", params: { id: v.id } })} />
              ))}
            </View>
          </View>
        ) : null}

        {data && data.documents.length > 0 ? (
          <View>
            <SectionHeader title="Your library" action="See all" onAction={() => router.push("/(app)/(tabs)/documents")} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 14 }}>
              {data.documents.map((d) => (
                <DocumentCard key={d.id} d={d} compact onPress={() => router.push({ pathname: "/(app)/documents/[id]", params: { id: d.id } })} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {data && !firstRun && data.verifications.length === 0 ? (
          <Card style={{ gap: 6 }}>
            <Heading>No verdicts yet</Heading>
            <Muted>Open a claim above, attach its evidence, and run the check. The result will appear here.</Muted>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
