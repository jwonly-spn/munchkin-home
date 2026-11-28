// 가짜 서버(미리 보기만): supabase 함수 부르기를 가로채 지어낸 답을 준다. ?mock=new(앨범 없음) · owner(앨범 있음) · pending(신청 기다림 — 입금 화면·현금영수증 칸) · open(new 와 같음 — 예전 이름)
//  2026-11-23 모두에게 결제창: 서버 기본이 열림(albumOpen true · 먼치킨 신청 지금부터) · 카드 단추는 모두(show) · 결제창은 canPay 인 심사 계정·운영자만(테스트 채널)
//  tester(심사 계정 — canPay·테스트 모드) · tester-wait(심사 계정 + 결제 안 끝난 카드 신청 하나) · beta(운영자가 albumOpen:false 로 끔) · cardoff(card.on off)
//  legacy(바뀌기 전 서버 답 — card 없음·albumOpen 없음·먼치킨 12/1) · 로그인 전 prices 는 sessionStorage mock_pub=0 이면 예전 서버처럼 401
//  가짜 결제창(window.__mkMockPortOne): sessionStorage mock_pay 가 ok·late(반영 늦음)·cancel·fail·mobile-ok·mobile-cancel 이면 그대로 하고, 없으면 화면에 가짜 창을 띄워 고르게 한다.
//  실제 포트원·KG 에는 아무것도 보내지 않는다(이 파일은 올리는 파일이 아님 — tools/preview.mjs 가 /album/mock.js 로만 준다).
//  인생역전 연결 번호(2026-11-28, album/#go=life): life-none(캐릭터 없음 — 동의 뒤 번호) · life-char(캐릭터 있음 — 지어낸 "먼치")
//   · life-used(life-char 와 같은데 [번호 지우기]를 누르면 지울 번호가 없었다고 답함 — 남이 먼저 썼거나 시간이 지남, cancel removed:false)
//   서버 life 웹 길(/functions/v1/life/me)과 같은 모양으로 답한다: me → {char} · code {agree?} → {code, until} · erase · cancel · rekey · 세션이 없으면 401.
//   로그인된 모습을 보려면 페이지보다 먼저 localStorage mk_session 에 가짜 표('T' 43자)를 넣는다(사진 도구 preload).
const SB = 'https://aksegkhhugqvvaidgvro.supabase.co';
const q = new URLSearchParams(location.search);
if (q.get('mock') && q.get('mock') !== '1') sessionStorage.setItem('mock_kind', q.get('mock'));
const kind = sessionStorage.getItem('mock_kind') || 'new';
const tester = kind === 'tester' || kind === 'tester-wait';
const now = Date.now(), DAY = 86400000;
const TOKEN = 'T'.repeat(43);
const PLAN = { munchkin: '먼치킨', album: '추억앨범', bundle: '먼치킨 + 추억앨범' };
const st = JSON.parse(sessionStorage.getItem('mock_st') || 'null') || {
  me: { id: 'mabcdefghijk', nickname: '밤톨', verified: kind !== 'new' ? now : null, loginId: 'bamtol_dj', kakao: false, role: 'dj' },
  orders: kind === 'pending' ? [{ id: 'oaaaaaaaaaaa', plan: 'album', months: 3, amount: 9000, payer: '밤톨4821', album: null, state: 'pending', created: now - 3600000, sent: null, done: null, nick: '밤톨', until_to: null, newAlbum: { label: '밤톨', name: '밤톨 추억앨범', host: 'xn--qh3bm70b.xn--s22bu18a0ub.com' }, pay: 'bank', payAt: null },
    { id: 'obbbbbbbbbbb', plan: 'munchkin', months: 1, amount: 3000, payer: '밤톨1111', album: null, state: 'paid', created: now - 40 * DAY, sent: now - 40 * DAY, done: now - 40 * DAY, nick: '밤톨', until_to: null, newAlbum: null, pay: 'bank', payAt: null }]
    : kind === 'tester-wait' ? [{ id: 'occccccccccc', plan: 'bundle', months: 1, amount: 5000, payer: '밤톨2468', album: null, state: 'pending', created: now - 600000, sent: null, done: null, nick: '밤톨', until_to: null, newAlbum: null, pay: 'card', payAt: null },
      { id: 'oddddddddddd', plan: 'munchkin', months: 1, amount: 3000, payer: '밤톨1357', album: null, state: 'test', created: now - 2 * DAY, sent: null, done: now - 2 * DAY, nick: '밤톨', until_to: null, newAlbum: null, pay: 'card', payAt: now - 2 * DAY }]
      : [],
  albums: kind === 'owner' ? [{ id: 'aqwertyuio', name: '밤톨 추억앨범', host: 'xn--qh3bm70b.xn--s22bu18a0ub.com', site: 'https://xn--qh3bm70b.xn--s22bu18a0ub.com/', paidUntil: now + 23 * DAY, state: 'active' }] : [],
  paid: {}   // 가짜 결제창에서 결제한 paymentId → 'ok' | 'fail'
};
// 인생역전 캐릭터(View 모양 — 지어낸 이름·숫자). life-char 만 처음부터 있다.
const LIFE_CHAR = { name: '먼치', rank: 5, rankName: '대리', money: 1284500, works: 412, rankWorks: 37, titles: ['🚲 자전거 출근러', '🍀 대박 인생'], top: false, promo: null };
if (!('life' in st)) st.life = kind === 'life-char' || kind === 'life-used' ? LIFE_CHAR : null;
const save = () => sessionStorage.setItem('mock_st', JSON.stringify(st));
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
// 서버 info.card(변경-1123 Ruling 4): {show, canPay, mode, storeId, channelKey} — show 가 거짓이면 키는 빈 글
const legacy = kind === 'legacy';
const card = legacy ? undefined : kind === 'cardoff' ? { show: false, canPay: false, mode: 'test', storeId: '', channelKey: '' }
  : { show: true, canPay: tester, mode: 'test', storeId: 'store-mock', channelKey: 'channel-key-mock' };
