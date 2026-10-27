import { html, icone, $ } from './dom.js';
import { normalizar } from '../util.js';

// Paleta de comandos (Ctrl+K): ir para qualquer tarefa, quadro, vista ou ação digitando parte do nome.
export const abrirComandos = (ctx, acoes) => {
  const { loja } = ctx;
  const dialogo = $('#dialogo');
  if (dialogo.open) dialogo.close();
  const itens = () => [
    ...['quadro', 'lista', 'calendario', 'painel', 'historico'].map((v, i) => ({ tipo: 'Vista', nome: { quadro: 'Quadro', lista: 'Lista', calendario: 'Calendário', painel: 'Painel', historico: 'Histórico' }[v], atalho: String(i + 1), fazer: () => ctx.irPara(v) })),
    { tipo: 'Ação', nome: 'Nova tarefa', atalho: 'N', fazer: () => { ctx.irPara('quadro'); requestAnimationFrame(() => $('[data-novo-card]')?.click()); } },
    { tipo: 'Ação', nome: 'Minhas tarefas', atalho: 'M', fazer: () => { ctx.filtro.responsavel = ctx.usuarioNome(); ctx.atualizar(); } },
    { tipo: 'Ação', nome: 'Novo quadro', fazer: () => acoes['novo-quadro']() },
    { tipo: 'Ação', nome: 'Exportar e importar', fazer: () => acoes.dados() },
    { tipo: 'Ação', nome: 'Trocar o tema', fazer: () => acoes.tema() },
    { tipo: 'Ação', nome: 'Atalhos de teclado', atalho: '?', fazer: () => acoes.atalhos() },
    ...loja.estado.quadros.filter((q) => !q.arquivado).map((q) => ({ tipo: 'Quadro', nome: q.nome, fazer: () => { loja.selecionarQuadro(q.id); ctx.atualizar(); } })),
    ...loja.quadro.cards.map((c) => ({ tipo: 'Tarefa', nome: c.titulo, detalhe: [loja.quadro.colunas.find((x) => x.id === c.colunaId)?.nome, c.responsavel].filter(Boolean).join(', '), fazer: () => ctx.abrirCard(c.id) }))
  ];
  dialogo.className = 'dialogo dialogo-pequena comandos';
  dialogo.innerHTML = html`<label class="comandos-busca">${icone('raio')}<input type="text" placeholder="Ir para tarefa, quadro, vista ou ação" aria-label="Comando" autocomplete="off"></label><ul class="comandos-lista" role="listbox"></ul><p class="comandos-dica"><kbd>↑</kbd><kbd>↓</kbd> escolher <kbd>Enter</kbd> abrir <kbd>Esc</kbd> fechar</p>`;
  const campo = dialogo.querySelector('input');
  const lista = dialogo.querySelector('ul');
  let atual = [];
  let cursor = 0;
  const desenhar = () => {
    const termo = normalizar(campo.value);
    atual = itens().filter((i) => !termo || normalizar(`${i.nome} ${i.tipo} ${i.detalhe ?? ''}`).includes(termo)).slice(0, 9);
    cursor = Math.min(cursor, Math.max(0, atual.length - 1));
    lista.innerHTML = atual.length ? html`${atual.map((i, k) => html`<li role="option" aria-selected="${k === cursor ? 'true' : 'false'}" data-i="${k}"><span class="tipo">${i.tipo}</span><span class="nome">${i.nome}${i.detalhe ? html`<small>${i.detalhe}</small>` : ''}</span>${i.atalho ? html`<kbd>${i.atalho}</kbd>` : ''}</li>`)}` : html`<li class="vazio">Nada encontrado.</li>`;
  };
  const executar = (i) => { dialogo.close(); setTimeout(() => i?.fazer(), 0); };
  campo.addEventListener('input', () => { cursor = 0; desenhar(); });
  campo.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); cursor = Math.min(atual.length - 1, cursor + 1); desenhar(); }
    if (ev.key === 'ArrowUp') { ev.preventDefault(); cursor = Math.max(0, cursor - 1); desenhar(); }
    if (ev.key === 'Enter') { ev.preventDefault(); executar(atual[cursor]); }
  });
  lista.addEventListener('click', (ev) => { const li = ev.target.closest('[data-i]'); if (li) executar(atual[Number(li.dataset.i)]); });
  dialogo.onclick = (ev) => { if (ev.target === dialogo) dialogo.close(); };
  dialogo.onclose = () => { dialogo.innerHTML = ''; };
  desenhar();
  dialogo.showModal();
  campo.focus();
};
