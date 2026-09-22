# Whis-AI Brand Kit — single source of truth (derived from the LIVE index.html)

Every new/updated page MUST look like the *next version of the existing whis-ai.com site* —
NOT a different design. Pull the look from the live `index.html`. Never use `owl_logo.jpeg`,
never any owl/tiger/animal face. Use the canonical W-peaks logo below everywhere.

## Canonical logo (copy VERBATIM — this is the real site logo)
```html
<a href="/" class="whis-brand" style="display:flex;align-items:center;gap:10px;text-decoration:none;">
  <div style="position:relative;height:38px;width:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:linear-gradient(145deg,#0a1628 0%,#0d1f3c 100%);border:1px solid rgba(14,165,233,0.4);box-shadow:0 0 14px rgba(14,165,233,0.25),0 4px 18px rgba(0,0,0,0.45);">
    <svg width="22" height="18" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 9 L7.5 2 L10 9" fill="rgba(14,165,233,0.22)"/>
      <path d="M14 9 L16.5 2 L19 9" fill="rgba(14,165,233,0.22)"/>
      <path d="M2 5 L6 17 L12 9 L18 17 L22 5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="8.5" cy="12" r="1.8" fill="#38bdf8"/>
      <circle cx="15.5" cy="12" r="1.8" fill="#38bdf8"/>
    </svg>
  </div>
  <span style="font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:19px;letter-spacing:-0.3px;color:#fff;">Whis<span style="color:#38bdf8;">-AI</span></span>
</a>
```
Favicon / OG image: use this W mark (a small SVG/PNG of it), NOT owl_logo.jpeg.

## Colors (existing site)
- Base background: deep navy `#010c1a` / `#0a1628`, with glows — sky `rgba(14,165,233,0.14)` + violet `rgba(139,92,246,0.12)` radial/linear behind the hero (the blue→purple gradient feel).
- Primary accent: sky-blue `#0ea5e9` / `#38bdf8`.
- Brand gradient (buttons, highlights, the "real-time" word): `linear-gradient(135deg,#0ea5e9 0%,#22d3ee 28%,#10b981 58%,#8b5cf6 100%)`.
- Support: cyan `#22d3ee`, emerald `#10b981`, violet `#8b5cf6`, darker blue `#0284c7`.
- Cards/surfaces: translucent navy `rgba(10,22,40,0.6)` with `1px solid rgba(14,165,233,0.16)`, rounded-xl, soft shadow + subtle glow.
- Text: `#eaf2ff` primary, `#93a7cc` muted.

## Type
`Inter` (body), `Plus Jakarta Sans` (headings/wordmark), `JetBrains Mono` (code). Google Fonts:
`https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap`

## Components
Pill badges (rounded-full, translucent, 1px sky border), rounded-xl cards with glow on hover,
gradient primary buttons, generous spacing. Match the existing hero (headline + cyan-highlighted
keywords, product screenshot with glow). It must feel premium and consistent across every page.

## Real platform brand colors + logos (use REAL colors/logos, not generic gray)
When showing Zoom/Teams/Meet/etc., use each brand's real color + real logo (prefer inline brand SVGs;
Font Awesome brand icons where they exist, else a small inline SVG). Colors:
- Zoom `#2D8CFF` · Microsoft Teams `#6264A7` · Google Meet `#00832D` (multicolor: `#00AC47/#2684FC/#FFBA00/#EA4335`)
- Webex `#00BCEB` (dark `#005A6A`) · Amazon Chime `#1CD1A1` · Cisco Webex green `#2CBE4E`
- CoderPad `#00A2FF` · HackerRank `#00EA64` (dark `#2EC866`) · LeetCode `#FFA116`
Each platform card: real logo + real color accent + name + a green "Verified" check (honest framing:
these are for the DESKTOP invisible app; web = practice).

## Hard rules
1. NO `owl_logo.jpeg`, NO owl/tiger/animal face anywhere. Use the W-peaks logo above.
2. Every page: the SAME header (logo + nav) and the SAME footer, so the site feels unified.
3. It's the NEXT VERSION of the existing site — inspired + improved, same brand DNA. Not a new look.
4. Dark navy→purple gradient base (not flat black `#070a14`). Sky-blue accent (`#0ea5e9`), not `#29b6f6`.
