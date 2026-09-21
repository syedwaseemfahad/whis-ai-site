// Whis-AI interview-guide generator (rich template).
// Data source: guides.json (48 companies with deep per-round content). Amazon SDE-2 is a
// separate bespoke page. Run: node gen-guides.mjs  -> writes pages + hub + sitemap.
import fs from 'fs';
import path from 'path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, 'interview-guides');
const ACCENT = '#0ea5e9';
const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const li  = a => (Array.isArray(a)?a:[]).map(x=>`<li>${esc(x)}</li>`).join('');

const COMPANIES = JSON.parse(fs.readFileSync(path.join(ROOT,'guides.json'),'utf8'));
// Full pool for cross-linking (bespoke Amazon + generated set).
const POOL = [{slug:'amazon-sde-2',name:'Amazon SDE-2',mark:'a',color:'#ff9900'}, ...COMPANIES.map(c=>({slug:c.slug,name:c.name,mark:c.mark,color:c.color}))];

function roundCard(r,i){
  const themes  = r.themes  && r.themes.length  ? `<div class="mt-3"><div class="rc-h">Example questions</div><ul class="rc-list">${li(r.themes)}</ul></div>`:'';
  const prepare = r.prepare && r.prepare.length ? `<div class="mt-3"><div class="rc-h">How to prepare</div><ul class="rc-list">${li(r.prepare)}</ul></div>`:'';
  const mist    = r.mistakes&& r.mistakes.length? `<div class="mt-3"><div class="rc-h rc-warn">Common mistakes</div><ul class="rc-list">${li(r.mistakes)}</ul></div>`:'';
  const sig     = r.signals && r.signals.length ? `<div class="mt-3"><div class="rc-h rc-good">What they look for</div><ul class="rc-list">${li(r.signals)}</ul></div>`:'';
  const expect  = r.expect ? `<p class="mt-2 text-slate-300 text-[15px] leading-relaxed">${esc(r.expect)}</p>`:'';
  return `<div class="glass rounded-2xl p-6 md:p-7 mb-4">
    <div class="flex items-start gap-3">
      <span class="w-8 h-8 rounded-lg grid place-items-center text-sm font-bold shrink-0" style="background:rgba(14,165,233,.15);color:var(--accent)">${i+1}</span>
      <div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><h3 class="text-lg font-bold text-white">${esc(r.n)}</h3><span class="px-2 py-0.5 rounded-full text-[11px] font-mono text-slate-400 border border-white/10">${esc(r.f||'')}</span></div>
      <div class="text-xs text-slate-500 mt-0.5">${esc(r.t||'')}</div></div>
    </div>
    ${expect}${themes}${prepare}${mist}${sig}
  </div>`;
}

function compSection(c){
  if(!c.comp || !Array.isArray(c.comp.levels) || !c.comp.levels.length) return '';
  const rows = c.comp.levels.map(l=>`<tr class="border-t border-white/5"><td class="px-4 py-3 text-white font-medium">${esc(l.role)}</td><td class="px-4 py-3 text-slate-400 whitespace-nowrap">${esc(l.exp||'')}</td><td class="px-4 py-3 font-bold whitespace-nowrap" style="color:var(--accent)">${esc(l.india||'—')}</td><td class="px-4 py-3 text-slate-300 whitespace-nowrap">${esc(l.us||'—')}</td><td class="px-4 py-3 text-slate-400 text-[13px] leading-relaxed">${esc(l.note||'')}</td></tr>`).join('');
  const breakdown = Array.isArray(c.comp.breakdown)&&c.comp.breakdown.length ? `<div class="glass rounded-2xl p-6 mt-4"><h3 class="text-white font-bold mb-3">How the package is structured</h3><ul class="rc-list" style="gap:6px">${li(c.comp.breakdown)}</ul></div>`:'';
  return `<section id="comp" class="pt-14"><h2 class="text-2xl font-extrabold text-white mb-2">${esc(c.name)} salary &amp; compensation (2026)</h2>
<p class="text-sm text-slate-400 mb-5 max-w-2xl leading-relaxed">${esc(c.comp.note||'Approximate total compensation by role and experience. India figures are total CTC in LPA (lakhs per annum); US figures are total comp (base + stock + bonus). Real offers vary with team, location, and negotiation.')}</p>
<div class="overflow-x-auto rounded-xl border border-white/5"><table class="w-full text-sm"><thead class="bg-[#1a2235] text-slate-300 text-left"><tr><th class="px-4 py-3 font-semibold">Role / Level</th><th class="px-4 py-3 font-semibold">Experience</th><th class="px-4 py-3 font-semibold">India — total CTC</th><th class="px-4 py-3 font-semibold">US — total comp</th><th class="px-4 py-3 font-semibold">What to know</th></tr></thead><tbody class="[&_tr:nth-child(even)]:bg-white/[0.02]">${rows}</tbody></table></div>
${breakdown}
<p class="text-xs text-slate-500 mt-3">Indicative 2026 market ranges aggregated from public sources (levels.fyi, Glassdoor, AmbitionBox, candidate reports). Compensation varies widely by location, team, level calibration, and negotiation — use these as directional benchmarks, not guarantees.</p></section>`;
}

