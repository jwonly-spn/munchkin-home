// 먼치킨.com/album #go=life(짧은 주소 먼치킨.com/life) — 인생역전(먼치킨 채팅 게임) 계정 연결 번호 화면. 2026-11-28 첫 판.
//  청취자가 먼치킨 계정(카카오·아이디 — 추억앨범과 같은 계정)으로 로그인 → [연결 번호 받기] → 이 화면에만 6자리 번호(3분 · 한 번)
//  → 먼치킨이 있는 스푼 방 채팅에 "!연결 123456" → 그 방의 나 ↔ 계정 캐릭터가 이어진다(짝은 그 DJ PC 에만).
// 서버 life 웹 길(POST /functions/v1/life/me — 머리글 apikey + x-bj-session): 몸통 {action}
//  me → {ok, char: View|null} · code {agree?: true} → {ok, code: '123456', until}(캐릭터가 없으면 agree 가 있어야 — 없으면 400 "동의가 필요해요.")
//  · erase → {ok}(캐릭터·번호·영수증 지움) · 401 "다시 로그인해 주세요." · 403 "이용이 막힌 계정이에요."
//  · cancel → {ok}(살아 있는 번호 지움) · rekey → {ok}(캐릭터 번호를 새로 — 모든 방의 연결이 풀리고 캐릭터·돈은 그대로)
//   (2026-11-28 보안 검토: 게임이 꺼진 방에 번호를 치면 3분 동안 살아 있어 본 사람이 먼저 쓸 수 있음 → [번호 지우기]·[다른 방 연결 모두 끊기]·주의 글)
//  View = {name, rank, rankName, money, works, rankWorks, titles:[칭호 글], top, promo} — 이 화면은 이름·직급·돈·칭호만 보인다.
// album.js 가 화면을 그릴 때마다 lifeView(ctx) 를 부른다. ctx = album.js 의 h·icon·call·S·go·toast·paint·openSheet·dropSession·busy·say·statusEl
//  · login(아이디 로그인 창 — 로그인하면 이 화면으로) · kakao(카카오 로그인 — 돌아올 주소 ?go=life) · kakaoButton · ageBox · age14Need.
// 화면: (로그인 전) 설명·3단계 + [카카오로 시작하기]·[아이디로 로그인] / (로그인) 캐릭터 없음 = 동의 칸 + [연결 번호 받기](동의 전엔 눌리지 않음)
//  · 캐릭터 있음 = 한 장(직급·돈·칭호) + [연결 번호 받기] + 맨 아래 [다른 방 연결 모두 끊기]·[게임 기록 지우기](둘 다 묻는 창 뒤)
//  / 번호 = 큰 6자리 + 3:00 시계 + [번호 지우기] + "!연결 123456" 복사 + 주의 글 세 줄 → 시간이 지나면 [새 번호].
// 모양: 베타 신청 화면(beta.js)과 같은 집안(bt-* 칸)을 쓰고, 이 화면만의 것(lf-*)은 아래 STYLE 을 문서에 한 번 붙인다
//  (CSSStyleSheet — index.html CSP 가 <style> 을 막아서. album.css 는 건드리지 않음 — 옛 브라우저면 bt-* 모양만으로 보인다).
//  제목(h1·h2)은 글꼴 조각(mk-title.woff2)에 있는 글자만 쓴다("캐릭터"의 '릭', "칭호"의 '칭'은 없어서 제목에 안 씀 — 본문은 괜찮음).
const SB = 'https://aksegkhhugqvvaidgvro.supabase.co';
const LIFE = SB + '/functions/v1/life/me';
const PRIVACY = 'https://xn--hu5bi2af5y.com/privacy.html';
const TTL = 180000;                 // 번호가 사는 시간(봇 contract CODE_TTL_MS 와 같음)
const CODE_RE = /^\d{6}$/;          // contract CODE_RE
const LINK_CMD = '!연결';           // 봇 기본 연결 명령(lifeSettings.linkCmd)
const EXAMPLE = '123456';
const AGREE_TEXT = '게임 기록(캐릭터 이름·게임 돈·직급·칭호)을 먼치킨 서버에 보관하는 데 동의해요. 스푼 아이디·닉네임은 보관하지 않아요.';
// 번호 아래 주의 글(보안 검토 — 사실대로, 세 줄)
const CODE_NOTES = ['이 번호를 다른 사람이 먼저 치면 그 사람 방에 내 캐릭터가 이어져요.', '인생역전이 켜진 방 채팅에만 쳐 주세요.', '연결이 안 됐으면 [번호 지우기]를 눌러 주세요.'];
const REKEY_LINES = ['모든 방송의 연결이 풀려요.', '캐릭터·돈·직급은 그대로예요.', `다시 이으려면 새 번호로 ${LINK_CMD} 해 주세요.`];
const STALE = 60000;
const STYLE = `
.view-life{--bt-pink:#C2255C;--bt-pink-soft:#FFF0F4;--bt-pink-line:#FFC9D5;--bt-blue:#0062C4}
.view-life .sect.narrow{width:min(100% - 32px,600px)}
.lf-hero::after{background-image:url("../art/game.webp");background-position:center bottom}
.lf-kbd{display:inline-block;font:800 .95em/1.3 var(--body);letter-spacing:.01em;font-variant-numeric:tabular-nums;padding:1px 7px;border-radius:7px;background:var(--chip);white-space:nowrap}
.bt-steps .lf-kbd{margin-top:2px}
.lf-agree{margin-top:22px;padding:12px 16px 6px}
.lf-agree .check{align-items:flex-start;font-size:16px;line-height:1.6}
.lf-agree .check input{margin-top:2px;accent-color:var(--bt-blue)}
.lf-agree .bt-view{margin-left:34px}
.lf-card{margin-top:20px;display:grid;gap:14px;padding:20px 22px;border-radius:22px;background:var(--soft);box-shadow:inset 0 0 0 1px var(--line)}
.lf-who{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:800;line-height:1.4;overflow-wrap:anywhere}
.lf-rank{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}
.lf-rank b{font:800 clamp(26px,7vw,32px)/1.2 var(--body);letter-spacing:-.02em}
.lf-rank span{font-size:14px;font-weight:700;color:var(--ink-2)}
.lf-money{display:grid;gap:2px}
.lf-money small,.lf-titles small{font-size:14px;font-weight:700;color:var(--ink-2)}
.lf-money b{font:800 22px/1.3 var(--body);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.lf-titles{display:grid;gap:6px}
.lf-titles ul{display:flex;flex-wrap:wrap;gap:6px}
.lf-titles li{padding:5px 11px;border-radius:10px;background:var(--card);box-shadow:inset 0 0 0 1px var(--line);font-size:14px;font-weight:800;line-height:1.4}
.lf-titles p{font-size:15px;color:var(--ink-2)}
.lf-name-hint{font-size:14px;line-height:1.55;color:var(--ink-2)}
.lf-code-box{margin-top:20px;display:grid;justify-items:center;text-align:center;gap:10px;padding:22px 18px 20px;border-radius:22px;background:var(--soft);box-shadow:inset 0 0 0 1px var(--line)}
.lf-code-box h2{font:800 15px/1.3 var(--body);letter-spacing:.02em;color:var(--ink-2)}
.lf-code-box h2:focus{outline:none}
.lf-code{font:800 clamp(46px,14vw,64px)/1.05 var(--body);letter-spacing:.14em;margin-right:-.14em;font-variant-numeric:tabular-nums;color:var(--ink)}
.lf-bar{width:min(100%,280px);height:6px;border-radius:3px;background:var(--line);overflow:hidden}
.lf-bar i{display:block;height:100%;border-radius:3px;background:var(--coral)}
.lf-timer{font-size:16px;font-weight:800;font-variant-numeric:tabular-nums}
.lf-how{margin-top:6px;font-size:15px;line-height:1.5;color:var(--ink-2)}
.lf-cmd{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px}
.lf-cmd .lf-kbd{font-size:21px;padding:9px 14px;border-radius:12px;background:var(--card);box-shadow:inset 0 0 0 1px var(--line)}
.lf-cmd .btn{gap:6px}
.lf-cmd .btn .ico{width:18px;height:18px}
.lf-warn{width:100%;margin-top:4px;text-align:left;font-size:15px;line-height:1.55;gap:4px}
.lf-cancel{margin-top:-2px}
.lf-done{margin-top:20px}
.lf-ask .sheet-head h2{font-family:var(--body);font-weight:800;font-size:19px;letter-spacing:-.01em}
.lf-ask .sheet-body p{font-size:16px;line-height:1.6}
.lf-ask-btns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:6px}
.lf-ask-btns .btn{white-space:normal;line-height:1.3;padding-inline:12px}
.lf-gone{font-size:20px;font-weight:800}
.lf-code-box .bt-go{width:100%;margin-top:4px}
.lf-next{margin-top:10px;font-size:15px;line-height:1.55}
.lf-foot{display:grid;justify-items:center;gap:4px;margin-top:26px;padding-top:14px;border-top:1px solid var(--line)}
.lf-foot>.status:empty{display:none}
.lf-foot .link-btn{color:var(--ink-2);font-weight:600}
@media (prefers-color-scheme:dark){.view-life{--bt-pink:#FF8FAB;--bt-pink-soft:rgba(255,107,139,.14);--bt-pink-line:rgba(255,143,171,.4);--bt-blue:#8CBDFF}}
@media (max-width:600px){
  .lf-hero{padding-right:120px}
  .lf-hero::after{display:block;right:8px;width:104px;height:118px}
  .lf-card{padding:18px}
}
`;

