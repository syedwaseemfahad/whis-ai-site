/* ═══════════════════════════════════════════════════════════════
   Whis-AI — Free Mock Interview (lead magnet)
   Flow: Setup → ask-aloud (TTS) → answer (mic + STT) → coach → loop
         → save the whole mock to the dashboard (/api/sessions).
   Live backend (deployed): /api/mock/next-question drives the questions
   and /api/mock/draft-answer drives the model answer + coaching; the
   finished mock is saved via /api/sessions*. A tiny local question/answer
   bank is kept only as a silent safety net if a call ever fails.
   TTS/STT are feature-detected and fall back to text so the page works
   on Safari/Firefox too.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const BACKEND_URL = 'https://api.whis-ai.com';
  const MAX_QUESTIONS = 7;        // 5–8 questions per mock
  const MIN_QUESTIONS = 5;

  // ── DOM helpers ──
  const $ = (id) => document.getElementById(id);
  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── State ──
  let currentUser = null;
  let GOOGLE_CLIENT_ID = null;
  const config = { role: '', company: '', language: 'en', resumeText: '' };
  let history = [];          // [{ question, answer, model, note }]
  let currentQuestion = '';
  let qNumber = 0;
  let startedAt = 0;
  let sessionId = null;

  // Speech
  let recognition = null;
  let sttSupported = false;
  let ttsSupported = ('speechSynthesis' in window);
  let recording = false;
  let finalTranscript = '';
  let interimTranscript = '';

  const LANG_TAGS = { en: 'en-US', hi: 'hi-IN', te: 'te-IN', es: 'es-ES', fr: 'fr-FR', de: 'de-DE' };

  // ═══════════ AUTH ═══════════
  function readUser() {
    try {
      const s = localStorage.getItem('whisUser');
      if (!s) return null;
      const u = JSON.parse(s);
      return (u && u.googleId) ? u : null;
    } catch (e) { localStorage.removeItem('whisUser'); return null; }
  }

  function consumeAuthRedirect() {
    const p = new URLSearchParams(location.search);
    if (p.get('auth_success') === 'true' && p.get('user')) {
      try { localStorage.setItem('whisUser', decodeURIComponent(p.get('user'))); } catch (e) {}
      history.length = 0;
      // Restore any mock we saved before bouncing to Google.
      restorePendingMock();
      const clean = location.pathname + (p.get('resume') ? '?resume=1' : '');
      window.history.replaceState({}, document.title, clean);
    }
  }

  function headers() {
    const h = { 'Content-Type': 'application/json' };
    if (currentUser && currentUser.googleId) h['x-google-id'] = currentUser.googleId;
    return h;
  }

  async function fetchGoogleClientId() {
    try {
      const r = await fetch(`${BACKEND_URL}/api/config`);
      if (r.ok) { const d = await r.json(); GOOGLE_CLIENT_ID = d.googleClientId || null; }
    } catch (e) { /* offline — button still routes */ }
  }

  function buildGoogleAuthUrl() {
    const ret = location.origin + '/mock-interview.html';
    const redirectUri = encodeURIComponent(`${BACKEND_URL}/api/auth/google/callback`);
    const source = localStorage.getItem('whisSource') || 'organic';
    const ref = localStorage.getItem('whisRef') || '';
    const aid = localStorage.getItem('whisVisitorId') || '';
    const state = encodeURIComponent(JSON.stringify({ s: source, r: ref, a: aid, ret }));
    const cid = GOOGLE_CLIENT_ID || '';
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${cid}` +
      `&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile&state=${state}&ret=${encodeURIComponent(ret)}`;
  }

  // Persist the mock across the OAuth round-trip so nothing is lost on sign-in.
  function stashPendingMock() {
    try {
      localStorage.setItem('whisMockPending', JSON.stringify({
        config, history, savedAt: Date.now()
      }));
    } catch (e) {}
  }
  function restorePendingMock() {
    try {
      const raw = localStorage.getItem('whisMockPending');
      if (!raw) return false;
      const d = JSON.parse(raw);
      // Only restore recent mocks (within 30 min).
      if (!d || (Date.now() - (d.savedAt || 0)) > 30 * 60 * 1000) { localStorage.removeItem('whisMockPending'); return false; }
      Object.assign(config, d.config || {});
      history = Array.isArray(d.history) ? d.history : [];
      return history.length > 0;
    } catch (e) { return false; }
  }
  function clearPendingMock() { try { localStorage.removeItem('whisMockPending'); } catch (e) {} }

  // ═══════════ TOAST ═══════════
  function toast(msg, isErr) {
    const t = $('toast');
    $('toastMsg').textContent = msg;
    t.classList.toggle('err', !!isErr);
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 3200);
  }

  // ═══════════ STAGES ═══════════
  function goStage(name) {
    document.querySelectorAll('.stage').forEach((s) => s.classList.remove('active'));
    const el = $('stage-' + name);
    if (el) el.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ═══════════ SETUP: saved resumes ═══════════
  async function loadSavedResumes() {
    const sel = $('fSavedResume');
    if (!currentUser) return; // only for signed-in users
    try {
      const r = await fetch(`${BACKEND_URL}/api/resumes`, { headers: headers() });
      if (!r.ok) return;
      const d = await r.json();
      const list = Array.isArray(d) ? d : (d.resumes || []);
      if (!list.length) return;
      list.forEach((res) => {
        const opt = document.createElement('option');
        opt.value = res.id || res._id || res.resumeId || '';
        opt.textContent = res.name || res.title || 'Saved resume';
        // Stash the text if the list already carries it.
        if (res.text || res.content) opt.dataset.text = res.text || res.content;
        sel.appendChild(opt);
      });
    } catch (e) { /* network hiccup — paste/upload still works */ }
  }

  async function resolveSavedResumeText(id) {
    // Prefer text already attached to the option.
    const opt = $('fSavedResume').selectedOptions[0];
    if (opt && opt.dataset.text) return opt.dataset.text;
    if (!id) return '';
    try {
      const r = await fetch(`${BACKEND_URL}/api/resumes/${encodeURIComponent(id)}`, { headers: headers() });
      if (!r.ok) return '';
      const d = await r.json();
      const res = d.resume || d;
      return res.text || res.content || '';
    } catch (e) { return ''; }
  }

  // ── Resume file upload (PDF/text). PDF parsed via pdf.js if reachable; else prompt to paste. ──
  function wireResumeUpload() {
    const drop = $('resumeDrop');
    const fileInput = $('resumeFile');
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault(); drop.classList.remove('drag');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleResumeFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleResumeFile(fileInput.files[0]); });
  }

  async function handleResumeFile(file) {
    const nameEl = $('resumeFileName');
    nameEl.textContent = `Loading ${file.name}…`;
    nameEl.classList.add('show');
    try {
      let text = '';
      if (/\.txt$/i.test(file.name) || file.type === 'text/plain') {
        text = await file.text();
      } else if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
        text = await extractPdfText(file);
      } else {
        // .doc/.docx — can't parse client-side reliably; ask user to paste.
        nameEl.textContent = `${file.name} added — please paste the text below if questions seem generic.`;
        return;
      }
      if (text && text.trim()) {
        $('fResume').value = text.trim().slice(0, 20000);
        nameEl.textContent = `${file.name} — loaded ✓`;
      } else {
        nameEl.textContent = `Couldn't read ${file.name}. Please paste the text below.`;
      }
    } catch (e) {
      nameEl.textContent = `Couldn't read ${file.name}. Please paste the text below.`;
    }
  }

  // Lazy-load pdf.js from CDN only when a PDF is dropped.
  let pdfLibPromise = null;
  function loadPdfLib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfLibPromise) return pdfLibPromise;
    pdfLibPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = () => {
        try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; } catch (e) {}
        resolve(window.pdfjsLib);
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return pdfLibPromise;
  }

  async function extractPdfText(file) {
    const lib = await loadPdfLib();
    const buf = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: buf }).promise;
    let out = '';
    const pages = Math.min(pdf.numPages, 8);
    for (let i = 1; i <= pages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      out += content.items.map((it) => it.str).join(' ') + '\n';
    }
    return out;
  }

  // ═══════════ START MOCK ═══════════
  async function startMock() {
    const role = $('fRole').value.trim();
    const company = $('fCompany').value.trim();
    const language = $('fLanguage').value;
    let resumeText = $('fResume').value.trim();

    const err = $('setupError');
    hide(err);
    if (!role) { err.textContent = 'Add the role you\'re interviewing for so questions stay on-target.'; show(err); $('fRole').focus(); return; }

    const startBtn = $('startBtn');
    startBtn.disabled = true;
    const orig = startBtn.innerHTML;
    startBtn.innerHTML = 'Preparing…';

    // Resolve a picked saved resume if the paste box is empty.
    const savedId = $('fSavedResume').value;
    if (!resumeText && savedId) resumeText = await resolveSavedResumeText(savedId);

    Object.assign(config, { role, company, language, resumeText });
    history = [];
    qNumber = 0;
    startedAt = Date.now();
    sessionId = null;

    $('ivRole').textContent = role;
    $('ivCompany').textContent = company ? `at ${company}` : '';

    startBtn.disabled = false;
    startBtn.innerHTML = orig;

    goStage('interview');
    await nextQuestion();
  }

  // ═══════════ QUESTION LOOP ═══════════
  function updateProgress() {
    $('ivCount').textContent = `Question ${qNumber} of ~${MAX_QUESTIONS}`;
    const pct = Math.min(100, Math.round((qNumber / MAX_QUESTIONS) * 100));
    $('ivBarFill').style.width = pct + '%';
  }

  async function nextQuestion() {
    qNumber++;
    updateProgress();

    // Reset answer + coaching UI
    hide($('coachCard'));
    show($('answerCard'));
    resetAnswerUI();

    // Loading state on the question card
    const qText = $('qText');
    qText.innerHTML = '<span class="q-skeleton"></span><span class="q-skeleton short"></span>';
    setQState('preparing', 'Thinking of a good question…');
    $('replayBtn').disabled = true;

    let question = '';
    try {
      const r = await fetch(`${BACKEND_URL}/api/mock/next-question`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          role: config.role, company: config.company, resumeText: config.resumeText,
          language: config.language, history: history.map((h) => ({ question: h.question, answer: h.answer }))
        })
      });
      if (r.ok) {
        const d = await r.json();
        question = d.question || d.text || d.next || '';
      }
    } catch (e) { /* fall through to local fallback */ }

    if (!question) question = fallbackQuestion(qNumber);

    currentQuestion = question;
    qText.textContent = question;
    speakQuestion(question);
  }

  // Silent safety net — only used if a live /api/mock/next-question call fails.
  function fallbackQuestion(n) {
    const role = config.role || 'this role';
    const bank = [
      `To start, walk me through your background and what draws you to ${role}.`,
      `Tell me about a project you're proud of. What was your specific contribution?`,
      `Describe a time you faced a hard technical or work problem. How did you approach it?`,
      `Tell me about a disagreement with a teammate and how you resolved it.`,
      `What's a mistake you made recently, and what did you change afterward?`,
      `Where do you want to grow in the next year, and why ${config.company || 'here'}?`,
      `Do you have any questions for me about the team or the role?`
    ];
    return bank[(n - 1) % bank.length];
  }

  function setQState(kind, text) {
    const el = $('qState');
    el.classList.toggle('speaking', kind === 'speaking');
    if (kind === 'speaking') {
      el.innerHTML = `<span class="wave"><i></i><i></i><i></i><i></i></span> ${esc(text)}`;
    } else {
      el.textContent = text;
    }
  }

  // ═══════════ TTS — ask the question aloud ═══════════
  let cachedVoice = null;
  function pickVoice() {
    if (!ttsSupported) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;
    const tag = (LANG_TAGS[config.language] || 'en-US').toLowerCase();
    const langPrefix = tag.split('-')[0];
    // Prefer a natural/local voice matching the language.
    const score = (v) => {
      let s = 0;
      const vl = (v.lang || '').toLowerCase();
      if (vl === tag) s += 5; else if (vl.split('-')[0] === langPrefix) s += 3;
      if (/natural|neural|google|premium|enhanced|siri/i.test(v.name)) s += 2;
      if (v.localService) s += 1;
      return s;
    };
    return voices.slice().sort((a, b) => score(b) - score(a))[0] || voices[0];
  }

  function speakQuestion(text) {
    if (!ttsSupported) {
      setQState('idle', 'Read the question, then answer when ready.');
      $('replayBtn').disabled = true;
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = cachedVoice || (cachedVoice = pickVoice());
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = LANG_TAGS[config.language] || 'en-US'; }
      u.rate = 1.0; u.pitch = 1.0;
      u.onstart = () => setQState('speaking', 'Asking…');
      u.onend = () => { setQState('idle', 'Your turn — press Start answering.'); $('replayBtn').disabled = false; };
      u.onerror = () => { setQState('idle', 'Your turn — press Start answering.'); $('replayBtn').disabled = false; };
      window.speechSynthesis.speak(u);
      $('replayBtn').disabled = false;
    } catch (e) {
      setQState('idle', 'Your turn — press Start answering.');
      $('replayBtn').disabled = false;
    }
  }

  function replayQuestion() { if (currentQuestion) speakQuestion(currentQuestion); }

  // ═══════════ STT — capture the spoken answer ═══════════
  function initSTT() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { sttSupported = false; return; }
    sttSupported = true;
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = LANG_TAGS[config.language] || 'en-US';

    recognition.onresult = (e) => {
      interimTranscript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += t + ' ';
        else interimTranscript += t;
      }
      renderLiveTranscript();
    };
    recognition.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        $('ansHint').textContent = 'Mic blocked — allow microphone access, or type your answer below.';
        fallbackToTyped();
      } else if (e.error === 'no-speech') {
        $('ansHint').textContent = 'Didn\'t catch that — try speaking again.';
      }
    };
    recognition.onend = () => {
      // Chrome sometimes stops on its own; restart if the user is still recording.
      if (recording) { try { recognition.start(); } catch (e) {} }
    };
  }

  function renderLiveTranscript() {
    const el = $('ansTranscript');
    el.innerHTML = esc(finalTranscript) + (interimTranscript ? `<span class="interim">${esc(interimTranscript)}</span>` : '');
    $('submitAnswerBtn').disabled = !(finalTranscript.trim() || interimTranscript.trim());
  }

  function resetAnswerUI() {
    finalTranscript = ''; interimTranscript = '';
    recording = false;
    const el = $('ansTranscript');
    el.innerHTML = '';
    $('ansTyped').value = '';
    $('ansHint').textContent = '';
    setMic(false);
    const rb = $('recordBtn');
    rb.classList.remove('recording');
    $('recordBtnText').textContent = 'Start answering';
    $('submitAnswerBtn').disabled = true;
    // Choose the right input surface.
    if (sttSupported) { show($('ansTranscript')); hide($('ansTyped')); show(rb); }
    else { fallbackToTyped(); }
  }

  function fallbackToTyped() {
    hide($('ansTranscript'));
    show($('ansTyped'));
    hide($('recordBtn'));
    $('submitAnswerBtn').disabled = false;
    $('ansTyped').addEventListener('input', () => {
      $('submitAnswerBtn').disabled = !$('ansTyped').value.trim();
    }, { once: false });
    if (!$('ansHint').textContent) $('ansHint').textContent = 'Speech recognition isn\'t available here — type your answer, then submit.';
  }

  function setMic(live) {
    const b = $('micBadge');
    b.classList.toggle('live', live);
    $('micBadgeText').textContent = live ? 'Listening…' : 'Idle';
  }

  async function toggleRecord() {
    if (!sttSupported) return;
    if (recording) { stopRecording(); return; }
    // Ask for mic permission explicitly for a clearer UX; SpeechRecognition also prompts.
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop()); // we only needed the permission grant
      }
    } catch (e) {
      $('ansHint').textContent = 'Microphone access is needed to answer aloud — or type your answer below.';
      fallbackToTyped();
      return;
    }
    // Stop the interviewer voice before we listen.
    if (ttsSupported) window.speechSynthesis.cancel();
    startRecording();
  }

  function startRecording() {
    recording = true;
    setMic(true);
    const rb = $('recordBtn');
    rb.classList.add('recording');
    $('recordBtnText').textContent = 'Stop';
    $('ansHint').textContent = 'Listening — speak naturally. Press Stop when you\'re done.';
    try { recognition.lang = LANG_TAGS[config.language] || 'en-US'; recognition.start(); }
    catch (e) { /* already started */ }
  }

  function stopRecording() {
    recording = false;
    setMic(false);
    const rb = $('recordBtn');
    rb.classList.remove('recording');
    $('recordBtnText').textContent = finalTranscript.trim() ? 'Answer again' : 'Start answering';
    try { recognition.stop(); } catch (e) {}
    $('ansHint').textContent = finalTranscript.trim() ? 'Looks good — submit to get coaching, or answer again to redo.' : '';
  }

  function currentAnswerText() {
    if (sttSupported) return (finalTranscript + ' ' + interimTranscript).trim();
    return $('ansTyped').value.trim();
  }

  // ═══════════ SUBMIT ANSWER → COACHING ═══════════
  async function submitAnswer() {
    const answer = currentAnswerText();
    if (!answer) { $('ansHint').textContent = 'Add an answer first — speak or type a response.'; return; }
    if (recording) stopRecording();
    if (ttsSupported) window.speechSynthesis.cancel();

    hide($('answerCard'));
    show($('coachCard'));
    $('coachYours').textContent = answer;
    $('coachModel').innerHTML = '<span class="q-skeleton"></span><span class="q-skeleton"></span><span class="q-skeleton short"></span>';
    const noteEl = $('coachNote');
    hide(noteEl);
    // Hold the Next/Finish actions until the coaching lands, so the loop feels deliberate.
    const actions = $('coachCard').querySelector('.coach-actions');
    if (actions) actions.classList.add('hidden');

    let model = '', note = '';
    try {
      const r = await fetch(`${BACKEND_URL}/api/mock/draft-answer`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          question: currentQuestion, answer, resumeText: config.resumeText,
          role: config.role, company: config.company, language: config.language
        })
      });
      if (r.ok) {
        const d = await r.json();
        model = d.model || d.answer || d.draft || d.text || '';
        note = d.note || d.feedback || d.improve || '';
      }
    } catch (e) { /* fall through */ }

    if (!model) {
      model = 'A strong answer uses the STAR shape: briefly set the Situation and Task, spend most of your time on the specific Actions you took, then close with a measurable Result. Tie it back to what this role needs.';
      note = note || 'Add one concrete number or outcome, and keep it under about 90 seconds.';
    }

    $('coachModel').textContent = model;
    if (note) { noteEl.innerHTML = `<strong>To improve:</strong> ${esc(note)}`; show(noteEl); }

    history.push({ question: currentQuestion, answer, model, note });

    if (actions) actions.classList.remove('hidden');

    // Toggle finish vs next based on how far along we are.
    $('finishBtn').classList.toggle('hidden', history.length < MIN_QUESTIONS && history.length < MAX_QUESTIONS);
    if (history.length >= MAX_QUESTIONS) {
      $('nextBtn').classList.add('hidden');
      $('finishBtn').classList.remove('hidden');
    } else {
      $('nextBtn').classList.remove('hidden');
    }
  }

  // ═══════════ END / SUMMARY / SAVE ═══════════
  async function finishMock() {
    if (recording) stopRecording();
    if (ttsSupported) window.speechSynthesis.cancel();
    renderSummary();
    goStage('summary');
    saveMock();
  }

  function renderSummary() {
    $('sumCount').textContent = String(history.length);
    const list = $('reviewList');
    if (!history.length) {
      list.innerHTML = '<div class="rev-item"><div class="rev-q">No answers recorded this time — run another mock to practice.</div></div>';
      return;
    }
    list.innerHTML = history.map((h, i) => `
      <div class="rev-item">
        <div class="rev-q"><span class="num">${i + 1}</span><span>${esc(h.question)}</span></div>
        <div class="rev-cols">
          <div class="rev-block">
            <div class="rb-label">Your answer</div>
            <div class="rb-text">${esc(h.answer || '(no answer)')}</div>
          </div>
          <div class="rev-block model">
            <div class="rb-label">Strong model answer</div>
            <div class="rb-text">${esc(h.model || '')}</div>
          </div>
        </div>
        ${h.note ? `<div class="rev-note"><strong>To improve:</strong> ${esc(h.note)}</div>` : ''}
      </div>`).join('');
  }

  async function saveMock() {
    const saveEl = $('saveState');
    if (!currentUser) {
      // Gate saving behind sign-in — but the mock itself already ran for free.
      saveEl.className = 'save-state warn';
      saveEl.innerHTML = 'Sign in to save this mock to your dashboard so you can review it later. ';
      const a = document.createElement('a');
      a.href = '#'; a.textContent = 'Sign in';
      a.addEventListener('click', (e) => { e.preventDefault(); openSignIn(); });
      saveEl.appendChild(a);
      return;
    }

    saveEl.className = 'save-state';
    saveEl.textContent = 'Saving to your dashboard…';

    try {
      // 1) Create the session (mode:'mock').
      const cr = await fetch(`${BACKEND_URL}/api/sessions`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ mode: 'mock', company: config.company, role: config.role, language: config.language })
      });
      if (!cr.ok) throw new Error('create ' + cr.status);
      const cd = await cr.json();
      sessionId = cd.sessionId || cd.id || '';
      if (!sessionId) throw new Error('no session id');

      // 2) Append the transcript. Interviewer question + your answer as alternating turns.
      const t0 = startedAt || Date.now();
      const entries = [];
      history.forEach((h) => {
        entries.push({ ts: Date.now() - t0, speaker: 'interviewer', text: h.question });
        if (h.answer) entries.push({ ts: Date.now() - t0, speaker: 'you', text: h.answer });
        // Fold the model answer in as an interviewer note so it's reviewable on the dashboard.
        if (h.model) entries.push({ ts: Date.now() - t0, speaker: 'interviewer', text: `[Model answer] ${h.model}${h.note ? `\n[To improve] ${h.note}` : ''}` });
      });
      if (entries.length) {
        await fetch(`${BACKEND_URL}/api/sessions/${encodeURIComponent(sessionId)}/transcript`, {
          method: 'POST', headers: headers(), body: JSON.stringify({ entries })
        });
      }

      // 3) End the session with a duration.
      const durationSec = Math.max(0, Math.round((Date.now() - t0) / 1000));
      await fetch(`${BACKEND_URL}/api/sessions/${encodeURIComponent(sessionId)}/end`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ durationSec })
      });

      clearPendingMock();
      saveEl.className = 'save-state ok';
      saveEl.innerHTML = 'Saved to your dashboard. ';
      const a = document.createElement('a');
      a.href = '/dashboard.html'; a.textContent = 'View it there →';
      saveEl.appendChild(a);
    } catch (e) {
      saveEl.className = 'save-state warn';
      saveEl.textContent = 'Couldn\'t save to the dashboard right now — your review below is still here.';
    }
  }

  // ═══════════ SIGN-IN MODAL ═══════════
  function openSignIn() {
    stashPendingMock(); // so we come back to a finished mock and can save it
    const btn = $('modalGoogleBtn');
    btn.href = buildGoogleAuthUrl();
    fetchGoogleClientId().then(() => { btn.href = buildGoogleAuthUrl(); });
    $('signInModal').classList.add('open');
  }
  function closeModal(id) { $(id).classList.remove('open'); }

  // ═══════════ WIRING ═══════════
  function wire() {
    $('startBtn').addEventListener('click', startMock);
    $('replayBtn').addEventListener('click', replayQuestion);
    $('recordBtn').addEventListener('click', toggleRecord);
    $('submitAnswerBtn').addEventListener('click', submitAnswer);
    $('nextBtn').addEventListener('click', nextQuestion);
    $('finishBtn').addEventListener('click', finishMock);
    $('endBtn').addEventListener('click', finishMock);
    $('restartBtn').addEventListener('click', () => { history = []; goStage('setup'); });

    // Typed fallback keeps submit enabled state fresh.
    $('ansTyped').addEventListener('input', () => {
      if (!sttSupported) $('submitAnswerBtn').disabled = !$('ansTyped').value.trim();
    });

    // Modal close + overlay + escape
    document.querySelectorAll('[data-close]').forEach((b) =>
      b.addEventListener('click', () => closeModal(b.getAttribute('data-close'))));
    document.querySelectorAll('.modal-overlay').forEach((ov) =>
      ov.addEventListener('click', (e) => { if (e.target === ov) closeModal(ov.id); }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach((m) => closeModal(m.id));
    });

    wireResumeUpload();

    // Warn before leaving mid-mock.
    window.addEventListener('beforeunload', (e) => {
      if ($('stage-interview').classList.contains('active') && history.length >= 0 && qNumber > 0) {
        e.preventDefault(); e.returnValue = '';
      }
    });
  }

  // ═══════════ BOOT ═══════════
  function boot() {
    consumeAuthRedirect();
    currentUser = readUser();

    // Feature detection
    initSTT();
    if (!ttsSupported || !sttSupported) {
      const notes = [];
      if (!sttSupported) notes.push('Your browser doesn\'t support speech-to-text, so you\'ll type answers (works everywhere).');
      if (!ttsSupported) notes.push('Spoken questions aren\'t supported here, so questions show as text.');
      const el = $('capNoteText');
      if (el) el.textContent = notes.join(' ') + ' Sign in to save this mock to your dashboard — optional to start.';
    }

    // Warm up voices (Chrome loads them async).
    if (ttsSupported) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => { cachedVoice = null; };
    }

    wire();
    loadSavedResumes();

    // If we came back from sign-in with a stashed finished mock, jump to the summary and save it.
    if (currentUser && history.length > 0) {
      $('ivRole').textContent = config.role || 'Mock interview';
      $('ivCompany').textContent = config.company ? `at ${config.company}` : '';
      renderSummary();
      goStage('summary');
      saveMock();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
