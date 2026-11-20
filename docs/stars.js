/* 별·달: 밤 구역(.night)의 글·단추·그림 상자를 피해 빈자리에만 찍어요(창 크기나 화면 내용이 바뀌면 다시 찍어요). 꾸밈일 뿐이라 스크립트가 꺼져 있으면 별만 안 보여요. */
(() => {
  const rnd = ((s) => () => (s = s * 16807 % 2147483647) / 2147483647)(20261120);
  const C = []; for (let i = 0; i < 90; i++) C.push([rnd(), rnd(), 1.2 + rnd() * 1.2, rnd()]);
  const SEL = 'a,button,img,summary,input,.kicker,.pc-note,.hello-note,.arch,.awin,.memories,.album-addr,.brand-sub,.must,.mgr-path span,.must-badge,.btn,.card,.album-mini,.sky-keep';
  const boxes = (root) => {
    const R = [], pad = 14, o = root.getBoundingClientRect();
    const add = (r) => { if (r.width && r.height) R.push([r.left - o.left - pad, r.top - o.top - pad, r.right - o.left + pad, r.bottom - o.top + pad]); };
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { if (!n.textContent.trim()) continue; const g = document.createRange(); g.selectNodeContents(n); for (const r of g.getClientRects()) add(r); }
    root.querySelectorAll(SEL).forEach((e) => add(e.getBoundingClientRect()));
    return R;
  };
  const hit = (R, x, y, r) => R.some((b) => x + r > b[0] && x - r < b[2] && y + r > b[1] && y - r < b[3]);
  const draw = () => document.querySelectorAll('.night').forEach((root) => {
    const sky = root.querySelector(':scope > .sky'); if (!sky) return;
    sky.textContent = '';
    const W = root.clientWidth, H = root.clientHeight, R = boxes(root); let k = 0; const max = W < 600 ? 12 : 18;
    for (const [px, py, r, t] of C) {
      if (k >= max) break;
      const x = 8 + px * (W - 16), y = 8 + py * (H - 16);
      if (hit(R, x, y, r + 1)) continue;
      const s = document.createElement('i'); s.className = 'st';
      s.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + r * 2 + 'px;height:' + r * 2 + 'px;background:' + (t > .8 ? '#FFD98A' : t > .4 ? '#FFF6DD' : '#fff');
      sky.appendChild(s); k++;
    }
    if (!root.classList.contains('hero-night')) return;
    const ms = W < 600 ? 34 : 54;
    for (const [mx, my] of [[.91, .11], [.93, .2], [.06, .12], [.9, .34], [.05, .3], [.92, .5]]) {
      const x = mx * W, y = my * H;
      if (hit(R, x, y, ms / 2 + 4)) continue;
      const m = document.createElement('i'); m.className = 'moon';
      m.style.cssText = 'left:' + (x - ms / 2) + 'px;top:' + (y - ms / 2) + 'px;width:' + ms + 'px;height:' + ms + 'px;box-shadow:inset -' + Math.round(ms * .26) + 'px ' + Math.round(ms * .11) + 'px 0 0 #FFD98A';
      sky.appendChild(m); break;
    }
  });
  let t; const later = (ms) => { clearTimeout(t); t = setTimeout(draw, ms); };
  addEventListener('resize', () => later(150));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  addEventListener('load', draw); draw();
  // 화면을 스크립트로 다시 그리는 페이지(추억앨범 신청): 내용이 바뀌면 다시 찍어요(별 자신이 바뀐 것은 빼고)
  const app = document.getElementById('app');
  if (app && window.MutationObserver) new MutationObserver((list) => {
    if (list.some((m) => !(m.target instanceof Element && m.target.closest('.sky')))) later(60);
  }).observe(app, { childList: true, subtree: true });
})();
