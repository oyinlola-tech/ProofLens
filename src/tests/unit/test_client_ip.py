from __future__ import annotations

import pytest
from starlette.requests import Request

from app.settings import settings
from shared.infrastructure.client_ip import client_ip


def _request(peer: str, headers: dict[str, str] | None = None) -> Request:
    raw = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    return Request({"type": "http", "headers": raw, "client": (peer, 1234)})


def test_untrusted_peer_ignores_forwarding_headers(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", [])
    req = _request("198.51.100.1", {"X-Forwarded-For": "1.2.3.4", "X-Real-IP": "5.6.7.8"})
    assert client_ip(req) == "198.51.100.1"


def test_trusted_proxy_uses_rightmost_untrusted_hop(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", ["10.0.0.1", "10.0.0.2"])
    # The client prepended a fake hop; the real client is the last one our proxies saw.
    req = _request("10.0.0.1", {"X-Forwarded-For": "6.6.6.6, 203.0.113.5, 10.0.0.2"})
    assert client_ip(req) == "203.0.113.5"


def test_trusted_proxy_falls_back_to_real_ip(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", ["10.0.0.1"])
    assert client_ip(_request("10.0.0.1", {"X-Real-IP": "203.0.113.9"})) == "203.0.113.9"
    assert client_ip(_request("10.0.0.1")) == "10.0.0.1"
