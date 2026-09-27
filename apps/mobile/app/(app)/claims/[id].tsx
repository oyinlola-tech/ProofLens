import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { api, ApiError, messageOf } from "../../../src/lib/api";
import { formatDateTime, truncate } from "../../../src/lib/format";
import { useTheme } from "../../../src/lib/theme";
import type { Claim, Document, Evidence, Verification, VerificationSummary } from "../../../src/lib/types";
import { useAsync } from "../../../src/lib/useAsync";
import { EvidenceCapture } from "../../../src/components/EvidenceCapture";
import { Body, Button, ClaimStatusBadge, Heading, Loading, Mono, Muted, Notice, Panel, Screen, SectionHeader, VerdictBadge } from "../../../src/components/ui";

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
      router.push({ pathname: "/(app)/verifications/[id]", params: { id: v.id } });
      silentRefresh();
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setVerifying(false);
      if (e instanceof ApiError && e.status === 409) setVerifyError({ message: "A verification is already running for this claim. Pull to refresh in a moment.", retryable: false });
      else if (e instanceof ApiError && e.kind === "unavailable") setVerifyError({ message: "Verification unavailable. The reasoning service could not be reached, so no verdict was produced.", retryable: true });
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

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: "Claim" }} />
      {error ? <Notice action={<Button title="Try again" variant="secondary" onPress={reload} />}>{error}</Notice> : null}
      {loading && !data ? <Loading /> : null}
      {data ? (
        <View style={{ gap: 24 }}>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Muted>What I want to verify</Muted>
              <ClaimStatusBadge status={data.claim.status} />
            </View>
            <Text style={{ fontSize: 21, lineHeight: 29, fontWeight: "600", color: t.ink, letterSpacing: -0.3 }}>&ldquo;{data.claim.text}&rdquo;</Text>
            <Muted>{formatDateTime(data.claim.created_at)}. To change the claim, create a new one.</Muted>
          </View>

          <Panel style={{ gap: 10 }}>
            <Heading>Run verification</Heading>
            <Muted>{data.evidence.length} {data.evidence.length === 1 ? "piece" : "pieces"} of evidence attached.</Muted>
            {verifying || analyzingElsewhere ? (
              <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
                <Loading label="Verifying… reading the passages, running deterministic checks, and reasoning over the evidence." />
                {verifying ? <Mono style={{ textAlign: "center" }}>{elapsed}s elapsed</Mono> : <Muted style={{ textAlign: "center" }}>Started from another session. This screen updates when it finishes.</Muted>}
              </View>
            ) : null}
            {verifyError ? (
              <Notice action={verifyError.retryable ? <Button title="Retry" variant="secondary" onPress={verify} /> : <Button title="Refresh" variant="secondary" onPress={refresh} />}>{verifyError.message}</Notice>
            ) : null}
            {!verifying && !analyzingElsewhere ? (
              <Button title={data.verifications.length ? "Verify again" : "Verify this claim"} onPress={verify} disabled={data.evidence.length === 0} />
            ) : null}
            {data.evidence.length === 0 ? <Muted style={{ fontSize: 12 }}>Attach at least one piece of evidence first.</Muted> : null}
            {data.verifications.length > 0 ? (
              <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 10 }}>
                <Muted>Previous results</Muted>
                {data.verifications.slice(0, 5).map((v) => (
                  <Pressable key={v.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/(app)/verifications/[id]", params: { id: v.id } })} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 }}>
                    <VerdictBadge verdict={v.verdict} />
                    <Muted>{formatDateTime(v.completed_at ?? v.created_at)}</Muted>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Panel>

          <View style={{ gap: 10 }}>
            <SectionHeader title="Evidence I want ProofLens to examine" />
            {data.evidence.length === 0 ? <Muted>No evidence attached yet. Add a file, paste a passage, or pick from your documents below.</Muted> : null}
            {data.evidence.map((e, i) => {
              const name = e.source_document_id ? data.names[e.source_document_id] : undefined;
              return (
                <Panel key={e.id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <Mono>{String(i + 1).padStart(2, "0")}</Mono>
                    <Text style={{ color: t.ink, fontWeight: "500", flexShrink: 1 }} numberOfLines={1}>{name ?? "Document no longer available"}</Text>
                    {e.source_page ? <Mono>page {e.source_page}</Mono> : null}
                  </View>
                  <Body style={{ fontSize: 14, lineHeight: 21, color: t.inkSecondary }}>{truncate(e.content, 240)}</Body>
                  <View style={{ flexDirection: "row", gap: 16 }}>
                    {e.source_document_id && name ? (
                      <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/(app)/documents/[id]", params: { id: e.source_document_id!, page: e.source_page ? String(e.source_page) : "1", q: e.content.slice(0, 300) } })}>
                        <Text style={{ color: t.ink, textDecorationLine: "underline" }}>View in document</Text>
                      </Pressable>
                    ) : null}
                    {data.claim.status !== "analyzing" ? (
                      <Pressable accessibilityRole="button" onPress={() => remove(e)}>
                        <Text style={{ color: t.inkSecondary }}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Panel>
              );
            })}
          </View>

          <EvidenceCapture claimId={data.claim.id} initialDocumentId={initialDocumentId} onAttached={silentRefresh} />
        </View>
      ) : null}
    </Screen>
  );
}
