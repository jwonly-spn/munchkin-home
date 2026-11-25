// 먼치킨.com/album #go=beta — 추억앨범 베타테스터 신청 화면(2026-11-25, 시안 기획\베타테스터-20261125\시안\apply.html 모양 그대로).
// album.js 가 화면을 그릴 때마다 betaView(ctx) 를 부른다. ctx = album.js 의 h·icon·call·billCall·S·go·toast·paint·openSheet·dropSession·busy·say·statusEl·hostText·key(공개 키).
//  (album.js 에는 주소 받기·로그인 먼저·화면 나누기 몇 줄만 — 정기결제 작업이 album.js 를 크게 바꾸고 있어 겹침을 줄이려고 따로 둔다)
// 서버: bakje-beta(status·photo-url·apply·cancel — 회원 세션 x-bj-session) · 주소 이름 확인은 기존 신청 화면과 같은 bakje-billing album-name.
// 화면: 뽑힘 → 이미 앨범 있음 → 신청 기다림(낸 내용·[고치기]·[신청 취소]) → 모집 끝남 → 신청 칸(모집 중) → 시작 전/끝남.
// 사진: 고르면 한 장씩 브라우저에서 긴 변 2000px webp 0.85(안 되면 jpeg)로 다시 그려(사진 속 위치 정보 EXIF 가 빠짐) 5MB 안으로 →
//  서버가 준 한 번 쓰는 올리기 주소(Supabase Storage 서명 올리기 /storage/v1/object/upload/sign/… — PUT 로 파일 몸통, 2시간)로만 올린다.
//  작은 그림(미리 보기)은 이 페이지 메모리에만 둔다(data: 주소 — index.html CSP 가 img-src 'self' data: 라 blob: 은 못 씀).
//  낸 사진의 경로만 이 기기 localStorage(mk_beta_photos)에 적어 둔다 — [고치기] 때 사진을 다시 고르지 않게(그림은 저장하지 않음).
const SB = 'https://aksegkhhugqvvaidgvro.supabase.co';
const BETA = SB + '/functions/v1/bakje-beta';
const UPLOAD_AT = SB + '/storage/v1/object/upload/sign/';   // 이 주소로만 사진을 보낸다(서버 답이 다른 곳이면 올리지 않음)
const TERMS = 'https://xn--hu5bi2af5y.com/terms.html';
const PRIVACY = 'https://xn--hu5bi2af5y.com/privacy.html';
const SUFFIX = '먼치킨.com';
const LABEL_RE = /^[가-힣a-z0-9](?:[가-힣a-z0-9-]{0,13}[가-힣a-z0-9])?$/;   // album.js·서버 labelOf 와 같은 규칙
const LABEL_RULE = '한글·영어 소문자·숫자로 1~15자예요. - 는 가운데에만 쓸 수 있어요.';
const PATH_RE = /^[\w-]{1,64}\/[\w-]{4,40}\.(?:webp|jpg|png)$/;
const HOST_RE = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
const MIN = 3, MAX = 10, SIDE = 2000, BYTES = 5242880, THUMB = 240;
const BAD_PIC = '이 사진은 열 수 없어요. jpg 나 png 로 바꿔 올려 주세요.';
const BIG_PIC = '사진이 너무 커요. 다른 사진을 골라 주세요.';
const UP_FAIL = '사진을 올리지 못했어요. 인터넷 연결을 확인하고 다시 골라 주세요.';
const KEEP = 'mk_beta_photos';
// 무료 끝(뽑힌 분은 이때까지 무료 — 봇 BETA_END 와 같은 값). "…까지 무료" 글은 늘 이것으로(서버 until 은 모집 기한이라 다를 수 있음)
const FREE_END = Date.parse('2026-12-31T23:59:59+09:00');

let C = null;   // 지금 ctx
const B = {
  owner: null,     // 이 상태를 받은 회원(계정이 바뀌면 처음부터)
  st: null,        // status 답 {open, seats, picked, left, until, closedAt, mine}
  at: 0,           // status 를 받은 때(1분보다 오래되면 들어올 때·탭이 다시 보일 때 다시 물음)
  job: null, err: '',
  edit: false,     // 신청 기다림에서 [고치기]를 누름
  filled: false,   // 스푼 닉네임 칸을 계정 닉네임으로 한 번 채움
  form: { spoonNick: '', label: '', name: '', msg: '', agree: false },
  lab: null,       // 주소 이름 확인 {label, ok: true|false|null, why, err}
  labTimer: 0, labSeq: 0,
  photos: [],      // [{path, thumb}] — thumb 이 빈 글이면 이 기기에 그림이 없는 낸 사진
  busy: null,      // 올리는 중 {i, n}
  note: '', noteBad: false,
  file: null, grid: null, count: null, pst: null, go: null   // 지금 그려진 칸(다시 그리지 않고 고친다)
};

