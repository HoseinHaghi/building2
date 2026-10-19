import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {register,password,clientHeaders} from './helpers';

async function setup(page) {
  await register(page);
  const me=await (await page.request.get('/api/auth/me')).json();
  const headers={Origin:'http://127.0.0.1:5190','X-CSRF-Token':me.csrfToken};
  const projectResponse=await page.request.post('/api/projects',{headers,data:{name:'Reliability project'}});
  expect(projectResponse.status()).toBe(201);const project=await projectResponse.json();
  const workResponse=await page.request.post('/api/works',{headers,data:{projectId:project.id,title:'Reliability work',floorNum:3,summary:'Original summary'}});
  expect(workResponse.status()).toBe(201);const work=await workResponse.json();
  return {headers,project,work,path:'/works/'+encodeURIComponent(work.id)};
}

test('session connection errors preserve the protected URL and draft until retry succeeds; a real 401 still requires login',async({page})=>{
  test.setTimeout(120000);
  const data=await setup(page);await page.goto(data.path);
  await page.getByRole('button',{name:'اضافه کردن گزارش',exact:true}).click();
  await page.getByLabel('متن گزارش کار',{exact:true}).fill('متن حفظ‌شده هنگام قطع ارتباط');
  let mode='offline';
  await page.route('**/api/auth/me',route=>mode==='offline' ? route.abort('failed') : mode==='server' ? route.fulfill({status:503,json:{error:'Temporary error'}}) : route.continue());
  await page.reload();
  await expect(page.getByRole('heading',{name:'ارتباط با سرور برقرار نشد'})).toBeVisible();
  await expect(page).toHaveURL('http://127.0.0.1:5190'+data.path);
  await expect(page.getByLabel('نام کاربری',{exact:true})).toHaveCount(0);
  mode='server';await page.getByRole('button',{name:'تلاش دوباره',exact:true}).click();
  await expect(page.getByRole('heading',{name:'ارتباط با سرور برقرار نشد'})).toBeVisible();
  mode='good';await page.getByRole('button',{name:'تلاش دوباره',exact:true}).click();
  await expect(page.getByRole('dialog').getByLabel('متن گزارش کار',{exact:true})).toHaveValue('متن حفظ‌شده هنگام قطع ارتباط');
  await expect(page).toHaveURL('http://127.0.0.1:5190'+data.path);
  await page.context().clearCookies();await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});

