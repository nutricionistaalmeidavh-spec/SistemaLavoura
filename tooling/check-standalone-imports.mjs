import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const roots=[resolve(root,'src'),resolve(root,'shared')];
const files=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())await walk(path);else if(['.js','.mjs','.cjs','.ts','.tsx'].includes(extname(entry.name)))files.push(path);}}
for(const dir of roots)await walk(dir);
const failures=[];
const importPattern=/(?:from\s*|import\s*\()(['"])([^'"]+)\1/g;
for(const file of files){const source=await readFile(file,'utf8');if(source.includes('SistemasNichadosAgroFrota'))failures.push(`${relative(root,file)}: referência ao monorepo`);for(const match of source.matchAll(importPattern)){const specifier=match[2];if(!specifier.startsWith('.'))continue;const target=resolve(dirname(file),specifier);const rel=relative(root,target);if(rel.startsWith('..')||resolve(target)===resolve(root,'..'))failures.push(`${relative(root,file)}: import escapa do repo -> ${specifier}`);}}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log(`Standalone import check: OK (${files.length} arquivos verificados)`);
