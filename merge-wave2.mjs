import fs from 'fs';
const files = [
 '/Users/waseemsyed/.claude/projects/-Users-waseemsyed-Desktop/2f1f2869-1b0c-46a3-b135-a4e79f2a5311/tool-results/toolu_01At8MeLbj7AJoxT8tYhzdNU.json',
 '/Users/waseemsyed/.claude/projects/-Users-waseemsyed-Desktop/2f1f2869-1b0c-46a3-b135-a4e79f2a5311/tool-results/toolu_01Jfv1UTLCUXvxqpSuFAA8CQ.json'
];
let all=[];
for(const f of files){
  let raw; try{ raw=JSON.parse(fs.readFileSync(f,'utf8')); }catch(e){ console.error('read fail',f,e.message); continue; }
  const text = Array.isArray(raw)? raw.map(x=>x.text||'').join('\n') : (raw.text||raw.content||'');
  const m = text.match(/```json\s*([\s\S]*?)```/);
  let jsonStr = m ? m[1] : text.slice(text.indexOf('['), text.lastIndexOf(']')+1);
  let arr; try{ arr=JSON.parse(jsonStr); }catch(e){ console.error('parse fail',f,e.message); continue; }
  console.error('parsed',arr.length,'from',f.split('/').pop());
  all.push(...arr);
}
const req=['slug','name','mark','color','sector','tagline','difficulty','timeline','process','rounds','topics','eligibility','prep2','prepC','faq'];
const existing=new Set(['amazon-sde-2','tcs','infosys','wipro','accenture','cognizant','capgemini','hcltech','tech-mahindra']);
const seen=new Set(existing); const clean=[];
for(const c of all){
  const missing=req.filter(k=>!(k in c) || c[k]==null);
  if(missing.length){ console.error('SKIP',(c.slug||c.name),'missing:',missing.join(',')); continue; }
  if(!Array.isArray(c.rounds)||!Array.isArray(c.faq)||!Array.isArray(c.topics)){ console.error('SKIP',c.slug,'bad arrays'); continue; }
  if(seen.has(c.slug)){ console.error('DUP',c.slug); continue; }
  seen.add(c.slug); clean.push(c);
}
fs.writeFileSync('wave2.json', JSON.stringify(clean,null,1));
console.log('WAVE2 VALID:',clean.length);
console.log(clean.map(c=>c.slug).join(', '));
