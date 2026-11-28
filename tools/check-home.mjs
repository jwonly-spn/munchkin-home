// 첫 페이지(docs/index.html) 구조 검사 — 이 PC 에서만 쓰는 도구예요(올리는 사이트가 부르는 파일이 아니에요).
//   node tools/check-home.mjs   →  통과면 "검사 통과 N개"(종료 코드 0), 실패면 빠진 것을 한 줄씩(종료 코드 1).
// 지키는 것(2026-11-28 새 흐름 「시안 D」): 공개 도구(release.cjs bumpPage)가 바꾸는 받기 링크·판 글 모양,
//   album.js 가 채우는 자리(#mk-auth · #mk-beta · #album .album-copy/.album-note · #pay 안 #mk-pay 가격표),
//   끝 인라인 스크립트(휴대폰이면 "PC에서 받기" · 받기 누르면 설치 그림 펼치기 · 주소 복사·보내기), 장면 id, 글.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.join(HERE, '..', 'docs');
const read = (rel) => { try { return fs.readFileSync(path.join(DOCS, rel), 'utf8'); } catch { return ''; } };
const html = read('index.html');
// 글·태그만(끝 인라인 스크립트 글자는 빼고 셈)
const markup = html.slice(0, Math.max(0, html.lastIndexOf('<script>')) || html.length);
const fails = [];
let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else fails.push(msg); };
const count = (s, re) => (s.match(re) || []).length;
// class="..." 안에 낱말(토큰)로 들어 있는 횟수
const classCount = (s, name) => [...s.matchAll(/class="([^"]*)"/g)].filter((m) => m[1].split(/\s+/).includes(name)).length;
// id 가 붙은 태그부터 같은 이름 태그가 닫히는 곳까지(안에 같은 태그가 겹쳐 있어도 셈)
const block = (s, id) => {
  const at = s.search(new RegExp(`<([a-z0-9]+)[^>]*\\bid="${id}"`));
  if (at < 0) return '';
  const tag = /^<([a-z0-9]+)/.exec(s.slice(at))[1];
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  re.lastIndex = at;
  let depth = 0, m;
  while ((m = re.exec(s))) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return s.slice(at, m.index + m[0].length);
  }
  return s.slice(at);
};

ok(html.length > 0, 'docs/index.html 을 읽지 못했어요');

// 1. 받기 링크 · 판 글(공개 도구가 이 모양 그대로 바꿔요)
const links = [...html.matchAll(/releases\/download\/v(\d+\.\d+\.\d+)\/Munchkin-Setup-(\d+\.\d+\.\d+)\.exe/g)];
ok(links.length >= 2, `받기 링크(releases/download/v<판>/Munchkin-Setup-<판>.exe)가 2개 이상이어야 해요 — 지금 ${links.length}개`);
const setupVers = new Set([...html.matchAll(/Munchkin-Setup-(\d+\.\d+\.\d+)\.exe/g)].map((m) => m[1]).concat(links.map((m) => m[1])));
ok(setupVers.size === 1, `받기 링크·설치 파일 이름의 판이 모두 같아야 해요 — 지금 ${[...setupVers].join(', ') || '없음'}`);
const ver = [...setupVers][0];
const verTexts = [...html.matchAll(/먼치킨 (\d+\.\d+\.\d+) · Windows 10·11 \(64비트\) · (\d+)MB · 무료 베타/g)];
ok(verTexts.length >= 1, '판 글(먼치킨 <판> · Windows 10·11 (64비트) · <N>MB · 무료 베타)이 1개 이상 있어야 해요');
ok(verTexts.every((m) => m[1] === ver), `판 글의 판(${[...new Set(verTexts.map((m) => m[1]))].join(', ')})이 받기 링크 판(${ver})과 같아야 해요`);
const dlCount = count(html, /<a [^>]*\bdata-dl\b/g);
ok(dlCount === links.length, `받기 링크마다 data-dl 이 붙어야 해요 — 링크 ${links.length}개, data-dl ${dlCount}개`);

