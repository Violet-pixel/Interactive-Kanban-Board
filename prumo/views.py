import json
from functools import wraps

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.db import IntegrityError, transaction
from django.http import FileResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt

from .models import ORDEM_PAPEIS, Anexo, Membro, Papel, Quadro, Registro, Token

VERSAO = "1.0.0"
LIMITE_DADOS = 5 * 1024 * 1024


def erro(status, mensagem, **extra):
    return JsonResponse({"mensagem": mensagem, **extra}, status=status)


def nome_de(usuario):
    return usuario.get_full_name() or usuario.username


def usuario_json(usuario):
    return {"id": usuario.id, "nome": nome_de(usuario), "email": usuario.email}


def token_da_requisicao(request):
    cabecalho = request.headers.get("Authorization", "")
    if cabecalho.startswith("Bearer "):
        return cabecalho[7:].strip()
    return None


def api(metodos, autenticado=True):
    def decorador(funcao):
        @csrf_exempt
        @wraps(funcao)
        def interna(request, *args, **kwargs):
            if request.method not in metodos:
                return erro(405, "Método não permitido.", permitidos=metodos)
            request.usuario = Token.validar(token_da_requisicao(request))
            if autenticado and not request.usuario:
                return erro(401, "Entre com e-mail e senha para continuar.")
            request.json = {}
            if request.content_type == "application/json" and request.body:
                if len(request.body) > LIMITE_DADOS:
                    return erro(413, "O quadro passou de 5 MB. Remova anexos locais grandes antes de enviar.")
                try:
                    request.json = json.loads(request.body)
                except ValueError:
                    return erro(400, "JSON inválido.")
            return funcao(request, *args, **kwargs)
        return interna
    return decorador


def papel_no_quadro(usuario, quadro):
    if usuario.is_superuser:
        return Papel.ADMIN
    membro = Membro.objects.filter(quadro=quadro, usuario=usuario).only("papel").first()
    return membro.papel if membro else None


def exigir(usuario, quadro, minimo):
    papel = papel_no_quadro(usuario, quadro)
    if papel is None:
        return None, erro(404, "Quadro não encontrado.")
    if ORDEM_PAPEIS[papel] < ORDEM_PAPEIS[minimo]:
        return papel, erro(403, "Seu papel neste quadro não permite esta ação.", papel=papel)
    return papel, None


def avisar_grupo(quadro_id, mensagem):
    camada = get_channel_layer()
    if camada:
        async_to_sync(camada.group_send)(f"quadro_{quadro_id}", {"type": "repassar", "mensagem": mensagem})


def validar_dados(dados):
    if not isinstance(dados, dict):
        return "Envie o quadro em “dados”."
    if not isinstance(dados.get("id"), str) or not dados["id"] or len(dados["id"]) > 40:
        return "O quadro precisa de um id de até 40 caracteres."
    if not isinstance(dados.get("colunas"), list) or not isinstance(dados.get("cards"), list):
        return "O quadro precisa das listas “colunas” e “cards”."
    return None


def mudancas_estruturais(antes, depois):
    return json.dumps([antes.get("colunas"), antes.get("automacoes"), antes.get("etiquetas"), antes.get("bloquearDependencias")], sort_keys=True) != json.dumps([depois.get("colunas"), depois.get("automacoes"), depois.get("etiquetas"), depois.get("bloquearDependencias")], sort_keys=True)


def gravar_registros(quadro, usuario, registros):
    novos = []
    for r in registros[:100]:
        if not isinstance(r, dict):
            continue
        quando = parse_datetime(str(r.get("em", ""))) or timezone.now()
        novos.append(Registro(quadro=quadro, usuario=usuario, cliente_id=str(r.get("id", ""))[:40], autor=nome_de(usuario) if r.get("autor") != "Automação" else "Automação", acao=str(r.get("acao", ""))[:60], detalhe=str(r.get("detalhe", ""))[:2000], card_id=str(r.get("cardId") or "")[:40], em=quando))
    Registro.objects.bulk_create(novos, ignore_conflicts=True)


