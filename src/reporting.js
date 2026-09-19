import {groupBy,aggregate} from '../shared/vendor/release-modules/artisys-reporting/src/index.mjs';
import {exportRows} from '../shared/vendor/release-modules/artisys-exporter/src/index.mjs';

export function createReportingService(){
  return Object.freeze({
    summary(rows=[],{groupField=null,valueField=null,op='count'}={}){
      if(!groupField)return aggregate(rows,valueField,op);
      const groups=groupBy(rows,groupField),out={};
      for(const key of Object.keys(groups).sort())out[key]=aggregate(groups[key],valueField,op);
      return Object.freeze(out);
    },
    export(rows=[],options={}){return exportRows(rows,options);}
  });
}
