import { html, seguro, icone, avisar, abrirDialogo, confirmar, baixarArquivo, lerArquivoTexto, corExibida, nomeCor } from './dom.js';
import { MODELOS } from '../modelos.js';
import { DESCRICOES_ACAO, registrar, colunaDe } from '../regras.js';
import { PRIORIDADES, uid, dataIso, CORES_ETIQUETA, nomePrioridade } from '../util.js';
import { paraCsv, paraJson, importarCsv, lerJson } from '../csv.js';
import { PAPEIS, pode, nomePapel } from '../permissoes.js';

export const dialogoNovoQuadro = (ctx) => {
  abrirDialogo({
    titulo: 'Novo quadro',
    corpo: html`<form class="formulario" data-form>
      <label class="campo"><span>Nome</span><input id="nq-nome" name="nome" required maxlength="80" placeholder="Ex.: Sprint 14"></label>
      <label class="campo"><span>Descrição</span><input id="nq-descricao" name="descricao" maxlength="200"></label>
      <fieldset class="modelos"><legend>Modelo</legend>${Object.entries(MODELOS).map(([id, m], i) => html`<label class="modelo"><input type="radio" name="modelo" value="${id}" ${seguro(i === 0 ? 'checked' : '')}><span><strong>${m.nome}</strong><small>${m.descricao}</small></span></label>`)}</fieldset>
      <label class="campo"><span>Cor</span><select id="nq-cor" name="cor">${CORES_ETIQUETA.map((c) => html`<option value="${c}">${nomeCor(c)}</option>`)}</select></label>
      <div class="acoes-dialogo"><button type="button" class="botao" data-fechar>Cancelar</button><button class="botao botao-primario">Criar quadro</button></div>
    </form>`,
    aoAbrir: (d, fechar) => {
      d.querySelector('#nq-nome').focus();
      d.querySelector('[data-form]').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        ctx.loja.novoQuadro({ nome: f.get('nome'), descricao: f.get('descricao'), modelo: f.get('modelo'), cor: f.get('cor') });
        fechar();
        avisar('Quadro criado.');
      });
    }
  });
};

