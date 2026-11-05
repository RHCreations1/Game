const DBKEY='eventRaffleGiftSystemV1',IMGKEY='eventRaffleImagesV1';
const ADMIN_EMAIL='admin@gmail.com';
const DEFAULT_TERMS=`1. One registration per person for each game.\n2. Prizes are subject to availability and cannot be exchanged for cash.\n3. Prizes must be collected at the Gift Collection Point during the event.\n4. Your name and mobile number are used only for event participation and prize collection.\n5. The organiser's decision is final.`;
const defaults={gifts:[{id:'G1',name:'Gift 01',enabled:true,total:50,manual:20,wheel:20,issuedManual:0,issuedWheel:0},{id:'G2',name:'Gift 02',enabled:true,total:40,manual:15,wheel:15,issuedManual:0,issuedWheel:0},{id:'G3',name:'Gift 03',enabled:true,total:30,manual:10,wheel:12,issuedManual:0,issuedWheel:0},{id:'G4',name:'Gift 04',enabled:true,total:20,manual:5,wheel:8,issuedManual:0,issuedWheel:0}],slots:[{id:'S1',name:'09:00 - 09:30',start:'09:00',end:'09:30',duration:30,active:true,weights:{G1:25,G2:25,G3:25,G4:15,OPPS:10}}],players:[],prizes:[],security:{manual:{phoneEnabled:true,phoneLimit:1,deviceEnabled:true,deviceLimit:1},wheel:{phoneEnabled:true,phoneLimit:1,deviceEnabled:true,deviceLimit:1}},settings:{eventName:'EVENT EXPERIENCE',eventSubtitle:'Play • Win • Collect',terms:DEFAULT_TERMS}};
let _state=structuredClone(defaults),_firestore=null,_storage=null,_stateReady=false,_saveQueue=Promise.resolve(),_fbError='';
function firebaseReady(){return !!(window.firebase&&window.firebase.apps&&window.firebase.apps.length&&_firestore)}
function db(){return _state}
function publicGameConfig(d){return {images:d.images||{},gifts:(d.gifts||[]).map(g=>({id:g.id,name:g.name,enabled:!!g.enabled,total:Number(g.total)||0,wheel:Number(g.wheel)||0,issuedWheel:Number(g.issuedWheel)||0,issuedManual:Number(g.issuedManual)||0,showName:g.showName!==false})),slots:d.slots||[],settings:{oppsLabel:d.settings?.oppsLabel||'OPPS',oppsShowName:d.settings?.oppsShowName!==false,wheelLogo:d.settings?.wheelLogo||'',terms:d.settings?.terms||DEFAULT_TERMS}}}
function save(d){_state=d;try{localStorage.setItem(DBKEY,JSON.stringify(d))}catch(e){} if(!_firestore)return Promise.resolve();_saveQueue=_saveQueue.then(async()=>{await _firestore.collection('eventData').doc('main').set(d);await _firestore.collection('publicGame').doc('settings').set(publicGameConfig(d));}).catch(e=>{_fbError=e.message;notify('Firebase save failed: '+e.message)});return _saveQueue}
function initFirebase(){
 if(!window.firebase){_fbError='Firebase SDK did not load';return}
 try{
   if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);
   _firestore=firebase.firestore();
   _storage=firebase.storage();
   // Public, read-only game configuration: no player names, phone numbers or prize history.
   _firestore.collection('publicGame').doc('settings').onSnapshot(s=>{
     if(s.exists){const pub=s.data();_state={..._state,...pub,settings:{..._state.settings,...(pub.settings||{})}};_stateReady=true;window.dispatchEvent(new CustomEvent('event-data-updated'));}
   },e=>{_fbError=e.message;console.error('Public game settings:',e)});
   firebase.auth().onAuthStateChanged(user=>{
     if(!user || String(user.email||'').toLowerCase()!==ADMIN_EMAIL){return;}
     const ref=_firestore.collection('eventData').doc('main');
     ref.onSnapshot(s=>{
       if(s.exists){_state={...structuredClone(defaults),...s.data()};_stateReady=true;try{localStorage.setItem(DBKEY,JSON.stringify(_state))}catch(e){};_firestore.collection('publicGame').doc('settings').set(publicGameConfig(_state)).catch(e=>console.error(e));migrateLegacyImages().catch(e=>console.warn('Legacy image migration:',e));window.dispatchEvent(new CustomEvent('event-data-updated'));}
       else{ref.set(defaults).then(()=>_firestore.collection('publicGame').doc('settings').set(publicGameConfig(defaults))).catch(e=>{_fbError=e.message;notify('Database initialization failed: '+e.message)});}
     },e=>{_fbError=e.message;notify('Firestore connection error: '+e.message)});
   });
 }catch(e){_fbError=e.message;console.error(e)}
}
function uid(prefix='ID'){return prefix+'-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase()}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function toMin(t){let [h,m]=String(t||'0:0').split(':').map(Number);return h*60+m}
function currentSlot(d=db()){const now=new Date(),t=now.getHours()*60+now.getMinutes();return d.slots.find(s=>s.active&&t>=toMin(s.start)&&t<toMin(s.end))||null}
function gameKey(game){return String(game).toUpperCase().includes('WHEEL')?'wheel':'manual'}
function normalizedPhone(phone){return String(phone||'').replace(/\D/g,'')}
function deviceId(){let id=localStorage.getItem('eventRaffleDeviceId');if(!id){id=uid('DEVICE');localStorage.setItem('eventRaffleDeviceId',id)}return id}
function imgs(){return db().images||{}}
function getImg(k){return imgs()[k]?.url||imgs()[k]||''}
function dataUrlBlob(dataUrl){const [head,b64]=dataUrl.split(',');const mime=(head.match(/data:(.*?);base64/)||[])[1]||'image/webp';const bin=atob(b64);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new Blob([bytes],{type:mime})}
async function uploadImage(key,dataUrl){if(!_storage||!firebase.auth().currentUser)throw new Error('Admin must be signed in before uploading images');const blob=dataUrlBlob(dataUrl);const path=`event-images/${key.replace(/[^a-zA-Z0-9_-]/g,'_')}-${Date.now()}.webp`;const ref=_storage.ref().child(path);await ref.put(blob,{contentType:blob.type,cacheControl:'public,max-age=3600'});const url=await ref.getDownloadURL();const d=db();d.images=d.images||{};const previous=d.images[key];d.images[key]={url,path};await save(d);if(previous?.path&&previous.path!==path){try{await _storage.ref().child(previous.path).delete()}catch(e){console.warn('Old image cleanup failed',e)}}return url}
async function removeImage(key){const d=db();d.images=d.images||{};const previous=d.images[key];delete d.images[key];await save(d);if(previous?.path&&_storage){try{await _storage.ref().child(previous.path).delete()}catch(e){console.warn('Storage delete failed',e);notify('Image reference removed, but Storage delete failed: '+e.message)}}}
async function migrateLegacyImages(){if(!_storage||!firebase.auth().currentUser)return;let legacy={};try{legacy=JSON.parse(localStorage.getItem(IMGKEY)||'{}')}catch(e){};for(const [key,data] of Object.entries(legacy)){if(typeof data==='string'&&data.startsWith('data:image/')&&!getImg(key)){try{await uploadImage(key,data)}catch(e){console.warn('Could not migrate',key,e)}}}}
function compressImage(file,max,type,q){return new Promise((res,rej)=>{let r=new FileReader();r.onload=()=>{let im=new Image();im.onload=()=>{let s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL(type,q))};im.onerror=rej;im.src=r.result};r.onerror=rej;r.readAsDataURL(file)})}
function oppsInfo(d=db()){return {label:d.settings.oppsLabel||'OPPS',img:getImg('opps'),showName:d.settings.oppsShowName!==false}}function giftShowName(g){return g.showName!==false}
function canNewPlayer(key){const c=db().security[key]||{};if(!c.showNewPlayer)return false;if(!c.deviceEnabled)return true;const n=db().players.filter(p=>gameKey(p.game)===key&&p.deviceId===deviceId()).length;return n<Math.max(1,+c.deviceLimit||1)}
function applyGameBackground(key){let b=getImg('bg_'+key);if(b)document.body.style.background=`linear-gradient(rgba(0,0,0,.3),rgba(0,0,0,.3)),url(${b}) center/cover fixed no-repeat`}
function initTerms(btnId){const d=db(),cb=document.getElementById('agree'),btn=document.getElementById(btnId),m=document.getElementById('termsModal');document.getElementById('termsText').textContent=d.settings.terms||DEFAULT_TERMS;document.getElementById('showTerms').onclick=e=>{e.preventDefault();m.classList.remove('hidden')};document.getElementById('closeTerms').onclick=()=>m.classList.add('hidden');const sync=()=>{btn.disabled=!cb.checked};cb.onchange=sync;sync()}
function registrationCheck(phone,game){let d=db(),key=gameKey(game),cfg=d.security[key]||{},ph=normalizedPhone(phone),dev=deviceId();let samePhone=d.players.filter(p=>gameKey(p.game)===key&&normalizedPhone(p.phone)===ph).length;let sameDevice=d.players.filter(p=>gameKey(p.game)===key&&p.deviceId===dev).length;if(cfg.phoneEnabled&&samePhone>=Math.max(1,+cfg.phoneLimit||1))return {ok:false,message:`This mobile number has reached its ${cfg.phoneLimit} registration limit for this game.`};if(cfg.deviceEnabled&&sameDevice>=Math.max(1,+cfg.deviceLimit||1))return {ok:false,message:`This device has reached its ${cfg.deviceLimit} play limit for this game.`};return {ok:true}}
function createPlayer(name,phone,game){let check=registrationCheck(phone,game);if(!check.ok){notify(check.message);return null}let d=db(),p={id:uid('PLY'),name:name.trim(),phone:phone.trim(),game,deviceId:deviceId(),createdAt:new Date().toISOString(),prize:null,status:'REGISTERED'};d.players.unshift(p);save(d);localStorage.setItem('eventRaffleActive_'+gameKey(game),p.id);return p}
function activePlayer(game){let id=localStorage.getItem('eventRaffleActive_'+game),d=db();return d.players.find(p=>p.id===id)||null}function clearActivePlayer(game){localStorage.removeItem('eventRaffleActive_'+game)}
function eligibleGifts(mode,d=db()){const key=mode==='manual'?'issuedManual':'issuedWheel';return d.gifts.filter(g=>g.enabled&&Number(g[mode])>Number(g[key])&&(Number(g.total)-Number(g.issuedManual)-Number(g.issuedWheel))>0)}
function pickPrize(mode,d=db()){const slot=currentSlot(d);if(!slot)return 'OPPS';const available=eligibleGifts(mode,d),availableIds=new Set(available.map(g=>g.id));let opts=Object.entries(slot.weights||{}).filter(([id,w])=>Number(w)>0&&(id==='OPPS'||availableIds.has(id)));const total=opts.reduce((a,x)=>a+Number(x[1]),0);if(!total)return 'OPPS';let n=Math.random()*total;for(const [id,w] of opts){n-=Number(w);if(n<0)return id}return 'OPPS'}
function wheelSegments(d=db()){const gs=d.gifts.filter(g=>g.enabled).slice(0,4),s=[];for(let i=0;i<8;i++)s.push(i%2===0&&gs.length?gs[(i/2)%gs.length].id:'OPPS');return s}
function award(playerId,mode,forcedPrize=null){let d=db(),p=d.players.find(x=>x.id===playerId);if(!p)return null;if(p.prize)return p;let prize=forcedPrize||pickPrize(mode,d),g=d.gifts.find(x=>x.id===prize);if(g){let key=mode==='manual'?'issuedManual':'issuedWheel';if(Number(g[key])>=Number(g[mode])||(Number(g.total)-Number(g.issuedManual)-Number(g.issuedWheel))<=0)prize='OPPS';else g[key]=Number(g[key])+1}p.prize=prize;p.qr=mode==='wheel'&&prize!=='OPPS'?uid('QR'):null;p.status=prize==='OPPS'?'NO_PRIZE':'AWARDED';p.mode=mode;d.prizes.unshift({id:uid('TXN'),playerId:p.id,playerName:p.name,phone:p.phone,game:p.game,mode,prize,qr:p.qr,status:prize==='OPPS'?'NO_PRIZE':'PENDING',createdAt:new Date().toISOString(),releasedAt:null,releasedBy:null});save(d);return p}
function manualEligible(d=db()){return d.gifts.filter(g=>g.enabled&&Number(g.manual)>Number(g.issuedManual)&&(Number(g.total)-Number(g.issuedManual)-Number(g.issuedWheel))>0)}
function releaseManual(playerId,giftId,staff='Release Staff'){let d=db(),p=d.players.find(x=>x.id===playerId),g=d.gifts.find(x=>x.id===giftId);if(!p||!g)return {ok:false,message:'Player or gift not found'};if(p.prize)return {ok:false,message:'A gift was already released to this player'};if(!manualEligible(d).some(x=>x.id===giftId))return {ok:false,message:'This gift is out of stock for the Manual game'};const now=new Date().toISOString();g.issuedManual=Number(g.issuedManual)+1;p.prize=giftId;p.qr=null;p.status='RELEASED';p.mode='manual';d.prizes.unshift({id:uid('TXN'),playerId:p.id,playerName:p.name,phone:p.phone,game:p.game,mode:'manual',prize:giftId,qr:null,status:'RELEASED',createdAt:now,releasedAt:now,releasedBy:staff});save(d);return {ok:true}}
function prizeName(id,d=db()){return d.gifts.find(g=>g.id===id)?.name||id}function qrRender(el,text){if(!el)return;el.innerHTML='';if(window.QRCode){new QRCode(el,{text,width:160,height:160,colorDark:'#101010',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M})}else el.innerHTML='<div style="color:#222;padding:20px">QR library unavailable<br>'+esc(text)+'</div>'}function fmtDate(s){return new Date(s).toLocaleString()}
function notify(msg){let n=document.getElementById('toast');if(!n){n=document.createElement('div');n.id='toast';n.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#20c997;color:#06271c;padding:12px 18px;border-radius:12px;font-size:12px;font-weight:800;z-index:9999';document.body.append(n)}n.textContent=msg;n.style.display='block';setTimeout(()=>n.style.display='none',3000)}
function resetEventData(){let d=db();d.players=[];d.prizes=[];d.gifts.forEach(g=>{g.issuedManual=0;g.issuedWheel=0});save(d);['manual','wheel'].forEach(k=>clearActivePlayer(k));localStorage.removeItem('eventRaffleDeviceId');return d}
function requireAdminLogin(){
 const host=document.createElement('div');host.id='adminAuthGate';host.style.cssText='position:fixed;inset:0;background:#07110d;z-index:10000;display:grid;place-items:center;padding:20px';
 host.innerHTML=`<form id="adminLoginForm" style="width:min(420px,100%);background:#102019;border:1px solid #28513e;border-radius:18px;padding:28px;color:#fff;font-family:Arial"><div style="font-size:12px;letter-spacing:2px;color:#20c997">EVENT GAMING SYSTEM</div><h2 id="authTitle" style="margin:12px 0">Admin Login</h2><p id="authHint" style="color:#a9b8af;font-size:13px">Sign in with the authorised administrator account.</p><label style="display:block;margin:18px 0 6px">Admin Email / Username</label><input id="adminEmail" type="email" required value="${ADMIN_EMAIL}" style="box-sizing:border-box;width:100%;padding:12px;border-radius:8px"><label style="display:block;margin:14px 0 6px">Password</label><input id="adminPassword" type="password" required minlength="8" style="box-sizing:border-box;width:100%;padding:12px;border-radius:8px"><button id="authSubmit" style="margin-top:18px;width:100%;padding:13px;background:#20c997;border:0;border-radius:8px;font-weight:bold">Sign in</button><button id="authMode" type="button" style="margin-top:10px;width:100%;padding:11px;background:transparent;border:1px solid #37634d;color:#bcebd8;border-radius:8px">Create Admin Account</button><p id="adminLoginError" style="color:#ff9b9b;font-size:12px"></p></form>`;
 document.body.append(host);
 let createMode=false;
 const msg=document.getElementById('adminLoginError'),emailEl=document.getElementById('adminEmail'),passEl=document.getElementById('adminPassword');
 firebase.auth().onAuthStateChanged(async user=>{
   if(user&&String(user.email||'').toLowerCase()===ADMIN_EMAIL){host.remove();return;}
   if(user){await firebase.auth().signOut();msg.textContent='This account is not authorised.';}
 });
 document.getElementById('authMode').onclick=()=>{createMode=!createMode;document.getElementById('authTitle').textContent=createMode?'Create Admin Account':'Admin Login';document.getElementById('authHint').textContent=createMode?'Create the authorised admin account. Email verification is not required.':'Sign in with the authorised administrator account.';document.getElementById('authSubmit').textContent=createMode?'Create account':'Sign in';document.getElementById('authMode').textContent=createMode?'Back to sign in':'Create Admin Account';passEl.value='';msg.textContent='';};
 document.getElementById('adminLoginForm').onsubmit=async e=>{
   e.preventDefault();msg.textContent='';
   const email=emailEl.value.trim().toLowerCase(),password=passEl.value;
   if(email!==ADMIN_EMAIL){msg.textContent='Only the configured admin email is authorised.';return;}
   if(password.length<8){msg.textContent='Use a password with at least 8 characters.';return;}
   try{
     if(createMode){
       const cred=await firebase.auth().createUserWithEmailAndPassword(email,password);
       msg.style.color='#8ee7bf';msg.textContent='Admin account created. You are signing in.';
       // The newly created admin is already authenticated; auth-state listener grants access.
     }else{
       await firebase.auth().signInWithEmailAndPassword(email,password);
     }
   }catch(err){
     const messages={'auth/api-key-not-valid.-please-pass-a-valid-api-key.':'Firebase API key is invalid. Check firebase-config.js and API key restrictions.','auth/email-already-in-use':'This admin account already exists. Sign in instead.','auth/weak-password':'Choose a stronger password (at least 8 characters).','auth/operation-not-allowed':'Enable Email/Password in Firebase Console > Authentication > Sign-in method.'};
     msg.style.color='#ff9b9b';msg.textContent=messages[err.code]||err.message;
   }
 };
}
initFirebase();
