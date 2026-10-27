import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarEntrada, lerPrazo } from '../../web/js/entrada.js';
import { atendeFiltro, diasNaColuna, FILTRO_VAZIO } from '../../web/js/filtros.js';

const quadro = {
  colunas: [{ id: 'a', nome: 'A fazer', tipo: 'espera' }, { id: 'f', nome: 'Feito', tipo: 'concluido' }],
  etiquetas: [{ id: 'e1', nome: 'Bug', cor: '#000' }, { id: 'e2', nome: 'Nova função', cor: '#000' }],
  membros: [{ nome: 'Ana Souza' }, { nome: 'Bruno Lima' }],
  cards: []
};
const quarta = new Date(2026, 9, 21, 10); // quarta-feira, 21/10/2026

test('adição rápida separa título, responsável, etiqueta, prioridade e prazo', () => {
  const r = interpretarEntrada('Corrigir login @ana #bug !alta >sexta', quadro, quarta);
  assert.equal(r.titulo, 'Corrigir login');
  assert.equal(r.responsavel, 'Ana Souza');
  assert.deepEqual(r.etiquetas, ['e1']);
  assert.equal(r.prioridade, 'alta');
  assert.equal(r.prazo, '2026-10-23');
  assert.deepEqual(r.avisos, []);
});

test('etiqueta com hífen, prioridade abreviada e nome inexistente vira aviso', () => {
  const r = interpretarEntrada('Tela nova #nova-funcao !u @zeca', quadro, quarta);
  assert.deepEqual(r.etiquetas, ['e2']);
  assert.equal(r.prioridade, 'urgente');
  assert.equal(r.responsavel, '');
  assert.equal(r.avisos.length, 1);
  assert.equal(r.titulo, 'Tela nova');
});

test('prazos: hoje, amanhã, +N, dia da semana e data', () => {
  assert.equal(lerPrazo('hoje', quarta), '2026-10-21');
  assert.equal(lerPrazo('amanhã', quarta), '2026-10-22');
  assert.equal(lerPrazo('+10', quarta), '2026-10-31');
  assert.equal(lerPrazo('qua', quarta), '2026-10-28');
  assert.equal(lerPrazo('15/11', quarta), '2026-11-15');
  assert.equal(lerPrazo('10/01', quarta), '2027-01-10');
  assert.equal(lerPrazo('31/02', quarta), null);
});

test('dias na coluna e filtros de bloqueadas e paradas', () => {
  const q = structuredClone(quadro);
  q.cards = [
    { id: 'c1', colunaId: 'a', titulo: 'Antiga', etiquetas: [], criadoEm: '2026-10-01T10:00:00', movimentos: [], dependencias: ['c2'] },
    { id: 'c2', colunaId: 'a', titulo: 'Nova', etiquetas: [], criadoEm: '2026-10-20T10:00:00', movimentos: [], dependencias: [] },
    { id: 'c3', colunaId: 'f', titulo: 'Feita', etiquetas: [], criadoEm: '2026-09-01T10:00:00', movimentos: [{ de: 'a', para: 'f', em: '2026-09-02T10:00:00' }], dependencias: [] }
  ];
  assert.equal(diasNaColuna(q.cards[0], quarta), 20);
  assert.equal(diasNaColuna(q.cards[2], quarta), 49);
  const parada = { ...FILTRO_VAZIO, parada: '5' };
  assert.deepEqual(q.cards.filter((c) => atendeFiltro(q, c, parada, quarta)).map((c) => c.id), ['c1']);
  const bloqueadas = { ...FILTRO_VAZIO, bloqueio: 'bloqueadas' };
  assert.deepEqual(q.cards.filter((c) => atendeFiltro(q, c, bloqueadas, quarta)).map((c) => c.id), ['c1']);
});
