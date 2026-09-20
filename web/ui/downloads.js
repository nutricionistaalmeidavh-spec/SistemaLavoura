const safeName=value=>String(value??'arquivo').trim().replace(/[\\/:*?"<>|]+/g,'-')||'arquivo';

function triggerDownload(blob,name){
  if(typeof document==='undefined'||!globalThis.URL?.createObjectURL)throw new Error('Download requires a browser environment.');
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=safeName(name);anchor.rel='noopener';anchor.style.display='none';
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  globalThis.setTimeout(()=>URL.revokeObjectURL(url),0);
  return name;
}

const binaryBytes=value=>{
  if(value instanceof Uint8Array)return value;
  if(value instanceof ArrayBuffer)return new Uint8Array(value);
  if(Array.isArray(value))return new Uint8Array(value);
  if(value&&Array.isArray(value.data))return new Uint8Array(value.data);
  if(value&&typeof value==='object'){
    const numeric=Object.keys(value).filter(key=>/^\d+$/.test(key)).sort((a,b)=>Number(a)-Number(b));
    if(numeric.length)return new Uint8Array(numeric.map(key=>Number(value[key])));
  }
  throw new TypeError('Binary download content is invalid.');
};

export function downloadBase64File(file={}){
  const encoded=String(file.bytesBase64??'');
  if(!encoded)throw new Error('Arquivo sem conteúdo para download.');
  const raw=atob(encoded),bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i+=1)bytes[i]=raw.charCodeAt(i);
  return triggerDownload(new Blob([bytes],{type:file.mimeType||'application/octet-stream'}),file.name||'arquivo');
}

export function downloadTextFile(content,{name='arquivo.txt',mimeType='text/plain;charset=utf-8'}={}){
  return triggerDownload(new Blob([String(content??'')],{type:mimeType}),name);
}

export function downloadBinaryFile(content,{name='arquivo.bin',mimeType='application/octet-stream'}={}){
  return triggerDownload(new Blob([binaryBytes(content)],{type:mimeType}),name);
}

export function downloadExportResult(result,{format='csv',nameBase='exportacao'}={}){
  if(format==='csv')return downloadTextFile(result,{name:`${nameBase}.csv`,mimeType:'text/csv;charset=utf-8'});
  if(format==='json')return downloadTextFile(result,{name:`${nameBase}.json`,mimeType:'application/json;charset=utf-8'});
  if(format==='xlsx-model')return downloadTextFile(JSON.stringify(result,null,2),{name:`${nameBase}-modelo-planilha.json`,mimeType:'application/json;charset=utf-8'});
  return downloadTextFile(typeof result==='string'?result:JSON.stringify(result,null,2),{name:`${nameBase}.txt`});
}
