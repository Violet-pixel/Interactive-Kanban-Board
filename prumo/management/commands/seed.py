import json
import re
from datetime import datetime, timedelta
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from prumo.models import Membro, Papel, Quadro

SENHA = "Prumo@2026"
CONTAS = [
    ("ana", "Ana", "Souza", "admin@prumo.dev", Papel.ADMIN),
    ("bruno", "Bruno", "Lima", "gerente@prumo.dev", Papel.GERENTE),
    ("carla", "Carla", "Dias", "membro@prumo.dev", Papel.MEMBRO),
    ("diego", "Diego", "Rocha", "diego@prumo.dev", Papel.MEMBRO),
    ("eva", "Eva", "Martins", "leitura@prumo.dev", Papel.VISUALIZADOR),
]
DATA_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$")


def deslocar(valor, dias):
    if isinstance(valor, dict):
        return {k: deslocar(v, dias) for k, v in valor.items()}
    if isinstance(valor, list):
        return [deslocar(v, dias) for v in valor]
    if isinstance(valor, str) and DATA_ISO.match(valor):
        if "T" in valor:
            return (datetime.fromisoformat(valor.replace("Z", "+00:00")) + timedelta(days=dias)).isoformat().replace("+00:00", "Z")
        return (datetime.fromisoformat(valor) + timedelta(days=dias)).date().isoformat()
    return valor


class Command(BaseCommand):
    help = "Cria contas e um quadro de demonstração com dados fictícios."

    def add_arguments(self, parser):
        parser.add_argument("--se-vazio", action="store_true", help="Só roda se não houver nenhum usuário.")

    @transaction.atomic
    def handle(self, *args, **opcoes):
        Usuario = get_user_model()
        if opcoes["se_vazio"] and Usuario.objects.exists():
            self.stdout.write("Banco já tem usuários. Demonstração ignorada.")
            return
        usuarios = {}
        for username, nome, sobrenome, email, papel in CONTAS:
            u, criado = Usuario.objects.get_or_create(username=username, defaults={"first_name": nome, "last_name": sobrenome, "email": email})
            if criado:
                u.set_password(SENHA)
                u.save()
            usuarios[email] = (u, papel)
        exemplo = json.loads((Path(settings.BASE_DIR) / "exemplos" / "lancamento.json").read_text(encoding="utf-8"))
        referencia = datetime.fromisoformat(exemplo["referencia"]).date()
        dias = (timezone.localdate() - referencia).days
        dados = deslocar(exemplo["quadros"][0], dias)
        quadro, _ = Quadro.objects.update_or_create(id=dados["id"], defaults={"nome": dados["nome"], "dados": dados, "revisao": 1, "criado_por": usuarios["admin@prumo.dev"][0]})
        for u, papel in usuarios.values():
            Membro.objects.update_or_create(quadro=quadro, usuario=u, defaults={"papel": papel})
        self.stdout.write(self.style.SUCCESS(f"Demonstração pronta: {len(usuarios)} contas (senha {SENHA}) e o quadro “{quadro.nome}”."))
