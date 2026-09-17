import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('dashboard is mounted as a real module and production integration uses local modules',async()=>{
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const authPatch=await readFile(new URL('../backend/apply-auth-integration.mjs',import.meta.url),'utf8');
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const directHtml=await readFile(new URL('../dashboard/index.html',import.meta.url),'utf8');
  assert.match(app,/mountFamilyDashboard/);
  assert.match(authPatch,/from '\.\/workspace\.mjs'/);
  assert.match(authPatch,/from '\.\/openai\.mjs'/);
  assert.match(html,/dashboard\.css/);
  assert.match(directHtml,/dashboard\.css/);
});

test('login and signup SPA entries load the released dashboard stylesheet and script',async()=>{
  for(const entry of ['login','signup']){
    const html=await readFile(new URL(`../${entry}/index.html`,import.meta.url),'utf8');
    assert.match(html,/dashboard\.css\?v=20260917\.3/);
    assert.match(html,/app\.js\?v=20260917\.3/);
  }
});

test('recording implementation uses independent complete segments and a continuous archive recorder',async()=>{
  const source=await readFile(new URL('../dashboard.js',import.meta.url),'utf8');
  assert.match(source,/new MediaStream\(stream\.getAudioTracks\(\)\)/);
  assert.match(source,/Promise\.all\(\[stopRecorder\(session\.segmentRecorder\), stopRecorder\(session\.archiveRecorder\)\]\)/);
  assert.match(source,/archiveRecorder/);
  assert.match(source,/pagehide/);
  assert.doesNotMatch(source,/setTimeout\(resolve, 50\)/);
  assert.doesNotMatch(source,/SpeechRecognition|webkitSpeechRecognition/);
});
