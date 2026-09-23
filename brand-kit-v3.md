# Whis-AI "Editorial" Design System (v3) — derived from index3.html

The premium, warm, editorial look. EVERY new v3 surface derives from this. Existing files
are NOT touched — v3 lives in NEW files only. Elegant, premium, seamless, clean.

## Fonts
- **Fraunces** (serif) — display/headlines, use italics for emphasis (opsz + ital available).
- **Inter** — body/UI. **JetBrains Mono** — code.
Google Fonts: `https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap`

## Palette
Light / cream (marketing + dashboard):
- `--cream:#faf6e9` `--cream-2:#f3eeda` (bg surfaces)
- `--ink:#1a1712` (text) `--ink-soft:#5b554a` (muted)
- `--line:rgba(26,23,18,.14)` (hairline borders)
Dark / forest-green (the app + "ghost mode" sections):
- `--green:#12432f` `--green-2:#0e3524` (bg) `--green-ink:#eaf3ec` (text on green)
Accents (both modes):
- `--lav:#d9c7f7` `--lav-deep:#c3a9ef` (PRIMARY accent, buttons/highlights)
- `--gold:#c98a1a` (secondary), `--terra:#e08a4a`, `--maroon:#7a1f2b` (sparingly)
- green accent `#0a7f4f`

## Components (match index3)
- **Nav:** a rounded "pill" bar (cream, hairline border) with the W logo, an Interview/Meetings toggle, links, and a dark "Get App Free" pill.
- **Buttons:** primary = lavender pill (`--lav-deep` bg, ink text), rounded-full, generous padding; secondary = text link with arrow.
- **Headlines:** large **Fraunces** serif, mixed roman + italic (e.g. "Nail the interview. *Name your salary.*").
- **Cards:** cream with hairline border + very soft shadow; on dark, translucent green.
- **Storytelling sections** alternate cream ↔ forest-green (like index3's "interviewer sees nothing" side-by-side).
- **Logo:** the canonical W-peaks mark (from brand-kit.md) in a tile — on cream use a dark/green tile; on green use the navy/green tile. Wordmark "Whis-AI" in Fraunces or Inter-800. NO owl/tiger, ever.

## Surface tones
- **index3.html** (homepage): cream + green sections. Already built — the reference.
- **Dashboard v3 (new file, e.g. dashboard3.html):** CREAM / light editorial — premium, spacious, Fraunces section titles, lavender primary actions, hairline cards. Same IA as the current dashboard (Sessions, Resumes, Mock Interview) but in this look.
- **App v3 (new folder, e.g. /app3/):** DARK forest-green editorial — `--green` base, `--green-ink` text, lavender accents, Fraunces for the few display bits; keeps the 90%-output focus layout + transcript ticker. Discreet + elegant for live use. Reuse the existing app logic (copy renderer.js/whis-web-api.js verbatim); only the CSS + index.html chrome change.

## Hard rules
1. New files ONLY. Do NOT modify existing index.html, /app/, dashboard.html, etc.
2. Everything must feel like ONE brand: index3 (cream) → dashboard3 (cream) → app3 (green) all clearly the same editorial family (Fraunces + lavender + cream/green).
3. Premium, elegant, seamless, clean. Serif restraint (display only), generous whitespace, hairline borders, no gradient/glow/emoji soup.
4. Reuse index3's exact tokens above so it's pixel-consistent.
