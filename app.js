/* Antipolo Philippines Stake – Stake Presidency Portal (app.js) */

/* ---------- Settings you may edit ---------- */
// Your Apps Script web-app link (the hidden backend)
const API_URL = 'https://script.google.com/macros/s/AKfycbzu_C7k38r-qqzBmLBl1LqgUbPIN4rzxUup0Go8He8xPxb5SV1BgN3D-84NNKRKOKNC/exec';

// Sidebar quick links. "roles" limits who sees a link (admin = Executive Secretary,
// sp = Stake Presidency, hc = High Council). Remove "roles" to show it to everyone.
const LINKS = [
  { label:'Executive Secretary Tracker (MAIN)', url:'https://docs.google.com/spreadsheets/d/1MUhpzICBoNRWM6IKNRv_JzUq_CEG8l6M48ijrKNOHp8/edit?gid=603386809#gid=603386809', icon:'sheet', roles:['admin'] },
  { label:'Stake Presidency View', url:'https://docs.google.com/spreadsheets/d/1UeV0nundDLCrrtZKtiymy6VuXN8T2YwpCstYN96zfH0/edit?gid=1572489677#gid=1572489677', icon:'sheet', roles:['admin','sp'] },
  { label:'LCR (TR interview requests)', url:'https://lcr.churchofjesuschrist.org/', icon:'lcr', roles:['admin','sp'] },
  { label:'Stake email invitation template', url:'https://docs.google.com/document/d/1hvNcEDIkylAy3p3c0bs5snat-EHLuCBF/edit', icon:'doc', roles:['admin'] },
  { label:'2027 Stake Calendar', url:'https://docs.google.com/spreadsheets/d/1YYvVabWY9-H2Qwi1-BVVBWVfyJO0Jx46Quy7XPDWV-c/edit?gid=508604250#gid=508604250', icon:'cal' },
  { label:'SP & HC Assignments', url:'https://docs.google.com/spreadsheets/d/1tf8T3006ijVuC3Rrj3ly72g-6JVm3UQN/edit?gid=738304419#gid=738304419', icon:'sheet' },
  { label:'General Handbook ch. 29 (29.3)', url:'https://www.churchofjesuschrist.org/study/manual/general-handbook/29-meetings-in-the-church?lang=eng', icon:'book' }
];

/* ---------- Basics ---------- */
const S = { token:null, data:null, page:'home', f:{ q:'', who:'', status:'open' } };
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isT = v => v === true || /^(true|yes)$/i.test(String(v));
const ROLE = { admin:'Executive Secretary', sp:'Stake Presidency', hc:'High Council' };
const OPEN = i => !['Done','Cancelled'].includes(i.Status);
const BADGE = { 'To Schedule':'warn', 'Scheduled':'info', 'Done':'ok', 'Follow-up':'violet', 'Cancelled':'' };
const badge = s => `<span class="badge ${BADGE[s] || ''}">${esc(s || '—')}</span>`;
const opt = (arr, v) => arr.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
const empty = m => `<div class="empty">${m}</div>`;
const main = h => { $('#main').innerHTML = h; };

let store = null; try { store = window.sessionStorage; store.getItem('x'); } catch (e) { store = null; }
var installEvt = null;   // set when the browser offers "Install app"

