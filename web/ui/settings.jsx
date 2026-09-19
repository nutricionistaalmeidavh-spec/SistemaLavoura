import React,{useMemo,useState} from 'react';
import {getUiContract,parseCsvText} from './contracts.js';
import {ConfirmDialog,DataTable,Modal,PageHeader,StatusBadge,StructuredForm,dateTime,recordRows,unwrapRecord} from './primitives.jsx';

const backupColumns=[{key:'createdAt',label:'Criado em',render:row=>dateTime(row.createdAt)},{key:'id',label:'Backup'}];
const catalogColumns=[{key:'name',label:'Nome'},{key:'type',label:'Tipo'},{key:'unit',label:'Unidade'},{key:'category',label:'Categoria'},{key:'active',label:'Status',render:row=><StatusBadge value={row.active===false?'inactive':'active'}/> }];
const catalogFields=[
  {name:'id',label:'ID',type:'text',required:true},
  {name:'type',label:'Tipo',type:'select',required:true,options:['crop','input','operation-type','unit','category']},
  {name:'name',label:'Nome',type:'text',required:true},
  {name:'unit',label:'Unidade',type:'text'},
  {name:'category',label:'Categoria',type:'text'},
  {name:'active',label:'Ativo',type:'checkbox'}
];
const importFields=[{name:'target',label:'Destino',type:'select',required:true,options:['fields','inputs']},{name:'csv',label:'Dados CSV',type:'textarea',required:true,help:'Use vírgulas e inclua os nomes das colunas na primeira linha.'}];

const settingValue=(key,value)=>{
  if(['inventory.lowStockThreshold','planning.lookAheadDays'].includes(key))return Number(value);
  if(key==='alerts.enabled')return value===true||String(value).toLowerCase()==='true'||String(value).toLowerCase()==='sim';
  return value;
};

