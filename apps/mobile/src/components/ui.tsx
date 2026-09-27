import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { CLAIM_STATUS_LABEL, PROCESSING_LABEL, VERDICT_LABEL, verdictColors } from "../lib/format";
import { font, radius, space, useTheme } from "../lib/theme";
import type { ClaimStatus, ProcessingStatus, Verdict } from "../lib/types";

export type IconName = keyof typeof Ionicons.glyphMap;

const NATIVE = Platform.OS !== "web";
// On web the wrapper border is the focus indicator, so the browser's own ring is dropped.
const NO_WEB_OUTLINE = (NATIVE ? null : { outlineStyle: "none" }) as object | null;
export { NO_WEB_OUTLINE };

/** Light tap feedback. Silently does nothing where haptics are unavailable. */
export function tap() {
  if (!NATIVE) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function notify(kind: "success" | "warning" | "error") {
  if (!NATIVE) return;
  const type = { success: Haptics.NotificationFeedbackType.Success, warning: Haptics.NotificationFeedbackType.Warning, error: Haptics.NotificationFeedbackType.Error }[kind];
  Haptics.notificationAsync(type).catch(() => {});
}

/* ------------------------------------------------------------------ layout */

interface ScreenProps {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  scroll?: boolean;
  /** Add the top safe-area inset. Use on screens without a native header. */
  top?: boolean;
  /** Pinned below the scroll area: primary actions stay reachable with the thumb. */
  footer?: ReactNode;
  /** Set when a tab bar already covers the bottom safe-area inset. */
  insideTabs?: boolean;
  /** Floating action, anchored bottom-right above the content. */
  fab?: ReactNode;
}

export function Screen({ children, refreshing, onRefresh, padded = true, scroll = true, top, footer, insideTabs, fab }: ScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = insideTabs ? 0 : insets.bottom;
  const pad = {
    paddingHorizontal: padded ? space.lg + 4 : 0,
    paddingTop: (top ? insets.top : 0) + (padded ? space.lg : 0),
    paddingBottom: footer ? space.xl : bottomInset + space.xxl + (fab ? 64 : 0),
  };
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={pad}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} progressBackgroundColor={t.surface} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, pad]}>{children}</View>
  );
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.canvas }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {body}
      {fab ? <View style={{ position: "absolute", right: space.lg + 4, bottom: bottomInset + space.lg, pointerEvents: "box-none" }}>{fab}</View> : null}
      {footer ? (
        <View style={{ paddingHorizontal: space.lg + 4, paddingTop: space.md, paddingBottom: bottomInset + space.md, backgroundColor: t.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.lineStrong, boxShadow: t.shadow }}>
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** Fades and lifts content in on mount. Respects nothing fancier: short, one-shot, interruptible. */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration: 320, delay, useNativeDriver: NATIVE });
    a.start();
    return () => a.stop();
  }, [v, delay]);
  return <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }, style]}>{children}</Animated.View>;
}

/* -------------------------------------------------------------------- type */

export function Display({ style, ...p }: TextProps) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={[{ fontFamily: font.display, fontSize: 34, lineHeight: 38, letterSpacing: -1, color: t.ink }, style]} {...p} />;
}
export function Title({ style, ...p }: TextProps) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={[{ fontFamily: font.display, fontSize: 27, lineHeight: 32, letterSpacing: -0.6, color: t.ink }, style]} {...p} />;
}
export function Heading({ style, ...p }: TextProps) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={[{ fontFamily: font.displaySemi, fontSize: 18, lineHeight: 24, letterSpacing: -0.2, color: t.ink }, style]} {...p} />;
}
export function Body({ style, ...p }: TextProps) {
  const t = useTheme();
  return <Text style={[{ fontFamily: font.body, fontSize: 16, lineHeight: 24, color: t.ink }, style]} {...p} />;
}
export function Muted({ style, ...p }: TextProps) {
  const t = useTheme();
  return <Text style={[{ fontFamily: font.body, fontSize: 14, lineHeight: 20, color: t.inkSecondary }, style]} {...p} />;
}
export function Mono({ style, ...p }: TextProps) {
  const t = useTheme();
  return <Text style={[{ fontFamily: font.mono, fontSize: 12, lineHeight: 16, color: t.inkTertiary, fontVariant: ["tabular-nums"] }, style]} {...p} />;
}
/** Small uppercase label that names a section or a value. */
export function Eyebrow({ style, ...p }: TextProps) {
  const t = useTheme();
  return <Text style={[{ fontFamily: font.monoMedium, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: "uppercase", color: t.inkTertiary }, style]} {...p} />;
}