@api(["GET"], autenticado=False)
def saude(request):
    return JsonResponse({"status": "ok", "versao": VERSAO, "hora": timezone.now().isoformat()})


@api(["GET"], autenticado=False)
def indice(request):
    return JsonResponse({
        "nome": "Prumo API",
        "versao": VERSAO,
        "autenticacao": "POST /api/v1/auth/entrar com {email, senha}; depois Authorization: Bearer <token>",
        "rotas": {
            "GET /api/v1/saude": "Estado do servidor",
            "POST /api/v1/auth/entrar": "Recebe {email, senha} e devolve {token, usuario}",
            "POST /api/v1/auth/sair": "Revoga o token atual",
            "GET /api/v1/auth/eu": "Usuário do token",
            "GET /api/v1/quadros": "Quadros em que você é membro",
            "POST /api/v1/quadros": "Cria um quadro com {dados}",
            "GET /api/v1/quadros/{id}": "Quadro completo com revisão e seu papel",
            "PUT /api/v1/quadros/{id}": "Salva {revisao, dados, registros}; 409 se a revisão estiver desatualizada",
            "DELETE /api/v1/quadros/{id}": "Exclui (administrador)",
            "GET /api/v1/quadros/{id}/historico": "Registros de alterações com autor (até 500)",
            "GET /api/v1/quadros/{id}/tarefas": "Tarefas em formato plano, com filtros ?coluna=&responsavel=&etiqueta=&prioridade=",
            "GET|POST /api/v1/quadros/{id}/membros": "Lista ou define {email, papel}; papel 'remover' tira o acesso",
            "POST /api/v1/quadros/{id}/anexos": "Envia multipart com 'card' e 'arquivo'",
            "GET /api/v1/anexos/{id}": "Baixa um anexo",
            "WS /ws/quadros/{id}/?token=": "Eventos em tempo real: quadro, presenca, excluido",
        },
    })


@api(["POST"], autenticado=False)
def entrar(request):
    email = str(request.json.get("email", "")).strip().lower()
    senha = str(request.json.get("senha", ""))
    Usuario = get_user_model()
    conta = Usuario.objects.filter(email__iexact=email).first()
    usuario = authenticate(request, username=conta.username, password=senha) if conta else None
    if not usuario:
        return erro(401, "E-mail ou senha incorretos.")
    Token.objects.filter(usuario=usuario, expira_em__lt=timezone.now()).delete()
    return JsonResponse({"token": Token.emitir(usuario), "usuario": usuario_json(usuario)})


@api(["POST"])
def sair(request):
    Token.objects.filter(chave_hash=Token.resumir(token_da_requisicao(request))).delete()
    return JsonResponse({"ok": True})


@api(["GET"])
def eu(request):
    return JsonResponse(usuario_json(request.usuario))


def resumo_quadro(quadro, papel):
    return {"id": quadro.id, "nome": quadro.nome, "arquivado": quadro.arquivado, "revisao": quadro.revisao, "papel": papel, "atualizadoEm": quadro.atualizado_em.isoformat()}


@api(["GET", "POST"])
def quadros(request):
    if request.method == "GET":
        if request.usuario.is_superuser:
            lista = [(q, Papel.ADMIN) for q in Quadro.objects.all()]
        else:
            lista = [(m.quadro, m.papel) for m in Membro.objects.filter(usuario=request.usuario).select_related("quadro").order_by("quadro__nome")]
        return JsonResponse([resumo_quadro(q, p) for q, p in lista], safe=False)
    dados = request.json.get("dados")
    problema = validar_dados(dados)
    if problema:
        return erro(400, problema)
    try:
        with transaction.atomic():
            quadro = Quadro.objects.create(id=dados["id"], nome=str(dados.get("nome", "Quadro"))[:120], arquivado=bool(dados.get("arquivado")), dados=dados, criado_por=request.usuario)
            Membro.objects.create(quadro=quadro, usuario=request.usuario, papel=Papel.ADMIN)
            gravar_registros(quadro, request.usuario, dados.get("historico", [])[:100])
    except IntegrityError:
        return erro(409, "Já existe um quadro com este id no servidor.")
    return JsonResponse({**resumo_quadro(quadro, Papel.ADMIN), "dados": quadro.dados}, status=201)


