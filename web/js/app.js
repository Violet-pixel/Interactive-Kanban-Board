import { Loja } from './estado.js';
import { ClienteApi } from './api.js';
import { FILTRO_VAZIO, filtroAtivo, responsaveisDo } from './filtros.js';
import { gerarNotificacoes } from './notificacoes.js';
import { pode, nomePapel } from './permissoes.js';
import { PRIORIDADES, debounce } from './util.js';
import { $, $$, html, seguro, icone, avisar, abrirDialogo, LOGO, corExibida } from './ui/dom.js';
import { renderizarQuadro } from './ui/quadro.js';
import { abrirCard } from './ui/card.js';
import { renderizarCalendario, renderizarPainel, renderizarHistorico, htmlNotificacoes } from './ui/vistas.js';
import { dialogoNovoQuadro, dialogoEditarQuadro, dialogoAutomacoes, dialogoMembros, dialogoDados, dialogoConta, dialogoAtalhos } from './ui/dialogos.js';

const armazenamento = (() => { try { return window.localStorage; } catch { return null; } })();
const loja = new Loja(armazenamento);
const api = new ClienteApi({ armazenamento });
const remotos = new Map();
const VISTAS = ['quadro', 'calendario', 'painel', 'historico'];

const ctx = {
  loja,
  api,
  filtro: { ...FILTRO_VAZIO },
  vista: VISTAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'quadro',
  mesCalendario: new Date(),
  servidorDisponivel: false,
  presentes: [],
  modoServidor: () => api.conectado && remotos.has(loja.quadro?.id),
  papel: () => (ctx.modoServidor() ? remotos.get(loja.quadro.id).papel : loja.estado.usuario.papel),
  abrirCard: (id) => abrirCard(id, ctx),
  atualizar: () => render()
};

const aplicarTema = () => {
  const tema = loja.estado.preferencias.tema;
  if (tema === 'sistema') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light';
  document.documentElement.dataset.densidade = loja.estado.preferencias.densidade;
};

const renderLateral = () => {
  const { quadros, quadroAtivo, preferencias } = loja.estado;
  const ativos = quadros.filter((q) => !q.arquivado);
  const arquivados = quadros.filter((q) => q.arquivado);
  const item = (q) => html`<li><button class="item-quadro ${q.id === quadroAtivo ? 'ativo' : ''}" data-quadro="${q.id}"><span class="ponto" style="background:${corExibida(q.cor)}"></span><span class="item-nome">${q.nome}</span>${remotos.has(q.id) ? html`<span class="tag-servidor" title="Salvo no servidor">●</span>` : ''}<span class="item-total">${q.cards.length}</span></button></li>`;
  $('#lateral').innerHTML = html`
    <div class="lateral-topo"><h2>Quadros</h2>${pode(loja.estado.usuario.papel, 'quadros') || api.conectado ? html`<button class="botao-icone" data-acao="novo-quadro" aria-label="Novo quadro" title="Novo quadro">${icone('mais')}</button>` : ''}</div>
    <ul class="lista-quadros">${ativos.map(item)}</ul>
    ${arquivados.length ? html`<button class="link alternar-arquivados" data-acao="arquivados">${preferencias.mostrarArquivados ? 'Ocultar' : 'Mostrar'} arquivados (${arquivados.length})</button>${preferencias.mostrarArquivados ? html`<ul class="lista-quadros arquivados">${arquivados.map(item)}</ul>` : ''}` : ''}
    <div class="lateral-rodape">
      ${ctx.presentes.length ? html`<div class="presentes"><span class="discreto">Agora neste quadro</span><div>${ctx.presentes.map((p) => html`<span class="avatar avatar-online" title="${p}">${p.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>`)}</div></div>` : ''}
      <button class="conta" data-acao="conta">${icone('usuario')}<span><strong>${api.conectado ? api.sessao.usuario.nome : loja.estado.usuario.nome}</strong><small>${api.conectado ? (ctx.modoServidor() ? `${nomePapel(ctx.papel())}, no servidor` : 'Conectado, quadro local') : `${nomePapel(loja.estado.usuario.papel)}, modo local`}</small></span></button>
    </div>`;
};

const opcoes = (lista, atual) => lista.map(([v, n]) => html`<option value="${v}" ${seguro(v === atual ? 'selected' : '')}>${n}</option>`);