// 2. 있어야 하는 id
for (const id of ['mk-auth', 'mk-beta', 'pay', 'pay-title', 'mk-pay', 'album', 'install-help', 'ih-title', 'get', 's2-date', 'show', 'bank', 'game', 'grow', 'pick']) {
  ok(count(html, new RegExp(`\\bid="${id}"`, 'g')) === 1, `id="${id}" 가 한 번 있어야 해요`);
}
// 같은 id 가 두 번 나오면 안 돼요
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const dup = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
ok(dup.length === 0, `같은 id 가 두 번 있어요: ${dup.join(', ')}`);
// 페이지 안 바로 가기(#…)가 가리키는 곳이 있어야 해요
const lost = [...new Set([...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]).filter((x) => !ids.includes(x)))];
ok(lost.length === 0, `가리키는 곳이 없는 바로 가기: ${lost.map((x) => '#' + x).join(', ')}`);

// 3. album.js 가 채우는 자리 · 인라인 스크립트가 쓰는 것
const album = block(html, 'album');
ok(classCount(album, 'album-copy') === 1, '#album 안에 class="album-copy" 가 한 개 있어야 해요');
ok(classCount(album, 'album-note') === 1, '#album .album-copy 안에 album-note 가 한 개 있어야 해요');
const albumCopy = album.slice(album.search(/class="[^"]*\balbum-copy\b/));
ok(classCount(albumCopy, 'album-note') === 1, 'album-note 는 .album-copy 안에 있어야 해요');
const pay = block(html, 'pay');
const mkPay = block(html, 'mk-pay');
ok(pay.includes('id="mk-pay"'), '#mk-pay 는 #pay 안에 있어야 해요');
ok(pay.includes('id="pay-title"'), '#pay-title(이용권 제목)은 #pay 안에 있어야 해요');
const cards = mkPay.split(/<article\b/).slice(1);
ok(cards.length === 3 && cards.every((c) => /^[^>]*class="[^"]*\bpt-card\b/.test(c)), `#mk-pay 안에 pt-card 가 3개 있어야 해요 — 지금 ${classCount(mkPay, 'pt-card')}개`);
ok(cards.length === 3 && cards.every((c) => c.includes('<a class="btn')), '#mk-pay 의 pt-card 마다 <a class="btn …> [신청하기] 가 있어야 해요');
ok(count(markup, /<details\b[^>]*\bdata-ih\b/g) === 3, `설치 그림 안내 details[data-ih] 가 3개 있어야 해요 — 지금 ${count(markup, /<details\b[^>]*\bdata-ih\b/g)}개`);
ok(block(html, 'install-help').includes('id="ih-title"'), '#ih-title 은 #install-help 안에 있어야 해요');
ok(count(markup, /\bdata-pc-note\b/g) >= 2, `data-pc-note 가 2개 이상 있어야 해요 — 지금 ${count(markup, /\bdata-pc-note\b/g)}개`);
ok(block(html, 'get').includes('data-pc-note'), '첫 받기 칸 #get 안에 data-pc-note 가 있어야 해요');
ok(classCount(html, 'header-get') === 1, `머리줄 받기 .header-get 이 한 개 있어야 해요 — 지금 ${classCount(html, 'header-get')}개`);
ok(block(html, 'mk-auth').length > 0 && /<header\b[\s\S]*id="mk-auth"[\s\S]*<\/header>/.test(html), '#mk-auth 는 머리줄(header) 안에 있어야 해요');
const tail = html.slice(html.lastIndexOf('<script>'));
for (const bit of ["classList.add('not-pc')", '[data-pc-note]', '.get [data-dl-label]', '.header-get', 'details[data-ih]', '[data-dl]', '[data-copy]', '[data-share]', 'a[href="#install-help"]']) {
  ok(tail.includes(bit), `끝 인라인 스크립트에 ${bit} 가 있어야 해요`);
}
ok(count(markup, /\bdata-dl-label\b/g) === links.length - 1, `받기 단추(머리줄 빼고)마다 data-dl-label 이 있어야 해요 — 받기 링크 ${links.length}개, data-dl-label ${count(markup, /\bdata-dl-label\b/g)}개`);

// 4. css · js 판
const head = html.slice(0, html.indexOf('</head>'));
const siteAt = head.indexOf('<link rel="stylesheet" href="site.css?v=10">');
ok(siteAt >= 0, '<link rel="stylesheet" href="site.css?v=10"> 가 있어야 해요');
const homeCss = /<link rel="stylesheet" href="home\.css\?v=\d+">/.exec(head);
ok(homeCss && homeCss.index > siteAt, 'site.css 뒤에 home.css?v= 가 있어야 해요');
ok(/<script src="home\.js\?v=2" defer><\/script>/.test(head), 'home.js?v=2 가 있어야 해요');
const albumVer = /album\.js\?v=(\d+)/.exec(read('album/index.html'))?.[1];
ok(albumVer && head.includes(`<script type="module" src="album/album.js?v=${albumVer}"></script>`), `album/album.js?v=${albumVer}(추억앨범 화면과 같은 판)가 있어야 해요`);
ok(head.includes('pay.css?v='), 'pay.css 가 있어야 해요(이용권 가격표 모양)');

