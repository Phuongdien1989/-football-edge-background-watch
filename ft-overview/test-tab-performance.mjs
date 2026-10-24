import assert from 'node:assert/strict';
import {patchMechanismTabs} from './patch-mechanism-tabs.mjs';
const live="import {renderSignalMechanism} from '../ft-ai-v2/light-signal-mechanisms.mjs';\nconst tabs=[['ftv2','FT AI V2']];/* FE_TAB_PERF_V2 */";
const p=patchMechanismTabs(live);assert(p.unchanged===true&&p.anchors===0&&p.code===live);console.log('PRESERVE_EXISTING_TAB_PERF_PASS');
