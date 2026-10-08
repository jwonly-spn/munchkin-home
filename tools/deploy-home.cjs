// 먼치킨 소개·다운로드 페이지(먼치킨.com)를 GitHub(jwonly-spn/munchkin-home)에 올리고 docs/ 를 GitHub Pages 로 연다.
// 이 PC의 GitHub 로그인(git credential manager)을 쓴다. 비밀 값은 출력하지 않는다.
// 사용: node tools/build-home.mjs && node tools/deploy-home.cjs "커밋 메시지" [--domain]
//   --domain: 사용자 도메인(먼치킨.com = xn--s22bu18a0ub.com)을 GitHub Pages 에 붙이고, 인증서가 나오면 https 강제를 켠다.
'use strict';
const fs = require('node:fs'), path = require('node:path'), {spawnSync} = require('node:child_process');
const OWNER = 'jwonly-spn', NAME = 'munchkin-home', ROOT = path.join(__dirname, '..');
const DOMAIN = 'xn--s22bu18a0ub.com';
const GIT = 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git';
const env = {...process.env, GIT_EXEC_PATH: GIT + '/mingw64/bin', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never'};
const git = (...args) => {
  const r = spawnSync(GIT + '/cmd/git.exe', ['-c', 'safe.directory=' + ROOT.replace(/\\/g, '/'), '-C', ROOT, ...args], {encoding: 'utf8', env, windowsHide: true, timeout: 120000});
  if (r.status !== 0) throw Error(`git ${args[0]} 실패: ${(r.stderr || r.stdout).trim().slice(0, 400)}`);
  return r.stdout.trim();
};
const auth = spawnSync(GIT + '/cmd/git.exe', ['credential', 'fill'], {input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', env, windowsHide: true, timeout: 15000});
const cred = Object.fromEntries((auth.stdout || '').trim().split('\n').map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
if (!cred.password) throw Error('GitHub 로그인 정보를 찾을 수 없어요.');
const headers = {Authorization: 'Bearer ' + cred.password, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json'};
async function gh(route, init = {}) {
  const r = await fetch('https://api.github.com' + route, {...init, headers: {...headers, ...init.headers}});
  if (r.status === 404 && init.allowMissing) return null;
  const text = await r.text();
  if (!r.ok && !(init.allow || []).includes(r.status)) throw Error(`GitHub ${r.status} ${route}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}
const withDomain = process.argv.includes('--domain');

(async () => {
  for (const f of ['docs/index.html', 'docs/404.html', 'docs/.nojekyll', 'docs/favicon.ico']) if (!fs.existsSync(path.join(ROOT, f))) throw Error(f + ' 이 없어요. 먼저 node tools/build-home.mjs');
  const risky = spawnSync('cmd', ['/c', 'dir', '/s', '/b', ROOT], {encoding: 'utf8'}).stdout.split(/\r?\n/).filter(p => /(\.pem|\.env|관리자키|secret|private)/i.test(p));
  if (risky.length) throw Error('비밀 파일로 보이는 파일이 있어요: ' + risky.join(', '));
  if (withDomain) fs.writeFileSync(path.join(ROOT, 'docs', 'CNAME'), DOMAIN + '\n');
  if (!fs.existsSync(path.join(ROOT, '.git'))) git('init', '-b', 'main');
  fs.writeFileSync(path.join(ROOT, '.gitignore'), 'node_modules/\n*.log\n.DS_Store\n.claude/\n');
  git('add', '-A');
  if (git('status', '--porcelain')) git('-c', 'user.name=JUN LIVE', '-c', 'user.email=jwonly-spn@users.noreply.github.com', 'commit', '-q', '-m', process.argv.slice(2).find(a => !a.startsWith('--')) || 'Update Munchkin home');
  let repo = await gh(`/repos/${OWNER}/${NAME}`, {allowMissing: true});
  if (!repo) {
    repo = await gh('/user/repos', {method: 'POST', body: JSON.stringify({name: NAME, description: '먼치킨 — 스푼 DJ를 위한 채팅 봇 소개·다운로드 페이지', homepage: 'https://' + DOMAIN + '/', private: false, has_issues: false, has_wiki: false, has_projects: false, auto_init: false})});
    console.log('저장소를 만들었어요:', repo.html_url);
  }
  if (!git('remote').split('\n').includes('origin')) git('remote', 'add', 'origin', `https://github.com/${OWNER}/${NAME}.git`);
  git('push', '-u', 'origin', 'main');
  const head = git('rev-parse', 'HEAD');
  console.log('올린 커밋:', head.slice(0, 7));
  let pages = await gh(`/repos/${OWNER}/${NAME}/pages`, {allowMissing: true});
  if (!pages) pages = await gh(`/repos/${OWNER}/${NAME}/pages`, {method: 'POST', body: JSON.stringify({source: {branch: 'main', path: '/docs'}})});
  if (withDomain && pages.cname !== DOMAIN) await gh(`/repos/${OWNER}/${NAME}/pages`, {method: 'PUT', body: JSON.stringify({cname: DOMAIN, source: {branch: 'main', path: '/docs'}})});
  for (let i = 0; i < 60; i++) {
    const b = await gh(`/repos/${OWNER}/${NAME}/pages/builds/latest`, {allowMissing: true});
    if (b && b.commit === head && b.status === 'built') break;
    if (b && b.commit === head && b.status === 'errored') throw Error('GitHub Pages 빌드 실패: ' + JSON.stringify(b.error));
    await new Promise(r => setTimeout(r, 5000));
  }
  pages = await gh(`/repos/${OWNER}/${NAME}/pages`);
  if (withDomain && !pages.https_enforced) {
    const r = await gh(`/repos/${OWNER}/${NAME}/pages`, {method: 'PUT', allow: [400, 404, 422], body: JSON.stringify({cname: DOMAIN, https_enforced: true, source: {branch: 'main', path: '/docs'}})});
    console.log('https 강제:', r && r.message ? '아직(인증서 준비 중) — ' + r.message : '켬');
  }
  pages = await gh(`/repos/${OWNER}/${NAME}/pages`);
  console.log('주소:', pages.html_url, '· 도메인:', pages.cname || '없음', '· https 강제:', pages.https_enforced, '· 인증서:', pages.https_certificate?.state || '없음');
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
