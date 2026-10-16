import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderReport } from './report.mjs';

// OpenRouter公開Decisionカタログ（2026-10-14）の要求IDと正式ID
export const MODEL_VERSIONS = {
  "scaledown/classify-1": "scaledown/classify-1-20260928",
  "microsoft/microsoft-decision-1": "microsoft/microsoft-decision-1-20261009",
  "openai/gpt-6-luna-decisions": "openai/gpt-6-luna-decisions-20261006",
  "liquid/d1": "liquid/d1-20260930",
  "typesafe/jev-1.13": "typesafe/jev-1.13-20260917",
  "cloudflare/clef-flash": "cloudflare/clef-flash",
  "cloudflare/clef": "cloudflare/clef",
  "upstage/solar-decide": "upstage/solar-decide-20260928",
  "perplexity/pplx-decider-v1.1-27b": "perplexity/pplx-decider-v1.1-27b-20261006",
  "jaredpalmer/kev-4b": "jaredpalmer/kev-4b-20260924",
  "cloudflare/clef-omni": "cloudflare/clef-omni-20261009",
  "nace-ai/drex-v2.0": "nace-ai/drex-v2.0-20261009",
  "togethercomputer/tev1-4b-experimental": "togethercomputer/tev1-4b-experimental-20260923",
  "inception/mercury-decide": "inception/mercury-decide-20260930",
  "respan/span-01": "respan/span-01-20260925"
};
export const MODELS = Object.keys(MODEL_VERSIONS);
export const ENDPOINT = 'https://openrouter.ai/api/alpha/decisions';
const ROOT = path.dirname(fileURLToPath(import.meta.url));

export function validateCases(cases) {
  if (!cases || Array.isArray(cases) || typeof cases !== 'object' || !Object.keys(cases).length) throw new Error('データは空でないJSON辞書にしてください');
  for (const [id, item] of Object.entries(cases)) {
    for (const field of ['category', 'state', 'rationale']) if (typeof item?.[field] !== 'string' || !item[field].trim()) throw new Error(`${id}: ${field} が必要です`);
    const q = item.question;
    if (!q || !['boolean', 'choice'].includes(q.type) || typeof q.instructions !== 'string' || !q.instructions.trim()) throw new Error(`${id}: 質問が不正です`);
    if (!q.criteria || typeof q.criteria !== 'object' || Array.isArray(q.criteria) || !Object.keys(q.criteria).length || Object.values(q.criteria).some(v => typeof v !== 'string' || !v.trim())) throw new Error(`${id}: 判定基準が不正です`);
    if (q.type === 'boolean' && (typeof item.expected !== 'boolean' || Object.keys(q.criteria).sort().join(',') !== 'false,true')) throw new Error(`${id}: Yes/Noの期待値・判定基準が不正です`);
    if (q.type === 'choice' && (typeof item.expected !== 'string' || !Object.hasOwn(q.criteria, item.expected) || Object.keys(q.criteria).length < 2)) throw new Error(`${id}: 分類の期待値が不正です`);
  }
  return cases;
}

