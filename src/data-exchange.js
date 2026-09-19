import {mapRow,detectDuplicates} from '../shared/vendor/release-modules/artisys-importer/src/index.mjs';
import {exportRows} from '../shared/vendor/release-modules/artisys-exporter/src/index.mjs';
import {createField,createCropInput} from './catalog.js';

const TARGETS=Object.freeze({fields:{validate:createField},inputs:{validate:createCropInput}});
const clone=value=>value==null?value:structuredClone(value);
const normalize=(target,row)=>target==='fields'?{...row,areaHa:Number(row.areaHa)}:target==='inputs'?{...row,...(row.unitCostMinor==null?{}:{unitCostMinor:Number(row.unitCostMinor)})}:row;

export function previewCropImport({target,rows=[],mapping={}}={}){
  const config=TARGETS[target];if(!config)throw new TypeError(`Unsupported import target: ${target}`);if(!Array.isArray(rows))throw new TypeError('Import rows must be an array.');
  const mapped=rows.map(source=>normalize(target,mapRow(source,mapping)));
  const errors=[];const validRows=[];
  mapped.forEach((row,index)=>{try{validRows[index]=config.validate(row);}catch(error){validRows[index]=row;errors.push({index,field:null,code:error instanceof TypeError?'required':'domain',message:error?.message??String(error)});}});
  const duplicates=detectDuplicates(mapped,{key:'id'});for(const duplicate of duplicates)errors.push({index:duplicate.index,field:'id',code:'duplicate',duplicateOf:duplicate.duplicateOf});
  return Object.freeze({target,rows:Object.freeze(validRows.map(row=>Object.freeze(clone(row)))),errors:Object.freeze(errors),duplicates:Object.freeze(duplicates),valid:errors.length===0});
}

export async function applyCropImport(plan,{repos}={}){
  if(!plan?.valid)throw new Error('Cannot apply invalid import plan.');
  const repository=repos?.[plan.target];if(!repository?.save)throw new TypeError(`Repository unavailable for import target: ${plan.target}`);
  let inserted=0;for(const row of plan.rows){await repository.save(row,{expectedVersion:0});inserted+=1;}return Object.freeze({ok:true,target:plan.target,inserted});
}
export function exportCropRows(rows=[],options={}){return exportRows(rows,options);}