const PAID_FROM = Date.parse('2027-01-01T00:00:00+09:00');
const pub = () => ({ ok: true, open: true, prices: { munchkin: 3000, album: 3000, bundle: 5000 }, year: { munchkin: 30000, album: 30000, bundle: 50000 }, months: [1, 3, 6, 12], albumOpen: kind !== 'beta', munchkinPaidFrom: PAID_FROM, now: Date.now(),
  card: { show: kind !== 'cardoff', canPay: false, mode: 'test', storeId: '', channelKey: '' } });
const amountOf = (b) => (b.months === 12 ? (b.plan === 'bundle' ? 50000 : 30000) : b.plan === 'bundle' ? 5000 * (b.months || 1) : 3000 * (b.months || 1));
const periodOf = (o) => (o.months === 12 ? '1년' : o.months + '개월');
const newOrder = (b, pay) => ({ id: 'o' + Math.random().toString(36).slice(2, 13).padEnd(11, 'z'), plan: b.plan, months: b.months || 0, amount: amountOf(b), payer: '밤톨' + (1000 + Math.floor(Math.random() * 9000)), album: b.album || null, state: 'pending', created: Date.now(), sent: null, done: null, nick: st.me.nickname, until_to: null,
  // 심사 보기 신청은 새 앨범 주소를 잡아 두지 않는다(설계안 3장 — want_host 비움 → newAlbum 없음)
  newAlbum: b.newAlbum && !(pay === 'card' && tester) ? { label: b.newAlbum.label, name: b.newAlbum.name || st.me.nickname + ' 추억앨범', host: new URL('https://' + b.newAlbum.label + '.먼치킨.com').hostname } : null,
  pay, payAt: null });
