// 먼치킨.com/album — 먼치킨 계정 가입·로그인 · 추억앨범 신청(주소 이름·앨범 이름·기간·계좌이체) · 내 정보.
// 계정은 하나: 먼치킨 계정 = 추억앨범 계정(서버 bakje 회원 — 모든 DJ 앨범 공통). 먼치킨 프로그램(봇·송출)도 이 계정으로 로그인한다.
// 서버: bakje(회원·카카오·본인인증·앨범 사이 로그인 이어 주기) · bakje-billing(이용권·추억앨범 신청). 로그인 표는 이 주소의 localStorage(mk_session)에만.
// 주소로 들어오는 것:
//  #bjlogin=<표>      카카오 로그인·먼치킨 프로그램(web-ticket)이 로그인된 채 열 때 → 표를 세션으로 바꾼다
//  #go=apply|me|find  그 화면으로(프로그램의 [신청하기]·[내 정보 관리]·[아이디·비밀번호 찾기])
//  ?app=<자리>        먼치킨 프로그램 카카오 로그인 — 여기서 로그인한 뒤 "먼치킨 프로그램에서 로그인할까요?" [로그인] → app-approve
//  ?bjverify=1&…      휴대폰 본인인증에서 돌아온 자리(포트원)
// 회원·본인인증 흐름은 추억앨범 사이트(박제관 docs/app.js)와 같게 — 포트원 V2 브라우저 SDK(누를 때만 불러온다).

const SB = 'https://aksegkhhugqvvaidgvro.supabase.co';
const KEY = 'sb_publishable_45cIqG4dGLSlev-rmNiVDg_uG8szVzD';
const API = SB + '/functions/v1/bakje/';
const BILL = SB + '/functions/v1/bakje-billing';
const PORTONE_SDK = 'https://cdn.portone.io/v2/browser-sdk.js';
const TERMS = 'https://xn--hu5bi2af5y.com/terms.html';
const PRIVACY = 'https://xn--hu5bi2af5y.com/privacy.html';
const SUFFIX = '먼치킨.com';
const APP_RE = /^app-[a-z2-9]{20}$/;
const TICKET_RE = /^[-_A-Za-z0-9]{43}$/;
const LOGIN_ID_RE = /^[a-z0-9_]{4,20}$/;
const LABEL_RE = /^[가-힣a-z0-9](?:[가-힣a-z0-9-]{0,13}[가-힣a-z0-9])?$/;
const NO_SESSION = new Set(['signup', 'login', 'ticket', 'find-start', 'find-done', 'reset']);
const PLAN_NAME = { munchkin: '먼치킨', album: '추억앨범', bundle: '먼치킨 + 추억앨범', 'add-album': '추억앨범 추가', 'add-munchkin': '먼치킨 추가' };
const PLAN_STATE = { paid: '확인됐어요', rejected: '거절됐어요', canceled: '취소했어요', pending: '확인 기다리는 중' };
const KAKAO_ERRORS = {
  cancel: '카카오 로그인을 그만뒀어요.',
  fail: '카카오 로그인을 하지 못했어요. 다시 해 주세요.',
  banned: '이용이 막힌 계정이에요.',
  setup: '카카오 로그인 준비 중이에요.',
  'sso-none': '다른 추억앨범에서 로그인한 기록이 없어요. 여기서 로그인해 주세요.'
};
const VERIFY_TEXT = '신청한 분을 확인하려고 휴대폰 본인인증을 한 번 해요. 이름·전화번호·생년월일은 저장하지 않아요. 만 14세 이상만 신청할 수 있어요.';
const WAIT_ALBUM = '운영자가 입금을 확인하면 앨범이 만들어져요(최대 24시간).';
const WAIT_PLAN = '운영자가 입금을 확인하면 이용 기간이 늘어나요(최대 24시간).';
const SSO_FRESH_MS = 50 * 86400000;
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

// ---------- 저장 ----------
const store = (pick) => ({
  get: (k) => { try { return pick().getItem(k); } catch { return null; } },
  set: (k, v) => { try { pick().setItem(k, v); } catch { /* 막힌 브라우저 */ } },
  del: (k) => { try { pick().removeItem(k); } catch { /* 막힌 브라우저 */ } }
});
const ls = store(() => localStorage), ss = store(() => sessionStorage);
const parse = (v) => { try { return JSON.parse(v || 'null'); } catch { return null; } };

// 미리 보기(이 PC 127.0.0.1)에서만: ?mock=1 이면 가짜 서버(mock.js — 올리는 파일에는 없다)
if (LOCAL && (new URLSearchParams(location.search).has('mock') || ss.get('mk_mock'))) {
  ss.set('mk_mock', '1');
  try { await import('./mock.js'); } catch { /* 없으면 그대로 */ }
}

// ---------- 주소로 들어온 값 — 맨 먼저 떼어 두고 주소를 깨끗하게 ----------
const RETURN = (() => {
  const out = { ticket: '', loginError: '', sso: '', go: '', app: '', verify: null };
  try {
    const hp = new URLSearchParams(location.hash.slice(1));
    if (TICKET_RE.test(hp.get('bjlogin') || '')) out.ticket = hp.get('bjlogin');
    if (/^[-a-z]{1,20}$/.test(hp.get('bjlogin-error') || '')) out.loginError = hp.get('bjlogin-error');
    if (/^[a-z]{1,10}$/.test(hp.get('bjsso') || '')) out.sso = hp.get('bjsso');
    if (['apply', 'me', 'find'].includes(hp.get('go'))) out.go = hp.get('go');
    const q = new URLSearchParams(location.search);
    if (APP_RE.test(q.get('app') || '')) out.app = q.get('app');
    if (q.get('bjverify') === '1') {
      const saved = parse(ss.get('mk_verify'));
      ss.del('mk_verify');
      const id = q.get('identityVerificationId') || '';
      out.verify = {
        mode: saved?.mode === 'find' ? 'find' : 'join', savedId: typeof saved?.id === 'string' ? saved.id : '',
        id: /^[-_A-Za-z0-9]{4,80}$/.test(id) ? id : '', code: q.get('code') || '', message: (q.get('message') || '').slice(0, 200)
      };
      if (APP_RE.test(saved?.app || '')) out.app = saved.app;
    }
  } catch { /* 이상한 주소 — 그냥 첫 화면 */ }
  try { history.replaceState(null, '', location.pathname + (out.app ? '?app=' + out.app : '')); } catch { /* 그대로 */ }
  return out;
})();

// ---------- 상태 ----------
const S = {
  session: ls.get('mk_session') || '',
  me: parse(ls.get('mk_me')),
  members: null,                 // members-config: {password, kakao, verify:{storeId, channelKey}|null}
  info: null, infoAt: 0, infoError: '',
  view: 'home',
  app: RETURN.app,               // 먼치킨 프로그램 카카오 로그인 자리
  appDone: '',                   // 'ok' · 오류 글
  next: null,                    // 로그인한 뒤 갈 화면
  draft: { label: '', name: '', plan: 'album', months: 1, album: '', ...(parse(ss.get('mk_draft')) || {}) },
  labelOk: null,                 // {label, host} — album-name 이 쓸 수 있다고 한 것
  verifyNote: null               // 본인인증 칸에 보일 것 {text, bad} · {conflict}
};
if (!TICKET_RE.test(S.session)) { S.session = ''; S.me = null; }
const saveDraft = () => ss.set('mk_draft', JSON.stringify(S.draft));

