import {test,expect} from '@playwright/test';
import {captureStep,enterProduct,logout} from './evidence-helpers.mjs';

const primary=['Admin','Journey','2026!'].join('-');
const secondary=['Stock','Journey','2026!'].join('-');
const member=['estoque','e2e'].join('-');

test('administration-rbac journey exercises visible product controls and restricted navigation',async({page},testInfo)=>{
  await enterProduct(page,{password:primary});
  await page.getByTestId('nav-admin').click();
  const workspace=page.getByTestId('admin-workspace');
  await expect(workspace).toBeVisible();
  await captureStep(page,testInfo,'administracao-inicial');

  await workspace.locator('.workspace-actions button').click();
  let dialog=page.getByRole('dialog');
  await dialog.locator('#field-username').fill(member);
  await dialog.locator('#field-password').fill(secondary);
  await dialog.locator('#field-roles').selectOption(['viewer']);
  await dialog.locator('form button[type="submit"]').click();
  await expect(page.getByText(member,{exact:true})).toBeVisible();
  await captureStep(page,testInfo,'registro-criado');

  await page.getByText(member,{exact:true}).click();
  const detail=workspace.locator('aside.workspace-panel');
  await detail.locator('.context-actions button').first().click();
  dialog=page.getByRole('dialog');
  await dialog.locator('#field-roles').selectOption(['warehouse']);
  await dialog.locator('form button[type="submit"]').click();
  await captureStep(page,testInfo,'perfil-atualizado');

  await logout(page);
  await enterProduct(page,{username:member,password:secondary});
  await expect(page.getByTestId('nav-inventory')).toBeVisible();
  await expect(page.getByTestId('nav-finance')).toHaveCount(0);
  await expect(page.getByTestId('nav-admin')).toHaveCount(0);
  await page.getByTestId('nav-inventory').click();
  await captureStep(page,testInfo,'navegacao-restrita');

  await logout(page);
  await enterProduct(page,{password:primary});
  await page.getByTestId('nav-admin').click();
  await page.getByText(member,{exact:true}).click();
  const selected=page.getByTestId('admin-workspace').locator('aside.workspace-panel');
  await selected.locator('.context-actions button').last().click();
  await page.getByRole('dialog').locator('footer button').last().click();
  await captureStep(page,testInfo,'registro-desativado');

  await page.getByTestId('admin-workspace').locator('[role="tablist"] button').nth(2).click();
  await expect(page.getByLabel('Filtrar auditoria')).toBeVisible();
  await captureStep(page,testInfo,'auditoria-rbac');
});