// 5. 글
for (const t of ['방송을 더 즐겁게', '방송을 더 편하게', '먼치킨!', '다른 봇 석 달 쓸 돈이면, 먼치킨은 1년을 함께해요', '다른 봇 기록 이어오기 가능!', '스푼(Spoon)이 만든 프로그램이 아니며']) {
  ok(html.includes(t), `글 "${t}" 이 있어야 해요`);
}
for (const [rel, s] of [['index.html', html], ['home.js', read('home.js')], ['home.css', read('home.css')]]) {
  for (const bad of ['절세', '누구나 절세', '누구나 비용']) ok(!s.includes(bad), `${rel} 에 "${bad}" 가 있으면 안 돼요`);
}

// 6. 장면 고양이 그림
for (const f of ['bank', 'lottery', 'tax', 'chatbot', 'tools', 'moving']) {
  ok(fs.existsSync(path.join(DOCS, 'art', f + '.webp')), `docs/art/${f}.webp 가 있어야 해요`);
}
// 7. 문장마다 줄바꿈(11/23 규칙 · 11/28 사용자 "마침표 했으면 다음줄에 쓰라고"): 문장 끝(한글 + . ? !) 뒤에 글이 이어지면
//    그 사이에 <br class="br-s"> 가 있어야 해요. 글 조각만 봐요(script·style 안, 봇 채팅 말풍선 .h-bub, 윈도·엣지 창 그림 .shot 은 빼요).
//    앞 문장이 3자 이하("네.")면 괜찮아요.
{
  const VOID = new Set(['br', 'img', 'input', 'meta', 'link', 'hr', 'source', 'use', 'path', 'circle', 'rect', 'line', 'polyline', 'wbr']);
  const parts = html.split(/(<[^>]+>)/);
  const stack = [], tags = [];
  let skip = 0;
  const missing = [];
  parts.forEach((tok, i) => {
    if (tok.startsWith('<')) {
      const m = /^<\s*(\/)?\s*([a-zA-Z0-9]+)/.exec(tok);
      if (!m || tok.startsWith('<!')) return;
      const name = m[2].toLowerCase();
      if (['script', 'style', 'title', 'textarea'].includes(name)) skip += m[1] ? -1 : 1;
      if (m[1]) { const k = tags.lastIndexOf(name); if (k >= 0) { stack.length = k; tags.length = k; } }
      else if (!tok.endsWith('/>') && !VOID.has(name)) { stack.push((/class="([^"]*)"/.exec(tok) || [])[1] || ''); tags.push(name); }
      return;
    }
    if (skip > 0 || !tok.trim() || stack.some((c) => c.split(/\s+/).some((x) => x === 'shot' || x === 'h-bub'))) return;
    let from = 0;
    for (const m of tok.matchAll(/([가-힣][.?!]+)[ \t\n]+/g)) {
      const before = tok.slice(from, m.index + m[1].length), after = tok.slice(m.index + m[0].length);
      from = m.index + m[0].length;
      const next = parts[i + 1] || '';
      if (!after.trim() && (!next || next.startsWith('</') || /^<br/i.test(next))) continue;
      if (before.replace(/\s/g, '').length <= 3) continue;
      missing.push(before.trim().slice(-20) + ' / ' + (after.trim() || next).slice(0, 15));
    }
  });
  ok(missing.length === 0, `문장 끝 뒤에 줄바꿈(<br class="br-s">)이 없어요: ${missing.join(' | ')}`);
}

// 페이지가 부르는 그림·영상 파일이 다 있어야 해요
const assets = [...new Set([...html.matchAll(/\b(?:src|poster|srcset)="([^"#:]+?)"/g)].map((m) => m[1].split('?')[0]))];
const gone = assets.filter((a) => !fs.existsSync(path.join(DOCS, a)));
ok(gone.length === 0, `없는 파일을 불러요: ${gone.join(', ')}`);

if (fails.length) {
  for (const f of fails) console.log('✗ ' + f);
  console.log(`검사 실패 ${fails.length}개 (통과 ${passed}개)`);
  process.exit(1);
}
console.log(`검사 통과 ${passed}개`);
