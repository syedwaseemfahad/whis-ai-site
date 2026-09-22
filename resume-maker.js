/* ═══════════════════════════════════════════════════════════════
   Whis-AI — Resume Maker (free lead-magnet)
   Free to build (no card). Import PDF/DOCX/paste/blank → structured
   editor + live preview → tailor to a JD → ATS score with per-point
   fixes → templates → download PDF + save to account.

   Backend contract (teammate is adding these — we degrade gracefully):
     POST /api/resume/tailor  {resumeText, jobDescription}
          → {resumeText?, tailoredText?, suggestions:[{issue,fix,severity}], score?}
     POST /api/resume/score   {resumeText, jobDescription?}
          → {score, suggestions:[{issue,fix,severity}]}
     POST /api/resumes        {title, data, resumeText}  → {id}
     GET  /api/resumes        → [{id,title,updatedAt,data}]
   Auth: identity from localStorage.whisUser; x-google-id on API calls.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const BACKEND_URL = 'https://api.whis-ai.com';
  const RETURN_PATH = '/resume-maker.html';
  const DRAFT_KEY = 'whisRM_draft';
  let GOOGLE_CLIENT_ID = null;

  // ── State ──
  let currentUser = null;
  let gateAfter = null; // 'save' | 'download' — action to resume after sign-in
  let suggestions = []; // [{id, issue, fix, severity, state:'open'|'accepted'|'ignored'}]
  let currentScore = null;
  let currentResumeId = null;

  const resume = {
    name: '', title: '', email: '', phone: '', location: '', links: '',
    summary: '',
    experience: [], // {role, org, when, bullets}
    education: [],  // {degree, school, when, detail}
    skills: '',
    template: 'classic', color: '#1a2b4a', font: 'sans'
  };

  // ── DOM helpers ──
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
    t.classList.toggle('err', !!isErr);
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 3400);
  }

  // ═══════════ AUTH (mirrors dashboard.js) ═══════════
  function consumeAuthRedirect() {
    const p = new URLSearchParams(location.search);
    if (p.get('auth_success') === 'true' && p.get('user')) {
      try { localStorage.setItem('whisUser', decodeURIComponent(p.get('user'))); } catch (e) {}
      history.replaceState({}, document.title, location.pathname);
    }
  }
  function readUser() {
    try {
      const u = JSON.parse(localStorage.getItem('whisUser') || 'null');
      return (u && u.googleId) ? u : null;
    } catch (e) { localStorage.removeItem('whisUser'); return null; }
  }
  async function fetchGoogleClientId() {
    try {
      const r = await fetch(`${BACKEND_URL}/api/config`);
      if (r.ok) { const d = await r.json(); GOOGLE_CLIENT_ID = d.googleClientId || null; }
    } catch (e) {}
  }
  function buildGoogleAuthUrl() {
    const ret = location.origin + RETURN_PATH;
    const redirectUri = encodeURIComponent(`${BACKEND_URL}/api/auth/google/callback`);
    const source = localStorage.getItem('whisSource') || 'organic';
    const ref = localStorage.getItem('whisRef') || '';
    const aid = localStorage.getItem('whisVisitorId') || '';
    const state = encodeURIComponent(JSON.stringify({ s: source, r: ref, a: aid, ret }));
    const cid = GOOGLE_CLIENT_ID || '';
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${cid}` +
      `&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile&state=${state}&ret=${encodeURIComponent(ret)}`;
  }
  function refreshAuthUrls() {
    const url = buildGoogleAuthUrl();
    ['gateGoogleBtn', 'topSignInBtn'].forEach((id) => { const b = $(id); if (b) b.href = url; });
  }
  function requireAuth(action) {
    if (currentUser) return true;
    gateAfter = action;
    $('gateAction').textContent = action === 'download' ? 'download' : 'save';
    saveDraft(); // keep the work while they sign in
    refreshAuthUrls();
    fetchGoogleClientId().then(refreshAuthUrls);
    openModal('signInModal');
    return false;
  }
  function logout() { localStorage.removeItem('whisUser'); location.reload(); }

  function renderAuthUI() {
    if (currentUser) {
      hide($('topSignInBtn'));
      show($('topUser'));
      const av = $('topAvatar');
      if (currentUser.picture) {
        av.innerHTML = `<img src="${esc(currentUser.picture)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover" onerror="this.remove()">`;
      } else {
        av.textContent = (currentUser.name || currentUser.email || '?').trim().charAt(0).toUpperCase();
      }
    } else {
      show($('topSignInBtn'));
      hide($('topUser'));
      refreshAuthUrls();
      fetchGoogleClientId().then(refreshAuthUrls);
    }
  }

  // ═══════════ IMPORT ═══════════
  function importStatus(msg, cls) {
    const el = $('importStatus');
    el.textContent = msg || '';
    el.className = 'start-note' + (cls ? ' ' + cls : '');
  }

  async function handleFile(file) {
    if (!file) return;
    const card = $('importUploadCard');
    card.classList.add('busy');
    importStatus('Reading “' + file.name + '”…');
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const ab = await file.arrayBuffer();
      const { text, error } = await extractFileText(ab, ext);
      if (error) { importStatus(error, 'err'); return; }
      if (!text || text.trim().length < 20) {
        importStatus('We couldn\'t find text in that file. Try pasting instead.', 'err'); return;
      }
      parseIntoResume(text);
      importStatus('Imported. Opening the editor…', 'ok');
      enterBuilder();
    } catch (e) {
      importStatus('Something went wrong reading that file. Try pasting the text.', 'err');
    } finally {
      card.classList.remove('busy');
    }
  }

  // Browser-side extraction — same libs/versions as the live app.
  async function extractFileText(buffer, ext) {
    try {
      const extension = (ext || '').toLowerCase().replace(/^\./, '');
      const ab = buffer instanceof ArrayBuffer ? buffer : new Uint8Array(buffer || []).buffer;
      if (extension === 'txt' || extension === 'md' || extension === 'rtf') {
        try { return { text: new TextDecoder('utf-8').decode(ab) || '' }; } catch (_) { return { text: '' }; }
      }
      if (extension === 'pdf') {
        if (!window.pdfjsLib) return { text: '', error: 'PDF reader still loading — try again in a moment.' };
        try {
          const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
          let out = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            out += content.items.map((it) => (it.str || '')).join(' ') + '\n';
          }
          return { text: out.trim() };
        } catch (e) { return { text: '', error: 'Could not read this PDF. If it\'s a scan, paste the text instead.' }; }
      }
      if (extension === 'docx') {
        if (!window.mammoth) return { text: '', error: 'Doc reader still loading — try again in a moment.' };
        try {
          const result = await window.mammoth.extractRawText({ arrayBuffer: ab });
          return { text: (result && result.value ? result.value : '').trim() };
        } catch (e) { return { text: '', error: 'Could not read this .docx. Save as PDF, or paste the text.' }; }
      }
      try {
        const t = new TextDecoder('utf-8').decode(ab).replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, ' ').trim();
        if (t && t.length > 40) return { text: t };
      } catch (_) {}
      return { text: '', error: 'Unsupported file. Upload a PDF, DOCX or TXT — or paste your resume text.' };
    } catch (_) { return { text: '' }; }
  }

  // Heuristic parse of raw resume text into structured sections.
  function parseIntoResume(text) {
    resetResume();
    const raw = text.replace(/\r/g, '');
    const lines = raw.split('\n').map((l) => l.trim());
    const nonEmpty = lines.filter(Boolean);

    // contact bits
    const emailM = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailM) resume.email = emailM[0];
    const phoneM = raw.match(/(\+?\d[\d\s().-]{7,}\d)/);
    if (phoneM) resume.phone = phoneM[0].trim();
    const links = (raw.match(/((https?:\/\/)?(www\.)?(linkedin\.com|github\.com|gitlab\.com|[\w-]+\.[\w.]+\/[^\s]+))/gi) || [])
      .filter((l) => !/@/.test(l)).slice(0, 3);
    if (links.length) resume.links = links.join(' · ');

    // name = first non-empty line that isn't the email/phone and looks like a name
    if (nonEmpty.length) {
      const first = nonEmpty.find((l) => l && !/@|\d{4,}|http/i.test(l) && l.length < 60);
      if (first) resume.name = first;
      const idx = nonEmpty.indexOf(resume.name);
      const maybeTitle = nonEmpty[idx + 1];
      if (maybeTitle && maybeTitle.length < 70 && !/@|http/i.test(maybeTitle)) resume.title = maybeTitle;
    }

    // section splitting
    const secRe = /^(professional\s+summary|summary|profile|objective|about|experience|work\s+experience|employment|professional\s+experience|education|academic|skills|technical\s+skills|core\s+competencies|projects|certifications)\s*:?\s*$/i;
    const blocks = {};
    let cur = 'header';
    blocks[cur] = [];
    lines.forEach((l) => {
      if (secRe.test(l)) {
        const key = l.toLowerCase();
        if (/summary|profile|objective|about/.test(key)) cur = 'summary';
        else if (/experience|employment/.test(key)) cur = 'experience';
        else if (/education|academic/.test(key)) cur = 'education';
        else if (/skill|competenc/.test(key)) cur = 'skills';
        else cur = 'other';
        blocks[cur] = blocks[cur] || [];
      } else {
        (blocks[cur] = blocks[cur] || []).push(l);
      }
    });

    if (blocks.summary) resume.summary = blocks.summary.filter(Boolean).join(' ').trim();
    if (blocks.skills) {
      resume.skills = blocks.skills.filter(Boolean).join(', ')
        .replace(/[•·|]/g, ',').replace(/\s*,\s*/g, ', ').replace(/(,\s*)+/g, ', ').trim().replace(/^,|,$/g, '');
    }
    if (blocks.experience) resume.experience = parseEntries(blocks.experience, 'exp');
    if (blocks.education) resume.education = parseEntries(blocks.education, 'edu');

    // if nothing landed in experience, keep a single seeded block so the user has structure
    if (!resume.experience.length) resume.experience = [emptyExp()];
    if (!resume.education.length) resume.education = [emptyEdu()];
    saveDraft();
  }

  const dateRe = /(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}\b|\b\d{4}\b|present|current)/i;
  function parseEntries(rawLines, kind) {
    const lines = rawLines.map((l) => l.trim());
    const entries = [];
    let cur = null;
    lines.forEach((l) => {
      if (!l) return;
      const isBullet = /^[•\-*▪◦·]/.test(l);
      const hasDate = dateRe.test(l);
      // A new entry heading: not a bullet, and (has a date range OR looks like Title — Company)
      if (!isBullet && (hasDate || /[—–-]|,\s|\bat\b/i.test(l)) && (!cur || cur.bullets.length || hasDate)) {
        if (cur) entries.push(cur);
        const when = (l.match(new RegExp(dateRe.source + '[\\s\\-–—to]*' + dateRe.source, 'i')) || l.match(dateRe) || [''])[0];
        const head = l.replace(when, '').replace(/[—–|]+\s*$/, '').trim();
        const parts = head.split(/\s*[—–|,]\s*|\s+at\s+/i).filter(Boolean);
        if (kind === 'edu') {
          cur = { degree: parts[0] || head, school: parts[1] || '', when: when.trim(), detail: '' };
        } else {
          cur = { role: parts[0] || head, org: parts[1] || '', when: when.trim(), bullets: [] };
        }
      } else if (cur) {
        const clean = l.replace(/^[•\-*▪◦·]\s*/, '').trim();
        if (kind === 'edu') { cur.detail = (cur.detail ? cur.detail + ' ' : '') + clean; }
        else if (clean) cur.bullets.push(clean);
      } else {
        // stray line before any heading — start a loose entry
        if (kind === 'edu') cur = { degree: l, school: '', when: '', detail: '' };
        else cur = { role: l, org: '', when: '', bullets: [] };
      }
    });
    if (cur) entries.push(cur);
    return entries;
  }

  function resetResume() {
    Object.assign(resume, {
      name: '', title: '', email: '', phone: '', location: '', links: '',
      summary: '', experience: [], education: [], skills: ''
    });
    suggestions = []; currentScore = null; currentResumeId = null;
  }
  const emptyExp = () => ({ role: '', org: '', when: '', bullets: [''] });
  const emptyEdu = () => ({ degree: '', school: '', when: '', detail: '' });

  function startBlank() {
    resetResume();
    resume.experience = [emptyExp()];
    resume.education = [emptyEdu()];
    saveDraft();
    enterBuilder();
  }

  // ═══════════ BUILDER RENDER ═══════════
  function enterBuilder() {
    hide($('startScreen'));
    show($('builderScreen'));
    hydrateFields();
    renderRepeaters();
    renderPreview();
    renderScore();
    renderFixes();
    window.scrollTo(0, 0);
  }
  function backToStart() {
    show($('startScreen'));
    hide($('builderScreen'));
    importStatus('');
    window.scrollTo(0, 0);
  }

  function hydrateFields() {
    const map = { name:'fName', title:'fTitle', email:'fEmail', phone:'fPhone', location:'fLocation', links:'fLinks', summary:'fSummary', skills:'fSkills' };
    Object.keys(map).forEach((k) => { const el = $(map[k]); if (el) el.value = resume[k] || ''; });
  }

  function renderRepeaters() {
    const exp = $('expList');
    exp.innerHTML = resume.experience.length ? resume.experience.map((e, i) => `
      <div class="rep-item" data-kind="experience" data-i="${i}">
        <div class="rep-top"><button class="icon-btn danger" data-del-rep="experience" data-i="${i}" title="Remove" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button></div>
        <div class="grid2">
          <div class="field"><label>Role</label><input type="text" data-rep="experience" data-i="${i}" data-key="role" value="${esc(e.role)}" placeholder="Senior Engineer" /></div>
          <div class="field"><label>Company</label><input type="text" data-rep="experience" data-i="${i}" data-key="org" value="${esc(e.org)}" placeholder="Acme Inc." /></div>
        </div>
        <div class="field" style="margin-top:12px"><label>Dates</label><input type="text" data-rep="experience" data-i="${i}" data-key="when" value="${esc(e.when)}" placeholder="Jan 2022 – Present" /></div>
        <div class="field" style="margin-top:12px"><label>Highlights (one per line)</label><textarea data-rep="experience" data-i="${i}" data-key="bullets" placeholder="Led a team of 5 to ship…&#10;Cut API latency by 40%…">${esc((e.bullets || []).join('\n'))}</textarea></div>
      </div>`).join('') : '<div class="rep-empty">No roles yet — add one.</div>';

    const edu = $('eduList');
    edu.innerHTML = resume.education.length ? resume.education.map((e, i) => `
      <div class="rep-item" data-kind="education" data-i="${i}">
        <div class="rep-top"><button class="icon-btn danger" data-del-rep="education" data-i="${i}" title="Remove" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button></div>
        <div class="grid2">
          <div class="field"><label>Degree</label><input type="text" data-rep="education" data-i="${i}" data-key="degree" value="${esc(e.degree)}" placeholder="B.S. Computer Science" /></div>
          <div class="field"><label>School</label><input type="text" data-rep="education" data-i="${i}" data-key="school" value="${esc(e.school)}" placeholder="Stanford University" /></div>
        </div>
        <div class="grid2" style="margin-top:12px">
          <div class="field"><label>Dates</label><input type="text" data-rep="education" data-i="${i}" data-key="when" value="${esc(e.when)}" placeholder="2018 – 2022" /></div>
          <div class="field"><label>Detail</label><input type="text" data-rep="education" data-i="${i}" data-key="detail" value="${esc(e.detail)}" placeholder="GPA 3.9 · Dean's List" /></div>
        </div>
      </div>`).join('') : '<div class="rep-empty">No schools yet — add one.</div>';

    wireRepeaterInputs();
  }

  function wireRepeaterInputs() {
    document.querySelectorAll('[data-rep]').forEach((el) => {
      el.addEventListener('input', () => {
        const kind = el.getAttribute('data-rep');
        const i = +el.getAttribute('data-i');
        const key = el.getAttribute('data-key');
        const item = resume[kind][i]; if (!item) return;
        if (key === 'bullets') item.bullets = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
        else item[key] = el.value;
        markDirty(); renderPreview();
      });
    });
    document.querySelectorAll('[data-del-rep]').forEach((b) => {
      b.addEventListener('click', () => {
        const kind = b.getAttribute('data-del-rep');
        resume[kind].splice(+b.getAttribute('data-i'), 1);
        markDirty(); renderRepeaters(); renderPreview();
      });
    });
  }

  // ── Live preview ──
  function renderPreview() {
    const doc = $('resumeDoc');
    doc.className = `resume-doc tpl-${resume.template} font-${resume.font}`;
    doc.style.setProperty('--doc-accent', resume.color);

    const contact = [
      resume.email && `<span>${esc(resume.email)}</span>`,
      resume.phone && `<span>${esc(resume.phone)}</span>`,
      resume.location && `<span>${esc(resume.location)}</span>`,
      resume.links && `<span>${esc(resume.links)}</span>`
    ].filter(Boolean).join('');

    const expHTML = resume.experience.filter((e) => e.role || e.org || (e.bullets && e.bullets.length)).map((e) => `
      <div class="rd-entry">
        <div class="rd-entry-top">
          <div><span class="rd-role">${esc(e.role || '')}</span>${e.org ? ` · <span class="rd-org">${esc(e.org)}</span>` : ''}</div>
          ${e.when ? `<span class="rd-when">${esc(e.when)}</span>` : ''}
        </div>
        ${(e.bullets && e.bullets.length) ? `<ul class="rd-bullets">${e.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      </div>`).join('');

    const eduHTML = resume.education.filter((e) => e.degree || e.school).map((e) => `
      <div class="rd-entry">
        <div class="rd-entry-top">
          <div><span class="rd-role">${esc(e.degree || '')}</span>${e.school ? ` · <span class="rd-org">${esc(e.school)}</span>` : ''}</div>
          ${e.when ? `<span class="rd-when">${esc(e.when)}</span>` : ''}
        </div>
        ${e.detail ? `<div class="rd-bullets" style="padding-left:0;margin-top:3px"><span style="font-size:12px;color:#333">${esc(e.detail)}</span></div>` : ''}
      </div>`).join('');

    const skills = resume.skills.split(',').map((s) => s.trim()).filter(Boolean);
    const skillsHTML = skills.length ? `<div class="rd-skills">${skills.map((s) => `<span class="rd-skill">${esc(s)}</span>`).join('')}</div>` : '';

    doc.innerHTML = `
      <div class="rd-header">
        <h1>${esc(resume.name) || '<span class="rd-empty">Your Name</span>'}</h1>
        ${resume.title ? `<div class="rd-headline">${esc(resume.title)}</div>` : ''}
        ${contact ? `<div class="rd-contact">${contact}</div>` : ''}
      </div>
      ${resume.summary ? `<div class="rd-section"><div class="rd-sec-title">Summary</div><div class="rd-summary">${esc(resume.summary)}</div></div>` : ''}
      ${expHTML ? `<div class="rd-section"><div class="rd-sec-title">Experience</div>${expHTML}</div>` : ''}
      ${eduHTML ? `<div class="rd-section"><div class="rd-sec-title">Education</div>${eduHTML}</div>` : ''}
      ${skillsHTML ? `<div class="rd-section"><div class="rd-sec-title">Skills</div>${skillsHTML}</div>` : ''}
    `;
  }

  // ── Full resume text (for API + save) ──
  function resumeToText() {
    const L = [];
    if (resume.name) L.push(resume.name);
    if (resume.title) L.push(resume.title);
    const c = [resume.email, resume.phone, resume.location, resume.links].filter(Boolean).join(' · ');
    if (c) L.push(c);
    if (resume.summary) { L.push('', 'SUMMARY', resume.summary); }
    if (resume.experience.some((e) => e.role || e.org)) {
      L.push('', 'EXPERIENCE');
      resume.experience.forEach((e) => {
        const head = [e.role, e.org].filter(Boolean).join(' — ') + (e.when ? `  (${e.when})` : '');
        if (head.trim()) L.push(head);
        (e.bullets || []).forEach((b) => L.push('• ' + b));
      });
    }
    if (resume.education.some((e) => e.degree || e.school)) {
      L.push('', 'EDUCATION');
      resume.education.forEach((e) => {
        L.push([e.degree, e.school].filter(Boolean).join(' — ') + (e.when ? `  (${e.when})` : ''));
        if (e.detail) L.push(e.detail);
      });
    }
    if (resume.skills) { L.push('', 'SKILLS', resume.skills); }
    return L.join('\n');
  }

  // ═══════════ TAILOR + SCORE ═══════════
  async function tailor() {
    const jd = $('jdInput').value.trim();
    const btn = $('tailorBtn');
    if (!jd) { toast('Paste a job description to tailor — or use “Re-score only”.'); $('jdInput').focus(); return; }
    setBtnLoading(btn, 'Tailoring…');
    try {
      const r = await fetch(`${BACKEND_URL}/api/resume/tailor`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ resumeText: resumeToText(), jobDescription: jd })
      });
      if (!r.ok) throw new Error('tailor ' + r.status);
      const d = await r.json();
      const tailored = d.resumeText || d.tailoredText || d.text;
      if (tailored && tailored.trim().length > 20) {
        parseIntoResume(tailored);
        hydrateFields(); renderRepeaters(); renderPreview();
      }
      applySuggestions(d.suggestions);
      if (d.score != null) { currentScore = clampScore(d.score); renderScore(); }
      else await scoreOnly(true);
      toast('Tailored to the job. Review the fixes on the right.');
    } catch (e) {
      toast('Couldn\'t reach the tailor service. Try again shortly.', true);
    } finally { restoreBtn(btn); }
  }

  async function scoreOnly(silent) {
    const btn = $('scoreOnlyBtn');
    if (!silent) setBtnLoading(btn, 'Scoring…');
    try {
      const r = await fetch(`${BACKEND_URL}/api/resume/score`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ resumeText: resumeToText(), jobDescription: $('jdInput').value.trim() || undefined })
      });
      if (!r.ok) throw new Error('score ' + r.status);
      const d = await r.json();
      currentScore = clampScore(d.score);
      if (d.suggestions) applySuggestions(d.suggestions);
      renderScore(); renderFixes();
      if (!silent) toast('Re-scored.');
    } catch (e) {
      if (!silent) toast('Couldn\'t reach the scoring service. Try again shortly.', true);
    } finally { if (!silent) restoreBtn(btn); }
  }

  function clampScore(s) { s = Number(s); if (isNaN(s)) return null; return Math.max(0, Math.min(100, Math.round(s))); }

  function applySuggestions(list) {
    if (!Array.isArray(list)) return;
    suggestions = list.map((s, i) => ({
      id: 's' + i + '_' + Date.now().toString(36),
      issue: s.issue || s.title || 'Suggestion',
      fix: s.fix || s.suggestion || s.detail || '',
      severity: normSev(s.severity),
      state: 'open'
    }));
    renderFixes();
  }
  function normSev(s) {
    s = String(s || '').toLowerCase();
    if (/high|critical|major/.test(s)) return 'high';
    if (/low|minor|nit/.test(s)) return 'low';
    return 'medium';
  }

  // ── Score gauge ──
  function renderScore() {
    const fill = $('gaugeFill');
    const numEl = $('scoreNum');
    const state = $('scoreState');
    const cap = $('scoreCaption');
    const CIRC = 2 * Math.PI * 52; // 326.7
    if (currentScore == null) {
      fill.style.strokeDashoffset = CIRC;
      fill.style.stroke = 'var(--accent)';
      numEl.textContent = '—';
      state.textContent = 'Not scored yet';
      cap.textContent = 'Tailor to a job (or re-score) to see where you stand — every point below 100 comes with its fix.';
      return;
    }
    fill.style.strokeDashoffset = CIRC * (1 - currentScore / 100);
    const col = currentScore >= 80 ? 'var(--ok)' : currentScore >= 60 ? 'var(--warn)' : 'var(--danger)';
    fill.style.stroke = col;
    numEl.textContent = currentScore;
    state.textContent = currentScore >= 80 ? 'Strong' : currentScore >= 60 ? 'Getting there' : 'Needs work';
    const gap = 100 - currentScore;
    cap.textContent = gap === 0
      ? 'Perfect ATS score. This resume is ready to send.'
      : `${gap} point${gap === 1 ? '' : 's'} to a perfect 100 — each one has a fix below.`;
  }

  // ── Fixes list (accept / ignore) ──
  function renderFixes() {
    const list = $('fixesList');
    const empty = $('fixesEmpty');
    const count = $('fixesCount');
    if (!suggestions.length) { list.innerHTML = ''; show(empty); count.textContent = ''; return; }
    hide(empty);
    const open = suggestions.filter((s) => s.state !== 'ignored').length;
    count.textContent = `${suggestions.filter((s) => s.state === 'accepted').length}/${open} applied`;
    list.innerHTML = suggestions.map((s) => `
      <div class="fix ${s.state === 'accepted' ? 'done' : ''}" data-id="${s.id}">
        <span class="fix-sev ${s.severity}" title="${s.severity} priority"></span>
        <div class="fix-body">
          <div class="fix-issue">${esc(s.issue)}</div>
          ${s.fix ? `<div class="fix-fix">${esc(s.fix)}</div>` : ''}
        </div>
        <div class="fix-actions">
          <button class="fix-btn accept ${s.state === 'accepted' ? 'active' : ''}" data-act="accept" data-id="${s.id}">${s.state === 'accepted' ? 'Done' : 'Accept'}</button>
          <button class="fix-btn ignore ${s.state === 'ignored' ? 'active' : ''}" data-act="ignore" data-id="${s.id}">Ignore</button>
        </div>
      </div>`).join('');
    list.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('click', () => toggleFix(b.getAttribute('data-id'), b.getAttribute('data-act')));
    });
  }

  function toggleFix(id, act) {
    const s = suggestions.find((x) => x.id === id); if (!s) return;
    s.state = (s.state === act ? 'open' : act);
    renderFixes();
    // Accepting/ignoring changes intent — recompute score from the backend on change.
    scheduleRescore();
  }
  let rescoreTimer = null;
  function scheduleRescore() {
    clearTimeout(rescoreTimer);
    rescoreTimer = setTimeout(() => { if (currentScore != null) scoreOnly(true); }, 900);
  }

  // ═══════════ TEMPLATES / STYLE ═══════════
  function selectTemplate(t) {
    resume.template = t;
    document.querySelectorAll('.tmpl').forEach((b) => b.classList.toggle('active', b.getAttribute('data-tmpl') === t));
    renderPreview(); markDirty();
  }
  function selectColor(c) {
    resume.color = c;
    document.querySelectorAll('.sw').forEach((b) => b.classList.toggle('active', b.getAttribute('data-color') === c));
    renderPreview(); markDirty();
  }
  function selectFont(f) {
    resume.font = f;
    document.querySelectorAll('#fontSeg button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-font') === f));
    renderPreview(); markDirty();
  }

  // ═══════════ DOWNLOAD ═══════════
  async function download() {
    if (!requireAuth('download')) return;
    const el = $('resumeDoc');
    const name = (resume.name || 'resume').replace(/[^\w]+/g, '_');
    if (window.html2pdf) {
      toast('Building your PDF…');
      try {
        await window.html2pdf().set({
          margin: 0,
          filename: `${name}_Whis-AI.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true },
          jsPDF: { unit: 'pt', format: 'letter', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] }
        }).from(el).save();
        return;
      } catch (e) { /* fall through to print */ }
    }
    // Reliable fallback: browser print-to-PDF via the print stylesheet.
    toast('Use your browser\'s “Save as PDF” in the print dialog.');
    window.print();
  }

  // ═══════════ SAVE / LOAD (account) ═══════════
  async function save() {
    if (!requireAuth('save')) return;
    const btn = $('saveBtn');
    setBtnLoading(btn, 'Saving…');
    const payload = {
      title: (resume.name ? resume.name + ' — ' : '') + (resume.title || 'Resume'),
      resumeText: resumeToText(),
      data: resume,
      score: currentScore
    };
    if (currentResumeId) payload.id = currentResumeId;
    try {
      const r = await fetch(`${BACKEND_URL}/api/resumes`, {
        method: 'POST', headers: headers(), body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error('save ' + r.status);
      const d = await r.json().catch(() => ({}));
      if (d.id) currentResumeId = d.id;
      localStorage.removeItem(DRAFT_KEY);
      flashSaved();
      toast('Saved to your account. It\'ll show on your dashboard.');
    } catch (e) {
      toast('Couldn\'t save right now. Your draft is kept on this device.', true);
      saveDraft();
    } finally { restoreBtn(btn); }
  }

  function flashSaved() {
    const tag = $('savedTag'); show(tag);
    clearTimeout(flashSaved._t);
    flashSaved._t = setTimeout(() => hide(tag), 2600);
  }

  async function openSaved() {
    if (!requireAuth('save')) return;
    openModal('savedModal');
    const list = $('savedList');
    list.innerHTML = '';
    show($('savedSkeleton')); hide($('savedEmpty')); hide($('savedError'));
    try {
      const r = await fetch(`${BACKEND_URL}/api/resumes`, { headers: headers() });
      if (!r.ok) throw new Error('list ' + r.status);
      const d = await r.json();
      const items = Array.isArray(d) ? d : (d.resumes || []);
      hide($('savedSkeleton'));
      if (!items.length) { show($('savedEmpty')); return; }
      list.innerHTML = items.map((it) => `
        <div class="saved-row" data-id="${esc(it.id || it._id || '')}">
          <div class="sr-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/></svg></div>
          <div class="sr-meta">
            <div class="sr-name">${esc(it.title || 'Untitled resume')}</div>
            <div class="sr-sub">${esc(fmtDate(it.updatedAt || it.createdAt))}${it.score != null ? ` · ATS ${it.score}` : ''}</div>
          </div>
          <span class="sr-open">Open</span>
        </div>`).join('');
      list.querySelectorAll('.saved-row').forEach((row) => {
        row.addEventListener('click', () => loadSaved(items.find((x) => String(x.id || x._id) === row.getAttribute('data-id'))));
      });
    } catch (e) {
      hide($('savedSkeleton')); show($('savedError'));
    }
  }

  function loadSaved(item) {
    if (!item) return;
    const data = item.data || item.resume || null;
    if (data && typeof data === 'object') {
      Object.assign(resume, {
        name: '', title: '', email: '', phone: '', location: '', links: '',
        summary: '', experience: [], education: [], skills: ''
      }, data);
    } else if (item.resumeText) {
      parseIntoResume(item.resumeText);
    }
    currentResumeId = item.id || item._id || null;
    currentScore = clampScore(item.score);
    suggestions = [];
    closeModal('savedModal');
    if ($('builderScreen').classList.contains('hidden')) enterBuilder();
    else { hydrateFields(); renderRepeaters(); renderPreview(); renderScore(); renderFixes(); }
    toast('Loaded.');
  }

  // ═══════════ DRAFT PERSISTENCE ═══════════
  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ resume, suggestions, currentScore, currentResumeId })); } catch (e) {}
  }
  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (d && d.resume) {
        Object.assign(resume, d.resume);
        suggestions = d.suggestions || [];
        currentScore = d.currentScore != null ? d.currentScore : null;
        currentResumeId = d.currentResumeId || null;
        return true;
      }
    } catch (e) {}
    return false;
  }
  function markDirty() { hide($('savedTag')); saveDraft(); }

  // ═══════════ MODALS / UTIL ═══════════
  function openModal(id) { $(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeModal(id) { $(id).classList.remove('open'); document.body.style.overflow = ''; }
  function setBtnLoading(btn, txt) { btn._orig = btn.innerHTML; btn.disabled = true; btn.textContent = txt; }
  function restoreBtn(btn) { if (btn._orig) btn.innerHTML = btn._orig; btn.disabled = false; }
  function fmtDate(v) {
    if (!v) return '—';
    const d = new Date(v); if (isNaN(d)) return '—';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ═══════════ WIRING ═══════════
  function wire() {
    // Import cards
    $('importUploadCard').addEventListener('click', () => $('fileInput').click());
    $('fileInput').addEventListener('change', (e) => handleFile(e.target.files && e.target.files[0]));
    $('importPasteCard').addEventListener('click', () => { $('pasteText').value = ''; openModal('pasteModal'); setTimeout(() => $('pasteText').focus(), 60); });
    $('importBlankCard').addEventListener('click', startBlank);
    $('pasteConfirmBtn').addEventListener('click', () => {
      const t = $('pasteText').value.trim();
      if (t.length < 20) { toast('Paste a bit more text to work with.', true); return; }
      parseIntoResume(t); closeModal('pasteModal'); enterBuilder();
    });

    // Drag & drop onto upload card
    const up = $('importUploadCard');
    ['dragover', 'dragenter'].forEach((ev) => up.addEventListener(ev, (e) => { e.preventDefault(); up.style.borderColor = 'var(--accent)'; }));
    ['dragleave', 'drop'].forEach((ev) => up.addEventListener(ev, (e) => { e.preventDefault(); up.style.borderColor = ''; }));
    up.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

    // Simple contact/summary/skills fields → resume
    const map = { fName:'name', fTitle:'title', fEmail:'email', fPhone:'phone', fLocation:'location', fLinks:'links', fSummary:'summary', fSkills:'skills' };
    Object.keys(map).forEach((id) => {
      const el = $(id); if (!el) return;
      el.addEventListener('input', () => { resume[map[id]] = el.value; markDirty(); renderPreview(); });
    });

    // Add repeater rows
    document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
      const kind = b.getAttribute('data-add');
      resume[kind].push(kind === 'experience' ? emptyExp() : emptyEdu());
      markDirty(); renderRepeaters(); renderPreview();
    }));

    // Tailor / score
    $('tailorBtn').addEventListener('click', tailor);
    $('scoreOnlyBtn').addEventListener('click', () => scoreOnly(false));

    // Templates / style
    document.querySelectorAll('.tmpl').forEach((b) => b.addEventListener('click', () => selectTemplate(b.getAttribute('data-tmpl'))));
    document.querySelectorAll('.sw').forEach((b) => b.addEventListener('click', () => selectColor(b.getAttribute('data-color'))));
    document.querySelectorAll('#fontSeg button').forEach((b) => b.addEventListener('click', () => selectFont(b.getAttribute('data-font'))));

    // Save / load / download
    $('saveBtn').addEventListener('click', save);
    $('downloadBtn').addEventListener('click', download);
    $('loadSavedBtn').addEventListener('click', openSaved);
    $('savedRetry').addEventListener('click', openSaved);
    $('backToStart').addEventListener('click', backToStart);

    // Mobile edit/preview tabs
    $('builderTabs').addEventListener('click', (e) => {
      const t = e.target.closest('.bt-tab'); if (!t) return;
      document.querySelectorAll('.bt-tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      const pane = t.getAttribute('data-pane');
      $('editorPane').setAttribute('data-hidden', pane !== 'edit');
      $('rightPane').setAttribute('data-hidden', pane !== 'preview');
    });

    // Auth
    $('topLogout').addEventListener('click', logout);
    $('topSignInBtn').addEventListener('click', () => { gateAfter = null; $('gateAction').textContent = 'save'; requireAuth('save'); });

    // Modal close + escape
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeModal(b.getAttribute('data-close'))));
    document.querySelectorAll('.modal-overlay').forEach((ov) => ov.addEventListener('click', (e) => { if (e.target === ov) closeModal(ov.id); }));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach((m) => closeModal(m.id)); });
  }

  // Sync active template/color/font chips to state (used after loads)
  function syncStyleChips() {
    document.querySelectorAll('.tmpl').forEach((b) => b.classList.toggle('active', b.getAttribute('data-tmpl') === resume.template));
    document.querySelectorAll('.sw').forEach((b) => b.classList.toggle('active', b.getAttribute('data-color') === resume.color));
    document.querySelectorAll('#fontSeg button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-font') === resume.font));
  }

  // ═══════════ BOOT ═══════════
  function boot() {
    consumeAuthRedirect();
    currentUser = readUser();
    renderAuthUI();
    wire();

    // Restore any in-progress draft (e.g. after a sign-in round-trip).
    const hadDraft = loadDraft();
    if (hadDraft && (resume.name || resume.summary || resume.experience.length || resume.skills)) {
      syncStyleChips();
      enterBuilder();
    }

    // Resume a gated action after returning signed in.
    if (currentUser && gateAfter) { const a = gateAfter; gateAfter = null; if (a === 'save') save(); else if (a === 'download') download(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