const renderFiltros = () => {
  const q = loja.quadro;
  const f = ctx.filtro;
  $('#filtros').innerHTML = html`
    <select id="filtro-responsavel" data-filtro="responsavel" aria-label="Responsável"><option value="">Responsável</option><option value="__sem__" ${seguro(f.responsavel === '__sem__' ? 'selected' : '')}>Sem responsável</option>${opcoes(responsaveisDo(q).map((n) => [n, n]), f.responsavel)}</select>
    <select id="filtro-etiqueta" data-filtro="etiqueta" aria-label="Etiqueta"><option value="">Etiqueta</option>${opcoes(q.etiquetas.map((e) => [e.id, e.nome]), f.etiqueta)}</select>
    <select id="filtro-prioridade" data-filtro="prioridade" aria-label="Prioridade"><option value="">Prioridade</option>${opcoes(PRIORIDADES.map((p) => [p.id, p.nome]), f.prioridade)}</select>
    <select id="filtro-prazo" data-filtro="prazo" aria-label="Prazo"><option value="">Prazo</option>${opcoes([['atrasado', 'Atrasadas'], ['hoje', 'Vencem hoje'], ['semana', 'Próximos 7 dias'], ['sem', 'Sem prazo']], f.prazo)}</select>
    <select id="filtro-coluna" data-filtro="colunaId" aria-label="Status"><option value="">Status</option>${opcoes(q.colunas.map((c) => [c.id, c.nome]), f.colunaId)}</select>
    ${filtroAtivo(f) ? html`<button class="link" data-acao="limpar-filtros">Limpar filtros</button>` : ''}
    <span class="espaco"></span>
    ${pode(ctx.papel(), 'automacoes') ? html`<button class="botao pequeno" data-acao="automacoes">${icone('raio')}Automações <span class="discreto">${q.automacoes.filter((a) => a.ativa !== false).length}</span></button>` : ''}
    ${pode(ctx.papel(), 'configurar') ? html`<button class="botao pequeno" data-acao="membros">Membros <span class="discreto">${(q.membros ?? []).length}</span></button><button class="botao pequeno" data-acao="configurar">Configurar</button>` : ''}`;
};

