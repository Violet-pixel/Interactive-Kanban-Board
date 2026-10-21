import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarQuadro } from '../../web/js/modelos.js';
import { adicionarCard, moverCard, excedeWip, criaCiclo, excluirCard, excluirColuna, adicionarColuna, moverColuna, cardsDaColuna, duplicarCard, editarCard, mencionou, progressoSubtarefas } from '../../web/js/regras.js';

const novo = () => criarQuadro({ nome: 'Teste', modelo: 'kanban' });

test('cria tarefa na primeira coluna e registra no histórico', () => {
  const q = novo();
  const r = adicionarCard(q, { titulo: 'Escrever testes' }, 'Ana');
  assert.equal(r.ok, true);
  assert.equal(r.card.colunaId, q.colunas[0].id);
  assert.equal(q.historico[0].acao, 'criou');
  assert.equal(q.historico[0].autor, 'Ana');
});

test('move entre colunas, marca início e conclusão', () => {
  const q = novo();
  const { card } = adicionarCard(q, { titulo: 'A' }, 'Ana');
  moverCard(q, card.id, q.colunas[2].id, 0, 'Ana');
  assert.ok(card.iniciadoEm);
  assert.equal(card.concluidoEm, null);
  moverCard(q, card.id, q.colunas[4].id, 0, 'Ana');
  assert.ok(card.concluidoEm);
  assert.equal(card.movimentos.length, 2);
  moverCard(q, card.id, q.colunas[1].id, 0, 'Ana');
  assert.equal(card.concluidoEm, null);
});

test('reordena dentro da coluna', () => {
  const q = novo();
  const ids = ['A', 'B', 'C'].map((t) => adicionarCard(q, { titulo: t }, 'Ana').card.id);
  moverCard(q, ids[2], q.colunas[0].id, 0, 'Ana');
  assert.deepEqual(cardsDaColuna(q, q.colunas[0].id).map((c) => c.titulo), ['C', 'A', 'B']);
});

test('respeita o limite WIP', () => {
  const q = novo();
  const andamento = q.colunas[2];
  andamento.limiteWip = 1;
  const a = adicionarCard(q, { titulo: 'A' }, 'Ana').card;
  const b = adicionarCard(q, { titulo: 'B' }, 'Ana').card;
  assert.equal(moverCard(q, a.id, andamento.id, 0, 'Ana').ok, true);
  assert.equal(excedeWip(q, andamento.id), true);
  const r = moverCard(q, b.id, andamento.id, 0, 'Ana');
  assert.equal(r.ok, false);
  assert.match(r.erro, /limite WIP/);
  assert.equal(moverCard(q, a.id, andamento.id, 0, 'Ana').ok, true);
});

test('bloqueia ou avisa sobre dependências', () => {
  const q = novo();
  const base = adicionarCard(q, { titulo: 'Base' }, 'Ana').card;
  const filha = adicionarCard(q, { titulo: 'Filha', dependencias: [base.id] }, 'Ana').card;
  assert.equal(moverCard(q, filha.id, q.colunas[1].id, 0, 'Ana').ok, true);
  const bloqueio = moverCard(q, filha.id, q.colunas[2].id, 0, 'Ana');
  assert.equal(bloqueio.ok, false);
  q.bloquearDependencias = false;
  const aviso = moverCard(q, filha.id, q.colunas[2].id, 0, 'Ana');
  assert.equal(aviso.ok, true);
  assert.match(aviso.avisos[0], /depende de: Base/);
});

test('detecta ciclos de dependência', () => {
  const q = novo();
  const a = adicionarCard(q, { titulo: 'A' }, 'Ana').card;
  const b = adicionarCard(q, { titulo: 'B', dependencias: [a.id] }, 'Ana').card;
  assert.equal(criaCiclo(q, a.id, b.id), true);
  assert.equal(criaCiclo(q, b.id, a.id), false);
  assert.equal(criaCiclo(q, a.id, a.id), true);
});

test('automação atribui, prioriza e move em cadeia', () => {
  const q = novo();
  const [, todo, andamento, revisao] = q.colunas;
  q.automacoes = [
    { id: '1', nome: 'Atribuir', ativa: true, gatilho: { tipo: 'entrar', colunaId: andamento.id }, acao: { tipo: 'atribuir', valor: 'Bruno' } },
    { id: '2', nome: 'Urgente', ativa: true, gatilho: { tipo: 'criar', colunaId: todo.id }, acao: { tipo: 'prioridade', valor: 'urgente' } },
    { id: '3', nome: 'Pular', ativa: true, gatilho: { tipo: 'entrar', colunaId: andamento.id }, acao: { tipo: 'mover', valor: revisao.id } },
    { id: '4', nome: 'Pausada', ativa: false, gatilho: { tipo: 'entrar', colunaId: revisao.id }, acao: { tipo: 'atribuir', valor: 'Ninguém' } }
  ];
  const { card } = adicionarCard(q, { titulo: 'X', colunaId: todo.id }, 'Ana');
  assert.equal(card.prioridade, 'urgente');
  moverCard(q, card.id, andamento.id, 0, 'Ana');
  assert.equal(card.responsavel, 'Bruno');
  assert.equal(card.colunaId, revisao.id);
  assert.ok(q.historico.some((h) => h.autor === 'Automação'));
});

test('excluir tarefa remove dependências apontando para ela', () => {
  const q = novo();
  const a = adicionarCard(q, { titulo: 'A' }, 'Ana').card;
  const b = adicionarCard(q, { titulo: 'B', dependencias: [a.id] }, 'Ana').card;
  excluirCard(q, a.id, 'Ana');
  assert.deepEqual(b.dependencias, []);
});

test('colunas: criar antes de Done, mover e excluir levando tarefas', () => {
  const q = novo();
  const col = adicionarColuna(q, 'QA', 'Ana');
  assert.equal(q.colunas.at(-2).id, col.id);
  moverColuna(q, col.id, 0, 'Ana');
  assert.equal(q.colunas[0].id, col.id);
  adicionarCard(q, { titulo: 'T', colunaId: col.id }, 'Ana');
  const r = excluirColuna(q, col.id, 'Ana');
  assert.equal(r.ok, true);
  assert.equal(q.cards[0].colunaId, q.colunas[0].id);
});

test('duplicar e editar tarefa', () => {
  const q = novo();
  const a = adicionarCard(q, { titulo: 'A', subtarefas: [{ id: 's', texto: 'x', feito: true }] }, 'Ana').card;
  const copia = duplicarCard(q, a.id, 'Ana').card;
  assert.equal(copia.titulo, 'A (cópia)');
  assert.notEqual(copia.subtarefas[0].id, 's');
  const r = editarCard(q, a.id, { titulo: 'Novo', prioridade: 'media' }, 'Ana');
  assert.deepEqual(r.alterados, ['titulo']);
  assert.deepEqual(progressoSubtarefas(a), { total: 1, feitas: 1, percentual: 100 });
});

test('menções por primeiro nome ou nome completo', () => {
  assert.equal(mencionou('Oi @ana, veja isso', 'Ana Souza'), true);
  assert.equal(mencionou('@AnaSouza pronto', 'Ana Souza'), true);
  assert.equal(mencionou('@bruno', 'Ana Souza'), false);
});
