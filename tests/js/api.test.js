import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClienteApi, ErroApi } from '../../web/js/api.js';

const resposta = (status, corpo) => ({ ok: status < 400, status, text: async () => (corpo === undefined ? '' : JSON.stringify(corpo)) });

test('entrar guarda o token e envia Authorization', async () => {
  const chamadas = [];
  const fetchFn = async (url, op) => {
    chamadas.push({ url, op });
    if (url.endsWith('/auth/entrar')) return resposta(200, { token: 'abc', usuario: { nome: 'Ana' } });
    return resposta(200, []);
  };
  const api = new ClienteApi({ fetchFn });
  await api.entrar('ana@prumo.dev', 'x');
  assert.equal(api.conectado, true);
  await api.listarQuadros();
  assert.equal(chamadas[1].op.headers.Authorization, 'Bearer abc');
});

test('conflito vira ErroApi com corpo e 401 encerra a sessão', async () => {
  let status = 409;
  const api = new ClienteApi({ fetchFn: async () => resposta(status, { mensagem: 'conflito', revisao: 3 }) });
  api.sessao = { token: 't' };
  await assert.rejects(api.salvarQuadro('q', 1, {}), (e) => e instanceof ErroApi && e.status === 409 && e.corpo.revisao === 3);
  status = 401;
  await assert.rejects(api.obterQuadro('q'));
  assert.equal(api.conectado, false);
});
