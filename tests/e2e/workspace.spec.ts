import { test, expect } from '@playwright/test';
test('T02/T05 confirmed profile and manual skills survive reload',async({page})=>{
 await page.goto('/demo');await page.getByRole('button',{name:'My profile',exact:true}).click();
 await page.getByLabel('Learning hours per week').fill('6');await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByRole('status')).toContainText('Profile saved');
 await page.reload();await page.getByRole('button',{name:'My profile',exact:true}).click();await expect(page.getByLabel('Learning hours per week')).toHaveValue('6');
 await page.getByRole('button',{name:'My skills',exact:true}).click();await page.getByLabel('Additional skill').fill('C++');await page.getByRole('button',{name:'Add skill',exact:true}).click();await page.getByRole('button',{name:'Confirm skills',exact:true}).click();await expect(page.getByRole('status')).toContainText('Skills confirmed');
 await page.reload();await page.getByRole('button',{name:'My skills',exact:true}).click();await expect(page.getByRole('button',{name:'Remove C++'})).toBeVisible();
});
test('T03/T07/T08/T09 consent, sample plan, progress, undo, safe failed replacement',async({page})=>{
 await page.goto('/demo');await page.getByRole('button',{name:'Learning roadmap',exact:true}).click();await expect(page.getByRole('button',{name:'Create sample roadmap'})).toBeDisabled();
 await page.getByRole('button',{name:'Privacy & settings',exact:true}).click();await page.getByRole('switch',{name:'Learning roadmap generation'}).click();await expect(page.getByRole('switch',{name:'Optional CV skill extraction'})).not.toBeChecked();
 await page.getByRole('button',{name:'Learning roadmap',exact:true}).click();await page.getByRole('button',{name:'Create sample roadmap'}).click();await expect(page.getByText('Completion records activity',{exact:false})).toBeVisible();
 const first=page.getByRole('checkbox',{name:'Complete Generative AI fundamentals'});await first.click();await expect(first).toBeChecked();
 await page.reload();await page.getByRole('button',{name:'Learning roadmap',exact:true}).click();await expect(first).toBeChecked();await first.click();await expect(first).not.toBeChecked();await first.click();
 await page.getByRole('button',{name:'My profile',exact:true}).click();await page.getByLabel('Learning hours per week').fill('1');await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await page.getByRole('button',{name:'Learning roadmap',exact:true}).click();await expect(page.getByText('Your saved inputs changed.',{exact:false})).toBeVisible();await page.getByRole('button',{name:'Replace plan',exact:true}).click();await page.getByRole('button',{name:'Create sample roadmap'}).click();await expect(page.getByRole('alert').filter({hasText:'exceeds your weekly'})).toBeVisible();await page.getByRole('button',{name:'Keep current plan'}).click();await expect(first).toBeChecked();
});
test('T14 mobile layout is usable without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/demo');await expect(page.getByRole('heading',{name:'Your next chapter, Alex.'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'My skills',exact:true}).click();await expect(page.getByRole('button',{name:'Confirm skills',exact:true})).toBeVisible();
});
test('T01 private routes do not return data without a session; mutations reject cross-origin',async({request})=>{
 const me=await request.get('/api/me');expect(me.status()).toBe(401);expect(await me.json()).toMatchObject({code:'SIGN_IN_REQUIRED',data:null});
 const mutation=await request.put('/api/profile',{headers:{origin:'https://untrusted.example'},data:{currentRole:'QA'}});expect(mutation.status()).toBe(403);expect(await mutation.json()).toMatchObject({code:'ORIGIN_DENIED'});
});
test('T09 stale edits in another tab are rejected and preserve the draft',async({context,page})=>{
 await page.goto('/demo');await page.getByRole('button',{name:'My profile',exact:true}).click();await page.getByLabel('Learning hours per week').fill('8');
 const other=await context.newPage();await other.goto('/demo');await other.getByRole('button',{name:'My profile',exact:true}).click();await other.getByLabel('Learning hours per week').fill('6');await other.getByRole('button',{name:'Save profile',exact:true}).click();await expect(other.getByRole('status')).toContainText('Profile saved');
 await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'saved data changed'})).toBeVisible();await expect(page.getByLabel('Learning hours per week')).toHaveValue('8');
 await page.reload();await page.getByRole('button',{name:'My profile',exact:true}).click();await expect(page.getByLabel('Learning hours per week')).toHaveValue('6');
});