const real = window.fetch.bind(window);
window.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.startsWith(SB)) return real(url, init);
  await new Promise((r) => setTimeout(r, 250));
  const path = new URL(u).pathname;
  const b = init.body ? JSON.parse(init.body) : {};
  const sess = Boolean(init.headers?.['x-bj-session']);
  if (path.endsWith('/members-config')) return reply({ ok: true, members: { password: true, kakao: true, verify: { storeId: 'store-test', channelKey: 'channel-test' } } });
  if (path.endsWith('/sso-check')) return reply({ ok: true, none: true });
  if (path.endsWith('/bakje/member')) {
    switch (b.action) {
      case 'login': case 'signup': case 'ticket': return reply({ ok: true, session: TOKEN, member: st.me });
      case 'me': return reply({ ok: true, member: st.me, banned: false, owns: st.albums.map((a) => a.id) });
      case 'nickname': st.me.nickname = b.nickname; save(); return reply({ ok: true, member: st.me });
      case 'logout': return reply({ ok: true });
      case 'app-approve': return b.id === 'app-' + 'x'.repeat(20) ? reply({ ok: false, error: '로그인 시간이 지났어요. 먼치킨 프로그램에서 다시 해 주세요.' }, 410) : reply({ ok: true });
      case 'verify-start': return reply({ ok: true, id: 'bjv-' + 'a'.repeat(20) });
      case 'sso-ticket': return reply({ ok: false, error: '미리 보기' }, 400);
      case 'password': return reply({ ok: true });
    }
    return reply({ ok: false, error: '미리 보기에서 안 되는 요청' }, 400);
  }
  if (path.endsWith('/bakje-billing')) {
    switch (b.action) {
      case 'info': return !sess ? reply({ ok: false, error: '다시 로그인해 주세요.' }, 401) : legacy ? reply({ ok: true, open: true, albumOpen: false, munchkinFrom: Date.parse('2026-12-01T00:00:00+09:00'), munchkinPaidFrom: PAID_FROM, bank: { bank: '토스뱅크', number: '1000-0000-0000', holder: '뉴비랩' }, prices: { munchkin: 3000, album: 3000, bundle: 5000 }, year: { munchkin: 30000, album: 30000, bundle: 50000 }, months: [1, 3, 6, 12], addons: {}, ents: { munchkin: now + 12 * DAY }, owns: [], albums: st.albums, orders: st.orders, admin: false })
        : reply({ ok: true, open: true, albumOpen: kind !== 'beta', munchkinFrom: Date.parse('2026-11-23T00:00:00+09:00'), munchkinPaidFrom: PAID_FROM, now: Date.now(), bank: { bank: '토스뱅크', number: '1000-0000-0000', holder: '뉴비랩' }, prices: { munchkin: 3000, album: 3000, bundle: 5000 }, year: { munchkin: 30000, album: 30000, bundle: 50000 }, months: [1, 3, 6, 12], addons: {}, ents: { munchkin: now + 12 * DAY, ...(st.albums[0] ? { album: st.albums[0].paidUntil } : {}) }, owns: st.albums.map((a) => a.id), albums: st.albums, orders: st.orders, admin: false, card });
      // 로그인 전 방문자(머리말 x-bj-session 없음): 이용권·가격·위 띠 시각만
      case 'prices': return sessionStorage.getItem('mock_pub') === '0' ? reply({ ok: false, error: '다시 로그인해 주세요.' }, 401) : reply(pub());
      case 'album-name': {
        const label = String(b.label || '').normalize('NFC').trim().toLowerCase();
        if (label === 'test') return reply({ ok: true, label, host: '', free: false, reason: '쓸 수 없는 주소 이름이에요. 다른 이름을 골라 주세요.' });
        if (label === '하늘') return reply({ ok: true, label, host: 'xn--x', free: false, reason: '이미 쓰이고 있는 주소예요. 다른 이름을 골라 주세요.' });
        return reply({ ok: true, label, host: new URL('https://' + label + '.먼치킨.com').hostname, free: true });
      }
      case 'order': {
        const o = newOrder(b, 'bank');
        st.orders.unshift(o); save();
        return reply({ ok: true, order: o, bank: {} });
      }
      // 약속 2: order 와 같은 칸 → 같은 내용의 결제 안 끝난 카드 신청이 있으면 그것을 다시
      case 'card-start': {
        if (!card?.canPay) return reply({ ok: false, error: '카드 결제는 아직 준비하고 있어요.' }, 403);
        let o = st.orders.find((x) => x.pay === 'card' && x.state === 'pending' && x.plan === b.plan && x.months === (b.months || 0) && (x.album || null) === (b.album || null));
        if (!o) { o = newOrder(b, 'card'); st.orders.unshift(o); save(); }
        return reply({ ok: true, order: o, pay: { storeId: card.storeId, channelKey: card.channelKey, paymentId: 'mk-' + o.id, orderName: `${PLAN[o.plan] || o.plan} 이용권 ${periodOf(o)}`, totalAmount: o.amount, currency: 'KRW', payMethod: 'CARD', redirectUrl: location.origin + '/album/?pay=' + o.id } });
      }
      // 약속 3: 테스트 채널이라 결제했으면 state test(이용권 없음)
      case 'card-done': {
        const o = st.orders.find((x) => x.id === b.id);
        if (!o) return reply({ ok: false, error: '신청을 찾을 수 없어요.' }, 404);
        const p = st.paid['mk-' + o.id];
        // late: 결제는 했는데 포트원 반영이 늦음 — 처음 물으면 pending, 다시 물으면 끝남
        if (p === 'late') { st.paid['mk-' + o.id] = 'ok'; save(); return reply({ ok: true, state: 'pending', order: o }); }
        if (p === 'ok' && o.state === 'pending') { o.state = 'test'; o.payAt = Date.now(); o.done = Date.now(); save(); }
        if (o.state === 'test') return reply({ ok: true, state: 'test', order: o });
        if (p === 'fail') return reply({ ok: true, state: 'failed', order: o, message: '카드사에서 결제를 거절했어요. 다른 카드로 다시 해 주세요.' });
        return reply({ ok: true, state: 'pending', order: o });
      }
      // 현금영수증(선택, 2026-11-25): 서버 bakje-billing v7 과 같은 검사 — 틀리면 400 · 번호는 회원 답에 넣지 않는다
      case 'sent': {
        const r = b.receipt, number = r && typeof r.number === 'string' ? r.number.replace(/[\s-]+/g, '') : '';
        if (r != null && (typeof r !== 'object' || Array.isArray(r))) return reply({ ok: false, error: '현금영수증 번호를 다시 확인해 주세요.' }, 400);
        if (number) {
          if (r.kind !== 'personal' && r.kind !== 'business') return reply({ ok: false, error: '현금영수증 종류를 골라 주세요.' }, 400);
          const good = r.kind === 'personal' ? /^01[0-9]{8,9}$/.test(number) || /^[0-9]{13,19}$/.test(number) : /^[0-9]{10}$/.test(number);
          if (!good) return reply({ ok: false, error: '현금영수증 번호를 다시 확인해 주세요.' }, 400);
        }
        const o = st.orders.find((x) => x.id === b.id); if (o) o.sent = Date.now(); save(); return reply({ ok: true, order: o });
      }
      case 'cancel': { const o = st.orders.find((x) => x.id === b.id); if (o) { o.state = 'canceled'; o.done = Date.now(); } save(); return reply({ ok: true, order: o }); }
    }
  }
  // 인생역전 연결 번호(서버 life 웹 길 — 2-7 약속과 같은 답)
  if (path.endsWith('/life/me')) {
    if (!sess) return reply({ ok: false, error: '다시 로그인해 주세요.' }, 401);
    switch (b.action) {
      case 'me': return reply({ ok: true, char: st.life });
      case 'code':
        if (!st.life && b.agree !== true) return reply({ ok: false, error: '동의가 필요해요.' }, 400);
        return reply({ ok: true, code: '274815', until: Date.now() + 180000 });
      case 'erase': st.life = null; save(); return reply({ ok: true });
      // 보안 검토(2026-11-28): 살아 있는 번호 지우기 · 캐릭터 번호 새로(모든 방 연결 풀림 — 캐릭터·돈은 그대로)
      case 'cancel': return reply({ ok: true, removed: kind !== 'life-used' });
      case 'rekey': return reply({ ok: true });
    }
    return reply({ ok: false, error: '모르는 요청이에요.' }, 400);
  }
  return reply({ ok: false, error: '미리 보기' }, 404);
};

