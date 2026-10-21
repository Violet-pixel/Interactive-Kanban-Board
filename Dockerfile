FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DJANGO_SETTINGS_MODULE=prumo.settings \
    PRUMO_MEDIA_ROOT=/dados/anexos

WORKDIR /app
RUN groupadd --system prumo && useradd --system --gid prumo --home-dir /app prumo && mkdir -p /dados/anexos && chown -R prumo:prumo /dados

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY manage.py VERSION ./
COPY prumo ./prumo
COPY web ./web
COPY exemplos ./exemplos
RUN chown -R prumo:prumo /app

USER prumo
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/saude', timeout=2).status == 200 else 1)"
CMD ["sh", "-c", "python manage.py migrate --noinput && if [ \"${PRUMO_SEED:-true}\" = \"true\" ]; then python manage.py seed --se-vazio; fi && exec daphne -b 0.0.0.0 -p 8000 prumo.asgi:application"]
