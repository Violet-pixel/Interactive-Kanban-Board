import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = BASE_DIR / "web"


def _bool(nome, padrao=False):
    return os.environ.get(nome, str(padrao)).strip().lower() in {"1", "true", "sim", "yes"}


def _lista(nome, padrao=""):
    return [x.strip() for x in os.environ.get(nome, padrao).split(",") if x.strip()]


SECRET_KEY = os.environ.get("PRUMO_SECRET_KEY") or secrets.token_urlsafe(48)
DEBUG = _bool("PRUMO_DEBUG", False)
ALLOWED_HOSTS = _lista("PRUMO_ALLOWED_HOSTS", "localhost,127.0.0.1,[::1]")
CSRF_TRUSTED_ORIGINS = _lista("PRUMO_CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "daphne",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "channels",
    "prumo.apps.PrumoConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "prumo.urls"
ASGI_APPLICATION = "prumo.asgi.application"
WSGI_APPLICATION = "prumo.wsgi.application"

TEMPLATES = []

if os.environ.get("PRUMO_DB_ENGINE", "sqlite") == "postgresql":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "HOST": os.environ.get("PRUMO_DB_HOST", "localhost"),
            "PORT": os.environ.get("PRUMO_DB_PORT", "5432"),
            "NAME": os.environ.get("PRUMO_DB_NAME", "prumo"),
            "USER": os.environ.get("PRUMO_DB_USER", "prumo"),
            "PASSWORD": os.environ.get("PRUMO_DB_PASSWORD", ""),
            "CONN_MAX_AGE": 60,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": os.environ.get("PRUMO_SQLITE_PATH", str(BASE_DIR / "prumo.sqlite3")),
        }
    }

if os.environ.get("PRUMO_REDIS_URL"):
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels_redis.core.RedisChannelLayer", "CONFIG": {"hosts": [os.environ["PRUMO_REDIS_URL"]]}}}
else:
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = os.environ.get("PRUMO_TIMEZONE", "America/Sao_Paulo")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
WHITENOISE_ROOT = WEB_DIR
WHITENOISE_INDEX_FILE = True
WHITENOISE_AUTOREFRESH = DEBUG

MEDIA_ROOT = Path(os.environ.get("PRUMO_MEDIA_ROOT", BASE_DIR / "anexos"))
PRUMO_MAX_ANEXO_MB = int(os.environ.get("PRUMO_MAX_ANEXO_MB", "20"))
PRUMO_TOKEN_HORAS = int(os.environ.get("PRUMO_TOKEN_HORAS", "168"))
DATA_UPLOAD_MAX_MEMORY_SIZE = 15 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
if _bool("PRUMO_HTTPS", False):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": os.environ.get("PRUMO_LOG_LEVEL", "INFO")},
}
