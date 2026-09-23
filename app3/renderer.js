// renderer.js

// ================================================================
// NO HOVER TOOLTIPS (stealth requirement)
// Native browser tooltips from `title="..."` attributes pop up on hover
// ("Listen to interviewer", "Capture screenshot", etc). They cannot be styled
// or disabled via CSS, and several are added dynamically at runtime. This guard
// strips every `title` attribute on load AND watches the DOM so any title added
// later (by JS or new elements) is removed before it can ever show.
(function suppressNativeTooltips() {
    const strip = (root) => {
        if (!root || root.nodeType !== 1) return;
        if (root.hasAttribute && root.hasAttribute('title')) root.removeAttribute('title');
        if (root.querySelectorAll) root.querySelectorAll('[title]').forEach(el => el.removeAttribute('title'));
    };
    const run = () => {
        strip(document.documentElement);
        const obs = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'attributes' && m.target && m.target.hasAttribute && m.target.hasAttribute('title')) {
                    m.target.removeAttribute('title');
                }
                if (m.addedNodes) m.addedNodes.forEach(strip);
            }
        });
        obs.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['title']
        });
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();

// ================================================================
// WEB / MOBILE ENVIRONMENT DETECTION (contract with the CSS teammate)
// ================================================================
// `window.WHIS_WEB === true` is set by the browser shim. We tag <body> so CSS can
// adapt layout, and detect mobile robustly. Mobile phones have NO getDisplayMedia
// (so no interviewer/system-audio capture), coarse pointers, and small viewports.
// Everything here is a no-op on desktop Electron (WHIS_WEB is falsy there).
function isMobileWeb() {
    if (!window.WHIS_WEB) return false;
    try {
        const noDisplayMedia = !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia;
        const coarseAndSmall = (typeof matchMedia === 'function'
            && matchMedia('(pointer:coarse)').matches
            && window.innerWidth < 820);
        const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent || '');
        // No screen-capture API is the hard signal (a phone literally cannot capture a
        // tab). Coarse+small or a mobile UA are the soft signals for tablets/edge cases.
        return noDisplayMedia || coarseAndSmall || uaMobile;
    } catch (_) {
        return false;
    }
}

// Boolean exposed for reuse across the renderer (and for the CSS teammate / debugging).
window.WHIS_IS_MOBILE = isMobileWeb();
const IS_MOBILE_WEB = window.WHIS_IS_MOBILE;

(function tagEnvClasses() {
    const apply = () => {
        if (!document.body) return;
        if (window.WHIS_WEB) document.body.classList.add('whis-web');
        if (IS_MOBILE_WEB) document.body.classList.add('whis-mobile');

        if (window.WHIS_WEB) {
            // Show a neutral boot state and DON'T flash the sign-in card while checkAuth
            // resolves. checkAuth() routes to showLogin()/showApp(), both of which hide
            // the boot overlay via _hideWebBoot().
            const _boot  = document.getElementById('web-boot-overlay');
            const _login = document.getElementById('login-overlay');
            if (_boot)  _boot.style.display  = 'flex';
            if (_login) _login.style.display = 'none';

            // Honest web copy: web is a practice/try surface, not the live stealth tool.
            const _sub = document.querySelector('#login-overlay .login-subtitle');
            if (_sub) _sub.textContent = 'Practice interview answers with an AI co-pilot. Sign in to start free.';
            const _subBtn = document.getElementById('sub-btn');
            if (_subBtn) _subBtn.textContent = 'Upgrade to Elite';
            // Persistent honest CTA in the profile menu: web = practice, desktop = live.
            const _deskItem = document.getElementById('web-desktop-app-item');
            if (_deskItem) _deskItem.style.display = '';
        }
    };
    if (document.body) apply();
    else document.addEventListener('DOMContentLoaded', apply);
})();

// WEB: dismiss the neutral boot overlay once auth routing has decided app-vs-login.
function _hideWebBoot() {
    if (!window.WHIS_WEB) return;
    const _boot = document.getElementById('web-boot-overlay');
    if (_boot) _boot.style.display = 'none';
}

// --- Mode Toggle State ---
let isAutoMode = false; // Defaults to Manual

// --- UI Elements ---
const loginOverlay = document.getElementById("login-overlay");
const subOverlay = document.getElementById("sub-overlay");
const contentArea = document.getElementById("content-area");

// Global Header Elements
const profileBtn = document.getElementById("profile-btn"); 
const profileDropdownMenu = document.getElementById("profile-dropdown-menu"); 
const dropdownUserEmail = document.getElementById("dropdown-user-email"); 
const logoutBtn = document.getElementById("logout-btn");
const userAvatar = document.getElementById("user-avatar");
const userIcon = document.getElementById("user-icon"); 
const upgradeBtn = document.getElementById("upgrade-btn");
const refreshBtn = document.getElementById("refresh-btn");
const closeAppBtn = document.getElementById("close-app-btn"); 
const usageShortcutsContainer = document.getElementById("usage-shortcuts");
const usageShortcutsPopoverContainer = document.getElementById("usage-shortcuts-popover");
const headerRight = document.getElementById("header-right");
const globalCloseBtn = document.getElementById("global-close-btn"); 
const micUsagePill = document.getElementById("mic-usage-pill");
const appMinutesPill = document.getElementById("app-minutes-pill"); 

// Toggle Switch & Shortcut Elements
const modeToggleCheckbox = document.getElementById("mode-toggle-checkbox");
const manualLabel = document.getElementById("mode-label-manual");
const autoLabel = document.getElementById("mode-label-auto");
const shortcutToggleBtn = document.getElementById("shortcut-toggle-btn");
const shortcutPopover = document.getElementById("shortcut-popover");

// Guide & Tour Overlay Elements
const guideBtn = document.getElementById("guide-btn");
const guideOverlay = document.getElementById("guide-overlay");
const closeGuideBtn = document.getElementById("close-guide-btn");
const tourOverlay = document.getElementById("tour-overlay");
const tourSkipBtn = document.getElementById("tour-skip-btn");
const tourNextBtn = document.getElementById("tour-next-btn");
const tourBackBtn = document.getElementById("tour-back-btn");
const tourSteps = document.querySelectorAll(".tour-step");
const tourDots = document.querySelectorAll(".tour-dots .dot");
let currentTourStep = 0;
let hasShownTourThisSession = false; 

// Permission Overlay Elements
const permOverlay = document.getElementById("permission-overlay");

// Trial UI Elements
const trialTimerContainer = document.getElementById("trial-timer-container");
const trialTimerText = document.getElementById("trial-timer-text");
const endTrialBtn = document.getElementById("end-trial-btn"); 
const menuStartTrialBtn = document.getElementById("menu-start-trial-btn");
const lockStartTrialBtn = document.getElementById("lock-start-trial-btn");
const trialModal = document.getElementById("trial-modal");
const closeTrialModalBtn = document.getElementById("close-trial-modal");
const startTrialEliteBtn = document.getElementById("start-trial-elite");
const trialSessionsLeftEl = document.getElementById("trial-sessions-left");
const trialErrorEl = document.getElementById("trial-error");

// Context Manager Elements
const contextManagerBtn = document.getElementById("context-manager-btn");
const contextOverlay = document.getElementById("context-overlay");
const closeContextBtn = document.getElementById("close-context-btn");
const contextListView = document.getElementById("context-list-view");
const contextEditorView = document.getElementById("context-editor-view");
const addNewContextBtn = document.getElementById("add-new-context-btn");
const saveCtxBtn = document.getElementById("save-ctx-btn");
const cancelCtxBtn = document.getElementById("cancel-ctx-btn");
const ctxNameInput = document.getElementById("ctx-name-input");
const ctxContentInput = document.getElementById("ctx-content-input");
const ctxFileInput = document.getElementById("ctx-file-input");
const ctxUploadBtn = document.getElementById("ctx-upload-btn");
const inputContainer = document.querySelector(".input-container"); 

// Usage Warning UI Elements (NEW)
const usageWarningOverlay = document.getElementById("usage-warning-overlay");
const usageWarningContinueBtn = document.getElementById("usage-warning-continue-btn");
const usageWarningCloseBtn = document.getElementById("usage-warning-close-btn");
const usageWarningSec = document.getElementById("usage-warning-sec");

// Buttons & Inputs
const loginBtn = document.getElementById("login-btn");
const loginCancelBtn = document.getElementById("login-cancel-btn"); 
const loginError = document.getElementById("login-error");
const subBtn = document.getElementById("sub-btn");
const subLogoutBtn = document.getElementById("sub-logout-btn");
const subRefreshBtn = document.getElementById("sub-refresh-btn");
const subStatus = document.getElementById("sub-status");

// Main App Elements
const messagesContainer = document.getElementById("messages");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const clearBtn = document.getElementById("clear-btn"); 
const voiceBtn = document.getElementById("voice-btn"); 
const listeningStatusEl = document.getElementById("listening-status");
const screenshotBtn = document.getElementById("screenshot-btn"); 
const crispToggleBtn = document.getElementById("crisp-toggle"); 

// Attachment Elements
const attachmentArea = document.getElementById("attachment-area");
const previewImg = document.getElementById("preview-img");
const removeAttachmentBtn = document.getElementById("remove-attachment-btn");

// Font Size Scaling Elements
const fontIncBtn = document.getElementById("font-inc");
const fontDecBtn = document.getElementById("font-dec");
const fontResetBtn = document.getElementById("font-reset");

// Screenshot OCR cache & Transcription Cache
let stagedScreenshotOcrText = "";
let stagedScreenshotOcrConfidence = null;
let hiddenTranscription = "";

let autoRoutinesStarted = false;

// Auto Intervals
let autoMicResetInterval = null;
let globalUsageInterval = null; // Unified global app usage interval

let currentUser = null;
let subscriptionTier = null;
let isFreeTier = false;
let subscriptionValidUntil = null;
let subscriptionOrders = [];
let subscriptionStatusObj = null;

// ── Connection health monitor ──
let _connStatus = 'unknown';
let _connCheckTimer = null;

// ── Session keys ──
const _SESSION_KEY = 'wh_session_v1';
const _SESSION_MAX_AGE = 4 * 60 * 60 * 1000;
let CURRENT_CONVERSATION_ID = null;

async function _checkConnection() {
    const dot = document.getElementById('conn-status-dot');
    if (dot) dot.dataset.status = 'checking';
    const prevStatus = _connStatus;
    try {
        const r = await fetch(`${BACKEND_URL}/ping`, {
            method: 'GET',
            signal: AbortSignal.timeout(4000),
            headers: { 'x-whis-auth': APP_AUTH_TOKEN }
        });
        _connStatus = r.ok ? 'online' : 'offline';
    } catch(_) {
        _connStatus = 'offline';
    }
    if (dot) dot.dataset.status = _connStatus;
    if (_connStatus !== prevStatus) {
        if (_connStatus === 'offline') _logHealth('conn_offline');
        else if (_connStatus === 'online') _logHealth('conn_online');
    }
}

function _startConnectionMonitor() {
    _checkConnection();
    _connCheckTimer = setInterval(_checkConnection, 30000);
}

// ================================================================
// WHIS TOAST, premium in-app notifications
// ================================================================
function whisToast(message, type = 'info', duration = 3000, opts = {}) {
    let container = document.getElementById('whis-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'whis-toast-container';
        document.body.appendChild(container);
    }
    const ICONS = { success:'fa-check-circle', error:'fa-circle-xmark', warning:'fa-triangle-exclamation', info:'fa-circle-info' };
    const toast = document.createElement('div');
    toast.className = `whis-toast whis-toast-${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${ICONS[type]||ICONS.info} whis-toast-icon"></i>
        <span class="whis-toast-msg">${message}</span>
        ${opts.action ? `<button class="whis-toast-action">${opts.action.label}</button>` : ''}
        <button class="whis-toast-close"><i class="fa-solid fa-xmark"></i></button>`;

    const dismiss = () => {
        toast.classList.add('wt-out');
        setTimeout(() => toast.remove(), 220);
    };
    toast.querySelector('.whis-toast-close').addEventListener('click', dismiss);
    if (opts.action) toast.querySelector('.whis-toast-action').addEventListener('click', () => { opts.action.fn(); dismiss(); });

    container.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('wt-in')));
    if (duration > 0) setTimeout(dismiss, duration);
    return { dismiss };
}

// ================================================================
// WHIS CONFIRM, premium async confirm dialog
// ================================================================
function whisConfirm(message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, title = '') {
    return new Promise(resolve => {
        const ov = document.createElement('div');
        ov.className = 'whis-confirm-overlay';
        ov.innerHTML = `<div class="whis-confirm-card">
            ${title ? `<div class="whis-confirm-title">${title}</div>` : ''}
            <p class="whis-confirm-msg">${message}</p>
            <div class="whis-confirm-btns">
                <button class="whis-confirm-cancel">${cancelLabel}</button>
                <button class="whis-confirm-ok${danger?' danger':''}">${confirmLabel}</button>
            </div></div>`;
        document.body.appendChild(ov);
        requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('wc-in')));
        const done = r => { ov.classList.remove('wc-in'); setTimeout(() => ov.remove(), 200); resolve(r); };
        ov.querySelector('.whis-confirm-ok').addEventListener('click', () => done(true));
        ov.querySelector('.whis-confirm-cancel').addEventListener('click', () => done(false));
        ov.addEventListener('click', e => { if (e.target === ov) done(false); });
    });
}

// ================================================================
// CONTEXTUAL HINT ENGINE
// Central place that reads ALL live state and renders the right
// one-line guidance message with smooth fade transitions.
// Call updateContextHint() from any state-change point.
// ================================================================
let _hintFadeTimer   = null;
let _hintRevertTimer = null;
let _lastHint        = null;

function updateContextHint(override) {
    const el = document.getElementById('context-hint');
    if (!el) return;

    const sym = (typeof CTRL !== 'undefined') ? CTRL : '⌘';
    let text, type;

    if (override) {
        text = override.text;
        type = override.type || 'neutral';
    } else {
        // Hide hint when mic is active, listening-status owns that slot
        if (typeof isListening !== 'undefined' && isListening) {
            el.style.display = 'none';
            _updateChipsVisibility();
            return;
        }
        el.style.display = '';

        if (state && state.isSending) {
            text = `Streaming · press <span class="ch-key">■ Stop</span> when you have enough`;
            type = 'active';
        } else if (typeof stagedScreenshotData !== 'undefined' && stagedScreenshotData) {
            const hasText = inputEl && inputEl.value.trim();
            text = hasText
                ? `Screenshot + text ready · <span class="ch-key">${sym}+↵</span> to send`
                : `Screenshot ready · add context or <span class="ch-key">${sym}+↵</span> to analyze`;
            type = 'screenshot';
        } else if (inputEl && inputEl.value.trim()) {
            text = `<span class="ch-key">${sym}+↵</span> to send · or add <span class="ch-key">${sym}+L</span> voice for more context`;
            type = 'neutral';
        } else if (typeof isAutoMode !== 'undefined' && isAutoMode) {
            text = `Auto · always listening · <span class="ch-key">${sym}+↵</span> when they finish speaking`;
            type = 'active';
        } else {
            const hasCtx = typeof localContexts !== 'undefined' && localContexts && localContexts.some(c => c.isActive);
            const loggedIn = typeof currentUser !== 'undefined' && currentUser;
            if (loggedIn && !hasCtx) {
                text = `💡 Upload resume via <strong>Profile → Manage Contexts</strong> for personalized answers`;
                type = 'nudge';
            } else {
                text = `<span class="ch-key">${sym}+L</span> listen · <span class="ch-key">${sym}+J</span> screenshot · or type below`;
                type = 'neutral';
            }
        }
    }

    const key = type + '|' + text;
    if (key === _lastHint) return;
    _lastHint = key;

    clearTimeout(_hintFadeTimer);
    el.style.opacity = '0';
    el.style.transform = 'translateY(2px)';
    _hintFadeTimer = setTimeout(() => {
        el.innerHTML = text;
        el.setAttribute('data-type', type);
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
    }, 100);

    _updateChipsVisibility();
}

// Show chips only when the session is idle (no messages yet or empty state)
function _updateChipsVisibility() {
    const chips = document.getElementById('quick-prompts');
    if (!chips) return;
    const hasRealMessages = state.messages.some(m => m.id !== 'welcome' && m.content !== 'Ready.' && m.role !== 'welcome');
    const isActive = (state && state.isSending) || (typeof isListening !== 'undefined' && isListening);
    chips.classList.toggle('hidden', hasRealMessages || isActive);
}

// Transient hint: show a message for `ms` then revert to state-based hint
function _flashHint(text, type = 'ready', ms = 4000) {
    clearTimeout(_hintRevertTimer);
    _lastHint = null; // force update even if text is same
    updateContextHint({ text, type });
    _hintRevertTimer = setTimeout(() => { _lastHint = null; updateContextHint(); }, ms);
}

// ================================================================
// INTERVIEW TIMER
// ================================================================
let _interviewStart = null;
let _interviewTicker = null;

function startInterviewTimer() {
    if (_interviewStart) return;
    _interviewStart = Date.now();
    const el = document.getElementById('interview-timer');
    const display = document.getElementById('interview-timer-display');
    if (el) el.style.display = 'flex';
    _interviewTicker = setInterval(() => {
        if (!display) return;
        const e = Date.now() - _interviewStart;
        const m = Math.floor(e / 60000), s = Math.floor((e % 60000) / 1000);
        display.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }, 1000);
}

function stopInterviewTimer() {
    clearInterval(_interviewTicker); _interviewTicker = null; _interviewStart = null;
    const el = document.getElementById('interview-timer');
    if (el) el.style.display = 'none';
    const d = document.getElementById('interview-timer-display');
    if (d) d.textContent = '00:00';
}
let isCrisp = false; 

// --- Font State ---
let currentFontScale = 1;

// --- Trial State ---
let trialTickerInterval = null;
let maxTrialSessions = 2;
let currentTrialUsage = 0;
let trialDurationMinutes = 5;
let _trialModalAutoShown = false; // auto-open the trial modal only once per session (no refresh-spam)
let _entitlementEnded = false;    // guards the one-time hard lock when a trial/sub ends
let _sessionInvalidStrikes = 0;   // tolerate transient session-rotation races before acting
let _inactiveStrikes = 0;         // tolerate a transient "inactive" blip before locking

// --- Usage Warning State ---
let appUsageTimer = null;
let usageWarningCountdownInterval = null;

// --- Context State ---
let localContexts = [];
let editingContextId = null;

// Staging & Processing Locks
let stagedScreenshotData = null; 
let isProcessingSend = false; 
let isBackgroundCommitting = false; 

// Session Logic
let currentSessionId = null;
let sessionHeartbeatInterval = null;

let subscriptionIsActive = false;
let subscriptionIsTrial = false;

// ========================================================
// --- ENVIRONMENT VARIABLES ---
// ========================================================
let BACKEND_URL = "http://localhost:4000";
let APP_AUTH_TOKEN = "";

async function loadEnvVariables() {
  try {
    if (window.electronAPI && window.electronAPI.getEnv) {
        const cfg = await window.electronAPI.getEnv();
        if (cfg.BACKEND_URL) {
            BACKEND_URL = cfg.BACKEND_URL.startsWith('http') ? cfg.BACKEND_URL : `http://${cfg.BACKEND_URL}`;
        }
        if (cfg.APP_AUTH_TOKEN) APP_AUTH_TOKEN = cfg.APP_AUTH_TOKEN;
    }
  } catch (err) { 
    console.error("Env load error:", err); 
  }
}

const AUDIO_MAX_DURATION_SEC = 60;
let CURRENT_STREAM_CONTROLLER_ID = crypto.randomUUID(); 

// --- System Detection ---
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const CTRL = isMac ? '⌘' : 'Ctrl';
const OPT = isMac ? '⌥' : 'Alt';
const SHIFT = isMac ? '⇧' : 'Shift';

const SYSTEM_AUDIO_KEYWORDS = ['stereo mix', 'loopback', 'what u hear', 'virtual audio cable', 'ishowu', 'blackhole', 'soundflower', 'vb-audio', 'vb cable', 'cable output'];
let audioInputDeviceID = 'default'; 


// ========================================================
// --- LIVE SUPPORT CHAT ---
// ========================================================
(function initSupportChat() {
    let supportPollInterval = null;
    let lastSupportMsgCount = 0;

    const panel   = document.getElementById('support-chat-panel');
    const openBtn = document.getElementById('support-chat-btn');
    const closeBtn = document.getElementById('close-support-chat-btn');
    const input   = document.getElementById('support-chat-input');
    const sendBtn = document.getElementById('support-chat-send-btn');
    const msgArea = document.getElementById('support-chat-messages');

    if (!panel) return;

    function getSupportEmail() {
        return (currentUser && currentUser.email) || localStorage.getItem('userEmail') || null;
    }

    function openPanel() {
        if (profileDropdownMenu) profileDropdownMenu.style.display = 'none';
        panel.style.display = 'flex';
        fetchHistory();
        startPolling();
        setTimeout(() => input && input.focus(), 100);
    }

    function closePanel() {
        panel.style.display = 'none';
        stopPolling();
    }

    function startPolling() {
        if (supportPollInterval) clearInterval(supportPollInterval);
        supportPollInterval = setInterval(fetchHistory, 3000);
    }

    function stopPolling() {
        if (supportPollInterval) clearInterval(supportPollInterval);
        supportPollInterval = null;
    }

    async function fetchHistory() {
        const email = getSupportEmail();
        if (!email) return;
        try {
            const res = await fetch(`${BACKEND_URL}/api/chat/history/${encodeURIComponent(email)}`, {
                headers: { 'x-whis-auth': APP_AUTH_TOKEN }
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data.success && Array.isArray(data.messages)) renderMessages(data.messages);
        } catch (_) {}
    }

    function renderMessages(messages) {
        const empty = document.getElementById('support-chat-empty');
        if (messages.length === 0) {
            if (empty) empty.style.display = 'flex';
            return;
        }
        if (empty) empty.style.display = 'none';

        // Rebuild only when count changes to avoid scroll jitter
        if (messages.length === lastSupportMsgCount) return;
        lastSupportMsgCount = messages.length;

        // Keep the empty placeholder, replace all msg nodes
        const existing = msgArea.querySelectorAll('.support-msg');
        existing.forEach(el => el.remove());

        messages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `support-msg ${msg.isSupport ? 'from-support' : 'from-user'}`;
            const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const body = msg.isSupport ? formatSupportMessage(msg.text) : escapeHTML(msg.text);
            div.innerHTML = `${body}<span class="support-msg-time">${time}</span>`;
            msgArea.appendChild(div);
        });
        msgArea.scrollTop = msgArea.scrollHeight;
    }

    async function sendMessage() {
        const email = getSupportEmail();
        const text  = input ? input.value.trim() : '';
        if (!text || !email) return;

        input.value = '';
        sendBtn.style.opacity = '0.5';

        // Optimistic bubble
        const tmp = document.createElement('div');
        tmp.className = 'support-msg from-user';
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        tmp.innerHTML = `${escapeHTML(text)}<span class="support-msg-time">${time}</span>`;
        const empty = document.getElementById('support-chat-empty');
        if (empty) empty.style.display = 'none';
        msgArea.appendChild(tmp);
        msgArea.scrollTop = msgArea.scrollHeight;
        lastSupportMsgCount++;

        try {
            await fetch(`${BACKEND_URL}/api/chat/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-whis-auth': APP_AUTH_TOKEN },
                body: JSON.stringify({ email, text, tzOffset: new Date().getTimezoneOffset() })
            });
            fetchHistory();
        } catch (_) {
            whisToast('Could not send message, check your connection', 'error', 3000);
        } finally {
            sendBtn.style.opacity = '';
        }
    }

    if (openBtn)  openBtn.addEventListener('click', openPanel);
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    if (sendBtn)  sendBtn.addEventListener('click', sendMessage);
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        });
    }
})();

// ========================================================
// --- APP USAGE WARNING LOGIC (60-minute tracker) ---
// ========================================================
function startAppUsageTimer() {
    if (appUsageTimer) clearTimeout(appUsageTimer);
    // Fires after 60 minutes
    appUsageTimer = setTimeout(() => {
        showUsageWarning();
    }, 60 * 60 * 1000);
}

function stopAppUsageTimer() {
    if (appUsageTimer) clearTimeout(appUsageTimer);
    if (usageWarningCountdownInterval) clearInterval(usageWarningCountdownInterval);
    if (usageWarningOverlay) usageWarningOverlay.style.display = "none";
}

function showUsageWarning() {
    if (window.WHIS_WEB) return; // no desktop 60-min session nag / quit on the web
    if (usageWarningOverlay) {
        usageWarningOverlay.style.display = "flex";
        let secondsLeft = 60;
        if (usageWarningSec) usageWarningSec.textContent = secondsLeft;

        if (usageWarningCountdownInterval) clearInterval(usageWarningCountdownInterval);
        usageWarningCountdownInterval = setInterval(() => {
            secondsLeft--;
            if (usageWarningSec) usageWarningSec.textContent = secondsLeft;
            if (secondsLeft <= 0) {
                clearInterval(usageWarningCountdownInterval);
                if (window.electronAPI && window.electronAPI.quitApp) {
                    window.electronAPI.quitApp();
                }
            }
        }, 1000);
    }
}

if (usageWarningContinueBtn) {
    usageWarningContinueBtn.addEventListener("click", () => {
        if (usageWarningOverlay) usageWarningOverlay.style.display = "none";
        if (usageWarningCountdownInterval) clearInterval(usageWarningCountdownInterval);
        startAppUsageTimer(); // Restart tracker for another 60 mins
    });
}

if (usageWarningCloseBtn) {
    usageWarningCloseBtn.addEventListener("click", () => {
        if (window.electronAPI && window.electronAPI.quitApp) {
            window.electronAPI.quitApp();
        }
    });
}


// ========================================================
// --- CONTENT ZOOM LOGIC ---
// ========================================================
// The old CSS-variable font scale has been retired. TRUE Electron content
// zoom (webContents.setZoomLevel, applied in the main process) is now the
// SINGLE source of truth for text/layout size. Here we only pin the CSS vars
// to their neutral 1.0 baseline (so nothing is pre-scaled and fights the
// content zoom) and drive the header buttons through the electronAPI bridge.
isCrisp = localStorage.getItem('wh_crisp') === '1';

function updateFontScale() {
    // Keep the CSS vars at their neutral 1.0 baseline. Do NOT read/write
    // wh_fontScale as a scaler anymore, content zoom in main handles sizing.
    const root = document.documentElement;
    root.style.setProperty('--base-font-size', '13px');
    root.style.setProperty('--code-font-size', '11px');
    root.style.setProperty('--title-font-size', '1.2em');
}

// Pin CSS vars to baseline on load
updateFontScale();

// Update the middle reset button label to reflect the current zoom percent.
function applyZoomLabel(state) {
    if (!fontResetBtn) return;
    fontResetBtn.textContent = state && state.percent && state.percent !== 100 ? state.percent + '%' : 'A';
}

if (fontIncBtn)   fontIncBtn.addEventListener("click",   () => { window.electronAPI && window.electronAPI.adjustZoom && window.electronAPI.adjustZoom(+1); });
if (fontDecBtn)   fontDecBtn.addEventListener("click",   () => { window.electronAPI && window.electronAPI.adjustZoom && window.electronAPI.adjustZoom(-1); });
if (fontResetBtn) fontResetBtn.addEventListener("click", () => { window.electronAPI && window.electronAPI.resetZoom  && window.electronAPI.resetZoom(); });

// Sync the label to persisted zoom on startup, and keep it live (keyboard zoom too).
if (window.electronAPI && window.electronAPI.getZoom) window.electronAPI.getZoom().then(applyZoomLabel).catch(() => {});
if (window.electronAPI && window.electronAPI.onZoomChanged) window.electronAPI.onZoomChanged(applyZoomLabel);


// ========================================================
// --- VAD CONFIGURATION ---
// ========================================================
// Two separate thresholds:
// RECORD, anything above this gets buffered (catches quiet video-call audio)
// VISUAL, only above this do the wave bars animate (prevents noise from triggering UI)
const VAD_RECORD_THRESHOLD = 0.002; // lowered: video-call audio is heavily compressed and quiet
const VAD_VISUAL_THRESHOLD = 0.015;
// Minimum peak in a buffer before we send it to transcription. Raised from 0.003 →
// 0.006: real speech peaks well above this, but background music, room tone and video
// intros usually don't, so fewer non-speech clips reach the model (fewer hallucinations)
// while genuine interviewer speech still passes.
const VAD_MIN_SEND_PEAK    = 0.018; // raised: quiet room noise/breathing under this is NOT sent, kills "random words from the air" hallucinations on near-silent clips
// 3 s hangover, covers natural mid-sentence pauses without cutting the recording window
const VAD_HANGOVER_MS = 1500; // reduced: cuts payload size + gets last segment committed faster
let vadLastSpeechTime = 0;
let _currentRmsLevel  = 0; // for real-time level meter
let isVadActive = false;
let _audioDetectedOnce = false; // module-level so startChunkCommitTimer can read it correctly

function calculateRMS(float32Array) {
    let sum = 0;
    for (let i = 0; i < float32Array.length; i++) {
        sum += float32Array[i] * float32Array[i];
    }
    return Math.sqrt(sum / float32Array.length);
}

function updateVADVisuals(isActive) {
    if (isVadActive === isActive) return; 
    isVadActive = isActive;
    
    if (!isAutoMode) {
        const waveContainer = document.querySelector('.wave-container');
        const statusText = document.querySelector('.status-text.listening-indicator');
        
        if (waveContainer) {
            if (isActive) {
                waveContainer.classList.remove('paused');
                if (statusText) statusText.style.opacity = "1";
            } else {
                waveContainer.classList.add('paused');
                if (statusText) statusText.style.opacity = "0.6"; 
            }
        }
    }
}

// ========================================================
// --- SMART PILL CONTAINER LOGIC (Zero Wasted Space) ---
// ========================================================
function checkPillContainer() {
    const container = document.getElementById("pill-container");
    if (!container) return;
    
    // Check if any child inside the pill container is currently visible
    const hasVisibleChildren = Array.from(container.children).some(child => 
        child.style.display !== 'none' && child.style.display !== ''
    );
    
    container.style.display = hasVisibleChildren ? "flex" : "none";
}

// ========================================================
// --- LIVE MINUTES DISPLAY LOGIC ---
// ========================================================
function updateMinutesDisplay(status) {
    if (!appMinutesPill) return;

    if (status && status.active && (status.tier === 'pro' || status.tier === 'pro_plus')) {
        const tierName = status.tier === 'pro_plus' ? 'Elite' : 'Pro';
        
        let mins = "∞";
        if (typeof status.micRemainingSeconds === "number") {
            mins = Math.floor(status.micRemainingSeconds / 60);
        }
        
        appMinutesPill.style.display = "flex";
        appMinutesPill.innerHTML = `
            <i class="fa-solid fa-hourglass-half" style="color:#c3a9ef; font-size:11px; margin-right:6px;"></i> 
            <span style="font-size:11px; color:#e9ecf5; font-weight:500;">${tierName}: ${mins} mins left</span>
        `;
        appMinutesPill.style.alignItems = "center";
        appMinutesPill.style.background = "rgba(0,0,0,0.5)";
        appMinutesPill.style.padding = "5px 12px";
        appMinutesPill.style.borderRadius = "12px";
        appMinutesPill.style.border = "1px solid rgba(255,255,255,0.1)";
    } else {
        appMinutesPill.style.display = "none";
    }

    // Trial-only model: there are no free daily answers, so never show the pill.
    const freeAnswersPill = document.getElementById('free-answers-pill');
    if (freeAnswersPill) freeAnswersPill.style.display = 'none';

    checkPillContainer();
}

// ========================================================
// ========================================================
// --- PERMISSION FLOW (macOS) ---
// ========================================================

// Shared helper, starts the 10-second ring countdown and quits the app.
// Returns a cancel function. Drives the SVG ring and the number.
function _startPermCountdown(onCancel) {
    // WEB: never run the desktop "reopen the app" countdown-and-quit. There is no OS
    // permission to re-grant on relaunch in a browser, and quitApp is a no-op, so this
    // would only leave a dead overlay covering the app. (This was the trial "closed
    // itself after 10 seconds" bug.)
    if (window.WHIS_WEB) return () => {};
    const TOTAL = 10;
    const CIRCUMFERENCE = 213.6;
    const countdownEl = document.getElementById('perm-v2-countdown');
    const ringEl      = document.getElementById('perm-v2-ring-fill');
    let secs = TOTAL;

    if (countdownEl) countdownEl.textContent = secs;
    if (ringEl)      ringEl.style.strokeDashoffset = '0';

    let cancelled = false;
    const interval = setInterval(() => {
        if (cancelled) { clearInterval(interval); return; }
        secs--;
        if (countdownEl) countdownEl.textContent = secs;
        if (ringEl) {
            const depleted = ((TOTAL - secs) / TOTAL) * CIRCUMFERENCE;
            ringEl.style.strokeDashoffset = depleted;
            if (secs <= 3) ringEl.style.stroke = '#f0a030';
        }
        if (secs <= 0) {
            clearInterval(interval);
            if (window.electronAPI && window.electronAPI.quitApp) {
                window.electronAPI.quitApp();
            }
        }
    }, 1000);

    return () => { cancelled = true; clearInterval(interval); };
}

// Called when audio capture fails on macOS, screen recording not granted.
function showScreenPermissionRestartDialog() {
    // WEB ADAPTATION: on the web build there is no macOS TCC screen-recording grant to
    // fix in System Settings, capturing interviewer audio just means picking a tab/window
    // (with "Share tab audio" checked) in the browser's own picker. Show a plain retry
    // message instead of the macOS "open System Settings / reopen app" countdown overlay.
    // (WHIS_WEB, not captureScreen, the web shim PROVIDES captureScreen, so keying off
    // it here would wrongly run the desktop 10-second countdown-and-quit on the web.)
    if (window.WHIS_WEB) {
        whisToast('To hear the interviewer, click <strong>Listen</strong> again and choose the meeting tab/window in the picker, make sure <strong>"Share tab audio"</strong> is checked.', 'warning', 8000);
        return;
    }

    const hr = document.getElementById("header-right");
    if (hr) hr.style.display = "none";

    const iconEl  = document.getElementById('perm-v2-icon');
    const titleEl = document.getElementById('perm-v2-title');
    const subEl   = document.getElementById('perm-v2-sub');
    const step2El = document.getElementById('perm-v2-step2');
    if (iconEl)  iconEl.className    = 'fa-solid fa-display';
    if (titleEl) titleEl.textContent = 'Screen Recording Access Needed';
    if (subEl)   subEl.textContent   = 'Required once so Whis-AI can hear interview audio.';
    if (step2El) step2El.innerHTML   = 'Find <strong>Whis-AI</strong>, toggle <strong class="perm-v2-on">ON</strong>, then reopen the app';

    if (window.electronAPI && window.electronAPI.openMacPrivacySettings) {
        window.electronAPI.openMacPrivacySettings('screen');
    }

    permOverlay.style.display = "flex";
    const cancel = _startPermCountdown();

    const closeBtn = document.getElementById('perm-v2-close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            cancel();
            permOverlay.style.display = "none";
            if (hr) hr.style.display = "";
        };
    }
}

// Show the permission overlay, open System Settings, then close the app after
// a short countdown so macOS can apply the new permission on relaunch.
function showPermissionOverlay(type, resolveCallback) {
    // WEB: the browser grants mic/screen via its own prompt at capture time, never show
    // the macOS "open System Settings, reopen the app" overlay. Resolve so any awaiting
    // flow continues cleanly.
    if (window.WHIS_WEB) { if (typeof resolveCallback === 'function') resolveCallback(true); return; }
    const hr = document.getElementById("header-right");
    if (hr) hr.style.display = "none";

    const isMic   = type === 'mic';
    const iconEl  = document.getElementById('perm-v2-icon');
    const titleEl = document.getElementById('perm-v2-title');
    const subEl   = document.getElementById('perm-v2-sub');
    const step2El = document.getElementById('perm-v2-step2');
    if (iconEl)  iconEl.className    = isMic ? 'fa-solid fa-microphone' : 'fa-solid fa-display';
    if (titleEl) titleEl.textContent = isMic ? 'Microphone Access Needed' : 'Screen Recording Access Needed';
    if (subEl)   subEl.textContent   = 'Required once so Whis-AI can hear interview audio.';
    if (step2El) step2El.innerHTML   = isMic
        ? 'Find <strong>Whis-AI</strong> under Microphone, toggle <strong class="perm-v2-on">ON</strong>, then reopen'
        : 'Find <strong>Whis-AI</strong> under Screen Recording, toggle <strong class="perm-v2-on">ON</strong>, then reopen';

    if (window.electronAPI && window.electronAPI.shrinkForPermission) {
        window.electronAPI.shrinkForPermission();
    }

    const pane = isMic ? 'mic' : 'screen';
    if (window.electronAPI && window.electronAPI.openMacPrivacySettings) {
        window.electronAPI.openMacPrivacySettings(pane);
    }

    permOverlay.style.display = "flex";
    const cancel = _startPermCountdown();

    // X button cancels the countdown, user can stay without granting
    const closeBtn = document.getElementById('perm-v2-close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            cancel();
            permOverlay.style.display = "none";
            if (hr) hr.style.display = "";
            if (window.electronAPI && window.electronAPI.restoreAfterPermission) {
                window.electronAPI.restoreAfterPermission();
            }
            if (typeof resolveCallback === 'function') resolveCallback(false);
        };
    }
}

async function checkAndRequestPermission(type) {
    // WEB: there is no OS-level TCC/permission bridge in a browser, the browser's own
    // getUserMedia/getDisplayMedia prompt handles consent inline. Return true so the
    // capture call proceeds and the native prompt appears (no desktop settings overlay).
    if (window.WHIS_WEB) return true;
    if (!window.electronAPI || !window.electronAPI.checkPermissions) return true;

    const perms = await window.electronAPI.checkPermissions();
    if (perms.os !== 'mac') return true;

    const status = (type === 'mic') ? perms.mic : perms.screen;
    if (status === 'granted') return true;

    return new Promise(async (resolve) => {
        if (type === 'mic' && status === 'not-determined') {
            // askForMediaAccess, main process lowers window before showing dialog
            const granted = await window.electronAPI.requestMicPermission();
            if (granted) return resolve(true);
            // User denied the in-app dialog, fall through to settings overlay
        } else if (type === 'screen' && status === 'not-determined') {
            // Trigger the TCC prompt (no-op on macOS 12+ but harmless)
            // main process lowers window before calling getSources
            await window.electronAPI.requestScreenPermission().catch(() => {});
            // Re-check immediately
            const perms2 = await window.electronAPI.checkPermissions();
            if (perms2.screen === 'granted') return resolve(true);
        }

        // Either still not-determined, or denied, guide user to System Settings
        showPermissionOverlay(type, resolve);
    });
}

// ========================================================
// --- AUTO MODE BACKGROUND PROCESSES ---
// ========================================================
function startAutoRoutines() {
    if (!isAutoMode) return;
    
    startListening();
    
    autoMicResetInterval = setInterval(async () => {
        if (!isAutoMode) return;
        isInternalMicReset = true;
        await stopAndCommitAudio(true);
        setTimeout(() => {
            if (isAutoMode) startListening();
            isInternalMicReset = false;
        }, 150);
    }, 45000);
}

function stopAutoRoutines() {
    if (autoMicResetInterval) clearInterval(autoMicResetInterval);
    stopAndCommitAudio(true);
}

// ========================================================
// --- TOGGLE EVENT LISTENER & OPACITY ---
// ========================================================

const appOpacitySlider = document.getElementById("app-opacity-slider");
if (appOpacitySlider) {
    // Restore saved opacity
    const savedOpacity = localStorage.getItem('wh_opacity');
    if (savedOpacity) { appOpacitySlider.value = savedOpacity; document.body.style.opacity = savedOpacity; }
    appOpacitySlider.addEventListener("input", (e) => {
        document.body.style.opacity = e.target.value;
        localStorage.setItem('wh_opacity', e.target.value);
    });
}

if (modeToggleCheckbox) {
    modeToggleCheckbox.addEventListener("change", (e) => {
        isAutoMode = e.target.checked;
        updateShortcutsUI(); 
        
        if (isAutoMode) {
            // Switch to Auto UI
            manualLabel.style.color = "var(--text-sub)";
            autoLabel.style.color = "#4df4b1";
            voiceBtn.style.display = "none";
            screenshotBtn.style.display = "none";
            clearStagedScreenshot(); 
            
            startAutoRoutines();
        } else {
            // Switch to Manual UI
            manualLabel.style.color = "#4df4b1";
            autoLabel.style.color = "var(--text-sub)";
            voiceBtn.style.display = "flex";
            screenshotBtn.style.display = "flex";
            stopUserMic();

            if (micUsagePill) micUsagePill.style.display = "none";

            stopAutoRoutines();
            clearStagedScreenshot();
        }
        checkPillContainer();
    });
}

// ========================================================
// --- TOUR LOGIC & SHORTCUT POPOVER ---
// ========================================================

if (shortcutToggleBtn) {
    shortcutToggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isVisible = shortcutPopover.style.display === "flex";
        shortcutPopover.style.display = isVisible ? "none" : "flex";
    });
}

function showTourStep(index) {
    // Scroll container back to top on new step
    const scrollContainer = document.getElementById("tour-content-scroll");
    if(scrollContainer) scrollContainer.scrollTop = 0;

    tourSteps.forEach((step, i) => {
        step.style.display = i === index ? "block" : "none";
    });
    tourDots.forEach((dot, i) => {
        dot.classList.toggle("active", i === index);
    });

    if (index === 0) {
        tourBackBtn.style.visibility = "hidden";
    } else {
        tourBackBtn.style.visibility = "visible";
    }

    if (index === tourSteps.length - 1) {
        tourNextBtn.innerHTML = `Finish <i class="fa-solid fa-check"></i>`;
        tourNextBtn.style.background = "linear-gradient(135deg, #c3a9ef, #4df4b1)";
        tourNextBtn.style.color = "#000";
    } else {
        tourNextBtn.innerHTML = `Next <i class="fa-solid fa-arrow-right"></i>`;
        tourNextBtn.style.background = "rgba(255,255,255,0.1)";
        tourNextBtn.style.color = "var(--text-main)";
    }
}

function closeTour() {
    tourOverlay.style.display = "none";
}

if (tourSkipBtn) tourSkipBtn.addEventListener("click", closeTour);

if (tourBackBtn) {
    tourBackBtn.addEventListener("click", () => {
        if (currentTourStep > 0) {
            currentTourStep--;
            showTourStep(currentTourStep);
        }
    });
}

// Add this right below your existing tourNextBtn click listener
if (tourNextBtn) {
    tourNextBtn.addEventListener("click", () => {
        if (currentTourStep < tourSteps.length - 1) {
            currentTourStep++;
            showTourStep(currentTourStep);
        } else {
            closeTour();
        }
    });
}

// NEW: Make the pagination dots clickable for high interactivity
tourDots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
        currentTourStep = index;
        showTourStep(currentTourStep);
    });
});

// ================================================================
// --- WORLD-CLASS INTERACTIVE TOUR ENGINE (IntelliJ-style) ---
// ================================================================

// ── active demo cleanup ──
let _wtDemoInterval = null;
let _wtDemoTimeout  = null;
function _clearWTDemos() {
    if (_wtDemoInterval) { clearInterval(_wtDemoInterval); _wtDemoInterval = null; }
    if (_wtDemoTimeout)  { clearTimeout(_wtDemoTimeout);   _wtDemoTimeout  = null; }
    // Restore input if tour left text there
    const inp = document.getElementById('input');
    if (inp && inp.dataset.wtDemo === '1') { inp.value = ''; inp.dataset.wtDemo = ''; }
    
    // Clean up mock tour messages
    document.querySelectorAll('.demo-msg').forEach(el => el.remove());
    
    // Reset mic status just in case
    const vb = document.getElementById('voice-btn');
    if (vb) vb.classList.remove('active');
    if (listeningStatusEl && listeningStatusEl.innerHTML.includes('DEMO')) {
        listeningStatusEl.innerHTML = '';
        listeningStatusEl.style.display = 'none';
    }
}

// Add these powerful helper functions right below _clearWTDemos():
function _pushFakeDemoMessage(role, text) {
    const messagesContainer = document.getElementById("messages");
    if (!messagesContainer) return null;
    const wrapper = document.createElement("div");
    wrapper.className = `whis-message ${role} demo-msg`;
    const bubble = document.createElement("div");
    bubble.className = "whis-message-bubble";
    bubble.innerHTML = formatMessageContent(text);
    wrapper.appendChild(bubble);
    messagesContainer.appendChild(wrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return bubble;
}

function _streamFakeText(bubbleEl, fullText) {
    let i = 0;
    _wtDemoInterval = setInterval(() => {
        if (i <= fullText.length) {
            bubbleEl.innerHTML = formatMessageContent(fullText.substring(0, i));
            i += 3; // stream 3 chars per tick
            const msgContainer = document.getElementById("messages");
            if(msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
        } else {
            clearInterval(_wtDemoInterval);
            _wtDemoInterval = null;
        }
    }, 15);
}

const _WHIS_TOUR_STEPS_ALL = [
    {
        title: 'A quick 60 second tour',
        tag: '🎯 Your interview copilot',
        body: 'I will show you what each button does. Tap Next to move along, or Skip anytime.',
        tip: 'Everything here is built to make you sound brilliant in a real interview.',
        target: null,
        position: 'center',
    },
    {
        title: 'Listen hears everyone',
        tag: '🎙️ The Listen button',
        body: 'Press this to Listen. It hears both voices, the interviewer through your speakers and you through your mic, and it knows who is speaking. In a real interview it answers the interviewer the moment they finish.',
        tip: 'Shortcut: <strong>⌘/Ctrl + L</strong>',
        target: '#voice-btn',
        position: 'top-right',
    },
    {
        title: window.WHIS_WEB ? 'Snap reads your shared tab' : 'Snap solves what is on your screen',
        tag: '📸 The Snap button',
        body: window.WHIS_WEB
            ? 'Once you share your interview tab or window, Snap grabs the current frame from that share, reads the coding question, and solves it. No new pop-up each time, one share, then just Snap. Great for LeetCode, HackerRank, or a shared doc.'
            : 'Snap grabs whatever coding question is on your screen, reads it, and solves it. Great for LeetCode, HackerRank, or a shared doc.',
        tip: window.WHIS_WEB ? 'Shortcut: <strong>⌘/Ctrl + J</strong>. It samples the tab you shared, not a fresh screenshot.' : 'Shortcut: <strong>⌘/Ctrl + J</strong>. The app hides itself so it never shows up in your own screenshot.',
        target: '#screenshot-btn',
        position: 'top-right',
    },
    {
        title: 'Crisp Mode, short or deep',
        tag: '🎯 The bullseye',
        body: 'Turn it ON for short bullet hints you can glance at while holding eye contact. Turn it OFF for full answers with code and tradeoffs.',
        tip: 'Keep it ON during live interviews.',
        target: '#crisp-toggle',
        position: 'top-left',
    },
    {
        title: 'Your box for typing',
        tag: '✍️ The composer',
        body: 'Type anything here, like "in Python", "STAR format", or "make it shorter". This box is only for what you type. The spoken conversation is captured for you automatically.',
        tip: null,
        target: '.input-container',
        position: 'top',
    },
    {
        title: 'Send, or Stop',
        tag: '🚀 The send button',
        body: 'This sends everything to the AI and streams the answer word by word. While it is answering it turns into a Stop button, so tap it the moment you have enough.',
        tip: 'Shortcut: <strong>⌘/Ctrl + Enter</strong>',
        target: '#send-btn',
        position: 'top-left',
    },
    {
        title: 'Make it about you',
        tag: '📄 Profile, then Manage Contexts',
        body: 'Open your profile here, then Manage Contexts. Add your resume and the job description, and every answer will speak to your stack and your projects instead of generic textbook stuff.',
        tip: 'Personalised answers win interviews.',
        target: '#profile-btn',
        position: 'bottom',
    },
    {
        webHide: true, // stealth proof is desktop-only; the "prove it" button errors in a browser
        title: 'Your interviewer sees nothing',
        tag: '🛡️ Stealth, our biggest edge',
        body: 'This is the part that wins interviews. Whis is invisible to your interviewer. Even if they screen share, record, or take a real screenshot on Mac or Windows, the app simply does not show up. Try it right now and see for yourself.<br><button id="wt-stealth-prove" class="wt-inline-btn"><i class="fa-solid fa-camera"></i> Prove it, take a screenshot</button>',
        tip: 'Nothing to hide manually. You stay completely private the whole interview.',
        target: '#stealth-header-badge',
        position: 'bottom',
        action: () => {
            const b = document.getElementById('wt-stealth-prove');
            if (b) b.addEventListener('click', () => { try { _runStealthVerify(); } catch (_) {} });
        },
    },
    {
        title: 'Try it right now',
        tag: '⚡ A 30 second test drive',
        body: window.WHIS_WEB
            ? 'See it for real.<br>1. Open a coding question &nbsp;<button id="wt-try-leetcode" class="wt-inline-btn"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open a LeetCode</button><br>2. Share that tab (Whis previews it on the right), then press <strong>Snap</strong> to read and solve the question.<br>3. With the tab shared, Whis also hears the interviewer from it and answers as they finish.'
            : 'See it for real.<br>1. Open a coding question &nbsp;<button id="wt-try-leetcode" class="wt-inline-btn"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open a LeetCode</button><br>2. Press <strong>Snap</strong> and watch it solve the question.<br>3. Turn on <strong>Listen</strong> and ask a question out loud, then watch Whis hear you and answer.',
        tip: 'The Snap and Listen buttons are live right now, go ahead and press them.',
        target: null,
        position: 'center',
        interactive: true,
        action: () => {
            const b = document.getElementById('wt-try-leetcode');
            if (b) b.addEventListener('click', () => { try { window.electronAPI.openUrl(DEMO_LEETCODE_URL); } catch (_) {} });
        },
    },
    {
        title: 'This is your unfair advantage',
        tag: '🏆 Go get hired',
        body: 'The people who walk in with Whis walk out with the offer. Do not face the interview that changes your life without it.<br><button id="wt-get-elite" class="wt-inline-btn wt-elite-btn"><i class="fa-solid fa-bolt"></i> Get Elite and land the offer</button>',
        tip: null,
        target: null,
        position: 'center',
        action: () => {
            const b = document.getElementById('wt-get-elite');
            if (b) b.addEventListener('click', () => { closeWhisTour(); try { _showTrialEndedOffer(true); } catch (_) {} });
        },
    },
];

// On web, drop steps that make desktop-only stealth claims / fire browser-breaking flows.
const WHIS_TOUR_STEPS = window.WHIS_WEB
    ? _WHIS_TOUR_STEPS_ALL.filter(s => !s.webHide)
    : _WHIS_TOUR_STEPS_ALL;

let whisTourStep = 0;
let whisTourActive = false;

function openWhisTour() {
    const overlay = document.getElementById('whis-tour');
    if (!overlay) return;
    // Hide free trial CTA while tour is running
    const cta = document.getElementById('free-trial-cta');
    if (cta) cta.style.display = 'none';
    whisTourStep = 0;
    whisTourActive = true;
    overlay.style.display = 'block';
    _buildWTDots();
    _renderWTStep(0);
}

function closeWhisTour() {
    whisTourActive = false;
    _clearWTDemos();
    // Restore any elements the stealth demo may have faded
    const contentArea = document.getElementById('content-area');
    const header = document.querySelector('.whis-global-header');
    [contentArea, header].forEach(el => { if (el) { el.style.transition = ''; el.style.opacity = '1'; } });
    // Clean up mic demo state
    const vb = document.getElementById('voice-btn');
    if (vb) vb.classList.remove('active');
    if (listeningStatusEl && listeningStatusEl.innerHTML.includes('DEMO')) {
        listeningStatusEl.innerHTML = '';
        listeningStatusEl.style.display = 'none';
    }
    const overlay = document.getElementById('whis-tour');
    if (overlay) overlay.style.display = 'none';
    const card = document.querySelector('.wt-card');
    if (card) card.classList.remove('is-complete');
    _clearWTSpotlight();
    updateFreeTrialCTA();
}

function _buildWTDots() {
    const dotsEl = document.getElementById('wt-dots');
    if (!dotsEl) return;
    dotsEl.innerHTML = '';
    document.getElementById('wt-step-total').textContent = WHIS_TOUR_STEPS.length;
    WHIS_TOUR_STEPS.forEach((_, i) => {
        const dot = document.createElement('span');
        dot.className = 'wt-dot' + (i === 0 ? ' active' : '');
        dot.addEventListener('click', () => _renderWTStep(i));
        dotsEl.appendChild(dot);
    });
}

function _clearWTSpotlight() {
    const hole = document.getElementById('wt-hole');
    const ring = document.getElementById('wt-ring');
    const arrow = document.getElementById('wt-arrow-path');
    if (hole)  { hole.setAttribute('width', '0'); hole.setAttribute('height', '0'); }
    if (ring)  ring.style.display = 'none';
    if (arrow) arrow.setAttribute('opacity', '0');
}

function _spotlightWTElement(el) {
    const PAD = 8;
    const r = el.getBoundingClientRect();
    const hole = document.getElementById('wt-hole');
    if (hole) {
        hole.setAttribute('x',      r.left   - PAD);
        hole.setAttribute('y',      r.top    - PAD);
        hole.setAttribute('width',  r.width  + PAD * 2);
        hole.setAttribute('height', r.height + PAD * 2);
        hole.setAttribute('rx', '10');
    }
    const ring = document.getElementById('wt-ring');
    if (ring) {
        ring.style.display = 'block';
        ring.style.left   = (r.left   - PAD) + 'px';
        ring.style.top    = (r.top    - PAD) + 'px';
        ring.style.width  = (r.width  + PAD * 2) + 'px';
        ring.style.height = (r.height + PAD * 2) + 'px';
    }
}

function _positionWTTooltip(targetRect, position) {
    const tip = document.getElementById('wt-tooltip');
    if (!tip) return;
    tip.style.display = 'block';
    tip.style.opacity = '0';

    requestAnimationFrame(() => {
        const MARGIN = 10;
        const W = window.innerWidth;
        const H = window.innerHeight;
        const tW = tip.offsetWidth  || 300;
        const tH = tip.offsetHeight || 240;
        let left, top;

        if (!targetRect || position === 'center') {
            left = W / 2 - tW / 2;
            top  = H / 2 - tH / 2;
        } else {
            const cx = targetRect.left + targetRect.width  / 2;
            const cy = targetRect.top  + targetRect.height / 2;
            switch (position) {
                case 'bottom':       top = targetRect.bottom + MARGIN; left = cx - tW / 2; break;
                case 'bottom-left':  top = targetRect.bottom + MARGIN; left = targetRect.left; break;
                case 'bottom-right': top = targetRect.bottom + MARGIN; left = targetRect.right - tW; break;
                case 'top':          top = targetRect.top - tH - MARGIN; left = cx - tW / 2; break;
                case 'top-left':     top = targetRect.top - tH - MARGIN; left = targetRect.left; break;
                case 'top-right':    top = targetRect.top - tH - MARGIN; left = targetRect.right - tW; break;
                case 'left':         top = cy - tH / 2; left = targetRect.left - tW - MARGIN; break;
                case 'right':        top = cy - tH / 2; left = targetRect.right + MARGIN; break;
                default:             top = H / 2 - tH / 2; left = W / 2 - tW / 2;
            }
            left = Math.max(MARGIN, Math.min(left, W - tW - MARGIN));
            top  = Math.max(MARGIN, Math.min(top,  H - tH - MARGIN));
        }

        tip.style.left = left + 'px';
        tip.style.top  = top  + 'px';
        tip.style.transition = 'opacity 0.22s cubic-bezier(0.25,0.46,0.45,0.94)';
        tip.style.opacity = '1';

        if (targetRect && position !== 'center') {
            _drawWTArrow(targetRect, position);
        }
    });
}

function _drawWTArrow(targetRect, position) {
    const tip = document.getElementById('wt-tooltip');
    const path = document.getElementById('wt-arrow-path');
    if (!tip || !path) return;

    const tRect = tip.getBoundingClientRect();
    const tx = targetRect.left + targetRect.width  / 2;
    const ty = targetRect.top  + targetRect.height / 2;
    let x1, y1, x2, y2;

    switch (position) {
        case 'bottom': case 'bottom-left': case 'bottom-right':
            x1 = tRect.left + tRect.width / 2;
            y1 = tRect.top;
            x2 = tx;
            y2 = targetRect.bottom + 6;
            break;
        case 'top': case 'top-left': case 'top-right':
            x1 = tRect.left + tRect.width / 2;
            y1 = tRect.bottom;
            x2 = tx;
            y2 = targetRect.top - 6;
            break;
        case 'left':
            x1 = tRect.right; y1 = tRect.top + tRect.height / 2;
            x2 = targetRect.left - 6; y2 = ty;
            break;
        case 'right':
            x1 = tRect.left; y1 = tRect.top + tRect.height / 2;
            x2 = targetRect.right + 6; y2 = ty;
            break;
        default: return;
    }

    // Curved quadratic bezier for a nicer arrow
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const cx = mx + (y2 - y1) * 0.15;
    const cy = my - (x2 - x1) * 0.15;
    path.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
    path.setAttribute('opacity', '0.65');
}

function _renderWTStep(index) {
    // Cancel any running demo from previous step
    _clearWTDemos();

    whisTourStep = index;
    const step  = WHIS_TOUR_STEPS[index];
    const total = WHIS_TOUR_STEPS.length;

    // Text content
    document.getElementById('wt-step-num').textContent = index + 1;
    document.getElementById('wt-tag').textContent      = step.tag;
    document.getElementById('wt-title').textContent    = step.title;
    document.getElementById('wt-body').innerHTML       = step.body;

    const tipEl = document.getElementById('wt-tip');
    if (step.tip) { tipEl.innerHTML = step.tip; tipEl.style.display = 'block'; }
    else          { tipEl.style.display = 'none'; }

    // Progress bar
    document.getElementById('wt-progress').style.width = ((index + 1) / total * 100) + '%';

    // Dots
    document.querySelectorAll('.wt-dot').forEach((d, i) => d.classList.toggle('active', i === index));

    // Back button state
    const backBtn = document.getElementById('wt-back');
    if (backBtn) backBtn.disabled = (index === 0);

    // Next / Finish button + last-step effects
    const nextBtn = document.getElementById('wt-next');
    const card    = document.querySelector('.wt-card');
    if (nextBtn) {
        if (index === total - 1) {
            nextBtn.innerHTML = '<i class="fa-solid fa-check"></i> Done!';
            nextBtn.style.background = 'linear-gradient(135deg, #4df4b1, #a8ff78)';
            if (card) card.classList.add('is-complete');
            // Fire confetti after a short pause so the card animation settles
            setTimeout(_fireTourConfetti, 350);
            setTimeout(_fireTourConfetti, 750);
        } else {
            nextBtn.innerHTML = 'Next <i class="fa-solid fa-arrow-right"></i>';
            nextBtn.style.background = '';
            if (card) card.classList.remove('is-complete');
        }
    }

    // Overlay opacity: lighter for center steps (no target), darker for spotlight steps
    const overlayFill = document.getElementById('wt-overlay-fill');

    // Spotlight + position
    _clearWTSpotlight();
    if (step.target) {
        const el = document.querySelector(step.target);
        if (el) {
            if (overlayFill) overlayFill.setAttribute('fill', 'rgba(5,8,22,0.62)');
            _spotlightWTElement(el);
            _positionWTTooltip(el.getBoundingClientRect(), step.position);
        } else {
            if (overlayFill) overlayFill.setAttribute('fill', 'rgba(5,8,22,0.40)');
            _positionWTTooltip(null, 'center');
        }
    } else {
        // No target: gentle vignette only, app clearly visible
        if (overlayFill) overlayFill.setAttribute('fill', 'rgba(5,8,22,0.38)');
        _positionWTTooltip(null, 'center');
    }

    // Interactive steps ("try it now"): let clicks pass THROUGH the dim overlay to the
    // real app so the user can actually press Snap / Listen. The tooltip keeps its own
    // pointer-events:all, so its buttons still work.
    const _tourOverlay = document.getElementById('whis-tour');
    if (_tourOverlay) _tourOverlay.style.pointerEvents = step.interactive ? 'none' : '';

    // Fire live demo action if this step has one (after a short delay)
    if (typeof step.action === 'function') {
        _wtDemoTimeout = setTimeout(() => {
            _wtDemoTimeout = null;
            step.action();
        }, 400);
    }
}

// ── Confetti burst: colorful particles fly up from the card ──
function _fireTourConfetti() {
    const tip = document.getElementById('wt-tooltip');
    if (!tip) return;
    const r = tip.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top  + r.height / 2;

    const colors  = ['#c3a9ef','#4df4b1','#ffffff','#a78bff','#ffd760','#ff6b9d'];
    const shapes  = ['50%','3px','0']; // circle, pill, square
    const count   = 36;
    const tour    = document.getElementById('whis-tour');

    for (let i = 0; i < count; i++) {
        const el   = document.createElement('div');
        const size = 4 + Math.random() * 5;
        const spread = (Math.random() - 0.5) * 180;
        el.className = 'wt-confetti';
        el.style.setProperty('--cc',  colors[Math.floor(Math.random() * colors.length)]);
        el.style.setProperty('--cs',  size + 'px');
        el.style.setProperty('--cbr', shapes[Math.floor(Math.random() * shapes.length)]);
        el.style.setProperty('--cx',  spread + 'px');
        el.style.setProperty('--cr',  (Math.random() * 720 - 360) + 'deg');
        el.style.setProperty('--cd',  (0.6 + Math.random() * 0.6) + 's');
        el.style.left = (cx - size / 2 + (Math.random() - 0.5) * 60) + 'px';
        el.style.top  = (cy - size / 2) + 'px';
        el.style.animationDelay = (Math.random() * 0.25) + 's';
        tour.appendChild(el);
        setTimeout(() => el.remove(), 1400);
    }
}

// Tour button event listeners
(function() {
    const wtNext = document.getElementById('wt-next');
    const wtBack = document.getElementById('wt-back');
    const wtSkip = document.getElementById('wt-skip');

    if (wtNext) {
        wtNext.addEventListener('click', () => {
            // Ripple effect on button
            wtNext.classList.add('ripple');
            setTimeout(() => wtNext.classList.remove('ripple'), 460);

            if (whisTourStep < WHIS_TOUR_STEPS.length - 1) {
                _renderWTStep(whisTourStep + 1);
            } else {
                closeWhisTour();
            }
        });
    }
    if (wtBack) {
        wtBack.addEventListener('click', () => {
            if (whisTourStep > 0) _renderWTStep(whisTourStep - 1);
        });
    }
    if (wtSkip) {
        wtSkip.addEventListener('click', closeWhisTour);
    }
})();

// ================================================================
// --- FREE TRIAL CTA LOGIC (center-screen button for free users) ---
// ================================================================

function updateFreeTrialCTA() {
    const cta       = document.getElementById('free-trial-cta');
    const headerBtn = document.getElementById('header-trial-btn');

    const isEligible = isFreeTier
        && !subscriptionIsActive
        && !subscriptionIsTrial
        && currentTrialUsage < maxTrialSessions;

    // Single trial prompt only: the premium trial MODAL is the one banner users see
    // (it auto-opens on launch). The old floating center card was a second, mismatched
    // banner, keep it permanently hidden so there's never two competing prompts.
    if (cta) cta.style.display = 'none';

    // Header "Try Free" button: a small, non-blocking re-entry point (not a banner) so
    // users who dismissed the modal can still start a trial on their own terms.
    if (headerBtn) headerBtn.style.display = isEligible ? 'flex' : 'none';

    // Lock/unlock the composer to match entitlement (no typing without a trial/plan).
    if (typeof _applyComposerLock === 'function') _applyComposerLock();

    if (isEligible) {
        const left = maxTrialSessions - currentTrialUsage;
        const sessionsText = document.getElementById('free-trial-sessions-text');
        if (sessionsText) sessionsText.textContent = `Free ${trialDurationMinutes}-minute trial · full access`;
        if (headerBtn) headerBtn.title = `Free ${trialDurationMinutes}-minute trial`;
    }
}

const freeTrialCtaBtn    = document.getElementById('free-trial-cta-btn');
const headerTrialBtn     = document.getElementById('header-trial-btn');
if (freeTrialCtaBtn) freeTrialCtaBtn.addEventListener('click', openTrialModal);
if (headerTrialBtn)  headerTrialBtn.addEventListener('click',  openTrialModal);

// ========================================================
// --- 1. System UI & Shortcuts Logic ---
// ========================================================
function updateShortcutsUI() {
    const enterSym = isMac ? '↵' : 'Enter';
    const backSym = isMac ? '⌫' : 'Del';
    
    // Core shortcuts available in all modes.
    // WEB: a browser tab can't hide/quit/move the window, only Clear Chat works.
    const baseShortcuts = window.WHIS_WEB
        ? [ { key: `${CTRL}+${backSym}`, label: 'Clear Chat' } ]
        : [
            { key: `${CTRL}+H`, label: 'Hide / Show App' },
            { key: `${CTRL}+${backSym}`, label: 'Clear Chat' },
            { key: `${CTRL}+Q`, label: 'Quit App' },
            { key: `${CTRL}+Arrows`, label: 'Move Window' },
            { key: `${CTRL}+ +`, label: 'Bigger Text (- smaller, 0 reset)' }
        ];

    let popoverShortcuts = [];
    let inlineShortcuts = [];

    if (isAutoMode) {
        popoverShortcuts = [
            { key: `${CTRL}+${enterSym}`, label: 'Send (Auto-Capture)' },
            ...baseShortcuts
        ];
        inlineShortcuts = window.WHIS_WEB
            ? [ { key: `${CTRL}+${enterSym}`, label: 'Send' } ]
            : [
                { key: `${CTRL}+H`, label: 'Hide' },
                { key: `${CTRL}+${enterSym}`, label: 'Send' }
            ];
    } else {
        popoverShortcuts = [
            { key: `${CTRL}+L`, label: 'Toggle Mic (Listen)' },
            { key: `${CTRL}+J`, label: 'Screenshot (Jot)' },
            { key: `${CTRL}+${enterSym}`, label: 'Send' },
            ...baseShortcuts
        ];
        inlineShortcuts = window.WHIS_WEB
            ? [
                { key: `${CTRL}+L`, label: 'Mic' },
                { key: `${CTRL}+J`, label: 'Snap' }
            ]
            : [
                { key: `${CTRL}+H`, label: 'Hide' },
                { key: `${CTRL}+L`, label: 'Mic' },
                { key: `${CTRL}+J`, label: 'Snap' }
            ];
    }

    // Render Compact Highlighted Inline Shortcuts
    if (usageShortcutsContainer) {
        usageShortcutsContainer.innerHTML = inlineShortcuts.map(s =>
            `<span class="inline-shortcut-item"><b>${s.key.replace(/\s/g, '')}</b> ${s.label}</span>`
        ).join('');
    }

    // Render Full List in Popover
    if (usageShortcutsPopoverContainer) {
        usageShortcutsPopoverContainer.innerHTML = popoverShortcuts.map(s =>
            `<span><b>${s.key.replace(/\s/g, '')}</b> ${s.label}</span>`
        ).join('');
    }

    if (IS_MOBILE_WEB) {
        // Phones have no keyboard shortcuts, keep the prompt simple and action-led.
        inputEl.placeholder = isAutoMode ? 'Add a note or follow-up…' : 'Ask anything, tap the mic to speak…';
    } else if (isAutoMode) {
        inputEl.placeholder = `Add a note or follow-up… (${CTRL}+↵ to send)`;
    } else {
        inputEl.placeholder = `Ask a question, or use ${CTRL}+L / ${CTRL}+J…`;
    }

    updateContextHint();
}

// Wire up keyboard shortcuts, L = Listen (mic), J = Jot (screenshot)
document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        if (!isAutoMode) { e.preventDefault(); toggleRecording(); }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        if (!isAutoMode && !_demoActive) { e.preventDefault(); handleScreenshotStage(); }
    }
});

function updateHeaderVisibility(isAuthenticated) {
  headerRight.style.visibility = isAuthenticated ? "visible" : "hidden";
  // Re-assert display too: permission overlays hide header-right with display:none and
  // don't always restore it, which is why the profile symbol kept disappearing. Any auth
  // refresh now brings it back so the profile is ALWAYS there once signed in.
  if (isAuthenticated) headerRight.style.display = "";
}

async function checkAuth(showToast = false) {
  if (showToast && listeningStatusEl) {
    listeningStatusEl.textContent = "Refreshing status...";
    listeningStatusEl.classList.add("active");
    listeningStatusEl.style.display = "flex";
  }

  try {
    const { user } = await window.electronAPI.checkAuth();
    if (user) {
      await handleUserPostLogin(user);
      if (showToast) {
        listeningStatusEl.innerHTML = `<div class="wave-and-text"><span class="status-text" style="color:#4df4b1">✓ Status Refreshed</span></div>`;
        setTimeout(() => {
          listeningStatusEl.classList.remove("active");
          listeningStatusEl.innerHTML = "";
          listeningStatusEl.style.display = "none";
        }, 2000);
      }
    } else {
      showLogin();
    }
  } catch (err) {
    console.error("Auth check failed", showLogin());
  }
}

async function handleUserPostLogin(user) {
  const googleId = user.googleId || user.id;

  // Stop any running heartbeat BEFORE rotating the session. Otherwise the old
  // heartbeat can fire a check with the pre-rotation session ID mid-rotation and
  // get a false "session invalid" (this is what abruptly stopped the app right
  // after starting a trial).
  stopSessionHeartbeat();
  _sessionInvalidStrikes = 0;

  try {
      const newSessionId = await window.electronAPI.rotateSession(googleId);
      currentSessionId = newSessionId || user.currentSessionId;
  } catch (e) {
      currentSessionId = user.currentSessionId;
  }

  try {
    const status = (await window.electronAPI.checkSubscription(googleId, currentSessionId)) || {};
    
    if (status.sessionInvalid) {
         // Never quit abruptly on a session check. This can fire transiently right
         // after a session rotation (e.g. starting a trial). Lock gracefully instead;
         // the user can reopen to reclaim the session on this device.
         stopSessionHeartbeat();
         showSubscriptionLock(user, window.WHIS_WEB
             ? "Your session was opened on another device. Reload this page and sign in again."
             : "Your session was opened on another device. Reopen the app to continue here.");
         return;
    }
    _sessionInvalidStrikes = 0;

    startSessionHeartbeat(googleId);

    subscriptionTier = status.tier || null;
    const isActive = !!status.active;
    isFreeTier = subscriptionTier === "free";
    subscriptionValidUntil = status.validUntil || null;
    subscriptionOrders = status.orders || [];
    subscriptionStatusObj = status;

    updateMinutesDisplay(status);

    if (status.micUsageEnforced && status.micRemainingSeconds <= 0) {
        showSubscriptionLock(user, "App minutes exhausted. Please upgrade or renew.");
        return; 
    }

    maxTrialSessions = status.maxTrialSessions || 2;
    trialDurationMinutes = status.trialDurationMinutes || 5;
    // Daily reset: if server's lastTrialDate is not today, the count from server is already reset
    currentTrialUsage = status.trialUsage ? (status.trialUsage.count || 0) : 0;
    const isTrialActive = !!status.isTrial;

    subscriptionIsActive = isActive;
    subscriptionIsTrial = isTrialActive;

    // Re-arm the end-of-entitlement lock whenever the user is genuinely entitled,
    // so a later lapse re-locks. Also keep the composer in sync with entitlement.
    if (isActive || isTrialActive) _entitlementEnded = false;
    if (typeof _applyComposerLock === 'function') _applyComposerLock();

    // Free users and Elite (pro_plus) users get OS-level screenshare invisibility.
    // Pro users do not, content protection is deliberately not set for them.
    const shouldProtect = isFreeTier || (subscriptionTier === "pro_plus" && isActive);
    await window.electronAPI.setWindowProtection(shouldProtect);
    _updateStealthBadge(shouldProtect);

    if (isTrialActive && status.validUntil) {
        _entitlementEnded = false; // re-arm the end-of-trial lock for this active trial
        _peakEmotionNudgeShown = false; // fresh trial → allow one peak-emotion nudge
        _trackFunnel('trial_active');
        startTrialTimer(status.validUntil, status.serverTime);
        trialTimerContainer.style.display = "flex";
        showTrialMotivation(true);
    } else {
        stopTrialTimer();
        trialTimerContainer.style.display = "none";
        showTrialMotivation(false);
        if (isFreeTier && !subscriptionIsActive) {
            if (currentTrialUsage < maxTrialSessions) {
                // WEB TRIAL-FIRST GATE (additive, web-only): on the web build we present
                // the "Start Your Free Elite Trial" choice UP FRONT, before the copilot
                // is usable, instead of dropping the user into a working app and popping
                // the modal after. We show the (locked) subscription surface as the base
                // so the composer/mic aren't reachable, then open the trial modal on top,
                // and RETURN before showApp(). Closing the modal ("Maybe Later"/X) leaves
                // the user on the lock screen, where "Use Free Pass" reopens this modal.
                // Guarded on window.WHIS_WEB so the DESKTOP flow is unchanged, and only
                // reached by genuinely non-entitled free users (active/trial users took the
                // branch above and go straight into showApp()).
                if (window.WHIS_WEB) {
                    showSubscriptionLock(user, "Start your free trial to begin, full access, no card needed.");
                    if (lockStartTrialBtn) lockStartTrialBtn.style.display = "block";
                    if (!_trialModalAutoShown) {
                        _trialModalAutoShown = true;
                        setTimeout(() => openTrialModal(), 250);
                    }
                    return;
                }
                // Desktop: keep the original behaviour, show the app, auto-open the modal
                // ONCE per session (re-opening it on every status refresh is what made the
                // app feel like it was glitching).
                if (!_trialModalAutoShown) {
                    _trialModalAutoShown = true;
                    setTimeout(() => openTrialModal(), 600);
                }
            } else {
                // Both trials exhausted, hard lock, do NOT show app
                _showTrialsExhausted(user);
                return;
            }
        }
    }

    showApp(user);
    try { _renderInterviewCountdownPill(); } catch (_) {}

    // Guided tour: show it once per app launch for entitled users (paid AND trial), so
    // it reappears every time they close and reopen. Gated on wh_stealth_ok so the very
    // first launch is owned by the stealth wizard (which fires the tour itself).
    // First capture the user's real interview (the conversion anchor). If the modal
    // shows, it chains the tour on close; otherwise fall back to the tour directly.
    const _onboardShown = maybeShowInterviewOnboarding();
    if (!_onboardShown && (isActive || isTrialActive) && !hasShownTourThisSession && localStorage.getItem('wh_stealth_ok')) {
        hasShownTourThisSession = true;
        setTimeout(() => { try { openWhisTour(); } catch (_) {} }, 800);
    }

    // WEB: once an entitled user reaches a usable state, make the answer loop
    // discoverable (type / Listen / mic). Fires at most once ever (localStorage-gated),
    // so returning users aren't nagged. Skipped for locked/free users (nothing to do yet).
    if (window.WHIS_WEB && (isActive || isTrialActive)) {
        _showWebFirstRunHintOnce();
    }

    const upgradeItem = document.getElementById("upgrade-btn");
    
    if (isTrialActive) {
        upgradeItem.innerHTML = `<i class="fa-solid fa-bolt" style="color:#ffd700"></i> Trial Active`;
        menuStartTrialBtn.style.display = "none"; 
    } else if (isActive && (subscriptionTier === 'pro' || subscriptionTier === 'pro_plus')) {
        upgradeItem.innerHTML = `<i class="fa-solid fa-gem"></i> Manage Subscription`;
        menuStartTrialBtn.style.display = "none";
    } else {
        upgradeItem.innerHTML = window.WHIS_WEB
            ? `<i class="fa-solid fa-crown"></i> Upgrade to Elite`
            : `<i class="fa-solid fa-crown"></i> Upgrade to Pro`;

        if (currentTrialUsage < maxTrialSessions) {
            menuStartTrialBtn.style.display = "block";
            menuStartTrialBtn.innerHTML = `<i class="fa-solid fa-stopwatch" style="color:#4df4b1;"></i> ${trialDurationMinutes}m Free Trial`;

            lockStartTrialBtn.style.display = "block";
            lockStartTrialBtn.innerHTML = `<i class="fa-solid fa-bolt"></i> ${trialDurationMinutes}-Min Free Trial`;
        } else {
             menuStartTrialBtn.style.display = "none";
             lockStartTrialBtn.style.display = "none";
        }
    }

    // Persistent upgrade pill, show for everyone EXCEPT genuine paid Elite users.
    // Trial users (Elite trial: tier is pro_plus) MUST still see it, that's when
    // most people decide to buy.
    const upgradeFab = document.getElementById('upgrade-fab');
    if (upgradeFab) {
        const isPaidElite = isActive && subscriptionTier === 'pro_plus' && !isTrialActive;
        // One upgrade CTA at a time: during the trial the top motivation bar already shows
        // "Get Elite", so hide this fab then. Free / trial-ended users still get the fab.
        upgradeFab.style.display = (isPaidElite || isTrialActive) ? 'none' : 'inline-flex';
    }

    await fetchContexts();
    updateFreeTrialCTA();

  } catch (e) {
    showSubscriptionLock(user, "Could not verify subscription.");
  }
}

// --- TRIAL TIMER LOGIC ---
// Single source of truth = the server's `validUntil`. We never guess the duration
// locally (that caused the 10:00 → 5:00 jump: the first trial is 10 min, but the
// old local math used the 5-min "subsequent trial" value). Clock skew between the
// device and server is corrected using the server's reported `serverTime`, so the
// countdown is both accurate and consistent from the very first frame.
// ── Trial motivation bar, a slim, glowing top nudge toward Elite during the trial.
// 100% noticeable (gentle pulse + rotating lines) but never blocks or interrupts.
const _TMB_LINES = [
    "Size doesn't matter, but your salary does.",
    "Small app. Big fat offer.",
    "Your competition is already using it.",
    "Nail the interview, name your salary.",
    "One great answer from the offer.",
    "Cheaper than an hour of the job you want."
];
let _tmbIdx = 0, _tmbTimer = null;
function _tmbRotate() {
    const el = document.getElementById('trial-motivation-text');
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => {
        el.textContent = _TMB_LINES[_tmbIdx % _TMB_LINES.length];
        _tmbIdx++;
        el.style.opacity = '1';
    }, 400);
}
function showTrialMotivation(on) {
    const bar = document.getElementById('trial-motivation-bar');
    if (!bar) return;
    if (on) {
        bar.style.display = 'flex';
        if (!_tmbTimer) { _tmbRotate(); _tmbTimer = setInterval(_tmbRotate, 9000); }
    } else {
        bar.style.display = 'none';
        if (_tmbTimer) { clearInterval(_tmbTimer); _tmbTimer = null; }
    }
}
(function _wireTmbCta() {
    const cta = document.getElementById('trial-motivation-cta');
    if (cta) cta.addEventListener('click', () => { try { _showTrialEndedOffer(true); } catch (_) {} });
})();

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSION: interview capture + funnel tracking + peak-emotion nudge
// -----------------------------------------------------------------------------
// The whole strategy hangs on one thing: connect the moment of value to the user's
// REAL upcoming interview. We capture it once at onboarding (stored locally so it
// always powers the in-app countdown, plus best-effort synced to the backend for
// personalized win-back emails), then weave a personalized deadline into the paywall.
// Everything here is additive and defensive, any failure is swallowed so nothing
// the user relies on can break.
// ═══════════════════════════════════════════════════════════════════════════════
const WH_INTERVIEW_KEY  = 'wh_interview';       // JSON { date, company, role }
const WH_INTERVIEW_SEEN = 'wh_interview_seen';  // '1' once onboarding has been shown
let _peakEmotionNudgeShown = false;             // one nudge per trial session

function getInterview() {
    try { return JSON.parse(localStorage.getItem(WH_INTERVIEW_KEY) || 'null'); } catch (_) { return null; }
}
function interviewDaysLeft(iv) {
    const d = iv && iv.date ? new Date(iv.date) : null;
    if (!d || isNaN(d.getTime())) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(d); target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
}
function _trackFunnel(event, context, metadata) {
    try {
        const gid = currentUser ? (currentUser.googleId || currentUser.id) : null;
        if (window.electronAPI && window.electronAPI.trackEvent)
            window.electronAPI.trackEvent({ googleId: gid, event, context, metadata });
    } catch (_) { /* tracking must never break the app */ }
}

function maybeShowInterviewOnboarding() {
    try {
        if (window.WHIS_WEB) return false; // web: value-first, don't wall the welcome
        if (!currentUser) return false;
        if (localStorage.getItem(WH_INTERVIEW_SEEN)) return false;
        const ov = document.getElementById('interview-onboard-overlay');
        if (!ov) return false;
        const iv = getInterview();
        if (iv) {
            if (iv.company) { const el = document.getElementById('io-company'); if (el) el.value = iv.company; }
            if (iv.bucket)  { document.querySelectorAll('#io-chips .io-chip').forEach(c => { if (c.textContent.trim() === iv.bucket) c.classList.add('on'); }); }
        }
        ov.style.display = 'flex';
        _trackFunnel('interview_onboard_shown');
        return true;
    } catch (_) { return false; }
}

function _closeInterviewOnboarding() {
    const ov = document.getElementById('interview-onboard-overlay');
    if (ov) ov.style.display = 'none';
    try { localStorage.setItem(WH_INTERVIEW_SEEN, '1'); } catch (_) {}
    // Chain the guided tour afterwards so the two never overlap.
    try {
        if (!hasShownTourThisSession && localStorage.getItem('wh_stealth_ok') && (subscriptionIsActive || subscriptionIsTrial)) {
            hasShownTourThisSession = true;
            setTimeout(() => { try { openWhisTour(); } catch (_) {} }, 400);
        }
    } catch (_) {}
}

function _saveInterviewFromModal() {
    const sel    = document.querySelector('#io-chips .io-chip.on');
    const compEl = document.getElementById('io-company');
    const company = compEl && compEl.value ? compEl.value.trim() : null;
    let date = null, bucket = null;
    if (sel) {
        bucket = sel.textContent.trim();
        const days = sel.getAttribute('data-days');
        if (days !== '' && days != null) {
            const d = new Date(); d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + parseInt(days, 10));
            date = d.toISOString().slice(0, 10);
        }
    }
    try { localStorage.setItem(WH_INTERVIEW_KEY, JSON.stringify({ date, company, role: null, bucket })); } catch (_) {}
    try {
        const gid = currentUser ? (currentUser.googleId || currentUser.id) : null;
        if (gid && window.electronAPI && window.electronAPI.saveInterview)
            window.electronAPI.saveInterview({ googleId: gid, date, company, role: null });
    } catch (_) {}
    _trackFunnel('interview_saved', bucket || undefined, { hasDate: !!date });
    try { _renderInterviewCountdownPill(); } catch (_) {}
    _closeInterviewOnboarding();
}

(function _wireInterviewOnboarding() {
    const chips = document.getElementById('io-chips');
    if (chips) chips.addEventListener('click', (e) => {
        const btn = e.target.closest('.io-chip');
        if (!btn) return;
        chips.querySelectorAll('.io-chip').forEach(c => c.classList.remove('on'));
        btn.classList.add('on');
    });
    const save = document.getElementById('io-save');
    const skip = document.getElementById('io-skip');
    const x    = document.getElementById('io-x');
    if (save) save.addEventListener('click', _saveInterviewFromModal);
    if (skip) skip.addEventListener('click', _closeInterviewOnboarding);
    if (x)    x.addEventListener('click', _closeInterviewOnboarding);
})();

// Personalized deadline line on the paywall, only when the user gave a future date.
function _renderInterviewCountdown() {
    const el = document.getElementById('trial-offer-countdown');
    if (!el) return;
    const recapEl = document.getElementById('trial-offer-recap');
    const iv = getInterview();
    const days = interviewDaysLeft(iv);
    // No usable date → keep the generic recap, hide the countdown.
    if (days === null || days < 0) { el.style.display = 'none'; return; }
    const who = iv.company ? `Your ${iv.company} interview` : 'Your interview';
    let phrase;
    if (days === 0)      phrase = `${who} is <span class="io-days">today</span>, walk in with Whis.`;
    else if (days === 1) phrase = `${who} is <span class="io-days">tomorrow</span>, don't go in without your edge.`;
    else                 phrase = `${who} is in <span class="io-days">${days} days</span>, be the one who walks in ready.`;
    el.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> ${phrase}`;
    el.style.display = '';
    // Occupy the same slot as the recap (zero net height added to the fitted card).
    if (recapEl) recapEl.style.display = 'none';
}

// Persistent header pill: a live countdown to the user's interview. This is the
// visible payoff for the onboarding question, the app quietly becomes "their
// interview tool." Shows only when a future date exists; hidden otherwise.
function _renderInterviewCountdownPill() {
    const pill = document.getElementById('interview-countdown-pill');
    if (!pill) return;
    const iv = getInterview();
    const days = interviewDaysLeft(iv);
    if (days === null || days < 0) { pill.style.display = 'none'; try { checkPillContainer(); } catch (_) {} return; }
    const label = days === 0 ? 'Interview today'
                : days === 1 ? 'Interview tomorrow'
                : `Interview in ${days}d`;
    const co = iv.company ? ` · ${escapeHTML(iv.company)}` : '';
    pill.innerHTML = `<i class="fa-solid fa-hourglass-half" style="color:#ffb020; font-size:11px; margin-right:6px;"></i>` +
                     `<span style="font-size:11px; color:#ffd9a0; font-weight:600;">${label}${co}</span>`;
    pill.style.display = 'flex';
    pill.style.alignItems = 'center';
    pill.style.background = 'rgba(255,170,0,0.10)';
    pill.style.padding = '5px 12px';
    pill.style.borderRadius = '12px';
    pill.style.border = '1px solid rgba(255,170,0,0.28)';
    try { checkPillContainer(); } catch (_) {}
}

// Non-blocking upgrade nudge fired once per trial, right after a strong answer.
function _maybeShowPeakEmotionNudge() {
    try {
        if (!subscriptionIsTrial || _peakEmotionNudgeShown) return;
        const lastA = [...(state.messages || [])].reverse().find(m => m.role === 'assistant');
        if (!lastA || !lastA.content || lastA.content.trim().length < 120) return;
        _peakEmotionNudgeShown = true;
        _trackFunnel('peak_nudge_shown');
        whisToast('That’s the answer that gets offers. Keep it for the interview that counts.', 'info', 6000,
            { action: { label: 'Get Elite', fn: () => { _trackFunnel('peak_nudge_clicked'); try { _showTrialEndedOffer(true); } catch (_) {} } } });
    } catch (_) { /* nudge is a bonus, never break the chat */ }
}

function startTrialTimer(expiryIsoString, serverTimeIso) {
    if (trialTickerInterval) clearInterval(trialTickerInterval);

    const expiryTime = new Date(expiryIsoString).getTime();
    if (isNaN(expiryTime)) return;

    // Offset to translate the local clock into "server time".
    let skew = 0;
    if (serverTimeIso) {
        const serverNow = new Date(serverTimeIso).getTime();
        if (!isNaN(serverNow)) skew = serverNow - Date.now();
    }

    const tick = () => {
        const diff = expiryTime - (Date.now() + skew);

        if (diff <= 0) {
            stopTrialTimer();
            trialTimerText.textContent = "0:00";
            try { localStorage.removeItem('trialStartLocal'); } catch (_) {}
            // Lock immediately and locally, no glitchy "Refreshing status…" round-trip.
            lockAfterEntitlementEnd();
            // Sync with the server once in the background (authoritative; no UI churn).
            checkAuth(false);
            return;
        }

        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        trialTimerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        trialTimerContainer.classList.toggle("urgent", diff < 60000);

        // Last-minute nudge: make the persistent upgrade banner urgent + clearer so we
        // catch the decision at peak engagement, right before access ends.
        const _fab = document.getElementById('upgrade-fab');
        if (_fab && _fab.style.display !== 'none') {
            const urgent = diff < 60000;
            _fab.classList.toggle('ending', urgent);
            const _lbl = _fab.querySelector('span');
            const wanted = urgent ? 'Trial ending, keep your edge' : 'Upgrade to Elite';
            if (_lbl && _lbl.textContent !== wanted) _lbl.textContent = wanted;
        }
    };

    tick();                                  // render correct value immediately (no placeholder flash)
    trialTickerInterval = setInterval(tick, 1000);
}

function stopTrialTimer() {
    if (trialTickerInterval) {
        clearInterval(trialTickerInterval);
        trialTickerInterval = null;
    }
}

// CRITICAL (revenue): the instant a trial or paid plan ends, lock the app HARD and
// locally, do not wait on async status round-trips (that left a window where usage
// felt available). Flips entitlement to free/locked, stops live capture, locks the
// composer, and shows one upgrade CTA. Idempotent via _entitlementEnded so it can't
// spam; re-armed when a new trial/plan becomes active in handleUserPostLogin.
function lockAfterEntitlementEnd() {
    if (_entitlementEnded) return;
    _entitlementEnded = true;

    try { if (typeof isListening !== 'undefined' && isListening) stopAndCommitAudio(true); } catch (_) {}
    stopTrialTimer();
    if (trialTimerContainer) trialTimerContainer.style.display = 'none';
    showTrialMotivation(false);

    subscriptionIsTrial  = false;
    subscriptionIsActive = false;
    subscriptionTier     = 'free';
    isFreeTier           = true;
    try { localStorage.removeItem('trialStartLocal'); } catch (_) {}

    if (typeof _applyComposerLock === 'function') _applyComposerLock();
    if (typeof updateFreeTrialCTA === 'function') updateFreeTrialCTA();

    _showTrialEndedOffer();
}

// Premium "trial complete" reward: surface the quarterly discount the user has
// unlocked (server-provided % via status.trialQuarterlyDiscount) with a single
// beautiful CTA straight to the pricing page. Shows whether the trial completed
// fully or the user ended it early, both count as "done".
function _showTrialEndedOffer(manual) {
    const s = subscriptionStatusObj || {};
    const pct  = s.trialRewardPct ?? s.trialQuarterlyDiscount ?? 10;
    const code = s.trialRewardCoupon || s.trialQuarterlyCoupon || '';
    // Region-aware plan label: India → 3-month (quarterly); else → 6-month (semiannual).
    const cycle = s.trialRewardCycle || 'quarterly';
    const planLabel = cycle === 'semiannual' ? '6-month plan' : '3-month plan';
    const overlay = document.getElementById('trial-offer-overlay');

    // Fallback if the premium card isn't available for any reason.
    if (!overlay || pct <= 0) {
        whisToast("Your trial's done. Don't walk into your next interview without the edge you just felt.", 'warning', 0,
            { action: { label: 'Get Elite', fn: () => window.electronAPI.openSubscriptionPage() } });
        return;
    }

    const pctEl    = document.getElementById('trial-offer-pct');
    const planEl   = document.getElementById('trial-offer-plan');
    const codeText = document.getElementById('trial-offer-code-text');
    const codeBtn  = document.getElementById('trial-offer-code');
    const codeLbl  = document.querySelector('.trial-offer-code-label');
    const applyEl  = document.querySelector('.trial-offer-apply');
    if (pctEl)  pctEl.textContent = `${pct}%`;
    if (planEl) planEl.textContent = planLabel;

    // ALWAYS show a real, copyable code. The backend always provides the region-correct
    // one; the fallback mirrors the matching cycle's default (never cross-region).
    const finalCode = code || (cycle === 'semiannual' ? 'WHIS10H' : 'WHIS10Q');
    if (codeText) codeText.textContent = finalCode;
    if (codeBtn)  { codeBtn.style.display = ''; codeBtn.classList.remove('copied'); }
    if (codeLbl)  { codeLbl.style.display = ''; codeLbl.textContent = 'Your coupon code, tap to copy'; }
    if (applyEl)  applyEl.innerHTML = '<i class="fa-solid fa-circle-info"></i> Copy this code and apply it during payment to get your discount.';

    // ── Personalized recap, proof of what THEY just did in the trial. This is the
    // most persuasive line on the card: it credits the user, then the headline turns
    // that into aspiration ("now imagine that for real"). Real answers use `assistant-`
    // IDs (the welcome/demo bubbles don't), so we count only genuine trial answers.
    try {
        // Manual opens (the persistent "Get Elite" pill) aren't a trial ending, hide the
        // "Trial Complete" badge and skip the "you just answered N" recap.
        const badgeEl = document.querySelector('#trial-offer-overlay .trial-offer-badge');
        if (badgeEl) badgeEl.style.display = manual ? 'none' : '';
        const recapEl = document.getElementById('trial-offer-recap');
        if (recapEl) {
            const n = manual ? 0 : (state.messages || []).filter(m =>
                m.role === 'assistant' && typeof m.id === 'string' &&
                m.id.startsWith('assistant-') && m.content && m.content.trim().length > 20
            ).length;
            if (n >= 1) {
                const noun = n === 1 ? 'question' : 'questions';
                recapEl.innerHTML = `You just answered <b>${n}</b> ${noun} like a pro.`;
            } else {
                recapEl.textContent = 'You just felt the edge. Keep it for the interview that counts.';
            }
            recapEl.style.display = '';
        }
    } catch (_) { /* recap is a bonus, never block the offer */ }

    try { _renderInterviewCountdown(); } catch (_) { /* countdown is a bonus */ }
    _trackFunnel('paywall_shown', manual ? 'manual' : 'trial_end');

    overlay.style.display = 'flex';
    _tpLoadPricing();
    _tpStartAutoCycle();
}

// ── In-app plan pricing for the trial-ended overlay ──────────────────────────
// Fetches geo-adjusted prices so the user picks a plan IN the app, then jumps
// straight to the pre-authenticated payment sheet (no website re-login).
let _tpCycle = 'monthly';
let _tpConf  = null;
let _tpCur   = 'INR';   // currency the user is shown (by timezone), passed to checkout so the charge matches

// Minimal user object the website needs to auto-login (same shape the backend OAuth
// encodes): googleId + display fields. The website's fetchUserStatus re-syncs the rest.
function _buildCheckoutUser() {
    if (!currentUser) return null;
    return {
        googleId: currentUser.googleId || currentUser.id,
        name:     currentUser.name || '',
        email:    currentUser.email || '',
        picture:  currentUser.picture || currentUser.avatar || ''
    };
}

async function _tpLoadPricing() {
    try {
        if (!_tpConf) _tpConf = await (await fetch(`${BACKEND_URL}/api/config`)).json();
        _tpRenderPricing();
        // Live social proof, a real-feeling "others are using it right now" count.
        const liveEl = document.getElementById('trial-offer-live');
        if (liveEl) {
            const lo = _tpConf.liveUsersMin || 850, hi = _tpConf.liveUsersMax || 1400;
            liveEl.textContent = Math.floor(lo + Math.random() * (hi - lo)).toLocaleString();
        }
    } catch (_) { /* leave the '…' placeholder, the order is still priced server-side */ }
}

// Charm-rounding, identical to the server + website so the app shows the exact
// price that will be charged (e.g. 2249 → 2299/2199 band, USD → x.99).
function _charmINR(p) { const n = Math.round(p); return (n % 100 === 99) ? n : Math.round(n / 100) * 100 - 1; }
function _charmUSD(p) { if (Math.round(p * 100) % 100 === 99) return +p.toFixed(2); return +Math.max(Math.round(p / 5) * 5 - 0.01, 0.99).toFixed(2); }

function _tpRenderPricing() {
    if (!_tpConf) return;
    // Region by the user's TIMEZONE, same as the website (index_website.html IS_INDIA),
    // NOT server IP-geo, which can fail or default to India for non-India users.
    // IST = Asia/Kolkata / Asia/Calcutta / UTC+5:30 (getTimezoneOffset() === -330).
    const _tz  = (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    const isIN = _tz.includes('Kolkata') || _tz.includes('Calcutta') || new Date().getTimezoneOffset() === -330;
    const sym  = isIN ? '₹' : '$';
    _tpCur     = isIN ? 'INR' : 'USD';   // remember what the user was shown → charge the same
    const src  = isIN ? _tpConf.pricingINR : _tpConf.pricingUSD;
    const pp   = (src && src.pro_plus) || {};

    // 6-Month (semiannual) is a US-only option (matches the website). Show/hide the
    // button here, and never leave a non-India cycle selected on the India card.
    const semiBtn = document.querySelector('.tp-cyc-semi');
    if (semiBtn) semiBtn.style.display = isIN ? 'none' : '';
    if (isIN && _tpCycle === 'semiannual') _tpCycle = 'quarterly';

    const base = pp[_tpCycle] ?? pp.monthly ?? 0;
    const disc = pp.discount || 0;
    // Apply the backend-configured discount, then charm-round, matches create-order.
    const final = disc > 0 ? (isIN ? _charmINR(base * (1 - disc / 100)) : _charmUSD(base * (1 - disc / 100))) : base;
    const fmt   = v => isIN ? Math.round(v).toLocaleString('en-IN') : Number(v).toFixed(2);

    document.querySelectorAll('.tp-cur').forEach(el => el.textContent = sym);
    const priceEl = document.getElementById('tp-elite-price');
    if (priceEl) priceEl.textContent = fmt(final);

    // Struck-through original + "X% OFF" badge, only when a discount is configured.
    const origEl = document.getElementById('tp-elite-orig');
    const offEl  = document.getElementById('tp-elite-off');
    if (origEl) { if (disc > 0) { origEl.style.display = ''; origEl.textContent = sym + fmt(base); } else origEl.style.display = 'none'; }
    if (offEl)  { if (disc > 0) { offEl.style.display  = ''; offEl.textContent = `You save ${Math.round(disc)}% today`; } else offEl.style.display = 'none'; }

    const perEl = document.getElementById('tp-elite-per');
    if (perEl) perEl.textContent = _tpCycle === 'semiannual' ? '/6 months' : _tpCycle === 'quarterly' ? '/quarter' : '/month';

    const saveEl = document.getElementById('tp-q-save');
    if (saveEl && pp.monthly && pp.quarterly) {
        const pct = Math.max(0, Math.round((1 - pp.quarterly / (pp.monthly * 3)) * 100));
        saveEl.textContent = pct > 0 ? `· save ${pct}%` : '';
    }
    const sSaveEl = document.getElementById('tp-s-save');
    if (sSaveEl && pp.monthly && pp.semiannual) {
        const pct = Math.max(0, Math.round((1 - pp.semiannual / (pp.monthly * 6)) * 100));
        sSaveEl.textContent = pct > 0 ? `· save ${pct}%` : '';
    }
    document.querySelectorAll('.tp-cyc').forEach(b => {
        b.classList.toggle('on', b.dataset.cycle === _tpCycle);
    });
}

// Auto-cycle the plan toggle every 2s so the user sees every price (monthly, 3-month,
// 6-month, whichever are available). Pauses the moment the cursor is over the card so
// they can read in peace, then resumes when it leaves.
let _tpAutoTimer = null;
let _tpHover = false;
function _tpStartAutoCycle() {
    _tpStopAutoCycle();
    _tpAutoTimer = setInterval(() => {
        const overlay = document.getElementById('trial-offer-overlay');
        if (!overlay || overlay.style.display === 'none') { _tpStopAutoCycle(); return; }
        if (_tpHover) return;
        const cyc = document.getElementById('tp-cycle');
        if (!cyc) return;
        const btns = [...cyc.querySelectorAll('.tp-cyc')].filter(b => b.offsetParent !== null); // visible ones only
        if (btns.length < 2) return;
        let idx = btns.findIndex(b => b.dataset.cycle === _tpCycle);
        if (idx < 0) idx = 0;
        const next = btns[(idx + 1) % btns.length];
        if (next) { _tpCycle = next.dataset.cycle; _tpRenderPricing(); }
    }, 2000);
}
function _tpStopAutoCycle() {
    if (_tpAutoTimer) { clearInterval(_tpAutoTimer); _tpAutoTimer = null; }
}

// Robust clipboard copy (Electron renderer / file://): clipboard API first, then a
// hidden-textarea fallback so the coupon always copies.
async function _copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
    try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch (_) { return false; }
}

(function _initTrialOfferCard() {
    const overlay    = document.getElementById('trial-offer-overlay');
    const codeBtn    = document.getElementById('trial-offer-code');
    const upgradeBtn = document.getElementById('trial-offer-upgrade');
    const closeBtn   = document.getElementById('trial-offer-close');
    // Top-right X, a plain, quiet close (no nag), same as clicking outside.
    const xBtn       = document.getElementById('trial-offer-x');
    if (xBtn) xBtn.addEventListener('click', () => { _tpStopAutoCycle(); if (overlay) overlay.style.display = 'none'; });

    // Pause the price auto-cycle while the cursor is over the card (reading), resume after.
    const _tpCard = document.querySelector('#trial-offer-overlay .trial-offer-card');
    if (_tpCard) {
        _tpCard.addEventListener('mouseenter', () => { _tpHover = true; });
        _tpCard.addEventListener('mouseleave', () => { _tpHover = false; });
    }

    if (codeBtn) codeBtn.addEventListener('click', async () => {
        const code = (document.getElementById('trial-offer-code-text') || {}).textContent || '';
        if (!code || code === ', ') return;
        const ok = await _copyToClipboard(code);
        codeBtn.classList.add('copied');
        whisToast(ok ? 'Coupon copied, apply it at checkout' : `Copy this code: ${code}`, ok ? 'success' : 'info', 2500);
    });

    // Plan cycle toggle (Monthly / 3-Month), re-price in place.
    document.querySelectorAll('.tp-cyc').forEach(b => b.addEventListener('click', () => {
        _tpCycle = b.dataset.cycle; _tpRenderPricing();
    }));

    if (upgradeBtn) upgradeBtn.addEventListener('click', async () => {
        const gid = currentUser ? (currentUser.googleId || currentUser.id) : null;
        // Fewest clicks: open the pre-authed payment sheet IN the app, carrying the
        // exact plan/cycle they picked here so they don't re-decide. No coupon, the
        // price they saw is exactly what they pay. Fall back to website if needed.
        try {
            if (window.electronAPI.openInAppCheckout) {
                const r = await window.electronAPI.openInAppCheckout({
                    gid, sid: currentSessionId || undefined,
                    tier: 'pro_plus', cycle: _tpCycle, cur: _tpCur
                });
                if (r && r.ok) return;
            }
        } catch (_) { /* fall through to website checkout */ }
        window.electronAPI.openSubscriptionPage({ user: _buildCheckoutUser() });
    });

    // When the in-app checkout window closes, re-check entitlement, if they paid,
    // this unlocks the app instantly with no manual restart.
    if (window.electronAPI.onCheckoutClosed) {
        window.electronAPI.onCheckoutClosed(() => { try { checkAuth(false); } catch (_) {} });
    }

    let _maybeLaterShown = false;
    if (closeBtn) closeBtn.addEventListener('click', () => {
        _tpStopAutoCycle();
        if (overlay) overlay.style.display = 'none';
        // Gentle, one-time recovery, point them to the always-there banner instead of
        // losing them silently. Never nags (shows at most once per session).
        if (!_maybeLaterShown) {
            _maybeLaterShown = true;
            try { whisToast('No rush, the "Upgrade to Elite" button stays up top whenever you\'re ready.', 'info', 4500); } catch (_) {}
        }
    });

    // Persistent "Get Elite" pill in the chatbox → open the same offer card anytime.
    const upgradeFab = document.getElementById('upgrade-fab');
    if (upgradeFab) upgradeFab.addEventListener('click', () => {
        try { _showTrialEndedOffer(true); } catch (_) {}
    });
})();

if(endTrialBtn) {
    endTrialBtn.addEventListener("click", async () => {
        const endOk = await whisConfirm("Your remaining trial minutes will be lost.", "End Session", "Keep Going", true, "End Trial?");
        if(endOk) {
            if(currentUser) {
                 const googleId = currentUser.googleId || currentUser.id;
                 await window.electronAPI.endTrial(googleId);
            }
            // Ending early counts as "done", lock immediately AND show the discount offer.
            lockAfterEntitlementEnd();
            // Sync with server quietly (no "Refreshing status…" flicker).
            checkAuth(false);
        }
    });
}

function startSessionHeartbeat(googleId) {
    if (sessionHeartbeatInterval) clearInterval(sessionHeartbeatInterval);
    
    sessionHeartbeatInterval = setInterval(async () => {
        if (!currentSessionId) return;
        try {
            const status = await window.electronAPI.checkSubscription(googleId, currentSessionId);
            
            if (status.sessionInvalid) {
                // Tolerate a transient mismatch (session rotation right after a trial
                // start can briefly look invalid). Only act after 2 consecutive strikes,
                // and LOCK rather than quit, the app must never vanish abruptly.
                _sessionInvalidStrikes++;
                if (_sessionInvalidStrikes >= 2) {
                    stopSessionHeartbeat();
                    showSubscriptionLock(currentUser, window.WHIS_WEB
                        ? "Your session was opened on another device. Reload this page and sign in again."
                        : "Your session was opened on another device. Reopen the app to continue here.");
                }
                return;
            }
            _sessionInvalidStrikes = 0;

            updateMinutesDisplay(status);

            if (status.micUsageEnforced && status.micRemainingSeconds <= 0) {
                stopSessionHeartbeat();
                showSubscriptionLock(currentUser, "App minutes exhausted. Please upgrade or renew.");
                return;
            }

            // Server is the source of truth. If it reports the user is no longer
            // active (trial expired OR paid plan lapsed), lock the app, the safety
            // net against infinite free usage. Require TWO consecutive inactive reads
            // so a single transient blip right after starting a trial can't false-lock;
            // the trial timer remains the instant, authoritative end at true expiry.
            // Defense-in-depth: never treat "inactive" as trial-end while the server
            // still reports a live trial (status.isTrial). The 1s trial timer is the
            // authoritative end at true expiry. This stops the heartbeat from killing a
            // web trial ~10s in even if `active` reads false for any reason.
            if (!status.active && !status.isTrial && (subscriptionIsActive || subscriptionIsTrial)) {
                _inactiveStrikes++;
                if (_inactiveStrikes >= 2) lockAfterEntitlementEnd();
            } else {
                _inactiveStrikes = 0;
            }

        } catch (e) { /* ignore */ }
    }, 5000);
}

function stopSessionHeartbeat() {
    if (sessionHeartbeatInterval) {
        clearInterval(sessionHeartbeatInterval);
        sessionHeartbeatInterval = null;
    }
}

function showLogin() {
  _hideWebBoot();
  loginOverlay.style.display = "flex";
  subOverlay.style.display = "none";
  contentArea.style.display = "none";
  currentUser = null;
  updateHeaderVisibility(false);
  stopSessionHeartbeat(); 
  stopAppUsageTimer(); // Clear usage timer
  
  if (globalUsageInterval) {
      clearInterval(globalUsageInterval);
      globalUsageInterval = null;
  }
  
  stopTrialTimer();
  updateListeningUI(false);
  hasShownTourThisSession = false; // Reset so it shows again on next explicit login
}

function showSubscriptionLock(user, msg) {
  _hideWebBoot();
  currentUser = user;
  loginOverlay.style.display = "none";
  contentArea.style.display = "none";
  subOverlay.style.display = "flex";
  if (msg) subStatus.textContent = msg;
  updateHeaderVisibility(false);
  updateListeningUI(false);
  stopAppUsageTimer();
}

function _showTrialsExhausted(user) {
  // Stop any audio that might be running before locking the screen
  if (isListening) stopAndCommitAudio(true);
  stopUserMicCapture();
  // Calculate time until UTC midnight so user knows when trials reset
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const msLeft = midnight - now;
  const h = Math.floor(msLeft / 3600000);
  const m = Math.floor((msLeft % 3600000) / 60000);
  const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
  showSubscriptionLock(user, `That's both free trials for today. Fresh ones unlock in ${timeStr}. Skip the wait and go Elite for unlimited access, whenever you want it.`);
  _showTrialEndedOffer();
}

function showToastError(msg) {
    listeningStatusEl.innerHTML = `<div class="wave-and-text"><span class="status-text" style="color:#ff6b6b; font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> ${msg}</span></div>`;
    listeningStatusEl.classList.add("active");
    listeningStatusEl.style.display = "flex";
    setTimeout(() => {
        if(listeningStatusEl.innerHTML.includes(msg)) {
            listeningStatusEl.classList.remove("active");
            listeningStatusEl.innerHTML = "";
            listeningStatusEl.style.display = "none";
        }
    }, 4000);
}

function showApp(user) {
  _hideWebBoot();
  currentUser = user;
  loginOverlay.style.display = "none";
  subOverlay.style.display = "none";
  contentArea.style.display = "flex";
  updateHeaderVisibility(true);
  // Re-render so the empty-state stealth block reflects the actual subscription tier.
  // renderMessages() is called at startup before auth, when subscriptionTier is still null.
  renderMessages();
  
  if(user.email) {
     dropdownUserEmail.textContent = user.email;
  }
  
  if (user.picture) {
    userAvatar.src = user.picture;
    userAvatar.style.display = "block";
    userIcon.style.display = "none";
  } else {
    userAvatar.style.display = "none";
    userIcon.style.display = "block";
  }
  
  updateCrispToggleUI();

  // Show initial contextual hint, slight delay so localContexts are loaded
  setTimeout(() => { _lastHint = null; updateContextHint(); }, 600);

  // One-time position hint, tells new users the window is moveable/resizable.
  // Desktop-only: a browser tab has no draggable/resizable app window.
  if (!window.WHIS_WEB && !localStorage.getItem('wh_pos_hint_shown')) {
    localStorage.setItem('wh_pos_hint_shown', '1');
    setTimeout(() => {
      const hint = document.createElement('div');
      hint.id = 'wh-pos-hint';
      hint.style.cssText = [
        'position:fixed','top:44px','left:50%','transform:translateX(-50%)',
        'z-index:99999','background:rgba(15,17,30,0.97)',
        'border:1px solid rgba(167,139,255,0.35)','border-radius:10px',
        'padding:9px 16px','display:flex','align-items:center','gap:10px',
        'box-shadow:0 8px 32px rgba(0,0,0,0.6),0 0 0 1px rgba(167,139,255,0.08)',
        'cursor:pointer','pointer-events:all',
        'opacity:0','transition:opacity 0.3s ease'
      ].join(';');
      hint.innerHTML = `
        <span style="font-size:15px;">↕</span>
        <span style="font-size:11.5px;color:rgba(255,255,255,0.85);font-weight:500;line-height:1.4;">
          Drag the pill above to move · resize from any edge
          <span style="color:rgba(167,139,255,0.8);margin-left:4px;">You can reposition this window anytime</span>
        </span>
        <span style="font-size:10px;color:rgba(255,255,255,0.3);margin-left:4px;flex-shrink:0;">✕</span>`;
      document.body.appendChild(hint);
      requestAnimationFrame(() => { hint.style.opacity = '1'; });
      const dismiss = () => {
        hint.style.opacity = '0';
        setTimeout(() => { try { hint.remove(); } catch(_) {} }, 320);
      };
      hint.addEventListener('click', dismiss);
      setTimeout(dismiss, 6000);
    }, 1800);
  }

  // Animated gradient border ring + comet
  (function initBorderRing() {
    const svg   = document.getElementById('whis-border-ring');
    const rect  = document.getElementById('wbr-rect');
    const comet = document.getElementById('wbr-comet');
    const grad  = document.getElementById('wbr-grad');
    const cGrad = document.getElementById('wbr-comet-grad');
    if (!svg || !rect || !grad) return;

    let perimeter = 0;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      [rect, comet].forEach(el => {
        if (!el) return;
        el.setAttribute('x', '2');
        el.setAttribute('y', '2');
        el.setAttribute('width',  w - 4);
        el.setAttribute('height', h - 4);
      });
      grad.setAttribute('x1', '0');
      grad.setAttribute('y1', '0');
      grad.setAttribute('x2', w);
      grad.setAttribute('y2', h);
      cGrad.setAttribute('x1', '0');
      cGrad.setAttribute('y1', '0');
      cGrad.setAttribute('x2', w * 0.4);
      cGrad.setAttribute('y2', '0');
      // approximate perimeter for dasharray
      perimeter = 2 * ((w - 4) + (h - 4));
      if (comet) {
        const tail = Math.min(perimeter * 0.08, 80); // comet tail = 8% of perimeter
        comet.setAttribute('stroke-dasharray', `${tail} ${perimeter}`);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    // Main ring: slow rainbow rotation
    let angle = 0;
    // Comet: travels around the perimeter via dashoffset
    let cometOffset = 0;

    const spin = () => {
      angle = (angle + 1.2) % 360;
      const cx = window.innerWidth  / 2;
      const cy = window.innerHeight / 2;
      grad.setAttribute('gradientTransform', `rotate(${angle} ${cx} ${cy})`);

      if (comet && perimeter > 0) {
        cometOffset = (cometOffset - 3 + perimeter) % perimeter; // 3px per frame ≈ 2s lap
        comet.setAttribute('stroke-dashoffset', cometOffset);
        // keep comet gradient aligned with its current position on the ring
        const progress = 1 - (cometOffset / perimeter);
        const px = progress * perimeter;
        cGrad.setAttribute('gradientTransform', `rotate(${angle} ${cx} ${cy})`);
      }

      requestAnimationFrame(spin);
    };
    requestAnimationFrame(spin);
  })();

  // Start the 60-min auto-warning tracker when app is running
  startAppUsageTimer();

  // Unified global usage tracking (deducts 60 seconds of general app usage every minute)
  if (!globalUsageInterval) {
      globalUsageInterval = setInterval(async () => {
          if (!currentUser) return;
          const googleId = currentUser.googleId || currentUser.id;
          try {
              await fetch(`${BACKEND_URL}/api/user/mic/consume`, {
                  method: "POST",
                  headers: { 
                      "Content-Type": "application/json",
                      "x-google-id": googleId, 
                      "x-session-id": currentSessionId,
                      "x-whis-auth": APP_AUTH_TOKEN 
                  },
                  body: JSON.stringify({ deltaSeconds: 60 })
              });
          } catch (e) { }
      }, 60000);
  }

  // Proactive screenshare-risk warning for Pro users (shown once per install).
  // Desktop only: stealth (visible vs invisible on screenshare) is a desktop feature.
  const isProtected = isFreeTier || (subscriptionTier === 'pro_plus' && subscriptionIsActive);
  if (!window.WHIS_WEB && !isProtected && subscriptionTier === 'pro' && subscriptionIsActive && !localStorage.getItem('wh_pro_risk_notified')) {
      localStorage.setItem('wh_pro_risk_notified', '1');
      setTimeout(() => {
          whisToast(
              '⚠ <strong>Screenshare Risk:</strong> You\'re on Pro, Whis-AI IS visible to your interviewer. Upgrade to Elite for full OS-level stealth.',
              'warning', 0,
              { action: { label: 'Upgrade to Elite', fn: () => window.electronAPI.openSubscriptionPage() } }
          );
      }, 1200);
  }

  // First-run stealth wizard, shown once ever, before the tour
  if (window.WHIS_WEB) {
      // WEB: value-first for conversion. Do NOT open the stealth or resume-onboarding
      // walls on arrival, the welcome + one-tap starter questions must be the first
      // thing a trial user sees, so they reach an answer in one tap. Personalizing with
      // a resume stays available later from Profile → Manage Contexts.
      try { localStorage.setItem('wh_stealth_ok', '1'); } catch (_) {}
  } else if (!localStorage.getItem('wh_stealth_ok')) {
      setTimeout(_showStealthOnboard, 600);
  } else {
      // Context onboarding, auto-shown at most once (and only if the user has no
      // saved context). _showContextOnboarding() enforces this so we never nag.
      setTimeout(_showContextOnboarding, 1200);
  }

  if (!autoRoutinesStarted) {
      autoRoutinesStarted = true;
      setTimeout(() => {
          if (isAutoMode) startAutoRoutines();
      }, 1000);
  }
}

profileBtn.addEventListener("click", (event) => {
    event.stopPropagation(); 
    const isVisible = profileDropdownMenu.style.display === "block";
    profileDropdownMenu.style.display = isVisible ? "none" : "block";
});

// ================================================================
// SUBSCRIPTION DETAIL PANEL
// ================================================================

function _fmtAmount(amount, currency) {
    if (amount == null || amount === '') return ', ';
    // Server stores amounts in actual currency units (INR rupees, USD dollars), no conversion needed
    const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₹';
    return sym + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function _fmtDate(d) {
    if (!d) return ', ';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function _tierLabel(tier) {
    if (tier === 'pro_plus') return 'Elite';
    if (tier === 'pro') return 'Pro';
    return 'Free';
}

function _cyclLabel(cycle) {
    if (!cycle) return '';
    return cycle.charAt(0).toUpperCase() + cycle.slice(1);
}

function openSubscriptionDetail() {
    profileDropdownMenu.style.display = 'none';
    const overlay = document.getElementById('subscription-overlay');
    if (!overlay) return;

    const s = subscriptionStatusObj;
    const tier = subscriptionTier || 'free';
    const isActive = !!(s && s.active);
    const isTrial = !!(s && s.isTrial);

    // ── Plan banner ──
    const banner = document.getElementById('sub-plan-banner');
    const tierClass = tier === 'pro_plus' ? 'tier-elite' : tier === 'pro' ? 'tier-pro' : 'tier-free';
    const tierName  = _tierLabel(tier);
    const statusText = isTrial ? 'Trial' : isActive ? 'Active' : 'Inactive';
    const statusClass = isTrial ? 'trial' : isActive ? 'active' : 'inactive';
    // Web has no OS-level stealth, so drop the screenshare visibility clauses there.
    const planDesc = window.WHIS_WEB
        ? (tier === 'free' ? '20 answers / day' : '10 hours')
        : tier === 'free'
        ? '20 answers / day · Screenshare invisible'
        : tier === 'pro'
        ? '10 hours · Visible on screenshare'
        : '10 hours · Screenshare invisible';

    banner.className = 'sub-plan-banner ' + tierClass;
    banner.innerHTML = `
        <div class="sub-plan-row">
            <span class="sub-plan-name ${tierClass}">${tierName} Plan</span>
            <span class="sub-status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="sub-plan-desc">${planDesc}</div>`;

    // ── Info grid ──
    const validUntil = subscriptionValidUntil;
    const validStr = validUntil ? _fmtDate(validUntil) : (tier === 'free' ? 'No expiry' : ', ');

    let usageStr = ', ';
    if (s) {
        if (s.micRemainingSeconds != null) {
            const mins = Math.floor(s.micRemainingSeconds / 60);
            usageStr = `${mins} min remaining`;
        }
    }

    const trialLeft = s ? (s.maxTrialSessions || maxTrialSessions) - ((s.trialUsage && s.trialUsage.count) || 0) : maxTrialSessions;
    const stealthStr = (tier === 'free' || (tier === 'pro_plus' && isActive)) ? '✓ On' : '✗ Off';
    const stealthHighlight = stealthStr.startsWith('✓');

    document.getElementById('sub-info-grid').innerHTML = `
        <div class="sub-info-cell">
            <div class="sub-info-label">Valid Until</div>
            <div class="sub-info-value">${validStr}</div>
        </div>
        <div class="sub-info-cell">
            <div class="sub-info-label">Usage</div>
            <div class="sub-info-value">${usageStr}</div>
        </div>
        <div class="sub-info-cell">
            <div class="sub-info-label">Stealth Mode</div>
            <div class="sub-info-value ${stealthHighlight ? 'highlight' : ''}">${stealthStr}</div>
        </div>
        <div class="sub-info-cell">
            <div class="sub-info-label">Free Trials Left</div>
            <div class="sub-info-value">${Math.max(0, trialLeft)} of ${s ? s.maxTrialSessions || maxTrialSessions : maxTrialSessions} today</div>
        </div>`;

    // ── Payment history ──
    const orderList = document.getElementById('sub-orders-list');
    const orders = subscriptionOrders;
    if (!orders || orders.length === 0) {
        orderList.innerHTML = '<div class="sub-empty">No payment records found.</div>';
    } else {
        orderList.innerHTML = orders.map(o => {
            const isPaid = o.status === 'paid';
            const isProcessing = o.status === 'processing';
            const iconClass = isPaid ? 'paid' : isProcessing ? 'processing' : 'unpaid';
            const icon = isPaid ? 'fa-check' : isProcessing ? 'fa-spinner' : 'fa-xmark';
            const orderTier = _tierLabel(o.tier);
            const cycle = _cyclLabel(o.cycle);
            const title = cycle ? `${orderTier} · ${cycle}` : orderTier;
            const amount = _fmtAmount(o.amount, o.currency || 'INR');
            const date = _fmtDate(o.date);
            const payId = o.paymentId ? o.paymentId.slice(-8) : ', ';

            return `<div class="sub-order-row">
                <div class="sub-order-icon ${iconClass}">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div class="sub-order-main">
                    <div class="sub-order-top">
                        <span class="sub-order-title">${title}</span>
                        <span class="sub-order-amount">${amount}</span>
                    </div>
                    <div class="sub-order-meta">
                        <span class="sub-order-meta-pill">${date}</span>
                        <span class="sub-order-meta-pill razorpay">Razorpay</span>
                        ${o.method ? `<span class="sub-order-meta-pill">${o.method}</span>` : ''}
                        <span class="sub-order-meta-pill">…${payId}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    overlay.style.display = 'flex';
}

const subDetailBtn = document.getElementById('subscription-detail-btn');
if (subDetailBtn) subDetailBtn.addEventListener('click', openSubscriptionDetail);

// Close button uses delegation, the overlay HTML loads after this script
document.addEventListener('click', (e) => {
    if (e.target.closest('#close-subscription-btn')) {
        const ov = document.getElementById('subscription-overlay');
        if (ov) ov.style.display = 'none';
    }
});

// ── Message action buttons (copy + thumbs) ──
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.msg-action-btn');
    if (!btn) return;
    const action  = btn.dataset.action;
    const actions = btn.closest('.msg-actions');
    if (!actions) return;
    const msgId = actions.dataset.msgId;
    const msg = state.messages.find(m => m.id === msgId);

    if (action === 'copy') {
        if (!msg) return;
        // Strip HTML to plain text
        const tmp = document.createElement('div');
        tmp.innerHTML = formatMessageContent(msg.content);
        const plain = tmp.innerText || tmp.textContent || '';
        navigator.clipboard.writeText(plain).then(() => {
            btn.classList.add('copied');
            btn.innerHTML = '<i class="fa-solid fa-check"></i>';
            whisToast('Answer copied', 'success', 2000);
            setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = '<i class="fa-regular fa-copy"></i>'; }, 2000);
        }).catch(() => whisToast('Copy failed', 'error', 2000));
    }

    if (action === 'thumbup') {
        const isActive = btn.classList.toggle('thumbed-up');
        actions.querySelector('[data-action="thumbdown"]')?.classList.remove('thumbed-down');
        if (isActive) whisToast('Glad that helped!', 'success', 2000);
    }

    if (action === 'thumbdown') {
        const isActive = btn.classList.toggle('thumbed-down');
        actions.querySelector('[data-action="thumbup"]')?.classList.remove('thumbed-up');
        if (isActive) whisToast('Thanks, we\'ll improve this', 'info', 2500);
    }
});

// ── Quick prompt chips ──
document.addEventListener('click', (e) => {
    const chip = e.target.closest('.quick-prompt-chip');
    if (!chip) return;
    const prompt = chip.dataset.prompt;
    if (!prompt || !inputEl) return;
    const cur = inputEl.value.trim();
    inputEl.value = cur ? cur + ', ' + prompt : prompt;
    inputEl.dispatchEvent(new Event('input'));
    inputEl.focus();
    // Momentary highlight
    chip.style.background = 'rgba(195,169,239,0.18)';
    chip.style.borderColor = 'rgba(195,169,239,0.4)';
    chip.style.color = '#fff';
    setTimeout(() => { chip.style.background = ''; chip.style.borderColor = ''; chip.style.color = ''; }, 600);
});

document.addEventListener("click", (event) => {
    if (profileDropdownMenu.style.display === "block" &&
        !profileDropdownMenu.contains(event.target) &&
        event.target !== profileBtn) {
        profileDropdownMenu.style.display = "none";
    }
    if (shortcutPopover && shortcutPopover.style.display === "flex" && 
        !shortcutPopover.contains(event.target) && 
        event.target !== shortcutToggleBtn && !shortcutToggleBtn.contains(event.target)) {
        shortcutPopover.style.display = "none";
    }
});

function resetLoginUI() {
    loginBtn.disabled = false;
    loginBtn.classList.add('google-sign-in-btn'); 
    loginBtn.innerHTML = `<span class="icon">G</span> Sign in with Google`;
    loginError.textContent = "";
    loginCancelBtn.style.display = "none"; 
}

loginBtn.addEventListener("click", async () => {
  loginError.textContent = "Signing in...";
  loginBtn.disabled = true;
  loginBtn.classList.remove('google-sign-in-btn'); 
  loginBtn.innerHTML = `Verifying...`;
  
  loginCancelBtn.style.display = "block"; 
  
  try {
    const result = await window.electronAPI.loginGoogle();
    if (result.error) {
      loginError.textContent = result.error;
    } else if (result.user) {
      loginError.textContent = "Verifying...";
      await handleUserPostLogin(result.user);
    }
  } catch (err) {
    loginError.textContent = "Error during login.";
  } finally {
    resetLoginUI();
  }
});

if(loginCancelBtn) {
    loginCancelBtn.addEventListener("click", () => {
        resetLoginUI();
        loginError.textContent = "Login cancelled. Try again.";
    });
}

const subCloseBtn = document.getElementById("sub-close-btn");
if (subCloseBtn) subCloseBtn.addEventListener("click", () => { subOverlay.style.display = "none"; });

subBtn.addEventListener("click", () => {
  window.electronAPI.openSubscriptionPage();
  subStatus.textContent = "Opened browser. Refresh after payment.";
});

subRefreshBtn.addEventListener("click", () => {
  subStatus.textContent = "Refreshing...";
  checkAuth(false).then(() => {
     if(subOverlay.style.display === "flex") {
        subStatus.textContent = "Status refreshed. Still inactive.";
     }
  });
});

refreshBtn.addEventListener("click", () => {
    profileDropdownMenu.style.display = "none";
    checkAuth(true);
});

// FIX: 'X' button instantly kills app
const quitApp = () => {
    if(window.electronAPI.quitApp) window.electronAPI.quitApp();
};

if (closeAppBtn) closeAppBtn.addEventListener("click", quitApp);
if (globalCloseBtn) globalCloseBtn.addEventListener("click", quitApp);

// Minimize button → shrink to the tiny bottom-centre pill (same as Cmd/Ctrl+H).
const minimizeBtn = document.getElementById("minimize-btn");
if (minimizeBtn) minimizeBtn.addEventListener("click", () => {
    if (window.electronAPI && window.electronAPI.minimizeToPill) window.electronAPI.minimizeToPill();
});

const handleLogout = async () => {
  profileDropdownMenu.style.display = "none";
  await window.electronAPI.logout();
  showLogin();
};

subLogoutBtn.addEventListener("click", handleLogout);
logoutBtn.addEventListener("click", handleLogout);

upgradeBtn.addEventListener("click", () => {
  profileDropdownMenu.style.display = "none";
  // Open the real website pricing, pre-authenticated (passes the user so the site
  // auto-logs-in, no re-login). Falls back to the plain pricing page if no identity.
  const user = _buildCheckoutUser();
  if (user) window.electronAPI.openSubscriptionPage({ user });
  else window.electronAPI.openSubscriptionPage();
});

// === GUIDE OVERLAY LOGIC ===
// WEB: the First-Time User Guide is 100% desktop (install .app/.exe, OS permissions,
// hide/quit/move shortcuts, screenshare stealth). None of it applies in a browser, so
// hide the "?" guide button entirely on web.
if (window.WHIS_WEB && guideBtn) guideBtn.style.display = 'none';

if (guideBtn && guideOverlay) {
  const openGuide = () => {
    guideOverlay.style.display = "flex";

    const content = guideOverlay.querySelector("#whis-guide-content");
    const nav = guideOverlay.querySelector("#whis-guide-nav");
    const search = guideOverlay.querySelector("#whis-guide-search");
    const clearBtnMenu = guideOverlay.querySelector("#whis-guide-clear");
    const topBtn = guideOverlay.querySelector("#whis-guide-top");

    if (content && nav) {
      if (!guideOverlay.__whisGuideBound) {
        guideOverlay.__whisGuideBound = true;

        const setActiveNav = (targetId) => {
          const items = nav.querySelectorAll(".whis-guide-nav-item");
          items.forEach((btn) => {
            btn.classList.toggle("is-active", btn.dataset.target === targetId);
          });
        };

        nav.addEventListener("click", (e) => {
          const btn = e.target.closest(".whis-guide-nav-item");
          if (!btn) return;
          const id = btn.dataset.target;
          const section = guideOverlay.querySelector("#" + id);
          if (!section) return;
          section.scrollIntoView({ behavior: "smooth", block: "start" });
          setActiveNav(id);
          content.focus();
        });

        let scrollRaf = 0;
        content.addEventListener("scroll", () => {
          if (scrollRaf) return;
          scrollRaf = requestAnimationFrame(() => {
            scrollRaf = 0;
            const sections = Array.from(guideOverlay.querySelectorAll(".whis-guide-section"))
              .filter((s) => !s.classList.contains("is-hidden"));
            if (!sections.length) return;

            const top = content.getBoundingClientRect().top + 12;
            let best = sections[0];
            let bestDist = Infinity;
            for (const s of sections) {
              const r = s.getBoundingClientRect();
              const dist = Math.abs(r.top - top);
              if (dist < bestDist) {
                bestDist = dist;
                best = s;
              }
            }
            if (best && best.id) setActiveNav(best.id);
          });
        });

        const applySearch = () => {
          const q = (search?.value || "").trim().toLowerCase();
          const sections = guideOverlay.querySelectorAll(".whis-guide-section");
          const navItems = nav.querySelectorAll(".whis-guide-nav-item");

          if (clearBtnMenu) clearBtnMenu.style.display = q ? "inline-flex" : "none";

          sections.forEach((s) => {
            const keys = (s.getAttribute("data-keys") || "").toLowerCase();
            const text = (s.textContent || "").toLowerCase();
            const match = !q || keys.includes(q) || text.includes(q);
            s.classList.toggle("is-hidden", !match);
          });

          navItems.forEach((btn) => {
            const id = btn.dataset.target;
            const sec = id ? guideOverlay.querySelector("#" + id) : null;
            const hidden = sec ? sec.classList.contains("is-hidden") : false;
            btn.style.display = hidden ? "none" : "";
          });

          const active = nav.querySelector(".whis-guide-nav-item.is-active");
          const activeId = active?.dataset?.target;
          const activeSec = activeId ? guideOverlay.querySelector("#" + activeId) : null;
          if (activeSec && activeSec.classList.contains("is-hidden")) {
            const firstVisibleBtn = Array.from(navItems).find((b) => b.style.display !== "none");
            if (firstVisibleBtn) firstVisibleBtn.click();
          }
        };

        if (search) {
          search.addEventListener("input", applySearch);
          search.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              const firstBtn = nav.querySelector(".whis-guide-nav-item:not([style*='display: none'])");
              if (firstBtn) firstBtn.click();
            }
          });
        }
        if (clearBtnMenu) {
          clearBtnMenu.addEventListener("click", () => {
            if (!search) return;
            search.value = "";
            applySearch();
            search.focus();
          });
        }
        if (topBtn) {
          topBtn.addEventListener("click", () => {
            content.scrollTo({ top: 0, behavior: "smooth" });
            setActiveNav("whis-guide-overview");
          });
        }
      }

      content.scrollTop = 0;
      if (search) {
        search.value = "";
        if (clearBtnMenu) clearBtnMenu.style.display = "none";
      }
      guideOverlay.querySelectorAll(".whis-guide-section").forEach((s) => s.classList.remove("is-hidden"));
      nav.querySelectorAll(".whis-guide-nav-item").forEach((b) => (b.style.display = ""));

      const overviewBtn = nav.querySelector(".whis-guide-nav-item[data-target='whis-guide-overview']");
      if (overviewBtn) {
        nav.querySelectorAll(".whis-guide-nav-item").forEach((btn) => btn.classList.remove("is-active"));
        overviewBtn.classList.add("is-active");
      }
      setTimeout(() => {
        if (search) search.focus();
        else content.focus();
      }, 0);

      return; 
    }

    try {
      const scroller = guideOverlay.querySelector(".guide-scroll-container");
      const sections = guideOverlay.querySelectorAll("details.guide-section");
      sections.forEach((d) => {
        d.open = true;
      });
      if (scroller) scroller.scrollTop = 0;
      sections.forEach((d) => {
        const label = d.querySelector("summary span:last-child");
        if (label) label.textContent = d.open ? "Close" : "Open";
      });
    } catch (_) {
    }
  };

  guideBtn.addEventListener("click", openGuide);

  if (closeGuideBtn) {
    closeGuideBtn.addEventListener("click", () => {
      guideOverlay.style.display = "none";
    });
  }

  guideOverlay.addEventListener("click", (e) => {
    if (e.target === guideOverlay) {
      guideOverlay.style.display = "none";
    }
  });

  guideOverlay.addEventListener(
    "toggle",
    (e) => {
      const t = e.target;
      if (!(t instanceof HTMLDetailsElement) || !t.classList.contains("guide-section")) return;
      const label = t.querySelector("summary span:last-child");
      if (label) label.textContent = t.open ? "Close" : "Open";
    },
    true
  );
}

function updateCrispToggleUI() {
    crispToggleBtn.classList.toggle('active', isCrisp);
}

// Apply persisted crisp state on load
updateCrispToggleUI();

crispToggleBtn.addEventListener("click", () => {
    isCrisp = !isCrisp;
    updateCrispToggleUI();
    localStorage.setItem('wh_crisp', isCrisp ? '1' : '0');
    _flashHint(
        isCrisp
            ? `Crisp Mode <strong>ON</strong> · short bullet hints you can glance at mid-interview`
            : `Crisp Mode <strong>OFF</strong> · full explanations with code and trade-offs`,
        'ready', 3500
    );
});

removeAttachmentBtn.addEventListener("click", () => {
    clearStagedScreenshot();
});

function clearStagedScreenshot() {
    stagedScreenshotData = null;
    stagedScreenshotOcrText = "";
    stagedScreenshotOcrConfidence = null;
    if (attachmentArea) {
        attachmentArea.style.display = "none";
        attachmentArea.style.margin = "0";
    }
    if (previewImg) previewImg.src = "";
    if (screenshotBtn) screenshotBtn.style.color = "var(--text-sub)";
    updateContextHint();
}

// ========================================================
// --- TRIAL MODAL LOGIC ---
// ========================================================

function openTrialModal() {
    if (profileDropdownMenu) profileDropdownMenu.style.display = "none";

    const left = maxTrialSessions - currentTrialUsage;
    // Don't reveal the running count, just present it as a free trial. We only surface
    // the limit once they've actually used them all (below).
    trialSessionsLeftEl.textContent = `Free ${trialDurationMinutes}-minute trial · full access`;
    trialErrorEl.textContent = "";

    if (left <= 0) {
        trialErrorEl.textContent = `You've used all your free trials for today. Come back tomorrow, or go Elite for unlimited access.`;
        startTrialEliteBtn.disabled = true;
    } else {
        startTrialEliteBtn.disabled = false;
    }

    trialModal.style.display = "flex";
}

async function activateTrial() {
    if (!currentUser) return;
    const googleId = currentUser.googleId || currentUser.id;

    trialErrorEl.textContent = "Activating...";
    startTrialEliteBtn.disabled = true;

    try {
        const res = await fetch(`${BACKEND_URL}/api/user/trial/start`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-google-id": googleId,
                "x-whis-auth": APP_AUTH_TOKEN
            },
            // Only one trial type exists (Elite); the server forces pro_plus regardless.
            body: JSON.stringify({ tier: "pro_plus" })
        });

        const data = await res.json();

        if (data.success) {
            // FIX: Save the exact local time the trial started to ignore PC clock skew
            localStorage.setItem('trialStartLocal', Date.now().toString());
            trialModal.style.display = "none";
            await checkAuth(true);
            // WEB: make the very next step obvious, drop the user straight into the
            // composer and surface a short first-run hint so they know what to do.
            if (window.WHIS_WEB) {
                try { _applyComposerLock(); } catch (_) {}
                try { inputEl && inputEl.focus(); } catch (_) {}
                _showWebFirstRunHintOnce();
            }
            // Every new trial user gets the guided walkthrough the moment their trial
            // starts. Guarded so it shows once per session (won't double with the
            // first-run wizard, which sets the same flag). On mobile the multi-step tour
            // is too heavy for a small screen, the concise first-run hint covers it.
            if (!hasShownTourThisSession && !IS_MOBILE_WEB) {
                hasShownTourThisSession = true;
                setTimeout(() => { try { openWhisTour(); } catch (_) {} }, 700);
            }
        } else {
            // Clear, friendly next step, never a dead UI. If the trial is already used
            // up, point the user at the plans instead of leaving a bare error string.
            const msg = data.error || "Failed to start trial.";
            trialErrorEl.textContent = msg;
            startTrialEliteBtn.disabled = false;
            if (/used|exhaust|already|limit/i.test(msg)) {
                whisToast('Your free trial is already used. Go Elite for unlimited access.', 'warning', 6000,
                    { action: { label: 'See Plans', fn: () => { try { window.electronAPI.openSubscriptionPage(); } catch (_) {} } } });
            }
        }
    } catch (e) {
        trialErrorEl.textContent = "Network error. Check your connection and tap Start again.";
        startTrialEliteBtn.disabled = false;
    }
}

menuStartTrialBtn.addEventListener("click", openTrialModal);
lockStartTrialBtn.addEventListener("click", openTrialModal);

// OPTIONAL resume personalization, opens the Context Manager over the trial modal.
// Purely additive: they can add a resume for tailored answers, or just skip and start.
const trialPersonalizeLink = document.getElementById("trial-personalize-link");
if (trialPersonalizeLink) trialPersonalizeLink.addEventListener("click", () => {
    if (contextOverlay) { contextOverlay.style.display = "flex"; fetchContexts(); }
});

// Composer quick button → FAST resume/context upload, one tap. Opens the Context
// Manager straight into the editor AND fires the file picker synchronously (within
// the click gesture, or the browser blocks it), so the user can pick their resume
// instantly. The existing change-handler extracts the text and drops it in for
// review + save. Reuses all tested logic, nothing new in the save path.
const contextQuickBtn = document.getElementById("context-quick-btn");
if (contextQuickBtn) contextQuickBtn.addEventListener("click", () => {
    try { if (contextOverlay) contextOverlay.style.display = "flex"; } catch (_) {}
    try { if (typeof openEditor === "function") openEditor(); } catch (_) {}
    // Default the name to "Resume" (fully editable) so upload is one step lighter.
    try { if (ctxNameInput && !ctxNameInput.value.trim()) ctxNameInput.value = "Resume"; } catch (_) {}
    // Fire the picker in the SAME gesture so it isn't suppressed.
    try { const fi = document.getElementById("ctx-file-input"); if (fi) fi.click(); } catch (_) {}
    // Populate the saved-contexts list in the background (for the "Back" view).
    try { if (typeof fetchContexts === "function") fetchContexts(); } catch (_) {}
    try { _trackFunnel("context_quick_upload"); } catch (_) {}
});

closeTrialModalBtn.addEventListener("click", () => {
    trialModal.style.display = "none";
});
const _trialModalX = document.getElementById("trial-modal-x");
if (_trialModalX) _trialModalX.addEventListener("click", () => { trialModal.style.display = "none"; });

startTrialEliteBtn.addEventListener("click", () => activateTrial());


// ========================================================
// --- Context Manager Logic ---
// ========================================================

async function fetchContexts() {
    if (!currentUser) return;
    try {
        const googleId = currentUser.googleId || currentUser.id;
        const res = await fetch(`${BACKEND_URL}/api/user/context`, {
            headers: { "x-google-id": googleId, "x-whis-auth": APP_AUTH_TOKEN }
        });
        const data = await res.json();
        if (data.contexts) {
            localContexts = data.contexts;
            renderContextList();
            updateActiveContextBadge();
        }
    } catch (e) {
        console.error("Failed to fetch contexts", e);
    }
}

function renderContextList() {
    contextListView.innerHTML = "";
    
    const noneDiv = document.createElement("div");
    const isNoneActive = !localContexts.some(c => c.isActive);
    noneDiv.className = `context-item ${isNoneActive ? 'active' : ''}`;
    noneDiv.innerHTML = `<div class="ctx-info"><div class="ctx-name">No Context</div><div class="ctx-preview">Standard AI behavior</div></div>`;
    noneDiv.onclick = () => toggleContextActive(null);
    contextListView.appendChild(noneDiv);

    if (localContexts.length === 0) return;

    localContexts.forEach(ctx => {
        const div = document.createElement("div");
        div.className = `context-item ${ctx.isActive ? 'active' : ''}`;
        div.innerHTML = `
            <div class="ctx-info">
                <div class="ctx-name">${escapeHTML(ctx.name)}</div>
                <div class="ctx-preview">${escapeHTML(ctx.content.substring(0, 50))}...</div>
            </div>
            <div class="ctx-actions">
                <button class="ctx-btn edit"><i class="fa-solid fa-pen"></i></button>
                <button class="ctx-btn delete"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        
        div.querySelector(".ctx-info").onclick = () => toggleContextActive(ctx.id);
        
        div.querySelector(".edit").onclick = (e) => {
            e.stopPropagation();
            openEditor(ctx);
        };

        div.querySelector(".delete").onclick = (e) => {
            e.stopPropagation();
            deleteContext(ctx.id);
        };

        contextListView.appendChild(div);
    });
}

async function toggleContextActive(id) {
    if (!currentUser) return;
    try {
        const googleId = currentUser.googleId || currentUser.id;
        const res = await fetch(`${BACKEND_URL}/api/user/context/toggle`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "x-google-id": googleId, 
                "x-whis-auth": APP_AUTH_TOKEN 
            },
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) {
            localContexts = data.contexts;
            renderContextList();
            updateActiveContextBadge();
        }
    } catch (e) { console.error(e); }
}

async function saveContext() {
    const name = ctxNameInput.value.trim();
    const content = ctxContentInput.value.trim();
    
    if (!name || !content) { whisToast("Name and content are both required", "warning"); return; }
    if (name.length > 64) { whisToast("Name must be under 64 characters", "warning"); return; }
    if (content.length > 32768) { whisToast("Content must be under 32,768 characters", "warning"); return; }
    
    saveCtxBtn.innerHTML = "Saving...";
    saveCtxBtn.disabled = true;

    try {
        const googleId = currentUser.googleId || currentUser.id;
        const payload = { name, content, id: editingContextId };
        
        const res = await fetch(`${BACKEND_URL}/api/user/context`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "x-google-id": googleId, 
                "x-whis-auth": APP_AUTH_TOKEN 
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Server returned ${res.status}: ${errText}`);
        }

        const data = await res.json();
        
        if (data.error) {
            whisToast(data.error, "error");
        } else {
            const wasNew = !editingContextId; // capture before closeEditor() resets it
            localContexts = data.contexts;
            // Find the context just saved, prefer the server-returned id, then name, then newest.
            const savedCtx = (data.context && data.context.id)
                ? data.contexts.find(c => c.id === data.context.id)
                : (data.contexts.find(c => c.name === name) || data.contexts[data.contexts.length - 1]);
            closeEditor();
            // Auto-select a newly added context so the user never has to go pick it manually.
            if (wasNew && savedCtx && !savedCtx.active) {
                await toggleContextActive(savedCtx.id); // activates + re-renders + updates badge
                whisToast("Context saved & selected", "success", 2200);
            } else {
                renderContextList();
                updateActiveContextBadge();
                whisToast("Context saved", "success", 2000);
            }
        }
    } catch (e) {
        console.error("Context Save Error:", e);
        whisToast("Save failed, check your connection", "error");
    } finally {
        saveCtxBtn.innerHTML = "Save Context";
        saveCtxBtn.disabled = false;
    }
}

async function deleteContext(id) {
    const ok = await whisConfirm("This context will be permanently deleted.", "Delete", "Cancel", true, "Delete Context");
    if (!ok) return;
    try {
        const googleId = currentUser.googleId || currentUser.id;
        await fetch(`${BACKEND_URL}/api/user/context/${id}`, {
            method: "DELETE",
            headers: { "x-google-id": googleId, "x-whis-auth": APP_AUTH_TOKEN }
        });
        localContexts = localContexts.filter(c => c.id !== id);
        renderContextList();
        updateActiveContextBadge();
    } catch (e) { console.error(e); }
}

function openEditor(ctx = null) {
    editingContextId = ctx ? ctx.id : null;
    ctxNameInput.value = ctx ? ctx.name : "";
    ctxContentInput.value = ctx ? ctx.content : "";
    
    ctxNameInput.maxLength = 64;
    ctxContentInput.maxLength = 32768;
    
    contextListView.style.display = "none";
    addNewContextBtn.style.display = "none";
    contextEditorView.style.display = "flex";
}

function closeEditor() {
    contextListView.style.display = "flex";
    addNewContextBtn.style.display = "block";
    contextEditorView.style.display = "none";
    editingContextId = null;
}

function updateActiveContextBadge() {
    const existing = document.querySelector(".active-context-badge");
    if (existing) existing.remove();

    const active = localContexts.find(c => c.isActive);
    const pillContainer = document.getElementById("pill-container");

    // Reflect active context on the composer's quick button so its value is obvious.
    const _cqb = document.getElementById("context-quick-btn");
    if (_cqb) _cqb.classList.toggle("active", !!active);

    if (active && pillContainer) {
        const badge = document.createElement("div");
        badge.className = "active-context-badge";
        badge.innerHTML = `<i class="fa-solid fa-layer-group"></i> Context: ${escapeHTML(active.name)}`;
        pillContainer.insertBefore(badge, pillContainer.firstChild);

        // Flash a hint confirming context is active and what it means
        if (!state.isSending && !isListening) {
            _flashHint(
                `✓ <strong>${escapeHTML(active.name)}</strong> active, every answer will reference your background`,
                'ready', 4000
            );
        }
    }

    checkPillContainer();
    // Re-evaluate the "upload resume" nudge
    _lastHint = null;
    updateContextHint();
}

// ================================================================
// WHIS INTERACTIVE DEMO ENGINE
// Full guided walkthrough: shortcuts → YouTube → LeetCode →
// Crisp Mode → Context Manager → Stealth Proof
// ================================================================

const DEMO_YOUTUBE_URL  = 'https://www.youtube.com/watch?v=we7ba0slWrc'; // Live mock interview Q&A
const DEMO_LEETCODE_URL = 'https://leetcode.com/problems/excel-sheet-column-title/description/';

let _demoStep    = 0;
let _demoActive  = false;
let _demoCleanup = [];   // fns to run when demo closes

const _CTRL = isMac ? '⌘' : 'Ctrl';

const _DEMO_STEPS_ALL = [

  /* ── 0  Welcome ─────────────────────────────────────────────────── */
  {
    tag: '🎬 Interactive Demo',
    icon: '<i class="fa-solid fa-wand-magic-sparkles"></i>',
    iconColor: '#a78bff',
    title: 'See Every Feature Live',
    target: null, pos: 'center',
    body: `A <strong>real, hands-on tour</strong> of Whis-AI. Every step triggers the actual feature, nothing is faked or mocked.`,
    action(zone) {
      zone.innerHTML = `
        <div class="demo-welcome-grid">
          <div class="demo-welcome-pill"><i class="fa-solid fa-keyboard" style="color:#c3a9ef"></i> 7 Shortcuts</div>
          <div class="demo-welcome-pill"><i class="fa-brands fa-youtube" style="color:#ff4444"></i> Live Audio</div>
          <div class="demo-welcome-pill"><i class="fa-solid fa-camera" style="color:#ffd700"></i> Screenshot OCR</div>
          <div class="demo-welcome-pill"><i class="fa-solid fa-bullseye" style="color:#4df4b1"></i> Crisp Mode</div>
          <div class="demo-welcome-pill"><i class="fa-solid fa-layer-group" style="color:#ff9f43"></i> Context AI</div>
          <div class="demo-welcome-pill"><i class="fa-solid fa-shield-halved" style="color:#4df4b1"></i> Stealth Proof</div>
        </div>
        <div class="demo-flow-hint">Hit <strong>Next →</strong> to begin. Each step is interactive.</div>`;
    }
  },

  /* ── 1  Shortcuts + Send Button ─────────────────────────────────── */
  {
    tag: '⌨️ Step 1 of 7',
    icon: '<i class="fa-solid fa-keyboard"></i>',
    iconColor: '#c3a9ef',
    title: 'Shortcuts + The Send Button',
    target: '#send-btn', pos: 'center',
    body: `The <strong style="color:#a78bff;">Send button ↑</strong> (highlighted above) sends your question to AI. The shortcut <strong style="color:#a78bff;">${_CTRL}+↵</strong> does the same thing, hands-free. The app is <span style="color:#4df4b1;">fully interactive</span> during this entire demo.`,
    action(zone) {
      const sym = _CTRL;
      const shortcuts = [
        { key: `${sym}+L`,      label: 'Listen to interviewer',      color: '#4df4b1', star: true  },
        { key: `${sym}+J`,      label: 'Screenshot + OCR',           color: '#c3a9ef', star: true  },
        { key: `${sym}+↵`,      label: 'Send  /  Stop streaming',    color: '#a78bff', star: true  },
        { key: `${sym}+H`,      label: 'Hide from your own screen',  color: '#ffaa00', star: false },
        { key: `${sym}+⌫`,      label: 'Clear chat',                 color: '#ff6b6b', star: false },
        { key: `${sym}+Arrows`, label: 'Move window',                color: '#666',    star: false },
        { key: `${sym}+Q`,      label: 'Quit app',                   color: '#555',    star: false },
      ];
      zone.innerHTML = `
        <div class="demo-interact-hint">
          <i class="fa-solid fa-hand-pointer" style="color:#4df4b1;"></i>
          You can type, send, scroll and use everything right now, the demo won't block you
        </div>
        <div class="demo-shortcuts-grid" style="margin-top:8px;">
          ${shortcuts.map(s => `
            <div class="demo-shortcut-row${s.star ? ' demo-shortcut-star' : ''}">
              <kbd class="demo-key" style="color:${s.color}; border-color:${s.color}40;">${s.key}</kbd>
              <span class="demo-key-label">${s.label}${s.star ? ' <span class="demo-star-badge">★</span>' : ''}</span>
            </div>`).join('')}
        </div>`;
    }
  },

  /* ── 2  YouTube / Live Audio Transcription ───────────────────────── */
  {
    tag: '🎙️ Step 2 of 7',
    icon: '<i class="fa-solid fa-microphone"></i>',
    iconColor: '#ff9500',
    title: 'It Hears You AND the Interviewer',
    target: '#voice-btn', pos: 'center',
    body: `The <strong style="color:#ff9500;">Listen button ↑</strong> (glowing orange) hears <strong>both voices</strong>, the interviewer through your speakers <em>and you through your mic</em>. It knows who's speaking, so in a real interview it answers the interviewer's question the instant it's asked. <strong style="color:#4df4b1;">Turn it on and ask a question out loud yourself</strong> to watch it work.`,
    async action(zone) {
      zone.innerHTML = `
        <div style="display:flex; gap:7px; margin-bottom:11px;">
          <div style="flex:1; padding:9px 6px; background:rgba(255,149,0,0.08); border:1px solid rgba(255,149,0,0.24); border-radius:10px; text-align:center;">
            <i class="fa-solid fa-users" style="color:#ff9500; font-size:16px; display:block; margin-bottom:3px;"></i>
            <div style="font-size:9.5px; color:rgba(255,255,255,0.5); font-weight:600; line-height:1.3;">You +<br>interviewer</div>
          </div>
          <div style="display:flex; align-items:center; color:rgba(255,255,255,0.2); font-size:11px; padding:0 1px;">›</div>
          <div style="flex:1; padding:9px 6px; background:rgba(77,244,177,0.08); border:1px solid rgba(77,244,177,0.22); border-radius:10px; text-align:center;">
            <i class="fa-solid fa-microphone" style="color:#4df4b1; font-size:16px; display:block; margin-bottom:3px;"></i>
            <div style="font-size:9.5px; color:rgba(255,255,255,0.5); font-weight:600; line-height:1.3;">Whis<br>captures</div>
          </div>
          <div style="display:flex; align-items:center; color:rgba(255,255,255,0.2); font-size:11px; padding:0 1px;">›</div>
          <div style="flex:1; padding:9px 6px; background:rgba(167,139,255,0.08); border:1px solid rgba(167,139,255,0.22); border-radius:10px; text-align:center;">
            <i class="fa-solid fa-bolt" style="color:#a78bff; font-size:16px; display:block; margin-bottom:3px;"></i>
            <div style="font-size:9.5px; color:rgba(255,255,255,0.5); font-weight:600; line-height:1.3;">Answer<br>streams</div>
          </div>
        </div>
        <button class="demo-action-btn" id="da-yt-go" style="width:100%; padding:14px; font-size:13px; font-weight:800; gap:10px; justify-content:center; background:linear-gradient(135deg,rgba(255,68,68,0.18),rgba(255,100,100,0.06)); border:1.5px solid rgba(255,68,68,0.45); letter-spacing:-0.2px; box-shadow:0 4px 20px rgba(255,68,68,0.2), inset 0 1px 0 rgba(255,255,255,0.08);">
          <i class="fa-brands fa-youtube" style="color:#ff4444; font-size:15px;"></i>
          Open Interview Video &amp; Start Listening
        </button>
        <div id="da-yt-listening" style="display:none; margin-top:9px;"></div>`;

      zone.querySelector('#da-yt-go').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color:#ff6b6b;"></i> Opening…';
        btn.style.opacity = '0.7';
        btn.disabled = true;

        if (window.electronAPI?.openUrl) window.electronAPI.openUrl(DEMO_YOUTUBE_URL);
        if (!isAutoMode && typeof toggleRecording === 'function') toggleRecording();

        btn.style.opacity = '1';
        btn.style.background = 'rgba(77,244,177,0.05)';
        btn.style.borderColor = 'rgba(77,244,177,0.25)';
        btn.style.boxShadow = '0 4px 14px rgba(77,244,177,0.12)';
        btn.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#4df4b1;"></i> Opened, press Play to begin';

        const listeningDiv = zone.querySelector('#da-yt-listening');
        listeningDiv.style.display = 'block';
        listeningDiv.innerHTML = `
          <div style="padding:12px 14px; background:linear-gradient(135deg,rgba(255,68,68,0.07),rgba(255,68,68,0.03)); border:1.5px solid rgba(255,68,68,0.22); border-radius:11px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:7px;">
              <div style="position:relative; width:10px; height:10px; flex-shrink:0;">
                <span style="position:absolute;inset:0;background:#ff4444;border-radius:50%;animation:pulse 1s infinite;"></span>
                <span style="position:absolute;inset:-4px;border:1.5px solid rgba(255,68,68,0.4);border-radius:50%;animation:demoBtnRipple 1.2s ease-in-out infinite;"></span>
              </div>
              <div style="font-size:12px; font-weight:800; color:#ff6b6b; letter-spacing:-0.1px;">Listening live through your speakers</div>
              <div style="margin-left:auto; background:rgba(255,68,68,0.18); border:1px solid rgba(255,68,68,0.35); border-radius:5px; padding:2px 7px; font-size:9.5px; font-weight:800; color:#ff8080; letter-spacing:0.4px;">LIVE</div>
            </div>
            <div style="display:flex; gap:3px; margin-bottom:8px;">
              ${[1,2,3,4,5,6,7,8,9,10,11,12].map((_, i) => `<div style="flex:1; background:rgba(255,68,68,${0.2 + Math.random()*0.6}); border-radius:2px; height:${6 + Math.random()*14}px; animation:soundWave ${0.6 + i*0.08}s ease-in-out infinite alternate;"></div>`).join('')}
            </div>
            <div style="color:rgba(255,255,255,0.5); font-size:11px; line-height:1.55;">
              Now <strong style="color:#ff9f43;">speak a question out loud yourself</strong>, Whis hears you too. When you (or the interviewer) finish, press
              <kbd style="color:#a78bff; font-size:10px; background:rgba(167,139,255,0.14); padding:1px 7px; border-radius:4px; border:1px solid rgba(167,139,255,0.32); font-weight:700;">${_CTRL}+↵</kbd>
              and the answer streams instantly.
            </div>
          </div>`;

        // Re-spotlight the mic button after listeningStatusEl has shifted layout
        setTimeout(() => {
          const vb = document.querySelector('#voice-btn');
          if (vb && _demoActive) _demoSpotlight(vb);
        }, 450);

        _demoCleanup.push(() => {
          if (typeof isListening !== 'undefined' && isListening && typeof toggleRecording === 'function') toggleRecording();
        });
      });
    }
  },

  /* ── 3  LeetCode Screenshot OCR ─────────────────────────────────── */
  {
    tag: '📸 Step 3 of 7',
    icon: '<i class="fa-solid fa-camera"></i>',
    iconColor: '#ffd700',
    title: 'Screenshot → Live AI Solution',
    target: '#screenshot-btn', pos: 'center',
    body: window.WHIS_WEB
      ? `The <strong style="color:#ffd700;">camera button ↑</strong> (glowing gold) grabs the current frame from your shared tab, reads the problem with OCR, then fires the answer live, all in under 3 seconds.`
      : `The <strong style="color:#ffd700;">camera button ↑</strong> (glowing gold) hides Whis-AI, scans your screen, reads the problem with OCR, then fires the answer live, all in under 3 seconds.`,
    async action(zone) {
      zone.innerHTML = `
        <div style="display:flex; gap:7px; margin-bottom:11px;">
          <div style="flex:1; padding:9px 6px; background:rgba(255,215,0,0.07); border:1px solid rgba(255,215,0,0.2); border-radius:10px; text-align:center;">
            <i class="fa-solid fa-arrow-up-right-from-square" style="color:#ffd700; font-size:15px; display:block; margin-bottom:3px;"></i>
            <div style="font-size:9.5px; color:rgba(255,255,255,0.5); font-weight:600; line-height:1.3;">Open<br>LeetCode</div>
          </div>
          <div style="display:flex; align-items:center; color:rgba(255,255,255,0.2); font-size:11px; padding:0 1px;">›</div>
          <div style="flex:1; padding:9px 6px; background:rgba(255,100,0,0.07); border:1px solid rgba(255,140,0,0.2); border-radius:10px; text-align:center;">
            <i class="fa-solid fa-camera" style="color:#ffaa00; font-size:15px; display:block; margin-bottom:3px;"></i>
            <div style="font-size:9.5px; color:rgba(255,255,255,0.5); font-weight:600; line-height:1.3;">OCR<br>capture</div>
          </div>
          <div style="display:flex; align-items:center; color:rgba(255,255,255,0.2); font-size:11px; padding:0 1px;">›</div>
          <div style="flex:1; padding:9px 6px; background:rgba(167,139,255,0.07); border:1px solid rgba(167,139,255,0.2); border-radius:10px; text-align:center;">
            <i class="fa-solid fa-bolt" style="color:#a78bff; font-size:15px; display:block; margin-bottom:3px;"></i>
            <div style="font-size:9.5px; color:rgba(255,255,255,0.5); font-weight:600; line-height:1.3;">AI answers<br>live</div>
          </div>
        </div>
        <button class="demo-action-btn" id="da-lc-go" style="width:100%; padding:14px; font-size:13px; font-weight:800; gap:10px; justify-content:center; background:linear-gradient(135deg,rgba(255,215,0,0.16),rgba(255,165,0,0.06)); border:1.5px solid rgba(255,215,0,0.45); letter-spacing:-0.2px; box-shadow:0 4px 20px rgba(255,215,0,0.18), inset 0 1px 0 rgba(255,255,255,0.08);">
          <i class="fa-solid fa-camera" style="color:#ffd700; font-size:15px;"></i>
          Open LeetCode &amp; Screenshot → AI Live
        </button>
        <div id="da-lc-status" style="margin-top:9px;"></div>`;

      zone.querySelector('#da-lc-go').addEventListener('click', async (e) => {
        const btn    = e.currentTarget;
        const status = zone.querySelector('#da-lc-status');

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color:#ffd700;"></i> Opening LeetCode…';
        btn.style.opacity = '0.7';
        btn.disabled  = true;
        window.electronAPI?.openUrl(DEMO_LEETCODE_URL);

        // Give browser 1.5s to load before capturing
        await new Promise(r => setTimeout(r, 1500));

        btn.style.opacity = '1';
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color:#ffd700;"></i> Scanning screen…';
        status.innerHTML = `
          <div style="padding:12px 14px; background:linear-gradient(135deg,rgba(255,215,0,0.07),rgba(255,215,0,0.02)); border:1.5px solid rgba(255,215,0,0.22); border-radius:11px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
              <div style="position:relative; width:10px; height:10px; flex-shrink:0;">
                <span style="position:absolute;inset:0;background:#ffd700;border-radius:50%;animation:pulse 0.8s infinite;"></span>
                <span style="position:absolute;inset:-4px;border:1.5px solid rgba(255,215,0,0.4);border-radius:50%;animation:demoBtnRipple 1s ease-in-out infinite;"></span>
              </div>
              <div style="font-size:12px; font-weight:800; color:rgba(255,230,80,0.95); letter-spacing:-0.1px;">Scanning your screen…</div>
              <div style="margin-left:auto; background:rgba(255,215,0,0.18); border:1px solid rgba(255,215,0,0.35); border-radius:5px; padding:2px 7px; font-size:9.5px; font-weight:800; color:#ffd700; letter-spacing:0.4px;">OCR</div>
            </div>
            <div style="height:3px; background:rgba(255,215,0,0.12); border-radius:2px; overflow:hidden;">
              <div id="da-lc-scanbar" style="height:100%; width:0%; background:linear-gradient(90deg,#ffd700,#ffaa00); border-radius:2px; transition:width 1.2s ease;"></div>
            </div>
            <div style="color:rgba(255,255,255,0.4); font-size:10px; margin-top:6px;">Reading all visible text on screen</div>
          </div>`;
        // Animate the scan bar
        requestAnimationFrame(() => {
          const bar = document.getElementById('da-lc-scanbar');
          if (bar) { requestAnimationFrame(() => { bar.style.width = '90%'; }); }
        });

        let gotCapture = false;
        try {
          const res = await window.electronAPI.captureScreenDemo();
          if (res && res.dataUrl) {
            stagedScreenshotData = res.dataUrl;
            gotCapture = true;
            if (typeof extractTextFromImage === 'function') {
              try {
                const ocr = await extractTextFromImage(res.dataUrl);
                stagedScreenshotOcrText = (ocr && ocr.text) ? ocr.text : '';
              } catch (_) { stagedScreenshotOcrText = ''; }
            }
          }
        } catch (err) { console.error('Demo capture:', err); }

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color:#a78bff;"></i> Sending to AI…';
        status.innerHTML = `
          <div style="padding:12px 14px; background:linear-gradient(135deg,rgba(167,139,255,0.08),rgba(167,139,255,0.02)); border:1.5px solid rgba(167,139,255,0.25); border-radius:11px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
              <div style="position:relative; width:10px; height:10px; flex-shrink:0;">
                <span style="position:absolute;inset:0;background:#a78bff;border-radius:50%;animation:pulse 0.8s infinite;"></span>
                <span style="position:absolute;inset:-4px;border:1.5px solid rgba(167,139,255,0.4);border-radius:50%;animation:demoBtnRipple 1s ease-in-out infinite;"></span>
              </div>
              <div style="font-size:12px; font-weight:800; color:#c4b0ff; letter-spacing:-0.1px;">Sending screenshot to AI…</div>
              <div style="margin-left:auto; background:rgba(167,139,255,0.18); border:1px solid rgba(167,139,255,0.35); border-radius:5px; padding:2px 7px; font-size:9.5px; font-weight:800; color:#a78bff; letter-spacing:0.4px;">AI</div>
            </div>
            <div style="height:3px; background:rgba(167,139,255,0.12); border-radius:2px; overflow:hidden;">
              <div style="height:100%; width:60%; background:linear-gradient(90deg,#a78bff,#4df4b1); border-radius:2px; animation:demoShimmerSweep 1s ease-in-out infinite;"></div>
            </div>
            <div style="color:rgba(255,255,255,0.4); font-size:10px; margin-top:6px;">Answer will stream live in the chat above</div>
          </div>`;

        // Wipe any leftover voice state from YouTube step, then fire real AI call
        if (typeof hiddenTranscription !== 'undefined') hiddenTranscription = '';
        const inp = document.getElementById('input');
        if (inp) {
          inp.value = 'Solve this coding problem with explanation and working code:';
          inp.dispatchEvent(new Event('input'));
        }
        // Wait for any in-progress send to finish (max 6s)
        let w = 0;
        while (isProcessingSend && w < 6000) { await new Promise(r => setTimeout(r, 100)); w += 100; }
        if (typeof finalizeAndSend === 'function' && !isProcessingSend) finalizeAndSend();

        btn.style.background = 'rgba(77,244,177,0.06)';
        btn.style.borderColor = 'rgba(77,244,177,0.3)';
        btn.style.boxShadow   = '0 4px 16px rgba(77,244,177,0.15)';
        btn.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#4df4b1;"></i> AI is answering, scroll up ↑';
        status.innerHTML = `
          <div style="padding:12px 14px; background:linear-gradient(135deg,rgba(77,244,177,0.09),rgba(77,244,177,0.02)); border:1.5px solid rgba(77,244,177,0.28); border-radius:11px; display:flex; align-items:center; gap:12px; animation:demoFadeIn 0.3s ease;">
            <div style="width:32px; height:32px; border-radius:50%; background:rgba(77,244,177,0.14); border:1.5px solid rgba(77,244,177,0.35); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <i class="fa-solid fa-arrow-up" style="color:#4df4b1; font-size:14px;"></i>
            </div>
            <div>
              <div style="color:#4df4b1; font-size:12.5px; font-weight:800; letter-spacing:-0.1px;">Answer streaming live above</div>
              <div style="color:rgba(255,255,255,0.4); font-size:10px; margin-top:2px;">Scroll the chat up to read it${gotCapture ? ' · real screenshot captured' : ''}</div>
            </div>
          </div>`;
      });
    }
  },

  /* ── 4  Crisp Mode ───────────────────────────────────────────────── */
  {
    tag: '🎯 Step 4 of 7',
    icon: '<i class="fa-solid fa-bullseye"></i>',
    iconColor: '#4df4b1',
    title: 'Crisp Mode, Same Question, Two Answer Styles',
    target: '#crisp-toggle', pos: 'center',
    body: `The <strong style="color:#4df4b1;">Crisp toggle ↑</strong> (highlighted above) changes answer depth. Watch the same question answered both ways, type it yourself or click the auto-fill button.`,
    action(zone) {
      const QUESTION = 'What is memoization?';
      const LONG_ANS = `**Memoization** is an optimization technique where you cache the result of an expensive function call so the same computation isn't repeated for the same input.\n\n**How it works:**\nThe function checks a cache (usually a hash map) before computing. If the result already exists for the given input, it returns the cached value immediately, O(1) lookup. If not, it computes, stores the result, then returns.\n\n**Classic example:** Fibonacci without memoization is O(2ᴺ). With memoization it drops to **O(N)** because each sub-problem is solved exactly once.`;
      const SHORT_ANS = `• Cache function results to avoid repeated computation\n• Check cache first → compute only on cache miss\n• Fibonacci: O(2ᴺ) → O(N) with memoization`;

      let crispState = false; // demo always starts with Crisp OFF to show the contrast clearly
      let _tw = null;

      function _stopTypewriter() { if (_tw) { clearInterval(_tw); _tw = null; } }

      function _typeIntoInput(text, onDone) {
        _stopTypewriter();
        const inp = document.getElementById('input');
        if (!inp) { if (onDone) onDone(); return; }
        inp.value = '';
        inp.dispatchEvent(new Event('input'));
        let i = 0;
        _tw = setInterval(() => {
          if (i < text.length) {
            inp.value += text[i++];
            inp.dispatchEvent(new Event('input'));
          } else {
            _stopTypewriter();
            if (onDone) onDone();
          }
        }, 28);
        _demoCleanup.push(() => { _stopTypewriter(); if (inp.dataset.demoTyped === '1') { inp.value = ''; inp.dispatchEvent(new Event('input')); } });
        inp.dataset.demoTyped = '1';
      }

      function _render() {
        zone.innerHTML = `
          <div class="demo-crisp-live-row">
            <button class="demo-action-btn" id="da-crisp-autofill" style="flex:1;">
              <i class="fa-solid fa-keyboard"></i> Auto-type the question
            </button>
            <button class="demo-action-btn ${crispState ? 'demo-action-btn-green' : 'demo-action-btn-blue'}" id="da-crisp-tog">
              <i class="fa-solid fa-bullseye"></i> Crisp is ${crispState ? 'ON' : 'OFF'}, Toggle
            </button>
          </div>
          <div class="demo-crisp-split">
            <div class="demo-crisp-half${!crispState ? ' demo-crisp-half-active' : ''}">
              <div class="demo-crisp-half-label off-label"><i class="fa-solid fa-align-left"></i> Crisp OFF · Full answer</div>
              <div class="demo-crisp-half-body">${LONG_ANS.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</div>
            </div>
            <div class="demo-crisp-half${crispState ? ' demo-crisp-half-active' : ''}">
              <div class="demo-crisp-half-label on-label"><i class="fa-solid fa-bullseye"></i> Crisp ON · Quick bullets</div>
              <div class="demo-crisp-half-body">${SHORT_ANS.replace(/\n/g, '<br>')}</div>
            </div>
          </div>
          <div class="demo-crisp-cta">Toggle above, then press <kbd style="color:#a78bff; font-size:10px;">${_CTRL}+↵</kbd> to send for a real AI answer</div>`;

        zone.querySelector('#da-crisp-autofill').addEventListener('click', () => {
          _typeIntoInput(QUESTION);
        });
        zone.querySelector('#da-crisp-tog').addEventListener('click', () => {
          if (crispToggleBtn) crispToggleBtn.click();
          crispState = isCrisp;
          _render();
        });
      }

      _render();
      // Auto-start typewriter after a short delay
      setTimeout(() => _typeIntoInput(QUESTION), 500);
    }
  },

  /* ── 5  Context Manager ──────────────────────────────────────────── */
  {
    tag: '📄 Step 5 of 7',
    icon: '<i class="fa-solid fa-layer-group"></i>',
    iconColor: '#ff9f43',
    title: 'Context Manager, Add Your Background',
    target: null, pos: 'center',
    body: `Paste your resume once. From that moment, every single AI answer is personalised to <em>your</em> actual experience, skills and projects, not generic advice for a random candidate.`,
    async action(zone) {
      const TEMPLATE = `Name: [Your Name]
Role: [Your Current / Target Role]
Experience: [X years doing what]

Key Skills: [e.g. Python, React, AWS, Kubernetes]
Projects: [Brief description of 1-2 key projects]
Education: [Degree · University · Year]

Interview focus: [e.g. System Design, Frontend, ML, Backend]`;

      const _showSaved = () => {
        zone.innerHTML = `
          <div style="padding:14px; background:rgba(77,244,177,0.08); border:1px solid rgba(77,244,177,0.22); border-radius:10px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px; color:#4df4b1; font-size:13px; font-weight:700;">
              <i class="fa-solid fa-circle-check" style="font-size:16px;"></i>
              Background saved &amp; active!
            </div>
            <div style="color:rgba(255,255,255,0.6); font-size:12px; line-height:1.55;">
              Every AI answer from now on will reference your actual background. Ask any interview question and watch it get personalised to <em>you</em>.
            </div>
          </div>
          <button class="demo-action-btn" id="da-ctx-reopen" style="width:100%; margin-top:10px; font-size:12px; padding:10px;">
            <i class="fa-solid fa-pen"></i> Edit my context
          </button>`;
        zone.querySelector('#da-ctx-reopen').addEventListener('click', () => _openManager());
      };

      const _openManager = async () => {
        // Boost z-index so context overlay renders above the demo card (which is 99998)
        if (contextOverlay) {
          contextOverlay.style.zIndex  = '999999';
          contextOverlay.style.display = 'flex';
        }
        if (typeof fetchContexts === 'function') await fetchContexts();
        await new Promise(r => setTimeout(r, 150));

        // Open editor and pre-fill the template so user just fills in their real details
        if (typeof openEditor === 'function') openEditor();
        if (ctxNameInput    && !ctxNameInput.value)    ctxNameInput.value    = 'My Background';
        if (ctxContentInput && !ctxContentInput.value) ctxContentInput.value = TEMPLATE;

        // Watch for overlay close → detect save and show success
        const _obs = new MutationObserver(() => {
          if (contextOverlay && contextOverlay.style.display === 'none') {
            _obs.disconnect();
            if (contextOverlay) contextOverlay.style.zIndex = '';
            // Check if a context is now active
            const hasActive = localContexts && localContexts.some(c => c.isActive);
            if (hasActive) _showSaved();
          }
        });
        if (contextOverlay) {
          _obs.observe(contextOverlay, { attributes: true, attributeFilter: ['style'] });
          _demoCleanup.push(() => { _obs.disconnect(); if (contextOverlay) contextOverlay.style.zIndex = ''; });
        }
      };

      zone.innerHTML = `
        <div style="padding:11px 13px; background:rgba(255,159,67,0.08); border:1px solid rgba(255,159,67,0.22); border-radius:10px; margin-bottom:12px;">
          <div style="color:#ff9f43; font-size:10px; font-weight:700; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">
            <i class="fa-solid fa-lightbulb"></i> Why this matters
          </div>
          <div style="color:rgba(255,255,255,0.65); font-size:12px; line-height:1.55;">
            Without context, generic answers. With your resume, AI references your <strong style="color:#fff;">actual projects, skills and stack</strong> in every answer.
          </div>
        </div>
        <button class="demo-action-btn" id="da-ctx-open" style="width:100%; padding:13px; font-size:13px; font-weight:700; gap:9px; background:linear-gradient(135deg,rgba(255,159,67,0.12),rgba(167,139,255,0.08)); border-color:rgba(255,159,67,0.35);">
          <i class="fa-solid fa-layer-group" style="color:#ff9f43; font-size:15px;"></i>
          Open Context Manager &amp; Add My Background
        </button>`;

      zone.querySelector('#da-ctx-open').addEventListener('click', _openManager);
    }
  },

  /* ── 6  Stealth Proof ────────────────────────────────────────────── */
  {
    webHide: true, // desktop-only: getDisplayMedia in a browser shows the visible tab, contradicting the claim
    tag: '🛡️ Step 6 of 7',
    icon: '<i class="fa-solid fa-shield-halved"></i>',
    iconColor: '#4df4b1',
    title: 'Stealth, Invisible in Every Screen Recording',
    target: '#stealth-header-badge', pos: 'center',
    body: 'Whis-AI is blocked at the <strong>OS compositor level</strong>, Zoom, Meet, Teams and any recording software literally cannot capture it. Take a real screenshot right now to prove it.',
    async action(zone) {
      zone.innerHTML = `
        <div class="demo-stealth-explainer">
          <div class="demo-stealth-row">
            <i class="fa-brands fa-zoom" style="color:#c3a9ef;font-size:16px;"></i>
            <span><strong>Zoom screen-share</strong>, Whis-AI not visible</span>
            <i class="fa-solid fa-shield-halved" style="color:#4df4b1;"></i>
          </div>
          <div class="demo-stealth-row">
            <i class="fa-solid fa-video" style="color:#ea4335;font-size:16px;"></i>
            <span><strong>Screen recording</strong>, Whis-AI not captured</span>
            <i class="fa-solid fa-shield-halved" style="color:#4df4b1;"></i>
          </div>
          <div class="demo-stealth-row">
            <i class="fa-solid fa-camera" style="color:#ffd700;font-size:16px;"></i>
            <span><strong>Screenshot</strong>, proves it right now</span>
            <i class="fa-solid fa-shield-halved" style="color:#4df4b1;"></i>
          </div>
        </div>
        <div class="demo-action-steps" style="margin-top:10px;">
          <div class="demo-action-step" id="da-st-1">
            <div class="demo-action-num">1</div>
            <div class="demo-action-text">
              <strong>Take a real screenshot of your screen</strong>
              <span>This is exactly what your interviewer's recording would capture</span>
            </div>
            <button class="demo-action-btn demo-action-btn-green" id="da-st-shot">
              <i class="fa-solid fa-camera"></i> Prove It, Screenshot Now
            </button>
          </div>
          <div id="da-st-result" style="display:none; flex-direction:column; gap:8px; width:100%;">
            <div class="demo-stealth-confirmed">
              <i class="fa-solid fa-shield-halved"></i>
              Whis-AI does NOT appear in this screenshot
            </div>
            <img id="da-st-img" class="demo-screenshot-thumb" src="" />
            <div class="demo-stealth-note">This is what your interviewer's screen recording would show. Whis-AI is completely gone.</div>
          </div>
        </div>`;

      zone.querySelector('#da-st-shot').addEventListener('click', async () => {
        const btn = zone.querySelector('#da-st-shot');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Capturing…';
        btn.disabled  = true;

        // captureScreen() returns { dataUrl }, content protection makes the
        // Whis-AI window appear as a solid black rectangle in the screenshot.
        // That black area IS the stealth proof.
        try {
          const res = await window.electronAPI.captureScreen();
          const screenDataUrl = (res && res.dataUrl) ? res.dataUrl : null;

          if (screenDataUrl) {
            const img    = zone.querySelector('#da-st-img');
            const result = zone.querySelector('#da-st-result');
            const _showResult = () => {
              result.style.display     = 'flex';
              result.style.flexDirection = 'column';
              result.style.gap         = '8px';
              result.style.width       = '100%';
              zone.querySelector('#da-st-1').style.opacity = '0.5';
              btn.innerHTML = '<i class="fa-solid fa-check"></i> Captured, see proof below ↓';
            };
            img.onload = _showResult;
            img.onerror = () => {
              // Still show result area even if image fails, the text proof is enough
              _showResult();
              btn.innerHTML = '<i class="fa-solid fa-check"></i> Captured, see proof below ↓';
            };
            img.src              = screenDataUrl;
            // data: URLs decode synchronously in Electron, fire immediately if already complete
            if (img.complete && img.naturalWidth > 0) _showResult();
            img.style.display    = 'block';
            img.style.width      = '100%';
            img.style.maxHeight  = '130px';
            img.style.objectFit  = 'cover';
            img.style.borderRadius = '8px';
            img.style.border     = '1px solid rgba(255,255,255,0.15)';
            img.style.marginTop  = '4px';
          } else {
            btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Nothing returned';
            whisToast('captureScreen returned empty, check Screen Recording permission.', 'warning', 4000);
          }
        } catch(e) {
          btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Permission needed';
          whisToast('Grant Screen Recording in System Settings → Privacy & Security → Screen Recording, then try again.', 'warning', 5000);
        }
      });
    }
  },

  /* ── 7  Complete ─────────────────────────────────────────────────── */
  {
    tag: '🏆 All Done!',
    icon: '<i class="fa-solid fa-trophy"></i>',
    iconColor: '#ffd700',
    title: 'You\'re Ready. Go Get Hired.',
    target: null, pos: 'center',
    body: 'You just saw every feature work live, the exact edge you\'ll have in the real room. One quick checklist:',
    action(zone) {
      const _stealthLines = window.WHIS_WEB ? '' : `
          <div class="demo-check-item"><i class="fa-solid fa-check"></i> Stealth active, invisible to interviewers</div>
          <div class="demo-check-item"><i class="fa-solid fa-check"></i> ${_CTRL}+H if you ever need to hide instantly</div>`;
      zone.innerHTML = `
        <div class="demo-checklist">
          <div class="demo-check-item"><i class="fa-solid fa-check"></i> Resume uploaded in Context Manager</div>
          <div class="demo-check-item"><i class="fa-solid fa-check"></i> ${_CTRL}+L to listen${window.WHIS_WEB ? '' : ` · ${_CTRL}+J to screenshot`}</div>
          <div class="demo-check-item"><i class="fa-solid fa-check"></i> Crisp Mode ON for short glanceable hints</div>${_stealthLines}
        </div>
        <div class="demo-sales-close">
          <div class="demo-sales-line">This is your unfair advantage. The candidates who walk in with Whis walk out with the offer, don't face the interview that changes your life without it.</div>
          <div class="demo-sales-btns">
            <button class="demo-sales-elite" id="da-get-elite"><i class="fa-solid fa-bolt"></i> Get Elite, Land the Offer</button>
            <button class="demo-sales-skip" id="da-finish-btn">Keep exploring the trial</button>
          </div>
        </div>`;
      zone.querySelector('#da-finish-btn').addEventListener('click', closeWhisDemo);
      const _ge = zone.querySelector('#da-get-elite');
      if (_ge) _ge.addEventListener('click', () => { closeWhisDemo(); try { _showTrialEndedOffer(true); } catch (_) {} });
      setTimeout(() => { _fireTourConfetti(); _fireTourConfetti(); }, 300);
    }
  }

];

// On web, drop the stealth-proof step (browser getDisplayMedia would show the tab, contradicting the claim).
const DEMO_STEPS = window.WHIS_WEB
    ? _DEMO_STEPS_ALL.filter(s => !s.webHide)
    : _DEMO_STEPS_ALL;

/* ─── Demo engine helpers ─── */

function _demoBuildDots() {
  const el = document.getElementById('demo-dots');
  if (!el) return;
  el.innerHTML = '';
  DEMO_STEPS.forEach((_, i) => {
    const d = document.createElement('span');
    d.className = 'demo-dot' + (i === 0 ? ' active' : '');
    d.addEventListener('click', () => _demoGoTo(i));
    el.appendChild(d);
  });
}

function _demoClearSpotlight() {
  const hole = document.getElementById('demo-spot-hole');
  const glow = document.getElementById('demo-spot-glow');
  if (hole) { hole.setAttribute('width', '0'); hole.setAttribute('height', '0'); }
  if (glow) glow.setAttribute('display', 'none');
}

function _demoSpotlight(el) {
  const PAD  = 10;
  const EDGE = 4;
  const VW   = window.innerWidth;
  const VH   = window.innerHeight;
  const r    = el.getBoundingClientRect();

  // Clamp: highlight never bleeds outside the viewport
  const x = Math.max(EDGE, r.left - PAD);
  const y = Math.max(EDGE, r.top  - PAD);
  const w = Math.min(r.width  + PAD * 2, VW - x - EDGE);
  const h = Math.min(r.height + PAD * 2, VH - y - EDGE);

  // SVG mask hole (creates the clear window in the dim layer)
  const hole = document.getElementById('demo-spot-hole');
  if (hole) {
    hole.setAttribute('x',      x);
    hole.setAttribute('y',      y);
    hole.setAttribute('width',  w);
    hole.setAttribute('height', h);
    hole.setAttribute('rx', '11');
  }

  // SVG glow border, exact same coordinates as the hole, always pixel-perfect
  const glow = document.getElementById('demo-spot-glow');
  if (glow) {
    const IN = 1.5; // inset slightly so the stroke hugs the inside of the hole edge
    glow.setAttribute('x',       x + IN);
    glow.setAttribute('y',       y + IN);
    glow.setAttribute('width',   Math.max(0, w - IN * 2));
    glow.setAttribute('height',  Math.max(0, h - IN * 2));
    glow.setAttribute('rx',      '10');
    glow.setAttribute('display', 'block');
  }
}

function _demoPositionCard(targetRect, pos) {
  const card = document.getElementById('demo-card');
  if (!card) return;
  card.style.opacity = '0';
  card.style.transform = 'translateY(6px) scale(0.98)';
  requestAnimationFrame(() => {
    const M  = 14;
    const W  = window.innerWidth;
    const H  = window.innerHeight;
    const cW = card.offsetWidth  || 360;
    const cH = card.offsetHeight || 420;
    let left, top;

    if (!targetRect || pos === 'center') {
      left = W / 2 - cW / 2;
      top  = H / 2 - cH / 2;
    } else {
      const cx = targetRect.left + targetRect.width  / 2;
      switch (pos) {
        case 'bottom':      top = targetRect.bottom + M; left = cx - cW / 2; break;
        case 'top':         top = targetRect.top - cH - M; left = cx - cW / 2; break;
        case 'top-right':   top = targetRect.top - cH - M; left = targetRect.right - cW; break;
        case 'top-left':    top = targetRect.top - cH - M; left = targetRect.left; break;
        case 'right':       top = targetRect.top; left = targetRect.right + M; break;
        default:            left = W / 2 - cW / 2; top = H / 2 - cH / 2;
      }
      left = Math.max(M, Math.min(left, W - cW - M));
      top  = Math.max(M, Math.min(top,  H - cH - M));
    }
    card.style.left = left + 'px';
    card.style.top  = top  + 'px';
    card.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    card.style.opacity = '1';
    card.style.transform = 'translateY(0) scale(1)';
  });
}

// Map demo step index → which UI button to highlight + its glow color
const _DEMO_BTN_HIGHLIGHT = {
  2: { sel: '#voice-btn',      color: 'rgba(249,115,22,0.80)',  glow: 'rgba(249,115,22,0.45)' },
  3: { sel: '#screenshot-btn', color: 'rgba(255,215,0,0.80)',   glow: 'rgba(255,215,0,0.42)'  },
};

function _demoClearBtnHighlight() {
  document.querySelectorAll('.demo-btn-highlight').forEach(el => {
    el.classList.remove('demo-btn-highlight');
    el.style.removeProperty('--demo-hl-color');
    el.style.removeProperty('--demo-hl-glow');
  });
}

function _demoGoTo(index) {
  _demoStep = Math.max(0, Math.min(index, DEMO_STEPS.length - 1));
  const step  = DEMO_STEPS[_demoStep];
  const total = DEMO_STEPS.length;

  // Step-specific side effects before rendering
  if (_demoStep === 3) {
    // Entering LeetCode step, stop mic so audio doesn't bleed into capture
    if (typeof isListening !== 'undefined' && isListening && typeof toggleRecording === 'function') {
      toggleRecording();
    }
  }
  if (_demoStep === 4) {
    // Entering Crisp step, always start with Crisp OFF so user sees the contrast
    if (typeof isCrisp !== 'undefined' && isCrisp && crispToggleBtn) {
      crispToggleBtn.click();
    }
  }

  // Highlight the relevant UI button for this step (mic on step 2, screenshot on step 3)
  _demoClearBtnHighlight();
  const _hlCfg = _DEMO_BTN_HIGHLIGHT[_demoStep];
  if (_hlCfg) {
    const _hlEl = document.querySelector(_hlCfg.sel);
    if (_hlEl) {
      _hlEl.style.setProperty('--demo-hl-color', _hlCfg.color);
      _hlEl.style.setProperty('--demo-hl-glow',  _hlCfg.glow);
      _hlEl.classList.add('demo-btn-highlight');
    }
  }

  // Header
  document.getElementById('demo-step-num').textContent   = _demoStep + 1;
  document.getElementById('demo-step-total').textContent = total;
  // Web drops the stealth step, so the "Step N of 7" tag labels would be off by one.
  document.getElementById('demo-tag').textContent         = window.WHIS_WEB
      ? step.tag.replace(/Step \d+ of \d+/, `Step ${_demoStep + 1} of ${total}`)
      : step.tag;
  document.getElementById('demo-title').textContent       = step.title;
  document.getElementById('demo-body').innerHTML          = step.body;

  // Icon
  const iconWrap = document.getElementById('demo-icon-wrap');
  if (iconWrap) {
    iconWrap.innerHTML = `<div class="demo-card-icon" style="color:${step.iconColor};">${step.icon}</div>`;
  }

  // Progress
  document.getElementById('demo-card-prog').style.width = (((_demoStep + 1) / total) * 100) + '%';
  document.getElementById('demo-progress-fill').style.width = (((_demoStep + 1) / total) * 100) + '%';

  // Dots
  document.querySelectorAll('.demo-dot').forEach((d, i) => d.classList.toggle('active', i === _demoStep));

  // Next/finish button
  const nextBtn = document.getElementById('demo-next');
  if (_demoStep === total - 1) {
    nextBtn.innerHTML = '<i class="fa-solid fa-check"></i> Done!';
    nextBtn.style.background = 'linear-gradient(135deg, #ffd700, #ff9f43)';
  } else {
    nextBtn.innerHTML = 'Next <i class="fa-solid fa-arrow-right"></i>';
    nextBtn.style.background = '';
  }

  // Back button
  const backBtn = document.getElementById('demo-back');
  if (backBtn) backBtn.disabled = (_demoStep === 0);

  // Fill action zone
  const zone = document.getElementById('demo-action-zone');
  zone.innerHTML = '';
  if (typeof step.action === 'function') {
    step.action(zone);
  }

  // Spotlight + card position, run inside rAF so the action zone has
  // fully painted before we measure element positions and card height.
  _demoClearSpotlight();
  requestAnimationFrame(() => {
    const fill = document.getElementById('demo-spot-fill');
    const card = document.getElementById('demo-card');

    const targetEl = step.target ? document.querySelector(step.target) : null;

    if (targetEl) {
      if (fill) fill.setAttribute('fill', 'rgba(3,5,16,0.72)');
      _demoSpotlight(targetEl);
    } else {
      if (fill) fill.setAttribute('fill', 'rgba(3,5,16,0.42)');
    }

    // Center the card, safe for all window sizes
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(8px) scale(0.97)';
      requestAnimationFrame(() => {
        const M  = 12;
        const W  = window.innerWidth;
        const H  = window.innerHeight;
        const cW = card.offsetWidth  || 360;
        const cH = card.offsetHeight || 440;
        const left = Math.max(M, Math.min(W / 2 - cW / 2, W - cW - M));
        const top  = Math.max(M, Math.min(H / 2 - cH / 2, H - cH - M));
        card.style.left = left + 'px';
        card.style.top  = top  + 'px';
        card.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0) scale(1)';
      });
    }
  });
}

function openWhisDemo() {
  profileDropdownMenu.style.display = 'none';
  const overlay = document.getElementById('whis-demo-overlay');
  if (!overlay) return;
  _demoActive = true;
  _demoCleanup = [];
  _demoStep = 0;
  overlay.style.display = 'block';
  // Keep pointer-events:none on the overlay so the app stays fully interactive.
  // Only the demo-card itself has pointer-events:all (set inline in HTML).
  _demoBuildDots();
  requestAnimationFrame(() => _demoGoTo(0));
}

function closeWhisDemo() {
  _demoCleanup.forEach(fn => { try { fn(); } catch(e) {} });
  _demoCleanup = [];
  _demoActive = false;
  const overlay = document.getElementById('whis-demo-overlay');
  if (overlay) { overlay.style.display = 'none'; overlay.style.pointerEvents = 'none'; }
  _demoClearSpotlight();
  _demoClearBtnHighlight();
}

// Wire up demo navigation
(function _initDemo() {
  const nextBtn  = document.getElementById('demo-next');
  const backBtn  = document.getElementById('demo-back');
  const skipBtn  = document.getElementById('demo-skip');
  const closeBtn = document.getElementById('demo-close-x');
  const launcher = document.getElementById('demo-launch-btn');

  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (_demoStep < DEMO_STEPS.length - 1) _demoGoTo(_demoStep + 1);
    else closeWhisDemo();
  });
  if (backBtn) backBtn.addEventListener('click', () => {
    if (_demoStep > 0) _demoGoTo(_demoStep - 1);
  });
  if (skipBtn)  skipBtn.addEventListener('click',  closeWhisDemo);
  if (closeBtn) closeBtn.addEventListener('click',  closeWhisDemo);
  if (launcher) launcher.addEventListener('click',  openWhisDemo);
})();

// ================================================================
// CONTEXT ONBOARDING, shown once after stealth wizard, before tour
// ================================================================
function _showContextOnboarding() {
    const overlay = document.getElementById('ctx-onboard-overlay');
    if (!overlay) return;
    // Don't nag on every login. Auto-show at most ONCE ever, and never if the
    // user already has any saved context. Users can always reopen this from
    // Profile → Manage Contexts. (Fixes "resume notification is too frequent".)
    try {
        if (Array.isArray(localContexts) && localContexts.length > 0) return;
        if (localStorage.getItem('wh_ctx_onboard_seen')) return;
        localStorage.setItem('wh_ctx_onboard_seen', '1');
    } catch (_) {}
    overlay.style.display = 'flex';
}

function _closeContextOnboarding(skipToTour = true) {
    const overlay = document.getElementById('ctx-onboard-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.25s ease';
        setTimeout(() => {
            overlay.style.display = 'none';
            overlay.style.opacity = '';
            overlay.style.transition = '';
        }, 260);
    }
    if (skipToTour && !hasShownTourThisSession) {
        hasShownTourThisSession = true;
        setTimeout(() => openWhisTour(), 350);
    }
}

(function _initContextOnboarding() {
    const saveBtn   = document.getElementById('ctx-ob-save-btn');
    const skipBtn   = document.getElementById('ctx-ob-skip-btn');
    const textarea  = document.getElementById('ctx-ob-textarea');
    const uploadBtn = document.getElementById('ctx-ob-upload-btn');
    const fileInput = document.getElementById('ctx-ob-file-input');
    const charHint  = document.getElementById('ctx-ob-char-hint');

    if (textarea && charHint) {
        textarea.addEventListener('input', () => {
            const len = textarea.value.length;
            charHint.textContent = `${len.toLocaleString()} / 32,768 characters`;
            charHint.style.color = len > 30000 ? '#ff6b6b' : '';
        });
    }

    const closeXBtn = document.getElementById('ctx-ob-close-btn');
    if (closeXBtn) closeXBtn.addEventListener('click', () => _closeContextOnboarding(false));

    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            _closeContextOnboarding(true);
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const content = textarea ? textarea.value.trim() : '';
            if (!content) {
                whisToast('Please paste your resume or background first, or click Skip.', 'warning', 3500);
                if (textarea) textarea.focus();
                return;
            }
            if (content.length > 32768) {
                whisToast('Content is too long, please trim to under 32,768 characters.', 'warning', 3500);
                return;
            }
            if (!currentUser) { whisToast('Not signed in, please reload.', 'error'); return; }

            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
            saveBtn.disabled = true;

            try {
                const googleId = currentUser.googleId || currentUser.id;
                const res = await fetch(`${BACKEND_URL}/api/user/context`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-google-id': googleId,
                        'x-whis-auth': APP_AUTH_TOKEN
                    },
                    body: JSON.stringify({ name: 'My Background', content, id: null })
                });

                if (!res.ok) throw new Error(`Server ${res.status}`);
                const data = await res.json();

                if (data.error) {
                    whisToast(data.error, 'error');
                } else {
                    if (data.contexts) {
                        localContexts = data.contexts;

                        // Find the newly saved context, prefer server-returned id,
                        // fall back to name match, then the most-recently-created item.
                        const newCtx = (data.context && data.context.id)
                            ? data.contexts.find(c => c.id === data.context.id)
                            : data.contexts.find(c => c.name === 'My Background')
                              || data.contexts[data.contexts.length - 1];

                        if (newCtx) {
                            // Only toggle if not already active, toggle flips the state
                            if (!newCtx.active) {
                                await toggleContextActive(newCtx.id);
                            } else {
                                renderContextList();
                                updateActiveContextBadge();
                            }
                        } else {
                            renderContextList();
                            updateActiveContextBadge();
                        }
                    }
                    _closeContextOnboarding(true);
                    setTimeout(() => {
                        whisToast('✓ Context saved &amp; activated, every answer will now reference your background!', 'success', 4500);
                    }, 400);
                }
            } catch (e) {
                console.error('Context onboard save error:', e);
                whisToast('Save failed, check your connection and try again.', 'error');
            } finally {
                saveBtn.innerHTML = '<i class="fa-solid fa-sparkles"></i> Save &amp; Personalize My Answers';
                saveBtn.disabled = false;
            }
        });
    }

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const ext = file.name.split('.').pop().toLowerCase();
            if (!['txt', 'pdf', 'docx'].includes(ext)) {
                whisToast('Only TXT, PDF, and DOCX files are supported.', 'warning'); return;
            }
            if (file.size > 5 * 1024 * 1024) {
                whisToast('File is too large, maximum 5 MB.', 'warning'); return;
            }
            const origBtnHtml = uploadBtn.innerHTML;
            uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing…';
            uploadBtn.disabled = true;
            try {
                const arrayBuffer = await file.arrayBuffer();
                const result = await window.electronAPI.extractFileText(arrayBuffer, ext);
                if (result.error) {
                    whisToast(result.error, 'error');
                } else if (result.text) {
                    if (textarea) {
                        textarea.value = result.text;
                        textarea.dispatchEvent(new Event('input'));
                    }
                    whisToast(`"${file.name}" loaded successfully.`, 'success', 2500);
                }
            } catch (err) {
                whisToast('Could not read this file, please paste the text manually.', 'error');
            } finally {
                uploadBtn.innerHTML = origBtnHtml;
                uploadBtn.disabled = false;
                fileInput.value = '';
            }
        });
    }
})();

if (contextManagerBtn) {
    contextManagerBtn.addEventListener("click", () => {
        profileDropdownMenu.style.display = "none";
        contextOverlay.style.display = "flex";
        fetchContexts();
    });
}

if (closeContextBtn) {
    closeContextBtn.addEventListener("click", () => {
        contextOverlay.style.display = "none";
        closeEditor(); 
    });
}

if (addNewContextBtn) {
    addNewContextBtn.addEventListener("click", () => {
        if(localContexts.length >= 10) { whisToast("Maximum 10 contexts allowed", "warning"); return; }
        openEditor();
    });
}

if (ctxUploadBtn && ctxFileInput) {
    ctxUploadBtn.addEventListener("click", () => {
        ctxFileInput.click();
    });

    ctxFileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const ext = file.name.split('.').pop().toLowerCase();
        if (!['txt', 'pdf', 'docx'].includes(ext)) {
            whisToast("Only TXT, PDF, and DOCX files are supported", "warning");
            ctxFileInput.value = '';
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            whisToast("File is too large, maximum 5 MB", "warning");
            ctxFileInput.value = '';
            return;
        }

        const originalBtnText = ctxUploadBtn.innerHTML;
        ctxUploadBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing...`;
        ctxUploadBtn.disabled = true;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const result = await window.electronAPI.extractFileText(arrayBuffer, ext);
            
            if (result.error) {
                whisToast(result.error, "error");
            } else if (result.text) {
                let text = result.text.trim();
                const cleanedText = text.replace(/\s+/g, ' ');
                if (cleanedText.length > 20000) {
                    whisToast("File has too much text, upload a 1–2 page resume or JD", "warning");
                } else {
                    if (cleanedText.length > 32768) {
                        whisToast("Text truncated to fit the 32,768 character limit", "info", 3500);
                    }
                    ctxContentInput.value = text.replace(/\n{3,}/g, '\n\n').substring(0, 32768);
                    whisToast("File loaded, review and save", "success", 3000);
                }
            } else {
                whisToast("No text could be extracted from this file", "warning");
            }
        } catch (err) {
            console.error("File extraction error:", err);
            whisToast("Failed to process file, try a different format", "error");
        } finally {
            ctxUploadBtn.innerHTML = originalBtnText;
            ctxUploadBtn.disabled = false;
            ctxFileInput.value = ''; 
        }
    });
}

if (saveCtxBtn) saveCtxBtn.addEventListener("click", saveContext);
if (cancelCtxBtn) cancelCtxBtn.addEventListener("click", closeEditor);

// ========================================================
// --- 2. Chat & Streaming Logic ---
// ========================================================

const state = {
  isSending: false,
  messages: [{ id: "welcome", role: "assistant", content: "Ready.", timestamp: new Date().toISOString() }],
  pendingStream: null
};

let streamBuffer = "";
let _streamLastTokenAt = 0;
let _streamStuckTimer  = null;
let _partialAnswerBuffer = '';
let _streamStartAt  = 0;
// Streaming render throttle, re-rendering the whole answer on EVERY token runs a
// heavy markdown parse on the main thread, which starves the ScriptProcessor audio
// callback and drops 2–4s of interviewer audio. Coalesce to ~11 renders/sec so the
// audio thread keeps up. Tokens still accumulate every message; only the DOM paint
// is throttled, and a final flush at stream-end guarantees the complete text shows.
let _streamRenderPending = false;
let _streamLastRenderAt  = 0;
const STREAM_RENDER_INTERVAL_MS = 90;
function scheduleStreamRender(activeId) {
  if (_streamRenderPending) return;
  _streamRenderPending = true;
  const wait = Math.max(0, STREAM_RENDER_INTERVAL_MS - (Date.now() - _streamLastRenderAt));
  setTimeout(() => {
    requestAnimationFrame(() => {
      _streamRenderPending = false;
      // Bail if the stream already ended (prevents a late paint re-adding the cursor).
      if (!state.pendingStream || state.pendingStream.id !== activeId) return;
      _streamLastRenderAt = Date.now();
      renderMessages(activeId, false);
    });
  }, wait);
}
let _latencyTimer   = null;

function resetStreamControllerId() {
    CURRENT_STREAM_CONTROLLER_ID = crypto.randomUUID();
}

function cleanupStreamState() {
    if (_streamStuckTimer) { clearInterval(_streamStuckTimer); _streamStuckTimer = null; }
    if (_latencyTimer) { clearInterval(_latencyTimer); _latencyTimer = null; }
    const _latEl = document.getElementById('stream-latency');
    if (_latEl) { _latEl.style.display = 'none'; }

    state.pendingStream = null;
    state.isSending = false;
    isProcessingSend = false;

    document.querySelectorAll('.stream-cursor').forEach(el => el.remove());

    sendBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i>`;
    sendBtn.disabled = false;

    // Flash "what to do next" after answer completes
    const sym = (typeof CTRL !== 'undefined') ? CTRL : '⌘';
    _flashHint(
        `Answer ready · hover any bubble to copy · press <span class="ch-key">${sym}+L</span> for the next question`,
        'ready', 5000
    );

    // Peak-emotion upgrade nudge, once per trial, right after a strong answer lands.
    try { _maybeShowPeakEmotionNudge(); } catch (_) {}

    if (listeningStatusEl.classList.contains("active") &&
       (listeningStatusEl.innerHTML.includes("Sending") || listeningStatusEl.innerHTML.includes("Extracted"))) {
         listeningStatusEl.classList.remove("active");
         listeningStatusEl.innerHTML = "";
         listeningStatusEl.style.display = "none";
    }

    // ── Read-time badge + follow-up chips on the last completed answer ──
    const lastAssistant = state.messages.filter(m => m.role === 'assistant' && m.content).pop();
    if (!lastAssistant) { _saveSession(); _logHealth('send_done'); return; }
    const lastEl = document.getElementById(`msg-${lastAssistant.id}`);
    if (!lastEl) { _saveSession(); _logHealth('send_done'); return; }

    // Read-time badge: avg speaking pace ~130 wpm = ~2.17 words/sec
    const actionsEl = lastEl.querySelector('.msg-actions');
    if (actionsEl && !actionsEl.querySelector('.read-time-badge')) {
        const wordCount = lastAssistant.content.trim().split(/\s+/).length;
        const secs = Math.max(5, Math.round(wordCount / 2.17));
        const badge = document.createElement('span');
        badge.className = 'read-time-badge';
        badge.title = 'Estimated time to say this answer aloud';
        badge.textContent = `~${secs}s`;
        actionsEl.prepend(badge);
    }

    // Follow-up chips
    if (!lastEl.querySelector('.followup-chips')) {
        const chips = document.createElement('div');
        chips.className = 'followup-chips';
        [
            { label: 'Simpler',    prompt: 'Simplify the previous answer, use plain language and keep it under 4 bullet points.' },
            { label: 'Show code',  prompt: 'Show a concrete code example for the previous answer.' },
            { label: 'Explain code', prompt: 'Explain the code from the previous answer line by line in plain English, what each part does and why, so I can narrate it out loud.' },
            { label: 'STAR',       prompt: 'Rewrite the previous answer in STAR format (Situation, Task, Action, Result).' },
            { label: 'Shorter',    prompt: 'Make the previous answer shorter, 3 bullet points max, no fluff.' },
            { label: 'Deeper',     prompt: 'Go deeper on the previous answer, add technical depth, edge cases, and trade-offs.' },
        ].forEach(({ label, prompt }) => {
            const btn = document.createElement('button');
            btn.className = 'followup-chip';
            btn.textContent = label;
            btn.dataset.prompt = prompt;
            chips.appendChild(btn);
        });
        lastEl.appendChild(chips);
    }

    _saveSession();
    _logHealth('send_done');
}

function stopStream() {
    if (state.isSending && window.electronAPI.cancelChatStream) {
        window.electronAPI.cancelChatStream(CURRENT_STREAM_CONTROLLER_ID);
        if (state.pendingStream) {
            const msg = state.messages.find((m) => m.id === state.pendingStream.id);
            if (msg) {
                msg.content += "\n\n(Response stopped by user.)";
            }
        }
        cleanupStreamState(); 
        resetStreamControllerId(); 
    }
}

if (window.electronAPI) {
  if (window.electronAPI.onToggleVoice) {
    window.electronAPI.onToggleVoice(() => {
       _flashShortcutLabel(CTRL + '+L  Mic');
       toggleRecording();
    });
  }

  if (window.electronAPI.onTriggerScreenshot) {
    window.electronAPI.onTriggerScreenshot(() => {
       if (_demoActive) return;
       _flashShortcutLabel(CTRL + '+J  Screenshot');
       handleScreenshotStage();
    });
  }

  if (window.electronAPI.onChatStreamChunk) {
    window.electronAPI.onChatStreamChunk((chunk) => {
      if (!state.pendingStream) return;
      
      const isFirstChunk = state.pendingStream.content === "";

      streamBuffer += chunk;
      const lines = streamBuffer.split("\n");
      streamBuffer = lines.pop(); 
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const jsonStr = trimmed.replace("data: ", "").trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            state.pendingStream.content += content;
            _streamLastTokenAt = Date.now();
            _partialAnswerBuffer = state.pendingStream.content;
            const msg = state.messages.find((m) => m.id === state.pendingStream.id);
            if (msg) {
              msg.content = state.pendingStream.content;
              // First chunk paints immediately (creates the bubble); the rest are
              // throttled so the streaming markdown parse can't starve audio→text.
              if (isFirstChunk) renderMessages(state.pendingStream.id, true);
              else scheduleStreamRender(state.pendingStream.id);
              // WEB Live Mode: mirror the same answer into the floating PiP panel.
              if (window.WHIS_WEB && typeof WhisLive !== 'undefined') {
                WhisLive.mirrorAnswer(state.pendingStream.content, isFirstChunk);
              }
            }
          }
        } catch {}
      }
    });
  }

  if (window.electronAPI.onChatStreamEnd) {
    window.electronAPI.onChatStreamEnd((fullText) => {
      // Final flush: paint any tokens still pending in the throttle window so the
      // complete answer is guaranteed on screen, then strip the streaming cursor.
      if (state.pendingStream) {
        const m = state.messages.find(x => x.id === state.pendingStream.id);
        if (m) { m.content = state.pendingStream.content; renderMessages(state.pendingStream.id, false); }
      }
      _streamRenderPending = false;
      document.querySelectorAll('.stream-cursor').forEach(el => el.remove());
      // WEB Live Mode: final flush + drop the streaming cursor in the PiP panel.
      if (window.WHIS_WEB && typeof WhisLive !== 'undefined') {
        WhisLive.endAnswer(state.pendingStream ? state.pendingStream.content : fullText);
      }
      cleanupStreamState();
      resetStreamControllerId();
    });
  }
}

function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// For support (AI) messages only, escape HTML then turn bare URLs into clickable links.
function formatSupportMessage(str) {
  if (!str) return "";
  const escaped = escapeHTML(str);
  return escaped.replace(
    /(https?:\/\/[^\s&quot;&#39;<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="support-msg-link">$1</a>'
  );
}

// Lightweight IDE-style syntax highlighter for code blocks. Works on already
// HTML-escaped code: it stashes strings/comments, then colours numbers, keywords and
// Types via <span class="hl-*"> (all wrapping is stashed so span attributes can't be
// re-matched), then restores. Good enough for a clean, coloured, image-#9 look with no
// external library and no issues during streaming.
const _HL_KEYWORDS = /\b(class|interface|enum|struct|new|extends|implements|import|from|package|public|private|protected|static|final|abstract|void|const|let|var|function|def|lambda|return|if|else|elif|for|while|do|switch|case|default|break|continue|try|catch|except|finally|throw|throws|raise|async|await|yield|in|is|as|with|and|or|not|true|false|null|None|nil|undefined|this|self|super|typeof|instanceof|int|long|short|byte|float|double|boolean|bool|char|string|str)\b/g;
function highlightCode(escaped) {
  if (!escaped) return escaped;
  const stash = [];
  const put = (cls, txt) => { stash.push('<span class="hl-' + cls + '">' + txt + '</span>'); return String.fromCharCode(0xE000 + stash.length - 1); };
  let s = escaped;
  s = s.replace(/&quot;(?:&(?!quot;)|[^&])*?&quot;/g, m => put('str', m));
  s = s.replace(/&#39;(?:&(?!#39;)|[^&])*?&#39;/g, m => put('str', m));
  s = s.replace(/\/\*[\s\S]*?\*\//g, m => put('com', m));
  s = s.replace(/(^|[^:&])(\/\/[^\n]*)/g, (m, p, c) => p + put('com', c));
  s = s.replace(/(^|\n)([ \t]*)(#[^\n]*)/g, (m, a, b, c) => a + b + put('com', c));
  s = s.replace(/\b(0x[0-9a-fA-F]+|\d+(?:\.\d+)?)\b/g, m => put('num', m));
  s = s.replace(_HL_KEYWORDS, m => put('kw', m));
  s = s.replace(/\b([A-Z][A-Za-z0-9_]*)\b/g, m => put('typ', m));
  for (let k = 0; k < 6 && /[-]/.test(s); k++) {
    s = s.replace(/[-]/g, c => stash[c.charCodeAt(0) - 0xE000] || c);
  }
  return s;
}
// Turn a model answer into clean, speak-out-loud "blocks". Line-based parsing gives
// real paragraphs (blank line = new paragraph, not a wall of <br>), proper numbered
// and bulleted lists, headings, inline `code`, and fenced code blocks. The goal is a
// reader can glance at one block, say it, and move to the next with zero friction.
// Pull the model's private "ASSIST_CUE: <topic>" first line, a refined, concise
// summary of what was asked (e.g. "Java code for prime numbers"). Shown as the Assist
// label, never in the spoken answer.
function _extractAssistTopic(text) {
  if (!text) return '';
  const m = text.match(/^\s*ASSIST_CUE:\s*(.+?)\s*(?:\n|$)/i);
  return m ? m[1].replace(/[."'\s]+$/, '').slice(0, 90) : '';
}

function formatMessageContent(text) {
  if (!text) return "";

  // Strip the private ASSIST_CUE line so it never shows inside the answer body.
  text = text.replace(/^\s*ASSIST_CUE:[^\n]*\n?/i, '');

  // 1. Pull fenced code blocks out FIRST so nothing inside them gets reformatted.
  const codeBlocks = [];
  let src = text.replace(/```([\s\S]*?)```/g, (m, code) => {
    codeBlocks.push(code);
    return ` CB${codeBlocks.length - 1} `;
  });

  // 2. Escape, then protect inline `code` spans from further formatting.
  src = escapeHTML(src);
  const inlineCode = [];
  src = src.replace(/`([^`\n]+)`/g, (m, c) => {
    inlineCode.push(c);
    return `IC${inlineCode.length - 1}`;
  });

  // Inline emphasis (bold only, safe for technical prose with stray asterisks).
  const inline = (s) => s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 3. Walk line by line, grouping into paragraphs / lists / headings.
  const lines = src.split('\n');
  let out = '';
  let listType = null;      // 'ul' | 'ol'
  let para = [];

  const flushPara = () => {
    if (para.length) { out += '<p>' + inline(para.join(' ')) + '</p>'; para = []; }
  };
  const closeList = () => { if (listType) { out += `</${listType}>`; listType = null; } };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushPara(); closeList(); continue; }

    const mCode = line.match(/^ CB(\d+) $/);
    const mH    = line.match(/^(#{1,3})\s+(.*)$/);
    const mOl   = line.match(/^(\d+)[.)]\s+(.*)$/);
    const mUl   = line.match(/^[-*•]\s+(.*)$/);

    if (mCode) {
      flushPara(); closeList();
      out += ` CB${mCode[1]} `;           // reinjected below
    } else if (mH) {
      flushPara(); closeList();
      const lvl = mH[1].length;
      out += `<h${lvl}>${inline(mH[2])}</h${lvl}>`;
    } else if (mOl) {
      flushPara();
      if (listType !== 'ol') { closeList(); out += '<ol>'; listType = 'ol'; }
      out += `<li>${inline(mOl[2])}</li>`;
    } else if (mUl) {
      flushPara();
      if (listType !== 'ul') { closeList(); out += '<ul>'; listType = 'ul'; }
      out += `<li>${inline(mUl[1])}</li>`;
    } else {
      closeList();
      para.push(line);                               // wraps within the paragraph
    }
  }
  flushPara(); closeList();

  // 4. Restore inline code.
  out = out.replace(/IC(\d+)/g, (m, i) =>
    `<code class="whis-inline-code">${inlineCode[i]}</code>`);

  // 5. Restore fenced code blocks (escaped, then syntax-highlighted).
  out = out.replace(/ CB(\d+) /g, (m, i) => {
    const code = codeBlocks[i] || '';
    const cleanCode = escapeHTML(code.replace(/^[a-z0-9+#]+\n/i, '').replace(/^\n+/, '').replace(/\s+$/, ''));
    return `<div class="code-block-wrapper"><button class="copy-code-btn"><i class="fa-regular fa-copy"></i></button><pre class="whis-code-block"><code>${highlightCode(cleanCode)}</code></pre></div>`;
  });

  return out;
}

// Follow-up chip click handler
document.addEventListener('click', (e) => {
    const chip = e.target.closest('.followup-chip');
    if (!chip) return;
    const prompt = chip.dataset.prompt;
    if (!prompt) return;
    // Remove all chip rows so they don't stack
    document.querySelectorAll('.followup-chips').forEach(el => el.remove());
    // Inject the prompt and send
    if (inputEl) inputEl.value = prompt;
    finalizeAndSend();
});

// Global Click Listener for Copy Buttons
document.addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('.copy-code-btn');
    if (!copyBtn) return;

    const preBlock = copyBtn.nextElementSibling;
    if (!preBlock) return;

    const codeToCopy = preBlock.textContent;

    const showSuccess = () => {
        copyBtn.innerHTML = '<i class="fa-solid fa-check" style="color: #4df4b1;"></i>';
        setTimeout(() => {
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
        }, 2000);
    };

    try {
        await navigator.clipboard.writeText(codeToCopy);
        showSuccess();
    } catch (err) {
        console.error('Clipboard API failed, using fallback.', err);
        const textArea = document.createElement("textarea");
        textArea.value = codeToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showSuccess();
    }
});

// ================================================================
// WEB WELCOME / EMPTY STATE (conversion-optimized)
// ----------------------------------------------------------------
// A confident welcome with 6 one-tap starter questions. Tapping one sends it
// through the exact same path a typed question uses (set #input, dispatch
// 'input', call finalizeAndSend) so the user sees a streaming answer within
// seconds, the fastest route to the "aha". If the composer is locked (no
// active trial/plan), we start the free trial first, one tap → trial → answer.
// WEB-only; never rendered on desktop Electron.
// ================================================================
const _WEB_STARTER_QUESTIONS = [
  { icon: 'fa-user', text: 'Tell me about yourself' },
  { icon: 'fa-bullseye', text: 'Why do you want this role?' },
  { icon: 'fa-scale-balanced', text: "What's your biggest weakness?" },
  { icon: 'fa-code', text: 'Explain REST vs GraphQL' },
  { icon: 'fa-bug', text: 'Walk me through a hard bug you fixed' },
  { icon: 'fa-people-arrows', text: 'Describe a conflict with a teammate' },
];

// Honest listening-status label per platform/mode (web = mic-first).
function _liveListenLabel() {
  if (!window.WHIS_WEB) return 'Listening, interviewer & you';
  if (IS_MOBILE_WEB) return 'Listening (mic), ask your question';
  return window._whisTabAudio ? 'Listening, interviewer’s tab' : 'Listening (mic), you & interviewer on speaker';
}

function _renderWebWelcome(container) {
  // Honest framing: on a phone, live meeting/interviewer capture isn't possible, // it's practice by voice/text. On desktop web, the mic hears you and your
  // interviewer on speaker; true screenshare-invisible live capture is the desktop app.
  const guidance = IS_MOBILE_WEB
    ? 'or tap the mic to practice out loud. Live interview capture needs the desktop app.'
    : 'or Start a Live Session, share your interview tab once, and Whis hears the '
      + 'interviewer straight from that tab (cleanest capture) and reads the screen. '
      + '<a href="#" id="web-adv-tabaudio" class="web-adv-link">Prefer your mic instead?</a>';

  const chips = _WEB_STARTER_QUESTIONS.map((q, i) => `
    <button class="web-starter-chip" data-starter-idx="${i}" style="--i:${i}">
      <i class="fa-solid ${q.icon} web-starter-icon" aria-hidden="true"></i>
      <span class="web-starter-text">${escapeHTML(q.text)}</span>
      <i class="fa-solid fa-arrow-right web-starter-go" aria-hidden="true"></i>
    </button>`).join('');

  const _sub = IS_MOBILE_WEB
    ? 'Practice interview answers by voice or text, anywhere.'
    : 'Practice and get instant, interview-ready answers.';

  container.innerHTML = `
    <div class="web-welcome">
      <div class="web-welcome-head">
        <div class="web-welcome-eyebrow"><i class="fa-solid fa-wand-magic-sparkles"></i> Whis Elite</div>
        <div class="web-welcome-title">Your interview co-pilot is ready</div>
        <div class="web-welcome-sub">${_sub}</div>
      </div>
      <div class="web-starter-grid">${chips}</div>
      <button type="button" class="web-session-enter web-session-enter-cta" id="web-session-enter-cta">
        <i class="fa-solid fa-tower-broadcast" aria-hidden="true"></i>
        Start Live Session
        <span class="wsec-sub">Share your interview tab · answers left, live tab preview right</span>
      </button>
      <div class="web-welcome-guidance">${guidance}</div>
      ${(typeof WhisLive !== 'undefined' && WhisLive.supported())
        ? `<button type="button" class="web-golive-cta wl-golive-btn" id="web-golive-cta">
             <i class="fa-solid fa-tower-broadcast" aria-hidden="true"></i>
             Go Live, float a co-pilot over your interview
             <i class="fa-solid fa-arrow-right" aria-hidden="true" style="font-size:11px;"></i>
           </button>`
        : ''}
      <a href="https://whis-ai.com/#download" target="_blank" rel="noopener" class="web-desktop-cta" id="web-desktop-cta">
        <i class="fa-solid fa-desktop" aria-hidden="true"></i> Get the desktop app for live interviews
        <i class="fa-solid fa-arrow-right" aria-hidden="true" style="font-size:11px;"></i>
      </a>
    </div>`;

  container.querySelectorAll('.web-starter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-starter-idx'), 10);
      const q = _WEB_STARTER_QUESTIONS[idx];
      if (q) _sendStarterQuestion(q.text);
    });
  });

  // Fallback: use the laptop mic instead of the shared tab audio (headphone users, or
  // no tab audio available). Sets the mic flag, then starts listening on the mic path.
  const adv = container.querySelector('#web-adv-tabaudio');
  if (adv) adv.addEventListener('click', (e) => {
    e.preventDefault();
    window._whisUseMic = true;
    whisToast('Using your microphone. The mic hears you and the interviewer if they’re on speaker, for the cleanest capture, Start a Live Session and share the tab instead.', 'info', 7000);
    try { startListening(); } catch (_) {}
  });

  // Welcome-screen "Go Live" entry (desktop web + Document PiP only).
  const golive = container.querySelector('#web-golive-cta');
  if (golive) golive.addEventListener('click', (e) => {
    e.preventDefault();
    try { WhisLive.goLive(golive); } catch (_) {}
  });
}

// Send a starter question via the real send path. If the user isn't yet on a
// trial/plan, start the free trial first (zero-friction aha), then send. If the
// trial can't start, fall back to the existing plans/upgrade path.
async function _sendStarterQuestion(text) {
  if (!inputEl) return;

  const fire = () => {
    inputEl.value = text;
    inputEl.dispatchEvent(new Event('input'));
    try { inputEl.focus(); } catch (_) {}
    finalizeAndSend();
  };

  // Already entitled → send immediately.
  if (typeof _isEntitledToUse === 'function' ? _isEntitledToUse() : true) {
    fire();
    return;
  }

  // Not entitled: try to start the free trial in one tap, then send the answer.
  try { _trackFunnel && _trackFunnel('web_starter_trial_attempt'); } catch (_) {}
  try {
    await activateTrial();
  } catch (_) { /* fall through to entitlement re-check below */ }

  if (typeof _isEntitledToUse === 'function' ? _isEntitledToUse() : false) {
    fire();
    return;
  }

  // Trial start failed / exhausted → graceful fallback to the existing paths.
  if (typeof openTrialModal === 'function' &&
      typeof currentTrialUsage !== 'undefined' &&
      typeof maxTrialSessions !== 'undefined' &&
      currentTrialUsage < maxTrialSessions) {
    try { openTrialModal(); return; } catch (_) {}
  }
  try {
    whisToast('Start Elite to ask this, one tap.', 'info', 5000,
      { action: { label: 'See Plans', fn: () => { try { window.electronAPI.openSubscriptionPage(); } catch (_) {} } } });
  } catch (_) {}
}

function renderMessages(activeMessageId = null, isFirstChunk = false) {
  // Hot-path: streaming update, only patch the active bubble, never rebuild
  if (activeMessageId && !isFirstChunk) {
    const activeEl = document.getElementById(`msg-${activeMessageId}`);
    if (activeEl) {
      const bubble = activeEl.querySelector('.whis-message-bubble');
      if (bubble) {
        const msg = state.messages.find(m => m.id === activeMessageId);
        if (msg) bubble.innerHTML = formatMessageContent(msg.content) + '<span class="stream-cursor"></span>';
      }
      return;
    }
  }

  // Full rebuild: initial load or first chunk of a new message

  // Prune display memory: cap at 60 messages to prevent DOM bloat in long sessions
  // (conversation history is server-managed via conversationId; this is display-only)
  const MAX_DISPLAY_MESSAGES = 60;
  if (state.messages.length > MAX_DISPLAY_MESSAGES) {
      state.messages.splice(0, state.messages.length - MAX_DISPLAY_MESSAGES);
  }

  messagesContainer.innerHTML = "";

  // Empty state, show when there are no real messages
  const realMessages = state.messages.filter(m => m.id !== 'welcome' && m.content !== 'Ready.');
  if (realMessages.length === 0) {
    // WEB: replace the desktop ⌘L/⌘J "void" with a confident, conversion-focused
    // welcome, one-tap starter questions that send immediately for the fastest
    // possible time-to-value (the "aha"). Guarded so desktop Electron is untouched.
    if (window.WHIS_WEB) {
      _renderWebWelcome(messagesContainer);
      return;
    }
    messagesContainer.innerHTML = `
      <div class="whis-empty-state">
        <div class="whis-empty-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
        <div class="whis-empty-title">Ready for your interview</div>
        <div class="whis-empty-hint">
          <kbd class="whis-empty-kbd">⌘L</kbd> listen to the interviewer &nbsp;·&nbsp; <kbd class="whis-empty-kbd">⌘J</kbd> screenshot a question<br>
          or type below
        </div>
        ${(() => {
          // WEB ADAPTATION: screen-share invisibility is a desktop-only OS capability and is
          // FALSE in a browser tab. Never render a stealth claim (active or risk) on web.
          if (window.WHIS_WEB) return '';
          if (!_isStealthActive()) {
            return `<div class="stealth-confirm-block stealth-confirm-risk" id="empty-stealth-verify" title="Click to upgrade to Elite for full stealth">
               <i class="fa-solid fa-triangle-exclamation stealth-confirm-icon"></i>
               <div class="stealth-confirm-text">
                 <span class="stealth-confirm-label">Screenshare Risk, Pro Plan</span>
                 <span class="stealth-confirm-sub">You may be visible to interviewers · Upgrade to Elite for full stealth</span>
               </div>
             </div>`;
          }
          // Trial-only model: no free responses, so no free-answer counter here.
          const freeHtml = '';
          return `<div class="stealth-confirm-block" id="empty-stealth-verify" title="Click to take a screenshot proof">
               <i class="fa-solid fa-shield-halved stealth-confirm-icon"></i>
               <div class="stealth-confirm-text">
                 <span class="stealth-confirm-label">Stealth Active</span>
                 <span class="stealth-confirm-sub">Invisible in screenshare &amp; recordings · Click to verify</span>
                 ${freeHtml}
               </div>
             </div>`;
        })()}
      </div>`;

    const stealthEl = document.getElementById('empty-stealth-verify');
    if (stealthEl) {
        stealthEl.addEventListener('click', _isStealthActive()
            ? _runStealthVerify
            : () => window.electronAPI.openSubscriptionPage()
        );
    }
    return;
  }

  [...state.messages].forEach((msg, _idx, _arr) => {
    if (msg.id === 'welcome' && msg.content === 'Ready.') return; // skip placeholder

    const wrapper = document.createElement("div");
    wrapper.id = `msg-${msg.id}`;
    wrapper.className = `whis-message ${msg.role === "assistant" ? "assistant" : "user"}`;

    const bubbleEl = document.createElement("div");
    bubbleEl.className = "whis-message-bubble";
    const isStreaming = activeMessageId && msg.id === activeMessageId;
    if (isStreaming && !msg.content) {
        bubbleEl.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>';
    } else if (msg.role === 'user') {
        // Never show the raw transcribed words, show a refined, concise cue of what was
        // asked (pulled from the answer's ASSIST_CUE line), falling back to "Assist" until
        // it streams in. The real content still goes to the AI; this is just the label.
        const next = _arr[_idx + 1];
        const topic = (next && next.role === 'assistant') ? _extractAssistTopic(next.content) : '';
        const label = topic ? escapeHTML(topic) : 'Assist';
        bubbleEl.innerHTML = `<span class="assist-label"><i class="fa-solid fa-wand-magic-sparkles"></i> ${label}</span>`;
    } else {
        bubbleEl.innerHTML = formatMessageContent(msg.content) + (isStreaming ? '<span class="stream-cursor"></span>' : '');
    }
    wrapper.appendChild(bubbleEl);

    // Action buttons for assistant messages (copy + thumbs)
    if (msg.role === 'assistant' && !isStreaming) {
      const actions = document.createElement('div');
      actions.className = 'msg-actions';
      actions.dataset.msgId = msg.id;
      actions.innerHTML = `
        <button class="msg-action-btn" data-action="copy"      title="Copy answer"><i class="fa-regular fa-copy"></i></button>
        <button class="msg-action-btn" data-action="thumbup"   title="Good answer"><i class="fa-regular fa-thumbs-up"></i></button>
        <button class="msg-action-btn" data-action="thumbdown" title="Needs improvement"><i class="fa-regular fa-thumbs-down"></i></button>`;
      wrapper.appendChild(actions);
    }

    messagesContainer.appendChild(wrapper);
  });

  if (activeMessageId && isFirstChunk) {
    const activeEl = document.getElementById(`msg-${activeMessageId}`);
    if (activeEl) activeEl.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (!activeMessageId) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  _updateChipsVisibility();
}

// ========================================================
// --- 3. UNIFIED SEND LOGIC (Button & Enter Key) ---
// ========================================================

// ── 30-MINUTE SESSION (paid users, frontend-only) ────────────────────────────
// Soft usage guard: after 30 min we ask "keep going?" 60s before the mark, so the
// user can stop and SAVE their minutes. No response → keeps going seamlessly.
const SESSION_LEN_SEC  = 30 * 60;
const SESSION_WARN_SEC = 60;
let _sessionSecLeft = 0, _sessionInterval = null, _sessionWarned = false;
function _isPaidActiveSession() {
    return subscriptionIsActive && (subscriptionTier === 'pro' || subscriptionTier === 'pro_plus') && !subscriptionIsTrial;
}
function startSessionTimer() {
    if (!_isPaidActiveSession() || _sessionInterval) return;
    _sessionSecLeft = SESSION_LEN_SEC; _sessionWarned = false;
    _sessionInterval = setInterval(_sessionTick, 1000);
}
function _resetSessionTimer() { _sessionSecLeft = SESSION_LEN_SEC; _sessionWarned = false; }
function stopSessionTimer() {
    if (_sessionInterval) { clearInterval(_sessionInterval); _sessionInterval = null; }
    _sessionSecLeft = 0; _sessionWarned = false; _hideSessionPrompt();
}
function _sessionTick() {
    if (!_isPaidActiveSession()) { stopSessionTimer(); return; }
    _sessionSecLeft--;
    if (_sessionSecLeft <= SESSION_WARN_SEC && !_sessionWarned) { _sessionWarned = true; _showSessionPrompt(); }
    if (_sessionSecLeft <= 0) { _hideSessionPrompt(); _resetSessionTimer(); } // no response → keep going
}
function _showSessionPrompt() {
    if (document.getElementById('session-extend-prompt')) return;
    const el = document.createElement('div');
    el.id = 'session-extend-prompt'; el.className = 'session-extend-prompt no-drag';
    el.innerHTML = `<div class="sxp-card">
        <div class="sxp-title">Your 30-minute session is ending</div>
        <div class="sxp-sub">Keep going, or end now to save your minutes.</div>
        <div class="sxp-actions">
          <button id="sxp-end"  class="sxp-btn sxp-end">End &amp; save minutes</button>
          <button id="sxp-keep" class="sxp-btn sxp-keep">Keep going</button>
        </div></div>`;
    document.body.appendChild(el);
    document.getElementById('sxp-keep').addEventListener('click', () => { _resetSessionTimer(); _hideSessionPrompt(); });
    document.getElementById('sxp-end').addEventListener('click', () => _endSession());
}
function _hideSessionPrompt() { const el = document.getElementById('session-extend-prompt'); if (el) el.remove(); }
function _endSession() {
    _hideSessionPrompt(); stopSessionTimer();
    try { if (typeof isListening !== 'undefined' && isListening) stopAndCommitAudio(true); } catch(_) {}
    try { whisToast('Session ended, your minutes are saved. Press Listen to start again.', 'info', 5000); } catch(_) {}
}

async function finalizeAndSend() {
  if (state.isSending) {
      stopStream();
      await new Promise(r => setTimeout(r, 100));
  }

  if (isProcessingSend) return;
  isProcessingSend = true;

  startInterviewTimer();
  try { startSessionTimer(); } catch (_) {} // 30-min session guard (paid users), never wedge a send
  updateContextHint(); // show "streaming" hint immediately

  const wasListeningBeforeSend = isListening;

  sendBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
  sendBtn.disabled = true;

  try {
      const tasks = [];
      if (isAutoMode) {
          tasks.push(silentScreenshotCapture());
      }
      if (wasListeningBeforeSend) {
          tasks.push(stopAndCommitAudio(true)); 
      }
      
      await Promise.all(tasks);

      if (wasListeningBeforeSend && !isListening) {
          startListening();
      }

      // Drain any in-flight rolling transcription commit so its text lands in the
      // input BEFORE we read it. Without this wait, a _doCommit() that started just
      // before Send would complete after inputEl.value = "" and the transcribed words
      // would be silently discarded.
      if (isBackgroundCommitting) {
          await new Promise(resolve => {
              const t0 = Date.now();
              const poll = setInterval(() => {
                  if (!isBackgroundCommitting || Date.now() - t0 > 2500) {
                      clearInterval(poll);
                      resolve();
                  }
              }, 40);
          });
      }

      const imageToSend = stagedScreenshotData;
      const finalInput = inputEl.value.replace(/\.+$/, '').trim();
      let currentHiddenText = "";
      
      if (isAutoMode) {
          currentHiddenText = hiddenTranscription.trim();
      }

      let combinedContent = "";
      if (currentHiddenText) combinedContent += `${currentHiddenText}\n\n`;
      if (finalInput) {
          combinedContent += (isAutoMode && currentHiddenText) ? `[User Note]:\n${finalInput}` : finalInput;
      }
      
      const finalContent = combinedContent.trim();

      // Nothing to send only if there's no typed text, no image, AND no captured
      // conversation. A spoken-only turn (empty box + live transcript) still sends.
      if (!finalContent && !imageToSend && liveTranscript.length === 0) {
          sendBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i>`;
          sendBtn.disabled = false;
          isProcessingSend = false;
          return;
      }

      hiddenTranscription = "";
      inputEl.value = "";
      localStorage.removeItem('wh_draft');

      await sendMessage({ overrideText: finalContent, screenshotDataURL: imageToSend });
      clearStagedScreenshot(); 

  } catch (e) {
      console.error("Finalize error", e);
      sendBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i>`;
      sendBtn.disabled = false;
      if (wasListeningBeforeSend && !isListening) startListening();
  } finally {
      isProcessingSend = false;
  }
}

async function sendMessage({ screenshotDataURL, overrideText } = {}) {
  // Trial-only model: a free user (no active trial / paid plan) cannot send.
  // Instead of letting them type into a void and get no answer, route them
  // straight to the trial. This is the cleanest "start your trial" path.
  if (isFreeTier && !subscriptionIsActive && !subscriptionIsTrial) {
      if (currentTrialUsage < maxTrialSessions) {
          openTrialModal();
      } else {
          whisToast('Your free trials for today are used up, upgrade to keep going.', 'warning', 5000,
              { action: { label: 'See Plans', fn: () => window.electronAPI.openSubscriptionPage() } });
      }
      return;
  }

  const googleId = currentUser ? (currentUser.googleId || currentUser.id) : null;

  let textToSend = overrideText !== undefined ? overrideText : "";
  
  // Empty box + a live conversation = a spoken-only turn: keep userContent empty (the
  // transcript below carries the question). Only fall back to the screen placeholder
  // when there's genuinely no typed text and no captured conversation.
  const userContent = textToSend
      || (screenshotDataURL ? "[Screenshot captured and analyzed]"
          : (liveTranscript.length ? "" : "(Screen context analyzed)"));

  state.messages.push({ id: `user-${Date.now()}`, role: "user", content: userContent });

  const assistantId = `assistant-${Date.now()}`;
  state.messages.push({ id: assistantId, role: "assistant", content: "" });
  state.pendingStream = { id: assistantId, content: "" };

  streamBuffer = "";
  _partialAnswerBuffer = '';
  renderMessages();

  state.isSending = true;
  _streamLastTokenAt = Date.now();
  _streamStartAt = Date.now();
  const _latEl = document.getElementById('stream-latency');
  if (_latEl) { _latEl.style.display = 'inline'; _latEl.textContent = '0.0s'; }
  _latencyTimer = setInterval(() => {
      if (_latEl) _latEl.textContent = ((Date.now() - _streamStartAt) / 1000).toFixed(1) + 's';
  }, 100);
  _streamStuckTimer = setInterval(() => {
      if (!state.isSending) { clearInterval(_streamStuckTimer); _streamStuckTimer = null; return; }
      if (Date.now() - _streamLastTokenAt > 10000) {
          clearInterval(_streamStuckTimer); _streamStuckTimer = null;
          whisToast('Response is taking longer than usual, tap <strong>■ Stop</strong> then retry if needed', 'warning', 8000);
      }
  }, 2000);
  _logHealth('send_start');

  sendBtn.innerHTML = `<i class="fa-solid fa-square"></i>`;
  sendBtn.disabled = false;

  try {
    let payloadContent = userContent;

    // Attach live conversation transcript if we have one, gives the AI full context
    // of what the interviewer said AND what the user said before pressing Send
    if (liveTranscript.length > 0) {
        const log = liveTranscript.map(s =>
            `${s.role === 'interviewer' ? 'INTERVIEWER' : 'CANDIDATE'}: ${s.text}`
        ).join('\n');
        payloadContent = userContent.trim()
            ? `[Live conversation transcript]\n${log}\n\n[Additional context / question]\n${userContent}`
            : `[Live conversation transcript]\n${log}`;
        liveTranscript = []; // clear after attaching
        _renderLiveTranscript();
    }

    if (isCrisp) {
        payloadContent += "\n\n(Constraint: Keep response under 300 characters.)";
    }

    if (screenshotDataURL) {
        _trackFunnel('screenshot_captured');
        const ocrSnippet = stagedScreenshotOcrText ? stagedScreenshotOcrText.trim() : "";
        const confStr = (typeof stagedScreenshotOcrConfidence === "number") ? `${Math.round(stagedScreenshotOcrConfidence)}%` : "unknown";

        if (ocrSnippet) {
            payloadContent += `\n\n[OCR attempt (may be incomplete, confidence: ${confStr})]:\n${ocrSnippet}`;
        }

        payloadContent += `\n\n[Instruction]\nYou are assisting during a live technical interview. The user just captured a screenshot of the prompt.\n- Do NOT say you can't analyze the image. If details are unclear, state assumptions and still proceed.\n- First, infer what the screenshot most likely contains (coding / config / error / system design) and summarize the prompt in 1-3 lines.\n- Then give the answer/solution (include code if it's a coding problem).\n- Then explain how it works in an interviewer-friendly way (approach, key steps, complexity, edge cases).\n- If the prompt is ambiguous, propose 2-3 plausible interpretations and provide the best answer for each.\n`;
    }

    const payload = { 
        role: "user", 
        content: payloadContent, 
        isCrisp: isCrisp
    };
    if (screenshotDataURL) payload.screenshot = screenshotDataURL;

    const result = await window.electronAPI.sendChatStream(payload, googleId, CURRENT_STREAM_CONTROLLER_ID);
    
    if (result && result.error && !result.aborted) {
      const msg = state.messages.find((m) => m.id === assistantId);
      if (msg) msg.content = "Error: " + result.error;

      const errString = String(result.error).toLowerCase();

      if (errString.includes("trial_required") || errString.includes("trial required") || errString.includes("free trial")) {
           if (msg) msg.content = "";
           renderMessages();
           openTrialModal();
      } else if (errString.includes("limit") || errString.includes("minutes")) {
           showSubscriptionLock(currentUser, "Usage limit reached. Please check your minutes/subscription.");
      } else {
           if (msg) msg.content = "Error: " + result.error;
      }

      if (_partialAnswerBuffer && _partialAnswerBuffer.length > 40) {
          const partialMsg = state.messages.find((m) => m.id === assistantId);
          if (partialMsg) { partialMsg.content = _partialAnswerBuffer + '\n\n*, Connection dropped, partial answer, *'; }
      }

      cleanupStreamState();
      resetStreamControllerId();
    }
  } catch (err) {
    if (_partialAnswerBuffer && _partialAnswerBuffer.length > 40) {
        const partialMsg = state.messages.find((m) => m.id === assistantId);
        if (partialMsg) { partialMsg.content = _partialAnswerBuffer + '\n\n*, Connection dropped, partial answer, *'; }
    }
    const isNetworkErr = err instanceof TypeError || (err.message && (err.message.toLowerCase().includes('fetch') || err.message.toLowerCase().includes('network')));
    if (isNetworkErr) {
        const retryPayload = { content: overrideText || '', screenshot: screenshotDataURL };
        _queueRetry(retryPayload, currentUser ? (currentUser.googleId || currentUser.id) : null);
    }
    cleanupStreamState();
    resetStreamControllerId();
  }
}



// --- 4. AUDIO LOGIC (WITH VAD) ---
// ========================================================

// ── Interviewer audio (system output) ──
let audioCtx = null;
let processor = null;
let inputStream = null;
let isListening = false;
let audioChunks = [];
let currentLength = 0;
const SAMPLE_RATE = 16000;
let activeMediaStream = null;
// WEB: true when startListening() is reading the PERSISTENT shared-screen audio track
// (the interviewer's tab/system audio). In that case stop/teardown must NOT stop the
// track, the shim owns the shared stream's lifecycle (also feeds the preview + Snap).
let _usingSharedLiveAudio = false;

// ── Reliability: stream auto-recovery + stuck-guard ──
let _streamRestartAttempts = 0;
let _bgCommitStartedAt     = 0;  // epoch ms when isBackgroundCommitting was last set

// ── Speech-end detection: VAD-triggered commit ──
// Fire _doCommit after SPEECH_END_MS of silence. 350 ms was too eager, it cut mid-
// sentence on natural thinking pauses ("So… the way I'd do it…"), sending 1-2s scraps
// that transcribe poorly. 750 ms waits for a real end-of-phrase, so each clip is a
// whole thought → far better accuracy (the realtime socket still streams words live).
const SPEECH_END_MS = 750;

// Consecutive transcription failures. Used to re-queue a clip that timed out /
// errored (so a slow response never silently loses an utterance) while capping
// retries so a genuinely bad clip can't become a poison-pill loop.
let _commitFailStreak = 0;
const MAX_COMMIT_RETRIES = 2;
let _speechEndAt          = 0;     // timestamp when silence started
let _speechEndFired       = false; // prevents double-firing per utterance

// ── Real-time streaming transcription (OpenAI Realtime API via server WS proxy) ──
// Primary path: PCM frames stream continuously to /ws/transcribe and text comes
// back word-by-word as the interviewer speaks. The WAV-clip _doCommit path stays
// wired as an automatic fallback and takes over the instant the socket is down.
const RT_TARGET_RATE = 24000; // OpenAI Realtime pcm16 expects 24 kHz mono
let _rtSocket = null;
let _rtReady = false;              // true only between the server "ready" event and socket close
let _rtManualClose = false;       // set when WE close it (stop listening), suppresses reconnect
let _rtReconnectTimer = null;
let _rtReconnectAttempts = 0;
let _rtPartialText = '';           // accumulates delta text for the in-progress segment

function _wsTranscribeURL() {
    const base = BACKEND_URL.replace(/^http/i, 'ws'); // http→ws, https→wss
    const gid = currentUser ? (currentUser.googleId || currentUser.id || '') : '';
    const ctx = liveTranscript.slice(-2).map(s => s.text).join(' ').slice(0, 120);
    const qs = new URLSearchParams({ token: APP_AUTH_TOKEN || '', gid, ctx });
    return `${base}/ws/transcribe?${qs.toString()}`;
}

// Linear resample a 16 kHz frame up to 24 kHz for the Realtime API.
function _resample16to24(input) {
    const ratio = RT_TARGET_RATE / SAMPLE_RATE; // 1.5
    const outLen = Math.round(input.length * ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
        const pos = i / ratio;
        const i0 = Math.floor(pos);
        const i1 = Math.min(i0 + 1, input.length - 1);
        const frac = pos - i0;
        out[i] = input[i0] * (1 - frac) + input[i1] * frac;
    }
    return out;
}

// Resample → PCM16 → send as a binary frame. No-op unless the socket is open.
function _sendPcmFrame(float32) {
    if (!_rtSocket || _rtSocket.readyState !== 1) return;
    const up = _resample16to24(float32);
    const pcm = new Int16Array(up.length);
    for (let i = 0; i < up.length; i++) {
        const s = Math.max(-1, Math.min(1, up[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    try { _rtSocket.send(pcm.buffer); } catch (_) {}
}

// Live caption of the current (not-yet-final) words, the "instant" feel. Manual
// mode only; auto mode keeps its own pill and just consumes finals.
function _renderPartialCaption(text) {
    // The interviewer's live (partial) words now stream straight into the transcript
    // panel, so there's one seamless place to watch the conversation, no separate caption.
    const stray = document.getElementById('rt-cap');
    if (stray) stray.remove();
    _renderLiveTranscript();
}

// Shared: apply a finalized interviewer transcript to the transcript log + composer.
// Used by both the streaming "final" event and the WAV-clip fallback.
// Whisper / gpt-4o-transcribe famously HALLUCINATE fixed phrases on near-silent or
// noisy clips ("Thank you", "you", "Thanks for watching", music/applause tags, etc.).
// Drop these so the transcript never fills with "random words from the air".
const _HALLUCINATION_PHRASES = new Set([
    'thank you','thanks','thanks for watching','thank you for watching','thank you very much',
    'thanks for listening','thank you so much','you','bye','bye bye','goodbye','see you',
    'see you next time','see you later','please subscribe','subscribe','like and subscribe',
    'so','ok','okay','yeah','yep','yup','mm','mmm','hmm','uh','um','ah','oh','the','i','a','and',
    'no','yes','right','you know','youre welcome','you re welcome','music','applause','silence',
    'have a good day','thanks a lot','okay thank you','bye for now'
]);
function _isLikelyHallucination(text) {
    const raw = (text || '').trim();
    if (!raw) return true;
    // pure sound tag like "[music]" / "(applause)"
    if (/^[\[\(][^\]\)]*[\]\)]$/.test(raw)) return true;
    const t = raw.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    if (!t || t.length <= 2) return true;
    if (_HALLUCINATION_PHRASES.has(t)) return true;
    // same word repeated (e.g. "you you you", "thank you thank you")
    const w = t.split(' ');
    if (w.length >= 2 && new Set(w).size === 1) return true;
    return false;
}

function _applyTranscribedText(text) {
    if (!text) return;
    if (_isLikelyHallucination(text)) { try { console.debug('[whis] dropped hallucination:', text); } catch (_) {} return; }
    _appendTranscript('interviewer', text);
    if (isAutoMode) {
        hiddenTranscription += (hiddenTranscription ? " " : "") + text;
    }
    // Manual mode: the interviewer's words are captured for the AI (liveTranscript) but
    // deliberately NOT written into the composer, the box stays clean for the user's
    // own typed follow-ups. No more mixing two voices into one box.
}

// Same as above but for the USER's own voice. Tags the transcript as the candidate
// (so the AI knows YOU said it, not the interviewer) while still showing it in the box
// so you can see your words landed. The diarised label is what gives the AI the
// "who's speaking" intelligence when the conversation is sent on Send.
function _applyUserVoiceText(text) {
    if (!text) return;
    _appendTranscript('user', text); // ← labelled CANDIDATE in the transcript sent to the AI
    if (isAutoMode) {
        hiddenTranscription += (hiddenTranscription ? " " : "") + text;
    }
    // Manual mode: your spoken words are captured for the AI but NOT dumped into the
    // composer, the box is yours alone, for typed follow-ups.
}

function openRealtimeTranscription() {
    if (!APP_AUTH_TOKEN) return; // no token → stay on HTTP fallback
    // Same entitlement gate as _doCommit, don't open a paid stream for free users
    // outside an active trial (the server would reject it anyway).
    if (isFreeTier && !subscriptionIsActive && !subscriptionIsTrial) return;
    _rtManualClose = false;
    try {
        const sock = new WebSocket(_wsTranscribeURL());
        sock.binaryType = 'arraybuffer';
        _rtSocket = sock;

        sock.onmessage = (ev) => {
            let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
            if (m.type === 'ready') {
                _rtReady = true;
                _rtReconnectAttempts = 0;
            } else if (m.type === 'partial') {
                _rtPartialText += m.text;
                _renderPartialCaption(_rtPartialText);
            } else if (m.type === 'final') {
                _rtPartialText = '';
                _renderPartialCaption('');
                _applyTranscribedText((m.text || '').trim());
            }
        };
        sock.onclose = () => {
            _rtReady = false;
            if (_rtSocket === sock) _rtSocket = null;
            _renderPartialCaption('');
            if (!_rtManualClose && isListening) _scheduleRtReconnect();
        };
        sock.onerror = () => { try { sock.close(); } catch (_) {} };
    } catch (_) {
        _rtReady = false;
        if (!_rtManualClose && isListening) _scheduleRtReconnect();
    }
}

function _scheduleRtReconnect() {
    if (_rtReconnectTimer) return;
    _rtReconnectAttempts++;
    // After 5 failed attempts, stop retrying, the WAV-clip fallback keeps working,
    // so the user still gets transcription, just not word-by-word.
    if (_rtReconnectAttempts > 5) { _rtReconnectAttempts = 0; return; }
    const delay = Math.min(4000, _rtReconnectAttempts * 800);
    _rtReconnectTimer = setTimeout(() => {
        _rtReconnectTimer = null;
        if (isListening && !_rtManualClose) openRealtimeTranscription();
    }, delay);
}

function closeRealtimeTranscription() {
    _rtManualClose = true;
    _rtReady = false;
    _rtPartialText = '';
    _renderPartialCaption('');
    if (_rtReconnectTimer) { clearTimeout(_rtReconnectTimer); _rtReconnectTimer = null; }
    if (_rtSocket) { try { _rtSocket.close(); } catch (_) {} _rtSocket = null; }
}

// ── User's own voice (microphone) ──
let userMicCtx = null;
let userMicProcessor = null;
let userMicStream = null;
let userMicChunks = [];
let userMicLength = 0;
let userMicCommitTimer = null;
let isCapturingUserVoice = false;

// ── Live speaker awareness ──────────────────────────────────────────────────
// Two physical sources = perfect diarization: system audio IS the interviewer,
// the mic IS you. We stamp the last moment each source had real speech energy so
// the UI can show, in real time, WHO is talking, instant proof the app hears both.
let _lastInterviewerAudioAt = 0;
let _lastUserAudioAt        = 0;
let _speakerUiTimer         = null;
// Cross-talk suppression: the interviewer's voice leaks out your speakers into your
// mic. To never mislabel it as YOU, we (1) require your mic to be at real speech level,
// and (2) ignore mic energy while the interviewer is actively speaking (that energy is
// almost always just bleed). These levels are on the raw (auto-gain-off) mic.
let _interviewerLoudAt      = 0;
const INTERVIEWER_SPEECH_LEVEL = 0.03;  // system-audio level that counts as the interviewer actually speaking
const MIC_SPEECH_LEVEL         = 0.02;  // your voice is captured above this
const MIC_CLEARLY_YOU_LEVEL    = 0.05;  // this loud = unmistakably YOU → captured even over the interviewer
// Keep the mic suppressed for 700 ms after the interviewer's audio dips. Their speech has
// short gaps between words; a short guard let bleed of the next word ("if", "then") sneak
// in as YOU. 700 ms bridges those gaps so the mic only opens on a REAL turn-end pause.
const CROSSTALK_GUARD_MS       = 700;
// Mic-silence watchdog: if the mic never delivers any signal while listening, it's a
// dead stream (almost always macOS mic permission), tell the user exactly how to fix it.
let _micEverHadSignal       = false;
let _micWatchdog            = null;
let _micWarnedThisRun       = false;
// Mic mixed straight into the interviewer's audio node, one shared live pipeline.
let _micSourceNode          = null;
let _micGainNode            = null;
let _micAnalyser            = null;
let _micLevelTimer          = null;

// ── Live conversation transcript ──
// Both voices accumulate here while listening; sent as context with the next message
let liveTranscript = []; // [{role:'interviewer'|'user', text:string, ts:number}]

function _appendTranscript(role, text) {
    if (!text.trim()) return;
    // Merge with last segment if same role and recent (within 4 s)
    const last = liveTranscript[liveTranscript.length - 1];
    if (last && last.role === role && Date.now() - last.ts < 4000) {
        last.text += ' ' + text.trim();
        last.ts = Date.now();
    } else {
        liveTranscript.push({ role, text: text.trim(), ts: Date.now() });
    }
    _renderLiveTranscript();
    // WEB: persist this finalized segment to the user's session so the dashboard's
    // "View transcript" is real. No-op on desktop and for signed-out users;
    // fire-and-forget so it never blocks capture.
    try {
        if (window.WHIS_WEB && typeof WhisTranscriptSync !== 'undefined') {
            WhisTranscriptSync.noteSegment(role, text.trim());
        }
    } catch (_) {}
}

function _renderLiveTranscript() {
    const el = document.getElementById('live-transcript');
    if (!el) return;
    // Interviewer's in-progress (not-yet-final) words stream live at the bottom.
    const partial = (typeof _rtPartialText === 'string' && !isAutoMode) ? _rtPartialText.trim() : '';
    if (liveTranscript.length === 0 && !partial) {
        el.style.display = 'none';
        try { if (window.WHIS_WEB && typeof WhisSession !== 'undefined') WhisSession.mirrorTranscript(); } catch (_) {}
        return;
    }
    el.style.display = 'flex';

    let html = liveTranscript.map(seg => {
        const isInt = seg.role === 'interviewer';
        const cls   = isInt ? 'lt-interviewer' : 'lt-user';
        const label = isInt ? 'Interviewer' : 'You';
        return `<div class="lt-seg ${cls}"><span class="lt-dot"></span><span class="lt-label">${label}</span><span class="lt-text">${escapeHTML(seg.text)}</span></div>`;
    }).join('');

    // Live interviewer line, word-by-word with a pulsing cursor for the seamless feel.
    if (partial) {
        html += `<div class="lt-seg lt-interviewer lt-live"><span class="lt-dot"></span><span class="lt-label">Interviewer</span><span class="lt-text">${escapeHTML(partial)}<span class="lt-cursor"></span></span></div>`;
    }

    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;

    // WEB focus session: stream the same transcript through the top ticker in real time.
    try { if (window.WHIS_WEB && typeof WhisSession !== 'undefined') WhisSession.mirrorTranscript(); } catch (_) {}
}

// Silent system audio capture via getDisplayMedia, intercepted by
// setDisplayMediaRequestHandler in main.js, no picker ever shown.
// getUserMedia+chromeMediaSource is broken in Electron 31/Chromium 126:
// it sends an IPC message the browser process rejects (bad_message reason 263),
// killing the renderer. getDisplayMedia uses a separate, validated code path.
async function getSystemAudioStreamViaElectron() {
    // getDisplayMedia requires video:true per the WebRTC spec, but our
    // setDisplayMediaRequestHandler in main.js provides the source
    // programmatically so no native picker appears.
    //
    // WEB ADAPTATION: in a real browser there is no setDisplayMediaRequestHandler, so
    // the browser shows its own tab/window/screen picker (this is expected and required
    // to capture the interviewer's audio from a tab). We request plain video:true there
    // because a 1x1 constraint can be rejected by some browsers; the desktop build keeps
    // the tiny 1x1 video to minimize GPU work. Web is detected by the absence of the
    // desktop-only captureScreen bridge.
    const _isWeb = !!window.WHIS_WEB;
    // MOBILE: phones have no getDisplayMedia at all, calling it throws (or is
    // undefined). Interviewer/system-audio capture is physically impossible on a
    // phone, so bail early and let startListening() fall through to mic-only.
    if (IS_MOBILE_WEB || !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('getDisplayMedia unavailable (mobile / no screen-capture)');
    }
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: _isWeb ? true : { width: 1, height: 1, frameRate: 1 }
    });

    const audioTracks = displayStream.getAudioTracks();

    // Stop video tracks after a brief delay to let the GPU flush its
    // texture pipeline before the IOSurface is released.
    displayStream.getVideoTracks().forEach(t => {
        setTimeout(() => { try { t.stop(); } catch (_) {} }, 2000);
    });

    if (audioTracks.length === 0) {
        throw new Error('getDisplayMedia returned no audio tracks');
    }

    return new MediaStream(audioTracks);
}

async function findLoopbackDeviceId() {
  if (!navigator.mediaDevices?.enumerateDevices) return null;
  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioInputs = devices.filter(d => d.kind === "audioinput");

  const keywords = [
    "stereo mix", "what u hear", "loopback",
    "vb-audio", "vb cable", "cable output", "cable",
    "blackhole", "soundflower", "loopback audio",
    "pulse", "monitor", "alsa"
  ];

  const match = audioInputs.find(d => keywords.some(k => (d.label || "").toLowerCase().includes(k)));
  return match?.deviceId || null;
}

// Pick the user's REAL microphone, never a virtual/loopback device. On machines set
// up for system-audio capture, the OS default input is often BlackHole/Stereo Mix/etc,
// which is silent when the user talks (their voice goes to the physical mic). Grabbing
// the default there = 0% pickup. So we explicitly find a physical input and use it.
async function pickRealMicDeviceId() {
  if (!navigator.mediaDevices?.enumerateDevices) return null;
  // Virtual / loopback devices are silent for the user's own voice, never pick them.
  const virtualKeywords = [
    "stereo mix", "what u hear", "loopback", "vb-audio", "vb cable",
    "cable output", "cable", "blackhole", "soundflower", "loopback audio",
    "pulse", "monitor", "alsa", "aggregate", "multi-output", "whis"
  ];
  // The true built-in mic (Mac + common Windows internal-mic labels).
  const builtInKeywords = [
    "built-in", "builtin", "internal", "macbook", "imac", "mac mini",
    "mac studio", "microphone array", "realtek"
  ];
  // Earphones/headsets: deprioritized. When the interviewer's voice plays into the
  // user's earphones, the built-in mic gives cleaner separation and avoids Bluetooth
  // hands-free (SCO) quality drop. NOTE: this only affects capture of the USER's own
  // voice, the INTERVIEWER is captured via system loopback, independent of the mic.
  const earphoneKeywords = [
    "airpod", "headset", "headphone", "earphone", "earbud", "buds", "beats",
    "bluetooth", "wireless", "hands-free", "handsfree", "bt "
  ];
  const label = d => (d.label || "").toLowerCase();

  const real = (await navigator.mediaDevices.enumerateDevices())
    .filter(d => d.kind === "audioinput")
    .filter(d => label(d) && !virtualKeywords.some(k => label(d).includes(k)));
  if (!real.length) return null;

  const isEar = d => earphoneKeywords.some(k => label(d).includes(k));
  // 1) an explicit built-in mic  →  2) any real mic that isn't an earphone/headset
  // →  3) last resort: any real mic (even earphones) so capture still works.
  const preferred = real.find(d => builtInKeywords.some(k => label(d).includes(k)))
                 || real.find(d => !isEar(d))
                 || real[0];
  return preferred?.deviceId || null;
}
const MAX_SAMPLES = SAMPLE_RATE * AUDIO_MAX_DURATION_SEC; 

let chunkCommitTimer = null; 
let isInternalMicReset = false;

async function getSystemAudioOutputDeviceID() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
     return 'default';
  }
  
  try {
    const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    try {
    } finally {
      permissionStream.getTracks().forEach(t => t.stop());
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputDevices = devices.filter((d) => d.kind === 'audioinput');

    const systemAudioDevice = audioInputDevices.find(d => 
        SYSTEM_AUDIO_KEYWORDS.some(keyword => d.label.toLowerCase().includes(keyword))
    );

    if (systemAudioDevice) {
      return systemAudioDevice.deviceId;
    }
    return 'default'; 
  } catch (err) {
    return 'default';
  }
}

async function startListening() {
  // Hard block: free users outside an active trial cannot capture audio
  if (isFreeTier && !subscriptionIsActive && !subscriptionIsTrial) {
      if (currentTrialUsage < maxTrialSessions) openTrialModal();
      return;
  }

  const hasPermission = await checkAndRequestPermission('mic');
  if (!hasPermission) return;

  if (isListening) return;

  // WEB: a live session has begun → make sure a dashboard session exists (uses the
  // URL's sessionId if the dashboard passed one, else creates one lazily, once).
  // No-op on desktop / signed-out users; never blocks the capture path.
  try {
    if (window.WHIS_WEB && typeof WhisTranscriptSync !== 'undefined') {
      WhisTranscriptSync.ensureSession();
    }
  } catch (_) {}

  try {
    let stream;
    _usingSharedLiveAudio = false; // reset; set true only when reusing the shared live audio track

    // ── MOBILE WEB PATH: mic-only ──
    // Phones cannot capture the interviewer's tab/system audio (no getDisplayMedia).
    // So on mobile the "Listen" button captures the USER's own voice via getUserMedia
    // (which DOES work on mobile) so they can ask questions by voice. We never touch
    // the system-audio cascade below (it would throw and dead-end the UI). A one-time
    // note explains the honest tradeoff. Typed questions remain the primary path.
    // We acquire the stream here, then fall through to the shared audio pipeline.
    if (window.WHIS_WEB && (IS_MOBILE_WEB || window._whisUseMic)) {
        // MIC path, only on mobile (no getDisplayMedia) or when the user explicitly
        // chose "use my mic". The mic hears the interviewer only if the call is on the
        // laptop speaker; it also picks up room noise, so it's the fallback, not default.
        if (IS_MOBILE_WEB) _showMobileCaptureNoteOnce();
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (eMic) {
            console.warn('Web mic capture failed:', eMic);
            updateListeningUI(false);
            whisToast('Whis needs microphone access. Enable the mic for this site (address-bar icon), then click Listen again, or just type your question below.', 'warning', 8000);
            return;
        }
    } else if (window.WHIS_WEB) {
        // DEFAULT on desktop web: capture the INTERVIEWER via the shared tab/window/
        // system audio. This is clean, line-level audio with no room noise, the reason
        // mic-first was mishearing ("random words from the air"). If the user cancels
        // the picker or shares without audio, we fall back to the mic so Listen works.
        //
        // PRIMARY (ParakeetAI-style): if a persistent screen share is already live
        // (started by the 75/25 live view) AND it carries audio, reuse THAT audio track
        // directly, no second picker, one share for the whole session. This is the core
        // "not hearing clearly" fix: the shared tab audio is the interviewer's own feed.
        let usedSharedLiveAudio = false;
        try {
            if (window.electronAPI && window.electronAPI.hasLiveScreen &&
                window.electronAPI.hasLiveScreen() &&
                window.electronAPI.liveHasAudio && window.electronAPI.liveHasAudio() &&
                window.electronAPI.getLiveAudioStream) {
                const shared = window.electronAPI.getLiveAudioStream();
                if (shared && shared.getAudioTracks().length) {
                    stream = shared;
                    usedSharedLiveAudio = true;
                    _usingSharedLiveAudio = true;
                }
            }
        } catch (_) { /* fall through to the getDisplayMedia path */ }

        if (usedSharedLiveAudio) {
            // Skip the picker + hint entirely, we already have the interviewer's audio.
        } else {
        try { _showTabShareHintOnce(); } catch (_) {}
        try {
            stream = await getSystemAudioStreamViaElectron();
        } catch (eTab) {
            console.warn('Tab-audio capture cancelled/failed, falling back to mic:', eTab);
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                whisToast('Using your microphone for now. For the cleanest interviewer capture, click <strong>Listen</strong> again and pick the <strong>meeting tab</strong> with <strong>“Share tab audio”</strong> checked.', 'info', 9000);
            } catch (eMic2) {
                updateListeningUI(false);
                whisToast('Couldn’t capture audio. Click <strong>Listen</strong> and pick the meeting tab (check <strong>“Share tab audio”</strong>), or allow your mic, or just type your question.', 'warning', 9000);
                return;
            }
        }
        } // end getDisplayMedia picker path (skipped when reusing the shared live audio)
    } else {
        audioInputDeviceID = await getSystemAudioOutputDeviceID();

        const constraints = {
          audio: {
            deviceId: audioInputDeviceID,
            sampleRate: SAMPLE_RATE,
            channelCount: 1
          }
        };

        const loopbackId = await findLoopbackDeviceId();

        // ── Attempt 1: Electron chromeMediaSource, silent, no picker, most reliable ──
        try {
            stream = await getSystemAudioStreamViaElectron();
        } catch (e1) {
        console.warn("Electron system audio failed, trying loopback device:", e1);

        // ── Attempt 2: Named loopback device (BlackHole / Stereo Mix / VB-Cable) ──
        if (loopbackId) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        deviceId: { exact: loopbackId },
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    },
                    video: false
                });
            } catch (e2) {
                console.warn("Loopback device failed:", e2);
            }
        }

        // No further fallback, getDisplayMedia is intentionally excluded because it
        // triggers the macOS native screen picker which causes the NSPanel window to hide.
        if (!stream) {
            if (window.WHIS_WEB) {
                // Desktop-web (laptop browser): the browser tab/screen picker was
                // dismissed or shared no audio. Give a browser-appropriate nudge, no
                // OS Settings / restart talk (that's desktop-app-only friction).
                updateListeningUI(false);
                whisToast('To capture the meeting, click <strong>Listen</strong> again and pick the interviewer’s tab or window, and be sure to check <strong>“Share tab audio.”</strong> Or just type your question below.', 'warning', 9000);
                return;
            } else if (isMac) {
                updateListeningUI(false);
                showScreenPermissionRestartDialog();
            } else {
                whisToast('Could not capture system audio. Enable <strong>Stereo Mix</strong> in Sound settings or install a virtual audio cable (VB-Cable), then try again.', 'error', 8000);
                updateListeningUI(false);
            }
            return;
        }
    }
    } // end desktop system-audio branch (mobile skips straight to the shared pipeline)

    activeMediaStream = stream;

    // Detect when the OS silently kills the audio stream (sleep/wake, device change, permission revoke)
    stream.getTracks().forEach(track => {
        track.addEventListener('ended', () => { if (isListening) _handleStreamEnded(); });
    });
    stream.addEventListener('inactive', () => { if (isListening) _handleStreamEnded(); });

    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
    }
    if (audioCtx.state === "suspended") await audioCtx.resume();

    // Auto-resume if the OS suspends the AudioContext (power-save / focus loss)
    audioCtx.addEventListener('statechange', () => {
        if (isListening && audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
    });

    inputStream = audioCtx.createMediaStreamSource(stream);
    processor = audioCtx.createScriptProcessor(4096, 1, 1);

    inputStream.connect(processor);
    processor.connect(audioCtx.destination);

    audioChunks = [];
    currentLength = 0;
    isListening = true;
    _streamRestartAttempts = 0;
    _audioDetectedOnce = false;
    _speechEndAt    = 0;
    _speechEndFired = false;
    _logHealth('listen_start');
    _trackFunnel('mic_listen_start');

    vadLastSpeechTime = Date.now();
    isVadActive = false;

    liveTranscript = [];
    _renderLiveTranscript();

    updateListeningUI(true);
    _showPreflightChecklist();
    startChunkCommitTimer();
    openRealtimeTranscription(); // primary: real-time streaming (WAV commit is fallback)
    // On mobile the PRIMARY stream is already the user's mic, so a second parallel mic
    // capture would double-open the device and transcribe the same voice twice. Desktop
    // still runs it (there the primary stream is the interviewer's system audio).
    if (!window.WHIS_WEB) startUserMicCapture(); // parallel user-voice capture (desktop only; web's primary stream already covers it)

    processor.onaudioprocess = (e) => {
        if (!isListening) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const rms = calculateRMS(inputData);
        const now = Date.now();

        // Speaker awareness: interviewer (system audio) is talking right now.
        if (rms > VAD_RECORD_THRESHOLD) _lastInterviewerAudioAt = now;
        if (rms > INTERVIEWER_SPEECH_LEVEL) _interviewerLoudAt = now; // interviewer is actively speaking now

        // Real-time path: stream every frame to the WS. Server-side VAD segments it.
        if (_rtReady) _sendPcmFrame(inputData);

        // Drive real-time level meter (update CSS var on status element)
        _currentRmsLevel = rms;
        const levelPct = Math.min(100, (rms / 0.08) * 100).toFixed(1) + '%';
        if (listeningStatusEl) listeningStatusEl.style.setProperty('--audio-level', levelPct);

        // Audio ring: drive green glow on the voice button proportional to level
        const ringLevel = Math.min(1, rms / 0.035).toFixed(3);
        if (voiceBtn) voiceBtn.style.setProperty('--aring', ringLevel);

        // First-time audio detected, silently note it (the live dot already shows
        // status; no toast needed).
        if (!_audioDetectedOnce && rms > VAD_RECORD_THRESHOLD) {
            _audioDetectedOnce = true;
        }

        // Visual wave bars: only animate at the higher threshold (speech-like levels)
        if (rms > VAD_VISUAL_THRESHOLD) {
            vadLastSpeechTime = now;
            if (!isVadActive) { isVadActive = true; updateVADVisuals(true); }
        } else {
            if (isVadActive && now - vadLastSpeechTime > VAD_HANGOVER_MS) {
                isVadActive = false;
                updateVADVisuals(false);
            }
        }

        // RECORD at the lower threshold, captures compressed video-call audio
        // that sits below the visual threshold but is real speech
        if (rms > VAD_RECORD_THRESHOLD) {
            vadLastSpeechTime = now; // also extend the recording window
        }

        if (now - vadLastSpeechTime <= VAD_HANGOVER_MS) {
            const clone = new Float32Array(inputData);
            audioChunks.push(clone);
            currentLength += clone.length;

            while (currentLength > MAX_SAMPLES) {
                const removed = audioChunks.shift();
                currentLength -= removed.length;
            }
        }

        // ── VAD-triggered commit: fire as soon as SPEECH_END_MS of silence detected ──
        // Fires the moment the interviewer stops speaking, no timer wait.
        if (rms > VAD_RECORD_THRESHOLD) {
            // Active speech: reset silence tracker, allow next end to trigger again
            _speechEndAt   = 0;
            _speechEndFired = false;
        } else {
            if (_speechEndAt === 0) _speechEndAt = now;
            if (!_speechEndFired && currentLength > 0 && (now - _speechEndAt) >= SPEECH_END_MS) {
                _speechEndFired = true;
                setTimeout(_doCommit, 0);
            }
        }
    };

  } catch (err) {
    console.error("Mic error:", err);
    updateListeningUI(false);
    showToastError("Capture failed");
  }
}

// ── Auto-recovery when the OS drops the audio stream ──
// Triggered by track.onended or stream inactive, backs off and retries up to 3×
async function _handleStreamEnded() {
    if (!isListening) return;

    _logHealth('stream_ended', `attempt ${_streamRestartAttempts}`);

    const MAX_RESTARTS = 3;
    if (_streamRestartAttempts >= MAX_RESTARTS) {
        _streamRestartAttempts = 0;
        await stopAndCommitAudio(true);
        whisToast(
            `Audio stream ended. Press <strong>${CTRL}+L</strong> to start listening again.`,
            'warning', 8000
        );
        return;
    }

    _streamRestartAttempts++;
    const attempt = _streamRestartAttempts;
    const delay   = attempt * 1500; // 1.5s, 3s, 4.5s back-off

    // Tear down current audio graph without resetting the listening UI
    closeRealtimeTranscription();
    stopChunkCommitTimer();
    stopUserMicCapture();
    try { if (processor)         { processor.disconnect(); processor.onaudioprocess = null; } } catch(_) {}
    try { if (inputStream)       { inputStream.disconnect(); }                               } catch(_) {}
    // WEB: don't stop the persistent shared-screen audio track (shim-owned).
    try { if (!_usingSharedLiveAudio) activeMediaStream?.getTracks().forEach(t => t.stop());  } catch(_) {}
    activeMediaStream = null;
    _usingSharedLiveAudio = false;
    processor = null;
    inputStream = null;
    if (audioCtx && audioCtx.state !== 'closed') { audioCtx.close().catch(() => {}); audioCtx = null; }

    isListening = false;

    whisToast(
        `Audio stream dropped, reconnecting (${attempt}/${MAX_RESTARTS})…`,
        'warning', delay + 800
    );

    setTimeout(async () => {
        await startListening();
        if (isListening) {
            _streamRestartAttempts = 0; // reconnected silently, the dot shows we're live
        }
    }, delay);
}

// ── Module-level commit function ──
// Hoisted out of startChunkCommitTimer so onaudioprocess can also call it
// for VAD-triggered (speech-end) commits without waiting for a timer tick.
async function _doCommit() {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
        return;
    }
    // Real-time streaming is live, it's handling transcription. Drain the fallback
    // buffer so it can't grow, and skip the HTTP commit entirely. If the socket
    // drops, _rtReady flips false and this path resumes automatically.
    if (_rtReady) { audioChunks = []; currentLength = 0; return; }
    if (!isListening || currentLength === 0 || isBackgroundCommitting) return;
    // Hard block: free users outside active trial must not burn transcription tokens
    if (isFreeTier && !subscriptionIsActive && !subscriptionIsTrial) {
        audioChunks = []; currentLength = 0; return;
    }

    isBackgroundCommitting = true;
    _bgCommitStartedAt = Date.now();

    const fullBuffer = new Float32Array(currentLength);
    let offset = 0;
    for (const chunk of audioChunks) { fullBuffer.set(chunk, offset); offset += chunk.length; }
    audioChunks = [];
    currentLength = 0;

    // Skip API call if the buffer contains only silence / fan noise.
    // We track BOTH peak (loudest moment) and how many frames actually contain
    // speech. A lone click/blip can clear the peak check while carrying no real
    // words, that wastes a Gemini call and often returns empty. Requiring a
    // minimum amount of speech-energy frames filters those out.
    let peakRms = 0;
    let speechFrames = 0;
    let totalFrames = 0;
    for (let i = 0; i < fullBuffer.length; i += 512) {
        const s = calculateRMS(fullBuffer.subarray(i, i + 512));
        if (s > peakRms) peakRms = s;
        if (s > VAD_RECORD_THRESHOLD) speechFrames++;
        totalFrames++;
    }
    // ~32 frames of 512 samples ≈ 16384 samples ≈ 1024 ms at 16 kHz is one second.
    // MIN_SPEECH_FRAMES = 8 frames ≈ 256 ms of cumulative speech energy.
    // This is below SPEECH_END_MS-triggered utterances (which always carry far
    // more than 256 ms of speech before the 350 ms silence fires), so it never
    // drops or delays a real interviewer utterance, it only kills sub-word blips.
    const MIN_SPEECH_FRAMES = 14;
    if (peakRms < VAD_MIN_SEND_PEAK || speechFrames < MIN_SPEECH_FRAMES) {
        isBackgroundCommitting = false;
        _bgCommitStartedAt = 0;
        return;
    }

    const wavBlob = encodeWAV(fullBuffer, SAMPLE_RATE);
    const controller = new AbortController();
    // 12 s ceiling: the backend races two providers and answers in ~2 s p99, so this
    // is a safety net, not a normal path. On timeout we re-queue below rather than drop.
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
        const formData = new FormData();
        formData.append("file", wavBlob, "recording.wav");
        // Recent words give the transcriber context → far better on names/jargon.
        const _ctx = liveTranscript.slice(-2).map(s => s.text).join(' ').slice(0, 140);
        if (_ctx) formData.append("context", _ctx);

        const txHeaders = { "x-whis-auth": APP_AUTH_TOKEN };
        if (currentUser) txHeaders["x-google-id"] = currentUser.googleId || currentUser.id;

        const res = await fetch(`${BACKEND_URL}/api/transcribe`, {
            method: "POST",
            headers: txHeaders,
            body: formData,
            signal: controller.signal
        });

        if (!res.ok) throw new Error("Commit failed");
        if (!isListening) return;

        const data = await res.json();
        const text = (data.text || "").trim();

        _commitFailStreak = 0; // successful round-trip (empty text still counts as success)

        if (text) _applyTranscribedText(text);
    } catch (_) {
        // Timed-out / failed clip: put it back at the FRONT of the queue so it retries
        // (in order, ahead of newer speech) instead of being silently lost. Capped so a
        // genuinely undecodable clip can't loop forever.
        if (isListening && _commitFailStreak < MAX_COMMIT_RETRIES) {
            _commitFailStreak++;
            audioChunks.unshift(fullBuffer);
            currentLength += fullBuffer.length;
            while (currentLength > MAX_SAMPLES) {
                const removed = audioChunks.pop(); // drop newest to keep the retried clip
                currentLength -= removed.length;
            }
        } else {
            _commitFailStreak = 0;
        }
    } finally {
        clearTimeout(timeoutId);
        isBackgroundCommitting = false;
        _bgCommitStartedAt = 0;
        _speechEndFired = false; // allow the next utterance to trigger an immediate commit
        // Eager retry: if audio accumulated while the API call was in flight, fire immediately
        if (isListening && currentLength > 0) {
            setTimeout(_doCommit, 0);
        }
    }
}

function startChunkCommitTimer() {
    if (chunkCommitTimer) clearInterval(chunkCommitTimer);


    chunkCommitTimer = setInterval(() => {
        // Watchdog: unstick isBackgroundCommitting if stuck >15 s
        if (isBackgroundCommitting && _bgCommitStartedAt > 0 && Date.now() - _bgCommitStartedAt > 15000) {
            isBackgroundCommitting = false;
            _bgCommitStartedAt = 0;
        }
        _doCommit(); // timer is now just a safety net; speech-end detection fires first
    }, 2000);
    // 2000 ms (was 500 ms): the 350 ms SPEECH_END_MS VAD trigger + eager-retry in
    // _doCommit's finally already fire every real utterance instantly, so this
    // interval is a pure watchdog for the rare "speaker never pauses" case.
    // Raising it 500→2000 cuts timer-driven _doCommit calls 75% and eliminates the
    // double-fire where a fresh trailing-noise buffer was committed right after a
    // VAD commit, with zero latency impact on interviewer audio.
}

function stopChunkCommitTimer() {
    if (chunkCommitTimer) {
        clearInterval(chunkCommitTimer);
        chunkCommitTimer = null;
    }
    isBackgroundCommitting = false;
}

// ── User's own voice: capture + rolling transcription ──
async function startUserMicCapture() {
    try {
        // Force the REAL mic (not a loopback), and drop the strict sampleRate constraint
        // that can hand back a dead/silent track on hardware that can't do 16 kHz, the
        // AudioContext below resamples for us, so native capture is both safer and cleaner.
        const realMicId = await pickRealMicDeviceId();
        const micAudio = {
            echoCancellation: true,   // removes most interviewer speaker-bleed
            noiseSuppression: true,
            autoGainControl: true,    // keeps your voice reliably loud enough to capture
            channelCount: 1
        };
        if (realMicId) micAudio.deviceId = { ideal: realMicId };

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: micAudio, video: false });
        } catch (devErr) {
            // Device-specific request failed, fall back to the plainest possible ask.
            console.warn("Mic capture with selected device failed, retrying default:", devErr);
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }

        userMicStream = stream;
        // Give the mic its OWN capture graph (independent of the flaky system-audio
        // loopback), then transcribe it exactly like the interviewer and drop the text
        // straight into the composer via _applyTranscribedText, that's what makes it
        // "show up in the box like it does".
        if (!userMicCtx) userMicCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
        if (userMicCtx.state === 'suspended') { try { await userMicCtx.resume(); } catch (_) {} }

        const src  = userMicCtx.createMediaStreamSource(stream);
        const proc = userMicCtx.createScriptProcessor(4096, 1, 1);
        src.connect(proc);
        proc.connect(userMicCtx.destination);
        userMicProcessor = proc;

        isCapturingUserVoice = true;
        userMicChunks = [];
        userMicLength = 0;
        _micEverHadSignal = false;
        let userSpeechLast = 0; // last ms we saw real speech (0 = not currently in speech)

        proc.onaudioprocess = (e) => {
            if (!isCapturingUserVoice) return;
            const data = e.inputBuffer.getChannelData(0);
            const rms  = calculateRMS(data);
            const now  = Date.now();
            // Count this as YOU only if your mic is at speech level AND the interviewer
            // is NOT speaking right now. While they speak, ANY mic energy is their voice
            // bleeding out your speakers into your mic, never you, so we drop it. You're
            // captured in the gaps (your turn). Headphones remove bleed entirely.
            const interviewerTalking = (now - _interviewerLoudAt) < CROSSTALK_GUARD_MS;
            if (rms > MIC_SPEECH_LEVEL && !interviewerTalking) {
                _lastUserAudioAt = now; _micEverHadSignal = true; userSpeechLast = now;
            }
            // Buffer around your speech (VAD hangover) so whole words are captured, but
            // never while the interviewer is talking, so their bleed can't leak into a
            // mic clip during the hangover tail.
            if (userSpeechLast && now - userSpeechLast <= VAD_HANGOVER_MS && !interviewerTalking) {
                const clone = new Float32Array(data);
                userMicChunks.push(clone);
                userMicLength += clone.length;
                while (userMicLength > MAX_SAMPLES) userMicLength -= userMicChunks.shift().length;
            }
        };

        // Commit every ~1.8 s: encode what we buffered, transcribe it, put it in the box.
        userMicCommitTimer = setInterval(async () => {
            if (!isCapturingUserVoice || userMicLength === 0) return;
            if (isFreeTier && !subscriptionIsActive && !subscriptionIsTrial) { userMicChunks = []; userMicLength = 0; return; }

            const buf = new Float32Array(userMicLength);
            let off = 0;
            for (const c of userMicChunks) { buf.set(c, off); off += c.length; }
            userMicChunks = [];
            userMicLength = 0;

            // Require a real speech burst (peak + a handful of speech frames) so room
            // tone / keyboard clicks don't get transcribed into the box.
            let peak = 0, speechFrames = 0;
            for (let i = 0; i < buf.length; i += 512) {
                const s = calculateRMS(buf.subarray(i, i + 512));
                if (s > peak) peak = s;
                if (s > MIC_SPEECH_LEVEL) speechFrames++;   // real close-mic speech, not bleed/noise
            }
            // Require a clear, sustained speech burst at YOUR mic level before sending, // 9 frames (~290 ms) drops single stray short words ("if", "then") that bleed
            // through a micro-gap, while your real answers easily clear it.
            if (peak < MIC_SPEECH_LEVEL || speechFrames < 9) return;

            try {
                const wav = encodeWAV(buf, SAMPLE_RATE);
                const fd  = new FormData();
                fd.append('file', wav, 'user.wav');
                const _mctx = liveTranscript.slice(-2).map(s => s.text).join(' ').slice(0, 140);
                if (_mctx) fd.append('context', _mctx);
                const headers = { 'x-whis-auth': APP_AUTH_TOKEN };
                if (currentUser) headers['x-google-id'] = currentUser.googleId || currentUser.id;
                const res = await fetch(`${BACKEND_URL}/api/transcribe`, {
                    method: 'POST', headers, body: fd, signal: AbortSignal.timeout(8000)
                });
                if (!res.ok) return;
                const { text } = await res.json();
                if (text && text.trim()) _applyUserVoiceText(text.trim()); // ← into the box, tagged CANDIDATE
            } catch (_) {}
        }, 1800);

    } catch (err) {
        console.warn("User mic capture failed:", err);
        // Tell the user instead of failing silently, a dead mic is exactly the
        // "it's not picking my voice" complaint, and it's almost always a permission issue.
        const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
        try {
            whisToast(
                denied
                    ? (window.WHIS_WEB
                        ? 'Microphone access is blocked. Click the mic icon in your browser\'s address bar to allow the microphone, then press Listen again.'
                        : 'Microphone access is blocked. Enable it in System Settings → Privacy → Microphone, then press Listen again.')
                    : 'Could not start your microphone. Check that no other app is using it, then press Listen again.',
                'error', 7000
            );
        } catch (_) {}
        // Interviewer (system) audio capture still works regardless.
    }
}

function stopUserMicCapture() {
    isCapturingUserVoice = false;
    if (_micWatchdog)       { clearTimeout(_micWatchdog);       _micWatchdog = null; }
    if (userMicCommitTimer) { clearInterval(userMicCommitTimer); userMicCommitTimer = null; }
    if (userMicProcessor)   { try { userMicProcessor.disconnect(); userMicProcessor.onaudioprocess = null; } catch (_) {} userMicProcessor = null; }
    if (userMicStream)      { try { userMicStream.getTracks().forEach(t => t.stop()); } catch (_) {} userMicStream = null; }
    // Release the OS mic device handle so the next session starts clean.
    if (userMicCtx && userMicCtx.state !== 'closed') { userMicCtx.close().catch(() => {}); userMicCtx = null; }
    userMicChunks = [];
    userMicLength = 0;
}

async function stopAndCommitAudio(silentStop = false) {
    if (!isListening) return;

    isListening = false;
    _logHealth('listen_stop');
    _trackFunnel('mic_listen_stop');
    closeRealtimeTranscription();
    stopChunkCommitTimer();
    stopUserMicCapture();
    updateListeningUI(false);
    if (voiceBtn) voiceBtn.style.setProperty('--aring', '0');

    if (processor) {
        processor.disconnect();
        processor.onaudioprocess = null;
    }
    if (inputStream) inputStream.disconnect();

    try {
        // WEB: never stop the PERSISTENT shared-screen audio track, the shim owns it
        // (it also drives the live preview + Snap). Just drop our reference; the audio
        // graph was already disconnected above.
        if (activeMediaStream && !_usingSharedLiveAudio) {
            activeMediaStream.getTracks().forEach(t => { try { t.stop(); } catch (_) {} });
        }
    } catch (_) {}
    activeMediaStream = null;
    _usingSharedLiveAudio = false;

    try {
        if (audioCtx && audioCtx.state !== 'closed') {
            await audioCtx.close();
        }
    } catch (_) {}
    audioCtx = null;
    processor = null;
    inputStream = null;

    if (audioChunks.length === 0) {
        return;
    }

    const fullBuffer = new Float32Array(currentLength);
    let offset = 0;
    for (const chunk of audioChunks) {
        fullBuffer.set(chunk, offset);
        offset += chunk.length;
    }

    const wavBlob = encodeWAV(fullBuffer, SAMPLE_RATE);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
        
    try {
        const formData = new FormData();
        formData.append("file", wavBlob, "recording.wav");
        const _fctx = liveTranscript.slice(-2).map(s => s.text).join(' ').slice(0, 140);
        if (_fctx) formData.append("context", _fctx);

        const res = await fetch(`${BACKEND_URL}/api/transcribe`, {
            method: "POST",
            headers: { "x-whis-auth": APP_AUTH_TOKEN },
            body: formData,
            signal: controller.signal
        });
        
        if (!res.ok) throw new Error("Transcription failed");
        const data = await res.json();
        const text = (data.text || "").trim();
        
        if (text) {
             // Final interviewer words → captured for the AI (liveTranscript / hidden
             // transcription), never written into the composer box.
             _applyTranscribedText(text);
        }
    } catch (err) {
        console.error(err);
    } finally {
        clearTimeout(timeoutId);
        audioChunks = [];
        currentLength = 0;
        inputEl.focus(); 
    }
}

function encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); 
    view.setUint16(20, 1, true); 
    view.setUint16(22, 1, true); 
    view.setUint32(24, sampleRate, true);       // sample rate
    view.setUint32(28, sampleRate * 2, true);   // byte rate = sampleRate * blockAlign (mono 16-bit ⇒ ×2)
    view.setUint16(32, 2, true);                 // block align = channels(1) * bytesPerSample(2)
    view.setUint16(34, 16, true);                // bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);
    floatTo16BitPCM(view, 44, samples);
    return new Blob([view], { type: 'audio/wav' });
}

function floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// Live "who's talking" readout. Runs only while manually listening. Reads the two
// source timestamps and re-colours the dot + label every ~180 ms: green when it hears
// YOU, blue when the interviewer speaks, calm grey when the line is quiet. This is the
// instant, undeniable proof that the app is listening to the person testing it.
function _startSpeakerIndicator() {
    if (_speakerUiTimer || isAutoMode) return;
    _speakerUiTimer = setInterval(() => {
        const dot = document.getElementById('ls-dot');
        const txt = document.getElementById('ls-text');
        if (!dot || !txt) return;
        const now = Date.now();
        const youRecent = now - _lastUserAudioAt < 750;
        const intRecent = now - _lastInterviewerAudioAt < 750;
        // MOBILE: the only source is the user's own mic (no interviewer capture), so the
        // primary processor's activity IS "you". Never show "Interviewer speaking…" here.
        if (IS_MOBILE_WEB) {
            const active = youRecent || intRecent;
            if (active) {
                dot.style.background = '#4df4b1'; dot.style.boxShadow = '0 0 9px rgba(77,244,177,0.9)';
                txt.textContent = 'Hearing you…'; txt.style.color = '#4df4b1';
            } else {
                dot.style.background = '#8b93a8'; dot.style.boxShadow = '0 0 6px rgba(139,147,168,0.5)';
                txt.textContent = 'Listening to you'; txt.style.color = '#aab2c5';
            }
            return;
        }
        // Two separate sources = clean diarization: the mic sets _lastUserAudioAt (you),
        // the system-audio processor sets _lastInterviewerAudioAt (interviewer).
        if (youRecent) {
            dot.style.background = '#4df4b1'; dot.style.boxShadow = '0 0 9px rgba(77,244,177,0.9)';
            txt.textContent = 'Hearing you…'; txt.style.color = '#4df4b1';
        } else if (intRecent) {
            dot.style.background = '#d9c7f7'; dot.style.boxShadow = '0 0 9px rgba(217,199,247,0.9)';
            txt.textContent = 'Interviewer speaking…'; txt.style.color = '#d9c7f7';
        } else {
            dot.style.background = '#8b93a8'; dot.style.boxShadow = '0 0 6px rgba(139,147,168,0.5)';
            txt.textContent = _liveListenLabel(); txt.style.color = '#aab2c5';
        }
    }, 180);
}
function _stopSpeakerIndicator() {
    if (_speakerUiTimer) { clearInterval(_speakerUiTimer); _speakerUiTimer = null; }
}

function updateListeningUI(active) {
  if (isAutoMode) {
      if (micUsagePill) {
          if (active) {
              micUsagePill.style.display = "flex";
              micUsagePill.innerHTML = `
                  <i class="fa-solid fa-circle fa-fade" style="color:#ff6b6b; font-size:8px; margin-right:6px;"></i> 
                  <span style="font-size:11px; color:#e9ecf5; font-weight:500;">Observing Screen & Audio</span>
              `;
              micUsagePill.style.alignItems = "center";
              micUsagePill.style.background = "rgba(0,0,0,0.5)";
              micUsagePill.style.padding = "5px 12px";
              micUsagePill.style.borderRadius = "12px";
              micUsagePill.style.border = "1px solid rgba(255,255,255,0.1)";
          } else {
              micUsagePill.style.display = "none";
          }
      }
  } else {
      if (active) {
        // Stable layout: the live speaker indicator (below) just swaps #ls-dot colour
        // and #ls-text so the user sees, instantly, that BOTH the interviewer and they
        // are being heard. No more misleading "not listening to you".
        let content = `<div class="wave-and-text" style="display: flex; align-items: center; gap: 8px;">`;
        content += `<div class="wave-container" style="margin: 0;"><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div></div>`;
        content += `<span id="ls-dot" style="width:7px;height:7px;border-radius:50%;background:#8b93a8;box-shadow:0 0 6px rgba(139,147,168,0.55);flex:0 0 auto;transition:background .12s,box-shadow .12s;"></span>`;
        content += `<span id="ls-text" class="status-text listening-indicator" style="font-size:10px; margin:0; line-height:1; text-transform:none; letter-spacing:0.2px; color:#aab2c5;">${window.WHIS_WEB ? _liveListenLabel() : 'Listening, interviewer &amp; you'}</span>`;
        content += `</div>`;
        listeningStatusEl.innerHTML = content;

        listeningStatusEl.style.display = "flex";
        listeningStatusEl.classList.add("active");
        listeningStatusEl.style.padding = "4px 10px";
        listeningStatusEl.style.margin = "2px 0 6px 0";

        voiceBtn.classList.add("active");
        _startSpeakerIndicator();
        // The box is for extra input now, guide the user without cluttering it with the
        // live transcript. (Don't override the locked/free-trial placeholder.)
        if (inputEl && !inputEl.readOnly) inputEl.placeholder = 'Press Send for an answer, or type a follow-up…';
      } else {
        _stopSpeakerIndicator();
        listeningStatusEl.classList.remove("active");
        listeningStatusEl.innerHTML = "";
        listeningStatusEl.style.display = "none";
        listeningStatusEl.style.padding = "0";
        listeningStatusEl.style.margin = "0";
        voiceBtn.classList.remove("active");
        if (inputEl && !inputEl.readOnly) inputEl.placeholder = 'Ask a question…';
      }
  }
  checkPillContainer();
  updateContextHint();
  // WEB focus session: keep the top-bar mic button + ticker listening dot in sync.
  try { if (window.WHIS_WEB && typeof window._whisSessionSync === 'function') window._whisSessionSync(); } catch (_) {}
}

function toggleRecording() {
  if (isAutoMode) return; 
  
  if (isListening) {
    stopAndCommitAudio();
  } else {
    startListening();
  }
}

// ========================================================
// --- 5. Screenshot & OCR ---
// ========================================================

async function compressDataUrl(dataUrl, maxWidth = 768, maxHeight = 768, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function preprocessForOcr(dataUrl, scale = 1.6) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");

      const maxDim = 1400;
      const targetW = Math.min(maxDim, Math.round(img.width * scale));
      const targetH = Math.min(maxDim, Math.round(img.height * scale));

      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.filter = "grayscale(100%) contrast(180%)";
      ctx.drawImage(img, 0, 0, targetW, targetH);

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function extractTextFromImage(dataUrl) {
    if (typeof Tesseract === 'undefined') {
        return null;
    }
    
    try {
        let best = null;
        try {
          const processed = await preprocessForOcr(dataUrl);
          const { data: { text, confidence } } = await Tesseract.recognize(processed, 'eng');
          best = { text: (text || "").trim(), confidence };
        } catch (_) {
        }

        if (!best || !best.text) {
          const { data: { text, confidence } } = await Tesseract.recognize(dataUrl, 'eng');
          best = { text: (text || "").trim(), confidence };
        }

        return best;
    } catch (err) {
        return null;
    }
}

let isCapturingScreen = false;

async function silentScreenshotCapture(opts = {}) {
    if (isCapturingScreen) return;
    // Demo already captured via captureScreenDemo(), skip to avoid the
    // desktopCapturer.getSources() blink that occurs on content-protected windows.
    if (_demoActive) return;
    if (!window.electronAPI || !window.electronAPI.captureScreen) return;

    // WEB Live Mode: when a persistent shared-screen stream exists, grab a frame
    // from it (no re-prompt, works while the Whis tab is backgrounded) instead of
    // the one-shot captureScreen(). Also skip the body-hide blink, the shared
    // window is the interview, not this tab.
    const useLive = window.WHIS_WEB && opts.fromLive === true &&
        window.electronAPI.hasLiveScreen && window.electronAPI.hasLiveScreen();

    isCapturingScreen = true;

    const slider = document.getElementById("app-opacity-slider");
    const targetOpacity = slider ? slider.value : "1";

    try {
        // Never hide the body during the interactive demo, it blacks out the entire overlay
        if (!_demoActive && !useLive) {
            document.body.style.transition = "opacity 0.15s ease-out";
            document.body.style.opacity = "0";
            document.body.style.pointerEvents = "none";
            await new Promise(r => setTimeout(r, 120));
        }

        const res = useLive
            ? await window.electronAPI.grabLiveFrame()
            : await window.electronAPI.captureScreen();

        if (!_demoActive && !useLive) {
            document.body.style.opacity = targetOpacity;
            document.body.style.pointerEvents = "auto";
            await new Promise(r => setTimeout(r, 30));
        }

        if (res && res.dataUrl) {
            const compressed = await compressDataUrl(res.dataUrl);

            if (!isAutoMode) {
                const ocrResult = await extractTextFromImage(compressed);
                stagedScreenshotOcrText = (ocrResult && ocrResult.text) ? ocrResult.text : "";
                stagedScreenshotOcrConfidence = (ocrResult && typeof ocrResult.confidence === "number") ? ocrResult.confidence : null;
            } else {
                stagedScreenshotOcrText = "";
                stagedScreenshotOcrConfidence = null;
            }

            stagedScreenshotData = compressed;
            updateContextHint();
        }
    } catch (err) {
        console.error("Silent capture failed", err);
    } finally {
        // Always restore, if body was set to 0, ensure it comes back regardless of demo state
        document.body.style.opacity = targetOpacity;
        document.body.style.pointerEvents = "auto";
        isCapturingScreen = false;
    }
}

async function handleScreenshotStage() {
  if (isProcessingSend || isAutoMode) return;

  // WEB (ParakeetAI-style): "Snap" no longer fires a fresh getDisplayMedia prompt each
  // time. If a screen is already shared (the persistent live stream), sample the CURRENT
  // frame from that video track and send it (one share, then Snap just grabs frames).
  // If nothing is shared yet, trigger the share first, then the next Snap samples it.
  // Desktop Electron keeps its original one-shot captureScreen() behavior (untouched).
  if (window.WHIS_WEB && !IS_MOBILE_WEB) {
    const shared = window.electronAPI && window.electronAPI.hasLiveScreen &&
      window.electronAPI.hasLiveScreen();
    if (shared) {
      await silentScreenshotCapture({ fromLive: true });
      finalizeAndSend();
      return;
    }
    // No share yet → start one (inside this click gesture) so Snap can sample it. If the
    // session preview owns the share flow, defer to it; otherwise prompt directly.
    if (typeof WhisSession !== 'undefined' && WhisSession.isActive() && window._whisSessionStartShare) {
      try { await window._whisSessionStartShare(); } catch (_) {}
    } else if (window.electronAPI && window.electronAPI.startLiveScreen) {
      let res;
      try { res = await window.electronAPI.startLiveScreen(true); } catch (e) { res = { error: e && e.message }; }
      if (!res || res.error) {
        try { whisToast('Share your interview tab/window first, then click <strong>Snap</strong> to capture the question.', 'info', 6000); } catch (_) {}
        return;
      }
    }
    // Now that a share exists, grab the frame and send.
    if (window.electronAPI && window.electronAPI.hasLiveScreen && window.electronAPI.hasLiveScreen()) {
      await silentScreenshotCapture({ fromLive: true });
      finalizeAndSend();
    }
    return;
  }

  const hasPermission = await checkAndRequestPermission('screen');
  if (!hasPermission) return;

  await silentScreenshotCapture();
  finalizeAndSend();
}

// WEB Live Mode: capture the interview question from the PERSISTENT shared screen
// (no re-prompt) and send it down the normal OCR→stream path. The answer streams
// into the main app AND mirrors into the floating PiP panel.
async function handleLiveCaptureStage() {
  if (isProcessingSend || isAutoMode) return;
  if (!(window.electronAPI && window.electronAPI.hasLiveScreen && window.electronAPI.hasLiveScreen())) return;
  // Immediate feedback in the PiP while the frame is grabbed + OCR'd.
  try { if (typeof WhisLive !== 'undefined' && WhisLive.isOpen()) WhisLive.mirrorAnswer('Reading the question…', true); } catch (_) {}
  await silentScreenshotCapture({ fromLive: true });
  finalizeAndSend();
}

// ========================================================
// --- 6. Bindings & App Initialization ---
// ========================================================

function handleClear() {
    const prevMessages = state.messages.filter(m => m.id !== 'welcome');
    const hadContent = prevMessages.length > 0;

    inputEl.value = "";
    localStorage.removeItem('wh_draft');
    hiddenTranscription = "";
    clearStagedScreenshot();
    stopInterviewTimer();

    if (listeningStatusEl.classList.contains("active")) {
        listeningStatusEl.classList.remove("active");
        listeningStatusEl.innerHTML = "";
        listeningStatusEl.style.display = "none";
    }

    state.messages = [];
    localStorage.removeItem(_SESSION_KEY);

    if (state.isSending) {
        stopStream();
    } else {
        cleanupStreamState();
        renderMessages();
    }

    _lastHint = null;
    updateContextHint();

    if (hadContent && prevMessages.length >= 2) {
        setTimeout(() => {
            whisToast('Export this session as .txt?', 'info', 8000, {
                action: { label: 'Export', fn: () => _exportSession(prevMessages) }
            });
        }, 200);
    }

    if (hadContent) {
        whisToast('Chat cleared', 'info', 5000, {
            action: {
                label: 'Undo',
                fn: () => {
                    state.messages = prevMessages;
                    renderMessages();
                    whisToast('Restored', 'success', 2000);
                }
            }
        });
    }
}

if (window.electronAPI && window.electronAPI.onTriggerClear) {
    window.electronAPI.onTriggerClear(() => {
        _flashShortcutLabel(CTRL + '+⌫  Clear');
        handleClear();
    });
}

if (window.electronAPI && window.electronAPI.onTriggerSend) {
    window.electronAPI.onTriggerSend(() => {
        _flashShortcutLabel(CTRL + '+↵  Send');
        if (state.isSending && inputEl.value.trim() === "") {
            stopStream();
        } else {
            finalizeAndSend();
        }
    });
}

if (clearBtn) {
    clearBtn.addEventListener("click", handleClear);
}

sendBtn.addEventListener("click", () => {
    if (state.isSending && inputEl.value.trim() === "") {
        stopStream();
    } else {
        finalizeAndSend();
    }
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  if (e.metaKey || e.ctrlKey || (!e.shiftKey && !e.altKey)) {
    e.preventDefault();
    finalizeAndSend();
  }
});

// Trial-only model: a user without an active trial/plan can't type into a void.
// Locking the composer (readOnly + clear placeholder) and routing focus to the
// trial keeps the experience clean, no typing that leads nowhere.
function _isEntitledToUse() {
    return !(isFreeTier && !subscriptionIsActive && !subscriptionIsTrial);
}
function _applyComposerLock() {
    if (!inputEl) return;
    const locked = !_isEntitledToUse();
    inputEl.readOnly = locked;
    if (locked) inputEl.placeholder = 'Start your free Elite trial to ask questions →';
}
inputEl.addEventListener("focus", () => {
    if (_isEntitledToUse()) return;
    inputEl.blur();
    if (currentTrialUsage < maxTrialSessions) {
        openTrialModal();
    } else {
        whisToast('Your free trials for today are used up, upgrade to keep going.', 'warning', 5000,
            { action: { label: 'See Plans', fn: () => window.electronAPI.openSubscriptionPage() } });
    }
});

// Update contextual hint as user types
inputEl.addEventListener("input", () => {
    updateContextHint();
    localStorage.setItem('wh_draft', inputEl.value);
});


if (voiceBtn) voiceBtn.addEventListener("click", () => { if (_demoActive) return; toggleRecording(); });
if (screenshotBtn) screenshotBtn.addEventListener("click", () => { if (_demoActive) return; handleScreenshotStage(); });

// ── Session restore/save (CHANGE 6) ──

function _saveSession() {
    try {
        const realMsgs = state.messages.filter(m => m.id !== 'welcome' && m.content);
        if (realMsgs.length === 0) return;
        localStorage.setItem(_SESSION_KEY, JSON.stringify({
            messages: realMsgs,
            conversationId: CURRENT_CONVERSATION_ID,
            savedAt: Date.now()
        }));
    } catch(_) {}
}

function _tryRestoreSession() {
    // Restore-session prompt disabled by request, never show the "Restore?" popup.
    // Clear any previously saved session so stale data doesn't accumulate.
    try { localStorage.removeItem(_SESSION_KEY); } catch(_) {}
}

// ── Session health log (CHANGE 14) ──
const _HEALTH_LOG_KEY = 'wh_health_log';

function _logHealth(event, detail = '') {
    try {
        const log = JSON.parse(localStorage.getItem(_HEALTH_LOG_KEY) || '[]');
        log.push({ ts: Date.now(), event, detail: String(detail).slice(0, 120) });
        if (log.length > 150) log.splice(0, log.length - 150);
        localStorage.setItem(_HEALTH_LOG_KEY, JSON.stringify(log));
    } catch(_) {}
}

// ── Network retry queue (CHANGE 15) ──
let _pendingRetryPayload = null;
let _retryWatchInterval = null;

function _queueRetry(payload, googleId) {
    _pendingRetryPayload = { payload, googleId };
    whisToast('Network error, will retry automatically when reconnected', 'warning', 0);
    _retryWatchInterval = setInterval(async () => {
        if (_connStatus !== 'online' || !_pendingRetryPayload) return;
        const { payload: p, googleId: g } = _pendingRetryPayload;
        _pendingRetryPayload = null;
        clearInterval(_retryWatchInterval); _retryWatchInterval = null;
        whisToast('Reconnected, sending…', 'info', 3000);
        await sendMessage({ overrideText: p.content, screenshotDataURL: p.screenshot });
    }, 4000);
}

// ── Post-session export (CHANGE 12) ──
function _exportSession(messages) {
    if (!messages || messages.length === 0) return;
    const lines = ['Whis-AI Session Export', `Date: ${new Date().toLocaleString()}`, '='.repeat(50), ''];
    messages.forEach((m, i) => {
        const role = m.role === 'user' ? '[ QUESTION ]' : '[ ANSWER ]';
        lines.push(role);
        lines.push(m.content || '');
        lines.push('');
        if (m.role === 'assistant' && i < messages.length - 1) lines.push('-'.repeat(30), '');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `whis-session-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
}

// ── Shortcut flash (CHANGE 13) ──
function _flashShortcutLabel(label) {
    const el = document.getElementById('shortcut-flash');
    if (!el) return;
    el.textContent = label;
    el.style.display = 'block';
    requestAnimationFrame(() => {
        el.classList.add('sf-show');
        clearTimeout(el._sfTimer);
        el._sfTimer = setTimeout(() => {
            el.classList.remove('sf-show');
            setTimeout(() => { el.style.display = 'none'; }, 160);
        }, 900);
    });
}

// ── Pre-interview checklist (CHANGE 9) ──
// ── Mobile capture note (shown once, honest about the tradeoff) ──
// The first time a mobile user taps Listen, explain that a phone can hear THEM (mic)
// and answer TYPED questions, but cannot capture the interviewer, that needs a laptop.
// Encouraging, not a dead-end: the value on mobile is instant answers to what they ask.
let _mobileCaptureNoteShown = false;
// One-time coaching so the getDisplayMedia picker isn't confusing: tell the user to
// pick the MEETING tab and turn ON "Share tab audio", the key to hearing the interviewer.
let _tabShareHintShown = false;
function _showTabShareHintOnce() {
    if (_tabShareHintShown) return;
    _tabShareHintShown = true;
    whisToast('Pick your <strong>meeting tab</strong> (Zoom/Meet/Teams) and turn ON <strong>“Share tab audio”</strong> so Whis hears the interviewer. Prefer your mic instead? <a href="#" id="wh-use-mic" style="color:#d9c7f7;font-weight:700;">Use my mic</a>.', 'info', 9000,
        { action: null });
    // wire the "use my mic" inline link (best-effort)
    setTimeout(() => { const a = document.getElementById('wh-use-mic'); if (a) a.addEventListener('click', (e) => { e.preventDefault(); window._whisUseMic = true; whisToast('Switched to microphone. Click Listen again.', 'info', 4000); }); }, 100);
}

function _showMobileCaptureNoteOnce() {
    if (_mobileCaptureNoteShown) return;
    if (localStorage.getItem('wh_mobile_capture_note') === '1') { _mobileCaptureNoteShown = true; return; }
    _mobileCaptureNoteShown = true;
    localStorage.setItem('wh_mobile_capture_note', '1');
    whisToast(
        'On your phone, Whis answers your <strong>typed questions</strong> and hears <strong>your mic</strong>. To capture the interviewer live during a call, open Whis on a laptop or desktop.',
        'info', 9000
    );
}

// ── Web first-run hint (once) ──
// Makes the answer loop discoverable the moment the user can actually use it.
// Desktop-web: type OR click Listen to capture the meeting tab. Mobile: type OR
// use the mic. Shown once ever (localStorage) so it never nags returning users.
let _webFirstRunHintShown = false;
function _showWebFirstRunHintOnce() {
    if (!window.WHIS_WEB) return;
    if (_webFirstRunHintShown) return;
    if (localStorage.getItem('wh_web_firstrun_hint') === '1') { _webFirstRunHintShown = true; return; }
    _webFirstRunHintShown = true;
    localStorage.setItem('wh_web_firstrun_hint', '1');
    const msg = IS_MOBILE_WEB
        ? 'You’re in. <strong>Type your question and press Enter</strong> for an instant answer, or tap the mic to ask by voice.'
        : 'You’re in. <strong>Type your question and press Enter</strong>, or click <strong>Listen</strong> to capture the meeting tab’s audio.';
    setTimeout(() => whisToast(msg, 'info', 8000), 400);
}

let _hasShownPreflight = false;

function _showPreflightChecklist() {
    if (_hasShownPreflight) return;
    _hasShownPreflight = true;
    const items = [];
    items.push(_connStatus === 'online' ? '✓ Backend connected' : '⚠ Backend unreachable');
    const hasCtx = typeof localContexts !== 'undefined' && localContexts.some(c => c.isActive);
    items.push(hasCtx ? '✓ Context loaded' : '⚠ No context, add resume for personalized answers');
    items.push(isCrisp ? '✓ Crisp mode ON (concise answers)' : '✓ Full mode (detailed answers)');
    const allOk = items.every(i => i.startsWith('✓'));
    // Don't nag when everything is fine, only surface real issues (e.g. no context).
    if (allOk) return;
    const warnings = items.filter(i => i.startsWith('⚠'));
    whisToast(warnings.join('  ·  '), 'warning', 6000);
}

// ── Stealth self-verification (CHANGE 11) ──
// ── Shared stealth verification, called from header badge, dropdown, and empty state ──
// ── Stealth protection helpers ──
function _isStealthActive() {
    return isFreeTier || (subscriptionTier === 'pro_plus' && subscriptionIsActive);
}

function _updateStealthBadge(isProtected) {
    const badge = document.getElementById('stealth-header-badge');
    if (!badge) return;
    if (isProtected) {
        badge.className = 'stealth-header-badge';
        badge.title = 'Invisible in screenshare, recordings & screenshots · Click to verify';
        badge.innerHTML = '<i class="fa-solid fa-shield-halved"></i><span>Stealth</span>';
        badge.onclick = _runStealthVerify;
    } else {
        badge.className = 'stealth-header-badge stealth-badge-risk';
        badge.title = 'Pro plan, Whis-AI IS visible in screenshares. Click to upgrade to Elite.';
        badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i><span>Screenshare Risk</span>';
        badge.onclick = () => {
            whisToast('Upgrade to Elite to activate full OS-level stealth invisibility.', 'warning', 5000, {
                action: { label: 'Upgrade to Elite', fn: () => window.electronAPI.openSubscriptionPage() }
            });
        };
    }
}

// ── Shared stealth capture helper ──
// desktopCapturer is a privileged Electron API, it sees this window even though
// content-protection hides it from *other* apps (Zoom, OBS, OS screenshot tools).
// We must hide the Whis body first so the captured image shows what the interviewer
// actually sees (the desktop/other windows behind Whis, with no trace of Whis).
async function _captureStealthProof() {
    if (window.WHIS_WEB) return null; // stealth proof is meaningless in a browser
    if (!window.electronAPI || !window.electronAPI.captureScreen) return null;

    const slider = document.getElementById('app-opacity-slider');
    const targetOpacity = slider ? slider.value : '1';

    try {
        if (!_demoActive) {
            document.body.style.transition  = 'opacity 0.12s ease-out';
            document.body.style.opacity     = '0';
            document.body.style.pointerEvents = 'none';
            await new Promise(r => setTimeout(r, 160));
        }

        const res = await window.electronAPI.captureScreen();
        return res && res.dataUrl ? res.dataUrl : null;
    } finally {
        // Always restore body, no matter what happens during capture
        document.body.style.transition  = 'opacity 0.1s ease-in';
        document.body.style.opacity     = targetOpacity;
        document.body.style.pointerEvents = 'auto';
    }
}

async function _runStealthVerify() {
    if (profileDropdownMenu) profileDropdownMenu.style.display = 'none';
    whisToast('Taking stealth screenshot, app will blink once…', 'info', 2500);
    const dataUrl = await _captureStealthProof();
    if (!dataUrl) { whisToast('Screenshot failed', 'error', 3000); return; }
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;pointer-events:all;';
    ov.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;color:#4df4b1;font-weight:700;font-size:14px;letter-spacing:0.4px;">
            <i class="fa-solid fa-shield-halved" style="font-size:18px;"></i>
            Whis-AI is completely invisible to your interviewer
        </div>
        <img src="${dataUrl}" style="max-width:80%;max-height:60vh;border-radius:10px;border:1px solid rgba(255,255,255,0.12);box-shadow:0 20px 60px rgba(0,0,0,0.8);"/>
        <div style="color:rgba(255,255,255,0.45);font-size:11px;text-align:center;line-height:1.6;">
            This is exactly what your interviewer's screen capture sees.<br>No trace of Whis-AI anywhere.
        </div>
        <button style="padding:8px 22px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);color:#fff;border-radius:100px;cursor:default;font-size:12px;letter-spacing:0.3px;">Close</button>
    `;
    ov.querySelector('button').addEventListener('click', () => ov.remove());
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
}

const stealthTestBtn = document.getElementById('stealth-test-btn');
if (stealthTestBtn) stealthTestBtn.addEventListener('click', _runStealthVerify);

// Badge click is set dynamically by _updateStealthBadge() after subscription loads:
// Elite/Free → _runStealthVerify   Pro → upgrade toast
// No permanent listener here, that would fire _runStealthVerify for Pro users too.

// ── Audio device change auto-recovery (CHANGE 8) ──
if (navigator.mediaDevices) {
    navigator.mediaDevices.addEventListener('devicechange', async () => {
        if (!isListening) return;
        _streamRestartAttempts = 0; // audio device changed, reconnect silently
        await _handleStreamEnded();
    });
}

// ══════════════════════════════════════════
// STEALTH ONBOARDING WIZARD
// ══════════════════════════════════════════
function _showStealthOnboard() {
    // WEB ADAPTATION: screen-share invisibility is an OS-level (Electron) capability that
    // does NOT exist in a browser tab. Detect the web build by the absence of the
    // desktop-only captureScreen bridge, skip the stealth wizard entirely, mark it done,
    // and fall through to context onboarding so the boot flow continues normally.
    if (window.WHIS_WEB) {
        try { localStorage.setItem('wh_stealth_ok', '1'); } catch (_) {}
        setTimeout(_showContextOnboarding, 400);
        return;
    }
    const overlay = document.getElementById('stealth-onboard-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';

    const p0Pro  = document.getElementById('stealth-ob-p0-pro');
    const p1     = document.getElementById('stealth-ob-p1');
    const p2Shot = document.getElementById('stealth-ob-p2-shot');
    const p2Share= document.getElementById('stealth-ob-p2-share');

    function _showPhase(show) {
        p0Pro.style.display  = show === 0 ? 'block' : 'none';
        p1.style.display     = show === 1 ? 'block' : 'none';
        p2Shot.style.display = show === 2 ? 'block' : 'none';
        p2Share.style.display= show === 3 ? 'block' : 'none';
    }

    // Pro users see the risk warning first; everyone else gets the verification flow
    _isStealthActive() ? _showPhase(1) : _showPhase(0);

    function _dismiss() {
        localStorage.setItem('wh_stealth_ok', '1');
        overlay.style.display = 'none';
        // Launch the interactive demo after the wizard completes (first time only)
        if (!hasShownTourThisSession) {
            hasShownTourThisSession = true;
            setTimeout(() => openWhisTour(), 400);
        }
    }

    async function _doScreenshot() {
        whisToast('App will blink once, that\'s the proof moment', 'info', 2200);
        const dataUrl = await _captureStealthProof();
        if (!dataUrl) { whisToast('Screenshot failed', 'error', 3000); return; }
        document.getElementById('stealth-shot-img').src = dataUrl;
        _showPhase(2);
    }

    // Phase 0 (Pro risk) buttons
    document.getElementById('stealth-pro-upgrade-btn').onclick  = () => { _dismiss(); window.electronAPI.openSubscriptionPage(); };
    document.getElementById('stealth-pro-continue-btn').onclick = _dismiss;

    // Phase 1 buttons
    document.getElementById('stealth-ob-shot-btn').onclick  = _doScreenshot;
    document.getElementById('stealth-ob-share-btn').onclick = () => _showPhase(3);
    document.getElementById('stealth-ob-skip').onclick      = _dismiss;

    // Phase 2A buttons
    document.getElementById('stealth-shot-done-btn').onclick = _dismiss;

    // Phase 2B buttons
    document.getElementById('stealth-share-shot-btn').onclick  = _doScreenshot;
    document.getElementById('stealth-share-done-btn').onclick  = _dismiss;
}

// ── Responsive scale: everything shrinks proportionally as the window narrows ──
(function initResponsiveScale() {
    const DESIGN_WIDTH = 620;  // px at which the layout looks perfect at scale 1.0
    const MIN_SCALE    = 0.42; // floor, never shrink below this factor
    let raf = null;            // RAF handle for coalescing multiple resize events

    function applyScale() {
        raf = null;
        const w     = window.innerWidth;
        const h     = window.innerHeight;
        const scale = Math.max(MIN_SCALE, Math.min(1.0, w / DESIGN_WIDTH));

        if (scale >= 1.0) {
            document.body.style.transform = '';
            document.body.style.width     = '';
            document.body.style.height    = '';
        } else {
            // Expand logical dimensions so scaled body still fills the viewport
            document.body.style.transform = `scale(${scale})`;
            document.body.style.width     = `${(w / scale).toFixed(2)}px`;
            document.body.style.height    = `${(h / scale).toFixed(2)}px`;
        }
    }

    // Coalesce all resize events fired within the same animation frame into one
    // applyScale call, ensures 60 fps max and zero jank during window drag-resize
    window.addEventListener('resize', () => {
        if (!raf) raf = requestAnimationFrame(applyScale);
    }, { passive: true });

    applyScale(); // run once on load so initial render is already scaled
})();

// =====================================================================
// WEB LIVE MODE, Document Picture-in-Picture co-pilot
// ---------------------------------------------------------------------
// A browser tab can't overlay the interview. Instead: the user shares
// their interview screen ONCE (persistent stream), and we float a small
// always-on-top Document PiP window over Zoom / the coding tab. It streams
// the AI answer and offers Capture + Mic. Frames are grabbed from the
// persistent stream (no re-prompt) so it works while this tab is hidden.
//
// Web-only. Guarded by window.WHIS_WEB and documentPictureInPicture support.
// NEVER runs on desktop Electron.
// =====================================================================
const WhisLive = (() => {
  let pip = null;          // the PiP Window
  let ansEl = null;        // streaming-answer node inside the PiP
  let statusEl = null;     // status line node
  let micBtn = null;       // mic toggle button node
  let goLiveBtnEls = [];   // "Go Live" trigger buttons in the main UI (for state reset)

  const supported = () =>
    window.WHIS_WEB &&
    !IS_MOBILE_WEB &&
    typeof window.documentPictureInPicture !== 'undefined' &&
    !!(window.electronAPI && window.electronAPI.startLiveScreen);

  const isOpen = () => !!pip;

  function _toast(msg, type, dur) {
    try { whisToast(msg, type || 'info', dur || 4000); } catch (_) {}
  }

  // Copy the host document's styles into the PiP doc, Document PiP windows do
  // NOT inherit the opener's stylesheets. Clone <link rel=stylesheet> + <style>.
  function _copyStyles(doc) {
    try {
      document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
        doc.head.appendChild(node.cloneNode(true));
      });
    } catch (_) {}
    // Compact, self-contained brand styles so the panel is readable even if the
    // host stylesheets fail to clone (cross-origin link edge cases).
    const s = doc.createElement('style');
    s.textContent = `
      :root { --wl-accent:#d9c7f7; }
      html,body { margin:0; padding:0; height:100%; }
      body.wl-body {
        background:#070a14; color:#e8edf5;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
        display:flex; flex-direction:column; overflow:hidden;
        -webkit-font-smoothing:antialiased;
      }
      .wl-head {
        display:flex; align-items:center; justify-content:space-between;
        padding:10px 12px; border-bottom:1px solid rgba(255,255,255,.08); flex:0 0 auto;
      }
      .wl-title { font-size:13px; font-weight:600; letter-spacing:.2px; display:flex; align-items:center; gap:7px; }
      .wl-dot { width:7px; height:7px; border-radius:50%; background:var(--wl-accent); box-shadow:0 0 0 3px rgba(217,199,247,.18); }
      .wl-close {
        background:transparent; border:none; color:#8a94a6; font-size:15px; cursor:pointer;
        width:26px; height:26px; border-radius:6px; line-height:1;
      }
      .wl-close:hover { background:rgba(255,255,255,.06); color:#fff; }
      .wl-status {
        padding:6px 12px; font-size:11.5px; color:#9aa6ba; flex:0 0 auto;
        border-bottom:1px solid rgba(255,255,255,.05); display:flex; align-items:center; gap:6px;
      }
      .wl-status .wl-live-dot { width:6px; height:6px; border-radius:50%; background:#3ddc84; }
      .wl-answer {
        flex:1 1 auto; overflow-y:auto; padding:12px 14px; font-size:14px; line-height:1.55;
        white-space:normal; word-break:break-word;
      }
      .wl-answer .wl-placeholder { color:#6b7688; font-size:13px; }
      .wl-answer pre {
        background:#0d1526; border:1px solid rgba(255,255,255,.07); border-radius:8px;
        padding:10px; overflow-x:auto; font-size:12.5px;
      }
      .wl-answer code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
      .wl-cursor { display:inline-block; width:7px; height:14px; background:var(--wl-accent);
        margin-left:2px; vertical-align:text-bottom; animation:wlblink 1s steps(2) infinite; }
      @keyframes wlblink { 50% { opacity:0; } }
      .wl-actions { display:flex; gap:8px; padding:10px 12px; flex:0 0 auto;
        border-top:1px solid rgba(255,255,255,.08); }
      .wl-btn {
        flex:1; display:flex; align-items:center; justify-content:center; gap:7px;
        padding:12px 10px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer;
        border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04); color:#e8edf5;
      }
      .wl-btn:hover { background:rgba(255,255,255,.08); }
      .wl-btn:active { transform:translateY(1px); }
      .wl-btn.wl-primary { background:var(--wl-accent); border-color:var(--wl-accent); color:#04121c; }
      .wl-btn.wl-primary:hover { filter:brightness(1.06); }
      .wl-btn.wl-on { background:rgba(61,220,132,.16); border-color:rgba(61,220,132,.5); color:#8ff0bd; }
      .wl-hint { padding:0 12px 10px; font-size:10.5px; color:#6b7688; line-height:1.4; flex:0 0 auto; }
    `;
    doc.head.appendChild(s);
  }

  function _buildBody(doc) {
    doc.body.className = 'wl-body';
    doc.body.innerHTML = `
      <div class="wl-head">
        <div class="wl-title"><span class="wl-dot"></span> Whis · Live</div>
        <button class="wl-close" id="wl-close" title="Close Live">&times;</button>
      </div>
      <div class="wl-status" id="wl-status"><span class="wl-live-dot"></span><span id="wl-status-text">Sharing your screen</span></div>
      <div class="wl-answer" id="wl-answer"><div class="wl-placeholder">Click <b>Capture question</b> when the interviewer shows a question, or turn on the mic to listen. The answer appears here.</div></div>
      <div class="wl-actions">
        <button class="wl-btn wl-primary" id="wl-capture"><span>&#128247;</span> Capture question</button>
        <button class="wl-btn" id="wl-mic"><span>&#127908;</span> Mic</button>
      </div>
      <div class="wl-hint">Tip: share only the interview window/tab, not this display, so the panel stays private.</div>
    `;

    ansEl = doc.getElementById('wl-answer');
    statusEl = doc.getElementById('wl-status-text');
    micBtn = doc.getElementById('wl-mic');

    doc.getElementById('wl-close').addEventListener('click', () => close());
    doc.getElementById('wl-capture').addEventListener('click', async () => {
      _setStatus('Reading the question…');
      try {
        await handleLiveCaptureStage();
      } catch (_) {
        _toast('Capture failed, try again.', 'error');
      }
      _syncStatus();
    });
    micBtn.addEventListener('click', () => {
      try { toggleRecording(); } catch (_) {}
      // Reflect state shortly after (startListening is async).
      setTimeout(_syncMic, 250);
    });
  }

  function _setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function _syncMic() {
    if (!micBtn) return;
    const on = (typeof isListening !== 'undefined' && isListening);
    micBtn.classList.toggle('wl-on', on);
    micBtn.innerHTML = on ? '<span>&#128308;</span> Listening' : '<span>&#127908;</span> Mic';
    _syncStatus();
  }

  function _syncStatus() {
    if (typeof isListening !== 'undefined' && isListening) {
      _setStatus(typeof _liveListenLabel === 'function' ? _liveListenLabel() : 'Listening…');
    } else {
      _setStatus('Sharing your screen · ready');
    }
  }

  // Called from the chat-stream handlers to mirror the main answer.
  function mirrorAnswer(fullContent, isFirstChunk) {
    if (!pip || !ansEl) return;
    try {
      const html = (typeof formatMessageContent === 'function')
        ? formatMessageContent(fullContent)
        : String(fullContent || '');
      ansEl.innerHTML = html + '<span class="wl-cursor"></span>';
      ansEl.scrollTop = ansEl.scrollHeight;
    } catch (_) {}
  }

  function endAnswer(fullContent) {
    if (!pip || !ansEl) return;
    try {
      const html = (typeof formatMessageContent === 'function')
        ? formatMessageContent(fullContent)
        : String(fullContent || '');
      ansEl.innerHTML = html;
      ansEl.scrollTop = ansEl.scrollHeight;
    } catch (_) {}
  }

  async function goLive(triggerEl) {
    if (isOpen()) { try { pip.focus(); } catch (_) {} return; }
    if (!supported()) {
      _toast('Live Mode needs Chrome or Edge on desktop, or put Whis on a second screen.', 'info', 6000);
      return;
    }

    // Share the interview screen ONCE (persistent stream). Must be in the click
    // handler's user gesture, both getDisplayMedia and requestWindow require it.
    let shareRes;
    try {
      shareRes = await window.electronAPI.startLiveScreen(window._whisTabAudio === true);
    } catch (e) {
      shareRes = { error: e && e.message };
    }
    if (!shareRes || shareRes.error) {
      _toast('Screen share cancelled. Live Mode needs your interview screen shared once.', 'warning', 5000);
      return;
    }

    // Open the always-on-top Document PiP window.
    try {
      pip = await window.documentPictureInPicture.requestWindow({ width: 400, height: 560 });
    } catch (e) {
      // PiP failed after sharing, stop the stream so we don't leave it dangling.
      try { window.electronAPI.stopLiveScreen(); } catch (_) {}
      pip = null;
      _toast('Could not open the Live panel. Try Chrome/Edge on desktop.', 'error', 5000);
      return;
    }

    _copyStyles(pip.document);
    _buildBody(pip.document);
    _syncMic();
    _syncStatus();

    // When the PiP closes (X, Cmd-W, or system) → stop stream + mic, reset UI.
    pip.addEventListener('pagehide', () => _onPipGone());

    goLiveBtnEls = Array.from(document.querySelectorAll('.wl-golive-btn'));
    goLiveBtnEls.forEach((b) => { b.classList.add('wl-active'); b.setAttribute('aria-pressed', 'true'); });

    _toast('Live Mode on. Share only the interview window so the panel stays private.', 'success', 5000);
  }

  function _onPipGone() {
    pip = null; ansEl = null; statusEl = null; micBtn = null;
    try { if (typeof isListening !== 'undefined' && isListening) stopAndCommitAudio(true); } catch (_) {}
    try { window.electronAPI.stopLiveScreen(); } catch (_) {}
    goLiveBtnEls.forEach((b) => { b.classList.remove('wl-active'); b.setAttribute('aria-pressed', 'false'); });
    goLiveBtnEls = [];
  }

  // Close the PiP programmatically (fires pagehide → _onPipGone).
  function close() {
    if (pip) { try { pip.close(); } catch (_) { _onPipGone(); } }
  }

  // The user clicked the browser's "Stop sharing" → tear down the panel.
  function _onScreenEnded() {
    if (pip) { try { pip.close(); } catch (_) {} }
    _onPipGone();
    _toast('Screen sharing ended.', 'info', 4000);
  }

  // Wire the browser "Stop sharing" callback + build the Go Live entry buttons.
  function init() {
    if (!window.WHIS_WEB) return;
    if (window.electronAPI && window.electronAPI.onLiveScreenEnded) {
      window.electronAPI.onLiveScreenEnded(() => _onScreenEnded());
    }
    _installEntryButtons();
  }

  // Inject a "Go Live" button into the input row (near Listen/Snap). On browsers
  // without Document PiP (or on mobile), show a disabled note instead of the button.
  function _installEntryButtons() {
    const row = document.querySelector('.input-row');
    if (!row || document.getElementById('go-live-btn') || document.getElementById('go-live-note')) return;

    // Smooth web default: use the mic unless a clean shared-audio stream takes over.
    if (window.WHIS_WEB && window._whisUseMic === undefined) window._whisUseMic = true;

    const anchor = document.getElementById('screenshot-btn') || row.firstElementChild;

    if (!supported()) {
      // Not supported here, a small, honest note (no false promises).
      const note = document.createElement('button');
      note.id = 'go-live-note';
      note.className = 'input-icon-btn wl-golive-note';
      note.type = 'button';
      note.title = IS_MOBILE_WEB
        ? 'Live Mode needs Chrome or Edge on a desktop.'
        : 'Live Mode needs Chrome or Edge, or put Whis on a second screen.';
      note.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i><span class="btn-mini-label">Live</span>';
      note.addEventListener('click', () => {
        _toast(IS_MOBILE_WEB
          ? 'Live Mode needs Chrome or Edge on a desktop computer.'
          : 'Live Mode needs Chrome or Edge on desktop, or put Whis on a second screen next to your interview.',
          'info', 6000);
      });
      if (anchor && anchor.nextSibling) row.insertBefore(note, anchor.nextSibling);
      else row.appendChild(note);
      return;
    }

    const btn = document.createElement('button');
    btn.id = 'go-live-btn';
    btn.className = 'input-icon-btn wl-golive-btn';
    btn.type = 'button';
    btn.title = 'Float a small live co-pilot over your interview (share your screen once)';
    btn.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i><span class="btn-mini-label">Go Live</span>';
    btn.addEventListener('click', () => goLive(btn));
    if (anchor && anchor.nextSibling) row.insertBefore(btn, anchor.nextSibling);
    else row.appendChild(btn);

    // Web: the main composer needs only Go Live. Listen + Snap are redundant here
    // and reappear inside the floating live co-pilot once it opens. CSS gates them
    // by body.whis-web:not(.whis-session-active) so they still work while live.
    if (window.WHIS_WEB) document.body.classList.add('whis-web');
  }

  return { init, goLive, close, mirrorAnswer, endAnswer, isOpen, supported };
})();

// ============================================================================
// WEB FOCUS-MODE LIVE SESSION  (WHIS_WEB only; desktop Electron untouched)
// ----------------------------------------------------------------------------
// A space-optimized "90% output" layout. Owner's top priority: the AI answer/
// code area should own almost the whole viewport, while the live transcript
// steals ~zero vertical space. We beat ParakeetAI where reviewers say it's
// weakest: their generated code overflows and can't scroll, here #messages and
// every code <pre> scroll cleanly, never truncated.
//
// LAYOUT (vertical stack, all web-gated by body.whis-session-active):
//   • Global header (reused), trial timer + Exit live here (one thin row).
//   • #web-focus-topbar (~thin), live dot, mic Start/Stop, language, Answer,
//                                 Screenshot, Exit fallback.
//   • #web-focus-ticker (~32px), single-line news-crawl of the live transcript,
//                                 "Listening…" with a pulsing dot; hover/click
//                                 drops #wf-overlay (last ~6 lines) that auto-
//                                 collapses. An "expand" affordance is present.
//   • #messages, ~90% of the view, full-width, generous type, scrollable code.
//   • .input-row (reused), slim manual message + Send + screenshot affordance.
//
// Everything reuses the EXISTING systems: startListening/stopAndCommitAudio,
// liveTranscript/_rtPartialText/_renderLiveTranscript, finalizeAndSend,
// handleScreenshotStage, and the trial timer element. No server changes.
// ============================================================================
const WhisSession = (() => {
  if (!window.WHIS_WEB) {
    // Desktop build: expose inert no-ops so any caller is safe.
    return { init(){}, enter(){}, exit(){}, isActive(){ return false; }, mirrorTranscript(){} };
  }

  let built = false;
  let active = false;
  let topbarEl = null;
  let tickerEl = null;
  let tickerTrackEl = null;
  let overlayEl = null;
  let micBtn = null;
  let langSelect = null;
  let dotEl = null;
  let overlayTimer = null;
  // Two-pane live view (LEFT = shared-tab stage + transcript, RIGHT = answers).
  let previewEl = null;      // <aside> LEFT pane wrapper
  let previewVideoEl = null; // <video> playing the shared stream's video track
  let previewHintEl = null;  // inline "re-share with audio" hint
  let sharePromptEl = null;  // in-view "Share your interview tab" CTA (pre-share)
  let leftPaneEl = null;     // full LEFT column wrapper
  let rightPaneEl = null;    // full RIGHT column wrapper
  let rightBodyEl = null;    // scroll host that adopts #messages
  let rightFootEl = null;    // adopts the existing .input-row + action buttons
  let transcriptPanelEl = null; // readable live transcript panel (replaces ticker)
  let menuBtn = null;        // "⋮" session menu trigger
  let menuPopoverEl = null;  // "⋮" popover
  let exitModalEl = null;    // Leave-or-End modal
  let timerMirrorEl = null;  // right-pane session timer mirror
  let timerMirrorRaf = null; // rAF handle keeping the mirror in sync
  // Where the adopted nodes came from, so exit() can restore the non-live view.
  let _msgsHome = null, _msgsAnchor = null;
  let _inputHome = null, _inputAnchor = null;

  const LANG_KEY = 'wh_session_lang';

  const _LANGS = [
    ['en', 'English'], ['hi', 'Hindi'], ['te', 'Telugu'], ['ta', 'Tamil'],
    ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'],
    ['zh', 'Chinese'], ['ja', 'Japanese'], ['ar', 'Arabic'],
  ];

  // Flatten liveTranscript (+ live partial) into a single running string for the
  // ticker crawl. Newest words at the END so auto-scroll keeps them visible.
  function _tickerString() {
    const segs = (typeof liveTranscript !== 'undefined' && Array.isArray(liveTranscript)) ? liveTranscript : [];
    const partial = (typeof _rtPartialText === 'string' && !isAutoMode) ? _rtPartialText.trim() : '';
    const parts = segs.map(s => s.text.trim()).filter(Boolean);
    if (partial) parts.push(partial);
    return parts.join('  ·  ');
  }

  function _build() {
    if (built) return;
    const content = document.getElementById('content-area');
    if (!content || !content.parentNode) return;

    // ── HIDDEN behavior source: the original focus top bar. It's no longer shown
    //    on web (the new two-pane UI owns the visible controls) but its buttons stay
    //    as the CANONICAL wiring for mic / Answer / Screenshot / language — the new
    //    controls simply proxy clicks onto these, so the proven pipelines are reused
    //    verbatim. Class .wf-hidden-source is display:none in CSS. ─────────────────
    topbarEl = document.createElement('div');
    topbarEl.id = 'web-focus-topbar';
    topbarEl.className = 'web-focus-topbar wf-hidden-source no-drag';
    topbarEl.innerHTML = `
      <button type="button" id="wf-mic" class="wf-btn wf-mic" title="Start / stop listening">
        <i class="fa-solid fa-microphone" aria-hidden="true"></i><span class="wf-btn-label">Start</span>
      </button>
      <span id="wf-live" class="wf-live"><span class="wf-live-dot"></span><span class="wf-live-text">Idle</span></span>
      <select id="wf-lang" class="wf-lang" title="Transcription language" aria-label="Transcription language">
        ${_LANGS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
      </select>
      <span class="wf-spacer"></span>
      <button type="button" id="wf-answer" class="wf-btn wf-answer" title="Answer the current question">
        <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i><span class="wf-btn-label">Answer</span>
      </button>
      <button type="button" id="wf-shot" class="wf-btn wf-shot" title="Capture the current frame from your shared tab for the AI to read">
        <i class="fa-solid fa-crop-simple" aria-hidden="true"></i><span class="wf-btn-label">Capture frame</span>
      </button>
      <button type="button" id="wf-exit" class="wf-btn wf-exit" title="Exit live session">
        <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i><span class="wf-btn-label">Exit</span>
      </button>`;

    // ── HIDDEN transcript ticker: still built (its data source _tickerString feeds
    //    the new readable panel via mirrorTranscript), but visually removed on web. ──
    tickerEl = document.createElement('div');
    tickerEl.id = 'web-focus-ticker';
    tickerEl.className = 'web-focus-ticker wf-hidden-source no-drag';
    tickerEl.innerHTML = `
      <span class="wf-tick-dot" id="wf-tick-dot" aria-hidden="true"></span>
      <div class="wf-tick-viewport"><div class="wf-tick-track" id="wf-tick-track"></div></div>`;

    // ── HIDDEN overlay (kept inert; the new transcript panel replaces it). ────────
    overlayEl = document.createElement('div');
    overlayEl.id = 'wf-overlay';
    overlayEl.className = 'wf-overlay wf-hidden-source no-drag';
    overlayEl.innerHTML = `<div class="wf-overlay-inner" id="wf-overlay-inner"></div>`;

    // ── LEFT PANE (~40%): big shared-tab stage + control row + transcript panel ──
    // Reuses id #web-live-preview so _attachPreview()/#wlp-video/#wlp-share are all
    // unchanged; the pane just now also carries the controls and transcript below it.
    leftPaneEl = document.createElement('aside');
    leftPaneEl.id = 'web-live-preview';
    leftPaneEl.className = 'web-live-preview web-live-pane no-drag';
    leftPaneEl.setAttribute('aria-label', 'Live session — shared tab and transcript');
    previewEl = leftPaneEl; // keep the historical name for _attach/_detachPreview
    leftPaneEl.innerHTML = `
      <div class="wlp-stagewrap">
        <div class="wlp-stage">
          <video id="wlp-video" class="wlp-video" autoplay muted playsinline></video>
          <div class="wlp-stage-tools">
            <button type="button" id="wlp-fullscreen" class="wlp-stage-btn" title="Fullscreen">
              <i class="fa-solid fa-expand" aria-hidden="true"></i><span>Fullscreen</span>
            </button>
            <button type="button" id="wlp-changetab" class="wlp-stage-btn" title="Share a different tab or window">
              <i class="fa-solid fa-repeat" aria-hidden="true"></i><span>Change Tab</span>
            </button>
          </div>
          <div class="wlp-share" id="wlp-share">
            <div class="wlp-share-icon"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></div>
            <div class="wlp-share-title">Share your interview tab</div>
            <div class="wlp-share-sub">Pick the meeting tab / window and tick <strong>Share tab audio</strong>. Whis hears the interviewer and reads the screen from here.</div>
            <button type="button" class="wlp-share-btn" id="wlp-share-btn">
              <i class="fa-solid fa-desktop" aria-hidden="true"></i> Share tab / window
            </button>
          </div>
        </div>
      </div>

      <div class="wlp-controls">
        <button type="button" id="wlp-listen" class="wlp-ctl wlp-ctl--listen" title="Start / stop listening">
          <span class="wlp-rec-dot" aria-hidden="true"></span>
          <i class="fa-solid fa-microphone" aria-hidden="true"></i><span class="wlp-ctl-label">Start</span>
        </button>
        <button type="button" id="wlp-clear" class="wlp-ctl wlp-ctl--ghost" title="Clear the transcript">
          <i class="fa-solid fa-eraser" aria-hidden="true"></i><span class="wlp-ctl-label">Clear</span>
        </button>
        <span class="wlp-ctl-spacer"></span>
        <select id="wlp-lang" class="wlp-lang" title="Transcription language" aria-label="Transcription language">
          ${_LANGS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
        </select>
      </div>

      <div class="wlp-transcript" id="wlp-transcript" aria-label="Live transcript" aria-live="polite"></div>

      <div class="wlp-hint" id="wlp-hint" style="display:none;"></div>`;

    // ── RIGHT PANE (~60%): timer + menu + exit, answers, composer + actions ──────
    rightPaneEl = document.createElement('section');
    rightPaneEl.id = 'web-right-pane';
    rightPaneEl.className = 'web-right-pane no-drag';
    rightPaneEl.innerHTML = `
      <div class="wrp-top">
        <div class="wrp-timer" id="wrp-timer"><span class="wrp-timer-dot"></span><span id="wrp-timer-text">00:00</span></div>
        <div class="wrp-top-actions">
          <button type="button" id="wrp-menu-btn" class="wrp-icon-btn" title="Session options" aria-haspopup="true" aria-expanded="false">
            <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
          </button>
          <button type="button" id="wrp-exit-btn" class="wrp-exit-btn" title="Leave or end this session">
            <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i><span>Exit</span>
          </button>
        </div>
        <div class="wrp-menu" id="wrp-menu" role="menu" hidden>
          <div class="wrp-menu-row">
            <span class="wrp-menu-label">Answer text size</span>
            <div class="wrp-seg" id="wrp-size">
              <button type="button" data-size="s" class="wrp-seg-btn">S</button>
              <button type="button" data-size="m" class="wrp-seg-btn is-on">M</button>
              <button type="button" data-size="l" class="wrp-seg-btn">L</button>
            </div>
          </div>
          <div class="wrp-menu-row">
            <span class="wrp-menu-label">Theme</span>
            <div class="wrp-seg" id="wrp-theme">
              <button type="button" data-theme="forest" class="wrp-seg-btn is-on">Forest</button>
              <button type="button" data-theme="deep" class="wrp-seg-btn">Deep</button>
            </div>
          </div>
          <div class="wrp-menu-row">
            <span class="wrp-menu-label">Language</span>
            <select id="wrp-lang" class="wrp-menu-select" aria-label="Transcription language">
              ${_LANGS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>
          <div class="wrp-menu-row">
            <span class="wrp-menu-label">Auto Answer</span>
            <button type="button" id="wrp-auto" class="wrp-switch" role="switch" aria-checked="false">
              <span class="wrp-switch-knob"></span>
            </button>
          </div>
          <button type="button" id="wrp-edit" class="wrp-menu-item">
            <i class="fa-solid fa-pen" aria-hidden="true"></i> Edit session
          </button>
        </div>
      </div>

      <div class="wrp-body" id="wrp-body"></div>

      <div class="wrp-foot" id="wrp-foot">
        <button type="button" id="wrp-clearmsgs" class="wrp-clearlink">Clear messages</button>
        <div class="wrp-foot-actions">
          <button type="button" id="wrp-answer" class="wrp-action wrp-action--primary" title="Answer the current question now">
            <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Answer
          </button>
          <button type="button" id="wrp-shot" class="wrp-action" title="Capture the shared frame and solve it">
            <i class="fa-solid fa-crop-simple" aria-hidden="true"></i> Screenshot
          </button>
        </div>
      </div>`;

    // Mount both panes as the first children of #content-area. CSS turns
    // #content-area into a two-column grid only when body.whis-session-active.
    content.insertBefore(rightPaneEl, content.firstChild);
    content.insertBefore(leftPaneEl, content.firstChild);
    content.insertBefore(overlayEl, content.firstChild);
    content.insertBefore(tickerEl, content.firstChild);
    content.insertBefore(topbarEl, content.firstChild);

    // Cache the hidden-source refs + new elements.
    previewVideoEl   = leftPaneEl.querySelector('#wlp-video');
    previewHintEl    = leftPaneEl.querySelector('#wlp-hint');
    sharePromptEl    = leftPaneEl.querySelector('#wlp-share');
    transcriptPanelEl= leftPaneEl.querySelector('#wlp-transcript');
    tickerTrackEl    = tickerEl.querySelector('#wf-tick-track');
    micBtn           = topbarEl.querySelector('#wf-mic');
    langSelect       = topbarEl.querySelector('#wf-lang');   // canonical language source
    dotEl            = tickerEl.querySelector('#wf-tick-dot');
    rightBodyEl      = rightPaneEl.querySelector('#wrp-body');
    rightFootEl      = rightPaneEl.querySelector('#wrp-foot');
    menuBtn          = rightPaneEl.querySelector('#wrp-menu-btn');
    menuPopoverEl    = rightPaneEl.querySelector('#wrp-menu');
    timerMirrorEl    = rightPaneEl.querySelector('#wrp-timer-text');

    // Restore saved language choice; keep BOTH visible selects + the hidden canonical
    // one in lockstep so the transcription language stays consistent everywhere.
    const leftLang  = leftPaneEl.querySelector('#wlp-lang');
    const menuLang  = rightPaneEl.querySelector('#wrp-lang');
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved) { if (langSelect) langSelect.value = saved; if (leftLang) leftLang.value = saved; if (menuLang) menuLang.value = saved; }
    } catch (_) {}
    const _syncLang = (val) => {
      if (langSelect) langSelect.value = val;
      if (leftLang) leftLang.value = val;
      if (menuLang) menuLang.value = val;
      try { localStorage.setItem(LANG_KEY, val); } catch (_) {}
      // Fire the canonical select's change so any existing listener still runs.
      try { if (langSelect) langSelect.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    };
    if (leftLang) leftLang.addEventListener('change', () => _syncLang(leftLang.value));
    if (menuLang) menuLang.addEventListener('change', () => _syncLang(menuLang.value));

    // LEFT control row: Start/Stop mic + Clear transcript.
    const listenBtn = leftPaneEl.querySelector('#wlp-listen');
    if (listenBtn) listenBtn.addEventListener('click', () => {
      if (typeof isListening !== 'undefined' && isListening) {
        try { stopAndCommitAudio(); } catch (_) {}
      } else {
        try { startListening(); } catch (_) {}
      }
      setTimeout(_syncListenState, 60);
    });
    const clearBtn2 = leftPaneEl.querySelector('#wlp-clear');
    if (clearBtn2) clearBtn2.addEventListener('click', () => _clearTranscript());

    // Share CTA + big-stage tools.
    const shareBtn = leftPaneEl.querySelector('#wlp-share-btn');
    if (shareBtn) shareBtn.addEventListener('click', () => { _startShare(true); });
    const fsBtn = leftPaneEl.querySelector('#wlp-fullscreen');
    if (fsBtn) fsBtn.addEventListener('click', () => _fullscreenPreview());
    const changeBtn = leftPaneEl.querySelector('#wlp-changetab');
    if (changeBtn) changeBtn.addEventListener('click', () => _changeTab());

    // RIGHT top bar: ⋮ menu + Exit.
    if (menuBtn) menuBtn.addEventListener('click', (e) => { e.stopPropagation(); _toggleMenu(); });
    const exitBtn = rightPaneEl.querySelector('#wrp-exit-btn');
    if (exitBtn) exitBtn.addEventListener('click', () => _openExitModal());

    // RIGHT bottom actions → proxy onto the canonical hidden buttons so the exact
    // proven flows (finalizeAndSend / handleScreenshotStage) run unchanged.
    const answerBtn = rightPaneEl.querySelector('#wrp-answer');
    if (answerBtn) answerBtn.addEventListener('click', () => { try { finalizeAndSend(); } catch (_) {} });
    const shotBtn = rightPaneEl.querySelector('#wrp-shot');
    if (shotBtn) shotBtn.addEventListener('click', () => { try { handleScreenshotStage(); } catch (_) {} });
    const clearMsgsBtn = rightPaneEl.querySelector('#wrp-clearmsgs');
    if (clearMsgsBtn) clearMsgsBtn.addEventListener('click', () => { try { handleClear(); } catch (_) {} });

    // ⋮ menu wiring.
    _wireMenu();

    // Click-away closes the ⋮ menu.
    document.addEventListener('click', (e) => {
      if (!menuPopoverEl || menuPopoverEl.hidden) return;
      if (menuPopoverEl.contains(e.target) || (menuBtn && menuBtn.contains(e.target))) return;
      _closeMenu();
    });

    built = true;
  }

  // ── Adopt / restore the shared #messages + .input-row into the right pane. ────
  // On enter() we MOVE (not clone) these live nodes into the right column so their
  // existing listeners/streaming keep working; on exit() we put them back exactly
  // where they were, leaving the non-live web view byte-for-byte unchanged.
  function _adoptRightPane() {
    if (!rightBodyEl || !rightFootEl) return;
    const msgs  = document.getElementById('messages');
    const input = document.querySelector('.input-row');
    if (msgs && msgs.parentNode !== rightBodyEl) {
      _msgsHome = msgs.parentNode; _msgsAnchor = msgs.nextSibling;
      rightBodyEl.appendChild(msgs);
    }
    if (input && input.parentNode !== rightFootEl) {
      _inputHome = input.parentNode; _inputAnchor = input.nextSibling;
      // Sit the composer just before the action buttons block.
      const actions = rightFootEl.querySelector('.wrp-foot-actions');
      rightFootEl.insertBefore(input, actions);
    }
  }
  function _restoreRightPane() {
    const msgs  = document.getElementById('messages');
    const input = document.querySelector('.input-row');
    if (msgs && _msgsHome) { try { _msgsHome.insertBefore(msgs, _msgsAnchor || null); } catch (_) {} }
    if (input && _inputHome) { try { _inputHome.insertBefore(input, _inputAnchor || null); } catch (_) {} }
    _msgsHome = _msgsAnchor = _inputHome = _inputAnchor = null;
  }

  // Clear ONLY the live transcript panel + ticker source (not the answers).
  function _clearTranscript() {
    try { if (typeof liveTranscript !== 'undefined' && Array.isArray(liveTranscript)) liveTranscript.length = 0; } catch (_) {}
    try { if (typeof _rtPartialText !== 'undefined') _rtPartialText = ''; } catch (_) {}
    try { _renderLiveTranscript(); } catch (_) {}
    mirrorTranscript();
  }

  // Fullscreen the shared-tab video.
  function _fullscreenPreview() {
    try {
      if (previewVideoEl && previewVideoEl.requestFullscreen) previewVideoEl.requestFullscreen();
      else if (previewVideoEl && previewVideoEl.webkitRequestFullscreen) previewVideoEl.webkitRequestFullscreen();
    } catch (_) {}
  }

  // Change Tab → stop the current live screen, then re-run the share picker so the
  // user can pick a different tab/window (reuses _startShare's full bind+listen flow).
  function _changeTab() {
    try { if (window.electronAPI && window.electronAPI.stopLiveScreen) window.electronAPI.stopLiveScreen(); } catch (_) {}
    _detachPreview();
    // Give the previous stream a beat to release, then re-open the picker.
    setTimeout(() => { _startShare(true); }, 120);
  }

  // ── ⋮ session menu ──────────────────────────────────────────────────────────
  function _toggleMenu() {
    if (!menuPopoverEl) return;
    if (menuPopoverEl.hidden) _openMenu(); else _closeMenu();
  }
  function _openMenu() {
    if (!menuPopoverEl) return;
    menuPopoverEl.hidden = false;
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
  }
  function _closeMenu() {
    if (!menuPopoverEl) return;
    menuPopoverEl.hidden = true;
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
  }
  function _wireMenu() {
    if (!menuPopoverEl) return;
    // Answer text size (S/M/L) → set a class on <body> the CSS reads.
    const sizeSeg = menuPopoverEl.querySelector('#wrp-size');
    if (sizeSeg) sizeSeg.addEventListener('click', (e) => {
      const b = e.target.closest('.wrp-seg-btn'); if (!b) return;
      sizeSeg.querySelectorAll('.wrp-seg-btn').forEach(x => x.classList.remove('is-on'));
      b.classList.add('is-on');
      document.body.classList.remove('wrp-size-s', 'wrp-size-m', 'wrp-size-l');
      document.body.classList.add('wrp-size-' + (b.getAttribute('data-size') || 'm'));
    });
    // Theme (Forest / Deep) → toggle a body class the CSS reads (both green tones).
    const themeSeg = menuPopoverEl.querySelector('#wrp-theme');
    if (themeSeg) themeSeg.addEventListener('click', (e) => {
      const b = e.target.closest('.wrp-seg-btn'); if (!b) return;
      themeSeg.querySelectorAll('.wrp-seg-btn').forEach(x => x.classList.remove('is-on'));
      b.classList.add('is-on');
      document.body.classList.toggle('wrp-theme-deep', b.getAttribute('data-theme') === 'deep');
    });
    // Auto Answer → drive the EXISTING manual/auto mode (isAutoMode) via its checkbox
    // so the real auto-answer behavior + routines toggle exactly as they do desktop.
    const autoSwitch = menuPopoverEl.querySelector('#wrp-auto');
    if (autoSwitch) {
      const _reflect = () => {
        const on = (typeof isAutoMode !== 'undefined' && isAutoMode);
        autoSwitch.classList.toggle('is-on', on);
        autoSwitch.setAttribute('aria-checked', on ? 'true' : 'false');
      };
      autoSwitch.addEventListener('click', () => {
        const cb = document.getElementById('mode-toggle-checkbox');
        if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); }
        setTimeout(_reflect, 30);
      });
      _reflect();
      window._whisSessionReflectAuto = _reflect;
    }
    // Edit session → dashboard's edit flow (best-effort); keep the session alive.
    const editBtn = menuPopoverEl.querySelector('#wrp-edit');
    if (editBtn) editBtn.addEventListener('click', () => {
      _closeMenu();
      try { whisToast('Edit session details from your dashboard.', 'info', 4000); } catch (_) {}
    });
  }

  // ── Exit modal: Leave (keep session) vs End (finalize) ───────────────────────
  function _openExitModal() {
    _closeMenu();
    if (!exitModalEl) {
      exitModalEl = document.createElement('div');
      exitModalEl.id = 'wf-exit-modal';
      exitModalEl.className = 'wf-exit-modal no-drag';
      exitModalEl.innerHTML = `
        <div class="wf-exit-overlay" data-exit-dismiss></div>
        <div class="wf-exit-card" role="dialog" aria-modal="true" aria-labelledby="wf-exit-title">
          <button type="button" class="wf-exit-x" data-exit-dismiss aria-label="Stay in session">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
          <h2 class="wf-exit-title" id="wf-exit-title">Leave or End Session?</h2>
          <div class="wf-exit-choices">
            <button type="button" class="wf-exit-choice" id="wf-exit-leave">
              <span class="wf-exit-choice-head"><i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i> Leave for now</span>
              <span class="wf-exit-choice-sub">Return to the dashboard. Your session stays available and you can rejoin.</span>
            </button>
            <button type="button" class="wf-exit-choice wf-exit-choice--danger" id="wf-exit-end">
              <span class="wf-exit-choice-head"><i class="fa-solid fa-circle-stop" aria-hidden="true"></i> End Session</span>
              <span class="wf-exit-choice-sub">Wrap up and save this session's transcript. This can't be undone.</span>
            </button>
          </div>
        </div>`;
      document.body.appendChild(exitModalEl);
      // Dismiss (X / overlay) → stay in session.
      exitModalEl.querySelectorAll('[data-exit-dismiss]').forEach(el =>
        el.addEventListener('click', () => _closeExitModal()));
      exitModalEl.querySelector('#wf-exit-leave').addEventListener('click', () => _leaveForNow());
      exitModalEl.querySelector('#wf-exit-end').addEventListener('click', () => _endSession());
    }
    exitModalEl.classList.add('wf-exit-open');
  }
  function _closeExitModal() {
    if (exitModalEl) exitModalEl.classList.remove('wf-exit-open');
  }
  // Leave for now → do NOT end/finalize; just navigate to the dashboard.
  function _leaveForNow() {
    _closeExitModal();
    try { window.location.href = '/dashboard3.html'; } catch (_) { window.location.href = 'dashboard3.html'; }
  }
  // End Session → finalize transcript + tear down the live view.
  function _endSession() {
    _closeExitModal();
    try { if (typeof WhisTranscriptSync !== 'undefined') WhisTranscriptSync.end(true); } catch (_) {}
    exit();
  }

  // Show the temporary recent-transcript overlay (last ~6 lines). Auto-collapses
  // after a few seconds unless `sticky` (expand affordance → longer dwell).
  function _showOverlay(sticky) {
    if (!overlayEl) return;
    const segs = (typeof liveTranscript !== 'undefined' && Array.isArray(liveTranscript)) ? liveTranscript : [];
    const partial = (typeof _rtPartialText === 'string' && !isAutoMode) ? _rtPartialText.trim() : '';
    const inner = overlayEl.querySelector('#wf-overlay-inner');

    if (segs.length === 0 && !partial) {
      inner.innerHTML = `<div class="wf-ov-empty">${
        (typeof isListening !== 'undefined' && isListening) ? 'Listening… nothing transcribed yet.' : 'Not listening yet, press Start.'
      }</div>`;
    } else {
      const recent = segs.slice(-6);
      let html = recent.map(seg => {
        const isInt = seg.role === 'interviewer';
        return `<div class="wf-ov-line ${isInt ? 'wf-ov-int' : 'wf-ov-you'}">
                  <span class="wf-ov-role">${isInt ? 'Interviewer' : 'You'}</span>
                  <span class="wf-ov-text">${escapeHTML(seg.text)}</span>
                </div>`;
      }).join('');
      if (partial) {
        html += `<div class="wf-ov-line wf-ov-int wf-ov-partial">
                   <span class="wf-ov-role">Interviewer</span>
                   <span class="wf-ov-text">${escapeHTML(partial)}<span class="wf-ov-caret"></span></span>
                 </div>`;
      }
      inner.innerHTML = html;
    }

    overlayEl.classList.add('wf-overlay-open');
    inner.scrollTop = inner.scrollHeight;
    if (overlayTimer) { clearTimeout(overlayTimer); overlayTimer = null; }
    overlayTimer = setTimeout(_hideOverlay, sticky ? 6000 : 3200);
  }

  function _hideOverlay() {
    if (overlayTimer) { clearTimeout(overlayTimer); overlayTimer = null; }
    if (overlayEl) overlayEl.classList.remove('wf-overlay-open');
  }

  // Render the diarized live transcript into the readable LEFT-pane panel (and keep
  // the hidden ticker's data source consistent). Auto-scrolls to the newest line.
  // Called from _renderLiveTranscript() so it stays in lockstep with the source.
  function mirrorTranscript() {
    if (!active) return;
    const listening = (typeof isListening !== 'undefined' && isListening);

    if (transcriptPanelEl) {
      const segs = (typeof liveTranscript !== 'undefined' && Array.isArray(liveTranscript)) ? liveTranscript : [];
      const partial = (typeof _rtPartialText === 'string' && !isAutoMode) ? _rtPartialText.trim() : '';
      if (segs.length === 0 && !partial) {
        transcriptPanelEl.innerHTML = `<div class="wlp-tx-idle">${
          listening ? 'Listening…' : 'Press Start to hear the interviewer and you.'
        }</div>`;
      } else {
        let html = segs.map(seg => {
          const isInt = seg.role === 'interviewer';
          return `<div class="wlp-tx-line ${isInt ? 'wlp-tx-int' : 'wlp-tx-you'}">
                    <span class="wlp-tx-role">${isInt ? 'Interviewer' : 'You'}</span>
                    <span class="wlp-tx-text">${escapeHTML(seg.text)}</span>
                  </div>`;
        }).join('');
        if (partial) {
          html += `<div class="wlp-tx-line wlp-tx-int wlp-tx-partial">
                     <span class="wlp-tx-role">Interviewer</span>
                     <span class="wlp-tx-text">${escapeHTML(partial)}<span class="wlp-tx-caret"></span></span>
                   </div>`;
        }
        transcriptPanelEl.innerHTML = html;
      }
      transcriptPanelEl.scrollTop = transcriptPanelEl.scrollHeight;
    }

    // Keep the hidden ticker's raw string in sync (harmless, cheap; kept for parity).
    if (tickerTrackEl) tickerTrackEl.textContent = _tickerString();
  }

  // Keep the mic button + listening dot/badge in sync with isListening.
  function _syncListenState() {
    const listening = (typeof isListening !== 'undefined' && isListening);
    if (micBtn) {
      micBtn.classList.toggle('wf-on', listening);
      const icon = listening ? 'fa-stop' : 'fa-microphone';
      const label = listening ? 'Stop' : 'Start';
      micBtn.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><span class="wf-btn-label">${label}</span>`;
    }
    // New LEFT-pane Start/Stop toggle (mic icon + red recording dot when listening).
    const listenBtn = leftPaneEl && leftPaneEl.querySelector('#wlp-listen');
    if (listenBtn) {
      listenBtn.classList.toggle('is-listening', listening);
      const icon = listening ? 'fa-stop' : 'fa-microphone';
      const label = listening ? 'Stop' : 'Start';
      listenBtn.innerHTML = `<span class="wlp-rec-dot" aria-hidden="true"></span><i class="fa-solid ${icon}" aria-hidden="true"></i><span class="wlp-ctl-label">${label}</span>`;
    }
    if (dotEl) dotEl.classList.toggle('wf-tick-live', listening);
    const live = document.getElementById('wf-live');
    if (live) {
      live.classList.toggle('wf-live-on', listening);
      const t = live.querySelector('.wf-live-text');
      if (t) t.textContent = listening ? 'Listening' : 'Idle';
    }
    // Reflect the ⋮ Auto Answer switch (mode may have changed elsewhere).
    try { window._whisSessionReflectAuto && window._whisSessionReflectAuto(); } catch (_) {}
    mirrorTranscript();
  }
  // Exposed so other listening-state changes (startListening/stop) can refresh us.
  window._whisSessionSync = _syncListenState;

  // Bind the persistent shared stream's VIDEO to the 25% preview <video> so the
  // user can monitor exactly what they're sharing. Muted (no echo) + playsinline.
  function _attachPreview() {
    try {
      if (!previewVideoEl || !(window.electronAPI && window.electronAPI.getLiveStream)) return;
      const s = window.electronAPI.getLiveStream();
      if (!s) return;
      previewVideoEl.srcObject = s;
      previewVideoEl.muted = true;      // never echo the interviewer through the preview
      previewVideoEl.play().catch(() => {});
      if (sharePromptEl) sharePromptEl.style.display = 'none';
      previewEl && previewEl.classList.add('wlp-sharing');
    } catch (_) {}
  }

  function _detachPreview() {
    try {
      if (previewVideoEl) { previewVideoEl.pause(); previewVideoEl.srcObject = null; }
    } catch (_) {}
    if (sharePromptEl) sharePromptEl.style.display = '';
    if (previewHintEl) { previewHintEl.style.display = 'none'; previewHintEl.textContent = ''; }
    previewEl && previewEl.classList.remove('wlp-sharing');
  }

  // Show/clear the inline "re-share with audio" hint in the preview column.
  function _showPreviewHint(html) {
    if (!previewHintEl) return;
    if (!html) { previewHintEl.style.display = 'none'; previewHintEl.innerHTML = ''; return; }
    previewHintEl.innerHTML = html;
    previewHintEl.style.display = 'block';
  }

  // Share the interview tab/window ONCE (persistent stream, video + audio). Must run
  // inside a user gesture (both getDisplayMedia and the picker require it). Then bind
  // the preview and start listening (which reuses the shared audio as PRIMARY). If the
  // share carries no audio, hint to re-share with audio and fall back to the mic so the
  // user is never stuck.
  async function _startShare(fromGesture) {
    if (!(window.electronAPI && window.electronAPI.startLiveScreen)) {
      // No screen-capture on this device (mobile) → mic-only fallback.
      try { startListening(); } catch (_) {}
      return;
    }
    // Already sharing → just make sure preview + listening are wired.
    if (window.electronAPI.hasLiveScreen && window.electronAPI.hasLiveScreen()) {
      _attachPreview();
      if (!(typeof isListening !== 'undefined' && isListening)) { try { startListening(); } catch (_) {} }
      setTimeout(_syncListenState, 120);
      return;
    }

    let res;
    try {
      res = await window.electronAPI.startLiveScreen(true);
    } catch (e) {
      res = { error: e && e.message };
    }

    if (!res || res.error) {
      // User cancelled the picker → keep the pre-share CTA and let them retry (or type).
      _detachPreview();
      try { whisToast('Screen share cancelled. Click <strong>Share tab / window</strong> to capture the interviewer, or just type your question.', 'warning', 6000); } catch (_) {}
      return;
    }

    _attachPreview();

    // No audio in the share → hint to re-share with audio, and fall back to the mic so
    // Listen still works (never stuck).
    const hasAudio = !!res.hasAudio ||
      (window.electronAPI.liveHasAudio && window.electronAPI.liveHasAudio());
    if (!hasAudio) {
      window._whisUseMic = true; // route startListening to the mic fallback
      _showPreviewHint('No tab audio detected. For the cleanest interviewer capture, click <strong>Share tab / window</strong> again and tick <strong>“Share tab audio.”</strong> Using your mic for now.');
      try { whisToast('No tab audio in that share. Re-share and tick <strong>“Share tab audio”</strong> for the cleanest capture, using your mic for now.', 'info', 8000); } catch (_) {}
    } else {
      window._whisUseMic = false;   // prefer the clean shared audio
      window._whisTabAudio = true;  // reflect the honest "listening, interviewer's tab" label
      _showPreviewHint('');
    }

    // Begin listening, startListening() reuses the shared audio track as PRIMARY.
    if (!(typeof isListening !== 'undefined' && isListening)) {
      try { startListening(); } catch (_) {}
    }
    setTimeout(_syncListenState, 120);
  }

  // The browser "Stop sharing" fired while the 75/25 view is open → drop the preview,
  // stop listening, and reset back to the pre-share CTA (session stays open).
  function _onShareEnded() {
    if (!active) return;
    _detachPreview();
    try { if (typeof isListening !== 'undefined' && isListening) stopAndCommitAudio(true); } catch (_) {}
    setTimeout(_syncListenState, 60);
    try { whisToast('Screen sharing stopped. Click <strong>Share tab / window</strong> to resume live capture.', 'info', 6000); } catch (_) {}
  }
  window._whisSessionOnShareEnded = _onShareEnded;
  // Exposed so Snap (handleScreenshotStage) can trigger the share via the session's
  // flow (which also binds the preview + audio) instead of a bare getDisplayMedia call.
  window._whisSessionStartShare = () => _startShare(true);

  function enter() {
    _build();
    if (!built) return;
    active = true;
    document.body.classList.add('whis-session-active');
    if (!document.body.classList.contains('wrp-size-m')) document.body.classList.add('wrp-size-m');

    // Move the shared answers list + composer into the RIGHT pane, and start the
    // session-timer mirror in the right-pane top row.
    _adoptRightPane();
    _startTimerMirror();

    mirrorTranscript();
    _syncListenState();

    // WEB (ParakeetAI-style): the PRIMARY input is the shared tab/window. On desktop
    // web, prompt the share right away (inside the enter() click gesture) so audio +
    // video + Snap all come from one share. If the user cancels, the preview column
    // keeps a "Share tab / window" CTA so they can start whenever they're ready.
    const canShare = !IS_MOBILE_WEB && window.electronAPI && window.electronAPI.startLiveScreen;
    if (canShare) {
      if (window.electronAPI.hasLiveScreen && window.electronAPI.hasLiveScreen()) {
        // Reuse an already-live share (e.g. from Go Live / Snap).
        _attachPreview();
        if (!(typeof isListening !== 'undefined' && isListening)) { try { startListening(); } catch (_) {} }
      } else {
        _startShare(true);
      }
    } else {
      // Mobile / no screen-capture: mic-first, no preview column.
      if (!(typeof isListening !== 'undefined' && isListening)) {
        try { startListening(); } catch (_) {}
      }
    }
    setTimeout(_syncListenState, 120);
    try { _trackFunnel && _trackFunnel('web_session_enter'); } catch (_) {}
  }

  function exit() {
    active = false;
    _hideOverlay();
    _closeMenu();
    _closeExitModal();
    _stopTimerMirror();
    // Stop capture cleanly (silent, no toast spam).
    try { if (typeof isListening !== 'undefined' && isListening) stopAndCommitAudio(true); } catch (_) {}

    // Tear down the persistent shared screen + preview (the session is ending).
    _detachPreview();
    try { if (window.electronAPI && window.electronAPI.stopLiveScreen) window.electronAPI.stopLiveScreen(); } catch (_) {}

    // WEB: persist the end of this live session to the dashboard (flushes any
    // buffered transcript, then POSTs /end with durationSec). Best-effort.
    // (End Session already called WhisTranscriptSync.end(true); this is idempotent.)
    try { if (typeof WhisTranscriptSync !== 'undefined') WhisTranscriptSync.end(false); } catch (_) {}

    // Return the shared answers + composer to their original home before dropping
    // the split class, so the non-live web view is byte-for-byte unchanged.
    _restoreRightPane();
    document.body.classList.remove('whis-session-active');
    // Back to the normal welcome / empty state.
    try { renderMessages(); } catch (_) {}
    try { _trackFunnel && _trackFunnel('web_session_exit'); } catch (_) {}
  }

  // Mirror the header/interview timer into the right-pane top row. Reuses the same
  // #interview-timer-display value when present; else derives from the trial timer.
  function _startTimerMirror() {
    _stopTimerMirror();
    const tick = () => {
      if (!active) return;
      if (timerMirrorEl) {
        let txt = null;
        const iv = document.getElementById('interview-timer-display');
        if (iv && iv.textContent && iv.textContent !== '00:00') txt = iv.textContent;
        if (!txt) {
          const tt = document.getElementById('trial-timer-text');
          if (tt && tt.textContent) txt = tt.textContent;
        }
        timerMirrorEl.textContent = txt || '00:00';
      }
      timerMirrorRaf = setTimeout(tick, 500);
    };
    tick();
  }
  function _stopTimerMirror() {
    if (timerMirrorRaf) { clearTimeout(timerMirrorRaf); timerMirrorRaf = null; }
  }

  function isActive() { return active; }

  function init() {
    // Wire any existing "Start Live Session" entry points. The welcome renders its CTA
    // dynamically, so we also delegate clicks at the document level (below).
    document.addEventListener('click', (e) => {
      const t = e.target && e.target.closest ? e.target.closest('.web-session-enter') : null;
      if (t) { e.preventDefault(); enter(); }
    });
    // React to the browser "Stop sharing" while the 75/25 view is open (in addition to
    // WhisLive's PiP handler, the shim supports multiple onLiveScreenEnded callbacks).
    try {
      if (window.electronAPI && window.electronAPI.onLiveScreenEnded) {
        window.electronAPI.onLiveScreenEnded(() => { if (active) _onShareEnded(); });
      }
    } catch (_) {}
  }

  return { init, enter, exit, isActive, mirrorTranscript };
})();

// ============================================================================
// WEB: LIVE SESSION → DASHBOARD TRANSCRIPT PERSISTENCE  (WhisTranscriptSync)
// ============================================================================
// Makes the dashboard's "View transcript" real for the LIVE web app. The backend
// already exposes the session contract (POST /api/sessions, .../transcript,
// .../end; GET /api/sessions/:id) and Mock Interview already uses it, the live
// app did not. This module wires it in, entirely web-gated (window.WHIS_WEB) and
// only for real signed-in users (googleId), so the desktop build and mock's own
// saving are untouched.
//
// Flow:
//   • Session id: read ?sessionId=… from the URL (the dashboard passes it). If
//     absent, create one lazily the first time the user starts listening OR a
//     transcript segment is produced, POST /api/sessions {mode:'interview'}, //     exactly once per page session, and reflect it back into the URL.
//   • Append: _appendTranscript() calls noteSegment(role,text). Segments are
//     buffered and flushed (debounced ~5s, or immediately once ≥8 are queued)
//     to /api/sessions/:id/transcript {entries:[{ts,speaker,text}]}. speaker is
//     'interviewer' | 'you' (role 'user' → 'you'). Fire-and-forget, try/catch,
//     never blocks the UI.
//   • End: on Exit / stop / pagehide, flush what's buffered and POST
//     /api/sessions/:id/end {durationSec}. On pagehide we use navigator.sendBeacon
//     so it survives the tab closing.
const WhisTranscriptSync = (() => {
  if (!window.WHIS_WEB) {
    return { init(){}, ensureSession(){}, noteSegment(){}, flush(){}, end(){} };
  }

  let sessionId = null;          // resolved session id (URL or lazily created)
  let creating = null;           // in-flight create promise (dedupe)
  let createTried = false;       // guard: only ever attempt create once per page
  let startedAt = 0;             // ms epoch of first activity (for durationSec)
  let ended = false;             // guard: only end once
  let buffer = [];               // queued {ts,speaker,text} awaiting flush
  let flushTimer = null;
  const FLUSH_MS = 5000;         // debounce window
  const FLUSH_AT = 8;            // hard flush once this many segments queued

  function _googleId() {
    try {
      if (currentUser) return currentUser.googleId || currentUser.id || null;
    } catch (_) {}
    return null;
  }

  function _headers() {
    const h = { 'Content-Type': 'application/json' };
    const gid = _googleId();
    if (gid) h['x-google-id'] = gid;
    if (typeof APP_AUTH_TOKEN === 'string' && APP_AUTH_TOKEN) h['x-whis-auth'] = APP_AUTH_TOKEN;
    return h;
  }

  // Read a pre-provisioned session id from the URL (dashboard → "resume/view").
  function _sessionIdFromUrl() {
    try {
      const q = new URLSearchParams(window.location.search || '');
      const v = (q.get('sessionId') || '').trim();
      return v || null;
    } catch (_) { return null; }
  }

  // Reflect the resolved session id back into the URL (no reload) so a refresh
  // keeps appending to the same session instead of orphaning it.
  function _reflectUrl(id) {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('sessionId') === id) return;
      url.searchParams.set('sessionId', id);
      window.history.replaceState(null, '', url.toString());
    } catch (_) {}
  }

  // Ensure we have a session id: prefer the URL, else create once. Returns a
  // promise resolving to the id (or null if we can't, not signed in / failed).
  function ensureSession() {
    if (sessionId) return Promise.resolve(sessionId);
    if (!_googleId()) return Promise.resolve(null); // real signed-in users only
    const fromUrl = _sessionIdFromUrl();
    if (fromUrl) {
      sessionId = fromUrl;
      if (!startedAt) startedAt = Date.now();
      return Promise.resolve(sessionId);
    }
    if (creating) return creating;
    if (createTried) return Promise.resolve(null);
    createTried = true;
    if (!startedAt) startedAt = Date.now();
    creating = (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/sessions`, {
          method: 'POST', headers: _headers(),
          body: JSON.stringify({ mode: 'interview', company: '', role: '' })
        });
        if (!r.ok) throw new Error('create ' + r.status);
        const d = await r.json();
        const id = d.sessionId || d.id || '';
        if (!id) throw new Error('no session id');
        sessionId = id;
        _reflectUrl(id);
        return id;
      } catch (e) {
        try { console.debug('[whis] session create failed', e); } catch (_) {}
        return null;
      } finally {
        creating = null;
      }
    })();
    return creating;
  }

  // Called from _appendTranscript() for every finalized segment. Buffers + schedules
  // a flush. Never throws, never blocks.
  function noteSegment(role, text) {
    try {
      if (!_googleId()) return;                 // signed-in web users only
      const clean = (text || '').trim();
      if (!clean) return;
      if (!startedAt) startedAt = Date.now();
      const speaker = (role === 'user') ? 'you' : 'interviewer';
      buffer.push({ ts: Date.now() - startedAt, speaker, text: clean });
      // Kick off session creation early so the id is ready by first flush.
      ensureSession();
      if (buffer.length >= FLUSH_AT) { flush(); return; }
      if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS);
    } catch (_) {}
  }

  // Flush the buffered entries to the transcript endpoint. Fire-and-forget.
  async function flush() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (!buffer.length) return;
    try {
      const id = await ensureSession();
      if (!id) return;                          // no session → keep buffer for later
      const entries = buffer;
      buffer = [];
      const r = await fetch(`${BACKEND_URL}/api/sessions/${encodeURIComponent(id)}/transcript`, {
        method: 'POST', headers: _headers(), body: JSON.stringify({ entries })
      });
      if (!r.ok) { buffer = entries.concat(buffer); } // re-queue on failure
    } catch (e) {
      try { console.debug('[whis] transcript flush failed', e); } catch (_) {}
    }
  }

  // End the session. `viaBeacon` uses sendBeacon (tab-close safe) and cannot set
  // custom headers, so the id is enough there (best-effort). Only ends once.
  function end(viaBeacon) {
    try {
      if (ended) return;
      if (!sessionId) return;                   // nothing was ever created
      ended = true;
      const durationSec = Math.max(0, Math.round((Date.now() - (startedAt || Date.now())) / 1000));
      const url = `${BACKEND_URL}/api/sessions/${encodeURIComponent(sessionId)}/end`;
      // Best-effort: push any buffered lines first (non-beacon path awaits nothing).
      const pending = buffer.slice();
      buffer = [];
      if (viaBeacon && navigator.sendBeacon) {
        try {
          if (pending.length) {
            navigator.sendBeacon(
              `${BACKEND_URL}/api/sessions/${encodeURIComponent(sessionId)}/transcript`,
              new Blob([JSON.stringify({ entries: pending })], { type: 'application/json' })
            );
          }
          navigator.sendBeacon(url, new Blob([JSON.stringify({ durationSec })], { type: 'application/json' }));
        } catch (_) {}
        return;
      }
      // Normal path: flush buffered lines, then end.
      (async () => {
        try {
          if (pending.length) {
            await fetch(`${BACKEND_URL}/api/sessions/${encodeURIComponent(sessionId)}/transcript`, {
              method: 'POST', headers: _headers(), body: JSON.stringify({ entries: pending })
            });
          }
          await fetch(url, { method: 'POST', headers: _headers(), body: JSON.stringify({ durationSec }) });
        } catch (e) {
          try { console.debug('[whis] session end failed', e); } catch (_) {}
        }
      })();
    } catch (_) {}
  }

  function init() {
    // If the dashboard handed us a session id, adopt it immediately.
    const fromUrl = _sessionIdFromUrl();
    if (fromUrl && _googleId()) { sessionId = fromUrl; startedAt = Date.now(); }
    // Tab close / navigate away → best-effort end via beacon.
    window.addEventListener('pagehide', () => { try { end(true); } catch (_) {} });
    document.addEventListener('visibilitychange', () => {
      // On hide, flush what we have so an idle-but-open tab still persists progress.
      if (document.visibilityState === 'hidden') { try { flush(); } catch (_) {} }
    });
  }

  return { init, ensureSession, noteSegment, flush, end };
})();

// START APP
(async () => {
    await loadEnvVariables();
    _startConnectionMonitor();
    updateShortcutsUI();
    checkAuth();
    _tryRestoreSession();
    renderMessages();
    const _savedDraft = localStorage.getItem('wh_draft');
    if (_savedDraft) { inputEl.value = _savedDraft; updateContextHint(); }
    try { if (window.WHIS_WEB) WhisLive.init(); } catch (_) {}
    try { if (window.WHIS_WEB) WhisSession.init(); } catch (_) {}
    try { if (window.WHIS_WEB) WhisTranscriptSync.init(); } catch (_) {}
})();
