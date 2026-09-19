import {buildSearchIndex,searchIndex} from '../shared/vendor/release-modules/artisys-search/src/index.mjs';

const payloads=records=>records.map(record=>record.payload);
const doc=(kind,item)=>({kind,id:String(item.id),name:item.name??item.code??item.crop??item.description??item.typeId??item.id,title:item.title??item.name??item.crop??item.description??item.id,description:[item.code,item.crop,item.description,item.category,item.status,item.typeId,item.metadata?.seasonId].filter(Boolean).join(' '),source:item});

export function createProductSearch({repos,finance}){
  if(!repos||!finance?.list)throw new TypeError('Crop repositories and finance repository are required.');
  return Object.freeze({
    async documents(){
      const [fields,seasons,operations,inputs,harvest,entries]=await Promise.all([repos.fields.list(),repos.seasons.list(),repos.operations.list(),repos.inputs.list(),repos.harvestLots.list(),finance.list()]);
      return Object.freeze([
        ...payloads(fields).map(item=>doc('field',item)),
        ...payloads(seasons).map(item=>doc('season',item)),
        ...payloads(operations).map(item=>doc('operation',item)),
        ...payloads(inputs).map(item=>doc('input',item)),
        ...payloads(harvest).map(item=>doc('harvest',item)),
        ...payloads(entries).map(item=>doc('finance',item))
      ]);
    },
    async query(query,{limit=20,kind=null}={}){const documents=await this.documents();const index=buildSearchIndex(documents,{fields:['name','title','description'],weights:{name:3,title:2,description:1}});return searchIndex(index,query,{limit,filter:kind?item=>item.kind===kind:null});}
  });
}
