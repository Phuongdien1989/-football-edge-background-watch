import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync('ht-presentation-polish/style.css','utf8');
assert.equal(css,readFileSync('ht-early-candidate/style.css','utf8'));
assert(!/@import|url\s*\(|animation\s*:|display\s*:\s*none|visibility\s*:\s*hidden/.test(css),'HT_CONTENT_OR_EXTERNAL_REQUEST_CHANGED');
assert(!/(?:^|\})\s*(?:body|html|\.app|\.fe-lsp|\.ftabs-content)\s*\{/.test(css),'UNSCOPED_STYLE');
for(const cls of ['htp-card','htp-game','htp-decision','htp-odds','htp-state','htp-comparison','htp-values','htp-session','htp-session-prices','htp-chart','htp-disclaimer'])assert(css.includes('.'+cls),'MISSING_HT_COMPONENT_'+cls);
assert(css.includes('summary:focus-visible'));assert(css.includes('data-state=WAIT_PRICE'));assert(css.includes('font-size:15px!important'));
console.log(JSON.stringify({status:'PASS',scope:'HT CSS only',hidden_components:false,external_resources:false,animations:false,future_build_style:'IDENTICAL',algorithm_changed:false}));
