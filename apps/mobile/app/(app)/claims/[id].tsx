import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Platform, Pressable, Text, View } from "react-native";
import { EvidenceCapture } from "../../../src/components/EvidenceCapture";
import { Button, Card, ClaimStatusBadge, Eyebrow, FadeIn, Heading, LogoMark, Mono, Muted, Notice, Screen, SectionHeader, SkeletonList, Stepper, TextLink, VerdictBadge, notify, type IconName } from "../../../src/components/ui";
import { api, ApiError, messageOf } from "../../../src/lib/api";
import { formatDateTime, timeAgo, truncate } from "../../../src/lib/format";
import { font, radius, useTheme } from "../../../src/lib/theme";
import type { Claim, Document, Evidence, Verification, VerificationSummary } from "../../../src/lib/types";
import { useAsync } from "../../../src/lib/useAsync";

const STAGES: { icon: IconName; text: string }[] = [
  { icon: "reader-outline", text: "Reading the passages you attached" },
  { icon: "git-compare-outline", text: "Comparing numbers, dates, names and wording" },
  { icon: "sparkles-outline", text: "Reasoning over your evidence only" },
];

/** Shown while a verification runs. The stages describe the pipeline; none is ticked off, because progress is not reported. */
function Verifying({ elapsed, elsewhere }: { elapsed: number; elsewhere: boolean }) {
  const t = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: Platform.OS !== "web" }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View accessibilityLiveRegion="polite" style={{ alignItems: "center", gap: 22, paddingVertical: 28 }}>
      <View style={{ width: 132, height: 132, alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={{ position: "absolute", width: 132, height: 132, borderRadius: 66, backgroundColor: t.accentSoft, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.2] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }] }} />
        <LogoMark size={72} />
      </View>
      <View style={{ gap: 6, alignItems: "center" }}>
        <Text accessibilityRole="header" style={{ fontFamily: font.display, fontSize: 25, letterSpacing: -0.5, color: t.ink }}>Checking your claim…</Text>
        {elsewhere ? <Muted style={{ textAlign: "center" }}>Started from another session. This screen updates when it finishes.</Muted> : <Mono style={{ fontSize: 13 }}>{elapsed}s elapsed</Mono>}
      </View>
      <Card flat style={{ alignSelf: "stretch", gap: 14 }}>
        {STAGES.map((s) => (
          <View key={s.text} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ionicons name={s.icon} size={19} color={t.accent} />
            <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 14.5, color: t.ink }}>{s.text}</Text>
          </View>
        ))}
      </Card>
      <Muted style={{ textAlign: "center", fontSize: 13 }}>If reasoning is unavailable you will be told. A verdict is never invented.</Muted>
    </View>
  );
}

