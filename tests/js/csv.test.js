import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarQuadro } from '../../web/js/modelos.js';
import { adicionarCard } from '../../web/js/regras.js';
import { paraCsv, lerCsv, importarCsv, paraJson, lerJson } from '../../web/js/csv.js';

test('exporta CSV com aspas e quebras de linha', () => {
  const q = criarQuadro({ nome: 'C' });
  adicionarCard(q, { titulo: 'Título, com vírgula', descricao: 'linha 1\nlinha "2"', etiquetas: [q.etiquetas[0].id] }, 'Ana');
  const csv = paraCsv(q);
  const [linha] = lerCsv(csv);
  assert.equal(linha.titulo, 'Título, com vírgula');
  assert.equal(linha.descricao, 'linha 1\nlinha "2"');
  assert.equal(linha.etiquetas, q.etiquetas[0].nome);
  assert.equal(linha.coluna, 'Backlog');
});

test('lê CSV com ponto e vírgula e BOM', () => {
  const linhas = lerCsv('﻿Título;Coluna\nA;Done\n');
  assert.deepEqual(linhas, [{ titulo: 'A', coluna: 'Done' }]);
});

test('importa CSV criando colunas, etiquetas e dependências', () => {
  const q = criarQuadro({ nome: 'I' });
  const texto = 'id,titulo,coluna,prioridade,etiquetas,prazo,dependencias\n1,Base,Done,alta,Bug|Nova,2026-11-01,\n2,Filha,Homologação,urgente,,,1\n';
  assert.equal(importarCsv(q, texto, 'Ana'), 2);
  const filha = q.cards.find((c) => c.titulo === 'Filha');
  const base = q.cards.find((c) => c.titulo === 'Base');
  assert.ok(q.colunas.some((c) => c.nome === 'Homologação'));
  assert.ok(q.etiquetas.some((e) => e.nome === 'Nova'));
  assert.deepEqual(filha.dependencias, [base.id]);
  assert.ok(base.concluidoEm);
  assert.equal(filha.prioridade, 'urgente');
});

test('JSON de ida e volta gera novos ids', () => {
  const q = criarQuadro({ nome: 'J' });
  const [copia] = lerJson(paraJson([q]));
  assert.equal(copia.nome, 'J');
  assert.notEqual(copia.id, q.id);
  assert.throws(() => lerJson('{"outra":1}'), /quadros do Prumo/);
});
