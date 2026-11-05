// 미리 보기(이 PC 만): 먼치킨홈 docs/ 를 127.0.0.1 에서 보여 준다. /album/mock.js 는 tools/preview-mock.js(가짜 서버 — 올리는 파일 아님).
//   node tools/preview.mjs [포트=5333]  →  첫 페이지 http://127.0.0.1:5333/  ·  추억앨범 신청 http://127.0.0.1:5333/album/?mock=new
//   (album.js 는 127.0.0.1 이고 ?mock 이 있을 때만 mock.js 를 부른다 — 실제 서버에는 아무것도 보내지 않는다)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', 'docs');
const PORT = Number(process.argv[2] || 5333);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };
http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = p === '/album/mock.js' ? path.join(HERE, 'preview-mock.js') : path.join(ROOT, p);
  if (!file.startsWith(ROOT) && file !== path.join(HERE, 'preview-mock.js')) { res.writeHead(403).end(); return; }
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch { res.writeHead(404).end('없음'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('없음'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`http://127.0.0.1:${PORT}/  ·  http://127.0.0.1:${PORT}/album/?mock=new`));