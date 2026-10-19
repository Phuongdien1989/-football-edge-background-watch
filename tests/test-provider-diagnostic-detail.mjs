import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {providerDiagnosticDetail as detail} from '../provider-diagnostic-detail.mjs';
const secret='NOT_A_REAL_API_KEY_123';
assert.equal(detail(null),null);assert.equal(detail({code:'OK',detail:'anything'}),null);
assert.equal(detail({code:'RATE',detail:null}),null);
const observation={code:'API_PROVIDER_RATE_LIMIT',detail:'{"rateLimit":"Too many requests. Please wait 1 minute."}'};
assert.equal(detail(observation),observation.detail);
assert.ok(!detail({code:'ERROR',detail:secret+' https://example.org/key '+secret+' person@example.org'},secret).includes(secret));
assert.ok(!detail({code:'ERROR',detail:'https://example.org/test person@example.org'}).includes('example.org'));
assert.equal(detail({code:'ERROR',detail:'x'.repeat(600)}).length,350);
const original=JSON.stringify(observation);detail(observation);assert.equal(JSON.stringify(observation),original);
// Prove removing ONLY the read-only import/field reconstructs the deployed module.
const current=readFileSync('worker_notify_v138_peak_window.js','utf8');
const restored=current.replace("import {providerDiagnosticDetail} from './provider-diagnostic-detail.mjs';\n",'').replace(',error_detail:providerDiagnosticDetail(o,this.env.APISPORTS_KEY),cache:o.cache||null','').replace("diagnostics_version:'PACING_COOLDOWN_QUOTA_V7_PAUSE_MINUTE'","diagnostics_version:'PACING_COOLDOWN_QUOTA_V6_UI_SYNC'");
const before=execFileSync('git',['show','3c97629e51251c56f9edeb8d0f67a7a0dad957a2:worker_notify_v138_peak_window.js'],{encoding:'utf8'});
assert.equal(restored,before);
console.log('READ_ONLY_PROVIDER_DETAIL_PASS: secret redaction, null/OK handling, cap, no mutations, exact runtime roundtrip');
