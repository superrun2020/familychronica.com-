import { readFile,writeFile,mkdir,rm } from 'node:fs/promises';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seoRoutes,publicSeoRoutes } from '../seo.js';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(join(root,'index.html'),'utf8');
const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const origin='https://familychronica.com';

for(const [path,meta] of Object.entries(seoRoutes)){
  if(path==='/')continue;
  const canonical=`${origin}${path}`;
  let html=source
    .replace(/<title>.*?<\/title>/,`<title>${escape(meta.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${escape(meta.description)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/,`<meta property="og:title" content="${escape(meta.title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/,`<meta property="og:description" content="${escape(meta.description)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/,`<meta property="og:url" content="${canonical}">`)
    .replace(/<meta name="robots" content="[^"]*">/,`<meta name="robots" content="${meta.noindex?'noindex, nofollow':'index, follow, max-image-preview:large'}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/,`<meta name="twitter:title" content="${escape(meta.title)}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/,`<meta name="twitter:description" content="${escape(meta.description)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/,`<link rel="canonical" href="${canonical}">`);
  const pageSchema=JSON.stringify({'@context':'https://schema.org','@type':'WebPage',name:meta.title,description:meta.description,url:canonical,isPartOf:{'@id':'https://familychronica.com/#website'}}).replaceAll('<','\\u003c');
  html=html.replace('</head>',`  <script type="application/ld+json">${pageSchema}</script>\n</head>`);
  const out=join(root,path.slice(1),'index.html');await mkdir(dirname(out),{recursive:true});await writeFile(out,html);
}

const date=new Date().toISOString().slice(0,10);
const urls=publicSeoRoutes.map(path=>`  <url><loc>${origin}${path==='/'?'/':path}</loc><lastmod>${date}</lastmod><changefreq>${path==='/'?'weekly':'monthly'}</changefreq><priority>${path==='/'?'1.0':'0.7'}</priority></url>`).join('\n');
await writeFile(join(root,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
console.log(`Generated ${Object.keys(seoRoutes).length-1} route pages and ${publicSeoRoutes.length} sitemap URLs.`);
