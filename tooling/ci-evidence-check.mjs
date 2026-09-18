import {readFile,readdir,stat} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {currentCommit} from './evidence.mjs';
const artifactDir=fileURLToPath(new URL('../qa-artifacts/',import.meta.url));
const releaseDir=fileURLToPath(new URL('../release/',import.meta.url));
const INSTALLER=/^ArtiSys-Lavoura-Setup-.*\.exe$/i;
const json=async p=>JSON.parse(await readFile(p,'utf8'));
export function validateCiEvidence({head,phase5,playwright}){for(const [name,item] of Object.entries({phase5,playwright})){if(item?.status!=='passed')throw new Error(`${name} evidence must be passed`);if(item?.commit!==head)throw new Error(`${name} evidence is stale`);}return true;}
export function selectCiInstaller(candidates){if(!candidates.length)throw new Error('Windows installer not found');const installer=[...candidates].sort((a,b)=>b.mtimeMs-a.mtimeMs)[0];if(installer.size<=1024*1024)throw new Error('Installer must be larger than 1 MiB');return installer;}
export async function checkCiEvidence(){const head=await currentCommit();const phase5=await json(join(artifactDir,'phase5-summary.json'));const playwright=await json(join(artifactDir,'playwright-summary.json'));validateCiEvidence({head,phase5,playwright});const names=(await readdir(releaseDir)).filter(n=>INSTALLER.test(n));const candidates=await Promise.all(names.map(async name=>{const s=await stat(join(releaseDir,name));return{name,size:s.size,mtimeMs:s.mtimeMs};}));const installer=selectCiInstaller(candidates);return{head,installer};}
if(basename(process.argv[1]??'').toLowerCase()==='ci-evidence-check.mjs')checkCiEvidence().then(({head,installer})=>console.log(`[PASS] CI evidence ${head.slice(0,12)} - ${installer.name}`)).catch(error=>{console.error(`[FAIL] CI evidence - ${error.message}`);process.exitCode=1;});