@api(["GET", "PUT", "DELETE"])
def quadro(request, quadro_id):
    obj = get_object_or_404(Quadro, pk=quadro_id)
    if request.method == "GET":
        papel, falha = exigir(request.usuario, obj, Papel.VISUALIZADOR)
        if falha:
            return falha
        return JsonResponse({**resumo_quadro(obj, papel), "dados": obj.dados})
    if request.method == "DELETE":
        papel, falha = exigir(request.usuario, obj, Papel.ADMIN)
        if falha:
            return falha
        obj.delete()
        avisar_grupo(quadro_id, {"tipo": "excluido"})
        return JsonResponse({"ok": True})
    papel, falha = exigir(request.usuario, obj, Papel.MEMBRO)
    if falha:
        return falha
    dados = request.json.get("dados")
    problema = validar_dados(dados)
    if problema:
        return erro(400, problema)
    if dados["id"] != obj.id:
        return erro(400, "O id dos dados não corresponde ao quadro.")
    with transaction.atomic():
        atual = Quadro.objects.select_for_update().get(pk=obj.pk)
        if request.json.get("revisao") != atual.revisao:
            return erro(409, "O quadro foi alterado por outra pessoa.", revisao=atual.revisao, dados=atual.dados)
        if ORDEM_PAPEIS[papel] < ORDEM_PAPEIS[Papel.GERENTE] and mudancas_estruturais(atual.dados, dados):
            return erro(403, "Só gerentes e administradores alteram colunas, etiquetas e automações.", papel=papel)
        atual.dados = dados
        atual.nome = str(dados.get("nome", atual.nome))[:120]
        atual.arquivado = bool(dados.get("arquivado"))
        atual.revisao += 1
        atual.save()
        gravar_registros(atual, request.usuario, request.json.get("registros") or [])
    avisar_grupo(atual.id, {"tipo": "quadro", "revisao": atual.revisao, "dados": atual.dados, "autor": nome_de(request.usuario)})
    return JsonResponse({"revisao": atual.revisao})


@api(["GET"])
def historico(request, quadro_id):
    obj = get_object_or_404(Quadro, pk=quadro_id)
    _, falha = exigir(request.usuario, obj, Papel.VISUALIZADOR)
    if falha:
        return falha
    limite = min(500, max(1, int(request.GET.get("limite", 200) or 200)))
    itens = obj.registros.all()[:limite]
    return JsonResponse([{"id": r.cliente_id or str(r.id), "autor": r.autor, "acao": r.acao, "detalhe": r.detalhe, "cardId": r.card_id or None, "em": r.em.isoformat()} for r in itens], safe=False)


