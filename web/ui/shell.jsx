import React,{useEffect,useState} from 'react';
import {groupNavigation} from '../product-runtime-model.js';
import {Icon} from './icons.jsx';

export function LavouraShell({meta,currentScreenId,onSelectScreen,title,onReload,onLogout,children,secondary}){
  const [menuOpen,setMenuOpen]=useState(false);
  const groups=groupNavigation(meta?.navigation??[]);
  useEffect(()=>setMenuOpen(false),[currentScreenId]);
  const brand=meta?.brand??{};
  const nav=(compact=false)=><div className="nav-groups">{groups.map(group=><section className="nav-group" key={group.label}><div className="nav-group-label">{group.label}</div>{group.items.map(item=>{const active=item.id===currentScreenId;return <button type="button" key={item.id} data-testid={`nav-${item.id}`} aria-current={active?'page':undefined} className={`nav-item ${active?'active':''} ${compact?'compact':''}`} onClick={()=>onSelectScreen(item.id)}><Icon name={item.icon} size={19}/><span>{item.label??item.id}</span></button>;})}</section>)}</div>;
  return <div className="product-shell">
    <aside className="sidebar" aria-label="Navegação principal">
      <div className="brand-block">
        <div className="brand-mark"><Icon name="leaf" size={25}/></div>
        <div className="brand-copy"><strong>{brand.shortName??'Sistema Lavoura'}</strong><small>{brand.productName??brand.name}</small></div>
      </div>
      <nav className="sidebar-nav">{nav()}</nav>
      <div className="sidebar-foot"><span className="local-dot"/> Dados locais <span>·</span> offline-first</div>
    </aside>

    <div className="shell-main">
      <header className="topbar">
        <button type="button" className="icon-button mobile-menu" aria-label="Abrir navegação" aria-expanded={menuOpen} onClick={()=>setMenuOpen(value=>!value)}><Icon name={menuOpen?'close':'menu'}/></button>
        <div className="topbar-title"><span className="topbar-eyebrow">Sistema Lavoura</span><h1>{title??'Dashboard'}</h1></div>
        <div className="topbar-actions">
          <button type="button" className="icon-button" aria-label="Atualizar tela" onClick={onReload}><Icon name="refresh"/></button>
          <button type="button" className="logout-button" onClick={onLogout}><Icon name="logout" size={18}/><span>Sair</span></button>
        </div>
      </header>
      {menuOpen?<div className="mobile-nav-panel"><nav aria-label="Navegação principal móvel">{nav(true)}</nav></div>:null}
      <div className={`content-frame ${secondary?'has-secondary':''}`}>
        <main className="screen-content">{children}</main>
        {secondary?<aside className="secondary-panel">{secondary}</aside>:null}
      </div>
    </div>
  </div>;
}
