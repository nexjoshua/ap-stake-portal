/* Antipolo Philippines Stake – Stake Presidency Portal (app.js) */

/* ---------- Settings you may edit ---------- */
// Your Apps Script web-app link (the hidden backend)
const API_URL = 'https://script.google.com/macros/s/AKfycbzu_C7k38r-qqzBmLBl1LqgUbPIN4rzxUup0Go8He8xPxb5SV1BgN3D-84NNKRKOKNC/exec';

// Sidebar quick links. "roles" limits who sees a link (admin = Executive Secretary,
// sp = Stake Presidency, hc = High Council, clerk = Stake Clerks). Remove "roles" to show it to everyone.
const LINKS = [
  { label:'Executive Secretary Tracker (MAIN)', url:'https://docs.google.com/spreadsheets/d/1MUhpzICBoNRWM6IKNRv_JzUq_CEG8l6M48ijrKNOHp8/edit?gid=603386809#gid=603386809', icon:'sheet', roles:['admin'] },
  { label:'Stake Presidency View', url:'https://docs.google.com/spreadsheets/d/1UeV0nundDLCrrtZKtiymy6VuXN8T2YwpCstYN96zfH0/edit?gid=1572489677#gid=1572489677', icon:'sheet', roles:['admin','sp'] },
  { label:'LCR (TR interview requests)', url:'https://lcr.churchofjesuschrist.org/', icon:'lcr', roles:['admin','sp','clerk'] },
  { label:'Stake email invitation template', url:'https://docs.google.com/document/d/1hvNcEDIkylAy3p3c0bs5snat-EHLuCBF/edit', icon:'doc', roles:['admin'] },
  { label:'2027 Stake Calendar', url:'https://docs.google.com/spreadsheets/d/1YYvVabWY9-H2Qwi1-BVVBWVfyJO0Jx46Quy7XPDWV-c/edit?gid=508604250#gid=508604250', icon:'cal' },
  { label:'SP & HC Assignments', url:'https://docs.google.com/spreadsheets/d/1tf8T3006ijVuC3Rrj3ly72g-6JVm3UQN/edit?gid=738304419#gid=738304419', icon:'sheet' },
  { label:'General Handbook ch. 29 (29.3)', url:'https://www.churchofjesuschrist.org/study/manual/general-handbook/29-meetings-in-the-church?lang=eng', icon:'book' }
];

// Ward codes and their full names
const WARD_NAMES = {
  A1:'Antipolo 1st Ward', A2:'Antipolo 2nd Ward',
  M1:'Masagana 1st Ward', M2:'Masagana 2nd Ward',
  S1:'San Isidro 1st Ward', S2:'San Isidro 2nd Ward',
  SI1:'San Isidro 1st Ward', SI2:'San Isidro 2nd Ward'
};

/* ---------- Basics ---------- */
const S = { token:null, data:null, page:'home', spkExtra:[],
  f:{ q:'', who:'', status:'open' }, cf:{ q:'', view:'open', kind:'' }, af:{ q:'', sp:'' } };
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isT = v => v === true || /^(true|yes)$/i.test(String(v));
const ROLE = { admin:'Executive Secretary', sp:'Stake Presidency', hc:'High Council', clerk:'Stake Clerk' };
const OPEN = i => !['Done','Cancelled'].includes(i.Status);
const BADGE = { 'To Schedule':'warn', 'Scheduled':'info', 'Done':'ok', 'Follow-up':'violet', 'Cancelled':'' };
const badge = s => `<span class="badge ${BADGE[s] || ''}">${esc(s || '—')}</span>`;
const opt = (arr, v) => arr.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
const optKeep = (arr, v) => opt(v && !arr.includes(v) ? [v, ...arr] : arr, v);
const empty = m => `<div class="empty">${m}</div>`;
const main = h => { $('#main').innerHTML = h; };
const wardLabel = w => WARD_NAMES[w] ? `${w} · ${WARD_NAMES[w]}` : (w || '');
const ED = () => !!(S.data && S.data.me && S.data.me.canEdit);   // executive secretary + stake presidency
// "SI1" and "S1" are the same ward
const unitKey = u => String(u || '').toUpperCase().replace(/\s+/g, '').replace(/^SI(\d+)$/, 'S$1');
const unitList = () => (S.data && S.data.units && S.data.units.list) || [];
const unitFor = w => unitList().find(u => u.key === unitKey(w));
// "Acosta, Jacquiri Joy" → "Jacquiri Acosta" (for initials)
const hcShort = n => { const [s, g] = String(n || '').split(','); return g ? g.trim().split(/\s+/)[0] + ' ' + s.trim() : String(n || ''); };

let store = null; try { store = window.sessionStorage; store.getItem('x'); } catch (e) { store = null; }
let local = null; try { local = window.localStorage; local.getItem('x'); } catch (e) { local = null; }
var installEvt = null;   // set when the browser offers "Install app"

/* ---------- Dates & times ---------- */
const parseD = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); };
const fmtD = (s, o) => { const d = parseD(s); return d ? d.toLocaleDateString('en-US', o || { weekday:'short', month:'short', day:'numeric' }) : ''; };
const LONG = { weekday:'long', month:'long', day:'numeric', year:'numeric' };
const to12 = t => { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')} ${ap}`; };
const to24 = t => { const m = String(t || '').match(/(\d{1,2}):(\d{2})\s*([AP]M)/i); if (!m) return ''; let h = +m[1] % 12; if (/p/i.test(m[3])) h += 12; return `${String(h).padStart(2, '0')}:${m[2]}`; };
const byWhen = (a, b) => { const A = a['Scheduled date'] || '9999', B = b['Scheduled date'] || '9999';
  return A < B ? -1 : A > B ? 1 : (to24(a.Time) || '99').localeCompare(to24(b.Time) || '99'); };
const tenure = s => {
  const a = parseD(s), b = parseD(S.data.today); if (!a || !b) return '';
  let m = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  if (b.getDate() < a.getDate()) m--;
  return m < 0 ? '' : `${Math.floor(m / 12)} yr ${m % 12} mo`;
};

/* ---------- Icons ---------- */
const I = {
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  todo:'<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>',
  ann:'<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12"/>',
  int:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M9 15l2 2 4-4"/>',
  calling:'<circle cx="10" cy="8" r="4"/><path d="M3 21a7 7 0 0 1 14 0M16 11l2 2 4-4"/>',
  units:'<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/>',
  spk:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
  asg:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4"/>',
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
  { id:'todo', label:'Interviews to report', icon:'todo', need: d => d.tasks && d.tasks.length, hot:true },
  { id:'ann', label:'Announcements', icon:'ann' },
  { id:'int', label:'Interviews', icon:'int' },
  { id:'cal', label:'Callings & releases', icon:'calling' },
  { id:'units', label:'High council & units', icon:'units', need:'units' },
  { id:'spk', label:'Speaking assignments', icon:'spk', need:'speaking' },
  { id:'asg', label:'Assignments', icon:'asg', need:'assignments' },
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
  if (r && r.error) {
    if (/^Unknown action/.test(r.error)) throw new Error('The backend is out of date. In Apps Script, deploy a new version.');
    throw new Error(r.error);
  }
  if (r && r.me) { S.data = r; render(); notifyNewTasks(); setTimeout(maybePopTasks, 300); }
  return r;
}
function toast(m, bad, ms) {
  const t = $('#toast'); t.textContent = m; t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(t._h); t._h = setTimeout(() => t.className = 'toast', ms || (bad ? 6000 : 3200));
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
  if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {});
  closeMenu(); showLogin();
  $('#lErr').textContent = expired ? 'Your session ended. Please sign in again.' : '';
}
function render() {
  const d = S.data, me = d.me, admin = me.role === 'admin';
  const allowed = p => (!p.admin || admin) && (!p.need || (typeof p.need === 'function' ? p.need(d) : d[p.need]));
  if (!allowed(PAGES.find(p => p.id === S.page) || {})) S.page = 'home';
  if (me.role === 'hc') S.f.who = '';
  $('#nav').innerHTML = PAGES.filter(allowed).map(p =>
    `<button data-p="${p.id}" class="${S.page === p.id ? 'on' : ''}${p.hot ? ' hot' : ''}">${icon(p.icon)}<span>${p.label}</span>${p.id === 'todo' ? `<span class="nav-badge">${d.tasks.length}</span>` : ''}</button>`).join('');
  const links = LINKS.filter(l => !l.roles || l.roles.includes(me.role));
  $('#links').innerHTML =
    (links.length ? `<h4>Quick links</h4>` + links.map(l =>
      `<a href="${esc(l.url)}" target="_blank" rel="noopener">${icon(l.icon)}<span>${esc(l.label)}</span>${icon('ext', 'ext')}</a>`).join('') : '') +
    (installEvt ? `<button class="install" id="installBtn">${icon('dl')}Install app</button>` : '');
  if ($('#installBtn')) $('#installBtn').onclick = installApp;
  $('#meName').textContent = me.name; $('#meRole').textContent = ROLE[me.role] || '';
  paintAv($('#meAv'), me.name, me.photo);
  paintAv($('#meAvMini'), me.name, me.photo);
  ({ home:pHome, todo:pTodo, ann:pAnn, int:pInt, cal:pCal, units:pUnits, spk:pSpk, asg:pAsg, ppl:pPpl, acct:pAcct })[S.page]();
}
function go(p) { S.page = p; closeMenu(); render(); window.scrollTo(0, 0); }

