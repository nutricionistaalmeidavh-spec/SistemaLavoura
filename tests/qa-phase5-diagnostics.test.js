import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const wrapperPath = 'scripts/qa-phase5-release.ps1';

test('phase5 release QA preserves raw diagnostics and fallback summary', () => {
  assert.equal(existsSync(wrapperPath), true, 'scripts/qa-phase5-release.ps1 must exist');
  const wrapper = readFileSync(wrapperPath, 'utf8');
  assert.match(wrapper, /phase5-raw\.log/);
  assert.match(wrapper, /Write-FallbackPhase5Summary/);
  assert.match(wrapper, /lastFailure/);
  assert.match(wrapper, /phase5-summary-missing|phase5-exit-without-diagnostic/);
  assert.doesNotMatch(wrapper, /Set-StrictMode/, 'NVM4W npm.ps1 is incompatible with inherited StrictMode');
  assert.match(wrapper, /Get-Command\s+npm\.cmd/, 'Phase 5 must resolve npm.cmd directly on Windows');
  assert.match(wrapper, /&\s+\$NpmCommand\s+run\s+phase5:raw/, 'Phase 5 must invoke the resolved npm.cmd executable');
  assert.doesNotMatch(wrapper, /&\s+npm\s+run\s+phase5:raw/, 'PowerShell must not resolve the NVM4W npm.ps1 shim');
  assert.match(wrapper, /Get-Command\s+npx\.cmd/, 'Phase 5 must resolve npx.cmd directly on Windows');
  assert.match(wrapper, /--no-install\s+playwright\s+install\s+chromium/, 'Phase 5 must provision the Playwright Chromium runtime');
  assert.match(wrapper, /qa:web:browser-install/, 'Browser bootstrap failures must be reported as QA web failures');
  assert.ok(wrapper.indexOf('playwright install chromium') < wrapper.indexOf('$NpmCommand run phase5:raw'), 'Chromium must be provisioned before phase5:raw');

  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.ok(pkg.scripts['phase5:raw'], 'phase5:raw must preserve the original phase5 command');
  assert.match(pkg.scripts.phase5, /qa-phase5-release\.ps1/);

  const release = JSON.parse(readFileSync('.artisys/release.json', 'utf8'));
  assert.match(String(release.steps.qa), /qa-phase5-release\.ps1/);
});
