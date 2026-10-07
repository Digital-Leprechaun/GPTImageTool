/*! Copyright (c) 2026 Joseph M Wilcox. SPDX-License-Identifier: MIT */
import { build } from 'esbuild';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const output = await build({ entryPoints: ['web/viewer.mjs'], bundle: true, write: false, format: 'iife', target: 'es2022', minify: true, legalComments:'inline', metafile:true });
const html = await readFile('web/viewer.html', 'utf8');
const css = await readFile('web/viewer.css', 'utf8');
const logo = `data:image/png;base64,${(await readFile('web/assets/asset-pack-games.png')).toString('base64')}`;
await mkdir('dist', { recursive: true });
await writeFile('dist/viewer.html', html.replace('LOGO_DATA_URI', () => logo).replace('/* INLINE_STYLE */', () => css).replace('/* INLINE_SCRIPT */', () => output.outputFiles[0].text.replaceAll('</script', '<\\/script')));
const packages = new Map();
for (const input of Object.keys(output.metafile.inputs).filter(path => path.includes('node_modules/'))) {
  let directory = dirname(resolve(input));
  while (directory !== dirname(directory)) {
    try {
      const pkg = JSON.parse(await readFile(resolve(directory,'package.json'),'utf8'));
      if(pkg.name) { packages.set(directory,pkg); break; }
    } catch(error) { if(error.code !== 'ENOENT')throw error; }
    directory = dirname(directory);
  }
}
let notices = 'Third-party licenses for code bundled in dist/viewer.html\n\n';
for (const [directory,pkg] of packages) {
  notices += `===== ${pkg.name} ${pkg.version} (${pkg.license || 'see license below'}) =====\n`;
  const files = (await readdir(directory)).filter(name => /^(license|copying|notice)(\.|$)/i.test(name));
  if(!files.length)throw new Error(`Missing bundled license: ${pkg.name}`);
  for(const file of files)notices += `${file}\n${await readFile(resolve(directory,file),'utf8')}\n\n`;
}
await writeFile('THIRD_PARTY_NOTICES.txt', `${notices.trimEnd()}\n`);
