import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const text=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const json=async path=>JSON.parse(await text(path));

test('v1.0.0 release metadata and packaged legal resources stay coherent',async()=>{
  const pkg=await json('package.json');
  const manifest=await json('.release/v1.0.0.json');
  assert.equal(pkg.version,'1.0.0');
  assert.equal(pkg.license,'AGPL-3.0-only');
  assert.equal(manifest.version,pkg.version);
  assert.equal(manifest.tag,'v1.0.0');
  assert.equal(manifest.license,pkg.license);
  assert.equal(manifest.artifact,'ArtiSys-Lavoura-Setup-1.0.0.exe');
  assert.ok(pkg.build.extraResources.some(item=>item.from==='LICENSE'&&item.to==='LICENSE'));
  assert.ok(pkg.build.extraResources.some(item=>item.from==='TRADEMARKS.md'&&item.to==='TRADEMARKS.md'));
});

test('interactive settings surface exposes the AGPL notice and source location',async()=>{
  const settings=await text('web/ui/settings.jsx');
  assert.match(settings,/AGPL-3\.0-only/);
  assert.match(settings,/sem garantia/i);
  assert.match(settings,/github\.com\/nutricionistaalmeidavh-spec\/SistemaLavoura/);
});

test('stable release workflow refuses to replace an existing published release',async()=>{
  const workflow=await text('.github/workflows/release-v1.0.0.yml');
  assert.doesNotMatch(workflow,/--clobber/);
  assert.match(workflow,/already exists|já existe/i);
});

test('clean-install Electron smoke uses an explicit process exit code',async()=>{
  const workflow=await text('.github/workflows/release-v1.0.0.yml');
  const start=workflow.indexOf('- name: Smoke-test installer on clean Windows runner');
  const end=workflow.indexOf('- name: Generate SHA-256 checksum');
  assert.ok(start>=0&&end>start,'release workflow must contain the clean-install smoke block');
  const smoke=workflow.slice(start,end);
  assert.doesNotMatch(smoke,/\$runtimeExit\s*=\s*\$LASTEXITCODE/);
  assert.match(smoke,/\$runtimeProcess\s*=\s*Start-Process[\s\S]*?-Wait\s+-PassThru/);
  assert.match(smoke,/\$runtimeProcess\.ExitCode/);
});

test('v1.0.0 workflow reruns when its own definition changes',async()=>{
  const workflow=await text('.github/workflows/release-v1.0.0.yml');
  assert.match(workflow,/paths:[\s\S]*?\.release\/v1\.0\.0\.json[\s\S]*?\.github\/workflows\/release-v1\.0\.0\.yml/);
});

test('stable v1.0.0 publication is restricted to a push on main',async()=>{
  const workflow=await text('.github/workflows/release-v1.0.0.yml');
  assert.match(workflow,/- name: Publish immutable GitHub release\n\s+if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
});
