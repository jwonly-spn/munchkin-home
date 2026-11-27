// 먼치킨.com/album — 먼치킨 계정 가입·로그인 · 추억앨범 신청(주소 이름·앨범 이름·기간·계좌이체) · 내 정보.
// 계정은 하나: 먼치킨 계정 = 추억앨범 계정(서버 bakje 회원 — 모든 DJ 앨범 공통). 먼치킨 프로그램(봇·송출)도 이 계정으로 로그인한다.
// 서버: bakje(회원·카카오·앨범 사이 로그인 이어 주기) · bakje-billing(이용권·추억앨범 신청). 로그인 표는 이 주소의 localStorage(mk_session)에만.
// 주소로 들어오는 것:
//  #bjlogin=<표>      카카오 로그인·먼치킨 프로그램(web-ticket)이 로그인된 채 열 때 → 표를 세션으로 바꾼다
//  #go=apply|me|find  그 화면으로(프로그램의 [신청하기]·[내 정보 관리]·[아이디·비밀번호 찾기])
//  #go=beta           추억앨범 베타테스터 신청(2026-11-25 — 봇·송출 큰 창 [신청하기]가 #bjlogin=<표>&go=beta 로 연다 · 화면은 beta.js)
//                     2026-11-26 쉬운 신청: 짧은 주소 먼치킨.com/beta(docs/beta/index.html)가 여기로 넘긴다 · 로그인 창을 먼저 띄우지 않고 설명·3단계부터
//  #go=beta&preview=1 운영자(또는 이미 앨범이 있는 분)가 신청 화면 세 단계를 미리 본다(보내기는 안 됨 — 이 탭 sessionStorage mk_beta_preview)
//  ?app=<자리>        먼치킨 프로그램 카카오 로그인 — 여기서 로그인한 뒤 "먼치킨 프로그램에서 로그인할까요?" [로그인] → app-approve
//  ?app=<자리>&kakao=1  (2026-11-06 쉬운 로그인) 먼치킨이 띄운 카카오 로그인 창: 로그인이 안 돼 있으면 바로 카카오로 넘기고,
//                     로그인되면 묻지 않고 승인한다 — 단, 그 창의 preload 가 준 표시(window.munchkinLogin — inApp·같은 자리 번호)가 있을 때만.
//                     보통 브라우저에는 그 표시가 없어 예전처럼 묻는다(남이 보낸 ?app= 링크로 내 계정이 남의 프로그램에 로그인되지 않게).
// 회원 흐름은 추억앨범 사이트(박제관 docs/app.js)와 같게. 2026-11-18 휴대폰 본인인증을 뺐다(사용자 결정) —
//  로그인(아이디·비밀번호 또는 카카오)만으로 신청. 만 14세는 가입할 때 체크로 받는다(아이디 가입 age14 · 카카오 첫 가입 kakao-start a=1).

const SB = 'https://aksegkhhugqvvaidgvro.supabase.co';
const KEY = 'sb_publishable_45cIqG4dGLSlev-rmNiVDg_uG8szVzD';
const API = SB + '/functions/v1/bakje/';
const BILL = SB + '/functions/v1/bakje-billing';
const BETA_FN = SB + '/functions/v1/bakje-beta';
const TERMS = 'https://xn--hu5bi2af5y.com/terms.html';
const PRIVACY = 'https://xn--hu5bi2af5y.com/privacy.html';
const SUFFIX = '먼치킨.com';
const APP_RE = /^app-[a-z2-9]{20}$/;
const TICKET_RE = /^[-_A-Za-z0-9]{43}$/;
const LOGIN_ID_RE = /^[a-z0-9_]{4,20}$/;
const LABEL_RE = /^[가-힣a-z0-9](?:[가-힣a-z0-9-]{0,13}[가-힣a-z0-9])?$/;
const NO_SESSION = new Set(['signup', 'login', 'ticket']);
const PLAN_NAME = { munchkin: '먼치킨', album: '추억앨범', bundle: '먼치킨 + 추억앨범', 'add-album': '추억앨범 추가', 'add-munchkin': '먼치킨 추가' };
const PLAN_STATE = { paid: '확인됐어요', rejected: '거절됐어요', canceled: '취소했어요', pending: '확인 기다리는 중', test: '테스트 결제(실제 결제 아님)' };
// 카드 결제(2026-11-23, 포트원 V2 → KG이니시스 결제창): 서버 info.card = {show, canPay, mode, storeId, channelKey}.
//  show = 모두에게 [카드로 결제]를 보임 · canPay = 실제로 결제창을 열 수 있음(테스트 채널 동안은 심사 계정·운영자만 — 서버가 정함). 아니면 단추를 끄고 CARD_CLOSED.
//  카드 번호는 KG 결제창이 받는다. 결제하는 분 이름·휴대폰·이메일은 결제창으로만 넘기고 어디에도 저장하지 않는다(PAYER — 이 페이지의 메모리에만).
const PORTONE_SDK = 'https://cdn.portone.io/v2/browser-sdk.esm.js';
const CARD_TEST = '🧪 테스트 결제예요 — 실제로 돈이 나가지 않고 이용권도 생기지 않아요';
const CARD_CLOSED = '카드 결제는 KG이니시스 심사가 끝나면 열려요. 지금은 계좌이체로 결제할 수 있어요.';
const CARD_WAIT = '카드 결제를 아직 마치지 않았어요.';
const CARD_FAIL = '결제를 마치지 못했어요. 다시 결제하거나 신청을 취소해 주세요.';
const CARD_CHECK = '결제를 확인하고 있어요. 잠시 뒤 [결제 다시 확인]을 눌러 주세요.';
// 이용권·결제 화면 맨 위 띠(2026-11-23 사용자 글 그대로) — 유료가 시작되는 때(2027-01-01 0시 한국, 서버 munchkinPaidFrom 이 있으면 그 값) 뒤엔 안 보인다
const PAID_FROM = Date.parse('2027-01-01T00:00:00+09:00');
const PAID_BANNER = '유료화는 1월 1일부터이며, 이전에 결제한 내역은 자동으로 1월 1일부터 사용됩니다.';
const KAKAO_ERRORS = {
  cancel: '카카오 로그인을 그만뒀어요.',
  fail: '카카오 로그인을 하지 못했어요. 다시 해 주세요.',
  banned: '이용이 막힌 계정이에요.',
  setup: '카카오 로그인 준비 중이에요.',
  'sso-none': '다른 추억앨범에서 로그인한 기록이 없어요. 여기서 로그인해 주세요.',
  // 처음 카카오로 가입하는데 만 14세 체크 없이 왔을 때(서버 kakao — 계정은 만들지 않았다)
  age14: '처음 가입하는 카카오 계정이에요. "만 14세 이상이에요"에 체크한 뒤 카카오 단추를 다시 눌러 주세요.'
};
const AGE14_NEED = '"만 14세 이상이에요"에 체크해 주세요.';
const WAIT_ALBUM = '운영자가 입금을 확인하면 앨범이 만들어져요(최대 24시간).';
const WAIT_PLAN = '운영자가 입금을 확인하면 이용 기간이 늘어나요(최대 24시간).';
const SSO_FRESH_MS = 50 * 86400000;
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
// 먼치킨.com 첫 페이지에 붙을 때(2026-11-23 사용자 "메인 화면에서도 결제 창 볼 수 있게, 회원가입 로그인도"): #app 대신 머리줄(#mk-auth)과 이용권 칸(#mk-pay)만 그린다.
//  같은 주소(먼치킨.com)라 로그인 표(localStorage mk_session)를 그대로 같이 쓴다. 신청 화면·내 정보는 album/ 로 넘어간다.
const HOME = !document.getElementById('app') && Boolean(document.getElementById('mk-pay'));
const ALBUM_URL = HOME ? 'album/' : './';
const BETA_PAGE = HOME ? 'beta/' : '../beta/';   // 짧은 주소 먼치킨.com/beta(→ album/#go=beta)
// 처음 HTML 의 가격 글(첫 페이지 #mk-pay · 추억앨범 #app) — 서버 가격을 아직 못 받았거나 못 받으면 이것을 그대로 보인다(첫 그리기 전에 떠 둔다)
const STATIC_PRICES = (() => { const ul = document.querySelector('#mk-pay ul, #app .boot-prices ul'); return ul ? ul.cloneNode(true) : null; })();

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
  const out = { ticket: '', loginError: '', sso: '', go: '', app: '', kakao: false, pay: null, plan: '', months: 0, preview: false };
  try {
    const hp = new URLSearchParams(location.hash.slice(1));
    if (TICKET_RE.test(hp.get('bjlogin') || '')) out.ticket = hp.get('bjlogin');
    if (/^[-a-z0-9]{1,20}$/.test(hp.get('bjlogin-error') || '')) out.loginError = hp.get('bjlogin-error');   // age14 처럼 숫자도
    if (/^[a-z]{1,10}$/.test(hp.get('bjsso') || '')) out.sso = hp.get('bjsso');
    if (['apply', 'me', 'find', 'beta'].includes(hp.get('go'))) out.go = hp.get('go');
    if (['munchkin', 'album', 'bundle'].includes(hp.get('plan'))) out.plan = hp.get('plan');   // #go=apply&plan=munchkin — 3번 칸에서 미리 고를 이용권
    if (['1', '12'].includes(hp.get('months'))) out.months = Number(hp.get('months'));          // &months=1|12 — 첫 화면에서 고른 기간
    out.preview = out.go === 'beta' && hp.get('preview') === '1';                             // #go=beta&preview=1 — 베타 신청 화면 미리 보기
    const q = new URLSearchParams(location.search);
    if (!out.go && q.get('go') === 'beta') { out.go = 'beta'; out.goBack = true; }          // 카카오에서 돌아옴(?go=beta — kakaoLogin 이 돌아올 주소에 실음, 2026-11-27) · 미리 보기는 그대로
    if (APP_RE.test(q.get('app') || '')) out.app = q.get('app');
    out.kakao = Boolean(out.app) && q.get('kakao') === '1';
    // 휴대폰 카드 결제에서 돌아옴: ?pay=<신청 번호>(서버 redirectUrl) + 포트원이 붙인 paymentId·code·message — 주소를 지우기 전에 떼어 둔다
    const pay = q.get('pay') || '';
    if (/^o[a-z0-9]{11}$/.test(pay) && (!q.get('paymentId') || q.get('paymentId') === 'mk-' + pay)) out.pay = { id: pay, code: q.get('code') || '', message: q.get('message') || '' };
  } catch { /* 이상한 주소 — 그냥 첫 화면 */ }
  if (HOME) {
    if (out.ticket || out.loginError || out.sso) { try { history.replaceState(null, '', location.pathname + location.search); } catch { /* 그대로 */ } }
    return { ...out, go: '', app: '', kakao: false, pay: null, plan: '', months: 0, preview: false };
  }
  try { history.replaceState(null, '', location.pathname + (out.app ? '?app=' + out.app : '')); } catch { /* 그대로 */ }
  return out;
})();

// ---------- 상태 ----------
const S = {
  session: ls.get('mk_session') || '',
  me: parse(ls.get('mk_me')),
  members: null,                 // members-config: {password, kakao}
  info: null, infoAt: 0, infoError: '',
  view: RETURN.go === 'beta' && !RETURN.app ? 'beta' : 'home',   // 베타 신청 주소면 첫 그림부터 베타(2026-11-27 — 상품 화면이 먼저 보였다가 바뀌던 것)
  app: RETURN.app,               // 먼치킨 프로그램 카카오 로그인 자리
  appDone: '',                   // 'ok' · 오류 글
  appAge: false,                 // 먼치킨 안의 카카오 창: 처음 가입이라 "만 14세 이상이에요" 체크가 필요함(서버 #bjlogin-error=age14)
  next: null,                    // 로그인한 뒤 갈 화면
  draft: { label: '', name: '', plan: 'album', months: 1, album: '', ...(parse(ss.get('mk_draft')) || {}) },
  labelOk: null,                 // {label, host} — album-name 이 쓸 수 있다고 한 것
  pub: null,                     // 로그인 전 이용권·가격(세션 없이 묻는 prices — 서버가 주면) · 못 받으면 {failed: true}
  payDone: null,                 // 카드 결제 결과 {state: checking·paid·test, order}
  payNote: null,                 // 결제 안 끝난 카드 신청에 보일 글 {id, text, bad}
  betaPub: null,                 // 베타테스터 모집 띠: 공개 status {open, seats, left} · 못 받으면 {open: false}
  // 베타 신청 미리 보기: 주소에 preview=1 → 이 탭 동안 기억(카카오에서 돌아와도) · 미리 보기 없이 #go=beta 로 오면 끔
  betaPreview: RETURN.preview || ((RETURN.go !== 'beta' || RETURN.goBack === true) && ss.get('mk_beta_preview') === '1')
};
if (RETURN.preview) ss.set('mk_beta_preview', '1'); else if (RETURN.go === 'beta' && RETURN.goBack !== true) ss.del('mk_beta_preview');
// 결제하는 분(카드 결제창에 넘김) — 저장하지 않는다(localStorage·sessionStorage 에도 안 씀). 화면을 다시 그려도 쓴 글이 남게 메모리에만.
const PAYER = { name: '', phone: '', email: '' };
if (RETURN.plan) S.draft.plan = RETURN.plan;
if (RETURN.months) S.draft.months = RETURN.months;
if (!TICKET_RE.test(S.session)) { S.session = ''; S.me = null; }
const saveDraft = () => ss.set('mk_draft', JSON.stringify(S.draft));

// 먼치킨 프로그램이 띄운 카카오 로그인 창인가(2026-11-06): 그 창의 preload 만 window.munchkinLogin 을 준다(보통 브라우저·다른 사이트는 못 만든다 —
//  페이지 글은 contextBridge 로 준 이 값을 바꿀 수 없다). 주소의 ?app= 과 그 창을 열 때 정한 자리 번호가 같을 때만 "창 안"으로 본다.
const IN_APP = (() => {
  try { const m = window.munchkinLogin; return m && m.inApp === true && typeof m.app === 'string' && APP_RE.test(m.app) ? m : null; } catch { return null; }
})();
const inApp = () => Boolean(IN_APP && S.app && S.app === IN_APP.app);
if (inApp()) { S.view = 'app'; S.appDone = 'wait'; document.documentElement.classList.add('in-app'); }

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
  right: '<path d="M9 5l7 7-7 7"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
  out: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H4"/>',
  ext: '<path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
  pin: '<path d="M9 4h6l-1 6 3 3v1.5H7V13l3-3-1-6zM12 14.5V21"/>',
  shield: '<path d="M12 3.5l7 3v5.2c0 4.3-3 7.6-7 8.8-4-1.2-7-4.5-7-8.8V6.5l7-3z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  album: '<rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="M3.5 15l4.5-4 3.5 3 3-2.5 6 5"/><circle cx="15.5" cy="8.5" r="1.6"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>',
  heart: '<path d="M12 20.3s-7.4-4.5-9.2-9.1C1.5 7.9 3.5 4.6 7 4.6c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.5 0 5.5 3.3 4.2 6.6-1.8 4.6-9.2 9.1-9.2 9.1z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M8.5 20h7M12 16v4"/>',
  spin: '<path d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5"/>'
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
async function memberCall(action, body = {}) {
  const auth = !NO_SESSION.has(action);
  try { return await call('member', { method: 'POST', body: { action, ...body }, session: auth, base: API }); }
  catch (e) { if (auth && e.status === 401) dropSession(); throw e; }
}
async function billCall(action, body = {}) {
  try { return await call('', { method: 'POST', body: { action, ...body }, session: true, base: BILL }); }
  catch (e) { if (e.status === 401) dropSession(); throw e; }
}
async function loadMembersConfig() {
  try {
    const m = (await call('members-config')).members;
    S.members = { password: m?.password !== false, kakao: m?.kakao === true };
  } catch { S.members = { password: true, kakao: false, failed: true }; }
}
async function loadInfo() {
  S.info = await billCall('info');
  S.infoAt = Date.now(); S.infoError = '';
  return S.info;
}
// 로그인 전 신청 화면: 세션 없이 prices 를 물어 이용권·가격·위 띠 시각을 받는다(화면에 가격을 따로 적지 않는다 — 못 받으면 로그인하라는 안내만)
//  답: {open, prices, year, months, albumOpen, munchkinPaidFrom, now, card}
let pubJob = null;
function ensurePub() {
  if (S.session || S.pub || pubJob) return;
  pubJob = call('', { method: 'POST', body: { action: 'prices' }, base: BILL })
    .then((r) => { S.pub = r?.prices ? r : { failed: true }; })
    .catch(() => { S.pub = { failed: true }; })
    .finally(() => { pubJob = null; paint(); });
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
  if (!S.session || S.app || S.view === 'apply' || S.view === 'beta' || $('dialog[open]')) return;
  if (Date.now() - Number(ls.get('mk_sso_at') || 0) < SSO_FRESH_MS) return;
  try {
    const r = await fetch(API + 'sso-check?' + new URLSearchParams({ h: location.host, peek: '1' }), { credentials: 'include', cache: 'no-store' }).then((x) => x.json());
    if (r?.has) { ls.set('mk_sso_at', String(Date.now())); return; }
    if (!r?.ok) return;
    const t = await memberCall('sso-ticket');
    ss.set('mk_after_sso', HOME ? 'pay' : S.view);
    location.href = API + 'sso-set?' + new URLSearchParams({ t: t.ticket, h: location.host, r: location.pathname });
  } catch { /* 다음에 다시 */ }
}
function ssoContinue() {
  if (S.next) ss.set('mk_next', S.next);
  location.href = API + 'sso?' + new URLSearchParams({ h: location.host, r: location.pathname + location.search });
}
// age14: 가입 화면에서 "만 14세 이상이에요"에 체크함(a=1) — 서버는 처음 카카오로 가입할 때만 본다(없으면 #bjlogin-error=age14)
//  베타 신청으로 가던 중이면 돌아올 주소에 ?go=beta 를 싣는다 — 이 탭 기억(mk_next)은 카카오에서 다른 탭·브라우저로 돌아오면 잃는다(2026-11-27)
function kakaoLogin(age14 = false) {
  if (S.next) ss.set('mk_next', S.next);
  const beta = !inApp() && (S.next === 'beta' || (!S.next && S.view === 'beta'));
  location.href = API + 'kakao-start?' + new URLSearchParams({ apikey: KEY, h: location.host, r: location.pathname + (beta ? '?go=beta' : location.search), ...(age14 ? { a: '1' } : {}) });
}