export const dialogoEditarQuadro = (ctx) => {
  const q = ctx.loja.quadro;
  const podeExcluir = pode(ctx.papel(), 'excluir_quadro');
  abrirDialogo({
    titulo: 'Configurar quadro',
    corpo: html`<form class="formulario" data-form>
      <label class="campo"><span>Nome</span><input id="eq-nome" name="nome" value="${q.nome}" required maxlength="80"></label>
      <label class="campo"><span>Descrição</span><textarea id="eq-descricao" name="descricao" rows="2" maxlength="200">${q.descricao}</textarea></label>
      <label class="campo"><span>Cor</span><select id="eq-cor" name="cor">${CORES_ETIQUETA.map((c) => html`<option value="${c}" ${seguro(c === q.cor ? 'selected' : '')}>${nomeCor(c)}</option>`)}</select></label>
      <label class="opcao"><input type="checkbox" id="eq-bloquear" name="bloquear" ${seguro(q.bloquearDependencias ? 'checked' : '')}><span>Impedir que tarefas avancem antes das dependências serem concluídas (desmarcado: só avisa)</span></label>
      <section class="bloco"><div class="bloco-topo"><h3>Etiquetas</h3></div>
        <ul class="lista-edicao">${q.etiquetas.map((e) => html`<li><span class="etiqueta ativa" style="--cor:${corExibida(e.cor)}">${e.nome}</span><select data-cor-etiqueta="${e.id}" aria-label="Cor de ${e.nome}">${CORES_ETIQUETA.map((c) => html`<option value="${c}" ${seguro(c === e.cor ? 'selected' : '')}>${nomeCor(c)}</option>`)}</select><button type="button" class="botao-icone pequeno" data-excluir-etiqueta="${e.id}" aria-label="Excluir ${e.nome}">${icone('fechar')}</button></li>`)}</ul>
      </section>
      <div class="acoes-dialogo separadas">
        <span>${podeExcluir ? html`<button type="button" class="botao botao-perigo" data-excluir>Excluir quadro</button>` : ''} <button type="button" class="botao" data-duplicar>Duplicar</button> <button type="button" class="botao" data-arquivar>${q.arquivado ? 'Restaurar' : 'Arquivar'}</button></span>
        <span><button type="button" class="botao" data-fechar>Cancelar</button> <button class="botao botao-primario">Salvar</button></span>
      </div>
    </form>`,
    aoAbrir: (d, fechar) => {
      const { loja } = ctx;
      d.querySelector('[data-form]').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const cores = Object.fromEntries([...d.querySelectorAll('[data-cor-etiqueta]')].map((s) => [s.dataset.corEtiqueta, s.value]));
        loja.alterarQuadro('editar quadro', (quadro, autor) => {
          quadro.nome = String(f.get('nome')).trim() || quadro.nome;
          quadro.descricao = String(f.get('descricao')).trim();
          quadro.cor = f.get('cor');
          quadro.bloquearDependencias = f.get('bloquear') === 'on';
          quadro.etiquetas.forEach((e) => { if (cores[e.id]) e.cor = cores[e.id]; });
          registrar(quadro, autor, 'editou o quadro', quadro.nome);
          return { ok: true };
        });
        fechar();
      });
      d.addEventListener('click', async (ev) => {
        const b = ev.target.closest('button');
        if (!b) return;
        if (b.dataset.excluirEtiqueta) {
          loja.alterarQuadro('excluir etiqueta', (quadro, autor) => {
            const e = quadro.etiquetas.find((x) => x.id === b.dataset.excluirEtiqueta);
            quadro.etiquetas = quadro.etiquetas.filter((x) => x.id !== e.id);
            quadro.cards.forEach((c) => { c.etiquetas = c.etiquetas.filter((x) => x !== e.id); });
            registrar(quadro, autor, 'excluiu etiqueta', e.nome);
            return { ok: true };
          });
          b.closest('li').remove();
        } else if (b.hasAttribute('data-duplicar')) {
          loja.duplicarQuadro(q.id); fechar(); avisar('Quadro duplicado.');
        } else if (b.hasAttribute('data-arquivar')) {
          loja.arquivarQuadro(q.id, !q.arquivado); fechar(); avisar(q.arquivado ? 'Quadro arquivado.' : 'Quadro restaurado.');
        } else if (b.hasAttribute('data-excluir')) {
          fechar();
          if (await confirmar('Excluir quadro', `Excluir “${q.nome}” e todas as ${q.cards.length} tarefas? Você pode desfazer com Ctrl+Z enquanto esta aba estiver aberta.`, 'Excluir quadro')) {
            if (ctx.modoServidor() && ctx.api.conectado) await ctx.api.excluirQuadro(q.id).catch((e) => avisar(e.message, 'erro'));
            loja.excluirQuadro(q.id);
          }
        }
      });
    }
  });
};

const descreverRegra = (q, r) => {
  const col = r.gatilho.colunaId ? colunaDe(q, r.gatilho.colunaId)?.nome : 'qualquer coluna';
  const quando = r.gatilho.tipo === 'criar' ? `Quando uma tarefa for criada em ${col}` : `Quando uma tarefa entrar em ${col}`;
  let valor = r.acao.valor;
  if (r.acao.tipo === 'mover') valor = colunaDe(q, valor)?.nome;
  if (r.acao.tipo === 'etiqueta') valor = q.etiquetas.find((e) => e.id === valor)?.nome;
  if (r.acao.tipo === 'prioridade') valor = nomePrioridade(valor);
  if (r.acao.tipo === 'prazo_dias') valor = `${valor} dia(s)`;
  return `${quando}, ${DESCRICOES_ACAO[r.acao.tipo]}${valor ? ` ${valor}` : ''}.`;
};

