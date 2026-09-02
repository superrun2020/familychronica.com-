import {readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(await readFile(join(root,'aso/metadata.json'),'utf8'));
const rules={appName:30,subtitle:30,keywords:100,googlePlayShortDescription:80,promotionalText:170,description:4000};
let failed=false;
for(const [locale,meta] of Object.entries(data.locales))for(const [field,max] of Object.entries(rules)){const length=[...String(meta[field]||'')].length;const ok=length>0&&length<=max;console.log(`${ok?'PASS':'FAIL'} ${locale} ${field}: ${length}/${max}`);if(!ok)failed=true}
if(failed)process.exitCode=1;