const renderTopo = () => {
  const q = loja.quadro;
  const naoLidas = loja.estado.notificacoes.filter((n) => !n.lida).length;
  $('#titulo-quadro').textContent = q.nome;
  $('#descricao-quadro').textContent = q.arquivado ? 'Quadro arquivado' : q.descricao;
  $('#botao-desfazer').disabled = !loja.podeDesfazer;
  $('#botao-refazer').disabled = !loja.podeRefazer;
  $('#botao-desfazer').title = loja.podeDesfazer ? `Desfazer ${loja.pilhaDesfazer.at(-1).descricao} (Ctrl+Z)` : 'Nada para desfazer';
  $('#botao-refazer').title = loja.podeRefazer ? `Refazer ${loja.pilhaRefazer.at(-1).descricao} (Ctrl+Y)` : 'Nada para refazer';
  $('#contador-notificacoes').textContent = naoLidas > 9 ? '9+' : naoLidas;
  $('#contador-notificacoes').hidden = !naoLidas;
  $$('[data-vista]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.vista === ctx.vista)));
  $('#estado-sync').textContent = ctx.modoServidor() ? 'Sincronizado' : 'Salvo neste navegador';
  document.title = `${q.nome} · Prumo`;
};

const render = () => {
  if (!loja.quadro) loja.novoQuadro({ nome: 'Meu quadro' });
  aplicarTema();
  renderTopo();
  renderLateral();
  renderFiltros();
  const alvo = $('#vista');
  alvo.dataset.vista = ctx.vista;
  if (ctx.vista === 'calendario') renderizarCalendario(alvo, ctx);
  else if (ctx.vista === 'painel') renderizarPainel(alvo, ctx);
  else if (ctx.vista === 'historico') renderizarHistorico(alvo, ctx);
  else renderizarQuadro(alvo, ctx);
};

const verificarNotificacoes = () => {
  const novas = loja.adicionarNotificacoes(gerarNotificacoes(loja.estado.quadros, { nome: api.conectado ? api.sessao.usuario.nome : loja.estado.usuario.nome }));
  if (novas.length && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
    novas.slice(0, 3).forEach((n) => new Notification('Prumo', { body: n.texto }));
  }
};

const salvarRemoto = debounce(async (id) => {
  const meta = remotos.get(id);
  const q = loja.estado.quadros.find((x) => x.id === id);
  if (!meta || !q || !api.conectado) return;
  const registros = q.historico.filter((h) => !meta.enviados.has(h.id)).slice(0, 100);
  try {
    const r = await api.salvarQuadro(id, meta.revisao, q, registros);
    meta.revisao = r.revisao;
    registros.forEach((h) => meta.enviados.add(h.id));
    $('#estado-sync').textContent = 'Sincronizado';
  } catch (erro) {
    if (erro.status === 409 && erro.corpo?.dados) {
      meta.revisao = erro.corpo.revisao;
      erro.corpo.dados.historico.forEach((h) => meta.enviados.add(h.id));
      loja.substituirQuadroRemoto(erro.corpo.dados);
      avisar('Outra pessoa alterou o quadro ao mesmo tempo. A versão mais recente foi carregada.', 'alerta', 6000);
    } else if (erro.status === 403) {
      avisar('Seu papel neste quadro não permite essa alteração.', 'erro');
      const atual = await api.obterQuadro(id).catch(() => null);
      if (atual) { meta.revisao = atual.revisao; loja.substituirQuadroRemoto(atual.dados); }
    } else {
      $('#estado-sync').textContent = 'Sem conexão. Tentando de novo…';
      setTimeout(() => salvarRemoto(id), 5000);
    }
  }
}, 400);

const assinarAtivo = () => {
  api.fecharTodos();
  ctx.presentes = [];
  const id = loja.quadro?.id;
  if (!ctx.modoServidor()) return;
  api.assinarQuadro(id, (msg) => {
    const meta = remotos.get(id);
    if (msg.tipo === 'quadro' && meta && msg.revisao > meta.revisao) {
      meta.revisao = msg.revisao;
      msg.dados.historico.forEach((h) => meta.enviados.add(h.id));
      loja.substituirQuadroRemoto(msg.dados);
      if (msg.autor) $('#estado-sync').textContent = `Atualizado por ${msg.autor}`;
    } else if (msg.tipo === 'presenca') {
      ctx.presentes = msg.usuarios;
      renderLateral();
    } else if (msg.tipo === 'excluido') {
      remotos.delete(id);
      loja.excluirQuadro(id);
      avisar('Este quadro foi excluído no servidor.', 'alerta');
    }
  });
};

ctx.aoConectar = async () => {
  try {
    const lista = await api.listarQuadros();
    for (const item of lista) {
      const completo = await api.obterQuadro(item.id);
      remotos.set(item.id, { revisao: completo.revisao, papel: completo.papel, enviados: new Set(completo.dados.historico.map((h) => h.id)) });
      const i = loja.estado.quadros.findIndex((q) => q.id === item.id);
      if (i >= 0) loja.estado.quadros[i] = completo.dados;
      else loja.estado.quadros.push(completo.dados);
    }
    if (lista.length && !remotos.has(loja.estado.quadroAtivo)) loja.estado.quadroAtivo = lista[0].id;
    loja.salvar();
    avisar(lista.length ? `Conectado. ${lista.length} quadro(s) do servidor.` : 'Conectado. Envie um quadro para o servidor em Conta e sincronização.');
    assinarAtivo();
    render();
  } catch (erro) {
    avisar(`Não foi possível carregar do servidor: ${erro.message}`, 'erro');
  }
};

ctx.aoDesconectar = () => {
  remotos.clear();
  ctx.presentes = [];
  render();
  avisar('Você saiu. Os quadros continuam disponíveis neste navegador.');
};

ctx.publicarQuadro = async () => {
  const q = loja.quadro;
  try {
    const r = await api.criarQuadro(q);
    remotos.set(q.id, { revisao: r.revisao, papel: r.papel, enviados: new Set(q.historico.map((h) => h.id)) });
    assinarAtivo();
    render();
    avisar('Quadro enviado ao servidor.');
  } catch (erro) {
    if (erro.status === 409) { await ctx.aoConectar(); return; }
    avisar(erro.message, 'erro');
  }
};

loja.assinar((estado, motivo) => {
  render();
  if (['alteracao', 'desfazer', 'refazer'].includes(motivo) && ctx.modoServidor()) {
    $('#estado-sync').textContent = 'Salvando…';
    salvarRemoto(loja.quadro.id);
  }
  if (motivo !== 'notificacoes') verificarNotificacoes();
});

const acoes = {
  'novo-quadro': () => dialogoNovoQuadro(ctx),
  configurar: () => dialogoEditarQuadro(ctx),
  automacoes: () => dialogoAutomacoes(ctx),
  membros: () => dialogoMembros(ctx),
  dados: () => dialogoDados(ctx),
  conta: () => dialogoConta(ctx),
  atalhos: () => dialogoAtalhos(),
  arquivados: () => loja.preferencia('mostrarArquivados', !loja.estado.preferencias.mostrarArquivados),
  'limpar-filtros': () => { ctx.filtro = { ...FILTRO_VAZIO }; $('#busca').value = ''; render(); },
  desfazer: () => { const d = loja.desfazer(); if (d) avisar(`Desfeito: ${d}`); },
  refazer: () => { const d = loja.refazer(); if (d) avisar(`Refeito: ${d}`); },
  tema: () => {
    const ordem = ['sistema', 'claro', 'escuro'];
    const atual = loja.estado.preferencias.tema;
    const proximo = ordem[(ordem.indexOf(atual) + 1) % ordem.length];
    loja.preferencia('tema', proximo);
    avisar(`Tema: ${proximo}`);
  },
  densidade: () => loja.preferencia('densidade', loja.estado.preferencias.densidade === 'compacta' ? 'confortavel' : 'compacta'),
  notificacoes: () => {
    abrirDialogo({
      titulo: 'Notificações',
      corpo: html`${typeof Notification !== 'undefined' && Notification.permission === 'default' ? html`<p><button class="botao pequeno" data-permitir>Receber alertas do navegador</button></p>` : ''}${htmlNotificacoes(loja.estado.notificacoes)}`,
      aoAbrir: (d, fechar) => {
        d.addEventListener('click', (ev) => {
          if (ev.target.closest('[data-permitir]')) Notification.requestPermission();
          const b = ev.target.closest('[data-quadro]');
          if (!b) return;
          fechar();
          if (loja.estado.quadros.some((q) => q.id === b.dataset.quadro)) loja.selecionarQuadro(b.dataset.quadro);
          if (b.dataset.card && loja.quadro.cards.some((c) => c.id === b.dataset.card)) ctx.abrirCard(b.dataset.card);
        });
      },
      aoFechar: () => loja.marcarNotificacoesLidas()
    });
  },
  menu: () => {
    abrirDialogo({
      titulo: 'Menu',
      largura: 'pequena',
      corpo: html`<nav class="menu-lista">
        <button data-acao="dados">Exportar e importar</button>
        <button data-acao="conta">Conta e sincronização</button>
        <button data-acao="densidade">Densidade: ${loja.estado.preferencias.densidade === 'compacta' ? 'compacta' : 'confortável'}</button>
        <button data-acao="atalhos">Atalhos de teclado</button>
        ${ctx.servidorDisponivel ? html`<a href="/api/v1/" target="_blank" rel="noopener">Documentação da API REST</a>` : ''}
      </nav>`,
      aoAbrir: (d) => d.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-acao]');
        if (b) { d.close(); setTimeout(() => acoes[b.dataset.acao]?.(), 0); }
      })
    });
  }
};

