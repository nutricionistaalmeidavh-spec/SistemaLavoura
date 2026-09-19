import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const execFileAsync=promisify(execFile);
const root=fileURLToPath(new URL('..',import.meta.url));

test('phase 5 product QA executes every contracted user action',async()=>{
  await execFileAsync(process.execPath,['tooling/qa-phase5.mjs'],{cwd:root,env:{...process.env,ARTISYS_QA_KEEP:'0'}});
  const summary=JSON.parse(await readFile(join(root,'qa-artifacts','phase5-summary.json'),'utf8'));
  assert.equal(summary.status,'passed');
  assert.equal(summary.actionCoverage.declared,17);
  assert.equal(summary.actionCoverage.exercised,17);
  assert.equal(summary.actionCoverage.passed,17);
  assert.deepEqual(summary.actionCoverage.failed,[]);
  assert.deepEqual(summary.actionCoverage.untested,[]);
});
