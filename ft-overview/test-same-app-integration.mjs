// Pure source check: fails if any FT V2 module import cannot be copied into the current app namespace.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {injectFTV2IntoCurrentShell} from './current-shell-injection.mjs';
const root=readFileSync('ft-overview/frozen-original-mobile.html','utf8');
assert.throws(()=>injectFTV2IntoCurrentShell(root),/CURRENT_SHELL_REQUIRED_FEATURE_MISSING/);
const mock='<html><body>'+('A'.repeat(20100))+' ftOverviewCard ui-tabs/integrated ht-candidate/</body></html>';
const patched=injectFTV2IntoCurrentShell(mock);
assert(patched.html.includes('ftAIV2Card'));
assert(patched.html.replace(patched.html.slice(patched.html.indexOf('<details'),patched.html.indexOf('</body>')),'')===mock);
assert.throws(()=>injectFTV2IntoCurrentShell(patched.html),/FT_V2_ALREADY_INSTALLED/);
const entry=readFileSync('ft-overview/ft-ai-v2-integrated.mjs','utf8');
for(const mod of ['core.mjs','adapter.mjs','experimental-decision.mjs','live-probability.mjs'])
 assert(entry.includes("'./"+mod+"'")&&existsSync('ft-overview/'+mod),'MISSING_V2_MODULE_'+mod);
console.log('FT_V2_SAME_APP_SHELL_ISOLATION_PASS');