// 가짜 포트원 결제창 — 실제 PortOne.requestPayment 와 같은 모양으로 답한다(PC: {paymentId, code?, message?} · 휴대폰: redirectUrl 로 넘어감)
window.__mkMockPortOne = {
  async requestPayment(req) {
    window.__mkLastPay = req;   // 시험용: 결제창에 넘긴 값(이 페이지 메모리에만)
    const preset = sessionStorage.getItem('mock_pay') || '';
    const mobile = preset.startsWith('mobile-');
    const pick = preset ? preset.replace('mobile-', '') : await new Promise((resolve) => {
      const wrap = document.createElement('div');
      Object.assign(wrap.style, { position: 'fixed', inset: '0', zIndex: '99', background: 'rgba(0,0,0,.55)', display: 'grid', placeItems: 'center', padding: '16px' });
      const box = document.createElement('div');
      Object.assign(box.style, { background: '#fff', color: '#222', borderRadius: '12px', padding: '20px', width: 'min(360px,100%)', font: '15px/1.5 system-ui,sans-serif', display: 'grid', gap: '10px' });
      const line = (t, bold) => { const p = document.createElement('p'); p.textContent = t; p.style.margin = '0'; if (bold) p.style.fontWeight = '700'; return p; };
      box.append(line('가짜 KG이니시스 결제창 (미리 보기)', true), line(req.orderName), line(Number(req.totalAmount).toLocaleString('ko-KR') + '원'), line(`${req.customer?.fullName || ''} · ${req.customer?.phoneNumber || ''} · ${req.customer?.email || ''}`));
      for (const [v, t] of [['ok', '결제하기'], ['fail', '카드 거절'], ['cancel', '닫기']]) {
        const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = t; Object.assign(bt.style, { minHeight: '44px', borderRadius: '8px', border: '1px solid #999', background: v === 'ok' ? '#E8374E' : '#fff', color: v === 'ok' ? '#fff' : '#222', fontWeight: '700', cursor: 'pointer' });
        bt.addEventListener('click', () => { wrap.remove(); resolve(v); });
        box.append(bt);
      }
      wrap.append(box); document.body.append(wrap);
      box.querySelector('button').focus();
    });
    await new Promise((r) => setTimeout(r, 200));
    if (pick === 'ok' || pick === 'fail' || pick === 'late') { st.paid[req.paymentId] = pick; save(); }
    const fail = pick === 'cancel' ? { code: 'FAILURE_TYPE_PG', message: '결제를 그만뒀어요.' } : pick === 'fail' ? { code: 'FAILURE_TYPE_PG', message: '카드사에서 결제를 거절했어요. 다른 카드로 다시 해 주세요.' } : null;
    if (mobile) {
      const back = new URL(req.redirectUrl);
      back.searchParams.set('paymentId', req.paymentId);
      back.searchParams.set('transactionType', 'PAYMENT');
      if (fail) { back.searchParams.set('code', fail.code); back.searchParams.set('message', fail.message); }
      location.href = back.href;
      return new Promise(() => {});   // 휴대폰은 페이지가 넘어가 끝나지 않는다
    }
    return fail ? { paymentId: req.paymentId, transactionType: 'PAYMENT', ...fail } : { paymentId: req.paymentId, transactionType: 'PAYMENT', txId: 'tx-mock' };
  }
};
