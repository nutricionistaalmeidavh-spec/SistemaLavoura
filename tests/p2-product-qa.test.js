import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const execFileAsync=promisify(execFile);const root=fileURLToPath(new URL('..',import.meta.url));
test('P2 product QA executes every P2 action and capability',async()=>{await execFileAsync(process.execPath,['tooling/qa-p2.mjs'],{cwd:root,env:{...process.env,ARTISYS_QA_KEEP:'0'}});const summary=JSON.parse(await readFile(join(root,'qa-artifacts','p2-summary.json'),'utf8'));assert.equal(summary.status,'passed');assert.equal(summary.moduleCoverage.declared,7);assert.equal(summary.moduleCoverage.passed,7);assert.deepEqual(summary.moduleCoverage.failed,[]);assert.equal(summary.actionCoverage.declared,9);assert.equal(summary.actionCoverage.exercised,9);assert.equal(summary.actionCoverage.passed,9);assert.deepEqual(summary.actionCoverage.failed,[]);assert.deepEqual(summary.actionCoverage.untested,[]);assert.equal(summary.checks.totalActionContract,37);});
