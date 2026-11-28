// 먼치킨.com 첫 화면(2026-11-28 새 흐름 「시안 D」): 눌러 보는 방송 채팅 창 셋(통장 · 미니게임 · 뽑기판) · 시즌 2 시작 표시 ·
// 키우기 영상은 보일 때만 재생(멈춤 단추) · 장면이 화면에 들어올 때 한 번 올라오며 나타나기. 움직임 줄이기면 모두 멈춰요.
// 처음 열었을 때부터 채팅 창은 이미 한 번 주고받은 모습이에요. 스크립트가 꺼져 있으면 통장 창의 첫 글만 보이고(단추는 그대로), 나머지 장면은 처음부터 다 보여요.
// 봇 글은 봇 프로그램이 실제로 보내는 글 그대로예요(메시지를 빼서 줄이기만 — 글자는 안 바꿈). 이름은 모두 지어낸 예시예요.
// who: bot=먼치킨(매니저) · dj=먼치 · a1=밤톨 · a2=달무리 · a3=구름빵 · st=상황 설명(채팅이 아님)
(() => {
  document.documentElement.classList.add('h-js');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const P = { bot: ['먼치킨', '매니저', ''], dj: ['먼치', 'DJ', 'h-dj'], a1: ['밤톨'], a2: ['달무리'], a3: ['구름빵'] };
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const row = ([who, text]) => {
    if (who === 'st') return el('p', 'h-st', text);
    const [name, role, rc] = P[who];
    const w = el('p', 'h-who', name);
    if (role) w.append(el('span', ('h-role ' + rc).trim(), role));
    if (who !== 'bot') { const m = el('div', 'h-msg h-me'); m.append(w, el('p', 'h-bub', text)); return m; }
    const m = el('div', 'h-msg h-bot');
    const av = el('span', 'h-av'); av.setAttribute('aria-hidden', 'true');
    const i = el('img'); i.src = 'munchkin-64.png'; i.alt = ''; i.width = 28; i.height = 28; av.append(i);
    const body = el('div'); body.append(w, el('p', 'h-bub', text)); m.append(av, body); return m;
  };
  // 차례로 보여 주기(움직임 줄이기면 한 번에). 다른 단추를 누르면 앞 차례는 멈춰요(token)
  const play = (box, rows, token) => {
    box.replaceChildren();
    if (still) { box.append(...rows.map(row)); return; }
    rows.forEach((r, i) => setTimeout(() => { if (box.dataset.t !== token) return; const n = row(r); n.classList.add('h-pop'); box.append(n); }, i * 650));
  };
  // 단추 묶음 + 채팅 창 하나: 처음엔 첫 장면을 채워 두고, 누르면 그 장면을 흘려보내요
  const tryChat = (outId, btnSel, key, scenes, first) => {
    const out = document.getElementById(outId);
    const btns = [...document.querySelectorAll(btnSel)];
    if (!out || !btns.length) return;
    const show = (k, quiet) => {
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[key] === k)));
      const t = String(Date.now()); out.dataset.t = t;
      if (quiet) { out.replaceChildren(...scenes[k].map(row)); return; }
      play(out, scenes[k], t);
    };
    btns.forEach((b) => b.addEventListener('click', () => show(b.dataset[key])));
    show(first, true);
  };

  // 1. 통장 — 청취자 달무리가 되어 명령을 보내요
  tryChat('bank-out', '#bank .h-send button', 'k', {
    shield: [['a2', '!실드 +100'], ['bot', '✅ 실드 +100 적용\n💸 통장 100스푼 차감\n🛡 현재 실드: 100\n🏦 보유 잔액: 0스푼']],
    fund: [['a2', '!펀딩 +100'], ['bot', '✅ 새 마이크 +100 적용\n💸 통장 100스푼 차감\n🎯 현재 새 마이크: 3,100\n🏦 보유 잔액: 0스푼']],
    roul: [['a2', '!룰렛 3'], ['bot', '🎯 달무리님의 기본 룰렛 결과\n1. 노래 한 곡\n2. 꽝\n3. 애교 한 번\n🎟 잔여 기본 룰렛권 0장\n🏦 통장 90스푼 사용 (3회 × 30)\n💰 남은 통장 10스푼']],
    menu: [['a2', '!메뉴 1'], ['bot', '🍽 노래 한 곡 사용 완료\n💸 100스푼 차감\n🏦 현재 통장 0스푼']],
  }, 'shield');

  // 2. 미니게임 — 소통 방송엔 DJ 한 마디, 플리 방송엔 저절로
  tryChat('game-out', '#game .h-seg button', 'g', {
    talk: [['dj', '!초성퀴즈'], ['bot', '🔤 초성퀴즈 시작!\n1/5 [동물] ㄱㅇㅇ\n👉 정답을 채팅으로 적어 주세요\n🎁 복권 1장'], ['a1', '고양이'], ['bot', '🎉 정답! 밤톨님이 맞혔어요\n✅ 고양이\n🎟 밤톨님 복권 1장 지급! (보유 1장)']],
    play: [['st', '🎵 노래만 트는 중 · DJ는 아무것도 안 쳐요'], ['st', '앞 판이 끝나고 1분 뒤'], ['bot', '🔢 업다운 시작!\n1~100 사이 숫자를 하나 정했어요\n👉 숫자만 채팅해 주세요\n🎁 복권 1장'], ['a1', '50'], ['a2', '75'], ['bot', '🔢 업다운 범위 51~74\n밤톨 50 ⬆ 업\n달무리 75 ⬇ 다운']],
  }, 'talk');

  // 3. 뽑기판 25칸 — 청취자 밤톨이 되어 칸을 열어요. 처음엔 4·9·13번이 열려 있고 통장 600스푼에서 시작, 칸마다 30스푼.
  //    판 아래엔 가장 최근 봇 글 한 덩이만(창 높이가 그대로라 페이지가 덜컹하지 않아요)
  const board = document.getElementById('board'), pickOut = document.getElementById('pick-out'), reset = document.getElementById('board-reset');
  if (board && pickOut) {
    const PRIZE = { 3: ['1등', '룰렛권 5장'], 13: ['2등', '복권 2장'], 21: ['2등', '복권 2장'], 7: ['3등', '포인트 100'], 16: ['3등', '포인트 100'], 24: ['3등', '포인트 100'] };
    const CELLS = 25, START = [4, 9, 13];
    let opened, bank;
    const fmt = (n) => n.toLocaleString('ko-KR');
    const open = (n, quiet) => {
      const b = board.children[n - 1]; if (!b || opened.has(n)) return;
      opened.add(n); bank -= 30;
      const p = PRIZE[n];
      b.disabled = true; b.textContent = p ? p[0] : '꽝'; if (p) b.classList.add('h-won');
      b.setAttribute('aria-label', n + '번 칸 열림: ' + (p ? p[0] + ' ' + p[1] : '꽝'));
      const left = CELLS - opened.size, prizeLeft = Object.keys(PRIZE).filter((k) => !opened.has(+k)).length;
      const lines = ['🎁 ' + n + '번 칸 · 밤톨님', p ? '🎉 ' + p[0] + ' 당첨!' : '💨 꽝'];
      if (p) lines.push('🎁 ' + p[1]);
      lines.push('🏦 통장 −30스푼 (남은 ' + fmt(bank) + '스푼)');
      if (left > 0) lines.push('📋 남은 칸 ' + left, '🏆 남은 당첨 ' + prizeLeft);
      const rows = [['bot', lines.join('\n')]];
      if (p && prizeLeft === 0) rows.push(['bot', '🏁 당첨 칸이 모두 나왔어요\n📋 남은 칸 ' + left]);
      const nodes = rows.map(row);
      if (!quiet && !still) nodes.forEach((x) => x.classList.add('h-pop'));
      pickOut.replaceChildren(...nodes);
    };
    const fresh = () => {
      opened = new Set(); bank = 600; board.replaceChildren();
      for (let i = 1; i <= CELLS; i++) { const b = el('button', '', String(i)); b.type = 'button'; b.setAttribute('aria-label', i + '번 칸 열기'); b.addEventListener('click', () => open(i)); board.append(b); }
      START.forEach((n) => open(n, true));
    };
    if (reset) reset.addEventListener('click', fresh);
    fresh();
  }

  // 4. 시즌 2 시작 표시(방문자 시계로 — 글만 바뀌어요)
  const date = document.getElementById('s2-date');
  if (date) {
    const START = Date.parse('2026-12-01T00:00:00+09:00'), END = Date.parse('2027-01-01T00:00:00+09:00'), now = Date.now();
    if (now >= END) date.textContent = '12월 31일에 끝났어요';
    else if (now >= START) date.textContent = '지금 진행 중 · 12월 31일까지';
  }

  // 5. 영상: 화면에 보일 때만 재생, 움직임 줄이기면 저절로 틀지 않아요. 영상 귀퉁이에 멈춤·재생 단추
  const vids = [...document.querySelectorAll('video[data-auto]')];
  vids.forEach((v) => {
    v.muted = true;
    const box = v.closest('.h-screen'); if (!box) return;
    const b = el('button', 'h-vid'); b.type = 'button';
    const paint = () => { b.textContent = v.paused ? '재생' : '멈춤'; b.setAttribute('aria-label', (v.getAttribute('aria-label') || '영상') + (v.paused ? ' 재생' : ' 멈춤')); };
    b.addEventListener('click', () => { if (v.paused) { v.dataset.user = 'play'; v.play().catch(() => {}); } else { v.dataset.user = 'pause'; v.pause(); } });
    v.addEventListener('play', paint); v.addEventListener('pause', paint);
    box.append(b); paint();
  });
  if (vids.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((list) => list.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) { if ((!still || v.dataset.user === 'play') && v.dataset.user !== 'pause') v.play().catch(() => {}); }
      else if (!v.paused) v.pause();
    }), { threshold: 0.4 });
    vids.forEach((v) => io.observe(v));
  }

  // 6. 화면에 들어올 때 한 번: 제목·그림이 12px 올라오며 나타나고, 채팅 창은 마지막 봇 글이 올라오고, 가격 막대가 차올라요
  const seen = (n) => {
    n.classList.add('in');
    if (n.classList.contains('h-chat') && !still) { const last = [...n.querySelectorAll('.h-msg.h-bot')].pop(); if (last) { last.classList.remove('h-pop'); void last.offsetWidth; last.classList.add('h-pop'); } }
  };
  const targets = [...document.querySelectorAll('.h-rv,.h-bars')];
  if (!('IntersectionObserver' in window) || still) targets.forEach(seen);
  else {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { seen(e.target); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    targets.forEach((n) => io.observe(n));
  }
})();
