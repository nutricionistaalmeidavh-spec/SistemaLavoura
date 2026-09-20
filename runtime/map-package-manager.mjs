import {access,mkdir,readFile,writeFile,rename,rm,stat,statfs} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {validateMapManifest} from '../src/map-package-planner.js';

const execFileAsync=promisify(execFile);
const PMTILES_VERSION='1.31.2';
const WINDOWS_X64_ASSET=Object.freeze({
  url:`https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_Windows_x86_64.zip`,
  sha256:'a658baa4d7e55020aef6ca17bd9ff9faa1582671266b36f58c52db0ac8e785a1'
});
const DEFAULT_MANIFEST_URL='https://github.com/nutricionistaalmeidavh-spec/mapasbrasilrelease/releases/latest/download/maps-manifest.json';
const PROFILE_ZOOM=Object.freeze({basic:10,detailed:12,maximum:14});
const safeId=value=>String(value??'farm').trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'farm';
const ensureBounds=bounds=>{if(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite)||bounds[0]>=bounds[2]||bounds[1]>=bounds[3])throw new TypeError('Valid farm bounds are required.');return bounds;};
const exists=async path=>{try{await access(path);return true;}catch{return false;}};
const atomicJson=async(path,value)=>{const temp=`${path}.tmp-${process.pid}-${Date.now()}`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`);await rename(temp,path);};
const sha256Buffer=buffer=>createHash('sha256').update(buffer).digest('hex');

export class MapPackageError extends Error{
  constructor(code,message,{retryable=false,cause=null}={}){
    super(message,{cause});
    this.name='MapPackageError';
    this.code=code;
    this.retryable=Boolean(retryable);
  }
}

export function normalizeMapPackageError(error,fallbackCode='MAP_RECOVERY_FAILED'){
  if(error instanceof MapPackageError)return error;
  if(error?.code==='ENOSPC')return new MapPackageError('MAP_DISK_FULL','Espaço em disco insuficiente para concluir o mapa.',{retryable:true,cause:error});
  const retryable=new Set(['MAP_CATALOG_UNAVAILABLE','MAP_SOURCE_UNAVAILABLE','MAP_EXTRACT_FAILED']);
  return new MapPackageError(fallbackCode,error?.message||'Falha no gerenciamento do mapa.',{retryable:retryable.has(fallbackCode),cause:error});
}

function profileOf(value){const profile=String(value??'detailed');if(!(profile in PROFILE_ZOOM))throw new TypeError(`Unknown map profile: ${profile}.`);return profile;}
function dateBuild(date){return date.toISOString().slice(0,10).replaceAll('-','');}

export function directFarmMapPlan({farmUnitId,farmName=null,bounds,profile='detailed',sourceUrl,sourceDate}={}){
  const selected=profileOf(profile),checkedBounds=ensureBounds(bounds),id=safeId(farmUnitId);
  if(typeof sourceUrl!=='string'||!sourceUrl.startsWith('https://'))throw new TypeError('HTTPS PMTiles source is required.');
  return Object.freeze({farmUnitId:String(farmUnitId),farmName,profile:selected,profileLabel:selected==='basic'?'Básico':selected==='detailed'?'Detalhado':'Máximo',bounds:Object.freeze([...checkedBounds]),bbox:checkedBounds.join(','),minZoom:0,maxZoom:PROFILE_ZOOM[selected],extractSource:sourceUrl,sourceDate:sourceDate??null,outputAsset:`farm-${id}-${selected}.pmtiles`,estimatedBytes:null,attribution:'Protomaps © OpenStreetMap contributors',requiresNetwork:true,localAfterInstall:true});
}

export function createMapPackageManager({dataDir,fetchImpl=globalThis.fetch,execFileImpl=execFileAsync,platform=process.platform,arch=process.arch,now=()=>new Date()}={}){
  if(typeof dataDir!=='string'||!dataDir.trim())throw new TypeError('dataDir is required.');
  if(typeof fetchImpl!=='function')throw new TypeError('fetch implementation is required.');
  const root=resolve(dataDir,'maps'),tools=join(root,'tools'),packages=join(root,'packages'),catalogPath=join(root,'catalog.json');
  const cliDir=join(tools,`pmtiles-${PMTILES_VERSION}`),cliPath=join(cliDir,'pmtiles.exe');
  let catalogCache=null;
  const active=new Set();

  async function init(){await Promise.all([mkdir(tools,{recursive:true}),mkdir(packages,{recursive:true})]);}
  async function loadCachedCatalog(){if(catalogCache)return catalogCache;if(await exists(catalogPath)){try{catalogCache=validateMapManifest(JSON.parse(await readFile(catalogPath,'utf8')));}catch{catalogCache=null;}}return catalogCache;}
  async function refreshCatalog(url=DEFAULT_MANIFEST_URL){
    await init();
    let response;
    try{response=await fetchImpl(url,{redirect:'follow'});}catch(error){throw normalizeMapPackageError(error,'MAP_CATALOG_UNAVAILABLE');}
    if(!response.ok)throw new MapPackageError('MAP_CATALOG_UNAVAILABLE',`Catálogo de mapas indisponível (${response.status}).`,{retryable:true});
    let value;
    try{value=validateMapManifest(await response.json());}catch(error){throw new MapPackageError('MAP_CATALOG_INVALID','O catálogo de mapas recebido é inválido.',{cause:error});}
    await atomicJson(catalogPath,value);
    catalogCache=value;
    return value;
  }
  async function resolveRecentSource(days=7){
    for(let offset=0;offset<days;offset+=1){const date=new Date(now());date.setUTCDate(date.getUTCDate()-offset);const build=dateBuild(date),url=`https://build.protomaps.com/${build}.pmtiles`;try{const response=await fetchImpl(url,{method:'HEAD',redirect:'follow'});if(response.ok||response.status===206)return Object.freeze({url,sourceDate:`${build.slice(0,4)}-${build.slice(4,6)}-${build.slice(6,8)}`,build});}catch{}}
    throw new MapPackageError('MAP_SOURCE_UNAVAILABLE',`Nenhum build diário do Protomaps foi encontrado nos últimos ${days} dias.`,{retryable:true});
  }
  async function ensureCli(){
    await init();if(await exists(cliPath))return cliPath;
    if(platform!=='win32'||arch!=='x64')throw new MapPackageError('MAP_UNSUPPORTED_RUNTIME','A extração automática de mapas está disponível no aplicativo desktop Windows x64.');
    await mkdir(cliDir,{recursive:true});
    let response;
    try{response=await fetchImpl(WINDOWS_X64_ASSET.url,{redirect:'follow'});}catch(error){throw normalizeMapPackageError(error,'MAP_SOURCE_UNAVAILABLE');}
    if(!response.ok)throw new MapPackageError('MAP_SOURCE_UNAVAILABLE',`Falha ao baixar a ferramenta PMTiles (${response.status}).`,{retryable:true});
    const buffer=Buffer.from(await response.arrayBuffer());const digest=sha256Buffer(buffer);if(digest!==WINDOWS_X64_ASSET.sha256)throw new MapPackageError('MAP_VERIFY_FAILED','O checksum da ferramenta PMTiles não confere.');
    const zipPath=join(cliDir,'pmtiles.zip'),expandDir=join(cliDir,'expanded');await writeFile(zipPath,buffer);await rm(expandDir,{recursive:true,force:true});await mkdir(expandDir,{recursive:true});
    await execFileImpl('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Expand-Archive -LiteralPath '${zipPath.replaceAll("'","''")}' -DestinationPath '${expandDir.replaceAll("'","''")}' -Force`],{windowsHide:true});
    const candidates=[join(expandDir,'pmtiles.exe'),join(expandDir,'pmtiles')];let source=null;for(const candidate of candidates)if(await exists(candidate)){source=candidate;break;}if(!source)throw new MapPackageError('MAP_VERIFY_FAILED','O executável PMTiles não foi encontrado no arquivo verificado.');
    await rename(source,cliPath);await rm(zipPath,{force:true});await rm(expandDir,{recursive:true,force:true});return cliPath;
  }
  async function installed(){await init();const {readdir}=await import('node:fs/promises');const names=(await readdir(packages)).filter(name=>name.endsWith('.json')).sort();const values=[];for(const name of names){try{values.push(JSON.parse(await readFile(join(packages,name),'utf8')));}catch{}}return values;}
  async function snapshot(){const catalog=await loadCachedCatalog();return Object.freeze({available:platform==='win32'&&arch==='x64',platform,arch,manifestUrl:DEFAULT_MANIFEST_URL,catalogVersion:catalog?.releaseVersion??null,catalogAvailable:Boolean(catalog),catalog:catalog?Object.freeze(catalog):null,installed:Object.freeze(await installed()),profiles:Object.freeze([{id:'basic',label:'Básico',maxZoom:10},{id:'detailed',label:'Detalhado',maxZoom:12},{id:'maximum',label:'Máximo',maxZoom:14}])});}
  async function preflight(estimatedBytes){try{const fsInfo=await statfs(packages);const available=Number(fsInfo.bavail)*Number(fsInfo.bsize);const required=Math.max(150*1024*1024,Number(estimatedBytes??0)*2.2);if(Number.isFinite(available)&&available<required)throw new Error(`Insufficient disk space: ${Math.round(available/1024/1024)} MiB available, ${Math.round(required/1024/1024)} MiB required.`);return{availableBytes:available,requiredBytes:required};}catch(error){if(/Insufficient disk space/.test(error.message))throw error;return{availableBytes:null,requiredBytes:null};}}
  async function installFarmMap(input={}){
    await init();const profile=profileOf(input.profile),bounds=ensureBounds(input.bounds),key=`${safeId(input.farmUnitId)}:${profile}`;if(active.has(key))throw new Error('This farm map is already being installed.');active.add(key);
    try{
      const cli=await ensureCli();const source=input.extractSource?{url:input.extractSource,sourceDate:input.sourceDate??null}:await resolveRecentSource();const plan=directFarmMapPlan({...input,bounds,profile,sourceUrl:source.url,sourceDate:source.sourceDate});await preflight(input.estimatedBytes);
      const finalPath=join(packages,plan.outputAsset),tempPath=`${finalPath}.part-${process.pid}-${Date.now()}.pmtiles`,backupPath=`${finalPath}.bak`;
      await rm(tempPath,{force:true});
      await execFileImpl(cli,['extract',plan.extractSource,tempPath,`--bbox=${plan.bbox}`,`--maxzoom=${plan.maxZoom}`,'--overfetch=0','--download-threads=4'],{windowsHide:true,maxBuffer:8*1024*1024});
      await execFileImpl(cli,['verify',tempPath],{windowsHide:true,maxBuffer:8*1024*1024});
      const info=await stat(tempPath);if(info.size<=0)throw new Error('Extracted farm map is empty.');
      if(await exists(finalPath)){await rm(backupPath,{force:true});await rename(finalPath,backupPath);}try{await rename(tempPath,finalPath);await rm(backupPath,{force:true});}catch(error){if(await exists(backupPath))await rename(backupPath,finalPath);throw error;}
      const record=Object.freeze({id:`farm-${safeId(input.farmUnitId)}-${profile}`,farmUnitId:String(input.farmUnitId),farmName:input.farmName??null,profile,profileLabel:plan.profileLabel,fileName:basename(finalPath),size:info.size,bounds:Object.freeze([...bounds]),minZoom:plan.minZoom,maxZoom:plan.maxZoom,sourceUrl:plan.extractSource,sourceDate:plan.sourceDate,attribution:plan.attribution,installedAt:new Date().toISOString()});
      await atomicJson(join(packages,`${record.id}.json`),record);return record;
    }finally{active.delete(key);}
  }
  async function removeFarmMap({id}={}){await init();const clean=safeId(id);if(!clean.startsWith('farm-'))throw new TypeError('Valid farm map id is required.');const metadataPath=join(packages,`${clean}.json`);if(!(await exists(metadataPath)))return{removed:false,id:clean};const metadata=JSON.parse(await readFile(metadataPath,'utf8'));await rm(join(packages,basename(metadata.fileName)),{force:true});await rm(metadataPath,{force:true});return{removed:true,id:clean};}

  return Object.freeze({snapshot,refreshCatalog,resolveRecentSource,installFarmMap,removeFarmMap,ensureCli,manifestUrl:DEFAULT_MANIFEST_URL});
}

export const MAP_PACKAGE_CONSTANTS=Object.freeze({PMTILES_VERSION,WINDOWS_X64_ASSET,DEFAULT_MANIFEST_URL});
