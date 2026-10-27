import { normalizar, dataIso, inicioDoDia } from './util.js';
import { responsaveisDo } from './filtros.js';

// Adição rápida: o título da tarefa aceita marcações que preenchem os campos na hora.
//   @ana        responsável (casa com quem já está no quadro, pelo começo do nome)
//   #bug        etiqueta existente (use hífen no lugar do espaço: #nova-funcao)
//   !alta       prioridade: !urgente, !alta, !media, !baixa (ou !u, !a, !m, !b)
//   >sexta      prazo: >hoje, >amanha, >seg ... >dom, >15/11, >15/11/2026, >+3 (em 3 dias)

const PRIORIDADE = { urgente: 'urgente', u: 'urgente', alta: 'alta', a: 'alta', media: 'media', m: 'media', baixa: 'baixa', b: 'baixa' };
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

export const lerPrazo = (texto, hoje = new Date()) => {
  const t = normalizar(texto);
  const base = inicioDoDia(hoje);
  const em = (dias) => { const d = new Date(base); d.setDate(d.getDate() + dias); return dataIso(d); };
  if (t === 'hoje') return em(0);
  if (t === 'amanha') return em(1);
  if (/^\+\d{1,3}$/.test(t)) return em(Number(t.slice(1)));
  const dia = SEMANA.indexOf(t.slice(0, 3));
  if (dia >= 0 && /^[a-z]+$/.test(t)) {
    const falta = (dia - base.getDay() + 7) % 7 || 7;
    return em(falta);
  }
  const m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : base.getFullYear();
    const d = new Date(ano, Number(m[2]) - 1, Number(m[1]));
    if (d.getMonth() !== Number(m[2]) - 1) return null;
    if (!m[3] && d < base) d.setFullYear(d.getFullYear() + 1);
    return dataIso(d);
  }
  return null;
};

export const interpretarEntrada = (texto, quadro, hoje = new Date()) => {
  const resultado = { titulo: '', responsavel: '', prioridade: '', etiquetas: [], prazo: '', avisos: [] };
  const pessoas = responsaveisDo(quadro);
  const sobra = [];
  for (const parte of String(texto ?? '').split(/\s+/).filter(Boolean)) {
    const sinal = parte[0];
    const valor = parte.slice(1);
    if (sinal === '@' && valor) {
      const alvo = normalizar(valor.replace(/[_-]/g, ' '));
      const achou = pessoas.find((p) => normalizar(p) === alvo) ?? pessoas.find((p) => normalizar(p).startsWith(alvo));
      if (achou) resultado.responsavel = achou;
      else resultado.avisos.push(`Ninguém chamado “${valor}” no quadro`);
      continue;
    }
    if (sinal === '#' && valor) {
      const alvo = normalizar(valor.replace(/[_-]/g, ' '));
      const et = quadro.etiquetas.find((e) => normalizar(e.nome) === alvo) ?? quadro.etiquetas.find((e) => normalizar(e.nome).startsWith(alvo));
      if (et) { if (!resultado.etiquetas.includes(et.id)) resultado.etiquetas.push(et.id); }
      else resultado.avisos.push(`Etiqueta “${valor}” não existe`);
      continue;
    }
    if (sinal === '!' && PRIORIDADE[normalizar(valor)]) {
      resultado.prioridade = PRIORIDADE[normalizar(valor)];
      continue;
    }
    if (sinal === '>' && valor) {
      const prazo = lerPrazo(valor, hoje);
      if (prazo) { resultado.prazo = prazo; continue; }
      resultado.avisos.push(`Não entendi o prazo “${valor}”`);
      continue;
    }
    sobra.push(parte);
  }
  resultado.titulo = sobra.join(' ').trim();
  return resultado;
};
