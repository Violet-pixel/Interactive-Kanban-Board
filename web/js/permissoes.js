export const PAPEIS = [
  { id: 'admin', nome: 'Administrador' },
  { id: 'gerente', nome: 'Gerente' },
  { id: 'membro', nome: 'Membro' },
  { id: 'visualizador', nome: 'Visualizador' }
];

const CAPACIDADES = {
  admin: ['ver', 'tarefas', 'comentar', 'colunas', 'configurar', 'automacoes', 'membros', 'quadros', 'excluir_quadro', 'importar'],
  gerente: ['ver', 'tarefas', 'comentar', 'colunas', 'configurar', 'automacoes', 'quadros', 'importar'],
  membro: ['ver', 'tarefas', 'comentar'],
  visualizador: ['ver']
};

export const pode = (papel, acao) => (CAPACIDADES[papel] ?? CAPACIDADES.visualizador).includes(acao);

export const nomePapel = (id) => PAPEIS.find((p) => p.id === id)?.nome ?? 'Visualizador';
