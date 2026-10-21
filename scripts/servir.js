import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(fileURLToPath(new URL('../web', import.meta.url)));
const porta = Number(process.env.PRUMO_PORT || process.argv[2] || 5173);
const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

const servidor = createServer(async (req, res) => {
  try {
    const caminho = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    if (caminho.startsWith('/api/')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{"mensagem":"Servidor Django não está rodando. Modo local ativo."}');
      return;
    }
    let arquivo = normalize(join(raiz, caminho));
    if (!arquivo.startsWith(raiz + sep) && arquivo !== raiz) { res.writeHead(403); res.end(); return; }
    if ((await stat(arquivo).catch(() => null))?.isDirectory()) arquivo = join(arquivo, 'index.html');
    const conteudo = await readFile(arquivo);
    res.writeHead(200, { 'Content-Type': tipos[extname(arquivo)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(conteudo);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Não encontrado');
  }
});

servidor.listen(porta, () => {
  console.log(`Prumo em modo local: http://localhost:${porta}`);
});
