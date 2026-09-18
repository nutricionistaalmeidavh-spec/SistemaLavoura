import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const self=fileURLToPath(import.meta.url);
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const roots=['src','shared','runtime','electron','web','tests','tooling'].map(name=>resolve(root,name));
const files=[];
async function walk(dir){try{for(const entry of await readdir(dir,{withFileTypes:true})){if(['node_modules','dist','release','qa-artifacts','playwright-report'].includes(entry.name))continue;const path=resolve(dir,entry.name);if(entry.isDirectory())await walk(path);else if(['.js','.mjs','.cjs','.ts','.tsx','.jsx'].includes(extname(entry.name)))files.push(path);}}catch(error){if(error.code!=='ENOENT')throw error;}}
for(const dir of roots)await walk(dir);
const failures=[];
const forbidden=['SistemasNichadosAgroFrota','frontEnds/','../SistemasNichadosAgroFrota','../frontEnds'];
const importPattern=/(?:from\s*|import\s*\()(['"])([^'"]+)\1/g;
for(const file of files){const source=await readFile(file,'utf8');if(file!==self){for(const token of forbidden)if(source.includes(token))failures.push(`${relative(root,file)}: referência externa proibida -> ${token}`);}for(const match of source.matchAll(importPattern)){const specifier=match[2];if(!specifier.startsWith('.'))continue;const target=resolve(dirname(file),specifier);const rel=relative(root,target);if(rel.startsWith('..'))failures.push(`${relative(root,file)}: import escapa do repo -> ${specifier}`);}}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log(`Standalone import check: OK (${files.length} arquivos verificados)`);
