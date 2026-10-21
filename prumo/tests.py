import json

from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, TransactionTestCase

from .asgi import application
from .models import Membro, Papel, Quadro, Registro, Token


def quadro_minimo(id_="qdr_teste", nome="Teste"):
    return {"id": id_, "nome": nome, "colunas": [{"id": "c1", "nome": "A fazer", "tipo": "espera", "limiteWip": 0}], "cards": [], "etiquetas": [], "automacoes": [], "historico": []}


class Base(TestCase):
    def setUp(self):
        U = get_user_model()
        self.ana = U.objects.create_user("ana", "ana@prumo.dev", "Senha1234", first_name="Ana")
        self.beto = U.objects.create_user("beto", "beto@prumo.dev", "Senha1234", first_name="Beto")
        self.token_ana = Token.emitir(self.ana)
        self.token_beto = Token.emitir(self.beto)

    def chamar(self, metodo, url, token=None, corpo=None):
        extra = {"HTTP_AUTHORIZATION": f"Bearer {token}"} if token else {}
        if corpo is None:
            return getattr(self.client, metodo)(url, **extra)
        return getattr(self.client, metodo)(url, data=json.dumps(corpo), content_type="application/json", **extra)

    def criar(self, token=None, dados=None):
        return self.chamar("post", "/api/v1/quadros", token or self.token_ana, {"dados": dados or quadro_minimo()})


class TesteAutenticacao(Base):
    def test_saude_publica(self):
        r = self.client.get("/api/v1/saude")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "ok")

    def test_entrar_com_email(self):
        r = self.chamar("post", "/api/v1/auth/entrar", corpo={"email": "ANA@prumo.dev", "senha": "Senha1234"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["usuario"]["nome"], "Ana")
        eu = self.chamar("get", "/api/v1/auth/eu", r.json()["token"])
        self.assertEqual(eu.json()["email"], "ana@prumo.dev")

    def test_senha_errada(self):
        r = self.chamar("post", "/api/v1/auth/entrar", corpo={"email": "ana@prumo.dev", "senha": "x"})
        self.assertEqual(r.status_code, 401)

    def test_sem_token(self):
        self.assertEqual(self.client.get("/api/v1/quadros").status_code, 401)

    def test_sair_revoga(self):
        self.chamar("post", "/api/v1/auth/sair", self.token_ana)
        self.assertEqual(self.chamar("get", "/api/v1/auth/eu", self.token_ana).status_code, 401)


class TesteQuadros(Base):
    def test_criar_e_listar(self):
        r = self.criar()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["papel"], "admin")
        lista = self.chamar("get", "/api/v1/quadros", self.token_ana).json()
        self.assertEqual([q["id"] for q in lista], ["qdr_teste"])
        self.assertEqual(self.chamar("get", "/api/v1/quadros", self.token_beto).json(), [])

    def test_id_duplicado(self):
        self.criar()
        self.assertEqual(self.criar().status_code, 409)

    def test_dados_invalidos(self):
        r = self.chamar("post", "/api/v1/quadros", self.token_ana, {"dados": {"id": "x"}})
        self.assertEqual(r.status_code, 400)

    def test_salvar_com_revisao(self):
        self.criar()
        dados = quadro_minimo(nome="Novo nome")
        r = self.chamar("put", "/api/v1/quadros/qdr_teste", self.token_ana, {"revisao": 1, "dados": dados, "registros": [{"id": "reg_1", "acao": "editou", "detalhe": "nome", "em": "2026-10-21T10:00:00Z"}]})
        self.assertEqual(r.json()["revisao"], 2)
        self.assertEqual(Quadro.objects.get().nome, "Novo nome")
        self.assertEqual(Registro.objects.get().autor, "Ana")

    def test_conflito_de_revisao(self):
        self.criar()
        self.chamar("put", "/api/v1/quadros/qdr_teste", self.token_ana, {"revisao": 1, "dados": quadro_minimo(nome="B")})
        r = self.chamar("put", "/api/v1/quadros/qdr_teste", self.token_ana, {"revisao": 1, "dados": quadro_minimo(nome="C")})
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.json()["dados"]["nome"], "B")

    def test_registros_nao_duplicam(self):
        self.criar()
        reg = [{"id": "reg_x", "acao": "moveu", "detalhe": "t", "em": "2026-10-21T10:00:00Z"}]
        self.chamar("put", "/api/v1/quadros/qdr_teste", self.token_ana, {"revisao": 1, "dados": quadro_minimo(), "registros": reg})
        self.chamar("put", "/api/v1/quadros/qdr_teste", self.token_ana, {"revisao": 2, "dados": quadro_minimo(), "registros": reg})
        self.assertEqual(Registro.objects.count(), 1)

    def test_tarefas_filtradas(self):
        dados = quadro_minimo()
        dados["cards"] = [{"id": "k1", "colunaId": "c1", "titulo": "Um", "responsavel": "Ana", "prioridade": "alta", "etiquetas": []}, {"id": "k2", "colunaId": "c1", "titulo": "Dois", "responsavel": "Beto", "prioridade": "baixa", "etiquetas": []}]
        self.criar(dados=dados)
        r = self.client.get("/api/v1/quadros/qdr_teste/tarefas?responsavel=ana", HTTP_AUTHORIZATION=f"Bearer {self.token_ana}")
        self.assertEqual([t["id"] for t in r.json()], ["k1"])


