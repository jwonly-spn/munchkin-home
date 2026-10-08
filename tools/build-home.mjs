// 먼치킨 소개·다운로드 페이지(먼치킨.com)를 만든다.
// 원본은 claude.ai 페이지용 `다운로드페이지\jun-live-download.html`(doctype·head 없이 쓰는 모양)이라,
// 여기서 앞쪽 <title>·<meta>·<link> 를 head 로 옮기고 claude.ai 가 넣어 주던 기본 틀(글자 모양·여백·[hidden])을 직접 넣어 docs/index.html 로 쓴다.
// 사용: node tools/build-home.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '..'), WORK = path.join(ROOT, '..');
const SOURCE = path.join(WORK, '다운로드페이지', 'jun-live-download.html');
const DOCS = path.join(ROOT, 'docs');
// 새 주소(한글 도메인은 브라우저가 알아보는 영문 표기로 적는다)
export const HOME = 'https://xn--s22bu18a0ub.com/';   // 먼치킨.com
export const KIUGI = 'https://xn--ok0bp87bn6g.com/';  // 키우기.com

let body = fs.readFileSync(SOURCE, 'utf8').replace(/^﻿/, '');
// 맨 앞의 <title>·<meta>·<link> 줄은 head 로 옮긴다
const head = [];
for (;;) {
  const m = body.match(/^\s*(<title>[\s\S]*?<\/title>|<meta\b[^>]*>|<link\b[^>]*>)/);
  if (!m) break;
  head.push(m[1]);
  body = body.slice(m[0].length);
}
if (!head.some((x) => x.startsWith('<title>'))) throw Error('원본 맨 앞에 <title> 이 없어요.');
// 키우기 사이트 주소를 새 도메인으로
body = body.replaceAll('https://jwonly-spn.github.io/jun-live-fanpage/', KIUGI);
if (body.includes('jwonly-spn.github.io/jun-live-fanpage')) throw Error('예전 키우기 주소가 남아 있어요.');

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head.join('\n')}
<meta property="og:title" content="먼치킨 · 스푼 DJ를 위한 채팅 봇">
<meta property="og:description" content="스푼 운영 승인을 받은 DJ용 채팅 봇. 지금 무료로 받을 수 있어요.">
<meta property="og:url" content="${HOME}">
<meta property="og:image" content="${HOME}munchkin-256.png">
<link rel="icon" href="favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="munchkin-64.png">
<link rel="apple-touch-icon" href="munchkin-256.png">
<link rel="canonical" href="${HOME}">
<style>
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:#FFF9F3}
img{max-width:100%}
[hidden]{display:none!important}
</style>
</head>
<body>
${body.trim()}
</body>
</html>
`;

fs.mkdirSync(DOCS, {recursive: true});
fs.writeFileSync(path.join(DOCS, 'index.html'), html);
// 없는 주소는 첫 화면으로
fs.writeFileSync(path.join(DOCS, '404.html'), `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>먼치킨</title><meta http-equiv="refresh" content="0; url=/"><link rel="canonical" href="${HOME}">
<style>body{margin:0;padding:40px 16px;font:16px/1.6 system-ui,sans-serif;background:#FFF9F3;color:#3A2B24;text-align:center}a{color:#C8466B}</style>
</head><body><p>페이지를 찾을 수 없어요. <a href="/">먼치킨 첫 화면으로 가기</a></p></body></html>
`);
fs.writeFileSync(path.join(DOCS, '.nojekyll'), '');
// 아이콘
const ICONS = path.join(WORK, '아이콘');
fs.copyFileSync(path.join(ICONS, 'munchkin.ico'), path.join(DOCS, 'favicon.ico'));
for (const s of [64, 256]) fs.copyFileSync(path.join(ICONS, `munchkin-${s}.png`), path.join(DOCS, `munchkin-${s}.png`));
console.log('docs/index.html', html.length, 'bytes · head', head.length, '줄');
