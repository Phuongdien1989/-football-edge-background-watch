import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
execFileSync(process.execPath,['ft-overview/build-integration.mjs','ft-overview/frozen-original-mobile.html'],{stdio:'inherit'});
const folder='ft-overview/build/ft-overview/';
const files=['ui.mjs','core.mjs','adapter.mjs','charts.mjs','demo.mjs','experimental-decision.mjs','live-probability.mjs','style.css'];
for(const file of files)assert(existsSync(folder+file),'MISSING_MAIN_APP_ASSET_'+file);
const ui=readFileSync(folder+'ui.mjs','utf8');
for(const name of ['experimental-decision.mjs','live-probability.mjs'])
 assert(ui.includes("'./"+name+"'"),'UNLINKED_MODULE_'+name);
const release=readFileSync('ft-overview/live-release.mjs','utf8');
for(const name of files)assert(release.includes("'"+name+"'"),'RELEASE_MISSING_'+name);
console.log('FT_V2_MAIN_APP_ASSET_INTEGRATION_PASS; production NOT deployed');