test('project and multipart work retries after a lost response and reload do not create duplicates',async({page})=>{
  test.setTimeout(120000);await register(page);page.on('dialog',dialog=>dialog.accept());
  let projectId,workId;
  await page.route('**/api/projects',async route=>{
    if(route.request().method()==='POST' && !projectId) {
      const response=await route.fetch();expect(response.status()).toBe(201);projectId=(await response.json()).id;await route.abort('failed');
    } else await route.continue();
  });
  await page.goto('/create-project');await page.getByLabel(/^عنوان پروژه/).fill('پروژه با پاسخ گم‌شده');
  await page.getByRole('button',{name:'ایجاد',exact:true}).click();
  await expect.poll(()=>projectId).toBeTruthy();await expect(page.getByRole('button',{name:'ایجاد',exact:true})).toBeEnabled();
  await page.reload();await expect(page.getByLabel(/^عنوان پروژه/)).toHaveValue('پروژه با پاسخ گم‌شده');
  await page.getByLabel(/^عنوان پروژه/).fill('عنوان تغییرکرده بعد از قطع ارتباط');
  const projectConflict=page.waitForResponse(response=>response.url().endsWith('/api/projects') && response.request().method()==='POST');
  await page.getByRole('button',{name:'ایجاد',exact:true}).click();expect((await projectConflict).status()).toBe(409);
  expect((await (await page.request.get('/api/projects')).json()).length).toBe(1);
  await page.getByLabel(/^عنوان پروژه/).fill('پروژه با پاسخ گم‌شده');
  await page.getByRole('button',{name:'ایجاد',exact:true}).click();
  await expect(page).toHaveURL('http://127.0.0.1:5190/dashboard?projectId='+projectId);
  expect((await (await page.request.get('/api/projects')).json()).length).toBe(1);
  await page.route('**/api/works',async route=>{
    if(route.request().method()==='POST' && !workId) {
      const response=await route.fetch();expect(response.status()).toBe(201);workId=(await response.json()).id;await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button',{name:'ایجاد کار',exact:true}).click();
  await page.getByLabel(/^عنوان کار/).fill('کار با پاسخ گم‌شده');await page.getByLabel(/^شرح مختصر کار/).fill('متن حفظ‌شده');
  await page.getByRole('combobox',{name:/انتخاب طبقه/}).click();await page.getByRole('option',{name:'طبقه اول',exact:true}).click();
  await page.getByLabel('فایل پیوست',{exact:true}).setInputFiles({name:'retry.txt',mimeType:'text/plain',buffer:Buffer.from('same upload after retry')});
  await expect(page.getByText('retry.txt',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'ایجاد',exact:true}).click();
  await expect.poll(()=>workId).toBeTruthy();await expect(page.getByRole('button',{name:'ایجاد',exact:true})).toBeEnabled();
  await page.reload();await expect(page.getByText('retry.txt',{exact:true})).toBeVisible();
  await page.getByLabel(/^عنوان کار/).fill('کار تغییرکرده بعد از قطع ارتباط');
  const workConflict=page.waitForResponse(response=>response.url().endsWith('/api/works') && response.request().method()==='POST');
  await page.getByRole('button',{name:'ایجاد',exact:true}).click();expect((await workConflict).status()).toBe(409);
  expect((await (await page.request.get('/api/works')).json()).total).toBe(1);
  await page.getByLabel(/^عنوان کار/).fill('کار با پاسخ گم‌شده');
  await page.getByRole('button',{name:'ایجاد',exact:true}).click();
  await expect(page).toHaveURL('http://127.0.0.1:5190/works/'+encodeURIComponent(workId));
  const works=await (await page.request.get('/api/works')).json();expect(works.total).toBe(1);
  expect(await (await page.request.get(works.items[0].attachment.url)).text()).toBe('same upload after retry');
});

test('a report saved before a lost response can be retried after reload without duplication',async({page})=>{
  const data=await setup(page);let reportId;
  await page.route('**/reports',async route=>{
    if(route.request().method()==='POST' && !reportId) {
      const response=await route.fetch();expect(response.status()).toBe(201);reportId=(await response.json()).id;await route.abort('failed');
    } else await route.continue();
  });
  await page.goto(data.path);await page.getByRole('button',{name:'اضافه کردن گزارش',exact:true}).click();
  await page.getByLabel('متن گزارش کار',{exact:true}).fill('گزارش بدون ثبت تکراری');
  await page.getByRole('dialog').getByRole('button',{name:'ایجاد',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await page.reload();await expect(page.getByRole('dialog').getByLabel('متن گزارش کار',{exact:true})).toHaveValue('گزارش بدون ثبت تکراری');
  await page.getByRole('dialog').getByLabel('متن گزارش کار',{exact:true}).fill('متن تغییرکرده پس از قطع ارتباط');
  const reportConflict=page.waitForResponse(response=>response.url().endsWith('/reports') && response.request().method()==='POST');
  await page.getByRole('dialog').getByRole('button',{name:'ایجاد',exact:true}).click();expect((await reportConflict).status()).toBe(409);
  expect((await (await page.request.get('/api'+data.path+'/reports')).json()).length).toBe(1);
  await page.getByRole('dialog').getByLabel('متن گزارش کار',{exact:true}).fill('گزارش بدون ثبت تکراری');
  await page.getByRole('dialog').getByRole('button',{name:'ایجاد',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const reports=await (await page.request.get('/api'+data.path+'/reports')).json();expect(reports.length).toBe(1);expect(reports[0].id).toBe(reportId);
});

test('stale work drafts cannot overwrite another tab and remain available until the user accepts the latest version',async({page})=>{
  test.setTimeout(120000);const data=await setup(page),second=await page.context().newPage();
  try {
    await page.goto(data.path+'/edit');await second.goto(data.path+'/edit');
    await page.getByLabel(/^عنوان کار/).fill('ذخیره نفر اول');await second.getByLabel(/^عنوان کار/).fill('متن نفر دوم');
    await page.getByRole('button',{name:'ذخیره',exact:true}).click();await expect(page).toHaveURL('http://127.0.0.1:5190'+data.path);
    await second.bringToFront();await second.getByRole('button',{name:'ذخیره',exact:true}).click();
    await expect(second.getByRole('alert')).toContainText('متن شما حفظ شده');
    await expect(second.getByLabel(/^عنوان کار/)).toHaveValue('متن نفر دوم');
    expect((await (await page.request.get('/api'+data.path)).json()).title).toBe('ذخیره نفر اول');
    await second.reload();await expect(second.getByLabel(/^عنوان کار/)).toHaveValue('متن نفر دوم');
    await second.getByRole('button',{name:'ذخیره',exact:true}).click();
    await second.getByRole('button',{name:'بررسی نسخه جدید',exact:true}).click();
    await expect(second.getByRole('dialog').getByText('ذخیره نفر اول',{exact:true})).toBeVisible();
    await second.screenshot({path:'test-results/reliability-work-conflict.png',animations:'disabled'});
    await second.getByRole('button',{name:'بازگشت به ویرایش',exact:true}).click();await expect(second.getByLabel(/^عنوان کار/)).toHaveValue('متن نفر دوم');
    await second.getByRole('button',{name:'بررسی نسخه جدید',exact:true}).click();
    await second.getByRole('button',{name:'استفاده از نسخه جدید',exact:true}).click();
    await expect(second.getByLabel(/^عنوان کار/)).toHaveValue('ذخیره نفر اول');
    await second.getByLabel(/^عنوان کار/).fill('ذخیره پس از بررسی');await second.getByRole('button',{name:'ذخیره',exact:true}).click();
    await expect(second).toHaveURL('http://127.0.0.1:5190'+data.path);
    expect((await (await page.request.get('/api'+data.path)).json()).title).toBe('ذخیره پس از بررسی');
  } finally {await second.close();}
});

test('concurrent report edits retain the unsaved text and require reviewing the newer report',async({page})=>{
  const data=await setup(page);
  await page.request.post('/api'+data.path+'/reports',{headers:data.headers,data:{text:'گزارش آغازین'}});
  const second=await page.context().newPage();
  try {
    for(const tab of [page,second]) {await tab.goto(data.path);await tab.getByRole('button',{name:'ویرایش گزارش: گزارش آغازین',exact:true}).click();}
    await page.getByRole('dialog').getByLabel('متن گزارش کار',{exact:true}).fill('نسخه نفر اول');
    await second.getByRole('dialog').getByLabel('متن گزارش کار',{exact:true}).fill('نوشته نفر دوم');
    await page.getByRole('dialog').getByRole('button',{name:'ذخیره',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
    await second.bringToFront();await second.getByRole('dialog').getByRole('button',{name:'ذخیره',exact:true}).click();
    await expect(second.getByRole('dialog').getByRole('alert')).toContainText('فرد دیگری');
    await expect(second.getByRole('dialog').getByLabel('متن گزارش کار',{exact:true})).toHaveValue('نوشته نفر دوم');
    await second.getByRole('button',{name:'بررسی نسخه جدید',exact:true}).click();
    const review=second.getByRole('dialog').filter({has:second.getByRole('heading',{name:'بررسی نسخه جدید',exact:true})});
    await expect(review.getByText('نسخه نفر اول',{exact:true})).toBeVisible();
    await review.getByRole('button',{name:'استفاده از نسخه جدید',exact:true}).click();
    await expect(second.getByRole('dialog').getByLabel('متن گزارش کار',{exact:true})).toHaveValue('نسخه نفر اول');
    await second.getByRole('dialog').getByLabel('متن گزارش کار',{exact:true}).fill('نسخه هماهنگ‌شده');
    await second.getByRole('dialog').getByRole('button',{name:'ذخیره',exact:true}).click();await expect(second.getByRole('dialog')).toHaveCount(0);
    expect((await (await page.request.get('/api'+data.path+'/reports')).json())[0].text).toBe('نسخه هماهنگ‌شده');
  } finally {await second.close();}
});

test('stale assignment edits cannot remove another tabs additions and can be retried after loading the latest team',async({page,playwright})=>{
  const data=await setup(page),people=[];
  for(let index=0;index<2;index++) {
    const api=await playwright.request.newContext({baseURL:'http://127.0.0.1:5190',extraHTTPHeaders:clientHeaders()});
    try {
      const username='team_'+randomUUID().slice(0,8),response=await api.post('/api/auth/register',{data:{name:'Team '+index,username,password}});
      expect(response.status()).toBe(201);const person=(await response.json()).user;people.push(person);
      expect((await page.request.post('/api/projects/'+data.project.id+'/members',{headers:data.headers,data:{identifier:username}})).status()).toBe(201);
    } finally {await api.dispose();}
  }
  const second=await page.context().newPage();
  try {
    for(const tab of [page,second]) {await tab.goto(data.path);await tab.getByRole('button',{name:'ویرایش مسئولین',exact:true}).click();}
    await page.getByPlaceholder('جست‌وجوی نام کاربری',{exact:true}).fill(people[0].username);
    await page.getByRole('dialog').getByRole('button',{name:/اضافه کردن/}).click();
    await expect(page.getByRole('list',{name:'مسئولان این کار'}).getByText(people[0].name,{exact:true})).toBeVisible();
    await second.bringToFront();await second.getByPlaceholder('جست‌وجوی نام کاربری',{exact:true}).fill(people[1].username);
    await second.getByRole('dialog').getByRole('button',{name:/اضافه کردن/}).click();
    await expect(second.getByRole('dialog').getByRole('alert')).toContainText('تغییر شما اعمال نشد');
    expect((await (await page.request.get('/api'+data.path)).json()).assignees.map(person=>person.id)).toEqual([people[0].id]);
    await second.getByRole('button',{name:'دریافت نسخه جدید',exact:true}).click();
    await expect(second.getByRole('list',{name:'مسئولان این کار'}).getByText(people[0].name,{exact:true})).toBeVisible();
    await second.getByRole('dialog').getByRole('button',{name:/اضافه کردن/}).click();
    await expect(second.getByRole('list',{name:'مسئولان این کار'}).getByText(people[1].name,{exact:true})).toBeVisible();
    expect((await (await page.request.get('/api'+data.path)).json()).assignees.map(person=>person.id).sort()).toEqual(people.map(person=>person.id).sort());
  } finally {await second.close();}
});
