import React,{useMemo,useState} from 'react';
import {ConfirmDialog,DataTable,KpiStrip,Modal,PageHeader,StatusBadge,StructuredForm,dateTime} from './primitives.jsx';

const ROLE_LABELS=Object.freeze({admin:'Administrador',manager:'Gestor','field-operator':'Operador de campo',warehouse:'Estoque',viewer:'Consulta'});
const PERMISSION_LABELS=Object.freeze({
  '*':'Acesso total',
  'crop:read':'Consultar produção','crop:write':'Alterar produção',
  'inventory:read':'Consultar estoque','inventory:write':'Alterar estoque',
  'finance:read':'Consultar financeiro','reports:read':'Consultar relatórios',
  'users:read':'Consultar usuários','users:write':'Administrar usuários',
  'audit:read':'Consultar auditoria','session:revoke':'Gerenciar a própria sessão',
  'settings:read':'Consultar configurações','settings:write':'Alterar configurações',
  'backup:write':'Criar backup','backup:restore':'Restaurar backup'
});
const roleLabel=value=>ROLE_LABELS[value]??String(value??'—');
const permissionLabel=value=>PERMISSION_LABELS[value]??String(value??'').replaceAll(':',' · ').replaceAll('-',' ');
const auditAction=value=>({
  'users.bootstrap':'Administrador inicial criado','users.create':'Usuário criado','users.roles':'Papéis alterados','users.active':'Status do usuário alterado','users.password-change':'Senha alterada',
  'session.login:success':'Login realizado','session.login:failure':'Falha de login','session.revoke':'Sessão encerrada'
}[value]??String(value??'—').replaceAll('.',' · ').replaceAll(':',' · '));

