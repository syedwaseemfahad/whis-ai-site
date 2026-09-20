// Whis-AI interview-guide generator.
// Adds a company = add a row to COMPANIES below, then run: node gen-guides.mjs
// Emits interview-guides/<slug>/index.html, rebuilds the hub, and refreshes sitemap.xml.
import fs from 'fs';
import path from 'path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, 'interview-guides');
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ── Data. Sourced from public processes (2026 cycle). Honest patterns, not leaked papers. ──
const COMPANIES = [
  { slug:'tcs', name:'TCS', mark:'T', color:'#0b4ea2', sector:'IT services · mass fresher hiring',
    tagline:'TCS hires freshers through the National Qualifier Test (NQT) into Ninja, Digital and Prime tracks.',
    difficulty:'Moderate', timeline:'NQT → interview (2–4 weeks)',
    process:'A single online NQT (Foundation + optional Advanced sections) decides your track, then a combined Technical → Managerial → HR interview.',
    rounds:[
      {n:'NQT — Foundation', f:'~75 min', t:'Numerical, Verbal & Reasoning ability (no negative marking)'},
      {n:'NQT — Advanced (Digital/Prime)', f:'~115 min', t:'Advanced quant/reasoning + advanced coding (C/C++/Java/Python)'},
      {n:'Technical interview', f:'30–45 min', t:'Your language, DSA, OOP, DBMS/SQL, OS, CN, final-year project'},
      {n:'Managerial (MR)', f:'15–30 min', t:'Scenario & pressure handling, project choices, teamwork'},
      {n:'HR', f:'15–20 min', t:'Communication, "why TCS", service-agreement acceptance, eligibility'} ],
    topics:['Aptitude: arithmetic, DI, series, puzzles','Coding: arrays, strings, complexity','CS: OOP, DBMS normalization, OS, CN','Project: architecture & trade-offs'],
    eligibility:'60% in 10th, 12th and graduation each; no more than one active backlog at application.',
    prep2:['Days 1–3: timed aptitude (quant/verbal/reasoning)','Days 4–8: coding by pattern in one language','Days 9–11: revise OOP/DBMS/OS/CN + your project','Days 12–13: 2 full NQT-pattern mocks','Day 14: HR/MR answers'],
    prepC:['Day 1: high-yield aptitude + 10 coding problems','Day 2: CS fundamentals cheat-sheet + project story + HR one-liners'],
    faq:[
      {q:'What is the TCS NQT?', a:'A single online qualifier test (Foundation, plus an Advanced section for Digital/Prime) whose score, with your CGPA, decides your hiring track.'},
      {q:'Which languages are allowed in the coding round?', a:'Typically C, C++, Java, Python (and Perl). Pick the one you are fastest and cleanest in.'},
      {q:'Is there negative marking?', a:'No — attempt every question.'} ] },

  { slug:'infosys', name:'Infosys', mark:'I', color:'#007cc3', sector:'IT services · SE / SP / DSE tracks',
    tagline:'Infosys hires via an online assessment then technical + HR interviews; SP/DSE run a pure coding test.',
    difficulty:'Moderate (higher for SP/DSE)', timeline:'Assessment → interview (2–4 weeks)',
    process:'System Engineer uses aptitude + pseudocode + verbal; Specialist Programmer / Digital Specialist Engineer use a 3-problem coding test. Then a technical interview and HR.',
    rounds:[
      {n:'Online assessment (SE)', f:'~2–3 hrs', t:'Aptitude, logical/pseudocode, verbal'},
      {n:'Coding test (SP/DSE)', f:'~3 hrs', t:'3 DSA problems with sectional cutoffs (Java/Python/C++/C)'},
      {n:'Technical interview', f:'30–45 min', t:'OOP, DBMS/SQL, OS, CN, live coding for SP/PP, project'},
      {n:'HR', f:'15–20 min', t:'Communication, motivation, flexibility'} ],
    topics:['Pseudocode output tracing','DSA: arrays, strings, trees, sorting, complexity (+ DP/graphs for SP/DSE)','OOP with real examples, DBMS normalization','Project depth'],
    eligibility:'Typically 60% / 6.0+ throughout with no active backlogs (varies by drive/batch).',
    prep2:['Days 1–3: aptitude + pseudocode tracing','Days 4–9: DSA (arrays→strings→trees; DP/graphs for SP/DSE)','Days 10–11: OOP/DBMS/OS/CN + project','Days 12–14: mocks + HR'],
    prepC:['Day 1: pseudocode + 12 DSA problems','Day 2: CS fundamentals + project + HR'],
    faq:[
      {q:'How is SP vs DSE decided?', a:'The same coding test decides both: a high score routes to Specialist Programmer, a moderate score to Digital Specialist Engineer.'},
      {q:'What are InfyTQ and HackWithInfy?', a:'Alternate routes — InfyTQ certification and the HackWithInfy coding contest can fast-track you to SP/PP roles.'},
      {q:'How much DSA should I prep for SP/DSE?', a:'Weight heavily toward DSA (roughly 70%), including DP and graphs.'} ] },

  { slug:'wipro', name:'Wipro', mark:'W', color:'#341e6b', sector:'IT services · Elite NLTH',
    tagline:'Wipro hires freshers through the Elite National Level Talent Hunt: aptitude + essay + coding, then interviews.',
    difficulty:'Moderate', timeline:'NLTH → interview (2–4 weeks)',
    process:'An SHL-administered online test (aptitude + written essay + 2 coding problems), then a technical interview and HR.',
    rounds:[
      {n:'Online assessment (NLTH)', f:'~60 min', t:'Quant, logical, verbal (~20 Q) + a timed essay'},
      {n:'Coding', f:'~60 min', t:'2 problems (Java/C/C++/Python)'},
      {n:'Technical interview', f:'30 min', t:'OOP, DBMS/SQL, OS basics, one language, project'},
      {n:'HR', f:'15–20 min', t:'Communication, "why Wipro", service-agreement acceptance'} ],
    topics:['Aptitude: quant, reasoning, verbal','Essay: grammar, structure, clarity','Coding: arrays, strings, basic algorithms','CS fundamentals + project'],
    eligibility:'B.E./B.Tech/M.E./M.Tech any branch, 60% each in 10th/12th/degree, no active backlogs; sectional cutoffs apply.',
    prep2:['Days 1–3: aptitude + essay practice','Days 4–8: coding fundamentals','Days 9–11: OOP/DBMS/OS + project','Days 12–14: mocks + HR'],
    prepC:['Day 1: aptitude + essay + 8 coding problems','Day 2: CS fundamentals + project + HR'],
    faq:[
      {q:'Does Wipro have an essay round?', a:'Yes — the NLTH includes a timed written-communication essay judged on grammar, structure and clarity.'},
      {q:'Are there sectional cutoffs?', a:'Yes — you must clear each section; a strong section will not compensate a weak one.'},
      {q:'What is the bond?', a:'Wipro typically has a service agreement; you accept it at the HR stage.'} ] },

  { slug:'accenture', name:'Accenture', mark:'A', color:'#a100ff', sector:'IT services · Associate SE / Full Stack',
    tagline:'Accenture runs a 4-stage funnel: cognitive+technical assessment, coding, communication, then interview.',
    difficulty:'Easy–Moderate', timeline:'Assessments → interview (2–4 weeks)',
    process:'A cognitive & technical assessment (elimination), a coding round, a spoken-English assessment, then a combined technical + HR interview.',
    rounds:[
      {n:'Cognitive & Technical', f:'~90 min', t:'Verbal, reasoning, numerical + technical/pseudocode (sectional cutoffs)'},
      {n:'Coding', f:'~45 min', t:'2 problems (basic DSA + language fundamentals)'},
      {n:'Communication assessment', f:'~20 min', t:'Pronunciation, fluency, sentence framing'},
      {n:'Technical + HR', f:'30 min', t:'Language basics, OOP, DBMS/SQL, project, fit'} ],
    topics:['Verbal, logical & numerical ability','Pseudocode + fundamentals of programming','Basic DSA coding','Spoken English'],
    eligibility:'60% aggregate throughout, no active backlogs; BE/B.Tech/MCA and related.',
    prep2:['Days 1–3: cognitive practice','Days 4–7: coding basics','Days 8–10: English + fundamentals','Days 11–14: mocks + HR'],
    prepC:['Day 1: cognitive + 8 coding problems','Day 2: English drills + fundamentals + HR'],
    faq:[
      {q:'Is the communication round eliminating?', a:'Treat it seriously — spoken-English proficiency is assessed and matters for progression.'},
      {q:'How hard is the coding round?', a:'Two basic-to-moderate problems on core DSA and language fundamentals.'},
      {q:'Is there negative marking?', a:'No — attempt everything, but clear each section.'} ] },

  { slug:'cognizant', name:'Cognizant', mark:'C', color:'#1a1a2e', sector:'IT services · GenC / GenC Next',
    tagline:'Cognizant hires through GenC, GenC Pro and GenC Next tracks via an AMCAT-based assessment then interviews.',
    difficulty:'Moderate (higher for GenC Next)', timeline:'Assessment → interview (2–4 weeks)',
    process:'Aptitude + verbal + reasoning (plus coding for Pro/Next) and an eliminating communication round, then a technical interview (deeper for GenC Next) and HR.',
    rounds:[
      {n:'Online assessment', f:'~75–120 min', t:'Aptitude, verbal, reasoning (+ coding for Pro/Next)'},
      {n:'Communication', f:'~20 min', t:'English — an elimination gate'},
      {n:'Technical interview', f:'30–45 min', t:'DSA, DBMS/SQL, OOP, web tech (GenC Next), project'},
      {n:'HR', f:'15–20 min', t:'Fit, flexibility, communication'} ],
    topics:['Aptitude & reasoning','Verbal / communication','Coding (Python/Java/C++/JS) for Pro/Next','CS fundamentals + web tech'],
    eligibility:'GenC ~60%/6.0; GenC Pro ~65%/6.5; GenC Next ~70%/7.0; zero active backlogs.',
    prep2:['Days 1–3: aptitude + verbal','Days 4–8: coding (deeper for Next)','Days 9–11: DBMS/OOP/web + project','Days 12–14: mocks + HR'],
    prepC:['Day 1: aptitude + coding','Day 2: fundamentals + English + HR'],
    faq:[
      {q:'What is the difference between GenC, Pro and Next?', a:'Tiers by score/CGPA and coding depth — GenC Next is the highest, with the deepest technical round and best package.'},
      {q:'Is the English round important?', a:'Yes — the communication round is an elimination gate.'},
      {q:'Which languages for coding?', a:'Commonly Python, Java, C++ or JavaScript.'} ] },

  { slug:'capgemini', name:'Capgemini', mark:'C', color:'#0070ad', sector:'IT services · Analyst / Senior Analyst',
    tagline:'Capgemini uses the Exceller assessment (pseudocode, English, game-based aptitude) then interviews.',
    difficulty:'Easy–Moderate', timeline:'Assessment → interview (2–4 weeks)',
    process:'Pseudocode MCQs, English, and a game-based cognitive test; a coding round for the Senior Analyst track; then technical + HR.',
    rounds:[
      {n:'Pseudocode MCQs', f:'~25 min', t:'Output tracing, loops/conditionals, algorithmic logic'},
      {n:'English + game-based aptitude', f:'~50 min', t:'Grammar/comprehension + adaptive cognitive mini-games'},
      {n:'Coding (Senior Analyst)', f:'~varies', t:'Algorithmic problem-solving (C/C++/Java/Python)'},
      {n:'Technical + HR', f:'30 min', t:'Language, OOP, DBMS/SQL, OS, project, fit'} ],
    topics:['Pseudocode logic','English grammar & comprehension','Game-based reasoning (memory, attention, planning)','CS fundamentals + coding (Senior)'],
    eligibility:'Typically 60% throughout, no active backlogs (drive-dependent).',
    prep2:['Days 1–3: pseudocode + English','Days 4–7: game-based aptitude + coding','Days 8–11: fundamentals + project','Days 12–14: mocks + HR'],
    prepC:['Day 1: pseudocode + game practice','Day 2: coding + fundamentals + HR'],
    faq:[
      {q:'What are the game-based tests?', a:'Short adaptive mini-games measuring working memory, attention and planning — practice a few beforehand so the format is familiar.'},
      {q:'Do I need the coding round?', a:'The coding round is required for the higher Senior Analyst band.'},
      {q:'Is pseudocode language-specific?', a:'No — it tests language-agnostic logic and output tracing.'} ] },

  { slug:'hcltech', name:'HCLTech', mark:'H', color:'#0f5fdc', sector:'IT services · Standard / Elite AI / TechBee',
    tagline:'HCLTech uses a computer-adaptive online test then a fast technical interview and HR.',
    difficulty:'Easy–Moderate', timeline:'Test → interview (2–4 weeks)',
    process:'A ~60-question adaptive test (aptitude + technical MCQs, plus coding for engineering roles), then a concept-then-live-coding technical interview and HR.',
    rounds:[
      {n:'Online written test', f:'~60 min', t:'Adaptive aptitude + technical MCQs (+ coding for engineering roles)'},
      {n:'Technical interview', f:'30 min', t:'OOP, DBMS/SQL, OS, one language, quick live coding, project'},
      {n:'HR', f:'15–20 min', t:'Communication, fit, flexibility'} ],
    topics:['Aptitude (adaptive; cannot revisit questions)','Programming fundamentals, DBMS, OS, CN','Basic-to-moderate DSA coding','Project'],
    eligibility:'B.E./B.Tech ≥60% across 10th/12th/degree, no active backlogs; sectional cutoffs.',
    prep2:['Days 1–3: aptitude (timed, no revisit)','Days 4–8: coding basics','Days 9–11: fundamentals + project','Days 12–14: mocks + HR'],
    prepC:['Day 1: aptitude + coding','Day 2: fundamentals + project + HR'],
    faq:[
      {q:'What does "computer-adaptive" mean?', a:'Difficulty adjusts to your answers and you cannot revisit a previous question — so pace yourself and answer carefully the first time.'},
      {q:'How is the Elite AI band decided?', a:'The premium band is driven by a real, deployed AI-project portfolio, not just your test score.'},
      {q:'What is TechBee?', a:'A post-12th early-career pathway with a 12-month training program.'} ] },

  { slug:'tech-mahindra', name:'Tech Mahindra', mark:'T', color:'#e2231a', sector:'IT services · ELQ / NLTH',
    tagline:'Tech Mahindra runs a 5-stage process: aptitude, technical+psychometric, AI communication, then interviews.',
    difficulty:'Easy–Moderate', timeline:'Assessments → interview (2–4 weeks)',
    process:'An aptitude test, a technical + psychometric test, an AI-based communication assessment (including a story-writing task), then technical and HR interviews.',
    rounds:[
      {n:'Aptitude test', f:'~varies', t:'Quant, English, pattern recognition, logical reasoning (sectional cutoffs)'},
      {n:'Technical + psychometric', f:'~varies', t:'OOP, DBMS/SQL, OS, CN, basic coding (psychometric untimed)'},
      {n:'AI communication', f:'~15 min', t:'Story-writing (image prompt) + spoken fluency, AI-evaluated'},
      {n:'Technical + HR', f:'30 min', t:'Concepts + live coding / SQL, project, fit'} ],
    topics:['Aptitude: quant, verbal, logical','CS fundamentals + basic coding','Written English (story-writing)','SQL query-writing'],
    eligibility:'Typically 60% throughout, no active backlogs (drive-dependent).',
    prep2:['Days 1–3: aptitude','Days 4–7: coding + SQL','Days 8–11: fundamentals + project','Days 12–14: English/story + HR'],
    prepC:['Day 1: aptitude + SQL','Day 2: fundamentals + story-writing + HR'],
    faq:[
      {q:'What is the story-writing task?', a:'A short (~1,000-character) narrative from an image prompt, scored on grammar, punctuation and flow.'},
      {q:'Is there SQL in the interview?', a:'Yes — expect live SQL query-writing alongside CS concepts.'},
      {q:'What is SuperCoder?', a:'An optional challenge for top performers that unlocks a higher package track.'} ] },
];

