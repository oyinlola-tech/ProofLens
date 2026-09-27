from __future__ import annotations

from datetime import UTC, datetime
from html import escape

from app.settings import settings
from shared.infrastructure.email import EmailMessage

_BRAND = "#1a1a2e"
_ACCENT = "#4f46e5"


def _footer_links() -> tuple[str, str]:
    base = settings.PUBLIC_WEB_URL.rstrip("/")
    return f"{base}/privacy", f"{base}/terms"


def _layout(*, title: str, preview: str, body: str) -> str:
    year = datetime.now(UTC).year
    privacy, terms = _footer_links()
    support = escape(settings.SUPPORT_EMAIL)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>{escape(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{escape(preview)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f7;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:{_BRAND};padding:28px 32px;text-align:center;">
<span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">ProofLens</span>
</td></tr>
<tr><td style="padding:32px;">
{body}
</td></tr>
<tr><td style="padding:20px 32px 28px;border-top:1px solid #e5e7eb;">
<p style="margin:0 0 6px;font-size:12px;line-height:18px;color:#6b7280;">Need help? Contact <a href="mailto:{support}" style="color:{_ACCENT};">{support}</a>.</p>
<p style="margin:0 0 6px;font-size:12px;line-height:18px;color:#6b7280;">ProofLens verifies claims against the evidence you supply. We only email you about your account.</p>
<p style="margin:0 0 6px;font-size:12px;line-height:18px;color:#6b7280;"><a href="{escape(privacy)}" style="color:#6b7280;">Privacy</a> &middot; <a href="{escape(terms)}" style="color:#6b7280;">Terms</a></p>
<p style="margin:0;font-size:12px;line-height:18px;color:#9ca3af;">&copy; {year} ProofLens. All rights reserved.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""


def _plain_footer() -> str:
    year = datetime.now(UTC).year
    privacy, terms = _footer_links()
    return (
        f"Need help? Contact {settings.SUPPORT_EMAIL}\n"
        "ProofLens verifies claims against the evidence you supply. We only email you about your account.\n"
        f"Privacy: {privacy}\nTerms: {terms}\n"
        f"© {year} ProofLens. All rights reserved."
    )


def _greeting(to: str) -> str:
    return escape(to.split("@", 1)[0])


def verification_code_email(to: str, otp: str) -> EmailMessage:
    expiry = settings.OTP_EXPIRY_MINUTES
    body = f"""<h1 style="margin:0 0 12px;font-size:22px;line-height:30px;color:#111827;">Verify your ProofLens email</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:24px;">Hi {_greeting(to)},</p>
<p style="margin:0 0 16px;font-size:16px;line-height:24px;">Thanks for creating your ProofLens account. Use the verification code below to confirm that this email address belongs to you.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="background:#eef2ff;border-radius:10px;padding:22px 16px;">
<p style="margin:0 0 6px;font-size:12px;line-height:16px;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;">Your verification code</p>
<p style="margin:0;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:34px;line-height:40px;font-weight:700;letter-spacing:10px;color:{_BRAND};">{escape(otp)}</p>
</td></tr></table>
<p style="margin:16px 0 0;font-size:14px;line-height:22px;color:#4b5563;">This code expires in {expiry} minutes.</p>
<p style="margin:16px 0 0;font-size:14px;line-height:22px;color:#b91c1c;font-weight:600;">For your security, never share this code with anyone. ProofLens will never ask you to send this code to another person.</p>
<p style="margin:16px 0 0;font-size:14px;line-height:22px;color:#4b5563;">If you did not create a ProofLens account, you can safely ignore this email.</p>"""
    text = (
        "Verify your ProofLens email\n\n"
        f"Hi {to.split('@', 1)[0]},\n\n"
        "Thanks for creating your ProofLens account. Use the verification code below to confirm "
        "that this email address belongs to you.\n\n"
        f"Your verification code: {otp}\n\n"
        f"This code expires in {expiry} minutes.\n\n"
        "For your security, never share this code with anyone. ProofLens will never ask you to "
        "send this code to another person.\n\n"
        "If you did not create a ProofLens account, you can safely ignore this email.\n\n"
        + _plain_footer()
    )
    return EmailMessage(
        to=to,
        subject="Verify your ProofLens email",
        text=text,
        html=_layout(
            title="Verify your ProofLens email",
            preview=f"Your ProofLens verification code expires in {expiry} minutes.",
            body=body,
        ),
    )


def welcome_email(to: str) -> EmailMessage:
    app_url = escape(settings.PUBLIC_WEB_URL.rstrip("/") + "/app")
    body = f"""<h1 style="margin:0 0 12px;font-size:22px;line-height:30px;color:#111827;">Your email is verified</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:24px;">Hi {_greeting(to)},</p>
<p style="margin:0 0 16px;font-size:16px;line-height:24px;">Your ProofLens account is ready. Enter a claim, attach the documents that should back it up, and ProofLens will tell you what the supplied evidence actually establishes, with the page it came from.</p>
<p style="margin:0 0 16px;font-size:16px;line-height:24px;"><a href="{app_url}" style="display:inline-block;background:{_BRAND};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">Open ProofLens</a></p>
<p style="margin:0;font-size:14px;line-height:22px;color:#4b5563;">If you did not verify a ProofLens account, contact us right away.</p>"""
    text = (
        "Your email is verified\n\n"
        f"Hi {to.split('@', 1)[0]},\n\n"
        "Your ProofLens account is ready. Enter a claim, attach the documents that should back it "
        "up, and ProofLens will tell you what the supplied evidence actually establishes, with the "
        "page it came from.\n\n"
        f"Open ProofLens: {settings.PUBLIC_WEB_URL.rstrip('/')}/app\n\n"
        "If you did not verify a ProofLens account, contact us right away.\n\n" + _plain_footer()
    )
    return EmailMessage(
        to=to,
        subject="Welcome to ProofLens",
        text=text,
        html=_layout(title="Welcome to ProofLens", preview="Your ProofLens account is ready.", body=body),
    )


def existing_account_email(to: str) -> EmailMessage:
    login_url = escape(settings.PUBLIC_WEB_URL.rstrip("/") + "/login")
    body = f"""<h1 style="margin:0 0 12px;font-size:22px;line-height:30px;color:#111827;">You already have a ProofLens account</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:24px;">Hi {_greeting(to)},</p>
<p style="margin:0 0 16px;font-size:16px;line-height:24px;">Someone tried to sign up for ProofLens with this email address, but it already has an account. No changes were made.</p>
<p style="margin:0 0 16px;font-size:16px;line-height:24px;">If it was you, <a href="{login_url}" style="color:{_ACCENT};">log in with your existing password</a>.</p>
<p style="margin:0;font-size:14px;line-height:22px;color:#4b5563;">If it was not you, you can ignore this email. Your account and password are unchanged.</p>"""
    text = (
        "You already have a ProofLens account\n\n"
        f"Hi {to.split('@', 1)[0]},\n\n"
        "Someone tried to sign up for ProofLens with this email address, but it already has an "
        "account. No changes were made.\n\n"
        f"If it was you, log in with your existing password: {settings.PUBLIC_WEB_URL.rstrip('/')}/login\n"
        "If it was not you, you can ignore this email. Your account and password are unchanged.\n\n"
        + _plain_footer()
    )
    return EmailMessage(
        to=to,
        subject="You already have a ProofLens account",
        text=text,
        html=_layout(
            title="You already have a ProofLens account",
            preview="A sign-up was attempted with your email address. No changes were made.",
            body=body,
        ),
    )
