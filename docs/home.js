// 먼치킨.com 첫 화면(2026-11-27 개편 「눌러 보는 방송」): 눌러 보는 채팅 · 시즌 2 시작 표시 · 영상은 보일 때만 재생.
// 스크립트가 꺼져 있으면 채팅 창만 비고(단추·설명 글은 그대로), 시즌 2 표시는 처음 글, 영상은 첫 그림만 보여요.
// 봇 글은 봇 프로그램이 실제로 보내는 글 그대로예요(지어낸 봇 글 없음). 입장 인사·후원 감사 두 줄은 봇 화면 [예시 넣기]의 예시 글(DJ가 정하는 글)이라 그렇게 밝혀요.
// 이름은 모두 지어낸 예시예요.
// who: bot=먼치킨(매니저) · dj=먼치 · a1=밤톨 · a2=달무리 · a3=구름빵 · st=상황 설명(채팅이 아님)
(() => {
  const P = { bot: ['먼치킨', '매니저', 'mgr'], dj: ['먼치', 'DJ', 'dj'], a1: ['밤톨'], a2: ['달무리'], a3: ['구름빵'] };
  const SCENES = {
    join: {
      note: 'DJ가 정해 둔 인사말 예시예요. 인사말은 DJ가 직접 적어요.',
      rows: [
        ['st', '밤톨이 방송에 들어와요'],
        ['bot', '밤톨님 어서 오세요!'],
      ],
    },
    gift: {
      note: '처음 설치했을 때부터 나가는 글이에요. 감사 인사말은 DJ가 정해요.',
      rows: [
        ['st', '달무리가 100스푼을 후원해요'],
        ['bot', '🏦 달무리님 100스푼 자동 입금!\n💰 잔액 100스푼\n⏰ 이번 방송 안에 안 쓰면 삭제돼요!\n👉 !실드 명령어로 바로 사용하실 수 있어요.'],
        ['a2', '!실드 +100'],
        ['bot', '✅ 실드 +100 적용\n💸 통장 100스푼 차감\n🛡 현재 실드: 100\n🏦 보유 잔액: 0스푼'],
      ],
    },
    quiz: {
      note: '게임은 DJ나 매니저가 시작해요. 맞히면 복권 1장이 기본이에요.',
      rows: [
        ['dj', '!초성퀴즈'],
        ['bot', '🔤 초성퀴즈 시작!\n1/5 [동물] ㄱㅇㅇ\n👉 정답을 채팅으로 적어 주세요\n🎁 복권 1장'],
        ['a1', '고양이'],
        ['bot', '🎉 정답! 밤톨님이 맞혔어요\n✅ 고양이\n🎟 밤톨님 복권 1장 지급! (보유 1장)'],
        ['bot', '🔤 2/5 [음식] ㄸㅂㅇ'],
      ],
    },
    boss: {
      note: '12월 1일부터 나오는 글이에요. 숫자는 예시예요.',
      rows: [
        ['bot', '👹 보스 등장! ⚡ 뇌우라\n📅 12월 9일 보스 (9일째)\n약점 속성: ⛰️ 땅\n👉 1분 안에 !참전\n🐲 내 대표 몬스터로 싸워요\n📺 생중계 https://키우기.com/b/xxxxxxxx'],
        ['a1', '!참전'],
        ['a2', '!참전'],
        ['a3', '!참전'],
        ['bot', '⚔ 밤톨님 참전 (🔥 홍룡이 Lv.3)\n⚔ 달무리님 참전 (💧 물꼬달 Lv.2)\n⚔ 구름빵님 참전 (🌿 새싹곰 Lv.2)'],
        ['bot', '⚔ 뇌우라와 전투 시작!\n👥 참전 3명\n❤ 보스 체력 1,240\n✨ 삼위일체! 공격 +12%, 체력 +25%\n🙌 인원이 적어서 받는 버프예요'],
        ['bot', '🏆 보스 토벌 성공!\n🌅 오늘 첫 승리! 땅 4배\n🗺 땅 +0.3% → 7.8%\n🏅 우리 방 땅 순위 4위\n⭐ 참전한 몬스터 경험치 +120'],
      ],
    },
    // 작은 칸에 쓰는 짧은 장면(멈춘 채로 보여요)
    thanks: { rows: [['st', '달무리가 100스푼을 후원해요'], ['bot', '달무리님 100스푼 후원 고마워요!']] },
    rps: { rows: [['a2', '!가위바위보 바위'], ['bot', '✊ 달무리님 바위 vs 봇 가위 ✌️\n🎉 이겼어요!']] },
    song: { rows: [['a1', '!신청곡 별빛밴드 - 밤하늘 산책'], ['bot', '🎵 1번째로 받았어요\n별빛밴드 - 밤하늘 산책']] },
  };
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const row = ([who, text]) => {
    if (who === 'st') return el('p', 'stage', text);
    const [name, role, roleCls] = P[who];
    const m = el('div', 'msg' + (who === 'bot' ? ' bot' : ''));
    const av = el('span', 'av ' + who);
    if (who === 'bot') { const i = el('img'); i.src = 'munchkin-64.png'; i.alt = ''; i.width = 34; i.height = 34; av.appendChild(i); } else av.textContent = name[0];
    av.setAttribute('aria-hidden', 'true');
    const body = el('div');
    const w = el('p', 'who', name);
    if (role) w.appendChild(el('span', 'role ' + roleCls, role));
    body.append(w, el('p', 'bub', text));
    m.append(av, body);
    return m;
  };
  const fill = (box, key) => box.replaceChildren(...SCENES[key].rows.map(row));

  // 작은 칸의 멈춘 채팅
  document.querySelectorAll('[data-scene]').forEach((b) => { if (SCENES[b.dataset.scene]) fill(b, b.dataset.scene); });

  // ── 눌러 보는 채팅 ──
  const box = document.getElementById('try-chat'), note = document.getElementById('try-note');
  const btns = [...document.querySelectorAll('.try-btns button[data-k]')].filter((b) => SCENES[b.dataset.k]);
  if (box && note && btns.length) {
    const order = btns.map((b) => b.dataset.k);
    let run = 0, auto = false, byCode = 0;   // byCode: 이 시각까지의 scroll 은 스크립트가 내린 것
    // 한 줄씩 흘려보내기. 움직임 줄이기면 장면 전체를 바로 보여요. 끝나면 done()
    const play = (key, done) => {
      const mine = ++run, rows = SCENES[key].rows;
      const later = (fn, ms) => setTimeout(() => { if (run === mine) fn(); }, ms);
      if (still.matches) { byCode = Date.now() + 300; fill(box, key); box.scrollTop = 0; return; }
      box.replaceChildren();
      let i = 0;
      const step = () => {
        if (i >= rows.length) { if (done) later(done, 2600); return; }
        const n = row(rows[i]); n.classList.add('in'); box.appendChild(n);
        byCode = Date.now() + 1200; box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
        const wait = rows[i][0] === 'bot' ? 1500 + rows[i][1].length * 15 : 900; i++;
        later(step, wait);
      };
      step();
    };
    // 저절로 한 바퀴가 끝나면 첫 장면을 조용히 채워 둬요(다시 흘리지 않고, 낭독기에도 읽히지 않게)
    const rest = () => {
      auto = false; run++;
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === order[0])));
      note.textContent = SCENES[order[0]].note;
      byCode = Date.now() + 300; fill(box, order[0]); box.scrollTop = 0;
    };
    const show = (key) => {
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === key)));
      note.textContent = SCENES[key].note;
      // 저절로 넘어가는 동안에는 화면 낭독기에 줄마다 읽히지 않게, 직접 누른 장면만 읽어 줘요
      box.setAttribute('aria-live', auto ? 'off' : 'polite');
      play(key, auto ? () => { if (!auto) return; const n = order[order.indexOf(key) + 1]; if (n) show(n); else rest(); } : null);
    };
    btns.forEach((b) => b.addEventListener('click', () => { auto = false; show(b.dataset.k); }));
    // 채팅 창 안을 직접 넘겨 보거나 키보드로 들어오면 다음 장면으로 저절로 넘어가지 않아요(지금 장면은 끝까지 흘러요).
    // 페이지를 내리다 창에 손이 닿은 것만으로는 멈추지 않아요.
    const hold = () => { if (auto) { auto = false; box.setAttribute('aria-live', 'polite'); } };
    box.addEventListener('scroll', () => { if (Date.now() > byCode) hold(); }, { passive: true });
    ['focusin', 'keydown'].forEach((t) => box.addEventListener(t, hold));
    // 처음: 첫 장면. 움직임 줄이기가 아니면 창이 화면에 보일 때부터 한 바퀴 저절로
    if (still.matches || !('IntersectionObserver' in window)) show(order[0]);
    else {
      note.textContent = SCENES[order[0]].note; fill(box, order[0]);   // 보이기 전에도 빈 창이 아니게
      const io = new IntersectionObserver((list) => {
        if (!list.some((e) => e.isIntersecting)) return;
        io.disconnect();
        if (run === 0) { auto = true; show(order[0]); }
      }, { threshold: 0.35 });
      io.observe(box);
    }
  }

  // ── 결제 전에 확인해 보세요: 좁은 화면에서는 제목만 보이고 눌러 펼쳐요(넓은 화면은 늘 펼침 — site.css 가 제목을 못 누르게 해요) ──
  const folds = [...document.querySelectorAll('[data-fold] > details')];
  if (folds.length) {
    const narrow = matchMedia('(max-width: 859px)');
    const set = () => folds.forEach((d) => { d.open = !narrow.matches; });
    set();
    if (narrow.addEventListener) narrow.addEventListener('change', set);
  }

  // ── 시즌 2 시작 표시(방문자 시계로 — 글만 바뀌어요) ──
  const date = document.getElementById('s2-date');
  if (date) {
    const START = Date.parse('2026-12-01T00:00:00+09:00'), END = Date.parse('2027-01-01T00:00:00+09:00'), now = Date.now();
    if (now >= END) date.textContent = '12월 31일에 끝났어요';
    else if (now >= START) { date.textContent = '지금 진행 중'; date.appendChild(el('span', '', '12월 31일까지')); }
  }

  // ── 영상: 화면에 보일 때만 재생, 움직임 줄이기면 저절로 틀지 않아요. 멈춤·재생 단추를 붙여요 ──
  const vids = [...document.querySelectorAll('video[data-auto]')];
  const shown = (v) => v.offsetParent !== null;   // 휴대폰/PC 용 가운데 지금 보이는 쪽만
  const groups = new Map();   // 영상 묶음(같은 설명 글을 쓰는 영상들) → 설명 글 옆 단추 하나
  vids.forEach((v) => {
    v.muted = true;
    const cap = v.closest('.screen')?.parentNode.querySelector(':scope > .cap');
    if (!cap) return;
    if (!groups.has(cap)) groups.set(cap, []);
    groups.get(cap).push(v);
  });
  groups.forEach((list, cap) => {
    const b = el('button', 'vid-toggle'); b.type = 'button';
    const cur = () => list.find(shown) || list[0];
    const paint = () => { const v = cur(); b.textContent = v.paused ? '재생' : '멈춤'; b.setAttribute('aria-label', (v.getAttribute('aria-label') || '영상') + (v.paused ? ' 재생' : ' 멈춤')); };
    b.addEventListener('click', () => {
      const v = cur();
      if (v.paused) { list.forEach((x) => { x.dataset.user = 'play'; }); v.play().catch(() => {}); }
      else { list.forEach((x) => { x.dataset.user = 'pause'; }); v.pause(); }
    });
    list.forEach((v) => { v.addEventListener('play', paint); v.addEventListener('pause', paint); });
    const text = el('span', '', cap.textContent); cap.replaceChildren(text, b); cap.classList.add('has-toggle');
    paint();
  });
  if (vids.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((list) => list.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting && shown(v)) { if (!still.matches && v.dataset.user !== 'pause') v.play().catch(() => {}); }
      else if (!v.paused) v.pause();
    }), { threshold: 0.4 });
    vids.forEach((v) => io.observe(v));
  }
})();
