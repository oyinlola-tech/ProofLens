import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Button, Eyebrow, FadeIn, Mono, Muted, NO_WEB_OUTLINE, Notice, Screen, Stepper, Title, notify, tap } from "../../../src/components/ui";
import { api, messageOf } from "../../../src/lib/api";
import { formatNumber } from "../../../src/lib/format";
import { font, radius, useTheme } from "../../../src/lib/theme";
import type { Claim, Document } from "../../../src/lib/types";

const MIN = 10;
const MAX = 10000;

const EXAMPLES = [
  "Drinking coffee every day prevents heart disease.",
  "The project gave 10,000 households access to clean water.",
  "The new policy reduced unemployment by 20% within a year.",
];

export default function NewClaim() {
  const { document: documentId } = useLocalSearchParams<{ document?: string }>();
  const router = useRouter();
  const t = useTheme();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<Document | null>(null);

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    api<Document>(`/documents/${documentId}`)
      .then((d) => !cancelled && setSource(d))
      .catch(() => {
        // The evidence step reports a missing document; nothing to show here.
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const length = text.trim().length;

  const submit = async () => {
    const value = text.trim();
    if (value.length < MIN) {
      notify("warning");
      setFieldError("Write a complete claim, at least a short sentence.");
      return;
    }
    if (value.length > MAX) {
      notify("warning");
      setFieldError("Keep the claim under 10,000 characters.");
      return;
    }
    setFieldError(null);
    setError(null);
    setBusy(true);
    try {
      const claim = await api<Claim>("/claims/", { method: "POST", body: { text: value } });
      // Replace, so Back from the evidence step returns to where the check was started.
      router.replace({ pathname: "/(app)/claims/[id]", params: { id: claim.id, ...(documentId ? { document: documentId } : {}) } });
    } catch (e) {
      notify("error");
      setError(messageOf(e));
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          <Button title={busy ? "Saving your claim…" : "Continue to evidence"} size="lg" iconRight="arrow-forward" loading={busy} onPress={submit} />
        </View>
      }
    >
      <View style={{ gap: 24 }}>
        <Stepper current={0} />
        <FadeIn style={{ gap: 8 }}>
          <Title>What do you want to check?</Title>
          <Muted style={{ fontSize: 15.5, lineHeight: 22 }}>Write it as one plain statement, the way you would say it. Evidence comes next.</Muted>
        </FadeIn>

        {error ? <Notice>{error}</Notice> : null}

        <View style={{ gap: 8 }}>
          <View style={{ backgroundColor: t.surface, borderRadius: radius.panel, borderWidth: focused || fieldError ? 1.5 : 1, borderColor: fieldError ? t.contradicted : focused ? t.accent : t.lineStrong, padding: 16, gap: 10, boxShadow: t.shadow }}>
            <Ionicons name="chatbox-ellipses-outline" size={22} color={focused ? t.accent : t.inkTertiary} />
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v);
                if (fieldError) setFieldError(null);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              multiline
              autoFocus
              accessibilityLabel="Your claim"
              placeholder="This study shows the new policy reduced unemployment by 20% within a year…"
              placeholderTextColor={t.inkTertiary}
              selectionColor={t.accent}
              style={[{ fontFamily: font.medium, fontSize: 19, lineHeight: 27, color: t.ink, minHeight: 150, textAlignVertical: "top" }, NO_WEB_OUTLINE]}
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: t.line, paddingTop: 10 }}>
              <Mono style={{ color: length > MAX ? t.contradicted : t.inkTertiary }}>{formatNumber(length)} / {formatNumber(MAX)}</Mono>
              {text ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear the claim" hitSlop={10} onPress={() => setText("")}>
                  <Text style={{ fontFamily: font.medium, fontSize: 13, color: t.inkSecondary }}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          {fieldError ? (
            <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <Ionicons name="alert-circle" size={15} color={t.contradicted} />
              <Text style={{ fontFamily: font.body, fontSize: 13, color: t.contradicted }}>{fieldError}</Text>
            </View>
          ) : null}
        </View>

        {source ? (
          <Notice tone="success" title="Source ready to attach">
            {`${source.filename} will be offered as evidence in the next step.`}
          </Notice>
        ) : null}

        {!text ? (
          <View style={{ gap: 10 }}>
            <Eyebrow>Or try an example</Eyebrow>
            {EXAMPLES.map((e) => (
              <Pressable
                key={e}
                accessibilityRole="button"
                accessibilityLabel={`Use the example: ${e}`}
                onPress={() => {
                  tap();
                  setText(e);
                }}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: pressed ? t.surfaceMuted : t.surface, borderWidth: 1, borderColor: t.line, borderRadius: radius.control + 2, paddingVertical: 13, paddingHorizontal: 14 })}
              >
                <Ionicons name="bulb-outline" size={18} color={t.accent} />
                <Text style={{ flex: 1, fontFamily: font.body, fontSize: 14.5, lineHeight: 20, color: t.ink }}>{e}</Text>
                <Ionicons name="arrow-up-outline" size={16} color={t.inkTertiary} style={{ transform: [{ rotate: "45deg" }] }} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
