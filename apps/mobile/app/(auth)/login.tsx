import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AuthShell } from "../../src/components/AuthShell";
import { Button, Field, Input, Muted, Notice, PasswordInput, TextLink, notify } from "../../src/components/ui";
import { api, ApiError, messageOf } from "../../src/lib/api";
import { useSession } from "../../src/lib/session";
import type { AuthResponse } from "../../src/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { signIn, expiredNotice, dismissExpired } = useSession();
  const params = useLocalSearchParams<{ reason?: string }>();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e = email.trim().toLowerCase();
    const errs: typeof errors = {};
    if (!EMAIL_RE.test(e)) errs.email = "Enter a valid email address.";
    if (password.length < 8) errs.password = "Use at least 8 characters.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError(null);
    setNeedsConfirmation(false);
    try {
      const auth = await api<AuthResponse>("/auth/login", { method: "POST", body: { email: e, password }, anonymous: true });
      await signIn(auth.token);
      notify("success");
    } catch (err) {
      notify("error");
      if (err instanceof ApiError && err.status === 401) setError("Email or password is incorrect.");
      else if (err instanceof ApiError && err.status === 403) setNeedsConfirmation(true);
      else setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to pick up your checks where you left them.">
      {expiredNotice || params.reason === "revoked" ? (
        <Notice tone="info" title={params.reason === "revoked" ? "Signed out everywhere" : "Session expired"} action={<Button title="Dismiss" variant="secondary" onPress={dismissExpired} />}>
          Log in again to continue.
        </Notice>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
      {needsConfirmation ? (
        <Notice tone="info" title="Confirm your email first" action={<Button title="Enter code" variant="secondary" iconRight="arrow-forward" onPress={() => router.push({ pathname: "/verify-email", params: { email: email.trim().toLowerCase() } })} />}>
          Enter the verification code from your email, then log in.
        </Notice>
      ) : null}
      <Field label="Email" error={errors.email}>
        <Input icon="mail-outline" invalid={Boolean(errors.email)} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoCorrect={false} spellCheck={false} textContentType="emailAddress" placeholder="you@example.org" returnKeyType="next" />
      </Field>
      <Field label="Password" error={errors.password}>
        <PasswordInput invalid={Boolean(errors.password)} value={password} onChangeText={setPassword} autoComplete="current-password" textContentType="password" placeholder="Your password" onSubmitEditing={submit} returnKeyType="go" />
      </Field>
      <Button title={busy ? "Logging in…" : "Log in"} size="lg" loading={busy} onPress={submit} />
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }}>
        <Muted>New to ProofLens?</Muted>
        <TextLink title="Create an account" onPress={() => router.replace("/(auth)/register")} />
      </View>
    </AuthShell>
  );
}
