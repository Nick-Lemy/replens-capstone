import { appendFileSync } from 'node:fs';

const keys = ['ACTIONS_RUNTIME_TOKEN', 'ACTIONS_RESULTS_URL', 'ACTIONS_CACHE_URL'];
const escapeCommandValue = (value) =>
  value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');

const runtime = Object.fromEntries(keys.map((key) => [key, process.env[key] ?? '']));
if (!runtime.ACTIONS_RUNTIME_TOKEN || !(runtime.ACTIONS_RESULTS_URL || runtime.ACTIONS_CACHE_URL)) {
  console.error('GitHub Actions cache runtime is unavailable.');
  process.exit(1);
}

for (const [key, value] of Object.entries(runtime)) {
  if (!value) continue;
  if (/[\r\n]/.test(value)) {
    console.error(`Invalid multiline GitHub Actions cache value: ${key}`);
    process.exit(1);
  }
  process.stdout.write(`::add-mask::${escapeCommandValue(value)}\n`);
  appendFileSync(process.env.GITHUB_ENV, `${key}=${value}\n`, { mode: 0o600 });
}
