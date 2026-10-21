import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarQuadro } from '../../web/js/modelos.js';
import { novoCard } from '../../web/js/regras.js';
import { resumo, temposDeFluxo, vazaoSemanal, porResponsavel, inicioDaSemana, fluxoCumulativo } from '../../web/js/metricas.js';
import { filtrarCards, situacaoPrazo } from '../../web/js/filtros.js';
import { gerarNotificacoes } from '../../web/js/notificacoes.js';

const HOJE = new Date(2026, 9, 21, 12);
const quadro = () => {
  const q = criarQuadro({ nome: 'M' });
  const [backlog, , andamento, , feito] = q.colunas;
  const c = (dados) => ({ ...novoCard(dados), ...dados });
  q.cards = [
    c({ titulo: 'Feito 1', colunaId: feito.id, responsavel: 'Ana', criadoEm: '2026-10-01T10:00:00Z', iniciadoEm: '2026-10-05T10:00:00Z', concluidoEm: '2026-10-11T10:00:00Z' }),
    c({ titulo: 'Feito 2', colunaId: feito.id, responsavel: 'Bruno', criadoEm: '2026-10-10T10:00:00Z', iniciadoEm: '2026-10-12T10:00:00Z', concluidoEm: '2026-10-20T10:00:00Z' }),
    c({ titulo: 'Atrasado', colunaId: andamento.id, responsavel: 'Ana', prazo: '2026-10-19', prioridade: 'alta' }),
    c({ titulo: 'Hoje', colunaId: backlog.id, prazo: '2026-10-21', etiquetas: [q.etiquetas[0].id] }),
    c({ titulo: 'Sem prazo', colunaId: backlog.id, descricao: 'Revisar relatório' })
  ];
  return q;
};

test('resumo conta concluídas, pendentes e atrasadas', () => {
  assert.deepEqual(resumo(quadro(), HOJE), { total: 5, concluidas: 2, pendentes: 3, atrasadas: 1, andamento: 1 });
});

test('lead time e cycle time', () => {
  const t = temposDeFluxo(quadro());
  assert.equal(t.leadMedio, 10);
  assert.equal(t.cicloMedio, 7);
  assert.equal(t.cicloMediano, 7);
  assert.equal(t.amostras, 2);
});

test('throughput semanal agrupa por segunda-feira', () => {
  const v = vazaoSemanal(quadro(), 4, HOJE);
  assert.equal(v.length, 4);
  assert.equal(inicioDaSemana(HOJE).getDay(), 1);
  assert.deepEqual(v.map((b) => b.total), [0, 1, 0, 1]);
});

test('por responsável', () => {
  const r = porResponsavel(quadro());
  assert.deepEqual(r.find((x) => x.nome === 'Ana'), { nome: 'Ana', total: 2, concluidas: 1 });
});

test('fluxo cumulativo cobre todos os dias', () => {
  const f = fluxoCumulativo(quadro(), 7, HOJE);
  assert.equal(f.length, 7);
});

test('filtros combinam texto, responsável, etiqueta e prazo', () => {
  const q = quadro();
  assert.deepEqual(filtrarCards(q, { texto: 'relatorio' }, HOJE).map((c) => c.titulo), ['Sem prazo']);
  assert.deepEqual(filtrarCards(q, { responsavel: 'ana', prazo: 'atrasado' }, HOJE).map((c) => c.titulo), ['Atrasado']);
  assert.deepEqual(filtrarCards(q, { etiqueta: q.etiquetas[0].id }, HOJE).map((c) => c.titulo), ['Hoje']);
  assert.deepEqual(filtrarCards(q, { prazo: 'semana' }, HOJE).map((c) => c.titulo), ['Hoje']);
  assert.equal(filtrarCards(q, { responsavel: '__sem__' }, HOJE).length, 2);
  assert.equal(situacaoPrazo(q, q.cards[0], HOJE), 'sem');
});

test('notificações de prazo e menção', () => {
  const q = quadro();
  q.cards[4].comentarios = [{ id: 'm1', autor: 'Bruno', texto: '@Ana pode revisar?', em: '2026-10-21T09:00:00Z' }];
  const n = gerarNotificacoes([q], { nome: 'Ana' }, HOJE);
  assert.ok(n.some((x) => x.tipo === 'prazo' && x.texto.includes('Atrasado')));
  assert.ok(n.some((x) => x.tipo === 'mencao'));
});
