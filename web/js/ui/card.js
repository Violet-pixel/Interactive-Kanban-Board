import { html, seguro, icone, avisar, abrirDialogo, confirmar, lerArquivoUrl } from './dom.js';
import { cardDe, colunaDe, editarCard, moverCard, excluirCard, duplicarCard, criaCiclo, registrar, progressoSubtarefas, dependenciasPendentes, estaConcluido } from '../regras.js';
import { responsaveisDo, situacaoPrazo } from '../filtros.js';
import { PRIORIDADES, uid, agora, formatarDataHora, formatarBytes, CORES_ETIQUETA } from '../util.js';
import { pode } from '../permissoes.js';
import { iniciais } from './quadro.js';

const LIMITE_ANEXO_LOCAL = 2 * 1024 * 1024;

const realcarMencoes = (texto) => html`${texto}`.valor.replace(/@([\p{L}\p{N}_.-]+)/gu, '<span class="mencao">@$1</span>');

const corpoCard = (quadro, card, papel) => {
  const podeEditar = pode(papel, 'tarefas');
  const podeComentar = pode(papel, 'comentar');
  const des = seguro(podeEditar ? '' : 'disabled');
  const prog = progressoSubtarefas(card);
  const deps = (card.dependencias ?? []).map((id) => cardDe(quadro, id)).filter(Boolean);
  const candidatos = quadro.cards.filter((c) => c.id !== card.id && !card.dependencias?.includes(c.id));
  const historico = quadro.historico.filter((h) => h.cardId === card.id).slice(0, 30);
  const prazo = situacaoPrazo(quadro, card);
  return html`<div class="card-detalhe">
    <div class="card-principal">
      <label class="campo"><span>Título</span><input id="cd-titulo" data-campo="titulo" value="${card.titulo}" maxlength="200" ${des}></label>
      <label class="campo"><span>Descrição</span><textarea id="cd-descricao" data-campo="descricao" rows="4" maxlength="5000" placeholder="Detalhes, critérios de aceite, links…" ${des}>${card.descricao}</textarea></label>

      <section class="bloco">
        <div class="bloco-topo"><h3>Subtarefas</h3><span class="discreto">${prog.feitas}/${prog.total}</span></div>
        ${prog.total ? html`<div class="progresso grande"><span style="width:${prog.percentual}%"></span></div>` : ''}
        <ul class="subtarefas">${card.subtarefas.map((s) => html`<li><label><input type="checkbox" data-sub="${s.id}" ${seguro(s.feito ? 'checked' : '')} ${des}><span class="${s.feito ? 'feito' : ''}">${s.texto}</span></label>${podeEditar ? html`<button class="botao-icone pequeno" data-remover-sub="${s.id}" aria-label="Remover subtarefa">${icone('fechar')}</button>` : ''}</li>`)}</ul>
        ${podeEditar ? html`<form class="linha-form" data-form-sub><input id="cd-nova-sub" placeholder="Nova subtarefa" maxlength="200"><button class="botao pequeno">Adicionar</button></form>` : ''}
      </section>

      <section class="bloco">
        <div class="bloco-topo"><h3>Dependências</h3><span class="discreto">esta tarefa depende de</span></div>
        <ul class="dependencias">${deps.map((d) => html`<li class="${estaConcluido(quadro, d) ? 'dep-ok' : 'dep-pendente'}"><span>${estaConcluido(quadro, d) ? '✓' : '•'} ${d.titulo}</span><span class="discreto">${colunaDe(quadro, d.colunaId)?.nome}</span>${podeEditar ? html`<button class="botao-icone pequeno" data-remover-dep="${d.id}" aria-label="Remover dependência">${icone('fechar')}</button>` : ''}</li>`)}</ul>
        ${!deps.length ? html`<p class="discreto">Nenhuma dependência.</p>` : ''}
        ${podeEditar && candidatos.length ? html`<div class="linha-form"><select id="cd-nova-dep"><option value="">Escolha uma tarefa…</option>${candidatos.map((c) => html`<option value="${c.id}">${c.titulo}</option>`)}</select><button class="botao pequeno" data-adicionar-dep>Vincular</button></div>` : ''}
      </section>

      <section class="bloco">
        <div class="bloco-topo"><h3>Anexos</h3><span class="discreto">${card.anexos.length}</span></div>
        <ul class="anexos">${card.anexos.map((a) => html`<li>${a.tipo?.startsWith('image/') && (a.dados || a.url) ? html`<img src="${a.dados || a.url}" alt="">` : html`<span class="anexo-tipo">${(a.nome.split('.').pop() || 'arq').slice(0, 4)}</span>`}<a href="${a.dados || a.url}" download="${a.nome}" target="_blank" rel="noopener">${a.nome}</a><span class="discreto">${formatarBytes(a.tamanho)}</span>${podeEditar ? html`<button class="botao-icone pequeno" data-remover-anexo="${a.id}" aria-label="Remover anexo">${icone('fechar')}</button>` : ''}</li>`)}</ul>
        ${podeEditar ? html`<label class="botao pequeno arquivo">${icone('clipe')}Anexar arquivo<input type="file" id="cd-anexo" multiple hidden></label>` : ''}
      </section>

      <section class="bloco">
        <div class="bloco-topo"><h3>Comentários</h3><span class="discreto">use @nome para mencionar</span></div>
        <ul class="comentarios">${[...card.comentarios].reverse().map((c) => html`<li><span class="avatar">${iniciais(c.autor)}</span><div><p class="comentario-topo"><strong>${c.autor}</strong> <span class="discreto">${formatarDataHora(c.em)}</span></p><p>${seguro(realcarMencoes(c.texto))}</p></div></li>`)}</ul>
        ${podeComentar ? html`<form class="formulario" data-form-comentario><textarea id="cd-comentario" rows="2" maxlength="2000" placeholder="Escreva um comentário"></textarea><div><button class="botao pequeno botao-primario">Comentar</button></div></form>` : ''}
      </section>

      <section class="bloco">
        <div class="bloco-topo"><h3>Histórico da tarefa</h3></div>
        <ol class="linha-tempo">${historico.map((h) => html`<li><strong>${h.autor}</strong> ${h.acao} <span class="discreto">· ${formatarDataHora(h.em)}</span><br><span class="discreto">${h.detalhe}</span></li>`)}</ol>
      </section>
    </div>

    <aside class="card-lateral">
      <label class="campo"><span>Status</span><select id="cd-coluna" data-coluna ${des}>${quadro.colunas.map((c) => html`<option value="${c.id}" ${seguro(c.id === card.colunaId ? 'selected' : '')}>${c.nome}</option>`)}</select></label>
      <label class="campo"><span>Responsável</span><input id="cd-responsavel" data-campo="responsavel" list="lista-responsaveis" value="${card.responsavel}" maxlength="80" placeholder="Ninguém" ${des}><datalist id="lista-responsaveis">${responsaveisDo(quadro).map((n) => html`<option value="${n}"></option>`)}</datalist></label>
      <label class="campo"><span>Prioridade</span><select id="cd-prioridade" data-campo="prioridade" ${des}>${PRIORIDADES.map((p) => html`<option value="${p.id}" ${seguro(p.id === card.prioridade ? 'selected' : '')}>${p.nome}</option>`)}</select></label>
      <label class="campo"><span>Início</span><input id="cd-inicio" type="date" data-campo="inicio" value="${card.inicio}" ${des}></label>
      <label class="campo"><span>Prazo ${prazo === 'atrasado' ? html`<em class="texto-alerta">atrasada</em>` : ''}</span><input id="cd-prazo" type="date" data-campo="prazo" value="${card.prazo}" ${des}></label>
      <div class="campo"><span>Etiquetas</span>
        <div class="etiquetas-escolha">${quadro.etiquetas.map((e) => html`<button type="button" class="etiqueta ${card.etiquetas.includes(e.id) ? 'ativa' : 'inativa'}" style="--cor:${e.cor}" data-etiqueta="${e.id}" ${des}>${e.nome}</button>`)}</div>
        ${pode(papel, 'configurar') ? html`<form class="linha-form" data-form-etiqueta><input id="cd-nova-etiqueta" placeholder="Nova etiqueta" maxlength="30"><select id="cd-cor-etiqueta" aria-label="Cor">${CORES_ETIQUETA.map((c) => html`<option value="${c}">${c}</option>`)}</select><button class="botao pequeno">Criar</button></form>` : ''}
      </div>
      <dl class="datas">
        <dt>Criada</dt><dd>${formatarDataHora(card.criadoEm)}</dd>
        ${card.iniciadoEm ? html`<dt>Iniciada</dt><dd>${formatarDataHora(card.iniciadoEm)}</dd>` : ''}
        ${card.concluidoEm ? html`<dt>Concluída</dt><dd>${formatarDataHora(card.concluidoEm)}</dd>` : ''}
      </dl>
      ${podeEditar ? html`<div class="acoes-card"><button class="botao" data-duplicar>Duplicar</button><button class="botao botao-perigo" data-excluir>Excluir</button></div>` : ''}
    </aside>
  </div>`;
};

