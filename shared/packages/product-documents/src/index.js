import {toCsv} from '../../../vendor/release-modules/artisys-reporting/src/index.mjs';
import {generatePdf} from '../../../vendor/release-modules/artisys-pdf/src/index.mjs';
const text=(v,l)=>{if(typeof v!=='string'||!v.trim())throw new TypeError(`${l} is required.`);return v.trim();};
const encoder=new TextEncoder();
const bytesOf=(content)=>{if(content instanceof Uint8Array)return content;if(content instanceof ArrayBuffer)return new Uint8Array(content);if(ArrayBuffer.isView(content))return new Uint8Array(content.buffer,content.byteOffset,content.byteLength);return encoder.encode(String(content));};
const hex=(bytes)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const digest=async(content)=>{if(!globalThis.crypto?.subtle)throw new Error('Web Crypto is required for document integrity.');return hex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytesOf(content))));};
const recordRow=(record)=>Object.freeze({collection:record.collection,id:record.id,version:record.version,createdAt:record.createdAt,updatedAt:record.updatedAt,...(record.payload&&typeof record.payload==='object'?record.payload:{value:record.payload})});
const columnHits=(rows,columns)=>rows.reduce((total,row)=>total+columns.reduce((hits,column)=>hits+(row?.[column]!==undefined?1:0),0),0);
export function createProductDocumentService({productId,definitions={},persistence=null}={}){
  const pid=text(productId,'Product id');
  const defs=Object.freeze({...definitions});
  const definition=(type)=>{const d=defs[type];if(!d)throw new Error(`Unknown document/report type: ${type}.`);return d;};
  const build=(type,rows,sourceCollection=null)=>{const d=definition(type);return Object.freeze({type,title:d.title,format:'csv',content:toCsv(rows,d.columns??[]),mimeType:'text/csv',rowCount:rows.length,sourceCollection});};
  const persistedRows=async(type,{collection=null}={})=>{
    const d=definition(type);
    if(!persistence?.listRecords)throw new Error('Persistence is required to build this report from saved data.');
    const requested=collection??d.sourceCollection??null;
    if(requested){const records=await persistence.listRecords(requested);return{collection:requested,rows:records.map(recordRow)};}
    if(typeof persistence.listCollections!=='function')throw new Error('Persistence collection discovery is required to build this report from saved data.');
    const columns=d.columns??[];
    const collections=(await persistence.listCollections()).filter((name)=>name!=='issued-documents'&&!name.startsWith('__'));
    let best={collection:null,rows:[],hits:-1};
    for(const name of collections){const rows=(await persistence.listRecords(name)).map(recordRow);const hits=columnHits(rows,columns);if(hits>best.hits||(hits===best.hits&&rows.length>best.rows.length))best={collection:name,rows,hits};}
    if(best.hits<=0)return{collection:null,rows:[]};
    return{collection:best.collection,rows:best.rows};
  };
  return Object.freeze({
    definitions:defs,
    buildCsv(type,rows){if(rows!==undefined)return build(type,rows);if(!persistence)return build(type,[]);return persistedRows(type).then(({collection,rows:storedRows})=>build(type,storedRows,collection));},
    async buildCsvFromPersistence(type,options={}){const {collection,rows}=await persistedRows(type,options);return build(type,rows,collection);},
    async buildPdf(type,{template,inputs=[],generator,plugins,options}={}){const d=definition(type);const bytes=await generatePdf({template,inputs,plugins,options,generator});return {type,title:d.title,format:'pdf',content:bytes,mimeType:'application/pdf'};},
    async issue({id,type,format,content,title=null,metadata={},issuedAt=new Date().toISOString()}={}){const d=definition(type);const binary=bytesOf(content);const record=Object.freeze({id:text(id,'Document id'),productId:pid,type,format:text(format,'Document format'),title:title??d.title,sha256:await digest(binary),size:binary.byteLength,issuedAt:new Date(issuedAt).toISOString(),metadata:Object.freeze({...metadata})});if(persistence)await persistence.putRecord('issued-documents',record.id,record,{expectedVersion:0});return record;},
    printJob(document,{copies=1,printer=null}={}){if(!Number.isSafeInteger(copies)||copies<1)throw new TypeError('Copies must be a positive integer.');return Object.freeze({documentId:document.id,productId:pid,format:document.format,copies,printer,status:'ready'});}
  });
}