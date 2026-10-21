import { uid, dataIso } from './util.js';
import { criarQuadro } from './modelos.js';

const diasAtras = (dias, hora = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(hora, 0, 0, 0);
  return d.toISOString();
};

const prazoEm = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return dataIso(d);
};

export const quadroDemonstracao = () => {
  const q = criarQuadro({ nome: 'Lançamento do aplicativo', descricao: 'Quadro de exemplo com dados fictícios para explorar o Prumo.', modelo: 'kanban' });
  const [backlog, todo, andamento, revisao, feito] = q.colunas;
  const [bug, melhoria, docs, pesquisa] = q.etiquetas;
  q.membros = [
    { nome: 'Ana Souza', papel: 'admin' },
    { nome: 'Bruno Lima', papel: 'gerente' },
    { nome: 'Carla Dias', papel: 'membro' },
    { nome: 'Diego Rocha', papel: 'membro' },
    { nome: 'Eva Martins', papel: 'visualizador' }
  ];
  const sub = (texto, feito = false) => ({ id: uid('sub'), texto, feito });
  const card = (coluna, dados, criado, iniciado = null, concluido = null) => {
    const movimentos = [];
    if (iniciado !== null) movimentos.push({ de: backlog.id, para: coluna.tipo === 'concluido' ? andamento.id : coluna.id, em: diasAtras(iniciado) });
    if (concluido !== null) movimentos.push({ de: andamento.id, para: feito.id, em: diasAtras(concluido, 16) });
    return {
      id: uid('crd'), colunaId: coluna.id, ordem: q.cards.filter((c) => c.colunaId === coluna.id).length,
      titulo: dados.titulo, descricao: dados.descricao ?? '', responsavel: dados.responsavel ?? '', prioridade: dados.prioridade ?? 'media',
      etiquetas: dados.etiquetas ?? [], prazo: dados.prazo ?? '', inicio: '', subtarefas: dados.subtarefas ?? [], comentarios: dados.comentarios ?? [],
      anexos: [], dependencias: [], criadoEm: diasAtras(criado), iniciadoEm: iniciado !== null ? diasAtras(iniciado) : null,
      concluidoEm: concluido !== null ? diasAtras(concluido, 16) : null, movimentos
    };
  };
  const login = card(feito, { titulo: 'Tela de login com validação', responsavel: 'Carla Dias', prioridade: 'alta', etiquetas: [melhoria.id], subtarefas: [sub('Formulário', true), sub('Mensagens de erro', true)] }, 30, 26, 21);
  const banco = card(feito, { titulo: 'Modelar tabelas de pedidos', responsavel: 'Diego Rocha', etiquetas: [melhoria.id] }, 28, 24, 18);
  const ci = card(feito, { titulo: 'Pipeline de integração contínua', responsavel: 'Bruno Lima', prioridade: 'baixa' }, 25, 20, 12);
  const manual = card(feito, { titulo: 'Guia de instalação', responsavel: 'Ana Souza', etiquetas: [docs.id] }, 20, 12, 6);
  const push = card(feito, { titulo: 'Notificações push', responsavel: 'Carla Dias', etiquetas: [melhoria.id] }, 15, 9, 2);
  const pagamento = card(revisao, { titulo: 'Integração com gateway de pagamento', responsavel: 'Diego Rocha', prioridade: 'urgente', etiquetas: [melhoria.id], prazo: prazoEm(1), subtarefas: [sub('Sandbox', true), sub('Webhooks', true), sub('Reembolso')], comentarios: [{ id: uid('cmt'), autor: 'Bruno Lima', texto: '@Diego confira os webhooks de estorno antes de liberar.', em: diasAtras(1, 14) }] }, 12, 7);
  const crash = card(andamento, { titulo: 'Corrigir travamento no Android 12', responsavel: 'Carla Dias', prioridade: 'urgente', etiquetas: [bug.id], prazo: prazoEm(-2), subtarefas: [sub('Reproduzir', true), sub('Corrigir'), sub('Testar em 3 aparelhos')] }, 6, 4);
  const busca = card(andamento, { titulo: 'Busca de produtos com filtros', responsavel: 'Ana Souza', prioridade: 'alta', etiquetas: [melhoria.id], prazo: prazoEm(4) }, 9, 3);
  const loja = card(todo, { titulo: 'Publicar na loja de aplicativos', responsavel: 'Bruno Lima', prioridade: 'alta', prazo: prazoEm(9), subtarefas: [sub('Capturas de tela'), sub('Política de privacidade'), sub('Descrição')] }, 5);
  const acess = card(todo, { titulo: 'Revisão de acessibilidade', responsavel: 'Eva Martins', etiquetas: [pesquisa.id], prazo: prazoEm(6) }, 4);
  const api = card(backlog, { titulo: 'Documentar a API pública', etiquetas: [docs.id], prioridade: 'baixa' }, 3);
  const modo = card(backlog, { titulo: 'Modo offline', etiquetas: [pesquisa.id], descricao: 'Avaliar sincronização com fila local.' }, 2);
  loja.dependencias = [pagamento.id, crash.id];
  q.cards = [login, banco, ci, manual, push, pagamento, crash, busca, loja, acess, api, modo];
  q.automacoes = [
    { id: uid('aut'), nome: 'Revisão vai para o Bruno', ativa: true, gatilho: { tipo: 'entrar', colunaId: revisao.id }, acao: { tipo: 'atribuir', valor: 'Bruno Lima' } },
    { id: uid('aut'), nome: 'Concluir marca subtarefas', ativa: true, gatilho: { tipo: 'entrar', colunaId: feito.id }, acao: { tipo: 'concluir_subtarefas', valor: '' } }
  ];
  q.historico = [
    { id: uid('reg'), em: diasAtras(1, 14), autor: 'Bruno Lima', acao: 'comentou', detalhe: pagamento.titulo, cardId: pagamento.id },
    { id: uid('reg'), em: diasAtras(2, 16), autor: 'Carla Dias', acao: 'moveu', detalhe: `${push.titulo}: In Progress → Done`, cardId: push.id },
    { id: uid('reg'), em: diasAtras(4), autor: 'Carla Dias', acao: 'moveu', detalhe: `${crash.titulo}: Backlog → In Progress`, cardId: crash.id },
    { id: uid('reg'), em: diasAtras(30), autor: 'Ana Souza', acao: 'criou o quadro', detalhe: q.nome, cardId: null }
  ];
  q.criadoEm = diasAtras(30);
  return q;
};
