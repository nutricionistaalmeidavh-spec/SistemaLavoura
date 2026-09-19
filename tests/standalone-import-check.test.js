import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

const execFileAsync=promisify(execFile);
const root=fileURLToPath(new URL('..',import.meta.url));

test('standalone import checker accepts descriptive path metadata when imports stay inside the repo',async()=>{
  const {stdout,stderr}=await execFileAsync(process.execPath,['tooling/check-standalone-imports.mjs'],{cwd:root});
  assert.match(stdout,/Standalone import check: OK/);
  assert.equal(stderr,'');
});
