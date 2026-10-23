import { html, seguro, icone } from './dom.js';
import { atendeFiltro, situacaoPrazo } from '../filtros.js';
import { resumo, temposDeFluxo, vazaoSemanal, porColuna, porResponsavel, porPrioridade, fluxoCumulativo } from '../metricas.js';
import { dataIso, formatarDataHora, nomePrioridade, lerDataLocal } from '../util.js';
import { colunaDe } from '../regras.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export const renderizarCalendario = (alvo, ctx) => {
  const quadro = ctx.loja.quadro;
  const ref = ctx.mesCalendario;
  const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const inicio = new Date(primeiro);
  inicio.setDate(1 - ((primeiro.getDay() + 6) % 7));
  const hoje = dataIso(new Date());
  const cards = quadro.cards.filter((c) => c.prazo && atendeFiltro(quadro, c, ctx.filtro));
  const porDia = new Map();
  cards.forEach((c) => { const k = c.prazo.slice(0, 10); porDia.set(k, [...(porDia.get(k) ?? []), c]); });
  const semPrazo = quadro.cards.filter((c) => !c.prazo && atendeFiltro(quadro, c, ctx.filtro) && colunaDe(quadro, c.colunaId)?.tipo !== 'concluido');
  const celulas = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    const k = dataIso(d);
    const lista = porDia.get(k) ?? [];
    celulas.push(html`<div class="dia ${d.getMonth() !== ref.getMonth() ? 'dia-fora' : ''} ${k === hoje ? 'dia-hoje' : ''}" data-dia="${k}">
      <span class="dia-numero">${d.getDate()}</span>
      ${lista.slice(0, 4).map((c) => html`<button class="evento prazo-${situacaoPrazo(quadro, c)} prioridade-${c.prioridade}" data-card="${c.id}" title="${c.titulo}">${c.titulo}</button>`)}
      ${lista.length > 4 ? html`<span class="discreto">+${lista.length - 4}</span>` : ''}
    </div>`);
  }
  const atrasadas = cards.filter((c) => situacaoPrazo(quadro, c) === 'atrasado');
  alvo.innerHTML = html`<div class="calendario">
    <div class="calendario-topo">
      <button class="botao pequeno" data-mes="-1" aria-label="Mês anterior">‹</button>
      <h2>${MESES[ref.getMonth()]} ${ref.getFullYear()}</h2>
      <button class="botao pequeno" data-mes="1" aria-label="Próximo mês">›</button>
      <button class="botao pequeno" data-mes="0">Hoje</button>
      <p class="resumo-calendario discreto"><span class="${atrasadas.length ? 'com-atraso' : ''}"><strong>${atrasadas.length}</strong> atrasada(s)</span><span><strong>${cards.length}</strong> com prazo</span><span><strong>${semPrazo.length}</strong> pendente(s) sem prazo</span></p>
    </div>
    <div class="grade-mes">${DIAS.map((d) => html`<div class="dia-semana">${d}</div>`)}${celulas}</div>
    ${atrasadas.length ? html`<section class="lista-atrasadas"><h3>Atrasadas</h3><ul>${atrasadas.sort((a, b) => a.prazo.localeCompare(b.prazo)).map((c) => html`<li><button class="link" data-card="${c.id}">${c.titulo}</button> <span class="discreto">venceu em ${lerDataLocal(c.prazo).toLocaleDateString('pt-BR')}, ${c.responsavel || 'sem responsável'}, em ${colunaDe(quadro, c.colunaId)?.nome}</span></li>`)}</ul></section>` : ''}
  </div>`;
  alvo.querySelector('.calendario').addEventListener('click', (ev) => {
    const mes = ev.target.closest('[data-mes]');
    const card = ev.target.closest('[data-card]');
    if (mes) {
      const passo = Number(mes.dataset.mes);
      ctx.mesCalendario = passo === 0 ? new Date() : new Date(ref.getFullYear(), ref.getMonth() + passo, 1);
      renderizarCalendario(alvo, ctx);
    } else if (card) ctx.abrirCard(card.dataset.card);
  });
};

