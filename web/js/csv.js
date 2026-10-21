import { uid, agora, normalizar } from './util.js';
import { colunaDe, novoCard, cardsDaColuna } from './regras.js';
import { criarQuadro } from './modelos.js';

export const CABECALHO = ['id', 'quadro', 'coluna', 'titulo', 'descricao', 'responsavel', 'prioridade', 'etiquetas', 'prazo', 'subtarefas_feitas', 'subtarefas_total', 'dependencias', 'criado_em', 'iniciado_em', 'concluido_em'];

const celula = (valor) => {
  const texto = String(valor ?? '');
  return /[";\n\r,]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

export const paraCsv = (quadro) => {
  const nomesEtiqueta = Object.fromEntries(quadro.etiquetas.map((e) => [e.id, e.nome]));
  const linhas = [...quadro.cards]
    .sort((a, b) => quadro.colunas.findIndex((c) => c.id === a.colunaId) - quadro.colunas.findIndex((c) => c.id === b.colunaId) || a.ordem - b.ordem)
    .map((c) => [
      c.id, quadro.nome, colunaDe(quadro, c.colunaId)?.nome ?? '', c.titulo, c.descricao, c.responsavel, c.prioridade,
      c.etiquetas.map((e) => nomesEtiqueta[e]).filter(Boolean).join('|'), c.prazo,
      c.subtarefas.filter((s) => s.feito).length, c.subtarefas.length, (c.dependencias ?? []).join('|'),
      c.criadoEm, c.iniciadoEm ?? '', c.concluidoEm ?? ''
    ].map(celula).join(','));
  return [CABECALHO.join(','), ...linhas].join('\r\n');
};

export const lerCsv = (texto) => {
  const linhas = [];
  let linha = [];
  let campo = '';
  let aspas = false;
  const conteudo = String(texto).replace(/^﻿/, '');
  const sep = (conteudo.split(/\r?\n/)[0].match(/;/g)?.length ?? 0) > (conteudo.split(/\r?\n/)[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  for (let i = 0; i < conteudo.length; i += 1) {
    const ch = conteudo[i];
    if (aspas) {
      if (ch === '"' && conteudo[i + 1] === '"') { campo += '"'; i += 1; }
      else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && conteudo[i + 1] === '\n') i += 1;
      linha.push(campo); campo = '';
      if (linha.some((v) => v !== '')) linhas.push(linha);
      linha = [];
    } else campo += ch;
  }
  if (campo !== '' || linha.length) { linha.push(campo); if (linha.some((v) => v !== '')) linhas.push(linha); }
  if (!linhas.length) return [];
  const cabecalho = linhas[0].map((h) => normalizar(h).replace(/\s+/g, '_'));
  return linhas.slice(1).map((l) => Object.fromEntries(cabecalho.map((h, i) => [h, l[i] ?? ''])));
};

export const importarCsv = (quadro, texto, autor) => {
  const registros = lerCsv(texto);
  let criadas = 0;
  const mapaIds = new Map();
  registros.forEach((r) => {
    const titulo = r.titulo || r.title || r.nome;
    if (!titulo) return;
    const nomeColuna = r.coluna || r.status || quadro.colunas[0]?.nome || 'Backlog';
    let coluna = quadro.colunas.find((c) => normalizar(c.nome) === normalizar(nomeColuna));
    if (!coluna) {
      coluna = { id: uid('col'), nome: nomeColuna, tipo: 'andamento', limiteWip: 0 };
      quadro.colunas.push(coluna);
    }
    const etiquetas = String(r.etiquetas || '').split('|').map((n) => n.trim()).filter(Boolean).map((nome) => {
      let e = quadro.etiquetas.find((x) => normalizar(x.nome) === normalizar(nome));
      if (!e) { e = { id: uid('etq'), nome, cor: '#8C8C7A' }; quadro.etiquetas.push(e); }
      return e.id;
    });
    const card = novoCard({
      colunaId: coluna.id,
      titulo,
      descricao: r.descricao || '',
      responsavel: r.responsavel || '',
      prioridade: ['urgente', 'alta', 'media', 'baixa'].includes(normalizar(r.prioridade)) ? normalizar(r.prioridade) : 'media',
      etiquetas,
      prazo: /^\d{4}-\d{2}-\d{2}/.test(r.prazo) ? r.prazo.slice(0, 10) : '',
      criadoEm: r.criado_em || agora()
    });
    card.iniciadoEm = r.iniciado_em || (coluna.tipo !== 'espera' ? card.criadoEm : null);
    card.concluidoEm = r.concluido_em || (coluna.tipo === 'concluido' ? agora() : null);
    card.ordem = cardsDaColuna(quadro, coluna.id).length;
    if (r.id) mapaIds.set(r.id, card.id);
    card._deps = String(r.dependencias || '').split('|').filter(Boolean);
    quadro.cards.push(card);
    criadas += 1;
  });
  quadro.cards.forEach((c) => {
    if (c._deps) {
      c.dependencias = c._deps.map((d) => mapaIds.get(d)).filter(Boolean);
      delete c._deps;
    }
  });
  if (criadas) {
    quadro.historico.unshift({ id: uid('reg'), em: agora(), autor, acao: 'importou CSV', detalhe: `${criadas} tarefa(s)`, cardId: null });
  }
  return criadas;
};

export const paraJson = (quadros) => JSON.stringify({ formato: 'prumo', versao: 1, exportadoEm: agora(), quadros }, null, 2);

export const lerJson = (texto) => {
  const dados = JSON.parse(texto);
  const lista = Array.isArray(dados) ? dados : dados.quadros ?? (dados.colunas ? [dados] : null);
  if (!Array.isArray(lista) || !lista.length) throw new Error('O arquivo não tem quadros do Prumo.');
  return lista.map((q) => {
    if (!Array.isArray(q.colunas) || !Array.isArray(q.cards)) throw new Error('Quadro inválido: faltam colunas ou tarefas.');
    const base = criarQuadro({ nome: q.nome });
    return { ...base, ...q, id: uid('qdr'), etiquetas: q.etiquetas ?? [], automacoes: q.automacoes ?? [], historico: q.historico ?? [], membros: q.membros ?? [] };
  });
};