/* ------------------------------------------------------------------- brand */

export function LogoMark({ size = 32, ring }: { size?: number; ring?: string }) {
  const t = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityRole="image" aria-label="ProofLens">
      <Circle cx={32} cy={32} r={22} fill="none" stroke={ring ?? t.ink} strokeWidth={6} />
      <Circle cx={32} cy={32} r={11} fill={t.accent} />
    </Svg>
  );
}

export function Wordmark({ size = 28, color }: { size?: number; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: size * 0.3 }}>
      <LogoMark size={size} ring={color} />
      <Text style={{ fontFamily: font.displaySemi, fontSize: size * 0.78, letterSpacing: -0.6, color: color ?? t.ink }}>ProofLens</Text>
    </View>
  );
}

/* ---------------------------------------------------------------- controls */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "inverse";

interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  size?: "md" | "lg";
  /** Overrides the label colour, for buttons placed over photography. */
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, variant = "primary", loading, disabled, icon, iconRight, size = "md", textColor, style, onPress, ...rest }: ButtonProps) {
  const t = useTheme();
  const bg = { primary: t.accent, secondary: t.surface, ghost: "transparent", danger: t.contradictedSoft, inverse: t.ink }[variant];
  const fg = textColor ?? { primary: t.onAccent, secondary: t.ink, ghost: t.inkSecondary, danger: t.contradicted, inverse: t.onInk }[variant];
  const border = { primary: t.accent, secondary: t.lineStrong, ghost: "transparent", danger: "transparent", inverse: t.ink }[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
      disabled={isDisabled}
      onPress={(e) => {
        tap();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.button,
        { minHeight: size === "lg" ? 56 : 50, backgroundColor: bg, borderColor: border, opacity: isDisabled ? 0.45 : pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        variant === "primary" && !isDisabled ? { boxShadow: `0 8px 20px -10px ${t.accent}` } : null,
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={fg} size="small" /> : icon ? <Ionicons name={icon} size={19} color={fg} /> : null}
      <Text style={{ color: fg, fontFamily: font.semi, fontSize: size === "lg" ? 17 : 15.5, letterSpacing: -0.1 }}>{title}</Text>
      {iconRight && !loading ? <Ionicons name={iconRight} size={18} color={fg} /> : null}
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, tone = "surface", size = 44 }: { icon: IconName; label: string; onPress?: () => void; tone?: "surface" | "plain" | "scrim"; size?: number }) {
  const t = useTheme();
  const bg = tone === "surface" ? t.surface : tone === "scrim" ? "rgba(15,15,17,0.45)" : "transparent";
  const fg = tone === "scrim" ? "#FFFFFF" : t.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: bg, borderWidth: tone === "surface" ? StyleSheet.hairlineWidth : 0, borderColor: t.lineStrong, opacity: pressed ? 0.7 : 1 })}
    >
      <Ionicons name={icon} size={20} color={fg} />
    </Pressable>
  );
}

/** Extended floating action button. */
export function Fab({ title, icon, onPress }: { title: string; icon: IconName; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ height: 56, paddingLeft: 18, paddingRight: 22, borderRadius: 28, flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: t.accent, boxShadow: `0 12px 26px -10px ${t.accent}, ${t.shadow}`, transform: [{ scale: pressed ? 0.96 : 1 }] })}
    >
      <Ionicons name={icon} size={22} color={t.onAccent} />
      <Text style={{ fontFamily: font.semi, fontSize: 15.5, color: t.onAccent }}>{title}</Text>
    </Pressable>
  );
}