const dias = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(1).replace('.', ',')} d`);

const barrasHorizontais = (itens, max) => html`<ul class="barras">${itens.map((i) => html`<li><span class="barra-rotulo">${i.nome}</span><span class="barra-trilho"><span class="barra ${i.classe ?? ''}" style="width:${max ? Math.max(2, (i.total / max) * 100) : 0}%"></span>${i.limite ? html`<span class="barra-limite" style="left:${Math.min(100, (i.limite / max) * 100)}%" title="Limite WIP"></span>` : ''}</span><span class="barra-valor">${i.texto ?? i.total}</span></li>`)}</ul>`;

const graficoVazao = (baldes) => {
  const largura = 560;
  const altura = 180;
  const margem = { e: 28, d: 8, t: 12, b: 26 };
  const max = Math.max(1, ...baldes.map((b) => b.total));
  const passo = (largura - margem.e - margem.d) / baldes.length;
  const y = (v) => altura - margem.b - (v / max) * (altura - margem.t - margem.b);
  const ticks = [...new Set([0, Math.ceil(max / 2), max])];
  return seguro(`<svg class="grafico" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Tarefas concluídas por semana">
    ${ticks.map((t) => `<line x1="${margem.e}" x2="${largura - margem.d}" y1="${y(t)}" y2="${y(t)}" class="grade-linha"/><text x="${margem.e - 6}" y="${y(t) + 4}" text-anchor="end" class="eixo">${t}</text>`).join('')}
    ${baldes.map((b, i) => {
      const x = margem.e + i * passo + passo * 0.18;
      const w = passo * 0.64;
      const rotulo = b.inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      return `<rect x="${x}" y="${y(b.total)}" width="${w}" height="${Math.max(0, altura - margem.b - y(b.total))}" class="${i === baldes.length - 1 ? 'coluna-grafico atual' : 'coluna-grafico'}"><title>${b.total} concluída(s) na semana de ${rotulo}</title></rect>${b.total ? `<text x="${x + w / 2}" y="${y(b.total) - 4}" text-anchor="middle" class="valor">${b.total}</text>` : ''}<text x="${x + w / 2}" y="${altura - 8}" text-anchor="middle" class="eixo">${rotulo}</text>`;
    }).join('')}
  </svg>`);
};

const graficoFluxo = (quadro, serie) => {
  const largura = 560;
  const altura = 200;
  const margem = { e: 28, d: 8, t: 10, b: 24 };
  const max = Math.max(1, ...serie.map((s) => Object.values(s.contagem).reduce((a, b) => a + b, 0)));
  const x = (i) => margem.e + (i / Math.max(1, serie.length - 1)) * (largura - margem.e - margem.d);
  const y = (v) => altura - margem.b - (v / max) * (altura - margem.t - margem.b);
  const colunas = [...quadro.colunas].reverse();
  const cores = ['var(--grafico-1)', 'var(--grafico-2)', 'var(--grafico-3)', 'var(--grafico-4)', 'var(--grafico-5)', 'var(--grafico-6)', 'var(--grafico-7)'];
  const base = serie.map(() => 0);
  const areas = colunas.map((col, ic) => {
    const topo = serie.map((s, i) => base[i] + (s.contagem[col.id] ?? 0));
    const pontos = [...topo.map((v, i) => `${x(i)},${y(v)}`), ...[...base].reverse().map((v, j) => `${x(serie.length - 1 - j)},${y(v)}`)];
    topo.forEach((v, i) => { base[i] = v; });
    return `<polygon points="${pontos.join(' ')}" fill="${cores[ic % cores.length]}"><title>${col.nome}</title></polygon>`;
  });
  return seguro(`<svg class="grafico" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Fluxo cumulativo dos últimos 14 dias">${areas.join('')}<text x="${margem.e}" y="${altura - 6}" class="eixo">${serie[0].dia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</text><text x="${largura - margem.d}" y="${altura - 6}" text-anchor="end" class="eixo">hoje</text><text x="${margem.e - 6}" y="${y(max) + 4}" text-anchor="end" class="eixo">${max}</text></svg>
  <ul class="legenda">${colunas.map((c, i) => `<li><span style="background:${cores[i % cores.length]}"></span>${html`${c.nome}`}</li>`).reverse().join('')}</ul>`);
};

export const renderizarPainel = (alvo, ctx) => {
  const quadro = ctx.loja.quadro;
  const r = resumo(quadro);
  const t = temposDeFluxo(quadro);
  const vazao = vazaoSemanal(quadro);
  const cols = porColuna(quadro);
  const resp = porResponsavel(quadro);
  const prio = porPrioridade(quadro);
  const media4 = vazao.slice(-4).reduce((s, b) => s + b.total, 0) / 4;
  const taxa = r.total ? Math.round((r.concluidas / r.total) * 100) : 0;
  alvo.innerHTML = html`<div class="painel">
    <section class="indicadores">
      <div class="indicador"><span class="indicador-rotulo">Concluídas</span><strong>${r.concluidas}</strong><span class="discreto">${taxa}% do quadro</span></div>
      <div class="indicador"><span class="indicador-rotulo">Pendentes</span><strong>${r.pendentes}</strong><span class="discreto">${r.andamento} em andamento</span></div>
      <div class="indicador ${r.atrasadas ? 'indicador-alerta' : ''}"><span class="indicador-rotulo">Atrasadas</span><strong>${r.atrasadas}</strong><span class="discreto">prazo vencido</span></div>
      <div class="indicador"><span class="indicador-rotulo">Lead time</span><strong>${dias(t.leadMediano)}</strong><span class="discreto">mediana; média ${dias(t.leadMedio)}</span></div>
      <div class="indicador"><span class="indicador-rotulo">Cycle time</span><strong>${dias(t.cicloMediano)}</strong><span class="discreto">mediana; média ${dias(t.cicloMedio)}</span></div>
      <div class="indicador"><span class="indicador-rotulo">Throughput</span><strong>${media4.toFixed(1).replace('.', ',')}</strong><span class="discreto">tarefas/semana (4 sem.)</span></div>
    </section>
    <section class="cartao-painel largo"><h3>Concluídas por semana</h3>${graficoVazao(vazao)}</section>
    <section class="cartao-painel"><h3>Tarefas por coluna</h3>${barrasHorizontais(cols.map((c) => ({ nome: c.nome, total: c.total, limite: c.limiteWip, classe: c.limiteWip && c.total >= c.limiteWip ? 'barra-cheia' : `barra-${c.tipo}`, texto: c.limiteWip ? `${c.total}/${c.limiteWip}` : c.total })), Math.max(1, ...cols.map((c) => Math.max(c.total, c.limiteWip || 0))))}</section>
    <section class="cartao-painel largo"><h3>Fluxo cumulativo dos últimos 14 dias</h3>${graficoFluxo(quadro, fluxoCumulativo(quadro))}</section>
    <section class="cartao-painel"><h3>Por responsável</h3>${barrasHorizontais(resp.map((p) => ({ nome: p.nome, total: p.total, texto: `${p.concluidas}/${p.total}` })), Math.max(1, ...resp.map((p) => p.total)))}<p class="discreto">concluídas / total</p></section>
    <section class="cartao-painel"><h3>Pendentes por prioridade</h3>${barrasHorizontais(prio.map((p) => ({ nome: nomePrioridade(p.id), total: p.total, classe: `barra-${p.id}` })), Math.max(1, ...prio.map((p) => p.total)))}</section>
    <section class="cartao-painel"><h3>Como ler</h3><dl class="glossario"><dt>Lead time</dt><dd>da criação até a conclusão.</dd><dt>Cycle time</dt><dd>da primeira etapa “em andamento” até a conclusão.</dd><dt>Throughput</dt><dd>tarefas concluídas por semana.</dd></dl><p class="discreto">${t.amostras} tarefa(s) concluída(s) na amostra.</p></section>
  </div>`;
};

export const renderizarHistorico = (alvo, ctx) => {
  const quadro = ctx.loja.quadro;
  const termo = ctx.filtro.texto?.toLowerCase() ?? '';
  const itens = quadro.historico.filter((h) => !termo || `${h.autor} ${h.acao} ${h.detalhe}`.toLowerCase().includes(termo));
  const autores = [...new Set(quadro.historico.map((h) => h.autor))];
  alvo.innerHTML = html`<div class="historico">
    <div class="historico-topo"><h2>Histórico de alterações</h2><span class="discreto">${itens.length} registro(s) de ${autores.length} pessoa(s). O quadro guarda os últimos 500.</span></div>
    <ol class="linha-tempo larga">${itens.map((h) => html`<li><span class="hora">${formatarDataHora(h.em)}</span><span><strong>${h.autor}</strong> ${h.acao}${h.cardId && quadro.cards.some((c) => c.id === h.cardId) ? html` <button class="link" data-card="${h.cardId}">${h.detalhe}</button>` : html` <span class="discreto">${h.detalhe}</span>`}</span></li>`)}</ol>
    ${!itens.length ? html`<p class="discreto">Nenhum registro.</p>` : ''}
  </div>`;
  alvo.querySelector('.historico').addEventListener('click', (ev) => {
    const c = ev.target.closest('[data-card]');
    if (c) ctx.abrirCard(c.dataset.card);
  });
};

export const htmlNotificacoes = (notificacoes) => html`<ul class="notificacoes">${notificacoes.map((n) => html`<li class="${n.lida ? '' : 'nao-lida'}"><button class="link" data-quadro="${n.quadroId}" data-card="${n.cardId ?? ''}">${icone(n.tipo === 'prazo' ? 'relogio' : n.tipo === 'mencao' ? 'balao' : 'usuario')}${n.texto}</button><span class="discreto">${formatarDataHora(n.em)}</span></li>`)}</ul>${!notificacoes.length ? html`<p class="discreto">Nenhuma notificação.</p>` : ''}`;
