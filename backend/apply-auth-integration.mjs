import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

const source = resolve(process.argv[2] || 'server.mjs');
const destination = resolve(process.argv[3] || source);
const targetDirectory = dirname(destination);
let server = await readFile(source, 'utf8');

const importMarker = "import nodemailer from 'nodemailer';";
if (!server.includes(importMarker)) throw new Error(`Integration anchor missing: ${importMarker}`);
const integrationImports = `${importMarker}\nimport { createWorkspaceService } from './workspace.mjs';\nimport { createOpenAIProvider } from './openai.mjs';`;
if (!server.includes("from './workspace.mjs'")) server = server.replace(importMarker, integrationImports);

const setupMarker = "const audit=";
if (!server.includes(setupMarker)) throw new Error(`Integration anchor missing: ${setupMarker}`);
const setup = "const workspaceService=await createWorkspaceService({dataDir,publicOrigin,sessionUser,provider:createOpenAIProvider(process.env)});\n";
if (!server.includes('const workspaceService=')) server = server.replace(setupMarker, `${setup}${setupMarker}`);

const dispatchMarker = 'async function api(req,res,url){';
if (!server.includes(dispatchMarker)) throw new Error(`Integration anchor missing: ${dispatchMarker}`);
if (!server.includes('if(await workspaceService.handle(req,res,url))')) {
  server = server.replace(dispatchMarker, `${dispatchMarker}\n  if(await workspaceService.handle(req,res,url))return;`);
}

await writeFile(destination, server, 'utf8');
for (const moduleName of ['workspace.mjs', 'openai.mjs']) {
  await copyFile(new URL(moduleName, import.meta.url), join(targetDirectory, moduleName));
}
console.log(`Integrated FamilyChronica workspace into ${basename(destination)} with local production imports.`);
