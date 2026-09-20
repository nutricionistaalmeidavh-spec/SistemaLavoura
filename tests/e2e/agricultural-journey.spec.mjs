import {test,expect} from '@playwright/test';
import {captureStep,createField,createInput,createSeason,enterProduct} from './evidence-helpers.mjs';

const password=['Agricultural','Journey','2026!'].join('-');
const select=(dialog,id,label)=>dialog.locator(`#field-${id}`).selectOption({label});

test('agricultural-chain uses the UI from field registration through report issuance',async({page},testInfo)=>{
  await enterProduct(page,{password});
  await captureStep(page,testInfo,'login-dashboard');
  await createField(page,{code:'CHAIN-01',name:'Talhão Cadeia E2E',farm:'Fazenda Cadeia E2E',area:'10'});
  await captureStep(page,testInfo,'talhao-criado');
  await createSeason(page,{crop:'Soja Cadeia E2E',period:'2026/27'});
  await captureStep(page,testInfo,'safra-criada');
  await createInput(page,{name:'Insumo Cadeia E2E',unit:'kg',category:'Fertilizante',unitCost:'25.90'});
  await captureStep(page,testInfo,'insumo-criado');

  await page.getByTestId('nav-inventory').click();
  await page.getByRole('button',{name:'Registrar entrada',exact:true}).click();
  let d=page.getByRole('dialog');
  await select(d,'sku','Insumo Cadeia E2E (kg)');
  await d.getByLabel('Quantidade',{exact:true}).fill('100');
  await d.getByLabel('Lote',{exact:true}).fill('CHAIN-LOT-01');
  await d.getByRole('button',{name:'Registrar entrada',exact:true}).click();
  await captureStep(page,testInfo,'estoque-inicial');

  await page.getByTestId('nav-operations').click();
  await page.getByRole('button',{name:'Programar operação',exact:true}).click();
  d=page.getByRole('dialog');
  await select(d,'seasonId','Soja Cadeia E2E 2026/27');
  await select(d,'fieldId','Fazenda Cadeia E2E > Talhão Cadeia E2E — 10 ha');
  await d.getByLabel('Tipo de operação',{exact:true}).fill('Operação Cadeia E2E');
  await d.getByLabel('Programada para',{exact:true}).fill('2026-09-21T08:00');
  await d.getByLabel('Insumos planejados',{exact:true}).fill('Insumo Cadeia E2E | 20');
  await d.getByRole('button',{name:'Programar operação',exact:true}).click();
  await expect(page.getByText('Operação Cadeia E2E',{exact:true}).first()).toBeVisible();
  await captureStep(page,testInfo,'operacao-programada');

  await page.getByText('Operação Cadeia E2E',{exact:true}).first().click();
  await page.getByRole('button',{name:'Iniciar',exact:true}).click();
  d=page.getByRole('dialog');
  await d.getByLabel('Iniciada em',{exact:true}).fill('2026-09-21T08:05');
  await d.getByRole('button',{name:'Iniciar operação',exact:true}).click();
  await captureStep(page,testInfo,'operacao-iniciada');

  await page.getByRole('button',{name:'Registrar aplicação',exact:true}).click();
  d=page.getByRole('dialog');
  await select(d,'seasonId','Soja Cadeia E2E 2026/27');
  await select(d,'fieldId','Fazenda Cadeia E2E > Talhão Cadeia E2E — 10 ha');
  await d.getByLabel('Área aplicada (ha)',{exact:true}).fill('10');
  await d.getByLabel('Produtos e doses',{exact:true}).fill('Insumo Cadeia E2E | 2 kg/ha');
  await d.getByLabel('Alvo',{exact:true}).fill('Adubação E2E');
  await d.getByRole('button',{name:'Registrar aplicação',exact:true}).click();
  await captureStep(page,testInfo,'aplicacao-registrada');

  await page.getByText('Operação Cadeia E2E',{exact:true}).first().click();
  await page.getByRole('button',{name:'Concluir',exact:true}).click();
  d=page.getByRole('dialog');
  await d.getByLabel('Concluída em',{exact:true}).fill('2026-09-21T10:00');
  await d.getByLabel('Área executada (ha)',{exact:true}).fill('10');
  await d.getByLabel('Mão de obra (R$)',{exact:true}).fill('100');
  await d.getByLabel('Máquina (R$)',{exact:true}).fill('200');
  await d.getByRole('button',{name:'Concluir operação',exact:true}).click();
  await captureStep(page,testInfo,'operacao-concluida');

  await page.getByTestId('nav-harvest').click();
  await page.getByRole('button',{name:'Registrar colheita',exact:true}).click();
  d=page.getByRole('dialog');
  await select(d,'seasonId','Soja Cadeia E2E 2026/27');
  await select(d,'fieldId','Fazenda Cadeia E2E > Talhão Cadeia E2E — 10 ha');
  await d.getByLabel('Quantidade',{exact:true}).fill('1000');
  await d.locator('#field-unit').selectOption('kg');
  await d.getByLabel('Área colhida (ha)',{exact:true}).fill('10');
  await d.getByRole('button',{name:'Registrar colheita',exact:true}).click();
  await captureStep(page,testInfo,'colheita-registrada');

  await page.getByRole('button',{name:'Lote armazenado',exact:true}).click();
  d=page.getByRole('dialog');
  await select(d,'seasonId','Soja Cadeia E2E 2026/27');
  await select(d,'fieldId','Fazenda Cadeia E2E > Talhão Cadeia E2E — 10 ha');
  await d.getByLabel('Silo/Armazém',{exact:true}).fill('Silo Cadeia');
  await d.getByLabel('Quantidade',{exact:true}).fill('1000');
  await d.locator('#field-unit').selectOption('kg');
  await d.getByRole('button',{name:'Registrar lote armazenado',exact:true}).click();
  await captureStep(page,testInfo,'lote-armazenado');

  await page.getByTestId('nav-finance').click();
  await page.getByRole('button',{name:'Nova venda',exact:true}).click();
  d=page.getByRole('dialog');
  await select(d,'seasonId','Soja Cadeia E2E 2026/27');
  await d.getByLabel('Comprador',{exact:true}).fill('Comprador Cadeia E2E');
  await d.getByLabel('Quantidade',{exact:true}).fill('100');
  await d.locator('#field-unit').selectOption('kg');
  await d.getByLabel('Preço unitário (R$)',{exact:true}).fill('5');
  await select(d,'fieldId','Fazenda Cadeia E2E > Talhão Cadeia E2E — 10 ha');
  await d.getByRole('button',{name:'Nova venda',exact:true}).click();
  await captureStep(page,testInfo,'venda-criada');

  await page.getByRole('button',{name:'Registrar entrega',exact:true}).click();
  d=page.getByRole('dialog');
  await d.locator('#field-saleId').selectOption({label:/Comprador Cadeia E2E/});
  await d.getByLabel('Quantidade entregue',{exact:true}).fill('100');
  await d.getByLabel('Romaneio/Referência',{exact:true}).fill('ROM-CHAIN-01');
  await d.getByRole('button',{name:'Registrar entrega',exact:true}).click();
  await captureStep(page,testInfo,'financeiro-da-venda');

  await page.getByTestId('nav-reports').click();
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Gerar CSV',exact:true}).click();
  await download;
  await expect(page.getByText('Resultado pronto')).toBeVisible();
  await page.getByRole('button',{name:'Emitir documento',exact:true}).click();
  await captureStep(page,testInfo,'relatorio-emitido');
});
