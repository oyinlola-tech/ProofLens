import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { api, messageOf } from "../lib/api";
import type { Claim } from "../lib/types";
import { Button, Field, Input, Mono, Notice } from "./ui";

export function ClaimComposer({ documentId, compact }: { documentId?: string; compact?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const t = text.trim();
    if (t.length < 10) {
      setFieldError("Write a complete claim, at least a short sentence.");
      return;
    }
    if (t.length > 10000) {
      setFieldError("Keep the claim under 10,000 characters.");
      return;
    }
    setFieldError(null);
    setError(null);
    setBusy(true);
    try {
      const claim = await api<Claim>("/claims/", { method: "POST", body: { text: t } });
      setText("");
      router.push({ pathname: "/(app)/claims/[id]", params: { id: claim.id, ...(documentId ? { document: documentId } : {}) } });
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      {error ? <Notice>{error}</Notice> : null}
      <Field label="What do you want to verify?" hint={compact ? undefined : "Write the proposition as a plain statement. Evidence comes next."} error={fieldError}>
        <Input value={text} onChangeText={setText} multiline placeholder="This study shows the new policy reduced unemployment by 20% within a year…" style={{ minHeight: compact ? 88 : 132 }} />
      </Field>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Mono>{text.length.toLocaleString()} / 10,000</Mono>
        <Button title={busy ? "Creating…" : "Continue to evidence"} loading={busy} onPress={submit} />
      </View>
    </View>
  );
}
