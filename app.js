
"use strict";
(function(){
const DATA=window.SFJ_DATA;
if(!DATA || !Array.isArray(DATA.foods) || !DATA.guides || !DATA.workouts){
  document.getElementById("fatal").classList.remove("hidden");
  document.getElementById("fatal").textContent="V15 startup error: app-data.js did not load correctly.";
  return;
}
const $=id=>document.getElementById(id);
const TODAY=new Date().toISOString().slice(0,10);
const KEY="sfj15:";
const MEALS=["Breakfast","Lunch","Dinner","Snacks"];
const defaults={calories:2050,protein:190,carbs:165,fat:58,fibre:35};
let state={
  page:"today", plan:"1", workoutStart:null, workoutTimer:null,
  activeExercise:null, activeFood:null, restTimer:null, restLeft:0,
  foodDate:TODAY, stream:null
};
function get(k,d){try{let v=localStorage.getItem(KEY+k);return v===null?d:JSON.parse(v)}catch(e){return d}}
function set(k,v){localStorage.setItem(KEY+k,JSON.stringify(v))}
function del(k){localStorage.removeItem(KEY+k)}
function toast(msg){$("toast").textContent=msg;$("toast").classList.remove("hidden");setTimeout(()=>$("toast").classList.add("hidden"),1700)}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function fmt(ms){let s=Math.max(0,Math.floor(ms/1000));return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}
function goals(){return {...defaults,...get("goals",{})}}
function workoutPlans(){return DATA.workouts}
function currentPlan(){return workoutPlans()[state.plan] || workoutPlans()["1"]}
function exerciseState(slug,setNo){return get(`set:${TODAY}:${state.plan}:${slug}:${setNo}`,{kg:"",reps:"",rir:"",done:false})}
function saveExerciseState(slug,setNo,v){set(`set:${TODAY}:${state.plan}:${slug}:${setNo}`,v)}
function extraSets(slug){return get(`extra:${state.plan}:${slug}`,0)}
function histories(slug){return get(`history:${slug}`,[])}
function exercisePR(slug){
  const sets=histories(slug).flatMap(x=>x.sets||[]).filter(x=>+x.kg>0&&+x.reps>0);
  return {kg:sets.length?Math.max(...sets.map(x=>+x.kg)):0,reps:sets.length?Math.max(...sets.map(x=>+x.reps)):0,e1:sets.length?Math.max(...sets.map(x=>+x.kg*(1+(+x.reps/30)))):0};
}
function nav(page){
  state.page=page;
  document.querySelectorAll(".screen").forEach(x=>x.classList.toggle("active",x.id===`screen-${page}`));
  document.querySelectorAll("[data-nav]").forEach(x=>x.classList.toggle("active",x.dataset.nav===page));
  if(page==="today") renderToday();
  if(page==="workout") renderWorkout();
  if(page==="meals") renderMeals();
  if(page==="progress") renderProgress();
  if(page==="more") renderMore();
  window.scrollTo(0,0);
}
document.querySelectorAll("[data-nav]").forEach(b=>b.addEventListener("click",()=>nav(b.dataset.nav)));

function workoutSummary(){
  const plan=currentPlan(); let exDone=0,setsDone=0,volume=0;
  plan.items.forEach(([slug,sets])=>{
    let completed=true;
    for(let i=1;i<=sets+extraSets(slug);i++){
      const s=exerciseState(slug,i);
      if(s.done){setsDone++;volume+=(+s.kg||0)*(+s.reps||0)}else completed=false;
    }
    if(completed)exDone++;
  });
  return {exDone,setsDone,volume,total:plan.items.length};
}
function renderWorkout(){
  const plans=workoutPlans(), plan=currentPlan(), sum=workoutSummary();
  $("planSelect").innerHTML=Object.entries(plans).map(([k,v])=>`<option value="${k}" ${k===state.plan?"selected":""}>${esc(v.title)}</option>`).join("");
  $("workoutTitle").textContent=plan.title;
  $("exerciseSummary").textContent=`${sum.exDone} / ${sum.total}`;
  $("setSummary").textContent=sum.setsDone;
  $("volumeSummary").textContent=`${Math.round(sum.volume)} kg`;
  $("workoutProgress").style.width=`${sum.total?sum.exDone/sum.total*100:0}%`;
  $("workoutList").innerHTML=plan.items.map(([slug,sets,reps,rest],idx)=>{
    const g=DATA.guides[slug]; if(!g)return `<div class="card">Missing guide: ${esc(slug)}</div>`;
    const pr=exercisePR(slug), prev=histories(slug)[0];
    let done=true;for(let i=1;i<=sets+extraSets(slug);i++)if(!exerciseState(slug,i).done)done=false;
    return `<article class="exerciseCard">
      <div class="exerciseTop">
        <div class="number">${idx+1}</div>
        <div><h3>${esc(g.title)}</h3><p>${esc(g.muscles)} · ${sets} sets · ${esc(reps)}</p></div>
        <img src="${esc(g.illustration)}" alt="">
      </div>
      <div class="cardStats">
        <div><span>HEAVIEST</span><b>${pr.kg?pr.kg+" kg":"—"}</b></div>
        <div><span>MOST REPS</span><b>${pr.reps||"—"}</b></div>
        <div><span>EST. 1RM</span><b>${pr.e1?pr.e1.toFixed(1):"—"}</b></div>
      </div>
      <div class="cardBottom"><span class="doneText">${done?"✓ Completed":prev?`Previous: ${(prev.sets||[]).map(s=>`${s.kg||"-"}×${s.reps||"-"}`).join(" · ")}`:"Ready to train"}</span><button data-open-exercise="${slug}" data-index="${idx}">Open</button></div>
    </article>`;
  }).join("");
  document.querySelectorAll("[data-open-exercise]").forEach(b=>b.onclick=()=>openExercise(b.dataset.openExercise,+b.dataset.index));
}
$("planSelect").onchange=e=>{state.plan=e.target.value;renderWorkout()};
$("startWorkout").onclick=()=>{
  if(state.workoutTimer){clearInterval(state.workoutTimer);state.workoutTimer=null;$("startWorkout").textContent="Resume workout";return}
  const elapsed=get(`elapsed:${TODAY}:${state.plan}`,0);state.workoutStart=Date.now()-elapsed;
  state.workoutTimer=setInterval(()=>{const v=Date.now()-state.workoutStart;set(`elapsed:${TODAY}:${state.plan}`,v);$("workoutClock").textContent=fmt(v)},1000);
  $("startWorkout").textContent="Pause workout";
};
$("finishWorkout").onclick=()=>{
  const plan=currentPlan(), sum=workoutSummary(), duration=get(`elapsed:${TODAY}:${state.plan}`,0);
  plan.items.forEach(([slug,sets])=>{
    const all=[];for(let i=1;i<=sets+extraSets(slug);i++)all.push(exerciseState(slug,i));
    const h=histories(slug).filter(x=>x.date!==TODAY);h.unshift({date:TODAY,sets:all});set(`history:${slug}`,h.slice(0,30));
  });
  const sessions=get("sessions",[]).filter(x=>!(x.date===TODAY&&x.plan===state.plan));
  sessions.unshift({id:Date.now(),date:TODAY,plan:state.plan,title:plan.title,duration,volume:sum.volume,sets:sum.setsDone});
  set("sessions",sessions.slice(0,100)); clearInterval(state.workoutTimer);state.workoutTimer=null;state.workoutStart=null;del(`elapsed:${TODAY}:${state.plan}`);
  $("workoutClock").textContent="00:00";$("startWorkout").textContent="Start workout";toast("Workout saved");renderWorkout();
};

function openExercise(slug,index){
  const plan=currentPlan(), item=plan.items[index], g=DATA.guides[slug], baseSets=item[1], reps=item[2], rest=item[3], total=baseSets+extraSets(slug), pr=exercisePR(slug), hist=histories(slug);
  state.activeExercise={slug,index};
  $("exerciseName").textContent=g.title;
  const rows=Array.from({length:total},(_,n)=>{
    const i=n+1,s=exerciseState(slug,i);
    return `<div class="setRow"><b>${i}</b><div class="weightControl"><button data-minus="${i}">−</button><input data-set="${i}" data-field="kg" type="number" step="0.5" value="${esc(s.kg)}"><button data-plus="${i}">+</button></div><input data-set="${i}" data-field="reps" type="number" value="${esc(s.reps)}"><select data-set="${i}" data-field="rir"><option value="">—</option>${[0,1,2,3].map(x=>`<option ${String(s.rir)===String(x)?"selected":""} value="${x}">${x}${x===3?"+":""}</option>`).join("")}</select><input data-set="${i}" data-field="done" type="checkbox" ${s.done?"checked":""}></div>`;
  }).join("");
  $("tab-overview").innerHTML=`<img class="heroImage" src="${esc(g.illustration)}" alt="${esc(g.title)} muscle anatomy map"><p class="visualNote">The red areas show the main muscles trained. Use the video below for body position and movement.</p>
    <a href="${esc(g.direct_demo||g.video)}" target="_blank" rel="noopener"><button class="primary full">▶ Watch movement demonstration video</button></a>
    <div class="prGrid detailBox"><div><span>HEAVIEST</span><b>${pr.kg?pr.kg+" kg":"—"}</b></div><div><span>MOST REPS</span><b>${pr.reps||"—"}</b></div><div><span>EST. 1RM</span><b>${pr.e1?pr.e1.toFixed(1):"—"}</b></div></div>
    <div class="detailBox"><h3>Previous sessions</h3>${hist.slice(0,6).map((h,hi)=>`<button class="full" data-copy-history="${hi}">${esc(h.date)} · ${(h.sets||[]).map(s=>`${s.kg||"-"}×${s.reps||"-"}`).join(" · ")}</button>`).join("")||'<p class="muted">No previous sessions yet.</p>'}</div>
    <details class="detailBox"><summary><b>Setup & technique</b></summary><ol>${(g.setup||g.steps||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ol><ol>${(g.movement||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ol></details>
    <details class="detailBox"><summary><b>Common mistakes</b></summary><ul>${(g.mistakes||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></details>
    <div class="restButtons">${[30,60,90,120].map(x=>`<button data-rest="${x}">${x}s</button>`).join("")}<button data-rest="custom">Custom</button></div>
    <div class="setsHead"><span>SET</span><span>WEIGHT</span><span>REPS</span><span>RIR</span><span>DONE</span></div>${rows}
    <button class="full" id="addSet">+ Add set</button><button class="primary full" id="saveExercise">Save exercise</button>`;
  $("tab-muscles").innerHTML=`<div class="detailBox"><h3>Primary muscles</h3><p>${esc(g.muscles)}</p><h3>Equipment</h3><p>${esc(g.equipment)}</p><p class="muted">${esc(g.beginner_tip||"")}</p></div>`;
  $("tab-notes").innerHTML=`<div class="detailBox"><textarea id="exerciseNotes" rows="9" placeholder="Personal technique or progression notes">${esc(get(`note:${slug}`,""))}</textarea><button class="primary full" id="saveNote">Save note</button></div>`;
  $("exerciseModal").classList.remove("hidden");
  bindExerciseModal(slug,index,total,rest,hist);
}
function bindExerciseModal(slug,index,total,rest,hist){
  document.querySelectorAll("[data-set]").forEach(e=>e.onchange=()=>{
    const i=+e.dataset.set,s=exerciseState(slug,i);s[e.dataset.field]=e.type==="checkbox"?e.checked:e.value;saveExerciseState(slug,i,s);
    if(e.dataset.field==="done"&&e.checked)startRest(rest||60);renderWorkout();
  });
  document.querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>{const e=document.querySelector(`[data-set="${b.dataset.plus}"][data-field="kg"]`);e.value=(+e.value||0)+2.5;e.dispatchEvent(new Event("change"))});
  document.querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>{const e=document.querySelector(`[data-set="${b.dataset.minus}"][data-field="kg"]`);e.value=Math.max(0,(+e.value||0)-2.5);e.dispatchEvent(new Event("change"))});
  document.querySelectorAll("[data-rest]").forEach(b=>b.onclick=()=>{let s=b.dataset.rest==="custom"?+prompt("Rest time in seconds","60"):+b.dataset.rest;if(s)startRest(s)});
  document.querySelectorAll("[data-copy-history]").forEach(b=>b.onclick=()=>{const h=hist[+b.dataset.copyHistory];(h.sets||[]).forEach((s,n)=>{["kg","reps","rir"].forEach(f=>{const e=document.querySelector(`[data-set="${n+1}"][data-field="${f}"]`);if(e){e.value=s[f]??"";e.dispatchEvent(new Event("change"))}})});toast("Previous session copied")});
  $("addSet").onclick=()=>{set(`extra:${state.plan}:${slug}`,extraSets(slug)+1);openExercise(slug,index)};
  $("saveExercise").onclick=()=>{const arr=[];for(let i=1;i<=total;i++)arr.push(exerciseState(slug,i));const h=histories(slug).filter(x=>x.date!==TODAY);h.unshift({date:TODAY,sets:arr});set(`history:${slug}`,h.slice(0,30));$("exerciseModal").classList.add("hidden");renderWorkout();toast("Exercise saved")};
  $("saveNote").onclick=()=>{set(`note:${slug}`,$("exerciseNotes").value);toast("Note saved")};
}
$("closeExercise").onclick=()=>$("exerciseModal").classList.add("hidden");
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));
  ["overview","muscles","notes"].forEach(x=>$(`tab-${x}`).classList.toggle("hidden",x!==b.dataset.tab));
});
function startRest(seconds){
  clearInterval(state.restTimer);state.restLeft=seconds;$("restDock").classList.remove("hidden");
  const tick=()=>{$("restClock").textContent=`Rest ${fmt(state.restLeft*1000)}`;$("restSummary").textContent=`${state.restLeft}s`;if(state.restLeft<=0){clearInterval(state.restTimer);navigator.vibrate?.([200,100,200]);toast("Rest complete");$("restDock").classList.add("hidden");$("restSummary").textContent="—"}};
  tick();state.restTimer=setInterval(()=>{state.restLeft--;tick()},1000);
}
$("restMinus").onclick=()=>state.restLeft=Math.max(0,state.restLeft-15);
$("restPlus").onclick=()=>state.restLeft+=15;
$("restStop").onclick=()=>{clearInterval(state.restTimer);$("restDock").classList.add("hidden");$("restSummary").textContent="—"};