const ACCENT = '#0ea5e9';
function page(c){
  const rows = c.rounds.map(r=>`<tr class="border-t border-white/5"><td class="px-4 py-3 text-white font-medium">${esc(r.n)}</td><td class="px-4 py-3 text-slate-400 font-mono">${esc(r.f)}</td><td class="px-4 py-3 text-slate-400">${esc(r.t)}</td></tr>`).join('');
  const topics = c.topics.map(t=>`<li>${esc(t)}</li>`).join('');
  const p2 = c.prep2.map(t=>`<li>${esc(t)}</li>`).join('');
  const pc = c.prepC.map(t=>`<li>${esc(t)}</li>`).join('');
  const faqs = c.faq.map(f=>`<details class="glass rounded-xl px-5 py-4"><summary class="flex justify-between items-center cursor-pointer list-none text-white font-semibold">${esc(f.q)} <i class="fa-solid fa-chevron-down chev text-slate-500 transition"></i></summary><p class="mt-3 text-sm text-slate-400">${esc(f.a)}</p></details>`).join('');
  const faqLd = JSON.stringify({"@context":"https://schema.org","@type":"FAQPage",mainEntity:c.faq.map(f=>({"@type":"Question",name:f.q,acceptedAnswer:{"@type":"Answer",text:f.a}}))});
  const bcLd = JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Home",item:"https://whis-ai.com/"},{"@type":"ListItem",position:2,name:"Interview Guides",item:"https://whis-ai.com/interview-guides/"},{"@type":"ListItem",position:3,name:c.name,item:`https://whis-ai.com/interview-guides/${c.slug}/`}]});
  const artLd = JSON.stringify({"@context":"https://schema.org","@type":"Article",headline:`${c.name} Interview Guide (2026)`,description:c.tagline,author:{"@type":"Organization",name:"Whis-AI"},publisher:{"@type":"Organization",name:"Whis-AI",logo:{"@type":"ImageObject",url:"https://whis-ai.com/owl_logo.jpeg"}},datePublished:"2026-09-20",dateModified:"2026-09-20",mainEntityOfPage:`https://whis-ai.com/interview-guides/${c.slug}/`});
  return `<!DOCTYPE html><html lang="en" class="scroll-smooth"><head>
<meta charset="UTF-8" /><title>${esc(c.name)} Interview Questions & Process (2026 Guide) | Whis-AI</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="description" content="${esc(c.name)} interview guide (2026): the full hiring process, every round, what's tested, eligibility, and a 2-week and 2-day prep plan. ${esc(c.tagline)}" />
<link rel="canonical" href="https://whis-ai.com/interview-guides/${c.slug}/" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta property="og:type" content="article" /><meta property="og:url" content="https://whis-ai.com/interview-guides/${c.slug}/" />
<meta property="og:title" content="${esc(c.name)} Interview Questions & Process (2026 Guide)" />
<meta property="og:description" content="${esc(c.tagline)}" /><meta property="og:image" content="https://whis-ai.com/og-image.png" />
<meta name="twitter:card" content="summary_large_image" /><meta name="twitter:image" content="https://whis-ai.com/og-image.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<script src="https://cdn.tailwindcss.com"></script>
<style>:root{--accent:${ACCENT};--accent-dark:#0284c7}html,body{background:#050814;color:#e2e8f0;font-family:'Plus Jakarta Sans','Inter',sans-serif}::-webkit-scrollbar{width:8px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:8px}.btn-premium{background:linear-gradient(135deg,var(--accent),var(--accent-dark));color:#04121b;border-radius:100px;font-weight:800;box-shadow:0 8px 24px -8px rgba(14,165,233,.5);transition:all .25s cubic-bezier(.34,1.56,.64,1)}.btn-premium:hover{transform:translateY(-2px)}.glass{background:rgba(15,20,35,.8);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06)}details[open] .chev{transform:rotate(180deg)}.hero-glow{background:radial-gradient(ellipse at 50% -10%,rgba(14,165,233,.16),transparent 60%)}.prose-w p,.prose-w li{color:#a9b6cc;line-height:1.7}</style>
<script type="application/ld+json">${bcLd}</script><script type="application/ld+json">${artLd}</script><script type="application/ld+json">${faqLd}</script>
</head><body class="antialiased">
<header class="sticky top-0 z-40 glass"><div class="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between"><a href="/" class="flex items-center gap-2 font-extrabold text-white"><span class="w-2.5 h-2.5 rounded-full" style="background:var(--accent);box-shadow:0 0 12px var(--accent)"></span> Whis-AI</a><nav class="hidden md:flex items-center gap-7 text-sm text-slate-300"><a href="/interview-guides/" class="hover:text-white transition">Interview Guides</a><a href="/#pricing-anchor" class="hover:text-white transition">Pricing</a></nav><a href="/#pricing-anchor" class="btn-premium text-sm px-6 py-2.5">Get Whis free</a></div></header>
<section class="hero-glow"><div class="max-w-5xl mx-auto px-5 pt-14 pb-8">
<nav class="text-xs text-slate-500 mb-5"><a href="/" class="hover:text-slate-300">Home</a> / <a href="/interview-guides/" class="hover:text-slate-300">Interview Guides</a> / <span class="text-slate-300">${esc(c.name)}</span></nav>
<div class="flex items-center gap-3 mb-4"><span class="w-11 h-11 rounded-xl grid place-items-center text-lg font-black" style="background:${c.color};color:#fff">${esc(c.mark)}</span><span class="text-slate-400 text-sm font-semibold">${esc(c.name)} · ${esc(c.sector)}</span></div>
<h1 class="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-[1.08] max-w-3xl">${esc(c.name)} Interview Guide <span style="color:var(--accent)">(2026)</span></h1>
<p class="mt-5 text-lg text-slate-300 max-w-2xl">${esc(c.tagline)}</p>
<div class="mt-6 flex flex-wrap gap-2"><span class="px-3 py-1.5 rounded-full glass text-xs font-semibold text-slate-300"><i class="fa-solid fa-gauge-high mr-1.5" style="color:var(--accent)"></i>${esc(c.difficulty)}</span><span class="px-3 py-1.5 rounded-full glass text-xs font-semibold text-slate-300"><i class="fa-solid fa-clock mr-1.5" style="color:var(--accent)"></i>${esc(c.timeline)}</span><span class="px-3 py-1.5 rounded-full glass text-xs font-semibold text-slate-300"><i class="fa-solid fa-rotate mr-1.5" style="color:var(--accent)"></i>Updated Sep 2026</span></div>
<div class="mt-8 flex flex-wrap gap-3"><a href="/#pricing-anchor" class="btn-premium px-8 py-4 text-sm inline-flex items-center gap-2">Build my dated plan <i class="fa-solid fa-arrow-right"></i></a><a href="#rounds" class="px-7 py-4 rounded-full text-sm font-bold text-white/90 border border-white/15 bg-white/5 hover:bg-white/10 transition">Jump to the rounds ↓</a></div>
</div></section>
<main class="max-w-4xl mx-auto px-5 pb-24 prose-w">
<section class="pt-8"><h2 class="text-2xl font-extrabold text-white mb-4">The hiring process</h2><p class="mb-5">${esc(c.process)}</p>
<div class="overflow-x-auto rounded-xl border border-white/5"><table class="w-full text-sm"><thead class="bg-[#1a2235] text-slate-300 text-left"><tr><th class="px-4 py-3 font-semibold">Round</th><th class="px-4 py-3 font-semibold">Format</th><th class="px-4 py-3 font-semibold">What's tested</th></tr></thead><tbody class="[&_tr:nth-child(even)]:bg-white/[0.02]">${rows}</tbody></table></div>
<p class="text-xs text-slate-500 mt-3">Process and cutoffs vary by drive and change over time — always confirm on the official careers page.</p></section>
<section id="rounds" class="pt-12"><h2 class="text-2xl font-extrabold text-white mb-4">What to master</h2><ul class="list-disc pl-5 space-y-1.5 mb-6">${topics}</ul>
<div class="glass rounded-2xl p-6 mb-4"><h3 class="text-white font-bold mb-2">Eligibility</h3><p class="text-sm">${esc(c.eligibility)}</p></div></section>
<section class="pt-4"><h2 class="text-2xl font-extrabold text-white mb-4">Your prep plan</h2>
<div class="grid md:grid-cols-2 gap-4"><div class="glass rounded-2xl p-6"><h3 class="text-white font-bold mb-3">2-week plan</h3><ul class="list-disc pl-5 space-y-2 text-sm">${p2}</ul></div><div class="glass rounded-2xl p-6"><h3 class="text-white font-bold mb-3">2-day crash plan</h3><ul class="list-disc pl-5 space-y-2 text-sm">${pc}</ul></div></div>
<div class="mt-6 rounded-2xl p-6 border border-sky-500/30" style="background:radial-gradient(120% 120% at 50% 0%, rgba(14,165,233,.10), transparent 60%), rgba(15,20,35,.9)"><h3 class="text-lg font-bold text-white">Want this plan dated to your interview?</h3><p class="mt-2 text-sm text-slate-300 max-w-xl">Upload your resume and tell Whis your interview date — get a personalized, day-by-day plan, then run Whis live in the interview itself.</p><a href="/#pricing-anchor" class="btn-premium inline-flex items-center gap-2 mt-4 px-7 py-3.5 text-sm">Get my personalized plan <i class="fa-solid fa-arrow-right"></i></a></div></section>
<section class="pt-12"><h2 class="text-2xl font-extrabold text-white mb-4">FAQ</h2><div class="space-y-1">${faqs}</div></section>
</main>
<section class="border-t border-white/5" style="background:radial-gradient(ellipse at 50% 120%,rgba(14,165,233,.12),transparent 60%)"><div class="max-w-3xl mx-auto px-5 py-16 text-center"><h2 class="text-3xl font-extrabold text-white tracking-tight">Walk into your ${esc(c.name)} interview ready.</h2><p class="mt-4 text-slate-300">Whis listens to the interviewer, reads your screen, and gives you real-time answers — invisible on Zoom, Teams and Meet.</p><a href="/#pricing-anchor" class="btn-premium inline-flex items-center gap-2 mt-7 px-9 py-4 text-sm">Get Whis free <i class="fa-solid fa-arrow-right"></i></a></div></section>
<footer class="border-t border-white/5"><div class="max-w-6xl mx-auto px-5 py-8 flex flex-wrap gap-4 justify-between text-sm text-slate-500"><span>© 2026 Whis-AI</span><div class="flex gap-5"><a href="/interview-guides/" class="hover:text-slate-300">All guides</a><a href="/privacy" class="hover:text-slate-300">Privacy</a></div></div></footer>
</body></html>`;
}

