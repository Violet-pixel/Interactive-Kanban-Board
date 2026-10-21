import { clonar, agora, uid } from './util.js';
import { criarQuadro } from './modelos.js';
import { quadroDemonstracao } from './demonstracao.js';

export const CHAVE = 'prumo:estado:v1';
export const LIMITE_DESFAZER = 100;

export const estadoInicial = () => {
  const demo = quadroDemonstracao();
  return {
    versao: 1,
    quadros: [demo],
    quadroAtivo: demo.id,
    usuario: { nome: 'Ana Souza', papel: 'admin' },
    preferencias: { tema: 'sistema', densidade: 'confortavel', mostrarArquivados: false },
    notificacoes: []
  };
};

export class Loja {
  constructor(armazenamento = null) {
    this.armazenamento = armazenamento;
    this.ouvintes = new Set();
    this.pilhaDesfazer = [];
    this.pilhaRefazer = [];
    this.estado = this.carregar();
  }

  carregar() {
    try {
      const bruto = this.armazenamento?.getItem(CHAVE);
      if (bruto) {
        const dados = JSON.parse(bruto);
        if (dados?.versao === 1 && Array.isArray(dados.quadros)) return { ...estadoInicial(), ...dados };
      }
    } catch {
      return estadoInicial();
    }
    return estadoInicial();
  }

  salvar() {
    try {
      this.armazenamento?.setItem(CHAVE, JSON.stringify(this.estado));
      return true;
    } catch {
      return false;
    }
  }

  assinar(fn) {
    this.ouvintes.add(fn);
    return () => this.ouvintes.delete(fn);
  }

  emitir(motivo) {
    this.ouvintes.forEach((fn) => fn(this.estado, motivo));
  }

  get quadro() {
    return this.estado.quadros.find((q) => q.id === this.estado.quadroAtivo) ?? this.estado.quadros.find((q) => !q.arquivado) ?? null;
  }

  instantaneo() {
    return JSON.stringify({ quadros: this.estado.quadros, quadroAtivo: this.estado.quadroAtivo });
  }

  alterar(descricao, fn, { historico = true, motivo = 'alteracao' } = {}) {
    const antes = this.instantaneo();
    const resultado = fn(this.estado);
    if (resultado && resultado.ok === false) return resultado;
    if (this.instantaneo() === antes) return resultado ?? { ok: true };
    if (historico) {
      this.pilhaDesfazer.push({ descricao, dados: antes });
      if (this.pilhaDesfazer.length > LIMITE_DESFAZER) this.pilhaDesfazer.shift();
      this.pilhaRefazer = [];
    }
    this.salvar();
    this.emitir(motivo);
    return resultado ?? { ok: true };
  }

  aplicar(dados) {
    const { quadros, quadroAtivo } = JSON.parse(dados);
    this.estado.quadros = quadros;
    this.estado.quadroAtivo = quadroAtivo;
  }

  desfazer() {
    const passo = this.pilhaDesfazer.pop();
    if (!passo) return null;
    this.pilhaRefazer.push({ descricao: passo.descricao, dados: this.instantaneo() });
    this.aplicar(passo.dados);
    this.salvar();
    this.emitir('desfazer');
    return passo.descricao;
  }

  refazer() {
    const passo = this.pilhaRefazer.pop();
    if (!passo) return null;
    this.pilhaDesfazer.push({ descricao: passo.descricao, dados: this.instantaneo() });
    this.aplicar(passo.dados);
    this.salvar();
    this.emitir('refazer');
    return passo.descricao;
  }

  get podeDesfazer() { return this.pilhaDesfazer.length > 0; }

  get podeRefazer() { return this.pilhaRefazer.length > 0; }

  preferencia(chave, valor) {
    this.estado.preferencias[chave] = valor;
    this.salvar();
    this.emitir('preferencias');
  }

  definirUsuario(dados) {
    this.estado.usuario = { ...this.estado.usuario, ...dados };
    this.salvar();
    this.emitir('usuario');
  }

  selecionarQuadro(id) {
    this.estado.quadroAtivo = id;
    this.salvar();
    this.emitir('quadro');
  }

  novoQuadro(dados) {
    return this.alterar('criar quadro', (e) => {
      const q = criarQuadro(dados);
      q.historico.unshift({ id: uid('reg'), em: agora(), autor: e.usuario.nome, acao: 'criou o quadro', detalhe: q.nome, cardId: null });
      e.quadros.push(q);
      e.quadroAtivo = q.id;
      return { ok: true, quadro: q };
    });
  }

  duplicarQuadro(id) {
    return this.alterar('duplicar quadro', (e) => {
      const original = e.quadros.find((q) => q.id === id);
      if (!original) return { ok: false, erro: 'Quadro não encontrado.' };
      const copia = clonar(original);
      copia.id = uid('qdr');
      copia.nome = `${original.nome} (cópia)`;
      copia.arquivado = false;
      copia.criadoEm = agora();
      copia.historico = [{ id: uid('reg'), em: agora(), autor: e.usuario.nome, acao: 'duplicou o quadro', detalhe: original.nome, cardId: null }];
      e.quadros.push(copia);
      e.quadroAtivo = copia.id;
      return { ok: true, quadro: copia };
    });
  }

  arquivarQuadro(id, arquivado = true) {
    return this.alterar(arquivado ? 'arquivar quadro' : 'restaurar quadro', (e) => {
      const q = e.quadros.find((x) => x.id === id);
      if (!q) return { ok: false, erro: 'Quadro não encontrado.' };
      q.arquivado = arquivado;
      if (arquivado && e.quadroAtivo === id) e.quadroAtivo = e.quadros.find((x) => !x.arquivado)?.id ?? id;
      if (!arquivado) e.quadroAtivo = id;
      return { ok: true };
    });
  }

  excluirQuadro(id) {
    return this.alterar('excluir quadro', (e) => {
      e.quadros = e.quadros.filter((q) => q.id !== id);
      if (!e.quadros.length) e.quadros.push(criarQuadro({ nome: 'Meu quadro' }));
      if (e.quadroAtivo === id) e.quadroAtivo = (e.quadros.find((q) => !q.arquivado) ?? e.quadros[0]).id;
      return { ok: true };
    });
  }

  alterarQuadro(descricao, fn, opcoes) {
    return this.alterar(descricao, () => {
      const q = this.quadro;
      if (!q) return { ok: false, erro: 'Nenhum quadro aberto.' };
      return fn(q, this.estado.usuario.nome);
    }, opcoes);
  }

  substituirQuadroRemoto(quadro) {
    const i = this.estado.quadros.findIndex((q) => q.id === quadro.id);
    if (i >= 0) this.estado.quadros[i] = quadro;
    else this.estado.quadros.push(quadro);
    this.pilhaDesfazer = [];
    this.pilhaRefazer = [];
    this.salvar();
    this.emitir('remoto');
  }

  adicionarNotificacoes(lista) {
    const existentes = new Set(this.estado.notificacoes.map((n) => n.chave));
    const novas = lista.filter((n) => !existentes.has(n.chave));
    if (!novas.length) return [];
    this.estado.notificacoes = [...novas, ...this.estado.notificacoes].slice(0, 100);
    this.salvar();
    this.emitir('notificacoes');
    return novas;
  }

  marcarNotificacoesLidas() {
    this.estado.notificacoes.forEach((n) => { n.lida = true; });
    this.salvar();
    this.emitir('notificacoes');
  }
}
