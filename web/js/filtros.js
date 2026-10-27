import { normalizar, inicioDoDia, lerDataLocal } from './util.js';
import { estaConcluido, dependenciasPendentes } from './regras.js';

export const FILTRO_VAZIO = { texto: '', responsavel: '', etiqueta: '', prioridade: '', prazo: '', colunaId: '', bloqueio: '', parada: '' };

/** Dias desde que a tarefa entrou na coluna atual (ou desde que foi criada). */
export const diasNaColuna = (card, hoje = new Date()) => {
  const ultimo = [...(card.movimentos ?? [])].reverse().find((m) => m.para === card.colunaId);
  const desde = ultimo?.em ?? card.criadoEm;
  if (!desde) return 0;
  return Math.max(0, Math.floor((inicioDoDia(hoje) - inicioDoDia(desde)) / 86400000));
};

export const situacaoPrazo = (quadro, card, hoje = new Date()) => {
  if (!card.prazo) return 'sem';
  if (estaConcluido(quadro, card)) return 'concluido';
  const prazo = lerDataLocal(card.prazo);
  const base = inicioDoDia(hoje);
  const dias = Math.round((prazo - base) / 86400000);
  if (dias < 0) return 'atrasado';
  if (dias === 0) return 'hoje';
  if (dias <= 7) return 'semana';
  return 'futuro';
};

export const filtroAtivo = (filtro) => Object.values(filtro).some(Boolean);

export const atendeFiltro = (quadro, card, filtro, hoje = new Date()) => {
  if (filtro.texto) {
    const alvo = normalizar([card.titulo, card.descricao, card.responsavel, ...(card.subtarefas ?? []).map((s) => s.texto)].join(' '));
    const termos = normalizar(filtro.texto).split(/\s+/).filter(Boolean);
    if (!termos.every((t) => alvo.includes(t))) return false;
  }
  if (filtro.responsavel) {
    if (filtro.responsavel === '__sem__') { if (card.responsavel) return false; }
    else if (normalizar(card.responsavel) !== normalizar(filtro.responsavel)) return false;
  }
  if (filtro.etiqueta && !card.etiquetas.includes(filtro.etiqueta)) return false;
  if (filtro.prioridade && card.prioridade !== filtro.prioridade) return false;
  if (filtro.colunaId && card.colunaId !== filtro.colunaId) return false;
  if (filtro.bloqueio === 'bloqueadas' && (estaConcluido(quadro, card) || !dependenciasPendentes(quadro, card).length)) return false;
  if (filtro.parada && (estaConcluido(quadro, card) || diasNaColuna(card, hoje) < Number(filtro.parada))) return false;
  if (filtro.prazo) {
    const s = situacaoPrazo(quadro, card, hoje);
    if (filtro.prazo === 'atrasado' && s !== 'atrasado') return false;
    if (filtro.prazo === 'hoje' && s !== 'hoje') return false;
    if (filtro.prazo === 'semana' && !['hoje', 'semana'].includes(s)) return false;
    if (filtro.prazo === 'sem' && s !== 'sem') return false;
  }
  return true;
};

export const filtrarCards = (quadro, filtro, hoje = new Date()) => quadro.cards.filter((c) => atendeFiltro(quadro, c, filtro, hoje));

export const responsaveisDo = (quadro) => [...new Set([
  ...quadro.cards.map((c) => c.responsavel).filter(Boolean),
  ...(quadro.membros ?? []).map((m) => m.nome)
])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
