import {test,expect} from '@playwright/test';
import {captureStep,createField,createInput,createSeason,enterProduct,selectOperationRow,submitDialog} from './evidence-helpers.mjs';

const password=['Action','Matrix','2026!'].join('-');

async function expectButtons(page,names){
  for(const name of names)await expect(page.getByRole('button',{name,exact:true}),`${name} deve estar acessível pela UI`).toBeVisible();
}

test('screen action matrix keeps every published user action reachable from the visible UI',async({page,context},testInfo)=>{
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:-21.18,longitude:-47.81,accuracy:12});
  await enterProduct(page,{password});

  await createField(page,{code:'MATRIX-01',name:'Talhão Matriz',farm:'Fazenda Matriz',area:'8'});
  await page.getByText('Talhão Matriz',{exact:true}).first().click();
  await expectButtons(page,['Novo talhão','Novo ponto no mapa','Editar','Anexar arquivo','Mapa/GIS','Monitoramento','Excluir']);
  await captureStep(page,testInfo,'matrix-fields-actions');

  await createSeason(page,{crop:'Soja Matriz',period:'2026/27'});
  await page.getByText('Soja Matriz',{exact:true}).first().click();
  await expectButtons(page,['Nova safra','Editar']);

  await createInput(page,{name:'Fertilizante Matriz',unit:'kg',category:'Fertilizante',unitCost:'12.50'});
  await expect(page.getByRole('button',{name:/Novo insumo/})).toBeVisible();

  await page.getByTestId('nav-operations').click();
  await expectButtons(page,['Programar operação','Novo planejamento','Registrar aplicação','Monitoramento','Registrar chuva']);

  await page.getByRole('button',{name:'Programar operação',exact:true}).click();
  let dialog=page.getByRole('dialog');
  await dialog.locator('#field-seasonId').selectOption({label:'Soja Matriz 2026/27'});
  await dialog.locator('#field-fieldId').selectOption({label:'Fazenda Matriz > Talhão Matriz — 8 ha'});
  await dialog.getByLabel('Tipo de operação',{exact:true}).fill('Operação Matriz');
  await dialog.getByLabel('Programada para',{exact:true}).fill('2026-09-22T08:00');
  await submitDialog(dialog,'Programar operação');
  await selectOperationRow(page,'Operação Matriz');
  await expectButtons(page,['Iniciar','Cancelar','Novo checklist']);
  await captureStep(page,testInfo,'matrix-operations-actions');

  await page.getByTestId('nav-harvest').click();
  await expectButtons(page,['Registrar colheita','Lote armazenado']);

  await page.getByTestId('nav-inventory').click();
  await expectButtons(page,['Registrar entrada','Registrar saída','Contagem física','Transferir']);

  await page.getByTestId('nav-finance').click();
  await expectButtons(page,['Nova venda','Pedido de compra','Fornecedor','Receber pedido','Registrar entrega','Receita manual','Nova despesa']);

  await page.getByTestId('nav-reports').click();
  await expectButtons(page,['Resumo das emissões','Exportar histórico','Gerar CSV','Gerar PDF']);

  await page.getByTestId('nav-settings').click();
  await expectButtons(page,['Criar backup','Alterar uma','Importar CSV','Novo item']);
  await expect(page.getByRole('button',{name:'Salvar preferências',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Criar backup',exact:true}).click();
  await expect(page.locator('.workspace-table tbody tr').first()).toBeVisible();
  const backupRow=page.locator('.workspace-table tbody tr').first();
  await backupRow.click();
  await expect(page.getByRole('button',{name:'Restaurar este backup',exact:true})).toBeVisible();
  const recovery=page.getByRole('button',{name:'Gerar código',exact:true});
  if(await recovery.count())await expect(recovery).toBeVisible();
  await captureStep(page,testInfo,'matrix-settings-actions');

  await page.getByTestId('nav-overview').click();
  await expect(page.getByLabel('Buscar na base agrícola')).toBeVisible();
  await expect(page.getByText('Capturar arquivo',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Buscar',exact:true})).toBeVisible();
  const alertCard=page.locator('.checklist-card').filter({hasText:'Operação programada'}).first();
  if(await alertCard.count()){
    await expect(alertCard.getByRole('button',{name:'Reconhecer',exact:true})).toBeVisible();
    await expect(alertCard.getByRole('button',{name:'Adiar 24h',exact:true})).toBeVisible();
    await expect(alertCard.getByRole('button',{name:'Dispensar',exact:true})).toBeVisible();
  }

  await page.getByTestId('nav-field-mode').click();
  await expect(page.getByTestId('field-mode-workspace')).toBeVisible();
  await expectButtons(page,['Usar meu GPS','Salvar observação','Registrar ocorrência','Tirar foto','Adicionar posição GPS','Salvar medição','Limpar']);

  await page.getByTestId('nav-offline-maps').click();
  await expect(page.getByTestId('offline-maps-workspace')).toBeVisible();
  await expect(page.getByRole('button',{name:'Baixar mapa desta fazenda',exact:true})).toBeVisible();

  await page.getByTestId('nav-admin').click();
  await expect(page.getByTestId('admin-workspace')).toBeVisible();

  await page.getByTestId('nav-iot').click();
  await expect(page.getByText('IoT da lavoura',{exact:true})).toBeVisible();
  await captureStep(page,testInfo,'matrix-complete');
});
