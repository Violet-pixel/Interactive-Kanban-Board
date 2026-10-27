import { escapar } from '../util.js';

export const $ = (seletor, raiz = document) => raiz.querySelector(seletor);

export const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

export const seguro = (valor) => ({ __seguro: true, valor: String(valor ?? ''), toString() { return this.valor; } });

const converter = (v) => {
  if (v && v.__seguro) return v.valor;
  if (Array.isArray(v)) return v.map(converter).join('');
  if (v === false || v === null || v === undefined) return '';
  return escapar(v);
};

export const html = (partes, ...valores) => seguro(partes.reduce((s, p, i) => s + converter(valores[i - 1]) + p));

// Cores antigas (1.0) continuam salvas nos quadros; na tela elas viram a paleta do canteiro.
const CORES_1_1 = {
  '#707645': ['#2D5DA6', 'Azul linha de giz'],
  '#8C8C7A': ['#7D8791', 'Cinza concreto'],
  '#A4978B': ['#5B636C', 'Grafite claro'],
  '#5C4033': ['#23272C', 'Grafite'],
  '#D6BDB8': ['#5E9A3A', 'Verde bolha'],
  '#F6E4A6': ['#B8862C', 'Latão'],
  '#6B1F33': ['#B23A32', 'Vermelho'],
  '#3E4A2C': ['#2F7A6B', 'Verde azulado']
};

export const corExibida = (cor) => CORES_1_1[String(cor ?? '').toUpperCase()]?.[0] ?? cor;

export const nomeCor = (cor) => CORES_1_1[String(cor ?? '').toUpperCase()]?.[1] ?? cor;

export const LOGO = '<svg viewBox="0 0 100 100" aria-hidden="true"><g transform="translate(50 50) scale(0.62) translate(-50 -50)" fill="currentColor"><path d="M50 10v30" stroke="currentColor" stroke-width="4"/><rect x="38" y="38" width="24" height="8"/><path d="M34 48h32L50 90Z"/></g></svg>';

export const ICONES = {
  desfazer: '<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  refazer: '<svg viewBox="0 0 24 24"><path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/></svg>',
  sino: '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21h4"/></svg>',
  tema: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  mais: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  pontos: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
  clipe: '<svg viewBox="0 0 24 24"><path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/></svg>',
  balao: '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-12 7l-5 1 1-4a8 8 0 1 1 16-4z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg>',
  relogio: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  elo: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/></svg>',
  fechar: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  usuario: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  seta: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
  mao: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  recolher: '<svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg>',
  expandir: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  ampulheta: '<svg viewBox="0 0 24 24"><path d="M6 3h12M6 21h12M7 3c0 6 10 6 10 9s-10 3-10 9M17 3c0 6-10 6-10 9"/></svg>',
  raio: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>'
};

export const icone = (nome) => seguro(`<span class="icone">${ICONES[nome] ?? ''}</span>`);

export const avisar = (texto, tipo = 'info', duracao = 3600) => {
  const area = $('#avisos');
  if (!area) return;
  const el = document.createElement('div');
  el.className = `aviso aviso-${tipo}`;
  el.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  el.textContent = texto;
  area.appendChild(el);
  setTimeout(() => { el.classList.add('saindo'); setTimeout(() => el.remove(), 300); }, duracao);
};

export const abrirDialogo = ({ titulo, corpo, largura = 'media', aoAbrir, aoFechar, classe = '' }) => {
  const anterior = $('#dialogo');
  if (anterior.open) anterior.close();
  const dialogo = anterior.cloneNode(false);
  anterior.replaceWith(dialogo);
  dialogo.className = `dialogo dialogo-${largura} ${classe}`;
  dialogo.innerHTML = html`<div class="dialogo-topo"><h2>${titulo}</h2><button class="botao-icone" data-fechar aria-label="Fechar">${icone('fechar')}</button></div><div class="dialogo-corpo">${seguro(corpo)}</div>`;
  const fechar = () => { if (dialogo.open) dialogo.close(); };
  dialogo.onclose = () => { aoFechar?.(); dialogo.innerHTML = ''; };
  dialogo.onclick = (ev) => {
    if (ev.target === dialogo || ev.target.closest('[data-fechar]')) fechar();
  };
  if (!dialogo.open) dialogo.showModal();
  aoAbrir?.(dialogo, fechar);
  return fechar;
};

export const confirmar = (titulo, mensagem, rotulo = 'Confirmar', perigo = true) => new Promise((resolver) => {
  let resposta = false;
  abrirDialogo({
    titulo,
    largura: 'pequena',
    corpo: html`<p class="texto-confirmar">${mensagem}</p><div class="acoes-dialogo"><button class="botao" data-fechar>Cancelar</button><button class="botao ${perigo ? 'botao-perigo' : 'botao-primario'}" data-ok>${rotulo}</button></div>`,
    aoAbrir: (d, fechar) => {
      d.querySelector('[data-ok]').addEventListener('click', () => { resposta = true; fechar(); });
      d.querySelector('[data-ok]').focus();
    },
    aoFechar: () => resolver(resposta)
  });
});

export const pedirTexto = (titulo, rotulo, inicial = '', confirmarRotulo = 'Salvar') => new Promise((resolver) => {
  let resposta = null;
  abrirDialogo({
    titulo,
    largura: 'pequena',
    corpo: html`<form class="formulario" data-form><label class="campo"><span>${rotulo}</span><input id="campo-texto-dialogo" name="valor" value="${inicial}" required maxlength="140"></label><div class="acoes-dialogo"><button type="button" class="botao" data-fechar>Cancelar</button><button class="botao botao-primario">${confirmarRotulo}</button></div></form>`,
    aoAbrir: (d, fechar) => {
      const input = d.querySelector('input');
      input.focus();
      input.select();
      d.querySelector('[data-form]').addEventListener('submit', (ev) => {
        ev.preventDefault();
        resposta = input.value.trim();
        fechar();
      });
    },
    aoFechar: () => resolver(resposta)
  });
});

export const baixarArquivo = (nome, conteudo, tipo) => {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const lerArquivoTexto = (arquivo) => new Promise((resolver, rejeitar) => {
  const leitor = new FileReader();
  leitor.onload = () => resolver(leitor.result);
  leitor.onerror = () => rejeitar(leitor.error);
  leitor.readAsText(arquivo, 'utf-8');
});

export const lerArquivoUrl = (arquivo) => new Promise((resolver, rejeitar) => {
  const leitor = new FileReader();
  leitor.onload = () => resolver(leitor.result);
  leitor.onerror = () => rejeitar(leitor.error);
  leitor.readAsDataURL(arquivo);
});
