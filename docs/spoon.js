// 스푼 동의 화면에서 돌아오는 주소(로그인 리디렉션 URL).
// 주소에 실려 온 1회용 code 를 곧바로 주소창에서 지우고, 우리 서버(비밀 키를 가진 쪽)에 넘겨요.
const LINK_API = 'https://aksegkhhugqvvaidgvro.supabase.co/functions/v1/spoon-link/callback';
const $ = (id) => document.getElementById(id);
const show = (state, title, message) => {
  document.body.dataset.state = state;
  $('title').textContent = title;
  $('message').textContent = message;
};

const params = new URLSearchParams(location.search);
const code = params.get('code') || '', state = params.get('state') || '', error = params.get('error') || '';
if (location.search) history.replaceState(null, '', location.pathname);

async function finish() {
  show('busy', '연결하는 중…', '잠시만 기다려 주세요.');
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(LINK_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, state }), signal: ctl.signal, cache: 'no-store' });
    if (res.status === 404) return show('wait', '아직 준비 중이에요', '스푼 연결 기능을 준비하고 있어요. 먼치킨 업데이트 소식을 기다려 주세요.');
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return show('ok', '연결됐어요', '먼치킨 프로그램으로 돌아가세요. 이 창은 닫아도 돼요.');
    show('fail', '연결하지 못했어요', typeof data.message === 'string' && data.message.length < 200 ? data.message : '먼치킨에서 "스푼 연결"을 다시 눌러 주세요.');
  } catch {
    show('fail', '연결하지 못했어요', '인터넷 연결을 확인하고 먼치킨에서 "스푼 연결"을 다시 눌러 주세요.');
  } finally { clearTimeout(timer); }
}

if (error === 'access_denied') show('fail', '허용하지 않았어요', '연결하려면 먼치킨에서 "스푼 연결"을 다시 누르고 스푼 화면에서 허용해 주세요.');
else if (error) show('fail', '연결하지 못했어요', '먼치킨에서 "스푼 연결"을 다시 눌러 주세요.');
else if (code && state && code.length <= 512 && state.length <= 512) finish();
