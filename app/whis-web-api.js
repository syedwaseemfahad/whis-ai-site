/* =============================================================================
 * whis-web-api.js  —  BROWSER SHIM for the Whis-AI desktop renderer
 * -----------------------------------------------------------------------------
 * The desktop app talks to the OS through Electron's preload bridge
 * (`window.electronAPI`, defined in whis/preload.js). This file re-implements
 * that SAME object using plain browser APIs so the UNCHANGED `renderer.js` can
 * run inside a normal web page. Load order matters:
 *
 *     <script src="whis-web-api.js"></script>   <-- this file, FIRST
 *     <script src="renderer.js"></script>       <-- unchanged desktop UI
 *
 * WHAT IS FAITHFUL:
 *   - Env/identity, auth (Google OAuth like the marketing site), streaming chat
 *     (the onChatStreamChunk / onChatStreamEnd callback contract), tracking,
 *     interview save, report, subscription status, trial end, screen capture via
 *     getDisplayMedia, mic/screen permission prompts, zoom, checkout redirect,
 *     and the in-page keyboard shortcuts (Cmd/Ctrl + L / J / Enter / Backspace).
 *
 * WHAT IS AN INTENTIONAL NO-OP (a browser tab simply cannot do these):
 *   - STEALTH / content-protection (setWindowProtection) — a web page can never
 *     hide itself from a screen-share. This is impossible by design, not a bug.
 *   - WINDOW MANAGEMENT (startWindowDrag, moveWindow, hideApp, minimizeToPill,
 *     shrinkForPermission, restoreAfterPermission, quitApp) — no OS window here.
 *   - Native OS settings deep-links (openMicSettings, openScreenRecordingSettings,
 *     etc.) — browsers grant permission via their own prompts, not System Settings.
 *   - getScreenSourceId — Electron-only concept; resolves null.
 *
 * Every method that exists on the desktop bridge exists here, returns a Promise
 * where the desktop returned a Promise, and NEVER throws synchronously.
 * ========================================================================== */

// Single source of truth for "am I running as the web app?" — set BEFORE renderer.js
// runs. The renderer must NOT infer web-ness from the presence/absence of a bridge
// method (we intentionally provide captureScreen via getDisplayMedia), so it keys off
// this flag instead. Desktop never defines it → falsy there.
window.WHIS_WEB = true;