export const dialogoAutomacoes = (ctx) => {
  const desenhar = () => {
    const q = ctx.loja.quadro;
    return html`<div class="automacoes">
      <ul class="lista-regras">${q.automacoes.map((r) => html`<li><label class="interruptor"><input type="checkbox" data-ativa="${r.id}" ${seguro(r.ativa !== false ? 'checked' : '')}><span></span></label><div><strong>${r.nome}</strong><p class="discreto">${descreverRegra(q, r)}</p></div><button class="botao-icone pequeno" data-excluir-regra="${r.id}" aria-label="Excluir regra">${icone('fechar')}</button></li>`)}</ul>
      ${!q.automacoes.length ? html`<p class="discreto">Nenhuma regra ainda. Crie a primeira abaixo.</p>` : ''}
      <form class="formulario nova-regra" data-form>
        <h3>Nova regra</h3>
        <label class="campo"><span>Nome</span><input id="ar-nome" name="nome" required maxlength="60" placeholder="Ex.: Review vai para o QA"></label>
        <div class="linha-campos">
          <label class="campo"><span>Quando a tarefa</span><select id="ar-evento" name="evento"><option value="entrar">entrar na coluna</option><option value="criar">for criada na coluna</option></select></label>
          <label class="campo"><span>Coluna</span><select id="ar-coluna" name="coluna"><option value="">Qualquer</option>${q.colunas.map((c) => html`<option value="${c.id}">${c.nome}</option>`)}</select></label>
        </div>
        <div class="linha-campos">
          <label class="campo"><span>Então</span><select id="ar-acao" name="acao">${Object.entries(DESCRICOES_ACAO).map(([v, n]) => html`<option value="${v}">${n}</option>`)}</select></label>
          <label class="campo" data-valor><span>Valor</span><span id="ar-valor-caixa"></span></label>
        </div>
        <div class="acoes-dialogo"><button class="botao botao-primario">Criar regra</button></div>
      </form>
    </div>`;
  };
  const campoValor = (q, acao) => {
    if (acao === 'atribuir') return html`<input id="ar-valor" name="valor" required maxlength="80" list="ar-pessoas"><datalist id="ar-pessoas">${(q.membros ?? []).map((m) => html`<option value="${m.nome}"></option>`)}</datalist>`;
    if (acao === 'prioridade') return html`<select id="ar-valor" name="valor">${PRIORIDADES.map((p) => html`<option value="${p.id}">${p.nome}</option>`)}</select>`;
    if (acao === 'etiqueta') return html`<select id="ar-valor" name="valor">${q.etiquetas.map((e) => html`<option value="${e.id}">${e.nome}</option>`)}</select>`;
    if (acao === 'mover') return html`<select id="ar-valor" name="valor">${q.colunas.map((c) => html`<option value="${c.id}">${c.nome}</option>`)}</select>`;
    if (acao === 'prazo_dias') return html`<input id="ar-valor" name="valor" type="number" min="0" max="365" value="3">`;
    return html`<input id="ar-valor" name="valor" value="" disabled placeholder="Sem valor">`;
  };
  abrirDialogo({
    titulo: 'Automações',
    corpo: desenhar(),
    aoAbrir: (d) => {
      const corpo = d.querySelector('.dialogo-corpo');
      const atualizarValor = () => { const s = d.querySelector('#ar-acao'); d.querySelector('#ar-valor-caixa').innerHTML = campoValor(ctx.loja.quadro, s.value); };
      const redesenhar = () => { corpo.innerHTML = desenhar(); atualizarValor(); };
      atualizarValor();
      corpo.addEventListener('change', (ev) => {
        if (ev.target.id === 'ar-acao') atualizarValor();
        if (ev.target.dataset.ativa) {
          ctx.loja.alterarQuadro('alternar automação', (q, autor) => {
            const r = q.automacoes.find((x) => x.id === ev.target.dataset.ativa);
            r.ativa = ev.target.checked;
            registrar(q, autor, r.ativa ? 'ativou automação' : 'pausou automação', r.nome);
            return { ok: true };
          });
        }
      });
      corpo.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-excluir-regra]');
        if (!b) return;
        ctx.loja.alterarQuadro('excluir automação', (q, autor) => {
          const r = q.automacoes.find((x) => x.id === b.dataset.excluirRegra);
          q.automacoes = q.automacoes.filter((x) => x.id !== r.id);
          registrar(q, autor, 'excluiu automação', r.nome);
          return { ok: true };
        });
        redesenhar();
      });
      corpo.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const regra = { id: uid('aut'), nome: String(f.get('nome')).trim(), ativa: true, gatilho: { tipo: f.get('evento'), colunaId: f.get('coluna') || null }, acao: { tipo: f.get('acao'), valor: f.get('valor') ?? '' } };
        if (regra.acao.tipo === 'mover' && regra.acao.valor === regra.gatilho.colunaId) { avisar('A regra moveria a tarefa para a mesma coluna.', 'erro'); return; }
        ctx.loja.alterarQuadro('criar automação', (q, autor) => {
          q.automacoes.push(regra);
          registrar(q, autor, 'criou automação', regra.nome);
          return { ok: true };
        });
        redesenhar();
        avisar('Regra criada.');
      });
    }
  });
};

