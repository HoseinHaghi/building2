import {test,expect} from '@playwright/test';
import {register,password} from './helpers';

async function account(page) {
  const username=await register(page);
  const session=await (await page.request.get('/api/auth/me')).json();
  const headers={Origin:'http://127.0.0.1:5190','X-CSRF-Token':session.csrfToken};
  const project=async name=>{
    const response=await page.request.post('/api/projects',{headers,data:{name}});
    expect(response.status()).toBe(201);return response.json();
  };
  const work=async(projectId,title)=>{
    const response=await page.request.post('/api/works',{headers,multipart:{projectId,title,floorNum:'1',summary:'شرح کار'}});
    expect(response.status()).toBe(201);return response.json();
  };
  return {username,headers,project,work};
}

test('draft text survives reload and selected files survive the project picker',async({page})=>{
  test.setTimeout(120000);
  const setup=await account(page);
  const first=await setup.project('پروژه نخست'),second=await setup.project('پروژه دوم');
  await page.goto('/create-project');
  await page.getByLabel(/^عنوان پروژه/).fill('عنوان حفظ‌شده');
  await page.getByRole('checkbox').check();
  await page.reload();
  await expect(page.getByLabel(/^عنوان پروژه/)).toHaveValue('عنوان حفظ‌شده');
  await expect(page.getByRole('checkbox')).toBeChecked();
  await page.getByRole('button',{name:'انتخاب پروژه',exact:true}).click();
  await page.getByText(first.name,{exact:true}).click();
  await page.getByRole('button',{name:'انتخاب',exact:true}).click();
  await page.reload();
  await expect(page.getByLabel(/^عنوان پروژه/)).toHaveValue('عنوان حفظ‌شده');
  await expect(page.getByText(first.name,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'انصراف',exact:true}).click();

  await page.goto('/dashboard?projectId='+first.id);
  await page.getByRole('button',{name:'ایجاد کار',exact:true}).click();
  await page.getByLabel(/^عنوان کار/).fill('کار بدون پیش‌نیاز');
  await page.getByLabel(/^شرح مختصر کار/).fill('این متن با رفرش حفظ می‌شود');
  await page.getByRole('combobox',{name:/انتخاب طبقه/}).click();
  await page.getByRole('option',{name:'طبقه دوم',exact:true}).click();
  await page.reload();
  await expect(page.getByLabel(/^عنوان کار/)).toHaveValue('کار بدون پیش‌نیاز');
  await expect(page.getByLabel(/^شرح مختصر کار/)).toHaveValue('این متن با رفرش حفظ می‌شود');
  await expect(page.getByRole('combobox',{name:/انتخاب طبقه/})).toContainText('طبقه دوم');
  await expect(page.getByLabel(/^شرح پیش نیاز/)).not.toHaveAttribute('required');
  const cover=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2uoAAAAASUVORK5CYII=','base64');
  await page.getByLabel('تصویر شاخص کار',{exact:true}).setInputFiles({name:'retained-cover.png',mimeType:'image/png',buffer:cover});
  await page.getByLabel('فایل پیوست',{exact:true}).setInputFiles({name:'retained.txt',mimeType:'text/plain',buffer:Buffer.from('retained file contents')});
  await page.getByRole('button',{name:'انتخاب پروژه',exact:true}).click();
  await page.getByText(second.name,{exact:true}).click();
  await page.getByRole('button',{name:'انتخاب',exact:true}).click();
  await expect(page.getByText('retained-cover.png',{exact:true})).toBeVisible();
  await expect(page.getByText('retained.txt',{exact:true})).toBeVisible();
  // Cancelling a second picker visit must also retain both files.
  await page.getByRole('button',{name:'انتخاب پروژه',exact:true}).click();
  await page.getByRole('button').filter({has:page.locator('svg[data-testid="CloseRoundedIcon"]')}).click();
  await expect(page.getByText('retained.txt',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/usability-work-form.png',animations:'disabled'});
  await page.getByRole('button',{name:'ایجاد',exact:true}).click();
  await expect(page).toHaveURL(/\/works\//);
  const workPath=new URL(page.url()).pathname;
  const saved=await (await page.request.get('/api'+workPath)).json();
  expect(saved.projectId).toBe(second.id);expect(saved.prerequisite).toBe('');
  expect(await (await page.request.get(saved.cover.url)).body()).toEqual(cover);
  expect(await (await page.request.get(saved.attachment.url)).text()).toBe('retained file contents');
  await page.getByRole('button',{name:'ویرایش',exact:true}).click();
  await page.getByLabel(/^عنوان کار/).fill('ویرایش ذخیره‌نشده');
  await page.reload();
  await expect(page.getByLabel(/^عنوان کار/)).toHaveValue('ویرایش ذخیره‌نشده');
  await page.getByRole('button',{name:'انصراف',exact:true}).click();
  await expect(page.getByText('کار بدون پیش‌نیاز',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'ویرایش',exact:true}).click();
  await expect(page.getByLabel(/^عنوان کار/)).toHaveValue('کار بدون پیش‌نیاز');
});

test('reports can be corrected and work completion can be reversed',async({page})=>{
  const setup=await account(page),project=await setup.project('پروژه گزارش');
  const work=await setup.work(project.id,'کار گزارش');
  const workPath='/works/'+encodeURIComponent(work.id);
  await page.goto(workPath);
  await page.getByRole('button',{name:'اضافه کردن گزارش',exact:true}).click();
  await page.getByLabel('متن گزارش کار',{exact:true}).fill('گزارش اولیه');
  await page.getByRole('button',{name:'ایجاد',exact:true}).click();
  await page.getByRole('button',{name:'ویرایش گزارش: گزارش اولیه',exact:true}).click();
  const editor=page.getByRole('dialog');
  await editor.getByLabel(/^متن گزارش کار/).fill('گزارش اصلاح‌شده');
  await expect(editor.locator('fieldset')).toHaveCSS('border-top-width','0px');
  await page.screenshot({path:'test-results/usability-report-editor.png',animations:'disabled'});
  await editor.getByRole('button',{name:'ذخیره',exact:true}).click();
  await expect(page.getByText('گزارش اصلاح‌شده',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText('گزارش اصلاح‌شده',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'حذف گزارش: گزارش اصلاح‌شده',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'انصراف',exact:true}).click();
  expect((await (await page.request.get('/api'+workPath+'/reports')).json()).length).toBe(1);
  await page.getByRole('button',{name:'حذف گزارش: گزارش اصلاح‌شده',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'حذف',exact:true}).click();
  await expect(page.getByText('گزارش اصلاح‌شده',{exact:true})).toHaveCount(0);
  expect((await (await page.request.get('/api'+workPath+'/reports')).json()).length).toBe(0);
  await page.getByRole('button',{name:'انجام کار',exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto(workPath);
  await page.getByRole('button',{name:'بازگشت به در حال انجام',exact:true}).click();
  await expect(page.getByRole('button',{name:'انجام کار',exact:true})).toBeVisible();
  expect((await (await page.request.get('/api'+workPath)).json()).status).toBe('in_progress');
});

test('project management, confirmed work deletion and logout use the existing sidebar',async({page})=>{
  const setup=await account(page),root=await setup.project('پروژه قابل اصلاح'),empty=await setup.project('پروژه خالی');
  const work=await setup.work(root.id,'کار برای بررسی حذف');
  await page.goto('/dashboard?projectId='+root.id);
  await page.getByRole('button',{name:'پروژه‌ها',exact:true}).click();
  await page.getByRole('button',{name:'مدیریت پروژه '+root.name,exact:true}).click();
  await page.getByRole('menuitem',{name:'تغییر نام پروژه'}).click();
  await page.getByRole('dialog').getByLabel(/^نام پروژه/).fill('پروژه اصلاح‌شده');
  await page.screenshot({path:'test-results/usability-project-rename.png',animations:'disabled'});
  await page.getByRole('dialog').getByRole('button',{name:'ذخیره',exact:true}).click();
  await expect(page.getByText('پروژه اصلاح‌شده',{exact:true})).toBeVisible();
  expect((await (await page.request.get('/api/projects/'+root.id)).json()).name).toBe('پروژه اصلاح‌شده');
  await page.getByRole('button',{name:'مدیریت پروژه پروژه اصلاح‌شده',exact:true}).click();
  await page.getByRole('menuitem',{name:'حذف پروژه',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'حذف',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('ابتدا کارها و زیرپروژه‌ها');
  expect((await page.request.get('/api/projects/'+root.id)).status()).toBe(200);
  await page.getByRole('dialog').getByRole('button',{name:'انصراف',exact:true}).click();
  await page.getByText(empty.name,{exact:true}).click();
  await page.getByRole('button',{name:'مدیریت پروژه '+empty.name,exact:true}).click();
  await page.getByRole('menuitem',{name:'حذف پروژه',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'حذف',exact:true}).click();
  await expect(page.getByText(empty.name,{exact:true})).toHaveCount(0);
  expect((await page.request.get('/api/projects/'+empty.id)).status()).toBe(404);

  await page.goto('/dashboard?projectId='+root.id);
  await page.getByRole('button',{name:work.title,exact:true}).click();
  await page.getByRole('button',{name:'حذف کار',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('گزارش‌ها و فایل‌های آن');
  await page.screenshot({path:'test-results/usability-delete-confirmation.png',animations:'disabled'});
  await page.getByRole('dialog').getByRole('button',{name:'انصراف',exact:true}).click();
  expect((await page.request.get('/api/works/'+encodeURIComponent(work.id))).status()).toBe(200);
  await page.getByRole('button',{name:'حذف کار',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'حذف',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await page.request.get('/api/works/'+encodeURIComponent(work.id))).status()).toBe(404);
  await page.getByRole('button',{name:'خروج از حساب',exact:true}).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  await page.goBack();await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('نام کاربری',{exact:true}).fill(setup.username);
  await page.getByLabel('رمز عبور',{exact:true}).fill(password);
  await page.getByRole('button',{name:'وارد شوید',exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole('button',{name:'پروژه‌ها',exact:true}).click();
  await expect(page.getByRole('button',{name:'خروج از حساب',exact:true})).toHaveText('خروج از حساب');
});

test('report and project controls respect member permissions',async({page,browser})=>{
  const setup=await account(page),root=await setup.project('پروژه مشترک'),work=await setup.work(root.id,'کار مشترک');
  const workUrl='/api/works/'+encodeURIComponent(work.id);
  await page.request.post(workUrl+'/reports',{headers:setup.headers,data:{text:'گزارش مالک'}});
  const context=await browser.newContext({baseURL:'http://127.0.0.1:5190'}),member=await context.newPage();
  try {
    const memberName=await register(member);
    await page.request.post('/api/projects/'+root.id+'/members',{headers:setup.headers,data:{identifier:memberName}});
    await member.goto('/works/'+encodeURIComponent(work.id));
    await expect(member.getByText('گزارش مالک',{exact:true})).toBeVisible();
    await expect(member.getByRole('button',{name:'ویرایش گزارش: گزارش مالک',exact:true})).toHaveCount(0);
    await expect(member.getByRole('button',{name:'حذف گزارش: گزارش مالک',exact:true})).toHaveCount(0);
    const ownerReports=await (await member.request.get(workUrl+'/reports')).json();
    const memberSession=await (await member.request.get('/api/auth/me')).json();
    const headers={Origin:'http://127.0.0.1:5190','X-CSRF-Token':memberSession.csrfToken};
    expect((await member.request.patch(workUrl+'/reports/'+ownerReports[0].id,{headers,data:{text:'ویرایش غیرمجاز'}})).status()).toBe(403);
    expect((await member.request.delete(workUrl+'/reports/'+ownerReports[0].id,{headers})).status()).toBe(403);
    await member.getByRole('button',{name:'اضافه کردن گزارش',exact:true}).click();
    await member.getByLabel('متن گزارش کار',{exact:true}).fill('گزارش عضو');
    await member.getByRole('button',{name:'ایجاد',exact:true}).click();
    await expect(member.getByRole('button',{name:'ویرایش گزارش: گزارش عضو',exact:true})).toBeVisible();
    await member.goto('/dashboard?projectId='+root.id);
    await member.getByRole('button',{name:'پروژه‌ها',exact:true}).click();
    await expect(member.getByRole('button',{name:'مدیریت پروژه '+root.name,exact:true})).toHaveCount(0);
  } finally {await context.close();}
});
