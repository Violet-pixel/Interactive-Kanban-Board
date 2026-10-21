import { writeFileSync } from 'node:fs';
import { quadroDemonstracao } from '../web/js/demonstracao.js';
import { dataIso } from '../web/js/util.js';

const quadro = quadroDemonstracao();
quadro.id = 'qdr_demonstracao';
const saida = { formato: 'prumo', versao: 1, referencia: dataIso(new Date()), quadros: [quadro] };
writeFileSync(new URL('../exemplos/lancamento.json', import.meta.url), `${JSON.stringify(saida, null, 2)}\n`);
console.log('exemplos/lancamento.json gerado.');