let C = null;   // 지금 ctx
const L = {
  owner: null,       // 이 상태를 받은 회원(계정이 바뀌면 처음부터)
  char: undefined,   // undefined = 아직 안 물음 · null = 캐릭터 없음 · View
  at: 0, job: null, err: '', blocked: false,
  agree: false,      // 동의 칸(화면에서만 — 번호를 받을 때 agree: true 로 보냄)
  age14: false,      // 로그인 전 만 14세 칸
  code: '', end: 0,  // 받은 번호 · 끝나는 때(이 기기 시계 — 받은 때 + 서버가 준 남은 시간, 이상하면 3분)
  gone: false,       // 번호 시간이 지남 → [새 번호]
  done: '',          // 방금 끝낸 일 한 줄("번호를 지웠어요" · "모든 방의 연결을 끊었어요") — 다음 번호를 받으면 지움
  timer: 0,
  dirty: false       // 번호를 받음 → 방에서 이었을 수 있으니 이 탭이 다시 보이면 캐릭터를 다시 물음
};

// ---------- 작은 도구 ----------
const won = (n) => Math.max(0, Math.floor(Number(n) || 0)).toLocaleString('ko-KR') + '원';
const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const cmdOf = (code) => `${LINK_CMD} ${code}`;
function reset(owner) {
  stopTimer();
  Object.assign(L, { owner, char: undefined, at: 0, job: null, err: '', blocked: false, agree: false, code: '', end: 0, gone: false, done: '', dirty: false });
}
function focusId(id) { setTimeout(() => document.getElementById(id)?.focus({ preventScroll: true }), 30); }
let styled = false;
function ensureStyle() {
  if (styled) return;
  styled = true;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(STYLE);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  } catch { /* 옛 브라우저 — bt-* 모양만으로 */ }
}
// 다시 그리기(쓰던 칸 초점은 되돌림 — beta.js 와 같게)
function repaint() {
  const id = document.activeElement?.id || '';
  C.paint();
  const el = id && document.getElementById(id);
  if (el && el !== document.activeElement) el.focus({ preventScroll: true });
}

