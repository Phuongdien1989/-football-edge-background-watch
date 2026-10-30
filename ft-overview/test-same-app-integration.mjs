import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {injectFTV2IntoCurrentShell} from './current-shell-injection.mjs';
const current='<html><head></head><body>'+('A'.repeat(21000))+' ftOverviewCard ui-tabs/integrated ht-candidate/ <script src="/ft-ai-v2/integrated.mjs"></script></body></html>';
const v=injectFTV2IntoCurrentShell(current);
assert(v.html.includes('light-signal-pro.css'));
assert.equal(v.html.replace('<link rel="stylesheet" href="/ft-ai-v2/light-signal-pro.css">\n',''),current);
assert.equal(injectFTV2IntoCurrentShell(v.html).html,v.html);
assert.throws(()=>injectFTV2IntoCurrentShell(current.replace('ftOverviewCard','missing')),/REQUIRED_CURRENT_FEATURE_MISSING/);
const entry=readFileSync('ft-overview/ft-ai-v2-integrated.mjs','utf8');
for(const mod of ['core.mjs','adapter.mjs','experimental-decision.mjs','live-probability.mjs','light-signal-pro-view.mjs'])
 assert(entry.includes("'./"+mod+"'")&&existsSync('ft-overview/'+mod),'MISSING_V2_MODULE_'+mod);
assert(entry.includes('fe-ft-v2-tab-open'));
console.log('LIGHT_SIGNAL_PRO_CURRENT_SIX_TAB_SHELL_PASS');