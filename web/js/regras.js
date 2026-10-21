import { uid, agora, clonar, normalizar } from './util.js';

export const LIMITE_HISTORICO = 500;

export const registrar = (quadro, autor, acao, detalhe = '', cardId = null) => {
  const item = { id: uid('reg'), em: agora(), autor: autor || 'Anônimo', acao, detalhe, cardId };
  quadro.historico.unshift(item);
  if (quadro.historico.length > LIMITE_HISTORICO) quadro.historico.length = LIMITE_HISTORICO;
  quadro.atualizadoEm = item.em;
  return item;
};

export const colunaDe = (quadro, id) => quadro.colunas.find((c) => c.id === id);

export const cardDe = (quadro, id) => quadro.cards.find((c) => c.id === id);

export const cardsDaColuna = (quadro, colunaId) => quadro.cards
  .filter((c) => c.colunaId === colunaId)
  .sort((a, b) => a.ordem - b.ordem);

export const colunaConcluida = (quadro) => quadro.colunas.find((c) => c.tipo === 'concluido') ?? quadro.colunas.at(-1);

export const estaConcluido = (quadro, card) => colunaDe(quadro, card.colunaId)?.tipo === 'concluido';

export const reordenar = (quadro, colunaId) => {
  cardsDaColuna(quadro, colunaId).forEach((c, i) => { c.ordem = i; });
};

export const excedeWip = (quadro, colunaId, ignorarCardId = null) => {
  const col = colunaDe(quadro, colunaId);
  if (!col || !col.limiteWip) return false;
  const total = quadro.cards.filter((c) => c.colunaId === colunaId && c.id !== ignorarCardId).length;
  return total >= col.limiteWip;
};

export const dependenciasPendentes = (quadro, card) => (card.dependencias ?? [])
  .map((id) => cardDe(quadro, id))
  .filter((dep) => dep && !estaConcluido(quadro, dep));

export const criaCiclo = (quadro, cardId, dependeDeId) => {
  if (cardId === dependeDeId) return true;
  const visitados = new Set();
  const pilha = [dependeDeId];
  while (pilha.length) {
    const atual = pilha.pop();
    if (atual === cardId) return true;
    if (visitados.has(atual)) continue;
    visitados.add(atual);
    const card = cardDe(quadro, atual);
    if (card) pilha.push(...(card.dependencias ?? []));
  }
  return false;
};

const marcarEntrada = (quadro, card, colunaId) => {
  const col = colunaDe(quadro, colunaId);
  const momento = agora();
  card.movimentos = card.movimentos ?? [];
  card.movimentos.push({ de: card.colunaId, para: colunaId, em: momento });
  card.colunaId = colunaId;
  if (col?.tipo === 'andamento' && !card.iniciadoEm) card.iniciadoEm = momento;
  if (col?.tipo === 'concluido') {
    if (!card.iniciadoEm) card.iniciadoEm = momento;
    card.concluidoEm = momento;
  } else {
    card.concluidoEm = null;
  }
};

export const novoCard = (dados = {}) => ({
  id: uid('crd'),
  colunaId: dados.colunaId,
  ordem: 0,
  titulo: dados.titulo?.trim() || 'Nova tarefa',
  descricao: dados.descricao ?? '',
  responsavel: dados.responsavel ?? '',
  prioridade: dados.prioridade ?? 'media',
  etiquetas: dados.etiquetas ?? [],
  prazo: dados.prazo ?? '',
  inicio: dados.inicio ?? '',
  subtarefas: dados.subtarefas ?? [],
  comentarios: [],
  anexos: [],
  dependencias: dados.dependencias ?? [],
  criadoEm: dados.criadoEm ?? agora(),
  iniciadoEm: null,
  concluidoEm: null,
  movimentos: []
});

export const adicionarCard = (quadro, dados, autor, { ignorarWip = false } = {}) => {
  const colunaId = dados.colunaId ?? quadro.colunas[0]?.id;
  if (!colunaId) return { ok: false, erro: 'Crie uma coluna antes de adicionar tarefas.' };
  if (!ignorarWip && excedeWip(quadro, colunaId)) {
    const col = colunaDe(quadro, colunaId);
    return { ok: false, erro: `A coluna ${col.nome} chegou ao limite WIP de ${col.limiteWip}.` };
  }
  const card = novoCard({ ...dados, colunaId });
  card.ordem = cardsDaColuna(quadro, colunaId).length;
  const col = colunaDe(quadro, colunaId);
  if (col.tipo === 'andamento') card.iniciadoEm = card.criadoEm;
  if (col.tipo === 'concluido') { card.iniciadoEm = card.criadoEm; card.concluidoEm = card.criadoEm; }
  quadro.cards.push(card);
  registrar(quadro, autor, 'criou', `${card.titulo} em ${col.nome}`, card.id);
  const avisos = executarAutomacoes(quadro, { tipo: 'criar', card, colunaId }, autor);
  return { ok: true, card, avisos };
};