(function () {
  "use strict";

  // ---- Constants -----------------------------------------------------------
  const BACKEND_URL = window.WHIS_BACKEND_URL || "https://api.whis-ai.com";
  const APP_AUTH_TOKEN = ""; // desktop had a shared secret; the web has none.

  // ---- Adopt the user returned from the OAuth callback ---------------------
  // After Google sign-in the backend bounces back to /app/?auth_success=true&user=...
  // (because loginGoogle sends ret:"/app/"). Persist that user to localStorage and
  // clean the URL — SYNCHRONOUSLY at load, before renderer.js boots and calls
  // checkAuth(). Mirrors the marketing site's auth_success handler exactly.
  (function _adoptUserFromCallback() {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get("auth_success") === "true" && q.get("user")) {
        const decoded = decodeURIComponent(q.get("user"));
        JSON.parse(decoded); // validate it's real JSON before storing
        localStorage.setItem("whisUser", decoded);
        history.replaceState({}, document.title, location.pathname);
      } else if (q.get("auth_error")) {
        console.warn("[whis-web] auth_error:", q.get("auth_error"));
        history.replaceState({}, document.title, location.pathname);
      }
    } catch (e) {
      console.warn("[whis-web] could not adopt callback user:", e);
    }
  })();

  // ---- Web-funnel entry event ---------------------------------------------
  // Fire ONE `web_app_opened` per browser session (even before sign-in, so we can
  // measure how many people reach the live app vs. how many convert). Deferred to
  // the end of the file once trackEvent is defined; guarded so it fires only once.
  function _emitWebOpenedOnce() {
    try {
      if (sessionStorage.getItem("whis_web_opened")) return;
      sessionStorage.setItem("whis_web_opened", "1");
      const u = storedUser();
      window.electronAPI && window.electronAPI.trackEvent &&
        window.electronAPI.trackEvent({ googleId: u && (u.googleId || u.id), event: "web_app_opened",
          metadata: { path: location.pathname, ref: document.referrer || null } });
    } catch (_) {}
  }

  // Google client id: the marketing site loads it from /api/config. We fetch it
  // lazily the first time loginGoogle() is called so we can build the OAuth URL
  // exactly like index.html does. Cached once resolved.
  let _googleClientId = window.WHIS_GOOGLE_CLIENT_ID || "";

  // ---- Tiny helpers --------------------------------------------------------
  const storedUser = () => {
    try {
      const s = localStorage.getItem("whisUser");
      return s ? JSON.parse(s) : null;
    } catch (_) {
      return null;
    }
  };
  const gid = () => {
    const u = storedUser();
    return (u && u.googleId) || "anon";
  };
  const safeFetch = (url, opts) =>
    fetch(url, opts).catch((err) => {
      console.warn("[whis-web] fetch failed:", url, err && err.message);
      return null;
    });

  // Callback registries (mirror ipcRenderer.on subscriptions) -----------------
  const _chunkCbs = []; // onChatStreamChunk
  const _endCbs = []; // onChatStreamEnd
  const _voiceCbs = []; // onToggleVoice        (Cmd/Ctrl+L)
  const _shotCbs = []; // onTriggerScreenshot   (Cmd/Ctrl+J)
  const _clearCbs = []; // onTriggerClear       (Cmd/Ctrl+Backspace)
  const _sendCbs = []; // onTriggerSend         (Cmd/Ctrl+Enter)
  const _zoomCbs = []; // onZoomChanged
  const _checkoutClosedCbs = []; // onCheckoutClosed

  const fireAll = (list, arg) => {
    for (const cb of list) {
      try {
        cb(arg);
      } catch (e) {
        console.warn("[whis-web] listener threw:", e);
      }
    }
  };

  // Per-controllerId AbortControllers for streaming cancellation.
  const _controllers = new Map();

  // Keep a conversation id across turns, like main.js's CURRENT_CONVERSATION_ID.
  let CURRENT_CONVERSATION_ID = null;

  // =========================================================================
  // ENV / IDENTITY
  // =========================================================================
  function getEnv() {
    return Promise.resolve({ BACKEND_URL, APP_AUTH_TOKEN });
  }

  async function checkAuth() {
    // MUST mirror the desktop shape: renderer does `const { user } = await checkAuth()`.
    // Returning a raw user (or null) breaks destructuring — {user:null} / {user} instead.
    const user = storedUser();
    if (!user) return { user: null };
    // Best-effort validation; the stored user is authoritative for the UI.
    try {
      const res = await safeFetch(`${BACKEND_URL}/api/user/status`, {
        method: "GET",
        headers: { "x-google-id": user.googleId || "" },
      });
      if (res && !res.ok && res.status === 401) {
        // Session revoked server-side — drop the stale user.
        localStorage.removeItem("whisUser");
        return null;
      }
    } catch (_) {
      /* offline / transient — keep the local user */
    }
    return { user };
  }

  async function _ensureGoogleClientId() {
    if (_googleClientId) return _googleClientId;
    try {
      const res = await safeFetch(`${BACKEND_URL}/api/config`);
      if (res && res.ok) {
        const data = await res.json();
        _googleClientId = data.googleClientId || "";
      }
    } catch (_) {}
    return _googleClientId;
  }

  // Start Google OAuth the SAME way the marketing site does (index.html):
  // build an accounts.google.com URL that redirects to the backend callback,
  // carrying attribution in `state`. The backend then bounces back to the app
  // with ?auth_success=true&user=<encoded json>, which we persist as whisUser.
  async function loginGoogle() {
    // If we're already signed in (e.g. from the marketing site — same origin, shared
    // localStorage), just hand the user back in the SAME { user } shape the desktop
    // returns, so the renderer's `if (result.user)` branch fires instead of no-op.
    const already = storedUser();
    if (already) return { user: already };

    const clientId = await _ensureGoogleClientId();
    if (!clientId) {
      console.warn("[whis-web] no Google client id; cannot start OAuth");
      return { error: "Sign-in is temporarily unavailable. Please try again." };
    }

    const redirectUri = encodeURIComponent(
      `${BACKEND_URL}/api/auth/google/callback`
    );
    const currentSource = localStorage.getItem("whisSource") || "organic";
    const currentRef = localStorage.getItem("whisRef") || "";
    const currentAid = localStorage.getItem("whisVisitorId") || "";
    // ret = where the backend should bounce us back to AFTER Google auth. Without this
    // the callback defaults to the marketing homepage and the app never sees the user.
    const retPath = location.pathname || "/app/";
    const stateParam = encodeURIComponent(
      JSON.stringify({ s: currentSource, r: currentRef, a: currentAid, ret: retPath })
    );
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}` +
      `&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile` +
      `&state=${stateParam}`;

    // Full-page redirect (identical to the site's <a href> flow). This navigates
    // away, so the returned Promise never resolves in this page instance — the
    // renderer re-checks auth on reload via checkAuth().
    try {
      window.location.href = authUrl;
    } catch (e) {
      console.warn("[whis-web] loginGoogle redirect failed:", e);
    }
    return new Promise(() => {}); // pending until navigation
  }

  function logout() {
    try {
      localStorage.removeItem("whisUser");
    } catch (_) {}
    return Promise.resolve();
  }

  // rotate-session → POST /api/auth/session/rotate (same path as desktop main.js).
  // Never throws; returns the new session id or a localStorage stub.
  async function rotateSession(googleId) {
    try {
      const res = await safeFetch(`${BACKEND_URL}/api/auth/session/rotate`, {
        method: "POST",
        headers: {
          "x-google-id": googleId || gid(),
          "x-whis-auth": APP_AUTH_TOKEN,
        },
      });
      if (res && res.ok) {
        const data = await res.json();
        if (data && data.success && data.newSessionId) {
          try {
            localStorage.setItem("whisSid", data.newSessionId);
          } catch (_) {}
          return data.newSessionId;
        }
      }
    } catch (_) {}
    // Stub fallback — never throw.
    try {
      return localStorage.getItem("whisSid") || "";
    } catch (_) {
      return "";
    }
  }

  // =========================================================================
  // STREAMING CHAT  (critical — matches the desktop callback contract)
  // Desktop: chat-with-openai-stream POSTs /api/chat-stream with body
  //   { conversationId, message }  and headers x-google-id / x-app-version.
  // Confirmed in whis/main.js line ~1395 and whis/server.js /api/chat-stream.
  // It streams RAW text chunks; each chunk → chat-stream-chunk; on finish the
  // accumulated text → chat-stream-end.
  // =========================================================================
  function onChatStreamChunk(cb) {
    if (typeof cb === "function") _chunkCbs.push(cb);
  }
  function onChatStreamEnd(cb) {
    if (typeof cb === "function") _endCbs.push(cb);
  }

  async function sendChatStream(lastMessage, googleId, controllerId) {
    const controller = new AbortController();
    if (controllerId != null) _controllers.set(controllerId, controller);
    let fullText = "";

    // Watchdogs mirror the desktop: 20s to connect, 25s idle mid-stream.
    const CONNECT_TIMEOUT_MS = 20000;
    const IDLE_TIMEOUT_MS = 25000;
    let timedOut = false;
    let connectTimer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CONNECT_TIMEOUT_MS);
    let idleTimer = null;
    const armIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, IDLE_TIMEOUT_MS);
    };
    const cleanup = () => {
      if (connectTimer) clearTimeout(connectTimer);
      if (idleTimer) clearTimeout(idleTimer);
      if (controllerId != null) _controllers.delete(controllerId);
    };

    try {
      const headers = {
        "Content-Type": "application/json",
        "x-whis-auth": APP_AUTH_TOKEN,
        "x-google-id": googleId || gid(),
        "x-app-version": "2",
      };

      const res = await fetch(`${BACKEND_URL}/api/chat-stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          conversationId: CURRENT_CONVERSATION_ID,
          message: lastMessage,
        }),
        signal: controller.signal,
      });

      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }

      const newConvId = res.headers.get("x-conversation-id");
      if (newConvId) CURRENT_CONVERSATION_ID = newConvId;

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        cleanup();
        fireAll(_endCbs, "");
        return { error: text || `HTTP ${res.status}` };
      }
      if (!res.body) {
        cleanup();
        fireAll(_endCbs, "");
        return { error: "No response body" };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      armIdle();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        armIdle();

        const chunk = decoder.decode(value, { stream: true });

        if (controller.signal.aborted) {
          cleanup();
          fireAll(_endCbs, fullText);
          return { aborted: true };
        }

        fullText += chunk;
        fireAll(_chunkCbs, chunk);
      }

      cleanup();
      fireAll(_endCbs, fullText);
      return { reply: fullText };
    } catch (err) {
      cleanup();
      if (err && err.name === "AbortError") {
        fireAll(_endCbs, fullText);
        if (timedOut && !fullText)
          return {
            error: "The server took too long to respond. Please try again.",
          };
        return { aborted: true };
      }
      console.error("[whis-web] sendChatStream error:", err);
      fireAll(_endCbs, fullText);
      return { error: "Streaming / backend error" };
    }
  }

  function cancelChatStream(controllerId) {
    try {
      const c = _controllers.get(controllerId);
      if (c) {
        c.abort();
        _controllers.delete(controllerId);
      }
    } catch (_) {}
  }

  // =========================================================================
  // TRACKING / DATA
  // =========================================================================
  function trackEvent(payload) {
    try {
      const { googleId, event: name, context, metadata } = payload || {};
      if (!name) return Promise.resolve({ ok: false });
      // Fire-and-forget; add surface:'web' so analytics can split web vs desktop.
      safeFetch(`${BACKEND_URL}/api/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-google-id": googleId || gid(),
          "x-whis-auth": APP_AUTH_TOKEN,
        },
        body: JSON.stringify({
          event: name,
          context,
          metadata,
          surface: "web",
        }),
        keepalive: true,
      });
    } catch (_) {}
    return Promise.resolve({ ok: true });
  }

  async function saveInterview(payload) {
    try {
      const { googleId, date, company, role } = payload || {};
      if (!googleId) return { ok: false };
      const res = await safeFetch(`${BACKEND_URL}/api/user/interview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-google-id": googleId,
          "x-whis-auth": APP_AUTH_TOKEN,
        },
        body: JSON.stringify({ date, company, role }),
      });
      return { ok: !!(res && res.ok) };
    } catch (_) {
      return { ok: false };
    }
  }

  async function submitReport(payload) {
    try {
      const { googleId, email, reason, details } = payload || {};
      const res = await safeFetch(`${BACKEND_URL}/api/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-google-id": googleId || "Anonymous",
          "x-whis-auth": APP_AUTH_TOKEN,
        },
        body: JSON.stringify({ email, reason, details }),
      });
      if (res && res.ok) return { success: true };
      return { error: "Failed to submit report" };
    } catch (_) {
      return { error: "Network error" };
    }
  }

  // extractFileText: the desktop parsed PDF/DOCX/TXT with Node modules. On the web we
  // do it IN THE BROWSER — pdf.js for PDF, mammoth for DOCX (both loaded from CDN in
  // index.html), TextDecoder for txt. No server round-trip, no resume upload needed.
  async function extractFileText(buffer, ext) {
    try {
      const extension = (ext || "").toLowerCase().replace(/^\./, "");
      const ab = buffer instanceof ArrayBuffer ? buffer : (buffer && buffer.buffer) || new Uint8Array(buffer || []).buffer;

      // Plain text
      if (extension === "txt" || extension === "md" || extension === "rtf") {
        try { return { text: new TextDecoder("utf-8").decode(ab) || "" }; } catch (_) { return { text: "" }; }
      }

      // PDF via pdf.js
      if (extension === "pdf") {
        try {
          if (!window.pdfjsLib) return { text: "", error: "PDF reader still loading — please try again in a moment." };
          const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
          let out = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            out += content.items.map((it) => (it.str || "")).join(" ") + "\n";
          }
          return { text: out.trim() };
        } catch (e) {
          console.warn("[whis-web] pdf extract failed:", e);
          return { text: "", error: "Could not read this PDF. If it's a scanned image, paste the text instead." };
        }
      }

      // DOCX via mammoth
      if (extension === "docx") {
        try {
          if (!window.mammoth) return { text: "", error: "Doc reader still loading — please try again in a moment." };
          const result = await window.mammoth.extractRawText({ arrayBuffer: ab });
          return { text: (result && result.value ? result.value : "").trim() };
        } catch (e) {
          console.warn("[whis-web] docx extract failed:", e);
          return { text: "", error: "Could not read this .docx. Try 'Save As' → PDF, or paste the text." };
        }
      }

      // Legacy .doc / unknown: try a plain-text decode, else guide the user.
      try {
        const t = new TextDecoder("utf-8").decode(ab).replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, " ").trim();
        if (t && t.length > 40) return { text: t };
      } catch (_) {}
      return { text: "", error: "Unsupported file. Upload a PDF, DOCX, or TXT — or paste your resume text." };
    } catch (_) {
      return { text: "" };
    }
  }

  async function checkSubscription(googleId, sessionId) {
    try {
      const headers = {
        "x-google-id": googleId || gid(),
        "x-whis-auth": APP_AUTH_TOKEN,
      };
      if (sessionId) headers["x-session-id"] = sessionId;
      const res = await safeFetch(`${BACKEND_URL}/api/user/status`, {
        method: "GET",
        headers,
      });
      if (!res || !res.ok) return { active: false, error: "Backend check failed" };
      return await res.json();
    } catch (_) {
      return { active: false, error: "Network error" };
    }
  }

  async function endTrial(googleId) {
    try {
      const res = await safeFetch(`${BACKEND_URL}/api/user/trial/end`, {
        method: "POST",
        headers: {
          "x-google-id": googleId || gid(),
          "x-whis-auth": APP_AUTH_TOKEN,
        },
      });
      if (res && res.ok) return await res.json();
      return { error: "Network error" };
    } catch (_) {
      return { error: "Network error" };
    }
  }

  // =========================================================================
  // SCREEN / PERMISSIONS  (browser)
  // Renderer consumes the return as `res.dataUrl` (lowercase Url).
  // =========================================================================
  async function _grabOneFrame() {
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      if (!track) return { error: "No screen track" };

      // Prefer ImageCapture where available; fall back to a <video>+<canvas>.
      let dataUrl = "";
      try {
        if (typeof ImageCapture !== "undefined") {
          const ic = new ImageCapture(track);
          const bitmap = await ic.grabFrame();
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          canvas.getContext("2d").drawImage(bitmap, 0, 0);
          dataUrl = canvas.toDataURL("image/png");
        }
      } catch (_) {
        dataUrl = "";
      }

      if (!dataUrl) {
        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        await video.play().catch(() => {});
        // Let a frame arrive.
        await new Promise((r) => {
          if (video.readyState >= 2) return r();
          video.onloadeddata = () => r();
          setTimeout(r, 500);
        });
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 1920;
        canvas.height = video.videoHeight || 1080;
        canvas.getContext("2d").drawImage(video, 0, 0);
        dataUrl = canvas.toDataURL("image/png");
        video.pause();
        video.srcObject = null;
      }

      return { dataUrl };
    } catch (err) {
      return { error: "Screen capture failed: " + (err && err.message) };
    } finally {
      if (stream) {
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch (_) {}
      }
    }
  }

  function captureScreen() {
    return _grabOneFrame();
  }
  function captureScreenDemo() {
    return _grabOneFrame();
  }

  function getScreenSourceId() {
    return Promise.resolve(null); // Electron-only; meaningless on the web.
  }

  function checkPermissions() {
    // The browser prompts on demand at capture/getUserMedia time.
    return Promise.resolve({ mic: true, screen: true });
  }

  async function requestMicPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch (_) {
      return false;
    }
  }

  function requestScreenPermission() {
    // Real prompt happens when getDisplayMedia is called during capture.
    return Promise.resolve(true);
  }

  const noopSettings = (label) => () => {
    try {
      console.info(`[whis-web] ${label}: no-op (use the browser's own prompt)`);
    } catch (_) {}
    return Promise.resolve();
  };
  const openMicSettings = noopSettings("openMicSettings");
  const openSoundSettings = noopSettings("openSoundSettings");
  const openAudioMidiSetup = noopSettings("openAudioMidiSetup");
  const openScreenRecordingSettings = noopSettings("openScreenRecordingSettings");
  const openMacPrivacySettings = (type) =>
    noopSettings("openMacPrivacySettings:" + (type || ""))();

  // =========================================================================
  // WINDOW / DESKTOP-ONLY  → safe no-ops (stealth impossible in a browser)
  // =========================================================================
  const noop = () => Promise.resolve();
  const setWindowProtection = () => noop();
  const startWindowDrag = () => {}; // was ipcRenderer.send (fire-and-forget)
  const hideApp = () => noop();
  const minimizeToPill = () => noop();
  const moveWindow = () => {}; // send-style, no return
  const shrinkForPermission = () => {}; // send-style
  const restoreAfterPermission = () => {}; // send-style
  function quitApp() {
    try {
      window.close(); // courtesy only; usually blocked for non-script-opened tabs
    } catch (_) {}
    return Promise.resolve();
  }

  // =========================================================================
  // ZOOM  (CSS zoom on <body>, persisted; parity with desktop)
  // =========================================================================
  let _zoomLevel = 0;
  try {
    const saved = parseInt(localStorage.getItem("whisWebZoom") || "0", 10);
    if (!Number.isNaN(saved)) _zoomLevel = saved;
  } catch (_) {}

  const _zoomState = () => {
    const factor = Math.pow(1.2, _zoomLevel);
    return {
      level: _zoomLevel,
      factor,
      percent: Math.round(factor * 100),
    };
  };
  const _applyZoom = () => {
    try {
      document.body.style.zoom = String(_zoomState().factor);
    } catch (_) {}
  };
  const _persistZoom = () => {
    try {
      localStorage.setItem("whisWebZoom", String(_zoomLevel));
    } catch (_) {}
  };
  // Apply on load once the body exists.
  if (document.body) _applyZoom();
  else
    document.addEventListener("DOMContentLoaded", _applyZoom, { once: true });

  function getZoom() {
    return Promise.resolve(_zoomState());
  }
  function adjustZoom(delta) {
    const d = parseInt(delta, 10);
    _zoomLevel += Number.isNaN(d) ? 0 : d;
    // Clamp to a sane range (~50%..~300%).
    if (_zoomLevel < -3) _zoomLevel = -3;
    if (_zoomLevel > 6) _zoomLevel = 6;
    _applyZoom();
    _persistZoom();
    const s = _zoomState();
    fireAll(_zoomCbs, s);
    return Promise.resolve(s);
  }
  function resetZoom() {
    _zoomLevel = 0;
    _applyZoom();
    _persistZoom();
    const s = _zoomState();
    fireAll(_zoomCbs, s);
    return Promise.resolve(s);
  }
  function onZoomChanged(cb) {
    if (typeof cb === "function") _zoomCbs.push(cb);
  }

  // =========================================================================
  // CHECKOUT
  // Desktop opened a pre-authed in-app checkout window. On the web we send the
  // user to the marketing site's pricing/checkout with query params so the
  // existing site checkout (Razorpay) can pick up the account + tier.
  // openSubscriptionPage(arg): arg may be a coupon string (legacy) or
  //   { user } / { gid, sid, tier, cycle, coupon }.
  // openInAppCheckout(arg): { gid, sid, tier, cycle, cur, coupon } → { ok }.
  // =========================================================================
  function _checkoutUrl(arg) {
    const u = storedUser();
    let tier, cycle, coupon, googleId;
    if (typeof arg === "string") {
      coupon = arg;
    } else if (arg && typeof arg === "object") {
      googleId = arg.gid || (arg.user && arg.user.googleId);
      tier = arg.tier;
      cycle = arg.cycle;
      coupon = arg.coupon;
    }
    googleId = googleId || (u && u.googleId) || "";
    const params = new URLSearchParams();
    if (googleId) params.set("gid", googleId);
    if (tier) params.set("tier", tier);
    if (cycle) params.set("cycle", cycle);
    if (coupon) params.set("coupon", coupon);
    const q = params.toString();
    // The marketing site's pricing lives at the site root under #pricing.
    return `https://whis-ai.com/#pricing${q ? "?" + q : ""}`;
  }

  function openSubscriptionPage(arg) {
    try {
      window.location.href = _checkoutUrl(arg);
    } catch (e) {
      console.warn("[whis-web] openSubscriptionPage failed:", e);
    }
    return Promise.resolve({ ok: true });
  }

  function openInAppCheckout(arg) {
    // Same destination on the web; the site handles the actual payment sheet.
    try {
      window.location.href = _checkoutUrl(arg);
    } catch (e) {
      console.warn("[whis-web] openInAppCheckout failed:", e);
      return Promise.resolve({ ok: false });
    }
    return Promise.resolve({ ok: true });
  }

  function onCheckoutClosed(cb) {
    if (typeof cb !== "function") return;
    _checkoutClosedCbs.push(cb);
    // On the web the "checkout window" is another tab/redirect; fire the
    // callback when focus returns so the renderer re-checks entitlement.
    window.addEventListener("focus", () => {
      try {
        cb();
      } catch (_) {}
    });
  }

  function openUrl(url) {
    try {
      window.open(url, "_blank", "noopener");
    } catch (e) {
      console.warn("[whis-web] openUrl failed:", e);
    }
    return Promise.resolve();
  }

  // =========================================================================
  // SHORTCUT LISTENERS  (desktop registered these; we own them in-page)
  // =========================================================================
  function onToggleVoice(cb) {
    if (typeof cb === "function") _voiceCbs.push(cb);
  }
  function onTriggerScreenshot(cb) {
    if (typeof cb === "function") _shotCbs.push(cb);
  }
  function onTriggerClear(cb) {
    if (typeof cb === "function") _clearCbs.push(cb);
  }
  function onTriggerSend(cb) {
    if (typeof cb === "function") _sendCbs.push(cb);
  }

  // Global keydown → fire the matching registry, mirroring the desktop
  // global shortcuts:  Cmd/Ctrl + L / J / Enter / Backspace.
  window.addEventListener(
    "keydown",
    (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = (e.key || "").toLowerCase();
      if (key === "l") {
        e.preventDefault();
        fireAll(_voiceCbs);
      } else if (key === "j") {
        e.preventDefault();
        fireAll(_shotCbs);
      } else if (key === "enter") {
        e.preventDefault();
        fireAll(_sendCbs);
      } else if (key === "backspace") {
        e.preventDefault();
        fireAll(_clearCbs);
      }
    },
    true // capture, so it wins before textarea handlers where appropriate
  );

  // =========================================================================
  // EXPOSE  — mirror every method name the desktop preload exposed.
  // =========================================================================
  window.electronAPI = {
    // Window drag / control (no-ops on web)
    startWindowDrag,
    hideApp,
    minimizeToPill,
    onTriggerSend,
    moveWindow,
    quitApp,

    // Env / identity
    getEnv,
    checkAuth,
    loginGoogle,
    logout,
    rotateSession,

    // Subscription / checkout
    checkSubscription,
    openSubscriptionPage,
    openInAppCheckout,
    onCheckoutClosed,
    endTrial,

    // Content protection (no-op)
    setWindowProtection,

    // Conversion / tracking / reporting
    saveInterview,
    trackEvent,
    submitReport,

    // File extraction
    extractFileText,

    // Streaming chat
    sendChatStream,
    cancelChatStream,
    onChatStreamChunk,
    onChatStreamEnd,

    // Shortcut listeners
    onToggleVoice,
    onTriggerScreenshot,
    onTriggerClear,

    // Screen capture
    captureScreen,
    captureScreenDemo,
    getScreenSourceId,
    openScreenRecordingSettings,
    openSoundSettings,
    openAudioMidiSetup,

    // Permission helpers
    shrinkForPermission,
    restoreAfterPermission,
    checkPermissions,
    requestMicPermission,
    openMicSettings,
    requestScreenPermission,
    openMacPrivacySettings,

    // External URL
    openUrl,

    // Zoom
    getZoom,
    adjustZoom,
    resetZoom,
    onZoomChanged,
  };

  console.info("[whis-web] shim ready");
  _emitWebOpenedOnce();
})();