/* ---------- Dates & times ---------- */
const parseD = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); };
const fmtD = (s, o) => { const d = parseD(s); return d ? d.toLocaleDateString('en-US', o || { weekday:'short', month:'short', day:'numeric' }) : ''; };
const to12 = t => { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')} ${ap}`; };
const to24 = t => { const m = String(t || '').match(/(\d{1,2}):(\d{2})\s*([AP]M)/i); if (!m) return ''; let h = +m[1] % 12; if (/p/i.test(m[3])) h += 12; return `${String(h).padStart(2, '0')}:${m[2]}`; };
const byWhen = (a, b) => { const A = a['Scheduled date'] || '9999', B = b['Scheduled date'] || '9999';
  return A < B ? -1 : A > B ? 1 : (to24(a.Time) || '99').localeCompare(to24(b.Time) || '99'); };

/* ---------- Icons ---------- */
const I = {
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  ann:'<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12"/>',
  int:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M9 15l2 2 4-4"/>',
  ppl:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  out:'<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l4-4-4-4M14 12H3"/>',
  lcr:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 9h3M15 13h3M6 16c.5-1.5 1.7-2 3-2s2.5.5 3 2"/>',
  doc:'<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8 13h8M8 17h5"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  sheet:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
  ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  dl:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'
};
const icon = (k, cls) => `<svg ${cls ? `class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;
const PAGES = [
  { id:'home', label:'Home', icon:'home' },
  { id:'ann', label:'Announcements', icon:'ann' },
  { id:'int', label:'Interviews', icon:'int' },
  { id:'ppl', label:'People & logins', icon:'ppl', admin:true },
  { id:'acct', label:'My account', icon:'user' }
];

/* ---------- Avatars ---------- */
const initials = n => String(n || '').replace(/^(pres\.|bro\.|sis\.|president|brother|sister)\s+/i, '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const okPhoto = p => /^data:image\/(jpeg|png|webp);base64,/.test(String(p || ''));
const avatar = (name, photo, cls) => okPhoto(photo)
  ? `<span class="av ${cls || ''}" style="background-image:url('${photo}')" role="img" aria-label="${esc(name)}"></span>`
  : `<span class="av ${cls || ''}" aria-hidden="true">${esc(initials(name))}</span>`;
function paintAv(el, name, photo) {
  if (!el) return;
  el.style.backgroundImage = okPhoto(photo) ? `url('${photo}')` : '';
  el.textContent = okPhoto(photo) ? '' : initials(name);
}

/* ---------- Server calls ---------- */
async function run(fn, ...args) {
  const body = fn === 'login'
    ? { fn:'login', email:args[0], password:args[1] }
    : { fn:'api', token:args[0], action:args[1], payload:args[2] };
  let res;
  try {
    res = await fetch(API_URL, { method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' }, body:JSON.stringify(body) });
  } catch (e) {
    throw new Error('Could not reach the server. Check your internet connection.');
  }
  if (!res.ok) throw new Error('Could not reach the server (' + res.status + ').');
  return res.json();
}
async function api(action, payload) {
  const r = await run('api', S.token, action, payload || {});
  if (r && r.error === 'SESSION_EXPIRED') { signOut(true); throw new Error('Your session ended. Please sign in again.'); }
  if (r && r.error) throw new Error(r.error);
  if (r && r.me) { S.data = r; render(); }
  return r;
}
function toast(m, bad) {
  const t = $('#toast'); t.textContent = m; t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(t._h); t._h = setTimeout(() => t.className = 'toast', 2600);
}
function twoStep(btn, fn) {
  if (btn.dataset.armed) { delete btn.dataset.armed; return fn(); }
  const t = btn.textContent; btn.dataset.armed = 1; btn.textContent = 'Click again to confirm';
  setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = t; } }, 3000);
}

/* ---------- Slide-in menu (tablet & phone) ---------- */
function openMenu() { $('#side').classList.add('open'); $('#scrim').classList.add('show'); document.body.classList.add('lock'); }
function closeMenu() { $('#side').classList.remove('open'); $('#scrim').classList.remove('show'); document.body.classList.remove('lock'); }

/* ---------- Shell ---------- */
function showLogin() { $('#boot').classList.add('hidden'); $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); }
function showApp() { $('#boot').classList.add('hidden'); $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); }
function signOut(expired) {
  if (S.token && !expired) run('api', S.token, 'logout', {}).catch(() => {});
  S.token = null; S.data = null; if (store) store.removeItem('tok');
  closeMenu(); showLogin();
  $('#lErr').textContent = expired ? 'Your session ended. Please sign in again.' : '';
}
function render() {
  const d = S.data, me = d.me, admin = me.role === 'admin';
  if (S.page === 'ppl' && !admin) S.page = 'home';
  if (me.role === 'hc') S.f.who = '';
  $('#nav').innerHTML = PAGES.filter(p => !p.admin || admin).map(p =>
    `<button data-p="${p.id}" class="${S.page === p.id ? 'on' : ''}">${icon(p.icon)}<span>${p.label}</span></button>`).join('');
  const links = LINKS.filter(l => !l.roles || l.roles.includes(me.role));
  $('#links').innerHTML =
    (links.length ? `<h4>Quick links</h4>` + links.map(l =>
      `<a href="${esc(l.url)}" target="_blank" rel="noopener">${icon(l.icon)}<span>${esc(l.label)}</span>${icon('ext', 'ext')}</a>`).join('') : '') +
    (installEvt ? `<button class="install" id="installBtn">${icon('dl')}Install app</button>` : '');
  if ($('#installBtn')) $('#installBtn').onclick = installApp;
  $('#meName').textContent = me.name; $('#meRole').textContent = ROLE[me.role] || '';
  paintAv($('#meAv'), me.name, me.photo);
  paintAv($('#meAvMini'), me.name, me.photo);
  ({ home:pHome, ann:pAnn, int:pInt, ppl:pPpl, acct:pAcct })[S.page]();
}
function go(p) { S.page = p; closeMenu(); render(); window.scrollTo(0, 0); }

