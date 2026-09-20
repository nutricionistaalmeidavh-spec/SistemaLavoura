import {test,expect} from '@playwright/test';
import {captureStep,createInput,enterProduct,submitDialog} from './evidence-helpers.mjs';

const password=['Inventory','Journey','2026!'].join('-');

test('inventory-lifecycle: entrada, saída, contagem, transferência e estoque baixo',async({page},testInfo)=>{
  await enterProduct(page,{password});
  await createInput(page,{name:'Insumo Estoque E2E',unit:'kg',category:'Fertilizante',unitCost:'10'});
  await page.getByTestId('nav-inventory').click();

  await page.getByRole('button',{name:'Registrar entrada',exact:true}).click();
  let dialog=page.getByRole('dialog');
  await dialog.locator('#field-sku').selectOption({label:'Insumo Estoque E2E (kg)'});
  await dialog.getByLabel('Quantidade',{exact:true}).fill('20');
  await dialog.getByLabel('Lote',{exact:true}).fill('INV-E2E-01');
  await submitDialog(dialog,'Registrar entrada');
  await expect(page.getByText('Insumo Estoque E2E (kg)',{exact:true}).first()).toBeVisible();
  await captureStep(page,testInfo,'entrada-estoque');

  await page.getByRole('button',{name:'Registrar saída',exact:true}).click();
  dialog=page.getByRole('dialog');
  await dialog.locator('#field-sku').selectOption({label:'Insumo Estoque E2E (kg)'});
  await dialog.getByLabel('Quantidade',{exact:true}).fill('13');
  await dialog.getByLabel('Lote',{exact:true}).fill('INV-E2E-01');
  await submitDialog(dialog,'Registrar saída');
  await expect(page.getByText('Atenção',{exact:true}).first()).toBeVisible();
  await captureStep(page,testInfo,'saida-e-estoque-baixo');

  await page.getByRole('button',{name:'Contagem física',exact:true}).click();
  dialog=page.getByRole('dialog');
  await dialog.locator('#field-sku').selectOption({label:'Insumo Estoque E2E (kg)'});
  await dialog.getByLabel('Quantidade contada',{exact:true}).fill('12');
  await dialog.getByLabel('Armazém',{exact:true}).fill('Principal');
  await submitDialog(dialog,'Contagem física');
  await captureStep(page,testInfo,'contagem-fisica');

  await page.getByRole('button',{name:'Transferir',exact:true}).click();
  dialog=page.getByRole('dialog');
  await dialog.locator('#field-sku').selectOption({label:'Insumo Estoque E2E (kg)'});
  await dialog.getByLabel('Quantidade',{exact:true}).fill('2');
  await dialog.getByLabel('Origem',{exact:true}).fill('Principal');
  await dialog.getByLabel('Destino',{exact:true}).fill('Secundário');
  await submitDialog(dialog,'Transferir estoque');
  await captureStep(page,testInfo,'transferencia-registrada');

  await page.getByTestId('nav-overview').click();
  await expect(page.getByText(/Estoque baixo/).first()).toBeVisible();
  await captureStep(page,testInfo,'alerta-estoque-baixo');
});
