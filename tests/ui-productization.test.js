import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgroShellModel, agroTheme } from '../src/ui.js';
import { groupNavigation, resolveSpecializedScreen, buildDashboardViewModel } from '../web/product-runtime-model.js';

test('UI-0 exposes semantic Lavoura surface and elevation tokens', () => {
  assert.equal(agroTheme.background, '#F4F7F4');
  assert.equal(agroTheme.surface, '#FFFFFF');
  assert.equal(agroTheme.surfaceSubtle, '#F8FAF8');
  assert.equal(agroTheme.surfaceAccent, '#EDF6EF');
  assert.equal(agroTheme.border, '#E1E8E2');
  assert.equal(agroTheme.radiusCard, '18px');
  assert.match(agroTheme.shadowCard, /rgba\(/);
  assert.match(agroTheme.shadowFloating, /rgba\(/);
});

test('UI-1 navigation keeps functional ids while exposing product groups', () => {
  const shell=createAgroShellModel();
  assert.equal(shell.brand.productName,'ArtiSys Agro Lavoura');
  assert.equal(shell.brand.shortName,'Sistema Lavoura');
  assert.deepEqual(shell.navigation.map(item=>item.id),['overview','fields','seasons','operations','inputs','harvest','inventory','finance','reports','settings']);
  assert.deepEqual(shell.navigation.map(item=>item.group),[
    'Visão geral',
    'Produção','Produção','Produção','Produção','Produção',
    'Gestão','Gestão','Gestão',
    'Sistema'
  ]);
});

test('UI-2 runtime groups navigation without changing order and resolves screen specialization', () => {
  const navigation=createAgroShellModel().navigation;
  const groups=groupNavigation(navigation);
  assert.deepEqual(groups.map(group=>group.label),['Visão geral','Produção','Gestão','Sistema']);
  assert.deepEqual(groups.flatMap(group=>group.items.map(item=>item.id)),navigation.map(item=>item.id));
  const Dashboard=()=>null;
  assert.equal(resolveSpecializedScreen({kind:'dashboard'},{dashboard:Dashboard}),Dashboard);
  assert.equal(resolveSpecializedScreen({kind:'workflow'},{dashboard:Dashboard}),null);
});

test('UI-3 dashboard view model uses only real backend snapshot data', () => {
  const model=buildDashboardViewModel({
    dashboard:{
      fields:{count:3,areaHa:1240},
      seasons:{count:1},
      operations:{planned:2,'in-progress':1,completed:5,cancelled:1,total:9},
      harvest:{quantity:4200,areaHa:70,yieldPerHa:60},
      finance:{incomeMinor:298000000,expenseMinor:158000000,marginMinor:140000000},
      alerts:{active:2,due:1},
      inventory:{lowStock:3,threshold:10},
      planning:{plans:4,progress:70,conflicts:1}
    },
    alerts:[{id:'a1',title:'Operação atrasada',status:'active',severity:'critical'}]
  });
  assert.deepEqual(model.kpis.map(item=>item.id),['area','operations','harvest','result']);
  assert.equal(model.kpis[0].value,1240);
  assert.equal(model.kpis[1].value,5);
  assert.equal(model.kpis[2].value,4200);
  assert.equal(model.kpis[3].valueMinor,140000000);
  assert.equal(model.progress.percent,56);
  assert.equal(model.progress.inProgress,1);
  assert.equal(model.attention.some(item=>item.kind==='alert'&&item.label==='Operação atrasada'),true);
  assert.equal(model.attention.some(item=>item.kind==='stock'&&item.count===3),true);
  assert.equal(model.attention.some(item=>item.kind==='planning'&&item.count===1),true);
});

test('UI-3 dashboard view model is safe for an empty farm', () => {
  const model=buildDashboardViewModel({});
  assert.equal(model.kpis[0].value,0);
  assert.equal(model.progress.percent,0);
  assert.deepEqual(model.attention,[]);
});
