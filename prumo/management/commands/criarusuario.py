import getpass

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Cria uma conta para entrar no Prumo."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--nome", required=True)
        parser.add_argument("--senha")
        parser.add_argument("--admin", action="store_true", help="Acesso de administrador a todos os quadros.")

    def handle(self, *args, **o):
        Usuario = get_user_model()
        email = o["email"].strip().lower()
        if Usuario.objects.filter(email__iexact=email).exists():
            raise CommandError("Já existe uma conta com este e-mail.")
        senha = o["senha"] or getpass.getpass("Senha: ")
        try:
            validate_password(senha)
        except ValidationError as e:
            raise CommandError(" ".join(e.messages))
        partes = o["nome"].strip().split(" ", 1)
        base = email.split("@")[0][:120]
        username = base
        n = 1
        while Usuario.objects.filter(username=username).exists():
            n += 1
            username = f"{base}{n}"
        u = Usuario.objects.create_user(username=username, email=email, password=senha, first_name=partes[0], last_name=partes[1] if len(partes) > 1 else "")
        if o["admin"]:
            u.is_superuser = True
            u.is_staff = True
            u.save()
        self.stdout.write(self.style.SUCCESS(f"Conta criada: {email}"))
