import { html, seguro, icone, avisar, $, $$, pedirTexto, confirmar, abrirDialogo, corExibida } from './dom.js';
import { cardsDaColuna, moverCard, adicionarCard, adicionarColuna, moverColuna, excluirColuna, progressoSubtarefas, dependenciasPendentes, estaConcluido, colunaDe, registrar } from '../regras.js';
import { atendeFiltro, situacaoPrazo, filtroAtivo, diasNaColuna } from '../filtros.js';
import { interpretarEntrada } from '../entrada.js';
import { formatarData, nomePrioridade, normalizar } from '../util.js';
import { pode } from '../permissoes.js';

export const iniciais = (nome) => String(nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

const ROTULO_PRAZO = { atrasado: 'Atrasada', hoje: 'Hoje', semana: '', futuro: '', concluido: '', sem: '' };

export const htmlCard = (quadro, card, podeMover, eu = '') => {
  const etiquetas = card.etiquetas.map((id) => quadro.etiquetas.find((e) => e.id === id)).filter(Boolean);
  const prog = progressoSubtarefas(card);
  const prazo = situacaoPrazo(quadro, card);
  const concluido = estaConcluido(quadro, card);
  const bloqueado = !concluido && dependenciasPendentes(quadro, card).length > 0;
  const parada = concluido ? 0 : diasNaColuna(card);
  const ic = quadro.colunas.findIndex((c) => c.id === card.colunaId);
  const proxima = quadro.colunas[ic + 1];
  const minha = eu && normalizar(card.responsavel) === normalizar(eu);
  return html`<article class="card prioridade-${card.prioridade} ${bloqueado ? 'card-bloqueado' : ''}" data-card="${card.id}" draggable="${podeMover ? 'true' : 'false'}" tabindex="0" aria-label="${card.titulo}">
    ${etiquetas.length ? html`<div class="card-etiquetas">${etiquetas.map((e) => html`<span class="etiqueta" style="--cor:${corExibida(e.cor)}">${e.nome}</span>`)}</div>` : ''}
    <h3 class="card-titulo">${card.titulo}</h3>
    <div class="card-meta">
      ${card.prazo ? html`<span class="selo prazo-${prazo}" title="Prazo">${icone('relogio')}${formatarData(card.prazo)}${ROTULO_PRAZO[prazo] ? html` <span class="selo-rotulo">${ROTULO_PRAZO[prazo]}</span>` : ''}</span>` : ''}
      ${prog.total ? html`<span class="selo ${prog.feitas === prog.total ? 'selo-ok' : ''}" title="Subtarefas">${icone('check')}${prog.feitas}/${prog.total}</span>` : ''}
      ${card.comentarios.length ? html`<span class="selo" title="Comentários">${icone('balao')}${card.comentarios.length}</span>` : ''}
      ${card.anexos.length ? html`<span class="selo" title="Anexos">${icone('clipe')}${card.anexos.length}</span>` : ''}
      ${bloqueado ? html`<span class="selo selo-alerta" title="Depende de tarefas não concluídas">${icone('elo')}Bloqueada</span>` : ''}
      ${parada >= 5 ? html`<span class="selo selo-parada ${parada >= 10 ? 'parada-longa' : ''}" title="Dias nesta coluna sem sair do lugar">${icone('ampulheta')}${parada} d parada</span>` : ''}
    </div>
    ${prog.total ? html`<div class="progresso" aria-hidden="true"><span style="width:${prog.percentual}%"></span></div>` : ''}
    <div class="card-rodape">
      <span class="prioridade">${nomePrioridade(card.prioridade)}</span>
      ${podeMover ? html`<span class="card-rapido">${!minha && eu ? html`<button type="button" class="rapido" data-assumir="${card.id}" title="Ficar com esta tarefa">${icone('mao')}<span>Assumir</span></button>` : ''}${proxima ? html`<button type="button" class="rapido" data-avancar="${card.id}" title="Mover para ${proxima.nome}">${icone('seta')}<span>${proxima.nome}</span></button>` : ''}</span>` : ''}
      ${card.responsavel ? html`<span class="avatar" title="${card.responsavel}">${iniciais(card.responsavel)}</span>` : html`<span class="avatar avatar-vazio" title="Sem responsável">?</span>`}
    </div>
  </article>`;
};

const TIPOS = { espera: 'Espera', andamento: 'Em andamento', concluido: 'Concluído' };

// Nível de bolha: uma marca por vaga do limite WIP; a bolha anda até a marca do total.
const htmlNivel = (total, limite) => {
  if (!limite) return html`<p class="sem-limite">Sem limite WIP</p>`;
  const estado = total >= limite ? 'nivel-cheio' : total === limite - 1 && limite > 1 ? 'nivel-quase' : 'nivel-livre';
  const numerar = limite <= 8;
  const marcas = Array.from({ length: limite + 1 }, (_, i) => html`<span class="nivel-marca ${i === limite ? 'limite' : i <= total && i > 0 ? 'cheia' : ''}" style="--i:${i / limite}">${numerar || i === 0 || i === limite ? html`<span>${i}</span>` : ''}</span>`);
  return html`<div class="nivel ${estado}" role="img" aria-label="${total} de ${limite} vagas do limite WIP ocupadas" style="--pos:${Math.min(1, total / limite)}">
    <span class="nivel-tubo"><span class="nivel-bolha"></span></span>
    <span class="nivel-regua" aria-hidden="true">${marcas}</span>
  </div>`;
};

export const renderizarQuadro = (alvo, ctx) => {
  const { loja, filtro } = ctx;
  const quadro = loja.quadro;
  const papel = ctx.papel();
  const podeTarefas = pode(papel, 'tarefas');
  const podeColunas = pode(papel, 'colunas');
  const filtrando = filtroAtivo(filtro);
  const recolhidas = loja.estado.preferencias.recolhidas?.[quadro.id] ?? [];
  const eu = ctx.usuarioNome?.() ?? '';
  alvo.innerHTML = html`<div class="quadro" style="--cor-quadro:${corExibida(quadro.cor)}">
    ${quadro.colunas.map((col) => {
      const todos = cardsDaColuna(quadro, col.id);
      const visiveis = todos.filter((c) => atendeFiltro(quadro, c, filtro));
      const cheio = col.limiteWip && todos.length >= col.limiteWip;
      if (recolhidas.includes(col.id)) {
        return html`<section class="coluna coluna-recolhida coluna-${col.tipo} ${cheio ? 'coluna-lotada' : ''}" data-coluna="${col.id}">
          <button class="recolhida-botao" data-expandir="${col.id}" title="Mostrar a coluna ${col.nome}" aria-label="Mostrar a coluna ${col.nome}">${icone('expandir')}<span class="recolhida-nome">${col.nome}</span><span class="contador">${todos.length}${col.limiteWip ? `/${col.limiteWip}` : ''}</span></button>
          <div class="coluna-lista" data-lista="${col.id}" hidden></div>
        </section>`;
      }
      return html`<section class="coluna coluna-${col.tipo}" data-coluna="${col.id}">
        <header class="coluna-topo" draggable="${podeColunas ? 'true' : 'false'}" data-arrastar-coluna="${col.id}">
          <button class="botao-icone pequeno recolher" data-recolher="${col.id}" aria-label="Recolher a coluna ${col.nome}" title="Recolher">${icone('recolher')}</button>
          <h2 class="coluna-nome" title="${TIPOS[col.tipo]}">${col.nome}</h2>
          <span class="contador ${cheio ? 'contador-cheio' : ''}" title="${col.limiteWip ? 'Tarefas / limite WIP' : 'Tarefas'}">${filtrando ? `${visiveis.length} de ` : ''}${todos.length}${col.limiteWip ? `/${col.limiteWip}` : ''}</span>
          ${podeColunas ? html`<button class="botao-icone pequeno" data-menu-coluna="${col.id}" aria-label="Opções da coluna ${col.nome}">${icone('pontos')}</button>` : ''}
          ${htmlNivel(todos.length, col.limiteWip)}
        </header>
        <div class="coluna-lista" data-lista="${col.id}">
          ${visiveis.map((c) => htmlCard(quadro, c, podeTarefas, eu))}
          ${!visiveis.length ? html`<p class="coluna-vazia">${filtrando ? 'Nada com esses filtros' : 'Arraste tarefas para cá'}</p>` : ''}
        </div>
        ${podeTarefas ? html`<button class="botao-adicionar" data-novo-card="${col.id}">${icone('mais')}Adicionar tarefa</button>` : ''}
      </section>`;
    })}
    ${podeColunas ? html`<button class="nova-coluna" data-nova-coluna>${icone('mais')}Nova coluna</button>` : ''}
  </div>`;
  ligarEventos(alvo.querySelector('.quadro'), ctx);
};

const indiceDestino = (lista, y, arrastadoId) => {
  const cards = $$('.card', lista).filter((c) => c.dataset.card !== arrastadoId);
  const proximo = cards.find((c) => {
    const r = c.getBoundingClientRect();
    return y < r.top + r.height / 2;
  });
  return { proximo, cards };
};

const indiceReal = (quadro, colunaId, proximoId, arrastadoId) => {
  const todos = cardsDaColuna(quadro, colunaId).filter((c) => c.id !== arrastadoId);
  if (!proximoId) return todos.length;
  const i = todos.findIndex((c) => c.id === proximoId);
  return i < 0 ? todos.length : i;
};

const executarMovimento = (ctx, cardId, colunaId, indice) => {
  const r = ctx.loja.alterarQuadro('mover tarefa', (q, autor) => moverCard(q, cardId, colunaId, indice, autor));
  if (r.ok === false) avisar(r.erro, 'erro');
  else r.avisos?.forEach((a) => avisar(a, a.startsWith('Esta tarefa') ? 'alerta' : 'info'));
};

const ligarEventos = (alvo, ctx) => {
  const { loja } = ctx;
  let arrastando = null;
  let marcador = null;
  const limparMarcador = () => {
    marcador?.remove();
    marcador = null;
    $$('.coluna-alvo, .coluna-recusa', alvo).forEach((el) => el.classList.remove('coluna-alvo', 'coluna-recusa'));
  };

  alvo.addEventListener('dragstart', (ev) => {
    const card = ev.target.closest('.card');
    const topo = ev.target.closest('[data-arrastar-coluna]');
    if (card && card.draggable) {
      arrastando = { tipo: 'card', id: card.dataset.card, origem: card.closest('[data-lista]').dataset.lista };
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', card.dataset.card);
      requestAnimationFrame(() => card.classList.add('arrastando'));
    } else if (topo && topo.draggable) {
      arrastando = { tipo: 'coluna', id: topo.dataset.arrastarColuna };
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', topo.dataset.arrastarColuna);
      requestAnimationFrame(() => topo.closest('.coluna').classList.add('arrastando'));
    }
  });

  alvo.addEventListener('dragend', () => {
    $$('.arrastando', alvo).forEach((el) => el.classList.remove('arrastando'));
    limparMarcador();
    arrastando = null;
  });

  alvo.addEventListener('dragover', (ev) => {
    if (!arrastando) return;
    if (arrastando.tipo === 'card') {
      const lista = ev.target.closest('[data-lista]') ?? ev.target.closest('.coluna')?.querySelector('[data-lista]');
      // coluna recolhida: aceita a tarefa no fim da lista
      if (!lista) return;
      ev.preventDefault();
      const q = loja.quadro;
      const col = colunaDe(q, lista.dataset.lista);
      const ocupados = q.cards.filter((c) => c.colunaId === col.id && c.id !== arrastando.id).length;
      const recusa = col.id !== arrastando.origem && col.limiteWip && ocupados >= col.limiteWip;
      $$('.coluna-alvo, .coluna-recusa', alvo).forEach((el) => el.classList.remove('coluna-alvo', 'coluna-recusa'));
      lista.closest('.coluna').classList.add(recusa ? 'coluna-recusa' : 'coluna-alvo');
      ev.dataTransfer.dropEffect = recusa ? 'none' : 'move';
      if (!marcador) { marcador = document.createElement('div'); marcador.className = 'marcador'; }
      const { proximo } = indiceDestino(lista, ev.clientY, arrastando.id);
      if (proximo) lista.insertBefore(marcador, proximo);
      else lista.appendChild(marcador);
    } else {
      const coluna = ev.target.closest('.coluna');
      if (!coluna) return;
      ev.preventDefault();
      const r = coluna.getBoundingClientRect();
      if (!marcador) { marcador = document.createElement('div'); marcador.className = 'marcador-coluna'; }
      const quadroEl = coluna.parentElement;
      if (ev.clientX < r.left + r.width / 2) quadroEl.insertBefore(marcador, coluna);
      else quadroEl.insertBefore(marcador, coluna.nextSibling);
    }
  });

  alvo.addEventListener('drop', (ev) => {
    if (!arrastando) return;
    ev.preventDefault();
    if (arrastando.tipo === 'card') {
      const lista = marcador?.parentElement;
      if (lista?.dataset.lista) {
        const proximo = marcador.nextElementSibling?.closest('.card');
        const indice = indiceReal(loja.quadro, lista.dataset.lista, proximo?.dataset.card, arrastando.id);
        executarMovimento(ctx, arrastando.id, lista.dataset.lista, indice);
      }
    } else if (marcador?.parentElement) {
      const ordem = [...marcador.parentElement.children].filter((el) => el.classList.contains('coluna') || el === marcador);
      const semArrastada = ordem.filter((el) => el.dataset.coluna !== arrastando.id);
      const indice = semArrastada.indexOf(marcador);
      loja.alterarQuadro('mover coluna', (q, autor) => { moverColuna(q, arrastando.id, indice, autor); return { ok: true }; });
    }
    limparMarcador();
    arrastando = null;
  });

  alvo.addEventListener('click', async (ev) => {
    const recolher = ev.target.closest('[data-recolher], [data-expandir]');
    if (recolher) {
      const id = recolher.dataset.recolher ?? recolher.dataset.expandir;
      const todas = { ...(loja.estado.preferencias.recolhidas ?? {}) };
      const atual = new Set(todas[loja.quadro.id] ?? []);
      if (recolher.dataset.recolher) atual.add(id); else atual.delete(id);
      todas[loja.quadro.id] = [...atual];
      loja.preferencia('recolhidas', todas);
      return;
    }
    const avancar = ev.target.closest('[data-avancar]');
    const assumir = ev.target.closest('[data-assumir]');
    if (avancar) {
      const q = loja.quadro;
      const c = q.cards.find((x) => x.id === avancar.dataset.avancar);
      const ic = q.colunas.findIndex((x) => x.id === c.colunaId);
      const destino = q.colunas[ic + 1];
      if (destino) executarMovimento(ctx, c.id, destino.id, cardsDaColuna(q, destino.id).length);
      return;
    }
    if (assumir) {
      const eu = ctx.usuarioNome();
      loja.alterarQuadro('assumir tarefa', (q, autor) => {
        const c = q.cards.find((x) => x.id === assumir.dataset.assumir);
        c.responsavel = eu;
        registrar(q, autor, 'atribuiu', `${c.titulo} a ${eu}`, c.id);
        return { ok: true };
      });
      avisar('A tarefa agora é sua.');
      return;
    }
    const card = ev.target.closest('.card');
    const novoCard = ev.target.closest('[data-novo-card]');
    const menu = ev.target.closest('[data-menu-coluna]');
    if (ev.target.closest('[data-nova-coluna]')) {
      const nome = await pedirTexto('Nova coluna', 'Nome da coluna', '', 'Criar');
      if (nome) loja.alterarQuadro('criar coluna', (q, autor) => { adicionarColuna(q, nome, autor); return { ok: true }; });
    } else if (novoCard) {
      abrirNovoCardInline(novoCard, ctx);
    } else if (menu) {
      abrirMenuColuna(menu.dataset.menuColuna, ctx);
    } else if (card) {
      ctx.abrirCard(card.dataset.card);
    }
  });

  alvo.addEventListener('keydown', (ev) => {
    const card = ev.target.closest('.card');
    if (!card) return;
    if (ev.key === 'Enter') { ev.preventDefault(); ctx.abrirCard(card.dataset.card); return; }
    if (!ev.altKey || card.draggable === false) return;
    const q = loja.quadro;
    const atual = q.cards.find((c) => c.id === card.dataset.card);
    const ic = q.colunas.findIndex((c) => c.id === atual.colunaId);
    const lista = cardsDaColuna(q, atual.colunaId);
    const pos = lista.findIndex((c) => c.id === atual.id);
    let destino = null;
    if (ev.key === 'ArrowRight' && ic < q.colunas.length - 1) destino = [q.colunas[ic + 1].id, 0];
    if (ev.key === 'ArrowLeft' && ic > 0) destino = [q.colunas[ic - 1].id, 0];
    if (ev.key === 'ArrowUp' && pos > 0) destino = [atual.colunaId, pos - 1];
    if (ev.key === 'ArrowDown' && pos < lista.length - 1) destino = [atual.colunaId, pos + 1];
    if (!destino) return;
    ev.preventDefault();
    executarMovimento(ctx, atual.id, destino[0], destino[1]);
    requestAnimationFrame(() => $(`[data-card="${atual.id}"]`)?.focus());
  });
};

const abrirNovoCardInline = (botao, ctx) => {
  const colunaId = botao.dataset.novoCard;
  const form = document.createElement('form');
  form.className = 'novo-card';
  form.innerHTML = html`<textarea id="novo-card-${colunaId}" rows="2" placeholder="Título da tarefa" maxlength="200" required aria-describedby="dica-${colunaId}"></textarea><div class="previa" aria-live="polite"></div><p class="dica" id="dica-${colunaId}"><kbd>@</kbd>pessoa <kbd>#</kbd>etiqueta <kbd>!</kbd>alta <kbd>&gt;</kbd>sexta</p><div class="linha"><button class="botao botao-primario pequeno">Adicionar</button><button type="button" class="botao pequeno" data-cancelar>Cancelar</button></div>`;
  botao.replaceWith(form);
  const campo = form.querySelector('textarea');
  campo.focus();
  const cancelar = () => ctx.atualizar();
  form.querySelector('[data-cancelar]').addEventListener('click', cancelar);
  campo.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); form.requestSubmit(); }
    if (ev.key === 'Escape') cancelar();
  });
  const previa = form.querySelector('.previa');
  campo.addEventListener('input', () => {
    const r = interpretarEntrada(campo.value, ctx.loja.quadro);
    const et = r.etiquetas.map((id) => ctx.loja.quadro.etiquetas.find((e) => e.id === id)?.nome);
    previa.innerHTML = html`${r.responsavel ? html`<span class="chip-previa">${icone('usuario')}${r.responsavel}</span>` : ''}${et.map((n) => html`<span class="chip-previa">#${n}</span>`)}${r.prioridade ? html`<span class="chip-previa">${nomePrioridade(r.prioridade)}</span>` : ''}${r.prazo ? html`<span class="chip-previa">${icone('relogio')}${formatarData(r.prazo)}</span>` : ''}${r.avisos.map((a) => html`<span class="chip-previa chip-aviso">${a}</span>`)}`;
  });
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const entrada = interpretarEntrada(campo.value, ctx.loja.quadro);
    const titulo = entrada.titulo;
    if (!titulo) { avisar('Escreva o título da tarefa.', 'alerta'); return; }
    const dados = { colunaId, titulo };
    if (entrada.responsavel) dados.responsavel = entrada.responsavel;
    if (entrada.prioridade) dados.prioridade = entrada.prioridade;
    if (entrada.etiquetas.length) dados.etiquetas = entrada.etiquetas;
    if (entrada.prazo) dados.prazo = entrada.prazo;
    const r = ctx.loja.alterarQuadro('criar tarefa', (q, autor) => adicionarCard(q, dados, autor));
    if (r.ok === false) { avisar(r.erro, 'erro'); return; }
    r.avisos?.forEach((a) => avisar(a));
    requestAnimationFrame(() => $(`[data-novo-card="${colunaId}"]`)?.click());
  });
};

