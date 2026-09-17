import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, request as httpRequest } from 'node:http';
import { createWorkspaceService } from '../backend/workspace.mjs';

const origin='http://127.0.0.1';
async function fixture(provider=null,{probe=async()=>10}={}){
  const dir=await mkdtemp(join(tmpdir(),'fc-workspace-test-'));
  const service=await createWorkspaceService({dataDir:dir,publicOrigin:origin,provider,probe,sessionUser:req=>{
    const id=Number(req.headers['x-test-user']);
    return id?{id,email:`user${id}@test.invalid`,name:`User ${id}`,family_name:`Family ${id}`} : null;
  }});
  const server=createServer((req,res)=>service.handle(req,res,new URL(req.url,origin)));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=(path,{user=1,method='GET',body,headers={}}={})=>new Promise((resolve,reject)=>{const payload=body===undefined?null:Buffer.from(typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body));const req=httpRequest(base+path,{method,headers:{...(user?{'x-test-user':String(user)}:{}),...(method!=='GET'?{origin,'content-type':'application/json'}:{}),...(payload?{'content-length':payload.length}:{}),...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const bytes=Buffer.concat(chunks);resolve({status:res.statusCode,headers:{get:name=>res.headers[name.toLowerCase()]||null},json:async()=>JSON.parse(bytes),arrayBuffer:async()=>bytes})})});req.on('error',reject);if(payload)req.write(payload);req.end()});
  return {dir,service,request,close:async()=>{await new Promise(resolve=>server.close(resolve));service.close();await rm(dir,{recursive:true,force:true})}};
}

test('auth is checked before body validation and cross-origin mutations are rejected',async t=>{const f=await fixture();t.after(()=>f.close());
  let r=await f.request('/api/auth/workspace/memories',{user:0,method:'POST',body:{title:'x'.repeat(500)}});assert.equal(r.status,401);
  r=await f.request('/api/auth/workspace/memories',{method:'POST',body:{title:'x'},headers:{origin:'https://evil.invalid'}});assert.equal(r.status,403);
});

test('workspace is private, persistent, bounded, and stores text literally',async t=>{const f=await fixture();t.after(()=>f.close());
  let r=await f.request('/api/auth/workspace');assert.equal(r.status,200);let data=await r.json();assert.equal(data.workspace.familyName,'Family 1');assert.deepEqual(data.memories,[]);
  const title='<img src=x onerror=alert(1)>';r=await f.request('/api/auth/workspace/memories',{method:'POST',body:{clientId:'retry-1',title,text:'A real memory'}});assert.equal(r.status,201);const created=await r.json();assert.equal(created.memory.title,title);
  r=await f.request('/api/auth/workspace/memories',{method:'POST',body:{clientId:'retry-1',title,text:'A real memory'}});assert.equal(r.status,200);assert.equal((await r.json()).memory.id,created.memory.id);
  r=await f.request(`/api/auth/workspace/memories/${created.memory.id}`,{user:2});assert.equal(r.status,404);
  r=await f.request('/api/auth/workspace/memories',{method:'POST',body:{title:'x',text:'z'.repeat(100001)}});assert.equal(r.status,422);
  f.service.close(); const reopened=await createWorkspaceService({dataDir:f.dir,publicOrigin:origin,sessionUser:req=>Number(req.headers['x-test-user'])?{id:1,email:'user1@test.invalid',name:'User 1',family_name:'Family 1'}:null});
  const persisted=reopened.store.listMemories(1);assert.equal(persisted.length,1);assert.equal(persisted[0].title,title);reopened.close(); f.service.close=()=>{};
});

test('members are account-owned and reject IDOR updates',async t=>{const f=await fixture();t.after(()=>f.close());
  let r=await f.request('/api/auth/workspace/members',{method:'POST',body:{name:'Grandma',relationship:'Grandmother'}});assert.equal(r.status,201);const id=(await r.json()).member.id;
  r=await f.request(`/api/auth/workspace/members/${id}`,{user:2,method:'DELETE',body:{}});assert.equal(r.status,404);
});

