import { type ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type PressableProps, type TextInputProps, type TextProps, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, space, useTheme } from "../lib/theme";
import { CLAIM_STATUS_LABEL, PROCESSING_LABEL, VERDICT_LABEL, verdictColors } from "../lib/format";
import type { ClaimStatus, ProcessingStatus, Verdict } from "../lib/types";

export function Screen({ children, refreshing, onRefresh, padded = true, scroll = true }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void; padded?: boolean; scroll?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pad = padded ? { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: insets.bottom + space.xxl } : { paddingBottom: insets.bottom };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: t.canvas }, pad]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.canvas }}
      contentContainerStyle={pad}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={t.inkSecondary} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Title({ style, ...p }: TextProps) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={[{ fontSize: 26, fontWeight: "600", letterSpacing: -0.4, color: t.ink }, style]} {...p} />;
}
export function Heading({ style, ...p }: TextProps) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={[{ fontSize: 17, fontWeight: "600", color: t.ink }, style]} {...p} />;
}
export function Body({ style, ...p }: TextProps) {
  const t = useTheme();
  return <Text style={[{ fontSize: 16, lineHeight: 24, color: t.ink }, style]} {...p} />;
}
export function Muted({ style, ...p }: TextProps) {
  const t = useTheme();
  return <Text style={[{ fontSize: 14, lineHeight: 20, color: t.inkSecondary }, style]} {...p} />;
}
export function Mono({ style, ...p }: TextProps) {
  const t = useTheme();
  return <Text style={[{ fontSize: 12, fontFamily: "monospace", color: t.inkTertiary, fontVariant: ["tabular-nums"] }, style]} {...p} />;
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({ title, variant = "primary", loading, disabled, style, ...rest }: PressableProps & { title: string; variant?: Variant; loading?: boolean }) {
  const t = useTheme();
  const bg = { primary: t.accent, secondary: t.surface, ghost: "transparent", danger: t.surface }[variant];
  const fg = { primary: t.onAccent, secondary: t.ink, ghost: t.inkSecondary, danger: t.contradicted }[variant];
  const border = { primary: t.accent, secondary: t.lineStrong, ghost: "transparent", danger: t.contradicted }[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style as object,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={fg} size="small" /> : null}
      <Text style={{ color: fg, fontSize: 15, fontWeight: "600" }}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 14, fontWeight: "500", color: t.ink }}>{label}</Text>
      {children}
      {error ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 13, color: t.contradicted }}>{error}</Text> : hint ? <Text style={{ fontSize: 13, color: t.inkTertiary }}>{hint}</Text> : null}
    </View>
  );
}

export function Input({ style, multiline, ...p }: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.inkTertiary}
      multiline={multiline}
      style={[styles.input, { borderColor: t.lineStrong, backgroundColor: t.surface, color: t.ink, minHeight: multiline ? 120 : 48, textAlignVertical: multiline ? "top" : "center" }, style]}
      {...p}
    />
  );
}

export function Badge({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, height: 24, justifyContent: "center", alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export function VerdictBadge({ verdict, large }: { verdict: Verdict | null; large?: boolean }) {
  const t = useTheme();
  const c = verdictColors(t, verdict);
  const label = verdict ? VERDICT_LABEL[verdict] : "No verdict";
  if (!large) return <Badge label={label} fg={c.fg} bg={c.bg} />;
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: radius.pill, paddingHorizontal: 16, height: 36, justifyContent: "center", alignSelf: "flex-start" }}>
      <Text style={{ color: c.fg, fontSize: 15, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const t = useTheme();
  const map: Record<ClaimStatus, { fg: string; bg: string }> = {
    pending: { fg: t.inkSecondary, bg: t.surfaceMuted },
    analyzing: { fg: t.accent, bg: t.accentSoft },
    verified: { fg: t.supported, bg: t.supportedSoft },
    rejected: { fg: t.contradicted, bg: t.contradictedSoft },
    unverified: { fg: t.partial, bg: t.partialSoft },
    failed: { fg: t.contradicted, bg: t.contradictedSoft },
  };
  return <Badge label={CLAIM_STATUS_LABEL[status]} {...map[status]} />;
}

export function ProcessingBadge({ status }: { status: ProcessingStatus }) {
  const t = useTheme();
  const map: Record<ProcessingStatus, { fg: string; bg: string }> = {
    uploaded: { fg: t.inkSecondary, bg: t.surfaceMuted },
    processing: { fg: t.accent, bg: t.accentSoft },
    processed: { fg: t.supported, bg: t.supportedSoft },
    failed: { fg: t.contradicted, bg: t.contradictedSoft },
  };
  return <Badge label={PROCESSING_LABEL[status]} {...map[status]} />;
}

export function Notice({ tone = "error", children, action }: { tone?: "error" | "info"; children: ReactNode; action?: ReactNode }) {
  const t = useTheme();
  const bg = tone === "error" ? t.contradictedSoft : t.surfaceMuted;
  const fg = tone === "error" ? t.contradicted : t.inkSecondary;
  return (
    <View accessibilityLiveRegion="polite" style={{ backgroundColor: bg, borderRadius: radius.control, padding: 12, gap: 10 }}>
      {typeof children === "string" ? <Text style={{ color: fg, fontSize: 14, lineHeight: 20 }}>{children}</Text> : children}
      {action}
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: t.lineStrong, borderRadius: radius.panel, padding: 20, gap: 8 }}>
      <Heading>{title}</Heading>
      <Muted>{body}</Muted>
      {action ? <View style={{ marginTop: 4 }}>{action}</View> : null}
    </View>
  );
}

export function Panel({ style, ...p }: ViewProps) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: radius.panel, padding: 16 }, style]} {...p} />;
}

export function Row({ children, onPress, last }: { children: ReactNode; onPress?: () => void; last?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} onPress={onPress} style={({ pressed }) => [{ paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line, backgroundColor: pressed ? t.surfaceMuted : "transparent", gap: 6 }]}>
      {children}
    </Pressable>
  );
}

export function Skeleton({ height = 16, width = "100%" as number | `${number}%` }) {
  const t = useTheme();
  return <View accessibilityElementsHidden style={{ height, width, borderRadius: 6, backgroundColor: t.surfaceMuted }} />;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  const t = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={{ paddingVertical: 32, alignItems: "center", gap: 8 }}>
      <ActivityIndicator color={t.inkSecondary} />
      <Muted>{label}</Muted>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
      <Heading>{title}</Heading>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={{ color: t.inkSecondary, fontSize: 14 }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: 18, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  input: { borderWidth: 1, borderRadius: radius.control, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, lineHeight: 22 },
});
