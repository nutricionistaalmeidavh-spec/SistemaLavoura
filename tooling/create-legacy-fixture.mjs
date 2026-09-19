import {DatabaseSync} from 'node:sqlite';
import {mkdir,rm} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
const target=resolve(process.argv[2]??'qa-artifacts/legacy/artisys-safras-talhoes.sqlite');
await mkdir(dirname(target),{recursive:true});await rm(target,{force:true});
const db=new DatabaseSync(target);db.exec('CREATE TABLE customer_data(id TEXT PRIMARY KEY,value TEXT);');db.prepare('INSERT INTO customer_data VALUES(?,?)').run('legacy-ci','preserve-me');db.close();
process.stdout.write(`${target}\n`);
