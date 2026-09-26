import test from 'node:test';import assert from 'node:assert/strict';
import {resolveEdition,editionDefaults} from '../src/editions/index.js';import {resolveEntitlements} from '../src/entitlements.js';import {normalizeLavouraLicense} from '../src/licensing.js';
test('editions are monotonic',()=>{const e=resolveEdition('essential').capabilities,m=resolveEdition('management').capabilities,c=resolveEdition('complete').capabilities;assert.ok(e.every(x=>m.includes(x)));assert.ok(m.every(x=>c.includes(x)))});
test('essential excludes management and advanced capabilities',()=>{const f=editionDefaults('essential');assert.equal(f['capability.fields'],true);assert.equal(f['capability.finance'],false);assert.equal(f['capability.satellite'],false)});
test('management includes management but excludes advanced precision capabilities',()=>{const f=editionDefaults('management');assert.equal(f['capability.finance'],true);assert.equal(f['capability.pdf'],undefined);assert.equal(f['capability.reports.pdf'],true);assert.equal(f['capability.gis'],false);assert.equal(f['capability.iot'],false)});
test('complete enables all declared capabilities',()=>{assert.ok(Object.values(editionDefaults('complete')).every(Boolean))});
test('license feature overrides edition default',()=>{const e=resolveEntitlements({edition:'essential',licenseFeatures:{'capability.pdf':true}});assert.equal(e.enabled('pdf'),true);assert.equal(e.enabled('finance'),false)});
test('lavoura license validates product and edition',()=>{assert.equal(normalizeLavouraLicense({product:'artisys-lavoura',edition:'management'}).edition,'management');assert.throws(()=>normalizeLavouraLicense({product:'other',edition:'complete'}))});

import {canUpgradeEdition,applyLicenseUpgrade} from '../src/license-upgrade.js';
import {capabilityForScreen,assertEntitled} from '../src/edition-policy.js';
test('edition policy rejects unavailable screen',()=>{const e=resolveEntitlements({edition:'essential'});assert.throws(()=>assertEntitled(e,capabilityForScreen('finance')),(x)=>x.code==='EDITION_FORBIDDEN')});
test('upgrade path is monotonic and preserves product',()=>{assert.equal(canUpgradeEdition('essential','management'),true);assert.equal(canUpgradeEdition('management','essential'),false);const next=applyLicenseUpgrade({product:'artisys-lavoura',edition:'essential'},{product:'artisys-lavoura',edition:'complete'});assert.equal(next.edition,'complete')});