const abrirMenuColuna = (colunaId, ctx) => {
  const { loja } = ctx;
  const col = colunaDe(loja.quadro, colunaId);
  abrirDialogo({
    titulo: `Coluna ${col.nome}`,
    largura: 'pequena',
    corpo: html`<form class="formulario" data-form>
      <label class="campo"><span>Nome</span><input id="coluna-nome" name="nome" value="${col.nome}" required maxlength="60"></label>
      <label class="campo"><span>Tipo da etapa</span><select id="coluna-tipo" name="tipo">${Object.entries(TIPOS).map(([v, n]) => html`<option value="${v}" ${seguro(col.tipo === v ? 'selected' : '')}>${n}</option>`)}</select><small>Etapas “Em andamento” iniciam o cycle time. “Concluído” encerra a tarefa.</small></label>
      <label class="campo"><span>Limite WIP</span><input id="coluna-wip" name="limiteWip" type="number" min="0" max="99" value="${col.limiteWip || 0}"><small>0 deixa a coluna sem limite.</small></label>
      <div class="acoes-dialogo separadas"><button type="button" class="botao botao-perigo" data-excluir>Excluir coluna</button><span><button type="button" class="botao" data-fechar>Cancelar</button> <button class="botao botao-primario">Salvar</button></span></div>
    </form>`,
    aoAbrir: (d, fechar) => {
      d.querySelector('[data-form]').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        loja.alterarQuadro('editar coluna', (q, autor) => {
          const c = colunaDe(q, colunaId);
          c.nome = String(f.get('nome')).trim() || c.nome;
          c.tipo = f.get('tipo');
          c.limiteWip = Math.max(0, Number(f.get('limiteWip')) || 0);
          registrar(q, autor, 'editou coluna', `${c.nome} (WIP ${c.limiteWip || 'livre'})`);
          return { ok: true };
        });
        fechar();
      });
      d.querySelector('[data-excluir]').addEventListener('click', async () => {
        fechar();
        const total = loja.quadro.cards.filter((c) => c.colunaId === colunaId).length;
        const ok = await confirmar('Excluir coluna', `Excluir “${col.nome}”? ${total ? `As ${total} tarefa(s) vão para a coluna anterior.` : ''}`, 'Excluir');
        if (!ok) return;
        const r = loja.alterarQuadro('excluir coluna', (q, autor) => excluirColuna(q, colunaId, autor));
        if (r.ok === false) avisar(r.erro, 'erro');
      });
    }
  });
};
