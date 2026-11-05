 'use strict';
// Eigenständige Weihnachtsvariante. Weder Cache noch Einstellungen der Lernkasse werden verändert.
const moneyPath = 'icons/';
const denominations = [5000,2000,1000,500,200,100,50,20,10,5,2,1];
const splitMap = {5000:[2000,2000,1000],2000:[1000,1000],1000:[500,500],500:[200,200,100],200:[100,100],100:[50,50],50:[20,20,10],20:[10,10],10:[5,5],5:[2,2,1],2:[1,1]};
const settingsKey = 'weihnachtskasse-settings-v1';
const productsKey = 'weihnachtskasse-products-v1';
const sizeNames = {klein:'Klein',mittel:'Mittel',gross:'Groß'};
const defaultProducts = [
  {id:'artikel-1',name:'Artikel 1',price:100,sizes:{klein:100,mittel:150,gross:200}},
  {id:'artikel-2',name:'Artikel 2',price:200,sizes:{klein:200,mittel:250,gross:300}}
];
let products = defaultProducts.map(p=>({...p,sizes:{...p.sizes}}));
let settings = {speech:true,difficulty:'normal',highContrast:false,priceMode:'original',sizes:{klein:false,mittel:false,gross:false}};
let state = {screen:'shop',cart:[],paid:[],change:[],customer:1,sales:[],practice:false,practiceTask:null};
const pictureUrls = new Map();
let dbPromise = null;
const app = document.getElementById('app');
const euro = new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'});
const fmt = cents => euro.format(cents/100);
const fmtSpeak = cents => fmt(cents).replace('€','Euro').replace(',00','');
const moneyLabel = cents => cents>=100 ? `${cents/100} Euro` : `${cents} Cent`;
const moneyFile = cents => cents>=100 ? `${cents/100}-euro.png` : `${cents}-cent.png`;
const esc = value => String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const productById = id => products.find(p=>p.id===id);
const moneyFromInput = input => {
  const n = Number(String(input).replace(',','.'));
  return Number.isFinite(n)&&n>=0&&n<=99999 ? Math.round(n*100) : null;
};
const decimalPrice = cents => (cents/100).toFixed(2);
function speak(text){if(!settings.speech)return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='de-DE';u.rate=.88;speechSynthesis.speak(u)}catch(e){}}
function total(){return state.cart.reduce((sum,item)=>sum+item.price,0)}
function paidTotal(){return state.paid.reduce((sum,cents)=>sum+cents,0)}
function groups(){
  const map=new Map();
  state.cart.forEach(item=>{
    const key=`${item.productId}:${item.size}`;
    const group=map.get(key)||{...item,count:0,total:0};
    group.count++;group.total+=item.price;map.set(key,group);
  });
  return [...map.values()];
}
function closeDialog(id){document.getElementById(id).close()}
window.closeDialog=closeDialog;
function setScreen(screen){state.screen=screen;render();if(screen==='pay'){window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0;app.scrollTop=0;scheduleFitPay()}}
function init(){
  loadSettings();loadProducts();bindTopButtons();render();
  loadAllPictures();
  if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  window.addEventListener('resize',scheduleFitPay);
  window.visualViewport?.addEventListener('resize',scheduleFitPay);
}
function bindTopButtons(){
  document.getElementById('helpBtn').onclick=()=>document.getElementById('helpDialog').showModal();
  document.getElementById('infoBtn').onclick=()=>document.getElementById('infoDialog').showModal();
  document.getElementById('reportBtn').onclick=openReport;
  document.getElementById('teacherBtn').onclick=openTeacher;
  document.getElementById('practiceBtn').onclick=()=>state.practice?normalMode():startPractice();
  document.getElementById('downloadCsvBtn').onclick=downloadCsv;
  document.getElementById('downloadPdfBtn').onclick=downloadPdf;
}
function loadSettings(){
  try{const s=JSON.parse(localStorage.getItem(settingsKey)||'null');if(s){settings={...settings,...s,sizes:{...settings.sizes,...s.sizes}}}}catch(e){}
  applySettingsClass();
}
function saveSettings(){try{localStorage.setItem(settingsKey,JSON.stringify(settings))}catch(e){alert('Einstellungen konnten nicht gespeichert werden.')}applySettingsClass()}
function loadProducts(){
  try{
    const saved=JSON.parse(localStorage.getItem(productsKey)||'null');
    if(Array.isArray(saved))products=saved.filter(p=>p&&typeof p.id==='string').map(p=>({
      id:p.id,name:String(p.name||'Artikel'),price:Number.isInteger(p.price)?p.price:100,
      sizes:{klein:100,mittel:150,gross:200,...p.sizes}
    }));
  }catch(e){}
}
function saveProducts(){
  try{localStorage.setItem(productsKey,JSON.stringify(products));return true}
  catch(e){alert('Artikel konnten nicht gespeichert werden. Bitte freien Gerätespeicher prüfen.');return false}
}
function applySettingsClass(){
  document.body.classList.toggle('contrastMode',!!settings.highContrast);
  document.body.classList.remove('moneyStandard','moneyGross','moneyXxl','largeMode');
  document.body.classList.add('moneyXxl');
}
function render(){
  document.getElementById('customerBadge').textContent=state.practice?'Übungsmodus':`Kunde ${state.customer}`;
  const practiceBtn=document.getElementById('practiceBtn');
  practiceBtn.textContent=state.practice?'Normalmodus':'🎲 Üben';
  document.body.classList.toggle('isPay',state.screen==='pay');
  document.body.classList.toggle('isChange',state.screen==='change');
  if(state.screen==='shop')renderShop();
  if(state.screen==='pay')renderPay();
  if(state.screen==='change')renderChange();
  if(state.screen==='done')renderDone();
  if(state.screen==='pay')scheduleFitPay();
}
function pictureHtml(id){
  const url=pictureUrls.get(id);
  return url?`<img src="${url}" alt="">`:'<span class="productPlaceholder" aria-hidden="true">🎁</span>';
}
function productCard(product){
  const sizes=Object.keys(sizeNames).filter(s=>settings.sizes[s]);
  const base=sizes.length?'':`<button class="baseBuy" data-product="${esc(product.id)}" data-size="" aria-label="${esc(product.name)}, ${fmt(priceOf(product,''))}">${fmt(priceOf(product,''))} <span aria-hidden="true">＋</span></button>`;
  return `<article class="productCard productTile" data-tile-id="${esc(product.id)}" aria-label="${esc(product.name)}"><div class="productPhoto">${pictureHtml(product.id)}</div><span class="productName">${esc(product.name)}</span>${base}${sizes.length?`<div class="sizeChoices">${sizes.map(s=>`<button class="sizeBuy size-${s}" data-product="${esc(product.id)}" data-size="${s}" aria-label="${esc(product.name)} ${sizeNames[s]}, ${fmt(priceOf(product,s))}"><span>${sizeNames[s]}</span><strong>${fmt(priceOf(product,s))}</strong></button>`).join('')}</div>`:''}</article>`;
}
function renderShop(){
  app.innerHTML=`<section class="screen"><div class="shopGrid christmasShop"><section class="panel productPanel"><div class="productHeader"><div><h1>🎄 Weihnachtskasse</h1>${state.practice?'<p class="practiceHint">Übung: Produkte liegen bereit. Kassiere diesen Einkauf.</p>':''}<p class="christmasSubtitle">❄️ Artikel antippen und kassieren ❄️</p></div><button class="ghost dark clearCartIcon" id="clearCartBtn" title="Einkauf löschen" aria-label="Einkauf löschen">🗑️</button></div><div class="productGrid">${products.length?products.map(productCard).join(''):'<p class="hint">Noch keine Artikel. Über ⚙️ können Artikel angelegt werden.</p>'}</div></section><aside class="panel cartPanel"><h2>Warenkorb</h2><div class="cartItems">${renderCartRows()}</div><div class="totalBox"><span>Summe</span><strong>${fmt(total())}</strong></div><div class="checkoutFooter"><button class="primary" id="checkoutBtn" ${state.cart.length?'':'disabled'}>💶 Zur Kasse</button></div></aside></div></section>`;
  app.querySelectorAll('[data-product]').forEach(button=>button.onclick=()=>addProduct(button.dataset.product,button.dataset.size||''));
  app.querySelectorAll('[data-tile-id]').forEach(tile=>tile.onclick=event=>{if(!event.target.closest('button')&&!Object.values(settings.sizes).some(Boolean))addProduct(tile.dataset.tileId,'')});
  app.querySelectorAll('[data-minus]').forEach(button=>button.onclick=()=>removeOne(button.dataset.minus,button.dataset.size||''));
  app.querySelectorAll('[data-plus]').forEach(button=>button.onclick=()=>addProduct(button.dataset.plus,button.dataset.size||''));
  document.getElementById('checkoutBtn').onclick=()=>{if(!state.cart.length)return;state.paid=[];setScreen('pay')};
  document.getElementById('clearCartBtn').onclick=()=>{if(confirm('Warenkorb wirklich leeren?'))clearCart()};
}
function renderCartRows(){
  if(!state.cart.length)return '<p class="hint">Noch keine Produkte im Warenkorb.</p>';
  return groups().map(g=>`<div class="cartRow"><div><div class="cartName">${g.count}× ${esc(g.name)}</div><div class="cartMeta">${fmt(g.price)} einzeln · ${fmt(g.total)}</div></div><div class="qty"><button class="minus" data-minus="${esc(g.productId)}" data-size="${esc(g.size)}" aria-label="${esc(g.name)} entfernen">−</button><strong>${g.count}</strong><button data-plus="${esc(g.productId)}" data-size="${esc(g.size)}" aria-label="${esc(g.name)} hinzufügen">+</button></div></div>`).join('');
}
function addProduct(id,size=''){
  const p=productById(id);if(!p)return;
  // Ist eine Größe aktiv, darf kein unsichtbarer Grundpreis gebucht werden.
  if(size?!settings.sizes[size]:Object.values(settings.sizes).some(Boolean))return;
  state.cart.push({productId:id,size,name:p.name+(size?' · '+sizeNames[size]:''),price:priceOf(p,size)});
  render();
}
function removeOne(id,size=''){
  const i=state.cart.findIndex(x=>x.productId===id&&x.size===size);
  if(i>=0)state.cart.splice(i,1);
  render();
}
function clearCart(){state.cart=[];state.paid=[];state.change=[];state.practice=false;state.practiceTask=null;render()}
window.clearCart=clearCart;
function priceOf(p,size=''){
  const cents=(size?Number(p.sizes?.[size]):Number(p.price));
  const raw=Number.isFinite(cents)?Math.max(0,Math.round(cents)):100;
  const mode=settings.priceMode||'original';
  if(mode==='full')return Math.round(raw/100)*100;
  if(mode==='half')return Math.round(raw/50)*50;
  if(mode==='ten')return Math.round(raw/10)*10;
  return raw;
}
function syncCartPrices(){
  state.cart=state.cart.filter(item=>productById(item.productId)&&(item.size?settings.sizes[item.size]:!Object.values(settings.sizes).some(Boolean))).map(item=>{
    const p=productById(item.productId);
    return {...item,name:p.name+(item.size?' · '+sizeNames[item.size]:''),price:priceOf(p,item.size)};
  });
  if(state.screen==='pay'||state.screen==='change'){state.paid=[];state.change=[];state.screen='shop';}
  render();
}
// Nur der Bezahlbildschirm wird bei kleinen Displays proportional eingepasst.
// Dessen HTML, Geldbilder, Reihenfolge und Schaltflächen entsprechen der Original-App.
let fitFrame=0;
function scheduleFitPay(){
  cancelAnimationFrame(fitFrame);
  if(state.screen==='pay')fitFrame=requestAnimationFrame(fitPayScreen);
}
function fitPayScreen(){
  const screen=app.querySelector('.payScreen');if(!screen)return;
  screen.style.transform='';screen.style.height='max-content';screen.style.minHeight='0';screen.style.width='100%';screen.style.marginLeft='auto';screen.style.marginRight='auto';
  const naturalHeight=screen.getBoundingClientRect().height;
  const viewportHeight=window.visualViewport?.height||window.innerHeight;
  const availableFromTop=viewportHeight-app.getBoundingClientRect().top-12;
  const usableHeight=Math.max(1,Math.min(app.clientHeight-12,availableFromTop));
  const factor=Math.min(1,usableHeight/Math.max(1,naturalHeight));
  if(factor<.999){
    screen.style.transformOrigin='top center';screen.style.transform=`scale(${factor})`;
  }
}
// Bilder bleiben auf diesem Gerät gespeichert (IndexedDB), nicht in einem Serverordner.
function openPictureDb(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){reject(new Error('Keine Bilddatenbank verfügbar'));return}
    const request=indexedDB.open('weihnachtskasse-bilder-v1',1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('images'))request.result.createObjectStore('images')};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  return dbPromise;
}
async function imageTxn(mode,fn){
  const db=await openPictureDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('images',mode);const request=fn(tx.objectStore('images'));
    tx.oncomplete=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error||new Error('Speichern abgebrochen'));
  });
}
function setPicture(id,blob){
  const old=pictureUrls.get(id);if(old)URL.revokeObjectURL(old);
  if(blob)pictureUrls.set(id,URL.createObjectURL(blob));else pictureUrls.delete(id);
}
async function loadAllPictures(){
  try{
    for(const p of products){const b=await imageTxn('readonly',store=>store.get(p.id));if(b)setPicture(p.id,b)}
    if(state.screen==='shop')render();
  }catch(e){console.warn('Produktbilder konnten nicht geladen werden:',e)}
}
async function resizedPicture(file){
  if(!file.type.startsWith('image/'))throw new Error('Bitte ein Bild auswählen.');
  if(file.size>20*1024*1024)throw new Error('Bitte ein Bild unter 20 MB auswählen.');
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();img.src=url;await img.decode();
    const factor=Math.min(1,900/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*factor));canvas.height=Math.max(1,Math.round(img.naturalHeight*factor));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Bild konnte nicht verarbeitet werden.')),'image/jpeg',.82));
  }finally{URL.revokeObjectURL(url)}
}