test('media validates size, declared type and signatures then supports owned byte ranges',async t=>{const f=await fixture();t.after(()=>f.close());const png=Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1,2,3,4]);
  let r=await f.request('/api/auth/workspace/media?clientId=m1&kind=photo',{method:'POST',body:png,headers:{'content-type':'image/png'}});assert.equal(r.status,201);const media=(await r.json()).media;
  r=await f.request(`/api/auth/workspace/media/${media.id}`,{user:2});assert.equal(r.status,404);
  r=await f.request(`/api/auth/workspace/media/${media.id}`,{headers:{range:'bytes=2-5'}});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 2-5/12');assert.deepEqual(new Uint8Array(await r.arrayBuffer()),png.slice(2,6));
  r=await f.request('/api/auth/workspace/media?kind=photo',{method:'POST',body:'not png',headers:{'content-type':'image/png'}});assert.equal(r.status,415);
  r=await f.request('/api/auth/workspace/media?kind=photo',{method:'POST',body:new Uint8Array(11*1024*1024),headers:{'content-type':'image/png'}});assert.equal(r.status,413);
  r=await f.request(`/api/auth/workspace/media/${media.id}`,{headers:{range:'bytes=-4'}});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 8-11/12');assert.deepEqual(new Uint8Array(await r.arrayBuffer()),png.slice(8));
  r=await f.request(`/api/auth/workspace/media/${media.id}`,{headers:{range:'bytes=4-2'}});assert.equal(r.status,416);assert.equal(r.headers.get('content-range'),'bytes */12');
  r=await f.request(`/api/auth/workspace/media/${media.id}`,{headers:{range:'items=0-1'}});assert.equal(r.status,416);assert.equal(r.headers.get('content-range'),'bytes */12');
});

test('memory rejects a missing or foreign media reference instead of silently dropping it',async t=>{const f=await fixture();t.after(()=>f.close());
  let r=await f.request('/api/auth/workspace/memories',{method:'POST',body:{title:'bad',mediaId:'missing'}});assert.equal(r.status,422);assert.equal((await r.json()).error,'INVALID_MEDIA');
  const png=Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1]);
  r=await f.request('/api/auth/workspace/media?clientId=other&kind=photo',{user:2,method:'POST',body:png,headers:{'content-type':'image/png'}});const other=(await r.json()).media;
  r=await f.request('/api/auth/workspace/memories',{method:'POST',body:{title:'bad',mediaId:other.id}});assert.equal(r.status,422);assert.equal((await r.json()).error,'INVALID_MEDIA');
});

test('failed provider calls consume a persisted request reservation and successful chat retry is idempotent',async t=>{let calls=0;const f=await fixture({chat:async()=>{calls++;throw new Error('upstream')},transcribe:async()=>({transcript:'x',translation:''})});t.after(()=>f.close());
  let r=await f.request('/api/auth/workspace/ai/chat',{method:'POST',body:{clientId:'stable-chat',message:'Keep me once'}});assert.equal(r.status,502);
  r=await f.request('/api/auth/workspace/ai/chat',{method:'POST',body:{clientId:'stable-chat',message:'Keep me once'}});assert.equal(r.status,502);
  assert.equal(calls,2);
  const usage=f.service.store.getUsage(1);assert.equal(usage.requests,2);

  const good=await fixture({chat:async()=>({text:'Only one answer'}),transcribe:async()=>({transcript:'x',translation:''})});t.after(()=>good.close());
  const first=await good.request('/api/auth/workspace/ai/chat',{method:'POST',body:{clientId:'retry-chat',message:'Hello'}});assert.equal(first.status,200);const firstBody=await first.json();
  const second=await good.request('/api/auth/workspace/ai/chat',{method:'POST',body:{clientId:'retry-chat',message:'Hello'}});assert.equal(second.status,200);const secondBody=await second.json();
  assert.equal(secondBody.message.id,firstBody.message.id);assert.equal(secondBody.duplicate,true);assert.equal(good.service.store.getUsage(1).requests,1);
});

test('conservative persisted budget permits exactly five AI operations per day',async t=>{const f=await fixture({chat:async()=>({text:'ok'}),transcribe:async()=>({transcript:'ok',translation:''})});t.after(()=>f.close());for(let i=0;i<5;i++)assert.equal((await f.request('/api/auth/workspace/ai/chat',{method:'POST',body:{clientId:`budget-${i}`,message:'hello'}})).status,200);const sixth=await f.request('/api/auth/workspace/ai/chat',{method:'POST',body:{clientId:'budget-6',message:'hello'}});assert.equal(sixth.status,429);assert.equal((await sixth.json()).error,'AI_DAILY_QUOTA');const usage=f.service.store.getUsage(1);assert.equal(usage.cost,500000);assert.equal(usage.requests,5);assert.equal(usage.audioSeconds,0)});

test('AI absence is explicit while drafts save; provider failures persist user chat',async t=>{const f=await fixture();t.after(()=>f.close());
  let r=await f.request('/api/auth/workspace/ai/status');assert.equal(r.status,200);assert.equal((await r.json()).available,false);
  r=await f.request('/api/auth/workspace/ai/chat',{method:'POST',body:{clientId:'c1',message:'Tell me about home'}});assert.equal(r.status,503);
  const ws=await (await f.request('/api/auth/workspace')).json();assert.equal(ws.chat.at(-1).role,'user');
  const broken=await fixture({chat:async()=>{throw new Error('secret upstream detail')},transcribe:async()=>{throw new Error('bad')}});t.after(()=>broken.close());
  r=await broken.request('/api/auth/workspace/ai/chat',{method:'POST',body:{clientId:'c2',message:'Keep this draft'}});assert.equal(r.status,502);assert.equal((await r.json()).error,'AI_PROVIDER_ERROR');
  const ws2=await (await broken.request('/api/auth/workspace')).json();assert.equal(ws2.chat.at(-1).content,'Keep this draft');
});