// 먼치킨 안의 카카오 로그인 창: 로그인돼 있으면 묻지 않고 승인한다(그 창을 연 프로그램의 자리 번호만 — inApp()).
//  승인하면 창에 알리고(approved — 프로그램이 바로 받아 가고 창을 닫는다) "로그인했어요"를 보인다. 세션이 끝났으면 카카오로 다시.
let approving = false;
async function autoApprove() {
  if (!inApp() || approving) return;
  if (!S.session) { S.appDone = ''; S.view = 'app'; paint(); return; }
  approving = true; S.appDone = 'wait'; S.view = 'app'; paint();
  try {
    await memberCall('app-approve', { id: S.app });
    S.appDone = 'ok';
    try { IN_APP.approved?.(); } catch { /* 프로그램이 2초마다 묻는다 */ }
  } catch (e) { S.appDone = e.status === 401 ? '' : e.message; }
  finally { approving = false; }
  paint();
}
// 창 안에서 카카오로(한 번만 저절로 — 그 뒤에는 단추로). age14: 처음 가입이라 만 14세 체크를 하고 다시 갈 때
function inAppKakao(age14 = false) { ss.set('mk_app_kakao:' + S.app, '1'); kakaoLogin(age14); }

// 로그인을 마친 뒤: 프로그램 로그인 승인 → 가려던 화면 → (닉네임이 없으면 먼저 닉네임)
function afterLogin(message) {
  if (message) toast(message);
  closeSheet();
  if (inApp()) { autoApprove(); return; }
  if (S.app) { go('app'); return; }
  // 베타 신청 길에서는 닉네임 창을 건너뛴다(스푼 닉네임은 신청 3단계에서 받음 — 2026-11-27, 처음 온 분이 창 두 개에 멈추던 것)
  if (S.me && !S.me.nickname && (S.next || ss.get('mk_next')) !== 'beta') { openSheet('nickname', { join: true }); return; }
  continueNext();
}
function continueNext() {
  const n = S.next || ss.get('mk_next');
  S.next = null; ss.del('mk_next');
  if (n === 'apply' || n === 'me' || n === 'beta') go(n);
  else paint();
  ssoRemember();
}
// 로그인이 필요한 화면은 로그인부터
function go(view) {
  if (HOME) {
    if (view === 'apply' || view === 'me' || view === 'beta') location.href = ALBUM_URL + '#go=' + view + (view === 'apply' ? `&plan=${S.draft.plan}&months=${S.draft.months}` : '');
    else paint();
    return;
  }
  // 먼치킨 안의 창은 로그인 화면(app) 밖으로 가지 않는다
  if (inApp()) { S.view = 'app'; paint(); return; }
  // 신청 화면은 로그인 전에도 연다(위 띠·이용권·가격 — 신청·결제는 로그인한 뒤, 2026-11-23)
  if (view === 'apply' && !S.session) {
    S.view = 'apply'; S.payDone = null; S.payNote = null;
    ensurePub();
    paint();
    window.scrollTo({ top: 0 });
    return;
  }
  // 베타테스터 신청도 로그인 전에 연다(설명·3단계부터 — 로그인은 그 화면의 [카카오로 시작하기], 2026-11-26)
  if (view === 'beta' && !S.session) {
    S.view = 'beta';
    paint();
    window.scrollTo({ top: 0 });
    return;
  }
  if ((view === 'apply' || view === 'me' || view === 'app') && !S.session) {
    if (view !== 'app') S.next = view;
    S.view = view === 'app' ? 'app' : S.view;
    paint();
    openSheet('login');
    return;
  }
  S.view = view;
  if (view !== 'apply') { S.payDone = null; S.payNote = null; }
  if (view === 'apply' || view === 'me') ensureInfo(true);
  paint();
  window.scrollTo({ top: 0 });
}

