import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, Card, Chip, ConfidenceRing, Eyebrow, FadeIn, Heading, Mono, Muted, Notice, Screen, SectionHeader, SkeletonList, TextLink, tap, verdictIcon, type IconName } from "../../../src/components/ui";
import { api, ApiError } from "../../../src/lib/api";
import { formatDateTime, plain, truncate, VERDICT_DESCRIPTION, VERDICT_LABEL, verdictColors } from "../../../src/lib/format";
import { font, radius, useTheme } from "../../../src/lib/theme";
import type { Document, EvidenceDetail, EvidenceReference, Finding, Verification } from "../../../src/lib/types";
import { useAsync } from "../../../src/lib/useAsync";

const FINDING_LABEL: Record<Finding["kind"], string> = {
  number_match: "Figure matches",
  number_mismatch: "Figure differs",
  date_match: "Date matches",
  date_mismatch: "Date differs",
  entity_mismatch: "Different entity",
  negation_conflict: "Negation conflict",
  qualifier_gap: "Stronger language than the source",
  exact_match: "Stated verbatim",
  low_relevance: "Evidence does not address the claim",
};

const ROLE_LABEL: Record<EvidenceReference["role"], string> = { supports: "Supports", contradicts: "Conflicts", context: "Context" };

/** A titled block of explanation with a leading icon. */
function Section({ icon, title, children, tone }: { icon: IconName; title: string; children: ReactNode; tone?: { fg: string; bg: string } }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: tone?.bg ?? t.surface, borderRadius: radius.panel, borderWidth: tone ? 0 : 1, borderColor: t.line, padding: 18, gap: 10, boxShadow: tone ? undefined : t.shadow }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Ionicons name={icon} size={19} color={tone?.fg ?? t.accent} />
        <Text accessibilityRole="header" style={{ flex: 1, fontFamily: font.displaySemi, fontSize: 16.5, lineHeight: 22, color: tone?.fg ?? t.ink }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Prose({ children }: { children: string }) {
  const t = useTheme();
  return <Text selectable style={{ fontFamily: font.body, fontSize: 15.5, lineHeight: 24, color: t.ink }}>{plain(children)}</Text>;
}

export default function VerificationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const [showChecks, setShowChecks] = useState(false);
  const { data, error, loading, refreshing, refresh, reload } = useAsync(async () => {
    const v = await api<Verification>(`/verification/${id}`);
    const ids = Array.from(new Set(v.evidence_used.map((e) => e.source_document_id).filter((x): x is string => Boolean(x))));
    const docs = await Promise.all(
      ids.map((d) => api<Document>(`/documents/${d}`).catch((e) => (e instanceof ApiError && e.kind === "not_found" ? null : Promise.reject(e)))),
    );
    const names: Record<string, string> = {};
    ids.forEach((d, i) => { if (docs[i]) names[d] = docs[i]!.filename; });
    return { v, names };
  }, [id]);

  const v = data?.v;
  const c = verdictColors(t, v?.verdict ?? null);
  const supported = v?.verdict === "supported";
  const evidenceById = new Map<string, EvidenceDetail>((v?.evidence_used ?? []).map((e) => [e.id, e]));
  const referenced = new Set((v?.evidence_references ?? []).map((r) => r.evidence_id));
  const unreferenced = (v?.evidence_used ?? []).filter((e) => !referenced.has(e.id));
  const findings = v ? [...v.findings.filter((f) => f.conflict), ...v.findings.filter((f) => !f.conflict)] : [];
  const conflicts = findings.filter((f) => f.conflict).length;

  const openSource = (documentId: string, page: number | null, highlight: string) =>
    router.push({ pathname: "/(app)/documents/[id]", params: { id: documentId, page: page ? String(page) : "1", q: highlight.slice(0, 300) } });

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={refresh}
      footer={v ? <Button title="Check another claim" size="lg" icon="add" onPress={() => router.push("/(app)/claims/new")} /> : undefined}
    >
      {error ? <Notice title="Could not open this result" action={<Button title="Try again" icon="refresh" variant="secondary" onPress={reload} />}>{error}</Notice> : null}
      {loading && !data ? <SkeletonList count={4} /> : null}
      {v && data ? (
        <View style={{ gap: 18 }}>
          {v.verdict === null ? (
            <Notice tone="info" title="No verdict was produced" action={<Button title="Open the claim" variant="secondary" onPress={() => router.push({ pathname: "/(app)/claims/[id]", params: { id: v.claim_id } })} />}>
              Nothing was invented in its place. Return to the claim and run the check again.
            </Notice>
          ) : (
            <FadeIn>
              <View style={{ backgroundColor: c.bg, borderRadius: radius.hero, padding: 22, gap: 16, borderWidth: 1, borderColor: c.fg }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <View style={{ flex: 1, gap: 8 }}>
                    <Eyebrow style={{ color: c.fg }}>Verdict</Eyebrow>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name={verdictIcon(v.verdict)} size={28} color={c.fg} />
                      <Text accessibilityRole="header" style={{ flex: 1, fontFamily: font.display, fontSize: 27, lineHeight: 30, letterSpacing: -0.7, color: c.fg }}>{VERDICT_LABEL[v.verdict]}</Text>
                    </View>
                  </View>
                  {v.confidence !== null ? <ConfidenceRing value={v.confidence} color={c.fg} track={t.line} /> : null}
                </View>
                <Text selectable style={{ fontFamily: font.body, fontSize: 16, lineHeight: 24, color: t.ink }}>{plain(v.reasoning || VERDICT_DESCRIPTION[v.verdict])}</Text>
                <Muted style={{ fontSize: 12.5, lineHeight: 18 }}>
                  {v.confidence !== null ? "Confidence is how strongly the supplied evidence settles this claim, not the probability that the claim is true." : "Confidence is unavailable for this result."}
                </Muted>
              </View>
            </FadeIn>
          )}

          <View style={{ backgroundColor: t.paper, borderRadius: radius.panel, padding: 18, gap: 12, borderWidth: 1, borderColor: t.line }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Eyebrow>Your claim</Eyebrow>
              <TextLink title="Open the claim" icon="chevron-forward" onPress={() => router.push({ pathname: "/(app)/claims/[id]", params: { id: v.claim_id } })} />
            </View>
            <Text selectable style={{ fontFamily: font.displaySemi, fontSize: 19, lineHeight: 26, letterSpacing: -0.3, color: t.ink }}>“{v.claim_text}”</Text>
            {v.claim_analysis ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <Chip icon="megaphone-outline" label={v.claim_analysis.assertion_strength === "absolute" ? "Absolute language" : v.claim_analysis.assertion_strength === "hedged" ? "Hedged language" : "Direct statement"} />
                {v.claim_analysis.causal ? <Chip icon="git-branch-outline" label="Asserts causation" /> : null}
                {v.claim_analysis.negated ? <Chip icon="remove-circle-outline" label="Negated" /> : null}
                {v.claim_analysis.numbers.map((n) => <Chip key={`n-${n}`} icon="calculator-outline" label={n} />)}
                {v.claim_analysis.dates.map((d) => <Chip key={`d-${d}`} icon="calendar-outline" label={d} />)}
                {v.claim_analysis.entities.slice(0, 4).map((e) => <Chip key={`e-${e}`} label={e} />)}
              </View>
            ) : null}
          </View>

          <Section icon="reader-outline" title="What the evidence says">
            {v.source_grounded_statement ? (
              <View style={{ borderLeftWidth: 3, borderLeftColor: t.accent, paddingLeft: 12 }}>
                <Prose>{v.source_grounded_statement}</Prose>
              </View>
            ) : v.verdict === "insufficient_evidence" ? (
              <Muted>The supplied evidence does not address this claim, so there is no source statement to report.</Muted>
            ) : (
              <Muted>No source grounded statement was produced for this verification.</Muted>
            )}
          </Section>

          <Section icon="scale-outline" title={supported ? "Why the claim is supported" : "Why the claim does not fully match"}>
            {v.why_claim_does_not_match ? (
              <Prose>{v.why_claim_does_not_match}</Prose>
            ) : supported && v.supported_parts ? (
              <Prose>{v.supported_parts}</Prose>
            ) : supported ? (
              <Prose>The evidence directly supports the essential proposition of the claim.</Prose>
            ) : (
              <Muted>No explanation was returned for this verification.</Muted>
            )}
          </Section>

          {v.supported_parts && !supported ? (
            <Section icon="checkmark-circle" title="Supported portion" tone={{ fg: t.supported, bg: t.supportedSoft }}>
              <Prose>{v.supported_parts}</Prose>
            </Section>
          ) : null}

          {v.unsupported_parts ? (
            <Section icon="alert-circle" title="Unsupported portion" tone={{ fg: t.partial, bg: t.partialSoft }}>
              <Prose>{v.unsupported_parts}</Prose>
            </Section>
          ) : null}

          {v.source_limitations ? (
            <Section icon="eye-off-outline" title="What the evidence does not establish">
              <Prose>{v.source_limitations}</Prose>
            </Section>
          ) : null}

          {v.conclusion ? (
            <Section icon="flag-outline" title="What you can conclude">
              <Prose>{v.conclusion}</Prose>
            </Section>
          ) : null}

          <View style={{ marginTop: 8 }}>
            <SectionHeader title="Show me why" count={v.evidence_used.length} />
            <Muted style={{ marginTop: -6, marginBottom: 14 }}>The exact passages this conclusion rests on, with the source one tap away.</Muted>
            {v.evidence_used.length === 0 ? <Muted>No evidence was attached when this verification ran.</Muted> : null}
            <View style={{ gap: 12 }}>
              {v.evidence_references.map((ref, i) => {
                const evidence = evidenceById.get(ref.evidence_id);
                const name = ref.document_id ? data.names[ref.document_id] : undefined;
                const highlight = ref.quote || evidence?.content || "";
                const role = ref.role === "contradicts" ? { fg: t.contradicted, bg: t.contradictedSoft } : ref.role === "supports" ? { fg: t.supported, bg: t.supportedSoft } : { fg: t.inkSecondary, bg: t.surfaceMuted };
                return (
                  <Card key={`${ref.evidence_id}-${i}`} style={{ gap: 12 }}>
                    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                      <Ionicons name="document-text" size={18} color={t.inkSecondary} />
                      <Text style={{ flex: 1, fontFamily: font.semi, fontSize: 14.5, color: t.ink }} numberOfLines={1}>{name ?? (ref.document_id ? "Document no longer available" : "Pasted evidence")}</Text>
                      {ref.page ? <Mono>p. {ref.page}</Mono> : null}
                    </View>
                    <View style={{ alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 10, height: 24, justifyContent: "center", backgroundColor: role.bg }}>
                      <Text style={{ fontFamily: font.semi, fontSize: 12, color: role.fg }}>{ROLE_LABEL[ref.role]}</Text>
                    </View>
                    <View style={{ borderLeftWidth: 3, borderLeftColor: role.fg, paddingLeft: 12 }}>
                      <Text selectable style={{ fontFamily: font.body, fontSize: 15, lineHeight: 23, color: t.ink }}>{ref.quote ? `“${truncate(ref.quote, 400)}”` : evidence ? truncate(evidence.content, 320) : "Passage text unavailable."}</Text>
                    </View>
                    {ref.quote && evidence && ref.quote.length < evidence.content.length ? <Muted style={{ fontSize: 12.5 }}>Quoted from the stored passage.</Muted> : null}
                    {ref.document_id && name ? <Button title="Open the source" icon="open-outline" variant="secondary" onPress={() => openSource(ref.document_id!, ref.page, highlight)} /> : null}
                  </Card>
                );
              })}
              {unreferenced.map((e) => {
                const name = e.source_document_id ? data.names[e.source_document_id] : undefined;
                return (
                  <Card key={e.id} flat style={{ gap: 12, borderStyle: "dashed", borderColor: t.lineStrong }}>
                    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                      <Ionicons name="document-text-outline" size={18} color={t.inkTertiary} />
                      <Text style={{ flex: 1, fontFamily: font.semi, fontSize: 14.5, color: t.ink }} numberOfLines={1}>{name ?? (e.source_document_id ? "Document no longer available" : "Pasted evidence")}</Text>
                      {e.source_page ? <Mono>p. {e.source_page}</Mono> : null}
                    </View>
                    <Muted style={{ fontSize: 12.5 }}>Considered, not cited</Muted>
                    <View style={{ borderLeftWidth: 3, borderLeftColor: t.line, paddingLeft: 12 }}>
                      <Text style={{ fontFamily: font.body, fontSize: 14.5, lineHeight: 22, color: t.inkSecondary }}>{truncate(e.content, 240)}</Text>
                    </View>
                    {e.source_document_id && name ? <Button title="Open the source" icon="open-outline" variant="secondary" onPress={() => openSource(e.source_document_id!, e.source_page, e.content)} /> : null}
                  </Card>
                );
              })}
            </View>
          </View>

          {findings.length > 0 ? (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showChecks }}
                onPress={() => {
                  tap();
                  setShowChecks((s) => !s);
                }}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: pressed ? t.surfaceMuted : "transparent" })}
              >
                <Ionicons name="git-compare-outline" size={20} color={t.accent} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Heading style={{ fontSize: 16.5 }}>Rule checks</Heading>
                  <Muted style={{ fontSize: 13 }}>
                    {findings.length} {findings.length === 1 ? "check" : "checks"}{conflicts ? `, ${conflicts} flagged` : ""}. Run without the model.
                  </Muted>
                </View>
                <Ionicons name={showChecks ? "chevron-up" : "chevron-down"} size={18} color={t.inkSecondary} />
              </Pressable>
              {showChecks ? (
                <View style={{ padding: 16, paddingTop: 0, gap: 10 }}>
                  {findings.map((f, i) => (
                    <View key={`${f.kind}-${i}`} style={{ borderWidth: 1, borderColor: f.conflict ? t.contradicted : t.line, backgroundColor: f.conflict ? t.contradictedSoft : t.surfaceMuted, borderRadius: radius.control + 2, padding: 12, gap: 6 }}>
                      <Eyebrow style={{ color: f.conflict ? t.contradicted : t.inkTertiary }}>{FINDING_LABEL[f.kind] ?? f.kind}</Eyebrow>
                      <Text style={{ fontFamily: font.body, fontSize: 14, lineHeight: 21, color: t.ink }}>{f.description}</Text>
                      {f.claim_value && f.evidence_value ? (
                        <View style={{ flexDirection: "row", gap: 12, marginTop: 2 }}>
                          <View style={{ flex: 1, gap: 2 }}><Muted style={{ fontSize: 12 }}>Claimed</Muted><Mono style={{ color: t.ink }}>{truncate(f.claim_value, 60)}</Mono></View>
                          <View style={{ flex: 1, gap: 2 }}><Muted style={{ fontSize: 12 }}>Source</Muted><Mono style={{ color: t.ink }}>{truncate(f.evidence_value, 60)}</Mono></View>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          ) : null}

          <View style={{ gap: 6, paddingTop: 4 }}>
            <Muted style={{ fontSize: 12.5, lineHeight: 18 }}>
              {v.analysis?.mode === "ai"
                ? `Produced by rule checks and ${v.analysis.provider} (${v.analysis.model}) reasoning over the passages listed here only. Every reference was validated against the stored evidence.`
                : "Produced by rule checks over the passages listed here only. Model reasoning was not used for this result."}
            </Muted>
            <Mono>{v.completed_at ? `Completed ${formatDateTime(v.completed_at)}` : `Started ${formatDateTime(v.created_at)}`}</Mono>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