/* ---------- Generic form dialog ---------- */
// extra: one { label, fn } or a list of them (red buttons on the left, each needs two clicks)
// opts: { save:'Save', close:'Close' } button labels
function openForm(title, body, onSave, extra, opts) {
  const dlg = $('#dlg'), extras = extra ? [].concat(extra) : [], o = opts || {};
  dlg.innerHTML = `<form class="dlg"><header><h2>${esc(title)}</h2><button type="button" class="x" data-close aria-label="Close">×</button></header>
    <div class="body">${body}<p class="err" id="fErr"></p></div>
    <footer>${extras.map((x, i) => `<button type="button" class="btn danger-t" data-extra="${i}">${esc(x.label)}</button>`).join('')}
    <span class="grow"></span><button type="button" class="btn" data-close>${esc(o.close || 'Close')}</button><button class="btn pri" id="fSave">${esc(o.save || 'Save')}</button></footer></form>`;
  const form = dlg.querySelector('form');
  dlg.querySelectorAll('[data-close]').forEach(b => b.onclick = () => dlg.close());
  form.onsubmit = e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    form.querySelectorAll('input[type=checkbox][name]').forEach(c => f[c.name] = c.checked);
    guard(() => onSave(f));
  };
  dlg.querySelectorAll('[data-extra]').forEach(b =>
    b.onclick = e => twoStep(e.currentTarget, () => guard(extras[+b.dataset.extra].fn)));
  dlg.showModal();
  addPwToggles(dlg);
}
// Closes the pop-up right away and saves in the background.
// If saving fails, the same pop-up (with what was typed) comes back with the error.
async function guard(fn) {
  const dlg = $('#dlg'), form = dlg.querySelector('form');
  $('#fErr').textContent = '';
  dlg.close();
  toast('Saving…', false, 60000);
  try { await fn(); }
  catch (e) {
    toast(e.message, true);
    if (!dlg.open && dlg.querySelector('form') === form) { $('#fErr').textContent = e.message; dlg.showModal(); }
  }
}

/* ---------- INTERVIEWS TO REPORT (SP & HC) ---------- */
const taskKey = t => t.kind + ':' + t.id;
const TASK_KIND = { int:'Interview', cal:'Calling interview', sa:'Setting apart' };
function taskOutcomes(t) {
  const re = ['reassign', "I can't do this one – please reassign"];
  if (t.kind === 'int') return [['done', 'Completed'], ['followup', 'Not finished – needs follow-up'], re];
  if (t.kind === 'sa') return [['done', 'Set apart'], re];
  return t.release
    ? [['yes', 'Member agreed to be released'], ['no', 'Not ready yet – put on hold'], re]
    : [['yes', 'Accepted the calling'], ['no', 'Did not accept'], re];
}
function taskForm(t, pos) {
  const tasks = S.data.tasks || [], today = S.data.today;
  openForm(TASK_KIND[t.kind] + (tasks.length > 1 ? ` (${pos || 1} of ${tasks.length})` : ''), `
    <div class="task-head"><b>${esc(agendaName(t.name))}</b>
      <span class="sub">${esc(t.what)}${t.ward ? ' · ' + esc(wardLabel(t.ward)) : ''}</span>
      ${t.date ? `<span class="sub">Scheduled ${fmtD(t.date, { weekday:'short', month:'short', day:'numeric' })}${t.time ? ' · ' + esc(t.time) : ''}${t.venue ? ' · ' + esc(t.venue) : ''}</span>` : ''}</div>
    <fieldset class="opts"><legend>What happened?</legend>
      ${taskOutcomes(t).map(([v, l]) => `<label class="opt"><input type="radio" name="outcome" value="${v}" required><span>${esc(l)}</span></label>`).join('')}
    </fieldset>
    <label>Date<input type="date" name="date" value="${esc(t.date && t.date <= today ? t.date : today)}"></label>
    <label>Note for the executive secretary <span class="muted">(optional, scheduling only)</span><textarea name="note" rows="2" maxlength="300"></textarea></label>
    <p class="hint">Never record worthiness, personal or family matters here.</p>`,
    async f => {
      const r = await api('reportTask', { kind:t.kind, id:t.id, outcome:f.outcome, date:f.date, note:f.note });
      toast(r.info || 'Report sent');
    }, null, { save:'Send report', close:'Later' });
}
// Pops the form up on screen when there is something new to report (once per sign-in for the same list)
function maybePopTasks() {
  const d = S.data;
  if (!d || !d.tasks || !d.tasks.length || $('#dlg').open) return;
  const keys = d.tasks.map(taskKey).sort().join(','), k = 'tp_' + d.me.email;
  if (store && store.getItem(k) === keys) return;
  if (store) store.setItem(k, keys);
  taskForm(d.tasks[0], 1);
}
// Phone / computer notification for newly assigned items (when the portal is open or installed)
function showNote(title, body) {
  const o = { body, icon:'icon-192.png', badge:'icon-192.png', tag:'apstake-tasks', renotify:true };
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller)
    navigator.serviceWorker.ready.then(r => r.showNotification(title, o)).catch(() => {});
  else { try { new Notification(title, o); } catch (e) {} }
}
function notifyNewTasks() {
  const d = S.data; if (!d || !d.me) return;
  const cur = (d.tasks || []).map(taskKey), k = 'known_' + d.me.email;
  let known = null; try { known = JSON.parse(local && local.getItem(k)); } catch (e) {}
  try { local && local.setItem(k, JSON.stringify(cur)); } catch (e) {}
  if ('setAppBadge' in navigator) (cur.length ? navigator.setAppBadge(cur.length) : navigator.clearAppBadge()).catch(() => {});
  if (!Array.isArray(known) || !('Notification' in window) || Notification.permission !== 'granted') return;
  const fresh = (d.tasks || []).filter(t => !known.includes(taskKey(t)));
  if (!fresh.length) return;
  showNote(fresh.length === 1 ? 'New ' + TASK_KIND[fresh[0].kind].toLowerCase() + ' assigned to you' : fresh.length + ' new interviews assigned to you',
    fresh.map(t => agendaName(t.name) + ' – ' + t.what).join('\n'));
}
async function askNotify() {
  if (!('Notification' in window)) return toast('This browser can\'t show notifications. On iPhone, add the portal to your Home Screen first, then open it from there.', true, 9000);
  const p = await Notification.requestPermission();
  if (p === 'granted') { toast('Notifications are on for this device'); showNote('Notifications are on', 'You will be told here when an interview is assigned to you.'); }
  else toast('Notifications were not allowed. You can change this in your browser settings.', true, 7000);
  render();
}
// Checks for new assignments every 5 minutes and whenever the portal comes back on screen
async function checkTasks() {
  if (!S.token || !S.data || document.visibilityState !== 'visible') return;
  try {
    const r = await run('api', S.token, 'ping', {});
    if (!r || r.error || !r.tasks) return;
    const a = r.tasks.map(taskKey).sort().join(','), b = (S.data.tasks || []).map(taskKey).sort().join(',');
    if (a !== b && !$('#dlg').open) await api('bootstrap');
  } catch (e) {}
}