/** Inline text link. */
export function TextLink({ title, onPress, icon, color }: { title: string; onPress?: () => void; icon?: IconName; color?: string }) {
  const t = useTheme();
  const c = color ?? t.accent;
  return (
    <Pressable accessibilityRole="link" hitSlop={10} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, opacity: pressed ? 0.6 : 1, minHeight: 28 })}>
      <Text style={{ fontFamily: font.semi, fontSize: 14, color: c }}>{title}</Text>
      {icon ? <Ionicons name={icon} size={15} color={c} /> : null}
    </Pressable>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ fontFamily: font.medium, fontSize: 14, color: t.ink }}>{label}</Text>
      {children}
      {error ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <Ionicons name="alert-circle" size={15} color={t.contradicted} />
          <Text style={{ fontFamily: font.body, fontSize: 13, color: t.contradicted, flexShrink: 1 }}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={{ fontFamily: font.body, fontSize: 13, lineHeight: 18, color: t.inkTertiary }}>{hint}</Text>
      ) : null}
    </View>
  );
}

interface InputProps extends TextInputProps {
  icon?: IconName;
  trailing?: ReactNode;
  invalid?: boolean;
}

export function Input({ style, multiline, icon, trailing, invalid, onFocus, onBlur, ...p }: InputProps) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.inputWrap,
        {
          borderColor: invalid ? t.contradicted : focused ? t.accent : t.lineStrong,
          borderWidth: focused || invalid ? 1.5 : 1,
          backgroundColor: t.surface,
          alignItems: multiline ? "flex-start" : "center",
          minHeight: multiline ? 120 : 54,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={19} color={focused ? t.accent : t.inkTertiary} style={{ marginTop: multiline ? 15 : 0 }} /> : null}
      <TextInput
        placeholderTextColor={t.inkTertiary}
        selectionColor={t.accent}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, { color: t.ink, textAlignVertical: multiline ? "top" : "center", paddingVertical: multiline ? 14 : 0, alignSelf: "stretch" }, NO_WEB_OUTLINE, style]}
        {...p}
      />
      {trailing}
    </View>
  );
}

/** Password field with a show/hide toggle. */
export function PasswordInput(p: InputProps) {
  const t = useTheme();
  const [shown, setShown] = useState(false);
  return (
    <Input
      icon="lock-closed-outline"
      secureTextEntry={!shown}
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        <Pressable accessibilityRole="button" accessibilityLabel={shown ? "Hide password" : "Show password"} hitSlop={10} onPress={() => setShown((s) => !s)} style={{ height: 44, width: 36, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={shown ? "eye-off-outline" : "eye-outline"} size={20} color={t.inkSecondary} />
        </Pressable>
      }
      {...p}
    />
  );
}

export function Segmented<T extends string>({ value, onChange, options, stretch }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: IconName }[]; stretch?: boolean }) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", backgroundColor: t.surfaceMuted, borderRadius: radius.pill, padding: 4, alignSelf: stretch ? "stretch" : "flex-start" }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => {
              if (!on) tap();
              onChange(o.value);
            }}
            style={{ flex: stretch ? 1 : undefined, height: 40, paddingHorizontal: 16, borderRadius: radius.pill, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: on ? t.surfaceRaised : "transparent", boxShadow: on ? t.shadow : undefined }}
          >
            {o.icon ? <Ionicons name={o.icon} size={16} color={on ? t.ink : t.inkSecondary} /> : null}
            <Text style={{ fontFamily: on ? font.semi : font.medium, fontSize: 14, color: on ? t.ink : t.inkSecondary }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ badges */

export function Badge({ label, fg, bg, icon }: { label: string; fg: string; bg: string; icon?: IconName }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingLeft: icon ? 8 : 10, paddingRight: 10, height: 26, flexDirection: "row", gap: 5, alignItems: "center", alignSelf: "flex-start" }}>
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <Text style={{ color: fg, fontFamily: font.semi, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function verdictIcon(v: Verdict | null): IconName {
  switch (v) {
    case "supported": return "checkmark-circle";
    case "partially_supported": return "contrast";
    case "contradicted": return "close-circle";
    case "insufficient_evidence": return "help-circle";
    default: return "ellipse-outline";
  }
}

export function VerdictBadge({ verdict }: { verdict: Verdict | null }) {
  const t = useTheme();
  const c = verdictColors(t, verdict);
  return <Badge label={verdict ? VERDICT_LABEL[verdict] : "No verdict"} fg={c.fg} bg={c.bg} icon={verdictIcon(verdict)} />;
}

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const t = useTheme();
  const map: Record<ClaimStatus, { fg: string; bg: string; icon: IconName }> = {
    pending: { fg: t.inkSecondary, bg: t.surfaceMuted, icon: "ellipse-outline" },
    analyzing: { fg: t.accent, bg: t.accentSoft, icon: "sync" },
    verified: { fg: t.supported, bg: t.supportedSoft, icon: "checkmark-done" },
    rejected: { fg: t.contradicted, bg: t.contradictedSoft, icon: "close-circle" },
    unverified: { fg: t.partial, bg: t.partialSoft, icon: "help-circle" },
    failed: { fg: t.contradicted, bg: t.contradictedSoft, icon: "warning" },
  };
  return <Badge label={CLAIM_STATUS_LABEL[status]} {...map[status]} />;
}

export function ProcessingBadge({ status }: { status: ProcessingStatus }) {
  const t = useTheme();
  const map: Record<ProcessingStatus, { fg: string; bg: string; icon: IconName }> = {
    uploaded: { fg: t.inkSecondary, bg: t.surfaceMuted, icon: "cloud-done-outline" },
    processing: { fg: t.accent, bg: t.accentSoft, icon: "sync" },
    processed: { fg: t.supported, bg: t.supportedSoft, icon: "checkmark-circle" },
    failed: { fg: t.contradicted, bg: t.contradictedSoft, icon: "warning" },
  };
  return <Badge label={PROCESSING_LABEL[status]} {...map[status]} />;
}

export function Chip({ label, icon }: { label: string; icon?: IconName }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 5, alignItems: "center", borderWidth: 1, borderColor: t.line, borderRadius: radius.pill, paddingHorizontal: 10, height: 28, backgroundColor: t.surface }}>
      {icon ? <Ionicons name={icon} size={13} color={t.inkSecondary} /> : null}
      <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: t.inkSecondary }}>{label}</Text>
    </View>
  );
}

