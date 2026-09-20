import React from 'react';
import {buildDashboardViewModel} from '../product-runtime-model.js';
import {Icon} from './icons.jsx';

const number=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const formatKpi=item=>item.valueMinor!==undefined?money.format(item.valueMinor/100):`${number.format(item.value??0)}${item.unit?` ${item.unit}`:''}`;
const severityLabel={critical:'Crítico',danger:'Crítico',warning:'Atenção',info:'Informativo'};

function KpiCard({item}){return <article className={`kpi-card tone-${item.id}`}>
  <div className="kpi-icon"><Icon name={item.icon} size={21}/></div>
  <div className="kpi-copy"><span>{item.label}</span><strong>{formatKpi(item)}</strong>{item.meta?<small>{item.meta}</small>:null}</div>
</article>;}

function EmptyAttention(){return <div className="dashboard-empty"><div className="empty-icon"><Icon name="check"/></div><div><strong>Operação em dia</strong><p>Nenhuma pendência crítica foi encontrada.</p></div></div>;}

export function LavouraDashboard({data,onNavigate}){
  const model=buildDashboardViewModel(data);
  const progress=model.progress;const management=data?.commercial?.management??{};
  return <div className="dashboard-page">
    <section className="dashboard-intro"><div><span className="eyebrow">Visão geral</span><h2>Panorama da lavoura</h2><p>Indicadores consolidados a partir dos dados registrados neste dispositivo.</p></div><div className="dashboard-intro-meta"><span className="status-dot"/> Base local atualizada</div></section>

    <section className="kpi-grid" aria-label="Indicadores principais">{model.kpis.map(item=><KpiCard key={item.id} item={item}/>)}</section>

    <section className="workspace-kpis"><article className="workspace-kpi"><span>Área gerenciada</span><strong>{number.format(management.totalAreaHa??0)} ha</strong></article><article className="workspace-kpi"><span>Receita agrícola</span><strong>{money.format((management.totalIncomeMinor??0)/100)}</strong></article><article className="workspace-kpi"><span>Custo agrícola</span><strong>{money.format((management.totalExpenseMinor??0)/100)}</strong></article><article className="workspace-kpi"><span>Monitoramentos abertos</span><strong>{management.openScouting??0}</strong></article></section><section className="dashboard-main-grid">
      <article className="dashboard-card operations-card">
        <header className="card-heading"><div><span className="eyebrow">Execução</span><h3>Andamento das operações</h3></div><button className="text-button" type="button" onClick={()=>onNavigate?.('operations')}>Ver operações</button></header>
        <div className="progress-hero"><strong>{progress.percent}%</strong><span>das operações registradas foram concluídas</span></div>
        <div className="progress-track" aria-label={`${progress.percent}% concluído`}><span style={{width:`${progress.percent}%`}}/></div>
        <div className="status-grid">
          <div><span className="status-swatch planned"/><strong>{progress.planned}</strong><small>Planejadas</small></div>
          <div><span className="status-swatch active"/><strong>{progress.inProgress}</strong><small>Em andamento</small></div>
          <div><span className="status-swatch completed"/><strong>{progress.completed}</strong><small>Concluídas</small></div>
          <div><span className="status-swatch cancelled"/><strong>{progress.cancelled}</strong><small>Canceladas</small></div>
        </div>
      </article>

      <article className="dashboard-card attention-card">
        <header className="card-heading"><div><span className="eyebrow">Prioridades</span><h3>O que precisa de atenção</h3></div></header>
        <div className="attention-list">{model.attention.length?model.attention.map((item,index)=><div className={`attention-row severity-${item.severity??'info'}`} key={`${item.kind}-${item.id??index}`}>
          <div className="attention-icon"><Icon name={item.kind==='alert'?'alert':item.kind==='stock'?'package':'clipboard-list'} size={18}/></div>
          <div><strong>{item.label}</strong><small>{item.count!==undefined?`${item.count} ocorrência(s)`:severityLabel[item.severity]??'Acompanhar'}</small></div>
        </div>):<EmptyAttention/>}</div>
      </article>
    </section>

    <section className="dashboard-bottom-grid">
      <article className="dashboard-card health-card">
        <header className="card-heading"><div><span className="eyebrow">Saúde operacional</span><h3>Resumo da fazenda</h3></div></header>
        <div className="health-metrics">
          <button type="button" onClick={()=>onNavigate?.('fields')}><Icon name="map"/><span><strong>{model.health.fields}</strong><small>Talhões cadastrados</small></span></button>
          <button type="button" onClick={()=>onNavigate?.('inventory')}><Icon name="package"/><span><strong>{model.health.lowStock}</strong><small>Itens em estoque baixo</small></span></button>
          <button type="button" onClick={()=>onNavigate?.('operations')}><Icon name="clipboard-list"/><span><strong>{model.health.planningProgress}%</strong><small>Progresso do planejamento</small></span></button>
        </div>
      </article>

      <article className="dashboard-card quick-card">
        <header className="card-heading"><div><span className="eyebrow">Atalhos</span><h3>Acesso rápido</h3></div></header>
        <div className="quick-links">
          <button type="button" onClick={()=>onNavigate?.('fields')}><Icon name="map"/><span>Talhões</span></button>
          <button type="button" onClick={()=>onNavigate?.('inventory')}><Icon name="warehouse"/><span>Estoque</span></button>
          <button type="button" onClick={()=>onNavigate?.('finance')}><Icon name="wallet"/><span>Financeiro</span></button>
          <button type="button" onClick={()=>onNavigate?.('reports')}><Icon name="chart"/><span>Relatórios</span></button>
        </div>
      </article>
    </section>
  </div>;
}
