let lang="fr";try{const s=localStorage.getItem("ghf-lang");if(s&&T[s])lang=s}catch(e){}
const st={need:"any",meal:"any",area:"any",day:String(new Date().getDay()),open:false,who:"any",walk:false,pc:""};
const $=id=>document.getElementById(id);
function isOpenNow(s){const d=new Date(),m=d.getHours()*60+d.getMinutes();return s.sch&&s.sch.some(e=>e.d.includes(d.getDay())&&m>=toMin(e.t[0])&&m<toMin(e.t[1])&&!e.n)}
const esc=x=>String(x).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function card(r){
  const t=T[lang],s=r.s;
  const b=[`<span class="b">${t.free}</span>`];
  if(isOpenNow(s))b.unshift(`<span class="b open">● ${t.openNow}</span>`);
  b.push(`<span class="b ${s.access==="referral"?"warn":""}">${t.acc[s.access]}</span>`);
  if(s.aud==="women")b.push(`<span class="b stop">${t.women}</span>`);
  if(s.aud==="families")b.push(`<span class="b">${t.families}</span>`);
  // group slots by day
  const days={};r.slots.forEach(e=>e.d.forEach(d=>{(days[d]=days[d]||[]).push(e)}));
  const order=[1,2,3,4,5,6,0].filter(d=>days[d]&&(st.open||st.day==="any"||+st.day===d||r.slots===null));
  let rows="";
  order.forEach(d=>days[d].sort((a,b)=>toMin(a.t[0])-toMin(b.t[0])).forEach(e=>{
    rows+=`<li><span class="d">${t.days[d]}</span><span class="t">${e.t[0]}–${e.t[1]}</span><span>${t.k[e.k]}${e.x?` <span style="color:var(--muted)">(${esc(e.x)})</span>`:""}${e.w?` · <strong>${t.womenSlot}</strong>`:""}${e.n?` · <em>${t.n[e.n]}</em>`:""}</span></li>`}));
  if(r.unknown)rows=`<li>${t.hoursUnknown}</li>`;
  const area=s.area==="all"?t.all:AREAN[s.area];
  const srcs=s.src.map(k=>`<a href="${SRC[k].url}" target="_blank" rel="noopener">${esc(SRC[k].name)}</a> (${SRC[k].date})`).join(" · ");
  return `<article class="card">
    <div><h3>${esc(s.name)}</h3>${s.org?`<div class="meta">${esc(s.org)}</div>`:""}</div>
    <div class="meta"><span>📍 ${esc(area)}</span>${s.addr?`<span>${esc(s.addr)}</span>`:""}${s.phone?`<span>☎ <span class="num">${s.phone}</span> <button type="button" class="reset" style="padding:2px 8px" data-copy="${s.phone}">${t.copy}</button></span>`:""}</div>
    <div class="badges">${b.join("")}</div>
    <ul class="slots">${rows}</ul>
    ${s.notes.length?`<ul class="notes">${s.notes.map(n=>`<li>${t.n[n]}</li>`).join("")}</ul>`:""}
    ${s.link?`<div><a href="${s.link}" target="_blank" rel="noopener">${t.web} ↗</a></div>`:""}
    <div class="src">${t.src}: ${srcs} · ${t.checked} ${CHECKED}</div>
  </article>`;
}

