// Exact copied-test adjustment: requested seventh tab, no model assertions relaxed.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const p='mechanism-mobile/test-browser.cjs',old="assert.equal(await page.locator('[data-ftabs-tab]').count(),6);",s=readFileSync(p,'utf8');assert.equal(s.split(old).length,2);writeFileSync(p,s.replace(old,"assert.equal(await page.locator('[data-ftabs-tab]').count(),7);"));