document.addEventListener('click', (ev) => {
  if (ev.target.closest('dialog')) return;
  const acao = ev.target.closest('[data-acao]');
  const quadro = ev.target.closest('[data-quadro]');
  const vista = ev.target.closest('[data-vista]');
  if (acao) acoes[acao.dataset.acao]?.();
  else if (quadro) { loja.selecionarQuadro(quadro.dataset.quadro); ctx.filtro = { ...FILTRO_VAZIO, texto: ctx.filtro.texto }; assinarAtivo(); document.body.classList.remove('lateral-aberta'); }
  else if (vista) { ctx.vista = vista.dataset.vista; history.replaceState(null, '', `#${ctx.vista}`); render(); }
  else if (ev.target.closest('[data-alternar-lateral]')) document.body.classList.toggle('lateral-aberta');
});

document.addEventListener('change', (ev) => {
  const f = ev.target.dataset?.filtro;
  if (!f || ev.target.closest('dialog')) return;
  ctx.filtro[f] = ev.target.value;
  render();
});

$('#busca').addEventListener('input', debounce((ev) => { ctx.filtro.texto = ev.target.value; render(); }, 150));

document.addEventListener('keydown', (ev) => {
  const digitando = ev.target.closest('input, textarea, select, [contenteditable]');
  const ctrl = ev.ctrlKey || ev.metaKey;
  if (ctrl && !digitando && ev.key.toLowerCase() === 'z' && !ev.shiftKey) { ev.preventDefault(); acoes.desfazer(); return; }
  if (ctrl && !digitando && (ev.key.toLowerCase() === 'y' || (ev.key.toLowerCase() === 'z' && ev.shiftKey))) { ev.preventDefault(); acoes.refazer(); return; }
  if (digitando || ctrl || ev.altKey || $('#dialogo').open) return;
  if (ev.key === '/') { ev.preventDefault(); $('#busca').focus(); }
  else if (ev.key === '?') dialogoAtalhos();
  else if (ev.key.toLowerCase() === 'n' && pode(ctx.papel(), 'tarefas')) {
    ctx.vista = 'quadro';
    render();
    $('[data-novo-card]')?.click();
    ev.preventDefault();
  } else if (['1', '2', '3', '4'].includes(ev.key)) { ctx.vista = VISTAS[Number(ev.key) - 1]; history.replaceState(null, '', `#${ctx.vista}`); render(); }
});

window.addEventListener('storage', (ev) => {
  if (ev.key === 'prumo:estado:v1' && ev.newValue) {
    loja.estado = loja.carregar();
    render();
  }
});

$('#logo').innerHTML = LOGO;
render();
verificarNotificacoes();
setInterval(verificarNotificacoes, 60000);

api.disponivel().then(async (ok) => {
  ctx.servidorDisponivel = ok;
  if (ok && api.conectado) await ctx.aoConectar();
  else if (!ok && api.conectado) api.gravarSessao(null);
  render();
});
