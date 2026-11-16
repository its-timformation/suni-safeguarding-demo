/* =====================================================================
   SUNI Safeguarding Training — demo build
   Data lives in localStorage (records) + IndexedDB (uploaded videos).
   Everything goes through the `Store` object so it can be swapped for
   a Cloudflare Worker API (D1 for records, R2 for video) later.
   ===================================================================== */
'use strict';

/* ---------- tiny utils ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => new Date().toISOString();
const DAY = 864e5;
const fmtDate = d => !d ? '—' : String(d).startsWith('9999') ? 'No expiry' : new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDT = d => d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const NO_EXPIRY = '9999-12-31T00:00:00.000Z';
const expiryFrom = (d, months) => months > 0 ? addMonths(d, months) : NO_EXPIRY;
const renewLabel = pw => pw.validityMonths > 0 ? `renew every ${pw.validityMonths} months` : 'no expiry';
const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x.toISOString(); };
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const initials = n => n.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
const avatarColour = n => ['#C8303D', '#1B766C', '#A6600C', '#6C4C70', '#24666D', '#B04468'][parseInt(hash(n), 36) % 6];
const firstName = n => n.split(' ')[0];
const pick = a => a[Math.floor(Math.random() * a.length)];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 2600);
}

const ICON = {
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="14" height="14" rx="3"/><path d="m16.5 10 5-3v10l-5-3"/></svg>',
  read: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v16H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M4 20.5A1.5 1.5 0 0 0 5.5 22H19v-3"/><path d="M8 7h7M8 11h5"/></svg>',
  quiz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.2a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.4-2.8 4"/><circle cx="12" cy="17.4" r=".6" fill="currentColor"/></svg>',
  attest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 4 5.5v6c0 5 3.4 8.8 8 10 4.6-1.2 8-5 8-10v-6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.5v.01"/></svg>',
  heart: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.4h2c.7-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M17.5 14.6c2.3.3 3.7 1.9 4 4.4"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
  path: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H15a3.5 3.5 0 0 1 0 7H9a3.5 3.5 0 0 0 0 7h6.5"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>',
  cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  link: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 15 6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  dl: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>',
  print: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 9V3h10v6M7 17H4.5a1.5 1.5 0 0 1-1.5-1.5V11a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4.5a1.5 1.5 0 0 1-1.5 1.5H17"/><rect x="7" y="14" width="10" height="7" rx="1"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
};
/* Official Scripture Union NI artwork (from suni.co.uk), injected at build time as data URIs */
const LOGO = (h = 40, white = false) => `<img src="${white ? window.SU_LOGO_WHITE : window.SU_LOGO}" alt="Scripture Union Northern Ireland" style="height:${h}px;width:auto;display:block">`;
const FLAME = (w = 34) => `<img src="${window.SU_FLAME}" alt="" aria-hidden="true" style="width:${w}px;height:auto;display:block">`;

/* =====================================================================
   MOCK DATABASE  —  same tables and columns as schema.sql (Cloudflare D1)
   ---------------------------------------------------------------------
   volunteers        id, first_name, last_name, email (unique), status,
                     created_at, archived_at, profile (JSON: roles, events…)
   training_records  id, volunteer_id, module_name, completed_at,
                     details (JSON: expiry, version, score, certificate…)
   audit_logs        id, created_at, volunteer_id, actor, action, details
   app               pathways, events, quiz progress, settings, outbox…
   Each table is its own localStorage key. To move to D1, replace
   Store.load/save with calls to a Worker API (see README) — the row
   shapes below are exactly what the Worker would read and write.
   ===================================================================== */