// ---------- 서버 ----------
// 로그인 시간이 지남(401) → 로그인 전 화면(설명·로그인 단추)으로
function relogin() {
  C.dropSession();
  reset('');
  setTimeout(() => { C.paint(); C.toast('다시 로그인해 주세요.', true); }, 0);
}
async function lifeCall(action, body = {}) {
  try { return await C.call('', { method: 'POST', body: { action, ...body }, session: true, base: LIFE }); }
  catch (e) { if (e.status === 401) relogin(); throw e; }
}
// quiet: 이미 화면이 있을 때 다시 묻기 — 실패해도 지금 화면 그대로
function load(quiet = false) {
  const owner = L.owner;
  L.job = lifeCall('me')
    .then((r) => {
      if (L.owner !== owner) return;
      L.char = r.char && typeof r.char === 'object' ? r.char : null;
      L.at = Date.now(); L.err = ''; L.blocked = false; L.dirty = false;
    })
    .catch((e) => {
      if (L.owner !== owner) return;
      if (e.status === 403) L.blocked = true;
      else if (!quiet || L.char === undefined) L.err = e.message;
    })
    .finally(() => {
      if (L.owner === owner) L.job = null;
      if (C.S.view === 'life') repaint();
    });
}
// 이 탭이 다시 보이면(스푼 앱에서 !연결 하고 돌아옴 · 오래 둠) 조용히 다시 묻기
let watching = false;
function watchOnce() {
  if (watching) return;
  watching = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !C || C.S.view !== 'life' || !C.S.session || L.job || L.char === undefined) return;
    if (L.dirty || Date.now() - L.at > STALE) load(true);
  });
}

