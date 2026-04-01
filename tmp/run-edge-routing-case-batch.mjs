import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const resultDir = path.join(cwd, 'tmp', 'edge-routing-case-results');
const fixtureDir = path.join(cwd, 'src', 'core', 'persistence', '__tests__', 'fixtures', 'desktop-sky-samples');
fs.rmSync(resultDir, { recursive: true, force: true });
fs.mkdirSync(resultDir, { recursive: true });

const fixtures = fs.readdirSync(fixtureDir)
  .filter((name) => name.endsWith('.sky'))
  .sort()
  .map((name) => `sky-${path.basename(name, '.sky')}`);

const algorithm = 'legacy-plus';
const results = [];

for (const fixture of fixtures) {
  const timeoutMs = 30_000;
  const resultPath = path.join(resultDir, `${fixture}__${algorithm}.json`);
  process.stdout.write(`RUN ${fixture} ${algorithm}\n`);

  const run = spawnSync('npx', ['vitest', 'run', 'tmp/edge-routing-full-fixtures.test.ts'], {
    cwd,
    env: {
      ...process.env,
      RUN_PERF_TESTS: '1',
      EDGE_ROUTING_FIXTURE_ID: fixture,
      EDGE_ROUTING_RESULT_PATH: path.relative(cwd, resultPath),
    },
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 16,
  });

  const record = {
    fixture,
    algorithm,
    timeoutMs,
    status: 'ok',
  };

  if (run.error?.code === 'ETIMEDOUT') {
    record.status = 'timeout';
  } else if (run.status !== 0) {
    record.status = 'error';
    record.exitCode = run.status;
    record.stderr = run.stderr.trim().slice(-4000);
    record.stdout = run.stdout.trim().slice(-4000);
  }

  if (fs.existsSync(resultPath) && fs.statSync(resultPath).size > 0) {
    const parsed = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    record.row = parsed.rows[0];
  }

  results.push(record);
  process.stdout.write(
    `DONE ${fixture} ${algorithm} ${record.status}${record.row ? ` ${record.row.timeMs}ms` : ''}\n`,
  );
}

const outputPath = path.join(cwd, 'tmp', 'edge-routing-case-results-summary.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`WROTE ${outputPath}`);