function renderList(){
  const r=search(st);
  $("count").textContent=T[lang].count(r.length);
  $("list").innerHTML=r.length?r.map(card).join(""):`<div class="empty">${T[lang].none}</div>`;
  $("meal-wrap").hidden=st.need!=="meal";
}
function fillOptions(){
  const t=T[lang];
  $("f-need").innerHTML=NEEDS.map(n=>`<button type="button" data-need="${n}" aria-pressed="${st.need===n}">${t.needs[n]}</button>`).join("");
  $("f-meal").innerHTML=["any",...MEALK].map(m=>`<option value="${m}">${t.meals[m]}</option>`).join("");$("f-meal").value=st.meal;
  $("f-area").innerHTML=AREAS.map(a=>`<option value="${a}">${a==="any"?t.anyArea:AREAN[a]}</option>`).join("");$("f-area").value=st.area;
  const td=new Date().getDay();
  $("f-day").innerHTML=`<option value="any">${t.anyDay}</option>`+[1,2,3,4,5,6,0].map(d=>`<option value="${d}">${t.daysL[d]}${d===td?" ("+t.today+")":""}</option>`).join("");$("f-day").value=st.day;
  $("f-who").innerHTML=["any","woman","man","family"].map(w=>`<option value="${w}">${t.whos[w]}</option>`).join("");$("f-who").value=st.who;
}
function setLang(l){
  lang=l;try{localStorage.setItem("ghf-lang",l)}catch(e){}
  const t=T[l];document.documentElement.lang=l;document.documentElement.dir=l==="ar"?"rtl":"ltr";
  $("langs").innerHTML=LANGS.map(x=>`<button type="button" lang="${x}" data-lang="${x}" aria-pressed="${x===l}">${T[x].name}</button>`).join("");
  $("t-tag").textContent=t.tag;$("t-sos-h").textContent=t.sosH;$("t-sos").textContent=t.sos;
  $("tabs").innerHTML=["find","whys","tests","src"].map((v,i)=>`<button role="tab" data-view="${v}" aria-selected="${view===v}">${t.tabs[i]}</button>`).join("");
  $("l-need").textContent=t.need;$("l-meal").textContent=t.meal;$("l-area").textContent=t.area;$("l-day").textContent=t.day;
  $("l-open").textContent=t.open;$("l-who").textContent=t.who;$("l-walk").textContent=t.walk;$("l-pc").textContent=t.pc;$("h-pc").textContent=t.pcH;$("reset").textContent=t.reset;
  fillOptions();renderList();
}
let view="find";
function show(v){view=v;["find","whys","tests","src"].forEach(x=>$("v-"+x).hidden=x!==v);document.querySelectorAll("#tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.view===v));if(v==="tests")runTests()}

document.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.lang)setLang(b.dataset.lang);
  else if(b.dataset.view)show(b.dataset.view);
  else if(b.dataset.need){st.need=b.dataset.need;document.querySelectorAll("#f-need button").forEach(x=>x.setAttribute("aria-pressed",x===b));renderList()}
  else if(b.dataset.copy){const txt=b.dataset.copy,done=()=>{b.textContent=T[lang].copied};try{navigator.clipboard.writeText(txt).then(done,()=>{})}catch(err){}}
  else if(b.id==="reset"){Object.assign(st,{need:"any",meal:"any",area:"any",day:String(new Date().getDay()),open:false,who:"any",walk:false,pc:""});$("f-open").checked=false;$("f-walk").checked=false;$("f-pc").value="";fillOptions();renderList()}
  else if(b.id==="runtests")runTests();
});
$("f-meal").onchange=e=>{st.meal=e.target.value;renderList()};
$("f-area").onchange=e=>{st.area=e.target.value;renderList()};
$("f-day").onchange=e=>{st.day=e.target.value;renderList()};
$("f-who").onchange=e=>{st.who=e.target.value;renderList()};
$("f-open").onchange=e=>{st.open=e.target.checked;renderList()};
$("f-walk").onchange=e=>{st.walk=e.target.checked;renderList()};
$("f-pc").oninput=e=>{st.pc=e.target.value.replace(/\D/g,"");renderList()};

function runTests(){
  let pass=0;
  const rows=TESTS.map((tc,i)=>{
    const r=search({...base,...tc.f});
    const ids=r.map(x=>x.s.id);
    const hit=tc.exp.filter(e=>ids.includes(e));
    const ok=hit.length>0;if(ok)pass++;
    const top=r.slice(0,3).map(x=>x.s.name).join(", ")||"—";
    const expNames=tc.exp.map(id=>S.find(s=>s.id===id));
    const srcs=[...new Set(expNames.flatMap(s=>s.src))].map(k=>`<a href="${SRC[k].url}" target="_blank" rel="noopener">${esc(SRC[k].name)}</a> (${SRC[k].date})`).join(" · ");
    const fl=Object.entries(tc.f).map(([k,v])=>`${k}=${k==="day"?["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][v]:v}`).join(" · ");
    return `<div class="sc"><h3>${i+1}. ${ok?'<span class="b open">✓ correct</span>':'<span class="b stop">✗ missed</span>'} <span class="b">${T[tc.lang].name}</span></h3>
      <div>${esc(tc.p)}</div><div class="q">Filters: ${esc(fl)}</div>
      <div class="res">Expected: <strong>${expNames.map(s=>esc(s.name)).join(" or ")}</strong> · Directory returned ${r.length} place(s), first: ${esc(top)}</div>
      <div class="src">Source: ${srcs} · checked ${CHECKED}</div></div>`});
  $("v-tests").innerHTML=`<div class="score"><span class="big">${pass}/10</span><span>correct referrals. Each scenario runs the same filter code the directory uses.</span><button class="run" id="runtests" type="button">Run again</button></div>
   <p class="lang-note">Jury view in English. The directory itself works in French, English, Arabic, Ukrainian and Spanish.</p><div class="list">${rows.join("")}</div>`;
}

