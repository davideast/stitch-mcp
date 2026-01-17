import fs from 'node:fs';
import path from 'node:path';

const binDir = path.join(process.cwd(), 'bin');
const binFile = path.join(binDir, 'stitch-mcp.js');

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir);
}

const content = `#!/usr/bin/env node
import '../dist/cli.js';
`;

fs.writeFileSync(binFile, content);
fs.chmodSync(binFile, '755');

console.log('Generated bin/stitch-mcp.js');