export const dialogoMembros = (ctx) => {
  const desenhar = () => {
    const q = ctx.loja.quadro;
    const servidor = ctx.modoServidor();
    return html`<div class="membros">
      <p class="discreto">${servidor ? 'No servidor, o papel de cada pessoa controla o que ela pode fazer neste quadro. Informe o e-mail de uma conta existente.' : 'No modo local, os membros servem para atribuições e menções. Os papéis passam a valer quando o quadro estiver no servidor.'}</p>
      <ul class="lista-edicao">${(q.membros ?? []).map((m, i) => html`<li><span class="avatar">${m.nome.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span><span class="membro-nome">${m.nome}${m.email ? html` <small class="discreto">${m.email}</small>` : ''}</span><select data-papel="${i}">${PAPEIS.map((p) => html`<option value="${p.id}" ${seguro(p.id === m.papel ? 'selected' : '')}>${p.nome}</option>`)}</select><button class="botao-icone pequeno" data-remover-membro="${i}" aria-label="Remover ${m.nome}">${icone('fechar')}</button></li>`)}</ul>
      <form class="linha-form" data-form><input id="mb-nome" name="nome" required maxlength="80" placeholder="${servidor ? 'E-mail da conta' : 'Nome da pessoa'}"><select id="mb-papel" name="papel">${PAPEIS.map((p) => html`<option value="${p.id}" ${seguro(p.id === 'membro' ? 'selected' : '')}>${p.nome}</option>`)}</select><button class="botao pequeno botao-primario">Adicionar</button></form>
    </div>`;
  };
  abrirDialogo({
    titulo: 'Membros e permissões',
    corpo: desenhar(),
    aoAbrir: (d) => {
      const corpo = d.querySelector('.dialogo-corpo');
      const redesenhar = () => { corpo.innerHTML = desenhar(); };
      const sincronizar = async (email, papel) => {
        if (!ctx.modoServidor() || !ctx.api.conectado || !email) return true;
        try { await ctx.api.definirMembro(ctx.loja.quadro.id, email, papel); return true; } catch (e) { avisar(e.message, 'erro'); return false; }
      };
      corpo.addEventListener('change', async (ev) => {
        if (ev.target.dataset.papel === undefined) return;
        const i = Number(ev.target.dataset.papel);
        const m = ctx.loja.quadro.membros[i];
        if (!(await sincronizar(m.email, ev.target.value))) { redesenhar(); return; }
        ctx.loja.alterarQuadro('alterar papel', (q, autor) => { q.membros[i].papel = ev.target.value; registrar(q, autor, 'alterou papel', `${m.nome}: ${nomePapel(ev.target.value)}`); return { ok: true }; });
      });
      corpo.addEventListener('click', async (ev) => {
        const b = ev.target.closest('[data-remover-membro]');
        if (!b) return;
        const i = Number(b.dataset.removerMembro);
        const m = ctx.loja.quadro.membros[i];
        if (!(await sincronizar(m.email, 'remover'))) return;
        ctx.loja.alterarQuadro('remover membro', (q, autor) => { q.membros.splice(i, 1); registrar(q, autor, 'removeu membro', m.nome); return { ok: true }; });
        redesenhar();
      });
      corpo.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const valor = String(f.get('nome')).trim();
        const papel = f.get('papel');
        const servidor = ctx.modoServidor() && ctx.api.conectado;
        let membro = { nome: valor, papel };
        if (servidor) {
          try { const r = await ctx.api.definirMembro(ctx.loja.quadro.id, valor, papel); membro = { nome: r.nome, email: r.email, papel }; } catch (e) { avisar(e.message, 'erro'); return; }
        }
        ctx.loja.alterarQuadro('adicionar membro', (q, autor) => {
          q.membros = (q.membros ?? []).filter((m) => (membro.email ? m.email !== membro.email : m.nome !== membro.nome));
          q.membros.push(membro);
          registrar(q, autor, 'adicionou membro', `${membro.nome} (${nomePapel(papel)})`);
          return { ok: true };
        });
        redesenhar();
      });
    }
  });
};

