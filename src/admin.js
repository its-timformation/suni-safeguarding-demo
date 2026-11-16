/* =====================================================================
   ADMIN
   ===================================================================== */
const NAV = [
  ['', 'Overview', 'grid'], ['people', 'People', 'people'], ['events', 'Events', 'cal'],
  ['pathways', 'Pathways', 'path'], ['emails', 'Emails', 'mail'], ['audit', 'Audit log', 'log'], ['privacy', 'Data & privacy', 'shield'], ['settings', 'Settings', 'cog'],
];
function adminShell(active, inner) {
  app().innerHTML = topbar(`<span class="small muted hide-sm">Signed in as <b>${esc(db.settings.adminName)}</b></span><button class="btn ghost sm" data-act="adminlogout">Log out</button>`, '#/admin') +
    `<main class="wrap"><div class="adminshell">
      <nav class="sidenav noprint">${NAV.map(([k, l, i]) => `<a href="#/admin${k ? '/' + k : ''}" class="${active === k ? 'on' : ''}">${ICON[i]} ${l}</a>`).join('')}
</nav>
      <div class="fadein" id="adm">${inner}</div></div></main>` + demobar('admin');
}
function adminRoute(parts) {
  if (!isAdmin()) return renderAdminLogin();
  const [sec, id, sub] = parts;
  if (sec === 'people' && id && sub === 'followup') return renderFollowUp(id, parts[3]);
  if (sec === 'people' && id) { recordTab = ['training', 'attempts', 'certs', 'activity'].includes(sub) ? sub : 'training'; return renderPersonRecord(id); }
  if (sec === 'people') return renderPeople();
  if (sec === 'events' && id) return renderEventDetail(id);
  if (sec === 'events') return renderEvents();
  if (sec === 'pathways' && id) return renderPathwayEditor(id);
  if (sec === 'pathways') return renderPathways();
  if (sec === 'emails') return renderEmails();
  if (sec === 'audit') return renderAudit();
  if (sec === 'settings') return renderSettings();
  if (sec === 'privacy') return renderPrivacy();
  if (sec === 'cert' && id) return renderCert(id, null);
  renderOverview();
}
function readyCounts(ev) { const c = { ready: 0, renew: 0, todo: 0, total: 0 }; live().forEach(p => { if (p.eventIds.includes(ev.id)) { c[eventState(p, ev)]++; c.total++; } }); return c; }
const SEG = [['ready', 'Ready', 'var(--teal)'], ['renew', 'Needs refresher', 'var(--amber)'], ['todo', 'Not trained', 'var(--red)']];
const readyBar = (c, evId) => c.total ? `<div class="segbar" role="img" aria-label="${SEG.map(([k, l]) => `${c[k]} ${l}`).join(', ')}">${SEG.map(([k, l, col]) => c[k] ? `<a href="#/admin/people" data-pf='${JSON.stringify({ event: evId, ready: k })}' style="flex:${c[k]};background:${col}" title="${c[k]} ${l} — click to see who"></a>` : '').join('')}</div>` : '<div class="segbar empty"></div>';
const readyLegend = (c, evId) => `<div class="seglegend">${SEG.map(([k, l, col]) => `<a href="#/admin/people" data-pf='${JSON.stringify({ event: evId, ready: k })}'><span class="sw" style="background:${col}"></span>${l} <b>${c[k]}</b></a>`).join('')}</div>`;
function bindPf() { $$('[data-pf]').forEach(a => a.onclick = e => { e.preventDefault(); peopleFilter = { ...PF0, ...JSON.parse(a.dataset.pf) }; peoplePage = 1; go('#/admin/people'); }); }
const pageHead = (eyebrow, title, sub, actions = '') => `<div class="pagehead"><div><div class="eyebrow">${eyebrow}</div><h1 style="font-size:32px;margin-top:4px">${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div><div class="row noprint">${actions}</div></div>`;
const avatar = p => `<span class="avatar" style="background:${avatarColour(p.name)}">${initials(p.name)}</span>`;

/* ---------- overview ---------- */
let matrixFilter = { q: '', event: '', role: '', status: '' }, matrixShown = 25;
const PF0 = { q: '', event: '', role: '', status: '', ready: '', pathway: '' }; let peopleFilter = { ...PF0 }, peopleShown = 40, peoplePage = 1; const PAGE = 25;
function renderOverview() {
  const N = live().length;
  const per = live().map(p => { const req = requiredPathwaysFor(p); return { p, req, sts: req.map(pw => ({ pw, st: statusOf(p, pw) })) }; });
  const has = k => per.filter(r => r.sts.some(x => x.st.key === k)).length;
  const fully = per.filter(r => r.req.length && r.sts.every(x => ['complete', 'due'].includes(x.st.key))).length;
  const pct = N ? Math.round(fully / N * 100) : 0;
  const locked = has('locked'), expired = has('expired'), due = has('due'), notStarted = has('none'), inProg = has('progress');
  const upcoming = [...db.events].filter(e => new Date(e.endDate || e.date) >= new Date()).sort((a, b) => a.date.localeCompare(b.date));
  const r = 54, C = 2 * Math.PI * r;
  const act = (n, label, sub, col, filter, icon) => `<a class="card kpi2" href="#/admin/people" data-pf='${JSON.stringify(filter)}'>
      <div class="row between"><span class="kdot" style="background:${col}1f;color:${col}">${icon}</span><span class="tiny muted">View ${ICON.arrow.replace('width="18" height="18"', 'width="14" height="14"')}</span></div>
      <div class="kn" style="color:${n ? col : 'var(--muted)'}">${n}</div><div class="kl">${label}</div><div class="tiny muted">${sub}</div>${n && filter.status !== 'locked' ? `<button class="btn soft xs kremind" data-kremind="${filter.status}">✉️ Remind all ${n}</button>` : ''}</a>`;
  const ST = [['complete', 'Complete', 'var(--teal)'], ['due', 'Due soon', 'var(--amber)'], ['progress', 'In progress', 'var(--sky)'], ['none', 'Not started', '#CFC8C0'], ['expired', 'Expired', 'var(--red)'], ['locked', 'Needs review', 'var(--plum)']];
  adminShell('', pageHead('Overview', 'Training at a glance', `${fmtDate(now())} · ${N} ${N === 1 ? 'person' : 'people'} · ${plural(db.pathways.length, 'pathway')} · ${plural(upcoming.length, 'upcoming event')}`,
    `<button class="btn ghost sm" id="xaudrep">${ICON.dl} Audit report (CSV)</button><button class="btn ghost sm" data-x="register">${ICON.dl} Training register</button><button class="btn ghost sm" data-x="audit">${ICON.dl} Audit log</button>`) + `
    <div class="ovtop">
      <div class="card herokpi">
        <div class="bigring"><svg width="132" height="132" viewBox="0 0 132 132"><circle cx="66" cy="66" r="${r}" stroke="#EFEAE4" stroke-width="14" fill="none"/><circle cx="66" cy="66" r="${r}" stroke="var(--teal)" stroke-width="14" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}" transform="rotate(-90 66 66)"/></svg><b>${pct}%</b></div>
        <div style="min-width:0"><div class="eyebrow">Fully trained</div><div class="hk-n">${fully}<span>&nbsp;/&nbsp;${N}</span></div><p class="muted small" style="margin:4px 0 0">people with every course they need, in date</p>
        <div class="row" style="margin-top:10px;gap:6px"><span class="chip st-progress"><span class="dot"></span>${inProg} in progress</span><span class="chip st-none"><span class="dot"></span>${notStarted} not started</span></div></div>
      </div>
      <div class="kpis">
        ${act(locked, 'Need a follow-up chat', 'Quiz locked after 3 attempts', 'var(--plum)', { status: 'locked' }, ICON.heart.replace('width="15" height="15"', 'width="18" height="18"'))}
        ${act(expired, 'Expired', 'Certificate has run out', 'var(--red)', { status: 'expired' }, ICON.x)}
        ${act(due, `Due in ${db.settings.dueSoonDays} days`, 'Send a reminder soon', 'var(--amber)', { status: 'due' }, ICON.cal.replace('<svg', '<svg width="18" height="18"'))}
      </div>
    </div>
    <h2 style="margin:28px 0 12px">By pathway</h2>
    <div class="grid g2">${db.pathways.filter(pw => pw.active !== false).map(pw => {
      const rows = per.filter(r => r.req.includes(pw)); const c = Object.fromEntries(ST.map(([k]) => [k, 0]));
      rows.forEach(r => c[r.sts.find(x => x.pw === pw).st.key]++);
      return `<div class="card"><div class="row between"><h3>${esc(pw.title)}</h3><span class="small"><b>${rows.length ? Math.round((c.complete + c.due) / rows.length * 100) : 0}%</b> <span class="muted">of ${rows.length}</span></span></div>
        <div class="tiny muted" style="margin:2px 0 10px">v${pw.version} · ${renewLabel(pw)}</div>
        <div class="segbar">${ST.map(([k, l, col]) => c[k] ? `<a href="#/admin/people" data-pf='${JSON.stringify({ pathway: pw.id, status: k })}' style="flex:${c[k]};background:${col}" title="${c[k]} ${l}"></a>` : '').join('')}</div>
        <div class="seglegend">${ST.map(([k, l, col]) => `<a href="#/admin/people" data-pf='${JSON.stringify({ pathway: pw.id, status: k })}'><span class="sw" style="background:${col}"></span>${l} <b>${c[k]}</b></a>`).join('')}</div></div>`;
    }).join('')}</div>
    <div class="grid g2" style="margin-top:22px;align-items:start">
      <div class="card"><div class="row between" style="margin-bottom:6px"><h3>Event readiness</h3><a class="small" href="#/admin/events">All events</a></div>
        ${upcoming.length ? upcoming.map(ev => { const c = readyCounts(ev);
          return `<div style="padding:12px 0;border-bottom:1px solid #F1EDE8"><div class="row between"><a href="#/admin/events/${ev.id}" style="color:inherit;font-weight:700">${esc(ev.name)}</a><span class="small"><b>${c.total ? Math.round(c.ready / c.total * 100) : 0}%</b> <span class="muted">ready</span></span></div>
            <div class="tiny muted" style="margin:2px 0 8px">${fmtDate(ev.date)} · ${esc(ev.location || '')} · ${plural(c.total, 'volunteer')}</div>${readyBar(c, ev.id)}${readyLegend(c, ev.id)}</div>`; }).join('') : '<div class="empty">No upcoming events</div>'}
      </div>
      <div class="card"><div class="row between" style="margin-bottom:6px"><h3>Recent activity</h3><a class="small" href="#/admin/audit">Audit log</a></div>${activityList(db.audit.slice(-10).reverse())}</div>
    </div>`);
  bindPf(); bindExports(); $("#xaudrep") && ($("#xaudrep").onclick = exportAuditReport);
  $$('[data-kremind]').forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); const k = b.dataset.kremind; const ppl = live().filter(p => requiredPathwaysFor(p).some(pw => statusOf(p, pw).key === k));
    composeEmail(ppl, { title: k === 'expired' ? 'Remind everyone whose training has expired' : 'Remind everyone due soon', ruleId: k === 'expired' ? 'r-expired' : 'r-expiring', ctxFor: p => { const x = requiredPathwaysFor(p).map(pw => ({ pw, st: statusOf(p, pw) })).find(y => y.st.key === k); return { training: x?.pw.title, expiry: x?.st.c?.expiresAt, daysLeft: x?.st.c ? Math.ceil((new Date(x.st.c.expiresAt) - Date.now()) / DAY) : '' }; } }); });
}
const ACTION_LABEL = {
  pathway_started: 'started', video_completed: 'finished the video', read_acknowledged: 'acknowledged a reading', quiz_attempt: 'took the quiz', quiz_locked: 'was flagged for review', attested: 'signed the attestation', certificate_issued: 'was issued a certificate',
  quiz_unlocked: 'reopened quiz for', pathway_published: 'published', person_added: 'added', person_updated: 'updated', person_removed: 'removed', event_saved: 'saved event', event_removed: 'removed event', settings_saved: 'updated settings', demo_seeded: 'created demo data', data_imported: 'imported a backup', invite_copied: 'copied invite link for',
};
function auditText(a) {
  const who = a.personId ? Person(a.personId)?.name || 'Removed person' : null;
  const pw = a.pathwayId ? (P(a.pathwayId)?.title || a.pathwayId) : '';
  const d = a.detail || {};
  switch (a.action) {
    case 'quiz_attempt': return `<b>${esc(who)}</b> took the quiz — ${d.score}% ${d.passed ? '<span class="chip st-complete">Pass</span>' : '<span class="chip st-expired">Not passed</span>'}${d.demo ? ' <span class="tag">demo</span>' : ''} <span class="muted">· ${esc(pw)}</span>`;
    case 'video_completed': return `<b>${esc(who)}</b> finished the video${d.demoSkip ? ' <span class="tag">demo skip</span>' : ''} <span class="muted">· ${esc(pw)}</span>`;
    case 'followup_recorded': return `<b>${esc(d.by)}</b> held a follow-up with <b>${esc(d.name || who)}</b> <span class="muted">· ${esc(d.how)} · ${esc(pw)}${d.reopened ? ' · quiz reopened' : ''}</span>${d.notes ? `<br><span class="tiny muted">“${esc(d.notes)}”</span>` : ''}`;
    case 'email_sent': return `${a.actor === 'system' ? 'Automatic email' : 'Email'} to <b>${esc(d.name || who)}</b> <span class="muted">· “${esc(d.subject)}”</span>`;
    case 'emails_sent': return `Admin sent <b>${d.count}</b> email${d.count === 1 ? '' : 's'} <span class="muted">· ${esc(d.template || d.subject || '')}</span>`;
    case 'volunteer_archived': return `Admin archived <b>${esc(d.name || who)}</b>${d.reason ? ` <span class="muted">· ${esc(d.reason)}</span>` : ''}`;
    case 'volunteer_reactivated': return `<b>${esc(d.name || who)}</b> reactivated <span class="muted">· ${esc(d.source || 'admin')} · ${d.records_kept} record${d.records_kept === 1 ? '' : 's'} kept${d.records_removed ? `, ${d.records_removed} over ${retentionYears()} years old removed` : ''}</span>`;
    case 'volunteer_deleted': return `${a.actor === 'system' ? 'Automatic cleanup' : 'Admin'} permanently deleted a volunteer <span class="muted">· ref ${esc(d.ref)} · ${d.records_deleted} records and ${d.audit_entries_deleted} audit entries erased · ${esc(d.reason || '')}</span>`;
    case 'volunteer_created': return `Admin added <b>${esc(d.name || who)}</b>${d.source ? ` <span class="muted">· ${esc(d.source)}</span>` : ''}`;
    case 'volunteer_updated': return `Admin updated <b>${esc(d.name || who)}</b> <span class="muted">· ${esc((d.changes || []).join(', '))}${d.source ? ' · ' + esc(d.source) : ''}</span>`;
    case 'retention_cleanup': return `Data cleanup (${esc(d.source)}) <span class="muted">· before ${esc(d.cutoff)} · ${d.records_removed} records, ${d.volunteers_deleted} volunteers, ${d.audit_entries_removed} audit entries removed</span>`;
    case 'data_imported': return `Admin imported data <span class="muted">· ${esc(d.kind || '')}${d.file ? ' · ' + esc(d.file) : ''}${d.created != null ? ` · ${d.created} new, ${d.updated} updated, ${d.reactivated} reactivated, ${d.skipped} skipped` : ''}${d.total ? ` · ${d.total} volunteers` : ''}</span>`;
    case 'report_exported': return `Admin downloaded <b>${esc(d.report || 'a report')}</b>${d.rows ? ` <span class="muted">· ${d.rows} rows</span>` : ''}`;
    case 'magic_link_sent': return `Sign-in link emailed to <b>${esc(d.name || who)}</b> <span class="muted">· valid ${LINK_MINUTES} minutes</span>`;
    case 'login': return `<b>${esc(d.name || who)}</b> signed in <span class="muted">· magic link</span>`;
    case 'logout': return `<b>${esc(d.name || who)}</b> logged out`;
    case 'login_blocked': return `Sign-in refused <span class="muted">· ${esc(d.reason || 'not an active volunteer')}</span>`;
    case 'admin_login': return `Admin signed in`;
    case 'admin_logout': return `Admin logged out`;
    case 'admin_preview': return `Admin previewed <b>${esc(d.name || who)}</b>’s training as a volunteer`;
    case 'module_completed': return `<b>${esc(who)}</b> completed <b>${esc(d.module || pw)}</b> <span class="muted">· record saved</span>`;
    case 'person_archived': case 'person_restored': return `Admin ${a.action === 'person_archived' ? 'archived' : 'restored'} <b>${esc(d.name || who)}</b>`;
    case 'quiz_unlocked': case 'invite_copied': case 'person_added': case 'person_updated': case 'person_removed': return `Admin ${ACTION_LABEL[a.action]} <b>${esc(d.name || who)}</b>${pw ? ` <span class="muted">· ${esc(pw)}</span>` : ''}${d.changes ? ` <span class="muted">· ${esc(d.changes.join(', '))}</span>` : ''}`;
    case 'completion_recorded': return `Admin recorded a completion for <b>${esc(d.name || who)}</b> <span class="muted">· ${esc(pw)} · ${esc(d.method || '')}</span>${d.reason ? `<br><span class="tiny muted">“${esc(d.reason)}”</span>` : ''}`;
    case 'training_reset': return `Admin reset <b>${esc(d.name || who)}</b>’s training <span class="muted">· ${esc(pw)} · certificate ${esc(d.certificate)}</span>${d.reason ? `<br><span class="tiny muted">“${esc(d.reason)}”</span>` : ''}`;
    case 'certificate_edited': return `Admin edited certificate <b>${esc(d.certId)}</b> for ${esc(d.name || who)} <span class="muted">· ${(d.changes || []).map(c => `${esc(c.field)} ${esc(c.from)} → ${esc(c.to)}`).join(', ')}</span>${d.reason ? `<br><span class="tiny muted">“${esc(d.reason)}”</span>` : ''}`;
    case 'certificate_revoked': case 'certificate_reinstated': return `Admin ${a.action === 'certificate_revoked' ? 'revoked' : 'reinstated'} certificate <b>${esc(d.certId)}</b> for ${esc(d.name || who)}${d.reason ? `<br><span class="tiny muted">“${esc(d.reason)}”</span>` : ''}`;
    case 'certificate_reissued': return `Admin reissued certificate ${esc(d.from)} as <b>${esc(d.to)}</b> for ${esc(d.name || who)}${d.reason ? `<br><span class="tiny muted">“${esc(d.reason)}”</span>` : ''}`;
    case 'pathway_published': return `Admin published <b>${esc(pw)}</b> v${a.version}${d.note ? ` — “${esc(d.note)}”` : ''}`;
    case 'event_saved': case 'event_removed': return `Admin ${ACTION_LABEL[a.action]} <b>${esc(d.name)}</b>`;
    default: return who ? `<b>${esc(who)}</b> ${ACTION_LABEL[a.action] || a.action} <span class="muted">· ${esc(pw)}</span>` : `Admin ${ACTION_LABEL[a.action] || a.action}`;
  }
}
function activityList(items) { return items.length ? `<ul class="timeline">${items.map(a => `<li><span class="when">${fmtDT(a.at)}</span><span>${auditText(a)}</span></li>`).join('')}</ul>` : '<div class="empty">No activity yet</div>'; }

function bindCopy() {
  $$('[data-copy]').forEach(b => b.onclick = async e => {
    e.stopPropagation(); const p = db.people.find(x => x.token === b.dataset.copy);
    const url = location.href.split('#')[0] + '#/i/' + p.token;
    try { await navigator.clipboard.writeText(url); toast('Invite link copied'); } catch { prompt('Copy this link:', url); }
    audit({ actor: 'admin', action: 'invite_copied', personId: p.id, detail: { name: p.name } });
  });
}

