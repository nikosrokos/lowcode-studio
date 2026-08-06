const esbuild = require('esbuild');

esbuild
  .build({
    entryPoints: ['out/extension.js'],
    bundle: true,
    outfile: 'out/extension.bundled.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    sourcemap: false,
    minify: false,
    logLevel: 'info'
  })
  .then(() => {
    const fs = require('fs');
    fs.renameSync('out/extension.bundled.js', 'out/extension.js');
    console.log('Bundled extension.js (includes adm-zip + fast-xml-parser)');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