// ---------- 작은 도구 ----------
const nickOf = (v) => String(v || '').normalize('NFC').trim().replace(/\s+/g, ' ');
const labelOf = (v) => String(v || '').normalize('NFC').trim().toLowerCase();
const len = (v) => [...String(v || '')].length;
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* 막힌 브라우저 */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* 막힌 브라우저 */ } }
};
// 한국 날짜로 "12월 31일"
function monthDay(ms) {
  const d = new Date(Number(ms) + 9 * 3600000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}
function dayOf(ms) {
  const d = new Date(Number(ms) + 9 * 3600000);
  return `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}.`;
}
const untilOf = (d) => Number(d?.until) || FREE_END;   // 모집 기한(서버 until — 없으면 무료 끝과 같게)
const albumUrl = (host) => (HOST_RE.test(String(host || '')) ? `https://${host}/` : '');
function reset(owner) {
  clearTimeout(B.labTimer);
  Object.assign(B, { owner, st: null, at: 0, job: null, err: '', edit: false, filled: false, form: { spoonNick: '', label: '', name: '', msg: '', agree: false },
    lab: null, photos: [], busy: null, note: '', noteBad: false });
}
function focusTitle() { setTimeout(() => document.getElementById('bt-title')?.focus({ preventScroll: true }), 30); }

// ---------- 서버 ----------
async function betaCall(action, body = {}) {
  try { return await C.call('', { method: 'POST', body: { action, ...body }, session: true, base: BETA }); }
  catch (e) {
    // 로그인 시간이 지남 → 다시 로그인(쓴 글·올린 사진은 이 페이지 메모리에 그대로)
    if (e.status === 401) { C.dropSession(); setTimeout(() => C.go('beta'), 0); }
    throw e;
  }
}
// quiet: 이미 화면이 있을 때 다시 묻기 — 실패해도 지금 화면 그대로, 바뀐 게 있을 때만 다시 그림(쓰던 칸 초점·글자 자리는 되돌림)
const sig = (d) => JSON.stringify(d ? [d.open, d.seats, d.picked, d.left, d.until, d.closedAt, d.mine] : null);
function load(quiet = false) {
  const owner = B.owner, before = sig(B.st);
  B.job = betaCall('status')
    .then((r) => {
      if (B.owner !== owner) return;
      // 틀린 세션은 401 이 아니라 mine 이 비어 온다 → 다시 로그인
      if (!r.mine) { C.dropSession(); setTimeout(() => C.go('beta'), 0); return; }
      B.st = r; B.at = Date.now(); B.err = '';
    })
    .catch((e) => { if (B.owner === owner && !quiet) B.err = e.message; })
    .finally(() => {
      if (B.owner === owner) B.job = null;
      if (!quiet || sig(B.st) !== before || !C.S.session) repaint();
    });
}
function repaint() {
  const a = document.activeElement, id = a?.id || '';
  let sel = null;
  try { sel = typeof a?.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd] : null; } catch { /* 고르기 없는 칸 */ }
  C.paint();
  const el = id && document.getElementById(id);
  if (el && el !== a) { el.focus({ preventScroll: true }); if (sel) { try { el.setSelectionRange(...sel); } catch { /* 그대로 */ } } }
}
// 1분보다 오래된 상태면 조용히 다시 묻기(사진을 올리거나 신청을 보내는 중에는 안 함)
const STALE = 60000;
function refreshIfStale() {
  if (!C || !B.st || B.job || B.busy || Date.now() - B.at < STALE) return;
  if (C.S.view !== 'beta' || !C.S.session || document.querySelector('.bt-go[data-busy]')) return;
  load(true);
}
let watching = false;
function watchVisible() {
  if (watching) return;
  watching = true;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshIfStale(); });
}

