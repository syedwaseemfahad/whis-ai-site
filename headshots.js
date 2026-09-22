/* ═══════════════════════════════════════════════════════════════
   Whis-AI — Studio Headshots (Prepare lead magnet)
   Flow: upload one photo → pick a style → generate.
   Since there's no image-gen backend yet, "Generate" tries the API
   and degrades GRACEFULLY: if the endpoint is missing (404/501) or
   unreachable, it opens a polished "early-access" flow that captures
   the user's email (or Google sign-in) and gives a clear ETA — so the
   button never feels broken. Every network call is guarded.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const BACKEND_URL = 'https://api.whis-ai.com';
  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

  // ── DOM helpers ──
  const $ = (id) => document.getElementById(id);
  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── Styles ──
  const STYLES = {
    corporate: { name: 'Corporate', grad: 'g-corporate' },
    linkedin:  { name: 'LinkedIn',  grad: 'g-linkedin'  },
    startup:   { name: 'Startup',   grad: 'g-startup'   },
    executive: { name: 'Executive', grad: 'g-executive' },
    outdoor:   { name: 'Outdoor',   grad: 'g-outdoor'   },
    creative:  { name: 'Creative',  grad: 'g-creative'  },
  };

  // ── State ──
  let currentUser = null;
  let GOOGLE_CLIENT_ID = null;
  let photoDataUrl = null;   // base64 preview
  let photoName = '';
  let selectedStyle = 'corporate';

  // ═══════════ AUTH (mirrors dashboard.js / mock-interview.js) ═══════════
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
      window.history.replaceState({}, document.title, location.pathname);
      // If we bounced to Google mid-reserve, finish the reservation.
      restorePending();
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
    const ret = location.origin + '/headshots.html';
    const redirectUri = encodeURIComponent(`${BACKEND_URL}/api/auth/google/callback`);
    const source = localStorage.getItem('whisSource') || 'organic';
    const ref = localStorage.getItem('whisRef') || '';
    const aid = localStorage.getItem('whisVisitorId') || '';
    const state = encodeURIComponent(JSON.stringify({ s: source, r: ref, a: aid, ret }));
    const cid = GOOGLE_CLIENT_ID || '';
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${cid}` +
      `&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile&state=${state}&ret=${encodeURIComponent(ret)}`;
  }

  // Persist selection across the OAuth round-trip so nothing is lost on sign-in.
  function stashPending() {
    try {
      localStorage.setItem('whisHeadshotPending', JSON.stringify({
        style: selectedStyle, photoName, savedAt: Date.now()
      }));
    } catch (e) {}
  }
  function restorePending() {
    try {
      const raw = localStorage.getItem('whisHeadshotPending');
      if (!raw) return;
      const d = JSON.parse(raw);
      localStorage.removeItem('whisHeadshotPending');
      if (!d || (Date.now() - (d.savedAt || 0)) > 30 * 60 * 1000) return;
      if (d.style && STYLES[d.style]) selectStyle(d.style);
      // Signed back in — auto-reserve with the account email.
      if (currentUser) {
        openEarlyModal();
        finishReservation(currentUser.email || '', 'google');
      }
    } catch (e) {}
  }

  // ═══════════ TOAST ═══════════
  function toast(msg, isErr) {
    const t = $('toast');
    $('toastMsg').textContent = msg;
    t.classList.toggle('err', !!isErr);
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 3200);
  }

  // ═══════════ UPLOAD ═══════════
  function handleFile(file) {
    hide($('uploadError'));
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      return uploadError('Please choose a PNG, JPG or WebP image.');
    }
    if (file.size > MAX_BYTES) {
      return uploadError('That image is over 10 MB. Try a smaller one.');
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      photoDataUrl = e.target.result;
      photoName = file.name || 'photo.jpg';
      renderUploaded();
      renderPreview();
    };
    reader.onerror = () => uploadError("Couldn't read that file. Try another image.");
    reader.readAsDataURL(file);
  }

  function uploadError(msg) {
    const el = $('uploadError');
    el.textContent = msg;
    show(el);
  }

  function renderUploaded() {
    $('thumb').src = photoDataUrl;
    $('fileName').textContent = photoName;
    hide($('dropInner'));
    show($('dropPreview'));
  }

  // ═══════════ STYLE ═══════════
  function selectStyle(key) {
    if (!STYLES[key]) return;
    selectedStyle = key;
    document.querySelectorAll('.style-card').forEach((c) => {
      const on = c.dataset.style === key;
      c.classList.toggle('selected', on);
      c.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    $('pvStyleTag').textContent = STYLES[key].name;
    renderPreview();
  }

  function applyBackdrop(el, gradClass) {
    if (!el) return;
    Object.values(STYLES).forEach((s) => el.classList.remove(s.grad));
    el.classList.add(gradClass);
  }

  // ═══════════ PREVIEW ═══════════
  function renderPreview() {
    const grad = STYLES[selectedStyle].grad;
    if (photoDataUrl) {
      hide($('pvEmpty'));
      show($('pvShot'));
      $('pvImg').src = photoDataUrl;
      applyBackdrop($('pvBackdrop'), grad);
    } else {
      show($('pvEmpty'));
      hide($('pvShot'));
    }
  }

  // ═══════════ GENERATE (graceful degrade) ═══════════
  async function generate() {
    hide($('uploadError'));
    if (!photoDataUrl) {
      uploadError('Upload a photo first — one clear selfie is all it takes.');
      $('drop').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const btn = $('generateBtn');
    btn.classList.add('loading');
    btn.disabled = true;
    startScan();

    let handled = false;
    try {
      const r = await fetch(`${BACKEND_URL}/api/headshots/generate`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ style: selectedStyle, photo: photoDataUrl, filename: photoName }),
      });

      if (r.ok) {
        // Real backend exists and produced results.
        const data = await r.json().catch(() => ({}));
        renderResults(data);
        handled = true;
      } else if (r.status === 404 || r.status === 501 || r.status === 503) {
        // Backend not built yet — this is the expected path today.
        openEarlyModal();
        handled = true;
      } else if (r.status === 401 || r.status === 403) {
        // Needs auth — early-access flow captures identity anyway.
        openEarlyModal();
        handled = true;
      }
    } catch (e) {
      /* network/CORS/offline — fall through to early access */
    } finally {
      stopScan();
      btn.classList.remove('loading');
      btn.disabled = false;
    }

    if (!handled) openEarlyModal();
  }

  function startScan() { show($('pvScan')); if ($('pvBadge')) $('pvBadge').textContent = 'Rendering…'; }
  function stopScan()  { hide($('pvScan')); if ($('pvBadge')) $('pvBadge').textContent = 'Preview'; }

  // If a real backend ever returns images, show them in the thumb strip.
  function renderResults(data) {
    const imgs = (data && Array.isArray(data.images)) ? data.images : [];
    if (!imgs.length) { openEarlyModal(); return; }
    const wrap = $('pvThumbs');
    wrap.innerHTML = '';
    imgs.slice(0, 4).forEach((src) => {
      const d = document.createElement('div');
      d.className = 'pv-thumb';
      const im = document.createElement('img');
      im.src = src; im.alt = 'Generated headshot';
      d.appendChild(im);
      wrap.appendChild(d);
    });
    if (imgs[0]) $('pvImg').src = imgs[0];
    toast('Your headshots are ready.');
  }

  // ═══════════ EARLY-ACCESS MODAL ═══════════
  function openEarlyModal() {
    const st = STYLES[selectedStyle];
    $('eaImg').src = photoDataUrl || '';
    applyBackdrop($('eaBackdrop'), st.grad);
    $('eaStyle').textContent = st.name + ' style';
    // reset to form view
    hide($('eaDone'));
    show($('eaForm'));
    hide($('eaError'));
    if (currentUser && currentUser.email) $('eaEmail').value = currentUser.email;
    $('earlyModal').classList.add('open');
    setTimeout(() => { try { $('eaEmail').focus(); } catch (e) {} }, 120);
  }

  function closeModal() { $('earlyModal').classList.remove('open'); }

  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  async function submitEmail() {
    const email = ($('eaEmail').value || '').trim();
    hide($('eaError'));
    if (!validEmail(email)) {
      const e = $('eaError'); e.textContent = 'Enter a valid email so we can send your headshots.'; show(e);
      return;
    }
    const btn = $('eaSubmit');
    btn.classList.add('loading'); btn.disabled = true;
    await joinWaitlist(email, 'email');
    btn.classList.remove('loading'); btn.disabled = false;
    finishReservation(email, 'email');
  }

  // Best-effort waitlist POST; store locally regardless so nothing is lost.
  async function joinWaitlist(email, method) {
    const payload = {
      email, style: selectedStyle, method,
      hasPhoto: !!photoDataUrl,
      source: localStorage.getItem('whisSource') || 'organic',
      ref: localStorage.getItem('whisRef') || '',
      ts: Date.now(),
    };
    // Local record first — guarantees we never drop a lead.
    try {
      const list = JSON.parse(localStorage.getItem('whisHeadshotWaitlist') || '[]');
      list.push(payload);
      localStorage.setItem('whisHeadshotWaitlist', JSON.stringify(list));
    } catch (e) {}
    // Then try the server, best-effort.
    try {
      await fetch(`${BACKEND_URL}/api/headshots/waitlist`, {
        method: 'POST', headers: headers(), body: JSON.stringify(payload),
      });
    } catch (e) { /* offline — local copy already saved */ }
  }

  function finishReservation(email, method) {
    const st = STYLES[selectedStyle];
    $('eaDoneEmail').textContent = email || 'your inbox';
    $('eaDoneSub').innerHTML =
      `We'll email your <strong>${esc(st.name)}</strong> headshots to <strong>${esc(email || 'your inbox')}</strong>. Most sets land within 24 hours.`;
    hide($('eaForm'));
    show($('eaDone'));
    toast("You're on the early-access list.");
  }

  function reserveWithGoogle(e) {
    e.preventDefault();
    stashPending();
    joinWaitlist(currentUser && currentUser.email ? currentUser.email : '', 'google-start');
    location.href = buildGoogleAuthUrl();
  }

  // ═══════════ WIRE UP ═══════════
  function init() {
    currentUser = readUser();
    consumeAuthRedirect();
    fetchGoogleClientId();

    // Upload
    const drop = $('drop');
    const input = $('photoInput');
    drop.addEventListener('click', (e) => {
      if (e.target.closest('.dp-change')) return; // handled separately
      input.click();
    });
    drop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    $('changePhotoBtn').addEventListener('click', (e) => { e.stopPropagation(); input.click(); });
    input.addEventListener('change', (e) => handleFile(e.target.files && e.target.files[0]));

    ['dragenter', 'dragover'].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', (e) => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });

    // Style cards
    document.querySelectorAll('.style-card').forEach((c) =>
      c.addEventListener('click', () => selectStyle(c.dataset.style)));

    // Generate
    $('generateBtn').addEventListener('click', generate);

    // Early-access modal
    $('eaSubmit').addEventListener('click', submitEmail);
    $('eaEmail').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitEmail(); });
    $('eaGoogleBtn').addEventListener('click', reserveWithGoogle);

    // Close handlers
    document.querySelectorAll('[data-close="earlyModal"]').forEach((b) =>
      b.addEventListener('click', closeModal));
    $('earlyModal').addEventListener('click', (e) => { if (e.target === $('earlyModal')) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    renderPreview();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
