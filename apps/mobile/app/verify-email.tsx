import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { AuthShell } from "../src/components/AuthShell";
import { Button, Card, Field, Input, Muted, Notice, TextLink, notify } from "../src/components/ui";
import { api, ApiError, messageOf } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import { font, radius, useTheme } from "../src/lib/theme";
import type { AuthResponse, VerificationPending } from "../src/lib/types";

const CODE_LENGTH = 6;
type OtpState = "idle" | "invalid" | "expired" | "locked" | "rate_limited";

export default function VerifyEmail() {
  const { email: emailParam, sent: sentParam, cooldown: cooldownParam } = useLocalSearchParams<{ email?: string; sent?: string; cooldown?: string }>();
  const { signIn } = useSession();
  const router = useRouter();
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpState, setOtpState] = useState<OtpState>("idle");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState(emailParam ?? "");
  const [editingEmail, setEditingEmail] = useState(!emailParam);
  const [sent, setSent] = useState(sentParam === "1");
  const [remaining, setRemaining] = useState(() => (sentParam === "1" ? Number.parseInt(cooldownParam ?? "0", 10) || 0 : 0));
  const inputRef = useRef<TextInput>(null);
  const submittedRef = useRef("");

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const needsNewCode = otpState === "expired" || otpState === "locked";

  const confirm = async (code = otp) => {
    const address = email.trim().toLowerCase();
    if (!address || code.length !== CODE_LENGTH || needsNewCode) return;
    if (submittedRef.current === code) return;
    submittedRef.current = code;
    setBusy(true);
    setError(null);
    try {
      const auth = await api<AuthResponse>("/auth/verify-otp", { method: "POST", body: { email: address, otp: code }, anonymous: true });
      await signIn(auth.token);
      notify("success");
      router.replace("/(app)/(tabs)");
    } catch (e) {
      submittedRef.current = "";
      notify("error");
      if (e instanceof ApiError && e.code === "OTP_EXPIRED") {
        setOtpState("expired");
        setError("That code has expired. Request a new one below.");
      } else if (e instanceof ApiError && e.code === "OTP_ATTEMPTS_EXCEEDED") {
        setOtpState("locked");
        setError("Too many incorrect attempts. Request a new code below.");
      } else if (e instanceof ApiError && e.code === "OTP_INVALID") {
        setOtpState("invalid");
        const left = e.attemptsRemaining;
        setError(left !== null ? `That code is not correct. ${left} ${left === 1 ? "attempt" : "attempts"} left.` : "That code is not correct. Check the email and try again.");
        setOtp("");
      } else if (e instanceof ApiError && e.status === 429) {
        setOtpState("rate_limited");
        setError("Too many attempts. Wait a few minutes before trying again.");
      } else {
        setError(messageOf(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const onChangeOtp = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "").slice(0, CODE_LENGTH);
    setOtp(digits);
    if (otpState === "invalid") setOtpState("idle");
    if (digits.length === CODE_LENGTH) void confirm(digits);
  };

  const resend = async () => {
    const address = email.trim().toLowerCase();
    if (!address || remaining > 0) return;
    setResending(true);
    setError(null);
    try {
      const pending = await api<VerificationPending>("/auth/resend-verification", { method: "POST", body: { email: address }, anonymous: true });
      setSent(true);
      setOtp("");
      setOtpState("idle");
      submittedRef.current = "";
      setRemaining(pending.resend_cooldown_seconds);
      inputRef.current?.focus();
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        const wait = e.retryAfter ?? 0;
        if (wait > 0) setRemaining(wait);
        setError(wait > 0 ? `Please wait ${wait} seconds before requesting a new code.` : e.userMessage);
      } else {
        setError(messageOf(e));
      }
    } finally {
      setResending(false);
    }
  };

  const boxes = Array.from({ length: CODE_LENGTH }, (_, i) => otp[i] ?? "");

  const address = email.trim().toLowerCase();

  return (
    <AuthShell
      title="Check your email"
      fallback="/(auth)/login"
      subtitle={
        <Muted style={{ fontSize: 15.5, lineHeight: 22 }}>
          {sent ? (
            <>We sent a {CODE_LENGTH}-digit code to <Text style={{ color: t.ink, fontFamily: font.semi }}>{address}</Text>. Enter it to finish creating your account.</>
          ) : (
            <>Enter the {CODE_LENGTH}-digit code from your ProofLens verification email.</>
          )}
        </Muted>
      }
    >
      {error ? <Notice>{error}</Notice> : null}
      {editingEmail ? (
        <Field label="Email">
          <Input icon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="you@example.org" />
        </Field>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: t.surfaceMuted, borderRadius: radius.control + 2, paddingHorizontal: 14, minHeight: 50 }}>
          <Text style={{ color: t.ink, fontFamily: font.medium, fontSize: 15, flexShrink: 1 }} numberOfLines={1}>{address}</Text>
          <TextLink title="Change" onPress={() => setEditingEmail(true)} />
        </View>
      )}
      <Field label="Verification code" hint={needsNewCode ? "Request a new code below, then enter it here." : "The code expires 10 minutes after it was sent."}>
        <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel={`${CODE_LENGTH}-digit verification code`}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {boxes.map((digit, i) => {
              const active = !needsNewCode && otp.length === i;
              return (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 62,
                    borderRadius: radius.control + 2,
                    borderWidth: active ? 2 : 1,
                    borderColor: otpState === "invalid" ? t.contradicted : active ? t.accent : digit ? t.ink : t.lineStrong,
                    backgroundColor: active ? t.accentSoft : t.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: needsNewCode ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontSize: 26, fontFamily: font.display, color: t.ink, fontVariant: ["tabular-nums"] }}>{digit}</Text>
                </View>
              );
            })}
          </View>
          <TextInput
            ref={inputRef}
            value={otp}
            onChangeText={onChangeOtp}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            editable={!busy && !needsNewCode}
            autoFocus={!editingEmail}
            caretHidden
            style={{ position: "absolute", opacity: 0, width: "100%", height: 62 }}
          />
        </Pressable>
      </Field>
      <Button title={busy ? "Verifying…" : "Verify and continue"} size="lg" loading={busy} disabled={otp.length !== CODE_LENGTH || needsNewCode} onPress={() => confirm()} />
      <Card flat style={{ gap: 10 }}>
        <Text style={{ fontFamily: font.semi, fontSize: 15, color: t.ink }}>Didn’t get the code?</Text>
        <Muted>Check your spam folder. Requesting a new code cancels the previous one.</Muted>
        <Button title={remaining > 0 ? `Resend code in ${remaining}s` : "Resend code"} icon="refresh" variant="secondary" loading={resending} disabled={remaining > 0 || !email.trim()} onPress={resend} />
      </Card>
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }}>
        <Muted>Already confirmed?</Muted>
        <TextLink title="Log in" onPress={() => router.replace("/(auth)/login")} />
      </View>
    </AuthShell>
  );
}