function pTodo() {
  const T = S.data.tasks || [];
  const canAsk = 'Notification' in window && Notification.permission === 'default';
  main(`<div class="head"><div><h1>Interviews to report</h1><p class="muted">Tell the executive secretary how each one went. It leaves this list once you send the report.</p></div></div>
  ${canAsk ? `<div class="note info"><span>Get a notification on this device when a new interview is assigned to you.</span><button class="btn sm pri" id="askN">Turn on notifications</button></div>` : ''}
  <div class="stack">${T.map((t, i) => `<section class="card task"><div class="task-row">
    <span class="badge ${t.kind === 'sa' ? 'violet' : t.kind === 'int' ? 'info' : 'warn'}">${TASK_KIND[t.kind]}</span>
    <div class="grow"><div class="t">${esc(agendaName(t.name))}</div>
      <div class="sub">${esc(t.what)}${t.ward ? ' · ' + esc(wardLabel(t.ward)) : ''}${t.date ? ' · ' + fmtD(t.date) + (t.time ? ' ' + esc(t.time) : '') : ''}</div></div>
    <button class="btn pri sm" data-task="${i}">Report</button></div></section>`).join('') || empty('Nothing to report. Thank you!')}</div>`);
  document.querySelectorAll('#main [data-task]').forEach(b => b.onclick = () => taskForm(T[+b.dataset.task], +b.dataset.task + 1));
  if ($('#askN')) $('#askN').onclick = askNotify;
}