/* ---------- Generic form dialog ---------- */
function openForm(title, body, onSave, extra) {
  const dlg = $('#dlg');
  dlg.innerHTML = `<form class="dlg"><header><h2>${esc(title)}</h2><button type="button" class="x" data-close aria-label="Close">×</button></header>
    <div class="body">${body}<p class="err" id="fErr"></p></div>
    <footer>${extra ? `<button type="button" class="btn danger-t" id="fExtra">${esc(extra.label)}</button>` : ''}
    <span class="grow"></span><button type="button" class="btn" data-close>Close</button><button class="btn pri" id="fSave">Save</button></footer></form>`;
  const form = dlg.querySelector('form');
  dlg.querySelectorAll('[data-close]').forEach(b => b.onclick = () => dlg.close());
  form.onsubmit = e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    form.querySelectorAll('input[type=checkbox]').forEach(c => f[c.name] = c.checked);
    guard($('#fSave'), () => onSave(f));
  };
  if (extra) $('#fExtra').onclick = e => twoStep(e.currentTarget, () => guard($('#fExtra'), extra.fn));
  dlg.showModal();
  addPwToggles(dlg);
}
async function guard(btn, fn) {
  btn.disabled = true; $('#fErr').textContent = '';
  try { await fn(); $('#dlg').close(); } catch (e) { $('#fErr').textContent = e.message; } finally { btn.disabled = false; }
}

