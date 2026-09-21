import {spawn} from 'node:child_process';
import {mkdir,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {currentCommit} from './git-current.mjs';

const SPECIALIZED=Object.freeze(['p6-gis-import.spec.mjs','p7-satellite.spec.mjs','p8-map-robustness.spec.mjs']);

export function buildPlaywrightSummary({commit,exitCode,startedAt,finishedAt}){if(!/^[a-f0-9]{40}$/.test(String(commit??'')))throw new TypeError('A full git sha is required.');return Object.freeze({commit,status:Number(exitCode)===0?'passed':'failed',exitCode:Number(exitCode),startedAt,finishedAt});}

export function partitionE2eFiles(files){
  const specs=[...files].filter(name=>name.endsWith('.spec.mjs')).sort();
  for(const required of SPECIALIZED)if(!specs.includes(required))throw new Error(`Missing specialized E2E spec: ${required}`);
  return Object.freeze({
    baseline:Object.freeze(specs.filter(name=>!SPECIALIZED.includes(name)).map(name=>`tests/e2e/${name}`)),
    p6:Object.freeze(['tests/e2e/p6-gis-import.spec.mjs']),
    p7:Object.freeze(['tests/e2e/p7-satellite.spec.mjs']),
    p8:Object.freeze(['tests/e2e/p8-map-robustness.spec.mjs'])
  });
}

const run=(command,args,{env=process.env}={})=>new Promise(resolve=>{
  const child=spawn(command,args,{stdio:'inherit',shell:process.platform==='win32',env});
  child.on('exit',code=>resolve(Number(code??1)));
  child.on('error',()=>resolve(1));
});
const runPlaywright=(files,label)=>run('npx',['playwright','test',...files],{env:{...process.env,ARTISYS_QA_PARTITION:label}});

export async function runQaWeb(){
  const startedAt=new Date().toISOString(),commit=await currentCommit(),files=await readdir('tests/e2e'),partitions=partitionE2eFiles(files);
  let exitCode=partitions.baseline.length?await runPlaywright(partitions.baseline,'baseline-p0-p5'):0;
  if(exitCode===0)exitCode=await runPlaywright(partitions.p6,'p6-gis');
  if(exitCode===0)exitCode=await runPlaywright(partitions.p7,'p7-satellite');
  if(exitCode===0)exitCode=await runPlaywright(partitions.p8,'p8-map-robustness');
  const finishedAt=new Date().toISOString(),summary=buildPlaywrightSummary({commit,exitCode,startedAt,finishedAt});
  await mkdir('qa/evidence',{recursive:true});
  await writeFile(join('qa','evidence','playwright-summary.json'),`${JSON.stringify(summary,null,2)}\n`);
  return exitCode;
}

if(import.meta.url===`file://${process.argv[1]}`){process.exitCode=await runQaWeb();}