// ---------- 주소 이름 확인(기존 신청 화면과 같은 album-name — 400ms 쉬면 묻는다) ----------
function checkLabel(value, out) {
  const { say } = C;
  clearTimeout(B.labTimer);
  const label = labelOf(value);
  B.form.label = label;
  if (B.lab?.label !== label) B.lab = null;
  if (!label) { say(out, ''); return; }
  if (!LABEL_RE.test(label)) { B.lab = { label, ok: false, why: LABEL_RULE }; say(out, LABEL_RULE, true); return; }
  if (B.lab?.ok === true) { say(out, '✓ 쓸 수 있어요', false, true); return; }
  if (B.lab?.ok === false) { say(out, B.lab.why, true); return; }
  B.lab = { label, ok: null };
  say(out, '쓸 수 있는지 보는 중…');
  const seq = ++B.labSeq;
  B.labTimer = setTimeout(async () => {
    try {
      const r = await C.billCall('album-name', { label });
      if (seq !== B.labSeq) return;
      B.lab = r.free ? { label, ok: true } : { label, ok: false, why: r.reason || '쓸 수 없는 이름이에요. 다른 이름을 골라 주세요.' };
      say(out, r.free ? '✓ 쓸 수 있어요' : B.lab.why, !r.free, r.free);
    } catch (e) {
      if (seq !== B.labSeq) return;
      B.lab = { label, ok: null, err: true };   // 확인을 못 함 — 신청은 서버가 다시 본다
      say(out, e.message, true);
    }
  }, 400);
}

