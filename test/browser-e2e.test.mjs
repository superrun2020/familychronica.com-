import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createWorkspaceService } from '../backend/workspace.mjs';

const playwrightPath = process.env.PLAYWRIGHT_PATH || '/tmp/fc-browser-qa/node_modules/playwright/index.mjs';
const root = new URL('..', import.meta.url).pathname;
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

async function fixture() {
  const dataDir = await mkdtemp(join(tmpdir(), 'fc-browser-test-'));
  let service;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/api/auth/session') {
      const authenticated = request.headers['x-test-user'] === '1';
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ authenticated, user: authenticated ? { id: 1 } : null }));
      return;
    }
    if (url.pathname === '/api/auth/logout') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end('{"ok":true}');
      return;
    }
    if (service && await service.handle(request, response, url)) return;
    let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (!relative) relative = 'index.html';
    let filename = normalize(join(root, relative));
    if (!filename.startsWith(root)) { response.writeHead(404).end(); return; }
    try {
      if ((await stat(filename)).isDirectory()) filename = join(filename, 'index.html');
      const bytes = await readFile(filename);
      response.writeHead(200, { 'Content-Type': contentTypes[extname(filename)] || 'application/octet-stream' });
      response.end(bytes);
    } catch {
      const bytes = await readFile(join(root, 'index.html'));
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(bytes);
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  service = await createWorkspaceService({
    dataDir,
    publicOrigin: base,
    sessionUser: request => request.headers['x-test-user'] === '1' ? { id: 1, email: '', name: '', family_name: 'Test Family' } : null,
  });
  return {
    base,
    service,
    close: async () => {
      await new Promise(resolve => server.close(resolve));
      service.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

test('real browser workspace persists safe content, media, members, languages and a complete recording', { timeout: 60_000 }, async t => {
  const { chromium } = await import(pathToFileURL(playwrightPath));
  const f = await fixture();
  t.after(() => f.close());
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  t.after(() => browser.close());

  const anonymous = await browser.newContext();
  const anonymousPage = await anonymous.newPage();
  await anonymousPage.goto(`${f.base}/dashboard`);
  await anonymousPage.waitForURL(/\/login\?next=%2Fdashboard|\/login\?next=\/dashboard/);
  await anonymous.close();

  const context = await browser.newContext({ extraHTTPHeaders: { 'x-test-user': '1' } });
  const page = await context.newPage();
  await page.goto(`${f.base}/dashboard`);
  await page.locator('#openAi').waitFor();
  assert.equal(await page.locator('.fc-avatar').textContent(), '?');
  await page.locator('#openAi').click();
  await page.locator('#aiScreen:not([hidden])').waitFor();
  await page.locator('#aiWarning').waitFor({ state: 'visible' });
  assert.match(await page.locator('#aiWarning').textContent(), /not configured/i);

  await page.locator('[data-ai-action="write"]').click();
  await page.locator('#memoryTitle').fill('<img src=x onerror=alert(1)>');
  await page.locator('#memoryText').fill('A browser-saved memory');
  await page.locator('#memoryForm button').click();
  await page.locator('.fc-memory-list article').waitFor();
  assert.equal(await page.locator('.fc-memory-list img').count(), 0);
  assert.match(await page.locator('.fc-memory-list article h3').textContent(), /<img/);
  await page.reload();
  await page.locator('.fc-memory-list article').waitFor();
  assert.match(await page.locator('.fc-memory-list').textContent(), /A browser-saved memory/);

  await page.locator('[data-action="photos"]').click();
  const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  await page.locator('#uploadFile').setInputFiles({ name: 'memory.png', mimeType: 'image/png', buffer: onePixelPng });
  await page.locator('#uploadForm button').click();
  await page.locator('.fc-media-grid img').waitFor();
  await page.reload();
  await page.locator('[data-action="photos"]').click();
  await page.locator('.fc-media-grid img').waitFor();

  await page.locator('[data-action="members"]').click();
  await page.locator('#memberForm button').click();
  assert.ok(await page.locator('#memberName').evaluate(element => !element.checkValidity()));
  await page.locator('#memberName').fill('Grandma');
  await page.locator('#memberRelation').fill('Grandmother');
  await page.locator('#memberForm button').click();
  await page.locator('text=Grandma · Grandmother').waitFor();

  for (const [lang, expected] of [['zh-CN', '你好，今天想记录什么故事？'], ['es', '¿Qué te gustaría conservar hoy?'], ['en', 'Hello, what story would you like to record today?']]) {
    await page.evaluate(value => localStorage.setItem('fc-language', value), lang);
    await page.reload();
    assert.match(await page.locator('.fc-welcome h1').textContent(), new RegExp(expected.replace(/[?]/g, '\\?')));
  }

  await page.locator('#openAi').click();
  await page.locator('#aiWave').click();
  assert.equal(await page.locator('#recordPreview').evaluate(video => video.srcObject), null);
  await page.locator('#startRecording').click();
  await page.locator('#recordTimer').waitFor();
  await page.waitForTimeout(1_500);
  await page.locator('#stopRecording').click();
  await page.locator('.fc-memory-list video').waitFor({ timeout: 20_000 });
  const mediaState = await page.locator('.fc-memory-list video').evaluate(async video => {
    await new Promise((resolve, reject) => {
      if (video.readyState >= 1) return resolve();
      video.addEventListener('loadedmetadata', resolve, { once: true });
      video.addEventListener('error', reject, { once: true });
    });
    video.muted = true;
    await video.play();
    await new Promise(resolve => setTimeout(resolve, 500));
    const currentTime = video.currentTime;
    video.pause();
    return { currentTime, readyState: video.readyState };
  });
  assert.ok(mediaState.readyState >= 1);
  assert.ok(mediaState.currentTime > 0);

  await page.locator('#openAi').click();
  await page.locator('#aiWave').click();
  await page.locator('#startRecording').click();
  await page.waitForTimeout(300);
  await page.locator('#exitAi').count();
  await page.evaluate(() => history.pushState({}, '', '/'));
  await page.evaluate(() => dispatchEvent(new PopStateEvent('popstate')));
  const ended = await page.evaluate(() => ![...document.querySelectorAll('video')].some(video => video.srcObject?.getTracks().some(track => track.readyState === 'live')));
  assert.equal(ended, true);
  await context.close();
});

test('delayed media permission resolving after navigation immediately stops acquired tracks', {timeout:30000}, async t=>{
  const {chromium}=await import(pathToFileURL(playwrightPath)),f=await fixture();t.after(()=>f.close());const browser=await chromium.launch({channel:'chrome',headless:true});t.after(()=>browser.close());const context=await browser.newContext({extraHTTPHeaders:{'x-test-user':'1'}}),page=await context.newPage();await page.goto(`${f.base}/dashboard`);await page.locator('#openAi').click();await page.locator('#aiWave').click();await page.evaluate(()=>{window.__stopped=false;let resolve;const pending=new Promise(r=>{resolve=r});navigator.mediaDevices.getUserMedia=()=>pending;window.__resolvePermission=()=>resolve({getTracks:()=>[{stop(){window.__stopped=true}}]})});await page.locator('#startRecording').click();assert.equal(await page.locator('#startRecording').isDisabled(),true);await page.evaluate(()=>{history.pushState({},'','/');dispatchEvent(new PopStateEvent('popstate'))});await page.evaluate(()=>window.__resolvePermission());await page.waitForFunction(()=>window.__stopped===true);assert.equal(await page.evaluate(()=>window.__stopped),true);await context.close();
});
