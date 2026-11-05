// 가짜 서버(미리 보기만): supabase 함수 부르기를 가로채 지어낸 답을 준다. ?mock=new(앨범 없음·로그인 전) · owner(앨범 있음) · pending(신청 기다림)
const SB = 'https://aksegkhhugqvvaidgvro.supabase.co';
const q = new URLSearchParams(location.search);
if (q.get('mock') && q.get('mock') !== '1') sessionStorage.setItem('mock_kind', q.get('mock'));
const kind = sessionStorage.getItem('mock_kind') || 'new';
const now = Date.now(), DAY = 86400000;
const TOKEN = 'T'.repeat(43);
const st = JSON.parse(sessionStorage.getItem('mock_st') || 'null') || {
  me: { id: 'mabcdefghijk', nickname: '밤톨', verified: kind !== 'new' ? now : null, loginId: 'bamtol_dj', kakao: false, role: 'dj' },
  orders: kind === 'pending' ? [{ id: 'oaaaaaaaaaaa', plan: 'album', months: 3, amount: 9000, payer: '밤톨4821', album: null, state: 'pending', created: now - 3600000, sent: null, done: null, nick: '밤톨', until_to: null, newAlbum: { label: '밤톨', name: '밤톨 추억앨범', host: 'xn--qh3bm70b.xn--s22bu18a0ub.com' } },
    { id: 'obbbbbbbbbbb', plan: 'munchkin', months: 1, amount: 3000, payer: '밤톨1111', album: null, state: 'paid', created: now - 40 * DAY, sent: now - 40 * DAY, done: now - 40 * DAY, nick: '밤톨', until_to: null, newAlbum: null }] : [],
  albums: kind === 'owner' ? [{ id: 'aqwertyuio', name: '밤톨 추억앨범', host: 'xn--qh3bm70b.xn--s22bu18a0ub.com', site: 'https://xn--qh3bm70b.xn--s22bu18a0ub.com/', paidUntil: now + 23 * DAY, state: 'active' }] : []
};
const save = () => sessionStorage.setItem('mock_st', JSON.stringify(st));
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const real = window.fetch.bind(window);
window.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.startsWith(SB)) return real(url, init);
  await new Promise((r) => setTimeout(r, 250));
  const path = new URL(u).pathname;
  const b = init.body ? JSON.parse(init.body) : {};
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
      case 'info': return reply({ ok: true, open: true, bank: { bank: '토스뱅크', number: '1000-0000-0000', holder: '제이원스튜디오' }, prices: { munchkin: 3000, album: 3000, bundle: 5000 }, year: { munchkin: 30000, album: 30000, bundle: 50000 }, months: [1, 3, 6, 12], addons: {}, ents: { munchkin: now + 12 * DAY, ...(st.albums[0] ? { album: st.albums[0].paidUntil } : {}) }, owns: st.albums.map((a) => a.id), albums: st.albums, orders: st.orders, admin: false });
      case 'album-name': {
        const label = String(b.label || '').normalize('NFC').trim().toLowerCase();
        if (label === 'test') return reply({ ok: true, label, host: '', free: false, reason: '쓸 수 없는 주소 이름이에요. 다른 이름을 골라 주세요.' });
        if (label === '하늘') return reply({ ok: true, label, host: 'xn--x', free: false, reason: '이미 쓰이고 있는 주소예요. 다른 이름을 골라 주세요.' });
        return reply({ ok: true, label, host: new URL('https://' + label + '.먼치킨.com').hostname, free: true });
      }
      case 'order': {
        const o = { id: 'o' + Math.random().toString(36).slice(2, 13).padEnd(11, 'z'), plan: b.plan, months: b.months || 0, amount: b.plan === 'bundle' ? 5000 * (b.months || 1) : 3000 * (b.months || 1), payer: '밤톨' + (1000 + Math.floor(Math.random() * 9000)), album: b.album || null, state: 'pending', created: Date.now(), sent: null, done: null, nick: st.me.nickname, until_to: null,
          newAlbum: b.newAlbum ? { label: b.newAlbum.label, name: b.newAlbum.name || st.me.nickname + ' 추억앨범', host: new URL('https://' + b.newAlbum.label + '.먼치킨.com').hostname } : null };
        st.orders.unshift(o); save();
        return reply({ ok: true, order: o, bank: {} });
      }
      case 'sent': { const o = st.orders.find((x) => x.id === b.id); if (o) o.sent = Date.now(); save(); return reply({ ok: true, order: o }); }
      case 'cancel': { const o = st.orders.find((x) => x.id === b.id); if (o) { o.state = 'canceled'; o.done = Date.now(); } save(); return reply({ ok: true, order: o }); }
    }
  }
  return reply({ ok: false, error: '미리 보기' }, 404);
};
