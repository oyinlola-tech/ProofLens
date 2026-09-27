import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { api, ApiError, messageOf } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import type { AuthResponse, VerificationPending } from "../src/lib/types";
import { Body, Button, Field, Input, Muted, Notice, Screen, Title } from "../src/components/ui";
import { radius, useTheme } from "../src/lib/theme";

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
      router.replace("/(app)/(tabs)");
    } catch (e) {
      submittedRef.current = "";
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

  return (
    <Screen>
      <View style={{ gap: 20, paddingTop: 32 }}>
        <Title>Confirm your email</Title>
        <Muted>
          {sent ? (
            <>We sent a {CODE_LENGTH}-digit code to <Text style={{ color: t.ink, fontWeight: "600" }}>{email.trim().toLowerCase()}</Text>. Enter it below to finish creating your account.</>
          ) : (
            <>Enter the {CODE_LENGTH}-digit code from your ProofLens verification email.</>
          )}
        </Muted>
        {error ? <Notice>{error}</Notice> : null}
        {editingEmail ? (
          <Field label="Email">
            <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="you@example.org" />
          </Field>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: t.surfaceMuted, borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Text style={{ color: t.ink, flexShrink: 1 }} numberOfLines={1}>{email.trim().toLowerCase()}</Text>
            <Pressable accessibilityRole="button" onPress={() => setEditingEmail(true)}>
              <Text style={{ color: t.inkSecondary, textDecorationLine: "underline" }}>Change</Text>
            </Pressable>
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
                      height: 56,
                      borderRadius: radius.control,
                      borderWidth: active ? 2 : 1,
                      borderColor: otpState === "invalid" ? t.contradicted : active ? t.accent : t.lineStrong,
                      backgroundColor: t.surface,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: needsNewCode ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 24, fontWeight: "600", color: t.ink, fontVariant: ["tabular-nums"] }}>{digit}</Text>
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
              style={{ position: "absolute", opacity: 0, width: "100%", height: 56 }}
            />
          </Pressable>
        </Field>
        <Button title={busy ? "Verifying…" : "Verify and continue"} loading={busy} disabled={otp.length !== CODE_LENGTH || needsNewCode} onPress={() => confirm()} />
        <View style={{ borderTopWidth: 1, borderTopColor: t.line, paddingTop: 20, gap: 10 }}>
          <Body style={{ fontWeight: "600" }}>Didn&rsquo;t get the code?</Body>
          <Muted>Check your spam folder. Requesting a new code cancels the previous one.</Muted>
          <Button title={remaining > 0 ? `Resend code in ${remaining}s` : "Resend code"} variant="secondary" loading={resending} disabled={remaining > 0 || !email.trim()} onPress={resend} />
          <Muted>
            Already confirmed?{" "}
            <Link href="/(auth)/login" style={{ color: t.ink, textDecorationLine: "underline" }}>
              Log in
            </Link>
          </Muted>
        </View>
      </View>
    </Screen>
  );
}
