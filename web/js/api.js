const CHAVE_SESSAO = 'prumo:sessao';

export class ErroApi extends Error {
  constructor(status, corpo) {
    super(corpo?.mensagem || `Erro ${status}`);
    this.status = status;
    this.corpo = corpo;
  }
}

export class ClienteApi {
  constructor({ base = '/api/v1', armazenamento = null, fetchFn = (...a) => fetch(...a) } = {}) {
    this.base = base;
    this.armazenamento = armazenamento;
    this.fetchFn = fetchFn;
    this.sessao = this.lerSessao();
    this.sockets = new Map();
  }

  lerSessao() {
    try { return JSON.parse(this.armazenamento?.getItem(CHAVE_SESSAO) || 'null'); } catch { return null; }
  }

  gravarSessao(sessao) {
    this.sessao = sessao;
    try {
      if (sessao) this.armazenamento?.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
      else this.armazenamento?.removeItem(CHAVE_SESSAO);
    } catch {
      return;
    }
  }

  get conectado() { return Boolean(this.sessao?.token); }

  async requisitar(caminho, { metodo = 'GET', corpo, formulario } = {}) {
    const cabecalhos = { Accept: 'application/json' };
    if (this.sessao?.token) cabecalhos.Authorization = `Bearer ${this.sessao.token}`;
    let body;
    if (formulario) body = formulario;
    else if (corpo !== undefined) { cabecalhos['Content-Type'] = 'application/json'; body = JSON.stringify(corpo); }
    const resposta = await this.fetchFn(`${this.base}${caminho}`, { method: metodo, headers: cabecalhos, body });
    const texto = await resposta.text();
    const dados = texto ? JSON.parse(texto) : null;
    if (!resposta.ok) {
      if (resposta.status === 401) this.gravarSessao(null);
      throw new ErroApi(resposta.status, dados);
    }
    return dados;
  }

  async disponivel() {
    try {
      const r = await this.fetchFn(`${this.base}/saude`, { headers: { Accept: 'application/json' } });
      return r.ok;
    } catch {
      return false;
    }
  }

  async entrar(email, senha) {
    const dados = await this.requisitar('/auth/entrar', { metodo: 'POST', corpo: { email, senha } });
    this.gravarSessao({ token: dados.token, usuario: dados.usuario });
    return dados;
  }

  async sair() {
    try { await this.requisitar('/auth/sair', { metodo: 'POST' }); } finally { this.gravarSessao(null); this.fecharTodos(); }
  }

  listarQuadros() { return this.requisitar('/quadros'); }

  obterQuadro(id) { return this.requisitar(`/quadros/${encodeURIComponent(id)}`); }

  criarQuadro(dados) { return this.requisitar('/quadros', { metodo: 'POST', corpo: { dados } }); }

  salvarQuadro(id, revisao, dados, registros = []) {
    return this.requisitar(`/quadros/${encodeURIComponent(id)}`, { metodo: 'PUT', corpo: { revisao, dados, registros } });
  }

  excluirQuadro(id) { return this.requisitar(`/quadros/${encodeURIComponent(id)}`, { metodo: 'DELETE' }); }

  historico(id) { return this.requisitar(`/quadros/${encodeURIComponent(id)}/historico`); }

  membros(id) { return this.requisitar(`/quadros/${encodeURIComponent(id)}/membros`); }

  definirMembro(id, email, papel) { return this.requisitar(`/quadros/${encodeURIComponent(id)}/membros`, { metodo: 'POST', corpo: { email, papel } }); }

  enviarAnexo(id, cardId, arquivo) {
    const f = new FormData();
    f.append('card', cardId);
    f.append('arquivo', arquivo);
    return this.requisitar(`/quadros/${encodeURIComponent(id)}/anexos`, { metodo: 'POST', formulario: f });
  }

  assinarQuadro(id, aoReceber) {
    this.fecharQuadro(id);
    if (!this.conectado || typeof WebSocket === 'undefined') return null;
    const protocolo = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocolo}://${location.host}/ws/quadros/${encodeURIComponent(id)}/?token=${encodeURIComponent(this.sessao.token)}`;
    let tentativas = 0;
    const abrir = () => {
      const ws = new WebSocket(url);
      const registro = { ws, ativo: true };
      this.sockets.set(id, registro);
      ws.onopen = () => { tentativas = 0; };
      ws.onmessage = (ev) => {
        try { aoReceber(JSON.parse(ev.data)); } catch { aoReceber({ tipo: 'invalido' }); }
      };
      ws.onclose = () => {
        if (!registro.ativo || !this.conectado) return;
        tentativas += 1;
        setTimeout(() => { if (registro.ativo) abrir(); }, Math.min(30000, 1000 * 2 ** tentativas));
      };
    };
    abrir();
    return () => this.fecharQuadro(id);
  }

  fecharQuadro(id) {
    const r = this.sockets.get(id);
    if (r) { r.ativo = false; r.ws.close(); this.sockets.delete(id); }
  }

  fecharTodos() {
    [...this.sockets.keys()].forEach((id) => this.fecharQuadro(id));
  }
}