export const moverCard = (quadro, cardId, colunaId, indice, autor, { automacao = true } = {}) => {
  const card = cardDe(quadro, cardId);
  const destino = colunaDe(quadro, colunaId);
  if (!card || !destino) return { ok: false, erro: 'Tarefa ou coluna não encontrada.' };
  const mudouColuna = card.colunaId !== colunaId;
  if (mudouColuna && excedeWip(quadro, colunaId, cardId)) {
    return { ok: false, erro: `A coluna ${destino.nome} chegou ao limite WIP de ${destino.limiteWip}.` };
  }
  const avisos = [];
  if (mudouColuna && destino.tipo !== 'espera') {
    const pendentes = dependenciasPendentes(quadro, card);
    if (pendentes.length) {
      const nomes = pendentes.map((p) => p.titulo).join(', ');
      if (quadro.bloquearDependencias) return { ok: false, erro: `Conclua antes: ${nomes}.` };
      avisos.push(`Esta tarefa depende de: ${nomes}.`);
    }
  }
  const origem = card.colunaId;
  const lista = cardsDaColuna(quadro, colunaId).filter((c) => c.id !== cardId);
  const posicao = Math.max(0, Math.min(indice ?? lista.length, lista.length));
  lista.splice(posicao, 0, card);
  if (mudouColuna) marcarEntrada(quadro, card, colunaId);
  lista.forEach((c, i) => { c.ordem = i; });
  if (mudouColuna) {
    reordenar(quadro, origem);
    registrar(quadro, autor, 'moveu', `${card.titulo}: ${colunaDe(quadro, origem)?.nome ?? '?'} → ${destino.nome}`, card.id);
    if (automacao) avisos.push(...executarAutomacoes(quadro, { tipo: 'entrar', card, colunaId }, autor));
  } else {
    registrar(quadro, autor, 'reordenou', `${card.titulo} em ${destino.nome}`, card.id);
  }
  return { ok: true, card, avisos };
};

export const editarCard = (quadro, cardId, campos, autor) => {
  const card = cardDe(quadro, cardId);
  if (!card) return { ok: false, erro: 'Tarefa não encontrada.' };
  const alterados = [];
  for (const [chave, valor] of Object.entries(campos)) {
    if (JSON.stringify(card[chave]) !== JSON.stringify(valor)) {
      card[chave] = clonar(valor);
      alterados.push(chave);
    }
  }
  if (alterados.length) registrar(quadro, autor, 'editou', `${card.titulo} (${alterados.join(', ')})`, card.id);
  return { ok: true, card, alterados };
};

export const excluirCard = (quadro, cardId, autor) => {
  const card = cardDe(quadro, cardId);
  if (!card) return { ok: false, erro: 'Tarefa não encontrada.' };
  quadro.cards = quadro.cards.filter((c) => c.id !== cardId);
  quadro.cards.forEach((c) => { c.dependencias = (c.dependencias ?? []).filter((d) => d !== cardId); });
  reordenar(quadro, card.colunaId);
  registrar(quadro, autor, 'excluiu', card.titulo, cardId);
  return { ok: true };
};

export const duplicarCard = (quadro, cardId, autor) => {
  const original = cardDe(quadro, cardId);
  if (!original) return { ok: false, erro: 'Tarefa não encontrada.' };
  const copia = { ...clonar(original), id: uid('crd'), titulo: `${original.titulo} (cópia)`, comentarios: [], movimentos: [], criadoEm: agora() };
  copia.subtarefas = copia.subtarefas.map((s) => ({ ...s, id: uid('sub') }));
  copia.ordem = cardsDaColuna(quadro, original.colunaId).length;
  quadro.cards.push(copia);
  registrar(quadro, autor, 'duplicou', original.titulo, copia.id);
  return { ok: true, card: copia };
};

export const adicionarColuna = (quadro, nome, autor, tipo = 'andamento') => {
  const col = { id: uid('col'), nome: nome?.trim() || 'Nova coluna', tipo, limiteWip: 0 };
  const concluida = quadro.colunas.findIndex((c) => c.tipo === 'concluido');
  if (concluida >= 0 && tipo !== 'concluido') quadro.colunas.splice(concluida, 0, col);
  else quadro.colunas.push(col);
  registrar(quadro, autor, 'criou coluna', col.nome);
  return col;
};