export function LavouraAdminWorkspace({data,onRun}){
  const users=Array.isArray(data?.users)?data.users:[];
  const roles=Array.isArray(data?.roles)?data.roles:[];
  const audit=Array.isArray(data?.audit)?data.audit:[];
  const currentUser=data?.currentUser??null;
  const capabilities=data?.capabilities??{};
  const [tab,setTab]=useState('users');
  const [selectedId,setSelectedId]=useState(null);
  const [dialog,setDialog]=useState(null);
  const [confirm,setConfirm]=useState(false);
  const [busy,setBusy]=useState(false);
  const [auditQuery,setAuditQuery]=useState('');
  const selected=users.find(user=>user.id===selectedId)??null;
  const userNames=useMemo(()=>new Map(users.map(user=>[user.id,user.username])),[users]);
  const roleOptions=useMemo(()=>roles.map(role=>({value:role.id,label:roleLabel(role.id)})),[roles]);
  const filteredAudit=useMemo(()=>{
    const query=auditQuery.trim().toLocaleLowerCase('pt-BR');
    if(!query)return audit;
    return audit.filter(entry=>[entry.action,entry.actorId,entry.entityType,entry.entityId,userNames.get(entry.actorId)].some(value=>String(value??'').toLocaleLowerCase('pt-BR').includes(query)));
  },[audit,auditQuery,userNames]);

  const userColumns=useMemo(()=>[
    {key:'username',label:'Usuário'},
    {key:'roles',label:'Papéis',render:row=>(row.roles??[]).map(roleLabel).join(', ')||'Sem papel'},
    {key:'active',label:'Status',render:row=><StatusBadge value={row.active?'active':'inactive'}/>}
  ],[]);
  const auditColumns=useMemo(()=>[
    {key:'at',label:'Data',render:row=>dateTime(row.at)},
    {key:'actorId',label:'Responsável',render:row=>userNames.get(row.actorId)??row.actorId??'Sistema'},
    {key:'action',label:'Evento',render:row=>auditAction(row.action)},
    {key:'entityId',label:'Registro',render:row=>row.entityId??row.entityType??'—'}
  ],[userNames]);
  const createFields=useMemo(()=>[
    {name:'username',label:'Usuário',type:'text',required:true},
    {name:'password',label:'Senha inicial',type:'password',required:true,autoComplete:'new-password',help:'Use pelo menos 8 caracteres.'},
    {name:'roles',label:'Papéis',type:'multiselect',required:true,options:roleOptions},
    {name:'active',label:'Ativo',type:'checkbox'}
  ],[roleOptions]);
  const roleFields=useMemo(()=>[{name:'roles',label:'Papéis',type:'multiselect',required:true,options:roleOptions}],[roleOptions]);
  const passwordFields=useMemo(()=>[
    {name:'currentPassword',label:'Senha atual',type:'password',required:true,autoComplete:'current-password'},
    {name:'newPassword',label:'Nova senha',type:'password',required:true,autoComplete:'new-password'},
    {name:'confirmPassword',label:'Confirmar nova senha',type:'password',required:true,autoComplete:'new-password'}
  ],[]);

  async function createUser(values){setBusy(true);try{await onRun('createUser',{username:values.username,password:values.password,roles:values.roles??[],active:values.active!==false});setDialog(null);}finally{setBusy(false);}}
  async function setUserRoles(values){if(!selected)return;setBusy(true);try{await onRun('setUserRoles',{userId:selected.id,roles:values.roles??[]});setDialog(null);}finally{setBusy(false);}}
  async function setUserActive(){if(!selected||selected.id===currentUser?.id)return;setBusy(true);try{await onRun('setUserActive',{userId:selected.id,active:!selected.active});setConfirm(false);}finally{setBusy(false);}}
  async function changePassword(values){if(values.newPassword!==values.confirmPassword)throw new Error('A confirmação da nova senha não confere.');if(String(values.newPassword??'').length<8)throw new Error('A nova senha deve ter pelo menos 8 caracteres.');setBusy(true);try{await onRun('changePassword',{currentPassword:values.currentPassword,newPassword:values.newPassword});}finally{setBusy(false);}}

  const activeUsers=users.filter(user=>user.active).length;
  return <section className="product-workspace" data-testid="admin-workspace">
    <PageHeader eyebrow="Sistema" title="Administração" description="Controle local de usuários, papéis de acesso, auditoria e segurança da conta." actions={capabilities.usersWrite?<button type="button" className="primary-button" onClick={()=>setDialog('create')}>Novo usuário</button>:null}/>
    <KpiStrip items={[{label:'Usuários',value:users.length},{label:'Ativos',value:activeUsers},{label:'Papéis',value:roles.length},{label:'Eventos auditados',value:audit.length}]}/>

    <div className="context-actions" role="tablist" aria-label="Administração">
      <button type="button" className={tab==='users'?'active':''} onClick={()=>setTab('users')}>Usuários</button>
      <button type="button" className={tab==='roles'?'active':''} onClick={()=>setTab('roles')}>Papéis e permissões</button>
      {capabilities.auditRead?<button type="button" className={tab==='audit'?'active':''} onClick={()=>setTab('audit')}>Auditoria</button>:null}
      {capabilities.passwordChange?<button type="button" className={tab==='password'?'active':''} onClick={()=>setTab('password')}>Alterar minha senha</button>:null}
    </div>

    {tab==='users'?<div className="workspace-split"><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Acesso local</span><h3>Usuários</h3></div><span>{users.length}</span></div><DataTable columns={userColumns} rows={users} selectedId={selectedId} onSelect={item=>setSelectedId(current=>current===item.id?null:item.id)} emptyTitle="Nenhum usuário"/></section><aside className="workspace-panel">{selected?<><div className="panel-heading"><div><span className="eyebrow">Usuário selecionado</span><h3>{selected.username}</h3></div><StatusBadge value={selected.active?'active':'inactive'}/></div><dl className="detail-list"><div><dt>Papéis</dt><dd>{(selected.roles??[]).map(roleLabel).join(', ')||'Sem papel'}</dd></div><div><dt>Acesso</dt><dd>{selected.active?'Liberado':'Bloqueado'}</dd></div></dl>{capabilities.usersWrite?<div className="context-actions"><button type="button" onClick={()=>setDialog('roles')}>Alterar papéis</button>{selected.id!==currentUser?.id?<button type="button" className={selected.active?'danger-ghost':''} onClick={()=>setConfirm(true)}>{selected.active?'Desativar usuário':'Ativar usuário'}</button>:null}</div>:<p className="muted">Seu perfil permite consulta, mas alterações de usuários exigem Administrador.</p>}</>:<div className="workspace-empty compact"><strong>Selecione um usuário</strong><span>Veja papéis, status e controles de acesso.</span></div>}</aside></div>:null}

    {tab==='roles'?<section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">RBAC local</span><h3>Papéis e permissões</h3></div><span>{roles.length} perfis</span></div><div className="checklist-stack">{roles.map(role=><article className="checklist-card" key={role.id}><div><strong>{roleLabel(role.id)}</strong><span>{role.permissions?.includes('*')?'Acesso total':`${role.permissions?.length??0} permissões`}</span></div><div className="context-actions">{(role.permissions??[]).map(permission=><span className="status-badge status-neutral" key={permission}>{permissionLabel(permission)}</span>)}</div></article>)}</div></section>:null}

    {tab==='audit'&&capabilities.auditRead?<section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Rastreabilidade</span><h3>Auditoria</h3></div><span>{filteredAudit.length} eventos</span></div><label className="search-field"><span>Filtrar auditoria</span><input aria-label="Filtrar auditoria" value={auditQuery} onChange={event=>setAuditQuery(event.target.value)} placeholder="Usuário, evento ou registro"/></label><DataTable columns={auditColumns} rows={filteredAudit} emptyTitle="Nenhum evento de auditoria" emptyDescription="As operações administrativas e de negócio são registradas localmente."/></section>:null}

    {tab==='password'&&capabilities.passwordChange?<section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">Minha conta</span><h3>Alterar minha senha</h3></div><span>{currentUser?.username}</span></div><p className="muted">Ao trocar a senha, esta sessão será encerrada e será necessário entrar novamente.</p><StructuredForm fields={passwordFields} busy={busy} submitLabel="Alterar senha e sair" onSubmit={changePassword}/></section>:null}

    <Modal open={dialog==='create'} title="Novo usuário" description="A conta é criada somente neste banco local." onClose={()=>setDialog(null)}><StructuredForm fields={createFields} initialValues={{active:true,roles:['viewer']}} busy={busy} submitLabel="Criar usuário" onSubmit={createUser} onCancel={()=>setDialog(null)}/></Modal>
    <Modal open={dialog==='roles'&&Boolean(selected)} title="Alterar papéis" description={selected?`Defina o acesso de ${selected.username}.`:''} onClose={()=>setDialog(null)}><StructuredForm fields={roleFields} initialValues={{roles:selected?.roles??[]}} busy={busy} submitLabel="Salvar papéis" onSubmit={setUserRoles} onCancel={()=>setDialog(null)}/></Modal>
    <ConfirmDialog open={confirm&&Boolean(selected)} title={selected?.active?'Desativar usuário':'Ativar usuário'} description={selected?`${selected.username} ficará ${selected.active?'sem acesso até ser reativado':'com acesso novamente'}.`:''} confirmLabel={selected?.active?'Desativar':'Ativar'} danger={Boolean(selected?.active)} onCancel={()=>setConfirm(false)} onConfirm={setUserActive}/>
  </section>;
}
