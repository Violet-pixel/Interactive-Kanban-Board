import django.db.models.deletion
import django.utils.timezone
import prumo.models
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Quadro",
            fields=[
                (
                    "id",
                    models.CharField(max_length=40, primary_key=True, serialize=False),
                ),
                ("nome", models.CharField(max_length=120)),
                ("arquivado", models.BooleanField(default=False)),
                ("revisao", models.PositiveIntegerField(default=1)),
                ("dados", models.JSONField()),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("atualizado_em", models.DateTimeField(auto_now=True)),
                (
                    "criado_por",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="quadros_criados",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "prumo_quadro",
                "ordering": ["nome"],
            },
        ),
        migrations.CreateModel(
            name="Membro",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "papel",
                    models.CharField(
                        choices=[
                            ("admin", "Administrador"),
                            ("gerente", "Gerente"),
                            ("membro", "Membro"),
                            ("visualizador", "Visualizador"),
                        ],
                        default="membro",
                        max_length=20,
                    ),
                ),
                ("adicionado_em", models.DateTimeField(auto_now_add=True)),
                (
                    "usuario",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="participacoes",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "quadro",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="membros",
                        to="prumo.quadro",
                    ),
                ),
            ],
            options={
                "db_table": "prumo_membro",
            },
        ),
        migrations.CreateModel(
            name="Anexo",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("card_id", models.CharField(max_length=40)),
                ("nome", models.CharField(max_length=255)),
                ("tipo", models.CharField(blank=True, max_length=120)),
                ("tamanho", models.PositiveBigIntegerField()),
                ("arquivo", models.FileField(upload_to=prumo.models.caminho_anexo)),
                ("enviado_em", models.DateTimeField(auto_now_add=True)),
                (
                    "enviado_por",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "quadro",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="anexos",
                        to="prumo.quadro",
                    ),
                ),
            ],
            options={
                "db_table": "prumo_anexo",
            },
        ),
        migrations.CreateModel(
            name="Registro",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("cliente_id", models.CharField(blank=True, max_length=40)),
                ("autor", models.CharField(max_length=120)),
                ("acao", models.CharField(max_length=60)),
                ("detalhe", models.TextField(blank=True)),
                ("card_id", models.CharField(blank=True, max_length=40)),
                ("em", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "quadro",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="registros",
                        to="prumo.quadro",
                    ),
                ),
                (
                    "usuario",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="registros",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "prumo_registro",
                "ordering": ["-em", "-id"],
            },
        ),
        migrations.CreateModel(
            name="Token",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("chave_hash", models.CharField(max_length=64, unique=True)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("expira_em", models.DateTimeField()),
                (
                    "usuario",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tokens",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "prumo_token",
            },
        ),
        migrations.AddIndex(
            model_name="quadro",
            index=models.Index(
                fields=["arquivado", "nome"], name="quadro_arquivado_nome_idx"
            ),
        ),
        migrations.AddConstraint(
            model_name="membro",
            constraint=models.UniqueConstraint(
                fields=("quadro", "usuario"), name="membro_unico_por_quadro"
            ),
        ),
        migrations.AddConstraint(
            model_name="membro",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("papel__in", ["admin", "gerente", "membro", "visualizador"])
                ),
                name="membro_papel_valido",
            ),
        ),
        migrations.AddIndex(
            model_name="anexo",
            index=models.Index(
                fields=["quadro", "card_id"], name="anexo_quadro_card_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="registro",
            index=models.Index(fields=["quadro", "-em"], name="registro_quadro_em_idx"),
        ),
        migrations.AddIndex(
            model_name="registro",
            index=models.Index(
                fields=["quadro", "card_id"], name="registro_quadro_card_idx"
            ),
        ),
        migrations.AddConstraint(
            model_name="registro",
            constraint=models.UniqueConstraint(
                condition=models.Q(("cliente_id", ""), _negated=True),
                fields=("quadro", "cliente_id"),
                name="registro_cliente_unico",
            ),
        ),
    ]
