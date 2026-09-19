import {test,expect} from '@playwright/test';

const workspaces={
  fields:'fields-workspace',
  seasons:'seasons-workspace',
  operations:'operations-workspace',
  inputs:'inputs-workspace',
  harvest:'harvest-workspace',
  inventory:'inventory-workspace',
  finance:'finance-workspace',
  reports:'reports-workspace',
  settings:'settings-workspace'
};

test('shell productizado expõe todas as áreas sem editor técnico JSON',async({page})=>{
  await page.goto('/');
  await page.getByTestId('password').fill('Ui-Product-2026!');
  await page.getByTestId('auth-submit').click();

  await expect(page.getByText('ArtiSys Agro Lavoura').first()).toBeVisible();
  await expect(page.getByRole('heading',{name:'Panorama da lavoura'})).toBeVisible();
  await expect(page.getByTestId('action-json')).toHaveCount(0);

  for(const [screenId,testId] of Object.entries(workspaces)){
    const nav=page.getByTestId(`nav-${screenId}`);
    await nav.click();
    await expect(nav).toHaveClass(/active/);
    await expect(page.getByTestId(testId)).toBeVisible();
    await expect(page.getByTestId('action-json')).toHaveCount(0);
    await expect(page.getByText('JSON de entrada')).toHaveCount(0);
  }
});
