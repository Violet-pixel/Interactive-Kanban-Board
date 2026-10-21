export const uid = (prefixo = '') => {
  const base = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return prefixo ? `${prefixo}_${base}` : base;
};

export const agora = () => new Date().toISOString();

export const clonar = (valor) => JSON.parse(JSON.stringify(valor));

export const escapar = (texto) => String(texto ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const normalizar = (texto) => String(texto ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .trim();

export const inicioDoDia = (data) => {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const dataIso = (data) => {
  const d = new Date(data);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
};

export const lerDataLocal = (texto) => {
  if (!texto) return null;
  const [a, m, d] = String(texto).slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return null;
  return new Date(a, m - 1, d);
};

export const diasEntre = (inicio, fim) => {
  if (!inicio || !fim) return null;
  return (new Date(fim) - new Date(inicio)) / 86400000;
};

export const formatarData = (texto) => {
  const d = lerDataLocal(texto);
  if (!d) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
};

export const formatarDataHora = (texto) => {
  if (!texto) return '';
  return new Date(texto).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const formatarBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export const mediana = (valores) => {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
};

export const media = (valores) => valores.length ? valores.reduce((s, x) => s + x, 0) / valores.length : null;

export const debounce = (fn, espera = 300) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), espera);
  };
};

export const PRIORIDADES = [
  { id: 'urgente', nome: 'Urgente', peso: 4 },
  { id: 'alta', nome: 'Alta', peso: 3 },
  { id: 'media', nome: 'Média', peso: 2 },
  { id: 'baixa', nome: 'Baixa', peso: 1 }
];

export const nomePrioridade = (id) => PRIORIDADES.find((p) => p.id === id)?.nome ?? 'Média';

export const CORES_ETIQUETA = ['#707645', '#8C8C7A', '#A4978B', '#5C4033', '#D6BDB8', '#F6E4A6', '#6B1F33', '#3E4A2C'];