/* ---------------------------------------------------------------- surfaces */

interface CardProps extends ViewProps {
  onPress?: () => void;
  accessibilityLabel?: string;
  flat?: boolean;
}

export function Card({ style, onPress, flat, children, accessibilityLabel, ...p }: CardProps) {
  const t = useTheme();
  const base: ViewStyle = { backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: radius.panel, padding: 16, boxShadow: flat ? undefined : t.shadow };
  if (!onPress) return <View style={[base, style]} {...p}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [base, { transform: [{ scale: pressed ? 0.985 : 1 }], opacity: pressed ? 0.92 : 1 }, style as ViewStyle]}
    >
      {children}
    </Pressable>
  );
}

/** Kept for call sites that want a plain bordered panel. */
export const Panel = Card;

export function IconTile({ icon, fg, bg, size = 44 }: { icon: IconName; fg?: string; bg?: string; size?: number }) {
  const t = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg ?? t.accentSoft, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={icon} size={size * 0.48} color={fg ?? t.accent} />
    </View>
  );
}

export function Notice({ tone = "error", children, action, title }: { tone?: "error" | "info" | "success"; children: ReactNode; action?: ReactNode; title?: string }) {
  const t = useTheme();
  const bg = tone === "error" ? t.contradictedSoft : tone === "success" ? t.supportedSoft : t.surfaceMuted;
  const fg = tone === "error" ? t.contradicted : tone === "success" ? t.supported : t.inkSecondary;
  const icon: IconName = tone === "error" ? "alert-circle" : tone === "success" ? "checkmark-circle" : "information-circle";
  return (
    <View accessibilityLiveRegion="polite" style={{ backgroundColor: bg, borderRadius: radius.control + 2, padding: 14, gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Ionicons name={icon} size={20} color={fg} style={{ marginTop: 1 }} />
        <View style={{ flex: 1, gap: 2 }}>
          {title ? <Text style={{ fontFamily: font.semi, fontSize: 14.5, color: tone === "info" ? t.ink : fg }}>{title}</Text> : null}
          {typeof children === "string" ? <Text style={{ color: tone === "info" ? t.inkSecondary : fg, fontFamily: font.body, fontSize: 14, lineHeight: 20 }}>{children}</Text> : children}
        </View>
      </View>
      {action}
    </View>
  );
}

export function EmptyState({ title, body, action, icon = "sparkles-outline" }: { title: string; body: string; action?: ReactNode; icon?: IconName }) {
  const t = useTheme();
  return (
    <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: t.lineStrong, borderRadius: radius.panel, paddingVertical: 28, paddingHorizontal: 22, gap: 10, alignItems: "center" }}>
      <IconTile icon={icon} size={52} />
      <Heading style={{ textAlign: "center", marginTop: 4 }}>{title}</Heading>
      <Muted style={{ textAlign: "center" }}>{body}</Muted>
      {action ? <View style={{ marginTop: 8, alignSelf: "stretch" }}>{action}</View> : null}
    </View>
  );
}