function page(c){
  const desc = (c.overview||c.tagline||'').slice(0,158);
  const procRows = (c.rounds||[]).map(r=>`<tr class="border-t border-white/5"><td class="px-4 py-3 text-white font-medium">${esc(r.n)}</td><td class="px-4 py-3 text-slate-400 font-mono">${esc(r.f||'')}</td><td class="px-4 py-3 text-slate-400">${esc(r.t||'')}</td></tr>`).join('');
  const rounds = (c.rounds||[]).map(roundCard).join('');
  const faqs = (c.faq||[]).map(f=>`<details class="glass rounded-xl px-5 py-4"><summary class="flex justify-between items-center cursor-pointer list-none text-white font-semibold">${esc(f.q)} <i class="fa-solid fa-chevron-down chev text-slate-500 transition"></i></summary><p class="mt-3 text-sm text-slate-400 leading-relaxed">${esc(f.a)}</p></details>`).join('');
  const related = POOL.filter(x=>x.slug!==c.slug).sort(()=>0.5-Math.random()).slice(0,6)
     .map(x=>`<a href="/interview-guides/${x.slug}/" class="gcard glass rounded-xl p-4 flex items-center gap-3"><span class="w-8 h-8 rounded-lg grid place-items-center text-sm font-black shrink-0" style="background:${x.color};color:#fff">${esc(x.mark)}</span><span class="text-sm font-semibold text-slate-200">${esc(x.name)}</span></a>`).join('');
  const faqLd = JSON.stringify({"@context":"https://schema.org","@type":"FAQPage",mainEntity:(c.faq||[]).map(f=>({"@type":"Question",name:f.q,acceptedAnswer:{"@type":"Answer",text:f.a}}))});
  const bcLd = JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Home",item:"https://whis-ai.com/"},{"@type":"ListItem",position:2,name:"Interview Guides",item:"https://whis-ai.com/interview-guides/"},{"@type":"ListItem",position:3,name:c.name,item:`https://whis-ai.com/interview-guides/${c.slug}/`}]});
  const artLd = JSON.stringify({"@context":"https://schema.org","@type":"Article",headline:`${c.name} Interview Guide (2026)`,description:desc,author:{"@type":"Organization",name:"Whis-AI"},publisher:{"@type":"Organization",name:"Whis-AI",logo:{"@type":"ImageObject",url:"https://whis-ai.com/owl_logo.jpeg"}},datePublished:"2026-09-21",dateModified:"2026-09-21",mainEntityOfPage:`https://whis-ai.com/interview-guides/${c.slug}/`});
  return `<!DOCTYPE html><html lang="en" class="scroll-smooth"><head>
<meta charset="UTF-8" /><title>${esc(c.name)} Interview Questions & Process (2026 Guide) | Whis-AI</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="description" content="${esc(c.name)} interview guide (2026): the full hiring process, every round explained, what's asked, how to prepare, common mistakes, eligibility, and a 2-week & 2-day plan." />
<link rel="canonical" href="https://whis-ai.com/interview-guides/${c.slug}/" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
<meta property="og:type" content="article" /><meta property="og:url" content="https://whis-ai.com/interview-guides/${c.slug}/" />
<meta property="og:title" content="${esc(c.name)} Interview Questions & Process (2026 Guide)" /><meta property="og:description" content="${esc(desc)}" /><meta property="og:image" content="https://whis-ai.com/og-image.png" />
<meta name="twitter:card" content="summary_large_image" /><meta name="twitter:image" content="https://whis-ai.com/og-image.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<script src="https://cdn.tailwindcss.com"></script>
<style>:root{--accent:${ACCENT};--accent-dark:#0284c7}html,body{background:#050814;color:#e2e8f0;font-family:'Plus Jakarta Sans','Inter',sans-serif}::-webkit-scrollbar{width:8px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:8px}.btn-premium{background:linear-gradient(135deg,var(--accent),var(--accent-dark));color:#04121b;border-radius:100px;font-weight:800;box-shadow:0 8px 24px -8px rgba(14,165,233,.5);transition:all .25s cubic-bezier(.34,1.56,.64,1)}.btn-premium:hover{transform:translateY(-2px)}.glass{background:rgba(15,20,35,.8);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06)}.gcard{transition:all .2s}.gcard:hover{transform:translateY(-2px);border-color:rgba(14,165,233,.35)}details[open] .chev{transform:rotate(180deg)}.toc a.active{color:#fff;background:rgba(14,165,233,.12);border-left:2px solid var(--accent)}.hero-glow{background:radial-gradient(ellipse at 50% -10%,rgba(14,165,233,.16),transparent 60%)}.rc-h{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin-bottom:4px}.rc-h.rc-warn{color:#fca5a5}.rc-h.rc-good{color:#6ee7b7}.rc-list{list-style:disc;padding-left:1.1rem;color:#a9b6cc;font-size:14px;line-height:1.65;display:flex;flex-direction:column;gap:2px}</style>
<script type="application/ld+json">${bcLd}</script><script type="application/ld+json">${artLd}</script><script type="application/ld+json">${faqLd}</script>
</head><body class="antialiased">
<header class="sticky top-0 z-40 glass"><div class="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between"><a href="/" class="flex items-center gap-2 font-extrabold text-white"><span class="w-2.5 h-2.5 rounded-full" style="background:var(--accent);box-shadow:0 0 12px var(--accent)"></span> Whis-AI</a><nav class="hidden md:flex items-center gap-7 text-sm text-slate-300"><a href="/#pricing-anchor" class="hover:text-white transition">Pricing</a><a href="/interview-guides/" class="hover:text-white transition">Interview Guides</a></nav><a href="/#pricing-anchor" class="btn-premium text-sm px-6 py-2.5">Get Whis free</a></div></header>
<section class="hero-glow"><div class="max-w-6xl mx-auto px-5 pt-14 pb-9">
<nav class="text-xs text-slate-500 mb-5"><a href="/" class="hover:text-slate-300">Home</a> / <a href="/interview-guides/" class="hover:text-slate-300">Interview Guides</a> / <span class="text-slate-300">${esc(c.name)}</span></nav>
<div class="flex items-center gap-3 mb-4"><span class="w-11 h-11 rounded-xl grid place-items-center text-lg font-black" style="background:${c.color};color:#fff">${esc(c.mark)}</span><span class="text-slate-400 text-sm font-semibold">${esc(c.name)} · ${esc(c.sector||'')}</span></div>
<h1 class="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-[1.08] max-w-3xl">${esc(c.name)} Interview Guide <span style="color:var(--accent)">(2026)</span></h1>
<p class="mt-5 text-lg text-slate-300 max-w-2xl leading-relaxed">${esc(c.overview||c.tagline)}</p>
<div class="mt-6 flex flex-wrap gap-2"><span class="px-3 py-1.5 rounded-full glass text-xs font-semibold text-slate-300"><i class="fa-solid fa-layer-group mr-1.5" style="color:var(--accent)"></i>${(c.rounds||[]).length}-round process</span><span class="px-3 py-1.5 rounded-full glass text-xs font-semibold text-slate-300"><i class="fa-solid fa-gauge-high mr-1.5" style="color:var(--accent)"></i>${esc(c.difficulty||'')}</span><span class="px-3 py-1.5 rounded-full glass text-xs font-semibold text-slate-300"><i class="fa-solid fa-clock mr-1.5" style="color:var(--accent)"></i>${esc(c.timeline||'')}</span><span class="px-3 py-1.5 rounded-full glass text-xs font-semibold text-slate-300"><i class="fa-solid fa-rotate mr-1.5" style="color:var(--accent)"></i>Updated Sep 2026</span></div>
<div class="mt-8 flex flex-wrap gap-3"><a href="/#pricing-anchor" class="btn-premium px-8 py-4 text-sm inline-flex items-center gap-2">Build my dated plan <i class="fa-solid fa-arrow-right"></i></a><a href="#rounds" class="px-7 py-4 rounded-full text-sm font-bold text-white/90 border border-white/15 bg-white/5 hover:bg-white/10 transition">Jump to the rounds ↓</a></div>
</div></section>
<div class="max-w-6xl mx-auto px-5 pb-24 lg:grid lg:grid-cols-[210px_1fr] lg:gap-12">
<aside class="hidden lg:block"><nav class="toc sticky top-24 space-y-1 text-sm" id="toc">
<a href="#process" class="block px-3 py-2 rounded-lg text-slate-400 hover:text-white transition">The process</a>
<a href="#rounds" class="block px-3 py-2 rounded-lg text-slate-400 hover:text-white transition">Round by round</a>
<a href="#master" class="block px-3 py-2 rounded-lg text-slate-400 hover:text-white transition">What to master</a>
<a href="#comp" class="block px-3 py-2 rounded-lg text-slate-400 hover:text-white transition">Salary &amp; comp</a>
<a href="#plan" class="block px-3 py-2 rounded-lg text-slate-400 hover:text-white transition">Prep plan</a>
<a href="#faq" class="block px-3 py-2 rounded-lg text-slate-400 hover:text-white transition">FAQ</a>
<a href="#related" class="block px-3 py-2 rounded-lg text-slate-400 hover:text-white transition">More guides</a>
<div class="mt-4 glass rounded-xl p-4 text-center"><div class="text-xs text-slate-400 mb-2">Interview soon?</div><a href="/#pricing-anchor" class="btn-premium block w-full py-2.5 text-xs">Get your plan</a></div>
</nav></aside>
<main class="min-w-0">
<section id="process" class="pt-10"><h2 class="text-2xl font-extrabold text-white mb-4">The hiring process</h2>
<div class="overflow-x-auto rounded-xl border border-white/5"><table class="w-full text-sm"><thead class="bg-[#1a2235] text-slate-300 text-left"><tr><th class="px-4 py-3 font-semibold">Round</th><th class="px-4 py-3 font-semibold">Format</th><th class="px-4 py-3 font-semibold">What's tested</th></tr></thead><tbody class="[&_tr:nth-child(even)]:bg-white/[0.02]">${procRows}</tbody></table></div>
<p class="text-xs text-slate-500 mt-3">Process and cutoffs vary by drive/team and change over time — confirm on the official careers page.</p></section>
<section id="rounds" class="pt-14"><h2 class="text-2xl font-extrabold text-white mb-6">Round-by-round: exactly what's asked & how to prepare</h2>${rounds}</section>
<section id="master" class="pt-6"><h2 class="text-2xl font-extrabold text-white mb-4">What to master</h2><ul class="rc-list mb-6" style="gap:6px">${li(c.topics)}</ul>
<div class="glass rounded-2xl p-6"><h3 class="text-white font-bold mb-2">Eligibility</h3><p class="text-sm text-slate-300 leading-relaxed">${esc(c.eligibility||'')}</p></div></section>
${compSection(c)}
<section id="plan" class="pt-14"><h2 class="text-2xl font-extrabold text-white mb-4">Your prep plan</h2>
<div class="inline-flex p-1 rounded-xl bg-[#1a2235] border border-white/10 mb-5" id="tabs"><button data-t="w2" class="tab px-4 py-2 rounded-lg text-sm font-semibold text-[#04121b]" style="background:var(--accent)">2 weeks</button><button data-t="crash" class="tab px-4 py-2 rounded-lg text-sm font-semibold text-slate-400">2-day crash</button></div>
<div id="pane-w2" class="glass rounded-2xl p-6"><ul class="rc-list" style="gap:8px">${li(c.prep2)}</ul></div>
<div id="pane-crash" class="glass rounded-2xl p-6 hidden"><ul class="rc-list" style="gap:8px">${li(c.prepC)}</ul></div>
<div class="mt-6 rounded-2xl p-6 border border-sky-500/30" style="background:radial-gradient(120% 120% at 50% 0%, rgba(14,165,233,.10), transparent 60%), rgba(15,20,35,.9)"><h3 class="text-lg font-bold text-white">Want this plan dated to your interview?</h3><p class="mt-2 text-sm text-slate-300 max-w-xl">Upload your resume and tell Whis your interview date — get a personalized, day-by-day plan built around your gaps, then run Whis live in the interview.</p><a href="/#pricing-anchor" class="btn-premium inline-flex items-center gap-2 mt-4 px-7 py-3.5 text-sm">Get my personalized plan <i class="fa-solid fa-arrow-right"></i></a></div></section>
<section id="faq" class="pt-14"><h2 class="text-2xl font-extrabold text-white mb-4">Frequently asked questions</h2><div class="space-y-1">${faqs}</div></section>
<section id="related" class="pt-14"><h2 class="text-2xl font-extrabold text-white mb-4">More interview guides</h2><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">${related}</div></section>
</main></div>
<section class="border-t border-white/5" style="background:radial-gradient(ellipse at 50% 120%,rgba(14,165,233,.12),transparent 60%)"><div class="max-w-3xl mx-auto px-5 py-16 text-center"><h2 class="text-3xl font-extrabold text-white tracking-tight">Walk into your ${esc(c.name)} interview ready.</h2><p class="mt-4 text-slate-300">Whis listens to the interviewer, reads your screen, and gives you real-time answers — invisible on Zoom, Teams and Meet.</p><a href="/#pricing-anchor" class="btn-premium inline-flex items-center gap-2 mt-7 px-9 py-4 text-sm">Get Whis free <i class="fa-solid fa-arrow-right"></i></a></div></section>
<footer class="border-t border-white/5"><div class="max-w-6xl mx-auto px-5 py-8 flex flex-wrap gap-4 justify-between text-sm text-slate-500"><span>© 2026 Whis-AI</span><div class="flex gap-5"><a href="/interview-guides/" class="hover:text-slate-300">All guides</a><a href="/privacy" class="hover:text-slate-300">Privacy</a></div></div></footer>
<script>
document.querySelectorAll('#tabs .tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#tabs .tab').forEach(x=>{x.style.background='';x.classList.add('text-slate-400');x.classList.remove('text-[#04121b]')});b.style.background='var(--accent)';b.classList.remove('text-slate-400');b.classList.add('text-[#04121b]');document.getElementById('pane-w2').classList.toggle('hidden',b.dataset.t!=='w2');document.getElementById('pane-crash').classList.toggle('hidden',b.dataset.t!=='crash')}));
const ls=[...document.querySelectorAll('#toc a')];const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)ls.forEach(l=>l.classList.toggle('active',l.getAttribute('href')==='#'+e.target.id))}),{rootMargin:'-25% 0px -65% 0px'});['process','rounds','master','comp','plan','faq','related'].forEach(id=>{const el=document.getElementById(id);if(el)io.observe(el)});
</script>
</body></html>`;
}

