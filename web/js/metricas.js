import { diasEntre, media, mediana, inicioDoDia } from './util.js';
import { estaConcluido, colunaDe } from './regras.js';
import { situacaoPrazo } from './filtros.js';

export const inicioDaSemana = (data) => {
  const d = inicioDoDia(data);
  const dia = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dia);
  return d;
};

export const resumo = (quadro, hoje = new Date()) => {
  const total = quadro.cards.length;
  const concluidas = quadro.cards.filter((c) => estaConcluido(quadro, c)).length;
  const atrasadas = quadro.cards.filter((c) => situacaoPrazo(quadro, c, hoje) === 'atrasado').length;
  const andamento = quadro.cards.filter((c) => colunaDe(quadro, c.colunaId)?.tipo === 'andamento').length;
  return { total, concluidas, pendentes: total - concluidas, atrasadas, andamento };
};

export const temposDeFluxo = (quadro) => {
  const feitos = quadro.cards.filter((c) => estaConcluido(quadro, c) && c.concluidoEm);
  const lead = feitos.map((c) => diasEntre(c.criadoEm, c.concluidoEm)).filter((v) => v !== null && v >= 0);
  const ciclo = feitos.map((c) => diasEntre(c.iniciadoEm ?? c.criadoEm, c.concluidoEm)).filter((v) => v !== null && v >= 0);
  return {
    leadMedio: media(lead),
    leadMediano: mediana(lead),
    cicloMedio: media(ciclo),
    cicloMediano: mediana(ciclo),
    amostras: feitos.length
  };
};

export const vazaoSemanal = (quadro, semanas = 8, hoje = new Date()) => {
  const fim = inicioDaSemana(hoje);
  const baldes = [];
  for (let i = semanas - 1; i >= 0; i -= 1) {
    const inicio = new Date(fim);
    inicio.setDate(inicio.getDate() - i * 7);
    baldes.push({ inicio, total: 0 });
  }
  quadro.cards.forEach((c) => {
    if (!c.concluidoEm || !estaConcluido(quadro, c)) return;
    const semana = inicioDaSemana(c.concluidoEm).getTime();
    const balde = baldes.find((b) => b.inicio.getTime() === semana);
    if (balde) balde.total += 1;
  });
  return baldes;
};

export const porColuna = (quadro) => quadro.colunas.map((col) => ({
  id: col.id,
  nome: col.nome,
  tipo: col.tipo,
  limiteWip: col.limiteWip,
  total: quadro.cards.filter((c) => c.colunaId === col.id).length
}));

export const porResponsavel = (quadro) => {
  const mapa = new Map();
  quadro.cards.forEach((c) => {
    const nome = c.responsavel || 'Sem responsável';
    const item = mapa.get(nome) ?? { nome, total: 0, concluidas: 0 };
    item.total += 1;
    if (estaConcluido(quadro, c)) item.concluidas += 1;
    mapa.set(nome, item);
  });
  return [...mapa.values()].sort((a, b) => b.total - a.total);
};

export const porPrioridade = (quadro) => ['urgente', 'alta', 'media', 'baixa'].map((p) => ({
  id: p,
  total: quadro.cards.filter((c) => c.prioridade === p && !estaConcluido(quadro, c)).length
}));

export const fluxoCumulativo = (quadro, dias = 14, hoje = new Date()) => {
  const resultado = [];
  const base = inicioDoDia(hoje);
  for (let i = dias - 1; i >= 0; i -= 1) {
    const dia = new Date(base);
    dia.setDate(dia.getDate() - i);
    const limite = new Date(dia);
    limite.setDate(limite.getDate() + 1);
    const contagem = Object.fromEntries(quadro.colunas.map((c) => [c.id, 0]));
    quadro.cards.forEach((card) => {
      if (new Date(card.criadoEm) >= limite) return;
      const movs = (card.movimentos ?? []).filter((m) => new Date(m.em) < limite);
      const coluna = movs.length ? movs.at(-1).para : (card.movimentos?.[0]?.de ?? card.colunaId);
      if (coluna in contagem) contagem[coluna] += 1;
    });
    resultado.push({ dia, contagem });
  }
  return resultado;
};