export const moverColuna = (quadro, colunaId, indice, autor) => {
  const atual = quadro.colunas.findIndex((c) => c.id === colunaId);
  if (atual < 0) return false;
  const [col] = quadro.colunas.splice(atual, 1);
  quadro.colunas.splice(Math.max(0, Math.min(indice, quadro.colunas.length)), 0, col);
  registrar(quadro, autor, 'reorganizou colunas', col.nome);
  return true;
};

export const excluirColuna = (quadro, colunaId, autor) => {
  const col = colunaDe(quadro, colunaId);
  if (!col) return { ok: false, erro: 'Coluna não encontrada.' };
  if (quadro.colunas.length === 1) return { ok: false, erro: 'O quadro precisa de pelo menos uma coluna.' };
  const restantes = quadro.colunas.filter((c) => c.id !== colunaId);
  const destino = restantes[Math.max(0, quadro.colunas.indexOf(col) - 1)];
  quadro.cards.filter((c) => c.colunaId === colunaId).forEach((c) => { c.colunaId = destino.id; c.ordem = 1e6 + c.ordem; });
  quadro.colunas = restantes;
  reordenar(quadro, destino.id);
  quadro.automacoes = quadro.automacoes.filter((a) => a.gatilho.colunaId !== colunaId && !(a.acao.tipo === 'mover' && a.acao.valor === colunaId));
  registrar(quadro, autor, 'excluiu coluna', `${col.nome} (tarefas foram para ${destino.nome})`);
  return { ok: true, destino };
};

export const DESCRICOES_ACAO = {
  atribuir: 'definir responsável',
  prioridade: 'definir prioridade',
  etiqueta: 'adicionar etiqueta',
  mover: 'mover para a coluna',
  concluir_subtarefas: 'marcar todas as subtarefas',
  prazo_dias: 'definir prazo em dias'
};

export const executarAutomacoes = (quadro, evento, autor, profundidade = 0) => {
  if (profundidade > 3) return [];
  const avisos = [];
  const regras = (quadro.automacoes ?? []).filter((r) => r.ativa !== false && r.gatilho.tipo === evento.tipo && (!r.gatilho.colunaId || r.gatilho.colunaId === evento.colunaId));
  for (const regra of regras) {
    const card = cardDe(quadro, evento.card.id);
    if (!card) break;
    const { tipo, valor } = regra.acao;
    if (tipo === 'atribuir' && card.responsavel !== valor) card.responsavel = valor;
    else if (tipo === 'prioridade') card.prioridade = valor;
    else if (tipo === 'etiqueta' && valor && !card.etiquetas.includes(valor)) card.etiquetas.push(valor);
    else if (tipo === 'concluir_subtarefas') card.subtarefas.forEach((s) => { s.feito = true; });
    else if (tipo === 'prazo_dias') {
      const d = new Date();
      d.setDate(d.getDate() + Number(valor || 0));
      card.prazo = d.toISOString().slice(0, 10);
    } else if (tipo === 'mover' && valor && valor !== card.colunaId) {
      const r = moverCard(quadro, card.id, valor, undefined, 'Automação', { automacao: false });
      if (!r.ok) { avisos.push(`Automação “${regra.nome}”: ${r.erro}`); continue; }
      avisos.push(...executarAutomacoes(quadro, { tipo: 'entrar', card, colunaId: valor }, autor, profundidade + 1));
    } else continue;
    registrar(quadro, 'Automação', 'aplicou regra', `${regra.nome} em ${card.titulo}`, card.id);
    avisos.push(`Automação “${regra.nome}” aplicada.`);
  }
  return avisos;
};

export const extrairMencoes = (texto) => [...String(texto).matchAll(/@([\p{L}\p{N}_.-]+)/gu)].map((m) => m[1]);

export const mencionou = (texto, nome) => {
  if (!nome) return false;
  const primeiro = normalizar(nome).split(/\s+/)[0];
  const completo = normalizar(nome).replace(/\s+/g, '');
  return extrairMencoes(texto).some((m) => [primeiro, completo].includes(normalizar(m)));
};

export const progressoSubtarefas = (card) => {
  const total = card.subtarefas?.length ?? 0;
  const feitas = card.subtarefas?.filter((s) => s.feito).length ?? 0;
  return { total, feitas, percentual: total ? Math.round((feitas / total) * 100) : 0 };
};