// ---------- 사진 줄이기·올리기 ----------
const fail = (message, kind) => Object.assign(Error(message), { kind });
// 그림 읽기: createImageBitmap(사진 방향 그대로) → 안 되면 <img>(data: 주소). HEIC 처럼 브라우저가 못 읽는 그림은 여기서 실패.
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* 아래 <img> 로 */ }
  }
  try {
    const src = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(r.error); r.readAsDataURL(file); });
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    await img.decode();
    return img;
  } catch { throw fail(BAD_PIC, 'decode'); }
}
const toBlob = (canvas, type, q) => new Promise((ok) => { try { canvas.toBlob(ok, type, q); } catch { ok(null); } });
async function shrink(file) {
  const src = await decode(file);
  const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
  if (!w0 || !h0) { src.close?.(); throw fail(BAD_PIC, 'decode'); }
  const k = Math.min(1, SIDE / Math.max(w0, h0));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w0 * k)); canvas.height = Math.max(1, Math.round(h0 * k));
  const g = canvas.getContext('2d');
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, canvas.width, canvas.height);   // 투명한 곳은 흰 바탕(jpeg 로 갈 때 검게 되지 않게)
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, canvas.width, canvas.height);
  src.close?.();
  // webp 0.85 → 이 브라우저가 webp 로 못 만들면(아이폰 사파리 등) jpeg → 5MB 넘으면 품질을 내려 다시
  let type = 'image/webp', q = 0.85;
  let blob = await toBlob(canvas, type, q);
  if (!blob || blob.type !== 'image/webp') { type = 'image/jpeg'; blob = await toBlob(canvas, type, q); }
  while (blob && blob.size > BYTES && q > 0.45) { q = Math.round((q - 0.15) * 100) / 100; blob = await toBlob(canvas, type, q); }
  if (!blob || blob.type !== type) { canvas.width = 0; throw fail(BAD_PIC, 'decode'); }
  if (blob.size > BYTES) { canvas.width = 0; throw fail(BIG_PIC, 'decode'); }
  // 작은 칸 그림: 짧은 변 240px jpeg(data: 주소 — 이 페이지 메모리에만)
  const t = document.createElement('canvas');
  const kt = Math.min(1, THUMB / Math.min(canvas.width, canvas.height));
  t.width = Math.max(1, Math.round(canvas.width * kt)); t.height = Math.max(1, Math.round(canvas.height * kt));
  const tg = t.getContext('2d');
  tg.imageSmoothingQuality = 'high';
  tg.drawImage(canvas, 0, 0, t.width, t.height);
  const thumb = t.toDataURL('image/jpeg', 0.72);
  canvas.width = 0; t.width = 0;
  return { blob, type, thumb };
}
async function uploadOne(file) {
  const { blob, type, thumb } = await shrink(file);
  const r = await betaCall('photo-url', { type });
  const url = String(r.url || '');
  if (!url.startsWith(UPLOAD_AT) || !PATH_RE.test(String(r.path || ''))) throw fail(UP_FAIL, 'up');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 90000);
  let res;
  // supabase-js uploadToSignedUrl 과 같게 공개 키(apikey)도 붙인다(서명 주소의 token 이 실제 허락)
  try { res = await fetch(url, { method: 'PUT', headers: { 'content-type': type, ...(C.key ? { apikey: C.key } : {}) }, body: blob, signal: ctl.signal, cache: 'no-store' }); }
  catch { throw fail(UP_FAIL, 'up'); }
  finally { clearTimeout(timer); }
  if (!res.ok) throw fail(UP_FAIL, 'up');
  return { path: r.path, thumb };
}
async function addFiles(list) {
  if (B.busy || !list.length) return;
  const owner = B.owner;
  const room = MAX - B.photos.length;
  const files = list.slice(0, Math.max(0, room));
  let warn = list.length > room ? '최대 10장이에요.' : '';
  if (!files.length) { setNote(warn, true); return; }
  B.note = ''; B.noteBad = false;
  let bad = false, stop = '';
  for (let i = 0; i < files.length; i++) {
    B.busy = { i: i + 1, n: files.length };
    drawPhotos();
    try {
      const p = await uploadOne(files[i]);
      if (B.owner !== owner) return;   // 그새 계정이 바뀜
      B.photos.push(p);
    } catch (e) {
      if (B.owner !== owner) return;
      if (e.kind === 'decode') {
        if (e.message === BAD_PIC) bad = true;
        else if (!warn.includes(e.message)) warn = [warn, e.message].filter(Boolean).join(' ');
        continue;
      }
      stop = e.message;   // 서버·인터넷 문제 — 남은 사진은 올리지 않는다
      break;
    }
  }
  B.busy = null;
  const msg = [warn, bad ? BAD_PIC : '', stop].filter(Boolean).join(' ');
  setNote(msg, Boolean(msg));
}
function setNote(text, bad) {
  B.note = text || ''; B.noteBad = Boolean(bad);
  drawPhotos();
}
function removePhoto(i) {
  if (B.busy) return;
  B.photos.splice(i, 1);
  B.note = ''; B.noteBad = false;
  drawPhotos();
  // 빠진 칸 자리의 ✕ → 없으면 앞 칸 ✕ → 없으면 [사진 고르기]
  const xs = B.grid?.querySelectorAll('.th-x') || [];
  (xs[i] || xs[i - 1] || document.getElementById('bt-add'))?.focus();
}
// 사진 칸만 다시 그린다(쓰던 칸의 초점·글은 그대로)
function drawPhotos() {
  if (!B.grid?.isConnected) return;
  const { h, icon } = C;
  const n = B.photos.length, ok = n >= MIN;
  B.count.textContent = ok ? `${n}장 ✓` : `${MIN}장 중 ${n}장`;
  B.count.classList.toggle('ok', ok);
  const tiles = B.photos.map((p, i) => h('li', { class: 'th' + (p.thumb ? '' : ' th-kept') },
    p.thumb ? h('img', { src: p.thumb, alt: `고른 사진 ${i + 1}` }) : h('span', null, icon('album'), h('span', { text: `낸 사진 ${i + 1}` })),
    h('button', { class: 'th-x', type: 'button', 'aria-label': `사진 ${i + 1} 빼기`, disabled: Boolean(B.busy), onclick: () => removePhoto(i) }, icon('close'))));
  if (B.busy) tiles.push(h('li', { class: 'th th-wait', 'aria-hidden': 'true' }, icon('spin'), h('span', { text: `${B.busy.i}/${B.busy.n}` })));
  else if (n < MAX) tiles.push(h('li', { class: 'th th-add' }, h('button', { type: 'button', id: 'bt-add', 'aria-describedby': 'bt-photo-hint bt-count', onclick: () => B.file?.click() },
    h('b', { 'aria-hidden': 'true', text: '＋' }), '사진 고르기')));
  B.grid.replaceChildren(...tiles);
  const text = B.busy ? `사진 올리는 중 ${B.busy.i}/${B.busy.n}` : B.note;
  if (B.pst.textContent !== text) B.pst.textContent = text;
  B.pst.classList.toggle('bad', !B.busy && B.noteBad);
  if (B.go) B.go.disabled = !ok || Boolean(B.busy);
}

