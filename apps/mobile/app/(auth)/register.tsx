import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { api, messageOf } from "../../src/lib/api";
import type { VerificationPending } from "../../src/lib/types";
import { Button, Field, Input, Muted, Notice, Screen, Title } from "../../src/components/ui";
import { useTheme } from "../../src/lib/theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const t = useTheme();
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
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: 20, paddingTop: 32 }}>
        <View>
          <Title>Create your account</Title>
          <Muted style={{ marginTop: 6 }}>
            Already have one?{" "}
            <Link href="/(auth)/login" style={{ color: t.ink, textDecorationLine: "underline" }}>
              Log in
            </Link>
          </Muted>
        </View>
        {error ? <Notice>{error}</Notice> : null}
        <Field label="Email" error={errors.email} hint="We will send a 6-digit verification code to this address.">
          <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoCorrect={false} spellCheck={false} textContentType="emailAddress" placeholder="you@example.org" />
        </Field>
        <Field label="Password" error={errors.password} hint="8 to 128 characters.">
          <Input value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" placeholder="At least 8 characters" onSubmitEditing={submit} returnKeyType="go" />
        </Field>
        <Button title={busy ? "Sending your code…" : "Create account"} loading={busy} onPress={submit} />
      </View>
    </Screen>
  );
}
