import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { DOCUMENT_TYPE_LABEL, formatNumber, formatPercent, timeAgo, verdictColors } from "../lib/format";
import { font, useTheme } from "../lib/theme";
import type { Claim, Document, Verdict, VerificationSummary } from "../lib/types";
import { Card, ClaimStatusBadge, IconTile, Muted, ProcessingBadge, VerdictBadge, type IconName } from "./ui";

function Dot() {
  const t = useTheme();
  return <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: t.inkTertiary }} />;
}

export function ResultCard({ v, onPress }: { v: VerificationSummary; onPress: () => void }) {
  const t = useTheme();
  const c = verdictColors(t, v.verdict);
  return (
    <Card onPress={onPress} style={{ padding: 0, overflow: "hidden", flexDirection: "row" }}>
      <View style={{ width: 5, backgroundColor: c.fg }} />
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <Text numberOfLines={3} style={{ fontFamily: font.medium, fontSize: 16, lineHeight: 23, color: t.ink }}>{v.claim_text}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <VerdictBadge verdict={v.verdict} />
          {v.confidence !== null ? <Text style={{ fontFamily: font.monoMedium, fontSize: 12.5, color: c.fg }}>{formatPercent(v.confidence)}</Text> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="document-text-outline" size={14} color={t.inkTertiary} />
          <Muted style={{ fontSize: 13 }}>{v.evidence_count} {v.evidence_count === 1 ? "source" : "sources"}</Muted>
          <Dot />
          <Muted style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>{timeAgo(v.completed_at ?? v.created_at)}</Muted>
          <Ionicons name="chevron-forward" size={16} color={t.inkTertiary} />
        </View>
      </View>
    </Card>
  );
}

/** `verdict` is the latest verdict for this claim, when the caller knows it. */
export function ClaimCard({ c, onPress, verdict }: { c: Claim; onPress: () => void; verdict?: Verdict | null }) {
  const t = useTheme();
  return (
    <Card onPress={onPress} style={{ gap: 12 }}>
      <Text numberOfLines={3} style={{ fontFamily: font.medium, fontSize: 16, lineHeight: 23, color: t.ink }}>{c.text}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {verdict && c.status !== "analyzing" ? <VerdictBadge verdict={verdict} /> : <ClaimStatusBadge status={c.status} />}
        <Muted style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>{timeAgo(c.created_at)}</Muted>
        <Ionicons name="chevron-forward" size={16} color={t.inkTertiary} />
      </View>
    </Card>
  );
}

export function documentIcon(type: Document["document_type"]): IconName {
  if (type === "pdf") return "document-attach";
  if (type === "html") return "code-slash";
  return "document-text";
}

export function DocumentCard({ d, onPress, compact }: { d: Document; onPress?: () => void; compact?: boolean }) {
  const t = useTheme();
  if (compact) {
    return (
      <Card onPress={onPress} style={{ width: 168, gap: 12 }}>
        <IconTile icon={documentIcon(d.document_type)} size={40} />
        <Text numberOfLines={2} style={{ fontFamily: font.medium, fontSize: 14.5, lineHeight: 20, color: t.ink, minHeight: 40 }}>{d.filename}</Text>
        <Muted style={{ fontSize: 12.5 }}>{DOCUMENT_TYPE_LABEL[d.document_type] ?? "File"} · {timeAgo(d.created_at)}</Muted>
      </Card>
    );
  }
  return (
    <Card onPress={onPress} style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
      <IconTile icon={documentIcon(d.document_type)} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 15.5, color: t.ink }}>{d.filename}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {d.processing_status !== "processed" ? <ProcessingBadge status={d.processing_status} /> : null}
          <Muted style={{ fontSize: 13 }}>{DOCUMENT_TYPE_LABEL[d.document_type] ?? "File"}</Muted>
          <Dot />
          <Muted style={{ fontSize: 13 }}>{formatNumber(d.content_length)} chars</Muted>
          <Dot />
          <Muted style={{ fontSize: 13 }}>{timeAgo(d.created_at)}</Muted>
        </View>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={t.inkTertiary} /> : null}
    </Card>
  );
}
