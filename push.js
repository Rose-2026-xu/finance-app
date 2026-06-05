const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = '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';
const REPO = 'Rose-2026-xu/finance-app';
const ROOT = 'E:/code/finance-app';

// Collect all files to upload
function collectFiles(dir, base) {
  const skip = ['node_modules', '.git', 'data', 'uploads'];
  let files = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (skip.includes(item)) continue;
    const full = path.join(dir, item);
    const rel = base ? base + '/' + item : item;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      files = files.concat(collectFiles(full, rel));
    } else if (stat.isFile()) {
      files.push(rel);
    }
  }
  return files;
}

const FILES = collectFiles(ROOT, '');
console.log(`Found ${FILES.length} files to upload`);

function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: `/repos/${REPO}${urlPath}`,
      method,
      headers: { 'Authorization': `token ${TOKEN}`, 'User-Agent': 'node-push', 'Content-Type': 'application/json' }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function uploadFile(filePath) {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) { console.log(`⏭ ${filePath}`); return; }
  const content = fs.readFileSync(fullPath).toString('base64');
  let sha = '';
  try {
    const res = await apiRequest('GET', `/contents/${filePath}?ref=master`, null);
    if (res.sha) sha = res.sha;
  } catch {}
  const body = { message: `upload ${filePath}`, content, branch: 'master' };
  if (sha) body.sha = sha;
  const res = await apiRequest('PUT', `/contents/${filePath}`, body);
  console.log(res.commit ? `✅ ${filePath}` : `❌ ${filePath} ${JSON.stringify(res).slice(0,100)}`);
}

(async () => {
  for (const f of FILES) {
    await uploadFile(f);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }
  console.log(`\n🎉 ${FILES.length} files uploaded!`);
})();