export const abrirCard = (cardId, ctx) => {
  const { loja, api } = ctx;
  let dialogoAtual = null;
  const alterar = (descricao, fn) => {
    const r = loja.alterarQuadro(descricao, fn);
    if (r?.ok === false) avisar(r.erro, 'erro');
    else r?.avisos?.forEach((a) => avisar(a));
    desenhar();
    return r;
  };
  const desenhar = () => {
    const quadro = loja.quadro;
    const card = cardDe(quadro, cardId);
    if (!card || !dialogoAtual) { dialogoAtual?.close(); return; }
    const corpo = dialogoAtual.querySelector('.dialogo-corpo');
    const rolagem = corpo.scrollTop;
    corpo.innerHTML = corpoCard(quadro, card, ctx.papel());
    corpo.scrollTop = rolagem;
    dialogoAtual.querySelector('h2').textContent = card.titulo;
  };
  const quadro = loja.quadro;
  const card = cardDe(quadro, cardId);
  if (!card) return;
  abrirDialogo({
    titulo: card.titulo,
    largura: 'grande',
    corpo: corpoCard(quadro, card, ctx.papel()),
    aoFechar: () => { dialogoAtual = null; },
    aoAbrir: (d, fechar) => {
      dialogoAtual = d;
      const corpo = d.querySelector('.dialogo-corpo');
      corpo.addEventListener('change', async (ev) => {
        const alvo = ev.target;
        if (alvo.dataset.campo) {
          const valor = alvo.dataset.campo === 'titulo' ? alvo.value.trim() || 'Sem título' : alvo.value.trim();
          alterar('editar tarefa', (q, autor) => editarCard(q, cardId, { [alvo.dataset.campo]: valor }, autor));
        } else if (alvo.hasAttribute('data-coluna')) {
          alterar('mover tarefa', (q, autor) => moverCard(q, cardId, alvo.value, undefined, autor));
        } else if (alvo.dataset.sub) {
          alterar('marcar subtarefa', (q, autor) => {
            const c = cardDe(q, cardId);
            const s = c.subtarefas.find((x) => x.id === alvo.dataset.sub);
            s.feito = alvo.checked;
            registrar(q, autor, s.feito ? 'concluiu subtarefa' : 'reabriu subtarefa', `${s.texto} (${c.titulo})`, cardId);
            return { ok: true };
          });
        } else if (alvo.id === 'cd-anexo' && alvo.files.length) {
          await anexar([...alvo.files]);
        }
      });
      const anexar = async (arquivos) => {
        for (const arquivo of arquivos) {
          try {
            let anexo;
            if (api?.conectado && ctx.modoServidor()) {
              const r = await api.enviarAnexo(loja.quadro.id, cardId, arquivo);
              anexo = { id: r.id, nome: r.nome, tipo: r.tipo, tamanho: r.tamanho, url: r.url, em: agora() };
            } else {
              if (arquivo.size > LIMITE_ANEXO_LOCAL) { avisar(`${arquivo.name} passa de 2 MB. Use o modo servidor para arquivos maiores.`, 'erro'); continue; }
              anexo = { id: uid('anx'), nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size, dados: await lerArquivoUrl(arquivo), em: agora() };
            }
            alterar('anexar arquivo', (q, autor) => {
              const c = cardDe(q, cardId);
              c.anexos.push(anexo);
              registrar(q, autor, 'anexou', `${anexo.nome} em ${c.titulo}`, cardId);
              return { ok: true };
            });
          } catch (erro) {
            avisar(`Não foi possível anexar ${arquivo.name}: ${erro.message}`, 'erro');
          }
        }
      };
      corpo.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const form = ev.target;
        if (form.hasAttribute('data-form-sub')) {
          const texto = form.querySelector('input').value.trim();
          if (!texto) return;
          alterar('adicionar subtarefa', (q, autor) => {
            const c = cardDe(q, cardId);
            c.subtarefas.push({ id: uid('sub'), texto, feito: false });
            registrar(q, autor, 'adicionou subtarefa', `${texto} (${c.titulo})`, cardId);
            return { ok: true };
          });
          d.querySelector('#cd-nova-sub')?.focus();
        } else if (form.hasAttribute('data-form-comentario')) {
          const texto = form.querySelector('textarea').value.trim();
          if (!texto) return;
          alterar('comentar', (q, autor) => {
            const c = cardDe(q, cardId);
            c.comentarios.push({ id: uid('cmt'), autor, texto, em: agora() });
            registrar(q, autor, 'comentou', c.titulo, cardId);
            return { ok: true };
          });
        } else if (form.hasAttribute('data-form-etiqueta')) {
          const nome = form.querySelector('input').value.trim();
          const cor = form.querySelector('select').value;
          if (!nome) return;
          alterar('criar etiqueta', (q, autor) => {
            const e = { id: uid('etq'), nome, cor };
            q.etiquetas.push(e);
            cardDe(q, cardId).etiquetas.push(e.id);
            registrar(q, autor, 'criou etiqueta', nome);
            return { ok: true };
          });
        }
      });
      corpo.addEventListener('click', async (ev) => {
        const b = ev.target.closest('button');
        if (!b) return;
        if (b.dataset.etiqueta) {
          alterar('alterar etiqueta', (q, autor) => {
            const c = cardDe(q, cardId);
            const lista = c.etiquetas.includes(b.dataset.etiqueta) ? c.etiquetas.filter((x) => x !== b.dataset.etiqueta) : [...c.etiquetas, b.dataset.etiqueta];
            return editarCard(q, cardId, { etiquetas: lista }, autor);
          });
        } else if (b.dataset.removerSub) {
          alterar('remover subtarefa', (q, autor) => {
            const c = cardDe(q, cardId);
            c.subtarefas = c.subtarefas.filter((s) => s.id !== b.dataset.removerSub);
            registrar(q, autor, 'removeu subtarefa', c.titulo, cardId);
            return { ok: true };
          });
        } else if (b.dataset.removerDep) {
          alterar('remover dependência', (q, autor) => {
            const c = cardDe(q, cardId);
            return editarCard(q, cardId, { dependencias: c.dependencias.filter((x) => x !== b.dataset.removerDep) }, autor);
          });
        } else if (b.hasAttribute('data-adicionar-dep')) {
          const escolha = d.querySelector('#cd-nova-dep').value;
          if (!escolha) return;
          if (criaCiclo(loja.quadro, cardId, escolha)) { avisar('Essa dependência criaria um ciclo entre as tarefas.', 'erro'); return; }
          alterar('adicionar dependência', (q, autor) => {
            const c = cardDe(q, cardId);
            return editarCard(q, cardId, { dependencias: [...(c.dependencias ?? []), escolha] }, autor);
          });
          const pend = dependenciasPendentes(loja.quadro, cardDe(loja.quadro, cardId));
          if (pend.length) avisar('A tarefa só avança depois que as dependências forem concluídas.', 'alerta');
        } else if (b.dataset.removerAnexo) {
          alterar('remover anexo', (q, autor) => {
            const c = cardDe(q, cardId);
            const a = c.anexos.find((x) => x.id === b.dataset.removerAnexo);
            c.anexos = c.anexos.filter((x) => x.id !== b.dataset.removerAnexo);
            registrar(q, autor, 'removeu anexo', `${a?.nome} de ${c.titulo}`, cardId);
            return { ok: true };
          });
        } else if (b.hasAttribute('data-duplicar')) {
          const r = alterar('duplicar tarefa', (q, autor) => duplicarCard(q, cardId, autor));
          if (r.ok) { fechar(); avisar('Tarefa duplicada.'); }
        } else if (b.hasAttribute('data-excluir')) {
          const titulo = cardDe(loja.quadro, cardId)?.titulo;
          fechar();
          if (await confirmar('Excluir tarefa', `Excluir “${titulo}”? Você pode desfazer com Ctrl+Z.`, 'Excluir')) {
            loja.alterarQuadro('excluir tarefa', (q, autor) => excluirCard(q, cardId, autor));
            avisar('Tarefa excluída.');
          }
        }
      });
      corpo.addEventListener('dragover', (ev) => { if (ev.dataTransfer?.types.includes('Files')) ev.preventDefault(); });
      corpo.addEventListener('drop', (ev) => {
        if (!ev.dataTransfer?.files.length || !pode(ctx.papel(), 'tarefas')) return;
        ev.preventDefault();
        anexar([...ev.dataTransfer.files]);
      });
    }
  });
};
