const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const clamp=(value,min=0,max=100)=>Math.min(max,Math.max(min,value));

export function groupNavigation(items=[]){
  const groups=[];
  const byLabel=new Map();
  for(const item of items){
    const label=String(item?.group??'Outros');
    let group=byLabel.get(label);
    if(!group){group={label,items:[]};byLabel.set(label,group);groups.push(group);}
    group.items.push(item);
  }
  return groups.map(group=>Object.freeze({label:group.label,items:Object.freeze([...group.items])}));
}

export function resolveSpecializedScreen(screen,registry={}){
  const kind=typeof screen==='string'?screen:screen?.kind;
  return kind&&typeof registry?.[kind]==='function'?registry[kind]:null;
}

export function buildDashboardViewModel(data={}){
  const snapshot=data?.dashboard??{};
  const fields=snapshot?.fields??{};
  const operations=snapshot?.operations??{};
  const harvest=snapshot?.harvest??data?.yield??{};
  const finance=snapshot?.finance??data?.financial??{};
  const alerts=snapshot?.alerts??{};
  const inventory=snapshot?.inventory??{};
  const planning=snapshot?.planning??{};
  const total=finite(operations.total);
  const completed=finite(operations.completed);
  const inProgress=finite(operations['in-progress']);
  const planned=finite(operations.planned);
  const cancelled=finite(operations.cancelled);
  const attention=[];

  for(const alert of Array.isArray(data?.alerts)?data.alerts:[]){
    if(alert?.status&&['dismissed','resolved'].includes(alert.status))continue;
    attention.push(Object.freeze({kind:'alert',id:alert?.id??null,label:String(alert?.title??'Alerta operacional'),severity:alert?.severity??'info'}));
  }
  const lowStock=finite(inventory.lowStock);
  if(lowStock>0)attention.push(Object.freeze({kind:'stock',label:'Itens com estoque baixo',count:lowStock,severity:'warning'}));
  const conflicts=finite(planning.conflicts);
  if(conflicts>0)attention.push(Object.freeze({kind:'planning',label:'Conflitos no planejamento',count:conflicts,severity:'warning'}));

  return Object.freeze({
    kpis:Object.freeze([
      Object.freeze({id:'area',label:'Área plantada',value:finite(fields.areaHa),unit:'ha',icon:'sprout'}),
      Object.freeze({id:'operations',label:'Operações concluídas',value:completed,meta:total>0?`${total} operações registradas`:'Nenhuma operação registrada',icon:'check'}),
      Object.freeze({id:'harvest',label:'Colheita registrada',value:finite(harvest.quantity),unit:harvest.unit??'',icon:'wheat'}),
      Object.freeze({id:'result',label:'Resultado da safra',valueMinor:finite(finance.marginMinor),currency:'BRL',icon:'wallet'})
    ]),
    progress:Object.freeze({
      total,completed,inProgress,planned,cancelled,
      percent:total>0?clamp(Math.round((completed/total)*100)):0
    }),
    attention:Object.freeze(attention.slice(0,6)),
    health:Object.freeze({
      activeAlerts:finite(alerts.active),
      dueAlerts:finite(alerts.due),
      lowStock,
      planningConflicts:conflicts,
      planningProgress:clamp(finite(planning.progress)),
      fields:finite(fields.count),
      seasons:finite(snapshot?.seasons?.count)
    })
  });
}
