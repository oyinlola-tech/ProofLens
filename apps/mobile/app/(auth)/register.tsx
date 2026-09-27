import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AuthShell } from "../../src/components/AuthShell";
import { Button, Field, Input, Muted, Notice, PasswordInput, TextLink, notify } from "../../src/components/ui";
import { api, messageOf } from "../../src/lib/api";
import type { VerificationPending } from "../../src/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e = email.trim().toLowerCase();
    const errs: typeof errors = {};
    if (!EMAIL_RE.test(e)) errs.email = "Enter a valid email address.";
    if (password.length < 8) errs.password = "Use at least 8 characters.";
    if (password.length > 128) errs.password = "Use at most 128 characters.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError(null);
    try {
      // 202 regardless of whether the address exists; the backend emails a one-time code.
      const pending = await api<VerificationPending>("/auth/register", { method: "POST", body: { email: e, password }, anonymous: true });
      router.push({ pathname: "/verify-email", params: { email: e, sent: "1", cooldown: String(pending.resend_cooldown_seconds) } });
    } catch (err) {
      notify("error");
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Your claims, documents and verdicts stay private to your account.">
      {error ? <Notice>{error}</Notice> : null}
      <Field label="Email" error={errors.email} hint="We will send a 6-digit verification code to this address.">
        <Input icon="mail-outline" invalid={Boolean(errors.email)} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoCorrect={false} spellCheck={false} textContentType="emailAddress" placeholder="you@example.org" returnKeyType="next" />
      </Field>
      <Field label="Password" error={errors.password} hint="8 to 128 characters.">
        <PasswordInput invalid={Boolean(errors.password)} value={password} onChangeText={setPassword} autoComplete="new-password" textContentType="newPassword" placeholder="Choose a password" onSubmitEditing={submit} returnKeyType="go" />
      </Field>
      <Button title={busy ? "Sending your code…" : "Create account"} size="lg" loading={busy} onPress={submit} />
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }}>
        <Muted>Already have an account?</Muted>
        <TextLink title="Log in" onPress={() => router.replace("/(auth)/login")} />
      </View>
    </AuthShell>
  );
}