function renderPay(){const due=total(), paid=paidTotal();app.innerHTML=`<section class="payScreen"><div class="paySummary"><div class="bigAmount"><span>Zu bezahlen</span><strong>${fmt(due)}</strong><button class="listenMini" id="listenDueBtn" aria-label="Kaufbetrag anhören">🔊</button></div><div class="bigAmount"><span>Sie haben gegeben</span><strong>${fmt(paid)}</strong><button class="listenMini" id="listenPaidBtn" aria-label="Gegebenen Betrag anhören">🔊</button></div></div><div class="moneyArea"><div class="moneyGroup"><h2>Scheine</h2><div class="moneyGrid">${[500,1000,2000,5000].map(moneyButton).join('')}</div></div><div class="moneyGroup"><h2>Münzen</h2><div class="moneyGrid coinGrid">${[200,100,50,20,10,5,2,1].map(moneyButton).join('')}</div></div></div><div class="payFooter"><div class="paidChips" aria-label="Ausgewähltes Geld">${state.paid.length?state.paid.map((v,i)=>`<button class="chip paidChip" data-remove-paid="${i}" title="${moneyLabel(v)} entfernen" aria-label="${moneyLabel(v)} entfernen"><img src="${moneyPath}${moneyFile(v)}" alt="${moneyLabel(v)}" onerror="this.style.display='none'"></button>`).join(''):'<span class="hint payHint">Tippe auf Scheine und Münzen.</span>'}</div><div class="actions payActions"><button class="danger iconAction" id="backShopBtn" aria-label="Zurück zum Einkauf"><span class="icon">↩</span><span class="smallLabel">Zurück</span></button><button class="primary iconAction wideAction" id="showChangeBtn" aria-label="Wechselgeld zeigen" ${paid>=due?'':'disabled'}><span class="icon">💶</span><span class="smallLabel">Wechselgeld</span></button></div></div></section>`;
app.querySelectorAll('[data-money]').forEach(b=>b.onclick=()=>{const v=Number(b.dataset.money);state.paid.push(v);render()});app.querySelectorAll('[data-remove-paid]').forEach(b=>b.onclick=()=>{state.paid.splice(Number(b.dataset.removePaid),1);render()});document.getElementById('listenDueBtn').onclick=()=>speak(`Bitte bezahlen Sie ${fmtSpeak(total())}.`);document.getElementById('listenPaidBtn').onclick=()=>speak(`Sie haben ${fmtSpeak(paidTotal())} gegeben.`);document.getElementById('backShopBtn').onclick=()=>setScreen('shop');document.getElementById('showChangeBtn').onclick=()=>{state.change=makeChange(paidTotal()-total());setScreen('change')};}
function moneyButton(v){return `<button class="moneyBtn ${v>=500?'noteMoney':'coinMoney'}" data-money="${v}" aria-label="${moneyLabel(v)}"><img src="${moneyPath}${moneyFile(v)}" alt="${moneyLabel(v)}" onerror="this.style.display='none'"></button>`}
function makeChange(amount){let rest=amount,out=[];for(const d of denominations){while(rest>=d){out.push(d);rest-=d}}return out}
function renderChange(){const change=paidTotal()-total();app.innerHTML=`<section class="changeScreen"><div class="changeMain"><h1>Wechselgeld</h1><div class="changeTotal">${fmt(change)}</div><button class="listenMini changeListen" id="repeatChangeBtn" aria-label="Wechselgeld anhören">🔊</button><p class="hint">Tippe ein Geldstück an, um es kleiner zu wechseln.</p><div class="changeList">${state.change.length?state.change.map((v,i)=>`<button class="changeItem ${v>=500?'noteChange':'coinChange'}" data-split="${i}" aria-label="${moneyLabel(v)} zerlegen"><img src="${moneyPath}${moneyFile(v)}" alt="" onerror="this.style.display='none'"><span>${fmt(v)}</span></button>`).join(''):'<p class="hint">Kein Wechselgeld.</p>'}</div></div><div class="actions changeActions"><button class="danger iconAction" id="backPayBtn" aria-label="Zurück zum Bezahlen"><span class="icon">↩</span><span class="smallLabel">Zurück</span></button><button class="primary iconAction" id="finishBtn" aria-label="Kunde fertig"><span class="icon">✅</span><span class="smallLabel">Fertig</span></button></div></section>`;
app.querySelectorAll('[data-split]').forEach(b=>b.onclick=()=>splitChange(Number(b.dataset.split)));document.getElementById('repeatChangeBtn').onclick=()=>speak(`Ihr Wechselgeld beträgt ${fmtSpeak(change)}.`);document.getElementById('backPayBtn').onclick=()=>setScreen('pay');document.getElementById('finishBtn').onclick=finishSale;}
function splitChange(i){const v=state.change[i];if(!splitMap[v])return;speak(`${moneyLabel(v)} wird kleiner gewechselt.`);state.change.splice(i,1,...splitMap[v]);render();}
function finishSale(){state.sales.push({customer:state.practice?'Übung':state.customer,total:total(),paid:paidTotal(),change:paidTotal()-total(),items:groups().map(g=>`${g.count}× ${g.name}`).join(', '),time:new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})});setScreen('done');}
function renderDone(){app.innerHTML=`<section class="doneScreen"><div class="doneCard"><div class="stars">⭐⭐⭐</div><h1>${state.practice?'Übung geschafft!':'Gut gemacht!'}</h1><div class="actions"><button class="primary goodbyeBtn" id="nextCustomerBtn">👋 Auf Wiedersehen und einen schönen Tag</button></div></div></section>`;document.getElementById('nextCustomerBtn').onclick=()=>{speak('Auf Wiedersehen und einen schönen Tag.');state.practice=false;state.practiceTask=null;state.customer++;state.cart=[];state.paid=[];state.change=[];setScreen('shop')}}
function openReport(){const sum=state.sales.reduce((s,x)=>s+x.total,0);document.getElementById('reportContent').innerHTML=state.sales.length?`<p><strong>${state.sales.length}</strong> Verkäufe · Tageswert <strong>${fmt(sum)}</strong></p><table class="reportTable"><thead><tr><th>Kunde</th><th>Zeit</th><th>Summe</th><th>Gegeben</th><th>Wechselgeld</th></tr></thead><tbody>${state.sales.map(s=>`<tr><td>${s.customer}</td><td>${s.time}</td><td>${fmt(s.total)}</td><td>${fmt(s.paid)}</td><td>${fmt(s.change)}</td></tr>`).join('')}</tbody></table>`:'<p>Noch keine Verkäufe.</p>';document.getElementById('reportDialog').showModal();}
function downloadCsv(){const rows=[['Kunde','Zeit','Artikel','Summe','Gegeben','Wechselgeld'],...state.sales.map(s=>[s.customer,s.time,s.items,fmt(s.total),fmt(s.paid),fmt(s.change)])];const csv=rows.map(r=>r.map(x=>`"${String(x).replaceAll('"','""')}"`).join(';')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='lernkasse-protokoll.csv';a.click();}
function downloadPdf(){const sum=state.sales.reduce((s,x)=>s+x.total,0);const rows=state.sales.map(s=>`<tr><td>${esc(s.customer)}</td><td>${esc(s.time)}</td><td>${esc(s.items)}</td><td>${fmt(s.total)}</td><td>${fmt(s.paid)}</td><td>${fmt(s.change)}</td></tr>`).join('');const html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Lernkasse Protokoll</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{margin:0 0 8px}p{font-size:14px}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}th,td{border:1px solid #999;padding:7px;text-align:left;vertical-align:top}th{background:#eee}.toolbar{margin-bottom:16px}.btn{border:0;border-radius:10px;background:#2e7d32;color:white;padding:12px 16px;font-weight:bold;cursor:pointer}@media print{.toolbar{display:none}body{margin:14mm}}</style></head><body><div class="toolbar"><button class="btn" onclick="window.print()">PDF speichern / drucken</button></div><h1>Verkaufsprotokoll Lernkasse</h1><p>Datum: ${new Date().toLocaleDateString('de-DE')} · Verkäufe: ${state.sales.length} · Tageswert: ${fmt(sum)}</p>${state.sales.length?`<table><thead><tr><th>Kunde</th><th>Zeit</th><th>Artikel</th><th>Summe</th><th>Gegeben</th><th>Wechselgeld</th></tr></thead><tbody>${rows}</tbody></table>`:'<p>Noch keine Verkäufe.</p>'}<script>setTimeout(()=>window.print(),300)<\/script></body></html>`;const w=window.open('','_blank');if(!w){alert('Bitte Pop-ups erlauben, um das Protokoll als PDF zu speichern.');return;}w.document.write(html);w.document.close();}


function renderTeacherContent(){
  const content=document.getElementById('teacherContent');
  content.innerHTML=`<div class="teacherGrid"><label><input type="checkbox" id="setSpeech" ${settings.speech?'checked':''}> Sprache über Vorlese-Tasten</label><label><input type="checkbox" id="setContrast" ${settings.highContrast?'checked':''}> Hoher Kontrast</label><label>Schwierigkeit <select id="setDifficulty"><option value="leicht" ${settings.difficulty==='leicht'?'selected':''}>leicht</option><option value="normal" ${settings.difficulty==='normal'?'selected':''}>normal</option><option value="schwer" ${settings.difficulty==='schwer'?'selected':''}>schwer</option></select></label><label>Preise <select id="setPriceMode"><option value="original" ${settings.priceMode==='original'?'selected':''}>Eingestellte Preise</option><option value="full" ${settings.priceMode==='full'?'selected':''}>nur volle Euro</option><option value="half" ${settings.priceMode==='half'?'selected':''}>50-Cent-Schritte</option><option value="ten" ${settings.priceMode==='ten'?'selected':''}>10-Cent-Schritte</option></select></label></div>
  <section class="teacherSection"><h3>🎁 Größenvarianten</h3><p class="hint">Einzeln aktivieren. Sobald eine Größe eingeschaltet ist, erscheint in der Artikelauswahl nur deren farbiger Größenpreis statt des dunkelgrünen Grundpreises.</p><div class="sizeSettings">${Object.keys(sizeNames).map(s=>`<label class="sizeToggle size-${s}"><input type="checkbox" data-toggle-size="${s}" ${settings.sizes[s]?'checked':''}> ${sizeNames[s]}</label>`).join('')}</div></section>
  <section class="teacherSection"><div class="teacherSectionHeading"><h3>🛍️ Artikel bearbeiten</h3><button type="button" class="secondary addArticleButton" id="addArticleBtn">＋ Artikel hinzufügen</button></div><p class="hint">Die Grundeinstellung enthält zwei Artikel. Namen, Bilder und Preise lassen sich direkt hier ändern. Änderungen werden automatisch lokal gespeichert.</p><div class="articleEditors">${products.map((p,i)=>`<div class="articleEditor" data-edit-id="${esc(p.id)}"><div class="editorPhoto">${pictureHtml(p.id)}</div><div class="editorFields"><label>Artikelname<input type="text" maxlength="80" data-edit-name="${esc(p.id)}" value="${esc(p.name)}" placeholder="Artikelname"></label><label>Grundpreis (€)<input type="text" inputmode="decimal" data-edit-price="${esc(p.id)}" value="${decimalPrice(p.price)}"></label><div class="editorSizePrices">${Object.keys(sizeNames).map(s=>`<label class="size-${s}">${sizeNames[s]} (€)<input type="text" inputmode="decimal" data-edit-size="${s}" data-edit-id="${esc(p.id)}" value="${decimalPrice(p.sizes[s])}" ${settings.sizes[s]?'':'disabled'}></label>`).join('')}</div><label class="imageUploadLabel">📷 Bild hochladen / ersetzen<input type="file" accept="image/*" data-image-upload="${esc(p.id)}"></label><div class="editorActions"><button type="button" class="ghost dark" data-remove-image="${esc(p.id)}" ${pictureUrls.has(p.id)?'':'disabled'}>Bild entfernen</button><button type="button" class="danger" data-remove-article="${esc(p.id)}">Artikel löschen</button></div></div></div>`).join('')}</div></section>
  <div class="actions teacherBottomActions"><button class="secondary" id="teacherPracticeBtn">Übung starten</button><button class="danger" id="clearDayBtn">Protokoll löschen</button></div>`;
  content.querySelector('#setSpeech').onchange=e=>{settings.speech=e.target.checked;saveSettings()};
  content.querySelector('#setContrast').onchange=e=>{settings.highContrast=e.target.checked;saveSettings()};
  content.querySelector('#setDifficulty').onchange=e=>{settings.difficulty=e.target.value;saveSettings()};
  content.querySelector('#setPriceMode').onchange=e=>{settings.priceMode=e.target.value;saveSettings();syncCartPrices()};
  content.querySelectorAll('[data-toggle-size]').forEach(el=>el.onchange=e=>{
    settings.sizes[el.dataset.toggleSize]=e.target.checked;saveSettings();syncCartPrices();renderTeacherContent();
  });
  content.querySelectorAll('[data-edit-name]').forEach(el=>el.onchange=e=>{
    const p=productById(el.dataset.editName);if(!p)return;
    p.name=e.target.value.trim().slice(0,80)||'Artikel';e.target.value=p.name;
    if(saveProducts())syncCartPrices();
  });
  content.querySelectorAll('[data-edit-price]').forEach(el=>el.onchange=e=>updatePrice(el.dataset.editPrice,'',e.target));
  content.querySelectorAll('[data-edit-size]').forEach(el=>el.onchange=e=>updatePrice(el.dataset.editId,el.dataset.editSize,e.target));
  content.querySelectorAll('[data-image-upload]').forEach(el=>el.onchange=async e=>{
    const id=el.dataset.imageUpload,file=e.target.files?.[0];if(!file)return;
    const container=el.closest('.articleEditor');
    try{
      const blob=await resizedPicture(file);await imageTxn('readwrite',store=>store.put(blob,id));setPicture(id,blob);
      if(container){container.querySelector('.editorPhoto').innerHTML=pictureHtml(id);container.querySelector('[data-remove-image]').disabled=false}
      if(state.screen==='shop')render();
    }catch(error){alert(`Bild konnte nicht gespeichert werden: ${error.message}`)}
    el.value='';
  });
  content.querySelectorAll('[data-remove-image]').forEach(el=>el.onclick=async()=>{
    try{await imageTxn('readwrite',store=>store.delete(el.dataset.removeImage));setPicture(el.dataset.removeImage,null);renderTeacherContent();if(state.screen==='shop')render()}
    catch(e){alert('Bild konnte nicht entfernt werden.')}
  });
  content.querySelectorAll('[data-remove-article]').forEach(el=>el.onclick=async()=>{
    const id=el.dataset.removeArticle,p=productById(id);
    if(!p||!confirm(`Artikel „${p.name}“ wirklich löschen?`))return;
    products=products.filter(item=>item.id!==id);saveProducts();
    try{await imageTxn('readwrite',store=>store.delete(id))}catch(e){}
    setPicture(id,null);syncCartPrices();renderTeacherContent();
  });
  content.querySelector('#addArticleBtn').onclick=()=>{
    const id='artikel-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
    products.push({id,name:`Artikel ${products.length+1}`,price:100,sizes:{klein:100,mittel:150,gross:200}});
    saveProducts();renderTeacherContent();if(state.screen==='shop')render();
    const field=content.querySelector(`[data-edit-name="${id}"]`);field?.focus();field?.scrollIntoView({block:'nearest'});
  };
  content.querySelector('#teacherPracticeBtn').onclick=()=>{document.getElementById('teacherDialog').close();startPractice()};
  content.querySelector('#clearDayBtn').onclick=()=>{if(confirm('Protokoll wirklich löschen?')){state.sales=[];document.getElementById('teacherDialog').close()}};
}
function updatePrice(id,size,input){
  const p=productById(id);if(!p)return;
  const cents=moneyFromInput(input.value);
  if(cents===null){alert('Bitte einen gültigen Preis zwischen 0 und 99999 € eingeben.');input.value=decimalPrice(size?p.sizes[size]:p.price);return}
  if(size)p.sizes[size]=cents;else p.price=cents;
  input.value=decimalPrice(cents);
  if(saveProducts())syncCartPrices();
}
function openTeacher(){renderTeacherContent();document.getElementById('teacherDialog').showModal()}
function normalMode(){state.practice=false;state.practiceTask=null;state.cart=[];state.paid=[];state.change=[];setScreen('shop');speak('Normalmodus.')}
function startPractice(){
  if(!products.length){alert('Bitte zuerst in den Einstellungen Artikel anlegen.');return}
  state.practice=true;state.cart=[];state.paid=[];state.change=[];
  const activeSizes=Object.keys(sizeNames).filter(size=>settings.sizes[size]);
  const sizeOptions=activeSizes.length?activeSizes:[''];
  const count=settings.difficulty==='leicht'?2:settings.difficulty==='schwer'?5:3;
  for(let i=0;i<count;i++){
    const p=products[Math.floor(Math.random()*products.length)];
    const size=sizeOptions[Math.floor(Math.random()*sizeOptions.length)];
    const item={productId:p.id,size,name:p.name+(size?' · '+sizeNames[size]:''),price:priceOf(p,size)};
    state.cart.push(item);
    if(settings.difficulty!=='leicht'&&Math.random()>.55)state.cart.push({...item});
  }
  setScreen('shop');speak('Kassiere den Einkauf.');
}
window.addEventListener('DOMContentLoaded',init);
