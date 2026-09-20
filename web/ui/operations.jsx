import React,{useMemo,useState} from 'react';
import {getUiContract,hydrateUiFields,referenceLabel} from './contracts.js';
import {ConfirmDialog,DataTable,KpiStrip,Modal,PageHeader,StatusBadge,StructuredForm,money,recordRows,unwrapRecord} from './primitives.jsx';

const uid=prefix=>globalThis.crypto?.randomUUID?.()??`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const date=value=>value?new Date(value).toLocaleDateString('pt-BR'):'—';

export function LavouraOperationsWorkspace({data,onRun}){
  const contract=getUiContract('operations');
  const references=data?.references??{};
  const rows=useMemo(()=>recordRows(data),[data]);
  const checklists=useMemo(()=>(data?.checklists??[]).map(raw=>({raw,row:unwrapRecord(raw)})),[data]);
  const notebook=useMemo(()=>(data?.notebook??[]).map(raw=>({raw,row:unwrapRecord(raw)})),[data]);
  const applications=useMemo(()=>(data?.applications??[]).map(raw=>({raw,row:unwrapRecord(raw)})),[data]);
  const scouting=useMemo(()=>(data?.scouting??[]).map(raw=>({raw,row:unwrapRecord(raw)})),[data]);
  const planningProgress=Number(data?.planningProgress??0);
  const gantt=Array.isArray(data?.gantt)?data.gantt:[];
  const columns=useMemo(()=>[
    {key:'scheduledAt',label:'Programação',render:row=>row.scheduledAt?new Date(row.scheduledAt).toLocaleString('pt-BR'):'—'},
    {key:'typeId',label:'Operação',render:row=>row.typeName??referenceLabel(references,'operationTypeOptions',row.typeId)},
    {key:'fieldId',label:'Talhão',render:row=>referenceLabel(references,'fieldOptions',row.fieldId)},
    {key:'seasonId',label:'Safra',render:row=>referenceLabel(references,'seasonOptions',row.seasonId)},
    {key:'status',label:'Status',render:row=><StatusBadge value={row.status}/>}],
    [references]);
  const [selected,setSelected]=useState(null);
  const [dialog,setDialog]=useState(null);
  const [confirm,setConfirm]=useState(null);
  const [busy,setBusy]=useState(false);
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
    if(['start','complete','cancel'].includes(name))input={id:selectedRow?.id,...values};
    if(name==='savePlan')input={id:uid('plan'),seasonId:values.seasonId,name:values.name,tasks:[{id:uid('task'),title:values.taskTitle,start:values.taskStart,end:values.taskEnd,progress:Number(values.progress??0),resourceId:values.resourceId||null,dependencies:[]}]};
    if(name==='createChecklist')input={title:values.title,entityId:selectedRow?.id,items:(values.items??[]).map((label,index)=>({id:`item-${index+1}`,label,required:true}))};
    await onRun(name,input);setDialog(null);
  }finally{setBusy(false);}}
  async function confirmed(){const name=confirm?.name;if(!name)return;setBusy(true);try{await submitAction(name,confirm.values??{});setConfirm(null);}finally{setBusy(false);}}
  async function setChecklistItem(checklist,item){await onRun('setChecklistItem',{id:checklist.id,itemId:item.id,checked:!item.checked});}
  async function completeChecklist(checklist){await onRun('completeChecklist',{id:checklist.id});}

  const dialogAction=dialog?.name?contract.actions[dialog.name]:null;
  const dialogFields=useMemo(()=>hydrateUiFields(dialogAction?.fields??[],references),[dialogAction,references]);
  const operationName=selectedRow?(selectedRow.typeName??referenceLabel(references,'operationTypeOptions',selectedRow.typeId)):'';
  return <section className="product-workspace" data-testid="operations-workspace">
    <PageHeader eyebrow="Produção" title="Operações" description="Planeje, execute e conclua atividades de campo com estoque, custos e caderno de campo integrados." actions={<><button type="button" className="primary-button" onClick={()=>openAction('schedule')}>Programar operação</button><button type="button" onClick={()=>openAction('savePlan')}>Novo planejamento</button><button type="button" onClick={()=>openAction('recordApplication')}>Registrar aplicação</button><button type="button" onClick={()=>openAction('addScouting')}>Monitoramento</button><button type="button" onClick={()=>openAction('recordRainfall')}>Registrar chuva</button></>}/>
    <KpiStrip items={[...kpis,{label:'Chuva acumulada',value:`${Number(data?.commercial?.climate?.totalRainMm??0).toLocaleString('pt-BR')} mm`},{label:'Alertas P1',value:data?.commercial?.alerts?.length??0}]}/>

    <div className="settings-grid"><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Planejamento</span><h3>Calendário agrícola</h3></div><span>{data?.calendar?.length??0} atividades</span></div><div className="checklist-stack">{(data?.calendar??[]).slice(0,10).map((item,index)=><article className="checklist-card" key={item.id??index}><strong>{item.title??item.name??'Atividade planejada'}</strong><small>{item.start?new Date(item.start).toLocaleDateString('pt-BR'):'Sem data'}</small></article>)}</div></section><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Gantt</span><h3>Linha do tempo</h3></div><span>{planningProgress.toLocaleString('pt-BR',{maximumFractionDigits:1})}% concluído</span></div>{gantt.length?<div className="checklist-stack">{gantt.slice(0,12).map((task,index)=><article className="checklist-card" key={task.id??index}><div><strong>{task.name??'Atividade'}</strong><span>{Number(task.progress??0).toLocaleString('pt-BR')}%</span></div><small>{date(task.start)} → {date(task.end)}{task.dependencies?` · depende de ${task.dependencies}`:''}</small></article>)}</div>:<p className="muted">Nenhuma tarefa planejada para a linha do tempo.</p>}</section></div>

    <div className="settings-grid"><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Aplicações</span><h3>Aplicações registradas</h3></div><span>{applications.length}</span></div>{applications.length?<div className="checklist-stack">{applications.slice(0,10).map(({row})=><article className="checklist-card" key={row.id}><div><strong>{referenceLabel(references,'fieldOptions',row.fieldId)}</strong><span>{date(row.appliedAt)}</span></div><small>{Number(row.areaHa??0).toLocaleString('pt-BR')} ha · {(row.products??[]).map(product=>`${product.name??referenceLabel(references,'inputOptions',product.inputId)} ${product.dosePerHa}/${product.unit??''}`).join(', ')}</small>{row.target?<p>Alvo: {row.target}</p>:null}</article>)}</div>:<p className="muted">Nenhuma aplicação registrada.</p>}</section><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Monitoramento</span><h3>Pragas, doenças e ocorrências</h3></div><span>{scouting.filter(item=>item.row.status!=='closed').length} abertos</span></div>{scouting.length?<div className="checklist-stack">{scouting.slice(0,10).map(({row})=><article className="checklist-card" key={row.id}><div><strong>{row.name}</strong><span>{row.kind} · severidade {row.severity}/5</span></div><small>{referenceLabel(references,'fieldOptions',row.fieldId)} · {date(row.observedAt)} · {row.status}</small>{row.notes?<p>{row.notes}</p>:null}</article>)}</div>:<p className="muted">Nenhum monitoramento registrado.</p>}</section></div>

    <div className="workspace-split"><div><DataTable columns={columns} rows={rows} selectedId={selectedRow?.id??null} onSelect={item=>setSelected(current=>current?.row?.id===item.row.id?null:item)} emptyTitle="Nenhuma operação programada"/></div><aside className="workspace-panel operation-detail">{selectedRow?<><div className="panel-heading"><div><span className="eyebrow">Operação selecionada</span><h3>{operationName}</h3></div><StatusBadge value={selectedRow.status}/></div><dl className="detail-list"><div><dt>Talhão</dt><dd>{referenceLabel(references,'fieldOptions',selectedRow.fieldId)}</dd></div><div><dt>Safra</dt><dd>{referenceLabel(references,'seasonOptions',selectedRow.seasonId)}</dd></div><div><dt>Programada</dt><dd>{selectedRow.scheduledAt?new Date(selectedRow.scheduledAt).toLocaleString('pt-BR'):'—'}</dd></div>{selectedRow.actualAreaHa?<div><dt>Área executada</dt><dd>{Number(selectedRow.actualAreaHa).toLocaleString('pt-BR')} ha</dd></div>:null}{selectedRow.actualCostMinor!=null?<div><dt>Custo</dt><dd>{money(selectedRow.actualCostMinor)}{selectedRow.costPerHaMinor!=null?` · ${money(selectedRow.costPerHaMinor)}/ha`:''}</dd></div>:null}</dl><div className="context-actions">{selectedRow.status==='planned'?<button type="button" onClick={()=>openAction('start')}>Iniciar</button>:null}{selectedRow.status==='in-progress'?<button type="button" className="primary-button" onClick={()=>openAction('complete')}>Concluir</button>:null}{['planned','in-progress'].includes(selectedRow.status)?<button type="button" className="danger-ghost" onClick={()=>openAction('cancel')}>Cancelar</button>:null}<button type="button" onClick={()=>openAction('createChecklist')}>Novo checklist</button></div><div className="checklist-stack"><h4>Checklists</h4>{selectedChecklists.length?selectedChecklists.map(({row})=><article className="checklist-card" key={row.id}><div><strong>{row.title}</strong><StatusBadge value={row.status}/></div>{(row.items??[]).map(item=><label key={item.id}><input type="checkbox" checked={Boolean(item.checked)} disabled={row.status==='completed'} onChange={()=>setChecklistItem(row,item)}/><span>{item.label}</span></label>)}{row.status!=='completed'?<button type="button" onClick={()=>completeChecklist(row)}>Concluir checklist</button>:null}</article>):<p className="muted">Nenhum checklist vinculado.</p>}</div><div className="checklist-stack"><h4>Caderno de campo</h4>{selectedNotebook.length?selectedNotebook.map(({row})=><article className="checklist-card" key={row.id}><div><strong>{row.operationType??'Operação agrícola'}</strong><span>{new Date(row.occurredAt).toLocaleString('pt-BR')}</span></div><small>{row.areaHa?`${Number(row.areaHa).toLocaleString('pt-BR')} ha · `:''}{row.costMinor!=null?money(row.costMinor):'Sem custo informado'}</small>{row.notes?<p>{row.notes}</p>:null}</article>):<p className="muted">A conclusão da operação gera o registro automaticamente.</p>}</div></>:<div className="workspace-empty compact"><strong>Selecione uma operação</strong><span>Veja ações, status, custos e caderno de campo.</span></div>}</aside></div>
    <Modal open={Boolean(dialogAction&&dialog?.name!=='cancel')} title={dialogAction?.label??'Ação'} description={dialog?.name==='complete'?'Ao concluir, estoque, custos e caderno de campo serão atualizados na mesma transação.':'Preencha apenas os dados necessários para esta etapa.'} onClose={()=>setDialog(null)}><StructuredForm fields={dialog?.name==='savePlan'?planFields:dialog?.name==='createChecklist'?checklistFields:dialogFields} busy={busy} submitLabel={dialogAction?.label??'Salvar'} onSubmit={values=>submitAction(dialog.name,values)} onCancel={()=>setDialog(null)}/></Modal>
    <Modal open={dialog?.name==='cancel'} title="Cancelar operação" description="Informe o motivo do cancelamento." onClose={()=>setDialog(null)}><StructuredForm fields={contract.actions.cancel.fields} busy={busy} submitLabel="Continuar" onSubmit={values=>{setConfirm({name:'cancel',values});setDialog(null);}} onCancel={()=>setDialog(null)}/></Modal>
    <ConfirmDialog open={confirm?.name==='cancel'} title="Confirmar cancelamento" description={selectedRow?`Cancelar a operação ${operationName}?`:''} confirmLabel="Cancelar operação" onCancel={()=>setConfirm(null)} onConfirm={confirmed}/>
  </section>;
}
