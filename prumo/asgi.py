import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "prumo.settings")

django_asgi = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from django.urls import path

from .consumers import QuadroConsumer

application = ProtocolTypeRouter({
    "http": django_asgi,
    "websocket": URLRouter([path("ws/quadros/<str:quadro_id>/", QuadroConsumer.as_asgi())]),
})
