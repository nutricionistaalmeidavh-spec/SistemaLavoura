import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const configPath=new URL('../.woodpecker/verify.yml',import.meta.url);

test('Woodpecker verify is manual-only on the available Windows local agent',async()=>{
  const yaml=await readFile(configPath,'utf8');
  assert.match(yaml,/labels:\s*[\r\n]+\s+platform:\s*windows\/amd64/);
  assert.match(yaml,/backend:\s*local/);
  assert.match(yaml,/event:\s*\[manual\]/);
  assert.doesNotMatch(yaml,/\bpush\b/);
  assert.doesNotMatch(yaml,/pull_request/);
  assert.match(yaml,/image:\s*powershell\.exe/);
  assert.doesNotMatch(yaml,/node:22-bookworm/);
  assert.doesNotMatch(yaml,/playwright install --with-deps chromium/);
  assert.match(yaml,/playwright install chromium/);
  assert.match(yaml,/npm run phase5/);
  assert.match(yaml,/npm run compat:contract/);
});
