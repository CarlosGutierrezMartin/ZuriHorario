import { test, expect } from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/');});
test('configure, save a shift, edit it, and reload the persisted total',async({page,isMobile})=>{
  const nav=page.getByRole('navigation',{name:isMobile?'Navegación móvil':'Navegación principal'});
  await nav.getByRole('button',{name:'Configuración'}).click();
  await page.getByLabel('¿Cómo te llamamos?').fill('Zuri');
  await page.getByLabel('Horas que debes trabajar cada mes').fill('160');
  await page.getByRole('button',{name:'Guardar configuración',exact:true}).click();
  await nav.getByRole('button',{name:'Inicio',exact:true}).click();
  const form=page.locator('#entry-form');
  await form.getByLabel('Entrada',{exact:true}).fill('08:30');
  await form.getByLabel('Salida',{exact:true}).fill('17:00');
  await form.getByLabel('Pausa').fill('45');
  await expect(form.locator('#live-total')).toHaveText('7 h 45 min');
  await form.getByRole('button',{name:'Guardar mi jornada'}).click();
  await expect(page.locator('.stat-number')).toContainText('7 h 45 min');
  await page.reload();
  await expect(page.locator('.stat-number')).toContainText('7 h 45 min');
  await page.locator('#entry-form').getByLabel('Salida',{exact:true}).fill('18:00');
  await page.getByRole('button',{name:'Guardar cambios'}).click();
  await expect(page.locator('.stat-number')).toContainText('8 h 45 min');
  await expect(page.locator('.progress-caption')).toContainText('160 h');
});
test('plan a shift without adding worked hours and display it in the calendar',async({page,isMobile})=>{
  const nav=page.getByRole('navigation',{name:isMobile?'Navegación móvil':'Navegación principal'});
  await nav.getByRole('button',{name:'Calendario',exact:true}).click();
  await page.getByRole('button',{name:'Añadir turno',exact:true}).first().click();
  const modal=page.getByRole('dialog');
  await modal.getByLabel('Nombre del turno').fill('Turno de mañana');
  await modal.getByLabel('Entrada',{exact:true}).fill('07:00');
  await modal.getByLabel('Salida',{exact:true}).fill('15:00');
  await modal.getByRole('button',{name:'Guardar turno'}).click();
  await expect(page.locator('.plan-title')).toHaveText('Turno de mañana');
  await nav.getByRole('button',{name:'Inicio',exact:true}).click();
  await expect(page.locator('.stat-number')).toContainText('0 h');
  await expect(page.locator('.mini-stat').last()).toContainText('7 h 30 min');
});
test('night shift, multiple intervals and validation',async({page})=>{
  const form=page.locator('#entry-form');
  await form.getByLabel('Entrada',{exact:true}).fill('22:00');
  await form.getByLabel('Salida',{exact:true}).fill('06:00');
  await form.getByRole('button',{name:'Guardar mi jornada'}).click();
  await expect(form.locator('.form-error')).toContainText('posterior');
  await form.getByLabel('Termina al día siguiente').check();
  await expect(form.locator('#live-total')).toHaveText('7 h 30 min');
  await form.getByRole('button',{name:'Guardar mi jornada'}).click();
  await expect(page.locator('.stat-number')).toContainText('7 h 30 min');
});
test('PWA has icons, registers its worker and saves offline',async({page,context,browserName})=>{
  const manifestHref=await page.locator('link[rel=manifest]').getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const manifest=await (await page.request.get(manifestHref!)).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((i:{sizes:string})=>i.sizes)).toContain('192x192');
  expect(manifest.icons.map((i:{sizes:string})=>i.sizes)).toContain('512x512');
  for(const icon of manifest.icons)expect((await page.request.get(icon.src)).ok()).toBe(true);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);
  if(browserName!=='webkit')await page.reload();
  await expect(page.getByRole('heading',{name:'Hola, Zuri'})).toBeVisible();
  await page.locator('#entry-form').getByRole('button',{name:'Guardar mi jornada'}).click();
  await expect(page.locator('.stat-number')).toContainText('7 h 30 min');
  if(browserName!=='webkit')await page.reload();
  await expect(page.locator('.stat-number')).toContainText('7 h 30 min');
  await context.setOffline(false);
  // WebKit's test-driver offline navigation can return an internal error.
  // Check the offline precache independently and the saved record after reconnecting.
  if(browserName==='webkit'){
    const cached=await page.evaluate(async()=>!!await caches.match(new URL('./index.html',location.href).href,{ignoreSearch:true}));
    expect(cached).toBe(true);
    await page.reload();await expect(page.locator('.stat-number')).toContainText('7 h 30 min');
  }
});
test('plan current and following weeks, then download exactly those shifts',async({page,isMobile})=>{
  const nav=page.getByRole('navigation',{name:isMobile?'Navegación móvil':'Navegación principal'});
  await nav.getByRole('button',{name:'Calendario',exact:true}).click();
  await page.getByRole('button',{name:'Planificar semana',exact:true}).click();
  const form=page.locator('#week-form');
  await form.getByLabel('Nombre de los turnos').fill('Turno de Zuri');
  const monday=form.locator('.weekly-row').first();
  await monday.getByLabel('Entrada',{exact:true}).fill('08:00');
  await monday.getByLabel('Salida',{exact:true}).fill('16:00');
  await form.getByLabel('Repetir en las siguientes semanas').selectOption('2');
  await form.getByRole('button',{name:'Guardar semana'}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('zurihorario:guest')!).plans);
  expect(Object.keys(saved)).toHaveLength(10);
  await page.getByRole('button',{name:'Exportar turnos',exact:true}).click();
  await expect(page.getByRole('dialog').locator('.export-count')).toContainText('5 turnos');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Descargar archivo .ics'}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/ZuriHorario-turnos-.*\.ics/);
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.getByRole('button',{name:'Semana siguiente',exact:true}).click();
  await expect(page.locator('.weekly-row').first().getByLabel('Entrada',{exact:true})).toHaveValue('08:00');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('mobile layout fits and installation has iPhone instructions',async({page,isMobile})=>{
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  if(isMobile){const nav=page.getByRole('navigation',{name:'Navegación móvil'});await nav.getByRole('button',{name:'Configuración'}).click();}
  await page.getByRole('button',{name:isMobile?'Instalar ZuriHorario':'Instalar la app',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('En iPhone o iPad');
  await expect(page.getByRole('dialog')).toContainText('Añadir a pantalla de inicio');
});
