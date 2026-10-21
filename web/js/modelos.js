import { uid, agora } from './util.js';

const coluna = (nome, tipo = 'andamento', limiteWip = 0) => ({ id: uid('col'), nome, tipo, limiteWip });

const etiqueta = (nome, cor) => ({ id: uid('etq'), nome, cor });

export const MODELOS = {
  kanban: {
    nome: 'Kanban',
    descricao: 'Backlog, To Do, In Progress, Review e Done.',
    colunas: () => [coluna('Backlog', 'espera'), coluna('To Do', 'espera'), coluna('In Progress', 'andamento', 3), coluna('Review', 'andamento', 2), coluna('Done', 'concluido')],
    etiquetas: () => [etiqueta('Bug', '#6B1F33'), etiqueta('Melhoria', '#707645'), etiqueta('Documentação', '#A4978B'), etiqueta('Pesquisa', '#F6E4A6')]
  },
  scrum: {
    nome: 'Scrum',
    descricao: 'Product Backlog, Sprint Backlog, Em andamento, Teste e Pronto.',
    colunas: () => [coluna('Product Backlog', 'espera'), coluna('Sprint Backlog', 'espera'), coluna('Em andamento', 'andamento', 4), coluna('Teste', 'andamento', 2), coluna('Pronto', 'concluido')],
    etiquetas: () => [etiqueta('História', '#707645'), etiqueta('Tarefa técnica', '#8C8C7A'), etiqueta('Bug', '#6B1F33'), etiqueta('Spike', '#F6E4A6')]
  },
  desenvolvimento: {
    nome: 'Desenvolvimento',
    descricao: 'Ideias, Especificação, Desenvolvimento, Code Review, QA e Produção.',
    colunas: () => [coluna('Ideias', 'espera'), coluna('Especificação', 'espera'), coluna('Desenvolvimento', 'andamento', 4), coluna('Code Review', 'andamento', 3), coluna('QA', 'andamento', 2), coluna('Produção', 'concluido')],
    etiquetas: () => [etiqueta('Frontend', '#707645'), etiqueta('Backend', '#5C4033'), etiqueta('Infra', '#8C8C7A'), etiqueta('Bug', '#6B1F33'), etiqueta('Segurança', '#D6BDB8')]
  },
  estudos: {
    nome: 'Estudos',
    descricao: 'Para estudar, Estudando, Revisar e Aprendido.',
    colunas: () => [coluna('Para estudar', 'espera'), coluna('Estudando', 'andamento', 2), coluna('Revisar', 'andamento'), coluna('Aprendido', 'concluido')],
    etiquetas: () => [etiqueta('Leitura', '#A4978B'), etiqueta('Exercícios', '#707645'), etiqueta('Prova', '#6B1F33'), etiqueta('Vídeo', '#F6E4A6')]
  },
  projetos: {
    nome: 'Gestão de projetos',
    descricao: 'Planejamento, Execução, Aprovação, Entregue e Bloqueado.',
    colunas: () => [coluna('Planejamento', 'espera'), coluna('Execução', 'andamento', 5), coluna('Aprovação', 'andamento', 3), coluna('Entregue', 'concluido')],
    etiquetas: () => [etiqueta('Cliente', '#707645'), etiqueta('Financeiro', '#5C4033'), etiqueta('Risco', '#6B1F33'), etiqueta('Marco', '#F6E4A6')]
  }
};

export const criarQuadro = ({ nome, descricao = '', modelo = 'kanban', cor = '#707645' }) => {
  const base = MODELOS[modelo] ?? MODELOS.kanban;
  return {
    id: uid('qdr'),
    nome: nome?.trim() || base.nome,
    descricao,
    cor,
    modelo,
    arquivado: false,
    criadoEm: agora(),
    atualizadoEm: agora(),
    bloquearDependencias: true,
    colunas: base.colunas(),
    cards: [],
    etiquetas: base.etiquetas(),
    automacoes: [],
    historico: [],
    membros: []
  };
};
