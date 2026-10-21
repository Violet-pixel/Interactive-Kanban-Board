import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Loja, CHAVE, LIMITE_DESFAZER } from '../../web/js/estado.js';
import { adicionarCard } from '../../web/js/regras.js';

const memoria = () => {
  const dados = new Map();
  return { getItem: (k) => dados.get(k) ?? null, setItem: (k, v) => dados.set(k, String(v)), removeItem: (k) => dados.delete(k), dados };
};

test('começa com o quadro de demonstração', () => {
  const loja = new Loja(memoria());
  assert.equal(loja.estado.quadros.length, 1);
  assert.ok(loja.quadro.cards.length > 5);
});

test('persiste e recarrega do armazenamento', () => {
  const arm = memoria();
  const loja = new Loja(arm);
  loja.novoQuadro({ nome: 'Persistido', modelo: 'scrum' });
  assert.ok(arm.dados.has(CHAVE));
  const outra = new Loja(arm);
  assert.equal(outra.quadro.nome, 'Persistido');
  assert.equal(outra.quadro.colunas[0].nome, 'Product Backlog');
});

test('desfazer e refazer', () => {
  const loja = new Loja(memoria());
  const antes = loja.quadro.cards.length;
  loja.alterarQuadro('criar tarefa', (q, autor) => adicionarCard(q, { titulo: 'Nova' }, autor));
  assert.equal(loja.quadro.cards.length, antes + 1);
  assert.equal(loja.desfazer(), 'criar tarefa');
  assert.equal(loja.quadro.cards.length, antes);
  assert.equal(loja.refazer(), 'criar tarefa');
  assert.equal(loja.quadro.cards.length, antes + 1);
  assert.equal(loja.refazer(), null);
});

test('nova alteração limpa o refazer e o histórico tem limite', () => {
  const loja = new Loja(memoria());
  loja.alterarQuadro('a', (q, autor) => adicionarCard(q, { titulo: 'A' }, autor));
  loja.desfazer();
  loja.alterarQuadro('b', (q, autor) => adicionarCard(q, { titulo: 'B' }, autor));
  assert.equal(loja.podeRefazer, false);
  for (let i = 0; i < LIMITE_DESFAZER + 10; i += 1) loja.alterarQuadro('x', (q, autor) => adicionarCard(q, { titulo: `T${i}`, colunaId: q.colunas[0].id }, autor));
  assert.equal(loja.pilhaDesfazer.length, LIMITE_DESFAZER);
});

test('alteração recusada não entra no histórico', () => {
  const loja = new Loja(memoria());
  const r = loja.alterarQuadro('falha', () => ({ ok: false, erro: 'não' }));
  assert.equal(r.ok, false);
  assert.equal(loja.podeDesfazer, false);
});

test('duplicar, arquivar e excluir quadros', () => {
  const loja = new Loja(memoria());
  const original = loja.quadro;
  loja.duplicarQuadro(original.id);
  assert.equal(loja.quadro.nome, `${original.nome} (cópia)`);
  assert.equal(loja.quadro.cards.length, original.cards.length);
  const copia = loja.quadro.id;
  loja.arquivarQuadro(copia);
  assert.equal(loja.quadro.id, original.id);
  loja.excluirQuadro(copia);
  assert.equal(loja.estado.quadros.length, 1);
  loja.desfazer();
  assert.equal(loja.estado.quadros.length, 2);
});

test('armazenamento corrompido volta ao estado inicial', () => {
  const arm = memoria();
  arm.setItem(CHAVE, '{quebrado');
  const loja = new Loja(arm);
  assert.equal(loja.estado.quadros.length, 1);
});
