import {test,expect} from '@playwright/test';
import {register} from './helpers';

test('cancel discards project and work fields, files and picker history',async({page})=>{
 test.setTimeout(180000);
 await register(page);
 const session=await (await page.request.get('/api/auth/me')).json();
 const response=await page.request.post('/api/projects',{headers:{Origin:'http://127.0.0.1:5190','X-CSRF-Token':session.csrfToken},data:{name:'پروژه آزمایش انصراف'}});
 expect(response.status()).toBe(201);const root=await response.json();
 await page.reload();

 await page.getByRole('button',{name:'ایجاد پروژه',exact:true}).click();
 await page.getByLabel(/^عنوان پروژه/).fill('پروژه لغو شده');
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'انتخاب پروژه',exact:true}).click();
 await page.getByText(root.name,{exact:true}).click();
 await page.getByRole('button',{name:'انتخاب',exact:true}).click();
 await expect(page.getByLabel(/^عنوان پروژه/)).toHaveValue('پروژه لغو شده');
 await page.getByRole('button',{name:'انصراف',exact:true}).click();
 await expect(page).toHaveURL(/\/dashboard$/);
 await page.goBack();
 await expect(page).toHaveURL(/\/create-project$/);
 const emptyProject=async()=>{
  await expect(page.getByLabel(/^عنوان پروژه/)).toHaveValue('');
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByText(root.name,{exact:false})).toHaveCount(0);
 };
 await emptyProject();await page.reload();await emptyProject();

 await page.goto('/dashboard?projectId='+root.id);
 await page.getByRole('button',{name:'ایجاد کار',exact:true}).click();
 await page.getByLabel(/^عنوان کار/).fill('کار لغو شده');
 await page.getByLabel(/^شرح مختصر کار/).fill('شرح لغو شده');
 await page.getByLabel(/^شرح پیش نیاز/).fill('پیش نیاز لغو شده');
 await page.getByRole('combobox',{name:/انتخاب طبقه/}).click();
 await page.getByRole('option',{name:'طبقه سوم',exact:true}).click();
 await page.getByRole('button',{name:'انتخاب پروژه',exact:true}).click();
 await page.getByText(root.name,{exact:true}).click();
 await page.getByRole('button',{name:'انتخاب',exact:true}).click();
 await expect(page.getByLabel(/^عنوان کار/)).toHaveValue('کار لغو شده');
 await page.getByLabel('تصویر شاخص کار',{exact:true}).setInputFiles({name:'cancel-cover.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2uoAAAAASUVORK5CYII=','base64')});
 await page.getByLabel('فایل پیوست',{exact:true}).setInputFiles({name:'cancel-attachment.txt',mimeType:'text/plain',buffer:Buffer.from('cancelled attachment')});
 await expect(page.getByText('cancel-cover.png',{exact:true})).toBeVisible();
 await expect(page.getByText('cancel-attachment.txt',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'انصراف',exact:true}).click();
 await expect(page).toHaveURL('http://127.0.0.1:5190/dashboard?projectId='+root.id);
 await page.goBack();
 await expect(page).toHaveURL(/\/create-work$/);
 const emptyWork=async()=>{
  for(const name of [/^عنوان کار/,/^شرح مختصر کار/,/^شرح پیش نیاز/])await expect(page.getByLabel(name)).toHaveValue('');
  for(const name of [/انتخاب پروژه/,/انتخاب طبقه/])await expect(page.getByRole('combobox',{name})).toHaveText(/^[\s\u200b]*$/);
  for(const name of ['cancel-cover.png','cancel-attachment.txt'])await expect(page.getByText(name,{exact:true})).toHaveCount(0);
  await expect(page.getByText('تصویر شاخص کار',{exact:true})).toBeVisible();
  await expect(page.getByText('فایل پیوست',{exact:true})).toBeVisible();
 };
 await emptyWork();await page.reload();await emptyWork();
 expect((await (await page.request.get('/api/projects')).json()).length).toBe(1);
 expect((await (await page.request.get('/api/works')).json()).total).toBe(0);
});