// ---------- 화면 조각 ----------
function head(eyebrow, title, sub, chips) {
  const { h } = C;
  return [
    h('p', { class: 'bt-eyebrow', text: eyebrow }),
    h('h1', { id: 'bt-title', tabindex: '-1', text: title }),
    sub ? h('p', { class: 'bt-sub', text: sub }) : null,
    chips?.length ? h('ul', { class: 'bt-chips' }, chips.map(([t, cls]) => h('li', { class: cls || null, text: t }))) : null
  ];
}
const chipsOf = (d) => [[`${Number(d.seats) || 10}명 추가 모집`], [`${monthDay(FREE_END)}까지 무료`], [`남은 자리 ${Math.max(0, Number(d.left) || 0)}`, 'hot']];
const wrap = (...kids) => C.h('section', { class: 'sect narrow' }, C.h('div', { class: 'bt' }, ...kids));
function albumCard(host, name) {
  const { h, icon, hostText } = C;
  const href = albumUrl(host);
  if (!href) return null;
  return h('a', { class: 'album-mini bt-album', href, target: '_blank', rel: 'noopener' },
    h('span', { class: 'album-mini-ico' }, icon('album')),
    h('span', { class: 'album-mini-txt' }, h('b', { text: name || '내 추억앨범' }), h('span', { text: hostText(host) })),
    h('span', { class: 'sr', text: '(새 창)' }), icon('ext'));
}
const guideBtn = () => C.h('button', { class: 'btn line block', type: 'button', text: '추억앨범 신청 안내 보기', onclick: () => C.go('home') });

// 시작 전·끝남
function closedView(d, ended, thanks) {
  const { h } = C;
  return wrap(
    head('베타테스터 신청', ended ? '베타테스터 모집이 끝났어요' : '아직 모집을 시작하지 않았어요',
      ended ? (thanks ? '신청해 주셔서 고마워요. 추억앨범은 이용권으로 언제든 신청할 수 있어요.' : '추억앨범은 이용권으로 언제든 신청할 수 있어요.')
        : '모집이 열리면 이 화면에서 신청할 수 있어요.'),
    h('div', { class: 'bt-actions' }, guideBtn()));
}
// 이미 앨범이 있음(서버는 mine.album 을 뽑혔을 때만 줘요 — 내 앨범은 내 정보에서)
function ownerView(m) {
  const { h, statusEl } = C;
  const st = statusEl();
  return wrap(
    head('베타테스터 신청', '이미 추억앨범이 있어요', '베타테스터는 아직 추억앨범이 없는 DJ분을 모집해요.'),
    h('div', { class: 'bt-actions' }, h('button', { class: 'btn line block', type: 'button', text: '내 정보에서 앨범 보기', onclick: () => C.go('me') })),
    // 앨범이 생기기 전에 낸 베타 신청이 남아 있으면 취소할 수 있게
    m.state === 'wait' ? [h('div', { class: 'bt-actions' }, cancelBtn(st)), st] : null);
}
// 뽑힘
function pickedView(d, m) {
  const { h } = C;
  const href = albumUrl(m.album?.host);
  return wrap(
    head('베타테스터', '🎉 베타테스터로 뽑혔어요', `${monthDay(FREE_END)}까지 추억앨범을 무료로 써요.`),
    h('div', { class: 'bt-actions' },
      albumCard(m.album?.host, m.app?.name),
      href ? h('a', { class: 'btn block big bt-go', href, target: '_blank', rel: 'noopener' }, '내 앨범 열기', h('span', { class: 'sr', text: '(새 창)' })) : null),
    h('p', { class: 'hint bt-after', text: '2027년 1월 1일부터는 이용권이 있어야 올리기·고치기를 할 수 있어요. 이용권이 없어도 앨범 보기는 그대로예요.' }));
}
function cancelBtn(st) {
  const { h, busy } = C;
  return h('button', { class: 'btn line', type: 'button', text: '신청 취소', onclick: (e) => busy(e.currentTarget, st, async () => {
    if (!confirm('베타테스터 신청을 취소할까요?\n올린 사진도 함께 지워져요.')) return;
    const r = await betaCall('cancel');
    B.st.mine = r.mine; B.at = Date.now(); B.edit = false; B.photos = []; B.form.agree = false; B.note = '';
    ls.del(KEEP);
    C.toast('신청을 취소했어요');
    C.paint(); focusTitle();
  }) });
}
// 신청 기다림: 낸 내용 + [고치기] [신청 취소]
function waitView(d, m) {
  const { h, statusEl } = C;
  const a = m.app || {};
  const st = statusEl();
  const row = (k, v) => (v ? h('div', { class: 'kv-row' }, h('dt', { text: k }), h('dd', { text: v })) : null);
  return wrap(
    head('베타테스터 신청', '신청 받았어요', '운영자가 보고 뽑아요. 뽑히면 먼치킨을 켤 때 알려 드리고, 이 화면에서도 볼 수 있어요.', chipsOf(d)),
    h('h2', { class: 'bt-h2', text: '낸 내용' }),
    h('dl', { class: 'kv bt-kv' },
      row('스푼 닉네임', a.spoonNick),
      row('원하는 주소', a.label ? `${a.label}.${SUFFIX}` : ''),
      row('앨범 이름', a.name),
      row('하고 싶은 말', a.msg),
      row('첨부', Number(a.photos) > 0 ? `박제 사진 ${Number(a.photos)}장` : ''),
      row('신청한 날', a.created ? dayOf(a.created) : '')),
    h('div', { class: 'bt-actions' },
      m.canApply ? h('button', { class: 'btn line', type: 'button', text: '고치기', onclick: () => startEdit(m) }) : null,
      cancelBtn(st)),
    st);
}
function startEdit(m) {
  const a = m.app || {};
  B.edit = true; B.filled = true;
  B.form = { spoonNick: a.spoonNick || '', label: a.label || '', name: a.name || '', msg: a.msg || '', agree: true };
  B.lab = null; B.note = ''; B.noteBad = false;
  const want = Number(a.photos) || 0;
  // 이 페이지에서 막 낸 사진(그림 있음) → 이 기기에 적어 둔 경로 → 없으면 다시 고르기
  if (!(want && B.photos.length === want)) {
    const kept = (() => { try { return JSON.parse(ls.get(KEEP) || 'null'); } catch { return null; } })();
    const paths = kept && kept.member === B.owner && Array.isArray(kept.paths) ? kept.paths.filter((p) => PATH_RE.test(String(p))) : [];
    B.photos = want && paths.length === want ? paths.map((path) => ({ path, thumb: '' })) : [];
    if (!B.photos.length && want) { B.note = `처음에 낸 사진 ${want}장은 이 기기에서 볼 수 없어요. 고치려면 사진을 다시 골라 주세요(3장 이상). 다시 고른 사진으로 바뀌어요.`; B.noteBad = false; }
  }
  C.paint();
  window.scrollTo({ top: 0 });
  focusTitle();
}