function foodN(f,k){const map={calories:"cal",protein:"p",carbs:"c",fat:"f",fibre:"fib"};return +(f[k]??f[map[k]]??0)}
function foodServing(f){return f.serving||f.per||(f.count_g?`${f.count_g} g each`:"100 g")}
function foodLog(date=state.foodDate){return get(`food:${date}`,[])}
function saveFoodLog(v,date=state.foodDate){set(`food:${date}`,v)}
function foodMacros(date=state.foodDate){
  return foodLog(date).reduce((a,x)=>{a.calories+=+x.calories||0;a.protein+=+x.protein||0;a.carbs+=+x.carbs||0;a.fat+=+x.fat||0;a.fibre+=+x.fibre||0;return a},{calories:0,protein:0,carbs:0,fat:0,fibre:0});
}
function macroHtml(vals){
  const g=goals();return [["Calories","calories",""],["Protein","protein","g"],["Carbs","carbs","g"],["Fat","fat","g"],["Fibre","fibre","g"]].map(([n,k,u])=>`<div><span>${n}</span><b>${Math.round(vals[k])}${u} / ${g[k]}${u}</b></div>`).join("");
}
function normalized(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()}
function searchFoods(q){
  const terms=normalized(q).split(" ").filter(Boolean);
  if(!terms.length)return DATA.foods.slice(0,20);
  return DATA.foods.map(f=>{
    const hay=normalized([f.name,f.brand,f.category,f.tags,f.search,f.source].join(" "));
    let score=0;terms.forEach(t=>{if(hay===t)score+=20;else if(hay.startsWith(t))score+=12;else if(hay.includes(t))score+=7;else{const words=hay.split(" ");if(words.some(w=>w.startsWith(t.slice(0,Math.max(2,t.length-1)))))score+=3}});
    return {f,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.f.name.localeCompare(b.f.name)).slice(0,50).map(x=>x.f);
}
function renderFoodResults(){
  const results=searchFoods($("foodSearch").value);
  $("foodResults").innerHTML=results.map((f,i)=>`<div class="foodResult"><div><b>${esc(f.name)}</b><div class="muted">${esc(f.brand||f.source||f.category||"")} · ${Math.round(foodN(f,"calories"))} kcal / ${foodServing(f)}</div></div><button data-food-index="${DATA.foods.indexOf(f)}">Add</button></div>`).join("")||'<p class="muted">No matching foods.</p>';
  document.querySelectorAll("[data-food-index]").forEach(b=>b.onclick=()=>openFood(DATA.foods[+b.dataset.foodIndex]));
}
function openFood(f){
  state.activeFood=f;$("foodName").textContent=f.name;
  $("foodDetail").innerHTML=`<div class="foodDetailMacros"><div><span>CAL</span><b>${Math.round(foodN(f,"calories"))}</b></div><div><span>PROTEIN</span><b>${foodN(f,"protein")}g</b></div><div><span>CARBS</span><b>${foodN(f,"carbs")}g</b></div><div><span>FAT</span><b>${foodN(f,"fat")}g</b></div></div>
    <label>Quantity / servings<input id="foodQty" type="number" min="0.1" step="0.1" value="1"></label>
    <label>Meal<select id="foodMeal">${MEALS.map(x=>`<option ${x===$("mealSelect").value?"selected":""}>${x}</option>`).join("")}</select></label>
    <button class="primary full" id="confirmFood">Add to diary</button>`;
  $("foodModal").classList.remove("hidden");
  $("confirmFood").onclick=()=>{const qty=+$("foodQty").value||1,log=foodLog();log.push({id:Date.now(),meal:$("foodMeal").value,name:f.name,qty,calories:foodN(f,"calories")*qty,protein:foodN(f,"protein")*qty,carbs:foodN(f,"carbs")*qty,fat:foodN(f,"fat")*qty,fibre:foodN(f,"fibre")*qty});saveFoodLog(log);$("foodModal").classList.add("hidden");renderMeals();toast("Food added")};
}
$("closeFood").onclick=()=>$("foodModal").classList.add("hidden");
$("foodSearch").oninput=renderFoodResults;
$("mealDate").onchange=e=>{state.foodDate=e.target.value;renderMeals()};
function renderMeals(){
  $("mealDate").value=state.foodDate;$("mealMacros").innerHTML=macroHtml(foodMacros());
  const log=foodLog();
  $("mealSections").innerHTML=MEALS.map(meal=>{
    const items=log.filter(x=>x.meal===meal),cal=items.reduce((a,x)=>a+x.calories,0);
    return `<section class="mealSection"><h3>${meal}<span>${Math.round(cal)} kcal</span></h3>${items.map(x=>`<div class="mealItem"><div><b>${esc(x.name)}</b><div class="muted">${Math.round(x.calories)} kcal · P ${x.protein.toFixed(1)} · C ${x.carbs.toFixed(1)} · F ${x.fat.toFixed(1)}</div></div><button data-remove-food="${x.id}">×</button></div>`).join("")||'<p class="muted">No foods logged.</p>'}</section>`;
  }).join("");
  document.querySelectorAll("[data-remove-food]").forEach(b=>b.onclick=()=>{saveFoodLog(log.filter(x=>String(x.id)!==b.dataset.removeFood));renderMeals()});
  renderFoodResults();
}

$("barcodeButton").onclick=()=>$("barcodeModal").classList.remove("hidden");
$("closeBarcode").onclick=()=>closeBarcode();
function closeBarcode(){if(state.stream)state.stream.getTracks().forEach(t=>t.stop());state.stream=null;$("barcodeVideo").classList.add("hidden");$("barcodeModal").classList.add("hidden")}
function barcodeLookup(code){
  const f=DATA.foods.find(x=>String(x.barcode||x.ean||"")===String(code));
  if(f){closeBarcode();openFood(f)}else $("barcodeStatus").innerHTML='<p class="muted">Barcode not found in the offline food database. Search by product name instead.</p>';
}
$("lookupBarcode").onclick=()=>barcodeLookup($("barcodeInput").value.trim());
$("scanBarcode").onclick=async()=>{
  if(!("BarcodeDetector" in window)){ $("barcodeStatus").innerHTML='<p class="muted">Camera barcode detection is not supported by this browser. Enter the barcode manually.</p>';return}
  try{
    const detector=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e"]});
    state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
    const v=$("barcodeVideo");v.srcObject=state.stream;v.classList.remove("hidden");await v.play();
    $("barcodeStatus").textContent="Point the camera at the barcode.";
    const scan=async()=>{if(!state.stream)return;const codes=await detector.detect(v);if(codes[0]){barcodeLookup(codes[0].rawValue);return}requestAnimationFrame(scan)};scan();
  }catch(e){$("barcodeStatus").innerHTML=`<p class="muted">Camera could not start: ${esc(e.message)}</p>`}
};

function renderToday(){
  $("todayDate").textContent=new Date().toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long"});
  const macros=foodMacros(TODAY);$("todayMacros").innerHTML=macroHtml(macros);
  const p=currentPlan(),sum=workoutSummary();$("todayWorkout").innerHTML=`<b>${esc(p.title)}</b><p class="muted">${p.items.length} exercises · ${sum.setsDone} sets completed</p>`;
  const checks=get(`checks:${TODAY}`,{});document.querySelectorAll("[data-check]").forEach(x=>x.checked=!!checks[x.dataset.check]);
  const g=goals(),macroScore=Math.min(1,macros.protein/g.protein)*40+Math.min(1,macros.fibre/g.fibre)*20;
  const checkScore=Object.values(checks).filter(Boolean).length/3*20,workoutScore=(sum.exDone/sum.total||0)*20;
  $("todayScore").textContent=Math.round(macroScore+checkScore+workoutScore)+"%";
}
document.querySelectorAll("[data-check]").forEach(c=>c.onchange=()=>{const x=get(`checks:${TODAY}`,{});x[c.dataset.check]=c.checked;set(`checks:${TODAY}`,x);renderToday()});

function renderProgress(){
  $("healthDate").value=TODAY;const health=get("health",[]).sort((a,b)=>a.date.localeCompare(b.date));
  $("healthHistory").innerHTML=health.slice().reverse().slice(0,12).map(x=>`<div class="historyRow"><span>${esc(x.date)}</span><b>${x.weight||"—"} kg · ${x.waist||"—"} cm · ${x.steps||0} steps</b></div>`).join("")||'<p class="muted">No measurements yet.</p>';
  $("sessionHistory").innerHTML=get("sessions",[]).slice(0,20).map(x=>`<div class="historyRow"><span>${esc(x.date)} · ${esc(x.title)}</span><b>${x.sets} sets · ${Math.round(x.volume)} kg · ${fmt(x.duration)}</b></div>`).join("")||'<p class="muted">No workouts saved yet.</p>';
  drawWeight(health);
}
$("saveHealth").onclick=()=>{
  const row={date:$("healthDate").value,weight:+$("healthWeight").value||null,waist:+$("healthWaist").value||null,steps:+$("healthSteps").value||0};
  let h=get("health",[]).filter(x=>x.date!==row.date);h.push(row);set("health",h);renderProgress();toast("Measurements saved");
};
function drawWeight(rows){
  const c=$("weightChart"),ctx=c.getContext("2d"),dpr=window.devicePixelRatio||1,w=c.clientWidth||760,h=260;c.width=w*dpr;c.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
  const vals=rows.filter(x=>x.weight).slice(-20);ctx.strokeStyle="#294865";ctx.lineWidth=1;for(let i=1;i<5;i++){let y=i*h/5;ctx.beginPath();ctx.moveTo(35,y);ctx.lineTo(w-10,y);ctx.stroke()}
  if(vals.length<2){ctx.fillStyle="#9fb3ca";ctx.font="13px sans-serif";ctx.fillText("Add at least two weight entries to see a trend.",20,40);return}
  const min=Math.min(...vals.map(x=>x.weight))-1,max=Math.max(...vals.map(x=>x.weight))+1;
  ctx.strokeStyle="#55d198";ctx.lineWidth=3;ctx.beginPath();vals.forEach((x,i)=>{const px=35+i*(w-55)/(vals.length-1),py=15+(max-x.weight)/(max-min)*(h-45);i?ctx.lineTo(px,py):ctx.moveTo(px,py)});ctx.stroke();
  ctx.fillStyle="#f7fbff";ctx.font="11px sans-serif";vals.forEach((x,i)=>{const px=35+i*(w-55)/(vals.length-1),py=15+(max-x.weight)/(max-min)*(h-45);ctx.beginPath();ctx.arc(px,py,3,0,Math.PI*2);ctx.fill();if(i===0||i===vals.length-1)ctx.fillText(x.weight.toFixed(1),px-10,py-9)});
}

function renderMore(){
  const g=goals();Object.keys(g).forEach(k=>{const el=$("goal"+k[0].toUpperCase()+k.slice(1));if(el)el.value=g[k]});
  $("diagnostics").innerHTML=`Version: 15.1<br>Foods loaded: ${DATA.foods.length}<br>Exercise guides: ${Object.keys(DATA.guides).length}<br>Workout plans: ${Object.keys(DATA.workouts).length}<br>Storage available: ${typeof localStorage!=="undefined"?"Yes":"No"}<br>Service worker: ${"serviceWorker" in navigator?"Supported":"Not supported"}<br>BarcodeDetector: ${"BarcodeDetector" in window?"Supported":"Manual entry only"}`;
}
$("saveGoals").onclick=()=>{const g={};["Calories","Protein","Carbs","Fat","Fibre"].forEach(k=>g[k.toLowerCase()]=+$("goal"+k).value);set("goals",g);renderMore();toast("Targets saved")};
$("exportData").onclick=()=>{const all={version:15,exported:new Date().toISOString(),data:{}};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(KEY))all.data[k]=localStorage.getItem(k)}const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(all,null,2)],{type:"application/json"}));a.download=`Sams_Fitness_V15_Backup_${TODAY}.json`;a.click();URL.revokeObjectURL(a.href)};
$("importData").onchange=async e=>{try{const o=JSON.parse(await e.target.files[0].text());Object.entries(o.data||{}).forEach(([k,v])=>localStorage.setItem(k,v));location.reload()}catch(err){alert("Invalid V15 backup file.")}};
$("resetData").onclick=()=>{if(confirm("Delete all Sam's Fitness V15 data from this browser?")){Object.keys(localStorage).filter(k=>k.startsWith(KEY)).forEach(k=>localStorage.removeItem(k));location.reload()}};

window.addEventListener("error",e=>{console.error(e.error||e.message)});
window.addEventListener("unhandledrejection",e=>{console.error(e.reason)});
$("mealDate").value=TODAY;
renderWorkout();renderToday();renderMeals();renderMore();
if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("service-worker.js").catch(console.warn);
})();
