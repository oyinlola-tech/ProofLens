from __future__ import annotations

import uvicorn

from app.settings import settings


def main() -> None:
    uvicorn.run(
        "app.bootstrap:create_app",
        factory=True,
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG and settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower(),
    )


if __name__ == "__main__":
    main()
