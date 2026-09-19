import React,{useEffect,useMemo,useState} from 'react';
import {resolveSpecializedScreen} from '../product-runtime-model.js';
import {LavouraShell} from './shell.jsx';
import {LavouraDashboard} from './dashboard.jsx';

const toRows=data=>{const candidate=Array.isArray(data)?data:data?.rows??data?.records??Object.values(data??{}).find(Array.isArray)??[];return candidate.map(value=>value?.payload??value);};
const text=value=>value==null?'—':typeof value==='object'?JSON.stringify(value):String(value);

function Auth({backend,onAuth}){
  const [hasUsers,setHasUsers]=useState(true);
  const [username,setUsername]=useState('admin');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{backend.authState().then(value=>setHasUsers(value.hasUsers)).catch(err=>setError(err.message));},[backend]);
  async function submit(event){event.preventDefault();setError('');try{if(!hasUsers)await backend.bootstrap({username,password});const login=await backend.login({username,password});onAuth({sessionId:login.session.id,token:login.token});}catch(err){setError(err.message);}}
  return <main className="auth-page"><section className="auth-brand"><div className="auth-leaf">◒</div><span>Sistema Lavoura</span><p>Gestão agrícola local, segura e pronta para o campo.</p></section><form onSubmit={submit} className="auth-card"><div><span className="eyebrow">ArtiSys Agro Lavoura</span><h1>{hasUsers?'Acesse sua fazenda':'Configure o administrador local'}</h1><p>{hasUsers?'Entre para continuar no ambiente local.':'Crie a primeira conta administrativa deste dispositivo.'}</p></div><label>Usuário<input data-testid="username" value={username} onChange={event=>setUsername(event.target.value)} autoComplete="username"/></label><label>Senha<input data-testid="password" type="password" value={password} onChange={event=>setPassword(event.target.value)} minLength={8} autoComplete={hasUsers?'current-password':'new-password'}/></label>{error?<div className="error" role="alert">{error}</div>:null}<button data-testid="auth-submit" className="primary-button">{hasUsers?'Entrar':'Criar administrador'}</button></form></main>;
}

function ActionPanel({screen,selected,onRun}){
  const [chosen,setChosen]=useState(null);
  const [raw,setRaw]=useState('{}');
  const [error,setError]=useState('');
  const definitions=screen?.actionDefinitions??{};
  useEffect(()=>{setChosen(null);setRaw('{}');setError('');},[screen?.id]);
  const start=name=>{setChosen(name);const definition=definitions[name];const base={};if(definition?.requiresSelection&&selected?.id)base.id=selected.id;setRaw(JSON.stringify(base,null,2));};
  async function run(){try{setError('');const input=JSON.parse(raw||'{}');await onRun(chosen,input);setChosen(null);setRaw('{}');}catch(err){setError(err.message);}}
  if(!Object.keys(definitions).length)return null;
  return <div className="advanced-actions"><div className="advanced-heading"><span className="eyebrow">Ferramentas</span><h3>Ações da tela</h3><p>Fluxo técnico temporário. Formulários dedicados entram nas próximas fases.</p></div><div className="action-buttons">{Object.entries(definitions).map(([name,definition])=><button type="button" key={name} onClick={()=>start(name)}>{definition.label??name}</button>)}</div>{chosen?<div className="action-editor"><strong>{definitions[chosen]?.label??chosen}</strong><label>JSON de entrada<textarea data-testid="action-json" value={raw} onChange={event=>setRaw(event.target.value)} rows={8}/></label><button type="button" data-testid="action-run" className="primary-button" onClick={run}>Executar</button></div>:null}{error?<div className="error" role="alert">{error}</div>:null}</div>;
}

function GenericScreen({data,selected,onSelect}){
  const rows=toRows(data);
  if(!rows.length)return <section className="empty-state"><div className="empty-orb"/><h3>Nenhum registro ainda</h3><p>Use as ações disponíveis para começar a preencher esta área.</p></section>;
  const columns=[...new Set(rows.flatMap(row=>Object.keys(row??{})))].filter(key=>!['metadata'].includes(key)).slice(0,9);
  return <div className="table-card"><div className="table-scroll"><table><thead><tr>{columns.map(column=><th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={row.id??index} className={selected===row?'selected':''} onClick={()=>onSelect(row)}>{columns.map(column=><td key={column}>{text(row[column])}</td>)}</tr>)}</tbody></table></div></div>;
}

const specializedScreens={dashboard:LavouraDashboard};

export function LavouraProductRuntime({backend}){
  const [auth,setAuth]=useState(()=>{try{return JSON.parse(localStorage.getItem('artisys.auth')||'null');}catch{return null;}});
  const [meta,setMeta]=useState(null);
  const [screenId,setScreenId]=useState(null);
  const [data,setData]=useState(null);
  const [selected,setSelected]=useState(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);

  useEffect(()=>{if(auth)localStorage.setItem('artisys.auth',JSON.stringify(auth));else localStorage.removeItem('artisys.auth');},[auth]);
  useEffect(()=>{if(!auth)return;let cancelled=false;backend.validate(auth).then(()=>backend.describe()).then(description=>{if(cancelled)return;setMeta(description);setScreenId(current=>current??description.navigation[0]?.id);}).catch(()=>{if(!cancelled)setAuth(null);});return()=>{cancelled=true;};},[backend,auth]);

  async function load(id=screenId){if(!auth||!id)return;setLoading(true);setError('');try{const next=await backend.load({screenId:id,auth,context:{}});setData(next);setSelected(null);}catch(err){setError(err.message);}finally{setLoading(false);}}
  useEffect(()=>{if(screenId&&meta)void load(screenId);},[screenId,meta]);

  const descriptor=useMemo(()=>meta?.screens?.find(screen=>screen.id===screenId)??null,[meta,screenId]);
  const Specialized=resolveSpecializedScreen(descriptor,specializedScreens);
  async function logout(){try{if(auth)await backend.logout(auth);}finally{setMeta(null);setScreenId(null);setData(null);setAuth(null);}}
  async function runAction(action,input){await backend.action({screenId,action,input,auth,context:{}});await load(screenId);}

  if(!auth)return <Auth backend={backend} onAuth={setAuth}/>;
  if(!meta)return <div className="loading-page"><span className="loading-spinner"/>Abrindo produto…</div>;
  const content=loading&&!data?<div className="loading-card">Carregando dados…</div>:error?<div className="error page-error" role="alert">{error}</div>:Specialized?<Specialized data={data} screen={descriptor} onNavigate={setScreenId} reload={()=>load(screenId)}/>:<GenericScreen data={data} selected={selected} onSelect={setSelected}/>;
  const secondary=!Specialized?<ActionPanel screen={descriptor} selected={selected} onRun={runAction}/>:null;
  return <LavouraShell meta={meta} currentScreenId={screenId} onSelectScreen={setScreenId} title={descriptor?.title??'Sistema Lavoura'} onReload={()=>load(screenId)} onLogout={logout} secondary={secondary}>{content}</LavouraShell>;
}
