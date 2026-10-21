import { readFileSync } from 'node:fs';
import { lerJson } from '../web/js/csv.js';
import { resumo, temposDeFluxo, porColuna, porResponsavel, vazaoSemanal } from '../web/js/metricas.js';

const arquivo = process.argv[2];
if (!arquivo) {
  console.error('Uso: npm run relatorio -- caminho/do/quadro.json');
  process.exit(1);
}

const dias = (v) => (v === null ? '-' : `${v.toFixed(1)} d`);
const quadros = lerJson(readFileSync(arquivo, 'utf-8'));
for (const q of quadros) {
  const r = resumo(q);
  const t = temposDeFluxo(q);
  console.log(`\n${q.nome}`);
  console.log('='.repeat(q.nome.length));
  console.log(`Tarefas: ${r.total} | concluídas: ${r.concluidas} | pendentes: ${r.pendentes} | atrasadas: ${r.atrasadas}`);
  console.log(`Lead time: mediana ${dias(t.leadMediano)}, média ${dias(t.leadMedio)}`);
  console.log(`Cycle time: mediana ${dias(t.cicloMediano)}, média ${dias(t.cicloMedio)}`);
  console.log(`Throughput (8 semanas): ${vazaoSemanal(q).map((b) => b.total).join(' ')}`);
  console.log('\nColunas');
  porColuna(q).forEach((c) => console.log(`  ${c.nome.padEnd(20)} ${String(c.total).padStart(3)}${c.limiteWip ? ` / WIP ${c.limiteWip}` : ''}`));
  console.log('\nResponsáveis');
  porResponsavel(q).forEach((p) => console.log(`  ${p.nome.padEnd(20)} ${p.concluidas}/${p.total}`));
}
