import fs from 'fs';
import { COMPANIES } from './gen-guides.mjs';

const files = [
 '/Users/waseemsyed/.claude/projects/-Users-waseemsyed-Desktop/2f1f2869-1b0c-46a3-b135-a4e79f2a5311/tool-results/toolu_01FTozcMhEWQXu6i7NKzDLps.json',
 '/Users/waseemsyed/.claude/projects/-Users-waseemsyed-Desktop/2f1f2869-1b0c-46a3-b135-a4e79f2a5311/tool-results/toolu_011t2bzKY2HurJHuhqEBx1Me.json',
 '/Users/waseemsyed/.claude/projects/-Users-waseemsyed-Desktop/2f1f2869-1b0c-46a3-b135-a4e79f2a5311/tool-results/toolu_01X46H2PfuTQWREDUKkvbHjR.json'
];
const enriched = {};
for(const f of files){
  const raw = JSON.parse(fs.readFileSync(f,'utf8'));
  const text = Array.isArray(raw)? raw.map(x=>x.text||'').join('\n') : (raw.text||'');
  const m = text.match(/```json\s*([\s\S]*?)```/);
  const jsonStr = m ? m[1] : text.slice(text.indexOf('['), text.lastIndexOf(']')+1);
  let arr; try{ arr=JSON.parse(jsonStr); }catch(e){ console.error('parse fail',f.split('/').pop(),e.message); continue; }
  for(const c of arr) if(c && c.slug) enriched[c.slug]=c;
  console.error('extracted',arr.length,'from',f.split('/').pop());
}

let merged=0, plain=0;
const out = COMPANIES.map(base=>{
  const e = enriched[base.slug];
  if(e && Array.isArray(e.rounds) && e.rounds.length){
    merged++;
    return { ...base,
      overview: e.overview || base.tagline,
      rounds: e.rounds,                       // rich rounds (expect/themes/prepare/mistakes/signals)
      topics: e.topics || base.topics,
      eligibility: e.eligibility || base.eligibility,
      prep2: e.prep2 || base.prep2,
      prepC: e.prepC || base.prepC,
      faq: e.faq || base.faq };
  }
  plain++; return base;
});
fs.writeFileSync('guides.json', JSON.stringify(out,null,1));
console.log(`merged rich: ${merged} | plain: ${plain} | total ${out.length} -> guides.json`);
// quick depth check
const sample = out.find(c=>c.slug==='tcs');
console.log('tcs rounds:', sample.rounds.length, '| first round keys:', Object.keys(sample.rounds[0]).join(','));
