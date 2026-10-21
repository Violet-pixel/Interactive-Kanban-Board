import { normalizar, dataIso } from './util.js';
import { situacaoPrazo } from './filtros.js';
import { mencionou } from './regras.js';

const mesmoNome = (a, b) => a && b && normalizar(a) === normalizar(b);

export const gerarNotificacoes = (quadros, usuario, hoje = new Date()) => {
  const lista = [];
  const dia = dataIso(hoje);
  quadros.filter((q) => !q.arquivado).forEach((q) => {
    q.cards.forEach((c) => {
      const meu = mesmoNome(c.responsavel, usuario.nome);
      const prazo = situacaoPrazo(q, c, hoje);
      if (meu && prazo === 'atrasado') lista.push({ chave: `atraso:${c.id}:${dia}`, tipo: 'prazo', quadroId: q.id, cardId: c.id, texto: `Atrasada: ${c.titulo}`, em: hoje.toISOString(), lida: false });
      if (meu && prazo === 'hoje') lista.push({ chave: `hoje:${c.id}:${dia}`, tipo: 'prazo', quadroId: q.id, cardId: c.id, texto: `Vence hoje: ${c.titulo}`, em: hoje.toISOString(), lida: false });
      (c.comentarios ?? []).forEach((m) => {
        if (!mesmoNome(m.autor, usuario.nome) && mencionou(m.texto, usuario.nome)) {
          lista.push({ chave: `mencao:${m.id}`, tipo: 'mencao', quadroId: q.id, cardId: c.id, texto: `${m.autor} mencionou você em ${c.titulo}`, em: m.em, lida: false });
        }
      });
    });
    (q.historico ?? []).slice(0, 60).forEach((h) => {
      if (!h.cardId || mesmoNome(h.autor, usuario.nome)) return;
      const card = q.cards.find((c) => c.id === h.cardId);
      if (!card || !mesmoNome(card.responsavel, usuario.nome)) return;
      const tipo = h.acao === 'editou' && /responsavel/.test(h.detalhe) ? 'atribuicao' : 'alteracao';
      lista.push({ chave: `hist:${h.id}`, tipo, quadroId: q.id, cardId: card.id, texto: `${h.autor} ${h.acao}: ${h.detalhe}`, em: h.em, lida: false });
    });
  });
  return lista;
};