export function buildRequest(model, item) {
  const { type, instructions, criteria } = item.question;
  return { model, state: item.state, questions: { decision: { type: type === 'boolean' ? 'noul' : type, instructions, criteria } } };
}
function invalid() { throw new Error('invalid_response'); }
function probability(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1; }
export function parseResponse(data, model, item) {
  if (data?.model !== model && data?.model !== MODEL_VERSIONS[model]) invalid();
  const a = data.answers?.decision;
  if (!a || a.type !== (item.question.type === 'boolean' ? 'noul' : 'choice')) invalid();
  let prediction, probabilities = null, selectedProbability;
  if (a.type === 'noul') {
    if (!probability(a.noul)) invalid();
    prediction = a.noul >= 0.5;
    selectedProbability = prediction ? a.noul : 1 - a.noul;
  } else {
    if (typeof a.choice !== 'string' || !Object.hasOwn(item.question.criteria, a.choice)) invalid();
    prediction = a.choice;
    if (a.probabilities != null) {
      const options = Object.keys(item.question.criteria);
      if (typeof a.probabilities !== 'object' || Array.isArray(a.probabilities) || Object.keys(a.probabilities).length !== options.length || options.some(k => !probability(a.probabilities[k]))) invalid();
      const sum = options.reduce((n, k) => n + a.probabilities[k], 0);
      // 各providerの丸め精度を考慮する。値の再正規化はしない。
      const decimals = Math.max(...Object.values(a.probabilities).map(p => {
        const [base, exponent = '0'] = String(p).split('e');
        return Math.max(0, (base.split('.')[1]?.length ?? 0) - Number(exponent));
      }));
      const tolerance = decimals === 0 ? 1e-6 : Math.max(1e-6, options.length * 0.5 * 10 ** -decimals);
      if (Math.abs(sum - 1) > tolerance || options.some(k => a.probabilities[k] > a.probabilities[a.choice] + 1e-6)) invalid();
      probabilities = Object.fromEntries(options.map(k => [k, a.probabilities[k]]));
      selectedProbability = probabilities[a.choice];
    } else selectedProbability = null;
  }
  const usage = {};
  for (const k of ['inputTokens', 'outputTokens']) {
    const value = data.usage?.[k === 'inputTokens' ? 'input_tokens' : 'output_tokens'];
    if (value != null && (!Number.isInteger(value) || value < 0)) invalid();
    usage[k] = value ?? null;
  }
  const costValue = data.usage?.cost;
  const cost = (typeof costValue === 'number' || (typeof costValue === 'string' && costValue.trim())) && Number.isFinite(Number(costValue)) && Number(costValue) >= 0 ? Number(costValue) : null;
  const provider = data.provider;
  const confidence = a.confidence;
  return { responseModel: data.model, prediction, correct: prediction === item.expected, probability: a.type === 'noul' ? a.noul : null, probabilities, selectedProbability, confidence: probability(confidence) ? confidence : null, usage, cost, provider: typeof provider === 'string' ? provider : null, generationId: typeof data.id === 'string' ? data.id : null };
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (p === 0.5) { const i = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[i] : (sorted[i-1] + sorted[i]) / 2; }
  return sorted[Math.ceil(p * sorted.length) - 1];
}
export function summarize(manifest, records) {
  return manifest.models.map(model => {
    const rows = records.filter(r => r.model === model);
    const valid = rows.filter(r => r.status === 'ok');
    const planned = Object.keys(manifest.cases).length * manifest.repeats;
    const correct = valid.filter(r => r.correct).length;
    const subset = ids => {
      const set = new Set(ids); const answered = valid.filter(r => set.has(r.caseId));
      return { planned: ids.length * manifest.repeats, valid: answered.length, correct: answered.filter(r => r.correct).length };
    };
    const categories = Object.fromEntries([...new Set(Object.values(manifest.cases).map(c => c.category))].map(c => [c, subset(Object.keys(manifest.cases).filter(id => manifest.cases[id].category === c))]));
    const types = Object.fromEntries(['boolean', 'choice'].map(t => [t, subset(Object.keys(manifest.cases).filter(id => manifest.cases[id].question.type === t))]));
    let consistent = 0, consistencyEligible = 0;
    if (manifest.repeats >= 2) for (const id of Object.keys(manifest.cases)) {
      const answers = valid.filter(r => r.caseId === id);
      if (answers.length === manifest.repeats && new Set(answers.map(r => r.repeat)).size === manifest.repeats) { consistencyEligible++; if (new Set(answers.map(r => r.prediction)).size === 1) consistent++; }
    }
    const timed = valid.map(r => r.latencyMs);
    const costRows = valid.filter(r => r.cost != null);
    const booleanRows = valid.filter(r => manifest.cases[r.caseId].question.type === 'boolean');
    return { model, planned, attempted: rows.length, valid: valid.length, correct, errors: rows.length - valid.length, apiSuccess: rows.filter(r => r.httpStatus >= 200 && r.httpStatus < 300).length, medianMs: percentile(timed, 0.5), p95Ms: percentile(timed, 0.95), cost: costRows.length ? costRows.reduce((n,r) => n + r.cost, 0) : null, costCount: costRows.length, consistent, consistencyEligible, falsePositive: booleanRows.filter(r => r.prediction && !manifest.cases[r.caseId].expected).length, falseNegative: booleanRows.filter(r => !r.prediction && manifest.cases[r.caseId].expected).length, categories, types };
  });
}

export async function reportOnly(outDir) {
  const manifest = JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf8'));
  const raw = await readFile(path.join(outDir, 'results.jsonl'), 'utf8');
  const records = raw.split('\n').filter(Boolean).map(line => JSON.parse(line));
  await writeFile(path.join(outDir, 'report.html'), renderReport(manifest, records, summarize(manifest, records)));
  return path.join(outDir, 'report.html');
}