export const dialogoDados = (ctx) => {
  const q = ctx.loja.quadro;
  const podeImportar = pode(ctx.papel(), 'importar');
  abrirDialogo({
    titulo: 'Exportar e importar',
    corpo: html`<div class="dados">
      <section class="bloco"><h3>Exportar</h3><div class="grade-botoes">
        <button class="botao" data-exportar="json-quadro">Este quadro em JSON</button>
        <button class="botao" data-exportar="csv">Tarefas deste quadro em CSV</button>
        <button class="botao" data-exportar="json-tudo">Todos os quadros em JSON</button>
      </div><p class="discreto">O CSV usa vírgula, UTF-8 e abre no Excel, LibreOffice e Google Planilhas.</p></section>
      ${podeImportar ? html`<section class="bloco"><h3>Importar</h3>
        <label class="botao arquivo">Escolher arquivo JSON ou CSV<input type="file" id="dados-arquivo" accept=".json,.csv,text/csv,application/json" hidden></label>
        <p class="discreto">JSON cria novos quadros. CSV adiciona as tarefas em “${q.nome}”, criando colunas e etiquetas que faltarem. Colunas aceitas: titulo, coluna, descricao, responsavel, prioridade, etiquetas (separadas por |), prazo (AAAA-MM-DD).</p>
      </section>` : ''}
    </div>`,
    aoAbrir: (d, fechar) => {
      const nomeBase = q.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'quadro';
      d.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-exportar]');
        if (!b) return;
        const dia = dataIso(new Date());
        if (b.dataset.exportar === 'csv') baixarArquivo(`${nomeBase}-${dia}.csv`, `﻿${paraCsv(q)}`, 'text/csv;charset=utf-8');
        if (b.dataset.exportar === 'json-quadro') baixarArquivo(`${nomeBase}-${dia}.json`, paraJson([q]), 'application/json');
        if (b.dataset.exportar === 'json-tudo') baixarArquivo(`prumo-${dia}.json`, paraJson(ctx.loja.estado.quadros), 'application/json');
      });
      d.querySelector('#dados-arquivo')?.addEventListener('change', async (ev) => {
        const arquivo = ev.target.files[0];
        if (!arquivo) return;
        try {
          const texto = await lerArquivoTexto(arquivo);
          if (/\.json$/i.test(arquivo.name) || texto.trim().startsWith('{') || texto.trim().startsWith('[')) {
            const quadros = lerJson(texto);
            ctx.loja.alterar('importar JSON', (e) => { e.quadros.push(...quadros); e.quadroAtivo = quadros[0].id; return { ok: true }; });
            avisar(`${quadros.length} quadro(s) importado(s).`);
          } else {
            let total = 0;
            ctx.loja.alterarQuadro('importar CSV', (quadro, autor) => { total = importarCsv(quadro, texto, autor); return { ok: true }; });
            avisar(total ? `${total} tarefa(s) importada(s).` : 'Nenhuma tarefa encontrada no CSV.', total ? 'info' : 'alerta');
          }
          fechar();
        } catch (erro) {
          avisar(`Não foi possível importar: ${erro.message}`, 'erro');
        }
      });
    }
  });
};