// 신청 칸(시안 apply.html)
function formView(d, m) {
  const { h, statusEl, say, busy } = C;
  const f = B.form;
  const editing = m.state === 'wait';
  if (!B.filled) { f.spoonNick = f.spoonNick || nickOf(C.S.me?.nickname || '').slice(0, 20); B.filled = true; }
  const defaultName = () => `${nickOf(f.spoonNick) || '스푼 닉네임'} 추억앨범`;

  // 스푼 닉네임
  const nick = h('input', { class: 'input', id: 'bt-nick', name: 'nickname', maxlength: '20', autocomplete: 'nickname', spellcheck: 'false', required: true, value: f.spoonNick });
  // 원하는 주소 이름(album-name 으로 "쓸 수 있어요" 확인)
  const out = h('p', { class: 'status', id: 'bt-label-st', role: 'status', 'aria-live': 'polite' });
  const label = h('input', { id: 'bt-label', maxlength: '15', value: f.label, placeholder: '예: 먼치', autocapitalize: 'none', spellcheck: 'false', autocomplete: 'off', required: true, 'aria-describedby': 'bt-label-st bt-label-hint' });
  label.addEventListener('input', (e) => { if (!e.isComposing) checkLabel(label.value, out); });
  label.addEventListener('compositionend', () => checkLabel(label.value, out));
  // 앨범 이름(선택 — 비우면 "<스푼 닉네임> 추억앨범")
  const name = h('input', { class: 'input', id: 'bt-name', maxlength: '40', autocomplete: 'off', value: f.name, placeholder: defaultName() });
  name.addEventListener('input', () => { f.name = name.value; });
  nick.addEventListener('input', () => { f.spoonNick = nick.value; name.placeholder = defaultName(); });
  // 하고 싶은 말(선택 100자)
  const msgN = h('p', { class: 'bt-n', id: 'bt-msg-n', text: `${len(f.msg)} / 100` });
  const msg = h('textarea', { class: 'input bt-msg', id: 'bt-msg', maxlength: '100', rows: '3', 'aria-describedby': 'bt-msg-n' });
  msg.value = f.msg;
  msg.addEventListener('input', () => { f.msg = msg.value; msgN.textContent = `${len(msg.value)} / 100`; });
  // 동의(화면에서만 — 서버로 보내지 않음)
  const agree = h('input', { type: 'checkbox', id: 'bt-agree', checked: f.agree, required: true });
  agree.addEventListener('change', () => { f.agree = agree.checked; });

  // 사진 칸(drawPhotos 가 안만 다시 그린다)
  B.file = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'hidden', tabindex: '-1', 'aria-hidden': 'true' });
  B.file.addEventListener('change', () => { const list = [...(B.file.files || [])]; B.file.value = ''; addFiles(list); });
  B.count = h('span', { class: 'bt-count', id: 'bt-count' });
  B.grid = h('ul', { class: 'bt-grid', 'aria-label': '고른 사진' });
  B.pst = h('p', { class: 'status', id: 'bt-photo-st', role: 'status', 'aria-live': 'polite' });

  const st = statusEl();
  B.go = h('button', { class: 'btn block big bt-go', type: 'submit', text: editing ? '고친 내용 보내기' : '신청하기', disabled: true, 'aria-describedby': 'bt-count' });
  const stop = (el, text) => { say(st, text, true); el?.focus(); };
  const form = h('form', { class: 'bt-form', noValidate: true, onsubmit: (e) => {
    e.preventDefault();
    const spoonNick = nickOf(f.spoonNick);
    if (!spoonNick) return stop(nick, '스푼 닉네임을 넣어 주세요.');
    if (len(spoonNick) > 20) return stop(nick, '스푼 닉네임은 20자까지예요.');
    const lb = labelOf(f.label);
    if (!lb) return stop(label, '원하는 주소 이름을 넣어 주세요.');
    if (!LABEL_RE.test(lb)) return stop(label, LABEL_RULE);
    if (B.lab?.label === lb && B.lab.ok === false) return stop(label, B.lab.why);
    if (B.lab?.label === lb && B.lab.ok === null && !B.lab.err) return stop(label, '주소 이름을 확인하고 있어요. 잠시 뒤 다시 눌러 주세요.');
    const nm = nickOf(f.name);
    if (nm && (len(nm) < 2 || len(nm) > 40)) return stop(name, '앨범 이름은 2~40자로 정해 주세요. 비워 두면 "' + defaultName() + '"이 돼요.');
    const ms = String(f.msg || '').normalize('NFC').trim();
    if (len(ms) > 100) return stop(msg, '하고 싶은 말은 100자까지예요.');
    if (B.busy) return stop(null, '사진을 올리고 있어요. 다 올린 뒤 눌러 주세요.');
    if (B.photos.length < MIN) return stop(document.getElementById('bt-add'), '박제 사진·박제 편지를 3장 이상 올려 주세요.');
    if (!f.agree) return stop(agree, '동의에 체크해 주세요.');
    busy(B.go, st, async () => {
      let r;
      try { r = await betaCall('apply', { spoonNick, label: lb, name: nm, msg: ms, photos: B.photos.map((p) => p.path) }); }
      catch (e) {
        if (e.status === 409 && /주소/.test(e.message)) {
          // 다른 분이 먼저 신청한(또는 그새 쓰인) 주소 → 주소 칸에 그 까닭을 두고 주소 칸으로(같은 이름으로는 다시 못 냄)
          clearTimeout(B.labTimer); B.labSeq++;
          B.lab = { label: lb, ok: false, why: e.message };
          say(out, e.message, true);
          label.focus();
        } else if (e.status === 400 && /사진/.test(e.message) && B.photos.some((p) => !p.thumb)) {
          // 이 기기에 적어 둔 옛 사진 경로로 보냈는데 서버에 그 사진이 없음(모집 정리 등) → 옛 사진을 비우고 다시 고르게
          B.photos = B.photos.filter((p) => p.thumb);
          ls.del(KEEP);
          setNote('사진을 다시 골라 주세요(3장 이상).', true);
          setTimeout(() => document.getElementById('bt-add')?.focus(), 0);
        }
        throw e;
      }
      B.st.mine = r.mine; B.at = Date.now(); B.edit = false;
      ls.set(KEEP, JSON.stringify({ member: B.owner, paths: B.photos.map((p) => p.path) }));
      C.toast(editing ? '신청을 고쳤어요' : '신청했어요');
      C.paint(); window.scrollTo({ top: 0 }); focusTitle();
    }).then(() => drawPhotos());   // busy 가 끝나며 단추를 켜 두니, 사진이 3장 밑으로 줄었으면 다시 끈다(성공해 화면이 바뀌었으면 아무 일 없음)
  } },
    h('div', { class: 'bt-f' }, h('label', { for: 'bt-nick', text: '스푼 닉네임' }), nick),
    h('div', { class: 'bt-f' }, h('label', { for: 'bt-label', text: '원하는 주소 이름' }),
      h('div', { class: 'bt-addr' }, label, h('span', { class: 'bt-suf', text: '.' + SUFFIX })),
      out,
      h('p', { class: 'hint', id: 'bt-label-hint', text: '뽑히면 이 주소로 앨범이 바로 만들어져요.' })),
    h('div', { class: 'bt-f' }, h('label', { for: 'bt-name' }, '앨범 이름 ', h('small', { text: '(선택)' })), name),
    h('div', { class: 'bt-f bt-photos', role: 'group', 'aria-labelledby': 'bt-photo-lab' },
      h('div', { class: 'bt-lab' }, h('span', { id: 'bt-photo-lab' }, '박제 사진·박제 편지 ', h('small', { text: '3장 이상' })), B.count),
      h('p', { class: 'hint', id: 'bt-photo-hint', text: '실제로 박제했던 사진이나 편지를 올려 주세요(최대 10장). 청취자 닉네임 말고 실명·연락처가 보이면 가려 주세요.' }),
      B.grid, B.pst, B.file),
    h('div', { class: 'bt-f' }, h('label', { for: 'bt-msg' }, '하고 싶은 말 ', h('small', { text: '(선택)' })), msg, msgN),
    h('div', { class: 'agree bt-agree' },
      h('label', { class: 'check', for: 'bt-agree' }, agree, h('span', null, h('em', { text: '(필수)' }), ' 베타 안내와 개인정보 수집에 동의해요')),
      h('p', { class: 'hint', text: '첨부한 사진은 뽑기에만 쓰고, 모집이 끝나면 지워요.' }),
      h('p', { class: 'bt-view' },
        h('a', { href: PRIVACY, target: '_blank', rel: 'noopener' }, '개인정보처리방침 보기', h('span', { class: 'sr', text: '(새 창)' })),
        h('a', { href: TERMS, target: '_blank', rel: 'noopener' }, '이용약관 보기', h('span', { class: 'sr', text: '(새 창)' })))),
    st, B.go,
    editing ? h('button', { class: 'link-btn bt-back', type: 'button', text: '고치지 않고 돌아가기', onclick: () => { B.edit = false; C.paint(); focusTitle(); } }) : null,
    h('p', { class: 'bt-foot', text: '운영자가 보고 뽑아요. 뽑히면 먼치킨을 켤 때 알려 드리고 앨범이 바로 열려요.' }));

  const sub = `${Number(d.seats) || 10}명을 추가로 모집해요. 운영자가 보고 뽑고, 뽑히면 ${monthDay(FREE_END)}까지 무료예요.`;
  const view = wrap(head(editing ? '베타테스터 신청 고치기' : '베타테스터 신청', '추억앨범 베타테스터', sub, chipsOf(d)), form);
  // 칸이 화면에 붙은 뒤: 사진 칸 그리기 · 주소 이름 다시 확인
  setTimeout(() => {
    drawPhotos();
    if (f.label) checkLabel(f.label, out);
  }, 0);
  return view;
}