test('transcription segments are ordered, idempotent, bounded, and provider-backed',async t=>{let calls=0;const f=await fixture({chat:async()=>({text:'ok',usageCostMicros:1}),transcribe:async({sequence})=>{calls++;return {transcript:`line ${sequence}`,translation:`行 ${sequence}`,usageCostMicros:2}}});t.after(()=>f.close());const audio=Uint8Array.from([0x1a,0x45,0xdf,0xa3,1,2]);
  let r=await f.request('/api/auth/workspace/transcription/segments?recordingId=r1&segmentId=s1&sequence=1&language=en&translateTo=zh-CN',{method:'POST',body:audio,headers:{'content-type':'audio/webm'}});assert.equal(r.status,200);
  r=await f.request('/api/auth/workspace/transcription/segments?recordingId=r1&segmentId=s1&sequence=1&language=en&translateTo=zh-CN',{method:'POST',body:audio,headers:{'content-type':'audio/webm'}});assert.equal(r.status,200);assert.equal(calls,1);
  r=await f.request('/api/auth/workspace/transcription/segments?recordingId=r1&segmentId=s3&sequence=3',{method:'POST',body:audio,headers:{'content-type':'audio/webm'}});assert.equal(r.status,409);
});

test('concurrent retries of the same transcription segment share one provider call',async t=>{let calls=0,release;const gate=new Promise(resolve=>{release=resolve});const f=await fixture({chat:async()=>({text:'ok'}),transcribe:async()=>{calls++;await gate;return {transcript:'one',translation:''}}});t.after(()=>f.close());const audio=Uint8Array.from([0x1a,0x45,0xdf,0xa3,1,2]);const options={method:'POST',body:audio,headers:{'content-type':'audio/webm'}};
  const first=f.request('/api/auth/workspace/transcription/segments?recordingId=parallel&segmentId=same&sequence=1',options);
  const second=f.request('/api/auth/workspace/transcription/segments?recordingId=parallel&segmentId=same&sequence=1',options);
  await new Promise(resolve=>setTimeout(resolve,20));release();
  assert.equal((await first).status,200);assert.equal((await second).status,200);assert.equal(calls,1);assert.equal(f.service.store.getUsage(1).requests,1);assert.equal(f.service.store.getUsage(1).audioSeconds,10);
});

test('concurrent duplicate media admission creates only one stored item',async t=>{const f=await fixture();t.after(()=>f.close());const png=Buffer.alloc(1024*1024,1);Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(png);const options={method:'POST',body:png,headers:{'content-type':'image/png'}};const results=await Promise.all([f.request('/api/auth/workspace/media?clientId=race&kind=photo',options),f.request('/api/auth/workspace/media?clientId=race&kind=photo',options)]);assert.ok(results.some(r=>r.status===201));assert.ok(results.every(r=>[200,201,429].includes(r.status)));const workspace=await(await f.request('/api/auth/workspace')).json();assert.equal(workspace.media.length,1)});

test('persistent 250 MiB media quota rejects the first byte over the limit',async t=>{const f=await fixture();t.after(()=>f.close());const png=Buffer.alloc(10*1024*1024,1);Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(png);for(let i=0;i<25;i++){const r=await f.request(`/api/auth/workspace/media?clientId=limit-${i}&kind=photo`,{method:'POST',body:png,headers:{'content-type':'image/png'}});assert.equal(r.status,201)}const extra=Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1]);const rejected=await f.request('/api/auth/workspace/media?clientId=over&kind=photo',{method:'POST',body:extra,headers:{'content-type':'image/png'}});assert.equal(rejected.status,413);assert.equal((await rejected.json()).error,'ACCOUNT_MEDIA_LIMIT')});

test('measured duration is accumulated and overlong probes fail closed',async t=>{const provider={chat:async()=>({text:'ok'}),transcribe:async()=>({transcript:'ok',translation:''})},audio=Uint8Array.from([0x1a,0x45,0xdf,0xa3,1]);const valid=await fixture(provider,{probe:async()=>14.75});t.after(()=>valid.close());let r=await valid.request('/api/auth/workspace/transcription/segments?recordingId=measured&segmentId=s1&sequence=1',{method:'POST',body:audio,headers:{'content-type':'audio/webm'}});assert.equal(r.status,200);assert.equal(valid.service.store.getUsage(1).audioSeconds,14.75);const bad=await fixture(provider,{probe:async()=>15.01});t.after(()=>bad.close());r=await bad.request('/api/auth/workspace/transcription/segments?recordingId=bad&segmentId=s1&sequence=1',{method:'POST',body:audio,headers:{'content-type':'audio/webm'}});assert.equal(r.status,422);assert.equal(bad.service.store.getUsage(1).requests,0)});