// ---------- 번호 시계 ----------
function stopTimer() { clearInterval(L.timer); L.timer = 0; }
function startTimer() {
  stopTimer();
  L.timer = setInterval(() => {
    const left = L.end - Date.now();
    if (left <= 0) {
      stopTimer();
      L.code = ''; L.end = 0; L.gone = true;
      if (C && C.S.view === 'life') { repaint(); focusId('lf-code-h'); }
      return;
    }
    const t = document.getElementById('lf-timer');
    if (t) t.textContent = `${clock(left)} 남았어요`;
    const bar = document.getElementById('lf-bar');
    if (bar) bar.style.width = `${Math.round((left / TTL) * 1000) / 10}%`;   // CSSOM(속성 아님) — CSP 에 걸리지 않음
  }, 1000);
}
function getCode(btn, st) {
  C.busy(btn, st, async () => {
    let r;
    try { r = await lifeCall('code', L.char ? {} : { agree: true }); }
    catch (e) {
      if (e.status === 403) { L.blocked = true; repaint(); return; }
      if (e.status === 400) load(true);   // 동의가 필요해요(캐릭터가 그새 지워짐 등) → 지금 상태로 다시 그림
      throw e;
    }
    const code = String(r.code ?? '');
    if (!CODE_RE.test(code)) throw Error('번호를 받지 못했어요. 다시 눌러 주세요.');
    const left = Number(r.until) - Date.now();
    L.code = code; L.gone = false; L.dirty = true; L.done = '';
    L.end = Date.now() + (left > 0 && left <= TTL + 5000 ? left : TTL);   // PC 시계가 틀려도 3분 안에서
    startTimer();
    repaint();
    focusId('lf-code-h');
    // 휴대폰에서 번호 칸이 화면 아래로 잘리지 않게(움직임 줄이기를 켠 기기는 바로)
    setTimeout(() => {
      const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.querySelector('.lf-code-box')?.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
    }, 40);
  });
}
// [번호 지우기] — 살아 있는 번호를 서버에서 지운다(게임이 꺼진 방에 쳤거나 남이 봤을 때)
function cancelCode(btn, st) {
  C.busy(btn, st, async () => {
    await lifeCall('cancel');
    stopTimer();
    Object.assign(L, { code: '', end: 0, gone: false, done: '번호를 지웠어요' });
    repaint();
    focusId('lf-done');
  });
}
// 묻는 창(로그인 창과 같은 dialog.sheet 모양 — 사진으로 확인할 수 있게 브라우저 confirm 대신). 고르면 true, 닫거나 그만두면 false.
function ask(title, lines, okText) {
  const { h, icon } = C;
  if (typeof HTMLDialogElement !== 'function' || !HTMLDialogElement.prototype.showModal) return Promise.resolve(confirm([title, ...lines].join('\n')));
  return new Promise((resolve) => {
    let answer = false;
    const ok = h('button', { class: 'btn main', type: 'button', text: okText, onclick: () => { answer = true; d.close(); } });
    const no = h('button', { class: 'btn line', type: 'button', text: '그만두기', onclick: () => d.close() });
    const d = h('dialog', { class: 'sheet lf-ask', 'aria-labelledby': 'lf-ask-h' },
      h('div', { class: 'sheet-in' },
        h('div', { class: 'sheet-head' },
          h('span', { class: 'icon-gap' }),
          h('h2', { id: 'lf-ask-h', text: title }),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': '닫기', onclick: () => d.close() }, icon('close'))),
        h('div', { class: 'sheet-body' }, lines.map((t) => h('p', { text: t })), h('div', { class: 'lf-ask-btns' }, no, ok))));
    d.addEventListener('close', () => { d.remove(); resolve(answer); });
    document.body.append(d);
    d.showModal();
    no.focus();
  });
}
// [다른 방 연결 모두 끊기] — 캐릭터 번호를 새로(rekey): 모든 방의 연결이 풀리고 캐릭터·돈·직급은 그대로
function rekeyBtn(st) {
  const { h } = C;
  return h('button', { class: 'link-btn', type: 'button', text: '다른 방 연결 모두 끊기', onclick: (e) => {
    const btn = e.currentTarget;
    ask('다른 방 연결을 모두 끊을까요?', REKEY_LINES, '모두 끊기').then((yes) => {
      if (!yes) { btn.focus(); return; }
      C.busy(btn, st, async () => {
        await lifeCall('rekey');
        L.done = '모든 방의 연결을 끊었어요';   // 떠 있는 번호는 그대로 둔다(서버가 정함 — 화면이 멋대로 지웠다고 하지 않게)
        repaint();
        focusId('lf-done');
      });
    });
  } });
}
async function copyCmd(text, el) {
  try { await navigator.clipboard.writeText(text); C.toast('복사했어요. 스푼 방 채팅에 붙여 넣어 주세요'); }
  catch {
    try { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch { /* 그대로 */ }
    C.toast('글자를 길게 눌러 복사해 주세요');
  }
}

// ---------- 화면 조각 ----------
function head(eyebrow, title, sub) {
  const { h } = C;
  return [
    h('p', { class: 'bt-eyebrow', text: eyebrow }),
    h('h1', { id: 'lf-title', tabindex: '-1', text: title }),
    sub ? h('p', { class: 'bt-sub', text: sub }) : null
  ];
}
const wrap = (...kids) => C.h('section', { class: 'sect narrow' }, C.h('div', { class: 'bt-box lf-box' }, ...kids));
const kbd = (text) => C.h('span', { class: 'lf-kbd', text });

// 로그인 전 첫 화면: 설명 · 3단계 · [카카오로 시작하기] + 아이디로 로그인
function guestView() {
  const { h } = C;
  const kakaoOn = C.S.members ? C.S.members.kakao === true : true;   // 설정을 아직 못 받았으면 있는 것으로(받으면 다시 그림)
  // 만 14세 칸: 처음 카카오로 가입하는 분이 카카오를 다녀온 뒤 가입 창에 멈추지 않게 여기서 먼저 받는다(베타 신청과 같게)
  const age = kakaoOn && C.ageBox ? C.ageBox('lf-age14') : null;
  const ageSt = age ? C.statusEl() : null;
  if (age) { age.box.checked = L.age14; age.box.addEventListener('change', () => { L.age14 = age.box.checked; if (age.box.checked) C.say(ageSt, ''); }); }
  const start = () => {
    if (!kakaoOn) { C.login(); return; }
    if (age && !age.box.checked) { C.say(ageSt, C.age14Need, true); age.box.focus(); return; }
    C.kakao(true);
  };
  const num = (n) => h('b', { class: 'bt-num', 'aria-hidden': 'true', text: String(n) });
  const item = (n, t, s) => h('li', null, num(n), h('span', null, h('span', { class: 'bt-step-t' }, t), h('small', null, s)));
  let main;
  if (kakaoOn) { main = C.kakaoButton('카카오로 시작하기', start); main.classList.add('big'); }
  else main = h('button', { class: 'btn main block big', type: 'button', text: '로그인하고 시작하기', onclick: start });
  return h('section', { class: 'sect narrow' }, h('div', { class: 'bt-box bt-intro bt-full lf-box' },
    h('div', { class: 'bt-hero lf-hero' },
      h('p', { class: 'bt-badge', text: '먼치킨 채팅 게임' }),
      h('h1', { id: 'lf-title', tabindex: '-1' }, '인생역전,', h('br'), '어느 방에서든 그대로'),
      h('p', { class: 'bt-hero-sub' }, '먼치킨 계정에 캐릭터를 이어 두면 먼치킨이 있는 어느 스푼 방에서든 이어서 키워요.', h('br', { class: 'br-s' }), '알바생부터 세계 최고 부자까지!')),
    h('h2', { class: 'sr', text: '연결은 3단계예요' }),
    h('ol', { class: 'bt-steps' },
      item(1, '먼치킨 계정으로 로그인', kakaoOn ? '카카오로 시작하면 계정이 없어도 바로 만들어져요' : '계정이 없으면 1분이면 가입해요'),
      item(2, '[연결 번호 받기]', '이 화면에만 6자리 번호가 떠요'),
      item(3, ['먼치킨이 있는 스푼 방 채팅에 ', kbd(cmdOf(EXAMPLE))], '어느 방에서 해도 같은 캐릭터로 이어져요')),
    h('p', { class: 'bt-note' }, '번호는 3분 동안 한 번만 써요.', h('br', { class: 'br-s' }), '번호를 받기 전에 방에서 먼저 놀았다면, 그 방에서 연결할 때 그 기록이 계정 캐릭터로 옮겨져요.'),
    h('div', { class: 'bt-cta' },
      age ? h('div', { class: 'bt-age' }, age.wrap, ageSt) : null,
      main,
      h('p', { class: 'bt-alt' }, kakaoOn
        ? h('button', { class: 'link-btn', type: 'button', text: '아이디로 로그인', onclick: () => C.login() })
        : h('button', { class: 'link-btn', type: 'button', text: '회원가입', onclick: () => { C.S.next = 'life'; C.openSheet('signup'); } })))));
}

// 번호 칸: 큰 6자리 + 3:00 시계 + "!연결 123456" 복사 / 시간이 지나면 [새 번호]
function codeBox(st) {
  const { h, icon } = C;
  const title = h('h2', { id: 'lf-code-h', tabindex: '-1', text: '연결 번호' });
  if (L.gone || !L.code) {
    const again = h('button', { class: 'btn block big bt-go', type: 'button', text: '새 번호', onclick: (e) => getCode(e.currentTarget, st) });
    return h('div', { class: 'lf-code-box', role: 'group', 'aria-labelledby': 'lf-code-h' },
      title,
      h('p', { class: 'lf-gone', text: '시간이 지났어요' }),
      h('p', { class: 'hint', text: '번호는 3분 동안만 써요. 새 번호를 받아 주세요.' }),
      st, again);
  }
  const left = Math.max(0, L.end - Date.now());
  const cmd = cmdOf(L.code);
  const cmdEl = kbd(cmd);
  const bar = h('i', { id: 'lf-bar' });
  bar.style.width = `${Math.round((left / TTL) * 1000) / 10}%`;
  return h('div', { class: 'lf-code-box', role: 'group', 'aria-labelledby': 'lf-code-h' },
    title,
    h('p', { class: 'lf-code', 'aria-label': [...L.code].join(' '), text: L.code }),
    h('div', { class: 'lf-bar', 'aria-hidden': 'true' }, bar),
    h('p', { class: 'lf-timer', id: 'lf-timer', role: 'timer', text: `${clock(left)} 남았어요` }),
    h('button', { class: 'link-btn lf-cancel', type: 'button', text: '번호 지우기', onclick: (e) => cancelCode(e.currentTarget, st) }),
    h('p', { class: 'lf-how', text: '먼치킨이 있는 스푼 방 채팅에 이렇게 적어 주세요' }),
    h('div', { class: 'lf-cmd' }, cmdEl,
      h('button', { class: 'btn line small', type: 'button', 'aria-label': `${cmd} 복사`, onclick: () => copyCmd(cmd, cmdEl) }, icon('copy'), '복사')),
    h('div', { class: 'notice warn lf-warn', role: 'note' }, CODE_NOTES.map((t) => h('p', { text: t }))),
    st);
}

// 캐릭터 한 장(이름 · 직급 · 가진 돈 · 칭호)
function charCard(v) {
  const { h } = C;
  const name = String(v.name || '').trim();
  const titles = Array.isArray(v.titles) ? v.titles.filter((t) => typeof t === 'string' && t.trim()) : [];
  return h('section', { class: 'lf-card', 'aria-label': '내 캐릭터' },
    h('p', { class: 'lf-who' }, h('span', { 'aria-hidden': 'true', text: '🪪' }), name ? `${name}의 인생` : '내 인생'),
    h('div', { class: 'lf-rank' }, h('b', { text: String(v.rankName || '알바생') }), h('span', { text: '직급' })),
    h('div', { class: 'lf-money' }, h('small', { text: '가진 돈' }), h('b', { text: won(v.money) })),
    h('div', { class: 'lf-titles' }, h('small', { text: '칭호' }),
      titles.length ? h('ul', { 'aria-label': '칭호' }, titles.map((t) => h('li', { text: t }))) : h('p', { text: '아직 없어요' })),
    name ? null : h('p', { class: 'lf-name-hint' }, '이름이 없으면 방마다 내 스푼 닉네임으로 보여요. 방 채팅에서 ', kbd('!이름 먼치'), ' 처럼 정할 수 있어요.'));
}

function eraseBtn(st) {
  const { h } = C;
  return h('button', { class: 'link-btn', type: 'button', text: '게임 기록 지우기', onclick: (e) => {
    const btn = e.currentTarget;
    ask('게임 기록을 지울까요?', ['캐릭터 이름·게임 돈·직급·칭호가 모두 지워지고 되돌릴 수 없어요.'], '지우기').then((yes) => {
      if (!yes) { btn.focus(); return; }
      C.busy(btn, st, async () => {
        await lifeCall('erase');
        stopTimer();
        Object.assign(L, { char: null, code: '', end: 0, gone: false, done: '', agree: false, dirty: false, at: Date.now() });
        C.toast('게임 기록을 지웠어요');
        C.paint(); window.scrollTo({ top: 0 }); focusId('lf-title');
      });
    });
  } });
}

// 로그인함 — 캐릭터 없음(동의 칸) · 캐릭터 있음(한 장)
function memberView() {
  const { h, statusEl } = C;
  const v = L.char;
  const st = statusEl();
  const showCode = Boolean(L.code) || L.gone;
  let action = null;
  if (showCode) action = codeBox(st);
  else if (!v) {
    // 동의(화면에서만 — 서버는 캐릭터가 없을 때 agree: true 가 있어야 번호를 만든다)
    const hintOf = (on) => (on ? '번호는 이 화면에만 떠요.' : '동의에 체크하면 눌려요.');
    const go = h('button', { class: 'btn block big bt-go', type: 'button', text: '연결 번호 받기', disabled: !L.agree, 'aria-describedby': 'lf-agree-hint' });
    const hint = h('p', { class: 'hint bt-alt', id: 'lf-agree-hint', text: hintOf(L.agree) });
    const box = h('input', { type: 'checkbox', id: 'lf-agree', checked: L.agree });
    box.addEventListener('change', () => { L.agree = box.checked; go.disabled = !box.checked; hint.textContent = hintOf(box.checked); });
    go.addEventListener('click', () => { if (L.agree) getCode(go, st); });
    action = [
      h('div', { class: 'agree bt-agree lf-agree' },
        h('label', { class: 'check', for: 'lf-agree' }, box, h('span', null, h('em', { text: '(필수)' }), ' ' + AGREE_TEXT)),
        h('p', { class: 'bt-view' }, h('a', { href: PRIVACY, target: '_blank', rel: 'noopener' }, '개인정보 처리방침 보기', h('span', { class: 'sr', text: '(새 창)' })))),
      h('div', { class: 'bt-cta' }, st, go, hint)
    ];
  } else {
    action = h('div', { class: 'bt-cta' }, st,
      h('button', { class: 'btn block big bt-go', type: 'button', text: '연결 번호 받기', onclick: (e) => getCode(e.currentTarget, st) }),
      h('p', { class: 'hint bt-alt', text: '새 방에서 내 캐릭터로 놀려면 그 방 채팅에 번호를 적어요.' }));
  }
  // 맨 아래: [다른 방 연결 모두 끊기](캐릭터 카드 아래 · 기록 지우기 위) · [게임 기록 지우기]
  const foot = v ? (() => { const st2 = statusEl(); return h('div', { class: 'lf-foot' }, st2, rekeyBtn(st2), eraseBtn(st2)); })() : null;
  const done = L.done ? h('p', { class: 'status good lf-done', id: 'lf-done', tabindex: '-1', role: 'status', text: L.done }) : null;
  return wrap(
    ...head('인생역전 계정 연결', '연결 번호 받기',
      v ? '번호를 받아 먼치킨이 있는 스푼 방 채팅에 적으면 그 방에서도 이 캐릭터로 이어서 놀아요.'
        : '번호를 받아 먼치킨이 있는 스푼 방 채팅에 적으면 그 방의 내 캐릭터가 이 계정에 이어져요.'),
    v ? charCard(v) : null,
    done,
    action,
    showCode && !L.gone ? h('p', { class: 'hint lf-next', text: v ? '방에서 연결하면 그 방에서도 이 캐릭터로 이어서 놀아요.' : '방에서 연결한 뒤 이 화면을 다시 열면 내 캐릭터가 보여요.' }) : null,
    foot);
}

function loadingView(err, retry) {
  const { h } = C;
  return wrap(...head('인생역전 계정 연결', '연결 번호 받기'),
    err ? [h('p', { class: 'status bad', role: 'alert', text: err }),
      h('div', { class: 'bt-actions' }, h('button', { class: 'btn line', type: 'button', text: '다시 불러오기', onclick: retry }))]
      : h('p', { class: 'muted bt-loading', text: '불러오는 중이에요…' }));
}
function blockedView() {
  const { h } = C;
  return wrap(...head('인생역전 계정 연결', '이용이 막힌 계정이에요', '이 계정으로는 연결 번호를 받을 수 없어요.'),
    h('p', { class: 'hint bt-after' }, '궁금한 점은 운영자(', h('a', { href: 'mailto:likegorogoro@naver.com', text: 'likegorogoro@naver.com' }), ')에게 알려 주세요.'));
}

// ---------- 화면 고르기 ----------
export function lifeView(ctx) {
  C = ctx;
  ensureStyle();
  watchOnce();
  const me = C.S.session ? (C.S.me?.id || '-') : '';
  if (L.owner !== me) reset(me);
  if (!me) return guestView();
  if (L.blocked) return blockedView();
  if (L.char === undefined) {
    if (!L.job && !L.err) load();
    return loadingView(L.err, () => { L.err = ''; load(); C.paint(); });
  }
  // 다른 화면에서 막 들어옴 + 오래된 상태면 조용히 다시 묻기
  if (!document.querySelector('main.view-life') && !L.job && Date.now() - L.at > STALE) load(true);
  return memberView();
}
