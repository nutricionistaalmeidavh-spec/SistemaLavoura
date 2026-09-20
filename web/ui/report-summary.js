const GROUP_FIELDS=new Set(['reportType','formatLabel','period']);
const METRICS=new Set(['documentCount','sizeKb']);
const CALCULATIONS=Object.freeze({total:'sum',average:'avg',count:'count'});

const periodLabel=value=>{
  if(!value)return 'Sem período';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return 'Sem período';
  return `${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
};

export function buildReportSummaryRequest(issuedRows=[],values={},definitions={}){
  const groupField=GROUP_FIELDS.has(values.groupBy)?values.groupBy:'reportType';
  const valueField=METRICS.has(values.metric)?values.metric:'documentCount';
  const op=CALCULATIONS[values.calculation]??'count';
  const rows=(issuedRows??[]).map(item=>{
    const row=item?.row??item??{};
    return Object.freeze({
      reportType:definitions?.[row.type]?.title??row.title??'Relatório',
      formatLabel:String(row.format??'Sem formato').toLocaleUpperCase('pt-BR'),
      period:periodLabel(row.issuedAt),
      documentCount:1,
      sizeKb:(Number(row.size)||0)/1024
    });
  });
  return Object.freeze({rows:Object.freeze(rows),groupField,valueField,op});
}

export function formatReportSummaryValue(value,values={}){
  const numeric=Number(value);
  if(!Number.isFinite(numeric))return '—';
  const formatted=numeric.toLocaleString('pt-BR',{maximumFractionDigits:2});
  if(values.metric==='sizeKb'&&values.calculation!=='count')return `${formatted} KB`;
  return formatted;
}
