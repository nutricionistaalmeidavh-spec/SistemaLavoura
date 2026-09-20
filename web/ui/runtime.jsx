import React,{useEffect,useMemo,useState} from 'react';
import {resolveSpecializedScreen} from '../product-runtime-model.js';
import {LavouraShell} from './shell.jsx';
import {LavouraDashboard} from './dashboard.jsx';
import {LavouraFieldsWorkspace} from './fields.jsx';
import {LavouraSimpleTableFormWorkspace} from './simple-table-form.jsx';
import {LavouraSeasonsWorkspace} from './seasons.jsx';
import {LavouraOperationsWorkspace} from './operations.jsx';
import {LavouraInventoryWorkspace} from './inventory.jsx';
import {LavouraFinanceWorkspace} from './finance.jsx';
import {LavouraHarvestWorkspace} from './harvest.jsx';
import {LavouraReportsWorkspace} from './reports.jsx';
import {LavouraSettingsWorkspace} from './settings.jsx';
import {LavouraAdminWorkspace} from './admin.jsx';

function Auth({backend,onAuth}){
  const [hasUsers,setHasUsers]=useState(true);
  const [username,setUsername]=useState('admin');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{backend.authState().then(value=>setHasUsers(value.hasUsers)).catch(err=>setError(err.message));},[backend]);
  async function submit(event){event.preventDefault();setError('');try{if(!hasUsers)await backend.bootstrap({username,password});const login=await backend.login({username,password});onAuth({sessionId:login.session.id,token:login.token});}catch(err){setError(err.message);}}
  return <main className="auth-page"><section className="auth-brand"><div className="auth-leaf">◒</div><span>Sistema Lavoura</span><p>Gestão agrícola local, segura e pronta para o campo.</p></section><form onSubmit={submit} className="auth-card"><div><span className="eyebrow">ArtiSys Agro Lavoura</span><h1>{hasUsers?'Acesse sua fazenda':'Configure o administrador local'}</h1><p>{hasUsers?'Entre para continuar no ambiente local.':'Crie a primeira conta administrativa deste dispositivo.'}</p></div><label>Usuário<input data-testid="username" value={username} onChange={event=>setUsername(event.target.value)} autoComplete="username"/></label><label>Senha<input data-testid="password" type="password" value={password} onChange={event=>setPassword(event.target.value)} minLength={8} autoComplete={hasUsers?'current-password':'new-password'}/></label>{error?<div className="error" role="alert">{error}</div>:null}<button data-testid="auth-submit" className="primary-button">{hasUsers?'Entrar':'Criar administrador'}</button></form></main>;
}

function TableFormRouter(props){
  const id=props.screen?.id;
  if(id==='fields')return <LavouraFieldsWorkspace {...props}/>;
  if(id==='seasons')return <LavouraSeasonsWorkspace {...props}/>;
  if(id==='inputs')return <LavouraSimpleTableFormWorkspace {...props} screenId={id}/>;
  if(id==='harvest')return <LavouraHarvestWorkspace {...props}/>;
  return <UnknownWorkspace screen={props.screen}/>;
}
function UnknownWorkspace({screen}){return <section className="workspace-empty"><strong>Tela indisponível</strong><span>Não há renderer especializado para {screen?.title??screen?.id??'esta área'}.</span></section>;}

const specializedScreens={
  dashboard:LavouraDashboard,
  'table-form':TableFormRouter,
  workflow:LavouraOperationsWorkspace,
  inventory:LavouraInventoryWorkspace,
  finance:LavouraFinanceWorkspace,
  reports:LavouraReportsWorkspace,
  settings:LavouraSettingsWorkspace,
  admin:LavouraAdminWorkspace
};

export function LavouraProductRuntime({backend}){
  const [auth,setAuth]=useState(()=>{try{return JSON.parse(localStorage.getItem('artisys.auth')||'null');}catch{return null;}});
  const [meta,setMeta]=useState(null);
  const [screenId,setScreenId]=useState(null);
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);

  useEffect(()=>{if(auth)localStorage.setItem('artisys.auth',JSON.stringify(auth));else localStorage.removeItem('artisys.auth');},[auth]);
  useEffect(()=>{if(!auth)return;let cancelled=false;backend.validate(auth).then(()=>backend.describe(auth)).then(description=>{if(cancelled)return;setMeta(description);setScreenId(current=>current&&description.navigation.some(item=>item.id===current)?current:description.navigation[0]?.id);}).catch(()=>{if(!cancelled)setAuth(null);});return()=>{cancelled=true;};},[backend,auth]);

  async function load(id=screenId){if(!auth||!id)return;setLoading(true);setError('');try{const next=await backend.load({screenId:id,auth,context:{}});setData(next);return next;}catch(err){setError(err.message);throw err;}finally{setLoading(false);}}
  useEffect(()=>{if(screenId&&meta)void load(screenId).catch(()=>{});},[screenId,meta]);

  const descriptor=useMemo(()=>meta?.screens?.find(screen=>screen.id===screenId)??null,[meta,screenId]);
  const Specialized=resolveSpecializedScreen(descriptor,specializedScreens);
  async function logout(){try{if(auth)await backend.logout(auth);}finally{setMeta(null);setScreenId(null);setData(null);setAuth(null);}}
  async function runAction(action,input){setError('');try{const result=await backend.action({screenId,action,input,auth,context:{}});if(screenId==='admin'&&action==='changePassword'){setMeta(null);setScreenId(null);setData(null);setAuth(null);return result;}await load(screenId);return result;}catch(err){setError(err.message);throw err;}}

  if(!auth)return <Auth backend={backend} onAuth={setAuth}/>;
  if(!meta)return <div className="loading-page"><span className="loading-spinner"/>Abrindo produto…</div>;
  const content=loading&&!data?<div className="loading-card">Carregando dados…</div>:Specialized?<Specialized data={data} screen={descriptor} onRun={runAction} onNavigate={setScreenId} reload={()=>load(screenId)}/>:<UnknownWorkspace screen={descriptor}/>;
  return <LavouraShell meta={meta} currentScreenId={screenId} onSelectScreen={id=>{setError('');setData(null);setScreenId(id);}} title={descriptor?.title??'Sistema Lavoura'} onReload={()=>load(screenId)} onLogout={logout}>{error?<div className="error page-error" role="alert">{error}</div>:null}{content}</LavouraShell>;
}