@api(["GET"])
def tarefas(request, quadro_id):
    obj = get_object_or_404(Quadro, pk=quadro_id)
    _, falha = exigir(request.usuario, obj, Papel.VISUALIZADOR)
    if falha:
        return falha
    dados = obj.dados
    colunas = {c["id"]: c for c in dados.get("colunas", [])}
    etiquetas = {e["id"]: e["nome"] for e in dados.get("etiquetas", [])}
    filtro = request.GET
    resultado = []
    for card in dados.get("cards", []):
        coluna = colunas.get(card.get("colunaId"), {})
        nomes = [etiquetas.get(e) for e in card.get("etiquetas", []) if etiquetas.get(e)]
        if filtro.get("coluna") and filtro["coluna"].lower() != coluna.get("nome", "").lower():
            continue
        if filtro.get("responsavel") and filtro["responsavel"].lower() != (card.get("responsavel") or "").lower():
            continue
        if filtro.get("etiqueta") and filtro["etiqueta"].lower() not in [n.lower() for n in nomes]:
            continue
        if filtro.get("prioridade") and filtro["prioridade"] != card.get("prioridade"):
            continue
        resultado.append({"id": card.get("id"), "titulo": card.get("titulo"), "coluna": coluna.get("nome"), "concluida": coluna.get("tipo") == "concluido", "responsavel": card.get("responsavel"), "prioridade": card.get("prioridade"), "etiquetas": nomes, "prazo": card.get("prazo") or None, "criadoEm": card.get("criadoEm"), "concluidoEm": card.get("concluidoEm")})
    return JsonResponse(resultado, safe=False)


@api(["GET", "POST"])
def membros(request, quadro_id):
    obj = get_object_or_404(Quadro, pk=quadro_id)
    if request.method == "GET":
        _, falha = exigir(request.usuario, obj, Papel.VISUALIZADOR)
        if falha:
            return falha
        return JsonResponse([{**usuario_json(m.usuario), "papel": m.papel} for m in obj.membros.select_related("usuario")], safe=False)
    _, falha = exigir(request.usuario, obj, Papel.ADMIN)
    if falha:
        return falha
    email = str(request.json.get("email", "")).strip().lower()
    papel = request.json.get("papel")
    alvo = get_user_model().objects.filter(email__iexact=email).first()
    if not alvo:
        return erro(404, "Nenhuma conta com este e-mail. Crie com: python manage.py criarusuario.")
    if papel == "remover":
        if alvo == request.usuario:
            return erro(400, "Você não pode remover a si mesmo.")
        Membro.objects.filter(quadro=obj, usuario=alvo).delete()
        return JsonResponse({"ok": True})
    if papel not in Papel.values:
        return erro(400, "Papel inválido.", papeis=Papel.values)
    Membro.objects.update_or_create(quadro=obj, usuario=alvo, defaults={"papel": papel})
    return JsonResponse({**usuario_json(alvo), "papel": papel})


@api(["POST"])
def anexos(request, quadro_id):
    obj = get_object_or_404(Quadro, pk=quadro_id)
    _, falha = exigir(request.usuario, obj, Papel.MEMBRO)
    if falha:
        return falha
    arquivo = request.FILES.get("arquivo")
    if not arquivo:
        return erro(400, "Envie o arquivo no campo “arquivo”.")
    if arquivo.size > settings.PRUMO_MAX_ANEXO_MB * 1024 * 1024:
        return erro(413, f"O limite por arquivo é {settings.PRUMO_MAX_ANEXO_MB} MB.")
    anexo = Anexo.objects.create(quadro=obj, card_id=str(request.POST.get("card", ""))[:40], nome=arquivo.name[:255], tipo=(arquivo.content_type or "")[:120], tamanho=arquivo.size, arquivo=arquivo, enviado_por=request.usuario)
    return JsonResponse({"id": str(anexo.id), "nome": anexo.nome, "tipo": anexo.tipo, "tamanho": anexo.tamanho, "url": f"/api/v1/anexos/{anexo.id}"}, status=201)


@csrf_exempt
def baixar_anexo(request, anexo_id):
    usuario = Token.validar(token_da_requisicao(request) or request.COOKIES.get("prumo_token"))
    anexo = get_object_or_404(Anexo, pk=anexo_id)
    if usuario and papel_no_quadro(usuario, anexo.quadro) is None:
        return erro(404, "Anexo não encontrado.")
    resposta = FileResponse(anexo.arquivo.open("rb"), as_attachment=not anexo.tipo.startswith("image/"), filename=anexo.nome)
    resposta["X-Content-Type-Options"] = "nosniff"
    resposta["Content-Security-Policy"] = "default-src 'none'; img-src 'self'"
    return resposta
