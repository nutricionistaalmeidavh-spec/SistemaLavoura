import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createBrowserPersistence,createBrowserRecovery} from '../shared/packages/vertical-persistence/src/browser.js';
import {createAgroLavouraPresentation} from '../src/presentation.js';
import {createRpcBackend} from '../runtime/backend.mjs';
import {LavouraProductRuntime} from './ui/runtime.jsx';
import './styles.css';

async function resolveBackend(){
  if(globalThis.artisys)return globalThis.artisys;
  const persistence=createBrowserPersistence({productId:'agro-lavoura'});
  const recovery=createBrowserRecovery(persistence,{productId:'agro-lavoura'});
  const presentation=createAgroLavouraPresentation({persistence,recovery});
  return createRpcBackend({presentation});
}

function Bootstrap(){
  const [backend,setBackend]=useState(null);
  const [error,setError]=useState('');
  useEffect(()=>{resolveBackend().then(setBackend).catch(err=>setError(err.message));},[]);
  if(error)return <main className="loading-page error" role="alert">Falha ao abrir o Sistema Lavoura: {error}</main>;
  if(!backend)return <div className="loading-page"><span className="loading-spinner"/>Carregando Sistema Lavoura…</div>;
  return <LavouraProductRuntime backend={backend}/>;
}

createRoot(document.getElementById('root')).render(<Bootstrap/>);
