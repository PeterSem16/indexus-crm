const fs = require('fs');
const path = require('path');
const constFile = path.join(__dirname, '..', 'node_modules', 'msgreader', 'lib', 'const.js');
if (!fs.existsSync(constFile)) { console.log('[patch-msgreader] msgreader not found, skipping'); process.exit(0); }
let content = fs.readFileSync(constFile, 'utf-8');
if (content.includes("'1009'") && content.includes("'1013'")) { console.log('[patch-msgreader] already patched'); process.exit(0); }
content = content.replace(
  "'1000': 'body',",
  "'1000': 'body',\n        '1009': 'compressedRtf',\n        '1013': 'bodyHtml',"
);
fs.writeFileSync(constFile, content, 'utf-8');
console.log('[patch-msgreader] patched: added compressedRtf (0x1009) and bodyHtml (0x1013) properties');
