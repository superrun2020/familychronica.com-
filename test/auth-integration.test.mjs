import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('production integration initializes after session authentication declarations',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fc-auth-integration-'));
 try {
  const source=join(dir,'baseline.mjs'),target=join(dir,'server.mjs');
  await symlink(resolve('../familychronica-auth/node_modules'),join(dir,'node_modules'));
  await writeFile(source,`import nodemailer from 'nodemailer';\nconst dataDir=${JSON.stringify(dir)};\nconst publicOrigin='http://127.0.0.1';\nconst transport=null;\nconst sessionUser=req=>null;\nconst audit=()=>{};\nasync function api(req,res,url){ return false; }\nawait api({resume(){}},{writeHead(status){if(status!==401)throw Error('Expected authentication gate')},end(text){if(!text.includes('AUTH_REQUIRED'))throw Error('Missing authentication response')}},new URL('http://127.0.0.1/api/auth/workspace'));\n`);
  const integration=spawnSync(process.execPath,['backend/apply-auth-integration.mjs',source,target],{encoding:'utf8'});
  assert.equal(integration.status,0,integration.stderr);
  const run=spawnSync(process.execPath,[target],{encoding:'utf8',timeout:10000});
  assert.equal(run.status,0,run.stderr);
 } finally {await rm(dir,{recursive:true,force:true})}
});
