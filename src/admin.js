/* =====================================================================
   ADMIN
   ===================================================================== */
const NAV = [
  ['', 'Overview', 'grid'], ['people', 'People', 'people'], ['events', 'Events', 'cal'],
  ['pathways', 'Pathways', 'path'], ['emails', 'Emails', 'mail'], ['audit', 'Audit log', 'log'], ['privacy', 'Data & privacy', 'shield'], ['settings', 'Settings', 'cog'],
];
function adminShell(active, inner) {
  app().innerHTML = topbar(`<span class="small muted tb-who">Signed in as <b>${esc(db.settings.adminName)}</b></span><nav class="tb-nav">${NAV.map(([k, l, i]) => `<a href="#/admin${k ? '/' + k : ''}" class="${active === k ? 'on' : ''}">${ICON[i]} ${l}</a>`).join('')}</nav><button class="btn ghost sm" data-act="adminlogout">Log out</button>`, '#/admin') +
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
  if (sec === 'emails' && id === 'rollout') return renderRollout();
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
/* page header: a small Back link, one primary action, up to two secondary ones, and the rest in a "More" menu
   (on phones: primary + More). Buttons keep their ids, so handlers bound after render still work. */
function moreMenu(items, label = 'More') {
  return `<div class="more"><button class="btn ghost sm" data-act="more" aria-haspopup="true" aria-expanded="false">${label} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
    <div class="moremenu" role="menu" hidden>${items.map(e => { e.classList.remove('btn', 'ghost', 'sm', 'xs', 'soft', 'red', 'hide-sm'); e.classList.add('mitem'); e.setAttribute('role', 'menuitem'); return e.outerHTML; }).join('')}</div></div>`;
}
const pageHead = (eyebrow, title, sub, actions = '') => {
  const t = document.createElement('template'); t.innerHTML = actions.trim(); const els = [...t.content.children];
  const back = els.find(e => e.hasAttribute('data-back')), primary = els.slice().reverse().find(e => e.classList.contains('red') && e !== back);
  const rest = els.filter(e => e !== back && e !== primary), phone = innerWidth < 620;
  const keep = phone ? (rest.length <= 1 && !primary ? rest.length : rest.length === 1 ? 1 : 0) : rest.length <= 3 ? rest.length : 2;
  const shown = rest.slice(0, keep), more = rest.slice(keep);
  return `<div class="pagehead">${back ? `<a class="backlink noprint" href="${back.getAttribute('href')}" data-back="${back.dataset.back}">${ICON.back.replace('<svg', '<svg width="16" height="16"')} Back</a>` : ''}
    <div class="ph-main"><div class="ph-text"><h1 class="ph-h1">${title}</h1>${sub ? `<div class="muted ph-sub">${sub}</div>` : ''}</div>
    ${shown.length + more.length || primary ? `<div class="ph-acts noprint">${shown.map(e => e.outerHTML).join('')}${more.length ? moreMenu(more, shown.length ? 'More' : phone && primary ? 'More' : 'Actions') : ''}${primary ? primary.outerHTML : ''}</div>` : ''}</div></div>`;
};
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
        <div class="tiny muted" style="margin:2px 0 10px">${vTag(pw)} · ${renewLabel(pw)}</div>
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
    case 'emails_scheduled': return `Admin scheduled <b>${d.count}</b> email${d.count === 1 ? '' : 's'} for ${esc(whenText(d.at))} <span class="muted">· ${esc(d.label || '')}</span>`;
    case 'schedule_cancelled': return `Admin cancelled a scheduled send <span class="muted">· ${esc(d.label || '')} (${d.count})</span>`;
    case 'training_released': return `Training invites ${d.source === 'scheduled' ? 'sent on schedule' : 'released by admin'} for <b>${esc(d.name)}</b> <span class="muted">· ${d.invites} invite${d.invites === 1 ? '' : 's'} to a team of ${d.team}</span>`;
    case 'events_batch_added': return `Admin added <b>${d.count}</b> events <span class="muted">· ${esc((d.names || []).join(', '))}</span>`;
    case 'list_synced': return `Admin synced <b>${esc(d.list)}</b> from ${esc(d.file || 'a list')} <span class="muted">· ${[d.added && d.added + ' added', d.joined && d.joined + ' joined', d.updated && d.updated + ' updated', d.reactivated && d.reactivated + ' reactivated', d.archived && d.archived + ' archived', d.removed && d.removed + ' taken off the team', d.unchanged + ' unchanged'].filter(Boolean).join(', ')}</span>`;
    case 'list_sync_undone': return `Admin undid a list sync`;
    case 'rollout_wave': return `Rollout batch sent <span class="muted">· ${d.count} invites${d.simulated ? ' (simulated day ' + esc(d.day) + ')' : ''} · ${d.left} to go · ${d.plan} plan</span>`;
    case 'rollout_started': return `Admin started a rollout <span class="muted">· ${d.people} people from ${esc(d.start)}, ${d.perDay} a day on the ${d.plan} plan</span>`;
    case 'rollout_paused': case 'rollout_resumed': case 'rollout_cancelled': return `Admin ${a.action.split('_')[1]} the rollout`;
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
    case 'pathway_published': return `Admin published <b>${esc(pw)}</b> ${d.label ? 'v' + esc(d.label) : vTag(P(a.pathwayId), a.version)}${d.kind ? ` <span class="muted">(${d.kind} update)</span>` : ''}${d.note ? ` — “${esc(d.note)}”` : ''}`;
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
    rows.push([p.name, p.email, p.roles.join('; '), p.eventIds.map(id => EventById(id)?.name).join('; '), pw.title, st.key === 'due' ? 'Due soon' : st.label.replace(/ ·.*/, ''), c ? fmtDate(c.completedAt) : '', c ? fmtDate(c.expiresAt) : '', c ? vTag(pw, c.version) : '', c?.score ?? '', attempts, c?.attestationName || '', c?.id || '']);
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
let peopleTab = 'all', peopleFiltersOpen = false; const peopleSel = new Set();
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
    `<button class="btn ghost sm" id="prem">${ICON.mail} Send reminders…</button><button class="btn ghost sm" id="psync">Sync a full list…</button><button class="btn ghost sm" id="pmail">Email everyone in this view…</button><button class="btn ghost sm" id="imp">Import from CSV…</button><button class="btn ghost sm" id="pprint">${ICON.print} Print list</button><button class="btn red sm" id="addp">+ Add person</button>`) + `
    <div class="tabs" role="tablist">${[['all', 'Everyone'], ...TYPES, ['archived', 'Archived']].map(([k, l]) => `<button role="tab" class="${peopleTab === k ? 'on' : ''}" aria-selected="${peopleTab === k}" data-ptab="${k}">${l} <span>${count(k)}</span></button>`).join('')}</div>
    <div class="filters ${peopleFiltersOpen ? 'open' : ''}">
      <input class="input" type="search" placeholder="Search name, email or church…" id="pq" value="${esc(f.q)}" style="flex:1 1 240px">
      ${(() => { const n = ['event', 'role', 'pathway', 'status', 'ready'].filter(k => f[k]).length; return `<button class="btn ghost filt-tog" id="pfilt" aria-expanded="${peopleFiltersOpen}" aria-controls="pfbox">Filters${n ? ` <span class="ibbadge">${n}</span>` : ''}</button>`; })()}
      <div class="filt-box" id="pfbox">
      <select class="input" id="pev"><option value="">All events</option>${db.events.map(e => `<option value="${e.id}" ${f.event === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
      <select class="input" id="prole"><option value="">All roles</option>${db.roles.map(r => `<option ${f.role === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>
      <select class="input" id="ppw"><option value="">All pathways</option>${db.pathways.map(pw => `<option value="${pw.id}" ${f.pathway === pw.id ? 'selected' : ''}>${esc(pw.title)}</option>`).join('')}</select>
      <select class="input" id="pst"><option value="">Any status</option>${[['attention', 'Needs attention'], ['complete', 'Up to date'], ['due', 'Due soon'], ['progress', 'In progress'], ['none', 'Not started'], ['expired', 'Expired'], ['locked', 'Needs review']].map(([k, l]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${ev ? `<select class="input" id="prd"><option value="">Any readiness</option>${SEG.map(([k, l]) => `<option value="${k}" ${f.ready === k ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}
      ${Object.keys(PF0).some(k => f[k]) ? `<button class="btn ghost sm" id="pclear">Clear</button>` : ''}
    </div></div>
    ${ev ? `<div class="card" style="margin-bottom:14px;padding:16px 18px"><div class="row between" style="margin-bottom:8px"><b>${esc(ev.name)}</b><span class="small muted">${fmtDate(ev.date)}</span></div>${readyBar(readyCounts(ev), ev.id)}${readyLegend(readyCounts(ev), ev.id)}</div>` : ''}
    ${peopleTab === 'archived' ? `<div class="notice info small" style="margin-bottom:14px">${ICON.info}<div>Archived volunteers can’t sign in and never get reminders. Their records are kept for ${retentionYears()} years, then deleted automatically. Reactivating keeps anything from the last ${retentionYears()} years.</div></div>` : ''}
    <div id="plist"></div>`);
  const pager = n => { const pages = Math.max(1, Math.ceil(n / PAGE)); if (peoplePage > pages) peoplePage = pages;
    const from = n ? (peoplePage - 1) * PAGE + 1 : 0, to = Math.min(n, peoplePage * PAGE);
    const nums = [...new Set([1, peoplePage - 1, peoplePage, peoplePage + 1, pages])].filter(x => x >= 1 && x <= pages).sort((a, b) => a - b);
    return `<div class="pager"><span class="small muted">Showing <b>${from.toLocaleString('en-GB')}–${to.toLocaleString('en-GB')}</b> of <b>${n.toLocaleString('en-GB')}</b></span>${pages > 1 ? `<div class="pgs"><button class="btn ghost xs" data-pg="${peoplePage - 1}" ${peoplePage === 1 ? 'disabled' : ''}>‹ Prev</button>${nums.map((x, i) => `${i && x - nums[i - 1] > 1 ? '<span class="muted">…</span>' : ''}<button class="btn xs ${x === peoplePage ? 'red' : 'ghost'}" data-pg="${x}">${x}</button>`).join('')}<button class="btn ghost xs" data-pg="${peoplePage + 1}" ${peoplePage === pages ? 'disabled' : ''}>Next ›</button></div>` : ''}</div>`; };
  const bulkbar = list => { const n = peopleSel.size, arch = [...peopleSel].map(Person).filter(p => p?.archived).length;
    const allMatch = list.length > PAGE && list.every(p => peopleSel.has(p.id));
    return n ? `<div class="bulkbar" role="region" aria-label="Selected people"><span><b>${n.toLocaleString('en-GB')}</b> selected${!allMatch && list.length > PAGE && pageRowsOf(list).every(p => peopleSel.has(p.id)) ? ` · <button class="linkbtn" id="selall">Select all ${list.length.toLocaleString('en-GB')} matching</button>` : ''}</span>
      <div class="bbacts">${n - arch ? `<button class="btn red xs" data-bulk="remind">Send reminders…</button><button class="btn ghost xs" data-bulk="email">Email…</button><button class="btn ghost xs" data-bulk="event">Add to event…</button><button class="btn ghost xs" data-bulk="archive">Archive</button>` : ''}${arch ? `<button class="btn teal xs" data-bulk="react">Reactivate ${arch}</button>` : ''}<button class="btn ghost xs" data-bulk="clear">Clear</button></div></div>` : ''; };
  const pageRowsOf = list => list.slice((peoplePage - 1) * PAGE, peoplePage * PAGE);
  const draw = () => {
    const list = filteredPeople(); const pageRows = pageRowsOf(list);
    $('#plist').innerHTML = `<div class="tablewrap"><table class="clickable ptable"><thead><tr><th class="selcell"><input type="checkbox" id="selpage" aria-label="Select this page" ${pageRows.length && pageRows.every(p => peopleSel.has(p.id)) ? 'checked' : ''}></th><th>Name</th><th class="hide-md">Type &amp; roles</th><th class="hide-md">Serving at</th><th class="hide-sm">Training</th><th>Status</th><th></th></tr></thead><tbody>
    ${pageRows.map(p => { const { req, done, worst } = personSummary(p);
      return `<tr data-row="${p.id}" tabindex="0" class="${peopleSel.has(p.id) ? 'sel' : ''}"><td class="selcell"><input type="checkbox" data-sel="${p.id}" ${peopleSel.has(p.id) ? 'checked' : ''} aria-label="Select ${esc(p.name)}"></td><td><span class="person">${avatar(p)}<span><b>${esc(p.name)}</b><br><span class="tiny muted">${esc(p.email)}</span></span></span></td>
        <td class="hide-md"><span class="typepill t-${typeOf(p)}">${typeOf(p)}</span>${p.roles.map(r => `<span class="tag">${esc(r)}</span>`).join('')}</td>
        <td class="hide-md">${p.eventIds.map(id => `<span class="tag nowrap">${esc(EventById(id)?.name || '')}</span>`).join('') || '<span class="muted">—</span>'}</td>
        <td class="hide-sm" style="min-width:110px"><div class="meter"><i style="width:${req.length ? done / req.length * 100 : 0}%"></i></div><span class="tiny muted">${done}/${req.length}</span></td>
        <td>${p.archived ? `<span class="chip st-none">Archived ${fmtDate(p.archivedAt)}</span>` : worst ? chip(worst) : '<span class="tiny muted">Nothing assigned</span>'}</td>
        <td class="rowacts">${p.archived ? `<button class="btn teal xs" data-react="${p.id}">Reactivate</button><button class="btn ghost xs" data-del="${p.id}" style="color:var(--red-600)">Delete</button>` : `<button class="btn ghost xs" data-remind="${p.id}" title="Email options" aria-haspopup="menu">✉️ ▾</button><button class="btn ghost xs hide-sm" data-copy="${p.token}" title="Copy invite link">${ICON.link}</button><button class="btn ghost xs hide-sm" data-edit="${p.id}">Edit</button>`}<span class="chev">${ICON.arrow.replace('width="18" height="18"', 'width="16" height="16"')}</span></td></tr>`;
    }).join('') || '<tr><td colspan="7" class="empty">No one matches those filters</td></tr>'}</tbody></table></div>
    ${pager(list.length)}${bulkbar(list)}`;
    bindCopy();
    $$('[data-row]').forEach(tr => { const open = e => { if (e.target.closest('button,a,input,.selcell')) return; go('#/admin/people/' + tr.dataset.row); }; tr.onclick = open; tr.onkeydown = e => e.key === 'Enter' && e.target === tr && open(e); });
    $$('.selcell').forEach(td => td.onclick = e => { if (e.target.tagName !== 'INPUT') { e.stopPropagation(); $('input', td).click(); } });
    $$('[data-edit]').forEach(b => b.onclick = e => { e.stopPropagation(); personPanel(Person(b.dataset.edit)); });
    $$('[data-remind]').forEach(b => b.onclick = e => { e.stopPropagation(); emailMenu(b, Person(b.dataset.remind)); });
    $$('[data-sel]').forEach(c => c.onchange = () => { c.checked ? peopleSel.add(c.dataset.sel) : peopleSel.delete(c.dataset.sel); draw(); });
    $('#selpage').onchange = e => { pageRows.forEach(p => e.target.checked ? peopleSel.add(p.id) : peopleSel.delete(p.id)); draw(); };
    $('#selall') && ($('#selall').onclick = () => { list.forEach(p => peopleSel.add(p.id)); draw(); });
    const chosen = () => [...peopleSel].map(Person).filter(Boolean);
    $$('[data-bulk]').forEach(b => b.onclick = () => { const k = b.dataset.bulk, ppl = chosen();
      if (k === 'clear') { peopleSel.clear(); draw(); } else if (k === 'remind') remindPeople(ppl, { title: `Remind ${ppl.length} selected` }); else if (k === 'email') composeEmail(ppl, { title: `Email ${ppl.length} selected` });
      else if (k === 'event') bulkAddToEvent(ppl); else if (k === 'archive') bulkArchive(ppl); else if (k === 'react') bulkReactivate(ppl); });
    $$('[data-pg]').forEach(b => b.onclick = () => { peoplePage = +b.dataset.pg; draw(); $('#plist').scrollIntoView({ block: 'start', behavior: 'smooth' }); });
    $$('[data-react]').forEach(b => b.onclick = e => { e.stopPropagation(); confirmReactivate(Person(b.dataset.react), renderPeople); });
    $$('[data-del]').forEach(b => b.onclick = e => { e.stopPropagation(); confirmDelete(Person(b.dataset.del), renderPeople); });
  };
  draw(); bindPf();
  const set = (k, v) => { f[k] = v; if (k === 'event') f.ready = ''; peoplePage = 1; k === 'event' ? renderPeople() : draw(); };
  $$('[data-ptab]').forEach(b => b.onclick = () => { peopleTab = b.dataset.ptab; peopleSel.clear(); peoplePage = 1; renderPeople(); });
  $('#pq').oninput = e => set('q', e.target.value);
  $('#pev').onchange = e => set('event', e.target.value);
  $('#prole').onchange = e => set('role', e.target.value);
  $('#pst').onchange = e => set('status', e.target.value);
  $('#ppw').onchange = e => set('pathway', e.target.value);
  $('#prd') && ($('#prd').onchange = e => set('ready', e.target.value));
  $('#pclear') && ($('#pclear').onclick = () => { peopleFilter = { ...PF0 }; renderPeople(); });
  $('#addp').onclick = () => personPanel();
  $('#pfilt').onclick = e => { peopleFiltersOpen = !peopleFiltersOpen; e.currentTarget.closest('.filters').classList.toggle('open', peopleFiltersOpen); e.currentTarget.setAttribute('aria-expanded', peopleFiltersOpen); };
  $('#imp').onclick = importPeople;
  $('#psync').onclick = () => rosterSync(peopleFilter.event ? 'event:' + peopleFilter.event : peopleTab === 'staff' ? 'staff' : peopleTab === 'all' ? 'volunteers' : peopleTab === 'other' ? 'all' : 'volunteers');
  $('#prem').onclick = () => { const ppl = filteredPeople().filter(p => !p.archived); remindPeople(ppl, { title: ppl.length === live().length ? 'Remind everyone who needs it' : `Remind the ${ppl.length} people in this view`, event: peopleFilter.event && EventById(peopleFilter.event) }); };
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
      ${req.map(pw => { const st = statusOf(p, pw), c = st.c; return `<tr><td><b>${esc(pw.title)}</b></td><td>${pdChip(st)}</td><td>${c ? fmtDate(c.completedAt) : '—'}</td><td>${c ? fmtDate(c.expiresAt) : '—'}</td><td>${c ? vTag(pw, c.version) : '—'}</td><td>${c?.score != null ? c.score + '%' : c?.manual ? 'Recorded' : '—'}</td><td class="mono">${c ? esc(c.id) : '—'}</td></tr>`; }).join('') || '<tr><td colspan="7">No training assigned</td></tr>'}
    </tbody></table>
    ${certs.length ? `<h2>Certificate history</h2><table class="pd-table"><thead><tr><th>Certificate</th><th>Pathway</th><th>Completed</th><th>Expiry</th><th>How</th><th>Status</th></tr></thead><tbody>
      ${certs.map(c => `<tr><td class="mono">${esc(c.id)}</td><td>${esc(c.pathwayTitle)} ${vTag(P(c.pathwayId), c.version)}</td><td>${fmtDate(c.completedAt)}</td><td>${fmtDate(c.expiresAt)}</td><td>${c.manual ? esc(c.manual.method) : `Online · signed “${esc(c.attestationName)}”`}</td><td>${c.revoked ? (c.revoked.replacedBy ? 'Replaced' : 'Revoked') + ` — ${esc(c.revoked.reason)}` : new Date(c.expiresAt) > new Date() ? 'Valid' : 'Expired'}</td></tr>`).join('')}</tbody></table>` : ''}
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
    <div class="pd-grid pd-3"><div><b>Ready</b><span class="pd-big" style="color:#1B766C">${c.ready}</span></div><div><b>Needs refresher</b><span class="pd-big" style="color:#C2850E">${c.renew}</span></div><div><b>Not trained</b><span class="pd-big" style="color:#D63744">${c.todo}</span></div></div>
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
  changeModal({ title: `Edit certificate ${esc(c.id)}`, intro: `${esc(p?.name || '')} · ${esc(c.pathwayTitle)} ${vTag(P(c.pathwayId), c.version)}, completed ${fmtDate(c.completedAt)}.`,
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
          <table><tbody>${x.a.questions.map((q, k) => `<tr><td class="tiny muted">Q${k + 1}</td><td>${q.correct ? '<span style="color:var(--teal);font-weight:800">✓</span>' : '<span style="color:var(--red-600);font-weight:800">✗</span>'}</td><td><b>${esc(q.text)}</b><div class="small" style="margin-top:3px">${q.correct ? `<span style="color:var(--teal)">${esc(q.chosen)}</span>` : `<span style="color:var(--red-600)">${esc(q.chosen)}</span> <span class="muted">→ correct: ${esc(q.answer || '')}</span>`}</div></td></tr>`).join('')}</tbody></table></details>`).join('')}
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
            const col = st.key === 'expired' || left <= 0 ? 'var(--red-600)' : st.key === 'due' ? '#8A5508' : 'var(--teal)';
            return `<div class="tfacts"><div><span>Completed</span><b>${fmtDate(c.completedAt)}</b></div><div><span>${exp > new Date() ? 'Valid until' : 'Expired'}</span><b style="color:${col}">${fmtDate(c.expiresAt)}</b></div><div><span>${c.manual ? 'Recorded' : 'Score'}</span><b>${c.manual ? 'By admin' : c.score != null ? c.score + '%' : '—'}</b></div><div><span>Version</span><b>${vTag(pw, c.version)}${c.version < pw.version ? ` <em class="tiny" style="color:#8A5508;font-style:normal">(now ${vTag(pw)})</em>` : ''}</b></div></div>
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
        <div><div class="row" style="gap:8px"><b>${esc(c.pathwayTitle)}</b><span class="tag">${vTag(P(c.pathwayId), c.version)}</span>${c.revoked ? `<span class="chip st-expired">${c.revoked.replacedBy ? 'Replaced' : 'Revoked'}</span>` : valid ? '<span class="chip st-complete">Valid</span>' : '<span class="chip st-due">Expired</span>'}${c.manual ? '<span class="tag" style="background:var(--sky-50)">Recorded by admin</span>' : ''}</div>
        <div class="small muted" style="margin-top:4px">${esc(c.id)} · completed ${fmtDate(c.completedAt)} · ${valid ? 'valid until' : 'expiry'} ${fmtDate(c.expiresAt)}${c.score != null ? ` · ${c.score}%` : ''}${c.manual ? ` · ${esc(c.manual.method)}` : ` · signed as “${esc(c.attestationName)}”`}${c.nameOnCert ? ` · name on certificate: ${esc(c.nameOnCert)}` : ''}</div>
        ${c.revoked ? `<div class="tiny" style="margin-top:4px;color:var(--red-600)">${c.revoked.replacedBy ? 'Replaced' : 'Revoked'} ${fmtDate(c.revoked.at)} by ${esc(c.revoked.by)} — “${esc(c.revoked.reason)}”</div>` : ''}
        ${(c.edits || []).length ? `<details class="tiny" style="margin-top:6px"><summary class="muted" style="cursor:pointer">${plural(c.edits.length, 'change')}</summary>${c.edits.map(e => `<div style="margin-top:4px">${fmtDT(e.at)} · ${esc(e.by)}: ${e.changes.map(ch => `${esc(ch.field)} ${esc(ch.from)} → ${esc(ch.to)}`).join(', ')} — “${esc(e.reason)}”</div>`).join('')}</details>` : ''}</div>
        <div class="row noprint" style="gap:6px;flex-wrap:nowrap"><a class="btn ghost xs" href="#/admin/cert/${c.id}">View</a>${c.revoked?.replacedBy ? '' : `<button class="btn ghost xs" data-ce="${c.id}">Edit…</button><button class="btn ghost xs" data-cr="${c.id}">Reissue…</button>${c.revoked ? `<button class="btn ghost xs" data-cu="${c.id}">Reinstate…</button>` : `<button class="btn ghost xs" data-cv="${c.id}" style="color:var(--red-600)">Revoke…</button>`}`}</div></div></div>`; }).join('')}</div>` : `<div class="card empty">No certificates yet${req.length ? ` — use “Record completion…” on the Training tab if they’ve trained elsewhere.` : ''}</div>`,
    activity: () => `<div class="card">${log.length ? `<ul class="timeline">${log.map(a => `<li><span class="when">${fmtDT(a.at)}</span><span>${auditText(a)}</span></li>`).join('')}</ul>` : '<div class="empty">No activity yet</div>'}</div>`,
  };
  adminShell('people', `<div class="printable">` + pageHead(`<a href="#/admin/people">People</a> / Record`, `<span class="person" style="gap:14px">${avatar(p).replace('avatar"', 'avatar" style="width:48px;height:48px;font-size:17px;background:' + avatarColour(p.name) + '"')}${esc(p.name)}</span>`,
    `${esc(p.email)}${p.phone ? ` · ${esc(p.phone)}` : ''}${p.org ? ` · ${esc(p.org)}` : ''} · Added ${fmtDate(p.createdAt)}${p.archived ? ' · <b style="color:var(--red-600)">Archived</b>' : ''}<br><span class="typepill t-${typeOf(p)}">${typeOf(p)}</span>${p.accessNI?.status === 'cleared' ? '<span class="tag" style="background:var(--teal-50);color:var(--teal)">AccessNI cleared</span>' : p.accessNI?.status === 'applied' ? '<span class="tag" style="background:var(--amber-50)">AccessNI pending</span>' : ''}${p.roles.map(r => `<span class="tag">${esc(r)}</span>`).join('')}${p.eventIds.map(id => `<span class="tag" style="background:var(--sky-50)">${esc(EventById(id)?.name || '')}</span>`).join('')}`,
    `<a class="btn ghost sm" href="#/admin/people" data-back="#/admin/people">${ICON.back} Back</a><button class="btn ghost sm" id="psend">${ICON.mail} Email…</button><a class="btn ghost sm" href="#/preview/${p.id}">Preview as volunteer</a><button class="btn ghost sm" data-copy="${p.token}">${ICON.link} Copy sign-in link</button><button class="btn ghost sm" id="prp">${ICON.print} Print record</button><a class="btn ghost sm" href="#/inbox/${p.token}">${ICON.mail} Demo inbox</a><button class="btn red sm" id="pe">Edit person</button>`) + `
    <div class="tabs noprint" role="tablist">${tabs.map(([k, l, n]) => `<button role="tab" aria-selected="${recordTab === k}" class="${recordTab === k ? 'on' : ''}" data-tab="${k}">${l} <span>${n}</span>${k === 'training' && lockedPws.length ? '<i class="tabdot"></i>' : ''}</button>`).join('')}</div>
    <div id="tabbody" class="fadein">${body[recordTab]()}</div></div>`);
  bindCopy();
  $('#pe').onclick = () => personPanel(p);
  $('#prp').onclick = () => printRecord(p);
  $('#psend').onclick = e => { e.stopPropagation(); emailMenu(e.currentTarget, p); };
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
    ${(() => { const rel = isReleased(ev), r = releaseOf(ev); return `<div class="notice ${rel ? 'good' : 'warn'} small relbar">${ICON.mail}<div style="flex:1"><b>${rel ? (r.mode === 'now' ? 'Training invites go out as people are added' : `Training invites sent ${fmtDate(ev.releasedAt)}`) : esc(releaseLabel(ev))}</b>${rel ? '' : `<br><span class="tiny">You can keep adding people — no one is emailed about ${esc(ev.name)} until then, and reminders for it wait too.</span>`}</div><div class="row" style="gap:6px">${rel ? '' : `<button class="btn red xs" id="evrelease">Release now (${team.length})</button>`}<button class="btn ghost xs" id="evrelchg">Change</button></div></div>`; })()}
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
      <div class="row"><input class="input" id="evq" placeholder="Search team…" value="${esc(evFilter.q)}" style="width:220px;padding:9px 14px"><button class="btn ghost sm" id="evmail">Copy emails</button><button class="btn ghost sm" id="evemail">Email team…</button><button class="btn ghost sm" id="evsync">Sync team from a list…</button><button class="btn soft sm" id="evremind">Remind not ready (${team.filter(p => eventState(p, ev) !== 'ready').length})</button></div></div>
    <div class="tabs" style="margin-bottom:14px">${[['', 'Everyone', team.length], ['ready', 'Ready', c.ready], ['renew', 'Needs refresher', c.renew], ['todo', 'Not trained', c.todo]].map(([k, l, n]) => `<button class="${evFilter.ready === k ? 'on' : ''}" data-rf="${k}">${l} <span>${n}</span></button>`).join('')}</div>
    <div id="evlist"></div>`);
  const draw = () => {
    const list = team.filter(p => (!evFilter.ready || eventState(p, ev) === evFilter.ready) && (!evFilter.q || (p.name + ' ' + p.email).toLowerCase().includes(evFilter.q.toLowerCase())));
    $('#evlist').innerHTML = `<div class="tablewrap"><table class="clickable"><thead><tr><th>Name</th><th class="hide-md">Role</th><th>Readiness</th>${pws.map(pw => `<th class="hide-sm">${esc(pw.title)}</th>`).join('')}<th></th></tr></thead><tbody>
      ${list.map(p => { const s = eventState(p, ev);
        return `<tr data-row="${p.id}" tabindex="0"><td><span class="person">${avatar(p)}<span><b>${esc(p.name)}</b><br><span class="tiny muted">${esc(p.email)}</span></span></span></td><td class="hide-md">${p.roles.map(r => `<span class="tag">${esc(r)}</span>`).join('')}</td>
          <td><span class="chip st-${K[s]}"><span class="dot"></span>${L[s]}</span></td>
          ${pws.map(pw => { const lc = latestCompletion(p.id, pw.id), st = statusOf(p, pw); const ok = lc && new Date(lc.expiresAt) > new Date(ev.endDate || ev.date);
            return `<td class="hide-sm">${lc && new Date(lc.expiresAt) > new Date() ? `<span class="small" style="font-weight:700;color:${ok ? 'var(--teal)' : '#8A5508'}">${ok ? '✓' : '!'} until ${fmtDate(lc.expiresAt)}</span>` : chip(st)}</td>`; }).join('')}
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
  $('#evremind').onclick = () => remindPeople(team.filter(p => eventState(p, ev) !== 'ready'), { title: `Remind ${ev.name} team`, event: ev });
  $('#evrelease') && ($('#evrelease').onclick = e => { if (!confirmInline(e.currentTarget, 'Click again to email the team now')) return; const n = releaseEvent(ev, 'manual'); toast(`Training released · ${n} invite${n === 1 ? '' : 's'} sent`); renderEventDetail(id); });
  $('#evrelchg') && ($('#evrelchg').onclick = () => eventForm(ev));
  $('#evsync').onclick = () => rosterSync('event:' + ev.id);
  $('#evemail') && ($('#evemail').onclick = () => composeEmail(team, { title: `Email ${ev.name} team`, event: ev, ctxFor: () => ({ event: ev }) }));
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
    toast(`${picked.size} added to ${ev.name}${isReleased(ev) ? '' : ` · ${releaseLabel(ev, true).toLowerCase()}`}`); closeModal(); renderEventDetail(ev.id); };
}

/* ---------- events ---------- */
function renderEvents() {
  const list = [...db.events].sort((a, b) => a.date.localeCompare(b.date));
  adminShell('events', pageHead('Events', 'Camps, missions & groups', 'Choose the training each event needs. Anyone signed up to serve is assigned it automatically.', `<button class="btn ghost sm" id="addbatch">Add several…</button><button class="btn red sm" id="adde">+ Add event</button>`) + `
    <div class="grid g2">${list.map(ev => {
      const ppl = live().filter(p => p.eventIds.includes(ev.id)); const c = readyCounts(ev);
      const pct = c.total ? c.ready / c.total * 100 : 0;
      const order = { todo: 0, renew: 1, ready: 2 }; const faces = [...ppl].sort((a, b) => order[eventState(a, ev)] - order[eventState(b, ev)]).slice(0, 12);
      const dotCol = { ready: 'var(--teal)', renew: 'var(--amber)', todo: 'var(--red)' }, dotTxt = { ready: 'ready', renew: 'needs a refresher before this event', todo: 'training not complete' };
      return `<div class="card evcard" data-evopen="${ev.id}" tabindex="0"><div class="row between"><div><div class="eyebrow">${fmtDate(ev.date)}${ev.endDate && ev.endDate !== ev.date ? ' – ' + fmtDate(ev.endDate) : ''}</div><h3 style="margin-top:4px">${esc(ev.name)}</h3><div class="small muted">${esc(ev.location || '')}</div></div><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn ghost xs" data-roster="${ev.id}" title="Print team roster">${ICON.print}</button><button class="btn ghost xs" data-ev="${ev.id}">Edit</button></div></div>
        <div class="tiny" style="margin-top:8px;color:${isReleased(ev) ? 'var(--teal)' : '#8A5508'};font-weight:700">✉︎ ${esc(releaseLabel(ev, true))}</div>
        <div style="margin:10px 0 8px" class="small"><b>Requires:</b> ${ev.requiredPathways.map(id => `<span class="tag">${esc(P(id)?.title || '?')}</span>`).join('') || '<span class="muted">Nothing yet</span>'}</div>
        <div class="row between small"><span><b>${c.ready}</b> of ${plural(c.total, 'volunteer')} ready</span><span><b>${Math.round(pct)}%</b></span></div>
        <div style="margin:8px 0 0">${readyBar(c, ev.id)}</div>
        ${readyLegend(c, ev.id)}
        <div class="row" style="gap:6px;margin-top:12px">${faces.map(p => `<a href="#/admin/people/${p.id}" title="${esc(p.name)} — ${dotTxt[eventState(p, ev)]}" style="position:relative">${avatar(p)}<span style="position:absolute;right:-2px;bottom:-2px;width:12px;height:12px;border-radius:50%;border:2px solid #fff;background:${dotCol[eventState(p, ev)]}"></span></a>`).join('') || '<span class="tiny muted">No one signed up yet</span>'}${ppl.length > faces.length ? `<a class="morefaces" href="#/admin/people" data-pf='${JSON.stringify({ event: ev.id })}'>+${ppl.length - faces.length}</a>` : ''}</div>
        <p class="tiny muted" style="margin:10px 0 0">“Ready” = every required certificate is still valid at the end of the event. “Needs refresher” = trained, but a certificate runs out before then.</p>
      </div>`;
    }).join('')}</div>`);
  bindPf();
  $('#adde').onclick = () => eventForm();
  $('#addbatch').onclick = batchEvents;
  $$('[data-ev]').forEach(b => b.onclick = () => eventForm(EventById(b.dataset.ev)));
  $$('[data-roster]').forEach(b => b.onclick = () => printRoster(EventById(b.dataset.roster)));
  $$('[data-evopen]').forEach(c => { const open = e => { if (e.target.closest('button,a')) return; evFilter = { ready: '', q: '' }; go('#/admin/events/' + c.dataset.evopen); }; c.onclick = open; c.onkeydown = e => e.key === 'Enter' && open(e); });
}
function eventForm(ev) {
  const isNew = !ev; ev = ev || { name: '', date: '', endDate: '', location: '', requiredPathways: ['p-essentials'] };
  const s = modal(`<header><h2>${isNew ? 'Add event' : 'Edit event'}</h2><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body"><div class="field"><label class="f">Name</label><input class="input" id="en" value="${esc(ev.name)}" placeholder="e.g. Ballycastle Mission 2027"></div>
    <div class="grid g3"><div class="field"><label class="f">Starts</label><input class="input" type="date" id="ed" value="${ev.date}"></div><div class="field"><label class="f">Ends</label><input class="input" type="date" id="ee" value="${ev.endDate || ''}"></div><div class="field"><label class="f">Location</label><input class="input" id="el" value="${esc(ev.location || '')}"></div></div>
    <div class="field"><label class="f">Required training</label><div class="checks">${db.pathways.map(p => `<label><input type="checkbox" name="erp" value="${p.id}" ${ev.requiredPathways.includes(p.id) ? 'checked' : ''}>${esc(p.title)}</label>`).join('')}</div></div>
    ${releaseFields(isNew ? { mode: 'before', weeks: 6 } : releaseOf(ev), ev.releasedAt && releaseOf(ev).mode !== 'now' ? ev.releasedAt : null)}</div>
    <footer>${isNew ? '' : `<button class="btn ghost" id="edel" style="margin-right:auto;color:var(--red-600)">${ICON.trash} Delete</button>`}<button class="btn ghost" data-close>Cancel</button><button class="btn red" id="esave">Save</button></footer>`);
  bindReleaseFields(s);
  $('#esave', s).onclick = () => {
    const rel = readRelease(s); if (rel.mode === 'date' && !rel.date) { toast('Choose the date invites should go out'); return; }
    const v = { name: $('#en', s).value.trim(), date: $('#ed', s).value, endDate: $('#ee', s).value || $('#ed', s).value, location: $('#el', s).value.trim(), requiredPathways: $$('[name=erp]:checked', s).map(x => x.value) };
    if (!v.name || !v.date) { toast('Add a name and start date'); return; }
    v.release = rel;
    if (isNew) db.events.push(ev = { id: uid('ev-'), ...v }); else Object.assign(ev, v);
    audit({ actor: 'admin', action: 'event_saved', detail: { name: v.name, release: rel } });
    let sent = 0; if (!ev.releasedAt && isReleased(ev) && rel.mode !== 'now') sent = releaseEvent(ev, 'manual');
    closeModal(); route(); toast(sent ? `Event saved · ${sent} invite${sent === 1 ? '' : 's'} sent` : `Event saved · ${releaseLabel(ev, true).toLowerCase()}`);
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
        <div class="row between"><span class="tag" style="background:${pw.colour}1a;color:color-mix(in srgb,${pw.colour} 70%,#000)">${vTag(pw)}</span>${pw.active === false ? '<span class="chip st-none">Hidden</span>' : ''}</div>
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
let pwTab = 'steps';
function renderPathwayEditor(id) {
  const live = P(id); if (!live) return go('#/admin/pathways');
  if (!draft || draft.id !== id) draft = JSON.parse(JSON.stringify(live));
  const changed = () => JSON.stringify(stripRev(draft)) !== JSON.stringify(stripRev(live));
  const typeName = { video: 'Video', read: 'Read & acknowledge', quiz: 'Quiz' };
  const stepSummary = s => s.type === 'video' ? (s.video?.source === 'file' ? `Uploaded file · ${esc(s.video.fileName || '')}` : `${s.video?.source === 'youtube' ? 'YouTube' : 'Vimeo'} · ${esc(s.video?.url || '')}`)
    : s.type === 'quiz' ? `${s.questions.length} questions in bank · ${s.drawCount} drawn · pass ${s.passMark}% · ${s.lock === false ? 'unlimited attempts' : `locks after ${s.maxAttempts} fails`}${s.questions.length < s.drawCount * 2 ? ' · <span style="color:#8A5508">tip: add more questions so retakes feel fresh</span>' : ''}`
      : `${plainText(s).trim().split(/\s+/).filter(Boolean).length} words${s.link?.url ? ' · links to a document' : ''}`;
  adminShell('pathways', pageHead(`<a href="#/admin/pathways">Pathways</a> / Edit`, esc(draft.title), `Live version: <b>${vTag(live)}</b>${live.version ? ` · published ${fmtDate(live.updatedAt)}` : ' · not published yet'}`,
    `<a class="btn ghost sm" href="#/admin/pathways" id="cancel">Close</a><button class="btn red sm" id="pub" ${changed() ? '' : 'disabled'}>Publish…</button>`) + `
    ${changed() ? `<div class="notice warn small" style="margin-bottom:16px">${ICON.info}<div><b>Unpublished changes.</b> Volunteers see the live version until you publish. Anyone partway through keeps the steps they’ve already done if those steps haven’t changed.</div></div>` : ''}
    <div class="pwtabs seg" role="tablist" aria-label="Pathway editor sections">${[['steps', `Steps <span>${draft.steps.length + 1}</span>`], ['settings', 'Settings'], ['history', 'History']].map(([k, l]) => `<button role="tab" data-pwt="${k}" aria-selected="${pwTab === k}" class="${pwTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="pwgrid" data-tab="${pwTab}">
      <section class="pw-steps" aria-labelledby="pwsteps-h">
        <div class="row between" style="margin-bottom:12px"><h2 class="pw-h" id="pwsteps-h">Steps</h2><span class="tiny muted pw-hint">Drag or use the arrows to reorder · tap a step to edit</span></div>
        <ol class="stack pwlist" id="steplist">${draft.steps.map((s, i) => `<li class="steprow" draggable="true" data-i="${i}">
          <span class="ico ${s.type}">${ICON[s.type]}</span>
          <button type="button" class="sr-main" data-es="${i}"><span class="sr-k">${i + 1} · ${typeName[s.type]}</span><b class="sr-t">${esc(s.title)}</b><span class="sr-sum">${stepSummary(s)}</span></button>
          <div class="sr-acts"><button class="iconbtn" data-mv="${i},-1" aria-label="Move ${esc(s.title)} up" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button><button class="iconbtn" data-mv="${i},1" aria-label="Move ${esc(s.title)} down" ${i === draft.steps.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
          <button class="btn ghost xs" data-es="${i}">Edit</button></div></li>`).join('')}
          <li class="steprow fixed"><span class="ico attest">${ICON.attest}</span><div class="sr-main"><span class="sr-k">Always last · Attestation</span><b class="sr-t">Sign-off & certificate</b><span class="sr-sum">Volunteers confirm the statement in Settings, then get their certificate.</span></div></li>
        </ol>
        <div class="pwadd"><span class="small muted">Add a step</span><div class="pwadd-btns">
          <button class="btn soft sm" data-add="video">${ICON.video.replace('<svg', '<svg width="18" height="18"')} Video</button>
          <button class="btn soft sm" data-add="read">${ICON.read.replace('<svg', '<svg width="18" height="18"')} Reading</button>
          <button class="btn soft sm" data-add="quiz">${ICON.quiz.replace('<svg', '<svg width="18" height="18"')} Quiz</button></div></div>
      </section>
      <section class="card pw-settings" aria-label="Pathway settings"><h2 class="pw-h pw-only-m" style="margin-bottom:12px">Settings</h2>
        <div class="field"><label class="f">Title</label><input class="input" data-k="title" value="${esc(draft.title)}"></div>
        <div class="field"><label class="f">Summary</label><textarea class="input autogrow" data-k="summary" rows="2">${esc(draft.summary)}</textarea></div>
        <div class="grid g2"><div class="field"><label class="f">Certificate valid for</label>${(() => { const m = draft.validityMonths, preset = [6, 12, 24, 36].includes(m) ? String(m) : m > 0 ? 'custom' : 'never';
          return `<select class="input" id="vsel">${[['6', '6 months'], ['12', '12 months'], ['24', '2 years'], ['36', '3 years'], ['custom', 'Custom…'], ['never', 'No expiry']].map(([v, l]) => `<option value="${v}" ${preset === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <div class="row" id="vcustom" style="margin-top:8px;gap:8px;${preset === 'custom' ? '' : 'display:none'}"><input class="input" type="number" min="1" max="120" id="vmonths" value="${m > 0 ? m : 18}" style="width:100px"><span class="small muted">months</span></div>`; })()}</div>
        <div class="field"><label class="f">Colour</label><input class="input" type="color" data-k="colour" value="${draft.colour}" style="height:44px;padding:4px"></div></div>
        <div class="field"><label class="f">Required for roles</label><div class="checks">${db.roles.map(r => `<label><input type="checkbox" name="rr" value="${esc(r)}" ${draft.requiredForRoles.includes(r) ? 'checked' : ''}>${esc(r)}</label>`).join('')}</div><div class="help">Also add it to events under <a href="#/admin/events">Events</a>.</div></div>
        <div class="field"><label class="f">Attestation statement</label><textarea class="input autogrow" data-k="attestation" rows="3">${esc(draft.attestation)}</textarea></div>
        <label class="row small" style="gap:10px;min-height:44px"><input type="checkbox" id="act" ${draft.active !== false ? 'checked' : ''}> Active (assign to volunteers)</label>
      </section>
    </div>
    <section class="pw-history" data-tab="${pwTab}"><h2 class="pw-h" style="margin:28px 0 10px">Version history</h2>
    <div class="card">${(live.versions || []).length ? `<ul class="timeline">${live.versions.slice().reverse().map(v => `<li><span class="when">${fmtDT(v.at)}</span><span><b>v${esc(v.label || v.version + '.0')}</b>${v.kind ? ` <span class="tag" style="font-size:11px">${v.kind === 'major' ? 'Major' : 'Minor'}</span>` : ''} — ${esc(v.note || '')} <span class="muted">· ${esc(v.by || '')}</span></span></li>`).join('')}</ul>` : '<div class="empty">Not published yet</div>'}</div></section>
    ${changed() ? `<div class="pwbar" role="region" aria-label="Unpublished changes"><span><b>Unpublished changes</b><br><span class="tiny">Volunteers still see ${vTag(live)}</span></span><button class="btn red" id="pub2">Publish…</button></div>` : ''}`);

  const refresh = () => renderPathwayEditor(id);
  const syncPub = () => { const c = changed(); $('#pub').disabled = !c; const bar = $('.pwbar');
    if (c && !bar) { app().insertAdjacentHTML('beforeend', `<div class="pwbar" role="region" aria-label="Unpublished changes"><span><b>Unpublished changes</b><br><span class="tiny">Volunteers still see ${vTag(live)}</span></span><button class="btn red" id="pub2">Publish…</button></div>`); $('#pub2').onclick = () => $('#pub').click(); }
    else if (!c && bar) bar.remove(); };
  $$('[data-pwt]').forEach(b => b.onclick = () => { pwTab = b.dataset.pwt; $$('[data-pwt]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); }); $$('.pwgrid,.pw-history').forEach(x => x.dataset.tab = pwTab); });
  $('#pub2') && ($('#pub2').onclick = () => $('#pub').click());
  $$('[data-k]').forEach(el => el.oninput = el.onchange = () => { draft[el.dataset.k] = el.dataset.num != null ? +el.value : el.value; syncPub(); });
  $$('[name=rr]').forEach(el => el.onchange = () => { draft.requiredForRoles = $$('[name=rr]:checked').map(x => x.value); syncPub(); });
  $('#act').onchange = e => { draft.active = e.target.checked; syncPub(); };
  const vupd = () => { const v = $('#vsel').value; $('#vcustom').style.display = v === 'custom' ? '' : 'none'; draft.validityMonths = v === 'never' ? 0 : v === 'custom' ? Math.max(1, +$('#vmonths').value || 1) : +v; syncPub(); };
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
    // suggest major when steps were added, removed, reordered or a video changed; minor otherwise
    const sig = p => p.steps.map(st => st.id + ':' + st.type + (st.type === 'video' ? JSON.stringify(st.video) : '')).join('|');
    const suggest = !live.version || sig(draft) !== sig(live) ? 'major' : 'minor';
    let kind = suggest;
    const s = modal(`<header><div><div class="eyebrow">${esc(draft.title)}</div><h2 style="margin-top:4px">Publish a new version</h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
      <div class="body"><fieldset class="vkind"><legend class="f">What kind of change is this?</legend>
        ${[['minor', 'Small update', 'Typos, clearer wording, extra or improved quiz questions.'], ['major', 'Major update', 'New or changed content, steps added, removed or reordered, a different video.']].map(([k, l, d]) => `<label class="vopt"><input type="radio" name="vk" value="${k}" ${kind === k ? 'checked' : ''}><span><b>${l} <span class="vnum">v${nextLabel(live, k)}</span>${suggest === k ? ' <span class="tag" style="font-size:11px">Suggested</span>' : ''}</b><span class="small muted">${d}</span></span></label>`).join('')}
      </fieldset>
      <div class="field" style="margin-top:14px"><label class="f">What changed?</label><input class="input" id="note" placeholder="e.g. Added two scenario questions"><div class="help">Kept in the version history and audit log.</div></div>
      <div class="notice info small">${ICON.info}<div>Existing certificates stay valid and keep the version they were earned on (for example v${verLabel(live)}). New completions will show <b id="vnew">v${nextLabel(live, kind)}</b>. Anyone partway through keeps the steps they’ve already done if those steps haven’t changed.</div></div></div>
      <footer><button class="btn ghost" data-close>Cancel</button><button class="btn red" id="pubgo">Publish v${nextLabel(live, kind)}</button></footer>`);
    $$('[name=vk]', s).forEach(r => r.onchange = () => { kind = r.value; $('#vnew', s).textContent = 'v' + nextLabel(live, kind); $('#pubgo', s).textContent = 'Publish v' + nextLabel(live, kind); });
    $('#pubgo', s).onclick = () => {
      if (!draft.steps.length) { toast('Add at least one step'); return; }
      const bad = draft.steps.find(st => st.type === 'quiz' && st.questions.length < st.drawCount);
      if (bad) { toast(`“${bad.title}” needs at least ${bad.drawCount} questions`); return; }
      draft.steps.forEach(st => st.rev = stepRev(st));
      const note = $('#note', s).value.trim() || 'Updated';
      const label = nextLabel(live, kind);
      draft.version = live.version + 1; draft.updatedAt = now();
      draft.versions = [...(live.versions || []), { version: draft.version, label, kind, at: now(), note, by: db.settings.adminName }];
      Object.keys(live).forEach(k => delete live[k]); Object.assign(live, JSON.parse(JSON.stringify(draft)));
      audit({ actor: 'admin', action: 'pathway_published', pathwayId: live.id, version: live.version, detail: { note, label, kind, snapshot: live.steps.map(st => ({ id: st.id, type: st.type, title: st.title, rev: st.rev })) } });
      closeModal(); draft = null; toast(`Published v${verLabel(live)}`); renderPathwayEditor(id);
    };
  };
}
const stripRev = p => JSON.parse(JSON.stringify(p, (k, v) => k === 'rev' ? undefined : v));

/* step editor modal */
function stepEditor(step, done, isNew) {
  const work = JSON.parse(JSON.stringify(step));
  const openQs = new Set();
  const s = modal(`<header><h2>${{ video: 'Video step', read: 'Reading step', quiz: 'Quiz step' }[work.type]}</h2><button class="iconbtn" data-close>${ICON.x}</button></header><div class="body" id="seb"></div>
    <footer><button class="btn ghost" id="sdel" style="margin-right:auto;color:var(--red-600)">${ICON.trash} Remove step</button><button class="btn ghost" data-close>Cancel</button><button class="btn red" id="ssave">Done</button></footer>`, work.type === 'quiz' ? 'wide' : '');
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
    body.innerHTML = common + `<div class="field"><label class="f" id="sblab">Content</label>${richEditor(work.format === 'html' ? sanitizeHTML(work.body) : md(work.body), 'sb')}<div class="help">Paste straight from Word or Google Docs — formatting is tidied automatically.</div></div>
      <div class="grid g2"><div class="field"><label class="f">Link label (optional)</label><input class="input" id="sll" value="${esc(work.link?.label || '')}" placeholder="Read the full policy"></div><div class="field"><label class="f">Link URL</label><input class="input" id="slu" value="${esc(work.link?.url || '')}" placeholder="https://…"></div></div>
      <div class="field"><label class="f">Acknowledgement statement</label><input class="input" id="sa" value="${esc(work.ackText || '')}"></div>`;
    bindRichEditor($('#sb', body).closest('.rte'));
  };
  const drawQuiz = () => {
    body.innerHTML = common + `<div class="grid g3"><div class="field"><label class="f">Questions per attempt</label><input class="input" type="number" min="1" max="20" id="qd" value="${work.drawCount}"></div>
      <div class="field"><label class="f">Pass mark (%)</label><input class="input" type="number" min="1" max="100" id="qp" value="${work.passMark}"></div>
      <div class="field"><label class="f">Question bank</label><div class="help" style="margin-top:12px">${work.questions.length} questions · each attempt draws ${work.drawCount}${work.questions.length < work.drawCount * 2 ? ' — <b style="color:#8A5508">add more so retakes feel fresh</b>' : ''}</div></div></div>
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
          <textarea class="input autogrow" data-qf="text" rows="2" placeholder="Question">${esc(q.text)}</textarea>
          ${q.options.map((o, k) => `<div class="optrow"><input type="radio" name="qc${i}" value="${k}" ${q.correct === k ? 'checked' : ''} title="Mark as correct answer"><textarea class="input autogrow" rows="1" data-qo="${k}" placeholder="Option ${'ABCD'[k]}" style="padding:8px 10px">${esc(o)}</textarea></div>`).join('')}
          <input class="input" data-qf="explanation" value="${esc(q.explanation || '')}" placeholder="Explanation shown after the quiz" style="margin-top:8px;padding:8px 10px;font-size:14px">
          <div class="row between" style="margin-top:10px"><button class="btn ghost xs" data-qdel="${i}" style="color:var(--red-600)">${ICON.trash} Delete question</button><button class="btn ghost xs" data-qdone="${q.id}">Done</button></div>
        </div></div>`; }).join('') || '<div class="empty">No questions yet</div>'}</div>
      <button type="button" class="qaddbig" id="qadd2">+ Add question</button>
      <p class="tiny muted">Select the circle next to the correct answer. Answer order is shuffled for each learner.</p>`;
    $$('[data-fb]', body).forEach(b => b.onclick = () => { keep(); work.feedback = b.dataset.fb; drawQuiz(); });
    $('#qlock', body).onchange = e => { $('#qlockn', body).style.display = e.target.checked ? '' : 'none'; $('#qlockoff', body).style.display = e.target.checked ? 'none' : ''; };
    const addQ = () => { keep(); const q = { id: uid('q_'), text: '', options: ['', '', '', ''], correct: 0, explanation: '' }; work.questions.push(q); openQs.add(q.id); drawQuiz(); const el = $(`[data-qid="${q.id}"]`, body); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => $('textarea', el)?.focus(), 250); };
    $('#qadd', body).onclick = addQ; $('#qadd2', body).onclick = addQ;
    $$('.qsum', body).forEach(b => b.onclick = () => { const it = b.closest('.qitem'), id = it.dataset.qid; const open = !it.classList.contains('open'); it.classList.toggle('open', open); $$('textarea.autogrow', it).forEach(grow); b.setAttribute('aria-expanded', open); open ? openQs.add(id) : openQs.delete(id); if (open) setTimeout(() => $('textarea', it)?.focus(), 30); });
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
    if (work.type === 'read') { work.body = sanitizeHTML($('#sb', body).innerHTML); work.format = 'html'; work.ackText = $('#sa', body).value; const u = $('#slu', body).value.trim(); work.link = u ? { url: u, label: $('#sll', body).value.trim() || 'Open document' } : null; }
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
          <label class="row small" style="gap:8px;margin-bottom:12px"><input type="checkbox" id="democtl" ${st.demoControls !== false ? 'checked' : ''} style="accent-color:var(--red-600);width:18px;height:18px"> Show demo controls (skip video, auto-answer quizzes)</label>
          <p class="small muted">Put the sample volunteers, events and pathways back to how they started.</p><button class="btn ghost sm" id="reset" style="color:var(--red-600)">Reset demo data</button></div>
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
    if (heldPathway(p, pw) && ['notstarted', 'locked'].includes(rule.trigger)) return;
    const st = statusOf(p, pw), c = latestCompletion(p.id, pw.id);
    if (rule.trigger === 'expiring' && c && !c.expiresAt.startsWith('9999')) { const dl = Math.ceil((new Date(c.expiresAt) - now) / DAY); const th = [...rule.days].sort((a, b) => a - b).find(d => dl > 0 && dl <= d); if (th != null) add(p, { training: pw.title, expiry: c.expiresAt, daysLeft: dl }, `${rule.id}|${p.id}|${c.id}|${th}`); }
    if (rule.trigger === 'expired' && st.key === 'expired' && st.c) add(p, { training: pw.title, expiry: st.c.expiresAt }, `${rule.id}|${p.id}|${st.c.id}`);
    if (rule.trigger === 'notstarted' && st.key === 'none' && now - new Date(p.createdAt) > rule.days[0] * DAY) add(p, { training: pw.title }, `${rule.id}|${p.id}|${pw.id}`);
    if (rule.trigger === 'locked' && st.key === 'locked') add(p, { training: pw.title }, `${rule.id}|${p.id}|${pw.id}|${lockInfo(p, pw)?.lockedAt || ''}`);
  }));
  if (rule.trigger === 'event') db.events.filter(isReleased).forEach(ev => { const dl = Math.ceil((new Date(ev.date) - now) / DAY); const th = [...rule.days].sort((a, b) => a - b).find(d => dl > 0 && dl <= d); if (th == null) return;
    live().filter(p => p.eventIds.includes(ev.id) && eventState(p, ev) !== 'ready').forEach(p => add(p, { event: ev, training: ev.requiredPathways.map(id => P(id)?.title).filter(Boolean).join(' and '), daysLeft: dl }, `${rule.id}|${p.id}|${ev.id}|${th}`)); });
  // one email per person per rule run
  const seen = new Set(); return out.filter(x => !seen.has(x.p.id) && seen.add(x.p.id));
}
function sendEmails(items, { subject, body, source, ruleId = null, at = null, rollout = false }) {
  db.outbox ||= []; at ||= now();
  items = items.filter(({ p }) => p && !p.archived);   // archived volunteers are never emailed
  // stay inside the email plan's daily limit: what doesn't fit goes out tomorrow morning
  if (!rollout && !proActive(dayISO(at))) { const room = allowanceLeft(dayISO(at), items.length > 1); if (items.length > room) { const later = items.slice(room); items = items.slice(0, room);
    scheduleEmails(later, { subject, body, ruleId, source, at: tomorrow9(Date.parse(at)), label: `${subject} (rest of a send, held to stay within the free plan)` });
    setTimeout(() => toast(`${later.length} email${later.length === 1 ? '' : 's'} held until tomorrow to stay within today's free allowance`), 400); } }
  items.forEach(({ p, ctx = {}, key }) => {
    const sj = mergeText(subject, p, ctx), bd = mergeText(body, p, ctx);
    db.outbox.push({ id: uid('m_'), at, to: p.email, personId: p.id, subject: sj, body: bd, source, ruleId, key: key || null, by: source === 'automatic' ? 'system' : db.settings.adminName });
    db.audit.push({ id: uid('a_'), at, personId: p.id, actor: source === 'automatic' ? 'system' : 'admin', action: 'email_sent', detail: { name: p.name, subject: sj, source, rule: ruleId && RULE(ruleId)?.name } });
  });
  persist(); if (items.length && !rollout) mailPop(db.outbox.slice(-items.length)); return items.length;
}
/* demo: show sent emails in the browser */
function mailPop(msgs) {
  if (!(location.hash || '').startsWith('#/admin')) return;
  let wrap = $('#mailpops'); if (!wrap) { wrap = document.createElement('div'); wrap.id = 'mailpops'; document.body.appendChild(wrap); }
  const m = msgs[msgs.length - 1], p = Person(m.personId);
  const el = document.createElement('div'); el.className = 'mailpop';
  el.innerHTML = `<div class="mp-ic">${ICON.mail}</div><div class="mp-txt"><div class="mp-k">${msgs.length > 1 ? `${msgs.length} emails sent` : `Email sent · ${m.source === 'automatic' ? 'automatic' : 'just now'}`}</div><b>${esc(m.subject)}</b><div class="tiny muted">To ${esc(p?.name || m.to)}${msgs.length > 1 ? ` and ${msgs.length - 1} more` : ''}</div>
    <div class="row" style="gap:6px;margin-top:8px"><button class="btn red xs" data-mpv>Preview</button>${p ? `<button class="btn ghost xs" data-mpi>Open ${esc(firstName(p.name))}’s inbox</button>` : ''}</div></div><button class="iconbtn mp-x" aria-label="Dismiss">${ICON.x}</button>`;
  wrap.prepend(el); while (wrap.children.length > (innerWidth < 620 ? 1 : 3)) wrap.lastChild.remove();
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
  const r = (db.emailRules || []).find(x => x.trigger === trigger); if (!r || !r.enabled || !p || p.archived) return;
  if (trigger === 'assigned') { if (ctx.event && !isReleased(ctx.event)) return 'held'; const a = assignedCtx(p, ctx.event); if (!a) return; ctx = { ...ctx, ...a, event: ctx.event || a.event }; }
  sendEmails([{ p, ctx, key: `${r.id}|${p.id}|${ctx.key || now()}` }], { subject: r.subject, body: r.body, source: 'automatic', ruleId: r.id });
}
/* pick the right one-click reminder for someone's situation */
function reminderFor(p) {
  if (p.archived) return null;
  const req = requiredPathwaysFor(p); const sts = req.map(pw => ({ pw, st: statusOf(p, pw), held: heldPathway(p, pw) }));
  const pick = k => sts.find(x => x.st.key === k);
  let x;
  if ((x = pick('expired'))) return { rule: RULE('r-expired'), ctx: { training: x.pw.title, expiry: x.st.c?.expiresAt } };
  if ((x = pick('due'))) return { rule: RULE('r-expiring'), ctx: { training: x.pw.title, expiry: x.st.c.expiresAt, daysLeft: Math.ceil((new Date(x.st.c.expiresAt) - Date.now()) / DAY) } };
  const pickOpen = k => sts.find(x => x.st.key === k && !x.held);
  if ((x = pickOpen('none') || pickOpen('progress'))) { const ev = p.eventIds.map(EventById).find(e => e && isReleased(e) && e.requiredPathways.includes(x.pw.id)); return { rule: ev ? RULE('r-event') : RULE('r-notstarted'), ctx: { training: x.pw.title, event: ev } }; }
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
function composeEmail(people, { title = 'Email people', ruleId = '', ctxFor = () => ({}), note = '', event = null } = {}) {
  people = people.filter(p => p && !p.archived);
  if (!people.length) { toast('No one to email'); return; }
  let rid = ruleId || 'custom'; let subj = '', body = ''; const sel = new Set(people.map(p => p.id)); let rq = '';
  if (!event) { const e0 = ctxFor(people[0])?.event; if (e0) event = e0; }
  const load = () => { const r = RULE(rid); subj = r ? r.subject : 'News about your safeguarding training'; body = r ? r.body : `Hi {first_name},\n\n`; };
  load();
  const s = modal(`<header><div><h2>${esc(title)}</h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body compose">
      <div>
        ${note ? `<div class="notice info small" style="margin-bottom:12px">${ICON.info}<div>${note}</div></div>` : ''}
        <details class="recipbox" ${people.length <= 6 ? 'open' : ''}><summary><span><b>To:</b> <span id="rsum"></span></span><span class="small" style="color:var(--red-600);font-weight:700">Choose who</span></summary>
          <div class="row between" style="margin:10px 0 8px;gap:8px"><input class="input" id="rq" placeholder="Search recipients…" style="flex:1;padding:8px 12px"><button type="button" class="btn ghost xs" id="rall">All</button><button type="button" class="btn ghost xs" id="rnone">None</button></div>
          <div class="reciplist" id="rlist"></div></details>
        <div class="field"><label class="f">Template</label><select class="input" id="ctpl"><option value="custom">Custom message</option>${db.emailRules.map(r => `<option value="${r.id}" ${rid === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
        <div class="field"><label class="f">Subject</label><input class="input" id="csub"></div>
        <div class="field"><label class="f">Message</label><textarea class="input" id="cbody" style="min-height:180px"></textarea>
          <div class="mergechips">${MERGE.map(([k, l]) => `<button type="button" data-merge="${k}" title="Insert ${l}">{${k}}</button>`).join('')}</div></div>
        <div class="field"><label class="f">When</label>${whenPicker(event)}</div>
      </div>
      <div><div class="tiny muted" style="margin-bottom:6px">Preview for <select id="cwho" class="input" style="display:inline-block;width:auto;padding:4px 30px 4px 8px;font-size:13px"></select></div><div id="cprev"></div></div>
    </div>
    <footer><button class="btn ghost" id="ctest" style="margin-right:auto">Send me a test</button><span class="small muted hide-sm" style="align-self:center">Demo: recorded, not really sent</span><button class="btn ghost" data-close>Cancel</button><button class="btn red" id="csend"></button></footer>`, 'wide');
  const chosen = () => people.filter(p => sel.has(p.id));
  const getWhen = bindWhen(s, () => upd());
  const upd = () => { const n = sel.size, w = getWhen();
    $('#rsum', s).textContent = n === people.length ? `${n === 1 ? people[0].name : `all ${n.toLocaleString('en-GB')} people`}` : `${n} of ${people.length.toLocaleString('en-GB')} people`;
    const b = $('#csend', s); b.disabled = !n || w === 'invalid';
    b.textContent = !n ? 'Choose someone' : `${w ? 'Schedule for' : 'Send to'} ${n === 1 ? firstName(chosen()[0].name) : n.toLocaleString('en-GB') + ' people'}${w && w !== 'invalid' ? ` · ${whenText(w)}` : ''}`;
    const cur = $('#cwho', s).value; const c = chosen().slice(0, 30);
    $('#cwho', s).innerHTML = c.map(p => `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>${esc(p.name)}</option>`).join(''); prev(); };
  const drawR = () => { const list = people.filter(p => !rq || (p.name + ' ' + p.email).toLowerCase().includes(rq)).slice(0, 200);
    $('#rlist', s).innerHTML = list.map(p => `<label class="reciprow"><input type="checkbox" value="${p.id}" ${sel.has(p.id) ? 'checked' : ''}><span>${esc(p.name)}</span><span class="tiny muted">${esc(p.email)}</span></label>`).join('') + (people.length > list.length && !rq ? `<div class="tiny muted" style="padding:6px">Showing 200 — search to find others</div>` : '');
    $$('#rlist input', s).forEach(i => i.onchange = () => { i.checked ? sel.add(i.value) : sel.delete(i.value); upd(); }); };
  const fill = () => { $('#csub', s).value = subj; $('#cbody', s).value = body; prev(); };
  const prev = () => { const p = Person($('#cwho', s).value) || chosen()[0] || people[0]; $('#cprev', s).innerHTML = emailHTML(mergeText($('#csub', s).value, p, ctxFor(p)), mergeText($('#cbody', s).value, p, ctxFor(p)), p); };
  drawR(); fill(); upd();
  $('#rq', s).oninput = e => { rq = e.target.value.toLowerCase(); drawR(); };
  $('#rall', s).onclick = () => { people.forEach(p => sel.add(p.id)); drawR(); upd(); };
  $('#rnone', s).onclick = () => { sel.clear(); drawR(); upd(); };
  $('#ctpl', s).onchange = e => { rid = e.target.value; load(); fill(); };
  $('#csub', s).oninput = prev; $('#cbody', s).oninput = prev; $('#cwho', s).onchange = prev;
  $$('[data-merge]', s).forEach(b => b.onclick = () => { const ta = $('#cbody', s), t = `{${b.dataset.merge}}`, i = ta.selectionStart ?? ta.value.length; ta.value = ta.value.slice(0, i) + t + ta.value.slice(ta.selectionEnd ?? i); ta.focus(); ta.selectionStart = ta.selectionEnd = i + t.length; prev(); });
  $('#ctest', s).onclick = () => { const p = Person($('#cwho', s).value) || people[0]; const m = { id: 'test', at: now(), to: ADMIN_DEMO.email, personId: null, subject: '[Test] ' + mergeText($('#csub', s).value, p, ctxFor(p)), body: mergeText($('#cbody', s).value, p, ctxFor(p)), source: 'ad-hoc', by: db.settings.adminName }; mailPop([m]); toast(`Test sent to ${ADMIN_DEMO.email} (filled in as ${p.name})`); };
  $('#csend', s).onclick = () => { const sj = $('#csub', s).value.trim(), bd = $('#cbody', s).value.trim(); if (!sj || !bd) { toast('Add a subject and message'); return; }
    const items = chosen().map(p => ({ p, ctx: ctxFor(p) })), w = getWhen(); const src = rid === 'custom' ? 'ad-hoc' : 'manual', r = rid === 'custom' ? null : rid;
    if (w) { const n = scheduleEmails(items, { subject: sj, body: bd, source: src, ruleId: r, at: w, label: sj }); closeModal(); toast(`${n} email${n === 1 ? '' : 's'} scheduled for ${whenText(w)}`); route(); return; }
    const n = sendEmails(items, { subject: sj, body: bd, source: src, ruleId: r });
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
    `<button class="btn ghost sm" id="ecomp">Write an email…</button><button class="btn ghost sm" id="esmart">Remind everyone who needs it…</button><button class="btn red sm" id="erun" ${totalDue ? '' : 'disabled'}>Send due automatic reminders (${totalDue})</button>`) + `
    ${allowanceBar()}
    <a class="card rocard" href="#/admin/emails/rollout"><div><b>${db.rollout?.status === 'running' ? `Rollout in progress · ${db.rollout.waves.reduce((n, w) => n + w.count, 0)} invited, ${db.rollout.queue.length} to go` : 'Launching? Roll out to everyone in daily batches'}</b><span class="small muted">${db.rollout?.status === 'running' ? 'See the batches and forecast' : 'Plan invites to fit the free email plan, or use a paid plan for just the first month'}</span></div>${ICON.arrow}</a>
    <div class="notice info small" style="margin-bottom:18px">${ICON.info}<div><b>Demo:</b> emails are recorded in the log below but not actually sent. In the live version, automatic reminders run every morning and send through an email service (e.g. Postmark or Resend).</div></div>
    ${(() => { const sch = [...(db.scheduled || [])].sort((a, b) => a.at.localeCompare(b.at)); const rel = db.events.filter(e => !isReleased(e)).sort((a, b) => (releaseDate(a) || '9').localeCompare(releaseDate(b) || '9'));
      return sch.length || rel.length ? `<h2 style="margin-bottom:12px">Coming up</h2><div class="card" style="margin-bottom:28px;padding:6px 18px">
      ${sch.map(x => `<div class="uprow"><div class="upwhen"><b>${fmtDate(x.at)}</b><span class="tiny muted">${whenText(x.at).split(' at ')[1]}</span></div><div style="flex:1;min-width:0"><b>${esc(x.label)}</b><div class="tiny muted">${x.items.length} ${x.items.length === 1 ? 'person' : 'people'} · scheduled by ${esc(x.by)} on ${fmtDate(x.createdAt)}</div></div><div class="row" style="gap:6px"><button class="btn ghost xs" data-schv="${x.id}">Preview</button><button class="btn soft xs" data-schs="${x.id}">Send now</button><button class="btn ghost xs" data-schc="${x.id}" style="color:var(--red-600)">Cancel</button></div></div>`).join('')}
      ${rel.map(e => { const n = live().filter(p => p.eventIds.includes(e.id) && assignedCtx(p, e)).length; return `<div class="uprow"><div class="upwhen"><b>${releaseDate(e) ? fmtDate(releaseDate(e)) : 'On hold'}</b><span class="tiny muted">${releaseDate(e) ? '09:00' : 'manual'}</span></div><div style="flex:1;min-width:0"><b>Training invites · ${esc(e.name)}</b><div class="tiny muted">${n} ${n === 1 ? 'person' : 'people'} on the team so far · ${esc(releaseLabel(e))}</div></div><div class="row" style="gap:6px"><a class="btn ghost xs" href="#/admin/events/${e.id}">Open event</a></div></div>`; }).join('')}</div>` : ''; })()}
    <h2 style="margin-bottom:12px">Automatic reminders</h2>
    <div class="grid g2" style="margin-bottom:28px">${db.emailRules.map(r => `<div class="card rulecard ${r.enabled ? '' : 'off'}">
      <div class="row between" style="align-items:flex-start;flex-wrap:nowrap;gap:14px"><div><div class="row" style="gap:8px"><span class="tag" style="background:${r.kind === 'time' ? 'var(--sky-50)' : 'var(--plum-50)'};color:${r.kind === 'time' ? '#24666D' : 'var(--plum)'}">${r.kind === 'time' ? 'Time-based' : 'When it happens'}</span></div>
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
  $('#esmart').onclick = openSendReminders;
  $$('[data-schs]').forEach(b => b.onclick = () => { const x = db.scheduled.find(y => y.id === b.dataset.schs); const n = sendScheduled(x, 'manual'); toast(`${n} sent`); renderEmails(); });
  $$('[data-schc]').forEach(b => b.onclick = e => { if (!confirmInline(e.currentTarget, 'Click again')) return; const x = db.scheduled.find(y => y.id === b.dataset.schc); db.scheduled = db.scheduled.filter(y => y !== x); audit({ actor: 'admin', action: 'schedule_cancelled', detail: { label: x.label, count: x.items.length } }); toast('Scheduled send cancelled'); renderEmails(); });
  $$('[data-schv]').forEach(b => b.onclick = () => { const x = db.scheduled.find(y => y.id === b.dataset.schv); const it = x.items.map(i => ({ p: Person(i.pid), ctx: unpackCtx(i.ctx) })).find(i => i.p); if (!it) return;
    modal(`<header><div><div class="eyebrow">Scheduled for ${esc(whenText(x.at))} · ${x.items.length} people</div><h2 style="margin-top:4px">${esc(x.label)}</h2><div class="small muted">Preview for ${esc(it.p.name)}</div></div><button class="iconbtn" data-close>${ICON.x}</button></header><div class="body">${emailHTML(mergeText(x.subject, it.p, it.ctx), mergeText(x.body, it.p, it.ctx), it.p)}<div class="recips" style="margin-top:14px">${x.items.slice(0, 30).map(i => `<span class="tag">${esc(Person(i.pid)?.name || 'Removed')}</span>`).join('')}${x.items.length > 30 ? `<span class="tag">+${x.items.length - 30} more</span>` : ''}</div></div>`, 'wide'); });
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
  const s = modal(`<header><div><div class="eyebrow" style="color:var(--red-600)">Permanent deletion</div><h2 style="margin-top:4px">Delete ${esc(p.name)}?</h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
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
  const s = modal(`<header><div><h2>Import volunteers from CSV</h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
  <div class="body" id="imbody"><p class="muted small" style="margin-top:0">Columns: <code>first_name, last_name, email</code> (optional: <code>roles</code>, <code>events</code> — separate several with <code>;</code>). Existing emails are updated — their training history is never touched. Archived volunteers in the file can be reactivated. Have the <b>complete</b> list? <button class="linkbtn dark" id="tosync">Sync a full list instead</button> — it also archives anyone who’s no longer on it.</p>
    <div class="dropzone" id="dz"><b>Drop a CSV file here</b> or click to choose<input type="file" accept=".csv,text/csv" hidden id="fi"></div>
    <div class="row" style="margin-top:12px;gap:8px"><button class="btn ghost xs" id="tpl">${ICON.dl} Blank template</button><button class="btn ghost xs" id="smp">${ICON.dl} Sample file</button><button class="btn soft xs" id="smpgo">Try the sample now</button></div></div>`, 'wide');
  const dz = $('#dz', s), fi = $('#fi', s);
  dz.onclick = () => fi.click(); dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = e => { e.preventDefault(); e.dataTransfer.files[0] && e.dataTransfer.files[0].text().then(t => previewImport(t, e.dataTransfer.files[0].name)); };
  fi.onchange = () => fi.files[0] && fi.files[0].text().then(t => previewImport(t, fi.files[0].name));
  $('#tosync', s).onclick = () => { closeModal(); rosterSync(); };
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
    modal(`<header><div><h2><code>${b.dataset.tbl}</code> <span class="muted" style="font-size:16px">${rows.length} rows</span></h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
      <div class="body"><p class="small muted" style="margin-top:0">First 5 rows, exactly as stored — the same shape the D1 Worker would return.</p><pre class="rowdump">${esc(JSON.stringify(rows.slice(-5).reverse(), null, 2))}</pre></div>`, 'wide'); });
  $('#scale').onclick = e => { if (db.people.length > 2500) { toast('Already at scale'); return; } if (!confirmInline(e.currentTarget, 'Click again — adds ~3,000 people')) return;
    const t0 = performance.now(); const back = d => new Date(Date.now() - d * DAY).toISOString();
    seedCrowd(P('p-essentials'), P('p-leaders'), back, null, { scale: Math.ceil((3000 - db.people.length) / 33), lite: true, seed: Date.now() % 1e6 });
    audit({ actor: 'admin', action: 'data_imported', detail: { kind: 'Scale test', total: db.people.length } });
    toast(`${db.people.length.toLocaleString('en-GB')} volunteers loaded in ${Math.round(performance.now() - t0)} ms`); renderPrivacy(); };
  $('#xreset').onclick = e => { if (!confirmInline(e.currentTarget, 'Click again to reset everything')) return; Store.clear(); seed(); draft = null; Session.set('admin', { email: ADMIN_DEMO.email, at: now() }); toast('Demo data reset'); go('#/admin'); };
}

/* =====================================================================
   TRAINING RELEASE SCHEDULES · SCHEDULED EMAILS · SMART REMINDERS
   ===================================================================== */
const dayISO = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const todayISO = () => dayISO(Date.now());
const RELEASE_MODES = [['now', 'As soon as people are added'], ['before', 'A set time before the event'], ['date', 'On a date I choose'], ['manual', 'Hold until I release them']];
const releaseOf = ev => ev.release || (typeof DEMO_RELEASE !== 'undefined' && DEMO_RELEASE[ev.id]) || { mode: 'now' };
function releaseDate(ev) { const r = releaseOf(ev);
  if (r.mode === 'date') return r.date || null;
  if (r.mode === 'before') return dayISO(new Date(ev.date + 'T09:00').getTime() - (r.weeks || 6) * 7 * DAY);
  return null; }
function isReleased(ev) { if (!ev) return true; if (ev.releasedAt) return true; const r = releaseOf(ev);
  if (r.mode === 'now') return true; if (r.mode === 'manual') return false; const d = releaseDate(ev); return !!d && d <= todayISO(); }
function releaseLabel(ev, short = false) { const r = releaseOf(ev);
  if (ev.releasedAt && r.mode !== 'now') return `Invites sent ${fmtDate(ev.releasedAt)}`;
  if (r.mode === 'now') return short ? 'Invites sent as people join' : 'Training invites go out as soon as people are added';
  if (r.mode === 'manual') return 'Invites on hold until you release them';
  return `Invites go out ${fmtDate(releaseDate(ev))}${r.mode === 'before' ? ` (${r.weeks} week${r.weeks === 1 ? '' : 's'} before)` : ''}`; }
/* a pathway is "held" for someone if only unreleased events require it */
function heldPathway(p, pw) {
  if (pw.requiredForRoles.some(r => p.roles.includes(r))) return false;
  const evs = p.eventIds.map(EventById).filter(e => e && e.requiredPathways.includes(pw.id));
  return evs.length > 0 && evs.every(e => !isReleased(e));
}
function assignedCtx(p, ev) {
  const pws = (ev ? ev.requiredPathways.map(P).filter(Boolean) : requiredPathwaysFor(p)).filter(pw => !heldPathway(p, pw) && ['none', 'progress', 'expired'].includes(statusOf(p, pw).key));
  if (!pws.length) return null;
  return { event: ev || p.eventIds.map(EventById).find(e => e && isReleased(e) && pws.some(pw => e.requiredPathways.includes(pw.id))), training: pws.map(pw => pw.title).join(' and ') };
}
function releaseEvent(ev, source = 'manual') {
  ev.releasedAt = now();
  const r = RULE('r-assigned'); const team = live().filter(p => p.eventIds.includes(ev.id));
  const items = team.map(p => ({ p, ctx: assignedCtx(p, ev), key: `r-assigned|${p.id}|${ev.id}` })).filter(x => x.ctx);
  const n = r && r.enabled && items.length ? sendEmails(items, { subject: r.subject, body: r.body, source: 'automatic', ruleId: r.id }) : 0;
  audit({ actor: source === 'manual' ? 'admin' : 'system', action: 'training_released', detail: { name: ev.name, invites: n, team: team.length, source } });
  return n;
}
function processReleases() { let n = 0;
  db.events.forEach(ev => { if (!ev.releasedAt && releaseOf(ev).mode !== 'now' && isReleased(ev)) { const k = releaseEvent(ev, 'scheduled'); n += k; if (k) toast(`${ev.name}: ${k} training invite${k === 1 ? '' : 's'} sent as scheduled`); } });
  return n; }

/* release-setting fields (event form + batch add) */
function releaseFields(r = { mode: 'now' }, released = null) {
  return `<div class="field relfields"><label class="f">When should training invites go out?</label>
    <div class="relmodes">${RELEASE_MODES.map(([k, l]) => `<label class="radiorow"><input type="radio" name="relm" value="${k}" ${r.mode === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
    <div class="row relx" data-for="before" style="gap:8px;margin-top:8px"><input class="input" type="number" min="1" max="52" id="relw" value="${r.weeks || 6}" style="width:90px"><span class="small muted">weeks before the event starts</span></div>
    <div class="row relx" data-for="date" style="gap:8px;margin-top:8px"><input class="input" type="date" id="reld" value="${r.date || ''}" style="width:200px"></div>
    <div class="help">People can still be added any time — the invite email waits until this point. Reminders for this event wait too.${released ? ` <b>Invites already went out ${fmtDate(released)}.</b>` : ''}</div></div>`;
}
function bindReleaseFields(s) { const sync = () => { const m = $('[name=relm]:checked', s)?.value; $$('.relx', s).forEach(x => x.hidden = x.dataset.for !== m); }; $$('[name=relm]', s).forEach(i => i.onchange = sync); sync(); }
function readRelease(s) { const mode = $('[name=relm]:checked', s)?.value || 'now';
  return mode === 'before' ? { mode, weeks: Math.max(1, +$('#relw', s).value || 6) } : mode === 'date' ? { mode, date: $('#reld', s).value } : { mode }; }

/* ---------- send now / schedule picker ---------- */
function whenPicker(ev) {
  const at9 = (d) => { const x = new Date(d); x.setHours(9, 0, 0, 0); return x; };
  const tmr = at9(Date.now() + DAY), mon = (() => { const x = at9(Date.now()); x.setDate(x.getDate() + ((8 - x.getDay()) % 7 || 7)); return x; })(), wk = at9(Date.now() + 7 * DAY);
  const quick = [['Tomorrow 9am', tmr], ['Monday 9am', mon], ['In a week', wk]];
  if (ev) { [6, 4, 2].forEach(w => { const d = at9(new Date(ev.date + 'T09:00').getTime() - w * 7 * DAY); if (d > Date.now() + DAY) quick.push([`${w} weeks before ${ev.name.replace(/ —.*/, '')}`, d]); }); }
  const local = d => `${dayISO(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `<div class="whenpick"><div class="seg"><button type="button" data-wm="now" class="on">Send now</button><button type="button" data-wm="later">Schedule</button></div>
    <div class="whenlater" hidden><div class="qchips">${quick.slice(0, 5).map(([l, d]) => `<button type="button" data-wq="${local(d)}">${esc(l)}</button>`).join('')}</div>
      <input class="input" type="datetime-local" id="wat" value="${local(tmr)}" min="${local(new Date())}"></div></div>`;
}
function bindWhen(s, onChange = () => {}) {
  let mode = 'now';
  $$('[data-wm]', s).forEach(b => b.onclick = () => { mode = b.dataset.wm; $$('[data-wm]', s).forEach(x => x.classList.toggle('on', x === b)); $('.whenlater', s).hidden = mode !== 'later'; onChange(); });
  $$('[data-wq]', s).forEach(b => b.onclick = () => { $('#wat', s).value = b.dataset.wq; $$('[data-wq]', s).forEach(x => x.classList.toggle('on', x === b)); onChange(); });
  $('#wat', s).oninput = () => { $$('[data-wq]', s).forEach(x => x.classList.remove('on')); onChange(); };
  return () => { if (mode === 'now') return null; const v = $('#wat', s).value; const d = v ? new Date(v) : null; return d && d > new Date() ? d.toISOString() : 'invalid'; };
}
const whenText = at => { const d = new Date(at); return `${fmtDate(at)} at ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/* ---------- scheduled email queue ---------- */
const packCtx = c => ({ ...c, event: c.event?.id || null });
const unpackCtx = c => ({ ...c, event: c.event ? EventById(c.event) : undefined });
function scheduleEmails(items, { subject, body, ruleId = null, source = 'manual', at, label = '' }) {
  db.scheduled ||= [];
  const list = items.filter(x => x.p && !x.p.archived).map(({ p, ctx = {}, key }) => ({ pid: p.id, key: key || null, ctx: packCtx(ctx) }));
  if (!list.length) return 0;
  db.scheduled.push({ id: uid('s_'), at, createdAt: now(), by: db.settings.adminName, subject, body, ruleId, source, label: label || subject, items: list });
  audit({ actor: 'admin', action: 'emails_scheduled', detail: { count: list.length, label: label || subject, at } });
  return list.length;
}
function sendScheduled(s, how = 'scheduled') {
  const n = sendEmails(s.items.map(i => ({ p: Person(i.pid), ctx: unpackCtx(i.ctx), key: i.key })), { subject: s.subject, body: s.body, source: s.source, ruleId: s.ruleId });
  db.scheduled = db.scheduled.filter(x => x !== s);
  audit({ actor: how === 'scheduled' ? 'system' : 'admin', action: 'emails_sent', detail: { count: n, template: s.label, scheduled: true } }); persist();
  return n;
}
function processScheduled() { const due = (db.scheduled || []).filter(s => s.at <= now()); due.forEach(s => { const n = sendScheduled(s); toast(`Scheduled email sent: “${s.label}” (${n})`); }); return due.length; }

/* ---------- smart reminders: the right template for each person ---------- */
function remindPeople(people, { title = 'Send reminders', event = null } = {}) {
  const active = people.filter(p => !p.archived), archived = people.length - active.length;
  const groups = new Map(); let upToDate = 0, locked = 0, held = 0;
  active.forEach(p => { const r = reminderFor(p);
    if (!r) { const req = requiredPathwaysFor(p); if (req.some(pw => statusOf(p, pw).key === 'locked')) locked++; else if (req.length && req.every(pw => heldPathway(p, pw) || ['complete'].includes(statusOf(p, pw).key)) && req.some(pw => heldPathway(p, pw))) held++; else upToDate++; return; }
    if (!groups.has(r.rule.id)) groups.set(r.rule.id, { rule: r.rule, items: [] }); groups.get(r.rule.id).items.push({ p, ctx: r.ctx }); });
  const G = [...groups.values()]; const on = new Set(G.map(g => g.rule.id));
  if (!G.length) { toast(active.length === 1 ? `${firstName(active[0].name)} has nothing to be reminded about` : 'No one here needs a reminder right now'); return; }
  const total = () => G.filter(g => on.has(g.rule.id)).reduce((n, g) => n + g.items.length, 0);
  const s = modal(`<header><div><div class="eyebrow">${active.length === 1 ? esc(active[0].name) : `${people.length.toLocaleString('en-GB')} selected`}</div><h2 style="margin-top:4px">${esc(title)}</h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body"><p class="small muted" style="margin-top:0">Each person gets the reminder that fits where they are — you don’t need to sort them first.</p>
      <div class="stack" style="gap:8px">${G.map(g => `<label class="remgrp"><input type="checkbox" data-g="${g.rule.id}" checked><span style="flex:1"><b>${esc(g.rule.name)}</b><br><span class="tiny muted">“${esc(mergeText(g.rule.subject, g.items[0].p, g.items[0].ctx))}”</span><br><span class="tiny">${g.items.slice(0, 4).map(i => esc(i.p.name)).join(', ')}${g.items.length > 4 ? ` +${g.items.length - 4} more` : ''}</span></span><span class="tag">${g.items.length}</span><button type="button" class="btn ghost xs" data-gp="${g.rule.id}">Preview</button></label>`).join('')}</div>
      ${upToDate + locked + held + archived ? `<p class="tiny muted" style="margin:12px 0 0">Not included: ${[upToDate && `${upToDate} up to date`, locked && `${locked} waiting for a follow-up chat`, held && `${held} whose event invites haven’t gone out yet`, archived && `${archived} archived (never emailed)`].filter(Boolean).join(' · ')}.</p>` : ''}
      <div style="margin-top:16px">${whenPicker(event)}</div></div>
    <footer><button class="btn ghost" id="rcustom" style="margin-right:auto">Write my own message…</button><button class="btn ghost" data-close>Cancel</button><button class="btn red" id="rgo2"></button></footer>`, 'wide');
  const getWhen = bindWhen(s, () => upd());
  const upd = () => { const n = total(), w = getWhen(); $('#rgo2', s).disabled = !n || w === 'invalid'; $('#rgo2', s).textContent = n ? `${w ? 'Schedule' : 'Send'} ${n} reminder${n === 1 ? '' : 's'}${w && w !== 'invalid' ? ` · ${whenText(w)}` : ''}` : 'Nothing selected'; };
  upd();
  $$('[data-g]', s).forEach(c => c.onchange = () => { c.checked ? on.add(c.dataset.g) : on.delete(c.dataset.g); upd(); });
  $$('[data-gp]', s).forEach(b => b.onclick = e => { e.preventDefault(); const g = groups.get(b.dataset.gp), it = g.items[0]; const pv = document.createElement('div'); pv.className = 'scrim'; pv.style.zIndex = 95;
    pv.innerHTML = `<div class="modal wide"><header><div><div class="eyebrow">Preview for ${esc(it.p.name)}</div><h2 style="margin-top:4px">${esc(g.rule.name)}</h2></div><button class="iconbtn" data-x>${ICON.x}</button></header><div class="body">${emailHTML(mergeText(g.rule.subject, it.p, it.ctx), mergeText(g.rule.body, it.p, it.ctx), it.p)}</div></div>`;
    document.body.appendChild(pv); pv.onclick = ev => { if (ev.target === pv || ev.target.closest('[data-x]')) pv.remove(); }; });
  $('#rcustom', s).onclick = () => { const t = G.flatMap(g => g.items.map(i => i.p)); closeModal(); composeEmail(t, { title, event }); };
  $('#rgo2', s).onclick = () => { const w = getWhen(); let n = 0;
    G.filter(g => on.has(g.rule.id)).forEach(g => { n += w ? scheduleEmails(g.items, { subject: g.rule.subject, body: g.rule.body, ruleId: g.rule.id, at: w, label: `Reminder · ${g.rule.name}` }) : sendEmails(g.items, { subject: g.rule.subject, body: g.rule.body, source: 'manual', ruleId: g.rule.id }); });
    if (!w) audit({ actor: 'admin', action: 'emails_sent', detail: { count: n, template: 'Smart reminders' } });
    closeModal(); toast(w ? `${n} reminder${n === 1 ? '' : 's'} scheduled for ${whenText(w)}` : `${n} reminder${n === 1 ? '' : 's'} sent`); route(); };
}
function openSendReminders() { remindPeople(live(), { title: 'Remind everyone who needs it' }); }

/* ---------- per-person email menu ---------- */
function closeMenu() { $('#emenu')?.remove(); }
function emailMenu(anchor, p) {
  closeMenu(); const r = reminderFor(p);
  const m = document.createElement('div'); m.id = 'emenu'; m.className = 'emenu';
  m.innerHTML = `${r ? `<button data-em="now"><b>Send reminder now</b><span>${esc(r.rule.name)}</span></button><button data-em="sched"><b>Schedule a reminder…</b><span>Pick a day and time</span></button>` : `<div class="emnote">${p.archived ? 'Archived — emails are off' : 'Up to date — no reminder needed'}</div>`}
    ${p.archived ? '' : `<button data-em="write"><b>Write an email…</b><span>Custom message or any template</span></button>`}<button data-em="inbox"><b>Open their inbox</b><span>See what they’ve been sent (demo)</span></button>`;
  document.body.appendChild(m);
  if (!anchor.offsetParent) anchor = anchor.closest('.more')?.querySelector('[data-act=more]') || anchor;
  const b = anchor.getBoundingClientRect(); const w = 260; m.style.left = Math.max(8, Math.min(innerWidth - w - 8, b.right - w)) + 'px';
  const top = b.bottom + 6; m.style.top = (top + m.offsetHeight > innerHeight - 8 ? b.top - m.offsetHeight - 6 : top) + scrollY + 'px';
  m.onclick = e => { const k = e.target.closest('[data-em]')?.dataset.em; if (!k) return; closeMenu();
    if (k === 'now') { sendReminder(p); route(); } else if (k === 'sched') remindPeople([p], { title: `Remind ${firstName(p.name)}` }); else if (k === 'write') composeEmail([p], { title: `Email ${p.name}` }); else go('#/inbox/' + p.token); };
  setTimeout(() => addEventListener('click', function off(e) { if (!m.contains(e.target)) { closeMenu(); removeEventListener('click', off, true); } }, true), 0);
}

/* ---------- bulk actions (People multi-select) ---------- */
function bulkAddToEvent(people) {
  const act = people.filter(p => !p.archived);
  const s = modal(`<header><div><div class="eyebrow">${act.length} selected</div><h2 style="margin-top:4px">Add to an event</h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body"><div class="field"><label class="f">Event</label><select class="input" id="bev">${[...db.events].sort((a, b) => a.date.localeCompare(b.date)).map(e => `<option value="${e.id}">${esc(e.name)} · ${fmtDate(e.date)}</option>`).join('')}</select></div><div id="bevnote" class="small muted"></div></div>
    <footer><button class="btn ghost" data-close>Cancel</button><button class="btn red" id="bgo">Add ${act.length}</button></footer>`);
  const note = () => { const ev = EventById($('#bev', s).value); const already = act.filter(p => p.eventIds.includes(ev.id)).length; $('#bevnote', s).innerHTML = `${releaseLabel(ev)}.${already ? ` ${already} already on this team.` : ''}`; };
  note(); $('#bev', s).onchange = note;
  $('#bgo', s).onclick = () => { const ev = EventById($('#bev', s).value); let n = 0;
    act.filter(p => !p.eventIds.includes(ev.id)).forEach(p => { p.eventIds.push(ev.id); n++; audit({ actor: 'admin', action: 'person_updated', personId: p.id, detail: { name: p.name, changes: [`added to ${ev.name}`] } }); autoEmail('assigned', p, { event: ev, key: ev.id }); });
    closeModal(); toast(`${n} added to ${ev.name}${isReleased(ev) ? '' : ` · ${releaseLabel(ev, true).toLowerCase()}`}`); route(); };
}
function bulkArchive(people) {
  const act = people.filter(p => !p.archived);
  const s = modal(`<header><h2>Archive ${act.length} ${act.length === 1 ? 'person' : 'people'}?</h2><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body"><p>They won’t be able to sign in or get reminders. Their records are kept for ${retentionYears()} years for safeguarding audits, and you can reactivate them any time.</p>
      <div class="recips">${act.slice(0, 12).map(p => `<span class="tag">${esc(p.name)}</span>`).join('')}${act.length > 12 ? `<span class="tag">+${act.length - 12} more</span>` : ''}</div></div>
    <footer><button class="btn ghost" data-close>Cancel</button><button class="btn red" id="bago">Archive ${act.length}</button></footer>`);
  $('#bago', s).onclick = () => { act.forEach(p => archiveVolunteer(p, 'Bulk archive')); peopleSel.clear(); closeModal(); toast(`${act.length} archived — records kept`); route(); };
}
function bulkReactivate(people) {
  const arch = people.filter(p => p.archived); const purge = arch.reduce((n, p) => n + reactivationPreview(p).purge.length, 0);
  const s = modal(`<header><h2>Reactivate ${arch.length} ${arch.length === 1 ? 'person' : 'people'}?</h2><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body"><p>They’ll be able to sign in and get reminders again. Records from the last ${retentionYears()} years are kept${purge ? `; <b>${purge} older record${purge === 1 ? '' : 's'}</b> will be removed` : ''}.</p></div>
    <footer><button class="btn ghost" data-close>Cancel</button><button class="btn teal" id="brgo">Reactivate ${arch.length}</button></footer>`);
  $('#brgo', s).onclick = () => { arch.forEach(p => reactivateVolunteer(p, 'Bulk reactivate')); peopleSel.clear(); closeModal(); toast(`${arch.length} reactivated`); route(); };
}

/* ---------- batch add events ---------- */
function parseDay(v) { v = (v || '').trim(); let m;
  if ((m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = v.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})$/))) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(v); return isNaN(d) ? '' : dayISO(d); }
function batchEvents() {
  let rows = [{}, {}, {}].map(() => ({ name: '', date: '', endDate: '', location: '' }));
  const s = modal(`<header><div><h2>Add several events</h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body">
      <details class="pastebox"><summary>Paste from a spreadsheet</summary><p class="tiny muted" style="margin:6px 0">One event per line: <code>name, start date, end date, location</code> — copy straight from Excel or Google Sheets. Dates like 05/07/2027 or 2027-07-05.</p>
        <textarea class="input" id="bpaste" rows="4" placeholder="Bangor Beach Mission 2027	12/07/2027	23/07/2027	Bangor"></textarea><button class="btn soft xs" id="bpgo" style="margin-top:8px">Add these rows</button></details>
      <div class="tablewrap" style="margin-top:12px"><table class="btable"><thead><tr><th>Event name</th><th>Starts</th><th>Ends</th><th>Location</th><th></th></tr></thead><tbody id="brows"></tbody></table></div>
      <button class="btn ghost xs" id="badd" style="margin-top:8px">+ Add row</button>
      <div class="grid g2" style="margin-top:18px;align-items:start">
        <div class="field"><label class="f">Required training (all of these events)</label><div class="checks">${db.pathways.map(p => `<label><input type="checkbox" name="berp" value="${p.id}" ${p.id === 'p-essentials' ? 'checked' : ''}>${esc(p.title)}</label>`).join('')}</div></div>
        ${releaseFields({ mode: 'before', weeks: 6 })}
      </div></div>
    <footer><span class="small muted" id="bsum" style="margin-right:auto;align-self:center"></span><button class="btn ghost" data-close>Cancel</button><button class="btn red" id="bsave">Add events</button></footer>`, 'wide');
  bindReleaseFields(s);
  const valid = r => r.name.trim() && r.date && (!r.endDate || r.endDate >= r.date);
  const problem = r => { if (!r.name.trim() && !r.date && !r.endDate && !r.location) return ''; if (!r.name.trim()) return 'Needs a name'; if (!r.date) return 'Needs a start date'; if (r.endDate && r.endDate < r.date) return 'Ends before it starts'; if (db.events.some(e => e.name.toLowerCase() === r.name.trim().toLowerCase())) return 'Already exists'; return ''; };
  const sum = () => { const ok = rows.filter(r => valid(r) && !problem(r)).length, bad = rows.filter(r => problem(r)).length;
    $('#bsum', s).textContent = `${ok} ready${bad ? ` · ${bad} need${bad === 1 ? 's' : ''} fixing` : ''}`; $('#bsave', s).disabled = !ok; $('#bsave', s).textContent = `Add ${ok || ''} event${ok === 1 ? '' : 's'}`;
    $$('#brows tr', s).forEach((tr, i) => { const pr = problem(rows[i]); tr.classList.toggle('bad', !!pr); $('.bprob', tr).textContent = pr; }); };
  const draw = () => { $('#brows', s).innerHTML = rows.map((r, i) => `<tr data-i="${i}"><td><input class="input" data-k="name" value="${esc(r.name)}" placeholder="e.g. Bangor Beach Mission 2027"><div class="bprob tiny"></div></td><td><input class="input" type="date" data-k="date" value="${r.date}"></td><td><input class="input" type="date" data-k="endDate" value="${r.endDate}"></td><td><input class="input" data-k="location" value="${esc(r.location)}"></td><td><button class="iconbtn" data-rmr="${i}" title="Remove row">${ICON.x}</button></td></tr>`).join('');
    $$('#brows input', s).forEach(inp => inp.oninput = () => { rows[+inp.closest('tr').dataset.i][inp.dataset.k] = inp.value; sum(); });
    $$('[data-rmr]', s).forEach(b => b.onclick = () => { rows.splice(+b.dataset.rmr, 1); if (!rows.length) rows.push({ name: '', date: '', endDate: '', location: '' }); draw(); }); sum(); };
  draw();
  $('#badd', s).onclick = () => { rows.push({ name: '', date: '', endDate: '', location: '' }); draw(); $$('#brows tr:last-child input', s)[0].focus(); };
  $('#bpgo', s).onclick = () => { const add = $('#bpaste', s).value.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.split(l.includes('\t') ? '\t' : ',').map(x => x.trim()))
      .filter(c => !/^(name|event)/i.test(c[0] || '') || parseDay(c[1])).map(c => ({ name: c[0] || '', date: parseDay(c[1]), endDate: parseDay(c[2]), location: c[3] || '' }));
    if (!add.length) { toast('Nothing to add — one event per line'); return; }
    rows = rows.filter(r => r.name || r.date).concat(add); $('#bpaste', s).value = ''; $('.pastebox', s).open = false; draw(); toast(`${add.length} row${add.length === 1 ? '' : 's'} added — check them, then save`); };
  $('#bsave', s).onclick = () => { const req = $$('[name=berp]:checked', s).map(x => x.value), rel = readRelease(s);
    if (rel.mode === 'date' && !rel.date) { toast('Choose the date invites should go out'); return; }
    const ok = rows.filter(r => valid(r) && !problem(r));
    ok.forEach(r => db.events.push({ id: uid('ev-'), name: r.name.trim(), date: r.date, endDate: r.endDate || r.date, location: r.location.trim(), requiredPathways: req, release: { ...rel } }));
    audit({ actor: 'admin', action: 'events_batch_added', detail: { count: ok.length, names: ok.map(r => r.name.trim()), release: rel.mode } });
    closeModal(); toast(`${ok.length} event${ok.length === 1 ? '' : 's'} added`); route(); };
}

/* =====================================================================
   SYNC A FULL LIST — compare an up-to-date list with what we hold and
   change only the differences (add, update, reactivate, archive / remove)
   ===================================================================== */
let lastSync = null;   // for undo
const SYNC_SCOPES = () => [['volunteers', 'All volunteers', 'Anyone not on your list is archived'], ['staff', 'All staff', 'Anyone not on your list is archived'], ['all', 'Everyone (volunteers, staff and other)', 'Anyone not on your list is archived'],
  ...[...db.events].sort((a, b) => a.date.localeCompare(b.date)).map(e => ['event:' + e.id, `${e.name} team`, 'Anyone not on your list is taken off this team (not archived)'])];
function scopePeople(scope) {
  if (scope.startsWith('event:')) { const id = scope.slice(6); return live().filter(p => p.eventIds.includes(id)); }
  return scope === 'all' ? live() : live().filter(p => typeOf(p) === (scope === 'staff' ? 'staff' : 'volunteer'));
}
function readRows(text) {
  text = text.replace(/^﻿/, '').trim(); if (!text) return { error: 'The list is empty.' };
  const tsv = text.includes('\t');
  let rows = tsv ? text.split(/\r?\n/).map(l => l.split('\t')) : parseCSV(text + '\n');
  rows = rows.filter(r => r.some(c => (c || '').trim()));
  const first = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  let head;
  if (first.includes('email')) { head = first.map(h => ({ first: 'first_name', firstname: 'first_name', forename: 'first_name', surname: 'last_name', last: 'last_name', lastname: 'last_name', 'e-mail': 'email', email_address: 'email', role: 'roles', event: 'events' }[h] || h)); rows.shift(); }
  else head = ['first_name', 'last_name', 'email', 'roles', 'events'];   // no header row: assume this order
  if (!head.includes('email') || !(head.includes('first_name') || head.includes('name'))) return { error: 'Couldn’t find the columns. Use first_name, last_name, email (roles and events are optional).' };
  return { rows: rows.map((r, i) => { const o = Object.fromEntries(head.map((h, k) => [h, (r[k] || '').trim()]));
    if (!o.first_name && o.name) Object.assign(o, (n => ({ first_name: n.first_name, last_name: n.last_name }))(splitName(o.name)));
    return { line: i + 2, o: { ...o, email: (o.email || '').toLowerCase() } }; }), hasRoles: head.includes('roles'), hasEvents: head.includes('events') };
}
function analyseSync(text, scope) {
  const R = readRows(text); if (R.error) return R;
  const evScope = scope.startsWith('event:') ? EventById(scope.slice(6)) : null;
  const inScope = new Set(scopePeople(scope).map(p => p.id)), seen = new Set(), matched = new Set(), byEmail = new Map(db.people.map(p => [p.email.toLowerCase(), p]));
  const out = { create: [], update: [], join: [], reactivate: [], same: [], invalid: [], missing: [], maybe: [], evScope, hasRoles: R.hasRoles, hasEvents: R.hasEvents };
  R.rows.forEach(r => { const o = r.o;
    if (!o.first_name || !o.last_name) return out.invalid.push({ ...r, why: 'First and last name are both needed' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) return out.invalid.push({ ...r, why: 'Not a valid email address' });
    if (seen.has(o.email)) return out.invalid.push({ ...r, why: 'Listed twice' }); seen.add(o.email);
    r.roles = R.hasRoles ? o.roles.split(';').map(x => x.trim()).filter(Boolean) : null;
    r.eventIds = R.hasEvents ? o.events.split(';').map(n => db.events.find(e => e.name.toLowerCase() === n.trim().toLowerCase())?.id).filter(Boolean) : [];
    if (evScope && !r.eventIds.includes(evScope.id)) r.eventIds.push(evScope.id);
    const ex = byEmail.get(o.email); r.ex = ex;
    if (!ex) { const twin = live().find(p => p.first_name.toLowerCase() === o.first_name.toLowerCase() && p.last_name.toLowerCase() === o.last_name.toLowerCase()); r.twin = twin; if (twin) out.maybe.push(r); return out.create.push(r); }
    matched.add(ex.id);
    r.changes = [];
    if (ex.first_name !== o.first_name || ex.last_name !== o.last_name) r.changes.push(['Name', ex.name, `${o.first_name} ${o.last_name}`]);
    if (r.roles && r.roles.length && r.roles.slice().sort().join() !== ex.roles.slice().sort().join()) r.changes.push(['Roles', ex.roles.join(', ') || '—', r.roles.join(', ')]);
    const newEv = r.eventIds.filter(id => !ex.eventIds.includes(id) && (!evScope || id !== evScope.id));
    if (newEv.length) r.changes.push(['Events', '', '+ ' + newEv.map(id => EventById(id).name).join(', ')]);
    if (ex.archived) return out.reactivate.push(r);
    if (evScope && !ex.eventIds.includes(evScope.id)) return out.join.push(r);
    if (!evScope && !inScope.has(ex.id)) { r.changes.push(['Type', typeOf(ex), '(listed here)']); }
    r.changes.length ? out.update.push(r) : out.same.push(r);
  });
  out.missing = scopePeople(scope).filter(p => !matched.has(p.id)).map(p => ({ p, twinOf: out.maybe.find(r => r.twin === p) }));
  out.scopeSize = inScope.size;
  return out;
}
function rosterSync(preScope = 'volunteers') {
  const s = modal(`<header><div><h2>Sync a full list</h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body" id="sybody">
      <p class="small muted" style="margin-top:0">Upload or paste the <b>complete, current list</b> — for example at the start of a new year, or the final team for a camp. We compare it with what’s here and only change the differences. You’ll check everything before anything happens.</p>
      <div class="field"><label class="f">What is this a list of?</label><select class="input" id="syscope">${SYNC_SCOPES().map(([k, l]) => `<option value="${k}" ${k === preScope ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><div class="help" id="syhelp"></div></div>
      <div class="dropzone" id="sydz"><b>Drop a CSV file here</b> or click to choose<input type="file" accept=".csv,.tsv,.txt,text/csv" hidden id="syfi"></div>
      <div class="field" style="margin-top:12px"><label class="f">…or paste from a spreadsheet</label><textarea class="input" id="sypaste" rows="4" placeholder="first_name	last_name	email\nNiamh	Doherty	niamh.doherty@example.com"></textarea><div class="help">Columns: first_name, last_name, email — optional roles and events (separate several with ;). Copy straight from Excel or Google Sheets.</div></div>
      <div class="row" style="gap:8px"><button class="btn red sm" id="sygo">Compare with what’s here</button><button class="btn ghost sm" id="sysample">Try with a sample list</button></div>
    </div>`, 'wide');
  const help = () => { const sc = $('#syscope', s).value; $('#syhelp', s).textContent = `${scopePeople(sc).length} currently. ${SYNC_SCOPES().find(x => x[0] === sc)[2]}.`; };
  help(); $('#syscope', s).onchange = help;
  const dz = $('#sydz', s), fi = $('#syfi', s), run = (t, name) => syncPreview(t, name, $('#syscope', s).value);
  dz.onclick = () => fi.click(); dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = e => { e.preventDefault(); const f = e.dataTransfer.files[0]; f && f.text().then(t => run(t, f.name)); };
  fi.onchange = () => fi.files[0] && fi.files[0].text().then(t => run(t, fi.files[0].name));
  $('#sygo', s).onclick = () => { const t = $('#sypaste', s).value; if (!t.trim()) { toast('Paste a list or choose a file'); return; } run(t, 'pasted list'); };
  $('#sysample', s).onclick = () => run(sampleSyncList($('#syscope', s).value), 'sample list');
}
/* demo: the current list with a few realistic differences */
function sampleSyncList(scope) {
  const cur = scopePeople(scope).sort((a, b) => a.last_name.localeCompare(b.last_name));
  const drop = new Set(cur.filter((_, i) => i % 9 === 4).slice(0, 4).map(p => p.id));
  const rows = cur.filter(p => !drop.has(p.id)).map((p, i) => [i === 2 ? p.first_name + '-Jane' : p.first_name, p.last_name, p.email]);
  rows.push(['Orla', 'Fitzpatrick', 'orla.fitzpatrick@example.com'], ['Conor', 'Magee', 'conor.magee@example.com']);
  const arch = db.people.find(p => p.archived); if (arch && !scope.startsWith('event:')) rows.push([arch.first_name, arch.last_name, arch.email]);
  const tw = cur.find(p => !drop.has(p.id) && p !== cur[2]); if (tw) rows.push([tw.first_name, tw.last_name, tw.first_name.toLowerCase() + '.' + tw.last_name.toLowerCase().replace(/[^a-z]/g, '') + '@newmail.example']);
  return ['first_name\tlast_name\temail', ...rows.map(r => r.join('\t'))].join('\n');
}
function syncPreview(text, fname, scope) {
  const a = analyseSync(text, scope); const body = $('#sybody'); if (!body) return;
  if (a.error) { toast(a.error); return; }
  const ev = a.evScope, missVerb = ev ? 'Take off the team' : 'Archive';
  const sec = (key, title, list, render, { cls = '', on = true, help = '' } = {}) => list.length ? `<div class="imsec ${cls}" data-sec="${key}"><div class="imh"><label class="row" style="gap:8px;cursor:pointer"><input type="checkbox" data-all="${key}" ${on ? 'checked' : ''}><b>${title}</b></label><span class="tag">${list.length}</span></div>${help ? `<div class="tiny muted" style="margin:-2px 0 6px">${help}</div>` : ''}
    <div class="sylist">${list.map((r, i) => `<label class="imrow syrow"><input type="checkbox" data-k="${key}" data-i="${i}" ${on ? 'checked' : ''}><span>${render(r)}</span></label>`).join('')}</div></div>` : '';
  const nm = r => `<b>${esc(r.o.first_name)} ${esc(r.o.last_name)}</b> <span class="muted">· ${esc(r.o.email)}</span>`;
  const diff = r => r.changes.map(([f, from, to]) => `<span class="sydiff"><span class="muted">${f}:</span> ${from ? `<s>${esc(from)}</s> → ` : ''}<b>${esc(to)}</b></span>`).join('');
  const bigDrop = a.scopeSize && a.missing.length / a.scopeSize > .3;
  body.innerHTML = `<div class="row between" style="margin-bottom:12px"><span class="small"><b>${esc(fname)}</b> · compared with <b>${esc(SYNC_SCOPES().find(x => x[0] === scope)[1])}</b> (${a.scopeSize})</span><button class="btn ghost xs" id="syback">Start again</button></div>
    <div class="imgrid">${[['To add', a.create.length + a.join.length, 'var(--teal)'], ['To update', a.update.length, 'var(--sky)'], ['To reactivate', a.reactivate.length, 'var(--amber)'], [ev ? 'Off the team' : 'To archive', a.missing.length, 'var(--red)'], ['No change', a.same.length, '#CFC8C0']].map(([l, n, c]) => `<div style="--c:${c}"><b>${n}</b><span>${l}</span></div>`).join('')}</div>
    ${bigDrop ? `<div class="notice warn small" style="margin-bottom:12px">${ICON.info}<div><b>${a.missing.length} of ${a.scopeSize} people aren’t on this list.</b> That’s a lot — check you’ve chosen the right list type above and that the file is complete.</div></div>` : ''}
    ${a.maybe.length ? `<div class="imsec warn"><div class="imh"><b>Same name, different email</b><span class="tag">${a.maybe.length}</span></div><div class="tiny muted" style="margin:-2px 0 6px">Tick if it’s the same person with a new email — we’ll update them instead of adding someone new.</div>
      ${a.maybe.map((r, i) => `<label class="imrow syrow"><input type="checkbox" data-twin="${i}"><span><b>${esc(r.twin.name)}</b>: <s>${esc(r.twin.email)}</s> → <b>${esc(r.o.email)}</b></span></label>`).join('')}</div>` : ''}
    ${sec('create', 'New people', a.create, r => `${nm(r)}${r.twin ? ' <span class="tag" style="background:var(--amber-50)">see above</span>' : ''}`, { help: ev ? `Added and put on the ${esc(ev.name)} team.` : '' })}
    ${sec('join', `Already here — add to ${ev ? esc(ev.name) : 'list'}`, a.join, r => `${nm(r)}${r.changes.length ? '<br>' + diff(r) : ''}`)}
    ${sec('update', 'Details changed', a.update, r => `${nm(r)}<br>${diff(r)}`, { help: 'Only the fields shown change. Training history is never touched.' })}
    ${sec('reactivate', 'Archived — back on the list', a.reactivate, r => { const pv = reactivationPreview(r.ex); return `${nm(r)}<br><span class="tiny muted">Archived ${fmtDate(r.ex.archivedAt)} · ${pv.keep.length} record${pv.keep.length === 1 ? '' : 's'} kept${pv.purge.length ? `, ${pv.purge.length} over ${retentionYears()} years old removed` : ''}</span>`; }, { cls: 'warn' })}
    ${sec('missing', ev ? `Not on your list — take off the ${esc(ev.name)} team` : 'Not on your list — archive', a.missing, m => { const up = m.p.eventIds.map(EventById).filter(e => e && new Date(e.endDate || e.date) >= new Date() && (!ev || e.id !== ev.id));
      return `<b>${esc(m.p.name)}</b> <span class="muted">· ${esc(m.p.email)}</span>${m.twinOf ? ' <span class="tag" style="background:var(--amber-50)">maybe listed with a new email</span>' : ''}${up.length && !ev ? `<br><span class="tiny" style="color:#8A5508">Still signed up for ${up.map(e => esc(e.name)).join(', ')}</span>` : ''}`; }, { cls: 'bad', help: ev ? 'They stay on the system and keep their training — they’re just no longer on this team.' : `Archived people can’t sign in or get emails. Records are kept for ${retentionYears()} years and you can reactivate any time. Untick anyone to leave them as they are.` })}
    ${sec('invalid', 'Rows we’ll skip', a.invalid, r => `Row ${r.line}: ${esc([r.o.first_name, r.o.last_name].filter(Boolean).join(' ') || '(no name)')} <span class="muted">· ${esc(r.o.email || 'no email')}</span> — <span style="color:var(--red-600)">${esc(r.why)}</span>`, { cls: 'bad', on: false })}
    ${a.same.length ? `<p class="tiny muted">${a.same.length} ${a.same.length === 1 ? 'person matches' : 'people match'} exactly — they won’t be touched.</p>` : ''}
    <label class="row small" style="gap:8px;margin-top:10px;cursor:pointer"><input type="checkbox" id="syinv" checked> Send training invites to people who are added${ev && !isReleased(ev) ? ` (held until ${esc(releaseLabel(ev).replace(/^Invites go out /, ''))})` : ''}</label>`;
  $$('[data-k=invalid]', body).forEach(c => c.disabled = true); $$('[data-all=invalid]', body).forEach(c => c.disabled = true);
  const foot = $('#scrim footer') || (() => { const f = document.createElement('footer'); $('#scrim .modal').appendChild(f); return f; })();
  const picked = k => $$(`[data-k=${k}]:checked`, body).map(c => (k === 'missing' ? a.missing : a[k])[+c.dataset.i]);
  const twins = () => $$('[data-twin]:checked', body).map(c => a.maybe[+c.dataset.twin]);
  const count = () => { const tw = new Set(twins()); return picked('create').filter(r => !tw.has(r)).length + tw.size + picked('join').length + picked('update').length + picked('reactivate').length + picked('missing').filter(m => !twins().some(t => t.twin === m.p)).length; };
  const upd = () => { const n = count(); $('#sygo2').textContent = n ? `Apply ${n} change${n === 1 ? '' : 's'}` : 'Nothing to change'; $('#sygo2').disabled = !n;
    $$('[data-all]', body).forEach(c => { const all = $$(`[data-k=${c.dataset.all}]`, body); c.checked = all.length && all.every(x => x.checked); c.indeterminate = !c.checked && all.some(x => x.checked); }); };
  foot.innerHTML = `<span class="small muted" style="margin-right:auto;align-self:center">You can undo this straight after</span><button class="btn ghost" data-close>Cancel</button><button class="btn red" id="sygo2"></button>`;
  $$('[data-all]', body).forEach(c => c.onchange = () => { $$(`[data-k=${c.dataset.all}]`, body).forEach(x => x.checked = c.checked); upd(); });
  body.addEventListener('change', e => { if (e.target.matches('[data-k],[data-twin]')) upd(); });
  upd();
  $('#syback').onclick = () => { closeModal(); rosterSync(scope); };
  $('#sygo2').onclick = () => applySync(a, { create: picked('create'), join: picked('join'), update: picked('update'), reactivate: picked('reactivate'), missing: picked('missing'), twins: twins(), invite: $('#syinv').checked, scope, fname });
}
function applySync(a, sel) {
  const ev = a.evScope; const snap = new Map(); const keep = p => { if (!snap.has(p.id)) snap.set(p.id, JSON.parse(JSON.stringify(p))); };
  const auditStart = db.audit.length, completionsBefore = db.completions.slice(); const created = [];
  const res = { added: 0, joined: 0, updated: 0, reactivated: 0, archived: 0, removed: 0, invites: 0 };
  const applyFields = (p, r) => { if (p.first_name !== r.o.first_name || p.last_name !== r.o.last_name) setName(p, r.o.first_name, r.o.last_name); if (r.roles && r.roles.length) p.roles = r.roles; r.eventIds.forEach(id => p.eventIds.includes(id) || p.eventIds.push(id)); };
  const invite = p => { if (sel.invite && autoEmail('assigned', p, { event: ev || undefined, key: 'sync' + (ev ? ev.id : '') }) !== 'held') res.invites += 0; };
  const twinSet = new Set(sel.twins);
  sel.twins.forEach(r => { const p = r.twin; keep(p); const old = p.email; p.email = r.o.email; applyFields(p, r); res.updated++;
    audit({ actor: 'admin', action: 'volunteer_updated', personId: p.id, detail: { name: p.name, changes: [`email: ${old} → ${p.email}`], source: 'List sync' } }); });
  sel.create.filter(r => !twinSet.has(r)).forEach(r => { const p = setName({ id: uid('u_'), token: uid('inv-'), createdAt: now(), email: r.o.email, type: a.evScope ? 'volunteer' : (sel.scope === 'staff' ? 'staff' : 'volunteer'), roles: r.roles || [], eventIds: r.eventIds.slice(), org: '', notes: '', accessNI: { status: 'not_requested', date: '' } }, r.o.first_name, r.o.last_name);
    db.people.push(p); created.push(p.id); res.added++; audit({ actor: 'admin', action: 'volunteer_created', personId: p.id, detail: { name: p.name, source: 'List sync' } }); invite(p); });
  sel.join.forEach(r => { keep(r.ex); applyFields(r.ex, r); res.joined++; audit({ actor: 'admin', action: 'volunteer_updated', personId: r.ex.id, detail: { name: r.ex.name, changes: [`added to ${ev.name}`, ...r.changes.map(c => c[0].toLowerCase())], source: 'List sync' } }); invite(r.ex); });
  sel.update.forEach(r => { keep(r.ex); applyFields(r.ex, r); res.updated++; audit({ actor: 'admin', action: 'volunteer_updated', personId: r.ex.id, detail: { name: r.ex.name, changes: r.changes.map(([f, x, y]) => `${f.toLowerCase()}: ${x ? x + ' → ' : ''}${y}`), source: 'List sync' } }); });
  sel.reactivate.forEach(r => { keep(r.ex); applyFields(r.ex, r); reactivateVolunteer(r.ex, 'List sync'); res.reactivated++; });
  sel.missing.filter(m => !sel.twins.some(t => t.twin === m.p)).forEach(({ p }) => { keep(p);
    if (ev) { p.eventIds = p.eventIds.filter(x => x !== ev.id); res.removed++; audit({ actor: 'admin', action: 'volunteer_updated', personId: p.id, detail: { name: p.name, changes: [`removed from ${ev.name}`], source: 'List sync' } }); }
    else { archiveVolunteer(p, 'Not on the latest list'); res.archived++; } });
  audit({ actor: 'admin', action: 'list_synced', detail: { list: SYNC_SCOPES().find(x => x[0] === sel.scope)[1], file: sel.fname, ...res, skipped: a.invalid.length, unchanged: a.same.length } });
  lastSync = { snap: [...snap.values()], created, completions: completionsBefore, at: now(), res, scope: sel.scope };
  closeModal(); syncDone(res, ev);
}
function syncDone(res, ev) {
  const line = [res.added && `${res.added} added`, res.joined && `${res.joined} added to the team`, res.updated && `${res.updated} updated`, res.reactivated && `${res.reactivated} reactivated`, res.archived && `${res.archived} archived`, res.removed && `${res.removed} taken off the team`].filter(Boolean);
  const s = modal(`<header><div><h2>${line.length ? 'Done — only the differences changed' : 'Nothing needed changing'}</h2></div><button class="iconbtn" data-close>${ICON.x}</button></header>
    <div class="body"><ul class="small" style="margin:0;padding-left:18px;line-height:1.8">${line.map(l => `<li>${l}</li>`).join('')}</ul>
      <p class="tiny muted" style="margin:12px 0 0">Every change is in the audit log. Anyone else was left exactly as they were.</p></div>
    <footer><button class="btn ghost" id="syundo" style="margin-right:auto">Undo this sync</button><button class="btn red" data-close>Done</button></footer>`);
  $('#syundo', s).onclick = () => { undoSync(); closeModal(); };
  watchModalClose(() => route());
}
function undoSync() {
  if (!lastSync) return;
  const created = new Set(lastSync.created);
  db.people = db.people.filter(p => !created.has(p.id));
  lastSync.snap.forEach(o => { const p = Person(o.id); if (p) { Object.keys(p).forEach(k => delete p[k]); Object.assign(p, o); } });
  db.completions = lastSync.completions;   // brings back anything removed when reactivating
  audit({ actor: 'admin', action: 'list_sync_undone', detail: { at: lastSync.at, ...lastSync.res } });
  lastSync = null; toast('Sync undone — everyone is back as they were'); route();
}

/* ---------- rich text editor (reading steps) ---------- */
const RTE_TOOLS = [['h', 'Heading', '<b style="font-size:15px">H</b>'], ['bold', 'Bold', '<b>B</b>'], ['italic', 'Italic', '<i style="font-family:Georgia,serif">I</i>'],
  ['ul', 'Bulleted list', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1.2" fill="currentColor"/><circle cx="4" cy="12" r="1.2" fill="currentColor"/><circle cx="4" cy="18" r="1.2" fill="currentColor"/></svg>'],
  ['ol', 'Numbered list', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 4.5h1.5V9M3.5 9h3M3.5 14.5a1.5 1.5 0 0 1 3 .3c0 1-3 2.2-3 3.7h3" stroke-width="1.6"/></svg>'],
  ['link', 'Link', ICON.link], ['clear', 'Clear formatting', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 5h12M12 5l-4 14M4 20l16-16"/></svg>']];
function richEditor(html, id) {
  return `<div class="rte"><div class="rte-bar" role="toolbar" aria-label="Formatting" aria-controls="${id}">${RTE_TOOLS.map(([k, l, ic], i) => `${i === 3 || i === 5 ? '<span class="rte-sep"></span>' : ''}<button type="button" class="rte-b" data-rte="${k}" aria-label="${l}" title="${l}" aria-pressed="false">${ic}</button>`).join('')}</div>
    <div class="rte-link" hidden><input class="input" type="url" placeholder="https://…" aria-label="Link address"><button type="button" class="btn red xs" data-rte-ok>Add link</button><button type="button" class="btn ghost xs" data-rte-x>Remove link</button></div>
    <div class="rte-area reading" id="${id}" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="sblab">${html || '<p><br></p>'}</div></div>`;
}
function bindRichEditor(wrap) {
  const area = $('.rte-area', wrap), lk = $('.rte-link', wrap); let saved = null;
  const exec = (c, v = null) => { area.focus(); document.execCommand(c, false, v); state(); };
  const block = () => { const sel = getSelection(); let n = sel.anchorNode; while (n && n !== area) { if (n.nodeType === 1 && /^(H3|P|LI)$/.test(n.tagName)) return n; n = n.parentNode; } return null; };
  const state = () => { const b = block(); const on = { bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), ul: document.queryCommandState('insertUnorderedList'), ol: document.queryCommandState('insertOrderedList'), h: b?.tagName === 'H3', link: !!getSelection().anchorNode?.parentElement?.closest('a') };
    $$('[data-rte]', wrap).forEach(x => x.setAttribute('aria-pressed', !!on[x.dataset.rte])); };
  document.execCommand('defaultParagraphSeparator', false, 'p');
  $$('[data-rte]', wrap).forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => { const k = b.dataset.rte;
    if (k === 'bold') exec('bold'); else if (k === 'italic') exec('italic'); else if (k === 'ul') exec('insertUnorderedList'); else if (k === 'ol') exec('insertOrderedList');
    else if (k === 'h') exec('formatBlock', block()?.tagName === 'H3' ? 'P' : 'H3');
    else if (k === 'clear') { exec('removeFormat'); if (block()?.tagName === 'H3') exec('formatBlock', 'P'); }
    else if (k === 'link') { const sel = getSelection(); if (!sel.rangeCount || !area.contains(sel.anchorNode)) { area.focus(); return; } saved = sel.getRangeAt(0).cloneRange(); const a = sel.anchorNode.parentElement?.closest('a');
      lk.hidden = false; const inp = $('input', lk); inp.value = a?.getAttribute('href') || ''; inp.focus(); } }; });
  const restore = () => { area.focus(); if (saved) { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(saved); } };
  $('[data-rte-ok]', lk).onclick = () => { let u = $('input', lk).value.trim(); if (!u) return; if (!/^(https?:|mailto:)/i.test(u)) u = 'https://' + u; restore();
    if (getSelection().isCollapsed) document.execCommand('insertHTML', false, `<a href="${esc(u)}">${esc(u)}</a>`); else document.execCommand('createLink', false, u); lk.hidden = true; state(); };
  $('[data-rte-x]', lk).onclick = () => { restore(); document.execCommand('unlink'); lk.hidden = true; state(); };
  $('input', lk).onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('[data-rte-ok]', lk).click(); } if (e.key === 'Escape') { e.stopPropagation(); lk.hidden = true; area.focus(); } };
  area.addEventListener('paste', e => { e.preventDefault(); const d = e.clipboardData; const h = d.getData('text/html');
    const html = h ? sanitizeHTML(h) : d.getData('text/plain').split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    document.execCommand('insertHTML', false, html); });
  area.addEventListener('keyup', state); area.addEventListener('mouseup', state); area.addEventListener('focus', state);
}

/* =====================================================================
   EMAIL ALLOWANCE + ROLLOUT PLANNER
   Free email plans cap sends per day (Resend free: 100/day, including
   sign-in links). We never go over: bulk sends keep a reserve for sign-in
   links and reminders, and anything that doesn't fit rolls to tomorrow.
   ===================================================================== */
// SUNI's choice: Resend Pro for the first month of the rollout, then the free plan (100 a day)
const PLAN = () => (db.settings.emailPlan ||= { plan: 'pro', dailyCap: 100, reservePct: 40, proUntil: dayISO(Date.now() + 30 * DAY), proPerDay: 400 });
const proActive = (day = todayISO()) => { const p = PLAN(); return p.plan === 'pro' && (!p.proUntil || day <= p.proUntil); };
const dailyCap = day => proActive(day) ? Infinity : PLAN().dailyCap;
const reserveCount = () => Math.round(PLAN().dailyCap * PLAN().reservePct / 100);
function sentOn(day = todayISO()) { return db.audit.filter(a => (a.action === 'email_sent' || a.action === 'magic_link_sent') && dayISO(a.at) === day).length; }
function allowanceLeft(day = todayISO(), bulk = true) { const c = dailyCap(day); if (c === Infinity) return Infinity; return Math.max(0, c - sentOn(day) - (bulk ? reserveCount() : 0)); }
function allowanceBar() {
  if (proActive()) return `<div class="allow pro"><b>Pro email plan</b> · no daily limit${PLAN().proUntil ? ` until ${fmtDate(PLAN().proUntil)}` : ''}</div>`;
  const used = sentOn(), cap = PLAN().dailyCap, res = reserveCount();
  return `<div class="allow" role="group" aria-label="Today's email allowance"><div class="allow-top"><b>Today: ${used} of ${cap} free emails used</b><span class="small muted">${res} kept for sign-in links and reminders</span></div>
    <div class="allow-bar"><i style="width:${Math.min(100, used / cap * 100)}%"></i><span style="left:${(cap - res) / cap * 100}%" title="Bulk sends stop here"></span></div></div>`;
}
const tomorrow9 = (from = Date.now()) => { const d = new Date(from + DAY); d.setHours(9, 0, 0, 0); return d.toISOString(); };

/* ---------- rollout ---------- */
const RO = () => (db.rollout ||= { status: 'draft', scope: 'all', order: 'event', perDay: null, weekdaysOnly: true, start: todayISO(), waves: [], queue: [] });
function alreadyInvited() { const s = new Set(); (db.outbox || []).forEach(m => { if (m.ruleId === 'r-assigned' || (m.key || '').startsWith('rollout|')) s.add(m.personId); }); db.audit.forEach(a => { if (a.action === 'login' && a.personId) s.add(a.personId); }); return s; }
function soonestEvent(p) { const ds = p.eventIds.map(EventById).filter(e => e && isReleased(e)).map(e => e.date).sort(); return ds[0] || '9999-12-31'; }
function rolloutCandidates(r = RO()) {
  const done = alreadyInvited();
  let list = live().filter(p => !done.has(p.id) && assignedCtx(p));
  if (r.scope === 'staff') list = list.filter(p => typeOf(p) === 'staff'); else if (r.scope === 'volunteers') list = list.filter(p => typeOf(p) === 'volunteer'); else if (r.scope.startsWith('event:')) list = list.filter(p => p.eventIds.includes(r.scope.slice(6)));
  const key = p => r.order === 'staff' ? (typeOf(p) === 'staff' ? '0' : '1') + soonestEvent(p) : r.order === 'event' ? soonestEvent(p) + p.last_name : p.last_name + p.first_name;
  return list.sort((a, b) => key(a).localeCompare(key(b)));
}
const perDayFor = (r, plan) => plan === 'pro' ? (PLAN().proPerDay || 400) : Math.max(1, r.perDay || (PLAN().dailyCap - reserveCount()));
function nextSendDay(from, weekdaysOnly) { const d = new Date(from + 'T12:00'); while (weekdaysOnly && [0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1); return dayISO(d); }
function forecast(n, perDay, start, weekdaysOnly) { const days = []; let d = nextSendDay(start, weekdaysOnly), left = n; while (left > 0 && days.length < 400) { const k = Math.min(perDay, left); days.push({ day: d, count: k }); left -= k; d = nextSendDay(dayISO(new Date(d + 'T12:00').getTime() + DAY), weekdaysOnly); } return days; }
function sendWave(r, day, sim = false) {
  if (r.waves.some(w => w.day === day)) return 0;
  const plan = proActive(day) ? 'pro' : 'free';
  const room = Math.min(perDayFor(r, plan), plan === 'pro' ? Infinity : allowanceLeft(day));
  const ok = new Set(rolloutCandidates(r).map(p => p.id));
  const take = []; while (r.queue.length && take.length < room) { const id = r.queue.shift(); if (ok.has(id)) take.push(id); }
  if (!take.length) { if (!r.queue.length) r.status = 'done'; return 0; }
  const rule = RULE('r-assigned'); const at = sim ? new Date(day + 'T09:00').toISOString() : undefined;
  const n = sendEmails(take.map(id => { const p = Person(id); return { p, ctx: assignedCtx(p), key: 'rollout|' + id }; }), { subject: rule.subject, body: rule.body, source: 'automatic', ruleId: rule.id, at, rollout: true });
  r.waves.push({ day, count: n, ids: take, simulated: sim });
  audit({ actor: 'system', action: 'rollout_wave', detail: { day, count: n, left: r.queue.length, plan, simulated: sim } });
  if (!r.queue.length) r.status = 'done';
  persist(); return n;
}
function processRollout() { const r = db.rollout; if (!r || r.status !== 'running') return 0; const t = todayISO(); if (t < r.start || (r.weekdaysOnly && [0, 6].includes(new Date().getDay()))) return 0; return sendWave(r, t); }

function renderRollout() {
  const r = RO(); const running = ['running', 'paused', 'done'].includes(r.status);
  const cands = running ? r.queue.length : rolloutCandidates(r).length;
  const planNow = PLAN().plan === 'pro' ? 'pro' : 'free';
  const fFree = forecast(cands, perDayFor(r, 'free'), r.start, r.weekdaysOnly), fPro = forecast(cands, perDayFor(r, 'pro'), r.start, r.weekdaysOnly);
  // a month of Pro then free for the rest
  const mixed = (() => { const out = []; let left = cands, d = nextSendDay(r.start, r.weekdaysOnly); const end = dayISO(new Date(r.start + 'T12:00').getTime() + 30 * DAY); while (left > 0 && out.length < 400) { const k = Math.min(d <= end ? perDayFor(r, 'pro') : perDayFor(r, 'free'), left); out.push({ day: d, count: k }); left -= k; d = nextSendDay(dayISO(new Date(d + 'T12:00').getTime() + DAY), r.weekdaysOnly); } return out; })();
  const chosen = planNow === 'pro' ? mixed : fFree;
  const sentTotal = r.waves.reduce((n, w) => n + w.count, 0), total = sentTotal + (running ? r.queue.length : cands);
  const chart = (() => { const W = 560, H = 150, pad = 28, maxD = Math.max(fFree.length, 1), maxN = Math.max(cands, 1);
    const pts = f => { let c = 0; return [[pad, H - pad], ...f.map((d, i) => { c += d.count; return [pad + (i + 1) / maxD * (W - pad - 10), H - pad - c / maxN * (H - pad - 14)]; })].map(p => p.map(v => v.toFixed(1)).join(',')).join(' '); };
    return `<svg viewBox="0 0 ${W} ${H}" class="rochart" role="img" aria-label="Free plan takes ${fFree.length} sending days; one month of Pro takes ${mixed.length}">
      <line x1="${pad}" y1="${H - pad}" x2="${W - 10}" y2="${H - pad}" stroke="currentColor" stroke-opacity=".25"/><line x1="${pad}" y1="14" x2="${W - 10}" y2="14" stroke="currentColor" stroke-opacity=".1" stroke-dasharray="3 3"/>
      <text x="${pad}" y="10" font-size="11" fill="currentColor" opacity=".6">${cands.toLocaleString('en-GB')} invited</text><text x="${W - 10}" y="${H - 8}" font-size="11" text-anchor="end" fill="currentColor" opacity=".6">${fFree.length} sending days</text><text x="${pad}" y="${H - 8}" font-size="11" fill="currentColor" opacity=".6">day 1</text>
      <polyline points="${pts(fFree)}" fill="none" stroke="var(--red)" stroke-width="2.5"/><polyline points="${pts(mixed)}" fill="none" stroke="var(--teal)" stroke-width="2.5"/></svg>
      <div class="rolegend"><span><i style="background:var(--red)"></i>Free plan only</span><span><i style="background:var(--teal)"></i>Pro for the first month</span></div>`; })();
  adminShell('emails', pageHead('Emails / Rollout', 'Roll out to volunteers', 'Invite people in daily batches that fit your email plan, so launching costs nothing — or use a paid plan for just the first month.',
    `<a class="btn ghost sm" href="#/admin/emails" data-back="#/admin/emails">${ICON.back} Back</a>`) + `
    ${allowanceBar()}
    <div class="rogrid">
      <section class="card ro-plan" aria-labelledby="ro-h1"><h2 id="ro-h1" class="ro-h">Plan</h2>
        <div class="field"><label class="f" for="ro-scope">Who to invite</label><select class="input" id="ro-scope" ${running ? 'disabled' : ''}>${[['all', 'Everyone not yet invited'], ['volunteers', 'Volunteers only'], ['staff', 'Staff only'], ...db.events.filter(isReleased).map(e => ['event:' + e.id, `${e.name} team`])].map(([k, l]) => `<option value="${k}" ${r.scope === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
          <div class="help">${cands.toLocaleString('en-GB')} people · skips anyone already invited, archived, up to date, or waiting for an event's release date</div></div>
        <fieldset class="field ro-order" ${running ? 'disabled' : ''}><legend class="f">Who goes first</legend>${[['event', 'Soonest event first'], ['staff', 'Staff first, then by event'], ['name', 'Alphabetical']].map(([k, l]) => `<label class="radiorow"><input type="radio" name="ro-order" value="${k}" ${r.order === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</fieldset>
        <fieldset class="field"><legend class="f">Email plan</legend><div class="seg" role="radiogroup" aria-label="Email plan">${[['free', 'Free · $0'], ['pro', 'Pro for 1 month · $20']].map(([k, l]) => `<button type="button" role="radio" aria-checked="${planNow === k}" class="${planNow === k ? 'on' : ''}" data-plan="${k}">${l}</button>`).join('')}</div>
          <div class="help">${planNow === 'pro' ? `<b>Recommended for launch.</b> Pro until ${fmtDate(PLAN().proUntil)}, sending up to ${perDayFor(r, 'pro')} a day so the help inbox isn't swamped. After that it drops back to the free plan automatically — remember to cancel Pro.` : `Free plan: ${PLAN().dailyCap} emails a day in total. ${reserveCount()} are kept each day for sign-in links and reminders.`}</div></fieldset>
        <div class="grid g2"><div class="field"><label class="f" for="ro-per">Invites per day (free plan)</label><input class="input" type="number" min="1" max="${PLAN().dailyCap - reserveCount()}" id="ro-per" value="${perDayFor(r, 'free')}"><div class="help">Up to ${PLAN().dailyCap - reserveCount()}</div></div>
          <div class="field"><label class="f" for="ro-start">Start</label><input class="input" type="date" id="ro-start" value="${r.start}" min="${todayISO()}" ${running ? 'disabled' : ''}></div></div>
        <label class="row small" style="gap:10px;min-height:44px"><input type="checkbox" id="ro-wd" ${r.weekdaysOnly ? 'checked' : ''}> Weekdays only (fewer weekend questions to answer)</label>
      </section>
      <section class="card ro-fc" aria-labelledby="ro-h2"><h2 id="ro-h2" class="ro-h">Forecast</h2>
        <div class="ro-big"><b>${chosen.length ? fmtDate(chosen.at(-1).day) : '—'}</b><span>${cands ? `everyone invited in ${chosen.length} sending day${chosen.length === 1 ? '' : 's'}` : 'No one left to invite'}</span></div>
        <div class="ro-compare">
          <div class="${planNow === 'free' ? 'on' : ''}"><span class="small muted">Free plan only</span><b>${fFree.length} days</b><span class="small">$0 · ${perDayFor(r, 'free')} a day</span></div>
          <div class="${planNow === 'pro' ? 'on' : ''}"><span class="small muted">Pro for the first month</span><b>${mixed.length} days</b><span class="small">$20 once · up to ${perDayFor(r, 'pro')} a day</span></div>
        </div>
        ${cands ? chart : ''}
        <p class="tiny muted" style="margin:10px 0 0">Each invite usually leads to a sign-in link a day or two later. The ${reserveCount()} kept back each day cover those, so the free limit is never hit.</p>
      </section>
    </div>
    <div class="ro-actions">${r.status === 'draft' ? `<button class="btn red" id="ro-go" ${cands ? '' : 'disabled'}>Start rollout · ${cands.toLocaleString('en-GB')} people</button>` : r.status === 'running' ? `<button class="btn ghost" id="ro-pause">Pause</button><button class="btn red" id="ro-now">Send today's batch now</button>` : r.status === 'paused' ? `<button class="btn red" id="ro-resume">Resume</button>` : `<span class="chip st-complete"><span class="dot"></span>Rollout complete</span>`}
      ${running ? `<button class="btn ghost" id="ro-reset">${r.status === 'done' ? 'Plan another rollout' : 'Cancel rollout'}</button>` : ''}
      ${running && r.status !== 'done' ? `<span class="small muted">${sentTotal.toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')} invited · the daily job sends the next batch each morning</span>` : ''}</div>
    ${demoOn() && r.status === 'running' ? `<div class="demo-tools noprint"><span class="dt-lbl">Demo controls</span><button class="dt-btn" id="ro-sim">⏭ Simulate the next sending day</button><button class="dt-btn" id="ro-sim5">⏭ Simulate a week</button></div>` : ''}
    <h2 class="ro-h" style="margin:28px 0 12px">Batches</h2>
    <div class="tablewrap"><table><thead><tr><th>Day</th><th>Date</th><th>Invites</th><th>Status</th></tr></thead><tbody>
      ${[...r.waves.map((w, i) => `<tr><td>${i + 1}</td><td>${fmtDate(w.day)}</td><td>${w.count}</td><td><span class="chip st-complete"><span class="dot"></span>Sent${w.simulated ? ' (simulated)' : ''}</span></td></tr>`),
        ...(r.status === 'done' ? [] : (running ? forecast(r.queue.length, perDayFor(r, planNow), nextSendDay(r.waves.length ? dayISO(new Date(r.waves.at(-1).day + 'T12:00').getTime() + DAY) : r.start, r.weekdaysOnly), r.weekdaysOnly) : chosen).slice(0, 12).map((d, i) => `<tr><td>${r.waves.length + i + 1}</td><td>${fmtDate(d.day)}</td><td>${d.count}</td><td><span class="chip st-none"><span class="dot"></span>${running ? 'Scheduled' : 'Planned'}</span></td></tr>`))].join('') || '<tr><td colspan="4" class="empty">Nothing planned</td></tr>'}
    </tbody></table></div>`);
  const save = () => { persist(); renderRollout(); };
  $('#ro-scope') && ($('#ro-scope').onchange = e => { r.scope = e.target.value; save(); });
  $$('[name=ro-order]').forEach(i => i.onchange = () => { r.order = i.value; save(); });
  $('#ro-per').onchange = e => { r.perDay = Math.max(1, Math.min(PLAN().dailyCap - reserveCount(), +e.target.value || 1)); save(); };
  $('#ro-start') && ($('#ro-start').onchange = e => { r.start = e.target.value || todayISO(); if (PLAN().plan === 'pro') PLAN().proUntil = dayISO(new Date(r.start + 'T12:00').getTime() + 30 * DAY); save(); });
  $('#ro-wd').onchange = e => { r.weekdaysOnly = e.target.checked; save(); };
  $$('[data-plan]').forEach(b => b.onclick = () => { const p = PLAN(); p.plan = b.dataset.plan; p.proUntil = p.plan === 'pro' ? dayISO(new Date(r.start + 'T12:00').getTime() + 30 * DAY) : ''; audit({ actor: 'admin', action: 'settings_saved', detail: { emailPlan: p.plan, proUntil: p.proUntil } }); save(); });
  $('#ro-go') && ($('#ro-go').onclick = e => { if (!confirmInline(e.currentTarget, `Click again to start · first batch ${fmtDate(nextSendDay(r.start, r.weekdaysOnly))}`)) return;
    r.queue = rolloutCandidates(r).map(p => p.id); r.status = 'running'; r.waves = []; r.startedAt = now();
    audit({ actor: 'admin', action: 'rollout_started', detail: { people: r.queue.length, start: r.start, plan: PLAN().plan, perDay: perDayFor(r, PLAN().plan) } });
    const n = r.start <= todayISO() ? processRollout() : 0; persist(); toast(n ? `Rollout started · ${n} invites sent today` : `Rollout scheduled · first batch ${fmtDate(nextSendDay(r.start, r.weekdaysOnly))}`); renderRollout(); });
  $('#ro-pause') && ($('#ro-pause').onclick = () => { r.status = 'paused'; audit({ actor: 'admin', action: 'rollout_paused', detail: {} }); save(); });
  $('#ro-resume') && ($('#ro-resume').onclick = () => { r.status = 'running'; audit({ actor: 'admin', action: 'rollout_resumed', detail: {} }); save(); });
  $('#ro-now') && ($('#ro-now').onclick = () => { const n = sendWave(r, todayISO()); toast(n ? `${n} invites sent` : r.waves.some(w => w.day === todayISO()) ? 'Today’s batch has already gone' : 'No room left in today’s free allowance'); renderRollout(); });
  $('#ro-reset') && ($('#ro-reset').onclick = e => { if (r.status !== 'done' && !confirmInline(e.currentTarget, 'Click again to cancel')) return; audit({ actor: 'admin', action: 'rollout_cancelled', detail: { left: r.queue.length } }); db.rollout = null; persist(); renderRollout(); });
  const sim = k => { let n = 0; for (let i = 0; i < k && r.status === 'running'; i++) { const last = r.waves.length ? dayISO(new Date(r.waves.at(-1).day + 'T12:00').getTime() + DAY) : r.start; n += sendWave(r, nextSendDay(last, r.weekdaysOnly), true); } toast(`${n} invites sent across ${k} simulated day${k === 1 ? '' : 's'}`); renderRollout(); };
  $('#ro-sim') && ($('#ro-sim').onclick = () => sim(1)); $('#ro-sim5') && ($('#ro-sim5').onclick = () => sim(5));
}

/* ---------- background jobs (demo: run while the app is open) ---------- */
function backgroundJobs() { const a = processScheduled(), b = processReleases() + processRollout(); if (a || b) { persist(); if (location.hash.startsWith('#/admin')) route(); } }

const DEMO_RELEASE = { 'ev-ballycastle': { mode: 'before', weeks: 8 }, 'ev-beach': { mode: 'date', date: '2027-03-01' }, 'ev-teen': { mode: 'manual' } };
/* ---------- boot ---------- */
db = Store.load();
if (!db || db.schema !== 1) seed();
db.scheduled ||= [];
db.events.forEach(e => { if (!e.release) e.release = DEMO_RELEASE[e.id] || { mode: 'now' }; });
dailyCleanup(); processScheduled(); processReleases(); processRollout();
setInterval(() => { if ($('#scrim') || $('#drawer')) { processScheduled(); processReleases(); persist(); return; } backgroundJobs(); }, 30000);
addEventListener('hashchange', route);
route();
