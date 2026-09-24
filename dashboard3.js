/* ═══════════════════════════════════════════════════════════════
   Whis-AI, Dashboard v3 (editorial) logic
   Same live backend contract as the current dashboard
   (api.whis-ai.com). Sessions + Resumes are backed by the real API.
   The resume is the single context Whis uses to personalize live
   interview answers. Documents / Resume-Maker / Headshots are
   intentionally NOT part of this surface.
   NEW FILE, touches nothing existing.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const BACKEND_URL = 'https://api.whis-ai.com';
  const RETURN_PATH = '/dashboard3.html';   // v3 dashboard
  const APP_PATH = '/app3/';                 // v3 (editorial) live app

  // Google client id is served by /api/config on the live site.
  let GOOGLE_CLIENT_ID = null;

  // ── State ──
  let currentUser = null;
  let allSessions = [];
  let currentFilter = 'all';
  let currentSearch = '';
  let currentView = 'grid';
  let currentSessionDetail = null;
  let resumesLoaded = false;
  let resumesCache = [];              // saved resumes, for the New Session picker
  let nsUploadedResume = null;        // { name, content } when a PDF is attached inline
  let resUploadedContent = null;      // extracted PDF text (kept internal, never shown to the user)

  // ── Tiny DOM helpers ──
  const $ = (id) => document.getElementById(id);
  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function headers() {
    const h = { 'Content-Type': 'application/json' };
    if (currentUser && currentUser.googleId) h['x-google-id'] = currentUser.googleId;
    return h;
  }

  function toast(msg, isErr) {
    const t = $('toast');
    $('toastMsg').textContent = msg;
    t.classList.toggle('wv-toast--error', !!isErr);
    t.classList.add('wv-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('wv-show'), 3200);
  }

  // ═══════════ AUTH ═══════════
  // Handle OAuth return (?auth_success=true&user=<json>)
  function consumeAuthRedirect() {
    const p = new URLSearchParams(location.search);
    if (p.get('auth_success') === 'true' && p.get('user')) {
      try {
        localStorage.setItem('whisUser', decodeURIComponent(p.get('user')));
      } catch (e) { /* ignore */ }
      history.replaceState({}, document.title, location.pathname);
    }
  }

  function readUser() {
    try {
      const s = localStorage.getItem('whisUser');
      if (!s) return null;
      const u = JSON.parse(s);
      return (u && u.googleId) ? u : null;
    } catch (e) {
      localStorage.removeItem('whisUser');
      return null;
    }
  }

  async function fetchGoogleClientId() {
    try {
      const r = await fetch(`${BACKEND_URL}/api/config`);
      if (r.ok) {
        const d = await r.json();
        GOOGLE_CLIENT_ID = d.googleClientId || null;
      }
    } catch (e) { /* offline, sign-in button still built below */ }
  }

  function buildGoogleAuthUrl() {
    const target = location.origin + RETURN_PATH;
    const ret = encodeURIComponent(target);
    const redirectUri = encodeURIComponent(`${BACKEND_URL}/api/auth/google/callback`);
    const source = localStorage.getItem('whisSource') || 'organic';
    const ref = localStorage.getItem('whisRef') || '';
    const aid = localStorage.getItem('whisVisitorId') || '';
    // Carry attribution + a return target through OAuth state.
    const state = encodeURIComponent(JSON.stringify({ s: source, r: ref, a: aid, ret: target }));
    const cid = GOOGLE_CLIENT_ID || '';
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${cid}` +
      `&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile&state=${state}&ret=${ret}`;
  }

  function showGate() {
    hide($('appShell'));
    const gate = $('signInGate');
    show(gate);
    const btn = $('gateGoogleBtn');
    btn.href = buildGoogleAuthUrl();
    // Refresh href once the client id resolves.
    fetchGoogleClientId().then(() => { btn.href = buildGoogleAuthUrl(); });
  }

  function logout() {
    localStorage.removeItem('whisUser');
    location.reload();
  }

  // ═══════════ PLAN / STATUS ═══════════
  async function loadUserStatus() {
    const nameEl = $('pcName'), badgeEl = $('pcBadge'), subEl = $('pcSub');
    try {
      const r = await fetch(`${BACKEND_URL}/api/user/status`, { headers: headers() });
      if (!r.ok) throw new Error('status ' + r.status);
      const s = await r.json();
      renderPlan(s);
    } catch (e) {
      // Graceful fallback, don't block the dashboard on status.
      nameEl.textContent = 'Free plan';
      badgeEl.textContent = 'Free session';
      badgeEl.classList.remove('wv-badge--elite');
      badgeEl.classList.add('wv-badge--trial');
      subEl.textContent = 'Upgrade to unlock unlimited sessions.';
    }
  }

  function renderPlan(s) {
    const nameEl = $('pcName'), badgeEl = $('pcBadge'), subEl = $('pcSub'), btn = $('upgradeBtn');
    s = s || {};
    const tier = (s.tier || s.plan || s.status || '').toString().toLowerCase();
    const isElite = s.isElite || /elite|unlimited|pro|premium|paid/.test(tier) || (s.active === true && s.trial === false);
    const isTrial = s.trial === true || /trial|free/.test(tier) || (!isElite && !tier);

    if (isElite) {
      nameEl.textContent = s.planName || 'Elite';
      badgeEl.textContent = 'Elite';
      badgeEl.classList.remove('wv-badge--trial');
      badgeEl.classList.add('wv-badge--elite');
      const hrs = (s.hoursRemaining != null) ? `${s.hoursRemaining}h left` : (s.unlimited ? 'Unlimited hours' : 'Active');
      subEl.textContent = hrs + (s.renewsAt ? ` · renews ${fmtDate(s.renewsAt)}` : '');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.2 2h-.4a2 2 0 0 0-2 1.7l-.2 1a7.5 7.5 0 0 0-1.7 1l-1-.4a2 2 0 0 0-2.5.9l-.2.3a2 2 0 0 0 .5 2.6l.8.6a7.6 7.6 0 0 0 0 2l-.8.6a2 2 0 0 0-.5 2.6l.2.3a2 2 0 0 0 2.5.9l1-.4a7.5 7.5 0 0 0 1.7 1l.2 1a2 2 0 0 0 2 1.7h.4a2 2 0 0 0 2-1.7l.2-1a7.5 7.5 0 0 0 1.7-1l1 .4a2 2 0 0 0 2.5-.9l.2-.3a2 2 0 0 0-.5-2.6l-.8-.6a7.6 7.6 0 0 0 0-2l.8-.6a2 2 0 0 0 .5-2.6l-.2-.3a2 2 0 0 0-2.5-.9l-1 .4a7.5 7.5 0 0 0-1.7-1l-.2-1A2 2 0 0 0 12.2 2z"/><circle cx="12" cy="12" r="3"/></svg> Manage plan';
    } else {
      nameEl.textContent = 'Free plan';
      badgeEl.textContent = isTrial ? 'Free session' : 'Free';
      badgeEl.classList.remove('elite');
      let sub = 'Upgrade to unlock unlimited sessions.';
      if (s.trialMinutesLeft != null) sub = `${s.trialMinutesLeft} trial minutes left.`;
      else if (s.trialDaysLeft != null) sub = `${s.trialDaysLeft} days left in your trial.`;
      subEl.textContent = sub;
    }
  }

  // ═══════════ PROFILE ═══════════
  function renderProfile() {
    if (!currentUser) return;
    $('profName').textContent = currentUser.name || 'Your account';
    $('profEmail').textContent = currentUser.email || '';
    const av = $('profAvatar');
    if (currentUser.picture) {
      av.innerHTML = `<img src="${esc(currentUser.picture)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover" onerror="this.remove()">`;
    } else {
      av.textContent = (currentUser.name || currentUser.email || '?').trim().charAt(0).toUpperCase();
    }
  }

  // ═══════════ SESSIONS ═══════════
  async function loadSessions() {
    const skel = $('sessionsSkeleton');
    show(skel);
    [$('sessionsGrid'), $('sessionsTableWrap'), $('sessionsEmpty'),
     $('sessionsNoResults'), $('sessionsError')].forEach(hide);
    try {
      const r = await fetch(`${BACKEND_URL}/api/sessions`, { headers: headers() });
      if (!r.ok) throw new Error('sessions ' + r.status);
      const d = await r.json();
      allSessions = Array.isArray(d) ? d : (d.sessions || []);
      hide(skel);
      updateLiveBadge();
      renderSessions();
    } catch (e) {
      hide(skel);
      show($('sessionsError'));
    }
  }

  function updateLiveBadge() {
    const hasLive = allSessions.some((s) => isLiveState(s.state));
    $('navSessions').classList.toggle('has-live', hasLive);
  }

  function isLiveState(state) {
    return /live|active|running|in_progress/i.test(String(state || ''));
  }

  function filteredSessions() {
    return allSessions.filter((s) => {
      const mode = String(s.mode || '').toLowerCase();
      if (currentFilter !== 'all') {
        if (currentFilter === 'interview' && !/interview/.test(mode)) return false;
        if (currentFilter === 'meeting' && !/meeting/.test(mode)) return false;
        if (currentFilter === 'mock' && !/mock/.test(mode)) return false;
      }
      if (currentSearch) {
        const hay = `${s.company || ''} ${s.role || ''} ${s.mode || ''}`.toLowerCase();
        if (!hay.includes(currentSearch)) return false;
      }
      return true;
    });
  }

  function renderSessions() {
    const grid = $('sessionsGrid');
    const tableWrap = $('sessionsTableWrap');
    const tbody = $('sessionsTableBody');
    [grid, tableWrap, $('sessionsEmpty'), $('sessionsNoResults'), $('sessionsError')].forEach(hide);

    if (allSessions.length === 0) {
      show($('sessionsEmpty'));
      return;
    }
    const list = filteredSessions();
    if (list.length === 0) {
      show($('sessionsNoResults'));
      return;
    }

    grid.innerHTML = list.map(cardHTML).join('');
    tbody.innerHTML = list.map(rowHTML).join('');

    if (currentView === 'grid') show(grid); else show(tableWrap);
    wireSessionClicks();
  }

  function modeIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>';
  }

  function stateChip(state) {
    if (isLiveState(state)) return '<span class="wv-badge chip state-live"><span class="d"></span>Live</span>';
    return `<span class="wv-badge chip state-ended">${esc(state || 'Ended')}</span>`;
  }

  function badgesHTML(s) {
    let out = `<span class="wv-badge chip mode">${esc(s.mode || 'Session')}</span>`;
    if (s.hasTranscript) {
      out += `<span class="wv-badge wv-badge--gold chip tr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Transcript</span>`;
    }
    return out;
  }

  function cardHTML(s) {
    const title = s.company || 'Untitled session';
    const role = s.role || ', ';
    return `
      <div class="s-card" data-id="${esc(s.sessionId)}">
        <div class="sc-top">
          <div class="sc-ico">${modeIcon()}</div>
          <span class="sc-date">${esc(fmtDate(s.createdAt))}</span>
        </div>
        <div>
          <div class="sc-title">${esc(title)}</div>
          <div class="sc-role">${esc(role)}</div>
        </div>
        <div class="sc-badges">${badgesHTML(s)} ${stateChip(s.state)}</div>
        <div class="sc-foot">
          <span class="sc-dur"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${esc(fmtDuration(s.durationSec))}</span>
          <span class="sc-view">View transcript<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
        </div>
      </div>`;
  }

  function rowHTML(s) {
    return `
      <tr data-id="${esc(s.sessionId)}">
        <td>${esc(fmtDate(s.createdAt))}</td>
        <td><div class="td-co">${esc(s.company || 'Untitled session')}</div><div class="td-role">${esc(s.role || ', ')}</div></td>
        <td><div class="td-badges">${badgesHTML(s)}</div></td>
        <td>${stateChip(s.state)}</td>
        <td>${esc(fmtDuration(s.durationSec))}</td>
        <td><span class="t-view">View<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></td>
      </tr>`;
  }

  function wireSessionClicks() {
    document.querySelectorAll('.s-card[data-id], .session-table tbody tr[data-id]').forEach((el) => {
      el.addEventListener('click', () => openTranscript(el.getAttribute('data-id')));
    });
  }

  // ═══════════ TRANSCRIPT VIEWER ═══════════
  async function openTranscript(id) {
    openModal('transcriptModal');
    const content = $('tvContent');
    content.innerHTML = '<div class="wv-skeleton sk-line w70"></div><div class="wv-skeleton sk-line w55"></div><div class="wv-skeleton sk-line w40"></div>';
    $('tvMeta').innerHTML = '';
    hide($('askBox'));
    $('askAnswer').classList.remove('show');

    try {
      const r = await fetch(`${BACKEND_URL}/api/sessions/${encodeURIComponent(id)}`, { headers: headers() });
      if (!r.ok) throw new Error('detail ' + r.status);
      const s = await r.json();
      currentSessionDetail = s;
      renderTranscript(s);
    } catch (e) {
      const local = allSessions.find((x) => String(x.sessionId) === String(id));
      if (local) { currentSessionDetail = local; renderTranscript(local, true); }
      else {
        content.innerHTML = `<div class="state error wv-empty"><div class="st-ico wv-empty-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg></div><h3 class="wv-h3">Couldn't load this session</h3><p class="wv-muted">Try again in a moment.</p></div>`;
      }
    }
  }

  function renderTranscript(s, degraded) {
    $('tvTitle').textContent = (s.company || 'Session') + (s.role ? `, ${s.role}` : '');
    $('tvSub').textContent = `${fmtDate(s.createdAt)} · ${fmtDuration(s.durationSec)}`;
    $('tvMeta').innerHTML = `${badgesHTML(s)} ${stateChip(s.state)}`;

    const content = $('tvContent');
    const turns = normalizeTranscript(s);
    if (!turns.length) {
      content.innerHTML = `<div class="state wv-empty"><div class="st-ico wv-empty-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h10"/></svg></div><h3 class="wv-h3">No transcript for this session</h3><p class="wv-muted">${degraded ? 'The full transcript is temporarily unavailable.' : 'This session didn\'t capture a transcript.'}</p></div>`;
      hide($('askBox'));
      return;
    }
    content.innerHTML = `<div class="transcript">${turns.map(turnHTML).join('')}</div>`;

    // Ask AI is best-effort, only surface it when the backend advertises it.
    if (s.canAsk || s.askEnabled) { show($('askBox')); } else { hide($('askBox')); }
  }

  // Accepts several plausible transcript shapes and normalizes to {you,text}.
  function normalizeTranscript(s) {
    const raw = s.transcript || s.turns || s.messages || [];
    if (!Array.isArray(raw)) return [];
    return raw.map((t) => {
      const speaker = (t.speaker || t.role || t.who || '').toLowerCase();
      const you = /you|me|self|candidate|user/.test(speaker);
      return { you, text: t.text || t.content || t.message || '' };
    }).filter((t) => t.text);
  }

  function turnHTML(t) {
    const cls = t.you ? 'you' : 'interviewer';
    const who = t.you ? 'You' : 'Int.';
    const lbl = t.you ? 'You' : 'Interviewer';
    return `<div class="turn ${cls}"><div class="who">${who}</div><div style="flex:1;min-width:0"><div class="who-lbl">${lbl}</div><div class="bubble">${esc(t.text)}</div></div></div>`;
  }

  async function askAI() {
    const q = $('askInput').value.trim();
    if (!q || !currentSessionDetail) return;
    const ans = $('askAnswer');
    ans.classList.add('show');
    ans.textContent = 'Thinking…';
    try {
      const r = await fetch(`${BACKEND_URL}/api/sessions/${encodeURIComponent(currentSessionDetail.sessionId)}/ask`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ question: q })
      });
      if (!r.ok) throw new Error('ask ' + r.status);
      const d = await r.json();
      ans.textContent = d.answer || d.text || 'No answer returned.';
    } catch (e) {
      ans.textContent = 'Ask AI is not available for this session yet.';
    }
  }

  // ═══════════ NEW SESSION ═══════════
  async function createSession() {
    const btn = $('createSessionBtn');
    const payload = {
      mode: $('nsMode').value,
      company: $('nsCompany').value.trim(),
      role: $('nsRole').value.trim(),
      language: $('nsLanguage').value,
      instructions: $('nsInstructions').value.trim()
    };
    // Attach a resume for tailored answers: either a saved resume id, or a
    // freshly uploaded PDF's parsed text. Additive, omitted when none chosen.
    const resSel = $('nsResume') ? $('nsResume').value : '';
    if (resSel === '__uploaded' && nsUploadedResume) {
      payload.resumeName = nsUploadedResume.name;
      payload.resumeContent = nsUploadedResume.content;
    } else if (resSel && resSel !== '__upload') {
      payload.resumeId = resSel;
    }
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.textContent = 'Creating…';
    try {
      const r = await fetch(`${BACKEND_URL}/api/sessions`, {
        method: 'POST', headers: headers(), body: JSON.stringify(payload)
      });
      let sid = '';
      if (r.ok) {
        const d = await r.json();
        sid = d.sessionId || d.id || '';
      }
      closeModal('newSessionModal');
      launchApp(sid);
    } catch (e) {
      // Even if session creation fails, get the user into the app.
      closeModal('newSessionModal');
      toast('Opening the app to start your session…');
      launchApp('');
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  }

  function launchApp(sessionId) {
    const url = sessionId ? `${APP_PATH}?sessionId=${encodeURIComponent(sessionId)}` : APP_PATH;
    window.open(url, '_blank');
    // Refresh the list shortly after so a newly created session appears.
    setTimeout(loadSessions, 1200);
  }

  // ═══════════ RESUMES (backend) ═══════════
  const RESUME_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/></svg>';
  const DEL_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';

  function firstText() {
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (typeof v === 'string' && v.length) return v;
    }
    return '';
  }
  function itemId(it) { return it.id || it._id || it.resumeId || it.documentId || ''; }
  function itemTitle(it, fallback) { return firstText(it.title, it.name, it.filename) || fallback; }
  function itemContent(it) { return firstText(it.content, it.body, it.text) || ''; }

  async function loadResumes() {
    show($('resumesSkeleton'));
    [$('resumesList'), $('resumesEmpty'), $('resumesError')].forEach(hide);
    try {
      const r = await fetch(`${BACKEND_URL}/api/resumes`, { headers: headers() });
      if (!r.ok) throw new Error('resumes ' + r.status);
      const d = await r.json();
      const items = Array.isArray(d) ? d : (d.resumes || d.items || []);
      hide($('resumesSkeleton'));
      renderResumes(items);
      resumesLoaded = true;
    } catch (e) {
      hide($('resumesSkeleton'));
      show($('resumesError'));
    }
  }

  function renderResumes(items) {
    resumesCache = Array.isArray(items) ? items : [];
    const list = $('resumesList');
    if (!items.length) { list.innerHTML = ''; hide(list); show($('resumesEmpty')); return; }
    hide($('resumesEmpty'));
    list.innerHTML = items.map((it) => {
      const id = itemId(it);
      const title = itemTitle(it, 'Untitled resume');
      return `
      <div class="doc-row" data-open="${esc(id)}">
        <div class="dr-ico">${RESUME_ICO}</div>
        <div class="dr-meta">
          <div class="dr-name">${esc(title)}</div>
          <div class="dr-sub">${esc(fmtDate(it.updatedAt || it.createdAt))}</div>
        </div>
        <div class="dr-actions">
          <button class="icon-btn danger" data-del="${esc(id)}" title="Delete" aria-label="Delete">${DEL_ICO}</button>
        </div>
      </div>`;
    }).join('');
    show(list);
    wireResumeRows(list);
  }

  function wireResumeRows(list) {
    list.querySelectorAll('[data-open]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-del]')) return;
        openResume(row.getAttribute('data-open'));
      });
    });
    list.querySelectorAll('[data-del]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteResume(b.getAttribute('data-del'));
      });
    });
  }

  async function openResume(id) {
    openModal('viewerModal');
    $('viewerTitle').textContent = 'Resume';
    $('viewerSub').textContent = ', ';
    $('viewerContent').innerHTML = '<div class="wv-skeleton sk-line w70"></div><div class="wv-skeleton sk-line w55"></div><div class="wv-skeleton sk-line w40"></div>';
    try {
      const r = await fetch(`${BACKEND_URL}/api/resumes/${encodeURIComponent(id)}`, { headers: headers() });
      if (!r.ok) throw new Error('resume ' + r.status);
      const it = await r.json();
      renderViewer(itemTitle(it, 'Resume'), it, itemContent(it));
    } catch (e) {
      $('viewerContent').innerHTML = `<div class="viewer-empty">Couldn't load this resume. Try again in a moment.</div>`;
    }
  }

  async function deleteResume(id) {
    if (!confirm('Delete this resume? This cannot be undone.')) return;
    try {
      const r = await fetch(`${BACKEND_URL}/api/resumes/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers() });
      if (!r.ok) throw new Error('del ' + r.status);
      toast('Resume deleted.');
      loadResumes();
    } catch (e) { toast('Couldn\'t delete. Try again.', true); }
  }

  function renderViewer(title, it, content) {
    $('viewerTitle').textContent = title;
    const bits = [];
    if (it.updatedAt || it.createdAt) bits.push(fmtDate(it.updatedAt || it.createdAt));
    if (content) bits.push(`${content.length} chars`);
    $('viewerSub').textContent = bits.join(' · ') || ', ';
    $('viewerContent').innerHTML = content
      ? `<div class="viewer-body">${esc(content)}</div>`
      : `<div class="viewer-empty">This resume has no saved text content.</div>`;
  }

  // ═══════════ ADD RESUME (modal + upload) ═══════════
  function openResumeModal() {
    $('resName').value = '';
    $('resBody').value = '';
    $('resFile').value = '';
    resUploadedContent = null;
    $('resDropText').textContent = 'Click to choose a PDF, or paste text below';
    $('resDrop').classList.remove('has-file');
    openModal('resumeModal');
    setTimeout(() => $('resName').focus(), 60);
  }

  async function readPdf(file) {
    if (!window.pdfjsLib) throw new Error('pdfjs unavailable');
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let out = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      out += tc.items.map((i) => i.str).join(' ') + '\n\n';
    }
    return out.trim();
  }

  async function handleResumeFile(file) {
    if (!file) return;
    const drop = $('resDrop');
    $('resDropText').textContent = `Reading ${file.name}…`;
    try {
      const text = await readPdf(file);
      // Keep the extracted text internal, never dump the raw parse into the visible box.
      resUploadedContent = text;
      if (!$('resName').value.trim()) {
        $('resName').value = file.name.replace(/\.pdf$/i, '');
      }
      $('resDropText').textContent = `${file.name} · ready`;
      drop.classList.add('has-file');
    } catch (e) {
      $('resDropText').textContent = 'Couldn\'t read that PDF. Paste the text instead.';
      drop.classList.remove('has-file');
      toast('Couldn\'t parse the PDF. Paste the text instead.', true);
    }
  }

  async function saveResume() {
    const title = $('resName').value.trim();
    // Prefer anything the user typed/pasted; otherwise use the extracted PDF text held internally.
    const content = ($('resBody').value.trim()) || (resUploadedContent || '').trim();
    if (!title) { $('resName').focus(); toast('Give your resume a title.', true); return; }
    if (!content) { $('resBody').focus(); toast('Add some content or upload a PDF.', true); return; }
    const btn = $('saveResumeBtn');
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const r = await fetch(`${BACKEND_URL}/api/resumes`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ title, content })
      });
      if (!r.ok) throw new Error('save ' + r.status);
      closeModal('resumeModal');
      toast('Resume saved.');
      loadResumes();
    } catch (e) {
      toast('Couldn\'t save. Try again.', true);
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  }

  // ═══════════ NAV / SCREENS ═══════════
  function switchScreen(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const target = $('screen-' + name);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-item[data-screen]').forEach((n) =>
      n.classList.toggle('wv-active', n.getAttribute('data-screen') === name));
    if (name === 'resumes' && !resumesLoaded) loadResumes();
    closeSidebar();
    const c = document.querySelector('.content'); if (c) c.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  // ═══════════ MODALS ═══════════
  function openModal(id) { $(id).classList.add('wv-open'); document.body.style.overflow = 'hidden'; }
  function closeModal(id) { $(id).classList.remove('wv-open'); document.body.style.overflow = ''; }

  function openNewSession() {
    ['nsCompany', 'nsRole', 'nsInstructions'].forEach((f) => { $(f).value = ''; });
    nsUploadedResume = null;
    $('nsResumeFile').value = '';
    populateResumePicker();
    openModal('newSessionModal');
    setTimeout(() => $('nsCompany').focus(), 60);
  }

  // Fill the New Session "Attach resume" select with the user's saved resumes.
  // Fetches the list lazily the first time (so the picker works even before the
  // Resumes screen has been visited). Always keeps "No resume" + "Attach a PDF…".
  function populateResumePicker() {
    const sel = $('nsResume');
    if (!sel) return;
    renderResumeOptions();
    if (!resumesLoaded) {
      fetch(`${BACKEND_URL}/api/resumes`, { headers: headers() })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          resumesCache = Array.isArray(d) ? d : (d.resumes || d.items || []);
          renderResumeOptions();
        })
        .catch(() => { /* offline, picker still offers PDF upload */ });
    }
  }

  function renderResumeOptions() {
    const sel = $('nsResume');
    if (!sel) return;
    const keep = sel.value;
    let html = '<option value="">No resume</option>';
    resumesCache.forEach((it) => {
      const id = itemId(it);
      if (!id) return;
      html += `<option value="${esc(id)}">${esc(itemTitle(it, 'Untitled resume'))}</option>`;
    });
    if (nsUploadedResume) {
      html += `<option value="__uploaded" selected>${esc(nsUploadedResume.name)} (attached)</option>`;
    }
    html += '<option value="__upload">Attach a PDF…</option>';
    sel.innerHTML = html;
    if (!nsUploadedResume && keep && keep !== '__upload') sel.value = keep;
  }

  // When the picker is set to "Attach a PDF…", open the file dialog. On pick,
  // parse the PDF client-side (same as the Resumes screen) and remember it.
  function onResumePickChange() {
    const sel = $('nsResume');
    if (sel.value === '__upload') {
      sel.value = nsUploadedResume ? '__uploaded' : '';
      $('nsResumeFile').click();
    } else if (sel.value !== '__uploaded') {
      nsUploadedResume = null;
      renderResumeOptions();
    }
  }

  async function onResumeFilePicked(file) {
    if (!file) return;
    try {
      const text = await readPdf(file);
      nsUploadedResume = { name: file.name.replace(/\.pdf$/i, ''), content: text };
      renderResumeOptions();
      $('nsResume').value = '__uploaded';
    } catch (e) {
      nsUploadedResume = null;
      renderResumeOptions();
      toast('Couldn\'t read that PDF. Add it from the Resumes tab instead.', true);
    }
    $('nsResumeFile').value = '';
  }

  // ═══════════ SIDEBAR (mobile) ═══════════
  function openSidebar() { $('sidebar').classList.add('open'); $('sbBackdrop').classList.add('show'); }
  function closeSidebar() { $('sidebar').classList.remove('open'); $('sbBackdrop').classList.remove('show'); }

  // ═══════════ FORMATTERS ═══════════
  function fmtDate(v) {
    if (!v) return ', ';
    const d = new Date(v);
    if (isNaN(d)) return ', ';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtDuration(sec) {
    sec = Number(sec) || 0;
    if (sec <= 0) return ', ';
    const m = Math.floor(sec / 60), s = sec % 60;
    if (m >= 60) { const h = Math.floor(m / 60); return `${h}h ${m % 60}m`; }
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  // ═══════════ WIRING ═══════════
  function wire() {
    // New session triggers
    ['newSessionBtnSide', 'newSessionBtnMain', 'newSessionBtnTop', 'emptyNewBtn']
      .forEach((id) => { const el = $(id); if (el) el.addEventListener('click', openNewSession); });
    $('createSessionBtn').addEventListener('click', createSession);

    // New session, Attach resume picker
    $('nsResume').addEventListener('change', onResumePickChange);
    $('nsResumeFile').addEventListener('change', (e) => onResumeFilePicked(e.target.files && e.target.files[0]));

    // Keyboard: Enter in a single-line field (or Cmd/Ctrl+Enter anywhere) submits.
    $('newSessionModal').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const inTextarea = e.target && e.target.tagName === 'TEXTAREA';
      if (!inTextarea || e.metaKey || e.ctrlKey) { e.preventDefault(); createSession(); }
    });
    $('resumeModal').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const inTextarea = e.target && e.target.tagName === 'TEXTAREA';
      if (!inTextarea || e.metaKey || e.ctrlKey) { e.preventDefault(); saveResume(); }
    });

    // Nav items (screen switchers only; anchor nav items navigate natively)
    document.querySelectorAll('.nav-item[data-screen]').forEach((n) =>
      n.addEventListener('click', () => switchScreen(n.getAttribute('data-screen'))));

    // Filters
    $('sessionFilters').addEventListener('click', (e) => {
      const t = e.target.closest('.filter-tab'); if (!t) return;
      $('sessionFilters').querySelectorAll('.filter-tab').forEach((x) => x.classList.remove('wv-on'));
      t.classList.add('wv-on');
      currentFilter = t.getAttribute('data-filter');
      renderSessions();
    });

    // Search
    $('sessionSearch').addEventListener('input', (e) => {
      currentSearch = e.target.value.trim().toLowerCase();
      renderSessions();
    });

    // View toggle
    $('viewToggle').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      $('viewToggle').querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      currentView = b.getAttribute('data-view');
      renderSessions();
    });

    // Retry
    $('retrySessionsBtn').addEventListener('click', loadSessions);

    // Resumes
    ['newResumeBtn', 'resumesEmptyBtn'].forEach((id) => { const el = $(id); if (el) el.addEventListener('click', openResumeModal); });
    $('retryResumesBtn').addEventListener('click', loadResumes);
    $('saveResumeBtn').addEventListener('click', saveResume);
    $('resFile').addEventListener('change', (e) => handleResumeFile(e.target.files && e.target.files[0]));

    // Ask AI
    $('askBtn').addEventListener('click', askAI);
    $('askInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') askAI(); });

    // Profile / logout
    $('logoutBtn').addEventListener('click', (e) => { e.stopPropagation(); logout(); });

    // Modal close buttons + overlay click
    document.querySelectorAll('[data-close]').forEach((b) =>
      b.addEventListener('click', () => closeModal(b.getAttribute('data-close'))));
    document.querySelectorAll('.wv-modal').forEach((ov) =>
      ov.addEventListener('click', (e) => { if (e.target === ov) closeModal(ov.id); }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.querySelectorAll('.wv-modal.wv-open').forEach((m) => closeModal(m.id));
    });

    // Mobile sidebar
    $('hamburger').addEventListener('click', openSidebar);
    $('sbBackdrop').addEventListener('click', closeSidebar);
  }

  // ═══════════ BOOT ═══════════
  function boot() {
    consumeAuthRedirect();
    currentUser = readUser();
    if (!currentUser) { showGate(); return; }

    hide($('signInGate'));
    show($('appShell'));
    renderProfile();
    wire();
    loadUserStatus();
    loadSessions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
