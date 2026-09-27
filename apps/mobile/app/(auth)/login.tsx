import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { api, ApiError, messageOf } from "../../src/lib/api";
import { useSession } from "../../src/lib/session";
import type { AuthResponse } from "../../src/lib/types";
import { Button, Field, Input, Muted, Notice, Screen, Title } from "../../src/components/ui";
import { useTheme } from "../../src/lib/theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { signIn, expiredNotice, dismissExpired } = useSession();
  const params = useLocalSearchParams<{ reason?: string }>();
  const router = useRouter();
  const t = useTheme();
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
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError("Email or password is incorrect.");
      else if (err instanceof ApiError && err.status === 403) setNeedsConfirmation(true);
      else setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: 20, paddingTop: 32 }}>
        <View>
          <Title>Log in</Title>
          <Muted style={{ marginTop: 6 }}>
            New here?{" "}
            <Link href="/(auth)/register" style={{ color: t.ink, textDecorationLine: "underline" }}>
              Create an account
            </Link>
          </Muted>
        </View>
        {expiredNotice || params.reason === "revoked" ? (
          <Notice tone="info" action={<Button title="Dismiss" variant="ghost" onPress={dismissExpired} />}>
            {params.reason === "revoked" ? "All sessions were signed out. Log in again to continue." : "Your session expired. Log in again to continue."}
          </Notice>
        ) : null}
        {error ? <Notice>{error}</Notice> : null}
        {needsConfirmation ? (
          <Notice tone="info" action={<Button title="Enter code" variant="secondary" onPress={() => router.push({ pathname: "/verify-email", params: { email: email.trim().toLowerCase() } })} />}>
            Confirm your email address before logging in. Enter the verification code from your email.
          </Notice>
        ) : null}
        <Field label="Email" error={errors.email}>
          <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoCorrect={false} spellCheck={false} textContentType="emailAddress" placeholder="you@example.org" />
        </Field>
        <Field label="Password" error={errors.password}>
          <Input value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" placeholder="At least 8 characters" onSubmitEditing={submit} returnKeyType="go" />
        </Field>
        <Button title={busy ? "Logging in…" : "Log in"} loading={busy} onPress={submit} />
      </View>
    </Screen>
  );
}