/* ---------- HOME ---------- */
function pHome() {
  const d = S.data, me = d.me, admin = me.role === 'admin', today = d.today, wk = addDays(today, 7);
  const inWeek = i => i['Scheduled date'] && i['Scheduled date'] >= today && i['Scheduled date'] <= wk;
  const open = d.interviews.filter(OPEN);
  const mine = admin ? open : open.filter(i => i.Interviewer === me.interviewer);
  const upcoming = mine.filter(i => i['Scheduled date'] >= today).sort(byWhen).slice(0, 6);
  const noIv = open.filter(i => !i.Interviewer);
  const stats = admin ? [
    ['To schedule', open.filter(i => i.Status === 'To Schedule').length, 'warn'],
    ['Needs an interviewer', noIv.length, 'bad'],
    ['Scheduled next 7 days', open.filter(inWeek).length, 'info'],
    ['Follow-up', open.filter(i => i.Status === 'Follow-up').length, 'violet']
  ] : [
    ['My open interviews', mine.length, 'info'],
    ['Next 7 days', mine.filter(inWeek).length, 'ok'],
    ['Still to schedule', mine.filter(i => i.Status === 'To Schedule').length, 'warn'],
    ['Announcements', d.announcements.length, 'mute']
  ];
  const hr = new Date().getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const item = i => `<li class="item"><div class="when"><b>${fmtD(i['Scheduled date'], { day:'numeric' })}</b><span>${fmtD(i['Scheduled date'], { month:'short' })}</span></div>
    <div class="grow"><div class="t">${esc(i.Name)}</div><div class="sub">${esc(i.Type)} · ${esc(i.Ward)} · ${esc(i.Time || 'Time TBD')}${i.Venue ? ' · ' + esc(i.Venue) : ''}</div></div>
    <div class="sub r">${esc(i.Interviewer || 'Unassigned')}</div></li>`;
  main(`<div class="head"><div><p class="eyebrow">${fmtD(today, { weekday:'long', month:'long', day:'numeric', year:'numeric' })}</p><h1>${greet}, ${esc(me.name)}</h1></div></div>
  <div class="stats">${stats.map(([l, n, c]) => `<div class="stat ${c}"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('')}</div>
  <div class="cols">
    <section class="card">
      <div class="card-h"><h2>${admin ? 'Upcoming interviews' : 'My upcoming interviews'}</h2><button class="link" data-go="int">View all →</button></div>
      ${upcoming.length ? `<ul class="list">${upcoming.map(item).join('')}</ul>` : empty('Nothing scheduled yet.')}
      ${admin && noIv.length ? `<div class="card-h mt"><h2>Needs an interviewer</h2></div><ul class="list">${noIv.slice(0, 5).map(i =>
        `<li class="item"><div class="grow"><div class="t">${esc(i.Name)}</div><div class="sub">${esc(i.Type)} · ${esc(i.Ward)} · ${esc(i.Purpose)}</div></div>
        <button class="btn sm pri" data-assign="${esc(i.ID)}">Assign</button></li>`).join('')}</ul>` : ''}
    </section>
    <section class="card">
      <div class="card-h"><h2>Announcements</h2><button class="link" data-go="ann">See all →</button></div>
      ${d.announcements.slice(0, 3).map(a => `<div class="mini"><div class="t">${isT(a.Pinned) ? '📌 ' : ''}${esc(a.Title)}</div>
        <div class="sub">${fmtD(a.Posted, { month:'short', day:'numeric' })} · ${esc(a.Audience)}</div>
        <p>${esc(String(a.Body).slice(0, 160))}${String(a.Body).length > 160 ? '…' : ''}</p></div>`).join('') || empty('No announcements yet.')}
    </section>
  </div>`);
  document.querySelectorAll('#main [data-assign]').forEach(b => b.onclick = () => intForm(findInt(b.dataset.assign)));
}

/* ---------- INTERVIEWS ---------- */
const findInt = id => S.data.interviews.find(i => i.ID === id);
function pInt() {
  const d = S.data, me = d.me, admin = me.role === 'admin', seeAll = me.role !== 'hc';
  const open = d.interviews.filter(OPEN);
  const chip = (v, l, c) => `<button class="chip ${S.f.who === v ? 'on' : ''}" data-w="${esc(v)}">${esc(l)}<span>${c}</span></button>`;
  const per = d.lists.interviewers.map(x => ({ n:x.name, sp:x.role === 'sp', c:open.filter(i => i.Interviewer === x.name).length }));
  main(`<div class="head"><div><h1>Interviews</h1><p class="muted">${seeAll ? 'All interview requests across the stake' : 'Interviews assigned to you'}</p></div>
    ${admin ? '<button class="btn pri" id="newInt">+ New interview</button>' : ''}</div>
  ${seeAll ? `<div class="chips" id="who">${chip('', 'Everyone', open.length)}${chip('__none', 'Needs interviewer', open.filter(i => !i.Interviewer).length)}
    ${per.filter(x => x.sp || x.c).map(x => chip(x.n, x.n, x.c)).join('')}</div>` : ''}
  <div class="toolbar"><input id="q" class="input" placeholder="Search name, ward, purpose…" value="${esc(S.f.q)}">
    <div class="seg" id="st">${[['open', 'Open'], ['Done', 'Done'], ['all', 'All']].map(([v, l]) => `<button data-s="${v}" class="${S.f.status === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
  <div class="card flush"><table class="tbl"><thead><tr><th>Member</th><th>Type</th><th>Ward</th><th>Interviewer</th><th>When</th><th>Status</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>`);
  $('#q').oninput = e => { S.f.q = e.target.value; drawInt(); };
  $('#st').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.f.status = b.dataset.s;
    $('#st').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); drawInt(); };
  if ($('#who')) $('#who').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; S.f.who = b.dataset.w;
    $('#who').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); drawInt(); };
  if (admin) $('#newInt').onclick = () => intForm();
  $('#tb').onclick = e => {
    const ed = e.target.closest('[data-edit]'); if (ed) return intForm(findInt(ed.dataset.edit));
    const dn = e.target.closest('[data-done]'); if (dn) markDone(dn.dataset.done);
  };
  drawInt();
}
function drawInt() {
  const d = S.data, me = d.me, admin = me.role === 'admin', q = S.f.q.toLowerCase();
  let rows = d.interviews.filter(i => S.f.status === 'all' ? true : S.f.status === 'open' ? OPEN(i) : i.Status === 'Done');
  if (S.f.who === '__none') rows = rows.filter(i => !i.Interviewer); else if (S.f.who) rows = rows.filter(i => i.Interviewer === S.f.who);
  if (q) rows = rows.filter(i => [i.Name, i.Ward, i.Purpose, i.Type, i.Interviewer, i.Venue].join(' ').toLowerCase().includes(q));
  rows.sort(byWhen);
  $('#tb').innerHTML = rows.length ? rows.map(i => {
    const mine = i.Interviewer && i.Interviewer === me.interviewer;
    const acts = (admin ? `<button class="btn sm" data-edit="${esc(i.ID)}">Edit</button>` : '') +
      ((mine || admin) && OPEN(i) ? `<button class="btn sm ok" data-done="${esc(i.ID)}">Mark done</button>` : '');
    return `<tr>
      <td data-l="Member"><div><b>${esc(i.Name)}</b><div class="sub">${esc(i.Purpose)}</div></div></td>
      <td data-l="Type">${esc(i.Type)}</td><td data-l="Ward">${esc(i.Ward)}</td>
      <td data-l="Interviewer">${i.Interviewer ? esc(i.Interviewer) : '<span class="warn-t">Not assigned</span>'}</td>
      <td data-l="When"><div>${i['Scheduled date'] ? `${fmtD(i['Scheduled date'])}<div class="sub">${esc(i.Time || '')}${i.Venue ? ' · ' + esc(i.Venue) : ''}</div>` : '<span class="muted">Not scheduled</span>'}</div></td>
      <td data-l="Status"><div>${badge(i.Status)}${i['Member notified'] === 'Yes' ? '<div class="sub">Member notified</div>' : ''}</div></td>
      <td class="acts">${acts}</td></tr>`;
  }).join('') : `<tr><td colspan="7">${empty('No interviews match.')}</td></tr>`;
}
async function markDone(id) {
  try { await api('setInterviewStatus', { id, status:'Done' }); toast('Marked as done'); } catch (e) { toast(e.message, true); }
}
function intForm(i) {
  i = i || { Type:'Temple Recommend', Status:'To Schedule', 'Member notified':'No' };
  const L = S.data.lists;
  openForm(i.ID ? 'Edit interview · ' + i.ID : 'New interview', `
    <div class="grid2"><label>Type<select name="Type">${opt(L.types, i.Type)}</select></label>
      <label>Ward<select name="Ward"><option value="">—</option>${opt(L.wards, i.Ward)}</select></label></div>
    <label>Member name<input name="Name" required value="${esc(i.Name)}" placeholder="Surname, Given name"></label>
    <label>Purpose / calling<input name="Purpose" value="${esc(i.Purpose)}"></label>
    <label>Interviewer<select name="Interviewer" id="fIv"></select><small class="hint" id="ivHint"></small></label>
    <div class="grid3"><label>Date<input type="date" name="Scheduled date" value="${esc(i['Scheduled date'])}"></label>
      <label>Time<input type="time" name="Time" value="${to24(i.Time)}"></label>
      <label>Venue<input name="Venue" list="venues" value="${esc(i.Venue)}"></label></div>
    <div class="grid2"><label>Member notified<select name="Member notified">${opt(['No', 'Yes'], i['Member notified'])}</select></label>
      <label>Status<select name="Status">${opt(L.statuses, i.Status)}</select></label></div>
    <label>Notes <span class="muted">(scheduling only)</span><textarea name="Notes" rows="2">${esc(i.Notes)}</textarea></label>
    <p class="hint">Never record worthiness, personal or family matters here.</p>`,
    async f => { f.Time = to12(f.Time); if (i.ID) f.ID = i.ID; await api('saveInterview', f); toast('Interview saved'); },
    i.ID && i.Status !== 'Cancelled' ? { label:'Cancel interview', fn: async () => { await api('saveInterview', { ID:i.ID, Status:'Cancelled' }); toast('Interview cancelled'); } } : null);
  const fill = () => {
    const sp = $('#dlg [name=Type]').value === 'Temple Recommend';
    const list = L.interviewers.filter(x => !sp || x.role === 'sp');
    const groups = [['Stake Presidency', list.filter(x => x.role === 'sp')], ['High Council', list.filter(x => x.role === 'hc')]].filter(g => g[1].length);
    $('#fIv').innerHTML = '<option value="">— Not assigned yet —</option>' + groups.map(([g, xs]) =>
      `<optgroup label="${g}">${xs.map(x => `<option ${x.name === i.Interviewer ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</optgroup>`).join('');
    $('#ivHint').textContent = sp ? 'Temple recommend interviews go to a member of the stake presidency.' : '';
  };
  fill(); $('#dlg [name=Type]').onchange = fill;
}

/* ---------- ANNOUNCEMENTS ---------- */
function pAnn() {
  const d = S.data, admin = d.me.role === 'admin';
  const linkify = s => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
  main(`<div class="head"><div><h1>Announcements</h1><p class="muted">${admin ? 'Each announcement shows only to the audience you choose' : 'From the stake executive secretary'}</p></div>
    ${admin ? '<button class="btn pri" id="newAnn">+ New announcement</button>' : ''}</div>
  <div class="stack" id="annList">${d.announcements.length ? d.announcements.map(a => {
    const expired = a.Expires && a.Expires < d.today;
    return `<article class="card ann ${isT(a.Pinned) ? 'pinned' : ''}"><div class="meta">${isT(a.Pinned) ? '<span class="badge info">Pinned</span>' : ''}
      <span class="badge">${esc(a.Audience || 'Everyone')}</span>${expired ? '<span class="badge warn">Expired</span>' : ''}
      <span class="sub">${fmtD(a.Posted, { month:'short', day:'numeric', year:'numeric' })} · ${esc(a['Posted by'])}</span></div>
      <h3>${esc(a.Title)}</h3><div class="body">${linkify(a.Body)}</div>
      ${admin ? `<div class="acts"><button class="btn sm" data-edit="${esc(a.ID)}">Edit</button><button class="btn sm danger-t" data-del="${esc(a.ID)}">Delete</button></div>` : ''}</article>`;
  }).join('') : empty('No announcements yet.')}</div>`);
  if (!admin) return;
  $('#newAnn').onclick = () => annForm();
  $('#annList').onclick = e => {
    const ed = e.target.closest('[data-edit]'); if (ed) return annForm(d.announcements.find(a => a.ID === ed.dataset.edit));
    const del = e.target.closest('[data-del]');
    if (del) twoStep(del, async () => { try { await api('deleteAnnouncement', { id:del.dataset.del }); toast('Deleted'); } catch (err) { toast(err.message, true); } });
  };
}
function annForm(a) {
  a = a || { Audience:'Everyone' };
  openForm(a.ID ? 'Edit announcement' : 'New announcement', `
    <label>Title<input name="Title" required value="${esc(a.Title)}"></label>
    <label>Message<textarea name="Body" rows="6">${esc(a.Body)}</textarea></label>
    <div class="grid2"><label>Who can see it<select name="Audience">${opt(S.data.lists.audiences, a.Audience)}</select></label>
      <label>Hide after (optional)<input type="date" name="Expires" value="${esc(a.Expires)}"></label></div>
    <label class="check"><input type="checkbox" name="Pinned" ${isT(a.Pinned) ? 'checked' : ''}> Pin to the top</label>
    ${a.ID ? '' : '<p class="hint">People who turned on announcement emails will get a copy by email.</p>'}`,
    async f => { if (a.ID) f.ID = a.ID; await api('saveAnnouncement', f); toast(a.ID ? 'Announcement updated' : 'Announcement posted'); });
}

/* ---------- PEOPLE (admin) ---------- */
function pPpl() {
  const us = S.data.users;
  main(`<div class="head"><div><h1>People & logins</h1><p class="muted">Interviewer names here fill every interviewer dropdown.</p></div>
    <button class="btn pri" id="newU">+ Add person</button></div>
  <div class="card flush"><table class="tbl"><thead><tr><th>Name</th><th>Role</th><th>Interviewer name</th><th>Email</th><th>Sign-in</th><th></th></tr></thead>
  <tbody id="ub">${us.map(u => `<tr>
    <td data-l="Name"><div class="person">${avatar(u.name, u.photo, 'sm')}<b>${esc(u.name)}</b></div></td>
    <td data-l="Role">${ROLE[u.role] || esc(u.role)}</td>
    <td data-l="Interviewer">${esc(u.interviewer) || '<span class="muted">—</span>'}</td>
    <td data-l="Email">${esc(u.email) || '<span class="muted">No email yet</span>'}</td>
    <td data-l="Sign-in">${u.active && u.hasPassword ? '<span class="badge ok">Active</span>' : u.active ? '<span class="badge warn">Needs password</span>' : '<span class="badge">Off</span>'}</td>
    <td class="acts"><button class="btn sm" data-e="${u.row}">Edit</button>${u.email ? `<button class="btn sm" data-p="${u.row}">Set password</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`);
  $('#newU').onclick = () => userForm();
  $('#ub').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const u = us.find(x => String(x.row) === (b.dataset.e || b.dataset.p));
    b.dataset.e ? userForm(u) : pwForm(u);
  };
}
function userForm(u) {
  u = u || { role:'hc', active:true };
  openForm(u.row ? 'Edit person' : 'Add person', `
    <label>Full name<input name="name" required value="${esc(u.name)}"></label>
    <div class="grid2"><label>Role<select name="role">${['sp', 'hc', 'admin'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${ROLE[r]}</option>`).join('')}</select></label>
      <label>Interviewer name<input name="interviewer" value="${esc(u.interviewer)}" placeholder="e.g. Bro. Acosta"><small class="hint">Leave blank if not an interviewer.</small></label></div>
    <label>Email (used to sign in and for notifications)<input type="email" name="email" value="${esc(u.email)}"></label>
    <label class="check"><input type="checkbox" name="active" ${u.active ? 'checked' : ''}> Allow this person to sign in</label>`,
    async f => { f.row = u.row || null; await api('saveUser', f); toast('Saved'); });
}
function pwForm(u) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const gen = [...crypto.getRandomValues(new Uint8Array(9))].map(b => chars[b % chars.length]).join('').replace(/(.{3})(?=.)/g, '$1-');
  openForm('Set password · ' + u.name, `<label>Temporary password<input name="password" required minlength="6" value="${gen}"></label>
    <p class="hint">Send it to ${esc(u.name)} privately, not in a group chat. They can change it under My account.</p>`,
    async f => { await api('resetPassword', { row:u.row, password:f.password }); toast('Password set'); });
}

/* ---------- MY ACCOUNT: photo, notifications, password ---------- */
function pAcct() {
  const me = S.data.me, n = me.notify || { assigned:true, announcements:true };
  const hasPhoto = okPhoto(me.photo);
  main(`<div class="head"><div><h1>My account</h1><p class="muted">Your photo, email notifications and password</p></div></div>
  <div class="cols">
    <div class="stack">
      <section class="card">
        <div class="profile">
          ${avatar(me.name, me.photo, 'lg')}
          <div class="who">
            <b>${esc(me.name)}</b><span class="muted">${esc(me.email)}</span><br>
            <span class="badge info">${ROLE[me.role]}</span>${me.interviewer ? ` <span class="badge">${esc(me.interviewer)}</span>` : ''}
            <div class="photo-acts">
              <button class="btn sm pri" id="phUp">${hasPhoto ? 'Change photo' : 'Add photo'}</button>
              ${hasPhoto ? '<button class="btn sm danger-t" id="phDel">Remove photo</button>' : ''}
            </div>
          </div>
        </div>
      </section>
      <section class="card">
        <h2>Notifications</h2>
        <p class="hint" style="margin-bottom:6px">Emails go to ${esc(me.email)}.</p>
        <label class="toggle"><span><b>Interviews assigned to me</b><small>An email when an interview is assigned to you, with the time and place.</small></span>
          <input type="checkbox" id="nAssigned" ${n.assigned ? 'checked' : ''}></label>
        <label class="toggle"><span><b>New announcements</b><small>A copy of each new announcement meant for you.</small></span>
          <input type="checkbox" id="nAnn" ${n.announcements ? 'checked' : ''}></label>
      </section>
    </div>
    <section class="card"><h2>Change password</h2>
      <form id="pwf" class="mt"><label>Current password<input type="password" name="current" required autocomplete="current-password"></label>
        <label>New password<input type="password" name="next" required minlength="6" autocomplete="new-password"></label>
        <label>Repeat new password<input type="password" name="again" required minlength="6" autocomplete="new-password"></label>
        <p class="err" id="pwErr"></p><button class="btn pri">Update password</button></form>
    </section>
  </div>`);
  addPwToggles($('#main'));

  // Photo
  $('#phUp').onclick = () => $('#photoFile').click();
  if ($('#phDel')) $('#phDel').onclick = e => twoStep(e.currentTarget, async () => {
    try { await api('saveProfile', { photo:'' }); toast('Photo removed'); } catch (err) { toast(err.message, true); }
  });

  // Notifications (save as soon as a switch changes)
  const saveNotify = async () => {
    try {
      await api('saveProfile', { notify:{ assigned:$('#nAssigned').checked, announcements:$('#nAnn').checked } });
      toast('Notification settings saved');
    } catch (err) { toast(err.message, true); }
  };
  $('#nAssigned').onchange = saveNotify;
  $('#nAnn').onchange = saveNotify;

  // Password
  $('#pwf').onsubmit = async e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); $('#pwErr').textContent = '';
    if (f.next !== f.again) { $('#pwErr').textContent = 'The new passwords do not match.'; return; }
    try { await api('changePassword', f); e.target.reset(); toast('Password updated'); } catch (err) { $('#pwErr').textContent = err.message; }
  };
}

// Shrinks a chosen picture to a small square so it stores quickly and privately
function resizePhoto(file, size) {
  size = size || 160;
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('Please choose a picture file (JPG or PNG).'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const c = document.createElement('canvas'); c.width = c.height = size;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      let q = 0.85, data = c.toDataURL('image/jpeg', q);
      while (data.length > 40000 && q > 0.4) { q -= 0.1; data = c.toDataURL('image/jpeg', q); }
      resolve(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That picture could not be opened. Please try a JPG or PNG.')); };
    img.src = url;
  });
}

/* ---------- Show / hide password ---------- */
const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a10.6 10.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
function addPwToggles(root) {
  (root || document).querySelectorAll('input[type=password]:not([data-eye])').forEach(inp => {
    inp.dataset.eye = '1';
    const wrap = document.createElement('span');
    wrap.className = 'pw';
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pw-eye'; b.innerHTML = EYE;
    b.title = 'Show password'; b.setAttribute('aria-label', 'Show password');
    b.onclick = () => {
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      b.innerHTML = show ? EYE_OFF : EYE;
      b.title = show ? 'Hide password' : 'Show password';
      b.setAttribute('aria-label', b.title);
      inp.focus();
    };
    wrap.appendChild(b);
  });
}

/* ---------- Install as an app ---------- */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (S.data) render(); });
window.addEventListener('appinstalled', () => {
  installEvt = null; if (S.data) render();
  toast('Installed – look for "AP Stake" on your home screen or apps list');
});
async function installApp() {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice;
  installEvt = null;
  if (S.data) render();
}
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* ---------- Start ---------- */
addPwToggles();
$('#out').innerHTML = icon('out');
$('#out').onclick = () => signOut();
$('#meBtn').onclick = () => go('acct');
$('#meMini').onclick = () => go('acct');
$('#menuBtn').onclick = openMenu;
$('#sideClose').onclick = closeMenu;
$('#scrim').onclick = closeMenu;
$('#links').addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
window.addEventListener('resize', () => { if (window.innerWidth > 960) closeMenu(); });
$('#nav').onclick = e => { const b = e.target.closest('button'); if (b) go(b.dataset.p); };
$('#main').addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go); });

$('#photoFile').onchange = async e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    toast('Uploading photo…');
    const data = await resizePhoto(file);
    await api('saveProfile', { photo:data });
    toast('Photo updated');
  } catch (err) { toast(err.message, true); }
};

$('#loginForm').onsubmit = async e => {
  e.preventDefault(); const b = $('#lBtn'); b.disabled = true; b.textContent = 'Signing in…'; $('#lErr').textContent = '';
  try {
    const r = await run('login', $('#lEmail').value, $('#lPw').value);
    if (r.error) throw new Error(r.error);
    S.token = r.token; if (store) store.setItem('tok', r.token);
    S.page = 'home'; await api('bootstrap'); $('#lPw').value = ''; showApp();
  } catch (err) { $('#lErr').textContent = err.message; }
  finally { b.disabled = false; b.textContent = 'Sign in'; }
};

(async () => {
  S.token = store && store.getItem('tok');
  if (!S.token) return showLogin();
  try { await api('bootstrap'); showApp(); } catch (e) { showLogin(); }
})();