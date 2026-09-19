export const filterRows=(rows,predicate)=>rows.filter(predicate);
export function groupBy(rows,key){return rows.reduce((m,r)=>{const k=typeof key==='function'?key(r):r[key];(m[k]??=[]).push(r);return m},{})}
export function aggregate(rows,field,op='sum'){const values=rows.map(r=>Number(r[field])).filter(Number.isFinite);if(op==='count')return rows.length;if(op==='sum')return values.reduce((a,b)=>a+b,0);if(op==='avg')return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;throw new Error('unsupported aggregation')}
const esc=v=>{const s=String(v??'');return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s};
export function toCsv(rows,columns=rows.length?Object.keys(rows[0]):[]){return[columns.join(','),...rows.map(r=>columns.map(c=>esc(r[c])).join(','))].join('\n')}