// ---------- 작은 도구 ----------
const $ = (sel, root = document) => root.querySelector(sel);
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'value') el.value = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (typeof v === 'boolean') el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}
const ICONS = {
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
  out: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H4"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  album: '<rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="M3.5 15l4.5-4 3.5 3 3-2.5 6 5"/><circle cx="15.5" cy="8.5" r="1.6"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>',
  heart: '<path d="M12 20.3s-7.4-4.5-9.2-9.1C1.5 7.9 3.5 4.6 7 4.6c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.5 0 5.5 3.3 4.2 6.6-1.8 4.6-9.2 9.1-9.2 9.1z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M8.5 20h7M12 16v4"/>'
};
function icon(name) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('class', 'ico');
  el.innerHTML = ICONS[name] || '';
  return el;
}
const won = (n) => Number(n || 0).toLocaleString('ko-KR') + '원';
const dayText = (ms) => { const d = new Date(Number(ms)); return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`; };
const planPeriod = (o) => (o.months ? (o.months === 12 ? '1년' : o.months + '개월') : `${dayText(o.until_to)}까지`);
let toastTimer = 0;
function toast(message, bad = false) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = message; t.className = bad ? 'bad' : ''; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3600);
}
async function copyLine(text, label) {
  try { await navigator.clipboard.writeText(text); toast(`${label} 복사했어요`); } catch { prompt(`${label} 복사해 주세요`, text); }
}
const statusEl = () => h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
function say(el, message, bad = false, good = false) { el.textContent = message || ''; el.classList.toggle('bad', !!bad); el.classList.toggle('good', !!good); }
async function busy(btn, st, fn) {
  if (btn.dataset.busy) return;
  btn.dataset.busy = '1'; btn.disabled = true; if (st) say(st, '');
  try { await fn(); } catch (e) { if (st) say(st, e.message, true); else toast(e.message, true); } finally { delete btn.dataset.busy; btn.disabled = false; }
}
function field(id, label, input, hint) {
  if (hint) input.setAttribute('aria-describedby', id + '-hint');
  return h('div', { class: 'field' }, h('label', { for: id, text: label }), input, hint ? h('p', { class: 'hint', id: id + '-hint', text: hint }) : null);
}
const input = (id, props = {}) => h('input', { class: 'input', id, ...props });
const pwInput = (id, auto) => input(id, { type: 'password', autocomplete: auto, maxlength: '64' });
const linkBtn = (text, onclick) => h('button', { class: 'link-btn', type: 'button', text, onclick });
function checkNewPassword(pw, pw2) {
  const n = [...pw.value].length;
  if (n < 8 || n > 64) { pw.focus(); return '비밀번호는 8~64자로 정해 주세요.'; }
  if (pw.value !== pw2.value) { pw2.focus(); return '비밀번호 두 칸이 서로 달라요.'; }
  return '';
}
const nickOf = (v) => v.normalize('NFC').trim().replace(/\s+/g, ' ');

// 한글 주소 보이기: 퓨니코드(xn--…)를 글자로(RFC 3492 풀기) — 예 xn--qh3bm70b.xn--s22bu18a0ub.com → 밤톨.먼치킨.com
function punyDecode(input) {
  const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700;
  const digit = (c) => (c >= 48 && c < 58 ? c - 22 : c >= 65 && c < 91 ? c - 65 : c >= 97 && c < 123 ? c - 97 : base);
  const adapt = (delta, points, first) => {
    let k = 0;
    delta = first ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / points);
    for (; delta > ((base - tMin) * tMax) >> 1; k += base) delta = Math.floor(delta / (base - tMin));
    return Math.floor(k + ((base - tMin + 1) * delta) / (delta + skew));
  };
  const out = [];
  let b = input.lastIndexOf('-'); if (b < 0) b = 0;
  for (let j = 0; j < b; j++) out.push(input.charCodeAt(j));
  let n = 128, bias = 72, i = 0;
  for (let at = b > 0 ? b + 1 : 0; at < input.length;) {
    const old = i;
    for (let w = 1, k = base; ; k += base) {
      if (at >= input.length) throw Error('bad');
      const d = digit(input.charCodeAt(at++));
      if (d >= base) throw Error('bad');
      i += d * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (d < t) break;
      w *= base - t;
    }
    const len = out.length + 1;
    bias = adapt(i - old, len, old === 0);
    n += Math.floor(i / len);
    i %= len;
    out.splice(i++, 0, n);
  }
  return String.fromCodePoint(...out);
}
const hostText = (host) => String(host || '').split('.').map((p) => { if (!p.startsWith('xn--')) return p; try { return punyDecode(p.slice(4)); } catch { return p; } }).join('.');

// ---------- 서버 ----------
async function call(path, { method = 'GET', body, query = {}, timeout = 25000, session = false, base = API } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  const sess = session && S.session ? { 'x-bj-session': S.session } : {};
  let res;
  try {
    const qs = method === 'GET' ? '?' + new URLSearchParams({ apikey: KEY, ...query }) : '';
    res = await fetch(base + path + qs, {
      method, signal: ctl.signal, cache: 'no-store',
      headers: method === 'GET' ? sess : { apikey: KEY, 'Content-Type': 'application/json', ...sess },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw Object.assign(Error('인터넷 연결을 확인해 주세요.'), { status: 0 });
  } finally { clearTimeout(timer); }
  let data = null;
  try { data = await res.json(); } catch { /* 아래 */ }
  if (!res.ok || !data?.ok) throw Object.assign(Error(data?.error || '잠시 문제가 생겼어요. 조금 뒤에 다시 해 주세요.'), { status: res.status, data });
  return data;
}
// 본인인증 마무리(verify-done·find-done)는 bakje-verify 함수로(2026-11-05 — 카카오 인증서는 CI 가 없어 이름·생년월일·전화번호 값으로도 같은 사람을 알아본다)
const VERIFY = SB + '/functions/v1/bakje-verify/';
async function memberCall(action, body = {}) {
  const auth = !NO_SESSION.has(action);
  const base = action === 'verify-done' || action === 'find-done' ? VERIFY : API;
  try { return await call('member', { method: 'POST', body: { action, ...body }, session: auth, base }); }
  catch (e) { if (auth && e.status === 401) dropSession(); throw e; }
}
async function billCall(action, body = {}) {
  try { return await call('', { method: 'POST', body: { action, ...body }, session: true, base: BILL }); }
  catch (e) { if (e.status === 401) dropSession(); throw e; }
}
async function loadMembersConfig() {
  try {
    const m = (await call('members-config')).members;
    const v = m?.verify;
    S.members = {
      password: m?.password !== false, kakao: m?.kakao === true,
      verify: v && typeof v.storeId === 'string' && v.storeId && typeof v.channelKey === 'string' && v.channelKey ? { storeId: v.storeId, channelKey: v.channelKey } : null
    };
  } catch { S.members = { password: true, kakao: false, verify: null, failed: true }; }
}
async function loadInfo() {
  S.info = await billCall('info');
  S.infoAt = Date.now(); S.infoError = '';
  return S.info;
}
let infoJob = null, infoErrAt = 0;
function ensureInfo(force = false) {
  if (!S.session || infoJob) return;
  if (!force && S.info && Date.now() - S.infoAt < 20000) return;
  if (!force && !S.info && S.infoError && Date.now() - infoErrAt < 30000) return;   // 계속 실패하면 저절로 다시 묻지 않는다(다시 불러오기 단추로)
  infoJob = loadInfo().catch((e) => { S.infoError = e.message; infoErrAt = Date.now(); }).finally(() => { infoJob = null; paint(); });
}

// ---------- 로그인 표 ----------
function saveMe(member) {
  S.me = member && typeof member.id === 'string' ? member : null;
  if (S.me) ls.set('mk_me', JSON.stringify(S.me)); else ls.del('mk_me');
}
function setSession(token, member) {
  if (!TICKET_RE.test(token || '')) throw Error('로그인을 처음부터 다시 해 주세요.');
  S.session = token;
  ls.set('mk_session', token);
  saveMe(member);
  S.info = null;
}
function dropSession() {
  S.session = ''; S.info = null; S.labelOk = null;
  ls.del('mk_session');
  saveMe(null);
}
async function loadMe() {
  if (!S.session) return;
  try { const r = await memberCall('me'); saveMe(r.member); S.banned = r.banned === true; }
  catch { /* 401 이면 이미 로그아웃, 인터넷 문제면 기억해 둔 계정으로 */ }
}
// 로그아웃 = 모든 곳에서(서버가 이 계정의 세션을 모두 지운다 — 다른 추억앨범·먼치킨 프로그램도)
async function logoutAll() {
  await memberCall('logout').catch(() => {});
  dropSession();
  ls.del('mk_sso_at'); ss.set('mk_sso_tried', '1');
}
// 앨범 사이 로그인 이어 주기(박제관 app.js 와 같게): 서버 주소의 쿠키(bj_sso)로 다른 앨범 주소에서도 저절로 로그인
async function trySso() {
  if (S.session || ss.get('mk_sso_tried')) return false;
  ss.set('mk_sso_tried', '1');
  try {
    const r = await fetch(API + 'sso-check?' + new URLSearchParams({ h: location.host }), { credentials: 'include', cache: 'no-store' }).then((x) => x.json());
    if (!r?.ticket || S.session) return false;
    const t = await memberCall('ticket', { ticket: r.ticket });
    setSession(t.session, t.member);
    ls.set('mk_sso_at', String(Date.now()));
    toast('다른 추억앨범에서 로그인한 계정으로 이어서 로그인했어요');
    return true;
  } catch { return false; }
}
// 로그인한 뒤 한 번: 서버에 쿠키를 맡겨 둔다(없으면 서버 주소에 잠깐 들렀다 돌아온다 — 50일에 한 번쯤).
//  신청 중이거나 프로그램 로그인 중에는 하지 않는다(화면이 바뀌면 안 되니까).
async function ssoRemember() {
  if (!S.session || S.app || S.view === 'apply' || $('dialog[open]')) return;
  if (Date.now() - Number(ls.get('mk_sso_at') || 0) < SSO_FRESH_MS) return;
  try {
    const r = await fetch(API + 'sso-check?' + new URLSearchParams({ h: location.host, peek: '1' }), { credentials: 'include', cache: 'no-store' }).then((x) => x.json());
    if (r?.has) { ls.set('mk_sso_at', String(Date.now())); return; }
    if (!r?.ok) return;
    const t = await memberCall('sso-ticket');
    ss.set('mk_after_sso', S.view);
    location.href = API + 'sso-set?' + new URLSearchParams({ t: t.ticket, h: location.host, r: location.pathname });
  } catch { /* 다음에 다시 */ }
}
function ssoContinue() {
  if (S.next) ss.set('mk_next', S.next);
  location.href = API + 'sso?' + new URLSearchParams({ h: location.host, r: location.pathname + location.search });
}
function kakaoLogin() {
  if (S.next) ss.set('mk_next', S.next);
  location.href = API + 'kakao-start?' + new URLSearchParams({ apikey: KEY, h: location.host, r: location.pathname + location.search });
}

// 로그인을 마친 뒤: 프로그램 로그인 승인 → 가려던 화면 → (닉네임이 없으면 먼저 닉네임)
function afterLogin(message) {
  if (message) toast(message);
  closeSheet();
  if (S.app) { go('app'); return; }
  if (S.me && !S.me.nickname) { openSheet('nickname', { join: true }); return; }
  continueNext();
}
function continueNext() {
  const n = S.next || ss.get('mk_next');
  S.next = null; ss.del('mk_next');
  if (n === 'apply' || n === 'me') go(n);
  else paint();
  ssoRemember();
}
// 로그인이 필요한 화면은 로그인부터
function go(view) {
  if ((view === 'apply' || view === 'me' || view === 'app') && !S.session) {
    if (view !== 'app') S.next = view;
    S.view = view === 'app' ? 'app' : S.view;
    paint();
    openSheet('login');
    return;
  }
  S.view = view;
  if (view === 'apply' || view === 'me') ensureInfo(true);
  paint();
  window.scrollTo({ top: 0 });
}

// ---------- 포트원 본인인증 ----------
let portoneLoading = null;
function loadPortOne() {
  if (window.PortOne?.requestIdentityVerification) return Promise.resolve(window.PortOne);
  if (portoneLoading) return portoneLoading;
  portoneLoading = new Promise((resolve, reject) => {
    const s = h('script', {
      src: PORTONE_SDK, async: true,
      onload: () => (window.PortOne?.requestIdentityVerification ? resolve(window.PortOne) : reject(Error('본인인증 창을 열지 못했어요. 다시 해 주세요.'))),
      onerror: () => { portoneLoading = null; s.remove(); reject(Error('본인인증 창을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.')); }
    });
    document.head.append(s);
  });
  return portoneLoading;
}
// mode: 'join'(내 계정 본인인증 — 신청 화면) · 'find'(아이디·비밀번호 찾기). PC 는 끝난 번호를 돌려주고,
//  휴대폰은 본인인증 창으로 넘어갔다가 ?bjverify=1 로 돌아온다(이 함수는 끝나지 않는다).
async function portoneVerify(mode) {
  const cfg = S.members?.verify;
  if (!cfg) throw Error('본인인증 준비 중이에요. 조금 뒤에 다시 해 주세요.');
  const sdk = loadPortOne();
  sdk.catch(() => {});
  const { id } = await memberCall(mode === 'find' ? 'find-start' : 'verify-start');
  const PortOne = await sdk;
  ss.set('mk_verify', JSON.stringify({ mode, id, app: S.app || '', at: Date.now() }));
  let res;
  try {
    res = await PortOne.requestIdentityVerification({
      storeId: cfg.storeId, identityVerificationId: id, channelKey: cfg.channelKey,
      redirectUrl: location.origin + location.pathname + '?bjverify=1',
      // 다날: 만 14세 미만은 인증 창에서부터 막고(서버도 다시 확인한다), 인증 창에 서비스 이름을 보인다.
      // KG이니시스 통합인증: 고객 정보를 미리 채우지 않음(flgFixedUser 는 꼭 넣어야 함). 채널의 결제대행사 것만 쓰이고 나머지는 무시된다.
      bypass: { danal: { AGELIMIT: 14, CPTITLE: '먼치킨 추억앨범' }, inicisUnified: { flgFixedUser: 'N' } }
    });
  } catch (e) {
    ss.del('mk_verify');
    throw Error(e?.message || '본인인증 창을 열지 못했어요. 다시 해 주세요.');
  }
  ss.del('mk_verify');
  if (!res) throw Error('본인인증 결과를 받지 못했어요. 다시 해 주세요.');
  if (res.code != null) throw Error(res.message || '본인인증을 마치지 못했어요. 다시 해 주세요.');
  return id;
}
// 신청 화면의 본인인증 마무리(verify-done). 같은 사람이 다른 계정으로 이미 인증했으면 그 계정을 알려 준다.
async function finishVerify(id) {
  S.verifyNote = { text: '본인인증 결과를 확인하는 중…' };
  paint();
  try {
    const r = await memberCall('verify-done', { id });
    saveMe(r.member);
    S.verifyNote = null;
    toast('본인인증을 마쳤어요');
  } catch (e) {
    S.verifyNote = e.status === 409 && e.data?.hint ? { conflict: e.data } : { text: e.message, bad: true };
  }
  paint();
}

// ---------- 창(로그인·가입·찾기·닉네임·비밀번호) ----------
let sheet = null;   // {d, box}
function openSheet(step, data = {}) {
  if (!sheet) {
    const box = h('div', { class: 'sheet-in' });
    const d = h('dialog', { class: 'sheet', 'aria-label': '먼치킨 계정' }, box);
    d.addEventListener('close', () => { d.remove(); if (sheet?.d === d) sheet = null; });
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    document.body.append(d);
    d.showModal();
    sheet = { d, box };
  }
  const v = (STEPS[step] || STEPS.login)(data);
  const head = h('div', { class: 'sheet-head' },
    v.back ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': '뒤로', onclick: () => openSheet(v.back, v.backData || {}) }, icon('left')) : h('span', { class: 'icon-gap' }),
    h('h2', { text: v.title }),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': '닫기', onclick: () => closeSheet() }, icon('close')));
  sheet.box.replaceChildren(head, h('div', { class: 'sheet-body' }, v.body));
  sheet.d.setAttribute('aria-label', v.title);
  if (v.focus && !matchMedia('(pointer: coarse)').matches) setTimeout(() => v.focus.focus(), 30);
  v.after?.();
}
function closeSheet() { sheet?.d.close(); }

function kakaoSymbol() {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 18 18');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('class', 'kakao-sym');
  el.innerHTML = '<path fill="#000" d="M9 1.6C4.58 1.6 1 4.4 1 7.86c0 2.21 1.47 4.16 3.69 5.27l-.94 3.45c-.08.3.26.55.52.38l4.12-2.72c.2.02.4.02.61.02 4.42 0 8-2.8 8-6.4S13.42 1.6 9 1.6z"/>';
  return el;
}
// 카카오 로그인 단추(카카오 디자인 안내: 노란 #FEE500 · 검은 말풍선 · 글자 85% 검정)
const kakaoButton = (text = '카카오 로그인') => h('button', { class: 'kakao-btn', type: 'button', onclick: () => kakaoLogin() }, kakaoSymbol(), h('span', { text }));
const orLine = (text = '또는') => h('p', { class: 'or' }, h('span', { text }));

const STEPS = {
  login() {
    const id = input('l-id', { name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', maxlength: '20' });
    const pw = pwInput('l-pw', 'current-password');
    const st = statusEl();
    const btn = h('button', { class: 'btn main block', type: 'submit', text: '로그인' });
    const form = h('form', { class: 'stack', onsubmit: (e) => {
      e.preventDefault();
      const loginId = id.value.trim().toLowerCase();
      if (!loginId || !pw.value) { say(st, '아이디와 비밀번호를 넣어 주세요.', true); (loginId ? pw : id).focus(); return; }
      busy(btn, st, async () => {
        const r = await memberCall('login', { loginId, password: pw.value });
        setSession(r.session, r.member);
        afterLogin('로그인했어요');
      });
    } }, field('l-id', '아이디', id), field('l-pw', '비밀번호', pw), st, btn);
    return {
      title: '먼치킨 계정 로그인', focus: id,
      body: [
        h('p', { class: 'lead-s', text: S.app ? '먼치킨 프로그램에 로그인하려면 먼저 여기서 먼치킨 계정으로 로그인해 주세요.' : '먼치킨 계정 하나로 먼치킨 프로그램과 모든 추억앨범을 써요.' }),
        S.members?.kakao ? [kakaoButton(), orLine()] : null,
        form,
        h('button', { class: 'btn soft block small', type: 'button', onclick: () => ssoContinue() }, icon('check'), '다른 추억앨범에서 로그인했다면 → 그 계정으로 계속'),
        h('div', { class: 'links' }, linkBtn('회원가입', () => openSheet('signup')), h('span', { class: 'sep', 'aria-hidden': 'true' }), linkBtn('아이디·비밀번호 찾기', () => openSheet('find')))
      ]
    };
  },

  signup() {
    const id = input('s-id', { name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', maxlength: '20' });
    id.addEventListener('input', (e) => { if (e.isComposing) return; const v = id.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); if (v !== id.value) id.value = v; });
    const pw = pwInput('s-pw', 'new-password'), pw2 = pwInput('s-pw2', 'new-password');
    const nk = input('s-nick', { maxlength: '12', autocomplete: 'nickname', spellcheck: 'false' });
    const all = h('input', { type: 'checkbox', id: 'agree-all' });
    const terms = h('input', { type: 'checkbox', id: 'agree-terms' });
    const privacy = h('input', { type: 'checkbox', id: 'agree-privacy' });
    all.addEventListener('change', () => { terms.checked = privacy.checked = all.checked; });
    for (const c of [terms, privacy]) c.addEventListener('change', () => { all.checked = terms.checked && privacy.checked; });
    const agreeRow = (box, forId, text, href) => h('div', { class: 'agree-row' },
      h('label', { class: 'check', for: forId }, box, h('span', null, h('em', { text: '(필수)' }), ' ' + text)),
      h('a', { class: 'agree-view', href, target: '_blank', rel: 'noopener', text: '보기', 'aria-label': text.replace(/에 동의해요$/, '') + ' 보기' }));
    const st = statusEl();
    const btn = h('button', { class: 'btn main block', type: 'submit', text: '가입하기' });
    const form = h('form', { class: 'stack', onsubmit: (e) => {
      e.preventDefault();
      const loginId = id.value.trim().toLowerCase();
      if (!LOGIN_ID_RE.test(loginId)) { say(st, '아이디는 영어 소문자·숫자·_ 로 4~20자예요.', true); id.focus(); return; }
      const bad = checkNewPassword(pw, pw2);
      if (bad) { say(st, bad, true); return; }
      const nick = nickOf(nk.value);
      if ([...nick].length < 2 || [...nick].length > 12) { say(st, '닉네임은 2~12자로 정해 주세요.', true); nk.focus(); return; }
      if (!terms.checked || !privacy.checked) { say(st, '이용약관과 개인정보 수집·이용에 동의해 주세요.', true); return; }
      busy(btn, st, async () => {
        const r = await memberCall('signup', { loginId, password: pw.value, agree: true, role: 'dj' });
        setSession(r.session, r.member);
        // 닉네임은 가입 뒤 따로 정한다 — 겹치거나 못 쓰는 닉네임이면 닉네임 단계에서 다시
        try { saveMe((await memberCall('nickname', { nickname: nick })).member); }
        catch (err) { toast('가입했어요'); openSheet('nickname', { join: true, value: nick, error: err.message }); return; }
        afterLogin('가입했어요');
      });
    } },
      field('s-id', '아이디', id, '영어 소문자·숫자·_ 로 4~20자'),
      field('s-pw', '비밀번호', pw, '8자 이상'),
      field('s-pw2', '비밀번호 확인', pw2),
      field('s-nick', '닉네임', nk, '한글·영문·숫자·_ 로 2~12자 — 추억앨범 댓글과 입금자명에 쓰여요'),
      h('div', { class: 'agree' },
        h('label', { class: 'check agree-all', for: 'agree-all' }, all, h('span', { text: '모두 동의해요' })),
        agreeRow(terms, 'agree-terms', '이용약관에 동의해요', TERMS),
        agreeRow(privacy, 'agree-privacy', '개인정보 수집·이용에 동의해요', PRIVACY)),
      h('p', { class: 'hint', text: '만 14세 이상만 가입할 수 있어요. 본인인증은 추억앨범·이용권을 신청할 때 한 번 해요.' }),
      st, btn);
    return {
      title: '회원가입', back: 'login', focus: id,
      body: [
        h('p', { class: 'lead-s', text: '먼치킨 계정을 만들어요. 먼치킨 프로그램과 추억앨범에서 같이 써요.' }),
        S.members?.kakao ? [kakaoButton('카카오로 시작하기'), orLine('또는 아이디로 가입')] : null,
        form
      ]
    };
  },

  nickname(x) {
    if (!S.me) return STEPS.login();
    const had = S.me.nickname || '';
    const nk = input('n-nick', { maxlength: '12', value: x.value || had, autocomplete: 'nickname', spellcheck: 'false' });
    const st = statusEl();
    if (x.error) say(st, x.error, true);
    const btn = h('button', { class: 'btn main block', type: 'submit', text: had ? '바꾸기' : '정하기' });
    const form = h('form', { class: 'stack', onsubmit: (e) => {
      e.preventDefault();
      const v = nickOf(nk.value);
      if ([...v].length < 2 || [...v].length > 12) { say(st, '닉네임은 2~12자로 정해 주세요.', true); nk.focus(); return; }
      busy(btn, st, async () => {
        if (v !== had) { saveMe((await memberCall('nickname', { nickname: v })).member); toast(had ? '닉네임을 바꿨어요' : '닉네임을 정했어요'); }
        closeSheet();
        if (x.join) continueNext(); else paint();
      });
    } }, field('n-nick', '닉네임', nk, '한글·영문·숫자·_ 로 2~12자예요. 가운데 빈칸도 쓸 수 있어요.'), st, btn);
    return {
      title: had ? '닉네임 바꾸기' : '닉네임 정하기', focus: nk,
      body: [
        h('p', { class: 'lead-s', text: '추억앨범 댓글에는 닉네임만 보여요. 입금자명에도 닉네임이 들어가요.' }),
        form,
        x.join ? h('div', { class: 'links' }, linkBtn('나중에 정할게요', () => { closeSheet(); continueNext(); })) : null
      ]
    };
  },

  password() {
    if (!S.me) return STEPS.login();
    const old = pwInput('p-old', 'current-password'), pw = pwInput('p-new', 'new-password'), pw2 = pwInput('p-new2', 'new-password');
    const st = statusEl();
    const btn = h('button', { class: 'btn main block', type: 'submit', text: '비밀번호 바꾸기' });
    const form = h('form', { class: 'stack', onsubmit: (e) => {
      e.preventDefault();
      if (!old.value) { say(st, '지금 비밀번호를 넣어 주세요.', true); old.focus(); return; }
      const bad = checkNewPassword(pw, pw2);
      if (bad) { say(st, bad, true); return; }
      busy(btn, st, async () => {
        await memberCall('password', { old: old.value, password: pw.value });
        closeSheet();
        toast('비밀번호를 바꿨어요. 다른 곳의 로그인은 풀렸어요');
      });
    } },
      h('input', { type: 'text', class: 'hidden', autocomplete: 'username', value: S.me.loginId || '', tabindex: '-1', 'aria-hidden': 'true' }),
      field('p-old', '지금 비밀번호', old), field('p-new', '새 비밀번호', pw, '8자 이상'), field('p-new2', '새 비밀번호 확인', pw2), st, btn);
    return { title: '비밀번호 바꾸기', focus: old, body: [h('p', { class: 'lead-s', text: '바꾸면 이 브라우저 말고 다른 곳(다른 추억앨범·먼치킨 프로그램)의 로그인은 풀려요.' }), form] };
  },

  find(x) {
    const cfg = S.members?.verify;
    const st = statusEl();
    const btn = h('button', { class: 'btn main block', type: 'button', text: '휴대폰 본인인증하기', disabled: !cfg });
    const done = async (id) => {
      say(st, '본인인증 결과를 확인하는 중…');
      const r = await memberCall('find-done', { id });
      openSheet('found', { account: r.account || {}, reset: typeof r.reset === 'string' ? r.reset : null });
    };
    btn.addEventListener('click', () => busy(btn, st, async () => { await done(await portoneVerify('find')); }));
    if (!cfg) say(st, '본인인증 준비 중이에요. 조금 뒤에 다시 해 주세요.');
    else if (x.error) say(st, x.error, true);
    return {
      title: '아이디·비밀번호 찾기', back: S.session ? null : 'login',
      body: [
        h('p', { class: 'lead-s', text: '가입한 계정에 했던 휴대폰 본인인증을 다시 하면 아이디를 알려 드리고, 비밀번호를 새로 정할 수 있어요.' }),
        h('p', { class: 'hint', text: '본인인증을 한 번도 하지 않은 계정은 찾을 수 없어요. 그때는 운영자(likegorogoro@naver.com)에게 알려 주세요.' }),
        st, btn,
        h('div', { class: 'links' }, linkBtn('회원가입', () => openSheet('signup')))
      ],
      after: () => {
        if (cfg) loadPortOne().catch(() => {});
        if (x.pendingId) busy(btn, st, () => done(x.pendingId));
      }
    };
  },

  found(x) {
    const a = x.account || {};
    const parts = [];
    if (a.loginId) {
      parts.push(h('div', { class: 'found-id' }, h('span', { text: '내 아이디' }), h('strong', { text: a.loginId })));
      if (x.reset && !S.session) {
        const pw = pwInput('r-pw', 'new-password'), pw2 = pwInput('r-pw2', 'new-password');
        const st = statusEl();
        const btn = h('button', { class: 'btn main block', type: 'submit', text: '새 비밀번호로 로그인' });
        parts.push(h('form', { class: 'stack', onsubmit: (e) => {
          e.preventDefault();
          const bad = checkNewPassword(pw, pw2);
          if (bad) { say(st, bad, true); return; }
          busy(btn, st, async () => {
            const r = await memberCall('reset', { reset: x.reset, password: pw.value });
            setSession(r.session, r.member);
            afterLogin('비밀번호를 바꾸고 로그인했어요');
          });
        } },
          h('p', { class: 'lead-s', text: '비밀번호를 새로 정하면 바로 로그인돼요. 10분 안에 해 주세요.' }),
          h('input', { type: 'text', class: 'hidden', autocomplete: 'username', value: a.loginId, tabindex: '-1', 'aria-hidden': 'true' }),
          field('r-pw', '새 비밀번호', pw, '8자 이상'), field('r-pw2', '새 비밀번호 확인', pw2), st, btn));
        parts.push(h('div', { class: 'links' }, linkBtn('지금 비밀번호로 로그인할게요', () => openSheet('login'))));
      } else if (!S.session) parts.push(h('button', { class: 'btn main block', type: 'button', text: '로그인하러 가기', onclick: () => openSheet('login') }));
    }
    if (a.kakao) parts.push(h('p', { class: 'lead-s', text: '카카오로 가입한 계정이에요. 카카오 로그인을 눌러 주세요.' }), S.members?.kakao && !S.session ? kakaoButton() : null);
    if (!a.loginId && !a.kakao) parts.push(h('p', { class: 'lead-s', text: '계정을 찾지 못했어요.' }));
    return { title: '계정 찾기', back: S.session ? null : 'login', body: parts };
  }
};

// ---------- 화면 ----------
const app = $('#app');
function paint() {
  const main = h('main', { class: 'wrap page', id: 'main' }, viewBody());
  app.replaceChildren(topbar(), main, footer());
}
function viewBody() {
  if (S.view === 'app') return appView();
  if (S.view === 'apply' && S.session) return applyView();
  if (S.view === 'me' && S.session) return meView();
  return homeView();
}
function topbar() {
  const right = S.session && S.me
    ? h('button', { class: 'me-btn', type: 'button', 'aria-label': '내 정보', onclick: () => go('me') }, icon('user'), h('span', { class: 'me-name', text: S.me.nickname || '내 정보' }))
    : h('button', { class: 'btn main small', type: 'button', text: '로그인', onclick: () => openSheet('login') });
  return h('header', { class: 'top' }, h('div', { class: 'wrap top-in' },
    h('a', { class: 'brand', href: './', onclick: (e) => {
      e.preventDefault();
      if (S.view === 'app') { S.app = ''; S.appDone = ''; try { history.replaceState(null, '', location.pathname); } catch { /* 그대로 */ } }
      go('home');
    } },
      h('img', { src: '../munchkin-64.png', alt: '', width: '34', height: '34' }), h('span', null, '먼치킨 ', h('em', { text: '추억앨범' }))),
    h('nav', { class: 'top-nav' },
      S.view !== 'apply' && S.view !== 'app' ? (albumBeta() && !ownsAlbum()
        ? h('a', { class: 'btn line small hide-s', href: PREVIEW_URL, target: '_blank', rel: 'noopener', text: '미리 보기' })
        : h('button', { class: 'btn line small hide-s', type: 'button', text: '신청하기', onclick: () => go('apply') })) : null,
      right)));
}
function footer() {
  return h('footer', { class: 'foot' }, h('div', { class: 'wrap' },
    h('p', { class: 'foot-links' },
      h('a', { href: TERMS, target: '_blank', rel: 'noopener', text: '이용약관' }), ' · ',
      h('a', { href: PRIVACY, target: '_blank', rel: 'noopener', text: '개인정보처리방침' }), ' · ',
      h('a', { href: '../', text: '먼치킨 첫 화면' })),
    h('p', { class: 'muted small', text: '먼치킨과 추억앨범은 스푼(Spoon)이 만든 서비스가 아니고, 스푼과 제휴 관계도 아니에요.' }),
    // 운영자 사업자 정보 — 평소엔 접어 두고 누르면 펼침(추억앨범 사이트와 같게)
    h('details', { class: 'foot-biz' },
      h('summary', { text: '사업자 정보' }),
      h('p', { text: '제이원스튜디오 · 대표 이지원 · 사업자등록번호 174-93-02335' }),
      h('p', { text: '대구광역시 수성구 동대구로 336 · likegorogoro@naver.com' }))));
}
const sectionHead = (eyebrow, title, lead) => h('div', { class: 'head' }, eyebrow ? h('p', { class: 'eyebrow', text: eyebrow }) : null, h('h2', { text: title }), lead ? h('p', { class: 'lead', text: lead }) : null);
// 추억앨범 베타(2026-11-05 사용자 "추억앨범은 아직 다른 디제이들은 이용할 수 없어 — 베타테스트 중이라 추후 공개 예정 · 미리보기 버튼 → 한이준.com"):
//  서버(bakje-billing info albumOpen)가 새 앨범 신청을 받을 때만 신청하기. 아니면(로그인 전 포함) 안내 + 미리 보기. 이미 앨범이 있는 DJ(시범)는 연장 그대로.
const PREVIEW_URL = 'https://xn--hu5bi2af5y.com/';
const BETA_TEXT = '추억앨범은 지금 베타 테스트 중이에요. 다른 DJ분들께는 추후 공개할 예정이에요.';
const albumBeta = () => S.info?.albumOpen !== true;
const ownsAlbum = () => Boolean(S.session && S.info?.albums?.length);
const previewBtn = (cls = 'btn main') => h('a', { class: cls, href: PREVIEW_URL, target: '_blank', rel: 'noopener' }, icon('album'), '미리 보기 · 한이준 추억앨범');
const betaBox = () => h('div', { class: 'card beta-box' },
  h('p', { class: 'eyebrow', text: '베타 테스트 중' }),
  h('p', { class: 'lead-s', text: BETA_TEXT }),
  h('p', { class: 'muted small', text: '어떤 모습인지는 한이준 추억앨범에서 미리 볼 수 있어요.' }),
  previewBtn());

// 처음 화면
function homeView() {
  const mine = S.session && S.info?.albums?.length ? S.info.albums : null;
  if (S.session && !S.info) ensureInfo();
  const beta = albumBeta() && !mine;
  const ctaMain = beta ? previewBtn() : h('button', { class: 'btn main', type: 'button', onclick: () => go('apply') }, icon('album'), mine ? '연장·신청하기' : '추억앨범 신청하기');
  const ctaSub = S.session
    ? h('button', { class: 'btn line', type: 'button', onclick: () => go('me') }, icon('user'), '내 정보')
    : h('button', { class: 'btn line', type: 'button', onclick: () => openSheet('login') }, '로그인 · 회원가입');
  const mock = h('div', { class: 'mock', 'aria-hidden': 'true' },
    h('div', { class: 'mock-bar' }, h('i'), h('i'), h('i'), h('span', { text: '밤톨.먼치킨.com' })),
    h('div', { class: 'mock-head' }, h('b', { class: 'mock-av' }), h('div', null, h('strong', { text: '밤톨 추억앨범' }), h('span', { text: '게시물 24 · 박제판 12 · 하트 380' }))),
    h('div', { class: 'mock-grid' }, ...[1, 2, 3, 4, 5, 6].map((n) => h('span', { class: 't' + n }, n === 1 ? h('em', { text: '🏆 최초' }) : null))));
  const points = [
    ['trophy', '최초 박제판이 저절로', '먼치킨 최초 박제판에 이름이 적히면 내 추억앨범에 저절로 올라가요. 손으로 올릴 필요가 없어요.'],
    ['key', '계정 하나로 둘 다', '먼치킨 계정 하나로 먼치킨 프로그램과 추억앨범을 함께 써요. 프로그램에서 로그인하면 앨범과 저절로 이어져요.'],
    ['heart', '청취자와 함께', '청취자가 하트를 누르고 댓글·답글을 달아요. 새 하트·댓글은 알림으로 알려 드려요.']
  ];
  return [
    mine ? h('section', { class: 'mine-strip' }, h('div', { class: 'mine-row' }, mine.map(albumMini))) : null,
    h('section', { class: 'hero' }, h('div', { class: 'hero-grid' },
      h('div', { class: 'hero-text' },
        h('p', { class: 'eyebrow', text: beta ? '먼치킨 추억앨범 · 베타 테스트 중' : '먼치킨 추억앨범' }),
        h('h1', null, '방송의 추억을', h('br'), h('em', { text: '나만의 앨범' }), '으로'),
        h('p', { class: 'lead' }, '내 박제판·최초 박제판·방송 사진을 모아 두는 나만의 사이트예요. 주소는 ', h('b', { text: '밤톨.먼치킨.com' }), '처럼 내 이름으로 정해요.'),
        h('div', { class: 'cta' }, ctaMain, ctaSub),
        h('p', { class: 'note', text: beta ? BETA_TEXT : '추억앨범만 써도 되고, 먼치킨과 함께 쓰면 더 편해요.' })),
      h('div', { class: 'hero-art' }, h('div', { class: 'plate' }, h('img', { src: '../munchkin-256.png', alt: '먼치킨 캐릭터', width: '256', height: '256' })), mock))),
    h('section', { class: 'sect' },
      sectionHead('같이 쓰면 좋은 점', '먼치킨이랑 같이 쓰면 더 좋아요'),
      h('div', { class: 'cards3' }, points.map(([ic, t, d]) => h('article', { class: 'point' }, h('span', { class: 'point-ico' }, icon(ic)), h('h3', { text: t }), h('p', { text: d }))))),
    h('section', { class: 'sect' },
      sectionHead('앨범에 담기는 것', '내 방송의 모든 순간을 한곳에'),
      h('ul', { class: 'chips' }, ['일반 게시물(피드)', '박제판', '최초 박제판', '달력으로 보기', '하트·댓글·답글', 'DJ 알림', '내 프로필·소개'].map((t) => h('li', { text: t })))),
    h('section', { class: 'sect' },
      sectionHead('만드는 방법', '이렇게 만들어요', beta ? '공개되면 세 단계면 끝나요. 지금은 베타 테스트 중이라 신청을 받지 않아요.' : '세 단계면 끝나요. 앨범이 생기면 바로 글을 올릴 수 있어요.'),
      h('ol', { class: 'steps' },
        h('li', null, h('b', { text: '먼치킨 계정으로 로그인' }), h('span', { text: '없으면 1분이면 가입해요. 카카오로도 돼요.' })),
        h('li', null, h('b', { text: '신청하기' }), h('span', { text: '주소 이름·앨범 이름·기간을 고르고 계좌로 이체해요.' })),
        h('li', null, h('b', { text: '바로 열려요' }), h('span', { text: '운영자가 입금을 확인하면 앨범과 주소가 바로 만들어져요(최대 24시간).' }))),
      h('div', { class: 'cta center' }, beta ? previewBtn() : h('button', { class: 'btn main', type: 'button', onclick: () => go('apply') }, '추억앨범 신청하기'))),
    h('section', { class: 'sect faq' },
      sectionHead('묻고 답하기', '궁금한 것'),
      [...(beta ? [['지금 신청할 수 있나요?', '아직은 베타 테스트 중이라 신청을 받지 않아요. 추후 공개할 예정이에요. 어떤 모습인지는 한이준 추억앨범(한이준.com)에서 미리 볼 수 있어요.']] : []),
        ['먼치킨을 안 써도 만들 수 있나요?', '네. 추억앨범만 신청해도 돼요. 먼치킨(봇 프로그램)을 함께 쓰면 최초 박제판이 저절로 올라가요.'],
        ['먼치킨 프로그램과는 어떻게 이어지나요?', '먼치킨에서 같은 먼치킨 계정으로 로그인하면 저절로 이어져요. 앨범이 생길 때 그 계정으로 로그인한 먼치킨이 있으면 그것도 바로 이어져요.'],
        ['본인인증은 왜 하나요?', '추억앨범·이용권을 신청한 분을 확인하려고 한 번 해요. 이름·전화번호·생년월일은 저장하지 않아요.'],
        ['청취자도 가입해야 하나요?', '앨범은 누구나 볼 수 있어요. 댓글을 달 때만 가입하면 돼요.']]
        .map(([q, a]) => h('details', { class: 'qa' }, h('summary', { text: q }), h('p', { text: a }))))
  ];
}
// 남은 기간 글
function leftOf(a) {
  if (a.state && a.state !== 'active') return { text: '보기만 할 수 있어요 — 운영자에게 문의해 주세요', bad: true };
  if (!a.paidUntil) return { text: '시범 이용 중', bad: false };
  const d = Math.ceil((a.paidUntil - Date.now()) / 86400000);
  if (d <= 0) return { text: '기간이 끝났어요 · 지금은 보기만 돼요', bad: true };
  return { text: `D-${d} · ${dayText(a.paidUntil)}까지`, bad: d <= 3 };
}
function albumMini(a) {
  const left = leftOf(a);
  return h('a', { class: 'album-mini', href: a.site || '#', target: '_blank', rel: 'noopener' },
    h('span', { class: 'album-mini-ico' }, icon('album')),
    h('span', { class: 'album-mini-txt' }, h('b', { text: a.name || '내 추억앨범' }), h('span', { text: hostText(a.host) })),
    h('span', { class: 'chip' + (left.bad ? ' bad' : ''), text: left.text }));
}

// 신청 화면
function stepper(done) {
  const items = ['본인인증', '주소 이름', '앨범 이름', '기간', '입금'];
  return h('ol', { class: 'stepper', 'aria-label': '신청 단계' }, items.map((t, i) => h('li', { class: done[i] ? 'done' : '' }, h('b', null, done[i] ? icon('check') : String(i + 1)), h('span', { text: t }))));
}
const kvRow = (k, ...v) => h('div', { class: 'kv-row' }, h('dt', { text: k }), h('dd', null, ...v));
const copyChip = (text, label) => h('button', { class: 'copy-chip', type: 'button', onclick: () => copyLine(text, label) }, icon('copy'), '복사');
// 확인을 기다리는 신청: 계좌·금액·입금자명 + [입금했어요] [신청 취소]
function orderCard(o, info) {
  const st = statusEl(), bank = info.bank;
  const na = o.newAlbum;
  return h('article', { class: 'card pay' + (o.sent ? ' sent' : ''), id: 'order-' + o.id },
    h('div', { class: 'pay-top' },
      h('span', { class: 'chip ' + (o.sent ? 'ok' : 'wait'), text: o.sent ? '입금 알림 보냄 · 확인 기다리는 중' : '이체를 기다리고 있어요' }),
      h('span', { class: 'muted small', text: dayText(o.created) })),
    h('p', { class: 'pay-title', text: `${PLAN_NAME[o.plan] || o.plan} · ${planPeriod(o)}` }),
    na ? h('p', { class: 'pay-album' }, icon('album'), h('span', null, h('b', { text: `${na.label}.${SUFFIX}` }), ' · ' + na.name)) : null,
    h('p', { class: 'amount', text: won(o.amount) }),
    bank ? h('dl', { class: 'kv' },
      kvRow('은행', bank.bank),
      kvRow('계좌', h('span', { class: 'mono', text: bank.number }), copyChip(bank.number.replace(/[^0-9]/g, ''), '계좌번호')),
      kvRow('예금주', bank.holder),
      kvRow('입금자명', h('b', { class: 'mono', text: o.payer }), copyChip(o.payer, '입금자명'))) : null,
    o.sent ? h('p', { class: 'notice', text: `입금했다고 알렸어요. ${na ? WAIT_ALBUM : WAIT_PLAN}` })
      : h('p', { class: 'hint', text: '이체할 때 받는 분에게 보이는 이름(입금자명)을 위 글자 그대로 적어 주세요. 이체한 뒤 "입금했어요"를 눌러 주세요.' }),
    st,
    h('div', { class: 'row-btns' },
      h('button', { class: 'btn line', type: 'button', text: '신청 취소', onclick: (e) => busy(e.currentTarget, st, async () => {
        if (!confirm('이 신청을 취소할까요? 이미 이체했다면 취소하지 말고 "입금했어요"를 눌러 주세요.')) return;
        await billCall('cancel', { id: o.id }); toast('신청을 취소했어요'); await loadInfo(); paint();
      }) }),
      !o.sent ? h('button', { class: 'btn main', type: 'button', text: '입금했어요', onclick: (e) => busy(e.currentTarget, st, async () => {
        await billCall('sent', { id: o.id }); toast('운영자에게 알렸어요'); await loadInfo(); paint();
      }) }) : null));
}
const segOf = (items, cur, on) => h('div', { class: 'seg', role: 'group' }, items.map(([v, label, ok = true]) =>
  h('button', { type: 'button', class: v === cur ? 'on' : '', 'aria-pressed': String(v === cur), disabled: !ok, onclick: () => on(v) }, label)));

let labelTimer = 0, labelSeq = 0, orderBtnRef = null, orderReady = () => false, stepperRef = null, stepperDone = () => [];
// 쓰는 동안(화면을 다시 그리지 않고) 신청 단추와 단계 표시만 고친다
function refreshOrderBtn() {
  if (orderBtnRef) orderBtnRef.disabled = !orderReady();
  if (stepperRef?.isConnected) { const fresh = stepper(stepperDone()); stepperRef.replaceWith(fresh); stepperRef = fresh; }
}
// 주소 이름 바로 확인(album-name — 400ms 쉬면 묻는다)
function checkLabel(v, out) {
  clearTimeout(labelTimer);
  const label = v.normalize('NFC').trim().toLowerCase();
  S.draft.label = label; saveDraft();
  if (S.labelOk?.label !== label) S.labelOk = null;
  refreshOrderBtn();
  if (!label) { say(out, ''); return; }
  if (!LABEL_RE.test(label)) { say(out, '한글·영어 소문자·숫자로 1~15자예요. - 는 가운데에만 쓸 수 있어요.', true); return; }
  if (S.labelOk) { say(out, `${label}.${SUFFIX} 은 쓸 수 있어요`, false, true); return; }
  say(out, '쓸 수 있는지 보는 중…');
  const seq = ++labelSeq;
  labelTimer = setTimeout(async () => {
    try {
      const r = await billCall('album-name', { label });
      if (seq !== labelSeq) return;
      if (r.free) { S.labelOk = { label: r.label, host: r.host }; say(out, `${r.label}.${SUFFIX} 은 쓸 수 있어요`, false, true); }
      else { S.labelOk = null; say(out, r.reason || '쓸 수 없는 이름이에요. 다른 이름을 골라 주세요.', true); }
    } catch (e) { if (seq === labelSeq) say(out, e.message, true); }
    refreshOrderBtn();
  }, 400);
}

function applyView() {
  const info = S.info;
  const me = S.me || {};
  if (!info) {
    ensureInfo();
    return h('section', { class: 'sect narrow' }, sectionHead('추억앨범 신청', '추억앨범 신청하기'),
      h('div', { class: 'card' }, S.infoError ? [h('p', { class: 'status bad', text: S.infoError }), h('button', { class: 'btn line', type: 'button', text: '다시 불러오기', onclick: () => ensureInfo(true) })] : h('p', { class: 'muted', text: '불러오는 중이에요…' })));
  }
  const albums = info.albums || [];
  const owner = albums.length > 0;
  const pending = (info.orders || []).filter((o) => o.state === 'pending');
  const pendingNew = pending.find((o) => o.newAlbum);
  const parts = [sectionHead(owner ? '추억앨범 연장' : '추억앨범 신청', owner ? '추억앨범 연장하기' : '추억앨범 신청하기',
    owner ? '쓰고 있는 기간이 남아 있으면 그 끝에 이어서 늘어나요. 한 달 = 30일.' : '주소 이름·앨범 이름·기간을 고르고 계좌로 이체하면, 운영자가 확인한 뒤 앨범이 바로 만들어져요.')];

  // 확인을 기다리는 신청
  if (pending.length) parts.push(h('div', { class: 'stack' }, h('h3', { class: 'sub', text: '확인을 기다리는 신청' }), pending.map((o) => orderCard(o, info))));
  if (!info.open) { parts.push(h('div', { class: 'card' }, h('p', { class: 'notice', text: '신청을 준비하고 있어요. 조금 뒤에 다시 와 주세요.' }))); return h('section', { class: 'sect narrow' }, parts); }
  // 베타: 앨범이 없는 DJ 는 새 신청 대신 안내·미리 보기(서버도 받지 않는다). 먼치킨 이용권 칸도 함께(무료 기간 안내)
  if (!owner && info.albumOpen !== true) { parts[0] = sectionHead('추억앨범 신청', '아직 신청을 받지 않아요'); parts.push(betaBox(), munchkinOnly(info)); return h('section', { class: 'sect narrow' }, parts); }

  // 1. 본인인증
  const verified = Boolean(me.verified);
  if (!verified) {
    const cfg = S.members?.verify;
    const st = statusEl();
    const btn = h('button', { class: 'btn main block', type: 'button', text: '휴대폰 본인인증하기', disabled: !cfg });
    btn.addEventListener('click', () => busy(btn, st, async () => { const id = await portoneVerify('join'); await finishVerify(id); }));
    const note = S.verifyNote;
    let conflict = null;
    if (note?.conflict) {
      const hint = note.conflict.hint || {};
      conflict = h('div', { class: 'notice' },
        h('strong', { text: note.conflict.error || '이미 본인인증한 계정이 있어요. 그 계정으로 로그인해 주세요.' }),
        hint.loginId ? h('p', null, '그 계정의 아이디: ', h('b', { text: hint.loginId })) : null,
        hint.kakao ? h('p', { text: '그 계정은 카카오로 가입했어요.' }) : null,
        h('button', { class: 'btn main small', type: 'button', text: '로그아웃하고 그 계정으로 로그인', onclick: async () => { S.verifyNote = null; await logoutAll(); S.next = 'apply'; paint(); openSheet('login'); } }));
    } else if (note?.text) say(st, note.text, note.bad);
    if (!cfg) say(st, '본인인증 준비 중이에요. 조금 뒤에 다시 해 주세요.');
    parts.push(stepper([false, false, false, false, false]),
      h('article', { class: 'card' }, h('h3', { text: '1. 본인인증' }), h('p', { class: 'lead-s', text: VERIFY_TEXT }), conflict, st, conflict ? null : btn));
    if (cfg) loadPortOne().catch(() => {});
    return h('section', { class: 'sect narrow' }, parts);
  }
  if (!me.nickname) {
    parts.push(h('article', { class: 'card' }, h('h3', { text: '닉네임을 먼저 정해 주세요' }), h('p', { class: 'lead-s', text: '입금자명과 앨범 이름에 닉네임이 쓰여요.' }),
      h('button', { class: 'btn main block', type: 'button', text: '닉네임 정하기', onclick: () => openSheet('nickname', {}) })));
    return h('section', { class: 'sect narrow' }, parts);
  }

  const d = S.draft;
  const price = (plan, m) => (m === 12 ? info.year?.[plan] : (info.prices?.[plan] || 0) * m);
  const addons = info.addons || {};
  // 고를 수 있는 이용권: 새 앨범이면 추억앨범만 · 먼치킨 + 추억앨범 · (먼치킨을 쓰는 중이면) 먼치킨 끝나는 날에 맞춰 추억앨범 더하기
  const plans = [['album', owner ? '추억앨범 연장' : '추억앨범만', info.prices?.album > 0], ['bundle', '먼치킨 + 추억앨범', info.prices?.bundle > 0]];
  if (addons['add-album']) plans.push(['add-album', '먼치킨 끝나는 날에 맞춰 더하기', true]);
  if (owner && addons['add-munchkin']) plans.push(['add-munchkin', '먼치킨 더하기(앨범 끝나는 날까지)', true]);
  if (!plans.some(([k, , ok]) => k === d.plan && ok)) d.plan = (plans.find(([, , ok]) => ok) || plans[0])[0];
  if (![1, 3, 6, 12].includes(d.months)) d.months = 1;
  const quote = addons[d.plan] || null;
  const amount = quote ? quote.amount : price(d.plan, d.months);
  const full = (info.prices?.[d.plan] || 0) * 12;
  const album = owner ? (albums.find((a) => a.id === d.album) || albums[0]) : null;
  const wantAlbum = !owner && d.plan !== 'add-munchkin';

  const st = statusEl();
  const nameIn = input('a-name', { maxlength: '40', value: d.name, placeholder: `${me.nickname} 추억앨범` });
  nameIn.addEventListener('input', () => { d.name = nameIn.value; saveDraft(); refreshOrderBtn(); });
  const nameOk = () => { const n = [...(d.name.trim() || `${me.nickname} 추억앨범`)].length; return n >= 2 && n <= 40; };
  orderReady = () => amount > 0 && (!wantAlbum || (S.labelOk && S.labelOk.label === d.label && nameOk()));
  const btn = h('button', { class: 'btn main block big', type: 'button', text: `${won(amount)} 신청하기`, disabled: true, onclick: () => busy(btn, st, async () => {
    if (!orderReady()) throw Error(wantAlbum && !S.labelOk ? '주소 이름을 먼저 정해 주세요.' : '신청 내용을 다시 봐 주세요.');
    const body = { plan: d.plan, ...(quote ? {} : { months: d.months }) };
    if (owner && album) body.album = album.id;
    if (wantAlbum) body.newAlbum = { label: d.label, name: d.name.trim() };
    const r = await billCall('order', body);
    toast('신청했어요. 계좌로 이체해 주세요');
    S.draft = { label: '', name: '', plan: 'album', months: 1, album: '' }; saveDraft(); S.labelOk = null;
    await loadInfo(); paint();
    setTimeout(() => $('#order-' + r.order.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }) });
  orderBtnRef = btn;

  const cards = [];
  if (owner) {
    cards.push(h('article', { class: 'card' }, h('h3', { text: albums.length > 1 ? '연장할 앨범' : '내 추억앨범' }),
      albums.length > 1 ? segOf(albums.map((a) => [a.id, a.name || hostText(a.host)]), album.id, (v) => { d.album = v; saveDraft(); paint(); }) : null,
      albumMini(album)));
  } else if (pendingNew) {
    parts.push(stepper([true, true, true, true, false]),
      h('article', { class: 'card' }, h('p', { class: 'notice', text: `${pendingNew.newAlbum.label}.${SUFFIX} 신청이 확인을 기다리고 있어요. 다른 주소로 새로 신청하려면 그 신청을 먼저 취소해 주세요.` })));
    parts.push(munchkinOnly(info));
    return h('section', { class: 'sect narrow' }, parts);
  } else {
    // 2. 주소 이름 · 3. 앨범 이름
    const out = statusEl();
    const labelIn = input('a-label', { maxlength: '15', value: d.label, placeholder: '예: 밤톨', autocapitalize: 'none', spellcheck: 'false', autocomplete: 'off', inputmode: 'text' });
    labelIn.addEventListener('input', (e) => { if (!e.isComposing) checkLabel(labelIn.value, out); });
    labelIn.addEventListener('compositionend', () => checkLabel(labelIn.value, out));
    cards.push(
      h('article', { class: 'card' }, h('h3', { text: '2. 주소 이름' }),
        h('p', { class: 'lead-s', text: '내 앨범 주소가 돼요. 한글도 돼요.' }),
        h('div', { class: 'addr' }, h('span', { class: 'addr-pre', text: 'https://' }), labelIn, h('span', { class: 'addr-suf', text: '.' + SUFFIX })),
        out,
        h('p', { class: 'hint', text: '한글·영어 소문자·숫자로 1~15자, - 는 가운데에만. 앨범이 만들어진 뒤에는 바꾸기 어려워요.' })),
      h('article', { class: 'card' }, h('h3', { text: '3. 앨범 이름' }),
        field('a-name', '앨범 이름', nameIn, `사이트 맨 위와 링크 미리 보기에 보여요. 비우면 "${me.nickname} 추억앨범"`)));
    if (d.label) setTimeout(() => checkLabel(d.label, out), 0);
  }
  // 4. 기간
  cards.push(h('article', { class: 'card' }, h('h3', { text: owner ? '기간' : '4. 이용권·기간' }),
    segOf(plans, d.plan, (v) => { d.plan = v; saveDraft(); paint(); }),
    quote ? h('p', { class: 'small', text: `${d.plan === 'add-album' ? '쓰고 있는 먼치킨' : '추억앨범'}이 끝나는 ${dayText(quote.until)}까지 함께 써요(${quote.days}일 · 한 달 ${won(quote.perMonth)} 기준).` })
      : segOf([[1, '1개월'], [3, '3개월'], [6, '6개월'], [12, '1년']], d.months, (v) => { d.months = v; saveDraft(); paint(); }),
    h('p', { class: 'amount', text: won(amount) }),
    !quote && d.months === 12 && full > amount ? h('p', { class: 'small good', text: `한 달씩보다 ${won(full - amount)} 아껴요 (한 달 ${won(Math.round(amount / 12))}꼴)` }) : null,
    d.plan === 'bundle' ? h('p', { class: 'hint', text: '먼치킨(봇 프로그램) 이용권도 같은 기간만큼 함께 늘어나요.' }) : null,
    amount > 0 ? null : h('p', { class: 'hint', text: '이 이용권은 아직 준비 중이에요.' })));
  // 5. 입금
  cards.push(h('article', { class: 'card' }, h('h3', { text: owner ? '신청' : '5. 신청하고 이체하기' }),
    h('p', { class: 'lead-s', text: `신청하면 계좌와 입금자명이 나와요. 이체한 뒤 "입금했어요"를 누르면 돼요. ${wantAlbum ? WAIT_ALBUM : WAIT_PLAN}` }),
    st, btn));
  stepperDone = () => [true, Boolean(S.labelOk), Boolean(S.labelOk) && nameOk(), Boolean(S.labelOk) && amount > 0, false];
  stepperRef = owner ? null : stepper(stepperDone());
  parts.push(stepperRef, ...cards, munchkinOnly(info));
  setTimeout(refreshOrderBtn, 0);
  return h('section', { class: 'sect narrow' }, parts);
}
// 먼치킨 이용권만(접어 둠)
function munchkinOnly(info) {
  if (!(info.prices?.munchkin > 0)) return null;
  // 무료 기간(2026-12-31 까지 — 서버 munchkinFrom): 신청 단추 없이 안내만(서버도 받지 않는다)
  const from = Number(info.munchkinFrom) || Date.parse('2027-01-01T00:00:00+09:00');
  if (Date.now() < from) return h('details', { class: 'card more' }, h('summary', { text: '먼치킨(봇 프로그램)만 쓰고 싶어요' }),
    h('p', { class: 'lead-s', text: '먼치킨은 2026년 12월 31일까지 무료예요. 지금은 신청하지 않아도 돼요.' }),
    h('p', { class: 'muted small', text: `먼치킨을 설치하고 먼치킨 계정으로 로그인하면 바로 쓸 수 있어요. 2027년 1월부터 먼치킨 이용권(월 ${won(info.prices.munchkin)})을 여기서 신청해요.` }),
    h('a', { class: 'btn line block', href: '../', text: '먼치킨 받으러 가기' }));
  let months = 1;
  const amt = h('p', { class: 'amount small-amount' });
  const st = statusEl();
  const price = (m) => (m === 12 ? info.year?.munchkin : info.prices.munchkin * m);
  const seg = h('div');
  const paintSeg = () => { seg.replaceChildren(segOf([[1, '1개월'], [3, '3개월'], [6, '6개월'], [12, '1년']], months, (v) => { months = v; paintSeg(); })); amt.textContent = won(price(months)); };
  paintSeg();
  const btn = h('button', { class: 'btn line block', type: 'button', text: '먼치킨 이용권 신청하기', onclick: () => busy(btn, st, async () => {
    const r = await billCall('order', { plan: 'munchkin', months });
    toast('신청했어요. 계좌로 이체해 주세요'); await loadInfo(); paint();
    setTimeout(() => $('#order-' + r.order.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }) });
  return h('details', { class: 'card more' }, h('summary', { text: '먼치킨(봇 프로그램) 이용권만 신청할래요' }),
    h('p', { class: 'lead-s', text: '추억앨범 없이 먼치킨만 쓸 때예요.' }), seg, amt, st, btn);
}

// 내 정보
function meView() {
  const m = S.me || {};
  const info = S.info;
  if (!info) ensureInfo();
  const ents = info?.ents || {};
  const until = (k) => (ents[k] > Date.now() ? h('b', { text: `${dayText(ents[k])}까지` }) : h('span', { class: 'muted', text: '없음' }));
  const albums = info?.albums || [];
  const orders = info?.orders || [];
  return h('section', { class: 'sect narrow' },
    sectionHead('내 정보', `${m.nickname || '먼치킨'}님`, '먼치킨 계정 하나로 먼치킨 프로그램과 모든 추억앨범을 써요.'),
    S.banned ? h('p', { class: 'notice bad', text: '이용이 막힌 계정이에요.' }) : null,
    h('article', { class: 'card' }, h('h3', { text: '계정' }),
      h('dl', { class: 'kv' },
        kvRow('닉네임', m.nickname ? h('b', { text: m.nickname }) : h('span', { class: 'muted', text: '아직 안 정했어요' })),
        kvRow('로그인', m.loginId ? `아이디 ${m.loginId}` : m.kakao ? '카카오' : '—'),
        kvRow('본인인증', m.verified ? h('span', { class: 'good' }, icon('check'), '했어요') : h('span', { class: 'muted', text: '아직 — 신청할 때 해요' }))),
      h('div', { class: 'row-btns wrap-btns' },
        h('button', { class: 'btn line small', type: 'button', text: m.nickname ? '닉네임 바꾸기' : '닉네임 정하기', onclick: () => openSheet('nickname', {}) }),
        m.loginId ? h('button', { class: 'btn line small', type: 'button', text: '비밀번호 바꾸기', onclick: () => openSheet('password') }) : null,
        h('button', { class: 'btn line small', type: 'button', onclick: async () => {
          if (!confirm('로그아웃할까요?\n이 계정으로 로그인한 모든 곳(다른 추억앨범·먼치킨 프로그램)에서 함께 로그아웃돼요.')) return;
          await logoutAll(); S.view = 'home'; paint(); toast('로그아웃했어요');
        } }, icon('out'), '로그아웃'))),
    h('article', { class: 'card' }, h('h3', { text: '내 추억앨범' }),
      !info ? h('p', { class: 'muted', text: S.infoError || '불러오는 중이에요…' })
        : albums.length ? albums.map((a) => {
          const left = leftOf(a);
          return h('div', { class: 'my-album' },
            h('div', { class: 'my-album-top' }, h('b', { text: a.name || '내 추억앨범' }), h('span', { class: 'chip' + (left.bad ? ' bad' : ''), text: left.text })),
            h('p', { class: 'mono addr-line', text: hostText(a.host) }),
            h('div', { class: 'row-btns' },
              a.site ? h('a', { class: 'btn line small', href: a.site, target: '_blank', rel: 'noopener' }, icon('link'), '앨범 열기') : null,
              h('button', { class: 'btn main small', type: 'button', text: '연장하기', onclick: () => { S.draft.album = a.id; saveDraft(); go('apply'); } })));
        })
        : orders.find((o) => o.state === 'pending' && o.newAlbum)
          ? [h('p', { class: 'muted', text: `${orders.find((o) => o.state === 'pending' && o.newAlbum).newAlbum.label}.${SUFFIX} 신청이 확인을 기다리고 있어요. ${WAIT_ALBUM}` }), h('button', { class: 'btn line block', type: 'button', text: '입금 안내 보기', onclick: () => go('apply') })]
          : albumBeta()
            ? [h('p', { class: 'muted', text: '아직 추억앨범이 없어요. ' + BETA_TEXT }), previewBtn('btn main block')]
            : [h('p', { class: 'muted', text: '아직 추억앨범이 없어요.' }), h('button', { class: 'btn main block', type: 'button', text: '추억앨범 신청하기', onclick: () => go('apply') })]),
    h('article', { class: 'card' }, h('h3', { text: '이용권' }),
      h('dl', { class: 'kv' }, kvRow('먼치킨', until('munchkin')), kvRow('추억앨범', until('album')))),
    h('article', { class: 'card' }, h('h3', { text: '내 신청' }),
      !info ? h('p', { class: 'muted', text: '불러오는 중이에요…' })
        : orders.length ? h('ul', { class: 'orders' }, orders.slice(0, 10).map((o) => h('li', null,
          h('span', null, `${PLAN_NAME[o.plan] || o.plan} ${planPeriod(o)} · ${won(o.amount)}`, o.newAlbum ? h('small', { text: ` · ${o.newAlbum.label}.${SUFFIX}` }) : null),
          o.state === 'pending' ? h('button', { class: 'link-btn', type: 'button', text: o.sent ? '확인 기다리는 중' : '입금 안내 보기', onclick: () => go('apply') })
            : h('span', { class: o.state === 'paid' ? 'good' : 'muted', text: (PLAN_STATE[o.state] || o.state) + (o.note ? ` (${o.note})` : '') }))))
          : h('p', { class: 'muted', text: '아직 신청한 것이 없어요.' })),
    h('p', { class: 'muted small center' }, '탈퇴는 추억앨범 사이트의 내 정보에서 할 수 있어요.'));
}

// 먼치킨 프로그램 카카오 로그인 승인(?app=)
function appView() {
  if (S.appDone === 'ok') return h('section', { class: 'sect narrow' }, h('article', { class: 'card app-card' },
    h('div', { class: 'app-ico ok' }, icon('check')),
    h('h2', { text: '로그인했어요!' }),
    h('p', { class: 'lead-s', text: '먼치킨 프로그램으로 돌아가세요. 몇 초 안에 저절로 로그인돼요. 이 창은 닫아도 돼요.' }),
    h('button', { class: 'btn line block', type: 'button', text: '추억앨범 둘러보기', onclick: () => { S.appDone = ''; go('home'); } })));
  if (S.appDone) return h('section', { class: 'sect narrow' }, h('article', { class: 'card app-card' },
    h('div', { class: 'app-ico bad' }, icon('close')),
    h('h2', { text: '로그인하지 못했어요' }),
    h('p', { class: 'status bad', text: S.appDone }),
    h('p', { class: 'lead-s', text: '먼치킨 프로그램에서 [카카오로 로그인]을 다시 눌러 주세요.' }),
    h('button', { class: 'btn line block', type: 'button', text: '첫 화면으로', onclick: () => { S.appDone = ''; S.app = ''; go('home'); } })));
  if (!S.session) return h('section', { class: 'sect narrow' }, h('article', { class: 'card app-card' },
    h('div', { class: 'app-ico' }, icon('monitor')),
    h('h2', { text: '먼치킨 프로그램 로그인' }),
    h('p', { class: 'lead-s', text: '먼저 여기서 먼치킨 계정으로 로그인해 주세요.' }),
    h('button', { class: 'btn main block', type: 'button', text: '로그인하기', onclick: () => openSheet('login') })));
  const m = S.me || {};
  const st = statusEl();
  const yes = h('button', { class: 'btn main block big', type: 'button', text: '로그인', onclick: () => busy(yes, st, async () => {
    try { await memberCall('app-approve', { id: S.app }); S.appDone = 'ok'; }
    catch (e) { if (e.status === 401) { openSheet('login'); return; } S.appDone = e.message; }
    S.app = '';
    try { history.replaceState(null, '', location.pathname); } catch { /* 그대로 */ }
    paint();
  }) });
  return h('section', { class: 'sect narrow' }, h('article', { class: 'card app-card' },
    h('div', { class: 'app-ico' }, icon('monitor')),
    h('h2', { text: '먼치킨 프로그램에서 로그인할까요?' }),
    h('p', { class: 'who' }, icon('user'), h('b', { text: m.nickname || '닉네임 없음' }), h('span', { class: 'muted', text: m.loginId ? ` · 아이디 ${m.loginId}` : m.kakao ? ' · 카카오' : '' })),
    h('p', { class: 'lead-s', text: '지금 이 PC에서 먼치킨을 켜고 [카카오로 로그인]을 눌렀다면 아래 [로그인]을 눌러 주세요.' }),
    h('p', { class: 'notice warn', text: '내가 시작한 로그인이 아니면 누르지 마세요. 누르면 그 프로그램이 내 계정으로 로그인돼요.' }),
    st, yes,
    h('div', { class: 'links' },
      linkBtn('다른 계정으로 로그인', () => { dropSession(); paint(); openSheet('login'); }),
      h('span', { class: 'sep', 'aria-hidden': 'true' }),
      linkBtn('그만두기', () => { S.app = ''; try { history.replaceState(null, '', location.pathname); } catch { /* 그대로 */ } go('home'); }))));
}

// ---------- 시작 ----------
async function start() {
  if (S.app) S.view = 'app';
  paint();
  const cfg = loadMembersConfig();
  // 카카오·먼치킨 프로그램이 넘겨 준 로그인 표
  if (RETURN.ticket) {
    try {
      const r = await memberCall('ticket', { ticket: RETURN.ticket });
      setSession(r.session, r.member);
      ls.set('mk_sso_at', String(Date.now()));   // 카카오 로그인은 서버 쿠키를 이미 심었다
    } catch (e) { toast(e.message, true); }
  } else if (S.session) await loadMe();
  await cfg;
  if (RETURN.sso === 'ok') ls.set('mk_sso_at', String(Date.now()));
  const back = ss.get('mk_after_sso'); ss.del('mk_after_sso');
  if (!S.session && !RETURN.ticket && !RETURN.loginError) await trySso();
  paint();

  if (RETURN.loginError) {
    toast(KAKAO_ERRORS[RETURN.loginError] || KAKAO_ERRORS.fail, RETURN.loginError !== 'cancel');
    if (RETURN.loginError === 'sso-none') openSheet('login');
    return;
  }
  // 휴대폰 본인인증에서 돌아옴
  const v = RETURN.verify;
  if (v) {
    if (v.savedId && v.id && v.savedId !== v.id) { toast('본인인증을 처음부터 다시 해 주세요.', true); return; }
    if (v.mode === 'find') { openSheet('find', v.code ? { error: v.message || '본인인증을 마치지 못했어요. 다시 해 주세요.' } : { pendingId: v.id }); return; }
    if (!S.session) { toast('로그인이 풀렸어요. 다시 로그인한 뒤 본인인증을 해 주세요.', true); S.next = 'apply'; openSheet('login'); return; }
    go('apply');
    if (v.code) { S.verifyNote = { text: v.message || '본인인증을 마치지 못했어요. 다시 해 주세요.', bad: true }; paint(); return; }
    if (!v.id) { toast('본인인증 결과를 받지 못했어요. 다시 해 주세요.', true); return; }
    await finishVerify(v.id);
    return;
  }
  if (S.app) {
    if (!S.session) { openSheet('login'); return; }
    if (RETURN.ticket && S.me && !S.me.nickname) { /* 프로그램 로그인 중에는 닉네임을 묻지 않는다 */ }
    go('app');
    return;
  }
  const want = RETURN.go || ss.get('mk_next') || back || '';
  if (want === 'find') { openSheet('find'); return; }
  if (want === 'apply' || want === 'me') {
    ss.del('mk_next');
    if (!S.session) { S.next = want; openSheet('login'); return; }
    if (RETURN.ticket && S.me && !S.me.nickname) { S.next = want; openSheet('nickname', { join: true }); return; }
    go(want);
  } else if (RETURN.ticket && S.session) {
    // 카카오로 막 로그인함 — 닉네임이 없으면 먼저
    afterLogin('로그인했어요');
    return;
  }
  ssoRemember();
}
start();
