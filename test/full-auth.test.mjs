import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {createHmac,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

test('actual auth server uses signed test sessions and rejects cross-account workspace reads',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fc-real-auth-'));
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const origin=`http://127.0.0.1:${port}`,secret=randomBytes(32).toString('hex');
 const child=spawn(process.execPath,[resolve('../familychronica-auth/server.mjs')],{env:{PATH:process.env.PATH,PORT:String(port),DATA_DIR:dir,PUBLIC_ORIGIN:origin,SESSION_SECRET:secret},stdio:['ignore','pipe','pipe']});let errors='';child.stderr.on('data',b=>{errors+=b});child.stdout.resume();
 try {
  let ready=false;for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(errors);try{ready=(await fetch(origin+'/api/auth/health')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,50))}assert.ok(ready,errors);
  const db=new DatabaseSync(join(dir,'auth.sqlite'));const stamp=new Date().toISOString();for(const id of [1,2])db.prepare('INSERT INTO users(id,email,name,family_name,status,created_at) VALUES(?,?,?,?,?,?)').run(id,`fixture-${id}@example.invalid`,`Fixture ${id}`,`Private ${id}`,'active',stamp);db.close();
  const cookie=id=>{const payload=Buffer.from(JSON.stringify({uid:id,exp:Date.now()+60000})).toString('base64url');return 'fc_session='+payload+'.'+createHmac('sha256',secret).update(payload).digest('hex')};
  const call=(path,id,body)=>fetch(origin+path,{method:body?'POST':'GET',headers:{...(id?{cookie:cookie(id)}:{}),origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await call('/api/auth/workspace',null)).status,401);
  const session=await (await call('/api/auth/session',1)).json();assert.equal(session.authenticated,true);assert.equal(session.user.id,1);
  const create=await call('/api/auth/workspace/memories',1,{clientId:'isolated-auth-fixture',title:'Isolated test',text:'Not production data'});assert.equal(create.status,201);const {memory}=await create.json();
  assert.equal((await call(`/api/auth/workspace/memories/${memory.id}`,2)).status,404);
  const read=await (await call(`/api/auth/workspace/memories/${memory.id}`,1)).json();assert.equal(read.memory.text,'Not production data');
  const status=await (await call('/api/auth/workspace/ai/status',1)).json();assert.equal(status.available,false);
 } finally {child.kill('SIGTERM');await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));await rm(dir,{recursive:true,force:true})}
});
