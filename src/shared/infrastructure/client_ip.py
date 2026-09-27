from __future__ import annotations

import hashlib

from fastapi import Request

from app.settings import settings


def client_ip(request: Request) -> str:
    """Return the caller's IP address.

    Forwarding headers are only honoured when the direct peer is a configured
    trusted proxy; otherwise any client could spoof them to evade rate limits.
    """
    peer = request.client.host if request.client else "unknown"
    trusted = set(settings.TRUSTED_PROXY_IPS)
    if peer not in trusted:
        return peer

    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        hops = [hop.strip() for hop in forwarded.split(",") if hop.strip()]
        # Walk right-to-left: the rightmost hop not added by one of our proxies is the client.
        for hop in reversed(hops):
            if hop not in trusted:
                return hop
        if hops:
            return hops[0]

    real_ip = request.headers.get("x-real-ip")
    if real_ip and real_ip.strip():
        return real_ip.strip()
    return peer


def client_ip_hash(request: Request) -> str:
    return hashlib.sha256(client_ip(request).encode()).hexdigest()[:16]