class TestePermissoes(Base):
    def setUp(self):
        super().setUp()
        self.criar()
        self.quadro = Quadro.objects.get()

    def definir(self, papel):
        return self.chamar("post", "/api/v1/quadros/qdr_teste/membros", self.token_ana, {"email": "beto@prumo.dev", "papel": papel})

    def test_nao_membro_nao_ve(self):
        self.assertEqual(self.chamar("get", "/api/v1/quadros/qdr_teste", self.token_beto).status_code, 404)

    def test_visualizador_nao_salva(self):
        self.definir("visualizador")
        self.assertEqual(self.chamar("get", "/api/v1/quadros/qdr_teste", self.token_beto).json()["papel"], "visualizador")
        r = self.chamar("put", "/api/v1/quadros/qdr_teste", self.token_beto, {"revisao": 1, "dados": quadro_minimo()})
        self.assertEqual(r.status_code, 403)

    def test_membro_move_mas_nao_muda_colunas(self):
        self.definir("membro")
        dados = quadro_minimo()
        dados["cards"] = [{"id": "k1", "colunaId": "c1", "titulo": "x"}]
        self.assertEqual(self.chamar("put", "/api/v1/quadros/qdr_teste", self.token_beto, {"revisao": 1, "dados": dados}).status_code, 200)
        dados["colunas"].append({"id": "c2", "nome": "Feito", "tipo": "concluido", "limiteWip": 0})
        self.assertEqual(self.chamar("put", "/api/v1/quadros/qdr_teste", self.token_beto, {"revisao": 2, "dados": dados}).status_code, 403)

    def test_gerente_muda_colunas_mas_nao_exclui(self):
        self.definir("gerente")
        dados = quadro_minimo()
        dados["colunas"].append({"id": "c2", "nome": "Feito", "tipo": "concluido", "limiteWip": 0})
        self.assertEqual(self.chamar("put", "/api/v1/quadros/qdr_teste", self.token_beto, {"revisao": 1, "dados": dados}).status_code, 200)
        self.assertEqual(self.chamar("delete", "/api/v1/quadros/qdr_teste", self.token_beto).status_code, 403)

    def test_remover_membro(self):
        self.definir("membro")
        self.definir("remover")
        self.assertFalse(Membro.objects.filter(usuario=self.beto).exists())

    def test_papel_invalido(self):
        self.assertEqual(self.definir("dono").status_code, 400)

    def test_anexo(self):
        arquivo = SimpleUploadedFile("nota.txt", b"conteudo", content_type="text/plain")
        r = self.client.post("/api/v1/quadros/qdr_teste/anexos", {"card": "k1", "arquivo": arquivo}, HTTP_AUTHORIZATION=f"Bearer {self.token_ana}")
        self.assertEqual(r.status_code, 201)
        baixado = self.client.get(r.json()["url"])
        self.assertEqual(b"".join(baixado.streaming_content), b"conteudo")


class TesteTempoReal(TransactionTestCase):
    def test_websocket_recebe_alteracao(self):
        U = get_user_model()
        ana = U.objects.create_user("ana", "ana@prumo.dev", "Senha1234", first_name="Ana")
        token = Token.emitir(ana)
        quadro = Quadro.objects.create(id="qdr_ws", nome="WS", dados=quadro_minimo("qdr_ws"))
        Membro.objects.create(quadro=quadro, usuario=ana, papel=Papel.ADMIN)

        async def fluxo():
            ws = WebsocketCommunicator(application, f"/ws/quadros/qdr_ws/?token={token}")
            conectado, _ = await ws.connect()
            self.assertTrue(conectado)
            presenca = await ws.receive_json_from()
            self.assertEqual(presenca["usuarios"], ["Ana"])
            from channels.layers import get_channel_layer
            await get_channel_layer().group_send("quadro_qdr_ws", {"type": "repassar", "mensagem": {"tipo": "quadro", "revisao": 2}})
            msg = await ws.receive_json_from()
            self.assertEqual(msg["revisao"], 2)
            await ws.disconnect()
            negado = WebsocketCommunicator(application, "/ws/quadros/qdr_ws/?token=errado")
            ok, _ = await negado.connect()
            self.assertFalse(ok)

        async_to_sync(fluxo)()
