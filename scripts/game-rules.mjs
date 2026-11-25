import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url);
const rulesPath = new URL('firestore.rules', root);
const { outputFiles } = await build({
  stdin: {
    contents:
      "export { GAME_DEFINITIONS, metricsForGame } from './packages/contracts/index.ts';",
    resolveDir: fileURLToPath(root),
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { GAME_DEFINITIONS, metricsForGame } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`
);

const entries = Object.entries(GAME_DEFINITIONS).map(([id, game]) => {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(id)) {
    throw new Error(`ID de jogo inválido: ${id}`);
  }
  const metrics = metricsForGame(id).map(({ value }) => value);
  if (
    !metrics.length ||
    game.defaultMetrics?.some((metric) => !metrics.includes(metric))
  ) {
    throw new Error(`Métricas padrão inválidas: ${id}`);
  }
  return `        ${JSON.stringify(id)}: ${JSON.stringify({
    metrics,
    targetsPattern: game.storedTargetsPattern,
    independentHold: game.independentHold ?? false,
    requiresSets: game.requiresSets ?? false,
    report: game.report ?? null,
  })}`;
});

const start = '    // BEGIN GENERATED GAME CATALOG';
const end = '    // END GENERATED GAME CATALOG';
const rules = await readFile(rulesPath, 'utf8');
const first = rules.indexOf(start);
const last = rules.indexOf(end);
if (first < 0 || last <= first)
  throw new Error('Marcadores do catálogo ausentes');

const newline = rules.includes('\r\n') ? '\r\n' : '\n';
const catalog = [
  start,
  '    function gameCatalog() {',
  '      return {',
  entries.join(`,${newline}`),
  '      };',
  '    }',
  end,
].join(newline);
const generated =
  rules.slice(0, first) + catalog + rules.slice(last + end.length);
if (process.argv.includes('--check')) {
  if (generated !== rules)
    throw new Error(
      'Catálogo do Firestore desatualizado. Execute npm run rules:generate.'
    );
} else if (generated !== rules) {
  await writeFile(rulesPath, generated, 'utf8');
}