// ---------- 화면 고르기 ----------
export function betaView(ctx) {
  C = ctx;
  watchVisible();
  // 다른 화면(또는 로그인)에서 막 들어옴 = 아직 베타 화면이 그려져 있지 않음 → 상태가 1분보다 오래됐으면 다시 묻기
  const entering = !document.querySelector('main.view-beta');
  const me = C.S.me?.id || '';
  if (B.owner !== me) reset(me);
  if (entering) refreshIfStale();
  const d = B.st;
  if (!d) {
    if (!B.job && !B.err) load();
    return wrap(head('베타테스터 신청', '추억앨범 베타테스터'),
      B.err ? [C.h('p', { class: 'status bad', role: 'alert', text: B.err }),
        C.h('div', { class: 'bt-actions' }, C.h('button', { class: 'btn line', type: 'button', text: '다시 불러오기', onclick: () => { B.err = ''; load(); C.paint(); } }))]
        : C.h('p', { class: 'muted bt-loading', text: '불러오는 중이에요…' }));
  }
  const m = d.mine || {};
  // 모집이 열려 있지 않을 때: 서버 closedAt(닫은 때 ms — 없으면 null)이 있거나 until 이 지났거나 남은 자리가 없으면 끝남, 아니면 시작 전
  const ended = d.closedAt != null || Date.now() > untilOf(d) || Number(d.left) <= 0;
  if (m.state === 'picked') return pickedView(d, m);
  if (m.hasAlbum) return ownerView(m);
  if (m.state === 'wait') return B.edit && m.canApply ? formView(d, m) : waitView(d, m);
  if (m.state === 'closed') return closedView(d, true, true);
  if (m.canApply || d.open === true) return formView(d, m);
  return closedView(d, ended, false);
}
