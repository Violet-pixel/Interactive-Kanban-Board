import hashlib
import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


class Papel(models.TextChoices):
    ADMIN = "admin", "Administrador"
    GERENTE = "gerente", "Gerente"
    MEMBRO = "membro", "Membro"
    VISUALIZADOR = "visualizador", "Visualizador"


ORDEM_PAPEIS = {Papel.VISUALIZADOR: 0, Papel.MEMBRO: 1, Papel.GERENTE: 2, Papel.ADMIN: 3}


class Quadro(models.Model):
    id = models.CharField(primary_key=True, max_length=40)
    nome = models.CharField(max_length=120)
    arquivado = models.BooleanField(default=False)
    revisao = models.PositiveIntegerField(default=1)
    dados = models.JSONField()
    criado_por = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="quadros_criados")
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "prumo_quadro"
        ordering = ["nome"]
        indexes = [models.Index(fields=["arquivado", "nome"], name="quadro_arquivado_nome_idx")]


class Membro(models.Model):
    quadro = models.ForeignKey(Quadro, on_delete=models.CASCADE, related_name="membros")
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="participacoes")
    papel = models.CharField(max_length=20, choices=Papel.choices, default=Papel.MEMBRO)
    adicionado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "prumo_membro"
        constraints = [
            models.UniqueConstraint(fields=["quadro", "usuario"], name="membro_unico_por_quadro"),
            models.CheckConstraint(condition=models.Q(papel__in=["admin", "gerente", "membro", "visualizador"]), name="membro_papel_valido"),
        ]


class Registro(models.Model):
    quadro = models.ForeignKey(Quadro, on_delete=models.CASCADE, related_name="registros")
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="registros")
    cliente_id = models.CharField(max_length=40, blank=True)
    autor = models.CharField(max_length=120)
    acao = models.CharField(max_length=60)
    detalhe = models.TextField(blank=True)
    card_id = models.CharField(max_length=40, blank=True)
    em = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "prumo_registro"
        ordering = ["-em", "-id"]
        indexes = [
            models.Index(fields=["quadro", "-em"], name="registro_quadro_em_idx"),
            models.Index(fields=["quadro", "card_id"], name="registro_quadro_card_idx"),
        ]
        constraints = [models.UniqueConstraint(fields=["quadro", "cliente_id"], condition=~models.Q(cliente_id=""), name="registro_cliente_unico")]


def caminho_anexo(instancia, nome):
    return f"{instancia.quadro_id}/{uuid.uuid4().hex}-{nome[-80:]}"


class Anexo(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quadro = models.ForeignKey(Quadro, on_delete=models.CASCADE, related_name="anexos")
    card_id = models.CharField(max_length=40)
    nome = models.CharField(max_length=255)
    tipo = models.CharField(max_length=120, blank=True)
    tamanho = models.PositiveBigIntegerField()
    arquivo = models.FileField(upload_to=caminho_anexo)
    enviado_por = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    enviado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "prumo_anexo"
        indexes = [models.Index(fields=["quadro", "card_id"], name="anexo_quadro_card_idx")]


class Token(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tokens")
    chave_hash = models.CharField(max_length=64, unique=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    expira_em = models.DateTimeField()

    class Meta:
        db_table = "prumo_token"

    @staticmethod
    def resumir(chave):
        return hashlib.sha256(chave.encode()).hexdigest()

    @classmethod
    def emitir(cls, usuario):
        chave = secrets.token_urlsafe(32)
        cls.objects.create(usuario=usuario, chave_hash=cls.resumir(chave), expira_em=timezone.now() + timedelta(hours=settings.PRUMO_TOKEN_HORAS))
        return chave

    @classmethod
    def validar(cls, chave):
        if not chave:
            return None
        token = cls.objects.select_related("usuario").filter(chave_hash=cls.resumir(chave), expira_em__gt=timezone.now()).first()
        if token and token.usuario.is_active:
            return token.usuario
        return None