// Master list for the hub (includes the bespoke Amazon page).
const HUB = [{slug:'amazon-sde-2',name:'Amazon SDE-2',mark:'a',color:'#ff9900',blurb:'Full loop, coding, system design, the 16 Leadership Principles & Bar Raiser.'},
  ...COMPANIES.map(c=>({slug:c.slug,name:c.name,mark:c.mark,color:c.color,blurb:c.tagline}))];

function hub(){
  const cards = HUB.map(c=>`<a href="/interview-guides/${c.slug}/" class="gcard glass rounded-2xl p-6 block"><div class="flex items-center gap-3 mb-3"><span class="w-10 h-10 rounded-xl grid place-items-center text-lg font-black" style="background:${c.color};color:#fff">${esc(c.mark)}</span><div class="text-white font-bold">${esc(c.name)}</div></div><p class="text-sm text-slate-400">${esc(c.blurb)}</p><span class="inline-flex items-center gap-1.5 mt-4 text-xs font-bold" style="color:${ACCENT}">Read the guide <i class="fa-solid fa-arrow-right text-[10px]"></i></span></a>`).join('');
  return `<!DOCTYPE html><html lang="en" class="scroll-smooth"><head>
<meta charset="UTF-8" /><title>Interview Guides — Rounds, Questions & Prep Plans | Whis-AI</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="description" content="Company-by-company interview guides: the exact rounds, what's tested, eligibility, and a dated prep plan — for India's top IT recruiters and global tech. Walk in ready with Whis." />
<link rel="canonical" href="https://whis-ai.com/interview-guides/" />
<meta property="og:title" content="Interview Guides — Rounds, Questions & Prep Plans" /><meta property="og:image" content="https://whis-ai.com/og-image.png" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:image" content="https://whis-ai.com/og-image.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"><script src="https://cdn.tailwindcss.com"></script>
<style>:root{--accent:${ACCENT}}html,body{background:#050814;color:#e2e8f0;font-family:'Plus Jakarta Sans',sans-serif}::-webkit-scrollbar{width:8px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:8px}.btn-premium{background:linear-gradient(135deg,var(--accent),#0284c7);color:#04121b;border-radius:100px;font-weight:800;box-shadow:0 8px 24px -8px rgba(14,165,233,.5);transition:all .25s}.btn-premium:hover{transform:translateY(-2px)}.glass{background:rgba(15,20,35,.8);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06)}.gcard{transition:all .25s}.gcard:hover{transform:translateY(-3px);border-color:rgba(14,165,233,.35)}.hero-glow{background:radial-gradient(ellipse at 50% -10%,rgba(14,165,233,.16),transparent 60%)}</style>
<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"ItemList",itemListElement:HUB.map((c,i)=>({"@type":"ListItem",position:i+1,name:`${c.name} Interview Guide`,url:`https://whis-ai.com/interview-guides/${c.slug}/`}))})}</script>
</head><body class="antialiased">
<header class="sticky top-0 z-40 glass"><div class="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between"><a href="/" class="flex items-center gap-2 font-extrabold text-white"><span class="w-2.5 h-2.5 rounded-full" style="background:var(--accent);box-shadow:0 0 12px var(--accent)"></span> Whis-AI</a><nav class="hidden md:flex items-center gap-7 text-sm text-slate-300"><a href="/interview-guides/" class="text-white">Interview Guides</a><a href="/#pricing-anchor" class="hover:text-white transition">Pricing</a></nav><a href="/#pricing-anchor" class="btn-premium text-sm px-6 py-2.5">Get Whis free</a></div></header>
<section class="hero-glow"><div class="max-w-5xl mx-auto px-5 pt-16 pb-10 text-center"><h1 class="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-[1.08]">Know exactly what your interview will ask.</h1><p class="mt-5 text-lg text-slate-300 max-w-2xl mx-auto">Company-by-company guides: the real rounds, what each tests, eligibility, and a dated prep plan. Then walk in with Whis giving you answers live.</p><a href="/#pricing-anchor" class="btn-premium inline-flex items-center gap-2 mt-7 px-8 py-4 text-sm">Build my personalized plan <i class="fa-solid fa-arrow-right"></i></a></div></section>
<main class="max-w-6xl mx-auto px-5 pb-24"><h2 class="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 mt-6">${HUB.length} guides</h2><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${cards}</div></main>
<section class="border-t border-white/5" style="background:radial-gradient(ellipse at 50% 120%,rgba(14,165,233,.12),transparent 60%)"><div class="max-w-3xl mx-auto px-5 py-16 text-center"><h2 class="text-3xl font-extrabold text-white tracking-tight">Prep smarter. Interview with backup.</h2><p class="mt-4 text-slate-300">Whis gives you real-time answers, invisible on Zoom, Teams and Meet.</p><a href="/#pricing-anchor" class="btn-premium inline-flex items-center gap-2 mt-7 px-9 py-4 text-sm">Get Whis free <i class="fa-solid fa-arrow-right"></i></a></div></section>
<footer class="border-t border-white/5"><div class="max-w-6xl mx-auto px-5 py-8 flex flex-wrap gap-4 justify-between text-sm text-slate-500"><span>© 2026 Whis-AI</span><div class="flex gap-5"><a href="/privacy" class="hover:text-slate-300">Privacy</a><a href="/terms" class="hover:text-slate-300">Terms</a></div></div></footer>
</body></html>`;
}

// ── Write pages ──
let n=0;
for(const c of COMPANIES){ const dir=path.join(OUT,c.slug); fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,'index.html'),page(c)); n++; }
fs.writeFileSync(path.join(OUT,'index.html'),hub());

// ── Refresh sitemap ──
const base=['/','/interview-guides/','/blog.html','/enterprise.html','/partner.html','/contact.html','/support.html','/privacy.html','/terms.html','/refund-policy.html','/shipping-policy.html'];
const guides=['/interview-guides/amazon-sde-2/',...COMPANIES.map(c=>`/interview-guides/${c.slug}/`)];
const urls=[...base.map(u=>({u,p:u==='/'?'1.0':'0.6'})),...guides.map(u=>({u,p:'0.8'}))];
const sm=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`+urls.map(x=>`  <url><loc>https://whis-ai.com${x.u}</loc><priority>${x.p}</priority></url>`).join('\n')+`\n</urlset>\n`;
fs.writeFileSync(path.join(ROOT,'sitemap.xml'),sm);

console.log(`generated ${n} company guides + hub (${HUB.length} total) + sitemap (${urls.length} urls)`);