// ---------- 창(로그인·가입·찾기·닉네임·비밀번호) ----------
let sheet = null;   // {d, box}
function openSheet(step, data = {}) {
  if (!sheet) {
    const box = h('div', { class: 'sheet-in' });
    const d = h('dialog', { class: 'sheet', 'aria-label': '먼치킨 계정' }, box);
    d.addEventListener('close', () => { d.remove(); if (sheet?.d === d) sheet = null; });
    // 바깥(어두운 곳)을 눌러도 닫지 않는다 — 가입하다 쓴 글이 날아가지 않게(2026-11-18 사용자 요청, 추억앨범 acct-sheet 의 sticky 와 같게). 닫기는 X 단추·Esc.
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
  breakSentences(sheet.box);
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
const kakaoButton = (text = '카카오 로그인', onclick = () => kakaoLogin()) => h('button', { class: 'kakao-btn', type: 'button', onclick }, kakaoSymbol(), h('span', { text }));
const orLine = (text = '또는') => h('p', { class: 'or' }, h('span', { text }));
// 가입할 때 "만 14세 이상이에요" 체크 칸(아이디 가입·카카오 첫 가입 둘 다 — 서버도 다시 본다)
function ageBox(id) {
  const box = h('input', { type: 'checkbox', id });
  const wrap = h('div', { class: 'agree' }, h('label', { class: 'check', for: id }, box, h('span', null, h('em', { text: '(필수)' }), ' 만 14세 이상이에요')));
  return { box, wrap };
}

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
        h('button', { class: 'link-btn sso-link', type: 'button', onclick: () => ssoContinue() }, '다른 DJ 앨범에서 이미 로그인했어요'),
        h('div', { class: 'links' }, linkBtn('회원가입', () => openSheet('signup')), h('span', { class: 'sep', 'aria-hidden': 'true' }), linkBtn('아이디·비밀번호 찾기', () => openSheet('find')))
      ]
    };
  },

  signup(x) {
    // 만 14세 체크는 맨 위 한 칸 — 카카오 가입과 아이디 가입 둘 다 이것을 본다
    const age = ageBox('s-age14');
    const kst = statusEl();
    if (x.kakaoAge) say(kst, KAKAO_ERRORS.age14, true);
    age.box.addEventListener('change', () => { if (age.box.checked) say(kst, ''); });
    const kakaoJoin = () => {
      if (!age.box.checked) { say(kst, AGE14_NEED, true); age.box.focus(); return; }
      kakaoLogin(true);
    };
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
      if (!age.box.checked) { say(st, AGE14_NEED, true); age.box.focus(); return; }
      if (!terms.checked || !privacy.checked) { say(st, '이용약관과 개인정보 수집·이용에 동의해 주세요.', true); return; }
      busy(btn, st, async () => {
        const r = await memberCall('signup', { loginId, password: pw.value, agree: true, age14: true, role: 'dj' });
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
      field('s-nick', '닉네임', nk, '한글·영문·숫자·_ 로 2~12자, 추억앨범 댓글에 보여요'),
      h('div', { class: 'agree' },
        h('label', { class: 'check agree-all', for: 'agree-all' }, all, h('span', { text: '모두 동의해요' })),
        agreeRow(terms, 'agree-terms', '이용약관에 동의해요', TERMS),
        agreeRow(privacy, 'agree-privacy', '개인정보 수집·이용에 동의해요', PRIVACY)),
      st, btn);
    return {
      title: '회원가입', back: 'login', focus: x.kakaoAge ? age.box : id,
      body: [
        h('p', { class: 'lead-s', text: '먼치킨 계정을 만들어요. 먼치킨 프로그램과 추억앨범에서 같이 써요.' }),
        age.wrap,
        S.members?.kakao ? [kakaoButton('카카오로 시작하기', kakaoJoin), kst, orLine('또는 아이디로 가입')] : kst,
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

  // 아이디·비밀번호 찾기(프로그램의 #go=find 도 여기로): 본인인증을 뺐으니(2026-11-18) 운영자에게 알려 주세요(카카오로 가입했다면 카카오 로그인)
  find() {
    return {
      title: '아이디·비밀번호 찾기', back: S.session ? null : 'login',
      body: [
        h('p', { class: 'lead-s' }, '아이디나 비밀번호를 잊었다면 운영자(', h('a', { href: 'mailto:likegorogoro@naver.com', text: 'likegorogoro@naver.com' }), ')에게 알려 주세요. 닉네임과 생각나는 아이디를 함께 적어 주세요.'),
        S.members?.kakao && !S.session ? [h('p', { class: 'hint', text: '카카오로 가입했다면 카카오 로그인을 눌러 주세요.' }), kakaoButton()] : null,
        h('div', { class: 'links' }, linkBtn('회원가입', () => openSheet('signup')))
      ]
    };
  }
};

// 줄바꿈(2026-11-23 사용자 "글들이 줄바꿈 없이 난해해 보여 — PC 에서도 모바일에서도 깔끔하게"): 문장이 둘 이상인 긴 문단은
//  문장마다 줄을 나눈다(글은 그대로 — <br class="br-s"> 만 넣는다). 첫 페이지 처음 HTML 도 같은 규칙으로 미리 나눠 두었다.
//  문단 40자 이상 · 한 덩어리 글 12자 이상(링크 앞 문장 끝에서도 나눔) · 앞 문장이 3자 이하("네.")면 안 나눔 · 링크·단추·굵은 글 안과 상태 글·숫자 칸은 건드리지 않는다.
const SENT_END = /([가-힣][.?!]+)[ \t\n]+(?=\S|$)/g;
const BREAK_SKIP = '.status, .amount, .pt-price, .pt-sub, .pt-badge, .chip, .eyebrow, .kicker, .who, .why-year';
function breakSentences(root) {
  if (!root) return;
  for (const el of root.querySelectorAll('p, .ih-why span')) {
    if (el.matches(BREAK_SKIP) || el.closest('button, a, .seg, #toast') || (el.textContent || '').length < 40) continue;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.parentElement.closest('a, button, b, strong, kbd, abbr, label') && n.parentElement !== el) continue;
      if (n.nodeValue.trim().length >= 12) nodes.push(n);
    }
    for (const n of nodes) {
      const t = n.nodeValue, frag = [];
      let last = 0, cut = 0;
      for (const m of t.matchAll(SENT_END)) {
        const end = m.index + m[1].length;
        if (t.slice(last, end).replace(/\s/g, '').length <= 3) continue;   // "네." 같은 짧은 첫 마디
        frag.push(document.createTextNode(t.slice(last, end)), h('br', { class: 'br-s' }));
        last = m.index + m[0].length; cut++;
      }
      if (!cut) continue;
      frag.push(document.createTextNode(t.slice(last)));
      n.replaceWith(...frag);
    }
  }
}

// ---------- 화면 ----------
const app = $('#app');
function paint() {
  if (HOME) { paintHome(); return; }
  // 모양만: 어느 화면인지 CSS 가 알게 이름을 적어 둔다(view-home · view-apply · view-me · view-app · view-beta)
  const name = S.view === 'app' ? 'app' : S.view === 'apply' || S.view === 'beta' || (S.view === 'me' && S.session) ? S.view : 'home';
  const main = h('main', { class: 'page view-' + name, id: 'main' }, viewBody());
  app.replaceChildren(topbar(), main, footer());
  breakSentences(main);
}
function viewBody() {
  if (S.view === 'app') return appView();
  if (S.view === 'apply' && S.session) return applyView();
  if (S.view === 'apply') return applyGuest();
  if (S.view === 'me' && S.session) return meView();
  if (S.view === 'beta') return betaBody();
  return homeView();
}
// 베타테스터 신청 화면(#go=beta)은 beta.js — 그 화면을 열 때만 불러온다(betaView 가 album.js 의 도구를 받아 그림)
let betaMod = null, betaJob = null, betaFail = false;
// 베타 화면의 [아이디로 로그인] — 로그인하면 베타 화면으로 돌아온다
function betaLogin() { S.next = 'beta'; openSheet('login'); }
function setBetaPreview(on) {
  S.betaPreview = Boolean(on);
  if (on) ss.set('mk_beta_preview', '1'); else ss.del('mk_beta_preview');
  paint(); window.scrollTo({ top: 0 });
}
// 베타테스터 모집 띠(먼치킨.com 첫 화면 · album/ 처음 화면, 2026-11-26): 세션 없이 공개 status 를 한 번 물어
//  모집 중(open)이고 남은 자리가 있을 때만 그린다 → 짧은 주소 먼치킨.com/beta. 못 물으면 안 보인다.
let betaPubJob = null;
function ensureBetaPub() {
  if (S.betaPub || betaPubJob) return;
  betaPubJob = call('', { method: 'POST', body: { action: 'status' }, base: BETA_FN })
    .then((r) => { S.betaPub = { open: r.open === true && Number(r.left) > 0, seats: Number(r.seats) || 10, left: Math.max(0, Number(r.left) || 0) }; })
    .catch(() => { S.betaPub = { open: false }; })
    .finally(() => { betaPubJob = null; if (S.betaPub.open) paint(); });
}
function betaStrip() {
  ensureBetaPub();
  if (!S.betaPub?.open) return null;
  return h('a', { class: 'beta-strip', href: BETA_PAGE, onclick: HOME ? null : (e) => { e.preventDefault(); go('beta'); } },
    h('span', { class: 'bs-tag', text: '모집 중' }),
    h('span', { class: 'bs-text' }, '추억앨범 베타테스터', h('span', { class: 'bs-more', text: ` ${S.betaPub.seats}명 추가 모집 · 뽑히면 12월 31일까지 무료` })),
    h('span', { class: 'bs-go' }, '신청하기', icon('right')));
}
// 본문 베타 단추(2026-11-27 사용자 "사이트에도 봇에도 그 어디에도 신청하는 방법이 없잖아 베타테스터를"):
//  맨 위 띠만으로는 잘 안 보여서, /album 첫 칸(유료 신청 단추 위)과 먼치킨.com 첫 화면 추억앨범 칸에 큰 단추를 하나 더 둔다.
//  모집 중이고 남은 자리가 있을 때만(띠와 같은 공개 status). 이미 앨범이 있는 분(내 앨범 줄이 보이는 분)에게는 /album 에서 그리지 않는다.
function betaCta() {
  ensureBetaPub();
  if (!S.betaPub?.open) return null;
  return h('a', { class: 'beta-cta', href: BETA_PAGE, onclick: HOME ? null : (e) => { e.preventDefault(); go('beta'); } },
    h('span', { class: 'bc-text' },
      h('span', { class: 'bc-tag' }, h('i', { text: '모집 중' }), `베타테스터 ${S.betaPub.seats}명 · 남은 자리 ${S.betaPub.left}`),
      h('b', { text: '뽑히면 12월 31일까지 무료예요' }),
      h('small', { text: '카카오로 시작 → 박제 사진 3장 → 스푼 닉네임' })),
    h('span', { class: 'bc-go' }, '베타 신청하기', icon('right')));
}
function betaBody() {
  if (betaMod) return betaMod.betaView({ h, icon, call, billCall, S, go, toast, paint, openSheet, dropSession, busy, say, statusEl, hostText, key: KEY,
    login: betaLogin, kakao: (age14) => { S.next = 'beta'; kakaoLogin(age14 === true); }, kakaoButton, ageBox, age14Need: AGE14_NEED, preview: S.betaPreview, setPreview: setBetaPreview });
  if (!betaJob && !betaFail) betaJob = import('./beta.js?v=3').then((m) => { betaMod = m; }, () => { betaFail = true; }).finally(() => { betaJob = null; paint(); });
  return h('section', { class: 'sect narrow' }, h('p', { class: betaFail ? 'status bad' : 'muted', text: betaFail ? '화면을 불러오지 못했어요. 인터넷 연결을 확인하고 새로 고침해 주세요.' : '불러오는 중이에요…' }));
}
function topbar() {
  // 먼치킨 안의 카카오 로그인 창: 이름표만(다른 화면으로 가는 단추 없음)
  if (inApp()) return h('header', { class: 'top on-night' }, h('div', { class: 'wrap top-in' },
    h('span', { class: 'brand' }, h('img', { src: '../munchkin-64.png', alt: '', width: '34', height: '34' }), h('span', null, '먼치킨 ', h('em', { text: '로그인' })))));
  const right = S.session && S.me
    ? h('button', { class: 'me-btn', type: 'button', 'aria-label': '내 정보', onclick: () => go('me') }, icon('user'), h('span', { class: 'me-name', text: S.me.nickname || '내 정보' }))
    : [h('button', { class: 'btn line small hide-s', type: 'button', text: '회원가입', onclick: () => { if (S.view === 'beta') S.next = 'beta'; openSheet('signup'); } }),
      h('button', { class: 'btn main small', type: 'button', text: '로그인', onclick: () => { if (S.view === 'beta') S.next = 'beta'; openSheet('login'); } })];
  // 이름표 두 칸(2026-11-16 UI 검토 S7): "먼치킨"은 먼치킨.com 첫 화면으로, "추억앨범"은 이 페이지 처음 화면으로. 맨 위에 [먼치킨 받기]도 둔다.
  return h('header', { class: 'top on-night' }, h('div', { class: 'wrap top-in' },
    h('div', { class: 'brand brand-split' },
      h('a', { class: 'brand-home', href: '../', 'aria-label': '먼치킨.com 첫 화면' },
        h('img', { src: '../munchkin-64.png', alt: '', width: '34', height: '34' }), h('span', { text: '먼치킨' })),
      h('a', { class: 'brand-album', href: './', onclick: (e) => {
        e.preventDefault();
        if (S.view === 'app') { S.app = ''; S.appDone = ''; try { history.replaceState(null, '', location.pathname); } catch { /* 그대로 */ } }
        go('home');
      } }, h('em', { text: '추억앨범' }))),
    h('nav', { class: 'top-nav' },
      h('a', { class: 'btn line small get-link', href: '../#get', text: '먼치킨 받기' }),
      S.view !== 'apply' && S.view !== 'app' && S.view !== 'beta' ? (albumBeta() && !ownsAlbum()
        ? h('a', { class: 'btn line small hide-s', href: PREVIEW_URL, target: '_blank', rel: 'noopener', text: '미리 보기' })
        : h('button', { class: 'btn line small hide-s', type: 'button', text: '신청하기', onclick: () => go('apply') })) : null,
      right)));
}
function footer() {
  if (inApp()) return h('footer', { class: 'foot' }, h('div', { class: 'wrap' },
    h('p', { class: 'muted small', text: '먼치킨 프로그램의 로그인 창이에요. 로그인하면 이 창은 저절로 닫혀요.' }),
    h('p', { class: 'muted small', text: '먼치킨과 추억앨범은 스푼(Spoon)이 만든 서비스가 아니고, 스푼과 제휴 관계도 아니에요.' })));
  return h('footer', { class: 'foot' }, h('div', { class: 'wrap' },
    h('p', { class: 'foot-links' },
      h('a', { href: TERMS, target: '_blank', rel: 'noopener', text: '이용약관' }), ' · ',
      h('a', { href: PRIVACY, target: '_blank', rel: 'noopener', text: '개인정보처리방침' }), ' · ',
      h('a', { href: '../', text: '먼치킨 첫 화면' })),
    h('p', { class: 'muted small', text: '먼치킨과 추억앨범은 스푼(Spoon)이 만든 서비스가 아니고, 스푼과 제휴 관계도 아니에요.' }),
    // 운영자 사업자 정보 — 평소엔 접어 두고 누르면 펼침(추억앨범 사이트와 같게)
    h('details', { class: 'foot-biz' },
      h('summary', { text: '사업자 정보' }),
      h('p', { text: '뉴비랩 (NEWVIE Lab) · 대표 이지원 · 사업자등록번호 748-15-02934 · 통신판매업 신고번호 제2026-대구수성구-1478호' }),
      h('p', { text: '대구광역시 수성구 동대구로 336 · 전화번호 0505-008-0032 · likegorogoro@naver.com' }))));
}
const sectionHead = (eyebrow, title, lead) => h('div', { class: 'head' }, eyebrow ? h('p', { class: 'eyebrow', text: eyebrow }) : null, h('h2', { text: title }), lead ? h('p', { class: 'lead', text: lead }) : null);
// 추억앨범 베타(2026-11-05 사용자 "추억앨범은 아직 다른 디제이들은 이용할 수 없어 — 베타테스트 중이라 추후 공개 예정 · 미리보기 버튼 → 한이준.com"):
//  서버(bakje-billing info albumOpen)가 새 앨범 신청을 받을 때만 신청하기. 아니면 안내 + 미리 보기. 이미 앨범이 있는 DJ(시범)는 연장 그대로.
//  2026-11-23 사용자 "모든 사람들이 볼 수 있게" — 서버 기본이 열림(운영자가 albumOpen:false 로 끌 수 있음), 로그인 전에는 열린 것으로 본다.
const PREVIEW_URL = 'https://xn--hu5bi2af5y.com/';
const BETA_TEXT = '추억앨범은 지금 베타 테스트 중이에요. 다른 DJ분들께는 추후 공개할 예정이에요.';
// 카드 결제: cardOn = [카드로 결제]를 보임(모두) · cardCanPay = 실제로 결제창을 열 수 있음(아니면 단추를 끄고 CARD_CLOSED)
const cardOn = () => S.info?.card?.show === true;
const cardCanPay = () => { const c = S.info?.card; return Boolean(c && c.show === true && c.canPay === true && c.storeId && c.channelKey); };
// 새 앨범 신청 문(2026-11-23 모두에게 염): 로그인했으면 서버 albumOpen 대로, 로그인 전에는 열린 것으로 본다(서버 기본이 열림 — 운영자가 끄면 로그인 뒤 안내)
const albumBeta = () => (S.info ? S.info.albumOpen !== true : S.pub?.prices ? S.pub.albumOpen === false : false);
// 맨 위 띠: 유료가 시작되기 전까지만(서버 시각 now 가 있으면 그것으로 — PC 시계가 틀려도)
function paidBanner() {
  const src = S.session ? S.info : S.pub;
  const from = Number(src?.munchkinPaidFrom) || PAID_FROM;
  const now = Number(src?.now) || Date.now();
  return now < from ? h('p', { class: 'notice paid-banner', role: 'note', text: PAID_BANNER }) : null;
}
const ownsAlbum = () => Boolean(S.session && S.info?.albums?.length);
const previewBtn = (cls = 'btn main') => h('a', { class: cls, href: PREVIEW_URL, target: '_blank', rel: 'noopener' }, icon('album'), '미리 보기 · 한이준 추억앨범');
const betaBox = () => h('div', { class: 'card beta-box' },
  h('p', { class: 'eyebrow', text: '베타 테스트 중' }),
  h('p', { class: 'lead-s', text: BETA_TEXT }),
  h('p', { class: 'muted small', text: '어떤 모습인지는 한이준 추억앨범에서 미리 볼 수 있어요.' }),
  previewBtn());

// 처음 화면 = 추억앨범 상품 상세 페이지(2026-11-23 사용자 "추억앨범은 별도의 서비스에 가깝고, 먼치킨을 이용하지 않는 특히 모바일로만
//  방송하는 사람들도 예비 고객 — 실제 상품 상세페이지 같은 느낌으로"). 휴대폰 먼저, 구역마다 큰 실제 화면 + 굵은 제목 + 한두 줄.
//  흐름: 첫 화면 → 이런 DJ분께 → 스푼 포스트 vs 추억앨범 → 할 수 있는 것(피드·게시물·박제판·달력 + 그 밖) → 먼치킨 없이도
//   → 먼치킨 봇과 함께(봇 이야기는 여기에만) → 이용권 → 만드는 법 → 묻고 답하기 → 마지막 신청.
//  사진: 실제 한이준 추억앨범(shots/album-*.webp — 로그인하지 않고 찍음) · 스푼 포스트(사용자 본인 포스트, spoon-post.webp)
//   · 피드·뽑기판 예시(feed-*.webp · pick-*.webp — 실제 앨범 사이트를 숨은 창으로 열고 그 창 안에서만 지어낸 DJ "먼치"·지어낸 글·코드로 그린 그림으로 바꿔 찍음).
//  글은 코드에서 확인한 것만(박제관 docs/app.js · 약관 · 봇 features/firstboard.mjs·pick.mjs). 송출의 "자동 박제"(후원 모션 찍기)는 앨범에 올라가지 않는다 —
//  여기서 말하는 자동 박제는 봇의 최초 박제판 이름 넣기다. 박제 편지 종류는 예전 글을 고칠 때만 있다 → "박제편지 사진은 박제판으로 올려요".
const shot = (name, w, hh, alt, lazy = true) => h('img', { src: `shots/${name}.webp`, width: String(w), height: String(hh), alt, decoding: 'async', loading: lazy ? 'lazy' : null });
const previewLink = (cls = 'btn line') => h('a', { class: cls, href: PREVIEW_URL, target: '_blank', rel: 'noopener' },
  '한이준 추억앨범 미리 보기', h('span', { class: 'sr', text: '(새 창)' }), icon('ext'));
// 함께 쓰는 이용권 보기: 이용권 칸에서 [먼치킨 + 추억앨범]을 골라 둔 채로 내려간다
function showBundle() {
  S.draft.plan = 'bundle'; saveDraft(); paint();
  setTimeout(() => { const p = $('#pay'); p?.scrollIntoView({ behavior: 'smooth', block: 'start' }); $('#pay-title')?.focus({ preventScroll: true }); }, 50);
}
// 추억앨범만 한 달 값(서버 가격을 받았으면 그것으로)
const albumMonth = () => { const p = (S.session ? S.info : S.pub)?.prices?.album; return Number(p) > 0 ? Number(p) : 3000; };
function homeView() {
  const mine = S.session && S.info?.albums?.length ? S.info.albums : null;
  if (S.session && !S.info) ensureInfo();
  const beta = albumBeta() && !mine;
  const applyBtn = (cls = 'btn main') => h('button', { class: cls, type: 'button', onclick: () => go('apply') }, icon('album'), mine ? '연장·신청하기' : '추억앨범 신청하기');
  const ctas = (more = '') => h('div', { class: ('cta ' + more).trim() }, beta ? previewLink('btn main') : [applyBtn(), previewLink()]);
  const art = (name, w, hh, alt = '') => h('img', { class: 'art', src: `../art/${name}.webp`, width: String(w), height: String(hh), alt, decoding: 'async', loading: 'lazy' });
  const sky = () => h('i', { class: 'sky', 'aria-hidden': 'true' });
  const head = (id, title, lead) => h('div', { class: 'head' }, h('h2', { id, text: title }), lead ? h('p', { class: 'lead', text: lead }) : null);
  const EXAMPLE = '예시 화면이에요. 이름은 지어낸 거예요.';
  const FEED_EXAMPLE = '예시 화면이에요. 이름은 지어낸 거고, 사진은 AI로 생성한 이미지예요.';
  // 할 수 있는 것: 기능 하나에 큰 화면 하나
  const feat = (cls, name, title, text, pic, cap) => h('li', { class: 'feat ' + cls },
    h('div', { class: 'feat-copy' }, h('p', { class: 'feat-name', text: name }), h('h3', { text: title }), [].concat(text).map((t) => h('p', { text: t }))),
    h('figure', { class: 'feat-pic' }, pic, cap ? h('figcaption', { text: cap }) : null));
  const top = (name, w, hh, alt) => h('div', { class: 'real-pic' }, shot(name, w, hh, alt));
  return [
    betaStrip(),
    mine ? h('section', { class: 'mine-strip on-night' }, h('div', { class: 'wrap mine-row' }, mine.map(albumMini))) : null,
    // ① 첫 화면
    h('section', { class: 'hero a-hero night hero-night', 'aria-labelledby': 'a-title' }, sky(), h('div', { class: 'wrap hero-in' },
      h('div', { class: 'hero-copy' },
        h('p', { class: 'kicker' }, h('i', { class: 'dot' + (beta ? ' warn' : ''), 'aria-hidden': 'true' }), beta ? '먼치킨 추억앨범 · 베타 테스트 중' : '먼치킨 추억앨범'),
        h('h1', { id: 'a-title' }, '방송의 추억을', h('br'), '나만의 앨범으로'),
        h('p', { class: 'lead' }, '최초 박제판, 박제판, 일상 사진을 인스타그램처럼 모아 두는 나만의 사이트예요. 휴대폰만 있어도 만들고 올릴 수 있어요. 주소는 ',
          h('b', { class: 'nobr', text: '내이름.먼치킨.com' }), '처럼 정해요.'),
        mine ? null : betaCta(),
        h('p', { class: 'hero-price' }, '추억앨범만 ', h('b', { text: `한 달 ${won(albumMonth())}` }), '부터'),
        ctas(),
        h('p', { class: 'note', text: beta ? BETA_TEXT : '청취자는 가입하지 않아도 앨범을 볼 수 있어요.' })),
      h('figure', { class: 'real-phone' },
        h('div', { class: 'phone' }, shot('album-home', 786, 1056, '한이준 추억앨범 첫 화면. 프로필 사진 옆에 게시물 3, 박제판 8, 하트 19가 있고, 피드·게시물·박제판·달력 탭 아래에 최초 박제판 세 장(빼빼로데이 8/10칸, 스푸니 가을 8/8칸, 할로윈 2nd 15/16칸)이 보여요.', false)),
        h('img', { class: 'art phone-pal', src: '../art/album.webp', width: '581', height: '720', alt: '', decoding: 'async' }),
        h('figcaption', { text: '실제 한이준 추억앨범 첫 화면이에요.' })))),
    // ② 이런 DJ분께
    h('section', { class: 'section for-sec', 'aria-labelledby': 'for-title' }, h('div', { class: 'wrap' },
      head('for-title', '이런 DJ분께 딱 맞아요'),
      h('ul', { class: 'for-grid' },
        [['t-sky', ['phone', 720, 541], '휴대폰으로만 방송해요', 'PC가 없어도 돼요. 휴대폰에서 로그인하고 바로 사진을 올려요.'],
          ['t-blush', ['thanks-cookie', 640, 720], '박제판을 모아 두고 싶어요', '시즌마다 만든 최초 박제판과 박제판을 한곳에 모아 둬요.'],
          ['t-butter', ['greet', 675, 720], '청취자와 추억을 나누고 싶어요', '청취자가 하트와 댓글로 함께해요. 앨범은 누구나 볼 수 있어요.']]
          .map(([tone, [img, w, hh], t, d]) => h('li', { class: 'for-card ' + tone }, h('div', { class: 'awin' }, art(img, w, hh)), h('div', null, h('h3', { text: t }), h('p', { text: d }))))))),
    // ③ 스푼 포스트 vs 추억앨범(사용자 말 그대로의 불편 — 새 주장은 넣지 않는다)
    h('section', { class: 'section vs-sec', 'aria-labelledby': 'vs-title' }, h('div', { class: 'wrap' },
      head('vs-title', '스푼 포스트, 불편하지 않으셨나요?', '참가 홍보글, 최초 박제판, 박제판, 박제편지까지 모두 올리기엔 스푼 포스트가 너무 불편해요.'),
      h('div', { class: 'vs-grid' },
        h('article', { class: 'vs-card vs-spoon', 'aria-labelledby': 'vs-spoon-t' },
          h('h3', { id: 'vs-spoon-t', text: '스푼 포스트에 올리면' }),
          h('figure', { class: 'vs-pic' }, h('div', { class: 'post-frame' }, shot('spoon-post', 516, 586, '스푼 포스트 화면. 글 여러 줄 아래에 사진 두 장이 나란히 잘려 보여요.')),
            h('figcaption', { text: '스푼 포스트 화면(한이준 실제 포스트)' })),
          h('ul', { class: 'x-list' }, ['1:1 비율이 아니면 사진이 어색하게 잘려요', '사진은 3장까지만 올라가요', '3장을 올려도 예쁘게, 한눈에 들어오지 않아요', '글을 써도 한눈에 읽히지 않아요'].map((t) => h('li', { text: t })))),
        h('article', { class: 'vs-card vs-album', 'aria-labelledby': 'vs-album-t' },
          h('h3', { id: 'vs-album-t', text: '추억앨범이 있다면' }),
          h('figure', { class: 'vs-pic' }, h('div', { class: 'phone small' }, shot('feed-mdc', 787, 1436, '추억앨범 피드의 게시물 예시. 왼쪽 스푼 포스트와 같은 글을 올린 모습이에요. MDC AWARDS 포스터가 자르지 않고 그대로 보이고, 아래에 하트 7개와 글 일곱 줄이 모두 보이며 댓글 3개 모두 보기가 있어요.')),
            h('figcaption', { text: EXAMPLE })),
          h('ul', { class: 'check-list' }, ['한 글에 사진 10장까지, 비율 그대로', '넘겨 보는 사진과 글이 인스타그램처럼 한눈에', '최초 박제판·박제판·박제편지는 탭마다 따로 모아요', '청취자는 하트와 댓글로 함께해요'].map((t) => h('li', { text: t }))))),
      h('p', { class: 'vs-sum' }, '스푼 포스트엔 ', h('b', { text: '정말 중요한 홍보글만' }), ' 올리세요. 일상 공유와 최초 박제판, 박제판, 박제편지는 추억앨범이 예쁘게 보여 드려요.'),
      ctas('center'))),
    // ④ 할 수 있는 것 — 기능 하나씩 크게
    h('section', { class: 'section feat-sec', 'aria-labelledby': 'feat-title' }, h('div', { class: 'wrap' },
      head('feat-title', '추억앨범에서 할 수 있는 것', '피드, 게시물, 박제판, 달력. 탭 네 개에 방송의 순간이 모여요.'),
      h('ul', { class: 'feat-list' },
        feat('t-butter', '피드', '인스타그램처럼 내려 봐요', ['일상 사진과 글을 올리면 위에서 아래로 넘겨 봐요.', '한 글에 사진 10장까지, 어떤 비율이든 자르지 않고 올라가요.'],
          h('div', { class: 'phone small' }, shot('feed-cat', 787, 1640, '추억앨범 피드 예시. 먼치의 게시물에 길가에서 고양이 그림자 자세를 한 사진이 크게 보이고, 아래에 하트 24개와 "예전에 유행한 고양이 자세 찍어봤음 ㅋ-ㅋ" 글, 댓글 5개 모두 보기가 있어요.')), FEED_EXAMPLE),
        feat('t-blush', '게시물', '최초 박제판을 한눈에', ['최초 박제판마다 판 이름과 종료까지 남은 날(D-7)이 함께 보여요.', '먼치킨 봇이 올린 판은 채운 칸 수도 보여요.'],
          h('div', { class: 'pc-frame' }, shot('album-pc-posts', 1200, 770, '한이준 추억앨범 게시물 탭(PC). 최초 박제판 세 장 아래에 판 이름과 채운 칸(8/10칸, 8/8칸, 15/16칸), 종료와 D-7 표시가 있어요.')), '실제 한이준 추억앨범 화면(PC)이에요.'),
        feat('t-sky', '박제판', '박제 사진을 한곳에 모아요', ['박제판과 박제편지 사진을 자르지 않고 그대로 모아요.', '사진 위에 후원한 분 닉네임도 적어 둘 수 있어요.'],
          top('album-boards', 786, 1020, '한이준 추억앨범의 박제판 탭. 박제판 사진 여섯 장이 세 장씩 두 줄로 놓여 있고, 사진마다 왼쪽 위에 닉네임이 적혀 있어요.'), '실제 한이준 추억앨범 화면이에요.'),
        feat('t-coral', '달력', '달력에서 그날을 찾아요', ['달을 누르면 그 달, 날을 누르면 그날 올린 박제판만 보여요.'],
          top('album-calendar', 786, 944, '한이준 추억앨범의 달력 탭. 2026년 11월 달력의 날짜 칸마다 그날 올린 박제판 사진이 작게 들어 있어요.'), '실제 한이준 추억앨범 화면이에요.')),
      h('h3', { class: 'more-title', text: '그리고 이것도 들어 있어요' }),
      h('ul', { class: 'more-grid' },
        [['heart', '하트·댓글·답글', '하트는 누구나, 댓글은 먼치킨 계정으로 로그인하면 달아요.'],
          ['user', 'DJ·리스너 표시', '댓글 옆에 DJ인지 리스너인지 보여요.'],
          ['bell', 'DJ 알림', '새 하트와 댓글을 알림으로 알려 드려요.'],
          ['pin', '고정한 글', '중요한 글은 프로필 아래 동그라미로 고정해요.'],
          ['link', '내 이름 주소', '내이름.먼치킨.com 주소를 직접 정해요.'],
          ['shield', '댓글 관리', '댓글을 지우거나 댓글을 못 달게 막을 수 있어요.']]
          .map(([ic, t, d]) => h('li', null, h('span', { class: 'more-ico' }, icon(ic)), h('h4', { text: t }), h('p', { text: d })))))),
    // ⑤ 먼치킨 없이도
    h('section', { class: 'section solo-sec', 'aria-labelledby': 'solo-title' }, h('div', { class: 'wrap solo-in' },
      h('div', { class: 'solo-copy' },
        head('solo-title', '먼치킨 없이, 휴대폰만으로도 돼요', '추억앨범은 따로 쓰는 서비스예요. 먼치킨 프로그램이 없어도 이렇게 써요.'),
        h('ul', { class: 'check-list' }, ['먼치킨 계정으로 로그인하면 어느 기기에서든 글을 올리고 고쳐요', '일반 게시물, 박제판, 최초 박제판 사진을 직접 올려요', '최초 박제판에 종료 날짜를 적으면 D-day가 보여요', '프로필 사진과 소개를 바꾸고, 중요한 글은 고정해요', '하트·댓글 알림을 받고 댓글을 관리해요'].map((t) => h('li', { text: t }))),
        h('div', { class: 'solo-need' },
          h('p', { class: 'solo-need-t', text: '먼치킨 봇(Windows PC 프로그램)이 있어야 하는 것' }),
          h('ul', null, h('li', { text: '최초 박제판 칸에 이름을 저절로 넣고, 앨범에 저절로 올리기' }), h('li', { text: '추억의 뽑기판을 앨범에 실시간으로 보이기' })))),
      h('div', { class: 'awin solo-art' }, art('phone', 720, 541, '엎드려 휴대폰을 들여다보는 먼치킨')))),
    // ⑥ 먼치킨 봇과 함께 — 자동 박제(최초 박제판) · 추억의 뽑기판
    h('section', { class: 'section night syn-sec', 'aria-labelledby': 'syn-title' }, sky(), h('div', { class: 'wrap' },
      head('syn-title', '먼치킨 봇과 함께면 더 편해요', '방송에서 먼치킨 봇이 한 일이 앨범에 저절로 남아요.'),
      h('ul', { class: 'syn-grid' },
        h('li', { class: 'syn-card syn-first sky-keep' },
          h('div', { class: 'syn-copy' },
            h('p', { class: 'tag', text: '자동 박제' }),
            h('h3', { text: '최초 박제판이 앨범에 저절로 올라가요' }),
            h('p', { text: '방송 중 후원이 오면 먼치킨 봇이 같은 스푼 수의 최초 박제판 칸에 닉네임을 적어요.' }),
            h('p', { text: '이름이 적힌 판은 앨범 게시물 탭에 저절로 올라가요. 칸이 더 채워지면 같은 글의 사진이 새로 바뀌어요.' }),
            h('p', { class: 'syn-small', text: '같은 스푼 수의 칸이 여럿이면 어느 칸인지 봇이 DJ에게 물어봐요.' })),
          h('figure', { class: 'syn-shot' },
            h('div', { class: 'phone small' }, shot('album-first-board', 802, 1215, '한이준 추억앨범에 올라간 할로윈 2nd 최초 박제판. 16칸 중 15칸에 닉네임이 적혀 있고, 아래에 하트 4개, 스푼 테마, 종료 날짜가 보여요.')),
            h('figcaption', { text: '앨범에 올라간 실제 최초 박제판이에요.' }))),
        h('li', { class: 'syn-card syn-pick sky-keep' },
          h('div', { class: 'syn-copy' },
            h('p', { class: 'tag', text: '추억의 뽑기판' }),
            h('h3', { text: '청취자가 앨범에서 뽑기판을 실시간으로 봐요' }),
            h('p', { text: '먼치킨 봇에서 뽑기판을 시작하면 앨범 프로필 아래에 "지금 뽑기판 LIVE"가 떠요.' }),
            h('p', { text: '청취자가 채팅으로 칸을 열 때마다 앨범에도 몇 초 안에 바뀌어서, 남은 칸과 상품을 함께 봐요.' }),
            h('p', { class: 'syn-small', text: '방송이 끝나면 잠시 숨겼다가 다음 방송에서 다시 보여요. 다 끝난 판은 "지난 뽑기판"으로 남아요.' })),
          // 예시 사진(2026-11-23 사용자 "전에 만들었던 거 — DJ 프로필 사진이랑 이름만 바꿔서 뽑기 예시 이미지로"): 진짜 추억앨범 사이트를 숨은 창으로 열고
          //  그 창 안에서만 뽑기판 자료(pick.json)를 지어낸 판으로, 앨범 이름을 "먼치"로, 프로필 사진을 먼치킨 그림으로 바꿔 찍은 것(방송 주소 줄은 뺌)
          h('figure', { class: 'pick-shots' },
            h('div', { class: 'pc-frame' }, shot('pick-pc', 1200, 911, 'PC 화면 예시. 먼치 추억앨범 프로필 아래에 "지금 뽑기판 LIVE" 카드가 있고, 먼치 뽑기판 30칸 중 11칸이 열려 1등 새벽달, 2등 밤톨, 3등 구름빵처럼 상품과 연 사람이 보여요.')),
            h('div', { class: 'phone small' }, shot('pick-phone', 786, 1546, '휴대폰 화면 예시. 할로윈 100칸 뽑기가 LIVE로 떠 있고, 100칸 중 당첨 16칸, 남은 칸 60, 상품마다 남은 수가 보여요.')),
            h('figcaption', { text: '예시 화면이에요. 이름은 지어낸 거예요.' })))),
      h('div', { class: 'syn-foot sky-keep' },
        h('p', { text: '자동 박제와 실시간 뽑기판은 먼치킨 봇(Windows PC 프로그램)이 하는 일이에요. 봇에서 같은 먼치킨 계정으로 로그인하면 앨범과 저절로 이어져요.' }),
        beta ? null : h('button', { class: 'btn main', type: 'button', onclick: showBundle, text: '먼치킨 + 추억앨범 이용권 보기' })))),
    // ⑦ 이용권 칸(2026-11-23 사용자 "추억앨범 화면에서도 결제 창·회원가입·로그인"): 로그인 전에도 종류·기간·금액이 보인다
    h('section', { class: 'section pay-home', id: 'pay', 'aria-labelledby': 'pay-title' }, h('div', { class: 'wrap pay-wrap' },
      h('div', { class: 'head' }, h('h2', { id: 'pay-title', tabindex: '-1', text: '이용권' }),
        h('p', { class: 'lead', text: '추억앨범만 쓰거나, 먼치킨 봇과 함께 쓸 수 있어요. 기간을 고르고 신청하기를 누르세요.' })),
      h('div', { class: 'pt pay-box', id: 'mk-pay' }, payBox()))),
    // ⑧ 만드는 법
    h('section', { class: 'start-section night' }, sky(), h('div', { class: 'wrap' },
      sectionHead('', '이렇게 만들어요', beta ? '공개되면 세 단계면 끝나요. 지금은 베타 테스트 중이라 신청을 받지 않아요.' : '세 단계면 끝나요. 앨범이 생기면 바로 글을 올릴 수 있어요.'),
      h('ol', { class: 'start-steps plain' },
        h('li', null, h('span', { class: 'num', 'aria-hidden': 'true', text: '1' }), h('h3', { text: '먼치킨 계정으로 로그인' }), h('p', { text: '없으면 1분이면 가입해요. 카카오로도 돼요.' })),
        h('li', null, h('span', { class: 'num', 'aria-hidden': 'true', text: '2' }), h('h3', { text: '신청하기' }), h('p', { text: cardCanPay() ? '주소 이름·앨범 이름·기간을 고르고 카드나 계좌이체로 결제해요.' : '주소 이름·앨범 이름·기간을 고르고 계좌로 이체해요.' })),
        h('li', null, h('span', { class: 'num', 'aria-hidden': 'true', text: '3' }), h('h3', { text: '바로 열려요' }), h('p', { text: cardCanPay() ? '카드는 결제하면 바로, 계좌이체는 운영자가 입금을 확인하면 앨범과 주소가 만들어져요(최대 24시간).' : '운영자가 입금을 확인하면 앨범과 주소가 바로 만들어져요(최대 24시간).' }))))),
    // ⑨ 묻고 답하기
    h('section', { class: 'section faq' }, h('div', { class: 'wrap' },
      sectionHead('', '자주 묻는 질문'),
      h('div', { class: 'faq-list' },
        [...(beta ? [['지금 신청할 수 있나요?', '아직은 베타 테스트 중이라 신청을 받지 않아요. 추후 공개할 예정이에요. 어떤 모습인지는 한이준 추억앨범(한이준.com)에서 미리 볼 수 있어요.']] : []),
          ['휴대폰만 있어도 되나요?', '네. 가입과 신청, 글 올리기까지 휴대폰에서 다 할 수 있어요. 먼치킨 계정으로 로그인만 하면 돼요.'],
          ['먼치킨 프로그램을 안 써도 되나요?', '네. 추억앨범만 신청해도 돼요. 먼치킨 봇을 함께 쓰면 최초 박제판이 저절로 올라가고, 뽑기판도 앨범에서 실시간으로 보여요.'],
          ['주소는 어떻게 정하나요?', '신청할 때 주소 이름을 적어요. 밤톨이라고 적으면 밤톨.먼치킨.com이 돼요. 이미 쓰는 이름이면 다른 이름으로 정해요.'],
          ['청취자도 가입해야 하나요?', '앨범은 누구나 볼 수 있어요. 댓글을 달 때만 가입하면 돼요.'],
          ['먼치킨 프로그램과는 어떻게 이어지나요?', '먼치킨에서 같은 먼치킨 계정으로 로그인하면 저절로 이어져요. 앨범이 생길 때 그 계정으로 로그인한 먼치킨이 있으면 그것도 바로 이어져요.'],
          ['이용 기간이 끝나면 앨범은 어떻게 되나요?', '앨범은 그대로 남고 보기만 할 수 있어요. 새 글 올리기와 저절로 올리기는 멈춰요.']]
          .map(([q, a]) => h('details', { class: 'qa' }, h('summary', { text: q }), h('p', { text: a })))))),
    // ⑩ 마지막 신청
    h('section', { class: 'final-cta end-cta night', 'aria-labelledby': 'end-title' }, sky(), h('div', { class: 'wrap' },
      h('img', { class: 'art final-art', src: '../art/album.webp', width: '581', height: '720', alt: '', decoding: 'async', loading: 'lazy' }),
      h('h2', { id: 'end-title', text: '오늘 방송의 추억부터 모아 볼까요?' }),
      h('p', { class: 'lead', text: beta ? BETA_TEXT : `추억앨범만 한 달 ${won(albumMonth())}부터예요.` }),
      ctas('center')))
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
  const items = ['주소 이름', '앨범 이름', '기간', cardOn() ? '결제' : '입금'];
  return h('ol', { class: 'stepper', 'aria-label': '신청 단계' }, items.map((t, i) => h('li', { class: done[i] ? 'done' : '' }, h('b', null, done[i] ? icon('check') : String(i + 1)), h('span', { text: t }))));
}
const kvRow = (k, ...v) => h('div', { class: 'kv-row' }, h('dt', { text: k }), h('dd', null, ...v));
const copyChip = (text, label) => h('button', { class: 'copy-chip', type: 'button', onclick: () => copyLine(text, label) }, icon('copy'), '복사');
// ---------- 카드 결제(포트원 V2 → KG이니시스 결제창) ----------
// 결제 단추를 누를 때만 SDK 를 불러온다. 미리 보기(이 PC 의 mock.js)는 가짜 결제창(window.__mkMockPortOne)을 쓴다 — 실제 포트원에 아무것도 보내지 않는다.
let portoneJob = null;
function loadPortOne() {
  if (LOCAL && window.__mkMockPortOne) return Promise.resolve(window.__mkMockPortOne);
  portoneJob ||= import(PORTONE_SDK).then((m) => {
    const p = m.default?.requestPayment ? m.default : m;
    if (typeof p?.requestPayment !== 'function') throw Error('sdk');
    return p;
  }).catch(() => { portoneJob = null; throw Error('결제창을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요.'); });
  return portoneJob;
}
// [다시 결제]용: 카드 신청을 만들 때 보낸 내용(이용권·기간·앨범 — 결제하는 분 정보는 없음). 없으면 신청 줄에서 다시 만든다.
const cardBodies = () => parse(ss.get('mk_card_body')) || {};
function keepCardBody(id, body) { const all = cardBodies(); all[id] = body; ss.set('mk_card_body', JSON.stringify(all)); }
function dropCardBody(id) { const all = cardBodies(); if (!(id in all)) return; delete all[id]; ss.set('mk_card_body', JSON.stringify(all)); }
function cardBodyOf(o) {
  const kept = cardBodies()[o.id];
  if (kept && typeof kept.plan === 'string') return kept;
  const body = { plan: o.plan, ...(o.months ? { months: o.months } : {}) };
  if (o.album) body.album = o.album;
  if (o.newAlbum) body.newAlbum = { label: o.newAlbum.label, name: o.newAlbum.name };
  return body;
}
const testBadge = () => (cardCanPay() && S.info.card.mode === 'test' ? h('p', { class: 'notice warn', text: CARD_TEST }) : null);
// 결제하는 분 칸(KG PC 결제창에 꼭 필요한 이름·휴대폰·이메일). key 는 같은 화면에 여러 벌 있을 때 칸 이름을 나누는 글자.
function payerBox(key, st) {
  const id = (k) => `pay-${key}-${k}`;
  const mk = (k, props) => {
    const el = input(id(k), { value: PAYER[k], 'aria-required': 'true', dataset: { payer: k }, ...props });
    el.addEventListener('input', () => {
      PAYER[k] = el.value; el.removeAttribute('aria-invalid');
      for (const x of document.querySelectorAll(`input[data-payer="${k}"]`)) if (x !== el) x.value = el.value;   // 다른 칸도 같은 글로
    });
    return el;
  };
  const name = mk('name', { autocomplete: 'name' });
  const phone = mk('phone', { type: 'tel', autocomplete: 'tel', inputmode: 'tel' });
  const email = mk('email', { type: 'email', autocomplete: 'email', inputmode: 'email', autocapitalize: 'none', spellcheck: 'false' });
  st.id = id('status');
  const el = h('fieldset', { class: 'payer', 'aria-describedby': id('note') },
    h('legend', { text: '결제하는 분' }),
    h('p', { class: 'hint', id: id('note'), text: '카드 결제창에 넘기는 정보예요. 결제 회사로만 보내고 먼치킨은 저장하지 않아요.' }),
    field(id('name'), '이름', name), field(id('phone'), '휴대폰 번호', phone), field(id('email'), '이메일', email));
  // 결제창에 넘길 값 — 빠졌으면 그 칸에 초점과 글(글은 칸과 이어 둔다)
  const read = () => {
    const bad = (box, message) => { box.setAttribute('aria-invalid', 'true'); box.setAttribute('aria-describedby', st.id); say(st, message, true); box.focus(); return null; };
    const fullName = name.value.trim(), phoneNumber = phone.value.replace(/[\s-]/g, ''), mail = email.value.trim();
    if (!fullName) return bad(name, '결제하는 분 이름을 넣어 주세요.');
    if (!phoneNumber) return bad(phone, '휴대폰 번호를 넣어 주세요.');
    if (!/^[0-9]+$/.test(phoneNumber)) return bad(phone, '휴대폰 번호는 숫자로 넣어 주세요.');
    if (!mail) return bad(email, '이메일을 넣어 주세요.');
    if (!email.checkValidity()) return bad(email, '이메일 주소를 다시 봐 주세요.');
    return { fullName, phoneNumber, email: mail };
  };
  return { el, read };
}
// 현금영수증 받기(선택, 2026-11-25): 계좌이체 "입금했어요" 위의 접힌 칸 — 펼치면 개인(소득공제)·사업자(지출증빙) 고르기 + 번호 칸.
//  기본은 접힘·비어 있음. 접혀 있거나 번호가 비어 있으면 보내지 않는다(전과 같음). 번호 검사는 서버가 — 틀리면 서버 글을 이 칸 아래에(bad).
//  추억앨범 app.js receiptBox 와 같은 글자. 번호는 이 페이지의 메모리에만(RECEIPT — localStorage·sessionStorage 에 안 씀, 화면을 다시 그려도 남게).
const RECEIPT_KINDS = [['personal', '개인(소득공제)', '휴대폰 번호 또는 현금영수증 카드 번호'], ['business', '사업자(지출증빙)', '사업자등록번호']];
const RECEIPT = {};   // 신청 번호 → {open, kind, number}
function receiptBox(key) {
  const id = (k) => `rc-${key}-${k}`;
  const mem = (RECEIPT[key] ||= { open: false, kind: RECEIPT_KINDS[0][0], number: '' });
  const st = statusEl();
  st.id = id('status');
  const num = input(id('no'), { type: 'text', inputmode: 'numeric', autocomplete: 'off', maxlength: '30', value: mem.number });
  const box = field(id('no'), RECEIPT_KINDS.find((x) => x[0] === mem.kind)[2], num);
  const label = box.querySelector('label');
  const calm = () => { num.removeAttribute('aria-invalid'); num.removeAttribute('aria-describedby'); say(st, ''); };
  num.addEventListener('input', () => { mem.number = num.value; calm(); });
  const pick = (v) => {
    mem.kind = v;
    for (const b of btns) { const on = b.dataset.kind === v; b.className = on ? 'on' : ''; b.setAttribute('aria-pressed', String(on)); }
    label.textContent = RECEIPT_KINDS.find((x) => x[0] === v)[2];
    calm();
  };
  const btns = RECEIPT_KINDS.map(([v, text]) => h('button', { type: 'button', class: v === mem.kind ? 'on' : '', 'aria-pressed': String(v === mem.kind), dataset: { kind: v }, onclick: () => pick(v) }, text));
  const el = h('details', { class: 'more receipt', open: mem.open },
    h('summary', { text: '현금영수증 받기(선택)' }),
    h('fieldset', { class: 'payer', 'aria-label': '현금영수증', 'aria-describedby': id('note') },
      h('div', { class: 'seg', role: 'group', 'aria-label': '현금영수증 종류' }, btns),
      box,
      h('p', { class: 'hint', id: id('note'), text: '입금을 확인한 뒤 발급해 드려요.' }),
      st));
  el.addEventListener('toggle', () => { mem.open = el.open; });
  const read = () => {
    const number = num.value.replace(/[\s-]+/g, '');
    return el.open && number ? { kind: mem.kind, number } : null;
  };
  const bad = (message) => { el.open = true; num.setAttribute('aria-invalid', 'true'); num.setAttribute('aria-describedby', st.id); say(st, message, true); num.focus(); };
  return { el, read, bad };
}
// 결제 안 끝난 카드 신청으로 화면을 옮기고 [다시 결제](또는 [결제 다시 확인])에 초점
function showOrder(id, focusSel = 'button[type="submit"]') {
  setTimeout(() => {
    const card = $('#order-' + id);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card.querySelector(focusSel)?.focus({ preventScroll: true });
  }, 50);
}
function cardStopped(id, text) {
  S.payDone = null; S.payNote = { id, text, bad: true };
  toast(text, true);
}
// 카드로 결제: card-start(서버가 금액·주문 이름·결제 번호를 정함) → KG 결제창 → card-done(서버가 포트원에 물어 마무리).
//  휴대폰은 결제창으로 페이지가 넘어갔다가 ?pay= 로 돌아온다(payReturn). 결제창에서 그만두거나 실패하면 신청은 그대로(다시 결제·취소).
async function payWithCard(body, st, payer) {
  const customer = payer.read();
  if (!customer) return;
  const sdk = loadPortOne();
  sdk.catch(() => {});
  S.payDone = null; S.payNote = null;
  const r = await billCall('card-start', body);
  const o = r.order, p = r.pay || {};
  keepCardBody(o.id, body);
  let PortOne, res;
  try { PortOne = await sdk; } catch (e) { cardStopped(o.id, e.message); await loadInfo().catch(() => {}); paint(); showOrder(o.id); return; }
  say(st, '결제창을 여는 중이에요…');
  try {
    res = await PortOne.requestPayment({ storeId: p.storeId, channelKey: p.channelKey, paymentId: p.paymentId, orderName: p.orderName, totalAmount: p.totalAmount,
      currency: p.currency, payMethod: p.payMethod, redirectUrl: p.redirectUrl, customer });
  } catch (e) { res = { code: 'ERROR', message: e?.message || '' }; }
  if (!res || res.code != null) { cardStopped(o.id, res?.message || CARD_FAIL); await loadInfo().catch(() => {}); paint(); showOrder(o.id); return; }
  say(st, '결제를 확인하는 중이에요…');
  await finishCard(o.id);
}
// 서버에 결제 마무리를 묻는다 → paid(이용권 생김) · test(테스트 결제 — 이용권 없음) · pending(아직) · failed(message)
async function finishCard(id) {
  let r;
  try { r = await billCall('card-done', { id }); }
  catch (e) { cardStopped(id, e.message); await loadInfo().catch(() => {}); paint(); showOrder(id); return; }
  if (r.state === 'paid' || r.state === 'test') {
    S.payDone = { state: r.state, order: r.order }; S.payNote = null;
    dropCardBody(id);
    PAYER.name = PAYER.phone = PAYER.email = '';   // 결제를 마쳤으면 결제하는 분 칸도 비운다
    S.draft = { label: '', name: '', plan: 'album', months: 1, album: '' }; saveDraft(); S.labelOk = null;
    toast(r.state === 'test' ? '테스트 결제를 마쳤어요' : '결제했어요');
  } else if (r.state === 'failed') cardStopped(id, r.message || CARD_FAIL);
  else {
    // pending: 방금 결제했는데 포트원 쪽 반영이 늦을 수 있다 — 다시 결제하라고 하지 않고, 신청 카드의 [결제 다시 확인]으로 다시 묻게 한다
    S.payDone = null; S.payNote = { id, text: CARD_CHECK, bad: false, check: true };
    toast(CARD_CHECK);
  }
  await loadInfo().catch(() => {});
  paint();
  // 결제를 마쳤으면 결과 카드로(초점은 [내 정보 보기] — 누른 단추가 화면에서 사라졌으니) · 확인 중이면 [결제 다시 확인]에
  if (S.payDone) setTimeout(() => { const d = $('#pay-done'); d?.scrollIntoView({ behavior: 'smooth', block: 'start' }); d?.querySelector('button')?.focus({ preventScroll: true }); }, 50);
  else showOrder(id, S.payNote?.check ? '.pay-check' : 'button[type="submit"]');
}
// 휴대폰 카드 결제에서 돌아옴(?pay=): code 가 있으면(그만둠·실패) 그 글을 보이고 신청은 그대로, 없으면 card-done 으로 마무리
async function payReturn(p) {
  if (!S.session) { S.next = 'apply'; openSheet('login'); return; }
  S.view = 'apply';
  if (!p.code) { S.payDone = { state: 'checking' }; paint(); await finishCard(p.id); return; }
  paint();
  await loadInfo().catch((e) => { S.infoError = e.message; });
  // 내 결제 안 끝난 카드 신청일 때만 주소에 실려 온 글을 보인다(남이 만든 주소의 글을 그대로 띄우지 않게)
  const o = (S.info?.orders || []).find((x) => x.id === p.id && x.pay === 'card' && x.state === 'pending');
  if (o) cardStopped(o.id, p.message || CARD_FAIL);
  paint();
  if (o) showOrder(o.id);
}
// 카드 결제 결과(결제를 마친 뒤 신청 화면 맨 위)
function payResult() {
  const d = S.payDone;
  if (!d) return null;
  if (d.state === 'checking') return h('article', { class: 'card', id: 'pay-done' }, h('p', { class: 'status', role: 'status', text: '카드 결제를 확인하는 중이에요…' }));
  const o = d.order || {}, test = d.state === 'test';
  return h('article', { class: 'card pay' + (test ? '' : ' sent'), id: 'pay-done' },
    h('div', { class: 'pay-top' },
      h('span', { class: 'chip ' + (test ? 'wait' : 'ok'), text: test ? '🧪 테스트 결제' : '결제했어요' }),
      h('span', { class: 'muted small', text: dayText(o.payAt || Date.now()) })),
    h('p', { class: 'pay-title', text: `${PLAN_NAME[o.plan] || o.plan || ''} · ${planPeriod(o)}` }),
    o.newAlbum ? h('p', { class: 'pay-album' }, icon('album'), h('span', null, h('b', { text: `${o.newAlbum.label}.${SUFFIX}` }), ' · ' + o.newAlbum.name)) : null,
    h('p', { class: 'amount', text: won(o.amount) }),
    h('p', { class: 'notice' + (test ? ' warn' : ''), text: test ? '테스트 결제를 마쳤어요. 실제로 돈이 나가지 않았고 이용권도 생기지 않아요.'
      : o.newAlbum ? '결제를 마쳤어요. 내 추억앨범은 내 정보에서 볼 수 있어요.' : '결제를 마쳤어요. 늘어난 이용 기간은 내 정보에서 볼 수 있어요.' }),
    h('button', { class: 'btn line block', type: 'button', text: '내 정보 보기', onclick: () => go('me') }));
}
// 결제 안 끝난 카드 신청: 계좌·입금자명 대신 "카드 결제를 아직 마치지 않았어요" + [다시 결제] [신청 취소]
function cardOrderCard(o) {
  const st = statusEl(), na = o.newAlbum, can = cardCanPay();
  const note = S.payNote?.id === o.id ? S.payNote : null;
  if (note) say(st, note.text, note.bad);
  const payer = can ? payerBox('o' + o.id, st) : null;
  const again = can ? h('button', { class: 'btn main', type: 'submit', text: '다시 결제' }) : null;
  const cancel = h('button', { class: 'btn line', type: 'button', text: '신청 취소', onclick: (e) => busy(e.currentTarget, st, async () => {
    if (!confirm('이 신청을 취소할까요?')) return;
    const r = await billCall('cancel', { id: o.id });
    dropCardBody(o.id); S.payNote = null;
    toast(!r.order || r.order.state === 'canceled' ? '신청을 취소했어요' : '이미 결제된 신청이라 취소하지 않았어요');
    await loadInfo(); paint();
  }) });
  const btns = h('div', { class: 'row-btns' }, cancel, again);
  // 결제 확인이 늦을 때(card-done pending): 다시 결제하지 않고 서버에 다시 묻는 길
  const recheck = note?.check ? h('div', { class: 'links' }, h('button', { class: 'link-btn pay-check', type: 'button', text: '결제 다시 확인', onclick: (e) => busy(e.currentTarget, st, () => finishCard(o.id)) })) : null;
  return h('article', { class: 'card pay', id: 'order-' + o.id },
    h('div', { class: 'pay-top' },
      h('span', { class: 'chip wait', text: '카드 결제를 기다리고 있어요' }),
      h('span', { class: 'muted small', text: dayText(o.created) })),
    h('p', { class: 'pay-title', text: `${PLAN_NAME[o.plan] || o.plan} · ${planPeriod(o)}` }),
    na ? h('p', { class: 'pay-album' }, icon('album'), h('span', null, h('b', { text: `${na.label}.${SUFFIX}` }), ' · ' + na.name)) : null,
    h('p', { class: 'amount', text: won(o.amount) }),
    h('p', { class: 'notice', text: can ? `${CARD_WAIT} 다시 결제하거나 신청을 취소할 수 있어요.` : `${CARD_WAIT} 신청을 취소할 수 있어요.` }),
    can ? [testBadge(), h('form', { class: 'stack', noValidate: true, onsubmit: (e) => { e.preventDefault(); busy(again, st, () => payWithCard(cardBodyOf(o), st, payer)); } }, payer.el, st, btns)]
      : [st, btns],
    recheck);
}

// 확인을 기다리는 신청: 계좌·금액·입금자명 + [입금했어요] [신청 취소]
function orderCard(o, info) {
  if (o.pay === 'card') return cardOrderCard(o);
  const st = statusEl(), bank = info.bank;
  const na = o.newAlbum;
  const rc = o.sent ? null : receiptBox(o.id);
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
    rc?.el,
    st,
    h('div', { class: 'row-btns' },
      h('button', { class: 'btn line', type: 'button', text: '신청 취소', onclick: (e) => busy(e.currentTarget, st, async () => {
        if (!confirm('이 신청을 취소할까요? 이미 이체했다면 취소하지 말고 "입금했어요"를 눌러 주세요.')) return;
        await billCall('cancel', { id: o.id }); toast('신청을 취소했어요'); await loadInfo(); paint();
      }) }),
      !o.sent ? h('button', { class: 'btn main', type: 'button', text: '입금했어요', onclick: (e) => busy(e.currentTarget, st, async () => {
        // 현금영수증(선택): 펼쳐서 번호를 적었으면 함께 보낸다 — 번호가 틀리면(400) 서버 글을 그 칸 아래에
        const receipt = rc.read();
        try { await billCall('sent', { id: o.id, ...(receipt ? { receipt } : {}) }); }
        catch (err) { if (receipt && err.status === 400) { rc.bad(err.message); return; } throw err; }
        delete RECEIPT[o.id];
        toast(receipt ? '운영자에게 알렸어요. 현금영수증도 신청했어요' : '운영자에게 알렸어요'); await loadInfo(); paint();
      }) }) : null));
}
const segOf = (items, cur, on, label) => h('div', { class: 'seg', role: 'group', 'aria-label': label || null }, items.map(([v, label, ok = true]) =>
  h('button', { type: 'button', class: v === cur ? 'on' : '', 'aria-pressed': String(v === cur), disabled: !ok, onclick: () => on(v) }, label)));

let labelTimer = 0, labelSeq = 0, orderBtnRef = null, payBtnRef = null, orderReady = () => false, stepperRef = null, stepperDone = () => [];
// 쓰는 동안(화면을 다시 그리지 않고) 신청 단추와 단계 표시만 고친다
function refreshOrderBtn() {
  if (orderBtnRef) orderBtnRef.disabled = !orderReady();
  if (payBtnRef) payBtnRef.disabled = !orderReady();
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

// ---------- 이용권 종류·기간·금액·할인 · 결제 단추 (신청 화면과 첫 화면 이용권 칸이 같이 쓴다 — 2026-11-23) ----------
// 할인 표시(사용자 "n% sale"): 서버 가격으로 계산하고 내림(부풀리지 않기). 0 이하이거나 값이 없으면 안 보임
const pct = (whole, val) => (whole > 0 && val > 0 && val < whole ? Math.floor(((whole - val) * 100) / whole) : 0);
const sale = (n) => (n > 0 ? [' ', h('span', { class: 'chip sale', text: `${n}% 할인` })] : null);   // 앞 빈칸: 화면 읽기가 "1년 16% 할인"으로 띄어 읽게
const munchkinOpen = (info) => info.prices?.munchkin > 0 && Date.now() >= (Number(info.munchkinFrom) || 0);
// 고를 수 있는 이용권과 금액. info = 서버 info(로그인) 또는 prices(로그인 전) · d = S.draft(고른 것 — 고를 수 없으면 plan·months 를 고친다)
function planModel(info, d, { owner = false, albumOk = true, addons = {} } = {}) {
  const P = info.prices || {}, Y = info.year || {};
  const bundleSale = P.munchkin > 0 && P.album > 0 ? pct(P.munchkin + P.album, P.bundle) : 0;
  // 고를 수 있는 이용권(이 차례로): 추억앨범만(앨범이 있으면 연장) · 먼치킨만 · 먼치킨 + 추억앨범 · (먼치킨을 쓰는 중이면) 먼치킨 끝나는 날에 맞춰 추억앨범 더하기 · (앨범 주인) 먼치킨 더하기
  const plans = [['album', owner ? '추억앨범 연장' : '추억앨범만', albumOk && P.album > 0], ['munchkin', '먼치킨만', munchkinOpen(info)],
    ['bundle', ['먼치킨 + 추억앨범', sale(bundleSale)], albumOk && P.bundle > 0]];
  if (addons['add-album']) plans.push(['add-album', '먼치킨 끝나는 날에 맞춰 더하기', owner || albumOk]);
  if (owner && addons['add-munchkin']) plans.push(['add-munchkin', '먼치킨 더하기(앨범 끝나는 날까지)', true]);
  const any = plans.some(([, , ok]) => ok);
  if (!plans.some(([k, , ok]) => k === d.plan && ok)) d.plan = (plans.find(([, , ok]) => ok) || plans[0])[0];
  if (![1, 12].includes(d.months)) d.months = 1;
  const quote = addons[d.plan] || null;
  const amount = quote ? quote.amount : d.months === 12 ? (Y[d.plan] || 0) : (P[d.plan] || 0) * d.months;
  const full = (P[d.plan] || 0) * 12;
  // 1년 할인: 먼치킨 + 추억앨범은 따로 한 달씩 낼 때(먼치킨 + 추억앨범 월값 × 12)와 비교(2026-11-23 사용자 "30%할인으로"), 나머지는 그 종류 월값 × 12
  const sepYear = d.plan === 'bundle' && P.munchkin > 0 && P.album > 0 ? (P.munchkin + P.album) * 12 : 0;
  const yearSale = sepYear ? pct(sepYear, Y.bundle || 0) : pct(full, Y[d.plan] || 0);
  return { plans, quote, amount, full, sepYear, yearSale, bundleSale, any };
}
// 종류·기간을 바꾸면 위 칸이 접히거나 펼쳐질 수 있으니, 그 칸(anchor)이 화면에서 제자리에 있게 하고 고른 단추에 초점을 돌려준다
const pickKeep = (anchor, seg, apply) => (v) => {
  const top = $(anchor)?.getBoundingClientRect().top;
  apply(v); saveDraft(); paint();
  const now = $(anchor);
  if (now && top != null) window.scrollBy(0, now.getBoundingClientRect().top - top);
  now?.querySelector(`[aria-label="${seg}"] [aria-pressed="true"]`)?.focus({ preventScroll: true });
};
// [종류] [기간] 고르기 + 금액 + 아낀 돈·도움말
function planBlock(m, d, anchor) {
  return [
    segOf(m.plans, d.plan, pickKeep(anchor, '이용권 종류', (v) => { d.plan = v; }), '이용권 종류'),
    m.quote ? h('p', { class: 'small', text: `${d.plan === 'add-album' ? '쓰고 있는 먼치킨' : '추억앨범'}이 끝나는 ${dayText(m.quote.until)}까지 함께 써요(${m.quote.days}일 · 한 달 ${won(m.quote.perMonth)} 기준).` })
      : segOf([[1, '1개월'], [12, ['1년', sale(m.yearSale)]]], d.months, pickKeep(anchor, '기간', (v) => { d.months = v; }), '기간'),
    h('p', { class: 'amount', text: won(m.amount) }),
    // 아낀 돈: 1년 할인 표시와 같은 기준 — 먼치킨 + 추억앨범은 따로 한 달씩 낼 때((먼치킨 + 추억앨범 월값) × 12)와 비교(2026-11-23)
    !m.quote && d.months === 12 && m.sepYear > m.amount ? h('p', { class: 'small good', text: `먼치킨·추억앨범을 따로 한 달씩 내는 것보다 ${won(m.sepYear - m.amount)} 아껴요 (한 달 ${won(Math.round(m.amount / 12))}꼴)` })
      : !m.quote && d.months === 12 && !m.sepYear && m.full > m.amount ? h('p', { class: 'small good', text: `한 달씩보다 ${won(m.full - m.amount)} 아껴요 (한 달 ${won(Math.round(m.amount / 12))}꼴)` }) : null,
    d.plan === 'bundle' ? h('p', { class: 'hint', text: '먼치킨(봇 프로그램) 이용권도 같은 기간만큼 함께 늘어나요.' }) : null,
    d.plan === 'munchkin' ? h('p', { class: 'hint', text: '먼치킨(봇 프로그램)만 쓸 때예요. 추억앨범은 만들지 않아요.' }) : null,
    m.amount > 0 ? null : h('p', { class: 'hint', text: '이 이용권은 아직 준비 중이에요.' })
  ];
}
// 결제 단추 묶음: [카드로 결제](card.show — 결제창은 canPay 일 때만, 아니면 꺼 두고 CARD_CLOSED) + 계좌이체(card.show 가 꺼져 있으면 예전 "신청하기" 하나)
//  body = 서버에 보낼 신청 내용 · ready = 지금 신청할 수 있나 · key = 결제하는 분 칸 이름을 나누는 글자
function payActions({ amount, body, ready, notReady, wantAlbum, key }) {
  const card = cardOn(), canPay = cardCanPay();
  const st = statusEl();
  const bankLead = `신청하면 계좌와 입금자명이 나와요. 이체한 뒤 "입금했어요"를 누르면 돼요. ${wantAlbum ? WAIT_ALBUM : WAIT_PLAN}`;
  orderReady = ready; payBtnRef = null;
  // 카드로 결제할 수 있으면 계좌이체는 보조 단추. 카드 단추가 꺼져 있으면(심사 중) 계좌이체가 주 단추.
  const btn = h('button', { class: canPay ? 'btn line block' : 'btn main block big', type: 'button', text: canPay ? '계좌이체로 신청' : card ? `${won(amount)} 계좌이체로 신청` : `${won(amount)} 신청하기`, disabled: true, onclick: () => busy(btn, st, async () => {
    if (!ready()) throw notReady();
    const r = await billCall('order', body());
    toast('신청했어요. 계좌로 이체해 주세요');
    S.draft = { label: '', name: '', plan: 'album', months: 1, album: '' }; saveDraft(); S.labelOk = null;
    // 먼치킨.com 첫 페이지에서 신청했으면 계좌·입금자명이 보이는 신청 화면으로
    if (HOME) { go('apply'); return; }
    await loadInfo(); S.view = 'apply'; paint();
    setTimeout(() => $('#order-' + r.order.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }) });
  orderBtnRef = btn;
  if (!card) return [h('p', { class: 'lead-s', text: bankLead }), st, btn];
  const cst = statusEl();
  const payer = canPay ? payerBox(key, cst) : null;
  const payBtn = h('button', { class: canPay ? 'btn main block big' : 'btn line block', type: canPay ? 'submit' : 'button', text: `${won(amount)} 카드로 결제`, disabled: true, 'aria-describedby': canPay ? null : 'card-closed-' + key });
  if (canPay) payBtnRef = payBtn;
  return [
    canPay ? [
      h('p', { class: 'lead-s', text: wantAlbum ? '카드로 결제하면 바로 앨범이 만들어져요.' : '카드로 결제하면 바로 이용 기간이 늘어나요.' }),
      testBadge(),
      h('form', { class: 'stack', noValidate: true, onsubmit: (e) => {
        e.preventDefault();
        busy(payBtn, cst, async () => { if (!ready()) throw notReady(); await payWithCard(body(), cst, payer); });
      } }, payer.el, cst, payBtn)
    ] : [payBtn, h('p', { class: 'hint', id: 'card-closed-' + key, text: CARD_CLOSED })],
    orLine('또는 계좌이체'),
    canPay ? null : h('p', { class: 'lead-s', text: bankLead }),
    st, btn,
    canPay ? h('p', { class: 'hint', text: `계좌이체는 ${bankLead}` }) : null
  ];
}
// 추억앨범 첫 화면 이용권 칸(2026-11-23 사용자 "이용권 신청 쪽이 좀 부자연스럽다" → 상품 상세 페이지의 "옵션 고르기"처럼):
//  맨 위 띠(글 그대로) → [1개월 | 1년] 한 줄 → 추억앨범 상품 카드 둘(추억앨범만 · 먼치킨 + 추억앨범 — 첫 페이지 가격표 .pt 모양) → 먼치킨만은 작은 링크.
//  값·할인은 신청 화면·첫 페이지 가격표와 같은 planModel(서버 가격 — 숫자를 새로 박지 않는다). 신청 단추는 카드마다 하나:
//  로그인 전이면 로그인 창(가입 길은 그 안과 아래 작은 글), 로그인했으면 고른 종류·기간 그대로 신청 화면(주소·앨범 이름 → 결제).
//  먼치킨.com 첫 페이지(HOME)는 priceTable(카드 셋)을 따로 쓴다 — 여기는 추억앨범 페이지만.
const ALBUM_PLANS = [['album', '추억앨범만', '내이름.먼치킨.com 추억앨범'], ['bundle', '먼치킨 + 추억앨범', '추억앨범과 먼치킨 봇 · 송출은 무료 덤']];
function albumApply(k) {
  S.draft.plan = k; saveDraft();
  if (!S.session) { S.next = 'apply'; openSheet('login'); return; }
  go('apply');
}
function payBox() {
  const src = S.session ? S.info : S.pub;
  if (S.session) ensureInfo(); else ensurePub();
  const out = [paidBanner()];
  if (S.payDone) out.push(payResult());
  const join = () => S.session ? null : h('p', { class: 'pt-join' }, '계정이 없나요? ', linkBtn('1분이면 가입해요', () => openSheet('signup')));
  // 서버 가격을 아직 못 받았거나 못 받았으면: 처음 HTML 의 가격 글을 그대로(불러오는 동안 깜빡이지 않게 · 서버가 답하지 않아도 가격이 보이게)
  if (!src?.prices) {
    const list = STATIC_PRICES ? Object.assign(STATIC_PRICES.cloneNode(true), { className: 'orders' }) : h('p', { class: 'muted', text: '이용권을 불러오는 중이에요…' });
    if (!S.session) return [...out, list, h('button', { class: 'btn main block', type: 'button', text: '로그인하고 신청하기', onclick: () => { S.next = 'apply'; openSheet('login'); } }), join()];
    return [...out, list, S.infoError && !src ? [h('p', { class: 'status bad', text: S.infoError }), h('button', { class: 'btn line', type: 'button', text: '다시 불러오기', onclick: () => ensureInfo(true) })] : null];
  }
  if (src.open === false) return [...out, h('p', { class: 'notice', text: '신청을 준비하고 있어요. 조금 뒤에 다시 와 주세요.' })];
  if (S.session) {
    const waiting = (S.info.orders || []).filter((o) => o.state === 'pending').length;
    if (waiting) out.push(h('p', { class: 'notice' }, h('span', { text: `확인을 기다리는 신청이 ${waiting}개 있어요.` }), linkBtn('신청 화면에서 보기', () => go('apply'))));
    if (S.payNote) out.push(h('p', { class: 'status' + (S.payNote.bad ? ' bad' : ''), role: 'status', text: S.payNote.text }));
  }
  const d = S.draft;
  if (![1, 12].includes(d.months)) d.months = 1;
  const year = d.months === 12;
  const albumOk = src.albumOpen !== false;
  const owns = Boolean(S.session && S.info?.albums?.length);
  // 카드마다 따로 계산한다(S.draft.plan 은 건드리지 않는다 — #go=apply&plan=munchkin 으로 온 사람의 고른 것 그대로)
  const at = (k, months) => planModel(src, { plan: k, months }, { albumOk });
  const okOf = (m, k) => Boolean(m.plans.find(([kk]) => kk === k)?.[2]);
  const best = Math.max(0, ...ALBUM_PLANS.map(([k]) => { const m = at(k, 12); return okOf(m, k) ? m.yearSale : 0; }));
  const toggle = segOf([[1, '1개월'], [12, ['1년', best > 0 ? [' ', h('span', { class: 'chip sale', text: `최대 ${best}% 할인` })] : null]]], d.months,
    pickKeep('#mk-pay', '기간', (v) => { d.months = v; }), '기간');
  const cardOf = ([k, name, desc]) => {
    const m = at(k, d.months), y = at(k, 12), ok = okOf(m, k);
    // 할인 표시(사실만): 1년이면 그 종류의 1년 할인, 1개월이면 먼치킨 + 추억앨범이 따로 내는 것보다 싼 만큼
    const off = year ? m.yearSale : k === 'bundle' ? m.bundleSale : 0;
    const label = k === 'album' && owns ? '연장하기' : '신청하기';
    return h('article', { class: 'card pt-card' + (k === 'album' ? ' pt-main' : '') },
      // 먼치킨 + 추억앨범: 둘 다 쓰는 분께만 이득이라 그렇게 적는다(따로 내는 것보다 싼 만큼 — bundleSale)
      k === 'bundle' && ok && m.bundleSale > 0 ? h('p', { class: 'pt-badge soft', text: '먼치킨도 쓴다면' }) : null,
      h('h3', { text: name }),
      h('p', { class: 'hint', text: desc }),
      h('p', { class: 'pt-price' }, h('b', { text: ok ? won(m.amount) : '—' }), h('span', { text: year ? ' / 1년' : ' / 월' })),
      h('p', { class: 'pt-sub' }, ok ? (year ? `한 달 ${won(Math.round(m.amount / 12))}꼴` : `1년 결제 시 ${won(y.amount)}`) : '준비 중이에요', off > 0 && ok ? [' ', h('span', { class: 'chip sale', text: `${off}% 할인` })] : null),
      h('button', { class: 'btn block ' + (k === 'album' ? 'main' : 'line'), type: 'button', text: ok ? label : '준비 중', disabled: !ok, 'aria-label': `${name} ${ok ? label : '준비 중'}`, onclick: () => albumApply(k) }));
  };
  const c = src.card;
  const munchkinOk = okOf(at('munchkin', d.months), 'munchkin');
  out.push(h('div', { class: 'pt-top' }, toggle), h('div', { class: 'pt-grid two' }, ALBUM_PLANS.map(cardOf)),
    munchkinOk ? h('p', { class: 'pt-more' }, '먼치킨 봇만 필요하신가요? ', linkBtn('먼치킨만 신청하기', () => albumApply('munchkin'))) : null,
    h('p', { class: 'hint pt-how', text: c?.show ? (c.mode === 'live' ? '결제는 카드나 계좌이체로 해요.' : CARD_CLOSED) : '결제는 계좌이체로 해요.' }),
    join());
  return out;
}

function applyView() {
  const info = S.info;
  const me = S.me || {};
  if (!info) {
    ensureInfo();
    return h('section', { class: 'sect narrow' }, paidBanner(), sectionHead('추억앨범 신청', '추억앨범 신청하기'),
      h('div', { class: 'card' }, S.infoError ? [h('p', { class: 'status bad', text: S.infoError }), h('button', { class: 'btn line', type: 'button', text: '다시 불러오기', onclick: () => ensureInfo(true) })] : h('p', { class: 'muted', text: '불러오는 중이에요…' })));
  }
  const albums = info.albums || [];
  const owner = albums.length > 0;
  const pending = (info.orders || []).filter((o) => o.state === 'pending');
  const pendingNew = pending.find((o) => o.newAlbum);
  const card = cardOn(), canPay = cardCanPay();
  payBtnRef = null;
  // 맨 위 띠(유료화 1월 1일부터 — 2026-11-23) · 머리
  const parts = [paidBanner(), sectionHead(owner ? '추억앨범 연장' : '추억앨범 신청', owner ? '추억앨범 연장하기' : '추억앨범 신청하기',
    owner ? '쓰고 있는 기간이 남아 있으면 그 끝에 이어서 늘어나요. 한 달 = 30일.'
      : canPay ? '주소 이름·앨범 이름·기간을 고르고 카드로 결제하면 앨범이 바로 만들어져요. 계좌이체도 돼요.' : '주소 이름·앨범 이름·기간을 고르고 계좌로 이체하면, 운영자가 확인한 뒤 앨범이 바로 만들어져요.')];
  // 카드 결제를 막 마쳤으면 그 결과를 맨 위에
  if (S.payDone) parts.push(payResult());

  // 확인을 기다리는 신청
  if (pending.length) parts.push(h('div', { class: 'stack' }, h('h3', { class: 'sub', text: '확인을 기다리는 신청' }), pending.map((o) => orderCard(o, info))));
  if (!info.open) { parts.push(h('div', { class: 'card' }, h('p', { class: 'notice', text: '신청을 준비하고 있어요. 조금 뒤에 다시 와 주세요.' }))); return h('section', { class: 'sect narrow' }, parts); }
  // 2026-11-23 사용자: 아래쪽 "먼치킨(봇 프로그램) 이용권만" 구역을 없애고, 3번 칸에서 [추억앨범만 · 먼치킨만 · 먼치킨 + 추억앨범]을 고른다.
  //  albumClosed = 새 앨범 신청을 받지 않음(운영자가 albumOpen:false) · albumBlocked = 새 앨범 신청이 이미 기다리는 중 → 그때는 먼치킨만 고를 수 있다
  const albumClosed = !owner && info.albumOpen !== true;
  const albumBlocked = !owner && Boolean(pendingNew);
  const albumOk = !albumClosed && !albumBlocked;
  const munchkinOk = munchkinOpen(info);
  if (albumClosed) {
    parts[1] = munchkinOk ? sectionHead('이용권 신청', '먼치킨 이용권 신청하기') : sectionHead('추억앨범 신청', '아직 신청을 받지 않아요');
    parts.push(betaBox());
    if (!munchkinOk) return h('section', { class: 'sect narrow' }, parts);
  }

  // 본인인증은 2026-11-18 뺐다 — 로그인하고 닉네임만 있으면 바로 신청
  if (!me.nickname) {
    parts.push(h('article', { class: 'card' }, h('h3', { text: '닉네임을 먼저 정해 주세요' }), h('p', { class: 'lead-s', text: '입금자명과 앨범 이름에 닉네임이 쓰여요.' }),
      h('button', { class: 'btn main block', type: 'button', text: '닉네임 정하기', onclick: () => openSheet('nickname', {}) })));
    return h('section', { class: 'sect narrow' }, parts);
  }

  const d = S.draft;
  const addons = info.addons || {};
  // 종류·기간·금액·할인은 첫 화면 이용권 칸과 같은 planModel
  const m = planModel(info, d, { owner, albumOk, addons });
  const { quote, amount } = m;
  const album = owner ? (albums.find((a) => a.id === d.album) || albums[0]) : null;
  // 먼치킨만(먼치킨 더하기)은 앨범이 필요 없다 — 주소 이름·앨범 이름 칸을 접는다
  const wantAlbum = !owner && d.plan !== 'munchkin' && d.plan !== 'add-munchkin';

  const nameIn = input('a-name', { maxlength: '40', value: d.name, placeholder: `${me.nickname} 추억앨범` });
  nameIn.addEventListener('input', () => { d.name = nameIn.value; saveDraft(); refreshOrderBtn(); });
  const nameOk = () => { const n = [...(d.name.trim() || `${me.nickname} 추억앨범`)].length; return n >= 2 && n <= 40; };
  const ready = () => amount > 0 && (!wantAlbum || (S.labelOk && S.labelOk.label === d.label && nameOk()));
  const orderBody = () => {
    const body = { plan: d.plan, ...(quote ? {} : { months: d.months }) };
    if (owner && album && d.plan !== 'munchkin') body.album = album.id;
    if (wantAlbum) body.newAlbum = { label: d.label, name: d.name.trim() };
    return body;
  };
  const notReady = () => Error(wantAlbum && !S.labelOk ? '주소 이름을 먼저 정해 주세요.' : '신청 내용을 다시 봐 주세요.');

  const cards = [];
  if (owner) {
    if (d.plan !== 'munchkin') cards.push(h('article', { class: 'card' }, h('h3', { text: albums.length > 1 ? '연장할 앨범' : '내 추억앨범' }),
      albums.length > 1 ? segOf(albums.map((a) => [a.id, a.name || hostText(a.host)]), album.id, (v) => { d.album = v; saveDraft(); paint(); }, '연장할 앨범') : null,
      albumMini(album)));
  } else if (!wantAlbum) {
    // 앨범 칸(1·2)을 한 칸으로 접는다: 새 앨범 신청이 기다리는 중이면 그 안내, 아니면 "먼치킨만은 앨범이 필요 없어요"(운영자가 앨범 신청을 껐으면 위 베타 안내로 충분)
    if (albumBlocked) cards.push(h('article', { class: 'card' }, h('p', { class: 'notice', text: pendingNew.pay === 'card'
      ? `${pendingNew.newAlbum.label}.${SUFFIX} 신청의 카드 결제를 아직 마치지 않았어요. 다른 주소로 새로 신청하려면 그 신청을 먼저 취소해 주세요.`
      : `${pendingNew.newAlbum.label}.${SUFFIX} 신청이 확인을 기다리고 있어요. 다른 주소로 새로 신청하려면 그 신청을 먼저 취소해 주세요.` })));
    else if (!albumClosed) cards.push(h('article', { class: 'card' }, h('h3', { text: '1·2. 주소 이름·앨범 이름' }),
      h('p', { class: 'notice', text: '먼치킨만은 앨범이 필요 없어요. 추억앨범도 함께 쓰려면 아래 3번에서 "먼치킨 + 추억앨범"을 골라 주세요.' })));
  } else {
    // 1. 주소 이름 · 2. 앨범 이름
    const out = statusEl();
    const labelIn = input('a-label', { maxlength: '15', value: d.label, placeholder: '예: 밤톨', autocapitalize: 'none', spellcheck: 'false', autocomplete: 'off', inputmode: 'text' });
    labelIn.addEventListener('input', (e) => { if (!e.isComposing) checkLabel(labelIn.value, out); });
    labelIn.addEventListener('compositionend', () => checkLabel(labelIn.value, out));
    cards.push(
      h('article', { class: 'card' }, h('h3', { text: '1. 주소 이름' }),
        h('p', { class: 'lead-s', text: '내 앨범 주소가 돼요. 한글도 돼요.' }),
        h('div', { class: 'addr' }, h('span', { class: 'addr-pre', text: 'https://' }), labelIn, h('span', { class: 'addr-suf', text: '.' + SUFFIX })),
        out,
        h('p', { class: 'hint', text: '한글·영어 소문자·숫자로 1~15자, - 는 가운데에만. 앨범이 만들어진 뒤에는 바꾸기 어려워요.' })),
      h('article', { class: 'card' }, h('h3', { text: '2. 앨범 이름' }),
        field('a-name', '앨범 이름', nameIn, `사이트 맨 위와 링크 미리 보기에 보여요. 비우면 "${me.nickname} 추억앨범"`)));
    if (d.label) setTimeout(() => checkLabel(d.label, out), 0);
  }
  // 3. 이용권·기간
  cards.push(h('article', { class: 'card', id: 'plan-card' }, h('h3', { text: owner ? '이용권·기간' : '3. 이용권·기간' }), planBlock(m, d, '#plan-card')));
  // 4. 결제(card.show — 모두에게 [카드로 결제], 결제창은 canPay 일 때만) · 4. 신청하고 이체하기(card.show 가 꺼져 있으면 예전 그대로)
  cards.push(h('article', { class: 'card' }, h('h3', { text: card ? (owner ? '결제' : '4. 결제') : (owner ? '신청' : '4. 신청하고 이체하기') }),
    payActions({ amount, body: orderBody, ready, notReady, wantAlbum, key: 'a' })));
  stepperDone = () => [Boolean(S.labelOk), Boolean(S.labelOk) && nameOk(), Boolean(S.labelOk) && amount > 0, false];
  stepperRef = owner || !wantAlbum ? null : stepper(stepperDone());
  parts.push(stepperRef, ...cards);
  setTimeout(refreshOrderBtn, 0);
  return h('section', { class: 'sect narrow' }, parts);
}
// 로그인 전 신청 화면(2026-11-23 — 모두에게 보임): 위 띠 · 이용권과 가격(서버 prices 그대로) · 신청·결제는 로그인한 뒤
function applyGuest() {
  ensurePub();
  const p = S.pub;
  const login = () => { S.next = 'apply'; openSheet('login'); };
  const join = () => { S.next = 'apply'; openSheet('signup'); };
  const ctas = () => h('div', { class: 'row-btns' },
    h('button', { class: 'btn line', type: 'button', text: '회원가입', onclick: join }),
    h('button', { class: 'btn main', type: 'button', text: '로그인하고 신청하기', onclick: login }));
  const per = (m) => (m === 12 ? '1년' : m + '개월');
  let body;
  if (!p) body = h('article', { class: 'card' }, h('p', { class: 'muted', text: '불러오는 중이에요…' }));
  else if (!p.prices) body = h('article', { class: 'card' }, h('p', { class: 'lead-s', text: '로그인하면 이용권과 가격을 보고 바로 신청할 수 있어요.' }), ctas());
  else {
    const rows = [['album', '추억앨범'], ['bundle', '먼치킨 + 추억앨범'], ['munchkin', '먼치킨']].filter(([k]) => p.prices[k] > 0)
      .map(([k, name]) => h('li', null, h('b', { text: name }), h('span', null, `한 달 ${won(p.prices[k])}`, p.year?.[k] > 0 ? h('small', { text: ` · 1년 ${won(p.year[k])}` }) : null)));
    const months = Array.isArray(p.months) && p.months.length ? p.months : null;
    body = [
      h('article', { class: 'card' }, h('h3', { text: '이용권' }),
        rows.length ? h('ul', { class: 'orders' }, rows) : h('p', { class: 'muted', text: '이용권을 준비하고 있어요.' }),
        months ? h('p', { class: 'hint', text: `기간은 ${months.map(per).join('·')} 중에서 골라요. 한 달 = 30일.` }) : null,
        p.albumOpen === false ? h('p', { class: 'hint', text: BETA_TEXT }) : null),
      h('article', { class: 'card' }, h('h3', { text: '신청하기' }),
        h('p', { class: 'lead-s', text: p.open === false ? '신청을 준비하고 있어요. 조금 뒤에 다시 와 주세요.' : '먼치킨 계정으로 로그인하면 이용권과 기간을 고르고 바로 결제할 수 있어요.' }),
        p.card?.show ? h('p', { class: 'hint', text: p.card.mode === 'live' ? '결제는 카드나 계좌이체로 해요.' : CARD_CLOSED }) : null,
        ctas())
    ];
  }
  return h('section', { class: 'sect narrow' }, paidBanner(), sectionHead('이용권 신청', '이용권과 가격', '먼치킨 계정 하나로 먼치킨 프로그램과 추억앨범을 써요.'), body);
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
        kvRow('로그인', m.loginId ? `아이디 ${m.loginId}` : m.kakao ? '카카오' : '—')),
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
          ? (orders.find((o) => o.state === 'pending' && o.newAlbum).pay === 'card'
            ? [h('p', { class: 'muted', text: `${orders.find((o) => o.state === 'pending' && o.newAlbum).newAlbum.label}.${SUFFIX} 신청의 ${CARD_WAIT}` }), h('button', { class: 'btn line block', type: 'button', text: '카드 결제 마치기', onclick: () => go('apply') })]
            : [h('p', { class: 'muted', text: `${orders.find((o) => o.state === 'pending' && o.newAlbum).newAlbum.label}.${SUFFIX} 신청이 확인을 기다리고 있어요. ${WAIT_ALBUM}` }), h('button', { class: 'btn line block', type: 'button', text: '입금 안내 보기', onclick: () => go('apply') })])
          : albumBeta()
            ? [h('p', { class: 'muted', text: '아직 추억앨범이 없어요. ' + BETA_TEXT }), previewBtn('btn main block')]
            : [h('p', { class: 'muted', text: '아직 추억앨범이 없어요.' }), h('button', { class: 'btn main block', type: 'button', text: '추억앨범 신청하기', onclick: () => go('apply') })]),
    h('article', { class: 'card' }, h('h3', { text: '이용권' }),
      h('dl', { class: 'kv' }, kvRow('먼치킨', until('munchkin')), kvRow('추억앨범', until('album')))),
    h('article', { class: 'card' }, h('h3', { text: '내 신청' }),
      !info ? h('p', { class: 'muted', text: '불러오는 중이에요…' })
        : orders.length ? h('ul', { class: 'orders' }, orders.slice(0, 10).map((o) => h('li', null,
          h('span', null, `${PLAN_NAME[o.plan] || o.plan} ${planPeriod(o)} · ${won(o.amount)}${o.pay === 'card' ? ' · 카드' : ''}`, o.newAlbum ? h('small', { text: ` · ${o.newAlbum.label}.${SUFFIX}` }) : null),
          o.state === 'pending' ? h('button', { class: 'link-btn', type: 'button', text: o.pay === 'card' ? '카드 결제 마치기' : o.sent ? '확인 기다리는 중' : '입금 안내 보기', onclick: () => go('apply') })
            : h('span', { class: o.state === 'paid' ? 'good' : 'muted', text: (PLAN_STATE[o.state] || o.state) + (o.note ? ` (${o.note})` : '') }))))
          : h('p', { class: 'muted', text: '아직 신청한 것이 없어요.' })),
    h('p', { class: 'muted small center' }, '탈퇴는 추억앨범 사이트의 내 정보에서 할 수 있어요.'));
}

// 먼치킨 안의 카카오 로그인 창(2026-11-06): 묻지 않는다 — 기다림·로그인했어요·안 됐어요·(로그인 전) 카카오로 로그인
function inAppView() {
  const card = (...kids) => h('section', { class: 'sect narrow' }, h('article', { class: 'card app-card' }, ...kids));
  if (S.appDone === 'ok') return card(
    h('div', { class: 'app-ico ok' }, icon('check')),
    h('h2', { text: '로그인했어요!' }),
    h('p', { class: 'lead-s', text: '먼치킨으로 돌아가요. 이 창은 저절로 닫혀요.' }));
  if (S.appDone === 'wait') return card(
    h('div', { class: 'app-ico wait' }, icon('spin')),
    h('h2', { text: '먼치킨에 로그인하는 중이에요' }),
    h('p', { class: 'lead-s', text: S.me?.nickname ? `${S.me.nickname}님 계정으로 로그인하고 있어요.` : '잠시만 기다려 주세요.' }));
  if (S.appDone && S.session) {
    const again = h('button', { class: 'btn main block', type: 'button', text: '다시 해 보기', onclick: () => autoApprove() });
    return card(
      h('div', { class: 'app-ico bad' }, icon('close')),
      h('h2', { text: '로그인하지 못했어요' }),
      h('p', { class: 'status bad', text: S.appDone }),
      again,
      h('p', { class: 'lead-s small', text: '계속 안 되면 이 창을 닫고 먼치킨에서 [카카오로 로그인]을 다시 눌러 주세요.' }));
  }
  // 로그인 전(카카오에서 그만뒀거나 실패함): 카카오가 먼저, 아이디는 작게.
  //  처음 가입하는 카카오 계정이면(appAge) "만 14세 이상이에요" 체크 칸을 보이고, 체크해야 카카오로 다시 간다(a=1)
  const age = S.appAge ? ageBox('app-age14') : null;
  const ast = statusEl();
  if (age) age.box.addEventListener('change', () => { if (age.box.checked) say(ast, ''); });
  const kakaoGo = () => {
    if (age && !age.box.checked) { say(ast, AGE14_NEED, true); age.box.focus(); return; }
    inAppKakao(Boolean(age));
  };
  return card(
    h('div', { class: 'app-ico kakao' }, kakaoSymbol()),
    h('h2', { text: '카카오로 로그인해 주세요' }),
    S.appNote ? h('p', { class: 'status bad', text: S.appNote }) : h('p', { class: 'lead-s', text: '카카오 계정으로 로그인하면 먼치킨이 저절로 로그인돼요. 처음이면 카카오로 바로 가입돼요.' }),
    age ? [age.wrap, ast] : null,
    h('button', { class: 'kakao-btn big', type: 'button', onclick: kakaoGo }, kakaoSymbol(), h('span', { text: '카카오로 로그인' })),
    h('div', { class: 'links' }, linkBtn('아이디로 로그인', () => openSheet('login'))));
}

// 먼치킨 프로그램 카카오 로그인 승인(?app=)
function appView() {
  if (inApp()) return inAppView();
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

  // 먼치킨 안의 카카오 로그인 창: 로그인돼 있으면 바로 승인, 아니면 처음 한 번은 바로 카카오로(그 뒤엔 [카카오로 로그인] 단추)
  if (inApp()) {
    if (RETURN.loginError) { S.appNote = KAKAO_ERRORS[RETURN.loginError] || KAKAO_ERRORS.fail; S.appAge = RETURN.loginError === 'age14'; S.appDone = ''; paint(); return; }
    if (S.session) { await autoApprove(); return; }
    if (RETURN.kakao && !ss.get('mk_app_kakao:' + S.app)) { inAppKakao(); return; }
    S.appDone = ''; paint();
    return;
  }

  // 휴대폰 카드 결제에서 돌아옴(?pay=…) — 주소는 맨 처음에 이미 지웠다(RETURN.pay 에 떼어 둠)
  if (RETURN.pay) { await payReturn(RETURN.pay); return; }

  if (RETURN.loginError) {
    // 베타 신청에서 [카카오로 시작하기]를 눌렀다가 돌아옴(그만둠·처음 가입 만 14세 체크 등) → 뒤 화면은 베타 신청 그대로
    if ((RETURN.go === 'beta' || ss.get('mk_next') === 'beta') && !S.session) { ss.del('mk_next'); S.next = 'beta'; S.view = 'beta'; paint(); }
    // 처음 카카오로 가입하는데 만 14세 체크가 없었다 → 가입 화면(맨 위 체크 칸)에서 다시
    if (RETURN.loginError === 'age14') { if (!S.session) openSheet('signup', { kakaoAge: true }); return; }
    toast(KAKAO_ERRORS[RETURN.loginError] || KAKAO_ERRORS.fail, RETURN.loginError !== 'cancel');
    if (RETURN.loginError === 'sso-none') openSheet('login');
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
  if (want === 'apply' || want === 'me' || want === 'beta') {
    ss.del('mk_next');
    // 베타 신청은 로그인 창을 먼저 띄우지 않는다(설명·3단계부터, 2026-11-26)
    if (!S.session && want === 'beta') { go('beta'); return; }
    if (!S.session) { S.next = want; openSheet('login'); return; }
    if (RETURN.ticket && S.me && !S.me.nickname && want !== 'beta') { S.next = want; openSheet('nickname', { join: true }); return; }
    go(want);
  } else if (RETURN.ticket && S.session) {
    // 카카오로 막 로그인함 — 닉네임이 없으면 먼저
    afterLogin('로그인했어요');
    return;
  }
  ssoRemember();
}
// ---------- 먼치킨.com 첫 페이지 ----------
// 첫 페이지 가격표(2026-11-23 시안 — 사용자 "이거 저기 있는게 좋은거야?" 뒤 제안): 맨 위 [1개월 | 1년] → 카드 셋(추억앨범만 · 먼치킨만 ★추천 · 먼치킨 + 추억앨범)
//  → 위 띠. 값·할인은 신청 화면과 같은 planModel(두 벌 만들지 않기). [신청하기]: 로그인 전이면 로그인, 먼치킨만이면 이 자리 아래 결제 칸(payActions),
//  추억앨범이 들어가면 album/#go=apply&plan=…&months=… 로.
const PT_PLANS = [['album', '추억앨범만', '나만의 추억앨범 사이트'], ['munchkin', '먼치킨만', '먼치킨 봇 · 송출은 무료 덤'], ['bundle', '먼치킨 + 추억앨범', '봇 + 추억앨범 · 송출은 무료 덤']];
function ptApply(k) {
  S.draft.plan = k; saveDraft();
  if (!S.session) { openSheet('login'); return; }
  if (k !== 'munchkin') { go('apply'); return; }
  if (!S.me?.nickname) { openSheet('nickname', {}); return; }
  S.ptPick = 'munchkin'; paint();
  setTimeout(() => { const p = $('#pt-pay'); p?.scrollIntoView({ behavior: 'smooth', block: 'start' }); p?.querySelector('h3')?.focus({ preventScroll: true }); }, 50);
}
function priceTable(src) {
  const d = S.draft;
  if (![1, 12].includes(d.months)) d.months = 1;
  const albumOk = src.albumOpen !== false;
  const year = d.months === 12;
  const at = (k, months) => planModel(src, { plan: k, months }, { albumOk });
  const okOf = (m, k) => Boolean(m.plans.find(([kk]) => kk === k)?.[2]);
  // 1년 단추의 작은 표시: 종류마다 1년 할인 가운데 가장 큰 것(내림 — planModel 그대로)
  const best = Math.max(0, ...PT_PLANS.map(([k]) => { const m = at(k, 12); return okOf(m, k) ? m.yearSale : 0; }));
  const toggle = segOf([[1, '1개월'], [12, ['1년', best > 0 ? [' ', h('span', { class: 'chip sale', text: `최대 ${best}% 할인` })] : null]]], d.months,
    pickKeep('#mk-pay', '기간', (v) => { d.months = v; }), '기간');
  const cardOf = ([k, name, desc]) => {
    const m = at(k, d.months), y = at(k, 12), ok = okOf(m, k);
    const off = year ? m.yearSale : k === 'bundle' ? m.bundleSale : 0;
    return h('article', { class: 'card pt-card' + (k === 'munchkin' ? ' pt-best' : '') + (S.ptPick === k ? ' on' : '') },
      k === 'munchkin' ? h('p', { class: 'pt-badge', text: '★ 추천' }) : null,
      h('h3', { text: name }),
      h('p', { class: 'hint', text: desc }),
      h('p', { class: 'pt-price' }, h('b', { text: ok ? won(m.amount) : '—' }), h('span', { text: year ? ' / 1년' : ' / 월' })),
      h('p', { class: 'pt-sub' }, ok ? (year ? `한 달 ${won(Math.round(m.amount / 12))}꼴` : `1년 결제 시 ${won(y.amount)}`) : '준비 중이에요', off > 0 && ok ? [' ', h('span', { class: 'chip sale', text: `${off}% 할인` })] : null),
      h('button', { class: 'btn block ' + (k === 'munchkin' ? 'main' : 'line'), type: 'button', text: ok ? '신청하기' : '준비 중', disabled: !ok, 'aria-label': `${name} 신청하기`, onclick: () => ptApply(k) }));
  };
  const out = [];
  if (S.payDone) out.push(payResult());
  if (S.session) {
    const waiting = (S.info?.orders || []).filter((o) => o.state === 'pending').length;
    if (waiting) out.push(h('p', { class: 'notice' }, h('span', { text: `확인을 기다리는 신청이 ${waiting}개 있어요.` }), linkBtn('신청 화면에서 보기', () => go('apply'))));
  }
  out.push(h('div', { class: 'pt-top' }, toggle), h('div', { class: 'pt-grid' }, PT_PLANS.map(cardOf)));
  // 먼치킨만 [신청하기]를 누른 뒤(로그인함): 이 자리에서 결제 — 카드/계좌이체 규칙은 신청 화면과 같은 payActions
  if (S.session && S.ptPick === 'munchkin' && S.draft.plan === 'munchkin') {
    const m = at('munchkin', d.months);
    out.push(h('article', { class: 'card pt-pay', id: 'pt-pay' },
      h('h3', { tabindex: '-1', text: `먼치킨만 · ${year ? '1년' : '1개월'} ${won(m.amount)}` }),
      S.payNote ? h('p', { class: 'status' + (S.payNote.bad ? ' bad' : ''), role: 'status', text: S.payNote.text }) : null,
      payActions({ amount: m.amount, body: () => ({ plan: 'munchkin', months: d.months }), ready: () => m.amount > 0, notReady: () => Error('신청 내용을 다시 봐 주세요.'), wantAlbum: false, key: 'h' })));
    setTimeout(refreshOrderBtn, 0);
  }
  const c = src.card;
  out.push(paidBanner(),
    !S.session ? h('p', { class: 'hint', text: '신청과 결제(카드·계좌이체)는 먼치킨 계정으로 로그인한 뒤에 해요.' }) : null,
    !S.session && c?.show && c.mode !== 'live' ? h('p', { class: 'hint', text: CARD_CLOSED }) : null);
  return out;
}
// 머리줄: 로그인 전 [로그인] [회원가입] · 로그인하면 [내 정보](album/ 내 정보)
function homeAuth() {
  if (S.session && S.me) return h('a', { class: 'btn line sm', href: ALBUM_URL + '#go=me' }, '내 정보');
  return [h('button', { class: 'btn line sm', type: 'button', text: '로그인', onclick: () => openSheet('login') }),
    h('button', { class: 'btn line sm join', type: 'button', text: '회원가입', onclick: () => openSheet('signup') })];
}
function paintHome() {
  $('#mk-auth')?.replaceChildren(...[homeAuth()].flat());
  $('#mk-beta')?.replaceChildren(...[betaStrip()].filter(Boolean));
  // 첫 화면 추억앨범 칸: 설명 글 아래(미리 보기 단추 위)에 베타 단추
  const albumCopy = $('#album .album-copy');
  if (albumCopy) {
    let slot = $('#mk-beta-album');
    if (!slot) { slot = h('div', { id: 'mk-beta-album' }); (albumCopy.querySelector('.album-note') || albumCopy.lastElementChild)?.after(slot); }
    slot.replaceChildren(...[betaCta()].filter(Boolean));
  }
  const box = $('#mk-pay');
  if (!box) return;
  // 서버 가격을 아직 못 받았거나 못 받았으면: 처음 HTML(위 띠·가격 글)을 그대로 두고, 로그인 전이면 album/ 로 가던 링크만
  //  이 페이지에서 여는 [회원가입] [로그인하고 신청하기] 줄로 바꾼다(깜빡임 없게 — 2026-11-23 검토)
  const src = S.session ? S.info : S.pub;
  if (!src?.prices && !S.payDone) {
    if (S.session) ensureInfo(); else ensurePub();
    // 가격표의 [신청하기](album/ 로 가는 처음 링크)를 이 페이지에서 로그인 창을 여는 단추로
    if (!S.session) for (const a of box.querySelectorAll('.pt-card a.btn')) a.replaceWith(h('button', { class: a.className, type: 'button', text: a.textContent, 'aria-label': a.getAttribute('aria-label'), onclick: () => openSheet('login') }));
    return;
  }
  box.replaceChildren(...priceTable(src).flat(Infinity).filter((x) => x != null && x !== false));
  breakSentences(box);
}
async function startHome() {
  paint();
  const cfg = loadMembersConfig();
  // 카카오·다른 앨범에서 로그인하고 돌아옴(#bjlogin)
  if (RETURN.ticket) {
    try { const r = await memberCall('ticket', { ticket: RETURN.ticket }); setSession(r.session, r.member); ls.set('mk_sso_at', String(Date.now())); }
    catch (e) { toast(e.message, true); }
  } else if (S.session) await loadMe();
  await cfg;
  if (RETURN.sso === 'ok') ls.set('mk_sso_at', String(Date.now()));
  paint();
  // 로그인한 뒤 서버 쿠키를 맡기고 돌아왔으면 이용권 칸으로
  if (ss.get('mk_after_sso') === 'pay') { ss.del('mk_after_sso'); setTimeout(() => $('#pay')?.scrollIntoView({ block: 'start' }), 300); }
  if (RETURN.loginError) {
    if (RETURN.loginError === 'age14') { if (!S.session) openSheet('signup', { kakaoAge: true }); return; }
    toast(KAKAO_ERRORS[RETURN.loginError] || KAKAO_ERRORS.fail, RETURN.loginError !== 'cancel');
    return;
  }
  if (RETURN.ticket && S.session) afterLogin('로그인했어요');
}
if (HOME) startHome(); else start();
