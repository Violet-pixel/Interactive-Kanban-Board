from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import Quadro, Token
from .views import nome_de, papel_no_quadro

PRESENTES = {}


class QuadroConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.quadro_id = self.scope["url_route"]["kwargs"]["quadro_id"]
        self.grupo = f"quadro_{self.quadro_id}"
        token = parse_qs(self.scope.get("query_string", b"").decode()).get("token", [None])[0]
        self.nome = await self.autorizar(token)
        if not self.nome:
            await self.close(code=4401)
            return
        await self.channel_layer.group_add(self.grupo, self.channel_name)
        await self.accept()
        PRESENTES.setdefault(self.grupo, {})[self.channel_name] = self.nome
        await self.anunciar()

    @database_sync_to_async
    def autorizar(self, token):
        usuario = Token.validar(token)
        quadro = Quadro.objects.filter(pk=self.quadro_id).first()
        if not usuario or not quadro or papel_no_quadro(usuario, quadro) is None:
            return None
        return nome_de(usuario)

    async def disconnect(self, code):
        if getattr(self, "nome", None):
            PRESENTES.get(self.grupo, {}).pop(self.channel_name, None)
            await self.channel_layer.group_discard(self.grupo, self.channel_name)
            await self.anunciar()

    async def anunciar(self):
        nomes = sorted(set(PRESENTES.get(self.grupo, {}).values()))
        await self.channel_layer.group_send(self.grupo, {"type": "repassar", "mensagem": {"tipo": "presenca", "usuarios": nomes}})

    async def receive_json(self, conteudo, **kwargs):
        if conteudo.get("tipo") == "ping":
            await self.send_json({"tipo": "pong"})

    async def repassar(self, evento):
        await self.send_json(evento["mensagem"])