export function Skeleton({ height = 16, width = "100%", radius: r = 8 }: { height?: number; width?: number | `${number}%`; radius?: number }) {
  const t = useTheme();
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: NATIVE }),
        Animated.timing(v, { toValue: 0.45, duration: 700, useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height, width, borderRadius: r, backgroundColor: t.surfaceMuted, opacity: v }} />;
}

/** Placeholder cards shaped like the list they stand in for. */
export function SkeletonList({ count = 3 }: { count?: number }) {
  const t = useTheme();
  return (
    <View accessibilityLabel="Loading" accessibilityLiveRegion="polite" style={{ gap: 12 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: radius.panel, padding: 16, gap: 12 }}>
          <Skeleton height={14} width="92%" />
          <Skeleton height={14} width="64%" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Skeleton height={24} width={110} radius={12} />
            <Skeleton height={24} width={70} radius={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  const t = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={{ paddingVertical: 28, alignItems: "center", gap: 10 }}>
      <ActivityIndicator color={t.accent} />
      <Muted style={{ textAlign: "center" }}>{label}</Muted>
    </View>
  );
}

export function SectionHeader({ title, action, onAction, count }: { title: string; action?: string; onAction?: () => void; count?: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
        <Heading>{title}</Heading>
        {count !== undefined ? (
          <View style={{ minWidth: 24, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: t.surfaceMuted, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: font.monoMedium, fontSize: 12, color: t.inkSecondary }}>{count}</Text>
          </View>
        ) : null}
      </View>
      {action && onAction ? <TextLink title={action} onPress={onAction} icon="chevron-forward" /> : null}
    </View>
  );
}

/** Large in-page header for tab screens, which have no native header. */
export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: space.xl - 4 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Display>{title}</Display>
        {subtitle ? <Muted>{subtitle}</Muted> : null}
      </View>
      {right}
    </View>
  );
}

/* ------------------------------------------------------------------- steps */

const STEPS = ["Claim", "Evidence", "Verdict"] as const;

/** Where the person is in the three-step check. `current` is 0-based. */
export function Stepper({ current }: { current: 0 | 1 | 2 }) {
  const t = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`Step ${current + 1} of 3: ${STEPS[current]}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: i < 2 ? 1 : undefined }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: done ? t.ink : on ? t.accent : t.surfaceMuted }}>
              {done ? <Ionicons name="checkmark" size={15} color={t.onInk} /> : <Text style={{ fontFamily: font.monoMedium, fontSize: 12, color: on ? t.onAccent : t.inkTertiary }}>{i + 1}</Text>}
            </View>
            <Text style={{ fontFamily: on ? font.semi : font.medium, fontSize: 13.5, color: on || done ? t.ink : t.inkTertiary }}>{label}</Text>
            {i < 2 ? <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: done ? t.ink : t.line }} /> : null}
          </View>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------- confidence */

export function ConfidenceRing({ value, color, track, size = 84 }: { value: number; color: string; track: string; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }} accessibilityRole="image" accessibilityLabel={`${Math.round(clamped * 100)} percent confidence`}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c * clamped} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Text style={{ fontFamily: font.display, fontSize: size * 0.27, letterSpacing: -0.5, color, fontVariant: ["tabular-nums"] }}>{Math.round(clamped * 100)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: radius.control + 2, borderWidth: 1, paddingHorizontal: 20, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  inputWrap: { borderRadius: radius.control + 2, paddingHorizontal: 14, flexDirection: "row", gap: 10 },
  input: { flex: 1, fontFamily: font.body, fontSize: 16, lineHeight: 22, minHeight: 44 },
});
