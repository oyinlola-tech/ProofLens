# syntax=docker/dockerfile:1
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /srv/prooflens

# Install dependencies first so they are cached independently of source changes.
COPY pyproject.toml README.md ./
RUN python - <<'PY' > /tmp/requirements.txt
import tomllib
print("\n".join(tomllib.load(open("pyproject.toml", "rb"))["project"]["dependencies"]))
PY
RUN pip install -r /tmp/requirements.txt && rm /tmp/requirements.txt

COPY alembic.ini main.py ./
COPY app ./app
COPY shared ./shared
COPY modules ./modules
COPY migrations ./migrations

RUN useradd --system --uid 10001 --no-create-home prooflens
USER prooflens

ENV PROOFLENS_ENVIRONMENT=production \
    PROOFLENS_DEBUG=false \
    PROOFLENS_HOST=0.0.0.0 \
    PROOFLENS_PORT=8000

EXPOSE 8000

# Run migrations separately before starting new versions:
#   docker run --rm --env-file .env <image> alembic upgrade head
CMD ["python", "main.py"]
