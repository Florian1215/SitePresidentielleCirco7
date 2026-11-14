# ---------- Base commune ----------
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

ENTRYPOINT ["sh", "/app/entrypoint.sh"]
EXPOSE 8000

# ---------- Développement ----------
# Le code est monté en volume (voir docker-compose.dev.yml) : runserver recharge à chaque modification.
FROM base AS dev
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# ---------- Production ----------
FROM base AS prod
COPY . .
RUN useradd --create-home --uid 1000 django \
    && mkdir -p /app/staticfiles /app/media \
    && chown -R django:django /app
USER django
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--access-logfile", "-"]
