
from app.settings import Settings


def test_settings_defaults(monkeypatch):
    for key in ("PROOFLENS_DEBUG", "PROOFLENS_ENVIRONMENT", "PROOFLENS_HOST"):
        monkeypatch.delenv(key, raising=False)
    settings = Settings(_env_file=None)
    assert settings.APP_NAME == "ProofLens"
    assert settings.ENVIRONMENT == "development"
    # Safe-by-default: debug docs/reload off and not exposed on all interfaces.
    assert settings.DEBUG is False
    assert settings.HOST == "127.0.0.1"
    assert settings.CORS_ALLOW_CREDENTIALS is False
    assert settings.TRUSTED_PROXY_IPS == []
    assert settings.API_PREFIX == "/api/v1"