export async function executeRun({ cases, models = MODELS, repeats = 2, outDir, apiKey, fetchImpl = fetch, progress = () => {} }) {
  validateCases(cases);
  if (!apiKey) throw new Error('OPENROUTER_API_KEY が未設定です');
  const caseHash = createHash('sha256').update(JSON.stringify(cases)).digest('hex');
  const manifest = { schemaVersion: 1, startedAt: new Date().toISOString(), finishedAt: null, state: 'running', stopReason: null, endpoint: ENDPOINT, service: 'OpenRouter', modelVersions: Object.fromEntries(models.map(m => [m, MODEL_VERSIONS[m]])), models, repeats, timeoutMs: 30000, threshold: 0.5, caseHash, cases };
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
  await writeFile(path.join(outDir, 'results.jsonl'), '', { flag: 'wx' });
  const records = [];
  let interrupted = false;
  let active;
  const stop = () => { interrupted = true; active?.abort(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    outer: for (let repeat = 1; repeat <= repeats; repeat++) {
      const entries = Object.entries(cases);
      for (let caseIndex = 0; caseIndex < entries.length; caseIndex++) {
        const [caseId, item] = entries[caseIndex];
        const shift = (caseIndex + repeat - 1) % models.length;
        const order = [...models.slice(shift), ...models.slice(0, shift)];
        for (const model of order) {
          if (interrupted) break outer;
          const started = performance.now();
          const row = { caseId, model, repeat, status: 'error', httpStatus: null, error: null, latencyMs: null };
          active = new AbortController();
          const timer = setTimeout(() => active.abort(), 30000);
          try {
            const response = await fetchImpl(ENDPOINT, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(buildRequest(model, item)), signal: active.signal });
            row.httpStatus = response.status;
            if (!response.ok) {
              row.error = `http_${response.status}`;
              if ([401, 403, 402].includes(response.status)) { manifest.stopReason = row.error; interrupted = true; }
              await response.body?.cancel();
            } else {
              let data;
              try { data = await response.json(); } catch { invalid(); }
              Object.assign(row, parseResponse(data, model, item), { status: 'ok' });
            }
          } catch (error) {
            row.error = error.message === 'invalid_response' ? 'invalid_response' : active.signal.aborted ? (interrupted ? 'interrupted' : 'timeout') : 'network_error';
          } finally { clearTimeout(timer); }
          row.latencyMs = Math.round((performance.now() - started) * 100) / 100;
          records.push(row);
          await appendFile(path.join(outDir, 'results.jsonl'), JSON.stringify(row) + '\n');
          progress({ completed: records.length, total: entries.length * models.length * repeats, row });
          if (interrupted) break outer;
        }
      }
    }
    manifest.state = interrupted ? 'stopped' : records.some(r => r.status !== 'ok') ? 'completed_with_errors' : 'completed';
    if (interrupted && !manifest.stopReason) manifest.stopReason = 'interrupted';
  } finally {
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    manifest.finishedAt = new Date().toISOString();
    await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await writeFile(path.join(outDir, 'report.html'), renderReport(manifest, records, summarize(manifest, records)));
  }
  return { manifest, records, summary: summarize(manifest, records) };
}

async function main() {
  const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean' }, limit: { type: 'string' }, repeats: { type: 'string', default: '2' }, models: { type: 'string' }, 'case-ids': { type: 'string' }, 'report-only': { type: 'string' }, out: { type: 'string' }, help: { type: 'boolean' } } });
  if (values.help) { console.log('node --env-file-if-exists=.env benchmark.mjs [--dry-run] [--limit N] [--repeats N] [--models ID,ID] [--case-ids ID,ID] [--out DIR]\nnode benchmark.mjs --report-only RUN_DIR'); return; }
  if (values['report-only']) { console.log(await reportOnly(path.resolve(values['report-only']))); return; }
  const all = validateCases(JSON.parse(await readFile(path.join(ROOT, 'cases.json'), 'utf8')));
  const positiveInteger = (v, name) => { if (!/^\d+$/.test(v) || !Number.isSafeInteger(Number(v)) || Number(v) < 1) throw new Error(`${name} は正の整数にしてください`); return Number(v); };
  const repeats = positiveInteger(values.repeats, 'repeats');
  const limit = values.limit ? positiveInteger(values.limit, 'limit') : Object.keys(all).length;
  const ids = values['case-ids'] ? values['case-ids'].split(',').map(s => s.trim()) : null;
  if (ids && (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !Object.hasOwn(all, id)))) throw new Error('case-ids が不正です');
  const selected = ids ? ids.map(id => [id, all[id]]) : Object.entries(all);
  const cases = Object.fromEntries(selected.slice(0, limit));
  const models = values.models ? values.models.split(',').map(s => s.trim()) : MODELS;
  if (!models.length || new Set(models).size !== models.length || models.some(m => !MODELS.includes(m))) throw new Error('models は指定の15モデルから重複なしで選んでください');
  const types = Object.fromEntries(['boolean', 'choice'].map(t => [t, Object.values(cases).filter(c => c.question.type === t).length]));
  console.log(JSON.stringify({ cases: Object.keys(cases).length, types, models, repeats, requests: Object.keys(cases).length * models.length * repeats }, null, 2));
  if (values['dry-run']) return;
  const outDir = values.out ? path.resolve(values.out) : path.join(ROOT, 'runs', new Date().toISOString().replaceAll(':','-').replaceAll('.','-'));
  const { summary, records, manifest } = await executeRun({ cases, models, repeats, outDir, apiKey: process.env.OPENROUTER_API_KEY, progress: ({ completed, total, row }) => { if (completed % 10 === 0 || row.status !== 'ok' || completed === total) console.log(`${completed}/${total} ${row.model} ${row.status}${row.error ? ' ' + row.error : ''}`); } });
  console.table(summary.map(s => ({ model: s.model, correct: `${s.correct}/${s.valid}`, errors: s.errors, medianMs: s.medianMs, p95Ms: s.p95Ms, costUSD: s.cost })));
  console.log(path.join(outDir, 'report.html'));
  if (manifest.state !== 'completed' || records.some(r => r.status !== 'ok')) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('実行できませんでした。キー設定、引数、データ、出力先を確認してください（秘密情報保護のため詳細例外は表示しません）。'); process.exitCode = 1; });
