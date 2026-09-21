import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPlaywrightSummary,partitionE2eFiles} from '../tooling/qa-web.mjs';

test('playwright summary binds status to commit and exit code',()=>{const summary=buildPlaywrightSummary({commit:'a'.repeat(40),exitCode:0,startedAt:'2026-09-18T12:00:00.000Z',finishedAt:'2026-09-18T12:01:00.000Z'});assert.equal(summary.status,'passed');assert.equal(summary.commit,'a'.repeat(40));assert.equal(summary.exitCode,0);});
test('playwright summary rejects malformed commit',()=>{assert.throws(()=>buildPlaywrightSummary({commit:'bad',exitCode:1,startedAt:'x',finishedAt:'y'}),/full git sha/);});
test('qa web isolates P6 P7 and P8 in fresh Playwright processes',()=>{const partition=partitionE2eFiles(['a.spec.mjs','p6-gis-import.spec.mjs','p7-satellite.spec.mjs','p8-map-robustness.spec.mjs','notes.txt']);assert.deepEqual(partition.baseline,['tests/e2e/a.spec.mjs']);assert.deepEqual(partition.p6,['tests/e2e/p6-gis-import.spec.mjs']);assert.deepEqual(partition.p7,['tests/e2e/p7-satellite.spec.mjs']);assert.deepEqual(partition.p8,['tests/e2e/p8-map-robustness.spec.mjs']);});
test('qa web fails closed when a specialized regression spec disappears',()=>{assert.throws(()=>partitionE2eFiles(['p6-gis-import.spec.mjs','p7-satellite.spec.mjs']),/p8-map-robustness/);});