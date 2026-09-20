import {spawn} from 'node:child_process';
import {readdir} from 'node:fs/promises';
import {basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {currentCommit,writeEvidence} from './evidence.mjs';

const summaryPath=fileURLToPath(new URL('../qa-artifacts/playwright-summary.json',import.meta.url));
const e2eDir=fileURLToPath(new URL('../tests/e2e/',import.meta.url));
const playwrightCli=fileURLToPath(new URL('../node_modules/@playwright/test/cli.js',import.meta.url));
const SPECIALIZED=Object.freeze(['p6-gis-import.spec.mjs','p7-satellite.spec.mjs']);

export function buildPlaywrightSummary({commit,exitCode,startedAt,finishedAt}){
  if(!/^[0-9a-f]{40}$/.test(commit))throw new Error('commit must be a full git sha');
  if(!Number.isInteger(exitCode))throw new Error('exitCode must be an integer');
  return{status:exitCode===0?'passed':'failed',commit,exitCode,startedAt,finishedAt};
}

export function partitionE2eFiles(files){
  const specs=[...files].filter(name=>name.endsWith('.spec.mjs')).sort();
  for(const required of SPECIALIZED)if(!specs.includes(required))throw new Error(`Missing specialized E2E spec: ${required}`);
  return Object.freeze({
    baseline:Object.freeze(specs.filter(name=>!SPECIALIZED.includes(name)).map(name=>`tests/e2e/${name}`)),
    p6:Object.freeze(['tests/e2e/p6-gis-import.spec.mjs']),
    p7:Object.freeze(['tests/e2e/p7-satellite.spec.mjs'])
  });
}

async function runPlaywright(files,label){
  console.log(`\n[qa:web] ${label}: fresh Playwright process (${files.length} spec${files.length===1?'':'s'})`);
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[playwrightCli,'test',...files],{stdio:'inherit',windowsHide:true,env:{...process.env,ARTISYS_QA_SEGMENT:label}});
    child.on('error',reject);
    child.on('close',code=>resolve(code??1));
  });
}

export async function runQaWeb(){
  const commit=await currentCommit(),startedAt=new Date().toISOString();
  let exitCode=1;
  try{
    const partitions=partitionE2eFiles(await readdir(e2eDir));
    exitCode=await runPlaywright(partitions.baseline,'baseline-p0-p5');
    if(exitCode===0)exitCode=await runPlaywright(partitions.p6,'p6-gis');
    if(exitCode===0)exitCode=await runPlaywright(partitions.p7,'p7-satellite');
  }finally{
    const finishedAt=new Date().toISOString();
    await writeEvidence(summaryPath,buildPlaywrightSummary({commit,exitCode,startedAt,finishedAt}));
  }
  return exitCode;
}

if(basename(process.argv[1]??'').toLowerCase()==='qa-web.mjs')runQaWeb().then(code=>{process.exitCode=code;}).catch(error=>{console.error(error);process.exitCode=1;});