export function LavouraSettingsWorkspace({data,onRun,screen}){
  const contract=getUiContract('settings');
  const available=screen?.actionDefinitions??{};
  const hasRecoveryCode=Boolean(available.recoveryCode);
  const hasRestoreByCode=Boolean(available.restoreByCode);
  const configuration=data?.configuration??{};
  const backups=useMemo(()=>recordRows(data?.backups??[]),[data]);
  const catalog=useMemo(()=>(data?.catalog??[]).map(raw=>({raw,row:unwrapRecord(raw)})),[data]);
  const flags=Object.entries(data?.featureFlags??{});
  const [dialog,setDialog]=useState(null);
  const [selectedBackup,setSelectedBackup]=useState(null);
  const [confirmRestore,setConfirmRestore]=useState(false);
  const [busy,setBusy]=useState(false);
  const [importPlan,setImportPlan]=useState(null);
  const [recoveryCode,setRecoveryCode]=useState(null);

  const preferenceInitial={inventoryLowStockThreshold:configuration['inventory.lowStockThreshold']??10,planningLookAheadDays:configuration['planning.lookAheadDays']??30,alertsEnabled:configuration['alerts.enabled']!==false,reportingCsvDelimiter:configuration['reporting.csvDelimiter']??','};
  async function mergePreferences(values){setBusy(true);try{await onRun('merge',{values:{'inventory.lowStockThreshold':Number(values.inventoryLowStockThreshold),'planning.lookAheadDays':Number(values.planningLookAheadDays),'alerts.enabled':Boolean(values.alertsEnabled),'reporting.csvDelimiter':values.reportingCsvDelimiter||','}});}finally{setBusy(false);}}
  async function setPreference(values){setBusy(true);try{await onRun('set',{key:values.key,value:settingValue(values.key,values.value)});setDialog(null);}finally{setBusy(false);}}
  async function backup(){setBusy(true);try{await onRun('backup',{});}finally{setBusy(false);}}
  async function restore(){if(!selectedBackup)return;setBusy(true);try{await onRun('restore',{id:selectedBackup.row.id});setConfirmRestore(false);setSelectedBackup(null);}finally{setBusy(false);}}
  async function makeRecoveryCode(){if(!selectedBackup||!hasRecoveryCode)return;setBusy(true);try{const result=await onRun('recoveryCode',{id:selectedBackup.row.id});setRecoveryCode(result?.code??result);setDialog('recovery-result');}finally{setBusy(false);}}
  async function restoreByCode(values){if(!hasRestoreByCode)return;setBusy(true);try{await onRun('restoreByCode',{code:values.code});setDialog(null);}finally{setBusy(false);}}
  async function previewImport(values){setBusy(true);try{const plan=await onRun('previewImport',{target:values.target,rows:parseCsvText(values.csv)});setImportPlan(plan);setDialog(null);}finally{setBusy(false);}}
  async function applyImport(){if(!importPlan?.valid)return;setBusy(true);try{await onRun('applyImport',{plan:importPlan});setImportPlan(null);}finally{setBusy(false);}}
  async function saveCatalog(values){setBusy(true);try{await onRun('upsertCatalog',values);setDialog(null);}finally{setBusy(false);}}
  async function toggleFlag(key,value){await onRun('setFeatureFlag',{key,value:!value});}

  return <section className="product-workspace settings-workspace" data-testid="settings-workspace"><PageHeader eyebrow="Sistema" title="Configurações" description="Preferências locais, segurança operacional, backup e dados auxiliares." actions={<><button type="button" disabled={busy} onClick={backup}>Criar backup</button>{hasRestoreByCode?<button type="button" onClick={()=>setDialog('restore-code')}>Restaurar por código</button>:null}</>}/>
    <div className="settings-grid"><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Preferências</span><h3>Operação do sistema</h3></div><button type="button" onClick={()=>setDialog('set')}>Alterar uma</button></div><StructuredForm fields={contract.actions.merge.fields} initialValues={preferenceInitial} busy={busy} submitLabel="Salvar preferências" onSubmit={mergePreferences}/></section>
    <section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Recursos</span><h3>Feature flags</h3></div><span>{flags.length}</span></div><div className="flag-list">{flags.map(([key,value])=><article key={key}><div><strong>{key}</strong><small>{value?'Ativo':'Desativado'}</small></div><button type="button" className={value?'toggle-button active':'toggle-button'} aria-pressed={Boolean(value)} onClick={()=>toggleFlag(key,value)}>{value?'Ligado':'Desligado'}</button></article>)}</div></section></div>
    <div className="settings-grid"><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Recuperação</span><h3>Backups locais</h3></div><span>{backups.length}</span></div><DataTable columns={backupColumns} rows={backups} selectedId={selectedBackup?.row?.id??null} onSelect={item=>setSelectedBackup(current=>current?.row?.id===item.row.id?null:item)} emptyTitle="Nenhum backup criado"/>{selectedBackup?<div className="context-actions">{hasRecoveryCode?<button type="button" onClick={makeRecoveryCode}>Gerar código</button>:null}<button type="button" className="danger-ghost" onClick={()=>setConfirmRestore(true)}>Restaurar este backup</button></div>:null}</section>
    <section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Importação</span><h3>Talhões e insumos</h3></div><button type="button" onClick={()=>setDialog('import')}>Importar CSV</button></div>{importPlan?<div className={`import-preview ${importPlan.valid?'valid':'invalid'}`}><strong>{importPlan.valid?'Importação pronta':'Revise os dados'}</strong><span>{importPlan.rows?.length??0} linhas · {importPlan.errors?.length??0} erros</span>{importPlan.errors?.length?<ul>{importPlan.errors.slice(0,5).map((error,index)=><li key={index}>Linha {Number(error.index)+2}: {error.message??error.code}</li>)}</ul>:null}{importPlan.valid?<button type="button" className="primary-button" disabled={busy} onClick={applyImport}>Aplicar importação</button>:null}</div>:<p className="muted">Importe dados em CSV sem editar estruturas técnicas.</p>}</section></div>
    <section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Catálogo agrícola</span><h3>Itens reutilizáveis</h3></div><button type="button" className="primary-button" onClick={()=>setDialog('catalog')}>Novo item</button></div><DataTable columns={catalogColumns} rows={catalog} emptyTitle="Catálogo vazio" emptyDescription="Cadastre culturas, insumos, unidades e tipos de operação."/></section>
    <Modal open={dialog==='set'} title="Alterar preferência" onClose={()=>setDialog(null)}><StructuredForm fields={contract.actions.set.fields} busy={busy} onSubmit={setPreference} onCancel={()=>setDialog(null)}/></Modal>
    {hasRestoreByCode?<Modal open={dialog==='restore-code'} title="Restaurar por código" description="Use um código de recuperação gerado anteriormente." onClose={()=>setDialog(null)}><StructuredForm fields={contract.actions.restoreByCode.fields} busy={busy} submitLabel="Restaurar" onSubmit={restoreByCode} onCancel={()=>setDialog(null)}/></Modal>:null}
    {hasRecoveryCode?<Modal open={dialog==='recovery-result'} title="Código de recuperação" onClose={()=>setDialog(null)}><div className="recovery-code"><strong>{String(recoveryCode??'—')}</strong><p>Guarde este código em local seguro.</p></div></Modal>:null}
    <Modal open={dialog==='import'} title="Importar dados" description="Cole um CSV com cabeçalho. O sistema valida antes de gravar." onClose={()=>setDialog(null)}><StructuredForm fields={importFields} busy={busy} submitLabel="Pré-visualizar" onSubmit={previewImport} onCancel={()=>setDialog(null)}/></Modal>
    <Modal open={dialog==='catalog'} title="Item do catálogo" onClose={()=>setDialog(null)}><StructuredForm fields={catalogFields} initialValues={{active:true}} busy={busy} onSubmit={saveCatalog} onCancel={()=>setDialog(null)}/></Modal>
    <ConfirmDialog open={confirmRestore} title="Restaurar backup" description={selectedBackup?`O banco local será restaurado para ${selectedBackup.row.id}.`:''} confirmLabel="Restaurar backup" onCancel={()=>setConfirmRestore(false)} onConfirm={restore}/>
  </section>;
}