const NS = 'suni-demo-v11';
const TABLE = { volunteers: NS + ':volunteers', training_records: NS + ':training_records', audit_logs: NS + ':audit_logs', app: NS + ':app' };
const Rows = {
  volunteer: p => ({ id: p.id, first_name: p.first_name, last_name: p.last_name, email: String(p.email).toLowerCase(), status: p.archived ? 'archived' : 'active', created_at: p.createdAt, archived_at: p.archived ? (p.archivedAt || now()) : null,
    profile: { type: p.type, phone: p.phone || '', org: p.org || '', roles: p.roles, event_ids: p.eventIds, notes: p.notes || '', access_ni: p.accessNI || null, invite_token: p.token, featured: !!p.featured } }),
  person: r => ({ id: r.id, first_name: r.first_name, last_name: r.last_name, name: `${r.first_name} ${r.last_name}`.trim(), email: r.email, archived: r.status === 'archived', archivedAt: r.archived_at, createdAt: r.created_at,
    type: r.profile?.type, phone: r.profile?.phone, org: r.profile?.org, roles: r.profile?.roles || [], eventIds: r.profile?.event_ids || [], notes: r.profile?.notes, accessNI: r.profile?.access_ni, token: r.profile?.invite_token || uid('inv-'), featured: r.profile?.featured }),
  record: c => ({ id: c.id, volunteer_id: c.personId, module_name: c.pathwayTitle, completed_at: c.completedAt,
    details: { pathway_id: c.pathwayId, expires_at: c.expiresAt, version: c.version, score: c.score, attestation_name: c.attestationName, attestation_text: c.attestationText, manual: c.manual || null, revoked: c.revoked || null, edits: c.edits || [], name_on_cert: c.nameOnCert || null, reissued_from: c.reissuedFrom || null } }),
  completion: r => ({ id: r.id, personId: r.volunteer_id, pathwayTitle: r.module_name, completedAt: r.completed_at, pathwayId: r.details?.pathway_id, expiresAt: r.details?.expires_at, version: r.details?.version, score: r.details?.score, attestationName: r.details?.attestation_name, attestationText: r.details?.attestation_text,
    manual: r.details?.manual || undefined, revoked: r.details?.revoked || null, edits: r.details?.edits || [], nameOnCert: r.details?.name_on_cert || undefined, reissuedFrom: r.details?.reissued_from || undefined }),
  auditRow: a => ({ id: a.id, created_at: a.at, volunteer_id: a.personId || null, actor: a.actor, action: a.action, details: { pathway_id: a.pathwayId, version: a.version, step_id: a.stepId, ...(a.detail ? { data: a.detail } : {}) } }),
  auditEntry: r => ({ id: r.id, at: r.created_at, personId: r.volunteer_id || undefined, actor: r.actor, action: r.action, pathwayId: r.details?.pathway_id, version: r.details?.version, stepId: r.details?.step_id, detail: r.details?.data }),
};
const Store = {
  load() {
    try {
      const get = k => JSON.parse(localStorage.getItem(TABLE[k]));
      const app = get('app'), vols = get('volunteers'), recs = get('training_records'), logs = get('audit_logs');
      if (!app || !vols || !recs || !logs) return null;
      return { ...app, people: vols.map(Rows.person), completions: recs.map(Rows.completion), audit: logs.map(Rows.auditEntry) };
    } catch { return null; }
  },
  save(db) {
    try {
      const { people, completions, audit, ...app } = db;
      localStorage.setItem(TABLE.volunteers, JSON.stringify(people.map(Rows.volunteer)));
      localStorage.setItem(TABLE.training_records, JSON.stringify(completions.map(Rows.record)));
      localStorage.setItem(TABLE.audit_logs, JSON.stringify(audit.map(Rows.auditRow)));
      localStorage.setItem(TABLE.app, JSON.stringify(app));
    } catch (e) { console.warn(e); toast('Could not save — browser storage is full or blocked'); }
  },
  clear() { try { Object.keys(localStorage).filter(k => k.startsWith('suni-')).forEach(k => localStorage.removeItem(k)); } catch { } },
  /* raw table access, used by the admin “Database” view and CSV export */
  table(name) { try { return JSON.parse(localStorage.getItem(TABLE[name])) || []; } catch { return []; } },
};
/* tidy up storage from earlier demo builds */
try { Object.keys(localStorage).filter(k => /^suni-safeguarding-demo-v\d+$/.test(k)).forEach(k => localStorage.removeItem(k)); } catch { }
const splitName = n => { const parts = String(n).trim().split(/\s+/); return { first_name: parts.shift() || '', last_name: parts.join(' ') }; };
function setName(p, first, last) { p.first_name = first.trim(); p.last_name = last.trim(); p.name = `${p.first_name} ${p.last_name}`.trim(); return p; }
/* Media: IndexedDB for uploaded videos (too big for localStorage) */
const Media = {
  _db: null, urls: {},
  open() { return this._db || (this._db = new Promise((res, rej) => { const r = indexedDB.open('suni-sg-media', 1); r.onupgradeneeded = () => r.result.createObjectStore('m'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
  async put(id, blob) { const d = await this.open(); return new Promise((res, rej) => { const t = d.transaction('m', 'readwrite'); t.objectStore('m').put(blob, id); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
  async get(id) { const d = await this.open(); return new Promise((res) => { const r = d.transaction('m').objectStore('m').get(id); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); },
  async url(id) {
    if (this.urls[id]) return this.urls[id];
    if (id === 'seed-video-1') return this.urls[id] = seedVideoUrl();
    const b = await this.get(id).catch(() => null); if (!b) return null;
    return this.urls[id] = URL.createObjectURL(b);
  },
};
let _seedUrl = null;
function seedVideoUrl() {
  if (_seedUrl) return _seedUrl;
  const b64 = window.SEED_VIDEO_B64; if (!b64 || b64.startsWith('__')) return null;
  const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return _seedUrl = URL.createObjectURL(new Blob([u8], { type: 'video/mp4' }));
}

let db, persistCount = 0;
function persist() { persistCount++; Store.save(db); }
function audit(entry) {
  db.audit.push({ id: uid('a_'), at: now(), ...entry });
  persist();
}

/* ---------- domain helpers ---------- */
const P = id => db.pathways.find(p => p.id === id);
/* lookup indexes (rebuilt after each save) so 3,000+ volunteers stay fast */
let _pIdx = null, _pStamp = '', _cIdx = null, _cStamp = '';
const Person = id => { const st = db.people.length + ':' + persistCount; if (_pStamp !== st) { _pIdx = new Map(db.people.map(p => [p.id, p])); _pStamp = st; } return _pIdx.get(id); };
const EventById = id => db.events.find(e => e.id === id);
const stepRev = s => hash(JSON.stringify({ ...s, rev: undefined }));

function requiredPathwaysFor(person) {
  const ids = new Set();
  db.pathways.forEach(p => { if (p.active !== false && p.requiredForRoles.some(r => person.roles.includes(r))) ids.add(p.id); });
  person.eventIds.forEach(eid => { const e = EventById(eid); if (e) e.requiredPathways.forEach(id => ids.add(id)); });
  return [...ids].map(P).filter(Boolean);
}
function latestCompletion(personId, pathwayId) {
  const st = db.completions.length + ':' + persistCount;
  if (_cStamp !== st) { _cIdx = new Map(); for (const c of db.completions) { if (c.revoked) continue; const k = c.personId + '|' + c.pathwayId, cur = _cIdx.get(k); if (!cur || c.completedAt > cur.completedAt) _cIdx.set(k, c); } _cStamp = st; }
  return _cIdx.get(personId + '|' + pathwayId);
}
const NO_PROGRESS = Object.freeze({ steps: Object.freeze({}), startedAt: null });
function prog(personId, pathwayId, create = true) {
  if (!create) return db.progress[personId]?.[pathwayId] || NO_PROGRESS;
  db.progress[personId] ??= {};
  return db.progress[personId][pathwayId] ??= { steps: {}, startedAt: null };
}
function stepDone(pr, step) { const s = pr.steps[step.id]; return !!(s && s.done && s.rev === step.rev); }
function quizLocked(pr, step) {
  const s = pr.steps[step.id]; if (!s || s.rev !== step.rev) return false;
  const fails = (s.attempts || []).filter(a => !a.passed && !a.voided).length;
  return step.lock !== false && !s.done && fails >= step.maxAttempts;
}
/* status for one person + pathway */
function statusOf(person, pathway) {
  const c = latestCompletion(person.id, pathway.id);
  const soon = (db.settings.dueSoonDays || 30) * DAY;
  if (c) {
    const left = new Date(c.expiresAt) - Date.now();
    if (left > soon) return { key: 'complete', label: 'Complete', c };
    if (left > 0) return { key: 'due', label: `Due ${fmtDate(c.expiresAt)}`, c };
  }
  const pr = prog(person.id, pathway.id, false);
  if (pathway.steps.some(s => s.type === 'quiz' && quizLocked(pr, s))) return { key: 'locked', label: 'Needs review', c };
  const any = pathway.steps.some(s => stepDone(pr, s));
  if (any) return { key: 'progress', label: `In progress · ${pctDone(pr, pathway)}%`, c };
  if (c) return { key: 'expired', label: 'Expired', c };
  return { key: 'none', label: 'Not started', c };
}
function pctDone(pr, pathway) {
  const total = pathway.steps.length + 1; // + attestation
  return Math.round(pathway.steps.filter(s => stepDone(pr, s)).length / total * 100);
}
const chip = st => `<span class="chip st-${st.key}"><span class="dot"></span>${esc(st.label)}</span>`;
function personCompliant(person) {
  const req = requiredPathwaysFor(person);
  return req.length > 0 && req.every(p => ['complete', 'due'].includes(statusOf(person, p).key));
}
/* ready = valid through the event; renew = trained now but a certificate lapses before the event ends; todo = training missing */
function eventState(person, ev) {
  const end = new Date(ev.endDate || ev.date); let state = 'ready';
  for (const pid of ev.requiredPathways) {
    const c = latestCompletion(person.id, pid);
    if (!c || new Date(c.expiresAt) < new Date()) return 'todo';
    if (new Date(c.expiresAt) <= end) state = 'renew';
  }
  return state;
}
const readyForEvent = (person, ev) => eventState(person, ev) === 'ready';

/* ---------- seed data ---------- */
function seed() {
  const roles = ['Camp Leader', 'Mission Team', 'SU Group Volunteer', 'Staff', 'Trustee', 'Partner church leader'];
  const essentialsQs = [
    ['What does “safeguarding” mean?', ['Protecting children and adults at risk from harm and abuse, and promoting their welfare', 'Making sure buildings and equipment are safe to use', 'Checking that every volunteer has an AccessNI certificate', 'Reporting crimes to the police'], 0, 'Safeguarding is about protecting children and adults at risk from harm and abuse — and actively promoting their welfare.'],
    ['According to the video, how do we safeguard children and adults?', ['By questioning the person until they tell us what is wrong', 'By paying attention to signs of abuse and telling someone about it', 'By waiting until we have proof before saying anything', 'By leaving it to social services to notice'], 1, 'We all safeguard by noticing the signs and telling someone. You don’t need proof — you need to share the concern.'],
    ['A council worker discovers a five-year-old is regularly left alone at home while his mum goes to work. What form of abuse is this?', ['Financial abuse', 'Emotional abuse', 'Neglect', 'It is not abuse if the parent is at work'], 2, 'Regularly leaving a young child alone and unsupervised is neglect — the child’s basic need for care and safety isn’t being met.'],
    ['What did the council worker do once she realised the child was on his own?', ['Contacted her manager, who contacted social services', 'Waited a few days to see if it happened again', 'Went in to look after the child herself', 'Told the neighbour to keep an eye on him'], 0, 'She followed procedure: she raised it with her manager straight away, and it was passed to social services.'],
    ['Why does acting quickly matter?', ['It means you won’t have to fill in a form later', 'It can have a major impact — keeping the person safe and getting the family support sooner', 'It doesn’t — it is better to wait and watch', 'So that the person in charge isn’t disturbed'], 1, 'Acting quickly can make a major difference. In the video, earlier reporting would have meant the mother got support even sooner.'],
    ['Who has the opportunity to help protect children and adults at risk?', ['Only social workers and the police', 'Only the Designated Safeguarding Officer', 'Everyone — by keeping their eyes open, using their instincts and telling someone', 'Only people who have a safeguarding qualification'], 2, 'Safeguarding is everyone’s responsibility. Keep your eyes open, use your instincts, and tell someone.'],
    ['In Mr Smith’s story, what made the post office staff concerned?', ['Mr Smith seemed unwell', 'A man claiming to be a relative used Mr Smith’s card and PIN and withdrew £50 instead of the usual £20', 'Mr Smith withdrew all of his savings', 'Mr Smith forgot his PIN'], 1, 'A change from someone’s usual pattern — a stranger with the card and PIN, taking out more than usual — was a red flag.'],
    ['What type of abuse does Mr Smith’s story illustrate?', ['Physical abuse', 'Neglect', 'Financial abuse', 'Discriminatory abuse'], 2, 'Someone taking control of an adult’s money without proper authority is financial abuse.'],
    ['What did the post office staff do about their concerns?', ['Confronted the man and refused to serve him', 'Contacted the safeguarding team', 'Did nothing because the man had the correct PIN', 'Phoned Mr Smith’s neighbours'], 1, 'They passed their concern to the safeguarding team — they didn’t try to investigate it themselves.'],
    ['“People don’t always know they’re being abused.” What does this mean for us?', ['We should wait until the person asks for help', 'It’s none of our business unless they complain', 'We have an opportunity — and a responsibility — to notice and speak up for them', 'We should tell the person they are being abused'], 2, 'Because people may not recognise abuse themselves, others noticing and telling someone is vital.'],
    ['You have a worry about a young person but you are not sure it is “serious enough”. What should you do?', ['Keep quiet in case you are wrong', 'Investigate further by asking them lots of questions', 'Share the concern with the Designated Safeguarding Officer — it’s their job to decide next steps', 'Post about it in the team WhatsApp group'], 2, 'You don’t have to be certain. Share the concern with the right person and let them decide what happens next.'],
  ];
  const leaderQs = [
    ['A young person says: “I’ll tell you something, but only if you promise not to tell anyone.” What do you say?', ['“I promise, it’s just between us.”', '“I can’t promise to keep it a secret if you or someone else might be at risk, but I’ll only tell people who need to know.”', '“Then don’t tell me — I don’t want to know.”', '“Let’s wait and talk about it at the end of the week.”'], 1, 'Never promise confidentiality. Be honest that you may need to pass it on, and that you will only tell people who need to know.'],
    ['A child begins to disclose something worrying. What is the best response?', ['Ask detailed questions to get the full story', 'Listen calmly, don’t ask leading questions, and reassure them they did the right thing in telling you', 'Tell them you’re sure it was a misunderstanding', 'Go and speak to the person they’ve mentioned'], 1, 'Listen, stay calm, avoid leading questions, and reassure them. Investigation is not your role.'],
    ['How should you record a disclosure?', ['Summarise it later in your own words when you have time', 'Write down exactly what was said, in the child’s words, with the date and time — as soon as possible — and sign it', 'Don’t write anything down, it could be seen by others', 'Record it on your phone’s notes app and share it with the team'], 1, 'Record accurately and promptly, in the child’s own words, and sign and date it. Give it to the Designated Safeguarding Officer.'],
    ['Who should you report a safeguarding concern to at camp or mission?', ['The young person’s friends', 'The Designated Safeguarding Officer (or the safeguarding lead for the event) on the same day', 'Nobody until the event has finished', 'Your church minister when you get home'], 1, 'Report to the Designated Safeguarding Officer or event safeguarding lead as soon as possible — the same day.'],
    ['A child is in immediate danger and you can’t reach the safeguarding lead. What do you do?', ['Wait until the safeguarding lead is available', 'Call 999', 'Send an email to the office', 'Ask the child what they want you to do'], 1, 'If a child is in immediate danger, call 999 first, then inform the safeguarding lead as soon as you can.'],
    ['Which of these is good practice for one-to-one time with a young person?', ['Meet somewhere private so they feel comfortable', 'Stay within sight of another leader and let others know where you are', 'Give them a lift home on your own', 'Swap personal phone numbers so they can message you'], 1, 'Stay visible to other leaders. Avoid situations where you are alone and unobserved with a young person.'],
    ['A young person from camp sends you a friend request on your personal social media. What should you do?', ['Accept — it’s a nice way to keep in touch', 'Politely decline and follow the organisation’s guidance on online contact', 'Accept, but only message them privately', 'Ignore it and say nothing to anyone'], 1, 'Don’t connect with young people through personal accounts or private messages. Follow the organisation’s online safety guidance.'],
    ['You’re worried about the way a fellow leader is behaving with the young people. What should you do?', ['Say nothing — they’re a friend', 'Talk to the leader’s family', 'Report your concern to the Designated Safeguarding Officer', 'Wait to see if anyone else notices'], 2, 'Concerns about adults must be reported too. Speak to the Designated Safeguarding Officer — this is part of keeping everyone safe.'],
  ];
  const mkQs = arr => arr.map(([text, options, correct, explanation]) => ({ id: uid('q_'), text, options, correct, explanation }));

  const essentials = {
    id: 'p-essentials', title: 'Safeguarding Essentials', colour: '#D63744',
    summary: 'The foundations every SUNI volunteer needs: what safeguarding is, how to spot the signs, and what to do.',
    validityMonths: 24, requiredForRoles: [...roles], active: true, version: 1,
    attestation: 'I confirm that I have completed this training personally, that I understand the content, and that I will follow SUNI’s Safeguarding Policy and procedures.',
    steps: [
      { id: 's-e1', type: 'video', title: 'What is safeguarding?', description: 'Real stories that show what safeguarding looks like — and why noticing and telling someone matters.', video: { source: 'file', mediaId: 'seed-video-1', fileName: 'Video 1 of 5 – What is Safeguarding.mp4', vtt: window.SEED_VTT || '' }, minWatchPct: 95 },
      { id: 's-e2', type: 'quiz', title: 'Check your understanding', drawCount: 5, passMark: 80, maxAttempts: 3, questions: mkQs(essentialsQs) },
      { id: 's-e3', type: 'read', title: 'If you are worried about a child', link: { label: 'SUNI website', url: 'https://www.suni.co.uk' },
        ackText: 'I have read and understood what to do if I am worried about a child or young person.',
        body: `## Sample content — replace with SUNI’s Safeguarding Policy\nThe welfare of the child or young person is always paramount. If something worries you, act on it.\n\n## Do\n- Listen calmly and take what you are told seriously\n- Reassure them they were right to tell you\n- Explain that you will need to tell someone who can help\n- Write down what was said, in their words, with the date and time\n- Tell the Designated Safeguarding Officer the same day\n\n## Don’t\n- Promise to keep a secret\n- Ask leading questions or try to investigate\n- Confront anyone who may be involved\n- Discuss it with anyone who doesn’t need to know\n\n## In an emergency\nIf a child is in immediate danger, call **999**, then tell the Designated Safeguarding Officer.` },
    ],
  };
  const leaders = {
    id: 'p-leaders', title: 'Leading at Camps & Missions', colour: '#1B766C',
    summary: 'For leaders on residential camps and missions: responding to disclosures, safe practice and working together.',
    validityMonths: 12, requiredForRoles: ['Camp Leader', 'Mission Team'], active: true, version: 1,
    attestation: 'I confirm that I have completed this training personally and will follow the Code of Conduct and safeguarding procedures at every SUNI camp or mission I serve on.',
    steps: [
      { id: 's-l1', type: 'read', title: 'Code of conduct for leaders', ackText: 'I have read and will follow the Code of Conduct for leaders.', link: null,
        body: `## Sample content — replace with SUNI’s Code of Conduct\nAs a leader you are a role model. These expectations protect young people — and you.\n\n## Always\n- Treat every young person with respect and dignity\n- Stay within sight of other leaders when with a young person\n- Keep physical contact appropriate, public and in response to the young person’s needs\n- Use only approved channels for any contact before or after an event\n- Report any concern — about a young person or an adult — to the safeguarding lead\n\n## Never\n- Spend time alone with a young person out of sight of others\n- Connect with young people on personal social media or private messaging\n- Give lifts alone without agreement from the event leader\n- Take or share photos except on approved devices and with consent` },
      { id: 's-l2', type: 'video', title: 'Responding to a disclosure', description: 'Add your own video here — upload a file or paste a YouTube/Vimeo link in the admin area. (Demo: reuses video 1.)', video: { source: 'file', mediaId: 'seed-video-1', fileName: 'Placeholder', vtt: window.SEED_VTT || '' }, minWatchPct: 95 },
      { id: 's-l3', type: 'quiz', title: 'Scenarios', drawCount: 5, passMark: 80, maxAttempts: 3, questions: mkQs(leaderQs) },
    ],
  };
  [essentials, leaders].forEach(p => { p.steps.forEach(s => s.rev = stepRev(s)); p.updatedAt = now(); p.versions = [{ version: 1, at: now(), note: 'First published', by: 'Admin' }]; });

  const events = [
    { id: 'ev-p7', name: 'P7 Camp — Summer 2027', date: '2027-07-05', endDate: '2027-07-09', location: 'Castlewellan', requiredPathways: ['p-essentials', 'p-leaders'] },
    { id: 'ev-beach', name: 'Portstewart Beach Mission 2027', date: '2027-07-19', endDate: '2027-08-01', location: 'Portstewart', requiredPathways: ['p-essentials', 'p-leaders'] },
    { id: 'ev-groups', name: 'SU Groups 2026/27', date: '2026-09-01', endDate: '2027-06-30', location: 'Schools across NI', requiredPathways: ['p-essentials'] },
    { id: 'ev-teen', name: 'Teen Camp — Summer 2027', date: '2027-07-12', endDate: '2027-07-17', location: 'Castlewellan', requiredPathways: ['p-essentials', 'p-leaders'] },
    { id: 'ev-ballycastle', name: 'Ballycastle Mission 2027', date: '2027-07-26', endDate: '2027-08-06', location: 'Ballycastle', requiredPathways: ['p-essentials', 'p-leaders'] },
    { id: 'ev-newcastle', name: 'Newcastle Holiday Club', date: '2027-04-06', endDate: '2027-04-09', location: 'Newcastle, Co. Down', requiredPathways: ['p-essentials'] },
  ];
  const mk = (name, email, roles, eventIds) => setName({ id: uid('u_'), email, roles, eventIds, token: uid('inv-'), createdAt: new Date(Date.now() - 400 * DAY).toISOString(), featured: true, type: 'volunteer', accessNI: { status: 'cleared', date: '2025-03-01' } }, splitName(name).first_name, splitName(name).last_name);
  const people = [
    mk('Hannah Doyle', 'hannah.doyle@example.com', ['Camp Leader'], ['ev-p7', 'ev-beach']),
    mk('James McCartney', 'james.mccartney@example.com', ['Mission Team'], ['ev-beach']),
    mk('Aoife Kelly', 'aoife.kelly@example.com', ['SU Group Volunteer'], ['ev-groups']),
    mk('Ruth Patterson', 'ruth.patterson@example.com', ['Camp Leader'], ['ev-p7']),
    mk('Mark Beattie', 'mark.beattie@example.com', ['SU Group Volunteer'], ['ev-groups']),
    { ...mk('Grace Wilson', 'grace.wilson@example.com', ['Staff'], []), type: 'staff', org: 'SUNI' },
  ];
  db = { schema: 1, settings: { orgName: 'Scripture Union Northern Ireland', short: 'SUNI', dsoName: 'Designated Safeguarding Officer', dsoPhone: '', dsoEmail: '', dueSoonDays: 30, retentionYears: 5, autoCleanup: true, lastCleanup: new Date().toISOString().slice(0, 10), adminName: 'Admin (demo)', demoControls: true, followUpDays: 5 }, roles, pathways: [essentials, leaders], events, people, progress: {}, completions: [], audit: [] };

  // history so the dashboard has something to show
  const back = d => new Date(Date.now() - d * DAY).toISOString();
  const complete = (person, pathway, daysAgo, score) => {
    const at = back(daysAgo); const certId = certNumber(at);
    db.completions.push({ id: certId, personId: person.id, pathwayId: pathway.id, pathwayTitle: pathway.title, version: pathway.version, completedAt: at, expiresAt: expiryFrom(at, pathway.validityMonths), score, attestationName: person.name, attestationText: pathway.attestation });
    const qz = pathway.steps.find(s => s.type === 'quiz');
    if (qz) { if (score === 80 && Math.random() < .3) fakeAttempt(person, pathway, qz, 60, back(daysAgo + 0.05)); fakeAttempt(person, pathway, qz, score, back(daysAgo + 0.01)); }
    db.audit.push({ id: uid('a_'), at, personId: person.id, actor: 'learner', action: 'attested', pathwayId: pathway.id, version: 1, detail: { name: person.name, certId } });
  };
  const [hannah, james, aoife, ruth, mark] = people;
  complete(hannah, essentials, 250, 100); complete(hannah, leaders, 248, 80);
  complete(james, essentials, 712, 80);
  complete(aoife, essentials, 790, 100);
  // Ruth: watched the video, failed once
  const pr = (db.progress[ruth.id] = {})[essentials.id] = { startedAt: back(2), steps: {} };
  pr.steps['s-e1'] = { done: true, rev: essentials.steps[0].rev, watched: 306, at: back(2) };
  db.audit.push({ id: uid('a_'), at: back(2), personId: ruth.id, actor: 'learner', action: 'video_completed', pathwayId: essentials.id, version: 1, stepId: 's-e1', detail: {} });
  pr.steps['s-e2'] = { rev: essentials.steps[1].rev, attempts: [fakeAttempt(ruth, essentials, essentials.steps[1], 60, back(1.9))] };
  // Mark: 3 fails → needs review
  const pm = (db.progress[mark.id] = {})[essentials.id] = { startedAt: back(5), steps: {} };
  pm.steps['s-e1'] = { done: true, rev: essentials.steps[0].rev, watched: 306, at: back(5) };
  const markWeak = ['form of abuse', 'type of abuse', 'not sure it is']; // consistently struggles with recognising types of abuse
  pm.steps['s-e2'] = { rev: essentials.steps[1].rev, attempts: [60, 40, 60].map((sc, i) => fakeAttempt(mark, essentials, essentials.steps[1], sc, back(5 - i * .4), markWeak)) };
  db.audit.push({ id: uid('a_'), at: back(4.1), personId: mark.id, actor: 'system', action: 'quiz_locked', pathwayId: essentials.id, version: 1, stepId: 's-e2', detail: { reason: 'Maximum attempts reached — flagged for follow-up' } });
  seedCrowd(essentials, leaders, back, complete);
  seedRetentionCases(essentials, leaders, back, complete);
  db.emailRules = defaultRules(); db.outbox = [];
  // a little history: last week's automatic reminders
  db.people.filter(p => !p.featured).slice(0, 40).forEach((p, i) => { const r = db.emailRules[[1, 2, 4, 6][i % 4]]; const at = back(1 + (i % 9));
    db.outbox.push({ id: uid('m_'), at, to: p.email, personId: p.id, subject: mergeText(r.subject, p, { training: 'Safeguarding Essentials', daysLeft: 30, expiry: addMonths(at, 1), event: EventById(p.eventIds[0]) }), body: mergeText(r.body, p, { training: 'Safeguarding Essentials', daysLeft: 30, expiry: addMonths(at, 1), event: EventById(p.eventIds[0]) }), source: 'automatic', ruleId: r.id, key: null, by: 'system' }); });
  db.audit.push({ id: uid('a_'), at: back(500), actor: 'admin', action: 'demo_seeded', detail: { note: 'Sample data created' } });
  db.audit.sort((a, b) => a.at.localeCompare(b.at));
  persist();
}
/* A realistic past quiz attempt (questions shown, answers given) for sample data */
function fakeAttempt(person, pathway, step, score, at, weak = [], rnd = Math.random) {
  const n = Math.min(step.drawCount, step.questions.length); const wrongN = Math.round(n * (100 - score) / 100);
  const pool = [...step.questions].sort(() => rnd() - .5);
  const weakQs = pool.filter(q => weak.some(w => q.text.includes(w))).slice(0, wrongN);
  const rest = pool.filter(q => !weakQs.includes(q)).slice(0, n - weakQs.length);
  const drawnQs = [...weakQs, ...rest]; let wrongLeft = wrongN;
  const questions = drawnQs.map(q => { const wrong = wrongLeft-- > 0; const wrongOpts = q.options.map((_, i) => i).filter(i => i !== q.correct);
    const chosen = wrong ? wrongOpts[Math.floor(rnd() * wrongOpts.length)] : q.correct;
    return { id: q.id, text: q.text, chosen: q.options[chosen], answer: q.options[q.correct], correct: !wrong }; }).sort(() => rnd() - .5);
  const a = { at, score, passed: score >= step.passMark, questions };
  db.audit.push({ id: uid('a_'), at, personId: person.id, actor: 'learner', action: 'quiz_attempt', pathwayId: pathway.id, version: pathway.version, stepId: step.id, detail: { score, passed: a.passed, questions } });
  return a;
}
/* ~300 realistic sample volunteers (deterministic, so every reset looks the same) */
function seedCrowd(essentials, leaders, back, complete, opts = {}) {
  const scale = opts.scale || 1, lite = !!opts.lite;
  let x = opts.seed || 20261116; const rnd = () => { x |= 0; x = x + 0x6D2B79F5 | 0; let t = Math.imul(x ^ x >>> 15, 1 | x); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pickR = a => a[Math.floor(rnd() * a.length)];
  const first = ['Aaron','Abbie','Adam','Aimee','Amy','Andrew','Anna','Ben','Beth','Caleb','Callum','Caitlin','Ciara','Chloe','Daniel','David','Deborah','Eilidh','Ellen','Emma','Erin','Ethan','Faith','Gareth','Grace','Hannah','Holly','Isaac','Jack','Jacob','James','Jamie','Jenna','Jessica','Joel','John','Jonathan','Josh','Judith','Karen','Kate','Katie','Laura','Leah','Lucy','Luke','Lydia','Mark','Martha','Matthew','Megan','Michael','Naomi','Nathan','Niamh','Oliver','Orla','Paul','Peter','Philip','Rachel','Rebecca','Reuben','Robyn','Ross','Ruth','Ryan','Samuel','Sarah','Shannon','Simon','Sophie','Stephen','Steven','Susan','Thomas','Timothy','Victoria','William','Zoe'];
  const last = ['Adair','Allen','Anderson','Armstrong','Beattie','Bell','Boyd','Brown','Campbell','Clarke','Craig','Crawford','Cunningham','Davidson','Dickson','Doherty','Douglas','Ferguson','Fleming','Gibson','Graham','Hamilton','Henderson','Hughes','Hutchinson','Irvine','Jamison','Johnston','Kerr','Kennedy','Lennon','Logan','Lyttle','Magee','Martin','Maxwell','McAuley','McBride','McCann','McClelland','McConnell','McCullough','McDowell','McFarland','McIlwaine','McKee','McKinney','McMillan','Millar','Mitchell','Montgomery','Moore','Morrison','Murray','Neill','Orr','Patterson','Quinn','Reid','Robinson','Ross','Scott','Shaw','Smyth','Stewart','Taylor','Thompson','Walker','Wallace','Watson','White','Wilson','Wright','Young'];
  const groups = [
    { n: 14 * scale, roles: ['SU Group Volunteer'], ev: () => ['ev-groups'].concat(rnd() < .12 ? ['ev-newcastle'] : []) },
    { n: 7 * scale, roles: ['Camp Leader'], ev: () => [pickR(['ev-p7', 'ev-teen', 'ev-p7', 'ev-teen', 'ev-newcastle'])] },
    { n: 8 * scale, roles: ['Mission Team'], ev: () => [pickR(['ev-beach', 'ev-beach', 'ev-ballycastle'])].concat(rnd() < .15 ? ['ev-newcastle'] : []) },
    { n: 2 * scale, roles: ['Staff'], type: 'staff', ev: () => (rnd() < .5 ? [pickR(['ev-p7', 'ev-teen', 'ev-beach', 'ev-ballycastle'])] : []) },
    { n: Math.max(1, Math.round(1 * scale)), roles: ['Trustee'], type: 'other', ev: () => [] },
    { n: Math.max(1, Math.round(1 * scale)), roles: ['Partner church leader'], type: 'other', ev: () => (rnd() < .5 ? ['ev-groups'] : []) },
  ];
  const used = new Set(db.people.map(p => p.name)), emails = new Set(db.people.map(p => p.email));
  const done = lite ? (p, pw, daysAgo, score) => { const at = back(daysAgo); db.completions.push({ id: certNumber(at), personId: p.id, pathwayId: pw.id, pathwayTitle: pw.title, version: pw.version, completedAt: at, expiresAt: expiryFrom(at, pw.validityMonths), score, attestationName: p.name, attestationText: pw.attestation, edits: [] }); } : complete;
  groups.forEach(g => { for (let k = 0; k < g.n; k++) {
    let fn, ln, name, tries = 0; do { fn = pickR(first); ln = pickR(last); name = `${fn} ${ln}`; } while (used.has(name) && ++tries < 40); used.add(name);
    let email = name.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.com', n2 = 2; while (emails.has(email)) email = name.toLowerCase().replace(/[^a-z]+/g, '.') + (n2++) + '@example.com'; emails.add(email);
    const p = { id: uid('u_'), first_name: fn, last_name: ln, name, email, type: g.type || 'volunteer', roles: [...g.roles], eventIds: [...new Set(g.ev())], token: uid('inv-'), createdAt: back(30 + rnd() * 600),
      org: g.type === 'staff' ? 'SUNI' : rnd() < .7 ? pickR(['Newtownbreda Baptist', 'Grace Baptist, Tullycarnet', 'Knock Presbyterian', 'St Mark’s, Dundela', 'Ballyholme Presbyterian', 'Whitewell', 'Portstewart Baptist', 'Ballycastle Presbyterian', 'Lisburn Elim']) : '',
      accessNI: g.type === 'other' && g.roles[0] === 'Trustee' ? { status: 'not_required', date: '' } : rnd() < .82 ? { status: 'cleared', date: back(60 + rnd() * 700).slice(0, 10) } : { status: pickR(['applied', 'not_requested']), date: '' } };
    db.people.push(p);
    requiredPathwaysFor(p).forEach(pw => {
      const r = rnd();
      // most volunteers are trained; leaders tend to refresh in spring/early summer before camps
      const ago = pw.validityMonths <= 12 ? (rnd() < .55 ? 5 + rnd() * 120 : 120 + rnd() * 300) : 5 + rnd() * 760;
      if (r < .74) done(p, pw, Math.round(ago), pickR([80, 80, 100, 100, 100]));
      else if (r < .86) {                                                                                     // in progress
        const pr = (db.progress[p.id] ??= {})[pw.id] = { startedAt: back(3 + rnd() * 20), steps: {} };
        const vid = pw.steps.find(s => s.type === 'video'); if (vid) pr.steps[vid.id] = { done: true, rev: vid.rev, watched: 306, at: back(2) };
        if (pw.steps[0].type === 'read') pr.steps[pw.steps[0].id] = { done: true, rev: pw.steps[0].rev, at: back(3) };
        const q = pw.steps.find(s => s.type === 'quiz'); if (q && !lite && rnd() < .4) pr.steps[q.id] = { rev: q.rev, attempts: [fakeAttempt(p, pw, q, pickR([40, 60, 60]), back(1 + rnd() * 5), [], rnd)] };
      } else if (r < .885 && !lite) {                                                                                  // locked
        const pr = (db.progress[p.id] ??= {})[pw.id] = { startedAt: back(6), steps: {} };
        const vid = pw.steps.find(s => s.type === 'video'); if (vid) pr.steps[vid.id] = { done: true, rev: vid.rev, watched: 306, at: back(6) };
        const q = pw.steps.find(s => s.type === 'quiz'); const weak = [pickR(q.questions).text.slice(0, 25), pickR(q.questions).text.slice(0, 25)];
        pr.steps[q.id] = { rev: q.rev, attempts: [pickR([40, 60]), pickR([40, 60]), 60].map((sc, i) => fakeAttempt(p, pw, q, sc, back(9 - i * 2), weak, rnd)) };
        db.audit.push({ id: uid('a_'), at: back(3), personId: p.id, actor: 'system', action: 'quiz_locked', pathwayId: pw.id, version: 1, stepId: q.id, detail: { reason: 'Maximum attempts reached — flagged for follow-up' } });
      }                                                                                                       // else: not started
    });
  } });
}
/* people that show the 5-year retention rules in action */
function seedRetentionCases(essentials, leaders, back, complete) {
  const Y = 365.25;
  const mkp = (first, last, roles, eventIds, createdDaysAgo, extra = {}) => { const p = setName({ id: uid('u_'), email: `${first}.${last}`.toLowerCase() + '@example.com', type: 'volunteer', roles, eventIds, token: uid('inv-'), createdAt: back(createdDaysAgo), org: 'Knock Presbyterian', accessNI: { status: 'cleared', date: back(createdDaysAgo - 20).slice(0, 10) }, ...extra }, first, last); db.people.push(p); return p; };
  const rec = (p, pw, daysAgo) => { const at = back(daysAgo); db.completions.push({ id: certNumber(at), personId: p.id, pathwayId: pw.id, pathwayTitle: pw.title, version: 1, completedAt: at, expiresAt: expiryFrom(at, pw.validityMonths), score: 100, attestationName: p.name, attestationText: pw.attestation, edits: [] });
    db.audit.push({ id: uid('a_'), at, personId: p.id, actor: 'learner', action: 'module_completed', pathwayId: pw.id, version: 1, detail: { module: pw.title } }); };
  const archive = (p, daysAgo) => { p.archived = true; p.archivedAt = back(daysAgo); db.audit.push({ id: uid('a_'), at: p.archivedAt, personId: p.id, actor: 'admin', action: 'volunteer_archived', detail: { name: p.name } }); };
  // active, with a 6-year-old record plus a recent renewal → the old record is due for removal
  const olivia = mkp('Olivia', 'Grant', ['SU Group Volunteer'], ['ev-groups'], 7 * Y); rec(olivia, essentials, 6.1 * Y); rec(olivia, essentials, 400);
  // active, only record is 5¼ years old → after cleanup she shows as not trained
  const peter = mkp('Peter', 'Lowry', ['SU Group Volunteer'], ['ev-groups'], 6 * Y); rec(peter, essentials, 5.25 * Y);
  // archived 4 months ago, recent record kept
  const rebecca = mkp('Rebecca', 'Moore', ['Camp Leader'], [], 3 * Y); rec(rebecca, essentials, 300); rec(rebecca, leaders, 290); archive(rebecca, 120);
  // archived 2 years ago with one record over 5 years old and one inside → reactivation demo
  const daniel = mkp('Daniel', 'Hughes', ['Mission Team'], [], 7 * Y); rec(daniel, essentials, 5.6 * Y); rec(daniel, essentials, 2.4 * Y); rec(daniel, leaders, 2.4 * Y); archive(daniel, 2 * Y);
  // archived over 5 years ago → whole record due for deletion
  const stephen = mkp('Stephen', 'Bell', ['SU Group Volunteer'], [], 9 * Y); rec(stephen, essentials, 7 * Y); archive(stephen, 5.5 * Y);
  // archived last year — appears in the sample import file so the import can reactivate her
  const laura = mkp('Laura', 'Kerr', ['SU Group Volunteer'], [], 3 * Y); rec(laura, essentials, 1.6 * Y); archive(laura, 300);
}
function certNumber(at = now()) {
  const y = new Date(at).getFullYear();
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = '';
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return `SUNI-SG-${y}-${s}`;
}

/* ---------- router ---------- */
const app = () => $('#app');
let cleanup = [];
function onLeave(fn) { cleanup.push(fn); }
/* in-app history: lets Back buttons return to the previous screen (and restore its scroll) */
const navStack = [], scrollMem = {};
let navBack = false;
function replaceHash(h) { route.replacing = true; location.replace(h); }
function appBack(fallback) { if (navStack.length > 1) history.back(); else go(fallback); }
addEventListener('hashchange', e => { try { scrollMem[new URL(e.oldURL).hash || '#/'] = scrollY; } catch { } });
function route() {
  cleanup.forEach(f => { try { f(); } catch { } }); cleanup = [];
  if (!route.keepOverlays) { closeModal(); document.getElementById('drawer')?.remove(); }
  if (!(location.hash || '').startsWith('#/admin')) document.getElementById('mailpops')?.remove();   // email pop-ups are an admin-only demo aid
  document.getElementById('emenu')?.remove();
  const cur = location.hash || '#/';
  navBack = navStack.length > 1 && navStack[navStack.length - 2] === cur;
  if (route.replacing) { navStack[navStack.length - 1] = cur; route.replacing = false; navBack = false; }
  else if (navBack) navStack.pop(); else if (navStack[navStack.length - 1] !== cur) navStack.push(cur);
  const h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  const restore = navBack ? scrollMem[cur] || 0 : 0; requestAnimationFrame(() => window.scrollTo({ top: restore }));
  if (parts[0] === 'i') { const p = db.people.find(x => x.token === parts[1]); loginPrefill = p ? p.email : ''; return replaceHash('#/login'); }
  if (parts[0] === 'login') return renderLogin();
  if (parts[0] === 'auth') return renderAuth(parts[1]);
  if (parts[0] === 'me') return learnerRoute(parts.slice(1));
  if (parts[0] === 'preview') return previewAs(parts[1]);
  if (parts[0] === 'verify') return renderVerify(parts[1], parts[2]);
  if (parts[0] === 'inbox') return renderInbox(parts[1], parts[2]);
  if (parts[0] === 'admin') return adminRoute(parts.slice(1));
  return renderHub();
}
/* after each navigation: update the tab title, announce the page and move focus to it */
let _firstRoute = true, _phone = innerWidth < 620;
addEventListener('resize', () => { const ph = innerWidth < 620; if (ph !== _phone) { _phone = ph; if (!document.querySelector('#scrim,#drawer')) { route.keepFocus = true; route(); route.keepFocus = false; } } });
addEventListener('hashchange', () => setTimeout(() => {
  const h = document.querySelector('main h1'); const t = h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
  document.title = (t ? t + ' · ' : '') + 'SUNI Safeguarding Training';
  if (_firstRoute) { _firstRoute = false; }
  const live = document.getElementById('srlive'); if (live && t) live.textContent = t;
  if (!route.keepFocus && !document.querySelector('#scrim,#drawer')) { const m = document.querySelector('main'); m?.focus({ preventScroll: true }); }
}, 60));
function go(h) { if (location.hash === h) route(); else location.hash = h; }

/* topbar: on phones the logo shrinks to the flame, a Back button becomes an icon,
   and anything beyond two actions folds into a menu (admins also get their nav there) */
function topbar(right = '', home = '#/') {
  let back = ''; right = right.replace(/<a class="btn ghost sm[^"]*" href="[^"]*" data-back="[^"]*">[\s\S]*?<\/a>/, m => { back = m; return ''; });
  const menu = (right.match(/class="btn /g) || []).length > 2 || right.includes('tb-nav');
  return `<div class="topbar ${menu ? 'hasmenu' : ''}"><div class="in">
    <a class="brand" href="${home}"><span class="brand-full">${LOGO(40)}</span><span class="brand-flame">${FLAME(30).replace('alt="" aria-hidden="true"', 'alt="Scripture Union NI Safeguarding Training — home"')}</span><span class="brand-div"></span><span class="brand-lbl"><small>Safeguarding</small> <b>Training</b></span></a>
    <div class="spacer"></div>${back ? `<span class="tb-back">${back}</span>` : ''}<div class="tb-acts">${right}</div>${menu ? `<button class="iconbtn tb-more" data-act="tbmenu" aria-label="Menu" aria-expanded="false"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>` : ''}</div></div>`;
}
function demobar(active) {
  const first = db.people[0];
  return `<nav class="demobar noprint" aria-label="Demo navigation"><button class="db-tog" data-act="demobar" aria-label="Demo menu">Demo</button><span>Demo</span>
    <a href="#/" class="${active === 'hub' ? 'on' : ''}">Start</a>
    <a href="${currentVolunteer() ? '#/me' : '#/login'}" class="${active === 'learner' ? 'on' : ''}">Volunteer</a>
    <a href="#/admin" class="${active === 'admin' ? 'on' : ''}">Admin</a>${(() => { const v = active === 'learner' && currentVolunteer(); if (!v) return '';
      const n = (db.outbox || []).filter(m => m.personId === v.id && !(db.readMail || {})[m.id]).length;
      return `<a href="#/inbox/${v.token}" class="db-inbox" title="Demo: the emails ${esc(firstName(v.name))} has been sent">📬 Inbox${n ? ` <span class="ibbadge">${n}</span>` : ''}</a>`; })()}</nav>`;
}
function previewBanner() { const s = Session.get('vol'); return s?.preview ? `<div class="previewbar noprint">👁 Admin preview — you’re seeing exactly what ${esc(Person(s.volunteer_id)?.name || '')} sees. <button class="btn xs" data-act="logout">Exit preview</button></div>` : ''; }
function worriedFab() { return `<button class="fab noprint" data-act="worried" aria-label="Worried about a child? Get help">${'<span class="pulse">' + ICON.heart + '</span>'}<span class="lbl">Worried about a child?</span></button>`; }
function showWorried() {
  const s = db.settings;
  modal(`<header><h2>Worried about a child?</h2><button class="iconbtn" data-close>${ICON.x}</button></header>
  <div class="body stack">
    <div class="notice bad">${ICON.info}<div><b>If a child is in immediate danger, call 999.</b></div></div>
    <div class="card" style="box-shadow:none;background:#FBFAF8">
      <div class="eyebrow">Your safeguarding contact</div>
      <h3 style="margin:6px 0 4px">${esc(s.dsoName || 'Designated Safeguarding Officer')}</h3>
      <div class="muted">${s.dsoPhone ? `<a href="tel:${esc(s.dsoPhone)}">${esc(s.dsoPhone)}</a>` : 'Phone: <i>add in Admin → Settings</i>'} · ${s.dsoEmail ? `<a href="mailto:${esc(s.dsoEmail)}">${esc(s.dsoEmail)}</a>` : '<i>email not set</i>'}</div>
    </div>
    <ul class="reading" style="font-size:15.5px;margin:0">
      <li>Listen, stay calm and take it seriously.</li>
      <li>Don’t promise to keep it secret.</li>
      <li>Write down what was said, in their words, with the date and time.</li>
      <li>Tell the safeguarding contact the same day.</li>
    </ul>
    <p class="small muted">Need advice? The NSPCC helpline is open to adults worried about a child: <a href="tel:08088005000">0808 800 5000</a>.</p>
  </div>`);
}

/* ---------- modal ---------- */
function modal(html, cls = '') {
  closeModal();
  const s = document.createElement('div'); s.className = 'scrim'; s.id = 'scrim';
  if (!modalReturn) modalReturn = document.activeElement;
  s.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  s.addEventListener('click', e => { if (e.target === s || e.target.closest('[data-close]')) closeModal(); });
  document.body.appendChild(s);
  a11yPass(s); setTimeout(() => ($('.body input:not([type=checkbox]):not([type=radio]),.body textarea,.body select', s) || $('.modal', s)).focus?.(), 30); $('.modal', s).tabIndex = -1;
  return s;
}
let modalReturn = null;
function closeModal() { const s = $('#scrim'); if (!s) return; s.remove(); if (modalReturn && document.contains(modalReturn)) modalReturn.focus(); modalReturn = null; }
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if ($('#emenu')) { $('#emenu').remove(); return; }
    const mm = $('.moremenu:not([hidden])'); if (mm) { mm.hidden = true; mm.previousElementSibling.setAttribute('aria-expanded', 'false'); mm.previousElementSibling.focus(); return; }
    if ($('#scrim')) { closeModal(); return; }
    if ($('#drawer')) { closeDrawer?.(); return; }
    const tb = $('.topbar.open'); if (tb) { tb.classList.remove('open'); $('.tb-more', tb)?.setAttribute('aria-expanded', 'false'); $('.tb-more', tb)?.focus(); return; }
    $('.demobar.open')?.classList.remove('open');
  }
  // arrow keys move through an open "More" menu
  if (['ArrowDown', 'ArrowUp'].includes(e.key)) { const m = document.activeElement?.closest('.moremenu'); if (m) { e.preventDefault(); const it = $$('.mitem', m), i = it.indexOf(document.activeElement); it[(i + (e.key === 'ArrowDown' ? 1 : -1) + it.length) % it.length].focus(); } }
  // keep keyboard focus inside an open dialog or drawer
  if (e.key === 'Tab') { const box = $('#scrim .modal') || $('#drawer .drawer'); if (!box) return;
    const f = $$(FOCUSABLE, box).filter(x => x.offsetParent !== null); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
});
/* ---------- accessibility pass: runs after every render ----------
   labels icon-only controls, ties form labels to their fields, names dialogs,
   hides decorative SVGs from screen readers and keeps <main> focusable for the skip link */
function a11yPass(root = document) {
  root.querySelectorAll('button,a[href],[role=button]').forEach(b => { if (b.getAttribute('aria-label') || b.getAttribute('aria-labelledby')) return; const t = b.textContent.replace(/\s+/g, ' ').trim();
    if (!t || /^[×✕▾▴⋯←→]+$/.test(t)) { const l = b.title || (b.matches('[data-close],[data-dclose],.mp-x,[data-x],[data-sx]') ? 'Close' : b.matches('[data-rmr]') ? 'Remove row' : b.matches('[data-rm]') ? 'Remove from event' : b.matches('[data-copy]') ? 'Copy sign-in link' : null); if (l) b.setAttribute('aria-label', l); } });
  root.querySelectorAll('button:not([type])').forEach(b => { if (!b.closest('form')) b.type = 'button'; });
  root.querySelectorAll('.field').forEach(f => { const lab = f.querySelector(':scope > label.f'), ctl = f.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea');
    if (lab && ctl && !lab.htmlFor && !lab.contains(ctl)) { ctl.id ||= uid('f_'); lab.htmlFor = ctl.id; } });
  root.querySelectorAll('input:not([type=hidden]),select,textarea').forEach(i => { if (i.labels?.length || i.getAttribute('aria-label') || i.getAttribute('aria-labelledby')) return;
    const l = i.placeholder || i.title || i.closest('tr')?.querySelector('b')?.textContent; if (l) i.setAttribute('aria-label', (i.type === 'checkbox' ? 'Select ' : '') + l.trim()); });
  root.querySelectorAll('[role=dialog]').forEach(d => { if (d.getAttribute('aria-labelledby') || d.getAttribute('aria-label')) return; const h = d.querySelector('h1,h2'); if (h) { h.id ||= uid('h_'); d.setAttribute('aria-labelledby', h.id); } });
  root.querySelectorAll('.segbar a,.segbar button').forEach(a => { a.tabIndex = -1; a.setAttribute('aria-hidden', 'true'); });
  root.querySelectorAll('.tablewrap').forEach(w => { if (w.hasAttribute('tabindex')) return; w.tabIndex = 0; w.setAttribute('role', 'region'); const h = w.previousElementSibling?.matches?.('h2,h3') ? w.previousElementSibling : w.closest('.card,section,#adm')?.querySelector('h2,h1'); w.setAttribute('aria-label', (h?.textContent.trim() || 'Table') + ' (scrolls sideways)'); });
  root.querySelectorAll('.segbar[role=img]').forEach(b => { b.removeAttribute('role'); b.setAttribute('aria-hidden', 'true'); });   // the legend beside it carries the same numbers and links
  root.querySelectorAll('td input:not([type=checkbox]),td select').forEach(i => { if (i.labels?.length || i.getAttribute('aria-label')) return; const td = i.closest('td'), th = td.closest('table')?.querySelectorAll('thead th')[td.cellIndex]; if (th?.textContent.trim()) i.setAttribute('aria-label', th.textContent.trim()); });
  root.querySelectorAll('.switch input').forEach(i => { if (i.getAttribute('aria-label')) return; const n = i.closest('.card,.row,label')?.parentElement?.querySelector('h3') || i.closest('label')?.parentElement?.querySelector('.muted'); i.setAttribute('aria-label', (n?.textContent || 'On or off').trim()); });
  root.querySelectorAll('select').forEach(x => { if (!x.labels?.length && !x.getAttribute('aria-label')) x.setAttribute('aria-label', x.options[0]?.textContent.replace(/^(All|Any) /, 'Filter: ') || 'Choose'); });
  root.querySelectorAll('input[type=checkbox],input[type=radio]').forEach(x => { if (x.labels?.length && x.labels[0].textContent.trim() || x.getAttribute('aria-label')) return;
    const n = x.closest('.card,.dtrain,tr,.row')?.querySelector('h3,b'); if (n) x.setAttribute('aria-label', n.textContent.trim()); });
  root.querySelectorAll('svg:not([role]):not([aria-hidden])').forEach(x => x.setAttribute('aria-hidden', 'true'));
  root.querySelectorAll('img:not([alt])').forEach(x => x.setAttribute('alt', ''));
  root.querySelectorAll('textarea.autogrow').forEach(t => { if (t.offsetParent && !t.dataset.g) { t.dataset.g = 1; grow(t); } });
  const m = document.querySelector('main'); if (m && !m.id) { m.id = 'main'; m.tabIndex = -1; }
}
/* textareas marked autogrow fit their content */
const grow = t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; };
document.addEventListener('input', e => { if (e.target.matches?.('textarea.autogrow')) grow(e.target); });
let _a11yQ = false;
new MutationObserver(() => { if (_a11yQ) return; _a11yQ = true; requestAnimationFrame(() => { _a11yQ = false; a11yPass(); }); }).observe(document.documentElement, { childList: true, subtree: true });

/* ---------- confetti ---------- */
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('#confetti'), x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
  const cols = ['#D63744', '#E9A337', '#1B766C', '#80C2C8', '#6C4C70'];
  const ps = Array.from({ length: 160 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .35, vx: (Math.random() - .5) * 16, vy: -Math.random() * 14 - 4, s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[Math.floor(Math.random() * 5)] }));
  let t = 0; (function f() {
    x.clearRect(0, 0, c.width, c.height); t++;
    ps.forEach(p => { p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
    if (t < 160) requestAnimationFrame(f); else x.clearRect(0, 0, c.width, c.height);
  })();
}

/* =====================================================================
   SESSIONS & SIMULATED MAGIC-LINK LOGIN
   Live version: POST /api/auth/magic-link → Resend email; GET /auth/:token
   sets an HttpOnly session cookie. Here the link is shown in a simulated inbox.
   ===================================================================== */
const SESSION = { vol: 'suni-session:volunteer', admin: 'suni-session:admin' };
const Session = {
  get(k) { try { return JSON.parse(localStorage.getItem(SESSION[k])); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(SESSION[k], JSON.stringify(v)); } catch { } },
  clear(k) { try { localStorage.removeItem(SESSION[k]); } catch { } },
};
const LINK_MINUTES = 30;
function currentVolunteer() {
  const s = Session.get('vol'); if (!s) return null;
  const p = Person(s.volunteer_id);
  if (!p || p.archived) { Session.clear('vol'); return null; }
  return p;
}
const isAdmin = () => !!Session.get('admin');
function logout(kind = 'vol') {
  const s = Session.get(kind);
  if (kind === 'vol' && s && !s.preview) audit({ personId: s.volunteer_id, actor: 'learner', action: 'logout', detail: {} });
  if (kind === 'admin') audit({ actor: 'admin', action: 'admin_logout', detail: { email: s?.email } });
  Session.clear(kind);
  if (kind === 'vol' && s?.preview) { toast('Preview ended'); return go(`#/admin/people/${s.volunteer_id}`); }
  toast('You’ve been signed out'); go(kind === 'admin' ? '#/admin' : '#/login');
}
const fmtTime = d => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
let loginPrefill = '';
function renderLogin(prefill = loginPrefill) {
  if (currentVolunteer() && !Session.get('vol')?.preview) return go('#/me');
  const samples = db.people.filter(p => p.featured && !p.archived).slice(0, 4).concat(db.people.filter(p => p.archived).slice(-1));
  app().innerHTML = topbar(`<a class="btn ghost sm" href="#/admin">Admin sign in</a>`) + `<main class="wrap fadein"><div class="login">
    <div class="card pad-lg login-card">
      <div class="eyebrow">Volunteer sign in</div><h1 style="font-size:32px;margin:6px 0 8px">Sign in to your safeguarding training</h1>
      <p class="muted" style="margin-bottom:20px">Enter the email address you gave us. We’ll send you a secure sign-in link — no password needed.</p>
      <form id="lf" novalidate><label class="f" for="le">Email address</label>
        <input class="input" id="le" type="email" autocomplete="email" inputmode="email" value="${esc(prefill)}" placeholder="you@example.com" style="font-size:17px;padding:13px 14px">
        <div class="help" id="lerr" style="color:var(--red-600);display:none"></div>
        <button class="btn red lg" style="width:100%;margin-top:14px">Email me a sign-in link ${ICON.arrow}</button></form>
      <div class="privacy"><div class="row" style="gap:10px;align-items:flex-start;flex-wrap:nowrap">${ICON.attest.replace('<svg', '<svg width="20" height="20" style="flex:none;color:var(--teal);margin-top:2px"')}<div>
        <b>How we use your information</b>
        <p>We store your name, email address, and training completion dates under our safeguarding obligations, and retain these records for 5 years.</p>
        <p class="tiny muted" style="margin:0">Scripture Union Northern Ireland is the data controller. You can ask to see or correct your information at any time. <a href="https://www.suni.co.uk" target="_blank" rel="noopener">Read our full privacy notice</a>.</p></div></div></div>
    </div>
    ${demoOn() ? `<div class="card demo-help"><div class="dt-lbl" style="margin-bottom:8px">Demo — try one of these</div>${samples.map(p => `<button class="demo-email" data-fill="${esc(p.email)}"><span class="avatar" style="width:28px;height:28px;font-size:11px;background:${avatarColour(p.name)}">${initials(p.name)}</span><span><b>${esc(p.name)}</b>${p.archived ? ' <span class="chip st-none" style="font-size:11px">Archived</span>' : ''}<br><span class="tiny muted">${esc(p.email)}</span></span></button>`).join('')}
      <p class="tiny muted" style="margin:10px 0 0">No emails are sent — the sign-in link appears in a simulated inbox.</p></div>` : ''}
  </div></main>` + demobar('learner');
  $$('[data-fill]').forEach(b => b.onclick = () => { $('#le').value = b.dataset.fill; $('#lerr').style.display = 'none'; $('#le').focus(); });
  $('#lf').onsubmit = e => { e.preventDefault(); requestMagicLink($('#le').value); };
}
function requestMagicLink(raw) {
  const email = String(raw || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) { const er = $('#lerr'); er.textContent = 'Please enter a valid email address.'; er.style.display = 'block'; $('#le').focus(); return; }
  const p = db.people.find(x => x.email.toLowerCase() === email);
  if (!p || p.archived) {
    if (p) audit({ personId: p.id, actor: 'system', action: 'login_blocked', detail: { reason: 'Volunteer is archived' } });
    // same message either way, so the login screen never reveals who is registered
    modal(`<header><h2>Check your inbox</h2><button class="iconbtn" data-close>${ICON.x}</button></header><div class="body">
      <p>If <b>${esc(email)}</b> belongs to an active volunteer, a sign-in link is on its way. It expires in ${LINK_MINUTES} minutes.</p>
      ${demoOn() ? `<div class="notice warn small">${ICON.info}<div><b>Demo note (not shown in the live version):</b> ${p ? `${esc(p.name)} is <b>archived</b>, so no link was sent — archived volunteers can’t sign in until an admin reactivates them.` : 'no volunteer has this email, so no link was sent.'}</div></div>` : ''}</div>
      <footer><button class="btn ghost" data-close>OK</button></footer>`);
    return;
  }
  const link = { token: uid('ml_') + uid(''), volunteer_id: p.id, created_at: now(), expires_at: new Date(Date.now() + LINK_MINUTES * 60e3).toISOString(), used_at: null };
  (db.magicLinks ||= []).push(link); db.magicLinks = db.magicLinks.slice(-200);
  audit({ personId: p.id, actor: 'system', action: 'magic_link_sent', detail: { expires_at: link.expires_at } });
  simulatedInbox(p, link);
}
function simulatedInbox(p, link) {
  const url = location.href.split('#')[0] + '#/auth/' + link.token;
  const s = modal(`<header><div><div class="eyebrow">📬 Simulated inbox</div><h2 style="margin-top:4px">${esc(p.email)}</h2><div class="small muted">This is the email ${esc(firstName(p.name))} would receive. Nothing has actually been sent.</div></div><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body">
      <div class="ib-meta" style="margin:0 0 10px"><b>Your sign-in link for SUNI safeguarding training</b><div class="tiny muted">From Scripture Union NI &lt;training@suni.co.uk&gt; · just now</div></div>
      <div class="em"><div class="em-head">${LOGO(34)}</div><div class="em-bar"></div><div class="em-body">
        <h2>Sign in to your training</h2><p>Hi ${esc(firstName(p.name))},</p><p>Tap the button below to sign in. This link can only be used once and expires in ${LINK_MINUTES} minutes, at <b>${fmtTime(link.expires_at)}</b>.</p>
        <a class="em-btn" href="#/auth/${link.token}" data-close>Sign in to my training</a>
        <p class="em-small">If you didn’t ask to sign in, you can ignore this email — nobody can sign in without access to your inbox.</p></div>
        <div class="em-foot">Scripture Union Northern Ireland · Charity NIC104852</div></div>
      <div class="row between" style="margin-top:12px"><span class="small muted" id="mlcount"></span>${demoOn() ? `<button class="btn ghost xs" id="mlexp">Demo: try an expired link</button>` : ''}</div>
    </div>`, 'phonewrap mlmodal');
  const tick = () => { const left = new Date(link.expires_at) - Date.now(); const el = $('#mlcount', s); if (!el) return clearInterval(t); el.textContent = left > 0 ? `Link expires in ${Math.floor(left / 60e3)}:${String(Math.floor(left / 1e3) % 60).padStart(2, '0')}` : 'Link expired'; };
  const t = setInterval(tick, 1000); tick();
  $('#mlexp', s) && ($('#mlexp', s).onclick = () => { const l = { ...link, token: uid('ml_') + uid(''), created_at: new Date(Date.now() - 45 * 60e3).toISOString(), expires_at: new Date(Date.now() - 15 * 60e3).toISOString() }; db.magicLinks.push(l); persist(); closeModal(); go('#/auth/' + l.token); });
}
function renderAuth(token) {
  const link = (db.magicLinks || []).find(l => l.token === token); const p = link && Person(link.volunteer_id);
  const fail = (title, msg) => { app().innerHTML = topbar() + `<main class="wrap fadein"><div class="login"><div class="card pad-lg login-card" style="text-align:center">
      <div class="vbadge" style="--tone:var(--amber);background:var(--amber);margin:0 auto 14px">${ICON.info.replace('<svg', '<svg width="40" height="40"')}</div>
      <h1 style="font-size:28px;margin-bottom:8px">${title}</h1><p class="muted">${msg}</p><a class="btn red lg" href="#/login" style="margin-top:10px">Send me a new link</a></div></div></main>` + demobar('learner'); };
  if (!link || !p) return fail('This sign-in link isn’t valid', 'It may have been mistyped. Ask for a new link and use the latest email.');
  if (link.used_at) return fail('This link has already been used', 'For your security each sign-in link works once. Ask for a new one to sign in again.');
  if (new Date(link.expires_at) < new Date()) return fail('This link has expired', `Sign-in links only last ${LINK_MINUTES} minutes. Ask for a new one — it only takes a moment.`);
  if (p.archived) return fail('You can’t sign in right now', 'Your volunteer record is archived. Please contact SUNI if you’re serving again.');
  link.used_at = now();
  Session.set('vol', { volunteer_id: p.id, at: now() });
  audit({ personId: p.id, actor: 'learner', action: 'login', detail: { method: 'magic_link' } });
  toast(`Signed in — welcome, ${firstName(p.name)}`); replaceHash('#/me');
}
const ADMIN_DEMO = { email: 'admin@suni.demo', pass: 'safeguarding' };
function renderAdminLogin() {
  app().innerHTML = topbar(`<a class="btn ghost sm" href="#/login">Volunteer sign in</a>`) + `<main class="wrap fadein"><div class="login"><div class="card pad-lg login-card">
    <div class="eyebrow">Admin</div><h1 style="font-size:30px;margin:6px 0 8px">Admin sign in</h1>
    <p class="muted">For SUNI staff who manage training records.</p>
    <form id="af"><div class="field"><label class="f">Email</label><input class="input" id="ae" type="email" value="${ADMIN_DEMO.email}"></div>
      <div class="field"><label class="f">Passcode</label><input class="input" id="ap" type="password" value=""><div class="help">Demo passcode: <b>${ADMIN_DEMO.pass}</b>. The live version would use Cloudflare Access with your SUNI account.</div></div>
      <div class="help" id="aerr" style="color:var(--red-600);display:none">That email and passcode don’t match.</div>
      <button class="btn red lg" style="width:100%">Sign in</button></form></div></div></main>` + demobar('admin');
  $('#af').onsubmit = e => { e.preventDefault();
    if ($('#ae').value.trim().toLowerCase() !== ADMIN_DEMO.email || $('#ap').value !== ADMIN_DEMO.pass) { $('#aerr').style.display = 'block'; return; }
    Session.set('admin', { email: ADMIN_DEMO.email, name: db.settings.adminName, at: now() }); audit({ actor: 'admin', action: 'admin_login', detail: { email: ADMIN_DEMO.email } }); toast('Signed in as admin'); route(); };
}
function previewAs(id) {
  if (!isAdmin()) return go('#/admin');
  const p = Person(id); if (!p) return go('#/admin/people');
  if (p.archived) { toast('Archived volunteers can’t be previewed — reactivate them first'); return go('#/admin/people/' + id); }
  Session.set('vol', { volunteer_id: p.id, at: now(), preview: true });
  audit({ personId: p.id, actor: 'admin', action: 'admin_preview', detail: { name: p.name } });
  replaceHash('#/me');
}

/* ---------- hub (demo landing) ---------- */
function renderHub() {
  app().innerHTML = topbar() + `<main class="wrap fadein">
  <div class="hero" style="margin-bottom:24px">
    <div class="flamebg">${FLAME(170)}</div>
    <div class="eyebrow">Interactive demo</div>
    <h1 style="margin:8px 0 10px">Safeguarding training,<br>simple to give and easy to evidence.</h1>
    <p class="muted" style="max-width:60ch;font-size:17px">Volunteers get a personal link, watch the videos, pass a short quiz and sign an attestation. Admins see who is ready for each camp or mission, and export records in one click.</p>
  </div>
  <div class="grid g2">
    <div class="card pad-lg">
      <div class="eyebrow">Volunteer view</div><h2 style="margin:6px 0 8px">Sign in with a magic link</h2>
      <p class="muted">Volunteers sign in with just their email — no passwords. Pick a sample volunteer to sign in as them (the link appears in a simulated inbox). There are ${db.people.filter(p => !p.archived).length} active volunteers in the demo.</p>
      <a class="btn red" href="#/login" style="margin:12px 0 4px">Volunteer sign in ${ICON.arrow}</a>
      <div class="stack" style="margin-top:14px">${(db.people.filter(p => p.featured).length ? db.people.filter(p => p.featured) : db.people.slice(0, 6)).map(p => {
        const req = requiredPathwaysFor(p); const done = req.filter(x => ['complete', 'due'].includes(statusOf(p, x).key)).length;
        return `<a class="row between" href="#/login" data-prefill="${esc(p.email)}" style=""padding:10px 12px;border-radius:14px;background:#FBFAF8;color:inherit;text-decoration:none">
          <span class="person"><span class="avatar" style="background:${avatarColour(p.name)}">${initials(p.name)}</span><span><b>${esc(p.name)}</b><br><span class="tiny muted">${esc(p.roles.join(', '))}</span></span></span>
          <span class="tiny muted">${done}/${req.length} complete ${ICON.arrow}</span></a>`;
      }).join('')}</div>
    </div>
    <div class="card pad-lg">
      <div class="eyebrow">Admin</div><h2 style="margin:6px 0 8px">Manage training & records</h2>
      <p class="muted">Build pathways from video, reading and quiz steps. Assign them by role or by event. Track who is ready, and export a compliance register.</p>
      <a class="btn red lg" href="#/admin" style="margin-top:10px">Admin sign in ${ICON.arrow}</a>
      <div class="notice info" style="margin-top:22px">${ICON.info}<div class="small">This demo keeps its data in this browser, in tables shaped exactly like the live database (Cloudflare D1). Emails appear in simulated inboxes instead of being sent.</div></div>
    </div>
  </div></main>` + demobar('hub');
  $$('[data-prefill]').forEach(a => a.onclick = () => { loginPrefill = a.dataset.prefill; });
}

/* =====================================================================
   LEARNER
   ===================================================================== */
function learnerRoute(parts) {
  const person = currentVolunteer();
  if (!person) { toast('Please sign in to continue'); return replaceHash('#/login'); }
  if (parts[0] === 'p' && parts[1]) return renderPlayer(person, P(parts[1]), parts[2]);
  if (parts[0] === 'cert' && parts[1]) { const c = db.completions.find(x => x.id === parts[1]); if (!c || c.personId !== person.id) return replaceHash('#/me'); return renderCert(parts[1], person); }
  renderLearnerHome(person);
}
const REFRESH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-15.4 6.4L3 16"/><path d="M3 21v-5h5"/><path d="M3 12A9 9 0 0 1 18.4 5.6L21 8"/><path d="M21 3v5h-5"/></svg>';
/* what a learner needs to know about renewing: expiring soon, expired, or reset by an admin */
function refreshInfo(person, pw, st) {
  if (st.key === 'due') return { kind: 'due', title: `Refresher due by ${fmtDate(st.c.expiresAt)}`, text: `Your certificate is still valid, but it runs out in ${Math.max(1, Math.ceil((new Date(st.c.expiresAt) - Date.now()) / DAY))} days. Refresh it now so you can keep serving.` };
  if (st.key === 'expired' || (st.key === 'progress' && st.c && new Date(st.c.expiresAt) < new Date())) return { kind: 'expired', title: `Expired ${fmtDate(st.c.expiresAt)}`, text: 'You’ll need to renew this before you next serve.' };
  if (['none', 'progress'].includes(st.key)) { const r = [...db.audit].reverse().find(a => a.personId === person.id && a.pathwayId === pw.id && a.action === 'training_reset');
    if (r) return { kind: 'reset', title: `Please redo this training`, text: `It was reset by ${esc(db.settings.short || 'SUNI')} on ${fmtDate(r.at)}${r.detail?.reason ? ` — “${esc(r.detail.reason)}”` : ''}.` }; }
  return null;
}
function refreshRing(kind, pct) {
  const col = kind === 'due' ? '#C98208' : 'var(--red)', bg = kind === 'due' ? 'var(--amber-50)' : 'var(--red-50)';
  const label = kind === 'due' ? 'Refresher due' : kind === 'expired' ? 'Expired' : 'Needs redoing';
  if (pct) { const r = 28, c = 2 * Math.PI * r; return `<div class="ring rring" role="img" aria-label="${label}, ${pct}% done"><svg width="68" height="68" aria-hidden="true"><circle cx="34" cy="34" r="${r}" stroke="${bg}" stroke-width="7" fill="none"/><circle cx="34" cy="34" r="${r}" stroke="${col}" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"/></svg><b style="color:${col}">${pct}%</b></div>`; }
  return `<div class="rbadge ${kind}" role="img" aria-label="${label}">${kind === 'expired' ? '<b>!</b>' : REFRESH_SVG}</div>`;
}
function ring(pct, colour = 'var(--red)') {
  const r = 28, c = 2 * Math.PI * r;
  return `<div class="ring"><svg width="68" height="68"><circle cx="34" cy="34" r="${r}" stroke="#EFEAE4" stroke-width="7" fill="none"/><circle cx="34" cy="34" r="${r}" stroke="${colour}" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}" style="transition:stroke-dashoffset .8s var(--ease)"/></svg><b>${pct === 100 ? `<span style="color:${colour};width:22px;display:block">${ICON.check}</span>` : pct + '%'}</b></div>`;
}
function renderLearnerHome(person) {
  const req = requiredPathwaysFor(person);
  const evs = person.eventIds.map(EventById).filter(Boolean);
  const done = req.filter(p => statusOf(person, p).key === 'complete').length;
  const refreshN = req.filter(p => refreshInfo(person, p, statusOf(person, p))).length;
  const allDone = req.length && done === req.length;
  app().innerHTML = topbar(`<span class="person small"><span class="avatar" style="background:${avatarColour(person.name)}">${initials(person.name)}</span><b class="hide-sm">${esc(person.name)}</b></span><button class="btn ghost sm" data-act="logout">Log out</button>`, '#/me') + previewBanner() +
    `<main class="wrap fadein">
    <div class="hero" style="margin-bottom:26px">
      <div class="flamebg">${FLAME(170)}</div>
      <div class="eyebrow">${allDone ? 'All done' : 'Your safeguarding training'}</div>
      <h1 style="margin:8px 0 10px">${allDone ? `Thank you, ${esc(firstName(person.name))} — you’re all set.` : `Hi ${esc(firstName(person.name))}, thanks for serving with us.`}</h1>
      <p class="muted" style="max-width:62ch;font-size:17px">${allDone ? 'Your training is up to date. You can download your certificates below at any time.' : `Before you serve${evs.length ? ` at <b>${evs.map(e => esc(e.name)).join('</b> and <b>')}</b>` : ''}, please complete the training below. It takes about ${Math.max(10, req.length * 15)} minutes, and you can stop and pick up where you left off.`}</p>
      <div class="row" style="margin-top:14px">${evs.map(e => `<span class="tag">${ICON.cal.replace('<svg', '<svg width="13" height="13" style="vertical-align:-2px"')} ${esc(e.name)} · ${fmtDate(e.date)}</span>`).join('')}</div>
    </div>
    ${(() => { const rn = evs.filter(e => eventState(person, e) === 'renew'); if (!rn.length) return '';
      const exp = Math.min(...rn.flatMap(e => e.requiredPathways.map(pid => +new Date(latestCompletion(person.id, pid).expiresAt))));
      return `<div class="notice warn" style="margin-bottom:18px">${ICON.info}<div><b>Heads up:</b> a certificate of yours runs out on ${fmtDate(exp)}, before <b>${rn.map(e => esc(e.name)).join('</b> and <b>')}</b>. You’ll be able to refresh it from ${fmtDate(exp - (db.settings.dueSoonDays || 30) * DAY)}.</div></div>`; })()}
    <div class="row between" style="margin-bottom:12px"><h2>Your training</h2><span class="muted small">${done} of ${req.length} up to date${refreshN ? ` · <b style="color:#8A5508">${refreshN} to refresh</b>` : ''}</span></div>
    <div class="grid" style="gap:14px">
    ${req.length ? req.map(p => {
      const st = statusOf(person, p); const pr = prog(person.id, p.id);
      const pct = ['complete', 'due'].includes(st.key) ? 100 : pctDone(pr, p);
      const why = [...p.requiredForRoles.filter(r => person.roles.includes(r)).map(r => `${r} role`), ...evs.filter(e => e.requiredPathways.includes(p.id)).map(e => e.name)];
      const rf = refreshInfo(person, p, st);
      const cta = st.key === 'complete' || st.key === 'due' ? (st.key === 'due' ? `<a class="btn red sm" href="#/me/p/${p.id}">${REFRESH_SVG.replace('<svg', '<svg width="16" height="16"')} Refresh now</a> ` : '') + `<a class="btn ghost sm" href="#/me/cert/${st.c.id}">${st.key === 'due' ? 'Current certificate' : 'View certificate'}</a>`
        : st.key === 'locked' ? `<span class="small muted">We’ll be in touch to help</span>`
          : `<a class="btn red sm" href="#/me/p/${p.id}">${pct ? 'Continue' : rf ? (rf.kind === 'reset' ? 'Start again' : 'Renew now') : 'Start'} ${ICON.arrow}</a>`;
      return `<div class="card pcard ${rf ? 'needs-' + rf.kind : ''}" data-href="${st.key === 'complete' ? '' : `#/me/p/${p.id}`}">
        ${rf ? `<div class="rfband">${rf.kind === 'expired' ? ICON.info : REFRESH_SVG}<div><b>${rf.title}</b><span>${rf.text}</span></div></div>` : ''}
        ${rf ? refreshRing(rf.kind, st.key === 'progress' ? pctDone(pr, p) : 0) : ring(pct, st.key === 'complete' ? 'var(--teal)' : p.colour)}
        <div style="flex:1;min-width:0">
          <div class="row" style="gap:8px;margin-bottom:4px"><h3>${esc(p.title)}</h3>${chip(st)}</div>
          <p class="muted small" style="margin:0 0 6px">${esc(p.summary)}</p>
          <div class="tiny muted">${p.steps.map(s => ICON[s.type].replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px"')).join(' ')} &nbsp;${plural(p.steps.length, 'step')} + sign-off · Required for ${esc(why.join(', ') || 'your role')}${st.c ? ` · Valid until ${fmtDate(st.c.expiresAt)}` : ''}</div>
        </div>
        <div class="noprint pcta">${cta}</div></div>`;
    }).join('') : `<div class="card empty">No training has been assigned to you yet.</div>`}
    </div>
    ${person.eventIds.length === 0 && !req.length ? '' : `<p class="small muted" style="margin-top:22px">Your answers and completion are recorded so ${esc(db.settings.short)} can show that everyone serving has been trained. See the <a href="https://www.suni.co.uk" target="_blank" rel="noopener">Privacy Notice</a>.</p>`}
  </main>` + worriedFab() + demobar('learner');
  $$('.pcard[data-href]').forEach(el => el.addEventListener('click', e => { if (!e.target.closest('a,button') && el.dataset.href) go(el.dataset.href); }));
}

/* ---------- player ---------- */
function renderPlayer(person, pathway, stepParam) {
  if (!pathway) return go('#/me');
  const pr = prog(person.id, pathway.id);
  if (!pr.startedAt) { pr.startedAt = now(); audit({ personId: person.id, actor: 'learner', action: 'pathway_started', pathwayId: pathway.id, version: pathway.version, detail: {} }); }
  const steps = [...pathway.steps, { id: 'attest', type: 'attest', title: 'Sign-off' }];
  const firstOpen = steps.findIndex(s => s.type === 'attest' || !stepDone(pr, s));
  let idx = stepParam != null ? Math.min(+stepParam, firstOpen) : firstOpen;
  if (isNaN(idx) || idx < 0) idx = firstOpen;
  const step = steps[idx];
  const kindLabel = { video: 'Video', read: 'Read & acknowledge', quiz: 'Quiz', attest: 'Attestation' };
  app().innerHTML = topbar(`<a class="btn ghost sm" href="#/me">${ICON.back} My training</a><button class="btn ghost sm" data-act="logout">Log out</button>`, '#/me') + previewBanner() +
    `<main class="wrap fadein"><div class="player">
    <aside id="paside">
      <div class="eyebrow">Pathway · v${pathway.version}</div>
      <h2 class="ptitle">${esc(pathway.title)}</h2>
      <button class="stepmini" data-act="steps" aria-expanded="false" aria-controls="steplist">
        <span class="sm-dots">${steps.map((s, i) => `<i class="${s.type !== 'attest' && stepDone(pr, s) ? 'd' : ''} ${i === idx ? 'c' : ''}"></i>`).join('')}</span>
        <span class="sm-txt"><span class="k">Step ${idx + 1} of ${steps.length} · ${kindLabel[step.type]}</span><b>${esc(step.title)}</b></span>
        <span class="sm-chev">All steps <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg></span></button>
      <ol class="steps" id="steplist">${steps.map((s, i) => {
        const done = s.type !== 'attest' && stepDone(pr, s); const lock = i > firstOpen;
        return `<li class="${done ? 'done' : ''} ${i === idx ? 'cur' : ''} ${lock ? 'lock' : ''}" ${lock ? 'aria-disabled="true"' : `data-step="${i}"`} tabindex="${lock ? -1 : 0}">
          <span class="num">${done ? ICON.check.replace('<svg', '<svg width="16" height="16"') : lock ? ICON.lock.replace('<svg', '<svg width="14" height="14"') : i + 1}</span>
          <span><span class="k">${kindLabel[s.type]}</span><br><span class="t">${esc(s.title)}</span></span></li>`;
      }).join('')}</ol>
    </aside>
    <section id="stage" class="card pad-lg"></section>
  </div></main>` + worriedFab();
  $$('.steps li[data-step]').forEach(li => { const f = () => go(`#/me/p/${pathway.id}/${li.dataset.step}`); li.addEventListener('click', f); li.addEventListener('keydown', e => e.key === 'Enter' && f()); });
  const next = () => go(`#/me/p/${pathway.id}/${idx + 1}`);
  const stage = $('#stage');
  ({ video: stageVideo, read: stageRead, quiz: stageQuiz, attest: stageAttest })[step.type](stage, { person, pathway, pr, step, next, idx });
}

const stepHead = (kind, title, sub = '') => `<div class="eyebrow">${kind}</div><h2 style="margin:4px 0 6px">${esc(title)}</h2>${sub ? `<p class="muted">${sub}</p>` : ''}`;

/* ---------- demo controls ---------- */
const demoOn = () => db.settings.demoControls !== false;
function demoPanel(buttons) {
  if (!demoOn()) return '';
  return `<div class="demo-tools noprint"><span class="dt-lbl">Demo controls</span>${buttons.map(([id, label]) => `<button class="dt-btn" id="${id}">${label}</button>`).join('')}</div>`;
}

/* ---------- WebVTT ---------- */
function parseVTT(src) {
  const toS = t => { const p = t.trim().split(':').map(parseFloat); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; };
  return String(src || '').replace(/\r/g, '').split(/\n\n+/).map(b => {
    const l = b.split('\n'); const i = l.findIndex(x => x.includes('-->')); if (i < 0) return null;
    const [a, z] = l[i].split('-->'); return { start: toS(a), end: toS(z.split(' ').filter(Boolean)[0]), text: l.slice(i + 1).join('\n') };
  }).filter(Boolean);
}

/* ---------- custom player for uploaded files ---------- */
const VP = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.6 5.2v13.6c0 .9 1 1.4 1.7.9l9.4-6.8c.6-.4.6-1.3 0-1.8l-9.4-6.8c-.7-.5-1.7 0-1.7.9z"/></svg>',
  replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"/><path d="M4 4v4.6h4.6"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><text x="12" y="15.5" font-size="7.5" font-weight="800" text-anchor="middle" fill="currentColor" stroke="none" font-family="system-ui">10</text></svg>',
  vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>',
  fs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  fsx: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
};
const tfmt = s => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function customPlayer(frame, { url, poster, vtt, title, start = 0, getLimit, onTime, onBlocked }) {
  const cues = parseVTT(vtt);
  frame.classList.add('vp');
  frame.tabIndex = 0;
  frame.innerHTML = `<video playsinline preload="metadata" ${poster ? `poster="${poster}"` : ''} src="${url}"></video>
    ${poster ? `<div class="vp-endbg" style="background-image:url('${poster}')"></div>` : ''}<div class="vp-shade"></div>
    <div class="vp-mark">${FLAME(18)}<span>${esc(title || '')}</span></div>
    <div class="vp-cc" aria-live="off"></div>
    <button class="vp-big" aria-label="Play"><span class="vp-ring"></span><span class="vp-ico">${VP.play}</span><span class="vp-lbl">Play</span></button>
    <div class="vp-bar">
      <div class="vp-track" role="slider" aria-label="Video position" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="0:00"><div class="vp-rail"><i class="vp-watched"></i><i class="vp-played"></i></div><span class="vp-thumb"></span><span class="vp-tip"></span></div>
      <div class="vp-tools">
        ${cues.length ? `<button class="vp-btn vp-ccb" aria-label="CC captions" aria-pressed="false" title="Captions (C)"><b aria-hidden="true">CC</b></button>` : ''}
        <span class="vp-volwrap"><input class="vp-volr" type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume"><button class="vp-btn vp-vol" aria-label="Mute" title="Mute (M)">${VP.vol}</button></span>
        <button class="vp-btn vp-fs" aria-label="Full screen" title="Full screen (F)">${VP.fs}</button>
      </div>
    </div>`;
  const v = $('video', frame), q = s => $(s, frame);
  let ccOn = false, idleT;
  const sync = () => {
    const d = v.duration || 0, lim = getLimit();
    q('.vp-watched').style.width = (d ? Math.min(1, lim / d) * 100 : 0) + '%';
    q('.vp-played').style.width = (d ? v.currentTime / d * 100 : 0) + '%';
    q('.vp-thumb').style.left = (d ? v.currentTime / d * 100 : 0) + '%';
    if (ccOn) { const c = cues.find(c => v.currentTime >= c.start && v.currentTime < c.end); q('.vp-cc').innerHTML = c ? `<span>${esc(c.text).replace(/\n/g, '<br>')}</span>` : ''; }
  };
  const setBig = (icon, label) => { q('.vp-ico').innerHTML = VP[icon]; q('.vp-lbl').textContent = label; q('.vp-big').setAttribute('aria-label', label); q('.vp-big').dataset.icon = icon; };
  const setPlaying = p => { frame.classList.toggle('playing', p); frame.classList.remove('ended'); if (p) frame.classList.add('started'); setBig(p ? 'pause' : 'play', p ? 'Pause' : v.currentTime > 0.5 ? `Resume · ${tfmt(v.currentTime)}` : `Play · ${tfmt(v.duration)}`); };
  const toggle = () => { v.paused ? v.play().catch(() => { }) : v.pause(); };
  const seekTo = t => {
    const lim = getLimit();
    if (t > lim + 1) { t = lim; onBlocked(); }
    v.currentTime = Math.max(0, Math.min(t, v.duration || t));
  };
  const wake = () => { frame.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => { if (!v.paused) frame.classList.add('idle'); }, 2600); };
  v.addEventListener('loadedmetadata', () => { if (start && start < v.duration - 2) v.currentTime = start; sync(); setPlaying(false); });
  v.addEventListener('timeupdate', () => { onTime(v.currentTime, v.duration); sync(); });
  v.addEventListener('play', () => { setPlaying(true); wake(); });
  v.addEventListener('pause', () => { setPlaying(false); frame.classList.remove('idle'); });
  v.addEventListener('ended', () => { setPlaying(false); frame.classList.remove('idle'); frame.classList.add('ended'); setBig('replay', 'Watch again'); });
  v.addEventListener('seeking', () => { const lim = getLimit(); if (v.currentTime > lim + 1.5) { v.currentTime = lim; onBlocked(); } });
  v.addEventListener('ratechange', () => { if (v.playbackRate > 1) v.playbackRate = 1; });
  v.addEventListener('click', toggle);
  v.addEventListener('dblclick', () => q('.vp-fs').click());
  q('.vp-big').onclick = toggle;
  const vol = q('.vp-volr');
  q('.vp-vol').onclick = () => { v.muted = !v.muted; };
  vol.oninput = () => { v.volume = +vol.value; v.muted = v.volume === 0; };
  v.addEventListener('volumechange', () => { q('.vp-vol').innerHTML = v.muted || v.volume === 0 ? VP.mute : VP.vol; vol.value = v.muted ? 0 : v.volume; });
  const ccb = q('.vp-ccb');
  if (ccb) ccb.onclick = () => { ccOn = !ccOn; ccb.classList.toggle('on', ccOn); ccb.setAttribute('aria-pressed', ccOn); if (!ccOn) q('.vp-cc').innerHTML = ''; sync(); toast(ccOn ? 'Captions on' : 'Captions off'); };
  const fsBtn = q('.vp-fs');
  fsBtn.onclick = () => { document.fullscreenElement ? document.exitFullscreen() : frame.requestFullscreen?.().catch(() => { }); };
  const fsChange = () => { fsBtn.innerHTML = document.fullscreenElement === frame ? VP.fsx : VP.fs; };
  document.addEventListener('fullscreenchange', fsChange);
  // scrubber: drag anywhere you've already watched
  const track = q('.vp-track');
  v.addEventListener('timeupdate', () => { const d = v.duration || 0; track.setAttribute('aria-valuemax', Math.round(d)); track.setAttribute('aria-valuenow', Math.round(v.currentTime)); track.setAttribute('aria-valuetext', `${tfmt(v.currentTime)} of ${tfmt(d)}`); });
  const tAt = e => { const r = track.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (v.duration || 0); };
  let drag = false;
  track.addEventListener('pointerdown', e => { drag = true; track.setPointerCapture(e.pointerId); seekTo(tAt(e)); frame.classList.add('scrub'); });
  track.addEventListener('pointermove', e => {
    const t = tAt(e), lim = getLimit(); const tip = q('.vp-tip');
    tip.textContent = t > lim + 1 ? 'Not watched yet' : `${tfmt(t)} / ${tfmt(v.duration)}`; tip.style.left = (v.duration ? t / v.duration * 100 : 0) + '%';
    if (drag) seekTo(Math.min(t, lim));
  });
  track.addEventListener('pointerup', () => { drag = false; frame.classList.remove('scrub'); });
  frame.addEventListener('pointermove', wake);
  frame.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'k') { e.preventDefault(); toggle(); }
    else if (k === 'arrowleft') { e.preventDefault(); seekTo(v.currentTime - 5); }
    else if (k === 'arrowright') { e.preventDefault(); seekTo(v.currentTime + 5); }
    else if (k === 'c' && ccb) ccb.click(); else if (k === 'm') q('.vp-vol').click(); else if (k === 'f') fsBtn.click();
    wake();
  });
  return { video: v, seek: t => { v.currentTime = t; }, destroy: () => { document.removeEventListener('fullscreenchange', fsChange); clearTimeout(idleT); v.pause(); } };
}

/* video step: file / YouTube / Vimeo with skip-ahead protection */
async function stageVideo(stage, { person, pathway, pr, step, next }) {
  const st = pr.steps[step.id] && pr.steps[step.id].rev === step.rev ? pr.steps[step.id] : (pr.steps[step.id] = { rev: step.rev, watched: 0, pos: 0 });
  const already = stepDone(pr, step);
  stage.innerHTML = stepHead('Video', step.title, esc(step.description || '')) + `
    <div class="videoframe" id="vf"></div>
    <div class="watchbar"><span class="small muted" id="wlabel">Watched 0%</span><span style="flex:1"></span>
    <button class="btn red" id="vnext" ${already ? '' : 'disabled'}>Continue ${ICON.arrow}</button></div>
    <div class="notice info small" style="margin-top:14px" id="vnote">${ICON.info}<div>${already ? 'You’ve already watched this video — feel free to watch it again.' : 'Watch the whole video to continue. You can pause and rewind using the bar on the video, and come back later — we’ll remember where you got to.'}</div></div>
    ${already ? '' : demoPanel([['demoSkip', '⏭ Jump to last 5 seconds']])}`;
  let duration = 0, maxW = st.watched || 0, finished = already, lastSave = 0, demoSkipped = false, seekFn = null;
  const update = (t) => {
    if (t > maxW && t - maxW < 3) maxW = t;
    const pct = duration ? Math.min(100, Math.round(maxW / duration * 100)) : 0;
    $('#wlabel') && ($('#wlabel').textContent = finished ? 'Video complete' : `Watched ${pct}%`);
    st.watched = maxW; st.pos = t;
    if (Date.now() - lastSave > 3000) { lastSave = Date.now(); persist(); }
    if (!finished && duration && maxW / duration * 100 >= (step.minWatchPct || 95)) {
      finished = true; st.done = true; st.at = now(); persist();
      audit({ personId: person.id, actor: 'learner', action: 'video_completed', pathwayId: pathway.id, version: pathway.version, stepId: step.id, detail: { source: step.video.source, watchedSeconds: Math.round(maxW), duration: Math.round(duration), ...(demoSkipped ? { demoSkip: true } : {}) } });
      $('#vnext').disabled = false; $('#wlabel').textContent = 'Video complete';
      $('#vnote').className = 'notice good small'; $('#vnote').innerHTML = ICON.check.replace('<svg', '<svg width="20" height="20"') + '<div><b>Nice — video complete.</b> Carry on when you’re ready.</div>';
      $('.demo-tools')?.remove(); toast('Video complete ✓');
    }
  };
  const blocked = () => toast('No skipping ahead on first watch — rewinding is fine');
  $('#vnext').onclick = () => { persist(); next(); };
  onLeave(() => persist());
  $('#demoSkip') && ($('#demoSkip').onclick = () => {
    if (!duration) { toast('Video still loading…'); return; }
    demoSkipped = true; maxW = Math.max(maxW, duration - 5); seekFn && seekFn(duration - 5); toast('Demo: jumped to the last 5 seconds');
  });
  const vf = $('#vf'); const v = step.video || {};
  if (v.source === 'file') {
    const url = await Media.url(v.mediaId);
    if (!url) { vf.innerHTML = `<div style="display:grid;place-items:center;color:#fff;padding:30px;text-align:center">Video not available in this browser. Ask an admin to re-upload it.</div>`; return; }
    const pl = customPlayer(vf, { url, poster: v.mediaId === 'seed-video-1' ? window.SEED_POSTER : '', vtt: v.vtt, title: step.title, start: st.pos || 0,
      getLimit: () => finished ? Infinity : maxW, onBlocked: blocked, onTime: (t, d) => { duration = d || duration; update(t); } });
    pl.video.addEventListener('loadedmetadata', () => { duration = pl.video.duration; update(st.pos || 0); });
    seekFn = t => { pl.seek(t); pl.video.play().catch(() => { }); };
    onLeave(pl.destroy);
  } else if (v.source === 'youtube') {
    const id = ytId(v.url); if (!id) { vf.innerHTML = '<div style="color:#fff;padding:30px">Invalid YouTube link</div>'; return; }
    vf.innerHTML = '<div id="yt"></div>';
    await loadScript('https://www.youtube.com/iframe_api', () => window.YT && window.YT.Player, 'onYouTubeIframeAPIReady');
    const pl = new YT.Player('yt', { videoId: id, playerVars: { rel: 0, modestbranding: 1, cc_load_policy: 0, start: Math.floor(st.pos || 0) }, events: { onReady: () => { duration = pl.getDuration(); } } });
    seekFn = t => { pl.seekTo(t, true); pl.playVideo(); };
    const t = setInterval(() => {
      if (!pl.getCurrentTime) return; duration = pl.getDuration() || duration; const c = pl.getCurrentTime();
      if (!finished && c > maxW + 2.5) { pl.seekTo(maxW, true); blocked(); return; }
      if (pl.getPlaybackRate && pl.getPlaybackRate() > 1) pl.setPlaybackRate(1);
      update(c);
    }, 500);
    onLeave(() => clearInterval(t));
  } else if (v.source === 'vimeo') {
    const id = (String(v.url).match(/vimeo\.com\/(?:video\/)?(\d+)/) || [])[1]; if (!id) { vf.innerHTML = '<div style="color:#fff;padding:30px">Invalid Vimeo link</div>'; return; }
    vf.innerHTML = `<iframe id="vm" src="https://player.vimeo.com/video/${id}?dnt=1" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    await loadScript('https://player.vimeo.com/api/player.js', () => window.Vimeo);
    const pl = new Vimeo.Player($('#vm'));
    seekFn = t => { pl.setCurrentTime(t); pl.play(); };
    pl.getDuration().then(d => { duration = d; if (st.pos) pl.setCurrentTime(st.pos); });
    pl.on('timeupdate', d => { duration = d.duration; update(d.seconds); });
    pl.on('seeked', d => { if (!finished && d.seconds > maxW + 2) { pl.setCurrentTime(maxW); blocked(); } });
    pl.on('playbackratechange', d => { if (d.playbackRate > 1) pl.setPlaybackRate(1); });
  }
}
const ytId = u => (String(u).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || [])[1];
const _scripts = {};
function loadScript(src, ready, cbName) {
  if (ready()) return Promise.resolve();
  return _scripts[src] ??= new Promise((res, rej) => {
    if (cbName) { const prev = window[cbName]; window[cbName] = () => { prev && prev(); res(); }; }
    const s = document.createElement('script'); s.src = src; s.onload = () => { if (!cbName) res(); }; s.onerror = () => { toast('Couldn’t load the video player — check your connection'); rej(); };
    document.head.appendChild(s);
  });
}

/* read & acknowledge */
function md(src) {
  const lines = String(src || '').split('\n'); let out = '', inList = false;
  const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  for (const l of lines) {
    if (/^\s*[-*] /.test(l)) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${inline(l.replace(/^\s*[-*] /, ''))}</li>`; continue; }
    if (inList) { out += '</ul>'; inList = false; }
    if (/^## /.test(l)) out += `<h3>${inline(l.slice(3))}</h3>`;
    else if (l.trim()) out += `<p>${inline(l)}</p>`;
  }
  return out + (inList ? '</ul>' : '');
}
function stageRead(stage, { person, pathway, pr, step, next }) {
  const done = stepDone(pr, step);
  stage.innerHTML = stepHead('Read & acknowledge', step.title) + `<div class="reading" id="rd">${md(step.body)}</div>
    ${step.link?.url ? `<p><a href="${esc(step.link.url)}" target="_blank" rel="noopener" class="btn ghost sm">${ICON.link} ${esc(step.link.label || 'Open document')}</a></p>` : ''}
    <div class="card" style="background:#FBFAF8;box-shadow:none;margin-top:22px">
      <label class="row" style="gap:12px;cursor:pointer;align-items:flex-start"><input type="checkbox" id="ack" ${done ? 'checked disabled' : ''} style="width:22px;height:22px;accent-color:var(--red-600);margin-top:2px"><span style="font-weight:600">${esc(step.ackText || 'I have read and understood this.')}</span></label>
    </div>
    <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn red" id="rnext" ${done ? '' : 'disabled'}>Continue ${ICON.arrow}</button></div>`;
  $('#ack').onchange = e => { $('#rnext').disabled = !e.target.checked; };
  $('#rnext').onclick = () => {
    if (!done) {
      pr.steps[step.id] = { done: true, rev: step.rev, at: now() };
      audit({ personId: person.id, actor: 'learner', action: 'read_acknowledged', pathwayId: pathway.id, version: pathway.version, stepId: step.id, detail: { text: step.ackText } });
    }
    next();
  };
}

/* quiz */
function stageQuiz(stage, ctx) {
  const { person, pathway, pr, step, next } = ctx;
  const st = pr.steps[step.id] && pr.steps[step.id].rev === step.rev ? pr.steps[step.id] : (pr.steps[step.id] = { rev: step.rev, attempts: [] });
  const fails = st.attempts.filter(a => !a.passed && !a.voided).length;
  const left = step.lock === false ? Infinity : step.maxAttempts - fails;
  if (stepDone(pr, step)) {
    const last = st.attempts.filter(a => a.passed).pop();
    stage.innerHTML = stepHead('Quiz', step.title) + `<div class="notice good">${ICON.check}<div><b>Passed with ${last?.score ?? '—'}%.</b> Nicely done.</div></div><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn red" id="qn">Continue ${ICON.arrow}</button></div>`;
    $('#qn').onclick = next; return;
  }
  if (left <= 0) {
    stage.innerHTML = stepHead('Quiz', step.title) + lockedExplainer(ctx) + demoPanel([['demoReopen', '↺ Reopen quiz (as an admin would)']]);
    $('#demoReopen') && ($('#demoReopen').onclick = () => demoReopen(ctx, st));
    return;
  }
  const n = Math.min(step.drawCount, step.questions.length);
  stage.innerHTML = stepHead('Quiz', step.title) + `
    <div class="grid g3" style="margin:16px 0 22px">
      <div class="card" style="box-shadow:none;background:#FBFAF8;padding:16px"><div class="kpi"><div class="n" style="font-size:26px">${n}</div><div class="l">questions, drawn at random</div></div></div>
      <div class="card" style="box-shadow:none;background:#FBFAF8;padding:16px"><div class="kpi"><div class="n" style="font-size:26px">${step.passMark}%</div><div class="l">to pass</div></div></div>
      <div class="card" style="box-shadow:none;background:#FBFAF8;padding:16px"><div class="kpi"><div class="n" style="font-size:26px">${left === Infinity ? '∞' : left}</div><div class="l">${left === Infinity ? 'unlimited attempts' : left === 1 ? 'attempt remaining' : 'attempts remaining'}</div></div></div>
    </div>
    <p class="muted">Take your time — there’s no timer. Each attempt draws a fresh set of questions, and you’ll see how you did at the end. ${step.lock === false ? 'You can retake it as many times as you need.' : `If it doesn’t go well after ${step.maxAttempts} attempts, don’t worry — we’ll pause the quiz and arrange a short chat to go over it with you.`}</p>
    <div class="row" style="justify-content:flex-end"><button class="btn red lg" id="qstart">${fails ? 'Try again' : 'Start quiz'} ${ICON.arrow}</button></div>` + quizDemoPanel(step);
  $('#qstart').onclick = () => runQuiz(stage, ctx, st);
  bindQuizDemo(stage, ctx, st);
}
function lockedExplainer({ person, step }) {
  const S = db.settings; const days = S.followUpDays || 5;
  const evs = person.eventIds.map(EventById).filter(e => e && e.requiredPathways.some(id => P(id)?.steps.includes(step)));
  return `<div class="card lockcard" style="background:#FBF9FC;box-shadow:none;border:1.5px solid var(--plum-50)">
    <div class="row" style="gap:12px"><span class="ico" style="width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:var(--plum-50);color:var(--plum)">${ICON.heart.replace('width="15" height="15"', 'width="20" height="20"')}</span>
    <div><h3>Let’s go through this together</h3><div class="small muted">You’ve used all ${step.maxAttempts} attempts — that’s okay, and it happens.</div></div></div>
    <p style="margin-top:14px">This isn’t a black mark against you. Safeguarding matters too much to leave anyone unsure, so instead of more attempts, we’d like to talk it through with you.</p>
    <ol>
      <li><span class="n">1</span><div><b>The quiz is paused for now.</b><br><span class="small muted">Your answers so far are saved. You don’t need to do anything else right now.</span></div></li>
      <li><span class="n">2</span><div><b>The safeguarding team${S.dsoName ? ` (${esc(S.dsoName)})` : ''} has been told automatically.</b><br><span class="small muted">They’ll see which questions caused difficulty, so the conversation is focused and short.</span></div></li>
      <li><span class="n">3</span><div><b>Someone will contact you within ${days} working days</b> to arrange a short, friendly chat — by phone, video or in person.<br><span class="small muted">We’ll use ${esc(person.email)}. Expect about 15–20 minutes going back over the key points.</span></div></li>
      <li><span class="n">4</span><div><b>Then we’ll reopen the quiz</b> with a fresh set of ${step.maxAttempts} attempts, and you can finish the training as normal.</div></li>
    </ol>
    ${evs.length ? `<div class="notice warn small" style="margin-top:18px">${ICON.info}<div>You’ll need to complete this training before you can serve at <b>${evs.map(e => esc(e.name)).join('</b> or <b>')}</b>. If that’s coming up soon, it’s worth getting in touch now.</div></div>` : ''}
    <div class="row small" style="margin-top:16px;gap:16px">
      <span class="muted">Don’t want to wait?</span>
      ${S.dsoEmail ? `<a href="mailto:${esc(S.dsoEmail)}?subject=${encodeURIComponent('Safeguarding training – quiz')}">Email ${esc(S.dsoName)}</a>` : '<span class="muted">Contact details: <i>add in Admin → Settings</i></span>'}
      ${S.dsoPhone ? `<a href="tel:${esc(S.dsoPhone)}">Call ${esc(S.dsoPhone)}</a>` : ''}
      <a href="#/me/p/${ctx_pid(step)}/0">Rewatch the video in the meantime</a>
    </div>
  </div>`;
}
const ctx_pid = step => db.pathways.find(p => p.steps.includes(step))?.id;
const quizDemoPanel = (step) => demoPanel([['demoPass', '✓ Auto-answer: pass'], ['demoFail', '✗ Auto-answer: fail'], ...(step?.lock === false ? [] : [['demoFail3', '⚠ Fail every attempt (locks quiz)']])]);
function bindQuizDemo(stage, ctx, st) {
  $('#demoPass', stage) && ($('#demoPass', stage).onclick = () => runQuiz(stage, ctx, st, 'pass'));
  $('#demoFail', stage) && ($('#demoFail', stage).onclick = () => runQuiz(stage, ctx, st, 'fail'));
  $('#demoFail3', stage) && ($('#demoFail3', stage).onclick = () => {
    const left = () => ctx.step.lock === false ? 0 : ctx.step.maxAttempts - st.attempts.filter(a => !a.passed && !a.voided).length;
    while (left() > 0) runQuiz(stage, ctx, st, 'fail');
  });
}
function demoReopen(ctx, st) {
  st.attempts.forEach(a => { if (!a.passed) a.voided = true; });
  audit({ actor: 'admin', action: 'quiz_unlocked', personId: ctx.person.id, pathwayId: ctx.pathway.id, version: ctx.pathway.version, detail: { name: ctx.person.name, note: 'Reopened from demo controls' } });
  toast('Quiz reopened'); stageQuiz($('#stage'), ctx);
}
function runQuiz(stage, ctx, st, auto) {
  const { person, pathway, step } = ctx;
  const drawn = shuffle(step.questions).slice(0, Math.min(step.drawCount, step.questions.length)).map(q => {
    const order = shuffle(q.options.map((_, i) => i));
    return { q, order, chosen: null };
  });
  const autoAnswer = mode => drawn.forEach((d, k) => { const wrong = mode === 'fail' && k < Math.ceil(drawn.length * .6); d.chosen = wrong ? d.order.find(o => o !== d.q.correct) : d.q.correct; });
  let i = 0;
  const keys = 'ABCDEF';
  const instant = (step.feedback || 'instant') === 'instant';
  const draw = () => {
    const d = drawn[i]; const shown = instant && d.chosen != null;
    const cls = oi => shown ? (oi === d.q.correct ? 'right' : oi === d.chosen ? 'wrong' : 'dim') : d.chosen === oi ? 'sel' : '';
    const ok = d.chosen === d.q.correct;
    stage.innerHTML = `<div class="row between" style="margin-bottom:10px"><span class="eyebrow">Question ${i + 1} of ${drawn.length}</span><span class="tiny muted">${shown ? 'Press Enter to continue' : `Press 1–${d.order.length} to choose${instant ? '' : ' · Enter to continue'}`}</span></div>
      <div class="qprog">${drawn.map((x, k) => `<i class="${instant && x.chosen != null ? (x.chosen === x.q.correct ? 'ok' : 'bad') : k <= i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="qtext ${shown ? '' : 'fadein'}">${esc(d.q.text)}</div>
      <div class="opts" role="radiogroup">${d.order.map((oi, k) => `<button class="opt ${shown ? '' : 'fadein'} ${cls(oi)}" role="radio" aria-checked="${d.chosen === oi}" data-oi="${oi}" ${shown ? 'disabled' : ''} style="animation-delay:${k * 40}ms"><span class="key">${shown && oi === d.q.correct ? '✓' : shown && oi === d.chosen ? '✗' : keys[k]}</span><span>${esc(d.q.options[oi])}</span></button>`).join('')}</div>
      ${shown ? `<div class="qfb ${ok ? 'ok' : 'bad'}" role="status"><b>${ok ? pick(['Correct!', 'That’s right.', 'Spot on.', 'Exactly right.']) : 'Not quite.'}</b> ${esc(d.q.explanation || '')}</div>` : ''}
      <div class="row between" style="margin-top:22px">
        ${instant ? `<span class="tiny muted">${shown ? '' : 'Choose an answer to see if you’re right'}</span>` : `<button class="btn ghost" id="qprev" ${i === 0 ? 'disabled' : ''}>${ICON.back} Back</button>`}
        <button class="btn red" id="qnext" ${d.chosen == null ? 'disabled' : ''}>${i === drawn.length - 1 ? (instant ? 'See results' : 'Submit answers') : 'Next'} ${ICON.arrow}</button></div>` + demoPanel([['dqPass', '✓ Finish this attempt: pass'], ['dqFail', '✗ Finish this attempt: fail']]);
    $('#dqPass', stage) && ($('#dqPass', stage).onclick = () => { autoAnswer('pass'); finish(true); });
    $('#dqFail', stage) && ($('#dqFail', stage).onclick = () => { autoAnswer('fail'); finish(true); });
    $$('.opt:not([disabled])', stage).forEach(b => b.onclick = () => {
      d.chosen = +b.dataset.oi;
      if (instant) { draw(); $('#qnext')?.focus(); return; }
      $$('.opt', stage).forEach(x => { const on = x === b; x.classList.toggle('sel', on); x.setAttribute('aria-checked', on); }); $('#qnext').disabled = false;
    });
    $('#qprev') && ($('#qprev').onclick = () => { i--; draw(); });
    $('#qnext').onclick = () => { if (i < drawn.length - 1) { i++; draw(); } else finish(); };
  };
  const kh = e => {
    if ($('#scrim') || !$('.opts', stage)) return;
    const n = parseInt(e.key); if (n >= 1 && n <= 6) { const o = $$('.opt', stage)[n - 1]; if (o && !o.disabled) o.click(); }
    if (e.key === 'Enter' && !$('#qnext').disabled && document.activeElement?.id !== 'qprev') { e.preventDefault(); $('#qnext').click(); }
  };
  document.addEventListener('keydown', kh); onLeave(() => document.removeEventListener('keydown', kh));
  const finish = (demo) => {
    document.removeEventListener('keydown', kh);
    const correct = drawn.filter(d => d.chosen === d.q.correct).length;
    const score = Math.round(correct / drawn.length * 100); const passed = score >= step.passMark;
    const attempt = { at: now(), score, passed, questions: drawn.map(d => ({ id: d.q.id, text: d.q.text, chosen: d.q.options[d.chosen], answer: d.q.options[d.q.correct], correct: d.chosen === d.q.correct })) };
    st.attempts.push(attempt); if (passed) { st.done = true; st.at = now(); }
    audit({ personId: person.id, actor: 'learner', action: 'quiz_attempt', pathwayId: pathway.id, version: pathway.version, stepId: step.id, detail: { score, passed, attempt: st.attempts.filter(a => !a.voided).length, of: step.maxAttempts, questions: attempt.questions, ...(demo ? { demo: true } : {}) } });
    const fails = st.attempts.filter(a => !a.passed && !a.voided).length; const left = step.lock === false ? Infinity : step.maxAttempts - fails;
    if (!passed && left <= 0) { audit({ personId: person.id, actor: 'system', action: 'quiz_locked', pathwayId: pathway.id, version: pathway.version, stepId: step.id, detail: { reason: 'Maximum attempts reached — flagged for follow-up' } }); autoEmail('locked', person, { training: pathway.title, key: now() }); }
    if (passed) confetti();
    stage.innerHTML = `<div class="result-hero fadein">
      <div class="eyebrow" style="color:${passed ? 'var(--teal)' : 'var(--red)'}">${passed ? 'Passed' : 'Not quite'}</div>
      <div class="bigscore" style="color:${passed ? 'var(--teal)' : 'var(--ink)'}">${score}%</div>
      <p class="muted" style="margin-top:8px">${correct} of ${drawn.length} correct · pass mark ${step.passMark}%</p>
      <p style="max-width:52ch;margin:10px auto 0">${passed ? 'Great work. Have a look over the explanations, then carry on.' : left > 0 ? `${left === Infinity ? 'You can try again as many times as you need.' : `You have ${plural(left, 'attempt')} left.`} Have a look at the notes below — you might want to rewatch the video first. You’ll get a fresh set of questions next time.` : 'You’ve used all your attempts. Here’s what happens next.'}</p></div>
      ${!passed && left <= 0 ? `<div style="margin-top:22px">${lockedExplainer(ctx)}</div>` : ''}
      <div class="review">${drawn.map(d => { const ok = d.chosen === d.q.correct; return `<div class="ri"><span class="ic" style="background:${ok ? 'var(--teal)' : 'var(--red)'}">${ok ? '✓' : '!'}</span><div><b>${esc(d.q.text)}</b><div class="small" style="margin-top:4px">${ok || passed ? '' : `<span class="muted">Your answer: ${esc(d.q.options[d.chosen])}</span><br>`}${esc(d.q.explanation || '')}</div></div></div>`; }).join('')}</div>
      <div class="row" style="justify-content:flex-end;margin-top:22px">
        ${passed ? `<button class="btn red" id="qn">Continue ${ICON.arrow}</button>` : left > 0 ? `<button class="btn ghost" id="qrw">Rewatch video</button><button class="btn red" id="qr">Try again</button>` : `<a class="btn ghost" href="#/me">Back to my training</a>`}</div>` + (passed ? '' : left > 0 ? quizDemoPanel(step) : demoPanel([['demoReopen', '↺ Reopen quiz (as an admin would)']]));
    bindQuizDemo(stage, ctx, st);
    $('#demoReopen', stage) && ($('#demoReopen', stage).onclick = () => demoReopen(ctx, st));
    $('#qn') && ($('#qn').onclick = ctx.next);
    $('#qr') && ($('#qr').onclick = () => runQuiz(stage, ctx, st));
    $('#qrw') && ($('#qrw').onclick = () => { const vi = pathway.steps.findIndex(s => s.type === 'video'); go(`#/me/p/${pathway.id}/${Math.max(0, vi)}`); });
  };
  if (auto) { autoAnswer(auto); finish(true); } else draw();
}

/* attestation + completion */
function stageAttest(stage, { person, pathway, pr }) {
  const st = statusOf(person, pathway);
  const freshCompletion = st.c && pr.completedVersion === pathway.version && pr.completedAt && st.c.completedAt === pr.completedAt;
  if (freshCompletion) { stage.innerHTML = completeScreen(person, st.c); return; }
  stage.innerHTML = stepHead('Sign-off', 'Attestation', 'This is your record that you completed the training yourself.') + `
    <div class="card" style="background:#FBFAF8;box-shadow:none">
      <label class="row" style="gap:12px;cursor:pointer;align-items:flex-start"><input type="checkbox" id="atck" style="width:22px;height:22px;accent-color:var(--red-600);margin-top:2px"><span style="font-weight:600">${esc(pathway.attestation)}</span></label>
      <div class="field" style="margin:18px 0 0">
        <label class="f" for="atname">Type your full name to sign</label>
        <input class="input" id="atname" autocomplete="name" placeholder="${esc(person.name)}" style="font-size:18px;font-weight:700">
        <div class="help">Must match the name on your invite: <b>${esc(person.name)}</b></div>
      </div>
    </div>
    <div class="row between" style="margin-top:16px"><span class="tiny muted">Signed ${fmtDT(now())} · Pathway version ${pathway.version}</span><button class="btn red lg" id="atgo" disabled>Sign & complete ${ICON.check.replace('<svg', '<svg width="18" height="18"')}</button></div>`;
  const chk = () => { $('#atgo').disabled = !($('#atck').checked && $('#atname').value.trim().toLowerCase().replace(/\s+/g, ' ') === person.name.toLowerCase()); };
  $('#atck').onchange = chk; $('#atname').oninput = chk;
  $('#atgo').onclick = () => {
    const at = now(); const certId = certNumber(at);
    const quizScores = pathway.steps.filter(s => s.type === 'quiz').map(s => (pr.steps[s.id]?.attempts || []).filter(a => a.passed).pop()?.score).filter(x => x != null);
    const c = { id: certId, personId: person.id, pathwayId: pathway.id, pathwayTitle: pathway.title, version: pathway.version, completedAt: at, expiresAt: expiryFrom(at, pathway.validityMonths), score: quizScores.length ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : null, attestationName: $('#atname').value.trim(), attestationText: pathway.attestation };
    db.completions.push(c);
    pr.completedVersion = pathway.version; pr.completedAt = at;
    audit({ personId: person.id, actor: 'learner', action: 'attested', pathwayId: pathway.id, version: pathway.version, detail: { name: c.attestationName, certId, statement: pathway.attestation } });
    audit({ personId: person.id, actor: 'system', action: 'certificate_issued', pathwayId: pathway.id, version: pathway.version, detail: { certId, expiresAt: c.expiresAt } });
    audit({ personId: person.id, actor: 'learner', action: 'module_completed', pathwayId: pathway.id, version: pathway.version, detail: { module: pathway.title, record_id: certId, completed_at: at } });
    // reset progress so the next renewal starts fresh (history stays in audit + completions)
    db.progress[person.id][pathway.id] = { steps: {}, startedAt: null, completedVersion: pathway.version, completedAt: at };
    autoEmail('complete', person, { training: pathway.title, expiry: c.expiresAt, key: c.id });
    persist(); confetti();
    stage.innerHTML = completeScreen(person, c);
  };
}
function completeScreen(person, c) {
  const others = requiredPathwaysFor(person).filter(p => !['complete', 'due'].includes(statusOf(person, p).key));
  return `<div class="result-hero fadein" style="padding:26px 0">
    <div style="width:84px;height:84px;margin:0 auto 14px;border-radius:50%;background:var(--teal-50);display:grid;place-items:center;color:var(--teal)">${ICON.check.replace('<svg', '<svg width="42" height="42"')}</div>
    <div class="eyebrow">Training complete</div><h1 style="margin:6px 0 10px">Thank you, ${esc(firstName(person.name))}!</h1>
    <p class="muted" style="max-width:52ch;margin:0 auto">You’ve completed <b>${esc(c.pathwayTitle)}</b>. Your certificate is valid until <b>${fmtDate(c.expiresAt)}</b> — we’ll remind you before it runs out.</p>
    <div class="row" style="justify-content:center;margin-top:20px">
      <a class="btn ghost" href="#/me/cert/${c.id}">${ICON.print} View certificate</a>
      ${others.length ? `<a class="btn red" href="#/me/p/${others[0].id}">Next: ${esc(others[0].title)} ${ICON.arrow}</a>` : `<a class="btn red" href="#/me">Back to my training</a>`}
    </div></div>`;
}

/* ---------- certificate + verify ---------- */
function qrSvg(text) {
  try { const q = qrcode(0, 'L'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 4, scalable: true }).replace('<svg ', '<svg shape-rendering="crispEdges" '); } catch { return ''; }
}
/* QR payload: certificate details + tamper check, so the code can be checked on any device.
   Live version: the QR just carries the ID and the server looks it up — the payload is a demo stand-in. */
const b64u = str => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = str => decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
const SIGN_SALT = 'suni-sg-demo-2026';
function certPayload(c) {
  const person = Person(c.personId);
  const body = b64u(JSON.stringify({ n: c.nameOnCert || person?.name || c.attestationName, t: c.pathwayTitle, v: c.version, c: c.completedAt.slice(0, 10), e: c.expiresAt.slice(0, 10), s: c.score }));
  return body + '.' + hash(c.id + body + SIGN_SALT);
}
const publicBase = () => (db.settings.publicUrl || '').trim().replace(/#.*$/, '') || (/^https?:/.test(location.protocol) ? location.href.split('#')[0] : '');
const verifyUrl = c => { const b = publicBase(); return b ? `${b}#/verify/${c.id}/${certPayload(c)}` : ''; };
function renderCert(certId, viewer) {
  const c = db.completions.find(x => x.id === certId);
  const person = c && Person(c.personId);
  const back = viewer ? '#/me' : '#/admin';
  if (!c || !person) { app().innerHTML = topbar() + `<main class="wrap"><div class="card empty">Certificate not found.</div></main>`; return; }
  app().innerHTML = topbar(`<a class="btn ghost sm noprint" href="${back}" data-back="${back}">${ICON.back} Back</a><button class="btn ghost sm noprint hide-sm" id="scanprev">📱 Preview scan</button><button class="btn red sm noprint hide-sm" onclick="print()">${ICON.print} Print / Save PDF</button>`, back) + `<main class="wrap fadein">
    ${c.revoked ? `<div class="notice bad noprint" style="max-width:980px;margin:0 auto 14px">${ICON.info}<div><b>${c.revoked.replacedBy ? `Replaced by ${esc(c.revoked.replacedBy)}` : 'This certificate has been revoked'}</b> on ${fmtDate(c.revoked.at)} — “${esc(c.revoked.reason)}”</div></div>` : ''}
    <div class="cert ${c.revoked ? 'cert-void' : ''}">
      <div class="flamebg">${FLAME(300)}</div>
      <div class="row" style="gap:18px">${LOGO(58)}<span class="brand-div" style="height:44px"></span><div><div class="eyebrow" style="color:var(--muted)">Safeguarding</div><div style="font-weight:800">Training Certificate</div></div></div>
      <div class="qr">${verifyUrl(c) ? `${qrSvg(verifyUrl(c))}<div style="margin-top:4px">Scan to verify</div>` : `<div class="qr-off noprint">QR code appears once this is on the web.<br><a href="#/admin/settings">Set the site address</a></div>`}</div>
      <div style="margin-top:6%"><div class="eyebrow">Certificate of completion</div>
      <h1 style="font-size:clamp(16px,2vw,22px);font-weight:600;color:var(--muted)">This certifies that</h1>
      <div class="name">${esc(c.nameOnCert || person.name)}</div>
      <div style="font-size:clamp(14px,2vw,22px)">has successfully completed <b>${esc(c.pathwayTitle)}</b>${c.score != null ? ` with a score of <b>${c.score}%</b>` : ''}.</div></div>
      <div class="meta">
        <div><b>Completed</b>${fmtDate(c.completedAt)}</div>
        <div><b>Valid until</b>${fmtDate(c.expiresAt)}</div>
        <div><b>Certificate ID</b>${esc(c.id)}</div>
        <div><b>Course version</b>v${c.version}</div>
        <div><b>${c.manual ? 'Recorded' : 'Signed as'}</b>${esc(c.manual ? c.manual.method.split(' (')[0] : c.attestationName)}</div>
        <div class="cert-tag">Light to live by</div>
      </div>
      <div class="tiny muted" style="margin-top:14px;position:relative">Scripture Union Northern Ireland · Charity number NIC104852 · Verify at ${esc(publicBase() ? publicBase().replace(/^https?:\/\//, '').replace(/\/$/, '') + ' · ID ' + c.id : 'the SUNI training site')}</div>
    </div>
    ${(() => { const valid = !c.revoked && new Date(c.expiresAt) > new Date();
      return `<div class="cert-m ${c.revoked ? 'void' : ''}"><div class="cm-top">${LOGO(40)}<span class="cm-tag ${valid ? 'ok' : 'bad'}">${c.revoked ? 'Not valid' : valid ? '✓ Valid' : 'Expired'}</span></div>
        <div class="cm-band"></div>
        <div class="cm-body"><div class="eyebrow">Safeguarding training certificate</div><div class="cm-name">${esc(c.nameOnCert || person.name)}</div>
          <p>has completed <b>${esc(c.pathwayTitle)}</b>${c.score != null ? ` with a score of <b>${c.score}%</b>` : ''}.</p>
          <dl class="cm-meta"><div><dt>Completed</dt><dd>${fmtDate(c.completedAt)}</dd></div><div><dt>Valid until</dt><dd>${fmtDate(c.expiresAt)}</dd></div><div><dt>Certificate ID</dt><dd>${esc(c.id)}</dd></div><div><dt>${c.manual ? 'Recorded' : 'Signed as'}</dt><dd>${esc(c.manual ? c.manual.method.split(' (')[0] : c.attestationName)}</dd></div></dl>
          ${verifyUrl(c) ? `<div class="cm-qr">${qrSvg(verifyUrl(c))}<span>Anyone can scan this to check it’s genuine</span></div>` : ''}
          <div class="cm-acts"><button class="btn red" onclick="print()">${ICON.dl} Download PDF</button><button class="btn ghost" id="scanprev2">📱 Preview scan</button></div>
          <p class="tiny muted" style="margin:12px 0 0">The PDF is the full A4 certificate. Scripture Union Northern Ireland · NIC104852</p></div></div>`; })()}
    </main>`;
  $('#scanprev').onclick = () => scanPreview(c); $('#scanprev2') && ($('#scanprev2').onclick = () => scanPreview(c));
  $('.qr-off a') && 0;
}
function scanPreview(c) {
  const url = verifyUrl(c);
  modal(`<header><div><div class="eyebrow">What people see when they scan</div><h2 style="margin-top:4px">Certificate check on a phone</h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body"><div class="phone"><div class="phone-notch"></div><div class="phone-bar"><span>${url ? esc(url.replace(/^https?:\/\//, '').split('#')[0]) : 'training.suni.co.uk'}/verify</span></div><div class="phone-screen"><div class="vpage in-phone"><header class="vhead">${LOGO(30)}</header><main class="vmain">${verifyCard(c.id, certPayload(c))}</main></div></div></div>
    <p class="small muted" style="text-align:center;margin:14px auto 0;max-width:46ch">${url ? 'Scanning the code opens this page on any phone.' : 'Once this demo is on the web (e.g. Cloudflare Pages), the QR code opens this page on any phone. Until then it can’t point anywhere.'} Anyone can also check an ID at <a href="#/verify" data-close>the verify page</a>.</p></div>`, 'phonewrap');
}
function verifyLookup(certId, payload) {
  const local = db.completions.find(x => x.id === certId);
  let data = null, tampered = false, source = 'record';
  if (local) { const p = Person(local.personId); data = { n: local.nameOnCert || p?.name || local.attestationName, t: local.pathwayTitle, v: local.version, c: local.completedAt, e: local.expiresAt, s: local.score, r: local.revoked, m: !!local.manual }; }
  else if (payload) { const [body, sig] = payload.split('.'); try { if (hash(certId + body + SIGN_SALT) !== sig) throw 0; data = JSON.parse(unb64u(body)); source = 'qr'; } catch { tampered = true; } }
  const state = tampered ? 'tampered' : !data ? 'notfound' : data.r ? (data.r.replacedBy ? 'replaced' : 'revoked') : new Date(data.e) > new Date() ? 'valid' : 'expired';
  return { data, state, source };
}
function verifyCard(certId, payload) {
  const { data, state, source } = verifyLookup(certId, payload);
  const S = {
    valid: ['var(--teal)', 'Valid certificate', 'This person has completed Scripture Union NI’s safeguarding training and it is in date.'],
    expired: ['#C2850E', 'Certificate expired', 'This training was completed but has expired. They’ll need to renew it before serving.'],
    revoked: ['var(--red)', 'Certificate revoked', 'This certificate is no longer valid. Please don’t rely on it — contact SUNI.'],
    replaced: ['#C2850E', 'Certificate replaced', `A newer certificate (${esc(data?.r?.replacedBy || '')}) has been issued. Ask to see that one.`],
    notfound: ['var(--red)', 'We can’t find that certificate', `No certificate matches <b>${esc(certId)}</b>. Check the ID or contact SUNI.`],
    tampered: ['var(--red)', 'This code has been altered', 'The details in this QR code don’t match its signature, so it can’t be trusted.'],
  }[state];
  const ico = state === 'valid' ? ICON.check.replace('<svg', '<svg width="44" height="44"') : state === 'expired' || state === 'replaced' ? ICON.info.replace('<svg', '<svg width="44" height="44"') : ICON.x.replace('width="18" height="18"', 'width="40" height="40"');
  const row = (k, v) => `<div class="vrow"><span>${k}</span><b>${v}</b></div>`;
  return `<div class="vcard">
    <div class="vtop" style="--tone:${S[0]}"><div class="vbadge">${ico}</div><div class="vk">Safeguarding certificate check</div><h1>${S[1]}</h1><p>${S[2]}</p></div>
    ${data ? `<div class="vbody">${row('Name', esc(data.n))}${row('Training', `${esc(data.t)} <span class="muted" style="font-weight:600">v${data.v}</span>`)}${row('Completed', fmtDate(data.c) + (data.m ? ' <span class="muted" style="font-weight:600">(recorded by SUNI)</span>' : ''))}${row(state === 'valid' ? 'Valid until' : 'Expiry date', `<span style="color:${S[0]}">${fmtDate(data.e)}</span>`)}${data.s != null ? row('Quiz score', data.s + '%') : ''}${row('Certificate ID', `<span class="mono">${esc(certId)}</span>`)}
      <div class="vchecked">${ICON.check.replace('<svg', '<svg width="13" height="13"')} Checked ${fmtDT(now())}</div></div>` : ''}
    <div class="vinfo">
      <details><summary>What does this certificate mean?</summary><p>The person named has watched SUNI’s safeguarding training, passed a short quiz and signed to say they’ll follow our safeguarding policy. It is <b>not</b> a criminal record check — AccessNI checks are handled separately.</p></details>
      ${source === 'qr' ? `<p class="tiny muted" style="margin:10px 0 0">Demo: these details were read from the QR code and its tamper check passed. The live site checks them against SUNI’s central records.</p>` : ''}
    </div>
    <div class="vfoot"><a href="#/verify">Check another certificate</a><span>·</span><a href="mailto:${esc(db.settings.dsoEmail || 'info@suni.co.uk')}">Contact SUNI</a></div>
  </div>`;
}
function renderVerify(certId, payload) {
  if (!certId) {
    app().innerHTML = `<div class="vpage"><header class="vhead">${LOGO(40)}</header><main class="vmain fadein"><div class="vcard"><div class="vtop" style="--tone:var(--red)"><div class="vbadge">${ICON.attest.replace('<svg', '<svg width="40" height="40"')}</div><div class="vk">Safeguarding certificate check</div><h1>Check a certificate</h1><p>Scan the QR code on a SUNI safeguarding certificate, or type its ID below.</p></div>
      <div class="vbody"><form id="vf2" class="vform"><input class="input" id="vid" placeholder="SUNI-SG-2026-XXXXXX" autocomplete="off" style="text-transform:uppercase;font-size:17px;font-weight:700;letter-spacing:.03em"><button class="btn red">Check</button></form><div class="help">You’ll find the ID at the bottom of the certificate.</div></div></div></main></div>`;
    $('#vf2').onsubmit = e => { e.preventDefault(); const v = $('#vid').value.trim().toUpperCase(); if (v) go('#/verify/' + v); };
    return;
  }
  app().innerHTML = `<div class="vpage"><header class="vhead">${LOGO(40)}</header><main class="vmain fadein">${verifyCard(certId, payload)}</main><footer class="vpfoot">Scripture Union Northern Ireland · Charity NIC104852 · Light to live by</footer></div>`;
}

/* global delegated actions */
document.addEventListener('click', e => {
  if (!e.target.closest('[data-act=more]')) document.querySelectorAll('.moremenu:not([hidden])').forEach(m => { m.hidden = true; m.previousElementSibling?.setAttribute('aria-expanded', 'false'); });
  const bk = e.target.closest('[data-back]'); if (bk) { e.preventDefault(); appBack(bk.dataset.back); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'worried') showWorried();
  if (a.dataset.act === 'more') { const m = a.nextElementSibling, open = m.hidden; document.querySelectorAll('.moremenu').forEach(x => { x.hidden = true; x.previousElementSibling?.setAttribute('aria-expanded', 'false'); }); m.hidden = !open; a.setAttribute('aria-expanded', open); if (open) m.querySelector('.mitem')?.focus(); return; }
  if (a.dataset.act === 'tbmenu') { const t = a.closest('.topbar'); const o = t.classList.toggle('open'); a.setAttribute('aria-expanded', o); }
  if (a.dataset.act === 'demobar') a.closest('.demobar').classList.toggle('open');
  if (a.dataset.act === 'steps') { const o = $('#paside').classList.toggle('open'); a.setAttribute('aria-expanded', o); }
  if (a.dataset.act === 'logout') logout('vol');
  if (a.dataset.act === 'adminlogout') logout('admin');
});