export const dialogoConta = (ctx) => {
  const { loja, api } = ctx;
  const servidor = ctx.servidorDisponivel;
  const usuario = loja.estado.usuario;
  abrirDialogo({
    titulo: 'Conta e sincronização',
    corpo: html`<div class="conta">
      ${api.conectado ? html`<section class="bloco"><h3>Conectado ao servidor</h3><p>${api.sessao.usuario.nome} <span class="discreto">${api.sessao.usuario.email}</span></p><p class="discreto">As alterações são salvas no banco de dados e aparecem na hora para quem estiver com o mesmo quadro aberto.</p><div class="grade-botoes"><button class="botao" data-publicar>Enviar “${loja.quadro.nome}” para o servidor</button><button class="botao" data-recarregar>Baixar quadros do servidor</button><button class="botao botao-perigo" data-sair>Sair</button></div></section>`
        : html`<section class="bloco"><h3>Modo local</h3><p class="discreto">Tudo fica salvo neste navegador (localStorage). ${servidor ? 'O servidor está disponível: entre para salvar no banco e colaborar em tempo real.' : 'Nenhum servidor encontrado neste endereço. Rode o projeto com Docker para usar banco de dados e colaboração.'}</p>
          <form class="formulario" data-form-local><label class="campo"><span>Seu nome (aparece no histórico e nos comentários)</span><input id="ct-nome" name="nome" value="${usuario.nome}" required maxlength="80"></label><label class="campo"><span>Papel neste navegador</span><select id="ct-papel" name="papel">${PAPEIS.map((p) => html`<option value="${p.id}" ${seguro(p.id === usuario.papel ? 'selected' : '')}>${p.nome}</option>`)}</select></label><div><button class="botao">Salvar</button></div></form>
          ${servidor ? html`<form class="formulario" data-form-entrar><h3>Entrar no servidor</h3><label class="campo"><span>E-mail</span><input id="ct-email" name="email" type="email" required autocomplete="username"></label><label class="campo"><span>Senha</span><input id="ct-senha" name="senha" type="password" required autocomplete="current-password"></label><div><button class="botao botao-primario">Entrar</button></div></form>` : ''}
        </section>`}
    </div>`,
    aoAbrir: (d, fechar) => {
      d.querySelector('[data-form-local]')?.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        loja.definirUsuario({ nome: String(f.get('nome')).trim(), papel: f.get('papel') });
        fechar();
        avisar('Perfil atualizado.');
      });
      d.querySelector('[data-form-entrar]')?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        try {
          await api.entrar(f.get('email'), f.get('senha'));
          fechar();
          await ctx.aoConectar();
        } catch (erro) {
          avisar(erro.status === 401 ? 'E-mail ou senha incorretos.' : erro.message, 'erro');
        }
      });
      d.addEventListener('click', async (ev) => {
        if (ev.target.closest('[data-sair]')) { await api.sair(); fechar(); ctx.aoDesconectar(); }
        if (ev.target.closest('[data-publicar]')) { fechar(); await ctx.publicarQuadro(); }
        if (ev.target.closest('[data-recarregar]')) { fechar(); await ctx.aoConectar(); }
      });
    }
  });
};

export const dialogoAtalhos = () => abrirDialogo({
  titulo: 'Atalhos de teclado',
  largura: 'pequena',
  corpo: html`<dl class="atalhos">
    <dt><kbd>Ctrl</kbd> + <kbd>Z</kbd></dt><dd>Desfazer</dd>
    <dt><kbd>Ctrl</kbd> + <kbd>Y</kbd> ou <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd></dt><dd>Refazer</dd>
    <dt><kbd>/</kbd></dt><dd>Buscar</dd>
    <dt><kbd>N</kbd></dt><dd>Nova tarefa na primeira coluna</dd>
    <dt><kbd>1</kbd> a <kbd>4</kbd></dt><dd>Quadro, calendário, painel e histórico</dd>
    <dt><kbd>Enter</kbd></dt><dd>Abrir a tarefa em foco</dd>
    <dt><kbd>Alt</kbd> + <kbd>←</kbd> <kbd>→</kbd></dt><dd>Mover a tarefa em foco entre colunas</dd>
    <dt><kbd>Alt</kbd> + <kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Mudar a ordem na coluna</dd>
    <dt><kbd>?</kbd></dt><dd>Esta lista</dd>
  </dl>`
});