/* ---------- HOME ---------- */
function pHome() {
  const d = S.data, me = d.me, admin = me.role === 'admin', clerk = me.role === 'clerk', ed = ED(), all = admin || clerk;
  const today = d.today, wk = addDays(today, 7);
  const inWeek = i => i['Scheduled date'] && i['Scheduled date'] >= today && i['Scheduled date'] <= wk;
  const open = d.interviews.filter(OPEN);
  const mine = all ? open : open.filter(i => i.Interviewer === me.interviewer);
  const upcoming = mine.filter(i => i['Scheduled date'] >= today).sort(byWhen).slice(0, 6);
  const noIv = open.filter(i => !i.Interviewer);
  const calOpenList = C().rows.filter(calOpen);
  const myCal = all ? calOpenList : calOpenList.filter(mineCal);
  const tasks = d.tasks || [];
  const myUnit = me.interviewer && unitList().find(u => u.interviewer === me.interviewer);
  const mySpk = me.interviewer && d.speaking ? d.speaking.rows.filter(r => r.Speaker === me.interviewer && r.Date >= today)
    .sort((a, b) => a.Date.localeCompare(b.Date))[0] : null;
  const spkUnit = mySpk && unitFor(mySpk.Ward);
  const stats = admin ? [
    ['To schedule', open.filter(i => i.Status === 'To Schedule').length, 'warn'],
    ['Needs an interviewer', noIv.length + calOpenList.filter(c => !c.Interviewer).length, 'bad'],
    ['Scheduled next 7 days', open.filter(inWeek).length, 'info'],
    ['Callings in progress', calOpenList.length, 'violet']
  ] : clerk ? [
    ['Open interviews', open.length, 'info'],
    ['Scheduled next 7 days', open.filter(inWeek).length, 'ok'],
    ['To record in LCR', calOpenList.filter(c => stage(c)[0] === 'Record in LCR').length, 'violet'],
    ['Announcements', d.announcements.length, 'mute']
  ] : [
    ['To report', tasks.length, tasks.length ? 'warn' : 'ok'],
    ['My open interviews', mine.length, 'info'],
    ['My callings & releases', myCal.length, 'violet'],
    ['Announcements', d.announcements.length, 'mute']
  ];
  const hr = new Date().getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const item = i => `<li class="item"><div class="when"><b>${fmtD(i['Scheduled date'], { day:'numeric' })}</b><span>${fmtD(i['Scheduled date'], { month:'short' })}</span></div>
    <div class="grow"><div class="t">${esc(i.Name)}</div><div class="sub">${esc(i.Type)} · ${esc(i.Ward)} · ${esc(i.Time || 'Time TBD')}${i.Venue ? ' · ' + esc(i.Venue) : ''}</div></div>
    <div class="sub r">${esc(i.Interviewer || 'Unassigned')}</div></li>`;
  main(`<div class="head"><div><p class="eyebrow">${fmtD(today, LONG)}</p><h1>${greet}, ${esc(me.name)}</h1>
    ${myUnit ? `<p class="muted">Your assigned unit: <b>${esc(wardLabel(myUnit.code))}</b>${myUnit.time ? ' · meets at ' + esc(myUnit.time) : ''}</p>` : ''}
    ${mySpk ? `<p class="muted">Your next talk: <b>${fmtD(mySpk.Date, { weekday:'short', month:'short', day:'numeric' })}</b> · ${esc(wardLabel(mySpk.Ward))}${spkUnit && spkUnit.time ? ' · ' + esc(spkUnit.time) : ''}${mySpk.Topic ? ' · ' + esc(mySpk.Topic) : ''}
      <button class="link" data-go="spk">View →</button></p>` : ''}</div></div>
  ${tasks.length ? `<div class="note info"><span><b>You have ${tasks.length} interview${tasks.length === 1 ? '' : 's'} to report.</b> Tell the executive secretary how ${tasks.length === 1 ? 'it' : 'they'} went.</span>
    <button class="btn sm pri" data-go="todo">Report now</button></div>` : ''}
  <div class="stats">${stats.map(([l, n, c]) => `<div class="stat ${c}"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('')}</div>
  <div class="cols">
    <section class="card">
      <div class="card-h"><h2>${all ? 'Upcoming interviews' : 'My upcoming interviews'}</h2><button class="link" data-go="int">View all →</button></div>
      ${upcoming.length ? `<ul class="list">${upcoming.map(item).join('')}</ul>` : empty('Nothing scheduled yet.')}
      ${ed && noIv.length ? `<div class="card-h mt"><h2>Needs an interviewer</h2></div><ul class="list">${noIv.slice(0, 5).map(i =>
        `<li class="item"><div class="grow"><div class="t">${esc(i.Name)}</div><div class="sub">${esc(i.Type)} · ${esc(i.Ward)} · ${esc(i.Purpose)}</div></div>
        <button class="btn sm pri" data-assign="${esc(i.ID)}">Assign</button></li>`).join('')}</ul>` : ''}
    </section>
    <section class="card">
      <div class="card-h"><h2>Announcements</h2><button class="link" data-go="ann">See all →</button></div>
      ${d.announcements.slice(0, 3).map(a => `<div class="mini"><div class="t">${isT(a.Pinned) ? '📌 ' : ''}${esc(a.Title)}</div>
        <div class="sub">${fmtD(a.Posted, { month:'short', day:'numeric' })} · ${esc(a.Audience)}</div>
        <p>${esc(String(a.Body).slice(0, 160))}${String(a.Body).length > 160 ? '…' : ''}</p></div>`).join('') || empty('No announcements yet.')}
    </section>
  </div>
  ${C().ok && (all || myCal.length) ? `<section class="card mt">
    <div class="card-h"><h2>${all ? 'Callings & releases in progress' : 'My callings & releases'}</h2><button class="link" data-go="cal">View all →</button></div>
    ${myCal.length ? `<ul class="list">${myCal.slice().sort(byInterview).slice(0, 6).map(c => { const [st, cls] = stage(c); return `<li class="item"><div class="grow"><div class="t">${esc(c.Name)}</div>
      <div class="sub">${esc(c.Action)}${c.Ward ? ' · ' + esc(c.Ward) : ''}${c.Calling ? ' · ' + esc(c.Calling) : ''}${c['Interview date'] ? ' · ' + fmtD(c['Interview date']) + (c.Time ? ' ' + esc(c.Time) : '') : ''}</div></div>
      <span class="badge ${cls}">${st}</span></li>`; }).join('')}</ul>` : empty('Nothing in progress.')}
  </section>` : ''}`);
  document.querySelectorAll('#main [data-assign]').forEach(b => b.onclick = () => intForm(findInt(b.dataset.assign)));
}

/* ---------- INTERVIEWS ---------- */
const findInt = id => S.data.interviews.find(i => i.ID === id);
function pInt() {
  const d = S.data, me = d.me, ed = ED(), seeAll = me.role !== 'hc';
  const open = d.interviews.filter(OPEN);
  const chip = (v, l, c) => `<button class="chip ${S.f.who === v ? 'on' : ''}" data-w="${esc(v)}">${esc(l)}<span>${c}</span></button>`;
  const per = d.lists.interviewers.map(x => ({ n:x.name, sp:x.role === 'sp', c:open.filter(i => i.Interviewer === x.name).length }));
  main(`<div class="head"><div><h1>Interviews</h1><p class="muted">${seeAll ? 'Temple recommend and other interview requests across the stake' : 'Interviews assigned to you'}</p></div>
    ${ed ? '<button class="btn pri" id="newInt">+ New interview</button>' : ''}</div>
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
  if (ed) $('#newInt').onclick = () => intForm();
  $('#tb').onclick = e => {
    const ed2 = e.target.closest('[data-edit]'); if (ed2) return intForm(findInt(ed2.dataset.edit));
    const dn = e.target.closest('[data-done]'); if (dn) markDone(dn.dataset.done);
  };
  drawInt();
}
function drawInt() {
  const d = S.data, me = d.me, ed = ED(), q = S.f.q.toLowerCase();
  let rows = d.interviews.filter(i => S.f.status === 'all' ? true : S.f.status === 'open' ? OPEN(i) : i.Status === 'Done');
  if (S.f.who === '__none') rows = rows.filter(i => !i.Interviewer); else if (S.f.who) rows = rows.filter(i => i.Interviewer === S.f.who);
  if (q) rows = rows.filter(i => [i.Name, i.Ward, i.Purpose, i.Type, i.Interviewer, i.Venue].join(' ').toLowerCase().includes(q));
  rows.sort(byWhen);
  $('#tb').innerHTML = rows.length ? rows.map(i => {
    const mine = i.Interviewer && i.Interviewer === me.interviewer;
    const acts = (ed ? `<button class="btn sm" data-edit="${esc(i.ID)}">Edit</button>` : '') +
      ((mine || ed) && OPEN(i) ? `<button class="btn sm ok" data-done="${esc(i.ID)}">Mark done</button>` : '');
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
  toast('Saving…', false, 60000);
  try { await api('setInterviewStatus', { id, status:'Done' }); toast('Marked as done'); } catch (e) { toast(e.message, true); }
}
function intForm(i) {
  i = i || { Type:'Temple Recommend', Status:'To Schedule', 'Member notified':'No' };
  const L = S.data.lists;
  openForm(i.ID ? 'Edit interview · ' + i.ID : 'New interview', `
    <div class="grid2"><label>Type<select name="Type">${opt(L.types, i.Type)}</select></label>
      <label>Ward<select name="Ward"><option value="">—</option>${L.wards.map(w => `<option value="${esc(w)}" ${w === i.Ward ? 'selected' : ''}>${esc(wardLabel(w))}</option>`).join('')}</select></label></div>
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

/* ---------- CALLINGS & RELEASES ---------- */
const CAL0 = { ok:false, error:'', rows:[], cols:[], lists:{ actions:[], statuses:[], where:[] } };
const C = () => (S.data && S.data.callings) || CAL0;
const hasCol = f => C().cols.includes(f);
const isRel = c => /releas/i.test(c.Action || '');
const isCancel = c => /cancel/i.test(c.Status || '');
const mineCal = c => { const n = S.data.me.interviewer; return !!n && (c.Interviewer === n || c['Set apart by'] === n); };
const agendaName = n => /,/.test(n) ? (n.split(',').slice(1).join(',').trim() + ' ' + n.split(',')[0].trim()).trim() : String(n || '');
const findCal = id => C().rows.find(c => c.ID === id);
const byInterview = (a, b) => (a['Interview date'] || '9999').localeCompare(b['Interview date'] || '9999') || String(a.Name).localeCompare(String(b.Name));

function ivOptions(v) {
  const L = S.data.lists.interviewers;
  const groups = [['Stake Presidency', L.filter(x => x.role === 'sp')], ['High Council', L.filter(x => x.role === 'hc')]].filter(g => g[1].length);
  return '<option value="">— Not assigned yet —</option>' +
    (v && !L.some(x => x.name === v) ? `<option selected>${esc(v)}</option>` : '') +
    groups.map(([g, xs]) => `<optgroup label="${g}">${xs.map(x => `<option ${x.name === v ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</optgroup>`).join('');
}

// Where each calling is in the process
function stage(c) {
  if (isCancel(c)) return ['Cancelled', ''];
  if (c.Accepted === 'No') return [isRel(c) ? 'On hold' : 'Declined', 'bad'];
  const lcrDone = !hasCol('Recorded in LCR') || isT(c['Recorded in LCR']);
  if (isRel(c)) {
    if (c['Sustained date']) return lcrDone ? ['Released', 'ok'] : ['Record in LCR', 'violet'];
    if (c.Accepted === 'Yes') return ['Ready to present', 'info'];
  } else {
    if (c['Set apart date']) return lcrDone ? ['Set apart', 'ok'] : ['Record in LCR', 'violet'];
    if (c['Sustained date']) return ['To set apart', 'violet'];
    if (c.Accepted === 'Yes') return ['Ready to sustain', 'info'];
  }
  if (!c.Interviewer) return ['Needs interviewer', 'bad'];
  return [c['Interview date'] ? 'Interview set' : 'To interview', 'warn'];
}
const calOpen = c => !['Cancelled', 'Declined', 'Released', 'Set apart'].includes(stage(c)[0]);

// Gives open callings without an interviewer their unit's high councilor
async function autoFill(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Filling…'; }
  toast('Filling interviewers from units…', false, 60000);
  try { const r = await api('autoAssign'); toast(r.info || 'Done', false, 7000); }
  catch (e) { toast(e.message, true, 7000); if (btn) { btn.disabled = false; btn.textContent = 'Fill interviewers from units'; } }
}

function pCal() {
  const me = S.data.me, ed = ED(), hc = me.role === 'hc', cal = C(), F = S.cf;
  if (hc && F.kind === 'none') F.kind = '';
  const head = `<div class="head"><div><h1>Callings & releases</h1><p class="muted">${hc ? 'Callings and releases assigned to you'
      : me.role === 'clerk' ? 'Mark each one once it is recorded in LCR' : 'Extending callings, releases, sustaining and setting apart'}</p></div>
    ${ed && cal.ok ? `<div class="head-acts"><button class="btn" id="fillBtn" title="Give each open calling without an interviewer its ward's assigned high councilor">Fill interviewers from units</button>
      <button class="btn" id="agBtn">Build stake agenda</button><button class="btn pri" id="newCal">+ New</button></div>` : ''}</div>`;
  if (!cal.ok) return main(head + `<div class="card">${empty('The Callings & Releases tab could not be read.<br><span class="sub">' + esc(cal.error || 'Please update the Apps Script backend.') + '</span>')}</div>`);

  const open = cal.rows.filter(calOpen);
  const kinds = [['', 'All', open.length], ['ext', 'Extend calling', open.filter(c => !isRel(c)).length], ['rel', 'Release', open.filter(isRel).length]];
  if (!hc) kinds.push(['none', 'Needs interviewer', open.filter(c => !c.Interviewer).length]);
  if (hasCol('Recorded in LCR') && (ed || me.role === 'clerk')) kinds.push(['lcr', 'To record in LCR', open.filter(c => stage(c)[0] === 'Record in LCR').length]);
  main(head + `<div class="chips" id="cKind">${kinds.map(([v, l, n]) => `<button class="chip ${F.kind === v ? 'on' : ''}" data-k="${v}">${l}<span>${n}</span></button>`).join('')}</div>
  <div class="toolbar"><input id="cq" class="input" placeholder="Search name, ward, calling…" value="${esc(F.q)}">
    <div class="seg" id="cst">${[['open', 'Open'], ['done', 'Finished'], ['all', 'All']].map(([v, l]) => `<button data-s="${v}" class="${F.view === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
  <div class="card flush"><table class="tbl"><thead><tr><th>Member</th><th>Action</th><th>Ward</th><th>Interviewer</th><th>Interview</th><th>Progress</th><th></th></tr></thead><tbody id="ctb"></tbody></table></div>`);

  $('#cq').oninput = e => { F.q = e.target.value; drawCal(); };
  $('#cst').onclick = e => { const b = e.target.closest('button'); if (!b) return; F.view = b.dataset.s;
    $('#cst').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); drawCal(); };
  $('#cKind').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; F.kind = b.dataset.k;
    $('#cKind').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); drawCal(); };
  if (ed) { $('#newCal').onclick = () => calForm(); $('#agBtn').onclick = agendaForm; $('#fillBtn').onclick = e => autoFill(e.currentTarget); }
  $('#ctb').onclick = async e => {
    const edb = e.target.closest('[data-cedit]'); if (edb) return calForm(findCal(edb.dataset.cedit));
    const rc = e.target.closest('[data-crec]'); if (rc) return recForm(findCal(rc.dataset.crec));
    const lc = e.target.closest('[data-clcr]');
    if (lc) {
      lc.disabled = true; toast('Saving…', false, 60000);
      try { await api('recordCalling', { id:lc.dataset.clcr, 'Recorded in LCR':'Yes' }); toast('Marked as recorded in LCR'); }
      catch (err) { lc.disabled = false; toast(err.message, true); }
    }
  };
  drawCal();
}

function drawCal() {
  const F = S.cf, me = S.data.me, ed = ED(), q = F.q.toLowerCase();
  const canLcr = (ed || me.role === 'clerk') && hasCol('Recorded in LCR');
  let rows = C().rows.filter(c => F.view === 'all' ? true : F.view === 'open' ? calOpen(c) : !calOpen(c));
  if (F.kind === 'ext') rows = rows.filter(c => !isRel(c));
  else if (F.kind === 'rel') rows = rows.filter(isRel);
  else if (F.kind === 'none') rows = rows.filter(c => !c.Interviewer);
  else if (F.kind === 'lcr') rows = rows.filter(c => stage(c)[0] === 'Record in LCR');
  if (q) rows = rows.filter(c => [c.Name, c.Ward, wardLabel(c.Ward), c.Calling, c.Action, c.Interviewer, c['Set apart by'], c.Venue].join(' ').toLowerCase().includes(q));
  rows.sort(byInterview);
  const short = s => fmtD(s, { month:'short', day:'numeric' });
  $('#ctb').innerHTML = rows.length ? rows.map(c => {
    const [st, cls] = stage(c);
    const u = !c.Interviewer && unitFor(c.Ward);
    const dates = [c['Sustained date'] && (isRel(c) ? 'Released ' : 'Sustained ') + short(c['Sustained date']),
                   c['Set apart date'] && 'Set apart ' + short(c['Set apart date'])].filter(Boolean).join(' · ');
    const acts = (ed ? `<button class="btn sm" data-cedit="${esc(c.ID)}">Edit</button>` : '') +
      (!ed && mineCal(c) && calOpen(c) && st !== 'Record in LCR' ? `<button class="btn sm ok" data-crec="${esc(c.ID)}">Record</button>` : '') +
      (canLcr && st === 'Record in LCR' ? `<button class="btn sm ok" data-clcr="${esc(c.ID)}">Recorded in LCR</button>` : '');
    return `<tr>
      <td data-l="Member"><div><b>${esc(c.Name)}</b><div class="sub">${esc(c.Calling || '')}</div></div></td>
      <td data-l="Action">${esc(c.Action)}</td>
      <td data-l="Ward"><div>${esc(c.Ward)}${WARD_NAMES[c.Ward] ? `<div class="sub">${esc(WARD_NAMES[c.Ward])}</div>` : ''}</div></td>
      <td data-l="Interviewer"><div>${c.Interviewer ? esc(c.Interviewer)
        : `<span class="warn-t">Not assigned</span>${u && u.interviewer ? `<div class="sub">Unit HC: ${esc(u.interviewer)}</div>` : ''}`}${!isRel(c) && c['Set apart by'] ? `<div class="sub">Set apart: ${esc(c['Set apart by'])}</div>` : ''}</div></td>
      <td data-l="Interview"><div>${c['Interview date'] ? `${fmtD(c['Interview date'])}<div class="sub">${esc(c.Time || '')}${c.Venue ? ' · ' + esc(c.Venue) : ''}</div>` : '<span class="muted">Not scheduled</span>'}</div></td>
      <td data-l="Progress"><div><span class="badge ${cls}">${st}</span>${dates ? `<div class="sub">${dates}</div>` : ''}</div></td>
      <td class="acts">${acts}</td></tr>`;
  }).join('') : `<tr><td colspan="7">${empty('No callings match.')}</td></tr>`;
}

// Add / edit (executive secretary + stake presidency). Choosing a ward fills in its assigned high councilor.
function calForm(c) {
  const L = C().lists, isNew = !c;
  c = c || { Action: L.actions.find(a => !/releas/i.test(a)) || L.actions[0] || '', Status: L.statuses[0] || '' };
  const f = (k, html) => hasCol(k) ? html : '';
  const yn = (name, v) => `<select name="${name}">${opt(['', 'Yes', 'No'], v)}</select>`;
  const cancelSt = hasCol('Status') && L.statuses.find(s => /cancel/i.test(s));
  openForm(isNew ? 'New calling or release' : 'Edit · ' + c.Name, `
    <div class="grid2"><label>Action<select name="Action">${optKeep(L.actions, c.Action)}</select></label>
      ${f('Ward', `<label>Ward<select name="Ward"><option value="">—</option>${S.data.lists.wards.map(w => `<option value="${esc(w)}" ${w === c.Ward ? 'selected' : ''}>${esc(wardLabel(w))}</option>`).join('')}</select></label>`)}</div>
    <label>Member name<input name="Name" required value="${esc(c.Name)}" placeholder="e.g. Kristian Trajano"></label>
    ${f('Calling', `<label>Calling<input name="Calling" value="${esc(c.Calling)}" placeholder="e.g. Ward Clerk"></label>`)}
    ${f('Interviewer', `<label>Interviewer<select name="Interviewer">${ivOptions(c.Interviewer)}</select><small class="hint" id="ivAuto"></small></label>`)}
    <div class="grid3">
      ${f('Interview date', `<label>Interview date<input type="date" name="Interview date" value="${esc(c['Interview date'])}"></label>`)}
      ${f('Time', `<label>Time<input type="time" name="Time" value="${to24(c.Time)}"></label>`)}
      ${f('Venue', `<label>Venue<input name="Venue" list="venues" value="${esc(c.Venue)}"></label>`)}</div>
    ${f('Accepted', `<label>Accepted / agreed${yn('Accepted', c.Accepted)}</label>`)}
    <div class="grid2">
      ${f('Sustained date', `<label>Presented on <span class="muted">(sustained or released)</span><input type="date" name="Sustained date" value="${esc(c['Sustained date'])}"></label>`)}
      ${f('Sustained where', `<label>Where presented<select name="Sustained where">${optKeep(['', ...L.where], c['Sustained where'] || '')}</select></label>`)}</div>
    <div class="grid2">
      ${f('Set apart by', `<label>Set apart by <span class="muted">(callings only)</span><select name="Set apart by">${ivOptions(c['Set apart by'])}</select></label>`)}
      ${f('Set apart date', `<label>Set apart on<input type="date" name="Set apart date" value="${esc(c['Set apart date'])}"></label>`)}</div>
    <div class="grid2">
      ${f('Recorded in LCR', `<label>Recorded in LCR${yn('Recorded in LCR', c['Recorded in LCR'])}</label>`)}
      ${f('Status', `<label>Status<select name="Status">${optKeep(['', ...L.statuses], c.Status || '')}</select></label>`)}</div>
    ${f('Notes', `<label>Notes <span class="muted">(scheduling only)</span><textarea name="Notes" rows="2">${esc(c.Notes)}</textarea></label>`)}
    <p class="hint">Never record worthiness, personal or family matters here.</p>`,
    async v => { if (v.Time !== undefined) v.Time = to12(v.Time); if (c.ID) v.ID = c.ID; await api('saveCalling', v); toast('Saved'); },
    [
      c.ID && cancelSt && !isCancel(c) ? { label:'Cancel calling', fn: async () => { await api('saveCalling', { ID:c.ID, Status:cancelSt }); toast('Cancelled'); } } : null,
      c.ID ? { label:'Delete', fn: async () => { await api('deleteCalling', { id:c.ID }); toast('Deleted'); } } : null
    ].filter(Boolean));

  // Auto-fill the unit's high councilor as interviewer
  const wSel = $('#dlg [name=Ward]'), iSel = $('#dlg [name=Interviewer]'), hint = $('#ivAuto');
  if (wSel && iSel && hint) {
    let auto = '';
    const apply = set => {
      const u = unitFor(wSel.value), ivn = u && u.interviewer;
      if (set && ivn && (!iSel.value || iSel.value === auto) && [...iSel.options].some(o => o.value === ivn)) { iSel.value = ivn; auto = ivn; }
      hint.textContent = !wSel.value ? 'Choose a ward to fill in its assigned high councilor.'
        : u && u.hc ? `${ivn || u.hc} is assigned to ${u.code}. Choose someone else if he isn't available that day.`
        : 'No high councilor is assigned to this ward. Pick an interviewer.';
    };
    wSel.onchange = () => apply(true);
    apply(isNew);
  }
}

// Record results (assigned SP / HC) – the full form; the quick way is "Interviews to report"
function recForm(c) {
  const L = C().lists, rel = isRel(c), me = S.data.me.interviewer, iv = c.Interviewer === me, setter = c['Set apart by'] === me;
  const f = (k, html) => hasCol(k) ? html : '';
  openForm((rel ? 'Release · ' : 'Calling · ') + c.Name, `
    <p class="hint" style="margin:0 0 14px">${esc(c.Action)}${c.Calling ? ' · ' + esc(c.Calling) : ''}${c.Ward ? ' · ' + esc(wardLabel(c.Ward)) : ''}</p>
    ${iv ? `<div class="grid2">
      ${f('Interview date', `<label>Interview date<input type="date" name="Interview date" value="${esc(c['Interview date'] || S.data.today)}"></label>`)}
      ${f('Accepted', `<label>${rel ? 'Member agreed to the release' : 'Member accepted the calling'}<select name="Accepted">${opt(['', 'Yes', 'No'], c.Accepted)}</select></label>`)}</div>` : ''}
    ${!rel && (iv || setter) ? f('Set apart date', `<label>Set apart on <span class="muted">(after the sustaining)</span><input type="date" name="Set apart date" value="${esc(c['Set apart date'])}"></label>`) : ''}
    ${f('Status', `<label>Status<select name="Status">${optKeep(['', ...L.statuses], c.Status || '')}</select></label>`)}
    <p class="hint">Scheduling only. Never record worthiness, personal or family matters here.</p>`,
    async v => { await api('recordCalling', Object.assign({ id:c.ID }, v)); toast('Saved'); });
}

// Stake agenda. Ward callings ("Where presented" contains "Ward") are grouped under "<Ward> Only".
function agendaText(items) {
  const line = c => `- ${agendaName(c.Name)}${c.Ward ? ' (' + c.Ward + ')' : ''}${c.Calling ? ' – ' + c.Calling : ''}`;
  const scope = c => {
    const w = c['Sustained where'] || '';
    if (/ward/i.test(w) && c.Ward) return (WARD_NAMES[c.Ward] || c.Ward).replace(/\s*ward$/i, '') + ' Only';
    return /stake/i.test(w) ? '' : w;
  };
  const group = list => {
    const keys = [...new Set(list.map(scope))].sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1) || a.localeCompare(b));
    return keys.map(k => (k ? k + '\n' : '') + list.filter(c => scope(c) === k).map(line).join('\n')).join('\n\n');
  };
  const rel = items.filter(isRel), ext = items.filter(c => !isRel(c));
  return ['STAKE AGENDA', rel.length && 'Release\n' + group(rel), ext.length && 'Sustaining and Set Apart\n' + group(ext)].filter(Boolean).join('\n\n');
}

function agendaForm() {
  const pending = C().rows.filter(c => !isCancel(c) && c.Accepted !== 'No' && !c['Sustained date']);
  if (!pending.length) return toast('Nothing is waiting to be presented.', true);
  const sun = parseD(S.data.today); sun.setDate(sun.getDate() + (7 - sun.getDay()) % 7);   // coming Sunday
  const sec = (title, list) => list.length ? `<h4>${title}</h4>` + list.map(c => {
    const iv = c.Interviewer || ((unitFor(c.Ward) || {}).interviewer ? unitFor(c.Ward).interviewer + ' (unit HC)' : '');
    return `<label class="check"><input type="checkbox" class="pk" value="${esc(c.ID)}" ${c.Accepted === 'Yes' ? 'checked' : ''}>
     <span>${esc(agendaName(c.Name))}${c.Ward ? ' (' + esc(c.Ward) + ')' : ''}${c.Calling ? ' – ' + esc(c.Calling) : ''}
     <span class="muted">· ${iv ? esc(iv) : 'no interviewer'}${c.Accepted === 'Yes' ? '' : ' · not interviewed yet'}</span></span></label>`;
  }).join('') : '';
  openForm('Build stake agenda', `
    <p class="hint" style="margin:0 0 10px">Tick the names to present. Those already interviewed are ticked for you.</p>
    <div class="pick" id="agPick">${sec('Release', pending.filter(isRel))}${sec('Sustaining and set apart', pending.filter(c => !isRel(c)))}</div>
    <div class="grid2"><label>Meeting date<input type="date" name="date" id="agDate" value="${iso(sun)}"></label>
      <label>Who can see it<select name="Audience">${opt(S.data.lists.audiences, 'Everyone')}</select></label></div>
    <label>Title<input name="Title" id="agTitle" required></label>
    <label>Announcement text <span class="muted">(edit freely before posting)</span><textarea name="Body" id="agText" rows="12"></textarea></label>
    <button type="button" class="btn sm" id="agCopy">Copy text</button>
    <label class="check mt"><input type="checkbox" name="mark" checked> Save the meeting date as the sustained / released date for the ticked names</label>`,
    async f => {
      const ids = [...document.querySelectorAll('#agPick .pk:checked')].map(x => x.value);
      if (!ids.length) throw new Error('Tick at least one name.');
      await api('saveAnnouncement', { Title:f.Title, Body:f.Body, Audience:f.Audience, Pinned:true, Expires:f.date });
      if (f.mark) await api('markSustained', { ids, date:f.date });
      toast('Stake agenda posted');
    });
  const setTitle = () => { $('#agTitle').value = 'Stake Agenda · ' + fmtD($('#agDate').value, { month:'long', day:'numeric', year:'numeric' }); };
  const setText = () => {
    const ids = [...document.querySelectorAll('#agPick .pk:checked')].map(x => x.value);
    $('#agText').value = agendaText(pending.filter(c => ids.includes(c.ID)));
  };
  $('#agPick').onchange = setText; $('#agDate').onchange = setTitle;
  setTitle(); setText();
  $('#agCopy').onclick = async () => {
    try { await navigator.clipboard.writeText($('#agText').value); toast('Copied'); }
    catch (e) { $('#agText').select(); toast('Press Ctrl+C to copy', true); }
  };
}

/* ---------- HIGH COUNCIL & UNITS ---------- */
function pUnits() {
  const U = S.data.units || { list:[], hcs:[], readOnly:true }, me = S.data.me, ed = ED();
  const open = C().rows.filter(calOpen);
  const free = U.hcs.filter(h => !h.unit);
  main(`<div class="head"><div><h1>High council & units</h1><p class="muted">The high councilor assigned to a ward interviews its releases and callings unless you choose someone else</p></div>
    ${ed && C().ok ? '<button class="btn pri" id="fillBtn">Fill interviewers from units</button>' : ''}</div>
  ${ed && U.readOnly ? '<div class="note">The High Council table could not be read, so units can\'t be changed here. Run <b>checkAssignments</b> in Apps Script to see why.</div>' : ''}
  <div class="units">${U.list.map(u => {
    const n = open.filter(c => unitKey(c.Ward) === u.key).length;
    const mine = me.interviewer && u.interviewer === me.interviewer;
    return `<section class="card unit${mine ? ' mine' : ''}">
      <div class="card-h"><div><h2>${esc(wardLabel(u.code))}</h2>${u.time ? `<span class="sub">Sunday meeting · ${esc(u.time)}</span>` : ''}</div>
        ${ed && !U.readOnly ? `<button class="btn sm" data-unit="${esc(u.key)}">Change</button>` : ''}</div>
      ${u.hc ? `<div class="person">${avatar(hcShort(u.hc), '')}<div><b>${esc(u.hc)}</b><div class="sub">${u.interviewer ? 'Interviews as ' + esc(u.interviewer) : '<span class="warn-t">No matching interviewer in People & logins</span>'}</div></div></div>`
             : '<p class="warn-t" style="margin:6px 0">No high councilor assigned</p>'}
      <div class="unit-foot">${u.spName ? `<span class="sub">Presidency: ${esc(u.spName)}</span>` : '<span></span>'}
        <button class="link" data-go="cal">${n} open calling${n === 1 ? '' : 's'} →</button></div>
    </section>`; }).join('') || empty('No units found.')}</div>
  ${free.length ? `<div class="head mt"><div><h2>High councilors without a unit</h2></div></div>
    <div class="card"><ul class="list">${free.map(h => `<li class="item">${avatar(hcShort(h.name), '', 'sm')}<div class="grow"><div class="t">${esc(h.name)}</div>
      <div class="sub">${esc(h.assignment || '')}</div></div><span class="sub">${esc(h.interviewer || '')}</span></li>`).join('')}</ul></div>` : ''}`);
  if ($('#fillBtn')) $('#fillBtn').onclick = e => autoFill(e.currentTarget);
  document.querySelectorAll('#main [data-unit]').forEach(b => b.onclick = () => unitForm(U.list.find(u => u.key === b.dataset.unit)));
}

function unitForm(u) {
  const U = S.data.units;
  openForm('Assigned high councilor · ' + wardLabel(u.code), `
    <label>High councilor<select name="name"><option value="">— None —</option>${U.hcs.map(h =>
      `<option value="${esc(h.name)}" ${h.name === u.hc ? 'selected' : ''}>${esc(h.name)}${h.unit && unitKey(h.unit) !== u.key ? ' (now ' + esc(h.unit) + ')' : ''}</option>`).join('')}</select></label>
    <p class="hint">This updates the Assigned Unit column of the High Council table. Moving someone from another unit leaves that unit without a high councilor.</p>
    <label class="check mt"><input type="checkbox" name="fill" checked> Also make him the interviewer for open callings in this unit that don't have one yet</label>`,
    async f => {
      await api('setUnitHc', { unit:u.code, label:u.sheetCode || u.code, name:f.name });
      if (f.fill && f.name) { const r = await api('autoAssign'); toast('Unit updated. ' + (r.info || ''), false, 7000); } else toast('Unit updated');
    });
}

/* ---------- SPEAKING ASSIGNMENTS ---------- */
function speakerOptions(v) {
  const L = S.data.lists.interviewers;
  const groups = [['High Council', L.filter(x => x.role === 'hc')], ['Stake Presidency', L.filter(x => x.role === 'sp')]].filter(g => g[1].length);
  return '<option value="">— No speaker —</option>' +
    (v && !L.some(x => x.name === v) ? `<option selected>${esc(v)}</option>` : '') +
    groups.map(([g, xs]) => `<optgroup label="${g}">${xs.map(x => `<option ${x.name === v ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</optgroup>`).join('');
}

function pSpk() {
  const P = S.data.speaking, me = S.data.me, ed = ED(), today = S.data.today, units = unitList();
  const dates = [...new Set(P.dates.concat(S.spkExtra))].sort();
  const up = dates.filter(d => d >= today);
  const past = dates.filter(d => d < today && P.rows.some(r => r.Date === d)).reverse();
  const card = (d, isNext) => {
    const rs = P.rows.filter(r => r.Date === d);
    const filled = units.filter(u => rs.some(r => unitKey(r.Ward) === u.key && r.Speaker)).length;
    return `<section class="card spk${isNext ? ' next' : ''}">
      <div class="card-h"><div><h2>${fmtD(d, LONG)}</h2>
        <span class="sub">${isNext ? '<span class="badge info">Next</span> ' : ''}${filled} of ${units.length} wards have a speaker</span></div>
        ${ed ? `<button class="btn sm${filled ? '' : ' pri'}" data-spk="${d}">${filled ? 'Edit speakers' : 'Assign speakers'}</button>` : ''}</div>
      <ul class="list">${units.map(u => {
        const r = rs.find(x => unitKey(x.Ward) === u.key) || {};
        const mine = me.interviewer && r.Speaker === me.interviewer;
        return `<li class="item${mine ? ' me-row' : ''}"><span class="badge">${esc(u.code)}</span>
          <div class="grow"><div class="t">${r.Speaker ? esc(r.Speaker) + (mine ? ' <span class="badge info">You</span>' : '') : '<span class="muted">No speaker yet</span>'}</div>
          <div class="sub">${esc(WARD_NAMES[u.code] || u.code)}${u.time ? ' · ' + esc(u.time) : ''}${r.Topic ? ' · <b>Topic:</b> ' + esc(r.Topic) : ''}</div></div></li>`;
      }).join('')}</ul></section>`;
  };
  main(`<div class="head"><div><h1>Speaking assignments</h1><p class="muted">Every 3rd Sunday of the quarter · one speaker per ward${P.topic ? ' · default topic: ' + esc(P.topic) : ''}</p></div>
    ${ed ? '<button class="btn" id="spkAdd">+ Add a date</button>' : ''}</div>
  <div class="spk-grid">${up.map((d, i) => card(d, i === 0)).join('') || empty('No upcoming speaking Sundays.')}</div>
  ${past.length ? `<details class="past mt"><summary>Past speaking assignments (${past.length})</summary><div class="spk-grid mt">${past.map(d => card(d, false)).join('')}</div></details>` : ''}`);
  document.querySelectorAll('#main [data-spk]').forEach(b => b.onclick = () => spkForm(b.dataset.spk));
  if ($('#spkAdd')) $('#spkAdd').onclick = () => openForm('Add a speaking date', `
    <label>Date<input type="date" name="date" required></label>
    <p class="hint">For a special Sunday. The 3rd Sunday of Feb, May, Aug and Nov is added automatically.</p>`,
    async f => { S.spkExtra = [...new Set(S.spkExtra.concat(f.date))]; render(); toast('Now choose the speakers'); spkForm(f.date); });
}

function spkForm(date) {
  const P = S.data.speaking, units = unitList(), rs = P.rows.filter(r => r.Date === date);
  openForm('Speakers · ' + fmtD(date, { weekday:'short', month:'long', day:'numeric', year:'numeric' }), `
    <p class="hint" style="margin:0 0 6px">One speaker per ward. The topic is optional${P.topic ? ' (if blank: ' + esc(P.topic) + ')' : ''}.</p>
    <div class="spk-form">${units.map(u => {
      const r = rs.find(x => unitKey(x.Ward) === u.key) || {};
      return `<div class="spk-row" data-ward="${esc(u.code)}" data-time="${esc(u.time)}">
        <div class="spk-w"><b>${esc(u.code)}</b><span class="sub">${esc(WARD_NAMES[u.code] || '')}${u.time ? ' · ' + esc(u.time) : ''}</span></div>
        <select class="spk-s" aria-label="Speaker for ${esc(u.code)}">${speakerOptions(r.Speaker)}</select>
        <input class="spk-t" placeholder="Topic (optional)" value="${esc(r.Topic)}" aria-label="Topic for ${esc(u.code)}">
      </div>`; }).join('')}</div>
    <p class="err" id="spkWarn"></p>
    <p class="hint">Speakers get an email with the date, ward, meeting time and topic.</p>`,
    async () => {
      const rows = [...document.querySelectorAll('#dlg .spk-row')].map(x => ({
        ward:x.dataset.ward, speaker:x.querySelector('.spk-s').value, topic:x.querySelector('.spk-t').value.trim() }));
      await api('saveSpeaking', { date, rows });
      toast('Speakers saved');
    });
  // Warn when the same person is set for two wards that meet at the same time
  const check = () => {
    const seen = {}, clash = [];
    document.querySelectorAll('#dlg .spk-row').forEach(x => {
      const s = x.querySelector('.spk-s').value; if (!s) return;
      const k = s + '|' + (x.dataset.time || '?');
      if (seen[k]) clash.push(`${s} is set for ${seen[k]} and ${x.dataset.ward} at the same time`); else seen[k] = x.dataset.ward;
    });
    $('#spkWarn').textContent = clash.join('. ');
  };
  $('#dlg .spk-form').onchange = check; check();
}

/* ---------- ASSIGNMENTS (secretary, presidency, clerks) ---------- */
function pAsg() {
  const A = S.data.assignments, P = S.data.speaking, ed = ED(), F = S.af, today = S.data.today;
  const spName = v => { const L = A.leadership.find(x => x.interviewer && x.interviewer === v); return L ? L.name : v; };
  const sps = [...new Set(A.councilors.map(c => c.SP).filter(Boolean))];
  const unitHc = w => A.councilors.find(c => unitKey(c.Unit) === unitKey(w));
  const units = unitList();
  const nextDates = P ? P.dates.filter(d => d >= today).slice(0, 4) : [];
  main(`<div class="head"><div><h1>Assignments</h1><p class="muted">Stake leadership, high council assignments and Sunday schedules</p></div></div>
  ${ed && A.snap.length ? `<div class="note">Some parts are showing a saved copy because they couldn't be read from the High Council table${A.error ? ' (' + esc(A.error) + ')' : ''}. Run <b>checkAssignments</b> in Apps Script to see what was found.</div>` : ''}
  <section class="card"><h2>Stake presidency & clerks</h2>
    <div class="lead mt">${A.leadership.map(p => `<div class="ld">${avatar(p.name, p.photo)}<div><b>${esc(p.name)}</b><span class="sub">${esc(p.title)}</span></div></div>`).join('')}</div>
  </section>
  <div class="head mt"><div><h2>High council</h2></div></div>
  <div class="chips" id="aSp"><button class="chip ${!F.sp ? 'on' : ''}" data-sp="">All<span>${A.councilors.length}</span></button>
    ${sps.map(s => `<button class="chip ${F.sp === s ? 'on' : ''}" data-sp="${esc(s)}">${esc(spName(s))}<span>${A.councilors.filter(c => c.SP === s).length}</span></button>`).join('')}</div>
  <div class="toolbar"><input id="aq" class="input" placeholder="Search name, unit, assignment…" value="${esc(F.q)}"></div>
  <div class="card flush"><table class="tbl"><thead><tr><th>#</th><th>High councilor</th><th>Unit</th><th>Assignment</th><th>Auditor</th><th>Sustained</th><th>Presidency</th></tr></thead><tbody id="atb"></tbody></table></div>
  <div class="cols3 mt">
    <section class="card"><h2>Sunday schedule</h2>
      <ul class="list mt">${A.schedule.map(([w, t]) => { const h = unitHc(w); return `<li class="item"><span class="badge info">${esc(t)}</span>
        <div class="grow"><div class="t">${esc(wardLabel(w))}</div><div class="sub">${h ? 'High councilor: ' + esc(h.Name) : 'No high councilor assigned'}</div></div></li>`; }).join('') || empty('No schedule yet.')}</ul>
    </section>
    <section class="card"><div class="card-h"><h2>Speaking assignments</h2><button class="link" data-go="spk">Open →</button></div>
      <p class="sub" style="margin:0">Every 3rd Sunday of the quarter${P && P.topic ? ' · ' + esc(P.topic) : ''}</p>
      <ul class="list mt">${nextDates.map((d, i) => { const n = units.filter(u => P.rows.some(r => r.Date === d && unitKey(r.Ward) === u.key && r.Speaker)).length;
        return `<li class="item"><div class="grow"><div class="t">${fmtD(d, { weekday:'short', month:'short', day:'numeric', year:'numeric' })}</div>
          <div class="sub">${n} of ${units.length} wards have a speaker</div></div>${i === 0 ? '<span class="badge info">Next</span>' : ''}</li>`; }).join('') || empty('No upcoming dates.')}</ul>
    </section>
    <section class="card"><h2>Audit committee</h2>
      <ul class="list mt">${A.audit.map(([n, r]) => `<li class="item">${avatar(n, '', 'sm')}<div class="grow"><div class="t">${esc(n)}</div><div class="sub">${esc(r)}</div></div></li>`).join('') || empty('No members listed.')}</ul>
    </section>
  </div>`);
  $('#aq').oninput = e => { F.q = e.target.value; drawAsg(); };
  $('#aSp').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; F.sp = b.dataset.sp;
    $('#aSp').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); drawAsg(); };
  drawAsg();
}
function drawAsg() {
  const A = S.data.assignments, F = S.af, q = F.q.toLowerCase();
  const spName = v => { const L = A.leadership.find(x => x.interviewer && x.interviewer === v); return L ? L.name : v; };
  let rows = A.councilors.slice();
  if (F.sp) rows = rows.filter(c => c.SP === F.sp);
  if (q) rows = rows.filter(c => [c.Name, c.Unit, wardLabel(c.Unit), c.Assignment, c.Auditor, c.SP, spName(c.SP)].join(' ').toLowerCase().includes(q));
  $('#atb').innerHTML = rows.length ? rows.map(c => {
    const sus = parseD(c.Sustained);
    return `<tr>
      <td data-l="#">${esc(c.No || (A.councilors.indexOf(c) + 1))}</td>
      <td data-l="High councilor"><b>${esc(c.Name)}</b></td>
      <td data-l="Unit"><div>${c.Unit ? esc(c.Unit) + (WARD_NAMES[c.Unit] ? `<div class="sub">${esc(WARD_NAMES[c.Unit])}</div>` : '') : '<span class="muted">—</span>'}</div></td>
      <td data-l="Assignment">${esc(c.Assignment) || '<span class="muted">—</span>'}</td>
      <td data-l="Auditor">${c.Auditor ? `<span class="badge">${esc(c.Auditor)}</span>` : '<span class="muted">—</span>'}</td>
      <td data-l="Sustained"><div>${sus ? fmtD(c.Sustained, { month:'short', day:'numeric', year:'numeric' }) : esc(c.Sustained || '—')}<div class="sub">${esc(sus ? tenure(c.Sustained) : c.Tenure)}</div></div></td>
      <td data-l="Presidency">${esc(spName(c.SP)) || '<span class="muted">—</span>'}</td></tr>`;
  }).join('') : `<tr><td colspan="7">${empty('No high councilors match.')}</td></tr>`;
}

/* ---------- ANNOUNCEMENTS ---------- */
function pAnn() {
  const d = S.data, ed = ED();
  const linkify = s => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
  main(`<div class="head"><div><h1>Announcements</h1><p class="muted">${ed ? 'Each announcement shows only to the audience you choose' : 'From the stake executive secretary'}</p></div>
    ${ed ? '<button class="btn pri" id="newAnn">+ New announcement</button>' : ''}</div>
  <div class="stack" id="annList">${d.announcements.length ? d.announcements.map(a => {
    const expired = a.Expires && a.Expires < d.today;
    return `<article class="card ann ${isT(a.Pinned) ? 'pinned' : ''}"><div class="meta">${isT(a.Pinned) ? '<span class="badge info">Pinned</span>' : ''}
      <span class="badge">${esc(a.Audience || 'Everyone')}</span>${expired ? '<span class="badge warn">Expired</span>' : ''}
      <span class="sub">${fmtD(a.Posted, { month:'short', day:'numeric', year:'numeric' })} · ${esc(a['Posted by'])}</span></div>
      <h3>${esc(a.Title)}</h3><div class="body">${linkify(a.Body)}</div>
      ${ed ? `<div class="acts"><button class="btn sm" data-edit="${esc(a.ID)}">Edit</button><button class="btn sm danger-t" data-del="${esc(a.ID)}">Delete</button></div>` : ''}</article>`;
  }).join('') : empty('No announcements yet.')}</div>`);
  if (!ed) return;
  $('#newAnn').onclick = () => annForm();
  $('#annList').onclick = e => {
    const edb = e.target.closest('[data-edit]'); if (edb) return annForm(d.announcements.find(a => a.ID === edb.dataset.edit));
    const del = e.target.closest('[data-del]');
    if (del) twoStep(del, async () => { toast('Deleting…', false, 60000); try { await api('deleteAnnouncement', { id:del.dataset.del }); toast('Deleted'); } catch (err) { toast(err.message, true); } });
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

/* ---------- PEOPLE (executive secretary only) ---------- */
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
    <div class="grid2"><label>Role<select name="role">${['sp', 'hc', 'clerk', 'admin'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${ROLE[r]}</option>`).join('')}</select></label>
      <label>Interviewer name<input name="interviewer" value="${esc(u.interviewer)}" placeholder="e.g. Bro. Acosta"><small class="hint">Leave blank if not an interviewer (e.g. clerks).</small></label></div>
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
  const N = 'Notification' in window ? Notification.permission : 'none';
  main(`<div class="head"><div><h1>My account</h1><p class="muted">Your photo, notifications and password</p></div></div>
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
        <label class="toggle"><span><b>Interviews, callings & talks assigned to me</b><small>An email when an interview, release, setting apart or speaking assignment is given to you.</small></span>
          <input type="checkbox" id="nAssigned" ${n.assigned ? 'checked' : ''}></label>
        <label class="toggle"><span><b>New announcements</b><small>A copy of each new announcement meant for you.</small></span>
          <input type="checkbox" id="nAnn" ${n.announcements ? 'checked' : ''}></label>
        <div class="toggle"><span><b>Notifications on this device</b><small>${
          N === 'granted' ? 'On. This phone or computer shows a notification when something new is assigned to you while the portal is open or installed.'
          : N === 'denied' ? 'Blocked. Allow notifications for this site in your browser settings.'
          : N === 'none' ? 'This browser can\'t show notifications. On iPhone, add the portal to your Home Screen and open it from there.'
          : 'Shows a phone or computer notification when a new interview is assigned to you.'}</small></span>
          ${N === 'granted' ? '<span class="badge ok">On</span>' : N === 'default' ? '<button type="button" class="btn sm pri" id="askN2">Turn on</button>' : ''}</div>
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
  if ($('#askN2')) $('#askN2').onclick = askNotify;

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

// New-assignment checks: every 5 minutes, and whenever the portal comes back on screen
setInterval(checkTasks, 5 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkTasks(); });

$('#photoFile').onchange = async e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    toast('Uploading photo…', false, 60000);
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
