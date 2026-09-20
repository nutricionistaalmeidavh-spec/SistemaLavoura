import React,{useEffect,useMemo,useState} from 'react';
import {getUiContract,hydrateUiFields,referenceLabel} from './contracts.js';
import {ConfirmDialog,DataTable,KpiStrip,Modal,PageHeader,StatusBadge,StructuredForm,money,recordRows,unwrapRecord} from './primitives.jsx';

const uid=prefix=>globalThis.crypto?.randomUUID?.()??`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const date=value=>value?new Date(value).toLocaleDateString('pt-BR'):'—';
const dateTime=value=>value?new Date(value).toLocaleString('pt-BR'):'—';
const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
const plannedInputItems=(lines,references)=>((lines??[]).map((line,index)=>{
  const [namePart,quantityPart]=String(line).split('|').map(part=>part.trim());
  if(!namePart||!quantityPart)throw new Error(`Insumo planejado linha ${index+1}: use Nome | quantidade.`);
  const quantity=Number(quantityPart.replace(',','.'));
  if(!Number.isFinite(quantity)||quantity<=0)throw new Error(`Insumo planejado linha ${index+1}: informe uma quantidade positiva.`);
  const input=(references.inputOptions??[]).find(option=>fold(option.value)===fold(namePart)||fold(option.label)===fold(namePart)||fold(String(option.label).replace(/\s*\([^)]*\)\s*$/,''))===fold(namePart));
  if(!input)throw new Error(`Insumo planejado linha ${index+1}: "${namePart}" não foi encontrado no cadastro de insumos.`);
  return {inputId:String(input.value),quantity};
}));

export function LavouraOperationsWorkspace({data,onRun}){
  const contract=getUiContract('operations');
  const references=data?.references??{};
  const rows=useMemo(()=>recordRows(data),[data]);
  const checklists=useMemo(()=>(data?.checklists??[]).map(raw=>({raw,row:unwrapRecord(raw)})),[data]);
  const notebook=useMemo(()=>(data?.notebook??[]).map(raw=>({raw,row:unwrapRecord(raw)})),[data]);
  const applications=useMemo(()=>(data?.applications??[]).map(raw=>({raw,row:unwrapRecord(raw)})),[data]);
  const scouting=useMemo(()=>(data?.scouting??[]).map(raw=>({raw,row:unwrapRecord(raw)})),[data]);
  const commercial=data?.commercial??{};
  const requirements=Array.isArray(commercial.requirements)?commercial.requirements:[];
  const rainfall=Array.isArray(commercial.rainfall)?commercial.rainfall:[];
  const fieldMobile=commercial.fieldMobile??{offlineReady:false,pendingOperations:[],openScouting:[],recentRainfall:[]};
  const planningProgress=Number(data?.planningProgress??0);
  const gantt=Array.isArray(data?.gantt)?data.gantt:[];
  const columns=useMemo(()=>[
    {key:'scheduledAt',label:'Programação',render:row=>row.scheduledAt?new Date(row.scheduledAt).toLocaleString('pt-BR'):'—'},
    {key:'typeId',label:'Operação',render:row=>row.typeName??referenceLabel(references,'operationTypeOptions',row.typeId)},
    {key:'fieldId',label:'Talhão',render:row=>referenceLabel(references,'fieldOptions',row.fieldId)},
    {key:'seasonId',label:'Safra',render:row=>referenceLabel(references,'seasonOptions',row.seasonId)},
    {key:'status',label:'Status',render:row=><StatusBadge value={row.status}/>}],
    [references]);
  const ganttColumns=useMemo(()=>[
    {key:'name',label:'Atividade'},
    {key:'start',label:'Início',render:row=>date(row.start)},
    {key:'end',label:'Fim',render:row=>date(row.end)},
    {key:'progress',label:'Progresso',render:row=>`${Number(row.progress??0).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`},
    {key:'dependencies',label:'Dependências',render:row=>row.dependencies||'—'}
  ],[]);
  const applicationColumns=useMemo(()=>[
    {key:'appliedAt',label:'Aplicação',render:row=>dateTime(row.appliedAt)},
    {key:'fieldId',label:'Talhão',render:row=>referenceLabel(references,'fieldOptions',row.fieldId)},
    {key:'areaHa',label:'Área',render:row=>`${Number(row.areaHa??0).toLocaleString('pt-BR',{maximumFractionDigits:2})} ha`},
    {key:'target',label:'Alvo',render:row=>row.target??'—'},
    {key:'products',label:'Produtos / dose',render:row=>(row.products??[]).map(product=>`${product.name??referenceLabel(references,'inputOptions',product.inputId)} ${Number(product.dosePerHa??0).toLocaleString('pt-BR')} ${product.unit??''}/ha`).join(', ')||'—'}
  ],[references]);
  const scoutingColumns=useMemo(()=>[
    {key:'observedAt',label:'Observado em',render:row=>dateTime(row.observedAt)},
    {key:'fieldId',label:'Talhão',render:row=>referenceLabel(references,'fieldOptions',row.fieldId)},
    {key:'name',label:'Ocorrência'},
    {key:'kind',label:'Tipo'},
    {key:'severity',label:'Severidade',render:row=>`${Number(row.severity??0)}/5`},
    {key:'affectedAreaHa',label:'Área afetada',render:row=>row.affectedAreaHa==null?'—':`${Number(row.affectedAreaHa).toLocaleString('pt-BR',{maximumFractionDigits:2})} ha`},
    {key:'status',label:'Status'}
  ],[references]);
  const rainfallColumns=useMemo(()=>[
    {key:'measuredAt',label:'Medição',render:row=>dateTime(row.measuredAt)},
    {key:'fieldId',label:'Talhão',render:row=>row.fieldId?referenceLabel(references,'fieldOptions',row.fieldId):'Geral'},
    {key:'mm',label:'Chuva',render:row=>`${Number(row.mm??0).toLocaleString('pt-BR',{maximumFractionDigits:1})} mm`},
    {key:'source',label:'Origem'},
    {key:'notes',label:'Observações',render:row=>row.notes??'—'}
  ],[references]);
  const requirementColumns=useMemo(()=>[
    {key:'inputId',label:'Insumo',render:row=>referenceLabel(references,'inputOptions',row.inputId)},
    {key:'required',label:'Necessário',render:row=>Number(row.required??0).toLocaleString('pt-BR',{maximumFractionDigits:2})},
    {key:'available',label:'Disponível',render:row=>Number(row.available??0).toLocaleString('pt-BR',{maximumFractionDigits:2})},
    {key:'toBuy',label:'A comprar',render:row=>Number(row.toBuy??0).toLocaleString('pt-BR',{maximumFractionDigits:2})}
  ],[references]);
  const [selected,setSelected]=useState(null);
  const [dialog,setDialog]=useState(null);
  const [confirm,setConfirm]=useState(null);
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    const selectedId=selected?.row?.id;
    if(!selectedId)return;
    const fresh=rows.find(item=>String(item.row.id)===String(selectedId));
    if(!fresh){setSelected(null);return;}
    if(fresh!==selected)setSelected(fresh);
  },[rows,selected?.row?.id]);
  const selectedRow=selected?.row??null;
  const selectedChecklists=selectedRow?checklists.filter(item=>item.row.entityId===selectedRow.id):[];
  const selectedNotebook=selectedRow?notebook.filter(item=>item.row.operationId===selectedRow.id):[];
  const counts=Object.fromEntries(['planned','in-progress','completed','cancelled'].map(status=>[status,rows.filter(item=>item.row.status===status).length]));
  const kpis=[{label:'Planejadas',value:counts.planned},{label:'Em andamento',value:counts['in-progress']},{label:'Concluídas',value:counts.completed},{label:'Progresso do plano',value:`${planningProgress.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`},{label:'Conflitos',value:data?.planningConflicts?.length??0},{label:'Custo agrícola',value:money(data?.costs?.totalMinor??0)}];
  const planFields=useMemo(()=>[
    {name:'seasonId',label:'Safra',type:'select',required:true,options:references.seasonOptions??[]},
    {name:'name',label:'Nome do plano',type:'text',required:true},
    {name:'taskTitle',label:'Tarefa',type:'text',required:true},
    {name:'taskStart',label:'Início',type:'date',required:true},
    {name:'taskEnd',label:'Fim',type:'date',required:true},
    {name:'progress',label:'Progresso (%)',type:'number',min:0,max:100},
    {name:'resourceId',label:'Máquina/Recurso',type:'text'}
  ],[references]);
  const checklistFields=[{name:'title',label:'Título',type:'text',required:true},{name:'items',label:'Itens obrigatórios',type:'lines',required:true,help:'Um item por linha.'}];

  function openAction(name){setDialog({name});}
  async function submitAction(name,values){setBusy(true);try{
    let input=values;
    if(name==='schedule'){const {plannedInputs,...rest}=values;input={...rest,inputItems:plannedInputItems(plannedInputs,references)};}
    if(['start','complete','cancel'].includes(name))input={id:selectedRow?.id,...values};
    if(name==='savePlan')input={id:uid('plan'),seasonId:values.seasonId,name:values.name,tasks:[{id:uid('task'),title:values.taskTitle,start:values.taskStart,end:values.taskEnd,progress:Number(values.progress??0),resourceId:values.resourceId||null,dependencies:[]}]};
    if(name==='createChecklist')input={title:values.title,entityId:selectedRow?.id,items:(values.items??[]).map((label,index)=>({id:`item-${index+1}`,label,required:true}))};
    await onRun(name,input);setDialog(null);
  }finally{setBusy(false);}}
  async function confirmed(){const name=confirm?.name;if(!name)return;setBusy(true);try{await submitAction(name,confirm.values??{});setConfirm(null);}finally{setBusy(false);}}
  async function setChecklistItem(checklist,item){await onRun('setChecklistItem',{id:checklist.id,itemId:item.id,checked:!item.checked});}
  async function completeChecklist(checklist){await onRun('completeChecklist',{id:checklist.id});}

  const dialogAction=dialog?.name?contract.actions[dialog.name]:null;
  const dialogFields=useMemo(()=>{
    const base=hydrateUiFields(dialogAction?.fields??[],references);
    if(dialog?.name!=='schedule')return base;
    return [...base,{name:'plannedInputs',label:'Insumos planejados',type:'lines',help:'Um por linha: nome do insumo | quantidade total prevista. Ex.: Glifosato | 120'}];
  },[dialogAction,dialog?.name,references]);
  const operationName=selectedRow?(selectedRow.typeName??referenceLabel(references,'operationTypeOptions',selectedRow.typeId)):'';
  return <section className="product-workspace" data-testid="operations-workspace">
    <PageHeader eyebrow="Produção" title="Operações" description="Planeje, execute e conclua atividades de campo com estoque, custos, caderno de campo e visão operacional integrados." actions={<><button type="button" className="primary-button" onClick={()=>openAction('schedule')}>Programar operação</button><button type="button" onClick={()=>openAction('savePlan')}>Novo planejamento</button><button type="button" onClick={()=>openAction('recordApplication')}>Registrar aplicação</button><button type="button" onClick={()=>openAction('addScouting')}>Monitoramento</button><button type="button" onClick={()=>openAction('recordRainfall')}>Registrar chuva</button></>}/>
    <KpiStrip items={[...kpis,{label:'Chuva acumulada',value:`${Number(commercial.climate?.totalRainMm??0).toLocaleString('pt-BR')} mm`},{label:'Medições de chuva',value:commercial.climate?.measurements??0},{label:'Alertas inteligentes',value:commercial.alerts?.length??0}]}/>

    <div className="settings-grid"><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Planejamento</span><h3>Calendário agrícola</h3></div><span>{data?.calendar?.length??0} atividades</span></div><div className="checklist-stack">{(data?.calendar??[]).map((item,index)=><article className="checklist-card" key={item.id??index}><strong>{item.title??item.name??'Atividade planejada'}</strong><small>{item.start?new Date(item.start).toLocaleDateString('pt-BR'):'Sem data'}</small></article>)}</div></section><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Visão de campo</span><h3>Operação mobile/offline</h3></div><StatusBadge value={fieldMobile.offlineReady?'active':'inactive'}/></div><KpiStrip items={[{label:'Pronto offline',value:fieldMobile.offlineReady?'Sim':'Não'},{label:'Operações pendentes',value:fieldMobile.pendingOperations?.length??0},{label:'Monitoramentos abertos',value:fieldMobile.openScouting?.length??0},{label:'Chuvas recentes',value:fieldMobile.recentRainfall?.length??0}]}/><div className="checklist-stack">{(fieldMobile.pendingOperations??[]).map(operation=><article className="checklist-card" key={operation.id}><div><strong>{operation.typeName??referenceLabel(references,'operationTypeOptions',operation.typeId)}</strong><StatusBadge value={operation.status}/></div><small>{referenceLabel(references,'fieldOptions',operation.fieldId)} · {dateTime(operation.scheduledAt)}</small></article>)}</div></section></div>

    <section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Gantt e progresso detalhado</span><h3>Linha do tempo completa</h3></div><span>{planningProgress.toLocaleString('pt-BR',{maximumFractionDigits:1})}% concluído · {gantt.length} tarefas</span></div><DataTable columns={ganttColumns} rows={gantt} emptyTitle="Nenhuma tarefa no Gantt" emptyDescription="Crie um planejamento para acompanhar dependências e progresso."/></section>

    <div className="settings-grid"><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Necessidade futura</span><h3>Previsão de insumos</h3></div><span>{requirements.filter(item=>Number(item.toBuy)>0).length} com compra necessária</span></div><DataTable columns={requirementColumns} rows={requirements} emptyTitle="Sem necessidade futura calculada" emptyDescription="Planeje os insumos ao programar operações para calcular automaticamente necessidade, estoque disponível e compra futura."/></section><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Pluviometria</span><h3>Histórico analítico de chuva</h3></div><span>{rainfall.length} medições · {Number(commercial.climate?.totalRainMm??0).toLocaleString('pt-BR')} mm</span></div><DataTable columns={rainfallColumns} rows={rainfall} emptyTitle="Sem pluviometria registrada"/></section></div>

    <section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Histórico completo</span><h3>Aplicações agrícolas</h3></div><span>{applications.length}</span></div><DataTable columns={applicationColumns} rows={applications} emptyTitle="Nenhuma aplicação registrada"/></section>
    <section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Histórico completo</span><h3>Monitoramentos agronômicos</h3></div><span>{scouting.filter(item=>item.row.status!=='closed').length} abertos · {scouting.length} registros</span></div><DataTable columns={scoutingColumns} rows={scouting} emptyTitle="Nenhum monitoramento registrado"/></section>

    <div className="workspace-split"><div><DataTable columns={columns} rows={rows} selectedId={selectedRow?.id??null} onSelect={item=>setSelected(current=>current?.row?.id===item.row.id?null:item)} emptyTitle="Nenhuma operação programada"/></div><aside className="workspace-panel operation-detail">{selectedRow?<><div className="panel-heading"><div><span className="eyebrow">Operação selecionada</span><h3>{operationName}</h3></div><StatusBadge value={selectedRow.status}/></div><dl className="detail-list"><div><dt>Talhão</dt><dd>{referenceLabel(references,'fieldOptions',selectedRow.fieldId)}</dd></div><div><dt>Safra</dt><dd>{referenceLabel(references,'seasonOptions',selectedRow.seasonId)}</dd></div><div><dt>Programada</dt><dd>{selectedRow.scheduledAt?new Date(selectedRow.scheduledAt).toLocaleString('pt-BR'):'—'}</dd></div>{selectedRow.actualAreaHa?<div><dt>Área executada</dt><dd>{Number(selectedRow.actualAreaHa).toLocaleString('pt-BR')} ha</dd></div>:null}{selectedRow.actualCostMinor!=null?<div><dt>Custo</dt><dd>{money(selectedRow.actualCostMinor)}{selectedRow.costPerHaMinor!=null?` · ${money(selectedRow.costPerHaMinor)}/ha`:''}</dd></div>:null}</dl><div className="context-actions">{selectedRow.status==='planned'?<button type="button" onClick={()=>openAction('start')}>Iniciar</button>:null}{selectedRow.status==='in-progress'?<button type="button" className="primary-button" onClick={()=>openAction('complete')}>Concluir</button>:null}{['planned','in-progress'].includes(selectedRow.status)?<button type="button" className="danger-ghost" onClick={()=>openAction('cancel')}>Cancelar</button>:null}<button type="button" onClick={()=>openAction('createChecklist')}>Novo checklist</button></div><div className="checklist-stack"><h4>Checklists</h4>{selectedChecklists.length?selectedChecklists.map(({row})=><article className="checklist-card" key={row.id}><div><strong>{row.title}</strong><StatusBadge value={row.status}/></div>{(row.items??[]).map(item=><label key={item.id}><input type="checkbox" checked={Boolean(item.checked)} disabled={row.status==='completed'} onChange={()=>setChecklistItem(row,item)}/><span>{item.label}</span></label>)}{row.status!=='completed'?<button type="button" onClick={()=>completeChecklist(row)}>Concluir checklist</button>:null}</article>):<p className="muted">Nenhum checklist vinculado.</p>}</div><div className="checklist-stack"><h4>Caderno de campo</h4>{selectedNotebook.length?selectedNotebook.map(({row})=><article className="checklist-card" key={row.id}><div><strong>{row.operationType??'Operação agrícola'}</strong><span>{new Date(row.occurredAt).toLocaleString('pt-BR')}</span></div><small>{row.areaHa?`${Number(row.areaHa).toLocaleString('pt-BR')} ha · `:''}{row.costMinor!=null?money(row.costMinor):'Sem custo informado'}</small>{row.notes?<p>{row.notes}</p>:null}</article>):<p className="muted">A conclusão da operação gera o registro automaticamente.</p>}</div></>:<div className="workspace-empty compact"><strong>Selecione uma operação</strong><span>Veja ações, status, custos e caderno de campo.</span></div>}</aside></div>
    <Modal open={Boolean(dialogAction&&dialog?.name!=='cancel')} title={dialogAction?.label??'Ação'} description={dialog?.name==='complete'?'Ao concluir, estoque, custos e caderno de campo serão atualizados na mesma transação.':'Preencha apenas os dados necessários para esta etapa.'} onClose={()=>setDialog(null)}><StructuredForm fields={dialog?.name==='savePlan'?planFields:dialog?.name==='createChecklist'?checklistFields:dialogFields} busy={busy} submitLabel={dialogAction?.label??'Salvar'} onSubmit={values=>submitAction(dialog.name,values)} onCancel={()=>setDialog(null)}/></Modal>
    <Modal open={dialog?.name==='cancel'} title="Cancelar operação" description="Informe o motivo do cancelamento." onClose={()=>setDialog(null)}><StructuredForm fields={contract.actions.cancel.fields} busy={busy} submitLabel="Continuar" onSubmit={values=>{setConfirm({name:'cancel',values});setDialog(null);}} onCancel={()=>setDialog(null)}/></Modal>
    <ConfirmDialog open={confirm?.name==='cancel'} title="Confirmar cancelamento" description={selectedRow?`Cancelar a operação ${operationName}?`:''} confirmLabel="Cancelar operação" onCancel={()=>setConfirm(null)} onConfirm={confirmed}/>
  </section>;
}