/* ---------- exports ---------- */
function csv(rows) { return rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n'); }
function download(name, text, type = 'text/csv') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
const stamp = () => new Date().toISOString().slice(0, 10);
function exportRegister() {
  const rows = [['Name', 'Email', 'Roles', 'Events', 'Pathway', 'Status', 'Completed', 'Expires', 'Course version', 'Score %', 'Quiz attempts (current cycle)', 'Signed as', 'Certificate ID']];
  live().forEach(p => requiredPathwaysFor(p).forEach(pw => {
    const st = statusOf(p, pw); const c = st.c; const pr = prog(p.id, pw.id);
    const attempts = pw.steps.filter(s => s.type === 'quiz').reduce((n, s) => n + (pr.steps[s.id]?.attempts?.length || 0), 0);
    rows.push([p.name, p.email, p.roles.join('; '), p.eventIds.map(id => EventById(id)?.name).join('; '), pw.title, st.key === 'due' ? 'Due soon' : st.label.replace(/ ·.*/, ''), c ? fmtDate(c.completedAt) : '', c ? fmtDate(c.expiresAt) : '', c ? 'v' + c.version : '', c?.score ?? '', attempts, c?.attestationName || '', c?.id || '']);
  }));
  download(`SUNI-safeguarding-register-${stamp()}.csv`, csv(rows)); toast('Register downloaded');
}
function exportAudit(list = db.audit) {
  const rows = [['Timestamp (UTC)', 'Actor', 'Person', 'Email', 'Action', 'Pathway', 'Version', 'Step', 'Details']];
  list.forEach(a => { const p = a.personId && Person(a.personId); rows.push([a.at, a.actor, p?.name || '', p?.email || '', a.action, a.pathwayId ? P(a.pathwayId)?.title || a.pathwayId : '', a.version ?? '', a.stepId || '', JSON.stringify(a.detail || {})]); });
  download(`SUNI-safeguarding-audit-${stamp()}.csv`, csv(rows)); toast('Audit log downloaded');
}
function bindExports() {
  $$('[data-x]').forEach(b => b.onclick = () => ({ register: exportRegister, audit: () => exportAudit(), backup: () => { download(`SUNI-safeguarding-backup-${stamp()}.json`, JSON.stringify(db, null, 2), 'application/json'); toast('Backup downloaded'); } })[b.dataset.x]());
}

/* ---------- people ---------- */
const live = () => db.people.filter(p => !p.archived);
const TYPES = [['volunteer', 'Volunteers'], ['staff', 'Staff'], ['other', 'Other']];
const typeOf = p => p.type || (p.roles.includes('Staff') ? 'staff' : 'volunteer');
let peopleTab = 'all';
function filteredPeople() {
  const f = peopleFilter; const ev = f.event && EventById(f.event);
  return db.people.filter(p => {
    if (peopleTab === 'archived' ? !p.archived : p.archived) return false;
    if (!['all', 'archived'].includes(peopleTab) && typeOf(p) !== peopleTab) return false;
    if (f.q && !(p.name + ' ' + p.email + ' ' + (p.org || '')).toLowerCase().includes(f.q.toLowerCase())) return false;
    if (f.event && !p.eventIds.includes(f.event)) return false;
    if (f.role && !p.roles.includes(f.role)) return false;
    if (f.ready && ev && eventState(p, ev) !== f.ready) return false;
    if (f.pathway && !requiredPathwaysFor(p).some(pw => pw.id === f.pathway)) return false;
    if (f.status) { const sts = requiredPathwaysFor(p).filter(pw => !f.pathway || pw.id === f.pathway).map(pw => statusOf(p, pw).key);
      if (f.status === 'attention' ? !sts.some(k => ['locked', 'expired', 'due'].includes(k)) : f.status === 'complete' ? !(sts.length && sts.every(k => k === 'complete')) : !sts.includes(f.status)) return false; }
    return true;
  });
}
function personSummary(p) {
  const req = requiredPathwaysFor(p); const sts = req.map(pw => statusOf(p, pw));
  const done = sts.filter(s => ['complete', 'due'].includes(s.key)).length;
  const worstK = ['locked', 'expired', 'none', 'progress', 'due', 'complete'].find(k => sts.some(s => s.key === k));
  const worst = worstK === 'complete' ? { key: 'complete', label: 'Up to date' } : sts.find(s => s.key === worstK);
  return { req, sts, done, worst };
}
function renderPeople() {
  const f = peopleFilter; const ev = f.event && EventById(f.event);
  const count = t => t === 'all' ? live().length : t === 'archived' ? db.people.filter(p => p.archived).length : live().filter(p => typeOf(p) === t).length;
  adminShell('people', pageHead('People', 'People', 'Training is assigned automatically from each person’s roles and the events they’ve signed up for.',
    `<button class="btn ghost sm" id="prem">✉️ Send reminders</button><button class="btn ghost sm" id="pmail">Email these people</button><button class="btn ghost sm" id="pprint">${ICON.print} Print list</button><button class="btn ghost sm" id="imp">Import CSV</button><button class="btn red sm" id="addp">+ Add person</button>`) + `
    <div class="tabs" role="tablist">${[['all', 'Everyone'], ...TYPES, ['archived', 'Archived']].map(([k, l]) => `<button role="tab" class="${peopleTab === k ? 'on' : ''}" aria-selected="${peopleTab === k}" data-ptab="${k}">${l} <span>${count(k)}</span></button>`).join('')}</div>
    <div class="filters">
      <input class="input" placeholder="Search name, email or church…" id="pq" value="${esc(f.q)}" style="flex:1 1 240px">
      <select class="input" id="pev"><option value="">All events</option>${db.events.map(e => `<option value="${e.id}" ${f.event === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
      <select class="input" id="prole"><option value="">All roles</option>${db.roles.map(r => `<option ${f.role === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>
      <select class="input" id="ppw"><option value="">All pathways</option>${db.pathways.map(pw => `<option value="${pw.id}" ${f.pathway === pw.id ? 'selected' : ''}>${esc(pw.title)}</option>`).join('')}</select>
      <select class="input" id="pst"><option value="">Any status</option>${[['attention', 'Needs attention'], ['complete', 'Up to date'], ['due', 'Due soon'], ['progress', 'In progress'], ['none', 'Not started'], ['expired', 'Expired'], ['locked', 'Needs review']].map(([k, l]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${ev ? `<select class="input" id="prd"><option value="">Any readiness</option>${SEG.map(([k, l]) => `<option value="${k}" ${f.ready === k ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}
      ${Object.keys(PF0).some(k => f[k]) ? `<button class="btn ghost sm" id="pclear">Clear</button>` : ''}
    </div>
    ${ev ? `<div class="card" style="margin-bottom:14px;padding:16px 18px"><div class="row between" style="margin-bottom:8px"><b>${esc(ev.name)}</b><span class="small muted">${fmtDate(ev.date)}</span></div>${readyBar(readyCounts(ev), ev.id)}${readyLegend(readyCounts(ev), ev.id)}</div>` : ''}
    ${peopleTab === 'archived' ? `<div class="notice info small" style="margin-bottom:14px">${ICON.info}<div>Archived volunteers can’t sign in and never get reminders. Their records are kept for ${retentionYears()} years, then deleted automatically. Reactivating keeps anything from the last ${retentionYears()} years.</div></div>` : ''}
    <div id="plist"></div>`);
  const pager = n => { const pages = Math.max(1, Math.ceil(n / PAGE)); if (peoplePage > pages) peoplePage = pages;
    const from = n ? (peoplePage - 1) * PAGE + 1 : 0, to = Math.min(n, peoplePage * PAGE);
    const nums = [...new Set([1, peoplePage - 1, peoplePage, peoplePage + 1, pages])].filter(x => x >= 1 && x <= pages).sort((a, b) => a - b);
    return `<div class="pager"><span class="small muted">Showing <b>${from.toLocaleString('en-GB')}–${to.toLocaleString('en-GB')}</b> of <b>${n.toLocaleString('en-GB')}</b></span>${pages > 1 ? `<div class="pgs"><button class="btn ghost xs" data-pg="${peoplePage - 1}" ${peoplePage === 1 ? 'disabled' : ''}>‹ Prev</button>${nums.map((x, i) => `${i && x - nums[i - 1] > 1 ? '<span class="muted">…</span>' : ''}<button class="btn xs ${x === peoplePage ? 'red' : 'ghost'}" data-pg="${x}">${x}</button>`).join('')}<button class="btn ghost xs" data-pg="${peoplePage + 1}" ${peoplePage === pages ? 'disabled' : ''}>Next ›</button></div>` : ''}</div>`; };
  const draw = () => {
    const list = filteredPeople();
    $('#plist').innerHTML = `<div class="tablewrap"><table class="clickable"><thead><tr><th>Name</th><th>Type &amp; roles</th><th>Serving at</th><th>Training</th><th>Status</th><th></th></tr></thead><tbody>
    ${list.slice((peoplePage - 1) * PAGE, peoplePage * PAGE).map(p => { const { req, done, worst } = personSummary(p);
      return `<tr data-row="${p.id}" tabindex="0"><td><span class="person">${avatar(p)}<span><b>${esc(p.name)}</b><br><span class="tiny muted">${esc(p.email)}</span></span></span></td>
        <td><span class="typepill t-${typeOf(p)}">${typeOf(p)}</span>${p.roles.map(r => `<span class="tag">${esc(r)}</span>`).join('')}</td>
        <td>${p.eventIds.map(id => `<span class="tag nowrap">${esc(EventById(id)?.name || '')}</span>`).join('') || '<span class="muted">—</span>'}</td>
        <td style="min-width:110px"><div class="meter"><i style="width:${req.length ? done / req.length * 100 : 0}%"></i></div><span class="tiny muted">${done}/${req.length}</span></td>
        <td>${p.archived ? `<span class="chip st-none">Archived ${fmtDate(p.archivedAt)}</span>` : worst ? chip(worst) : '<span class="tiny muted">Nothing assigned</span>'}</td>
        <td class="rowacts">${p.archived ? `<button class="btn teal xs" data-react="${p.id}">Reactivate</button><button class="btn ghost xs" data-del="${p.id}" style="color:var(--red-600)">Delete</button>` : `<button class="btn ghost xs" data-remind="${p.id}" title="Send reminder email">✉️</button><button class="btn ghost xs" data-copy="${p.token}" title="Copy invite link">${ICON.link}</button><button class="btn ghost xs" data-edit="${p.id}">Edit</button>`}<span class="chev">${ICON.arrow.replace('width="18" height="18"', 'width="16" height="16"')}</span></td></tr>`;
    }).join('') || '<tr><td colspan="6" class="empty">No one matches those filters</td></tr>'}</tbody></table></div>
    ${pager(list.length)}`;
    bindCopy();
    $$('[data-row]').forEach(tr => { const open = e => { if (e.target.closest('button,a')) return; go('#/admin/people/' + tr.dataset.row); }; tr.onclick = open; tr.onkeydown = e => e.key === 'Enter' && open(e); });
    $$('[data-edit]').forEach(b => b.onclick = e => { e.stopPropagation(); personPanel(Person(b.dataset.edit)); });
    $$('[data-remind]').forEach(b => b.onclick = e => { e.stopPropagation(); sendReminder(Person(b.dataset.remind)); });
    $$('[data-pg]').forEach(b => b.onclick = () => { peoplePage = +b.dataset.pg; draw(); $('#plist').scrollIntoView({ block: 'start', behavior: 'smooth' }); });
    $$('[data-react]').forEach(b => b.onclick = e => { e.stopPropagation(); confirmReactivate(Person(b.dataset.react), renderPeople); });
    $$('[data-del]').forEach(b => b.onclick = e => { e.stopPropagation(); confirmDelete(Person(b.dataset.del), renderPeople); });
  };
  draw(); bindPf();
  const set = (k, v) => { f[k] = v; if (k === 'event') f.ready = ''; peoplePage = 1; k === 'event' ? renderPeople() : draw(); };
  $$('[data-ptab]').forEach(b => b.onclick = () => { peopleTab = b.dataset.ptab; peoplePage = 1; renderPeople(); });
  $('#pq').oninput = e => set('q', e.target.value);
  $('#pev').onchange = e => set('event', e.target.value);
  $('#prole').onchange = e => set('role', e.target.value);
  $('#pst').onchange = e => set('status', e.target.value);
  $('#ppw').onchange = e => set('pathway', e.target.value);
  $('#prd') && ($('#prd').onchange = e => set('ready', e.target.value));
  $('#pclear') && ($('#pclear').onclick = () => { peopleFilter = { ...PF0 }; renderPeople(); });
  $('#addp').onclick = () => personPanel();
  $('#imp').onclick = importPeople;
  $('#prem').onclick = openSendReminders;
  $('#pprint').onclick = () => printPeopleList(filteredPeople());
  $('#pmail').onclick = () => { const ppl = filteredPeople().filter(p => !p.archived); const ev = peopleFilter.event && EventById(peopleFilter.event); composeEmail(ppl, { title: 'Email this list', ctxFor: ev ? () => ({ event: ev }) : () => ({}), note: `Sending to the ${ppl.length} people in your current People view.` }); };
}

/* ---------- person side panel (add / edit) ---------- */
function closeDrawer() { const d = $('#drawer'); if (!d) return; d.classList.add('out'); setTimeout(() => d.remove(), 220); }
function personPanel(p, section = 'details') {
  const isNew = !p; const orig = p;
  const w = JSON.parse(JSON.stringify(p || { name: '', email: '', phone: '', org: '', type: 'volunteer', roles: [], eventIds: [], notes: '', accessNI: { status: 'not_requested', date: '' } }));
  w.type = w.type || typeOf(w); w.accessNI = w.accessNI || { status: 'not_requested', date: '' };
  const wasOpen = !!$('#drawer'); $('#drawer')?.remove();
  const d = document.createElement('div'); d.id = 'drawer'; d.className = 'drawer-wrap' + (wasOpen ? ' instant' : ''); document.body.appendChild(d);
  const SECTIONS = [['details', 'Details'], ['serving', 'Roles & events'], ['checks', 'Checks & notes'], ...(isNew ? [] : [['training', 'Training'], ['account', 'Account']])];
  const read = () => {
    const g = id => $('#' + id, d);
    if (g('dn')) { w.name = g('dn').value.trim(); w.email = g('de').value.trim(); w.phone = g('dp').value.trim(); w.org = g('do').value.trim(); }
    if (g('dnotes')) { w.notes = g('dnotes').value; w.accessNI = { status: g('dani').value, date: g('danid').value }; }
    if ($('[name=dr]', d)) { w.roles = $$('[name=dr]:checked', d).map(x => x.value); w.eventIds = $$('[name=dv]:checked', d).map(x => x.value); }
  };
  const preview = () => { const r = requiredPathwaysFor(w); return `<div class="notice ${r.length ? 'info' : 'warn'} small">${ICON.info}<div>${r.length ? `Will be asked to complete <b>${r.map(x => esc(x.title)).join('</b> and <b>')}</b>` : 'No training assigned yet — choose a role or an event.'}</div></div>`; };
  const ANI = [['not_requested', 'Not requested yet'], ['applied', 'Applied — waiting'], ['cleared', 'Cleared'], ['not_required', 'Not required for this role']];
  const body = {
    details: () => `<div class="field"><label class="f">Full name</label><input class="input" id="dn" value="${esc(w.name)}" placeholder="e.g. Sam Irwin"></div>
      <div class="grid g2"><div class="field"><label class="f">Email</label><input class="input" id="de" type="email" value="${esc(w.email)}"></div><div class="field"><label class="f">Phone <span class="muted" style="font-weight:600">(optional)</span></label><input class="input" id="dp" value="${esc(w.phone || '')}"></div></div>
      <div class="field"><label class="f">Type</label><div class="seg" id="dtype">${TYPES.map(([k, l]) => `<button type="button" data-t="${k}" class="${w.type === k ? 'on' : ''}">${l.replace(/s$/, '')}</button>`).join('')}</div><div class="help">“Other” is for trustees, partner church leaders, contractors and similar.</div></div>
      <div class="field"><label class="f">Church or organisation <span class="muted" style="font-weight:600">(optional)</span></label><input class="input" id="do" value="${esc(w.org || '')}" placeholder="e.g. Grace Baptist, Tullycarnet"></div>`,
    serving: () => `<div class="field"><label class="f">Roles</label><div class="checks">${db.roles.map(r => `<label><input type="checkbox" name="dr" value="${esc(r)}" ${w.roles.includes(r) ? 'checked' : ''}>${esc(r)}</label>`).join('')}</div></div>
      <div class="field"><label class="f">Serving at</label><div class="evpick">${[...db.events].sort((a, b) => a.date.localeCompare(b.date)).map(e => `<label><input type="checkbox" name="dv" value="${e.id}" ${w.eventIds.includes(e.id) ? 'checked' : ''}><span><b>${esc(e.name)}</b><span class="tiny muted">${fmtDate(e.date)} · ${esc(e.location || '')} · needs ${e.requiredPathways.map(id => esc(P(id)?.title || '')).join(' + ')}</span></span></label>`).join('')}</div></div>
      <div id="dprev">${preview()}</div>`,
    checks: () => `<div class="field"><label class="f">AccessNI check</label><div class="grid g2"><select class="input" id="dani">${ANI.map(([k, l]) => `<option value="${k}" ${w.accessNI.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select><input class="input" type="date" id="danid" value="${esc(w.accessNI.date || '')}" title="Date cleared"></div><div class="help">Record the status and date only — don’t store certificate numbers here.</div></div>
      <div class="field"><label class="f">Internal notes</label><textarea class="input" id="dnotes" style="min-height:140px" placeholder="Only admins can see these. Keep them factual.">${esc(w.notes || '')}</textarea></div>`,
    training: () => { const pp = orig; const req = requiredPathwaysFor(pp);
      return req.length ? req.map(pw => { const st = statusOf(pp, pw); const pr = prog(pp.id, pw.id); const locked = pw.steps.some(s => s.type === 'quiz' && quizLocked(pr, s)); const cur = latestCompletion(pp.id, pw.id);
        return `<div class="dtrain"><div class="row between"><b>${esc(pw.title)}</b>${chip(st)}</div>
          <div class="tiny muted" style="margin:3px 0 10px">${cur ? `Certificate ${esc(cur.id)} · valid until ${fmtDate(cur.expiresAt)}` : 'No current certificate'}</div>
          <div class="row" style="gap:6px">
            ${locked ? `<button class="btn red xs" data-dun="${pw.id}">Reopen quiz</button>` : ''}
            <button class="btn ghost xs" data-dmc="${pw.id}">Record completion…</button>
            ${cur ? `<button class="btn ghost xs" data-dce="${cur.id}">Change expiry…</button><button class="btn ghost xs" data-dcr="${cur.id}">Reissue…</button><button class="btn ghost xs" data-dcv="${cur.id}" style="color:var(--red-600)">Revoke…</button>` : ''}
            <button class="btn ghost xs" data-drs="${pw.id}" style="color:var(--red-600)">Reset training…</button></div></div>`; }).join('') + `<p class="tiny muted">Each change asks for a reason and is recorded in the audit log.</p>`
        : '<div class="empty">No training assigned — add a role or event first.</div>'; },
    account: () => `<div class="dtrain"><b>Invite link</b><div class="tiny muted" style="margin:3px 0 10px">Send this to ${esc(firstName(w.name))} so they can do their training. Generating a new one stops the old link working.</div>
        <div class="row" style="gap:6px"><button class="btn ghost xs" data-copy="${orig.token}">${ICON.link} Copy sign-in link</button><button class="btn ghost xs" id="dnewtok">Generate new link</button><a class="btn ghost xs" href="#/preview/${orig.id}">Preview as ${esc(firstName(w.name))}</a></div></div>
      ${orig.archived ? `<div class="dtrain" style="border-color:#BFE3DC"><b>Reactivate ${esc(firstName(w.name))}</b><div class="tiny muted" style="margin:3px 0 10px">Archived ${fmtDate(orig.archivedAt)}. Reactivating lets them sign in and get reminders again. Records from the last ${retentionYears()} years are kept; older ones are removed.</div><button class="btn teal xs" id="dreact">Reactivate…</button></div>`
        : `<div class="dtrain" style="border-color:#F1D3D6"><b>Archive ${esc(firstName(w.name))}</b><div class="tiny muted" style="margin:3px 0 10px">For people who’ve stopped serving. They can’t sign in, won’t get reminders and drop out of lists — but their records are kept for ${retentionYears()} years for safeguarding audits.</div><button class="btn ghost xs" id="darch" style="color:var(--red-600)">Archive</button></div>`}
      <div class="dtrain" style="border-color:#F1D3D6"><b>Delete permanently</b><div class="tiny muted" style="margin:3px 0 10px">Only for erasure requests or mistakes. Erases everything, including their audit trail.</div><button class="btn ghost xs" id="ddel" style="color:var(--red-600)">Delete…</button></div>`,
  };
  const head = () => `<div class="person" style="gap:12px">${w.name ? `<span class="avatar" style="width:44px;height:44px;font-size:16px;background:${avatarColour(w.name)}">${initials(w.name)}</span>` : ''}<div><div class="eyebrow">${isNew ? 'New person' : 'Edit person'}</div><h2 style="margin-top:2px">${esc(w.name || 'Add someone')}</h2></div></div>`;
  // shell is built once — switching sections only swaps the body, so nothing re-animates
  d.innerHTML = `<div class="drawer-scrim"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="${isNew ? 'Add person' : 'Edit ' + esc(w.name)}">
      <header><div id="dhead">${head()}</div><button class="iconbtn" data-dclose>${ICON.x}</button></header>
      <nav class="dnav">${SECTIONS.map(([k, l]) => `<button data-ds="${k}">${l}</button>`).join('')}</nav>
      <div class="dbody"></div>
      <footer><button class="btn ghost" data-dclose>Cancel</button><button class="btn red" id="dsave">${isNew ? 'Add person & copy invite link' : 'Save changes'}</button></footer></aside>`;
  $$('[data-dclose]', d).forEach(b => b.onclick = closeDrawer); $('.drawer-scrim', d).onclick = closeDrawer;
  $$('[data-ds]', d).forEach(b => b.onclick = () => { if (b.dataset.ds === section) return; read(); section = b.dataset.ds; render(); });
  d.addEventListener('change', e => { if (e.target.name === 'dr' || e.target.name === 'dv') { read(); $('#dprev', d) && ($('#dprev', d).innerHTML = preview()); } });
  d.addEventListener('input', e => { if (e.target.id === 'dn') { w.name = e.target.value; $('#dhead', d).innerHTML = head(); } });
  $('#dsave', d).onclick = () => save();
  const render = () => {
    $$('[data-ds]', d).forEach(b => { const on = b.dataset.ds === section; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    const bodyEl = $('.dbody', d); bodyEl.innerHTML = body[section](); bodyEl.scrollTop = 0;
    $$('[data-t]', d).forEach(b => b.onclick = () => { w.type = b.dataset.t; $$('[data-t]', d).forEach(x => x.classList.toggle('on', x === b)); });
    bindCopy();
    const C = id => db.completions.find(c => c.id === id), pw = id => P(id);
    const after = () => setTimeout(() => { if (Person(orig.id)) personPanel(Person(orig.id), 'training'); }, 50);
    const wrap = fn => () => { fn(); watchModalClose(after); };
    $$('[data-dmc]', d).forEach(b => b.onclick = wrap(() => manualComplete(orig, pw(b.dataset.dmc))));
    $$('[data-drs]', d).forEach(b => b.onclick = wrap(() => resetTraining(orig, pw(b.dataset.drs))));
    $$('[data-dce]', d).forEach(b => b.onclick = wrap(() => editCert(C(b.dataset.dce))));
    $$('[data-dcr]', d).forEach(b => b.onclick = wrap(() => reissueCert(C(b.dataset.dcr))));
    $$('[data-dcv]', d).forEach(b => b.onclick = wrap(() => revokeCert(C(b.dataset.dcv))));
    $$('[data-dun]', d).forEach(b => b.onclick = () => { const x = pw(b.dataset.dun), pr = prog(orig.id, x.id); x.steps.filter(s => s.type === 'quiz' && quizLocked(pr, s)).forEach(s => pr.steps[s.id].attempts.forEach(a => { if (!a.passed) a.voided = true; })); audit({ actor: 'admin', action: 'quiz_unlocked', personId: orig.id, pathwayId: x.id, version: x.version, detail: { name: orig.name, note: 'Reopened from edit panel' } }); toast('Quiz reopened'); route(); personPanel(orig, 'training'); });
    $('#dnewtok', d) && ($('#dnewtok', d).onclick = e => { if (!confirmInline(e.currentTarget, 'Click again — old link stops working')) return; orig.token = uid('inv-'); audit({ actor: 'admin', action: 'person_updated', personId: orig.id, detail: { name: orig.name, changes: ['invite link regenerated'] } }); toast('New invite link created'); personPanel(orig, 'account'); route(); });
    $('#darch', d) && ($('#darch', d).onclick = e => { if (!confirmInline(e.currentTarget, 'Click again to archive')) return; archiveVolunteer(orig); toast(`${orig.name} archived — records kept`); closeDrawer(); route(); });
    $('#dreact', d) && ($('#dreact', d).onclick = () => { closeDrawer(); confirmReactivate(orig); });
    $('#ddel', d) && ($('#ddel', d).onclick = () => { closeDrawer(); confirmDelete(orig); });
    setTimeout(() => $('.dbody input, .dbody textarea', d)?.focus(), 60);
  };
  const save = async () => {
    read();
    if (!w.name || !/\S+@\S+\.\S+/.test(w.email)) { toast('Please add a name and a valid email'); if (section !== 'details') { section = 'details'; render(); } return; }
    const clash = db.people.find(x => x.email.toLowerCase() === w.email.toLowerCase() && x !== orig); if (clash) { toast(`${clash.name} already uses that email`); return; }
    const fields = ['name', 'email', 'phone', 'org', 'type', 'roles', 'eventIds', 'notes', 'accessNI'];
    if (isNew) {
      const np = { id: uid('u_'), token: uid('inv-'), createdAt: now(), ...Object.fromEntries(fields.map(k => [k, w[k]])) }; db.people.push(np);
      audit({ actor: 'admin', action: 'person_added', personId: np.id, detail: { name: np.name, type: np.type, roles: np.roles, events: np.eventIds } });
      if (requiredPathwaysFor(np).length) autoEmail('assigned', np, { event: np.eventIds.map(EventById)[0], key: 'new' });
      try { await navigator.clipboard.writeText(location.href.split('#')[0] + '#/i/' + np.token); toast('Added — invite link copied'); } catch { toast('Added'); }
      closeDrawer(); go('#/admin/people/' + np.id); return;
    }
    const changes = fields.filter(k => JSON.stringify(orig[k] ?? '') !== JSON.stringify(w[k] ?? '')).map(k => k === 'notes' ? 'notes' : k === 'eventIds' ? 'events' : k);
    if (!changes.length) { closeDrawer(); return; }
    fields.forEach(k => orig[k] = w[k]);
    audit({ actor: 'admin', action: 'person_updated', personId: orig.id, detail: { name: orig.name, changes } });
    toast('Saved'); closeDrawer(); route();
  };
  render();
}
function watchModalClose(cb) { const t = setInterval(() => { if (!$('#scrim')) { clearInterval(t); cb(); } }, 120); }

const personForm = p => personPanel(p);
function confirmInline(btn, msg) { if (btn.dataset.armed) return true; btn.dataset.armed = 1; const t = btn.innerHTML; btn.innerHTML = msg; setTimeout(() => { if (btn.isConnected) { btn.innerHTML = t; delete btn.dataset.armed; } }, 3000); return false; }
function parseCSV(t) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.map(r => r.map(x => x.replace(/^﻿/, '')));
}

/* ---------- branded print documents (A4 portrait) ---------- */
function printDoc(title, subtitle, inner, { confidential = true } = {}) {
  $('#printdoc')?.remove();
  const d = document.createElement('div'); d.id = 'printdoc';
  d.innerHTML = `<div class="pd-head"><div class="pd-logo">${LOGO(46)}</div><div class="pd-title"><div class="pd-eyebrow">Safeguarding training</div><h1>${title}</h1>${subtitle ? `<div class="pd-sub">${subtitle}</div>` : ''}</div></div>
    <div class="pd-bar"></div>${inner}
    <div class="pd-foot"><span>Generated ${fmtDT(now())} by ${esc(db.settings.adminName)}</span><span>${confidential ? 'CONFIDENTIAL — contains personal data. Store securely and destroy when no longer needed.' : ''}</span><span>Scripture Union Northern Ireland · NIC104852</span></div>`;
  document.body.appendChild(d); document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); d.remove(); removeEventListener('afterprint', done); };
  addEventListener('afterprint', done);
  setTimeout(() => print(), 60);
}
const pdChip = st => `<span class="pd-chip pd-${st.key}">${esc(st.key === 'complete' ? 'Complete' : st.label.replace(/ ·.*/, ''))}</span>`;
function printRecord(p) {
  const req = requiredPathwaysFor(p); const certs = db.completions.filter(c => c.personId === p.id).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const atts = attemptsFor(p); const log = db.audit.filter(a => a.personId === p.id).slice().reverse();
  const ANI = { not_requested: 'Not requested', applied: 'Applied — awaiting', cleared: 'Cleared', not_required: 'Not required' };
  printDoc(esc(p.name), `Training record · ${esc(p.email)}`, `
    <div class="pd-grid">
      <div><b>Type</b>${esc(typeOf(p))}</div><div><b>Roles</b>${esc(p.roles.join(', ') || '—')}</div>
      <div><b>Serving at</b>${esc(p.eventIds.map(id => EventById(id)?.name).filter(Boolean).join(', ') || '—')}</div>
      <div><b>AccessNI</b>${esc(ANI[p.accessNI?.status] || 'Not recorded')}${p.accessNI?.date ? ` · ${fmtDate(p.accessNI.date)}` : ''}</div>
      <div><b>Church / organisation</b>${esc(p.org || '—')}</div><div><b>Record status</b>${p.archived ? 'Archived' : 'Active'}</div>
    </div>
    <h2>Required training</h2>
    <table class="pd-table"><thead><tr><th>Pathway</th><th>Status</th><th>Completed</th><th>Valid until</th><th>Version</th><th>Score</th><th>Certificate</th></tr></thead><tbody>
      ${req.map(pw => { const st = statusOf(p, pw), c = st.c; return `<tr><td><b>${esc(pw.title)}</b></td><td>${pdChip(st)}</td><td>${c ? fmtDate(c.completedAt) : '—'}</td><td>${c ? fmtDate(c.expiresAt) : '—'}</td><td>${c ? 'v' + c.version : '—'}</td><td>${c?.score != null ? c.score + '%' : c?.manual ? 'Recorded' : '—'}</td><td class="mono">${c ? esc(c.id) : '—'}</td></tr>`; }).join('') || '<tr><td colspan="7">No training assigned</td></tr>'}
    </tbody></table>
    ${certs.length ? `<h2>Certificate history</h2><table class="pd-table"><thead><tr><th>Certificate</th><th>Pathway</th><th>Completed</th><th>Expiry</th><th>How</th><th>Status</th></tr></thead><tbody>
      ${certs.map(c => `<tr><td class="mono">${esc(c.id)}</td><td>${esc(c.pathwayTitle)} v${c.version}</td><td>${fmtDate(c.completedAt)}</td><td>${fmtDate(c.expiresAt)}</td><td>${c.manual ? esc(c.manual.method) : `Online · signed “${esc(c.attestationName)}”`}</td><td>${c.revoked ? (c.revoked.replacedBy ? 'Replaced' : 'Revoked') + ` — ${esc(c.revoked.reason)}` : new Date(c.expiresAt) > new Date() ? 'Valid' : 'Expired'}</td></tr>`).join('')}</tbody></table>` : ''}
    ${atts.length ? `<h2>Quiz attempts</h2><table class="pd-table"><thead><tr><th>Date</th><th>Pathway</th><th>Score</th><th>Result</th><th>Questions missed</th></tr></thead><tbody>
      ${atts.map(x => `<tr><td>${fmtDT(x.a.at)}</td><td>${esc(x.pw.title)}</td><td>${x.a.score}%</td><td>${x.a.passed ? 'Pass' : x.a.voided ? 'Not passed (reset)' : 'Not passed'}</td><td class="small">${(x.a.questions || []).filter(q => !q.correct).map(q => esc(q.text)).join('<br>') || '—'}</td></tr>`).join('')}</tbody></table>` : ''}
    ${p.notes ? `<h2>Internal notes</h2><div class="pd-note">${esc(p.notes).replace(/\n/g, '<br>')}</div>` : ''}
    <h2>Activity</h2><table class="pd-table pd-log"><tbody>${log.slice(0, 40).map(a => `<tr><td class="nowrap">${fmtDT(a.at)}</td><td>${auditText(a).replace(/<(?!\/?b>|br>)[^>]+>/g, '')}</td></tr>`).join('') || '<tr><td>No activity</td></tr>'}</tbody></table>
    <div class="pd-sign"><div>Reviewed by<span></span></div><div>Signature<span></span></div><div>Date<span></span></div></div>`);
}
function printPeopleList(list) {
  const f = peopleFilter; const bits = [peopleTab !== 'all' ? (peopleTab === 'archived' ? 'Archived' : TYPES.find(t => t[0] === peopleTab)?.[1]) : 'Everyone', f.event && EventById(f.event)?.name, f.role, f.pathway && P(f.pathway)?.title, f.status && `status: ${f.status}`, f.q && `“${f.q}”`].filter(Boolean);
  printDoc('Training register', `${list.length} ${list.length === 1 ? 'person' : 'people'} · ${esc(bits.join(' · '))}`, `
    <table class="pd-table"><thead><tr><th>Name</th><th>Type / roles</th>${db.pathways.map(pw => `<th>${esc(pw.title)}</th>`).join('')}<th>Next expiry</th></tr></thead><tbody>
    ${list.map(p => { const req = requiredPathwaysFor(p); const next = req.map(pw => latestCompletion(p.id, pw.id)?.expiresAt).filter(Boolean).sort()[0];
      return `<tr><td><b>${esc(p.name)}</b><br><span class="small">${esc(p.email)}</span></td><td class="small">${esc(typeOf(p))}<br>${esc(p.roles.join(', '))}</td>${db.pathways.map(pw => `<td>${req.includes(pw) ? pdChip(statusOf(p, pw)) : '<span class="small">n/a</span>'}</td>`).join('')}<td>${next ? fmtDate(next) : '—'}</td></tr>`; }).join('')}
    </tbody></table>`);
}
function printRoster(ev) {
  const ppl = live().filter(p => p.eventIds.includes(ev.id)).sort((a, b) => a.name.localeCompare(b.name)); const c = readyCounts(ev);
  const L = { ready: 'Ready', renew: 'Needs refresher', todo: 'Not trained' };
  printDoc(esc(ev.name), `Team safeguarding roster · ${fmtDate(ev.date)}${ev.endDate && ev.endDate !== ev.date ? ' – ' + fmtDate(ev.endDate) : ''} · ${esc(ev.location || '')}`, `
    <div class="pd-grid pd-3"><div><b>Ready</b><span class="pd-big" style="color:#239084">${c.ready}</span></div><div><b>Needs refresher</b><span class="pd-big" style="color:#C2850E">${c.renew}</span></div><div><b>Not trained</b><span class="pd-big" style="color:#D63744">${c.todo}</span></div></div>
    <p class="small">Required training: ${ev.requiredPathways.map(id => esc(P(id)?.title || '')).join(', ')}. “Ready” means every certificate is valid until the end of the event.</p>
    <table class="pd-table"><thead><tr><th>Name</th><th>Role</th><th>Readiness</th>${ev.requiredPathways.map(id => `<th>${esc(P(id)?.title || '')} — valid until</th>`).join('')}<th>✓ on site</th></tr></thead><tbody>
    ${ppl.map(p => { const s = eventState(p, ev); return `<tr><td><b>${esc(p.name)}</b></td><td class="small">${esc(p.roles.join(', '))}</td><td><span class="pd-chip pd-${s === 'ready' ? 'complete' : s === 'renew' ? 'due' : 'expired'}">${L[s]}</span></td>${ev.requiredPathways.map(id => { const lc = latestCompletion(p.id, id); return `<td>${lc ? fmtDate(lc.expiresAt) : '—'}</td>`; }).join('')}<td class="pd-box"></td></tr>`; }).join('')}
    </tbody></table>`);
}

/* ---------- admin record management (every change needs a reason and is audited) ---------- */
const isoDate = d => new Date(d).toISOString().slice(0, 10);
function changeModal({ title, intro = '', fields = '', confirm = 'Save change', danger = false, onConfirm }) {
  const s = modal(`<header><h2>${title}</h2><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body">${intro ? `<p class="muted" style="margin-top:0">${intro}</p>` : ''}${fields}
      <div class="field"><label class="f">Reason for this change <span class="muted" style="font-weight:600">(required — kept in the audit log)</span></label><textarea class="input" id="cm-reason" style="min-height:70px" placeholder="e.g. Attended in-person training at church on 3 March; certificate seen"></textarea></div></div>
    <footer><button class="btn ghost" data-close>Cancel</button><button class="btn ${danger ? 'red' : 'teal'}" id="cm-go">${confirm}</button></footer>`);
  $('#cm-go', s).onclick = () => {
    const reason = $('#cm-reason', s).value.trim(); if (reason.length < 4) { toast('Please give a reason'); $('#cm-reason', s).focus(); return; }
    if (onConfirm(reason, s) !== false) { closeModal(); route(); }
  };
}
function manualComplete(p, pw) {
  const today = isoDate(now());
  changeModal({ title: `Record completion — ${esc(pw.title)}`, intro: `Use this when ${esc(firstName(p.name))} has done equivalent training elsewhere, or attended an in-person session. A certificate will be issued and marked as recorded by an admin.`,
    fields: `<div class="grid g2"><div class="field"><label class="f">Completed on</label><input class="input" type="date" id="mc-date" value="${today}" max="${today}"></div>
      <div class="field"><label class="f">Valid until</label><input class="input" type="date" id="mc-exp" value="${pw.validityMonths > 0 ? isoDate(addMonths(now(), pw.validityMonths)) : ''}" placeholder="No expiry"><div class="help">Leave blank for no expiry.</div></div></div>
      <div class="field"><label class="f">How was it completed?</label><select class="input" id="mc-how">${['In-person SUNI training session', 'Training with another organisation (e.g. thirtyone:eight, church, school)', 'Equivalent certificate seen', 'Other'].map(o => `<option>${o}</option>`).join('')}</select></div>`,
    confirm: 'Record completion & issue certificate',
    onConfirm: (reason, s) => {
      const at = new Date($('#mc-date', s).value + 'T12:00:00').toISOString(), exp = $('#mc-exp', s).value ? new Date($('#mc-exp', s).value + 'T12:00:00').toISOString() : NO_EXPIRY;
      if (exp <= at) { toast('Expiry must be after completion'); return false; }
      const c = { id: certNumber(at), personId: p.id, pathwayId: pw.id, pathwayTitle: pw.title, version: pw.version, completedAt: at, expiresAt: exp, score: null, attestationName: 'Recorded by admin', attestationText: '', manual: { method: $('#mc-how', s).value, reason, by: db.settings.adminName, at: now() }, edits: [] };
      db.completions.push(c); db.progress[p.id] && (db.progress[p.id][pw.id] = { steps: {}, startedAt: null });
      audit({ actor: 'admin', action: 'completion_recorded', personId: p.id, pathwayId: pw.id, version: pw.version, detail: { name: p.name, certId: c.id, completedAt: at, expiresAt: exp, method: c.manual.method, reason } });
      toast('Completion recorded — certificate issued');
    } });
}
function resetTraining(p, pw) {
  const cur = latestCompletion(p.id, pw.id);
  changeModal({ title: `Reset training — ${esc(pw.title)}`, intro: `Clears ${esc(firstName(p.name))}’s progress (videos watched, readings, quiz attempts) so they start this pathway again. Their history stays in the audit log.`,
    fields: `<div class="field"><label class="f">What should happen to their certificate?</label><div class="stack">
      <label class="radiorow"><input type="radio" name="rs" value="keep" checked><span><b>Keep it</b><br><span class="small muted">${cur ? `${esc(cur.id)} stays valid until ${fmtDate(cur.expiresAt)}` : 'They don’t have a current certificate'}</span></span></label>
      ${cur ? `<label class="radiorow"><input type="radio" name="rs" value="revoke"><span><b>Revoke it</b><br><span class="small muted">They’ll need to complete the training again before they count as trained</span></span></label>` : ''}</div></div>`,
    confirm: 'Reset training', danger: true,
    onConfirm: (reason, s) => {
      const mode = $('[name=rs]:checked', s)?.value || 'keep';
      (db.progress[p.id] ??= {})[pw.id] = { steps: {}, startedAt: null };
      if (mode === 'revoke' && cur) cur.revoked = { at: now(), by: db.settings.adminName, reason };
      audit({ actor: 'admin', action: 'training_reset', personId: p.id, pathwayId: pw.id, version: pw.version, detail: { name: p.name, certificate: mode === 'revoke' && cur ? `revoked ${cur.id}` : 'kept', reason } });
      toast(mode === 'revoke' ? 'Training reset and certificate revoked' : 'Training reset');
    } });
}
function editCert(c) {
  const p = Person(c.personId);
  changeModal({ title: `Edit certificate ${esc(c.id)}`, intro: `${esc(p?.name || '')} · ${esc(c.pathwayTitle)} v${c.version}, completed ${fmtDate(c.completedAt)}.`,
    fields: `<div class="grid g2"><div class="field"><label class="f">Valid until</label><input class="input" type="date" id="ec-exp" value="${isoDate(c.expiresAt)}" min="${isoDate(c.completedAt)}"></div>
      <div class="field"><label class="f">Name shown on certificate</label><input class="input" id="ec-name" value="${esc(c.nameOnCert || p?.name || '')}"></div></div>
      <div class="help" style="margin:-6px 0 14px">Changing the completion date or quiz score isn’t allowed — reset the training or record a new completion instead.</div>`,
    onConfirm: (reason, s) => {
      const exp = new Date($('#ec-exp', s).value + 'T12:00:00').toISOString(), nm = $('#ec-name', s).value.trim();
      const changes = [];
      if (isoDate(exp) !== isoDate(c.expiresAt)) changes.push({ field: 'expiry', from: isoDate(c.expiresAt), to: isoDate(exp) });
      if (nm && nm !== (c.nameOnCert || p?.name)) changes.push({ field: 'name', from: c.nameOnCert || p?.name, to: nm });
      if (!changes.length) { toast('Nothing changed'); return false; }
      changes.forEach(ch => { if (ch.field === 'expiry') c.expiresAt = exp; if (ch.field === 'name') c.nameOnCert = nm; });
      (c.edits ??= []).push({ at: now(), by: db.settings.adminName, reason, changes });
      audit({ actor: 'admin', action: 'certificate_edited', personId: c.personId, pathwayId: c.pathwayId, detail: { name: p?.name, certId: c.id, changes, reason } });
      toast('Certificate updated');
    } });
}
function revokeCert(c, reinstate) {
  const p = Person(c.personId);
  changeModal({ title: `${reinstate ? 'Reinstate' : 'Revoke'} certificate ${esc(c.id)}`, intro: reinstate ? 'The certificate will count again and show as valid when checked.' : `${esc(p?.name || '')} will no longer count as trained for ${esc(c.pathwayTitle)}. Anyone scanning the certificate will see it’s been revoked.`,
    confirm: reinstate ? 'Reinstate' : 'Revoke certificate', danger: !reinstate,
    onConfirm: reason => {
      if (reinstate) { (c.edits ??= []).push({ at: now(), by: db.settings.adminName, reason, changes: [{ field: 'status', from: 'revoked', to: 'reinstated' }] }); c.revoked = null; }
      else c.revoked = { at: now(), by: db.settings.adminName, reason };
      audit({ actor: 'admin', action: reinstate ? 'certificate_reinstated' : 'certificate_revoked', personId: c.personId, pathwayId: c.pathwayId, detail: { name: p?.name, certId: c.id, reason } });
      toast(reinstate ? 'Certificate reinstated' : 'Certificate revoked');
    } });
}
function reissueCert(c) {
  const p = Person(c.personId);
  changeModal({ title: `Reissue certificate`, intro: `Creates a new certificate ID with the same details (e.g. lost certificate or a name change). ${esc(c.id)} will be marked as replaced.`,
    fields: `<div class="field"><label class="f">Name shown on new certificate</label><input class="input" id="ri-name" value="${esc(c.nameOnCert || p?.name || '')}"></div>`, confirm: 'Reissue',
    onConfirm: (reason, s) => {
      const n = { ...JSON.parse(JSON.stringify(c)), id: certNumber(now()), nameOnCert: $('#ri-name', s).value.trim() || undefined, edits: [{ at: now(), by: db.settings.adminName, reason, changes: [{ field: 'reissued', from: c.id, to: 'this certificate' }] }], revoked: null, reissuedFrom: c.id };
      c.revoked = { at: now(), by: db.settings.adminName, reason: `Replaced by ${n.id}`, replacedBy: n.id };
      db.completions.push(n);
      audit({ actor: 'admin', action: 'certificate_reissued', personId: c.personId, pathwayId: c.pathwayId, detail: { name: p?.name, from: c.id, to: n.id, reason } });
      toast(`Reissued as ${n.id}`);
    } });
}

/* ---------- follow-up page (after 3 failed attempts) ---------- */
function lockInfo(p, pw) {
  const pr = prog(p.id, pw.id); const step = pw.steps.find(st => st.type === 'quiz' && quizLocked(pr, st)); if (!step) return null;
  const atts = attemptsFor(p).filter(x => x.pw === pw && !x.cert && !x.a.voided).reverse();
  const lockedAt = db.audit.filter(a => a.personId === p.id && a.action === 'quiz_locked' && a.pathwayId === pw.id).pop()?.at || atts.at(-1)?.a.at;
  const due = lockedAt ? addWorkingDays(lockedAt, db.settings.followUpDays || 5) : null;
  return { step, atts, lockedAt, due, overdue: due && new Date(due) < new Date() };
}
function renderFollowUp(pid, pwid) {
  const p = Person(pid), pw = P(pwid); if (!p || !pw) return go('#/admin/people');
  const L = lockInfo(p, pw);
  if (!L) { adminShell('people', pageHead(`<a href="#/admin/people">People</a> / <a href="#/admin/people/${p.id}">${esc(p.name)}</a> / Follow-up`, 'No follow-up needed', `${esc(p.name)}’s ${esc(pw.title)} quiz isn’t locked.`, `<a class="btn ghost sm" href="#/admin/people/${p.id}">Back to record</a>`)); return; }
  const { step, atts, lockedAt, due, overdue } = L;
  // questions missed, with every wrong answer they gave and the bank's explanation
  const missed = {}; atts.forEach((x, i) => x.a.questions.forEach(q => { if (!q.correct) { (missed[q.text] ??= { q, n: 0, answers: [], att: [] }); missed[q.text].n++; missed[q.text].answers.push(q.chosen); missed[q.text].att.push(i + 1); } }));
  const list = Object.values(missed).sort((a, b) => b.n - a.n);
  const bankQ = t => step.questions.find(q => q.text === t);
  adminShell('people', pageHead(`<a href="#/admin/people">People</a> / <a href="#/admin/people/${p.id}">${esc(p.name)}</a> / Follow-up`, `Follow-up: ${esc(firstName(p.name))}’s quiz`,
    `${esc(pw.title)} · ${esc(step.title)} · locked ${fmtDT(lockedAt)}`, `<a class="btn ghost sm" href="#/admin/people/${p.id}" data-back="#/admin/people/${p.id}">${ICON.back} Back</a>`) + `
    <div class="fu">
      <div class="fu-main">
        <div class="fu-summary">
          <div><span class="tiny muted">Attempts</span><b>${atts.map(x => `<span style="color:var(--red-600)">${x.a.score}%</span>`).join(' · ')}</b><span class="tiny muted">pass mark ${step.passMark}%</span></div>
          <div><span class="tiny muted">Questions missed</span><b>${list.length}</b><span class="tiny muted">${list.filter(m => m.n > 1).length} missed more than once</span></div>
          <div class="${overdue ? 'od' : ''}"><span class="tiny muted">Promised contact by</span><b>${fmtDate(due)}</b><span class="tiny ${overdue ? '' : 'muted'}">${overdue ? 'Overdue' : `${db.settings.followUpDays || 5} working days after locking`}</span></div>
        </div>
        <h3 style="margin:26px 0 4px">Talk these through</h3><p class="small muted" style="margin:0 0 12px">Ordered by how often ${esc(firstName(p.name))} got them wrong.</p>
        ${list.map(m => { const bq = bankQ(m.q.text); return `<div class="fu-q">
          <div class="row between" style="align-items:flex-start;gap:14px"><b style="font-size:16.5px;line-height:1.35">${esc(m.q.text)}</b><span class="missbadge">Missed ${m.n}×</span></div>
          <div class="fu-ans"><div><span class="tiny muted">${esc(firstName(p.name))} answered</span>${[...new Set(m.answers)].map(a => `<div class="wrong">✗ ${esc(a)} <span class="tiny muted">(attempt ${m.att.filter((_, i) => m.answers[i] === a).join(', ')})</span></div>`).join('')}</div>
          <div><span class="tiny muted">Correct answer</span><div class="right">✓ ${esc(m.q.answer || (bq ? bq.options[bq.correct] : ''))}</div></div></div>
          ${bq?.explanation ? `<div class="fu-exp"><b>Key point:</b> ${esc(bq.explanation)}</div>` : ''}</div>`; }).join('') || '<div class="card empty">No question detail recorded.</div>'}
        <h3 style="margin:26px 0 10px">All attempts</h3>
        ${atts.map((x, i) => `<details class="fu-att"><summary><span class="an">Attempt ${i + 1}</span><span class="ad">${fmtDT(x.a.at)}</span><span class="abar"><i style="width:${x.a.score}%;background:var(--red)"></i><em style="left:${step.passMark}%"></em></span><b style="color:var(--red-600)">${x.a.score}%</b><span class="tiny muted" style="margin-left:auto">${x.a.questions.filter(q => !q.correct).length} of ${x.a.questions.length} wrong</span></summary>
          <table><tbody>${x.a.questions.map((q, k) => `<tr><td class="tiny muted">Q${k + 1}</td><td>${q.correct ? '<span style="color:var(--teal);font-weight:800">✓</span>' : '<span style="color:var(--red);font-weight:800">✗</span>'}</td><td><b>${esc(q.text)}</b><div class="small" style="margin-top:3px">${q.correct ? `<span style="color:var(--teal)">${esc(q.chosen)}</span>` : `<span style="color:var(--red-600)">${esc(q.chosen)}</span> <span class="muted">→ correct: ${esc(q.answer || '')}</span>`}</div></td></tr>`).join('')}</tbody></table></details>`).join('')}
      </div>
      <aside class="fu-side">
        <div class="card">
          <div class="person" style="gap:12px;margin-bottom:12px">${avatar(p).replace('avatar"', 'avatar" style="width:44px;height:44px;font-size:16px;background:' + avatarColour(p.name) + '"')}<div><b>${esc(p.name)}</b><div class="tiny muted">${esc(p.roles.join(', '))}</div></div></div>
          <div class="row" style="gap:6px;margin-bottom:6px"><a class="btn ghost sm" href="mailto:${esc(p.email)}?subject=${encodeURIComponent('Your safeguarding training')}">Email</a>${p.phone ? `<a class="btn ghost sm" href="tel:${esc(p.phone)}">Call</a>` : ''}</div>
          <div class="tiny muted">${esc(p.email)}${p.phone ? ' · ' + esc(p.phone) : ''}</div>
        </div>
        <div class="card" style="margin-top:14px">
          <h3 style="margin-bottom:12px">Record the follow-up</h3>
          <div class="grid g2"><div class="field"><label class="f">Date</label><input class="input" type="date" id="fu-date" value="${isoDate(now())}" max="${isoDate(now())}"></div>
          <div class="field"><label class="f">How</label><select class="input" id="fu-how"><option>Phone call</option><option>Video call</option><option>In person</option></select></div></div>
          <div class="field"><label class="f">Spoken to by</label><input class="input" id="fu-by" value="${esc(db.settings.dsoName && db.settings.dsoName !== 'Designated Safeguarding Officer' ? db.settings.dsoName : '')}" placeholder="Your name"></div>
          <div class="field"><label class="f">Notes</label><textarea class="input" id="fu-notes" style="min-height:120px" placeholder="What you went over, how they found it, anything to watch for"></textarea></div>
          <label class="radiorow" style="margin-bottom:14px"><input type="checkbox" id="fu-reopen" checked><span><b>Reopen the quiz now</b><br><span class="small muted">Gives ${esc(firstName(p.name))} a fresh ${step.maxAttempts} attempts</span></span></label>
          <button class="btn red" id="fu-save" style="width:100%">Save follow-up</button>
          <p class="tiny muted" style="margin:10px 0 0">Saved to ${esc(firstName(p.name))}’s record and the audit log.</p>
        </div>
      </aside>
    </div>`);
  $('#fu-save').onclick = () => {
    const notes = $('#fu-notes').value.trim(), by = $('#fu-by').value.trim();
    if (!by || notes.length < 4) { toast('Add who spoke to them and a short note'); return; }
    const reopen = $('#fu-reopen').checked;
    audit({ actor: 'admin', action: 'followup_recorded', personId: p.id, pathwayId: pw.id, version: pw.version, detail: { name: p.name, date: $('#fu-date').value, how: $('#fu-how').value, by, notes, reopened: reopen } });
    if (reopen) { const pr = prog(p.id, pw.id); pr.steps[step.id].attempts.forEach(a => { if (!a.passed) a.voided = true; }); audit({ actor: 'admin', action: 'quiz_unlocked', personId: p.id, pathwayId: pw.id, version: pw.version, detail: { name: p.name, note: 'Reopened after follow-up conversation' } }); }
    toast(reopen ? 'Follow-up saved — quiz reopened' : 'Follow-up saved'); go('#/admin/people/' + p.id);
  };
}

/* ---------- person record (tabs) ---------- */
let recordTab = 'training';
function attemptsFor(p) {
  // every attempt is in the audit log; link each to the certificate it led to (or the current cycle)
  const voided = new Set(); db.pathways.forEach(pw => pw.steps.forEach(st => (db.progress[p.id]?.[pw.id]?.steps[st.id]?.attempts || []).forEach(a => a.voided && voided.add(a.at))));
  const resets = db.audit.filter(x => x.personId === p.id && ['quiz_unlocked', 'training_reset'].includes(x.action));
  const out = db.audit.filter(x => x.personId === p.id && x.action === 'quiz_attempt').map(x => {
    const pw = P(x.pathwayId); if (!pw) return null;
    const step = pw.steps.find(s => s.id === x.stepId) || pw.steps.find(s => s.type === 'quiz') || {};
    const cert = db.completions.filter(c => c.personId === p.id && c.pathwayId === pw.id && !c.manual && c.completedAt >= x.at).sort((a, b) => a.completedAt.localeCompare(b.completedAt))[0];
    return { pw, step, cert, a: { at: x.at, score: x.detail?.score, passed: x.detail?.passed, questions: x.detail?.questions || [], voided: voided.has(x.at), demo: x.detail?.demo } };
  }).filter(Boolean).sort((a, b) => a.a.at.localeCompare(b.a.at));
  // number attempts within each cycle
  const cyc = {}; out.forEach(x => { const k = x.pw.id + '|' + (x.cert?.id || 'current'); cyc[k] = (cyc[k] || 0) + 1; x.n = cyc[k]; x.cycle = k; });
  out.forEach(x => { x.resetAfter = resets.some(r => r.pathwayId === x.pw.id && r.at > x.a.at && (!x.cert || r.at < x.cert.completedAt)); });
  return out.reverse();
}
function missedSummary(attempts) {
  const m = {}; attempts.forEach(({ a }) => (a.questions || []).forEach(q => { if (!q.correct) m[q.text] = (m[q.text] || 0) + 1; }));
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}
function openAttempt(x, person) {
  const { a, pw, step, n } = x; const qs = a.questions || [];
  modal(`<header><div><div class="eyebrow">${esc(pw.title)} · ${esc(step.title || 'Quiz')}</div><h2 style="margin-top:4px">${n ? `Attempt ${n}${step.maxAttempts ? ` of ${step.maxAttempts}` : ''}` : 'Quiz attempt'} — ${esc(person.name)}</h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body">
      <div class="row" style="gap:10px;margin-bottom:16px">
        <span class="chip ${a.passed ? 'st-complete' : 'st-expired'}"><span class="dot"></span>${a.passed ? 'Passed' : 'Not passed'}</span>
        <span class="tag">Score ${a.score}% · pass mark ${step.passMark || 80}%</span><span class="tag">${fmtDT(a.at)}</span>${a.voided ? '<span class="tag">Reset by admin</span>' : ''}
      </div>
      ${qs.length ? `<div class="review" style="margin:0">${qs.map((q, i) => `<div class="ri"><span class="ic" style="background:${q.correct ? 'var(--teal)' : 'var(--red)'}">${q.correct ? '✓' : '✗'}</span><div style="flex:1"><div class="tiny muted" style="font-weight:700">Question ${i + 1}</div><b>${esc(q.text)}</b>
        <div class="small" style="margin-top:6px">${q.correct ? `<span style="color:var(--teal);font-weight:600">Answered: ${esc(q.chosen)}</span>` : `<span style="color:var(--red-600);font-weight:600">Answered: ${esc(q.chosen)}</span>${q.answer ? `<br><span class="muted">Correct answer: ${esc(q.answer)}</span>` : ''}`}</div></div></div>`).join('')}</div>`
        : '<div class="empty">Question-level detail wasn’t recorded for this attempt.</div>'}
    </div>
    <footer><button class="btn ghost" data-close>Close</button></footer>`, 'wide');
}
function renderPersonRecord(id) {
  const p = Person(id); if (!p) return go('#/admin/people');
  const req = requiredPathwaysFor(p);
  const certs = db.completions.filter(c => c.personId === p.id).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const log = db.audit.filter(a => a.personId === p.id).slice().reverse();
  const atts = attemptsFor(p);
  const lockedPws = req.filter(pw => pw.steps.some(s => s.type === 'quiz' && quizLocked(prog(p.id, pw.id), s)));
  const tabs = [['training', 'Training', req.length], ['attempts', 'Quiz attempts', atts.length], ['certs', 'Certificates', certs.length], ['activity', 'Activity', log.length]];
  if (!tabs.some(t => t[0] === recordTab)) recordTab = 'training';
  const lockCard = pw => { const L = lockInfo(p, pw); if (!L) return '';
    return `<a class="lockstrip" href="#/admin/people/${p.id}/followup/${pw.id}">
      <span class="kdot" style="background:var(--plum);color:#fff">${ICON.lock.replace('<svg', '<svg width="18" height="18"')}</span>
      <span style="flex:1;min-width:0"><span class="eyebrow" style="color:var(--plum)">Follow-up needed</span><b style="display:block">${esc(pw.title)} quiz locked after ${L.atts.length} attempts (${L.atts.map(x => x.a.score + '%').join(', ')})</b>
      <span class="small muted">Locked ${fmtDate(L.lockedAt)} · promised contact by <b style="color:${L.overdue ? 'var(--red-600)' : 'inherit'}">${fmtDate(L.due)}${L.overdue ? ' (overdue)' : ''}</b></span></span>
      <span class="btn red sm">Open follow-up ${ICON.arrow}</span></a>`; };
  const body = {
    training: () => `${lockedPws.map(lockCard).join('')}<div class="grid g2" style="align-items:start">${req.map(pw => {
        const st = statusOf(p, pw); const pr = prog(p.id, pw.id);
        return `<div class="card tcard"><div class="row between"><h3>${esc(pw.title)}</h3>${chip(st)}</div>
          ${st.c ? (() => { const c = st.c, exp = new Date(c.expiresAt), start = new Date(c.completedAt), never = c.expiresAt.startsWith('9999');
            const left = never ? 1 : Math.max(0, Math.min(1, (exp - Date.now()) / (exp - start))); const months = Math.round((exp - Date.now()) / (30.44 * DAY));
            const col = st.key === 'expired' || left <= 0 ? 'var(--red)' : st.key === 'due' ? 'var(--amber)' : 'var(--teal)';
            return `<div class="tfacts"><div><span>Completed</span><b>${fmtDate(c.completedAt)}</b></div><div><span>${exp > new Date() ? 'Valid until' : 'Expired'}</span><b style="color:${col}">${fmtDate(c.expiresAt)}</b></div><div><span>${c.manual ? 'Recorded' : 'Score'}</span><b>${c.manual ? 'By admin' : c.score != null ? c.score + '%' : '—'}</b></div><div><span>Version</span><b>v${c.version}${c.version < pw.version ? ` <em class="tiny" style="color:#A86A0C;font-style:normal">(now v${pw.version})</em>` : ''}</b></div></div>
              ${never ? '' : `<div class="tlife"><i style="width:${left * 100}%;background:${col}"></i></div><div class="tiny muted" style="margin-top:4px">${exp > new Date() ? (months >= 1 ? `${months} month${months === 1 ? '' : 's'} left` : `${Math.max(0, Math.ceil((exp - Date.now()) / DAY))} days left`) : `Expired ${Math.round((Date.now() - exp) / (30.44 * DAY))} months ago`}</div>`}`; })() : `<div class="small muted" style="margin:6px 0 4px">Not completed yet · current version v${pw.version}</div>`}
          ${(() => { const renewing = pw.steps.some(s => stepDone(pr, s) || (pr.steps[s.id]?.attempts || []).length); const cyc = st.c && !renewing;
            const tick = `<span class="tk on">${ICON.check.replace('<svg', '<svg width="13" height="13"')}</span>`;
            const stepRow = (s, state, extra = '') => `<div class="tstep ${state}">${state === 'done' ? tick : state === 'locked' ? `<span class="tk lk">${ICON.lock.replace('<svg', '<svg width="12" height="12"')}</span>` : '<span class="tk"></span>'}<span class="ico ${s.type || 'attest'}">${ICON[s.type || 'attest'].replace('<svg', '<svg width="14" height="14"')}</span><span class="tt">${esc(s.title)}${extra}</span></div>`;
            if (cyc) return `<div class="tsteps">${pw.steps.map(s => stepRow(s, 'done')).join('')}${stepRow({ title: 'Sign-off', type: 'attest' }, 'done', st.c.manual ? ` <span class="tiny muted">· ${esc(st.c.manual.method)}</span>` : ` <span class="tiny muted">· signed as “${esc(st.c.attestationName)}”</span>`)}</div>`;
            return (st.c ? `<div class="notice info small" style="margin:12px 0 0">${ICON.info}<div>Renewal in progress — current certificate stays valid until ${fmtDate(st.c.expiresAt)}.</div></div>` : '') + `<div class="tsteps">${pw.steps.map(s => { const att = pr.steps[s.id]?.attempts || [];
              return stepRow(s, stepDone(pr, s) ? 'done' : quizLocked(pr, s) ? 'locked' : 'todo', s.type === 'quiz' && att.length ? ` <span class="tiny">${att.map(a => `<span style="color:${a.passed ? 'var(--teal)' : a.voided ? 'var(--muted)' : 'var(--red)'}">${a.score}%</span>`).join(' · ')}</span>` : ''); }).join('')}${stepRow({ title: 'Sign-off', type: 'attest' }, 'todo')}</div>`; })()}
          <div class="row noprint" style="margin-top:12px;gap:8px;border-top:1px solid #F4F0EB;padding-top:12px">${st.c ? `<a class="btn teal xs" href="#/admin/cert/${st.c.id}">${ICON.attest.replace('<svg', '<svg width="14" height="14"')} View certificate</a>` : ''}<span class="tiny muted" style="flex:1;text-align:right">Admin tools</span>
            <button class="btn ghost xs" data-mc="${pw.id}">Record completion…</button>
            <button class="btn ghost xs" data-rs="${pw.id}" style="color:var(--red-600)">Reset training…</button></div>
          </div>`; }).join('') || '<div class="card empty">No training assigned</div>'}</div>`,
    attempts: () => {
      if (!atts.length) return '<div class="card empty">No quiz attempts yet</div>';
      const byPw = db.pathways.filter(pw => atts.some(x => x.pw === pw));
      return byPw.map(pw => {
        const mine = atts.filter(x => x.pw === pw); const groups = [...new Set(mine.map(x => x.cycle))];
        const st = statusOf(p, pw); const q = pw.steps.find(s => s.type === 'quiz');
        return `<div class="card" style="margin-bottom:16px"><div class="row between"><div><h3>${esc(pw.title)}</h3><div class="tiny muted">${esc(q?.title || 'Quiz')} · ${q?.drawCount || 5} questions · pass mark ${q?.passMark || 80}% · ${q?.lock === false ? 'unlimited attempts' : `locks after ${q?.maxAttempts || 3} failed attempts`}</div></div>${chip(st)}</div>
          ${groups.map(g => { const list = mine.filter(x => x.cycle === g).slice().reverse(); const cert = list[0].cert;
            const head = cert ? `Led to certificate <b>${esc(cert.id)}</b> · completed ${fmtDate(cert.completedAt)}${cert.revoked ? ' (revoked)' : ''}` : (st.key === 'locked' ? '<b style="color:var(--plum)">Current attempts — quiz locked, follow-up needed</b>' : '<b>Current attempts</b> — not yet passed');
            return `<div class="cyc"><div class="cychead">${head}</div>
              ${list.map(x => `<button class="attrow" data-att="${atts.indexOf(x)}">
                <span class="an">Attempt ${x.n}</span><span class="ad">${fmtDT(x.a.at)}</span>
                <span class="abar"><i style="width:${x.a.score}%;background:${x.a.passed ? 'var(--teal)' : 'var(--red)'}"></i><em style="left:${q?.passMark || 80}%"></em></span>
                <b class="as" style="color:${x.a.passed ? 'var(--teal)' : 'var(--red-600)'}">${x.a.score}%</b>
                <span class="chip ${x.a.passed ? 'st-complete' : 'st-expired'}">${x.a.passed ? 'Passed' : 'Not passed'}</span>
                ${x.a.voided ? '<span class="tag">Reset by admin</span>' : ''}${x.a.demo ? '<span class="tag">demo</span>' : ''}
                <span class="tiny muted" style="margin-left:auto">${x.a.questions.length ? `${x.a.questions.filter(q => !q.correct).length} wrong · view answers →` : 'no detail'}</span></button>`).join('')}</div>`; }).join('')}
        </div>`; }).join('');
    },
    certs: () => certs.length ? `<div class="stack">${certs.map(c => { const valid = !c.revoked && new Date(c.expiresAt) > new Date();
      return `<div class="card certrow ${c.revoked ? 'revoked' : ''}"><div class="row between" style="align-items:flex-start">
        <div><div class="row" style="gap:8px"><b>${esc(c.pathwayTitle)}</b><span class="tag">v${c.version}</span>${c.revoked ? `<span class="chip st-expired">${c.revoked.replacedBy ? 'Replaced' : 'Revoked'}</span>` : valid ? '<span class="chip st-complete">Valid</span>' : '<span class="chip st-due">Expired</span>'}${c.manual ? '<span class="tag" style="background:var(--sky-50)">Recorded by admin</span>' : ''}</div>
        <div class="small muted" style="margin-top:4px">${esc(c.id)} · completed ${fmtDate(c.completedAt)} · ${valid ? 'valid until' : 'expiry'} ${fmtDate(c.expiresAt)}${c.score != null ? ` · ${c.score}%` : ''}${c.manual ? ` · ${esc(c.manual.method)}` : ` · signed as “${esc(c.attestationName)}”`}${c.nameOnCert ? ` · name on certificate: ${esc(c.nameOnCert)}` : ''}</div>
        ${c.revoked ? `<div class="tiny" style="margin-top:4px;color:var(--red-600)">${c.revoked.replacedBy ? 'Replaced' : 'Revoked'} ${fmtDate(c.revoked.at)} by ${esc(c.revoked.by)} — “${esc(c.revoked.reason)}”</div>` : ''}
        ${(c.edits || []).length ? `<details class="tiny" style="margin-top:6px"><summary class="muted" style="cursor:pointer">${plural(c.edits.length, 'change')}</summary>${c.edits.map(e => `<div style="margin-top:4px">${fmtDT(e.at)} · ${esc(e.by)}: ${e.changes.map(ch => `${esc(ch.field)} ${esc(ch.from)} → ${esc(ch.to)}`).join(', ')} — “${esc(e.reason)}”</div>`).join('')}</details>` : ''}</div>
        <div class="row noprint" style="gap:6px;flex-wrap:nowrap"><a class="btn ghost xs" href="#/admin/cert/${c.id}">View</a>${c.revoked?.replacedBy ? '' : `<button class="btn ghost xs" data-ce="${c.id}">Edit…</button><button class="btn ghost xs" data-cr="${c.id}">Reissue…</button>${c.revoked ? `<button class="btn ghost xs" data-cu="${c.id}">Reinstate…</button>` : `<button class="btn ghost xs" data-cv="${c.id}" style="color:var(--red-600)">Revoke…</button>`}`}</div></div></div>`; }).join('')}</div>` : `<div class="card empty">No certificates yet${req.length ? ` — use “Record completion…” on the Training tab if they’ve trained elsewhere.` : ''}</div>`,
    activity: () => `<div class="card">${log.length ? `<ul class="timeline">${log.map(a => `<li><span class="when">${fmtDT(a.at)}</span><span>${auditText(a)}</span></li>`).join('')}</ul>` : '<div class="empty">No activity yet</div>'}</div>`,
  };
  adminShell('people', `<div class="printable">` + pageHead(`<a href="#/admin/people">People</a> / Record`, `<span class="person" style="gap:14px">${avatar(p).replace('avatar"', 'avatar" style="width:48px;height:48px;font-size:17px;background:' + avatarColour(p.name) + '"')}${esc(p.name)}</span>`,
    `${esc(p.email)}${p.phone ? ` · ${esc(p.phone)}` : ''}${p.org ? ` · ${esc(p.org)}` : ''} · Added ${fmtDate(p.createdAt)}${p.archived ? ' · <b style="color:var(--red-600)">Archived</b>' : ''}<br><span class="typepill t-${typeOf(p)}">${typeOf(p)}</span>${p.accessNI?.status === 'cleared' ? '<span class="tag" style="background:var(--teal-50);color:var(--teal)">AccessNI cleared</span>' : p.accessNI?.status === 'applied' ? '<span class="tag" style="background:var(--amber-50)">AccessNI pending</span>' : ''}${p.roles.map(r => `<span class="tag">${esc(r)}</span>`).join('')}${p.eventIds.map(id => `<span class="tag" style="background:var(--sky-50)">${esc(EventById(id)?.name || '')}</span>`).join('')}`,
    `<a class="btn ghost sm" href="#/admin/people" data-back="#/admin/people">${ICON.back} Back</a><button class="btn ghost sm" data-copy="${p.token}">${ICON.link} Invite link</button><a class="btn ghost sm" href="#/preview/${p.id}">Preview as volunteer</a><button class="btn ghost sm" id="prp">${ICON.print} Print record</button><button class="btn ghost sm" id="psend">✉️ Send reminder</button><a class="btn ghost sm" href="#/inbox/${p.token}">📬 Inbox</a><button class="btn red sm" id="pe">Edit</button>`) + `
    <div class="tabs noprint" role="tablist">${tabs.map(([k, l, n]) => `<button role="tab" aria-selected="${recordTab === k}" class="${recordTab === k ? 'on' : ''}" data-tab="${k}">${l} <span>${n}</span>${k === 'training' && lockedPws.length ? '<i class="tabdot"></i>' : ''}</button>`).join('')}</div>
    <div id="tabbody" class="fadein">${body[recordTab]()}</div></div>`);
  bindCopy();
  $('#pe').onclick = () => personPanel(p);
  $('#prp').onclick = () => printRecord(p);
  $('#psend').onclick = () => { sendReminder(p); renderPersonRecord(id); };
  $$('[data-tab]').forEach(b => b.onclick = () => replaceHash(`#/admin/people/${id}${b.dataset.tab === 'training' ? '' : '/' + b.dataset.tab}`));
  $$('[data-att]').forEach(b => b.onclick = () => openAttempt(atts[+b.dataset.att], p));
  const C = id => db.completions.find(c => c.id === id);
  $$('[data-mc]').forEach(b => b.onclick = () => manualComplete(p, P(b.dataset.mc)));
  $$('[data-rs]').forEach(b => b.onclick = () => resetTraining(p, P(b.dataset.rs)));
  $$('[data-ce]').forEach(b => b.onclick = () => editCert(C(b.dataset.ce)));
  $$('[data-cr]').forEach(b => b.onclick = () => reissueCert(C(b.dataset.cr)));
  $$('[data-cv]').forEach(b => b.onclick = () => revokeCert(C(b.dataset.cv)));
  $$('[data-cu]').forEach(b => b.onclick = () => revokeCert(C(b.dataset.cu), true));
  $$('[data-unlock]').forEach(b => b.onclick = () => {
    const pw = P(b.dataset.unlock); const pr = prog(p.id, pw.id);
    pw.steps.filter(s => s.type === 'quiz' && quizLocked(pr, s)).forEach(s => pr.steps[s.id].attempts.forEach(a => { if (!a.passed) a.voided = true; }));
    audit({ actor: 'admin', action: 'quiz_unlocked', personId: p.id, pathwayId: pw.id, version: pw.version, detail: { name: p.name, note: 'Attempts reset after follow-up conversation' } });
    toast('Quiz reopened — fresh attempts available'); renderPersonRecord(id);
  });
}
function addWorkingDays(d, n) { const x = new Date(d); while (n > 0) { x.setDate(x.getDate() + 1); if (x.getDay() % 6) n--; } return x.toISOString(); }

/* ---------- event detail page ---------- */
let evFilter = { ready: '', q: '' };
function renderEventDetail(id) {
  const ev = EventById(id); if (!ev) return go('#/admin/events');
  const team = live().filter(p => p.eventIds.includes(ev.id)).sort((a, b) => a.name.localeCompare(b.name));
  const c = readyCounts(ev); const days = Math.ceil((new Date(ev.date) - Date.now()) / DAY); const endDays = Math.ceil((new Date(ev.endDate || ev.date) - Date.now()) / DAY);
  const when = days > 0 ? `Starts in ${days} day${days === 1 ? '' : 's'}` : endDays >= 0 ? 'Happening now' : 'Finished';
  const L = { ready: 'Ready', renew: 'Needs refresher', todo: 'Not trained' }, K = { ready: 'complete', renew: 'due', todo: 'expired' };
  const pws = ev.requiredPathways.map(P).filter(Boolean);
  const ST = [['complete', 'Complete', 'var(--teal)'], ['due', 'Due soon', 'var(--amber)'], ['progress', 'In progress', 'var(--sky)'], ['none', 'Not started', '#CFC8C0'], ['expired', 'Expired', 'var(--red)'], ['locked', 'Needs review', 'var(--plum)']];
  adminShell('events', pageHead(`<a href="#/admin/events">Events</a> / ${esc(ev.name)}`, esc(ev.name),
    `${fmtDate(ev.date)}${ev.endDate && ev.endDate !== ev.date ? ' – ' + fmtDate(ev.endDate) : ''} · ${esc(ev.location || '')} · <b>${when}</b>`,
    `<a class="btn ghost sm" href="#/admin/events" data-back="#/admin/events">${ICON.back} Back</a><button class="btn ghost sm" id="evprint">${ICON.print} Print roster</button><button class="btn ghost sm" id="evedit">Edit event</button><button class="btn red sm" id="evadd">+ Add people</button>`) + `
    <div class="evtop">
      <div class="card"><div class="row between" style="margin-bottom:12px"><h3>Team readiness</h3><span class="small"><b style="font-size:22px">${c.total ? Math.round(c.ready / c.total * 100) : 0}%</b> <span class="muted">ready</span></span></div>
        <div class="evnums">${['ready', 'renew', 'todo'].map(k => `<button class="evnum ${evFilter.ready === k ? 'on' : ''}" data-rf="${k}" style="--c:${k === 'ready' ? 'var(--teal)' : k === 'renew' ? 'var(--amber)' : 'var(--red)'}"><b>${c[k]}</b><span>${L[k]}</span></button>`).join('')}</div>
        <div style="margin-top:14px">${readyBar(c, ev.id)}</div>
        <p class="tiny muted" style="margin:10px 0 0">“Ready” = every required certificate is valid until the event ends (${fmtDate(ev.endDate || ev.date)}).</p></div>
      <div class="card"><h3 style="margin-bottom:12px">Required training</h3>${pws.map(pw => { const cc = Object.fromEntries(ST.map(([k]) => [k, 0])); team.forEach(p => cc[statusOf(p, pw).key]++);
          return `<div class="evpw"><div class="row between"><a href="#/admin/pathways/${pw.id}" style="color:inherit;font-weight:700">${esc(pw.title)}</a><span class="small muted">${cc.complete + cc.due}/${team.length} done</span></div>
            <div class="segbar" style="height:9px;margin-top:8px">${ST.map(([k, l, col]) => cc[k] ? `<a href="#/admin/people" data-pf='${JSON.stringify({ event: ev.id, pathway: pw.id, status: k })}' style="flex:${cc[k]};background:${col}" title="${cc[k]} ${l}"></a>` : '').join('')}</div>
            <div class="tiny muted" style="margin-top:6px">${ST.filter(([k]) => cc[k]).map(([k, l]) => `${l} ${cc[k]}`).join(' · ')}</div></div>`; }).join('') || '<div class="empty">No training required — edit the event to add some.</div>'}</div>
    </div>
    <div class="row between" style="margin:26px 0 12px"><h2>Team <span class="muted" style="font-weight:600;font-size:18px">(${team.length})</span></h2>
      <div class="row"><input class="input" id="evq" placeholder="Search team…" value="${esc(evFilter.q)}" style="width:220px;padding:9px 14px"><button class="btn ghost sm" id="evmail">Copy emails</button><button class="btn soft sm" id="evremind">✉️ Remind not ready (${team.filter(p => eventState(p, ev) !== 'ready').length})</button></div></div>
    <div class="tabs" style="margin-bottom:14px">${[['', 'Everyone', team.length], ['ready', 'Ready', c.ready], ['renew', 'Needs refresher', c.renew], ['todo', 'Not trained', c.todo]].map(([k, l, n]) => `<button class="${evFilter.ready === k ? 'on' : ''}" data-rf="${k}">${l} <span>${n}</span></button>`).join('')}</div>
    <div id="evlist"></div>`);
  const draw = () => {
    const list = team.filter(p => (!evFilter.ready || eventState(p, ev) === evFilter.ready) && (!evFilter.q || (p.name + ' ' + p.email).toLowerCase().includes(evFilter.q.toLowerCase())));
    $('#evlist').innerHTML = `<div class="tablewrap"><table class="clickable"><thead><tr><th>Name</th><th>Role</th><th>Readiness</th>${pws.map(pw => `<th>${esc(pw.title)}</th>`).join('')}<th></th></tr></thead><tbody>
      ${list.map(p => { const s = eventState(p, ev);
        return `<tr data-row="${p.id}" tabindex="0"><td><span class="person">${avatar(p)}<span><b>${esc(p.name)}</b><br><span class="tiny muted">${esc(p.email)}</span></span></span></td><td>${p.roles.map(r => `<span class="tag">${esc(r)}</span>`).join('')}</td>
          <td><span class="chip st-${K[s]}"><span class="dot"></span>${L[s]}</span></td>
          ${pws.map(pw => { const lc = latestCompletion(p.id, pw.id), st = statusOf(p, pw); const ok = lc && new Date(lc.expiresAt) > new Date(ev.endDate || ev.date);
            return `<td>${lc && new Date(lc.expiresAt) > new Date() ? `<span class="small" style="font-weight:700;color:${ok ? 'var(--teal)' : '#A86A0C'}">${ok ? '✓' : '!'} until ${fmtDate(lc.expiresAt)}</span>` : chip(st)}</td>`; }).join('')}
          <td class="rowacts"><button class="btn ghost xs" data-copy="${p.token}" title="Copy invite link">${ICON.link}</button><button class="btn ghost xs" data-rm="${p.id}" title="Remove from this event">${ICON.x.replace('width="18" height="18"', 'width="14" height="14"')}</button><span class="chev">${ICON.arrow.replace('width="18" height="18"', 'width="16" height="16"')}</span></td></tr>`; }).join('') || `<tr><td colspan="${4 + pws.length}" class="empty">${team.length ? 'No one matches' : 'No one is signed up yet — use “Add people”.'}</td></tr>`}
      </tbody></table></div>`;
    bindCopy();
    $$('#evlist [data-row]').forEach(tr => { const open = e => { if (e.target.closest('button,a')) return; go('#/admin/people/' + tr.dataset.row); }; tr.onclick = open; tr.onkeydown = e => e.key === 'Enter' && open(e); });
    $$('[data-rm]').forEach(b => b.onclick = e => { e.stopPropagation(); const p = Person(b.dataset.rm); if (!confirmInline(b, 'Remove?')) return;
      p.eventIds = p.eventIds.filter(x => x !== ev.id); audit({ actor: 'admin', action: 'person_updated', personId: p.id, detail: { name: p.name, changes: [`removed from ${ev.name}`] } }); toast(`${p.name} removed from ${ev.name}`); renderEventDetail(id); });
  };
  draw(); bindPf();
  $$('[data-rf]').forEach(b => b.onclick = () => { evFilter.ready = evFilter.ready === b.dataset.rf && b.classList.contains('evnum') ? '' : b.dataset.rf; renderEventDetail(id); });
  $('#evq').oninput = e => { evFilter.q = e.target.value; draw(); };
  $('#evprint').onclick = () => printRoster(ev);
  $('#evedit').onclick = () => eventForm(ev);
  $('#evmail').onclick = async () => { const em = team.filter(p => eventState(p, ev) !== 'ready').map(p => p.email); if (!em.length) { toast('Everyone is ready 🎉'); return; }
    try { await navigator.clipboard.writeText(em.join('; ')); toast(`${em.length} email addresses copied`); } catch { prompt('Copy these addresses:', em.join('; ')); } };
  $('#evadd').onclick = () => addToEvent(ev);
  $('#evremind').onclick = () => composeEmail(team.filter(p => eventState(p, ev) !== 'ready'), { title: `Remind ${ev.name} team`, ruleId: 'r-event', ctxFor: () => ({ event: ev, training: ev.requiredPathways.map(id => P(id)?.title).filter(Boolean).join(' and ') }) });
}
function addToEvent(ev) {
  const pool = live().filter(p => !p.eventIds.includes(ev.id)).sort((a, b) => a.name.localeCompare(b.name)); const picked = new Set();
  const s = modal(`<header><div><div class="eyebrow">${esc(ev.name)}</div><h2 style="margin-top:4px">Add people to this event</h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body"><input class="input" id="aq" placeholder="Search by name, email or role…" style="margin-bottom:12px"><div class="addlist" id="alist"></div>
      <p class="tiny muted" style="margin:10px 0 0">They’ll be asked to complete: ${ev.requiredPathways.map(id => esc(P(id)?.title || '')).join(', ') || 'nothing yet'}.</p></div>
    <footer><span class="small muted" id="acount" style="margin-right:auto;align-self:center">None selected</span><button class="btn ghost" data-close>Cancel</button><button class="btn red" id="ago" disabled>Add to event</button></footer>`, 'wide');
  const draw = () => { const q = $('#aq', s).value.toLowerCase();
    $('#alist', s).innerHTML = pool.filter(p => !q || (p.name + ' ' + p.email + ' ' + p.roles.join(' ')).toLowerCase().includes(q)).slice(0, 60).map(p => `<label class="addrow"><input type="checkbox" value="${p.id}" ${picked.has(p.id) ? 'checked' : ''}>${avatar(p)}<span style="flex:1"><b>${esc(p.name)}</b><br><span class="tiny muted">${esc(p.roles.join(', '))}</span></span>${(() => { const s2 = eventState(p, ev); return `<span class="chip st-${s2 === 'ready' ? 'complete' : s2 === 'renew' ? 'due' : 'none'}" style="font-size:12px">${s2 === 'ready' ? 'Already trained' : s2 === 'renew' ? 'Needs refresher' : 'Needs training'}</span>`; })()}</label>`).join('') || '<div class="empty">No one found</div>';
    $$('#alist input', s).forEach(i => i.onchange = () => { i.checked ? picked.add(i.value) : picked.delete(i.value); $('#acount', s).textContent = picked.size ? `${picked.size} selected` : 'None selected'; $('#ago', s).disabled = !picked.size; }); };
  draw(); $('#aq', s).oninput = draw;
  $('#ago', s).onclick = () => { picked.forEach(pid => { const p = Person(pid); p.eventIds.push(ev.id); audit({ actor: 'admin', action: 'person_updated', personId: p.id, detail: { name: p.name, changes: [`added to ${ev.name}`] } }); if (eventState(p, ev) !== 'ready') autoEmail('assigned', p, { event: ev, training: ev.requiredPathways.map(id => P(id)?.title).filter(Boolean).join(' and '), key: ev.id }); });
    toast(`${picked.size} added to ${ev.name}`); closeModal(); renderEventDetail(ev.id); };
}

/* ---------- events ---------- */
function renderEvents() {
  const list = [...db.events].sort((a, b) => a.date.localeCompare(b.date));
  adminShell('events', pageHead('Events', 'Camps, missions & groups', 'Choose the training each event needs. Anyone signed up to serve is assigned it automatically.', `<button class="btn red sm" id="adde">+ Add event</button>`) + `
    <div class="grid g2">${list.map(ev => {
      const ppl = live().filter(p => p.eventIds.includes(ev.id)); const c = readyCounts(ev);
      const pct = c.total ? c.ready / c.total * 100 : 0;
      const order = { todo: 0, renew: 1, ready: 2 }; const faces = [...ppl].sort((a, b) => order[eventState(a, ev)] - order[eventState(b, ev)]).slice(0, 12);
      const dotCol = { ready: 'var(--teal)', renew: 'var(--amber)', todo: 'var(--red)' }, dotTxt = { ready: 'ready', renew: 'needs a refresher before this event', todo: 'training not complete' };
      return `<div class="card evcard" data-evopen="${ev.id}" tabindex="0"><div class="row between"><div><div class="eyebrow">${fmtDate(ev.date)}${ev.endDate && ev.endDate !== ev.date ? ' – ' + fmtDate(ev.endDate) : ''}</div><h3 style="margin-top:4px">${esc(ev.name)}</h3><div class="small muted">${esc(ev.location || '')}</div></div><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn ghost xs" data-roster="${ev.id}" title="Print team roster">${ICON.print}</button><button class="btn ghost xs" data-ev="${ev.id}">Edit</button></div></div>
        <div style="margin:14px 0 8px" class="small"><b>Requires:</b> ${ev.requiredPathways.map(id => `<span class="tag">${esc(P(id)?.title || '?')}</span>`).join('') || '<span class="muted">Nothing yet</span>'}</div>
        <div class="row between small"><span><b>${c.ready}</b> of ${plural(c.total, 'volunteer')} ready</span><span><b>${Math.round(pct)}%</b></span></div>
        <div style="margin:8px 0 0">${readyBar(c, ev.id)}</div>
        ${readyLegend(c, ev.id)}
        <div class="row" style="gap:6px;margin-top:12px">${faces.map(p => `<a href="#/admin/people/${p.id}" title="${esc(p.name)} — ${dotTxt[eventState(p, ev)]}" style="position:relative">${avatar(p)}<span style="position:absolute;right:-2px;bottom:-2px;width:12px;height:12px;border-radius:50%;border:2px solid #fff;background:${dotCol[eventState(p, ev)]}"></span></a>`).join('') || '<span class="tiny muted">No one signed up yet</span>'}${ppl.length > faces.length ? `<a class="morefaces" href="#/admin/people" data-pf='${JSON.stringify({ event: ev.id })}'>+${ppl.length - faces.length}</a>` : ''}</div>
        <p class="tiny muted" style="margin:10px 0 0">“Ready” = every required certificate is still valid at the end of the event. “Needs refresher” = trained, but a certificate runs out before then.</p>
      </div>`;
    }).join('')}</div>`);
  bindPf();
  $('#adde').onclick = () => eventForm();
  $$('[data-ev]').forEach(b => b.onclick = () => eventForm(EventById(b.dataset.ev)));
  $$('[data-roster]').forEach(b => b.onclick = () => printRoster(EventById(b.dataset.roster)));
  $$('[data-evopen]').forEach(c => { const open = e => { if (e.target.closest('button,a')) return; evFilter = { ready: '', q: '' }; go('#/admin/events/' + c.dataset.evopen); }; c.onclick = open; c.onkeydown = e => e.key === 'Enter' && open(e); });
}
function eventForm(ev) {
  const isNew = !ev; ev = ev || { name: '', date: '', endDate: '', location: '', requiredPathways: ['p-essentials'] };
  const s = modal(`<header><h2>${isNew ? 'Add event' : 'Edit event'}</h2><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body"><div class="field"><label class="f">Name</label><input class="input" id="en" value="${esc(ev.name)}" placeholder="e.g. Ballycastle Mission 2027"></div>
    <div class="grid g3"><div class="field"><label class="f">Starts</label><input class="input" type="date" id="ed" value="${ev.date}"></div><div class="field"><label class="f">Ends</label><input class="input" type="date" id="ee" value="${ev.endDate || ''}"></div><div class="field"><label class="f">Location</label><input class="input" id="el" value="${esc(ev.location || '')}"></div></div>
    <div class="field"><label class="f">Required training</label><div class="checks">${db.pathways.map(p => `<label><input type="checkbox" name="erp" value="${p.id}" ${ev.requiredPathways.includes(p.id) ? 'checked' : ''}>${esc(p.title)}</label>`).join('')}</div></div></div>
    <footer>${isNew ? '' : `<button class="btn ghost" id="edel" style="margin-right:auto;color:var(--red)">${ICON.trash} Delete</button>`}<button class="btn ghost" data-close>Cancel</button><button class="btn red" id="esave">Save</button></footer>`);
  $('#esave', s).onclick = () => {
    const v = { name: $('#en', s).value.trim(), date: $('#ed', s).value, endDate: $('#ee', s).value || $('#ed', s).value, location: $('#el', s).value.trim(), requiredPathways: $$('[name=erp]:checked', s).map(x => x.value) };
    if (!v.name || !v.date) { toast('Add a name and start date'); return; }
    if (isNew) db.events.push({ id: uid('ev-'), ...v }); else Object.assign(ev, v);
    audit({ actor: 'admin', action: 'event_saved', detail: v }); closeModal(); route(); toast('Event saved');
  };
  $('#edel', s) && ($('#edel', s).onclick = () => { if (!confirmInline($('#edel', s), 'Click again to delete')) return; db.events = db.events.filter(x => x !== ev); db.people.forEach(p => p.eventIds = p.eventIds.filter(i => i !== ev.id)); audit({ actor: 'admin', action: 'event_removed', detail: { name: ev.name } }); closeModal(); route(); });
}

/* ---------- pathways list ---------- */
function renderPathways() {
  adminShell('pathways', pageHead('Pathways', 'Training pathways', 'A pathway is a set of steps — videos, readings and quizzes — that finishes with a signed attestation.', `<button class="btn red sm" id="addpw">+ New pathway</button>`) + `
    <div class="grid g2">${db.pathways.map(pw => {
      const assigned = live().filter(p => requiredPathwaysFor(p).includes(pw));
      const done = assigned.filter(p => ['complete', 'due'].includes(statusOf(p, pw).key)).length;
      return `<a class="card pcard" href="#/admin/pathways/${pw.id}" style="color:inherit;text-decoration:none;display:block">
        <div class="row between"><span class="tag" style="background:${pw.colour}1a;color:${pw.colour}">v${pw.version}</span>${pw.active === false ? '<span class="chip st-none">Hidden</span>' : ''}</div>
        <h3 style="margin:10px 0 6px">${esc(pw.title)}</h3><p class="small muted">${esc(pw.summary)}</p>
        <div class="row" style="gap:6px;margin:10px 0">${pw.steps.map(s => `<span class="ico ${s.type}" title="${esc(s.title)}" style="width:30px;height:30px;border-radius:9px;display:grid;place-items:center">${ICON[s.type].replace('<svg', '<svg width="15" height="15"')}</span>`).join('')}<span class="ico attest" style="width:30px;height:30px;border-radius:9px;display:grid;place-items:center">${ICON.attest.replace('<svg', '<svg width="15" height="15"')}</span></div>
        <div class="tiny muted">${renewLabel(pw).replace(/^./, c => c.toUpperCase())} · Required for ${esc(pw.requiredForRoles.join(', ') || 'events only')} · ${done}/${assigned.length} complete</div></a>`;
    }).join('')}</div>`);
  $('#addpw').onclick = () => {
    const pw = { id: uid('p-'), title: 'New pathway', colour: '#6C4C70', summary: 'Describe what this training covers.', validityMonths: 12, requiredForRoles: [], active: true, version: 0, attestation: 'I confirm that I have completed this training personally and understand its content.', steps: [], versions: [], updatedAt: now() };
    db.pathways.push(pw); persist(); go('#/admin/pathways/' + pw.id);
  };
}

/* ---------- pathway editor (draft → publish) ---------- */
let draft = null;
function renderPathwayEditor(id) {
  const live = P(id); if (!live) return go('#/admin/pathways');
  if (!draft || draft.id !== id) draft = JSON.parse(JSON.stringify(live));
  const changed = () => JSON.stringify(stripRev(draft)) !== JSON.stringify(stripRev(live));
  const typeName = { video: 'Video', read: 'Read & acknowledge', quiz: 'Quiz' };
  const stepSummary = s => s.type === 'video' ? (s.video?.source === 'file' ? `Uploaded file · ${esc(s.video.fileName || '')}` : `${s.video?.source === 'youtube' ? 'YouTube' : 'Vimeo'} · ${esc(s.video?.url || '')}`)
    : s.type === 'quiz' ? `${s.questions.length} questions in bank · ${s.drawCount} drawn · pass ${s.passMark}% · ${s.lock === false ? 'unlimited attempts' : `locks after ${s.maxAttempts} fails`}${s.questions.length < s.drawCount * 2 ? ' · <span style="color:#A86A0C">tip: add more questions so retakes feel fresh</span>' : ''}`
      : `${(s.body || '').split(/\s+/).length} words${s.link?.url ? ' · links to a document' : ''}`;
  adminShell('pathways', pageHead(`<a href="#/admin/pathways">Pathways</a> / Edit`, esc(draft.title), `Live version: <b>v${live.version}</b>${live.version ? ` · published ${fmtDate(live.updatedAt)}` : ' · not published yet'}`,
    `<a class="btn ghost sm" href="#/admin/pathways" id="cancel">Close</a><button class="btn red sm" id="pub" ${changed() ? '' : 'disabled'}>Publish v${live.version + 1}</button>`) + `
    ${changed() ? `<div class="notice warn small" style="margin-bottom:16px">${ICON.info}<div><b>Unpublished changes.</b> Volunteers see the live version until you publish. Anyone partway through keeps the steps they’ve already done if those steps haven’t changed.</div></div>` : ''}
    <div class="grid" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:22px;align-items:start">
      <div>
        <div class="row between" style="margin-bottom:12px"><h3>Steps</h3><span class="tiny muted">Drag to reorder</span></div>
        <div class="stack" id="steplist">${draft.steps.map((s, i) => `<div class="steprow" draggable="true" data-i="${i}">
          <span class="ico ${s.type}">${ICON[s.type]}</span>
          <div style="flex:1;min-width:0"><div class="tiny muted" style="font-weight:700">${i + 1} · ${typeName[s.type]}</div><b>${esc(s.title)}</b><div class="tiny muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${stepSummary(s)}</div></div>
          <button class="iconbtn" data-mv="${i},-1" title="Move up" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button><button class="iconbtn" data-mv="${i},1" title="Move down" ${i === draft.steps.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
          <button class="btn ghost xs" data-es="${i}">Edit</button></div>`).join('')}
          <div class="steprow" style="cursor:default;background:#FBFAF8;box-shadow:none"><span class="ico attest">${ICON.attest}</span><div style="flex:1"><div class="tiny muted" style="font-weight:700">Always last · Attestation</div><b>Sign-off & certificate</b></div></div>
        </div>
        <div class="row" style="margin-top:14px"><span class="small muted">Add step:</span>
          <button class="btn soft sm" data-add="video">${ICON.video.replace('<svg', '<svg width="16" height="16"')} Video</button>
          <button class="btn soft sm" data-add="read">${ICON.read.replace('<svg', '<svg width="16" height="16"')} Reading</button>
          <button class="btn soft sm" data-add="quiz">${ICON.quiz.replace('<svg', '<svg width="16" height="16"')} Quiz</button></div>
      </div>
      <div class="card">
        <div class="field"><label class="f">Title</label><input class="input" data-k="title" value="${esc(draft.title)}"></div>
        <div class="field"><label class="f">Summary</label><textarea class="input" data-k="summary" style="min-height:70px">${esc(draft.summary)}</textarea></div>
        <div class="grid g2"><div class="field"><label class="f">Certificate valid for</label>${(() => { const m = draft.validityMonths, preset = [6, 12, 24, 36].includes(m) ? String(m) : m > 0 ? 'custom' : 'never';
          return `<select class="input" id="vsel">${[['6', '6 months'], ['12', '12 months'], ['24', '2 years'], ['36', '3 years'], ['custom', 'Custom…'], ['never', 'No expiry']].map(([v, l]) => `<option value="${v}" ${preset === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <div class="row" id="vcustom" style="margin-top:8px;gap:8px;${preset === 'custom' ? '' : 'display:none'}"><input class="input" type="number" min="1" max="120" id="vmonths" value="${m > 0 ? m : 18}" style="width:100px"><span class="small muted">months</span></div>`; })()}</div>
        <div class="field"><label class="f">Colour</label><input class="input" type="color" data-k="colour" value="${draft.colour}" style="height:44px;padding:4px"></div></div>
        <div class="field"><label class="f">Required for roles</label><div class="checks">${db.roles.map(r => `<label><input type="checkbox" name="rr" value="${esc(r)}" ${draft.requiredForRoles.includes(r) ? 'checked' : ''}>${esc(r)}</label>`).join('')}</div><div class="help">Also add it to events under <a href="#/admin/events">Events</a>.</div></div>
        <div class="field"><label class="f">Attestation statement</label><textarea class="input" data-k="attestation">${esc(draft.attestation)}</textarea></div>
        <label class="row small" style="gap:8px"><input type="checkbox" id="act" ${draft.active !== false ? 'checked' : ''} style="accent-color:var(--red)"> Active (assign to volunteers)</label>
      </div>
    </div>
    <h3 style="margin:28px 0 10px">Version history</h3>
    <div class="card">${(live.versions || []).length ? `<ul class="timeline">${live.versions.slice().reverse().map(v => `<li><span class="when">${fmtDT(v.at)}</span><span><b>v${v.version}</b> — ${esc(v.note || '')} <span class="muted">· ${esc(v.by || '')}</span></span></li>`).join('')}</ul>` : '<div class="empty">Not published yet</div>'}</div>`);

  const refresh = () => renderPathwayEditor(id);
  $$('[data-k]').forEach(el => el.oninput = el.onchange = () => { draft[el.dataset.k] = el.dataset.num != null ? +el.value : el.value; $('#pub').disabled = !changed(); });
  $$('[name=rr]').forEach(el => el.onchange = () => { draft.requiredForRoles = $$('[name=rr]:checked').map(x => x.value); $('#pub').disabled = !changed(); });
  $('#act').onchange = e => { draft.active = e.target.checked; $('#pub').disabled = !changed(); };
  const vupd = () => { const v = $('#vsel').value; $('#vcustom').style.display = v === 'custom' ? '' : 'none'; draft.validityMonths = v === 'never' ? 0 : v === 'custom' ? Math.max(1, +$('#vmonths').value || 1) : +v; $('#pub').disabled = !changed(); };
  $('#vsel').onchange = vupd; $('#vmonths').oninput = vupd;
  $$('[data-mv]').forEach(b => b.onclick = () => { const [i, d] = b.dataset.mv.split(',').map(Number); const [x] = draft.steps.splice(i, 1); draft.steps.splice(i + d, 0, x); refresh(); });
  $$('[data-es]').forEach(b => b.onclick = () => stepEditor(draft.steps[+b.dataset.es], refresh));
  $$('[data-add]').forEach(b => b.onclick = () => {
    const t = b.dataset.add;
    const s = t === 'video' ? { id: uid('s-'), type: 'video', title: 'New video', description: '', video: { source: 'youtube', url: '' }, minWatchPct: 95 }
      : t === 'read' ? { id: uid('s-'), type: 'read', title: 'New reading', body: '## Heading\nWrite or paste content here.', ackText: 'I have read and understood this.', link: null }
        : { id: uid('s-'), type: 'quiz', title: 'Check your understanding', drawCount: 5, passMark: 80, maxAttempts: 3, questions: [] };
    draft.steps.push(s); stepEditor(s, refresh, true);
  });
  // drag reorder
  let from = null;
  $$('#steplist .steprow[draggable]').forEach(r => {
    r.ondragstart = () => { from = +r.dataset.i; r.classList.add('dragging'); };
    r.ondragend = () => r.classList.remove('dragging');
    r.ondragover = e => { e.preventDefault(); r.classList.add('over'); };
    r.ondragleave = () => r.classList.remove('over');
    r.ondrop = e => { e.preventDefault(); const to = +r.dataset.i; if (from == null || from === to) return; const [x] = draft.steps.splice(from, 1); draft.steps.splice(to, 0, x); refresh(); };
  });
  $('#cancel').onclick = e => { if (changed() && !confirmInline(e.currentTarget, 'Discard changes?')) { e.preventDefault(); return; } draft = null; };
  $('#pub').onclick = () => {
    const s = modal(`<header><h2>Publish v${live.version + 1}</h2><button class="iconbtn" data-close>${ICON.x}</button></header>
      <div class="body"><div class="field"><label class="f">What changed?</label><input class="input" id="note" placeholder="e.g. Added two scenario questions"><div class="help">Kept in the version history and audit log.</div></div>
      <div class="notice info small">${ICON.info}<div>Existing certificates stay valid and keep their version number. New completions will show v${live.version + 1}.</div></div></div>
      <footer><button class="btn ghost" data-close>Cancel</button><button class="btn red" id="pubgo">Publish</button></footer>`);
    $('#pubgo', s).onclick = () => {
      if (!draft.steps.length) { toast('Add at least one step'); return; }
      const bad = draft.steps.find(st => st.type === 'quiz' && st.questions.length < st.drawCount);
      if (bad) { toast(`“${bad.title}” needs at least ${bad.drawCount} questions`); return; }
      draft.steps.forEach(st => st.rev = stepRev(st));
      const note = $('#note', s).value.trim() || 'Updated';
      draft.version = live.version + 1; draft.updatedAt = now();
      draft.versions = [...(live.versions || []), { version: draft.version, at: now(), note, by: db.settings.adminName }];
      Object.keys(live).forEach(k => delete live[k]); Object.assign(live, JSON.parse(JSON.stringify(draft)));
      audit({ actor: 'admin', action: 'pathway_published', pathwayId: live.id, version: live.version, detail: { note, snapshot: live.steps.map(st => ({ id: st.id, type: st.type, title: st.title, rev: st.rev })) } });
      closeModal(); draft = null; toast(`Published v${live.version}`); renderPathwayEditor(id);
    };
  };
}
const stripRev = p => JSON.parse(JSON.stringify(p, (k, v) => k === 'rev' ? undefined : v));

/* step editor modal */
function stepEditor(step, done, isNew) {
  const work = JSON.parse(JSON.stringify(step));
  const openQs = new Set();
  const s = modal(`<header><h2>${{ video: 'Video step', read: 'Reading step', quiz: 'Quiz step' }[work.type]}</h2><button class="iconbtn" data-close>${ICON.x}</button></header><div class="body" id="seb"></div>
    <footer><button class="btn ghost" id="sdel" style="margin-right:auto;color:var(--red)">${ICON.trash} Remove step</button><button class="btn ghost" data-close>Cancel</button><button class="btn red" id="ssave">Done</button></footer>`, work.type === 'quiz' ? 'wide' : '');
  const body = $('#seb', s);
  const common = `<div class="field"><label class="f">Step title</label><input class="input" id="st" value="${esc(work.title)}"></div>`;
  const drawVideo = () => {
    const v = work.video;
    body.innerHTML = common + `<div class="field"><label class="f">Description</label><input class="input" id="sd" value="${esc(work.description || '')}"></div>
      <div class="field"><label class="f">Video source</label><div class="seg">${[['file', 'Upload file'], ['youtube', 'YouTube'], ['vimeo', 'Vimeo']].map(([k, l]) => `<button data-src="${k}" class="${v.source === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      ${v.source === 'file' ? `<div class="dropzone" id="vdz">${v.mediaId ? `<b>${esc(v.fileName || 'Video uploaded')}</b><br><span class="small muted">Drop a new file to replace it</span>` : '<b>Drop an MP4 here</b> or click to choose'}<input type="file" accept="video/*" hidden id="vfi"></div>
        <div class="help">Uploading gives the most reliable “no skipping” control. In the live version, files go to secure cloud storage.</div>
        <div class="field" style="margin-top:14px"><label class="f">Captions (WebVTT)</label><div class="row"><button class="btn ghost sm" id="vttb">${v.vtt ? 'Replace captions file' : 'Upload .vtt captions'}</button>${v.vtt ? `<span class="small muted">${parseVTT(v.vtt).length} captions loaded</span><button class="btn ghost xs" id="vttx">Remove</button>` : '<span class="small muted">Adds a CC button to the player</span>'}</div></div>`
        : `<div class="field"><label class="f">${v.source === 'youtube' ? 'YouTube' : 'Vimeo'} link</label><input class="input" id="vurl" value="${esc(v.url || '')}" placeholder="${v.source === 'youtube' ? 'https://youtu.be/…' : 'https://vimeo.com/…'}"><div class="help">Use an unlisted video so it isn’t publicly searchable.</div></div>`}
      <div class="field" style="margin-top:16px"><label class="f">Must watch at least</label><select class="input" id="mw" style="width:auto">${[80, 90, 95, 100].map(n => `<option ${work.minWatchPct === n ? 'selected' : ''} value="${n}">${n}%</option>`).join('')}</select></div>`;
    $$('[data-src]', body).forEach(b => b.onclick = () => { keep(); work.video = { source: b.dataset.src, url: '', mediaId: null }; drawVideo(); });
    $('#vttb', body) && ($('#vttb', body).onclick = () => { const fi = document.createElement('input'); fi.type = 'file'; fi.accept = '.vtt,text/vtt'; fi.onchange = async () => { const t = await fi.files[0].text(); if (!/WEBVTT/.test(t)) { toast('That isn’t a WebVTT file'); return; } keep(); work.video.vtt = t; toast('Captions added'); drawVideo(); }; fi.click(); });
    $('#vttx', body) && ($('#vttx', body).onclick = () => { keep(); work.video.vtt = ''; drawVideo(); });
    const dz = $('#vdz', body);
    if (dz) {
      const fi = $('#vfi', body);
      dz.onclick = () => fi.click(); dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
      const up = async f => {
        if (!f.type.startsWith('video/')) { toast('Please choose a video file'); return; }
        dz.innerHTML = '<b>Saving…</b>'; const mid = uid('m_');
        try { await Media.put(mid, f); keep(); work.video = { source: 'file', mediaId: mid, fileName: f.name, vtt: work.video.vtt || '' }; toast('Video saved'); drawVideo(); }
        catch { toast('Couldn’t store that video in this browser'); drawVideo(); }
      };
      dz.ondrop = e => { e.preventDefault(); e.dataTransfer.files[0] && up(e.dataTransfer.files[0]); };
      fi.onchange = () => fi.files[0] && up(fi.files[0]);
    }
  };
  const drawRead = () => {
    body.innerHTML = common + `<div class="field"><label class="f">Content</label><textarea class="input" id="sb" style="min-height:240px;font-family:ui-monospace,monospace;font-size:14px">${esc(work.body)}</textarea><div class="help">Use <code>## Heading</code>, <code>- bullet</code> and <code>**bold**</code>.</div></div>
      <div class="grid g2"><div class="field"><label class="f">Link label (optional)</label><input class="input" id="sll" value="${esc(work.link?.label || '')}" placeholder="Read the full policy"></div><div class="field"><label class="f">Link URL</label><input class="input" id="slu" value="${esc(work.link?.url || '')}" placeholder="https://…"></div></div>
      <div class="field"><label class="f">Acknowledgement statement</label><input class="input" id="sa" value="${esc(work.ackText || '')}"></div>`;
  };
  const drawQuiz = () => {
    body.innerHTML = common + `<div class="grid g3"><div class="field"><label class="f">Questions per attempt</label><input class="input" type="number" min="1" max="20" id="qd" value="${work.drawCount}"></div>
      <div class="field"><label class="f">Pass mark (%)</label><input class="input" type="number" min="1" max="100" id="qp" value="${work.passMark}"></div>
      <div class="field"><label class="f">Question bank</label><div class="help" style="margin-top:12px">${work.questions.length} questions · each attempt draws ${work.drawCount}${work.questions.length < work.drawCount * 2 ? ' — <b style="color:#A86A0C">add more so retakes feel fresh</b>' : ''}</div></div></div>
      <div class="lockset"><label class="switch"><input type="checkbox" id="qlock" ${work.lock !== false ? 'checked' : ''}><span></span></label>
        <div style="flex:1"><b>Lock the quiz after repeated failed attempts</b><div class="small muted">When locked, the volunteer is told someone will be in touch, and admins are asked to follow up before reopening it.</div>
        <div class="row" id="qlockn" style="margin-top:10px;gap:8px;${work.lock !== false ? '' : 'display:none'}"><span class="small">Lock after</span><input class="input" type="number" min="1" max="10" id="qa" value="${work.maxAttempts}" style="width:80px"><span class="small">failed attempts</span></div>
        <div class="small muted" id="qlockoff" style="margin-top:8px;${work.lock !== false ? 'display:none' : ''}">Unlimited attempts — the quiz never locks.</div></div></div>
      <div class="field"><label class="f">Show answers</label><div class="seg" id="qfbseg">${[['instant', 'After each question'], ['end', 'At the end only']].map(([k, l]) => `<button data-fb="${k}" class="${(work.feedback || 'instant') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="help">“After each question” helps people learn as they go. “At the end only” is closer to a formal test — learners see which ones they got wrong, with explanations, but not the right answers.</div></div>
      <div class="row between" style="margin:6px 0 10px"><h3>Question bank <span class="muted" style="font-weight:600">(${work.questions.length})</span></h3><div class="row"><button class="btn ghost xs" id="qcsv">Import CSV</button><button class="btn soft xs" id="qadd">+ Add question</button></div></div>
      <div class="qtools"><button class="btn ghost xs" data-qall="1">Expand all</button><button class="btn ghost xs" data-qall="0">Collapse all</button></div>
      <div class="qlist" id="qlist">${work.questions.map((q, i) => { const bad = !q.text.trim() || q.options.filter(o => o.trim()).length < 2 || !(q.options[q.correct] || '').trim();
        return `<div class="qitem ${openQs.has(q.id) ? 'open' : ''}" data-qid="${q.id}">
        <button type="button" class="qsum" aria-expanded="${openQs.has(q.id)}"><span class="qn">Q${i + 1}</span><span class="qs-main"><span class="qs-text">${esc(q.text) || '<i class="muted">New question</i>'}</span><span class="qs-ans">${(q.options[q.correct] || '').trim() ? `✓ ${esc(q.options[q.correct])}` : ''}</span></span>${bad ? '<span class="qwarn">Incomplete</span>' : ''}<span class="qchev">${ICON.down}</span></button>
        <div class="qedit" data-qi="${i}">
          <textarea class="input" data-qf="text" style="min-height:54px" placeholder="Question">${esc(q.text)}</textarea>
          ${q.options.map((o, k) => `<div class="optrow"><input type="radio" name="qc${i}" value="${k}" ${q.correct === k ? 'checked' : ''} title="Mark as correct answer"><input class="input" data-qo="${k}" value="${esc(o)}" placeholder="Option ${'ABCD'[k]}" style="padding:8px 10px"></div>`).join('')}
          <input class="input" data-qf="explanation" value="${esc(q.explanation || '')}" placeholder="Explanation shown after the quiz" style="margin-top:8px;padding:8px 10px;font-size:14px">
          <div class="row between" style="margin-top:10px"><button class="btn ghost xs" data-qdel="${i}" style="color:var(--red-600)">${ICON.trash} Delete question</button><button class="btn ghost xs" data-qdone="${q.id}">Done</button></div>
        </div></div>`; }).join('') || '<div class="empty">No questions yet</div>'}</div>
      <button type="button" class="qaddbig" id="qadd2">+ Add question</button>
      <p class="tiny muted">Select the circle next to the correct answer. Answer order is shuffled for each learner.</p>`;
    $$('[data-fb]', body).forEach(b => b.onclick = () => { keep(); work.feedback = b.dataset.fb; drawQuiz(); });
    $('#qlock', body).onchange = e => { $('#qlockn', body).style.display = e.target.checked ? '' : 'none'; $('#qlockoff', body).style.display = e.target.checked ? 'none' : ''; };
    const addQ = () => { keep(); const q = { id: uid('q_'), text: '', options: ['', '', '', ''], correct: 0, explanation: '' }; work.questions.push(q); openQs.add(q.id); drawQuiz(); const el = $(`[data-qid="${q.id}"]`, body); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => $('textarea', el)?.focus(), 250); };
    $('#qadd', body).onclick = addQ; $('#qadd2', body).onclick = addQ;
    $$('.qsum', body).forEach(b => b.onclick = () => { const it = b.closest('.qitem'), id = it.dataset.qid; const open = !it.classList.contains('open'); it.classList.toggle('open', open); b.setAttribute('aria-expanded', open); open ? openQs.add(id) : openQs.delete(id); if (open) setTimeout(() => $('textarea', it)?.focus(), 30); });
    $$('[data-qdone]', body).forEach(b => b.onclick = () => { keep(); openQs.delete(b.dataset.qdone); drawQuiz(); });
    $$('[data-qall]', body).forEach(b => b.onclick = () => { keep(); work.questions.forEach(q => b.dataset.qall === '1' ? openQs.add(q.id) : openQs.delete(q.id)); drawQuiz(); });
    $$('.qedit', body).forEach(el => el.addEventListener('input', () => { const it = el.closest('.qitem'), i = +el.dataset.qi; const t = $('[data-qf=text]', el).value, opts = $$('[data-qo]', el).map(x => x.value), c = +($('input[type=radio]:checked', el)?.value || 0);
      $('.qs-text', it).innerHTML = esc(t) || '<i class="muted">New question</i>'; $('.qs-ans', it).textContent = (opts[c] || '').trim() ? '✓ ' + opts[c] : '';
      const bad = !t.trim() || opts.filter(o => o.trim()).length < 2 || !(opts[c] || '').trim(); let w = $('.qwarn', it);
      if (bad && !w) { w = document.createElement('span'); w.className = 'qwarn'; w.textContent = 'Incomplete'; $('.qchev', it).before(w); } else if (!bad && w) w.remove(); }));
    $$('.qedit input[type=radio]', body).forEach(r => r.addEventListener('change', () => r.closest('.qedit').dispatchEvent(new Event('input'))));
    $$('[data-qdel]', body).forEach(b => b.onclick = () => { keep(); work.questions.splice(+b.dataset.qdel, 1); drawQuiz(); });
    $('#qcsv', body).onclick = () => {
      const fi = document.createElement('input'); fi.type = 'file'; fi.accept = '.csv';
      fi.onchange = async () => { keep(); const rows = parseCSV(await fi.files[0].text()); if (/question/i.test(rows[0]?.[0] || '')) rows.shift(); let n = 0;
        rows.filter(r => r[0]).forEach(r => { work.questions.push({ id: uid('q_'), text: r[0], options: [r[1], r[2], r[3], r[4]].map(x => x || ''), correct: Math.max(0, 'ABCD'.indexOf((r[5] || 'A').trim().toUpperCase())), explanation: r[6] || '' }); n++; });
        toast(`${n} questions imported`); drawQuiz(); };
      fi.click(); toast('CSV columns: question, A, B, C, D, correct letter, explanation');
    };
  };
  const keep = () => {
    work.title = $('#st', body)?.value ?? work.title;
    if (work.type === 'video') { work.description = $('#sd', body)?.value ?? ''; work.minWatchPct = +($('#mw', body)?.value || 95); if ($('#vurl', body)) work.video.url = $('#vurl', body).value.trim(); }
    if (work.type === 'read') { work.body = $('#sb', body).value; work.ackText = $('#sa', body).value; const u = $('#slu', body).value.trim(); work.link = u ? { url: u, label: $('#sll', body).value.trim() || 'Open document' } : null; }
    if (work.type === 'quiz') {
      work.drawCount = +$('#qd', body).value || 5; work.passMark = +$('#qp', body).value || 80; work.maxAttempts = +$('#qa', body).value || 3; work.lock = $('#qlock', body).checked;
      $$('.qedit', body).forEach(el => { const q = work.questions[+el.dataset.qi]; q.text = $('[data-qf=text]', el).value; q.explanation = $('[data-qf=explanation]', el).value; q.options = $$('[data-qo]', el).map(x => x.value); q.correct = +($(`input[type=radio]:checked`, el)?.value || 0); });
    }
  };
  ({ video: drawVideo, read: drawRead, quiz: drawQuiz })[work.type]();
  $('#ssave', s).onclick = () => {
    keep();
    if (work.type === 'video' && work.video.source !== 'file' && !(work.video.source === 'youtube' ? ytId(work.video.url) : /vimeo\.com\/(video\/)?\d+/.test(work.video.url))) { toast('That link doesn’t look right'); return; }
    if (work.type === 'video' && work.video.source === 'file' && !work.video.mediaId) { toast('Upload a video file first'); return; }
    if (work.type === 'quiz' && work.questions.some(q => !q.text.trim() || q.options.filter(o => o.trim()).length < 2)) { toast('Each question needs text and at least two options'); return; }
    if (work.type === 'quiz') work.questions.forEach(q => { const keepIdx = q.options.map((o, i) => o.trim() ? i : -1).filter(i => i >= 0); q.correct = Math.max(0, keepIdx.indexOf(q.correct)); q.options = keepIdx.map(i => q.options[i]); });
    Object.keys(step).forEach(k => delete step[k]); Object.assign(step, work);
    closeModal(); done();
  };
  $('#sdel', s).onclick = () => { if (!confirmInline($('#sdel', s), 'Click again to remove')) return; draft.steps = draft.steps.filter(x => x !== step); closeModal(); done(); };
  s.addEventListener('click', e => { if (isNew && e.target.closest('[data-close]')) { draft.steps = draft.steps.filter(x => x !== step); done(); } });
}

/* ---------- audit ---------- */
function renderAudit() {
  let f = { q: '', action: '' };
  adminShell('audit', pageHead('Audit log', 'Every action, recorded', 'This log can only be added to — nothing in it is ever edited or deleted. Quiz entries keep the exact questions shown and the answers given.',
    `<button class="btn ghost sm" id="ax">${ICON.dl} Export CSV</button><button class="btn ghost sm" data-x="backup">${ICON.dl} Full backup (JSON)</button>`) + `
    <div class="row" style="margin-bottom:14px"><input class="input" id="aq" placeholder="Search person or pathway…" style="max-width:280px"><select class="input" id="aa" style="width:auto"><option value="">All actions</option>${[...new Set(db.audit.map(a => a.action))].map(a => `<option value="${a}">${a.replace(/_/g, ' ')}</option>`).join('')}</select></div>
    <div class="card" id="alist"></div>`);
  const list = () => db.audit.filter(a => (!f.action || a.action === f.action) && (!f.q || ((Person(a.personId)?.name || '') + ' ' + (P(a.pathwayId)?.title || '') + ' ' + JSON.stringify(a.detail || {})).toLowerCase().includes(f.q.toLowerCase()))).slice().reverse();
  const draw = () => { $('#alist').innerHTML = activityList(list()); };
  draw();
  $('#aq').oninput = e => { f.q = e.target.value; draw(); };
  $('#aa').onchange = e => { f.action = e.target.value; draw(); };
  $('#ax').onclick = () => exportAudit(list().reverse());
  bindExports();
}

/* ---------- settings ---------- */
function renderSettings() {
  const st = db.settings;
  adminShell('settings', pageHead('Settings', 'Settings', '') + `
    <div class="grid g2" style="align-items:start">
      <div class="card"><h3 style="margin-bottom:14px">Safeguarding contact</h3>
        <p class="small muted">Shown to every volunteer under “Worried about a child?”.</p>
        <div class="field"><label class="f">Name / title</label><input class="input" data-s="dsoName" value="${esc(st.dsoName)}"></div>
        <div class="grid g2"><div class="field"><label class="f">Phone</label><input class="input" data-s="dsoPhone" value="${esc(st.dsoPhone)}"></div><div class="field"><label class="f">Email</label><input class="input" data-s="dsoEmail" value="${esc(st.dsoEmail)}"></div></div>
        <h3 style="margin:10px 0 14px">Records</h3>
        <div class="grid g2"><div class="field"><label class="f">“Due soon” warning</label><select class="input" data-s="dueSoonDays" data-num>${[14, 30, 60, 90].map(n => `<option value="${n}" ${st.dueSoonDays === n ? 'selected' : ''}>${n} days before</option>`).join('')}</select></div>
        <div class="field"><label class="f">Keep records for</label><select class="input" data-s="retentionYears" data-num>${[3, 6, 10, 25].map(n => `<option value="${n}" ${st.retentionYears === n ? 'selected' : ''}>${n} years</option>`).join('')}</select><div class="help">Agree this with your data protection lead.</div></div></div>
        <div class="field"><label class="f">Follow-up after 3 failed attempts</label><select class="input" data-s="followUpDays" data-num>${[2, 3, 5, 7, 10].map(n => `<option value="${n}" ${(st.followUpDays || 5) === n ? 'selected' : ''}>Contact within ${n} working days</option>`).join('')}</select><div class="help">This promise is shown to the volunteer, so pick something your team can keep.</div></div>
        <div class="field"><label class="f">Roles</label><input class="input" id="roles" value="${esc(db.roles.join(', '))}"><div class="help">Separate with commas.</div></div>
        <button class="btn red" id="ss">Save settings</button>
      </div>
      <div class="stack">
        <div class="card"><h3 style="margin-bottom:8px">Certificate QR codes</h3>
          <p class="small muted">The address people reach when they scan a certificate. Filled in automatically once the site is on the web.</p>
          <div class="field" style="margin-bottom:10px"><input class="input" data-s="publicUrl" value="${esc(st.publicUrl || '')}" placeholder="${/^https?:/.test(location.protocol) ? esc(location.href.split('#')[0]) : 'https://training.suni.co.uk/'}"></div>
          <button class="btn ghost sm" id="ss2">Save address</button></div>
        <div class="card"><h3 style="margin-bottom:8px">Data</h3><p class="small muted">Download everything, or restore from a backup.</p>
          <div class="row"><button class="btn ghost sm" data-x="backup">${ICON.dl} Download backup</button><button class="btn ghost sm" id="restore">Restore backup…</button></div></div>
        <div class="card"><h3 style="margin-bottom:8px">Demo</h3>
          <label class="row small" style="gap:8px;margin-bottom:12px"><input type="checkbox" id="democtl" ${st.demoControls !== false ? 'checked' : ''} style="accent-color:var(--red);width:18px;height:18px"> Show demo controls (skip video, auto-answer quizzes)</label>
          <p class="small muted">Put the sample volunteers, events and pathways back to how they started.</p><button class="btn ghost sm" id="reset" style="color:var(--red)">Reset demo data</button></div>
      </div>
    </div>`);
  $('#ss').onclick = () => {
    $$('[data-s]').forEach(el => st[el.dataset.s] = el.dataset.num != null ? +el.value : el.value.trim());
    db.roles = $('#roles').value.split(',').map(x => x.trim()).filter(Boolean);
    audit({ actor: 'admin', action: 'settings_saved', detail: { dsoName: st.dsoName, dueSoonDays: st.dueSoonDays, retentionYears: st.retentionYears } });
    toast('Settings saved');
  };
  $('#ss2').onclick = () => { st.publicUrl = $('[data-s=publicUrl]').value.trim(); persist(); toast('Address saved'); };
  $('#democtl').onchange = e => { st.demoControls = e.target.checked; persist(); toast(e.target.checked ? 'Demo controls on' : 'Demo controls off'); };
  $('#reset').onclick = e => { if (!confirmInline(e.currentTarget, 'Click again to reset')) return; Store.clear(); seed(); draft = null; Session.set('admin', { email: ADMIN_DEMO.email, at: now() }); toast('Demo data reset'); go('#/admin'); };
  $('#restore').onclick = () => { const fi = document.createElement('input'); fi.type = 'file'; fi.accept = '.json'; fi.onchange = async () => { try { const d = JSON.parse(await fi.files[0].text()); if (!d.pathways || !d.people) throw 0; db = d; audit({ actor: 'admin', action: 'data_imported', detail: { kind: 'backup' } }); toast('Backup restored'); route(); } catch { toast('That file isn’t a valid backup'); } }; fi.click(); };
  bindExports();
}

/* =====================================================================
   EMAILS & REMINDERS (demo: emails are recorded in the outbox, not sent)
   ===================================================================== */
const MERGE = [['first_name', 'First name'], ['training', 'Training'], ['expiry_date', 'Expiry date'], ['days_left', 'Days left'], ['event', 'Event'], ['event_date', 'Event date'], ['link', 'Their training link'], ['dso_name', 'Safeguarding contact']];
function defaultRules() {
  return [
    { id: 'r-assigned', kind: 'event', trigger: 'assigned', name: 'Training assigned', enabled: true, when: 'As soon as someone is added, or signs up to an event that needs training they haven’t done', subject: 'Your safeguarding training for {event}', body: `Hi {first_name},\n\nThank you for serving with us! Before you join us at {event}, please complete {training}. It takes about 15 minutes and you can stop and come back any time.\n\nIf you have any questions, just reply to this email.` },
    { id: 'r-notstarted', kind: 'time', trigger: 'notstarted', name: 'Not started yet', enabled: true, days: [7], when: 'Days after training was assigned, if they haven’t started', subject: 'A reminder: {training}', body: `Hi {first_name},\n\nJust a gentle reminder that your {training} is still waiting for you. It only takes about 15 minutes.` },
    { id: 'r-expiring', kind: 'time', trigger: 'expiring', name: 'Certificate expiring soon', enabled: true, days: [30, 7], when: 'Days before a certificate expires', subject: 'Your safeguarding certificate expires in {days_left} days', body: `Hi {first_name},\n\nYour {training} certificate runs out on {expiry_date}. Please take a few minutes to refresh it so you can keep serving.` },
    { id: 'r-expired', kind: 'event', trigger: 'expired', name: 'Certificate expired', enabled: true, when: 'On the day a certificate expires', subject: 'Your safeguarding training has expired', body: `Hi {first_name},\n\nYour {training} certificate expired on {expiry_date}. You’ll need to renew it before you next serve with us.` },
    { id: 'r-event', kind: 'time', trigger: 'event', name: 'Event coming up — not ready', enabled: true, days: [30, 14], when: 'Days before an event, to anyone on the team who isn’t ready', subject: '{event} is coming up — your training', body: `Hi {first_name},\n\n{event} starts on {event_date} and we’re looking forward to having you. Your safeguarding training isn’t complete for that date yet — please finish {training} before then.` },
    { id: 'r-locked', kind: 'event', trigger: 'locked', name: 'Quiz locked', enabled: true, when: 'When someone uses all their quiz attempts (copied to the safeguarding contact)', subject: 'Your safeguarding quiz — we’ll be in touch', body: `Hi {first_name},\n\nThanks for working through {training}. As you’ve used all your quiz attempts, {dso_name} will be in touch within a few days for a short chat, then we’ll reopen it for you. Nothing else to do for now.` },
    { id: 'r-complete', kind: 'event', trigger: 'complete', name: 'Training complete', enabled: true, when: 'When someone signs off their training', subject: 'Thank you — {training} complete', body: `Hi {first_name},\n\nThank you for completing {training}. Your certificate is valid until {expiry_date} and you can view or download it any time from your training page.` },
  ];
}
const RULE = id => (db.emailRules ||= defaultRules()).find(r => r.id === id);
const trainLink = p => (publicBase() || location.href.split('#')[0]) + '#/i/' + p.token;
function mergeText(t, p, ctx = {}) {
  const v = { first_name: firstName(p.name), name: p.name, training: ctx.training || requiredPathwaysFor(p).map(x => x.title).join(' and ') || 'your safeguarding training', expiry_date: ctx.expiry ? fmtDate(ctx.expiry) : '', days_left: ctx.daysLeft ?? '', event: ctx.event?.name || p.eventIds.map(id => EventById(id)?.name).filter(Boolean)[0] || 'SUNI', event_date: ctx.event ? fmtDate(ctx.event.date) : '', link: trainLink(p), dso_name: db.settings.dsoName || 'our safeguarding team' };
  return String(t).replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
}
function emailHTML(subject, body, p) {
  const paras = esc(body).split(/\n\n+/).map(x => `<p>${x.replace(/\n/g, '<br>')}</p>`).join('');
  return `<div class="em"><div class="em-head">${LOGO(34)}</div><div class="em-bar"></div><div class="em-body"><h2>${esc(subject)}</h2>${paras}
    <a class="em-btn" href="${esc(trainLink(p))}" target="_blank" rel="noopener">Go to my training</a>
    <p class="em-small">Or copy this link: ${esc(trainLink(p))}</p></div>
    <div class="em-foot">Scripture Union Northern Ireland · Charity NIC104852<br>You’re getting this because you’re serving with SUNI. Questions? Just reply.</div></div>`;
}
/* who is due each automatic reminder right now */
function dueFor(rule) {
  const out = []; const sent = new Set((db.outbox || []).map(o => o.key).filter(Boolean)); const now = Date.now();
  const add = (p, ctx, key) => { if (!sent.has(key)) out.push({ p, ctx, key }); };
  live().forEach(p => requiredPathwaysFor(p).forEach(pw => {
    const st = statusOf(p, pw), c = latestCompletion(p.id, pw.id);
    if (rule.trigger === 'expiring' && c && !c.expiresAt.startsWith('9999')) { const dl = Math.ceil((new Date(c.expiresAt) - now) / DAY); const th = [...rule.days].sort((a, b) => a - b).find(d => dl > 0 && dl <= d); if (th != null) add(p, { training: pw.title, expiry: c.expiresAt, daysLeft: dl }, `${rule.id}|${p.id}|${c.id}|${th}`); }
    if (rule.trigger === 'expired' && st.key === 'expired' && st.c) add(p, { training: pw.title, expiry: st.c.expiresAt }, `${rule.id}|${p.id}|${st.c.id}`);
    if (rule.trigger === 'notstarted' && st.key === 'none' && now - new Date(p.createdAt) > rule.days[0] * DAY) add(p, { training: pw.title }, `${rule.id}|${p.id}|${pw.id}`);
    if (rule.trigger === 'locked' && st.key === 'locked') add(p, { training: pw.title }, `${rule.id}|${p.id}|${pw.id}|${lockInfo(p, pw)?.lockedAt || ''}`);
  }));
  if (rule.trigger === 'event') db.events.forEach(ev => { const dl = Math.ceil((new Date(ev.date) - now) / DAY); const th = [...rule.days].sort((a, b) => a - b).find(d => dl > 0 && dl <= d); if (th == null) return;
    live().filter(p => p.eventIds.includes(ev.id) && eventState(p, ev) !== 'ready').forEach(p => add(p, { event: ev, training: ev.requiredPathways.map(id => P(id)?.title).filter(Boolean).join(' and '), daysLeft: dl }, `${rule.id}|${p.id}|${ev.id}|${th}`)); });
  // one email per person per rule run
  const seen = new Set(); return out.filter(x => !seen.has(x.p.id) && seen.add(x.p.id));
}
function sendEmails(items, { subject, body, source, ruleId = null }) {
  db.outbox ||= []; const at = now();
  items = items.filter(({ p }) => p && !p.archived);   // archived volunteers are never emailed
  items.forEach(({ p, ctx = {}, key }) => {
    const sj = mergeText(subject, p, ctx), bd = mergeText(body, p, ctx);
    db.outbox.push({ id: uid('m_'), at, to: p.email, personId: p.id, subject: sj, body: bd, source, ruleId, key: key || null, by: source === 'automatic' ? 'system' : db.settings.adminName });
    db.audit.push({ id: uid('a_'), at, personId: p.id, actor: source === 'automatic' ? 'system' : 'admin', action: 'email_sent', detail: { name: p.name, subject: sj, source, rule: ruleId && RULE(ruleId)?.name } });
  });
  persist(); if (items.length) mailPop(db.outbox.slice(-items.length)); return items.length;
}
/* demo: show sent emails in the browser */
function mailPop(msgs) {
  let wrap = $('#mailpops'); if (!wrap) { wrap = document.createElement('div'); wrap.id = 'mailpops'; document.body.appendChild(wrap); }
  const m = msgs[msgs.length - 1], p = Person(m.personId);
  const el = document.createElement('div'); el.className = 'mailpop';
  el.innerHTML = `<div class="mp-ic">${ICON.mail}</div><div class="mp-txt"><div class="mp-k">${msgs.length > 1 ? `${msgs.length} emails sent` : `Email sent · ${m.source === 'automatic' ? 'automatic' : 'just now'}`}</div><b>${esc(m.subject)}</b><div class="tiny muted">To ${esc(p?.name || m.to)}${msgs.length > 1 ? ` and ${msgs.length - 1} more` : ''}</div>
    <div class="row" style="gap:6px;margin-top:8px"><button class="btn red xs" data-mpv>Preview</button>${p ? `<button class="btn ghost xs" data-mpi>Open ${esc(firstName(p.name))}’s inbox</button>` : ''}</div></div><button class="iconbtn mp-x" aria-label="Dismiss">${ICON.x}</button>`;
  wrap.prepend(el); while (wrap.children.length > 3) wrap.lastChild.remove();
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  const t = setTimeout(kill, 9000); el.onmouseenter = () => clearTimeout(t);
  $('.mp-x', el).onclick = kill; $('[data-mpv]', el).onclick = () => { kill(); viewEmail(m); };
  $('[data-mpi]', el) && ($('[data-mpi]', el).onclick = () => { kill(); go('#/inbox/' + p.token + '/' + m.id); });
}
/* demo: a mail-app style inbox for one person */
function renderInbox(token, mid) {
  const p = db.people.find(x => x.token === token); if (!p) return go('#/');
  const mails = (db.outbox || []).filter(m => m.personId === p.id).slice().reverse();
  const cur = mails.find(m => m.id === mid) || mails[0];
  const read = (db.readMail ||= {});
  if (cur) { read[cur.id] = 1; persist(); }
  app().innerHTML = `<div class="inbox"><header class="ib-top"><div class="row" style="gap:12px">${ICON.mail.replace('<svg', '<svg width="22" height="22"')}<b>Inbox</b><span class="muted small">${esc(p.email)}</span></div>
      <div class="row" style="gap:8px"><span class="tag" style="background:var(--amber-50)">Demo inbox — not a real mailbox</span><a class="btn ghost sm" href="${isAdmin() ? '#/admin/people/' + p.id : '#/me'}" data-back="${isAdmin() ? '#/admin/people/' + p.id : '#/me'}">${ICON.back} Back</a></div></header>
    <div class="ib-body"><aside class="ib-list">${mails.map(m => `<a class="ib-item ${cur && m.id === cur.id ? 'on' : ''} ${read[m.id] ? '' : 'unread'}" href="#/inbox/${p.token}/${m.id}"><div class="row between"><b>Scripture Union NI</b><span class="tiny muted">${fmtDate(m.at)}</span></div><div class="ib-sub">${esc(m.subject)}</div><div class="ib-snip">${esc(m.body.replace(/\s+/g, ' ').slice(0, 90))}…</div></a>`).join('') || '<div class="empty">No emails yet.<br><span class="small">Send a reminder from the admin area to see one arrive.</span></div>'}</aside>
      <main class="ib-read">${cur ? `<div class="ib-meta"><h2>${esc(cur.subject)}</h2><div class="small muted">From <b>Scripture Union NI</b> &lt;training@suni.co.uk&gt; · to ${esc(p.name)} · ${fmtDT(cur.at)}</div></div>${emailHTML(cur.subject, cur.body, p)}` : ''}</main></div></div>` + demobar('');
  const btn = $('.ib-read .em-btn'); if (btn) { btn.removeAttribute('target'); btn.setAttribute('href', '#/i/' + p.token); }
}
/* fire an event-based rule straight away (called from actions around the app) */
function autoEmail(trigger, p, ctx = {}) {
  const r = (db.emailRules || []).find(x => x.trigger === trigger); if (!r || !r.enabled || !p) return;
  sendEmails([{ p, ctx, key: `${r.id}|${p.id}|${ctx.key || now()}` }], { subject: r.subject, body: r.body, source: 'automatic', ruleId: r.id });
}
/* pick the right one-click reminder for someone's situation */
function reminderFor(p) {
  const req = requiredPathwaysFor(p); const sts = req.map(pw => ({ pw, st: statusOf(p, pw) }));
  const pick = k => sts.find(x => x.st.key === k);
  let x;
  if ((x = pick('expired'))) return { rule: RULE('r-expired'), ctx: { training: x.pw.title, expiry: x.st.c?.expiresAt } };
  if ((x = pick('due'))) return { rule: RULE('r-expiring'), ctx: { training: x.pw.title, expiry: x.st.c.expiresAt, daysLeft: Math.ceil((new Date(x.st.c.expiresAt) - Date.now()) / DAY) } };
  if ((x = pick('none') || pick('progress'))) { const ev = p.eventIds.map(EventById).find(e => e && e.requiredPathways.includes(x.pw.id)); return { rule: ev ? RULE('r-event') : RULE('r-notstarted'), ctx: { training: x.pw.title, event: ev } }; }
  if ((x = pick('locked'))) return null;
  return null;
}
function sendReminder(p) {
  const r = reminderFor(p);
  if (!r) { toast(requiredPathwaysFor(p).length ? `${firstName(p.name)} is up to date — nothing to remind` : 'No training assigned'); return; }
  sendEmails([{ p, ctx: r.ctx }], { subject: r.rule.subject, body: r.rule.body, source: 'manual', ruleId: r.rule.id });
  toast(`Reminder sent to ${p.name}`);
}
/* compose / bulk send */
function composeEmail(people, { title = 'Email people', ruleId = '', ctxFor = () => ({}), note = '' } = {}) {
  if (!people.length) { toast('No one to email'); return; }
  let rid = ruleId || 'custom'; let subj = '', body = '';
  const load = () => { const r = RULE(rid); subj = r ? r.subject : 'News about your safeguarding training'; body = r ? r.body : `Hi {first_name},\n\n`; };
  load();
  const s = modal(`<header><div><div class="eyebrow">${people.length} ${people.length === 1 ? 'person' : 'people'}</div><h2 style="margin-top:4px">${esc(title)}</h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body compose">
      <div>
        ${note ? `<div class="notice info small" style="margin-bottom:12px">${ICON.info}<div>${note}</div></div>` : ''}
        <div class="recips">${people.slice(0, 8).map(p => `<span class="tag">${esc(p.name)}</span>`).join('')}${people.length > 8 ? `<span class="tag">+${people.length - 8} more</span>` : ''}</div>
        <div class="field"><label class="f">Template</label><select class="input" id="ctpl"><option value="custom">Custom message</option>${db.emailRules.map(r => `<option value="${r.id}" ${rid === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
        <div class="field"><label class="f">Subject</label><input class="input" id="csub"></div>
        <div class="field"><label class="f">Message</label><textarea class="input" id="cbody" style="min-height:200px"></textarea>
          <div class="mergechips">${MERGE.map(([k, l]) => `<button type="button" data-merge="${k}" title="Insert ${l}">{${k}}</button>`).join('')}</div></div>
      </div>
      <div><div class="tiny muted" style="margin-bottom:6px">Preview for <select id="cwho" class="input" style="display:inline-block;width:auto;padding:4px 30px 4px 8px;font-size:13px">${people.slice(0, 30).map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('')}</select></div><div id="cprev"></div></div>
    </div>
    <footer><span class="small muted" style="margin-right:auto;align-self:center">Demo: recorded in the email log, not actually sent</span><button class="btn ghost" data-close>Cancel</button><button class="btn red" id="csend">Send to ${people.length} ${people.length === 1 ? 'person' : 'people'}</button></footer>`, 'wide');
  const fill = () => { $('#csub', s).value = subj; $('#cbody', s).value = body; prev(); };
  const prev = () => { const p = people[+$('#cwho', s).value || 0]; $('#cprev', s).innerHTML = emailHTML(mergeText($('#csub', s).value, p, ctxFor(p)), mergeText($('#cbody', s).value, p, ctxFor(p)), p); };
  fill();
  $('#ctpl', s).onchange = e => { rid = e.target.value; load(); fill(); };
  $('#csub', s).oninput = prev; $('#cbody', s).oninput = prev; $('#cwho', s).onchange = prev;
  $$('[data-merge]', s).forEach(b => b.onclick = () => { const ta = $('#cbody', s), t = `{${b.dataset.merge}}`, i = ta.selectionStart ?? ta.value.length; ta.value = ta.value.slice(0, i) + t + ta.value.slice(ta.selectionEnd ?? i); ta.focus(); ta.selectionStart = ta.selectionEnd = i + t.length; prev(); });
  $('#csend', s).onclick = () => { const sj = $('#csub', s).value.trim(), bd = $('#cbody', s).value.trim(); if (!sj || !bd) { toast('Add a subject and message'); return; }
    const n = sendEmails(people.map(p => ({ p, ctx: ctxFor(p) })), { subject: sj, body: bd, source: rid === 'custom' ? 'ad-hoc' : 'manual', ruleId: rid === 'custom' ? null : rid });
    audit({ actor: 'admin', action: 'emails_sent', detail: { count: n, subject: sj, template: rid === 'custom' ? 'Custom' : RULE(rid)?.name } });
    closeModal(); toast(`${n} email${n === 1 ? '' : 's'} sent`); route(); };
}
function viewEmail(m) {
  const p = Person(m.personId) || { name: m.to, token: '' };
  modal(`<header><div><div class="eyebrow">${m.source === 'automatic' ? 'Automatic · ' + esc(RULE(m.ruleId)?.name || '') : m.source === 'ad-hoc' ? 'Ad-hoc email' : 'Sent by ' + esc(m.by)}</div><h2 style="margin-top:4px">${esc(m.subject)}</h2><div class="small muted">To ${esc(p.name)} &lt;${esc(m.to)}&gt; · ${fmtDT(m.at)}</div></div><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body">${emailHTML(m.subject, m.body, p)}</div><footer><button class="btn ghost" data-close>Close</button></footer>`, 'wide');
}
let outboxShown = 30, outboxQ = '';
function renderEmails() {
  db.emailRules ||= defaultRules(); db.outbox ||= [];
  const due = Object.fromEntries(db.emailRules.filter(r => r.kind === 'time' || ['expired', 'locked'].includes(r.trigger)).map(r => [r.id, r.enabled ? dueFor(r) : []]));
  const totalDue = Object.values(due).reduce((n, l) => n + l.length, 0);
  adminShell('emails', pageHead('Emails', 'Emails & reminders', 'Automatic reminders go out on their own; you can also send one-off emails to anyone.',
    `<button class="btn ghost sm" id="ecomp">✉️ Compose email</button><button class="btn red sm" id="erun" ${totalDue ? '' : 'disabled'}>Send due reminders (${totalDue})</button>`) + `
    <div class="notice info small" style="margin-bottom:18px">${ICON.info}<div><b>Demo:</b> emails are recorded in the log below but not actually sent. In the live version, automatic reminders run every morning and send through an email service (e.g. Postmark or Resend).</div></div>
    <h2 style="margin-bottom:12px">Automatic reminders</h2>
    <div class="grid g2" style="margin-bottom:28px">${db.emailRules.map(r => `<div class="card rulecard ${r.enabled ? '' : 'off'}">
      <div class="row between" style="align-items:flex-start;flex-wrap:nowrap;gap:14px"><div><div class="row" style="gap:8px"><span class="tag" style="background:${r.kind === 'time' ? 'var(--sky-50)' : 'var(--plum-50)'};color:${r.kind === 'time' ? '#2F7C84' : 'var(--plum)'}">${r.kind === 'time' ? 'Time-based' : 'When it happens'}</span></div>
        <h3 style="margin:8px 0 4px">${esc(r.name)}</h3><div class="small muted">${esc(r.when)}${r.days ? `: <b style="color:var(--ink)">${r.days.map(d => d + (r.trigger === 'notstarted' ? ' days after' : ' days before')).join(', ')}</b>` : ''}</div></div>
        <label class="switch"><input type="checkbox" data-rtog="${r.id}" ${r.enabled ? 'checked' : ''}><span></span></label></div>
      <div class="small" style="margin-top:12px;padding:10px 12px;background:#FBFAF8;border-radius:10px"><span class="muted">Subject:</span> ${esc(r.subject)}</div>
      <div class="row between" style="margin-top:12px">${due[r.id] ? `<span class="small ${due[r.id].length ? '' : 'muted'}">${due[r.id].length ? `<b>${due[r.id].length}</b> due now` : 'No one due right now'}</span>` : `<span class="small muted">Sends automatically</span>`}
        <div class="row" style="gap:6px">${due[r.id]?.length ? `<button class="btn soft xs" data-rsend="${r.id}">Send ${due[r.id].length}</button>` : ''}<button class="btn ghost xs" data-redit="${r.id}">Edit</button></div></div></div>`).join('')}</div>
    <div class="row between" style="margin-bottom:12px"><h2>Sent <span class="muted" style="font-weight:600;font-size:18px">(${db.outbox.length})</span></h2><input class="input" id="eq" placeholder="Search name or subject…" value="${esc(outboxQ)}" style="width:240px;padding:9px 14px"></div>
    <div id="elog"></div>`);
  const draw = () => { const list = db.outbox.slice().reverse().filter(m => !outboxQ || (m.to + ' ' + m.subject + ' ' + (Person(m.personId)?.name || '')).toLowerCase().includes(outboxQ.toLowerCase()));
    $('#elog').innerHTML = `<div class="tablewrap"><table class="clickable"><thead><tr><th>Sent</th><th>To</th><th>Subject</th><th>Type</th></tr></thead><tbody>${list.slice(0, outboxShown).map((m, i) => `<tr data-mail="${m.id}"><td class="nowrap small">${fmtDT(m.at)}</td><td><b>${esc(Person(m.personId)?.name || m.to)}</b><br><span class="tiny muted">${esc(m.to)}</span></td><td>${esc(m.subject)}</td><td>${m.source === 'automatic' ? `<span class="tag" style="background:var(--sky-50)">Auto · ${esc(RULE(m.ruleId)?.name || '')}</span>` : m.source === 'ad-hoc' ? '<span class="tag" style="background:var(--plum-50)">Ad-hoc</span>' : `<span class="tag">Manual${m.ruleId ? ' · ' + esc(RULE(m.ruleId)?.name || '') : ''}</span>`}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Nothing sent yet</td></tr>'}</tbody></table></div>
      ${list.length > outboxShown ? `<div class="row" style="justify-content:center;margin-top:12px"><button class="btn ghost sm" id="emore">Show more</button></div>` : ''}`;
    $$('[data-mail]').forEach(tr => tr.onclick = () => viewEmail(db.outbox.find(m => m.id === tr.dataset.mail)));
    $('#emore') && ($('#emore').onclick = () => { outboxShown += 30; draw(); }); };
  draw();
  $('#eq').oninput = e => { outboxQ = e.target.value; outboxShown = 30; draw(); };
  $$('[data-rtog]').forEach(t => t.onchange = () => { const r = RULE(t.dataset.rtog); r.enabled = t.checked; audit({ actor: 'admin', action: 'settings_saved', detail: { reminder: r.name, enabled: r.enabled } }); toast(`${r.name}: ${r.enabled ? 'on' : 'off'}`); renderEmails(); });
  $$('[data-redit]').forEach(b => b.onclick = () => editRule(RULE(b.dataset.redit)));
  $$('[data-rsend]').forEach(b => b.onclick = () => { const r = RULE(b.dataset.rsend); const n = sendEmails(due[r.id], { subject: r.subject, body: r.body, source: 'automatic', ruleId: r.id }); audit({ actor: 'admin', action: 'emails_sent', detail: { count: n, template: r.name } }); toast(`${n} “${r.name}” email${n === 1 ? '' : 's'} sent`); renderEmails(); });
  $('#erun').onclick = () => { let n = 0; db.emailRules.forEach(r => { if (due[r.id]?.length) n += sendEmails(due[r.id], { subject: r.subject, body: r.body, source: 'automatic', ruleId: r.id }); }); audit({ actor: 'admin', action: 'emails_sent', detail: { count: n, template: 'All due reminders' } }); toast(`${n} reminder${n === 1 ? '' : 's'} sent`); renderEmails(); };
  $('#ecomp').onclick = () => { const s = modal(`<header><h2>Who should get this email?</h2><button class="iconbtn" data-close>${ICON.x}</button></header><div class="body stack">
      ${[['all', 'Everyone (active)', live().length], ['attention', 'Anyone needing attention (expired, due soon, locked)', live().filter(p => requiredPathwaysFor(p).some(pw => ['expired', 'due', 'locked'].includes(statusOf(p, pw).key))).length], ['notdone', 'Anyone not fully trained', live().filter(p => !personCompliant(p)).length], ...db.events.map(e => ['ev:' + e.id, `Team: ${e.name}`, live().filter(p => p.eventIds.includes(e.id)).length]), ...TYPES.map(([k, l]) => ['type:' + k, l, live().filter(p => typeOf(p) === k).length])].map(([k, l, n]) => `<button class="radiorow" data-aud="${k}" style="width:100%;text-align:left;background:#fff"><span style="flex:1"><b>${esc(l)}</b></span><span class="tag">${n}</span></button>`).join('')}
      <p class="tiny muted">Tip: you can also email any filtered list from the People page.</p></div>`);
    $$('[data-aud]', s).forEach(b => b.onclick = () => { const k = b.dataset.aud; const ppl = k === 'all' ? live() : k === 'attention' ? live().filter(p => requiredPathwaysFor(p).some(pw => ['expired', 'due', 'locked'].includes(statusOf(p, pw).key))) : k === 'notdone' ? live().filter(p => !personCompliant(p)) : k.startsWith('ev:') ? live().filter(p => p.eventIds.includes(k.slice(3))) : live().filter(p => typeOf(p) === k.slice(5));
      const ev = k.startsWith('ev:') && EventById(k.slice(3)); closeModal(); composeEmail(ppl, { title: b.textContent.trim().replace(/\d+$/, ''), ctxFor: ev ? () => ({ event: ev }) : () => ({}) }); }); };
}
function editRule(r) {
  const p = live()[0];
  const s = modal(`<header><div><div class="eyebrow">${r.kind === 'time' ? 'Time-based reminder' : 'Sent when it happens'}</div><h2 style="margin-top:4px">${esc(r.name)}</h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body compose"><div>
      <p class="small muted" style="margin-top:0">${esc(r.when)}.</p>
      ${r.days ? `<div class="field"><label class="f">${r.trigger === 'notstarted' ? 'Send after (days)' : 'Send (days before)'}</label><input class="input" id="rdays" value="${r.days.join(', ')}" placeholder="e.g. 30, 7"><div class="help">Separate several with commas — each person gets one email at each point.</div></div>` : ''}
      <div class="field"><label class="f">Subject</label><input class="input" id="rsub" value="${esc(r.subject)}"></div>
      <div class="field"><label class="f">Message</label><textarea class="input" id="rbody" style="min-height:200px">${esc(r.body)}</textarea><div class="mergechips">${MERGE.map(([k, l]) => `<button type="button" data-merge="${k}" title="Insert ${l}">{${k}}</button>`).join('')}</div></div>
    </div><div><div class="tiny muted" style="margin-bottom:6px">Preview (${esc(p?.name || '')})</div><div id="rprev"></div></div></div>
    <footer><button class="btn ghost" data-close>Cancel</button><button class="btn red" id="rsave">Save</button></footer>`, 'wide');
  const ctx = { training: 'Safeguarding Essentials', expiry: addMonths(now(), 1), daysLeft: 30, event: db.events[0] };
  const prev = () => { $('#rprev', s).innerHTML = emailHTML(mergeText($('#rsub', s).value, p, ctx), mergeText($('#rbody', s).value, p, ctx), p); };
  prev(); $('#rsub', s).oninput = prev; $('#rbody', s).oninput = prev;
  $$('[data-merge]', s).forEach(b => b.onclick = () => { const ta = $('#rbody', s), t = `{${b.dataset.merge}}`, i = ta.selectionStart ?? ta.value.length; ta.value = ta.value.slice(0, i) + t + ta.value.slice(ta.selectionEnd ?? i); ta.focus(); prev(); });
  $('#rsave', s).onclick = () => { if ($('#rdays', s)) { const d = $('#rdays', s).value.split(/[,\s]+/).map(Number).filter(n => n > 0); if (!d.length) { toast('Add at least one number of days'); return; } r.days = [...new Set(d)].sort((a, b) => b - a); }
    r.subject = $('#rsub', s).value.trim(); r.body = $('#rbody', s).value; audit({ actor: 'admin', action: 'settings_saved', detail: { reminder: r.name, days: r.days, subject: r.subject } }); closeModal(); toast('Reminder saved'); renderEmails(); };
}

/* =====================================================================
   VOLUNTEER LIFECYCLE  ·  RETENTION  ·  IMPORT / EXPORT
   ===================================================================== */
const YEAR = 365.25 * DAY;
const retentionYears = () => db.settings.retentionYears || 5;
const retentionCutoff = () => new Date(Date.now() - retentionYears() * YEAR).toISOString();
function signOutIfCurrent(p) { const s = Session.get('vol'); if (s && s.volunteer_id === p.id) Session.clear('vol'); }

function archiveVolunteer(p, reason = '') {
  p.archived = true; p.archivedAt = now(); signOutIfCurrent(p);
  audit({ actor: 'admin', action: 'volunteer_archived', personId: p.id, detail: { name: p.name, reason } });
}
/* remove one volunteer's training records older than the retention period */
function purgeOldRecords(personId) {
  const cut = retentionCutoff(); const old = db.completions.filter(c => c.personId === personId && c.completedAt < cut);
  if (old.length) db.completions = db.completions.filter(c => !old.includes(c));
  return old;
}
function reactivationPreview(p) {
  const cut = retentionCutoff(); const mine = db.completions.filter(c => c.personId === p.id);
  return { keep: mine.filter(c => c.completedAt >= cut), purge: mine.filter(c => c.completedAt < cut) };
}
function reactivateVolunteer(p, source = 'admin') {
  const removed = purgeOldRecords(p.id);
  p.archived = false; p.archivedAt = null;
  audit({ actor: 'admin', action: 'volunteer_reactivated', personId: p.id, detail: { name: p.name, source, records_kept: db.completions.filter(c => c.personId === p.id).length, records_removed: removed.length, modules_removed: removed.map(c => c.pathwayTitle) } });
  return removed;
}
/* permanent erasure: volunteer row, training records, progress, emails, links and their audit trail */
function deleteVolunteer(p, reason = 'Admin request', actor = 'admin') {
  const recs = db.completions.filter(c => c.personId === p.id).length, logs = db.audit.filter(a => a.personId === p.id).length;
  db.people = db.people.filter(x => x !== p);
  db.completions = db.completions.filter(c => c.personId !== p.id);
  delete db.progress[p.id];
  db.outbox = (db.outbox || []).filter(m => m.personId !== p.id);
  db.magicLinks = (db.magicLinks || []).filter(l => l.volunteer_id !== p.id);
  db.audit = db.audit.filter(a => a.personId !== p.id);
  signOutIfCurrent(p);
  // the deletion itself is logged, without any personal data
  audit({ actor, action: 'volunteer_deleted', detail: { ref: 'vol-' + hash(p.id), records_deleted: recs, audit_entries_deleted: logs, reason } });
  return { recs, logs };
}
function confirmReactivate(p, after) {
  const { keep, purge } = reactivationPreview(p);
  const s = modal(`<header><div><div class="eyebrow">Reactivate volunteer</div><h2 style="margin-top:4px">${esc(p.name)}</h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body"><p>${esc(firstName(p.name))} will be able to sign in again and will get training reminders. Archived ${fmtDate(p.archivedAt)}.</p>
      <div class="lifebox ok"><b>${keep.length} training record${keep.length === 1 ? '' : 's'} kept</b> <span class="small muted">— completed in the last ${retentionYears()} years</span>${keep.map(c => `<div class="small">✓ ${esc(c.pathwayTitle)} · ${fmtDate(c.completedAt)}${new Date(c.expiresAt) < new Date() ? ' <span class="muted">(expired — will need renewing)</span>' : ''}</div>`).join('')}</div>
      ${purge.length ? `<div class="lifebox bad"><b>${purge.length} older record${purge.length === 1 ? '' : 's'} removed</b> <span class="small muted">— over ${retentionYears()} years old (UK GDPR storage limitation)</span>${purge.map(c => `<div class="small">✗ ${esc(c.pathwayTitle)} · ${fmtDate(c.completedAt)}</div>`).join('')}<div class="tiny muted" style="margin-top:6px">Those modules will show as incomplete so ${esc(firstName(p.name))} knows to renew them.</div></div>` : ''}</div>
    <footer><button class="btn ghost" data-close>Cancel</button><button class="btn teal" id="rgo">Reactivate ${esc(firstName(p.name))}</button></footer>`);
  $('#rgo', s).onclick = () => { const removed = reactivateVolunteer(p); closeModal(); toast(`${p.name} reactivated${removed.length ? ` · ${removed.length} old record${removed.length === 1 ? '' : 's'} removed` : ''}`); after ? after() : route(); };
}
function confirmDelete(p, after) {
  const recs = db.completions.filter(c => c.personId === p.id).length, logs = db.audit.filter(a => a.personId === p.id).length;
  const s = modal(`<header><div><div class="eyebrow" style="color:var(--red)">Permanent deletion</div><h2 style="margin-top:4px">Delete ${esc(p.name)}?</h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body"><div class="notice bad">${ICON.info}<div><b>This can’t be undone.</b> It permanently erases ${esc(firstName(p.name))}’s volunteer record, <b>${recs} training record${recs === 1 ? '' : 's'}</b>, quiz attempts, emails and <b>their audit trail (${logs} entr${logs === 1 ? 'y' : 'ies'})</b>. Only an anonymous “volunteer deleted” entry is kept.</div></div>
      <p class="small muted">If they’ve simply stopped serving, <b>archive</b> them instead — that keeps their records for the ${retentionYears()}-year safeguarding audit, and they’re deleted automatically afterwards.</p>
      <div class="field"><label class="f">Type their email address to confirm</label><input class="input" id="dconf" placeholder="${esc(p.email)}" autocomplete="off"></div>
      <div class="field"><label class="f">Reason</label><select class="input" id="dreason"><option>Erasure request from the volunteer</option><option>Added by mistake / duplicate</option><option>Other</option></select></div></div>
    <footer><button class="btn ghost" data-close>Cancel</button><button class="btn red" id="dgo" disabled>Delete permanently</button></footer>`);
  $('#dconf', s).oninput = e => { $('#dgo', s).disabled = e.target.value.trim().toLowerCase() !== p.email.toLowerCase(); };
  $('#dgo', s).onclick = () => { const r = deleteVolunteer(p, $('#dreason', s).value); closeModal(); toast(`${p.name} deleted · ${r.recs} records and ${r.logs} audit entries erased`); after ? after() : go('#/admin/people'); };
}

/* ---------- rolling 5-year cleanup (UK GDPR storage limitation) ---------- */
function retentionDue() {
  const cut = retentionCutoff();
  const vols = db.people.filter(p => p.archived && p.archivedAt && p.archivedAt < cut);
  const gone = new Set(vols.map(p => p.id));
  const records = db.completions.filter(c => c.completedAt < cut && !gone.has(c.personId));
  const logs = db.audit.filter(a => a.at < cut && !gone.has(a.personId));
  return { cut, vols, records, logs };
}
function runCleanup(source = 'manual') {
  const d = retentionDue();
  d.vols.forEach(p => deleteVolunteer(p, `Archived over ${retentionYears()} years ago`, 'system'));
  const rset = new Set(d.records.map(c => c.id)); db.completions = db.completions.filter(c => !rset.has(c.id));
  const lset = new Set(d.logs.map(a => a.id)); db.audit = db.audit.filter(a => !lset.has(a.id));
  db.settings.lastCleanup = new Date().toISOString().slice(0, 10);
  audit({ actor: 'system', action: 'retention_cleanup', detail: { source, cutoff: d.cut.slice(0, 10), volunteers_deleted: d.vols.length, records_removed: d.records.length, audit_entries_removed: d.logs.length } });
  return { vols: d.vols.length, records: d.records.length, logs: d.logs.length };
}
/* simulated daily job — runs once per day when the app opens */
function dailyCleanup() {
  const today = new Date().toISOString().slice(0, 10);
  if (!db.settings.autoCleanup || db.settings.lastCleanup === today) return;
  const r = runCleanup('automatic daily job');
  if (r.vols + r.records + r.logs) setTimeout(() => toast(`Daily data cleanup: ${r.records} old record${r.records === 1 ? '' : 's'} and ${r.vols} archived volunteer${r.vols === 1 ? '' : 's'} removed`), 800);
}

/* ---------- audit report (CSV) ---------- */
function exportAuditReport() {
  const rows = [['volunteer_id', 'first_name', 'last_name', 'email', 'status', 'created_at', 'archived_at', 'module_name', 'completed_at', 'expires_at', 'certificate_id', 'record_status']];
  [...db.people].sort((a, b) => (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name)).forEach(p => {
    const recs = db.completions.filter(c => c.personId === p.id).sort((a, b) => a.completedAt.localeCompare(b.completedAt));
    const base = [p.id, p.first_name, p.last_name, p.email, p.archived ? 'archived' : 'active', p.createdAt, p.archivedAt || ''];
    if (!recs.length) rows.push([...base, '', '', '', '', 'no training records']);
    recs.forEach(c => rows.push([...base, c.pathwayTitle, c.completedAt, c.expiresAt.startsWith('9999') ? '' : c.expiresAt, c.id, c.revoked ? (c.revoked.replacedBy ? 'replaced' : 'revoked') : new Date(c.expiresAt) > new Date() ? 'valid' : 'expired']));
  });
  download(`SUNI-safeguarding-audit-report-${stamp()}.csv`, csv(rows));
  audit({ actor: 'admin', action: 'report_exported', detail: { report: 'Audit report (CSV)', rows: rows.length - 1 } });
  toast(`Audit report downloaded (${rows.length - 1} rows)`);
}

/* ---------- CSV bulk import (first_name, last_name, email) ---------- */
const SAMPLE_IMPORT = () => ['first_name,last_name,email', 'Sam,Irwin,sam.irwin@example.com', 'Niamh,Doherty,niamh.doherty@example.com', `Hannah,Doyle-Reid,hannah.doyle@example.com`, 'Laura,Kerr,laura.kerr@example.com', 'Ben,Hutchinson,ben.hutchinson@example', ',Smith,j.smith@example.com', 'Sam,Irwin,SAM.IRWIN@example.com'].join('\n');
function importPeople() {
  const s = modal(`<header><div><div class="eyebrow">Bulk import</div><h2 style="margin-top:4px">Import volunteers from CSV</h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
  <div class="body" id="imbody"><p class="muted small" style="margin-top:0">Columns: <code>first_name, last_name, email</code> (optional: <code>roles</code>, <code>events</code> — separate several with <code>;</code>). Existing emails are updated — their training history is never touched. Archived volunteers in the file can be reactivated.</p>
    <div class="dropzone" id="dz"><b>Drop a CSV file here</b> or click to choose<input type="file" accept=".csv,text/csv" hidden id="fi"></div>
    <div class="row" style="margin-top:12px;gap:8px"><button class="btn ghost xs" id="tpl">${ICON.dl} Blank template</button><button class="btn ghost xs" id="smp">${ICON.dl} Sample file</button><button class="btn soft xs" id="smpgo">Try the sample now</button></div></div>`, 'wide');
  const dz = $('#dz', s), fi = $('#fi', s);
  dz.onclick = () => fi.click(); dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = e => { e.preventDefault(); e.dataTransfer.files[0] && e.dataTransfer.files[0].text().then(t => previewImport(t, e.dataTransfer.files[0].name)); };
  fi.onchange = () => fi.files[0] && fi.files[0].text().then(t => previewImport(t, fi.files[0].name));
  $('#tpl', s).onclick = () => download('volunteer-import-template.csv', 'first_name,last_name,email\n');
  $('#smp', s).onclick = () => download('volunteer-import-sample.csv', SAMPLE_IMPORT());
  $('#smpgo', s).onclick = () => previewImport(SAMPLE_IMPORT(), 'volunteer-import-sample.csv');
}
function analyseImport(text) {
  const rows = parseCSV(text.replace(/^﻿/, '')).filter(r => r.some(c => c.trim()));
  if (!rows.length) return { error: 'The file is empty.' };
  const head = rows.shift().map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const need = ['first_name', 'last_name', 'email'].filter(c => !head.includes(c));
  if (need.length) return { error: `Missing column${need.length > 1 ? 's' : ''}: ${need.join(', ')}. The first row must be the column names.` };
  const seen = new Set(), out = { create: [], update: [], same: [], reactivate: [], invalid: [] };
  rows.forEach((r, i) => {
    const o = Object.fromEntries(head.map((h, k) => [h, (r[k] || '').trim()])); const line = i + 2;
    const email = o.email.toLowerCase();
    if (!o.first_name || !o.last_name) return out.invalid.push({ line, o, why: 'First and last name are both required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return out.invalid.push({ line, o, why: 'Not a valid email address' });
    if (seen.has(email)) return out.invalid.push({ line, o, why: 'Duplicate of an earlier row in this file' });
    seen.add(email);
    const roles = (o.roles || '').split(';').map(x => x.trim()).filter(Boolean);
    const eventIds = (o.events || '').split(';').map(n => db.events.find(e => e.name.toLowerCase() === n.trim().toLowerCase())?.id).filter(Boolean);
    const ex = db.people.find(p => p.email.toLowerCase() === email);
    const row = { line, o: { ...o, email }, roles, eventIds, ex };
    if (!ex) out.create.push(row);
    else if (ex.archived) out.reactivate.push(row);
    else if (ex.first_name !== o.first_name || ex.last_name !== o.last_name || (roles.length && roles.join() !== ex.roles.join()) || eventIds.some(id => !ex.eventIds.includes(id))) out.update.push(row);
    else out.same.push(row);
  });
  return out;
}
function previewImport(text, fname) {
  const a = analyseImport(text); const body = $('#imbody'); if (!body) return;
  if (a.error) { toast(a.error); body.insertAdjacentHTML('afterbegin', `<div class="notice bad small" style="margin-bottom:12px">${ICON.info}<div>${esc(a.error)}</div></div>`); return; }
  const sec = (title, list, render, cls = '') => list.length ? `<div class="imsec ${cls}"><div class="imh"><b>${title}</b><span class="tag">${list.length}</span></div>${list.slice(0, 50).map(render).join('')}${list.length > 50 ? `<div class="tiny muted">…and ${list.length - 50} more</div>` : ''}</div>` : '';
  const nm = r => `${esc(r.o.first_name)} ${esc(r.o.last_name)} <span class="muted">· ${esc(r.o.email)}</span>`;
  body.innerHTML = `<div class="row between" style="margin-bottom:12px"><span class="small"><b>${esc(fname)}</b> · ${a.create.length + a.update.length + a.same.length + a.reactivate.length + a.invalid.length} rows checked</span><button class="btn ghost xs" id="imback">Choose a different file</button></div>
    <div class="imgrid">${[['New', a.create.length, 'var(--teal)'], ['Updates', a.update.length, 'var(--sky)'], ['Archived — can reactivate', a.reactivate.length, 'var(--amber)'], ['Unchanged', a.same.length, '#CFC8C0'], ['Problems', a.invalid.length, 'var(--red)']].map(([l, n, c]) => `<div style="--c:${c}"><b>${n}</b><span>${l}</span></div>`).join('')}</div>
    ${sec('New volunteers', a.create, r => `<div class="imrow">＋ ${nm(r)}</div>`)}
    ${sec('Updates to existing volunteers', a.update, r => `<div class="imrow">✎ ${nm(r)}${r.ex.first_name !== r.o.first_name || r.ex.last_name !== r.o.last_name ? ` <span class="small muted">— name was “${esc(r.ex.name)}”</span>` : ''} <span class="tiny muted">· training history kept</span></div>`)}
    ${sec('Archived volunteers in this file', a.reactivate, r => { const pv = reactivationPreview(r.ex); return `<label class="imrow imre"><input type="checkbox" data-re="${r.ex.id}" checked><span>${nm(r)}<br><span class="tiny muted">Archived ${fmtDate(r.ex.archivedAt)} · ${pv.keep.length} record${pv.keep.length === 1 ? '' : 's'} kept${pv.purge.length ? `, ${pv.purge.length} older than ${retentionYears()} years will be removed` : ''}</span></span><span class="tag">Reactivate</span></label>`; }, 'warn')}
    ${sec('Rows that will be skipped', a.invalid, r => `<div class="imrow">✗ Row ${r.line}: ${esc([r.o.first_name, r.o.last_name].filter(Boolean).join(' ') || '(no name)')} <span class="muted">· ${esc(r.o.email || 'no email')}</span> — <span style="color:var(--red-600)">${esc(r.why)}</span></div>`, 'bad')}
    ${a.same.length ? `<p class="tiny muted">${a.same.length} row${a.same.length === 1 ? ' matches' : 's match'} existing volunteers exactly — nothing to change.</p>` : ''}`;
  const foot = $('#scrim footer') || (() => { const f = document.createElement('footer'); $('#scrim .modal').appendChild(f); return f; })();
  const count = () => a.create.length + a.update.length + $$('[data-re]:checked').length;
  foot.innerHTML = `<button class="btn ghost" data-close>Cancel</button><button class="btn red" id="imgo">Import ${count()} change${count() === 1 ? '' : 's'}</button>`;
  $$('[data-re]').forEach(c => c.onchange = () => { $('#imgo').textContent = `Import ${count()} change${count() === 1 ? '' : 's'}`; });
  $('#imback').onclick = () => { closeModal(); importPeople(); };
  $('#imgo').onclick = () => {
    const react = new Set($$('[data-re]:checked').map(c => c.dataset.re)); let created = 0, updated = 0, reactivated = 0;
    a.create.forEach(r => { const p = setName({ id: uid('u_'), token: uid('inv-'), createdAt: now(), email: r.o.email, type: 'volunteer', roles: r.roles, eventIds: r.eventIds, org: '', notes: '', accessNI: { status: 'not_requested', date: '' } }, r.o.first_name, r.o.last_name);
      db.people.push(p); created++; audit({ actor: 'admin', action: 'volunteer_created', personId: p.id, detail: { name: p.name, source: 'CSV import' } }); if (requiredPathwaysFor(p).length) autoEmail('assigned', p, { key: 'import' }); });
    const upd = r => { const before = r.ex.name; setName(r.ex, r.o.first_name, r.o.last_name); if (r.roles.length) r.ex.roles = r.roles; r.eventIds.forEach(id => r.ex.eventIds.includes(id) || r.ex.eventIds.push(id));
      audit({ actor: 'admin', action: 'volunteer_updated', personId: r.ex.id, detail: { name: r.ex.name, changes: before !== r.ex.name ? [`name: ${before} → ${r.ex.name}`] : ['roles/events'], source: 'CSV import' } }); };
    a.update.forEach(r => { upd(r); updated++; });
    a.reactivate.filter(r => react.has(r.ex.id)).forEach(r => { upd(r); reactivateVolunteer(r.ex, 'CSV import'); reactivated++; });
    audit({ actor: 'admin', action: 'data_imported', detail: { kind: 'Volunteer CSV', file: fname, created, updated, reactivated, skipped: a.invalid.length } });
    closeModal(); toast(`Imported: ${created} new · ${updated} updated · ${reactivated} reactivated${a.invalid.length ? ` · ${a.invalid.length} skipped` : ''}`); route();
  };
}

/* ---------- send reminders (active volunteers with incomplete modules only) ---------- */
function openSendReminders() {
  const incompleteOf = p => requiredPathwaysFor(p).filter(pw => ['none', 'progress', 'expired'].includes(statusOf(p, pw).key));
  const active = live(), archived = db.people.filter(p => p.archived);
  const targets = active.filter(p => incompleteOf(p).length);
  const locked = active.filter(p => !incompleteOf(p).length && requiredPathwaysFor(p).some(pw => statusOf(p, pw).key === 'locked')).length;
  composeEmail(targets, { title: 'Send reminders', ruleId: 'r-notstarted',
    note: `<b>${targets.length}</b> active volunteers have incomplete training. Not included: <b>${archived.length} archived</b> (never emailed), ${active.length - targets.length - locked} up to date${locked ? `, ${locked} waiting for a follow-up chat` : ''}.`,
    ctxFor: p => ({ training: incompleteOf(p).map(pw => pw.title).join(' and ') }) });
}

/* ---------- Data & privacy page ---------- */
function renderPrivacy() {
  const d = retentionDue(); const yrs = retentionYears();
  const runs = db.audit.filter(a => a.action === 'retention_cleanup').slice(-6).reverse();
  const tbl = Object.entries({ volunteers: db.people.length, training_records: db.completions.length, audit_logs: db.audit.length });
  adminShell('privacy', pageHead('Data & privacy', 'Data, retention & admin tools', `Records are kept for ${yrs} years under our safeguarding obligations, then removed automatically (UK GDPR storage limitation).`,
    `<button class="btn ghost sm" id="xrep">${ICON.dl} Download audit report (CSV)</button><button class="btn ghost sm" id="ximp">Import volunteers (CSV)</button>`) + `
    <div class="grid g2" style="align-items:start">
      <div class="card"><div class="row between"><h3>Rolling ${yrs}-year cleanup</h3><label class="row small" style="gap:8px;cursor:pointer"><span class="muted">Run daily</span><label class="switch"><input type="checkbox" id="autoc" ${db.settings.autoCleanup ? 'checked' : ''}><span></span></label></label></div>
        <p class="small muted" style="margin:6px 0 14px">Anything older than <b>${fmtDate(d.cut)}</b> is removed. Last run: <b>${db.settings.lastCleanup ? fmtDate(db.settings.lastCleanup) : 'never'}</b>.</p>
        <div class="imgrid three">${[['Training records over ' + yrs + ' years old', d.records.length, 'var(--amber)'], ['Volunteers archived over ' + yrs + ' years ago', d.vols.length, 'var(--red)'], ['Audit entries over ' + yrs + ' years old', d.logs.length, 'var(--sky)']].map(([l, n, c]) => `<div style="--c:${c}"><b>${n}</b><span>${l}</span></div>`).join('')}</div>
        ${d.records.length || d.vols.length ? `<details class="duelist"><summary>See what will be removed</summary>
          ${d.vols.map(p => `<div class="imrow">🗑 <b>${esc(p.name)}</b> <span class="muted">· archived ${fmtDate(p.archivedAt)} — whole record deleted</span></div>`).join('')}
          ${d.records.map(c => `<div class="imrow">✗ ${esc(Person(c.personId)?.name || '')} <span class="muted">· ${esc(c.pathwayTitle)} completed ${fmtDate(c.completedAt)}</span></div>`).join('')}</details>` : ''}
        <button class="btn red" id="runc" style="margin-top:14px" ${d.records.length + d.vols.length + d.logs.length ? '' : 'disabled'}>Run cleanup now</button>
        ${runs.length ? `<h4 style="margin:18px 0 6px;font-size:14px">Recent runs</h4><ul class="timeline">${runs.map(a => `<li><span class="when">${fmtDT(a.at)}</span><span class="small">${esc(a.detail.source)} · ${a.detail.records_removed} records, ${a.detail.volunteers_deleted} volunteers, ${a.detail.audit_entries_removed} audit entries removed</span></li>`).join('')}</ul>` : ''}
      </div>
      <div class="stack">
        <div class="card"><h3 style="margin-bottom:8px">What we keep, and for how long</h3><ul class="small" style="margin:0;padding-left:18px;line-height:1.7">
          <li>Name, email address and training completion dates — <b>${yrs} years</b> from completion.</li>
          <li>Archived volunteers can’t sign in or get reminders; their records stay for the ${yrs}-year audit, then are deleted.</li>
          <li>Reactivating someone keeps anything from the last ${yrs} years; older modules show as needing renewal.</li>
          <li>Deleting someone erases them and their audit trail immediately (for erasure requests).</li></ul>
          <p class="tiny muted" style="margin:10px 0 0">Shown to volunteers on the sign-in page. No consent checkbox is used — the lawful basis is our safeguarding obligations.</p></div>
        <div class="card"><h3 style="margin-bottom:8px">Database</h3><p class="small muted" style="margin-top:0">Mock tables in this browser, shaped exactly like the Cloudflare D1 schema.</p>
          <div class="dbt">${tbl.map(([t, n]) => `<button data-tbl="${t}"><code>${t}</code><b>${n.toLocaleString('en-GB')}</b><span class="tiny muted">rows · view</span></button>`).join('')}</div></div>
        <div class="card demo-help"><div class="dt-lbl">Demo tools</div>
          <div class="row" style="gap:8px;margin-top:10px"><button class="btn ghost xs" id="scale">Load 3,000 volunteers (scale test)</button><button class="btn ghost xs" id="xreset" style="color:var(--red-600)">Reset demo data</button></div>
          <p class="tiny muted" style="margin:8px 0 0">The scale test adds sample volunteers so you can see search and pagination at full size. Reset puts everything back to the starting sample.</p></div>
      </div>
    </div>`);
  $('#xrep').onclick = exportAuditReport; $('#ximp').onclick = importPeople;
  $('#autoc').onchange = e => { db.settings.autoCleanup = e.target.checked; audit({ actor: 'admin', action: 'settings_saved', detail: { autoCleanup: e.target.checked } }); toast(e.target.checked ? 'Daily cleanup on' : 'Daily cleanup off'); };
  $('#runc').onclick = e => { if (!confirmInline(e.currentTarget, 'Click again to remove permanently')) return; const r = runCleanup('manual run'); toast(`Cleanup done: ${r.records} record${r.records === 1 ? '' : 's'}, ${r.vols} volunteer${r.vols === 1 ? '' : 's'}, ${r.logs} audit entr${r.logs === 1 ? 'y' : 'ies'} removed`); renderPrivacy(); };
  $$('[data-tbl]').forEach(b => b.onclick = () => { const rows = Store.table(b.dataset.tbl);
    modal(`<header><div><div class="eyebrow">Table</div><h2 style="margin-top:4px"><code>${b.dataset.tbl}</code> <span class="muted" style="font-size:16px">${rows.length} rows</span></h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
      <div class="body"><p class="small muted" style="margin-top:0">First 5 rows, exactly as stored — the same shape the D1 Worker would return.</p><pre class="rowdump">${esc(JSON.stringify(rows.slice(-5).reverse(), null, 2))}</pre></div>`, 'wide'); });
  $('#scale').onclick = e => { if (db.people.length > 2500) { toast('Already at scale'); return; } if (!confirmInline(e.currentTarget, 'Click again — adds ~3,000 people')) return;
    const t0 = performance.now(); const back = d => new Date(Date.now() - d * DAY).toISOString();
    seedCrowd(P('p-essentials'), P('p-leaders'), back, null, { scale: Math.ceil((3000 - db.people.length) / 33), lite: true, seed: Date.now() % 1e6 });
    audit({ actor: 'admin', action: 'data_imported', detail: { kind: 'Scale test', total: db.people.length } });
    toast(`${db.people.length.toLocaleString('en-GB')} volunteers loaded in ${Math.round(performance.now() - t0)} ms`); renderPrivacy(); };
  $('#xreset').onclick = e => { if (!confirmInline(e.currentTarget, 'Click again to reset everything')) return; Store.clear(); seed(); draft = null; Session.set('admin', { email: ADMIN_DEMO.email, at: now() }); toast('Demo data reset'); go('#/admin'); };
}

/* ---------- boot ---------- */
db = Store.load();
if (!db || db.schema !== 1) seed();
dailyCleanup();
addEventListener('hashchange', route);
route();
