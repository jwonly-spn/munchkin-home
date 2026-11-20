/* 본문 글꼴의 나머지 글자(닉네임·앨범 이름처럼 미리 알 수 없는 글자) 조각 목록을, 화면이 다 뜬 뒤에 받아요.
   첫 화면 글자는 mk-text.woff2 한 파일에 다 있어서 이 목록이 먼저 올 필요가 없어요. */
(() => {
  const href = new URL('pretendard-rest.css?v=1', document.currentScript.src).href;
  const add = () => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.append(l); };
  if (document.readyState === 'complete') add(); else addEventListener('load', add);
})();