/* ---------- 5 Whys & Sources (jury-facing, English) ---------- */
$("v-whys").innerHTML=`
<p class="lang-note">Jury view in English.</p>
<h2>The problem</h2>
<p>Geneva's food-aid study (Cartographie de l'aide alimentaire, February 2024) mapped a large network of institutions and associations. The challenge brief cites 61,258 people seeking food or hygiene aid (CAPAS). The help exists. People still struggle to reach the right place quickly.</p>
<h2>Main chain</h2>
<ol class="why">
<li><span class="n">1</span><span><strong>Why don't people get help?</strong> They can't find the right organisation.</span></li>
<li><span class="n">2</span><span><strong>Why can't they find it?</strong> Information is spread over many websites, flyers and offices.</span></li>
<li><span class="n">3</span><span><strong>Why is that a problem?</strong> Every place has its own days, hours, audience and access rules, so comparing takes time.</span></li>
<li><span class="n">4</span><span><strong>Why is it hardest for this group?</strong> Many don't read French, are new in the city, and are under stress with no time to search.</span></li>
<li><span class="n">5</span><span><strong>Why is there no shortcut?</strong> No single, multilingual place matches a person's need, location, day and situation to the right service.</span></li>
</ol>
<p class="root"><strong>Root cause:</strong> the help exists, but the path to the help is built for people who already know the system.</p>
<h2>Four branches</h2>
<div class="tbl"><table><thead><tr><th>Branch</th><th>Root cause</th><th>Feature that answers it</th></tr></thead><tbody>
<tr><td>Scattered information</td><td>Nobody owns or funds one shared, up-to-date source</td><td>All places in one list, each with source link and date</td></tr>
<tr><td>Language</td><td>The system assumes people read French</td><td>Five languages in one tap, Arabic right-to-left</td></tr>
<tr><td>Complicated conditions</td><td>Rules are never turned into simple yes/no questions</td><td>Filters: who you are, walk-in only, postal code, day</td></tr>
<tr><td>Shame and trust</td><td>People don't know what is asked of them at the door</td><td>Clear badges: free, just walk in, ticket on site, referral needed</td></tr>
</tbody></table></div>
<h2>What this prototype does not solve</h2>
<p>Who keeps the data current after the hackathon. Schedules change (seasonal meals, closures). That is branch 1's root and needs an owner, for example the city's social service or the CAPAS network, updating one shared dataset.</p>`;

$("v-src").innerHTML=`
<p class="lang-note">Jury view in English.</p>
<h2>Dataset</h2>
<p>${S.length} services, built only from official or first-party pages. Every card shows its source and the date that source was published. All entries were checked on ${CHECKED}.</p>
<div class="tbl"><table><thead><tr><th>Source</th><th>Published</th><th>Used for</th></tr></thead><tbody>
<tr><td><a href="${SRC.feuillet.url}" target="_blank" rel="noopener">${SRC.feuillet.name}</a></td><td>July 2026</td><td>Addresses and weekly hours for meals, showers, care, shelter line</td></tr>
<tr><td><a href="${SRC.repas.url}" target="_blank" rel="noopener">${SRC.repas.name}</a></td><td>04.06.2026</td><td>Official list of free meal and day-centre associations</td></tr>
<tr><td><a href="${SRC.hyg.url}" target="_blank" rel="noopener">${SRC.hyg.name}</a></td><td>01.10.2025</td><td>Showers, laundry, Vestiaire social voucher rule</td></tr>
<tr><td><a href="${SRC.colis.url}" target="_blank" rel="noopener">${SRC.colis.name}</a></td><td>01.05.2026</td><td>ColiShop addresses, postal-code days, attestation rule</td></tr>
<tr><td><a href="${SRC.heb.url}" target="_blank" rel="noopener">${SRC.heb.name}</a></td><td>2026</td><td>30-day limit, dogs under conditions</td></tr>
<tr><td><a href="${SRC.carto.url}" target="_blank" rel="noopener">${SRC.carto.name}</a></td><td>February 2024</td><td>Problem context</td></tr>
</tbody></table></div>
<h2>How a referral is scored</h2>
<p>Each test scenario sets the same filters a real person would choose. It counts as correct when the expected service appears in the results. The filter code is the same code the directory runs.</p>
<h2>Left out on purpose</h2>
<p>Wheelchair access, halal or vegetarian food, and whether a place asks for ID were not stated in the sources, so the directory does not filter on them yet. Adding them means asking each organisation directly. Le CARÉ's winter weekend meal and Caritas épiceries are mentioned in the sources without exact days or a Geneva address, so they are noted but not scheduled.</p>`;

setLang(lang);