export default function ClaimScreen() {
  const { id, document: initialDocumentId } = useLocalSearchParams<{ id: string; document?: string }>();
  const router = useRouter();
  const t = useTheme();
  const { data, error, loading, refreshing, refresh, reload, silentRefresh } = useAsync(async () => {
    const claim = await api<Claim>(`/claims/${id}`);
    const [evidence, verifications, documents] = await Promise.all([
      api<Evidence[]>(`/evidence/?claim_id=${id}`),
      api<VerificationSummary[]>(`/verification/?claim_id=${id}&limit=10`),
      api<Document[]>("/documents/?limit=100"),
    ]);
    const names: Record<string, string> = {};
    for (const d of documents) names[d.id] = d.filename;
    return { claim, evidence, verifications, names };
  }, [id]);

  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const analyzingElsewhere = data?.claim.status === "analyzing" && !verifying;

  useEffect(() => {
    if (!verifying) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [verifying]);

  // A verification started elsewhere: poll the real claim status, never mark it failed locally.
  useEffect(() => {
    if (!analyzingElsewhere) return;
    const timer = setInterval(silentRefresh, 3000);
    return () => clearInterval(timer);
  }, [analyzingElsewhere, silentRefresh]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const verify = async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setVerifying(true);
    setVerifyError(null);
    setElapsed(0);
    try {
      const v = await api<Verification>("/verification/", { method: "POST", body: { claim_id: id }, signal: ctrl.signal });
      setVerifying(false);
      notify("success");
      router.push({ pathname: "/(app)/verifications/[id]", params: { id: v.id } });
      silentRefresh();
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setVerifying(false);
      notify("error");
      if (e instanceof ApiError && e.status === 409) setVerifyError({ message: "A verification is already running for this claim. Pull to refresh in a moment.", retryable: false });
      else if (e instanceof ApiError && e.kind === "unavailable") setVerifyError({ message: "The reasoning service could not be reached, so no verdict was produced.", retryable: true });
      else if (e instanceof ApiError && e.kind === "network") setVerifyError({ message: "The connection dropped while waiting. ProofLens may still be processing this claim. Pull to refresh before running it again.", retryable: true });
      else setVerifyError({ message: messageOf(e), retryable: true });
    }
  };

  const remove = (ev: Evidence) => {
    Alert.alert("Remove this evidence?", "It will no longer be considered in new verifications.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/evidence/${ev.id}`, { method: "DELETE" });
            silentRefresh();
          } catch (e) {
            Alert.alert("Could not remove", messageOf(e));
          }
        },
      },
    ]);
  };

  const running = verifying || analyzingElsewhere;
  const count = data?.evidence.length ?? 0;

  const footer =
    data && !running ? (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name={count > 0 ? "checkmark-circle" : "information-circle-outline"} size={17} color={count > 0 ? t.supported : t.inkTertiary} />
          <Muted style={{ fontSize: 13.5 }}>{count > 0 ? `${count} ${count === 1 ? "piece" : "pieces"} of evidence attached` : "Attach at least one piece of evidence to continue"}</Muted>
        </View>
        <Button title={data.verifications.length ? "Check again" : "Check this claim"} size="lg" icon="search" disabled={count === 0} onPress={verify} />
      </View>
    ) : undefined;

  return (
    <Screen refreshing={refreshing} onRefresh={running ? undefined : refresh} footer={footer}>
      {error ? <Notice title="Could not open this claim" action={<Button title="Try again" icon="refresh" variant="secondary" onPress={reload} />}>{error}</Notice> : null}
      {loading && !data ? <SkeletonList count={3} /> : null}
      {data && running ? <Verifying elapsed={elapsed} elsewhere={Boolean(analyzingElsewhere)} /> : null}
      {data && !running ? (
        <View style={{ gap: 26 }}>
          <Stepper current={1} />

          <FadeIn>
            <View style={{ backgroundColor: t.paper, borderRadius: radius.panel, padding: 20, gap: 12, borderWidth: 1, borderColor: t.line }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Eyebrow>Your claim</Eyebrow>
                {data.verifications[0]?.verdict ? <VerdictBadge verdict={data.verifications[0].verdict} /> : <ClaimStatusBadge status={data.claim.status} />}
              </View>
              <Text selectable style={{ fontFamily: font.displaySemi, fontSize: 22, lineHeight: 29, letterSpacing: -0.4, color: t.ink }}>“{data.claim.text}”</Text>
              <Muted style={{ fontSize: 13 }}>Written {formatDateTime(data.claim.created_at)}. To change the wording, start a new check.</Muted>
            </View>
          </FadeIn>

          {verifyError ? (
            <Notice title="No verdict was produced" action={verifyError.retryable ? <Button title="Try again" icon="refresh" variant="secondary" onPress={verify} /> : <Button title="Refresh" icon="refresh" variant="secondary" onPress={refresh} />}>
              {verifyError.message}
            </Notice>
          ) : null}

          <View>
            <SectionHeader title="Evidence" count={count} />
            {count === 0 ? (
              <Muted style={{ marginBottom: 14 }}>Nothing attached yet. Add the passage or document this claim is supposed to rest on.</Muted>
            ) : (
              <View style={{ gap: 12, marginBottom: 18 }}>
                {data.evidence.map((e, i) => {
                  const name = e.source_document_id ? data.names[e.source_document_id] : undefined;
                  return (
                    <Card key={e.id} style={{ gap: 10 }}>
                      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontFamily: font.monoMedium, fontSize: 12, color: t.accent }}>{i + 1}</Text>
                        </View>
                        <Text style={{ flex: 1, fontFamily: font.semi, fontSize: 14.5, color: t.ink }} numberOfLines={1}>{name ?? "Document no longer available"}</Text>
                        {e.source_page ? <Mono>p. {e.source_page}</Mono> : null}
                      </View>
                      <View style={{ borderLeftWidth: 3, borderLeftColor: t.accent, paddingLeft: 12 }}>
                        <Text style={{ fontFamily: font.body, fontSize: 14.5, lineHeight: 22, color: t.inkSecondary }}>{truncate(e.content, 240)}</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        {e.source_document_id && name ? (
                          <TextLink title="View in document" icon="open-outline" onPress={() => router.push({ pathname: "/(app)/documents/[id]", params: { id: e.source_document_id!, page: e.source_page ? String(e.source_page) : "1", q: e.content.slice(0, 300) } })} />
                        ) : (
                          <View />
                        )}
                        <TextLink title="Remove" icon="trash-outline" color={t.inkSecondary} onPress={() => remove(e)} />
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
            <Heading style={{ fontSize: 16, marginBottom: 10 }}>{count === 0 ? "Add evidence" : "Add more evidence"}</Heading>
            <EvidenceCapture claimId={data.claim.id} initialDocumentId={initialDocumentId} onAttached={silentRefresh} />
          </View>

          {data.verifications.length > 0 ? (
            <View>
              <SectionHeader title="Earlier verdicts" count={data.verifications.length} />
              <Card style={{ padding: 0, overflow: "hidden" }}>
                {data.verifications.slice(0, 5).map((v, i, all) => (
                  <Pressable
                    key={v.id}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: "/(app)/verifications/[id]", params: { id: v.id } })}
                    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: i === all.length - 1 ? 0 : 1, borderBottomColor: t.line, backgroundColor: pressed ? t.surfaceMuted : "transparent" })}
                  >
                    <VerdictBadge verdict={v.verdict} />
                    <Muted style={{ flex: 1, fontSize: 13, textAlign: "right" }} numberOfLines={1}>{timeAgo(v.completed_at ?? v.created_at)}</Muted>
                    <Ionicons name="chevron-forward" size={16} color={t.inkTertiary} />
                  </Pressable>
                ))}
              </Card>
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