// Hub
const HUB=[{slug:'amazon-sde-2',name:'Amazon SDE-2',mark:'a',color:'#ff9900',blurb:'Full loop, coding, system design, the 16 Leadership Principles & Bar Raiser.'},...COMPANIES.map(c=>({slug:c.slug,name:c.name,mark:c.mark,color:c.color,blurb:c.tagline||c.overview}))];
function hub(){
  const cards=HUB.map(c=>`<a href="/interview-guides/${c.slug}/" class="gcard glass rounded-2xl p-6 block"><div class="flex items-center gap-3 mb-3"><span class="w-10 h-10 rounded-xl grid place-items-center text-lg font-black" style="background:${c.color};color:#fff">${esc(c.mark)}</span><div class="text-white font-bold">${esc(c.name)}</div></div><p class="text-sm text-slate-400">${esc((c.blurb||'').slice(0,110))}</p><span class="inline-flex items-center gap-1.5 mt-4 text-xs font-bold" style="color:${ACCENT}">Read the guide <i class="fa-solid fa-arrow-right text-[10px]"></i></span></a>`).join('');
  return `<!DOCTYPE html><html lang="en" class="scroll-smooth"><head><meta charset="UTF-8" /><title>Interview Guides — Rounds, Questions & Prep Plans | Whis-AI</title><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /><meta name="description" content="Company-by-company interview guides: exact rounds, what's asked, how to prepare, eligibility, and dated prep plans — for India's top IT recruiters and global tech. Walk in ready with Whis." /><link rel="canonical" href="https://whis-ai.com/interview-guides/" /><meta property="og:title" content="Interview Guides — Rounds, Questions & Prep Plans" /><meta property="og:image" content="https://whis-ai.com/og-image.png" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:image" content="https://whis-ai.com/og-image.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"><script src="https://cdn.tailwindcss.com"></script>
<style>:root{--accent:${ACCENT}}html,body{background:#050814;color:#e2e8f0;font-family:'Plus Jakarta Sans',sans-serif}::-webkit-scrollbar{width:8px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:8px}.btn-premium{background:linear-gradient(135deg,var(--accent),#0284c7);color:#04121b;border-radius:100px;font-weight:800;box-shadow:0 8px 24px -8px rgba(14,165,233,.5);transition:all .25s}.btn-premium:hover{transform:translateY(-2px)}.glass{background:rgba(15,20,35,.8);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06)}.gcard{transition:all .25s}.gcard:hover{transform:translateY(-3px);border-color:rgba(14,165,233,.35)}.hero-glow{background:radial-gradient(ellipse at 50% -10%,rgba(14,165,233,.16),transparent 60%)}</style>
<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"ItemList",itemListElement:HUB.map((c,i)=>({"@type":"ListItem",position:i+1,name:`${c.name} Interview Guide`,url:`https://whis-ai.com/interview-guides/${c.slug}/`}))})}</script>
</head><body class="antialiased">
<header class="sticky top-0 z-40 glass"><div class="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between"><a href="/" class="flex items-center gap-2 font-extrabold text-white"><span class="w-2.5 h-2.5 rounded-full" style="background:var(--accent);box-shadow:0 0 12px var(--accent)"></span> Whis-AI</a><nav class="hidden md:flex items-center gap-7 text-sm text-slate-300"><a href="/#pricing-anchor" class="hover:text-white transition">Pricing</a><a href="/interview-guides/" class="text-white">Interview Guides</a></nav><a href="/#pricing-anchor" class="btn-premium text-sm px-6 py-2.5">Get Whis free</a></div></header>
<section class="hero-glow"><div class="max-w-5xl mx-auto px-5 pt-16 pb-10 text-center"><h1 class="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-[1.08]">Know exactly what your interview will ask.</h1><p class="mt-5 text-lg text-slate-300 max-w-2xl mx-auto">Company-by-company guides: the real rounds, what each one asks, how to prepare, eligibility, and a dated prep plan. Then walk in with Whis giving you answers live.</p><a href="/#pricing-anchor" class="btn-premium inline-flex items-center gap-2 mt-7 px-8 py-4 text-sm">Build my personalized plan <i class="fa-solid fa-arrow-right"></i></a></div></section>
<main class="max-w-6xl mx-auto px-5 pb-24"><h2 class="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 mt-6">${HUB.length} guides</h2><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${cards}</div></main>
<section class="border-t border-white/5" style="background:radial-gradient(ellipse at 50% 120%,rgba(14,165,233,.12),transparent 60%)"><div class="max-w-3xl mx-auto px-5 py-16 text-center"><h2 class="text-3xl font-extrabold text-white tracking-tight">Prep smarter. Interview with backup.</h2><p class="mt-4 text-slate-300">Whis gives you real-time answers, invisible on Zoom, Teams and Meet.</p><a href="/#pricing-anchor" class="btn-premium inline-flex items-center gap-2 mt-7 px-9 py-4 text-sm">Get Whis free <i class="fa-solid fa-arrow-right"></i></a></div></section>
<footer class="border-t border-white/5"><div class="max-w-6xl mx-auto px-5 py-8 flex flex-wrap gap-4 justify-between text-sm text-slate-500"><span>© 2026 Whis-AI</span><div class="flex gap-5"><a href="/privacy" class="hover:text-slate-300">Privacy</a><a href="/terms" class="hover:text-slate-300">Terms</a></div></div></footer>
</body></html>`;
}

let n=0;
for(const c of COMPANIES){ const dir=path.join(OUT,c.slug); fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,'index.html'),page(c)); n++; }
fs.writeFileSync(path.join(OUT,'index.html'),hub());
const base=['/','/interview-guides/','/blog.html','/enterprise.html','/partner.html','/contact.html','/support.html','/privacy.html','/terms.html','/refund-policy.html','/shipping-policy.html'];
const guides=['/interview-guides/amazon-sde-2/',...COMPANIES.map(c=>`/interview-guides/${c.slug}/`)];
const urls=[...base.map(u=>({u,p:u==='/'?'1.0':'0.6'})),...guides.map(u=>({u,p:'0.8'}))];
fs.writeFileSync(path.join(ROOT,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`+urls.map(x=>`  <url><loc>https://whis-ai.com${x.u}</loc><priority>${x.p}</priority></url>`).join('\n')+`\n</urlset>\n`);
console.log(`generated ${n} rich company guides + hub (${HUB.length}) + sitemap (${urls.length} urls)`);
