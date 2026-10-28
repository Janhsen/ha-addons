/* Fitness-Karte für Home Assistant (custom:fitness-card). Erzeugt aus dem Mockup durch buildcard.py. */
(function(){
if(customElements.get('fitness-card'))return;
/* Fitness-Daten-Schicht. Die Karte kennt nur dieses Format, nicht die Quelle.
   Quellen: recorder (heute), archive (später, ausgeschaltet), demo (Mockup).
   Alle Tage sind Kalendertage in der HA-Zeitzone, Index 0 = 1.1.2026. */
(function(root){
'use strict';
const START_UTC=Date.UTC(2026,0,1),DAY=864e5;

/* ---- Zeit ---- */
function parts(ms,tz){const f=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)),o={};for(const p of f)o[p.type]=+p.value;return o}
function dayIndex(ms,tz){const p=parts(ms,tz);return Math.round((Date.UTC(p.year,p.month-1,p.day)-START_UTC)/DAY)}
function hourOf(ms,tz){return parts(ms,tz).hour}
/* Beginn des lokalen Tages als ISO-UTC (für WS-Abfragen) */
function dayStartIso(idx,tz){const d=new Date(START_UTC+idx*DAY),y=d.getUTCFullYear(),m=d.getUTCMonth(),dd=d.getUTCDate();
 let guess=Date.UTC(y,m,dd);for(let i=0;i<3;i++){const p=parts(guess,tz),diff=(Date.UTC(y,m,dd)-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute));if(!diff)break;guess+=diff}
 return new Date(guess).toISOString()}

/* ---- Google-Polyline (Präzision 5) ---- */
function decodePolyline(str){const out=[];let i=0,lat=0,lon=0;while(i<str.length){let b,sh=0,r=0;do{b=str.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32);lat+=(r&1)?~(r>>1):r>>1;sh=0;r=0;do{b=str.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32);lon+=(r&1)?~(r>>1):r>>1;out.push([lat/1e5,lon/1e5])}return out}

/* ---- Feldzuordnung (Mockup-Feld -> Sensor) ---- */
/* kind: change = Tagesdifferenz (total_increasing); last = Wert am Tagesende;
   mean = Tagesmittel; hist = letzter Zustand des Tages aus der Verlaufs-History */
const FIELDS={
 steps:['schritte','change'],kcal:['kalorien','change'],goal:['tagliches_schrittziel','last'],
 rhr:['ruhepuls','last'],hrmin:['minimale_herzfrequenz','last'],hrmax:['maximale_herzfrequenz','last'],hrv:['hrv_letzte_nacht_durchschnitt','last'],
 sleep:['schlafwert','last'],slp:['gesamtschlafdauer','last'],deep:['tiefschlaf','last'],rem:['rem_schlaf','last'],light:['leichtschlaf','last'],awake:['wachzeit','last'],need:['schlafbedarf','last'],
 bb:['body_battery','mean'],stress:['durchschnittliches_stresslevel','last'],
 sr:['dauer_ruhestress','last'],sl:['dauer_niedriger_stress','last'],sm:['dauer_mittlerer_stress','last'],sh:['dauer_hoher_stress','last'],
 vo2:['vo2max','last'],kg:['gewicht','last'],
 ready:['trainingsbereitschaft','hist'],
 imm:['intensitatsminuten_moderat','change'],imh:['intensitatsminuten_intensiv','change'],
 bed:['schlafenszeit','ts'],wake:['aufwachzeit','ts']};
/* ---- Quellenwahl: eigene Integration (sensor.<name>_<x>) vor Garmin Connect (sensor.garmin_<name>_<x>) ----
   PMAP: Connect-Name -> Name bei der eigenen Integration. Was dort fehlt (VO2max, Bereitschaft, Status), kommt immer von Connect.
   Die eigene Integration liefert Zeiten in Sekunden, Connect in Minuten (PSEC): beim Lesen auf Minuten umgerechnet. */
const PMAP={schritte:'schritte',kalorien:'gesamtkalorien',tagliches_schrittziel:'schrittziel',ruhepuls:'ruhepuls',hrv_letzte_nacht_durchschnitt:'hrv_letzte_nacht',schlafwert:'schlafwert',
 gesamtschlafdauer:'schlafdauer',tiefschlaf:'tiefschlaf',rem_schlaf:'rem_schlaf',leichtschlaf:'leichtschlaf',wachzeit:'wachzeit',schlafbedarf:'schlafbedarf',
 body_battery:'body_battery',durchschnittliches_stresslevel:'durchschnittlicher_stress',dauer_ruhestress:'ruhezeit_stress',dauer_niedriger_stress:'zeit_niedriger_stress',
 dauer_mittlerer_stress:'zeit_mittlerer_stress',dauer_hoher_stress:'zeit_hoher_stress',gewicht:'gewicht',hrv_wochendurchschnitt:'hrv_wochendurchschnitt',
 intensitatsminuten_moderat:'intensitatsminuten_moderat',intensitatsminuten_intensiv:'intensitatsminuten_hoch',
 maximales_stresslevel:'maximaler_stress',inaktive_zeit:'sitzende_zeit',sehr_aktive_zeit:'zeit_hochaktiv',schlafenszeit:'schlafbeginn',aufwachzeit:'schlafende',
 ziel_intensitatsminuten:'intensitatsminuten_ziel',fitnessalter:'fitnessalter',chronologisches_alter:'kalendarisches_alter',laktatschwellen_herzfrequenz:'laktatschwelle_puls',etagen_aufwarts:'stockwerke_hoch',ziel_etagen_aufwarts:'stockwerke_ziel',zuletzt_synchronisiert:'letzte_synchronisation',nachster_schlafbedarf:'nachster_schlafbedarf'};
const PSEC=new Set(['gesamtschlafdauer','tiefschlaf','rem_schlaf','leichtschlaf','wachzeit','dauer_ruhestress','dauer_niedriger_stress','dauer_mittlerer_stress','dauer_hoher_stress','inaktive_zeit','sehr_aktive_zeit']);
const SRC={mode:'auto',by:{}}; /* by: Feldschlüssel (steps, bb, hrv …) -> auto|personal|connect */
const MODES=['auto','personal','connect'];
function setSourceConfig(c){c=c||{};SRC.mode=MODES.includes(c.source)?c.source:'auto';SRC.by={};for(const[k,v]of Object.entries(c.source_by||{}))if(MODES.includes(v))SRC.by[k]=v}
function sourceMode(key){return(key&&SRC.by[key])||SRC.mode}
const NAMEKEY={};for(const[k,v]of Object.entries(FIELDS))NAMEKEY[v[0]]=k;NAMEKEY.hrv_wochendurchschnitt='hrv';
Object.assign(NAMEKEY,{ziel_intensitatsminuten:'imin',maximales_stresslevel:'stress',inaktive_zeit:'stress',sehr_aktive_zeit:'stress',schlafenszeit:'sleep',aufwachzeit:'sleep',fitnessalter:'fitage',chronologisches_alter:'fitage',erreichbares_fitnessalter:'fitage',laktatschwellen_herzfrequenz:'zones',etagen_aufwarts:'floors',ziel_etagen_aufwarts:'floors',hrv_basiswert:'hrv',optimale_schlafenszeit:'sleep',optimale_aufwachzeit:'sleep',nachster_schlafbedarf:'sleep',zuletzt_synchronisiert:'sync'});
const connectId=(cu,name)=>'sensor.garmin_'+cu+'_'+name;
const personalId=(pu,name)=>PMAP[name]&&pu?'sensor.'+pu+'_'+PMAP[name]:null;
const unitFactor=(unit,name)=>unit==='s'?1/60:unit==='min'?1:unit==='h'?60:(PSEC.has(name)?1/60:1);
/* Ein Messwert aus den HA-Zuständen: {v, src:'personal'|'connect'|null, e} */
function pickState(states,pu,cu,name,mode){
 mode=mode||sourceMode(NAMEKEY[name]);
 const num=(e,f)=>{if(!e||e.state==null||e.state===''||e.state==='unknown'||e.state==='unavailable')return null;const v=parseFloat(e.state);return isFinite(v)?v*f:null};
 const pid=personalId(pu,name),pe=pid&&states[pid],ce=states[connectId(cu,name)];
 const P=()=>{const v=num(pe,unitFactor(pe&&pe.attributes&&pe.attributes.unit_of_measurement,name));return v==null?null:{v,src:'personal',e:pe}},C=()=>{const v=num(ce,1);return v==null?null:{v,src:'connect',e:ce}};
 let r;
 if(mode==='connect'||!pid)r=C();
 else if(mode==='personal')r=P();
 else r=P()||C();
 return r||{v:null,src:null,e:null}}
/* Ein Zeitstempel (ISO-Zustand, device_class timestamp) nach Quellenwahl: {ms, src} oder {ms:null} */
function pickTs(states,pu,cu,name,mode){
 mode=mode||sourceMode(NAMEKEY[name]);
 const ts=e=>{if(!e||!e.state||e.state==='unknown'||e.state==='unavailable')return null;const t=Date.parse(e.state);return isFinite(t)?t:null};
 const pid=personalId(pu,name),P=()=>{const t=ts(pid&&states[pid]);return t==null?null:{ms:t,src:'personal'}},C=()=>{const t=ts(states[connectId(cu,name)]);return t==null?null:{ms:t,src:'connect'}};
 let r;if(mode==='connect'||!pid)r=C();else if(mode==='personal')r=P();else r=P()||C();return r||{ms:null,src:null}}
/* Entitäten für Verlauf und Langdruck: Reihenfolge der Kandidaten, die existieren */
function candidateIds(states,pu,cu,name,mode){mode=mode||sourceMode(NAMEKEY[name]);const pid=personalId(pu,name),cid=connectId(cu,name),has=id=>id&&(!states||states[id]),out=[];
 if(mode==='connect'||!pid){if(has(cid))out.push(cid)}else if(mode==='personal'){if(has(pid))out.push(pid)}else{if(has(pid))out.push(pid);if(has(cid))out.push(cid)}return out}
const SPORT={mountain_biking:'mtb',cycling:'mtb',road_biking:'mtb',gravel_cycling:'mtb',e_bike_mountain:'mtb',running:'run',trail_running:'run',treadmill_running:'run',hiking:'hike',walking:'hike',resort_snowboarding:'ski',resort_skiing:'ski',backcountry_skiing:'ski',lap_swimming:'swim',open_water_swimming:'swim',yoga:'yoga'};

/* ---- Tagesaggregation (rein, testbar) ---- */
function aggregateStats(rows,kind,tz){ /* rows: [{start(ms),mean|change|state,...}] -> Map dayIdx -> Wert */
 const m=new Map();
 for(const r of rows||[]){const d=dayIndex(r.start,tz);
  if(kind==='change'){const v=r.change;if(v==null)continue;m.set(d,(m.get(d)||0)+v)}
  else if(kind==='mean'){const v=r.mean;if(v==null)continue;const q=m.get(d)||{s:0,n:0};q.s+=v;q.n++;m.set(d,q)}
  else{const v=r.mean!=null?r.mean:r.state;if(v==null)continue;m.set(d,v)}} /* last: Zeilen sind aufsteigend, der letzte gewinnt */
 if(kind==='mean')for(const[k,q]of m)m.set(k,q.s/q.n);
 return m}
function lastPerDay(states,tz){ /* history-Zeilen [{s,lu(s)|last_updated}] -> Map dayIdx -> letzter numerischer Zustand */
 const m=new Map();for(const x of states||[]){const t=x.lu!=null?x.lu*1000:Date.parse(x.last_updated||x.lc||'');const s=x.s!=null?x.s:x.state;const v=parseFloat(s);if(!isFinite(v)||!isFinite(t))continue;m.set(dayIndex(t,tz),v)}return m}

/* Zeitstempel-Zustände (Schlafbeginn, Schlafende): je Tag Minuten ab Mitternacht (Ortszeit) des Aufwachtags.
   Der Tag richtet sich nach dem Wert, nicht nach dem Zeitpunkt der Meldung: Aufwachen gehört zu seinem Tag, Schlafbeginn zu dem Tag, an dem man danach aufsteht (Wert + 6 h). Bett vor Mitternacht = negativ. */
function tsPerDay(states,tz,kind){const m=new Map();for(const x of states||[]){const s=x.s!=null?x.s:x.state;if(s==null||s===''||s==='unknown'||s==='unavailable')continue;const t=Date.parse(s);if(!isFinite(t))continue;
 const d=dayIndex(kind==='bed'?t+6*36e5:t,tz),a=Date.parse(dayStartIso(d,tz));m.set(d,(t-a)/6e4)}return m}

/* ---- Aktivitäten ---- */
function mapActivity(w,a,routes,tz){
 const t=Date.parse(a.startTime),id=String(a.activityId),sport=SPORT[a.activityType]||'other',R=routes&&routes.get(id);
 const dur=a.movingDuration||a.duration||0,dist=a.distance||0;
 return{id:'g'+id,who:w,source:'recorder',date:new Date(t),day:dayIndex(t,tz),sport,name:a.activityName||'Aktivität',sname:null,
  gps:!!R||!!(a.startLatitude&&dist>0),
  st:{dist,dur,elapsed:a.elapsedDuration||dur,gain:a.elevationGain||0,loss:a.elevationLoss||0,avgHR:a.averageHR||null,maxHR:a.maxHR||null,kcal:a.calories||0,load:Math.round(a.activityTrainingLoad||0),avgV:dur?dist/dur*3.6:0,maxV:a.maxSpeed?a.maxSpeed*3.6:null,
   te:{aerobic:a.aerobicTrainingEffect??null,anaerobic:a.anaerobicTrainingEffect??null,label:a.trainingEffectLabel||null}},
  zones:[1,2,3,4,5].map(i=>a['hrTimeInZone_'+i]||0),
  w:R?R.points:null,start:a.startLatitude?[a.startLatitude,a.startLongitude]:null,place:a.locationName||null,
  tr:null /* Höhen-, Puls- und Tempoprofil, Splits: nur über das Archiv */,joint:null}}
function mergeActivities(w,lists,routes,tz){const m=new Map();for(const l of lists)for(const a of l||[]){if(!a||a.activityId==null)continue;const k=String(a.activityId);if(!m.has(k)||(a.hrTimeInZone_1!=null&&m.get(k).hrTimeInZone_1==null))m.set(k,a)}
 return[...m.values()].map(a=>mapActivity(w,a,routes,tz)).filter(a=>isFinite(a.date)).sort((x,y)=>y.date-x.date)}
function routesFromStates(states){const m=new Map();for(const x of states||[]){const a=x.a||x.attributes;if(!a||!a.polyline||a.aktivitaet_id==null)continue;m.set(String(a.aktivitaet_id),{points:decodePolyline(a.polyline),start:a.startzeit,km:a.distanz_km,sport:a.sportart})}return m}

/* ---- Recorder-Adapter ---- */
function recorderSource(hass,user,opt){opt=opt||{};const tz=(hass.config&&hass.config.time_zone)||'Europe/Berlin',P='sensor.garmin_'+user+'_',PU=opt.personal||user,PP='sensor.'+PU+'_';
 const ws=msg=>hass.callWS(msg),cache=new Map(),memo=(k,f)=>{if(!cache.has(k))cache.set(k,f().catch(e=>{cache.delete(k);throw e}));return cache.get(k)};
 const stats=(ids,period,types,a,b)=>ws({type:'recorder/statistics_during_period',start_time:a,end_time:b,statistic_ids:ids,period,types});
 const hist=(ids,a,b)=>ws({type:'history/history_during_period',start_time:a,end_time:b,entity_ids:ids,include_start_time_state:true,significant_changes_only:false,minimal_response:false,no_attributes:false});
 return{id:'recorder',user,tz,
  /* ältester Tag, für den der Recorder Garmin-Daten hat; davor liefert diese Quelle nichts */
  async coverage(){return memo('cov',async()=>{const mode=sourceMode('steps'),ids=mode==='personal'?[PP+'schritte']:mode==='connect'?[P+'schritte']:[PP+'schritte',P+'schritte'];const r=await stats(ids,'day',['state'],'2026-01-01T00:00:00Z',new Date().toISOString());let from=null;for(const id of ids){const rows=r[id]||[];if(rows.length){const d=dayIndex(rows[0].start,tz);if(from==null||d<from)from=d}}return{from}})},
  /* Tageswerte: Array von {day, steps, ...} mit null bei fehlenden Werten */
  async daily(fromDay,toDay){const a=dayStartIso(fromDay,tz),b=dayStartIso(toDay+1,tz),byKind={change:new Set(),last:new Set(),mean:new Set(),hist:new Set(),ts:new Set()};
   /* je Feld die Kandidaten in Auswahlreihenfolge (Quellenwahl): pro Tag gewinnt der erste mit Wert */
   const cands={};for(const[f,[id,k]]of Object.entries(FIELDS)){const m=sourceMode(f==='bed'||f==='wake'?'sleep':f),pn=PMAP[id],c={id:P+id,fac:1},pc=pn&&k!=='hist'?{id:PP+pn,fac:PSEC.has(id)?1/60:1}:null;
    cands[f]=m==='connect'||!pc?[c]:m==='personal'?[pc]:[pc,c];for(const x of cands[f])byKind[k].add(x.id)}
   const out=new Map();const put=(f,m,fac)=>{for(const[d,v0]of m){if(d<fromDay||d>toDay)continue;const o=out.get(d)||out.set(d,{day:d}).get(d);if(o[f]==null)o[f]=fac===1?v0:v0*fac}};
   const[dayRows,hourRows,hRows]=await Promise.all([
    byKind.change.size?stats([...byKind.change],'day',['change'],a,b):{},
    byKind.last.size||byKind.mean.size?stats([...byKind.last,...byKind.mean],'hour',['mean','state'],a,b):{},
    byKind.hist.size||byKind.ts.size?hist([...byKind.hist,...byKind.ts],a,b):{}]);
   for(const[f,[,k]]of Object.entries(FIELDS))for(const x of cands[f])put(f,k==='ts'?tsPerDay(hRows[x.id],tz,f):k==='hist'?lastPerDay(hRows[x.id],tz):aggregateStats((k==='change'?dayRows:hourRows)[x.id],k,tz),x.fac);
   const days=[];for(let d=fromDay;d<=toDay;d++){const o=out.get(d)||{day:d};for(const f of Object.keys(FIELDS))if(o[f]==null)o[f]=null;
    o.light=o.light; days.push(o)}return days},
  /* Aktivitäten, aus Historie der Garmin-Sensoren; Routen verknüpft über aktivitaet_id */
  async activities(fromDay,toDay){return memo('act',async()=>{const a=dayStartIso(0,tz),b=new Date().toISOString();
   const ids=[P+'letzte_aktivitat',P+'letzte_aktivitaten',P+'route_vereinfacht'];
   const h=await hist(ids,new Date(Date.now()-35*DAY).toISOString(),b);
   const single=(h[P+'letzte_aktivitat']||[]).map(x=>x.a||x.attributes).filter(Boolean);
   const lists=[];for(const x of h[P+'letzte_aktivitaten']||[]){const at=x.a||x.attributes;if(at&&at.last_activities)lists.push(at.last_activities)}
   const routes=routesFromStates(h[P+'route_vereinfacht']);
   return mergeActivities(user,[single,...lists],routes,tz)}).then(l=>l.filter(x=>x.day>=fromDay&&x.day<=toDay))},
  /* Tagesverlauf: grob (Body Battery ca. 9 Werte/Tag, Stress aus Deltas, Herzfrequenz nur Min/Max) */
  async dayCurve(day,kind){const map={bb:'body_battery',stress:'durchschnittliches_stresslevel',hr:'minimale_herzfrequenz'};const a=dayStartIso(day,tz),b=dayStartIso(day+1,tz);
   const r=await stats([P+map[kind]],'hour',['mean'],a,b);return(r[P+map[kind]]||[]).map(x=>({h:hourOf(x.start,tz),v:x.mean}))},
  /* Profil, Splits: nur Archiv */
  async trackDetail(){return null}}}

/* ---- Archiv-Adapter (aus, bis der Umzug erledigt ist) ---- */
function archiveSource(cfg){cfg=cfg||{};const off=async()=>{throw new Error('archive-disabled')};
 return{id:'archive',enabled:!!cfg.enabled,coverage:async()=>({from:null}),daily:off,activities:off,dayCurve:off,trackDetail:off}}

/* ---- Zusammenführen: Archiv für ältere Tage, Recorder für neuere ---- */
async function combine(recorder,archive){
 return{recorder,archive,async coverage(){const r=await recorder.coverage();return{recorderFrom:r.from,archiveEnabled:!!archive.enabled}},
  async daily(a,b){const r=await recorder.coverage(),cut=r.from==null?b+1:r.from;let old=[];
   if(archive.enabled&&a<cut){try{old=await archive.daily(a,Math.min(b,cut-1))}catch(_){}}
   const cur=b>=cut?await recorder.daily(Math.max(a,cut),b):[];
   const have=new Set([...old,...cur].map(x=>x.day)),fill=[];for(let d=a;d<=b;d++)if(!have.has(d)){const o={day:d};for(const f of Object.keys(FIELDS))o[f]=null;o.missing=true;fill.push(o)}
   return[...old,...fill,...cur].sort((x,y)=>x.day-y.day)},
  async activities(a,b){let old=[];if(archive.enabled){try{old=await archive.activities(a,b)}catch(_){}}const cur=await recorder.activities(a,b),ids=new Set(old.map(x=>x.id));return[...old,...cur.filter(x=>!ids.has(x.id))].sort((x,y)=>y.date-x.date)},
  async dayCurve(d,k){return recorder.dayCurve(d,k)},
  async trackDetail(act){if(archive.enabled){try{return await archive.trackDetail(act)}catch(_){}}return null}}}

const api={tsPerDay,PMAP,PSEC,setSourceConfig,sourceMode,pickState,pickTs,candidateIds,personalId,connectId,unitFactor,START_UTC,DAY,dayIndex,dayStartIso,decodePolyline,FIELDS,SPORT,aggregateStats,lastPerDay,mapActivity,mergeActivities,routesFromStates,recorderSource,archiveSource,combine};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FitnessData=api;
})(typeof self!=='undefined'?self:this);

const CSS=`:host{display:block;color:var(--text);font:15px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif;font-variant-numeric:tabular-nums}

/* Layout: Kopfzeile mit Person und Bereich, darunter je Bereich eine Arbeitsfläche. Touren = Liste links, Karte mit Zeitstrahl rechts, Details darunter. */
:host{--bg:#F1F3F4;--edge:rgba(255,255,255,.8);--c-body:#546E7A;--c-act:#43A047;--c-sleep:#8E24AA;--c-heart:#FF5722;--c-str:#F9A825;--surface:#FFFFFF;--surface2:#ECEEF3;--text:#15181E;--text2:#586071;--sep:rgba(21,24,30,.13);--p1:#1E88E5;--p2:#FB8C00;--ok:#43A047;--warn:#FB8C00;--bad:#F44336;--field:#E7EBF1;--grid:rgba(21,24,30,.08);--shadow:0 6px 24px rgba(15,20,30,.14);--r:14px;color-scheme:light}
:host([data-theme="dark"]){--bg:#202124;--edge:rgba(255,255,255,.09);--c-body:#90A4AE;--c-act:#66BB6A;--c-sleep:#BA68C8;--c-heart:#FF7043;--c-str:#FFCA28;--surface:#2D2E31;--surface2:#3C4043;--text:#ECEFF5;--text2:#9BA4B4;--sep:rgba(236,239,245,.14);--p1:#64B5F6;--p2:#FFA726;--ok:#66BB6A;--warn:#FFA726;--bad:#EF5350;--field:#26272A;--grid:rgba(236,239,245,.07);--shadow:0 6px 24px rgba(0,0,0,.5);color-scheme:dark}
*{box-sizing:border-box}
.app{display:block;background:var(--bg);color:var(--text);font:15px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif;padding-inline:16px;padding-block:12px 16px;font-variant-numeric:tabular-nums}
.wrap{max-width:1320px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
button{font:inherit;color:inherit;cursor:pointer}
button:focus-visible,input:focus-visible{outline:2px solid var(--p1);outline-offset:2px}
.top{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between}
.tbar{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between}
h1{font-size:28px;line-height:1.1;margin:0;letter-spacing:-.02em;font-weight:700}
.seg{display:inline-flex;background:var(--surface2);border-radius:999px;padding:3px;gap:2px;max-width:100%;overflow-x:auto}
.seg button{border:0;background:none;padding:7px 14px;border-radius:999px;color:var(--text2);min-height:36px;white-space:nowrap;display:inline-flex;align-items:center;gap:7px}
.seg button[aria-pressed="true"]{background:var(--surface);color:var(--text);box-shadow:0 1px 3px rgba(0,0,0,.18);font-weight:600}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none}
#presets{max-width:100%;flex-wrap:wrap;overflow:visible;border-radius:22px}#presets::-webkit-scrollbar{display:none}
.ldot{width:9px;height:9px;border-radius:50%;background:var(--bad);display:inline-block;flex:none;margin-right:6px;animation:lp 1.6s ease-out infinite}@keyframes lp{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--bad) 55%,transparent)}70%,100%{box-shadow:0 0 0 8px transparent}}@media (prefers-reduced-motion:reduce){.ldot{animation:none}}
.card{background:var(--surface);border-radius:var(--r);padding:16px;border:1px solid var(--sep)}
.muted{color:var(--text2)}
.sm{font-size:12px}
.h2{font-size:17px;font-weight:600;margin:0 0 10px}
.chip{border:1px solid var(--sep);background:var(--surface);border-radius:999px;padding:5px 11px;min-height:32px;display:inline-flex;gap:6px;align-items:center;font-size:13px}
.chip[aria-pressed="true"]{background:var(--text);color:var(--bg);border-color:var(--text)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
@media (min-width:871px){#hamb{display:none!important}}
.dcard:focus-visible,.chip:focus-visible,.ib:focus-visible,.row:focus-visible,button:focus-visible{outline:2px solid var(--accent,#1a73e8);outline-offset:2px}
.ib{width:36px;height:36px;border-radius:50%;border:1px solid var(--sep);background:var(--surface);display:inline-grid;place-items:center;padding:0}
.ib svg{width:18px;height:18px}
svg.i{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.banner{font-size:12px;color:var(--text2);display:flex;gap:8px;align-items:flex-start}
/* Heute */
.cols{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(min(100%,430px),1fr))}
.who{display:flex;align-items:center;gap:8px;font-weight:600;font-size:17px;margin-bottom:12px}
.rings{display:flex;gap:10px;justify-content:space-around;flex-wrap:wrap;margin-bottom:14px}
.ring{display:grid;justify-items:center;gap:2px;text-align:center;min-width:92px}
.ring b{font-size:17px}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(122px,1fr));gap:8px}
.tile{border:1px solid var(--sep);background:var(--surface);border-radius:12px;padding:10px;text-align:left;display:flex;flex-direction:column;gap:2px;min-height:84px}
.tile[aria-pressed="true"]{border-color:var(--text);background:var(--surface2)}
.tile .v{font-size:20px;font-weight:600}
.tile .v small{font-size:12px;font-weight:600;color:var(--text2);margin-left:3px}
.tile svg.sp{width:100%;height:22px;margin-top:auto}
.detailbox{margin-top:10px;border-top:1px solid var(--sep);padding-top:12px}
.mini{display:grid;grid-template-columns:120px 1fr;gap:14px;align-items:center}
.mini svg{width:100%;height:auto;background:var(--field);border-radius:10px}
.kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:10px}
.kv div{display:flex;flex-direction:column}
.kv b{font-size:17px;font-weight:600}
.kvt{grid-template-columns:repeat(auto-fill,minmax(136px,1fr))}.kvt b{white-space:nowrap}.kvt .kvl b{white-space:normal}
@media (max-width:640px){.kvt{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 8px}.kvt b{font-size:15px}.kvt span{font-size:11px}}
.kv span{font-size:12px;color:var(--text2)}
.btn{border:1px solid var(--sep);background:var(--surface);border-radius:999px;padding:7px 14px;min-height:36px;display:inline-flex;gap:6px;align-items:center}
.btn.p{background:var(--text);color:var(--bg);border-color:var(--text)}
/* Datenquelle, Schlaf-Teilwerte, dichte Verläufe */
.srow{display:grid;grid-template-columns:104px 1fr auto;gap:8px;align-items:center;font-size:13px;margin:6px 0}
.srow b{font-weight:600;white-space:nowrap}
.sbar{position:relative;height:6px;border-radius:3px;background:var(--surface2);overflow:hidden}.sbar i{display:block;height:100%;border-radius:3px}
.sbar u{position:absolute;top:0;bottom:0;background:color-mix(in srgb,var(--text) 22%,transparent);border-radius:3px}
.hint{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:var(--surface2);font-size:13px;line-height:1.4}.hint svg.i{width:18px;height:18px;margin-top:1px;color:var(--warn)}.hint b{font-weight:600}
.bedc svg{width:100%;height:auto;display:block}.bedc text{fill:var(--text2);font:11px -apple-system,system-ui,sans-serif}.bedc .g{stroke:var(--grid);stroke-width:1}.bedc .rg{margin-top:10px}.bedc .bplot{touch-action:pan-y;-webkit-user-select:none;user-select:none;cursor:pointer;border-radius:10px}.bedc .bplot:focus-visible{outline:2px solid var(--p1);outline-offset:2px}.bedc .bleg{margin-top:8px}.bedc .bsw{display:inline-block;width:16px;height:0;vertical-align:middle}.bedc .bdet{margin-top:12px;border-top:1px solid var(--sep);padding-top:10px}.bedc .bdur{font-size:11px}.bedc .bdh{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px}.bedc .bnav{display:flex;gap:8px}.bedc .bnav .ib{width:44px;height:44px}.bedc .bnav .ib:disabled{opacity:.35}
.sx2{margin-top:10px;border-top:1px solid var(--sep);padding-top:10px}
.sx2 p{margin:8px 0 0;font-size:13px}
.sx2 .srow{grid-template-columns:auto minmax(40px,1fr) auto;gap:10px;font-size:15px;min-width:0}
.ovl{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--text2);margin-top:6px}
.sscale .ssc{position:relative;height:6px;border-radius:3px;background:var(--surface2);margin:12px 0 4px}.sscale .ssb{position:absolute;top:-4px;bottom:-4px;width:1px;background:var(--text2)}.sscale .ssd{position:absolute;top:-4px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:var(--c-sleep);border:2px solid var(--surface)}.sscale .ssl{position:relative;height:16px;font-size:11px;color:var(--text2)}.sscale .ssl span{position:absolute;transform:translateX(-50%);white-space:nowrap}.sscale .ssl span:first-child{transform:none}.sscale .ssl span:last-child{transform:translateX(-100%)}.mnights svg{width:100%;max-width:440px;height:auto;display:block}.mnights text{fill:var(--text2);font:11px -apple-system,system-ui,sans-serif}.mnights .g{stroke:var(--grid);stroke-width:1}
.swin2{margin:12px 0 4px;min-height:44px;border-radius:10px}.swin2:focus-visible{outline:2px solid var(--p1);outline-offset:2px}.swin2 svg{width:100%;max-width:440px;height:auto;display:block}.swin2 text{fill:var(--text2);font:11px -apple-system,system-ui,sans-serif}.swin2 .g{stroke:var(--grid);stroke-width:1}.swin2 .sout{fill:var(--text);font-weight:400}.swin2 .sin{fill:var(--surface);font-weight:600}.swin2 .sdur{font-size:12px}
.wkb{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;align-items:end;height:92px;margin:8px 0 4px}
.wkb div{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px;height:100%;font-size:11px;color:var(--text2)}
.wkb i{display:block;width:100%;max-width:26px;border-radius:5px;background:var(--c-act);min-height:2px}
.wkb i.na{background:var(--surface2)}
.agel{position:relative;height:56px;margin:6px 0 4px}.agel s{position:absolute;top:30px;left:0;right:0;height:2px;background:var(--sep);text-decoration:none}
.agel b{position:absolute;top:0;transform:translateX(-50%);font-size:12px;font-weight:600;white-space:nowrap;text-align:center}
.agel b::after{content:"";display:block;width:12px;height:12px;border-radius:50%;margin:4px auto 0;background:var(--c-act);border:2px solid var(--surface)}
.agel b.ach{top:17px}.agel b.cal::after{background:var(--text2)}.agel b.ach::after{background:var(--surface);border:2px solid var(--c-body);width:8px;height:8px;margin-top:6px}
.agel span{position:absolute;top:30px;height:2px;background:var(--c-act)}
.srctag{display:inline-block;font-size:11px;font-weight:600;padding:1px 8px;border-radius:999px;border:1px solid var(--sep);color:var(--text2)}
.srctag.e{color:var(--p1);border-color:currentColor}
.srcseg{margin:8px 0;display:flex;width:100%}.srcseg button{flex:1 1 0;padding-inline:6px;min-width:0}
.srcrow{padding:8px 0;border-top:1px solid var(--sep)}.srcrow .srcseg{margin:6px 0 0}.srchead{display:flex;justify-content:space-between;align-items:center;gap:8px}.srcvals{display:flex;gap:16px;margin-top:2px}
/* Touren */
.tour{display:grid;gap:14px;grid-template-columns:minmax(300px,370px) minmax(0,1fr);grid-template-areas:"list map" "list det";align-items:start}
.tour .list{grid-area:list}.tour .mapcol{grid-area:map}.tour .det{grid-area:det}
@media (max-width:900px){.tour{grid-template-columns:minmax(0,1fr);grid-template-areas:"map" "det" "list"}}
.mapbox{position:relative;border-radius:var(--r);overflow:hidden;height:clamp(330px,52vh,560px);border:1px solid var(--sep);background:var(--field);touch-action:none}
.mapbox>canvas#map{width:100%;height:100%;display:block;cursor:grab;position:relative;z-index:1}#mlmap{position:absolute;inset:0;pointer-events:none}.maplibregl-canvas{outline:0}
.mapbox>canvas#map:active{cursor:grabbing}
.ov{position:absolute;display:flex;gap:6px;z-index:2}
.pick{position:absolute;left:8px;right:8px;bottom:8px;max-height:60%;display:flex;flex-direction:column;background:color-mix(in srgb,var(--surface) 92%,transparent);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-radius:var(--r);box-shadow:var(--shadow);overflow:hidden;z-index:5}
.pickh{display:flex;align-items:center;justify-content:space-between;padding:4px 4px 4px 14px;border-bottom:1px solid var(--sep)}
.pickl{overflow-y:auto}.pickl .row:last-child{border-bottom:0}
.ov.tl{left:10px;top:10px;flex-wrap:wrap;max-width:calc(100% - 70px)}
.ov.tr{right:10px;top:10px;flex-direction:column}
.ov.bl{left:10px;bottom:8px;font-size:11px;color:var(--text2);background:color-mix(in srgb,var(--surface) 82%,transparent);padding:3px 8px;border-radius:8px;max-width:calc(100% - 20px)}
.ov .chip,.ov .ib{box-shadow:var(--shadow);border:0}
.scrubwrap{margin-top:10px;background:var(--surface);border:1px solid var(--sep);border-radius:var(--r);padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.scrubrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.scrubrow .cur{flex:1;min-width:150px;font-weight:600}
#scrub{width:100%;height:68px;display:block;touch-action:none;cursor:ew-resize}
.list{background:var(--surface);border:1px solid var(--sep);border-radius:var(--r);overflow:hidden}
.lhead{padding:12px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid var(--sep)}
.rows{max-height:min(74vh,860px);overflow:auto}
@media (max-width:900px){.rows{max-height:520px}}
.mh{position:sticky;top:0;background:var(--surface2);padding:5px 14px;font-size:12px;font-weight:600;color:var(--text2);letter-spacing:.04em;text-transform:uppercase;z-index:1}
.row{display:grid;grid-template-columns:36px 1fr auto;gap:10px;align-items:center;width:100%;text-align:left;border:0;background:none;padding:9px 14px;border-bottom:1px solid var(--sep);min-height:56px}
.row[aria-current="true"]{background:color-mix(in srgb,var(--text) 8%,var(--surface))}
.row .av{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:#fff}
.row .t{display:flex;flex-direction:column;min-width:0}
.row .t b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row .r{text-align:right;font-weight:600}
.range{display:flex;gap:8px;align-items:center;font-size:13px}
.det .card{padding:14px}
.dh{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.dh h3{margin:0;font-size:20px}
.pill{border-radius:999px;padding:2px 9px;font-size:12px;color:#fff}
.chartbox{position:relative;touch-action:pan-y}
.chartbox svg{display:block;width:100%}
.ro{font-size:12px;color:var(--text2);min-height:18px;margin:6px 0 2px}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{font-weight:600;color:var(--text2);text-align:right;padding:4px 6px;font-size:12px}
.tbl td{padding:5px 6px;text-align:right;border-top:1px solid var(--sep)}
.tbl th:first-child,.tbl td:first-child{text-align:left}
.bar{height:8px;border-radius:4px;background:var(--surface2);position:relative;min-width:60px}
.bar i{position:absolute;inset:0 auto 0 0;border-radius:4px}
.zones{display:flex;height:14px;border-radius:7px;overflow:hidden;gap:2px;margin:6px 0 10px}
.zones i{display:block}
.tip{position:absolute;pointer-events:none;background:var(--text);color:var(--bg);padding:6px 9px;border-radius:8px;font-size:12px;white-space:nowrap;z-index:3;transform:translate(-50%,-110%)}
.note{background:var(--surface2);border-radius:10px;padding:10px 12px;font-size:13px}
/* Coach */
.chat{display:flex;flex-direction:column;gap:8px;max-height:320px;overflow:auto;margin:10px 0}
.msg{padding:8px 12px;border-radius:16px;max-width:88%;white-space:pre-line}
.msg.me{align-self:flex-end;background:var(--text);color:var(--bg)}
.msg.ai{align-self:flex-start;background:var(--surface2)}
form.ask{display:flex;gap:8px}
form.ask input{flex:1;min-width:0;border:1px solid var(--sep);border-radius:999px;padding:9px 14px;background:var(--surface);color:var(--text);font:inherit;min-height:40px}
.acwr{height:14px;border-radius:7px;position:relative;background:var(--surface2)}
.acwr i{position:absolute;top:-4px;width:4px;height:22px;background:var(--text);border-radius:2px}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}

.demo{font-size:12px;font-weight:600;letter-spacing:0;border:1px solid var(--sep);border-radius:999px;padding:2px 9px;color:var(--text2);vertical-align:middle;margin-left:8px}
.stack{display:flex;flex-direction:column;gap:14px}
button:disabled{opacity:.35;cursor:default}
#dpick{min-width:44px;min-height:44px;box-sizing:border-box}
.daybar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.dl{display:flex;flex-direction:column;min-width:130px;line-height:1.2}.dl b{font-size:17px}
.strip{display:flex;gap:4px;margin-left:auto;overflow-x:auto;max-width:100%}
.strip button{border:0;background:none;border-radius:12px;min-width:44px;min-height:56px;padding:4px 6px;display:flex;flex-direction:column;align-items:center;gap:1px}
.strip button[aria-pressed="true"]{background:var(--text);color:var(--bg)}.strip button[aria-pressed="true"] .muted{color:inherit;opacity:.75}
.pd{width:6px;height:6px;border-radius:50%;background:var(--text2);display:block}.strip button[aria-pressed="true"] .pd{background:var(--bg)}
.hero{display:flex;gap:16px;align-items:center;margin-bottom:16px}
.big{font-size:22px;font-weight:700;display:flex;align-items:center;gap:8px;line-height:1.2}
.cg{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))}
.dcard{border:1px solid var(--sep);background:var(--surface);border-radius:14px;padding:12px 14px;text-align:left;display:flex;flex-direction:column;gap:4px;min-height:44px}
.dcard[aria-expanded="true"]{border-color:var(--text);background:var(--surface2)}
.dh2{display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px}.chev{margin-left:auto;color:var(--text2);display:inline-flex}
.bigv{font-size:22px;font-weight:700;line-height:1.15}.bigv small{font-size:12px;font-weight:600;color:var(--text2)}
.lg{display:flex;gap:4px 12px;flex-wrap:wrap;font-size:12px;color:var(--text2)}.lg span{display:inline-flex;align-items:center;gap:5px}.lg .dot{width:8px;height:8px}
.meter{height:10px;border-radius:5px;background:var(--surface2);overflow:hidden;margin:6px 0 4px}.meter i{display:block;height:100%;border-radius:5px}
.dcard .zones{margin:6px 0 2px;height:10px;border-radius:5px}
.dpanel{margin-top:12px;border:1px solid var(--sep);border-radius:14px;padding:14px;background:var(--surface)}
.dtop{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;margin-bottom:10px}
.arow{display:grid;grid-template-columns:56px 1fr auto 16px;gap:12px;align-items:center;width:100%;text-align:left;border:0;border-top:1px solid var(--sep);background:none;padding:10px 0;min-height:60px}
.arow .t{display:flex;flex-direction:column;min-width:0}.arow .t b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.arow .r{text-align:right;font-weight:600;display:flex;flex-direction:column}.arow .r .sm{font-weight:400}
.arow .mr{display:grid;place-items:center}.arow .mr svg{width:56px;height:52px;background:var(--field);border-radius:10px}.arow .av{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;color:#fff}
.delta{color:var(--text2)}
.srow{display:grid;grid-template-columns:150px 1fr 60px;gap:10px;align-items:center;padding:6px 0;font-size:15px}.srow span{display:flex;gap:8px;align-items:center}.srow b{text-align:right}
.lgx{display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-top:4px}
.heatwrap .hm{overflow-x:auto}.heatwrap rect[data-n]:not([data-n="0"]){cursor:pointer}
.sumkv{width:100%;margin-top:4px}.range{flex-wrap:wrap}
.acwr i{background:var(--text)}

/* Bubble-Card-Stil: Glas-Kacheln, große Radien, Kategorie-Farben, schwebende Leiste unten */

h1{font-size:28px}
.card{border-radius:28px;background:color-mix(in srgb,var(--surface) 84%,transparent);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);border:1px solid var(--edge);box-shadow:0 1px 3px rgba(0,0,0,.05)}
.dcard{border-radius:22px;background:color-mix(in srgb,var(--surface) 92%,transparent);border-color:var(--edge);box-shadow:0 1px 2px rgba(0,0,0,.04)}
.dcard[aria-expanded="true"]{background:color-mix(in srgb,var(--cc) 12%,var(--surface));border-color:color-mix(in srgb,var(--cc) 50%,transparent)}
.ico{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--cc) 16%,transparent);color:var(--cc);flex:none}
.dpanel{border-radius:22px}
.ib{width:44px;height:44px}
.chips2{display:flex;gap:6px;flex-wrap:wrap}
.chip{min-height:40px;padding:6px 14px}
#who .chip[aria-pressed="true"]{background:var(--text);color:var(--bg);border-color:var(--text)}
.seg button{min-height:40px}
.mapbox,.scrubwrap,.list{border-radius:24px}
.dock{position:sticky;width:max-content;max-width:100%;margin:12px auto 0;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:5;display:flex;gap:4px;padding:6px;border-radius:999px;background:color-mix(in srgb,var(--surface) 72%,transparent);-webkit-backdrop-filter:blur(22px) saturate(1.6);backdrop-filter:blur(22px) saturate(1.6);border:1px solid var(--edge);box-shadow:var(--shadow);z-index:20}
.dock button{border:0;background:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:84px;min-height:54px;border-radius:999px;color:var(--text2);font-size:11px;font-weight:600}
.dock button[aria-current="page"]{color:var(--tc)}
.chartbox .sc svg{width:auto}.sc{display:flex}.yax{flex:none}.cg{grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))}
.scl{flex:1;min-width:0;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}.scl::-webkit-scrollbar{display:none}
.prange{font-size:13px;color:var(--text2);margin:2px 0 6px}
.rangein{display:flex;gap:10px 14px;flex-wrap:wrap;align-items:center;margin-top:10px}.rangein label,.dl2{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--text2)}.rangein input,.dl2 input{font:inherit;color:var(--text);background:var(--surface);border:1px solid var(--sep);border-radius:12px;padding:8px 10px;min-height:40px}.datebtn{position:relative;overflow:hidden}.datebtn input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}

.dday{margin-top:16px;border-top:1px solid var(--sep);padding-top:12px}
button.srow{border:0;background:none;width:100%;text-align:left;font:inherit;color:inherit;min-height:44px;border-radius:12px}button.srow[aria-expanded="true"]{background:var(--surface2)}.tl{margin:2px 0 8px}
.kv .kvb{border:0;background:none;text-align:left;font:inherit;color:inherit;display:flex;flex-direction:column;padding:6px 8px;margin:-6px -8px;border-radius:12px;min-height:44px}.kv .kvb[aria-pressed="true"]{background:var(--surface2)}
.recs{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.rec{border:1px solid var(--sep);background:var(--surface);border-radius:16px;padding:10px 12px;text-align:left;display:flex;flex-direction:column;gap:2px;min-height:44px;font:inherit;color:inherit}.rec b{font-size:20px}

:host{--tc-h:#2E7D32;--tc-t:#B45309;--tc-s:#7B1FA2}
:host([data-theme="dark"]){--tc-h:#66BB6A;--tc-t:#FFA726;--tc-s:#CE93D8}
.dock{background:color-mix(in srgb,var(--surface) 90%,transparent)}
.dock button[aria-current="page"]{background:color-mix(in srgb,var(--tc) 14%,transparent);font-weight:700}
.chip,.seg button,.btn,.rangein input,.dl2 input,.rec,button.srow{min-height:44px}
.hero .traffic{margin-left:auto}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}.phead{margin-bottom:8px}
.pgrid{display:flex;flex-direction:column;gap:10px;margin-top:12px}.pcard{width:100%}.pcell{min-width:0}
.phero{display:flex;align-items:center;gap:10px;min-width:0}.phero .traffic{margin-left:auto;padding:5px;gap:3px}.phero .traffic i{width:11px;height:11px}
.ptab{display:flex;flex-direction:column}
.prow{display:grid;grid-template-columns:minmax(84px,1fr) 1.1fr 1.1fr;gap:8px;align-items:center;padding:8px 6px;border:0;border-top:1px solid var(--sep);background:none;font:inherit;color:inherit;text-align:left;min-height:44px;width:100%;border-radius:0}
.prow.ph{border-top:0;min-height:36px;font-weight:600}.prow.ph .dot{margin-right:6px}
button.prow[aria-pressed="true"]{background:var(--surface2);border-radius:12px}
.pv{display:flex;flex-direction:column;min-width:0}.pv b{font-size:17px}.pl{color:var(--text2);font-size:13px}
.pairrec{display:flex;flex-direction:column;gap:6px;align-items:stretch}
.pr2{border:0;background:none;display:flex;align-items:center;gap:8px;font:inherit;color:inherit;text-align:left;min-height:36px;padding:0}.pr2 b{font-size:17px}
.morebtn{border:0;background:none;width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;font:inherit;color:inherit;min-height:56px}.morebtn>span{display:flex;flex-direction:column}
[data-pm] .kv{display:none}
@media (max-width:520px){.prow{grid-template-columns:minmax(70px,.9fr) 1.1fr 1.1fr}.phero{flex-wrap:wrap}}

.sheetwrap{position:fixed;inset:0;z-index:60;display:flex;align-items:flex-end;justify-content:center;pointer-events:none}
.sheetwrap.on{pointer-events:auto}
.sheetbg{position:absolute;inset:0;background:rgba(0,0,0,.38);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .2s}
.sheetwrap.on .sheetbg{opacity:1}
.sheet{position:relative;width:100%;max-width:760px;max-height:90vh;max-height:90dvh;display:flex;flex-direction:column;background:color-mix(in srgb,var(--surface) 94%,transparent);-webkit-backdrop-filter:blur(26px) saturate(1.4);backdrop-filter:blur(26px) saturate(1.4);border:1px solid var(--edge);border-radius:28px 28px 0 0;box-shadow:0 -8px 40px rgba(0,0,0,.25);transform:translateY(30px);opacity:0;transition:transform .22s ease,opacity .2s;padding-bottom:env(safe-area-inset-bottom,0px)}
.sheetwrap.on .sheet{transform:none;opacity:1}
.sgrip{width:40px;height:5px;border-radius:3px;background:var(--sep);margin:8px auto 0;touch-action:none}
.shead{display:flex;align-items:center;gap:10px;padding:8px 8px 4px max(20px,env(safe-area-inset-left,0px));touch-action:none}
.stitle{font-size:22px;font-weight:400;margin:0;flex:1;min-width:0;line-height:1.2}
.sico{display:inline-flex}
.sx{border:0;background:none;width:44px;height:44px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:var(--text2)}
.sbody{overflow:auto;padding:8px max(20px,env(safe-area-inset-left,0px)) 20px max(20px,env(safe-area-inset-left,0px));overscroll-behavior:contain}
@media (min-width:700px){.sheetwrap{align-items:center}.sheet{border-radius:28px;max-height:86vh;box-shadow:0 20px 60px rgba(0,0,0,.35)}.sgrip{display:none}.shead{padding-top:16px}}
@media (prefers-reduced-motion:reduce){.sheet,.sheetbg{transition:none}}
/* Schlank & ruhig (Entwurf nach iOS 26: wenig Rahmen, Inhalt vor Fläche) */
.chip{border-color:transparent;background:color-mix(in srgb,var(--text) 6%,transparent);font-weight:600}
.chip[aria-pressed="true"]{background:var(--text);color:var(--bg);border-color:transparent}
.bar{height:6px;border-radius:3px}.meter{height:6px;border-radius:3px}.meter i{border-radius:3px}
.h2{font-size:17px;font-weight:600}
.card{border-color:var(--sep);box-shadow:none}
.card .card{background:none;border:0;box-shadow:none;padding:12px 0 0;border-top:1px solid var(--sep);border-radius:0;-webkit-backdrop-filter:none;backdrop-filter:none}
.seg{background:color-mix(in srgb,var(--text) 6%,transparent)}
/* Review 1-6 */
.heatwrap{--emp:color-mix(in srgb,var(--text) 9%,var(--surface))}
.card .dcard{background:color-mix(in srgb,var(--text) 4%,transparent);border-color:transparent;box-shadow:none}
.card .dcard[aria-expanded="true"]{background:color-mix(in srgb,var(--cc) 12%,var(--surface));border-color:color-mix(in srgb,var(--cc) 50%,transparent)}
@media (max-width:640px){
 .strip{margin-left:0;width:100%;justify-content:space-between}.strip button{flex:1}
 .scrubrow .cur{order:2;flex:1 1 100%;min-width:0}
 #rq{flex-wrap:nowrap;overflow-x:auto;margin-right:-16px;padding-right:16px;scrollbar-width:none}#rq::-webkit-scrollbar{display:none}#rq .chip{flex:none}
}
/* Touren-Fenster: Desktop unverändert, Handy als Bottom-Sheet */
.tsheet,.tsb{display:contents}.grabber{display:none}
@media (max-width:640px){
 .tour{display:block}.mapcol{margin:0 -16px}
 .mapbox{height:calc(100dvh - 190px);min-height:380px;border-radius:0;border:0}
 .pick{bottom:calc(var(--ins,0px) + 8px)}
 .tsheet{display:flex;flex-direction:column;position:fixed;left:0;right:0;bottom:0;height:88dvh;z-index:15;background:color-mix(in srgb,var(--surface) 94%,transparent);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);border-radius:28px 28px 0 0;border-top:1px solid var(--sep);box-shadow:0 -6px 24px rgba(0,0,0,.14);--vis:46dvh;transform:translateY(calc(100% - var(--vis)));transition:transform .28s cubic-bezier(.3,.7,.4,1);will-change:transform}
 .tsheet[data-d="s"]{--vis:calc(200px + env(safe-area-inset-bottom,0px))}.tsheet[data-d="l"]{--vis:88dvh}
 .grabber{display:flex;width:100%;height:44px;flex:none;border:0;background:none;align-items:center;justify-content:center;touch-action:none;cursor:grab}
 .grabber i{display:block;width:40px;height:5px;border-radius:3px;background:color-mix(in srgb,var(--text) 28%,transparent)}
 .tsb{display:block;flex:1;min-height:0;overflow-y:hidden;overscroll-behavior:contain;padding:0 12px calc(110px + env(safe-area-inset-bottom,0px))}
 .tsheet[data-d="l"] .tsb{overflow-y:auto}
 .tsheet .scrubwrap,.tsheet .list{border:0;box-shadow:none;background:none;margin-top:0;padding-inline:0}
 .tsheet .det{margin-top:10px}.tsheet .list{margin-top:10px;border-top:1px solid var(--sep);border-radius:0}
 @media (prefers-reduced-motion:reduce){.tsheet{transition:none}}
}
/* Stufe 1: HIG (Glas nur für Schwebendes), Kontrast, Fokus */
.card{background:var(--surface);-webkit-backdrop-filter:none;backdrop-filter:none;border:1px solid var(--sep);box-shadow:none}
.pill{background:color-mix(in srgb,var(--pc) 18%,var(--surface));color:var(--text);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--pc) 50%,transparent);font-weight:600}
:host{--tc-t:#B45309}
.dock button[aria-current="page"]{color:var(--text)}.dock button[aria-current="page"] svg{color:var(--tc)}
button:focus:not(:focus-visible){outline:none}
.sx:focus:not(:focus-visible){outline:none;box-shadow:none}
:host([data-theme="dark"]){--text2:#A8B0BF}
.emptyline{font-size:13px;color:var(--text2);padding:4px 0}
@media (max-width:640px){.hero{flex-wrap:wrap}.hero>svg{order:1;flex:none}.hero>.traffic{order:2;margin-left:auto}.hero>div:not(.traffic){order:3;flex:1 1 100%}}
/* Zeitleiste der Touren entfernt */
.scrubwrap{display:none!important}
/* Desktop: Karten der Trends nebeneinander */
@media (min-width:1100px){
.stack{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(520px,1fr));grid-auto-flow:dense;gap:14px;align-items:stretch}
.stack>#rcard,.stack>#acard,.stack>:nth-last-child(-n+3){grid-column:1/-1}
.stack>.cols{grid-template-columns:minmax(0,1fr)}
}
.dday:first-child{border-top:0;margin-top:0;padding-top:0;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--sep)}
/* Touren mobil: Karte zuerst, Filter als Pillen auf der Karte, Tour als Kachel */
.fb,.fpop,.tsum,.tclose{display:none}
@media (max-width:640px){
.ov.fb{display:flex;left:10px;top:10px;right:10px;gap:8px;flex-wrap:nowrap}
.fpill{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--sep);background:color-mix(in srgb,var(--surface) 90%,transparent);-webkit-backdrop-filter:blur(14px) saturate(1.4);backdrop-filter:blur(14px) saturate(1.4);font:inherit;font-size:15px;font-weight:600;color:var(--text);box-shadow:var(--shadow);cursor:pointer}
.fpill svg:last-child{transform:rotate(90deg);color:var(--text2)}.fpill[aria-expanded="true"] svg:last-child{transform:rotate(-90deg)}
.fpop{display:block;position:absolute;left:10px;right:10px;top:62px;z-index:6;max-height:min(60%,420px);overflow-y:auto;background:color-mix(in srgb,var(--surface) 96%,transparent);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);border-radius:var(--r);box-shadow:var(--shadow);border:1px solid var(--sep)}
.fpop[hidden]{display:none}
.fpop .lhead{border:0;padding:12px}.fpop[data-sec="sport"] #rangebar{display:none}.fpop[data-sec="date"] #sports{display:none}.fpop .sumkv{display:none}
.ov.tl{display:none}
.tsheet .tsum{display:block;padding:6px 4px 2px;font-size:17px}.tsheet[data-sel="1"] .tsum{display:none}
.tsheet[data-sel="0"] .det{display:none}.tsheet[data-sel="1"] .list{display:none}
.tsheet .tclose{display:none;position:absolute;top:2px;right:8px;z-index:3}.tsheet[data-sel="1"] .det{margin-top:34px}.tsheet[data-sel="1"] .tclose{display:inline-flex}
}
/* Menü mobil: klein, nur Symbole, rechts unten */
@media (max-width:640px){
.dock{left:auto;right:max(12px,env(safe-area-inset-right,0px));transform:none;margin:12px 12px 0 auto;padding:4px;gap:2px}
.dock button{min-width:48px;min-height:48px;gap:0}
.dock button span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.wrap{padding-bottom:calc(76px + env(safe-area-inset-bottom,0px))}
}
/* Bereitschaft und Body Battery als Ringe mit Details */
.ringb,.bbw{border:0;background:none;padding:0;font:inherit;color:inherit;cursor:pointer;flex:none;border-radius:var(--r)}
.bbw{display:flex;flex-direction:column;align-items:center;gap:2px;margin-left:auto;min-width:48px}
.ins p{margin:6px 0}.insbig{display:flex;align-items:baseline;gap:10px}.insbig b{font-size:34px;font-weight:700}.insh{font-size:15px;font-weight:600;margin:16px 0 4px}
@media (max-width:640px){.hero>.ringb{order:1}.hero>.bbw{order:2;margin-left:auto}.hero>div:not(.traffic){order:3;flex:1 1 100%}}
/* Kopf-Entwürfe */
.hvsw{display:flex;gap:6px;margin:0 0 10px;flex-wrap:wrap}.hvsw button{min-height:36px;min-width:44px;padding:0 12px;border-radius:999px;border:1px solid var(--sep);background:none;font:inherit;font-size:13px;color:var(--text2)}.hvsw button[aria-pressed="true"]{background:var(--text);color:var(--surface);border-color:var(--text)}
.hA{display:grid;grid-template-columns:1fr 1fr;gap:8px}.gk{display:flex;align-items:center;gap:10px;padding:10px;border:0;border-radius:var(--r);background:var(--surface2);font:inherit;color:inherit;text-align:left;cursor:pointer;min-width:0}.gk>span{display:flex;flex-direction:column;min-width:0}.gk b{font-size:17px;font-weight:700}.gk svg{flex:none}
.hsub{margin:8px 2px 0}
.stand{margin:0 2px}
.hB{display:flex;flex-direction:column;gap:6px}.hbt{display:flex;align-items:center;gap:8px;font-size:28px;font-weight:700}.hbs{font-size:15px}.mrow{display:grid;grid-template-columns:96px 1fr auto 16px;align-items:center;gap:10px;min-height:48px;border:0;border-top:1px solid var(--sep);background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;padding:0}.mrow:first-of-type{margin-top:6px}.mrow b{min-width:44px;text-align:right}.mrow svg{color:var(--text2)}
.hC{display:flex;flex-direction:column;gap:6px}.hct{display:flex;align-items:center;gap:8px;font-size:28px;font-weight:700}.hcr{display:flex;gap:6px;justify-content:space-between;margin-top:8px}.hcr button{display:flex;flex-direction:column;align-items:center;gap:4px;border:0;background:none;font:inherit;color:inherit;padding:4px;flex:1;min-width:0;cursor:pointer}
.hcr button.dcard{background:none!important;box-shadow:none;border:0;padding:4px;display:flex;flex-direction:column;min-height:0}
.hcr{max-width:460px}
/* Navigation ohne schwebende Leiste: Entwürfe */
#tabs.nvhide{display:none!important}
#tabs2[hidden]{display:none}
.nvtop{display:flex;width:100%;margin:2px 0 4px}.nvtop button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px}.nvtop button[aria-pressed="true"] svg{color:var(--tc)}
.nvtitle{display:flex;gap:18px;overflow-x:auto;margin:-2px 0 2px;scrollbar-width:none}.nvtitle::-webkit-scrollbar{display:none}.nvtitle button{border:0;background:none;padding:0;min-height:44px;font:inherit;font-size:28px;font-weight:700;color:var(--text2);opacity:.55;cursor:pointer;white-space:nowrap}.nvtitle button[aria-current="page"]{color:var(--text);opacity:1}
.dock.nvbar{left:0!important;right:0!important;transform:none!important;width:auto!important;max-width:none!important;margin:0!important;bottom:0!important;border-radius:0!important;border-width:1px 0 0!important;justify-content:space-around;padding:4px 8px calc(4px + env(safe-area-inset-bottom,0px))!important;background:color-mix(in srgb,var(--surface) 96%,transparent)!important;box-shadow:none!important}
.dock.nvbar button{flex:1;min-width:0!important;background:none!important;gap:2px!important}
.dock.nvbar button span{position:static!important;width:auto!important;height:auto!important;clip:auto!important}
.dock.nvbar button[aria-current="page"]{color:var(--text)}
.wrap.nvnodock{padding-bottom:calc(24px + env(safe-area-inset-bottom,0px))}
/* Personenwahl: beide Personen einzeln an/aus, Kopf oben fixiert */
.top{position:sticky;top:0;z-index:12;margin:0 calc(-1*max(16px,env(safe-area-inset-left,0px)));padding:8px max(16px,env(safe-area-inset-left,0px));background:color-mix(in srgb,var(--bg) 98%,transparent);-webkit-backdrop-filter:blur(16px) saturate(1.4);backdrop-filter:blur(16px) saturate(1.4)}
.whot{gap:8px;flex-wrap:nowrap}
.whot button{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--sep);background:var(--surface);font:inherit;font-size:15px;font-weight:600;color:var(--text2);cursor:pointer}
.whot button .dot{width:10px;height:10px;border-radius:50%;background:transparent;box-shadow:inset 0 0 0 2px var(--pc)}
.whot button[aria-pressed="true"]{background:color-mix(in srgb,var(--pc) 16%,var(--surface));border-color:color-mix(in srgb,var(--pc) 45%,transparent);color:var(--text)}
.whot button[aria-pressed="true"] .dot{background:var(--pc);box-shadow:none}
/* Handy: Kopf mit Personenwahl fest oben, auch bei Touren */
@media (max-width:640px){
.top{position:fixed;left:0;right:0;top:0;margin:0;z-index:16;padding:calc(8px + env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) 8px max(16px,env(safe-area-inset-left,0px))}
.wrap{padding-top:calc(var(--toph,132px) - env(safe-area-inset-top,0px))}
.mapbox{height:calc(100dvh - var(--toph,132px))}
}
.pstack{display:flex;flex-direction:column;gap:14px;min-width:0}
.pcmp{display:grid;grid-template-columns:minmax(84px,auto) 1fr 1fr;align-items:center;gap:6px 8px;margin:4px 0 12px;max-width:520px}
.pc-h{display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center}.pc-h b{display:flex;align-items:center;gap:6px;font-size:17px}.pc-h .sm{display:flex;align-items:center;gap:4px;color:var(--text2)}
.pc-l{font-size:15px;color:var(--text2)}.pc-r{display:flex;justify-content:center;border:0;background:none;padding:2px;min-height:44px;cursor:pointer;border-radius:var(--r)}
.pcmp{grid-template-columns:minmax(96px,auto) 1fr 1fr!important;gap:2px 12px!important}
.pc-r{flex-direction:column;align-items:stretch!important;justify-content:center!important;gap:4px;padding:6px 4px!important}
.pc-v{display:flex;align-items:center;justify-content:center;gap:6px}.pc-v b{font-size:20px;font-weight:700}
.pc-bar{display:block;height:6px;border-radius:999px;background:var(--surface2);overflow:hidden}.pc-bar i{display:block;height:100%;border-radius:999px}
.pc-l{border-top:1px solid var(--sep);align-self:stretch;display:flex;align-items:center}
.whot .cmpb{padding:0;width:44px;justify-content:center}.whot .cmpb[aria-pressed="true"]{background:var(--text);color:var(--surface);border-color:var(--text)}
/* Touren mobil nach Review: Karte fest, Blatt deckend, Stufen sauber */
@media (max-width:640px){
.tour .mapbox{position:fixed;top:var(--toph,132px);left:0;right:0;bottom:0;height:auto;min-height:0}
.tsheet{height:calc(100dvh - var(--toph,132px) - 8px);background:var(--surface);-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:0 -6px 24px rgba(0,0,0,.14)}
.tsheet[data-d="s"]{--vis:calc(150px + env(safe-area-inset-bottom,0px))}
.tsheet[data-d="l"]{--vis:calc(100dvh - var(--toph,132px) - 8px)}
.tsheet .tsb,.tsheet[data-d="l"] .tsb{overflow-y:auto;padding-bottom:calc(100dvh - var(--toph,132px) - 8px - var(--vis,46dvh) + 84px)}
.tsheet .rows{max-height:none;overflow:visible}
.tsheet[data-d="s"][data-sel="0"] .list{visibility:hidden}
.tsheet .mh{background:none;text-transform:none;letter-spacing:0;font-size:12px;padding:10px 4px 4px;position:static}
.tsheet .tclose{top:0;right:12px}.tsheet[data-sel="1"] .det{margin-top:0}
/* X in der Griffzeile wie iOS: kleiner grauer Kreis, 44-px-Trefferfläche, Abstand zur Ecke */
.tsheet .tclose{top:0;right:12px;width:44px;height:44px;border:0;align-items:center;justify-content:center;padding:0;color:var(--text2);background:radial-gradient(circle,var(--surface2) 0 15px,transparent 15.5px)}.tsheet .tclose svg{width:16px;height:16px}
.tsheet .det .card{border:0;background:none;box-shadow:none;padding:4px 4px 0}
.tsheet .det .dh{padding-right:52px}
.fpop{right:62px}
#zi,#zo{display:none!important}
.dock{position:fixed!important;bottom:calc(12px + env(safe-area-inset-bottom,0px))!important;right:max(12px,env(safe-area-inset-right,0px))!important;left:auto!important;margin:0!important;z-index:20!important}
.ov.bl{bottom:calc(var(--ins,0px) + 8px)}
}
@media (max-width:640px) and (prefers-color-scheme:dark){.tsheet{box-shadow:0 -8px 24px rgba(0,0,0,.45)}}
`;
const HTML=`<div class="wrap">
  <div class="top">
    <h1><button class="ib" id="hamb" hidden aria-label="Menü" style="margin-right:8px;vertical-align:middle"><svg class="i" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>Fitness <span class="demo" title="Aktivitäten, Routen und ältere Verläufe sind erfundene Beispieldaten. Nur die Tageswerte von heute kommen aus Home Assistant.">Beispieldaten</span></h1>
    <div class="chips2" id="who" role="group" aria-label="Person"></div>
  </div>
  <main id="view"></main>
</div>
<nav class="dock" id="tabs" aria-label="Bereich"></nav>
`;
const liveSigOf=h=>Object.entries(h.states||{}).filter(([id,s])=>s&&((/^binary_sensor\.garmin_inreach_relay_livetrack_/.test(id)&&s.state==='on')||/^sensor\.garmin_[a-z0-9]+_(schritte|body_battery|trainingsbereitschaft|ruhepuls|durchschnittliches_stresslevel)$/.test(id)||/^sensor\.[a-z0-9]+_(schritte|body_battery|ruhepuls|durchschnittlicher_stress|schlafwert|hrv_letzte_nacht)$/.test(id))).map(([id,s])=>id+'@'+((s.attributes||{}).last_update||s.last_updated||'')).sort().join('|');
function createApp(host,root,opts){

const $=(s,e=root)=>e.querySelector(s),$$=(s,e=root)=>[...e.querySelectorAll(s)];
const D=864e5,dpr=Math.min(2,window.devicePixelRatio||1);
const css=n=>getComputedStyle(host).getPropertyValue(n).trim();
/* Lücken bleiben Lücken: fehlende Werte (null) werden als – gezeigt, nie ersetzt */
const ok=v=>v!=null&&typeof v!=='boolean'&&isFinite(v),nn=a=>a.filter(ok);
const sumA=a=>{const v=nn(a);return v.length?v.reduce((x,y)=>x+y,0):null},maxA=a=>{const v=nn(a);return v.length?Math.max(...v):null},minA=a=>{const v=nn(a);return v.length?Math.min(...v):null};
const f0=n=>ok(n)?Math.round(n).toLocaleString('de-DE'):'–',f1=n=>ok(n)?n.toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1}):'–';
const uv=(v,unit,f)=>ok(v)?(f||f0)(v)+unit:'–';
const dfmt=(d,o)=>d.toLocaleDateString('de-DE',o);
const hm=s=>{if(!ok(s))return'–';s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?h+':'+String(m).padStart(2,'0')+' h':m+' min'};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const IC={warn:'<path d="M12 4 3 20h18L12 4z"/><path d="M12 10v4.5M12 17.4v.1"/>',sliders:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',cmp:'<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>',spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',close:'<path d="M6 6l12 12M18 6L6 18"/>',mtb:'<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-8h5l3 8M10 8l3 8M9 6h3"/>',run:'<circle cx="14" cy="5" r="2"/><path d="M12 9l-3 3 3 2-2 5M12 9l4 2 3-1M12 14l4 1 1 4"/>',hike:'<path d="M3 19l6-10 4 6 2-3 6 7z"/>',ski:'<path d="M4 17l16-6M6 20l14-5"/><circle cx="9" cy="6" r="2"/><path d="M9 9l3 4"/>',swim:'<path d="M3 17c2 0 2-1.5 4.5-1.5S10 17 12 17s2.5-1.5 4.5-1.5S19 17 21 17M7 12l4-3 3 2"/><circle cx="16" cy="7" r="2"/>',yoga:'<circle cx="12" cy="5" r="2"/><path d="M12 8v5M7 20l5-7 5 7M6 11h12"/>',moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',bolt:'<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',body:'<circle cx="12" cy="5.5" r="2"/><path d="M6 9h12M12 9v5M9 21l3-7 3 7"/>',calendar:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',map:'<path d="M9 4L4 6v14l5-2 6 2 5-2V4l-5 2zM9 4v14M15 6v14"/>',chart:'<path d="M5 20V10M12 20V4M19 20v-8"/>',play:'<path d="M8 5l11 7-11 7z"/>',pause:'<path d="M8 5v14M16 5v14"/>',prev:'<path d="M15 5l-7 7 7 7"/>',next:'<path d="M9 5l7 7-7 7"/>',plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',send:'<path d="M4 12l16-8-6 16-3-7z"/>'};
const ic=(n,s)=>`<svg class="i" viewBox="0 0 24 24"${s?` style="width:${s}px;height:${s}px"`:''}>${IC[n]}</svg>`;
const SP={mtb:{n:'Mountainbike',k:'Mountainbiken',hr:131,v:15.5,kc:10},run:{n:'Laufen',k:'Laufen',hr:150,v:10.4,kc:13},hike:{n:'Wandern',k:'Wandern',hr:119,v:3.9,kc:7.5},ski:{n:'Snowboard',k:'Snowboarden',hr:122,v:14,kc:8},swim:{n:'Schwimmen',k:'Schwimmen',hr:128,v:1.8,kc:9},yoga:{n:'Yoga',k:'Yoga',hr:82,v:0,kc:3}};
const PL={home:{n:'Musterstadt',lat:48.52,lon:-30.95,el:360,sp:3.5},mtn:{n:'Bergdorf',lat:46.41,lon:-28.40,el:1180,sp:3},alp:{n:'Hochtal',lat:46.47,lon:-28.26,el:1450,sp:2},coast:{n:'Küstenort',lat:45.66,lon:-26.22,el:60,sp:2},lake:{n:'Bergsee',lat:46.55,lon:-26.07,el:560,sp:1},pass:{n:'Passhöhe',lat:46.40,lon:-28.42,el:1700,sp:2}};
const PERS={p1:{n:'Person 1',c:'--p1'},p2:{n:'Person 2',c:'--p2'}};
const col=w=>css(PERS[w].c);
let START,TODAY,ND,OFF=0,ACTS=[],byId={},TODAYV={},DAILY={},LIVE=false,S;
const dAt=i=>new Date(START.getFullYear(),START.getMonth(),START.getDate()+i);
const dayOf=d=>Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(2026,0,1))/D)-OFF;
/* ---------- Beispieldaten ---------- */
const W0=(lat,lon)=>{const s=256,r=lat*Math.PI/180;return[(lon+180)/360*s,(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*s]};
function placeFor(d,who,sport){const m=d.getMonth(),dd=d.getDate(),k=m*100+dd;
 if(k>=214&&k<=221)return'pass';if(k>=808&&k<=812)return'lake';if(who==='p2'&&k>=905&&k<=909)return'coast';
 if(k>=926&&k<=1018)return sport==='mtb'?'alp':'mtn';return'home'}
function makeAct(who,i,d,sport,place,seed,dist,gain,name){
 const r=rng(seed),P=PL[place];
 const a={id:who+i,who,date:d,sport,place,name:name||(P.n+' '+SP[sport].k),seed,dist,gain,gps:sport!=='yoga'};
 if(a.gps)track(a,r);else{const dur=2400+r()*1800;a.st={dist:0,dur,gain:0,avgHR:SP.yoga.hr+r()*8,maxHR:104+r()*14,kcal:dur/60*3,load:Math.round(dur/3600*18),avgV:0}}
 return a}
function track(a,r){
 const P=PL[a.place],sp=SP[a.sport],N=Math.max(40,Math.round(a.dist*1000/45));
 const A=1,B=.45+r()*.55,phi=r()*Math.PI,p1=r()*6,p2=r()*6,p3=r()*6;
 const raw=[];let per=0;
 for(let i=0;i<=N;i++){const th=2*Math.PI*i/N,rr=1+.35*Math.sin(2*th+p1)+.2*Math.sin(3*th+p2)+.1*Math.sin(5*th+p3);const x=rr*Math.cos(th)*A,y=rr*Math.sin(th)*B;raw.push([x*Math.cos(phi)-y*Math.sin(phi),x*Math.sin(phi)+y*Math.cos(phi)]);if(i)per+=Math.hypot(raw[i][0]-raw[i-1][0],raw[i][1]-raw[i-1][1])}
 const sc=a.dist*1000/per,cLat=P.lat+(r()-.5)*P.sp*2/111,cLon=P.lon+(r()-.5)*P.sp*2/(111*Math.cos(P.lat*Math.PI/180));
 const lat=[],lon=[],ele=[],hr=[],v=[],d=[0],t=[0];
 const ph=[r()*6,r()*6,r()*6];let e0=P.el+(r()-.5)*60;
 const eraw=raw.map((_,i)=>{const th=2*Math.PI*i/N;return Math.sin(th+ph[0])*1+.55*Math.sin(2*th+ph[1])+.3*Math.sin(4*th+ph[2])});
 let g=0;for(let i=1;i<=N;i++)g+=Math.max(0,eraw[i]-eraw[i-1]);
 const es=a.gain>0&&g>0?a.gain/g:0;
 for(let i=0;i<=N;i++){lat.push(cLat+raw[i][1]*sc/111320);lon.push(cLon+raw[i][0]*sc/(111320*Math.cos(P.lat*Math.PI/180)));ele.push(e0+eraw[i]*es)}
 let gain=0,loss=0,hrS=0,mx=0;const nz=.5+r();
 for(let i=1;i<=N;i++){const dx=(lon[i]-lon[i-1])*111320*Math.cos(P.lat*Math.PI/180),dy=(lat[i]-lat[i-1])*111320,sd=Math.hypot(dx,dy)||1,de=ele[i]-ele[i-1],sl=de/sd;
  if(de>0)gain+=de;else loss-=de;
  const spd=Math.max(.25*sp.v,Math.min(1.7*sp.v,sp.v*(1-(a.sport==='ski'?-3:6)*sl)))/3.6*(.92+.16*Math.sin(i/9+nz));
  v.push(spd);d.push(d[i-1]+sd);t.push(t[i-1]+sd/spd)}
 v.unshift(v[0]);
 for(let i=0;i<=N;i++){const sl=i?(ele[i]-ele[i-1])/(d[i]-d[i-1]||1):0;const h=Math.max(62,Math.min(188,sp.hr+Math.min(28,Math.max(-14,sl*180))+8*Math.sin(i/37+nz)+3*Math.sin(i/7)));hr.push(h);hrS+=h;mx=Math.max(mx,h)}
 const dur=t[N],avgHR=hrS/(N+1);
 a.tr={lat,lon,ele,hr,v,d,t};
 a.w=lat.map((la,i)=>W0(la,lon[i]));
 a.st={dist:d[N],dur,gain,loss,avgHR,maxHR:mx,kcal:dur/60*sp.kc,load:Math.round(dur/3600*Math.max(0,avgHR-70)*1.6),avgV:d[N]/dur*3.6}}
const TIT={mtb:['Feierabendrunde','Trails nach der Arbeit','Ein bunter Rad Mix','Sonntagsausfahrt','Matschschlacht','Hausrunde mit Extra-Anstieg'],run:['Morgenrunde','Locker im Wald','Tempo-Intervalle','Laufen vor der Arbeit'],hike:['Gipfeltag','Aussicht und Käsekuchen','Wanderung zu zweit']};
function gen(who){
 const r=rng(who==='p1'?11:29),out=[];let n=0;
 for(let di=0;di<=ND;di++){const d=dAt(di),wd=d.getDay(),we=wd===0||wd===6;
  const chance=who==='p1'?(we?.8:.42):(we?.55:.36);
  if(di===ND||r()>chance)continue;
  d.setHours(6+Math.floor(r()*12),Math.floor(r()*60));
  const k=d.getMonth()*100+d.getDate(),snow=k>=214&&k<=221,lake=k>=808&&k<=812;
  let s,x=r();
  if(who==='p1'){s=snow?'ski':lake?(x<.5?'swim':'run'):(we&&x<.18?'hike':x<.62?'mtb':'run')}
  else{s=snow?(x<.6?'ski':'hike'):lake?(x<.5?'swim':'hike'):x<.4?'run':x<.65?'yoga':x<.88?'hike':'mtb'}
  if(who==='p1'&&k>=214&&k<=221&&s==='ski'&&r()<.2)s='hike';
  const pl=placeFor(d,who,s),q=r();
  const dist={mtb:18+q*26+(we?8:0),run:4.5+q*8.5,hike:8+q*7,ski:22+q*18,swim:.4+q*.4,yoga:0}[s];
  const gain={mtb:dist*17,run:dist*8,hike:dist*68,ski:dist*80,swim:0,yoga:0}[s]*(pl==='home'&&s!=='hike'?.8:1);
  {const a=makeAct(who,n++,d,s,pl,Math.floor(r()*1e9),dist,gain);if(who==='p1'&&TIT[s]&&r()<.55){const L=TIT[s];a.sname=L[Math.floor(r()*L.length)]}out.push(a)}}
 if(who==='p1'){
  for(let i=out.length-1;i>=0;i--){const dd=dayOf(out[i].date);if(dd===dayOf(new Date(2026,9,20))||dd===dayOf(new Date(2026,9,16)))out.splice(i,1)}
  {const a=makeAct('p1',n++,new Date(2026,9,20,17,49),'mtb','home',777,36.48,669,'Musterstadt Mountainbiken');a.sname='Ein bunter Rad Mix';a.sx={ach:13,pr:5,gear:'Bike 1',dev:'Garmin watch',pow:170};out.push(a)}
  {const a=makeAct('p1',n++,new Date(2026,9,16,11,25),'hike','mtn',778,12.85,915,'Bergdorf Wandern');a.sname='Gipfelrunde';a.sx={ach:10,pr:7,dev:'Garmin watch',cad:53};out.push(a)}}
 return out}
function initDemo(){START=new Date(2026,0,1);TODAY=new Date(2026,9,21);ND=Math.round((TODAY-START)/D);OFF=0;LIVE=false;
const JA=gen('p1'),KA=gen('p2'),JT=[];
JA.filter(a=>a.sport==='hike').filter((a,i)=>i%2===0).slice(0,5).forEach((a,q)=>{const di=dayOf(a.date);for(let i=KA.length-1;i>=0;i--)if(dayOf(KA[i].date)===di)KA.splice(i,1);
 const k=makeAct('p2','p2j'+q,new Date(a.date.getTime()+10*6e4),'hike',a.place,a.seed,a.dist,a.gain,a.name);k.joint=a.id;
 k.st.dur*=1.06;k.st.avgHR+=6;k.st.maxHR+=4;k.st.load=Math.round(k.st.load*1.08);k.st.kcal*=.9;k.st.avgV=k.st.dist/k.st.dur*3.6;k.tr.t=k.tr.t.map(x=>x*1.06);
 k.tr.lat=k.tr.lat.map((x,i)=>x+.00005*Math.sin(i/6));k.tr.lon=k.tr.lon.map((x,i)=>x+.00007*Math.cos(i/5));k.w=k.tr.lat.map((la,i)=>W0(la,k.tr.lon[i]));JT.push(k)});
/* Beispiele für Aktivitäten ohne GPS und ohne Höhe (nur Mockup/Demo, im Live-Betrieb kommen die Werte aus dem Tracker-Verlauf):
   Laufband mit Puls, Tempo und Distanz (keine Position, keine Höhe), Crosstrainer nur mit Puls (x-Achse = Zeit), Lauf mit GPS aber ohne Höhenwerte */
const EX=[];
{const r=rng(4242);
 {const N=150,t=[],d=[],hr=[],v=[];let dd=0,h=96;
  for(let i=0;i<=N;i++){const tt=i*16,blk=Math.floor(i/15),sp=i<12?7.5:i>N-10?7:(blk%2?12.8:9.6),vv=(sp+.3*Math.sin(i/3))/3.6;if(i)dd+=vv*16;t.push(tt);v.push(vv);d.push(dd);h+=((92+(sp-6)*13)-h)*.14+(r()-.5)*3;hr.push(h)}
  const a={id:'p1_tm',who:'p1',date:new Date(2026,9,19,18,5),sport:'run',place:'home',name:'Laufband',seed:1,dist:dd/1000,gain:0,gps:false};
  a.tr={ele:null,hr,v,d,t};a.zones=[0,0,0,0,0];
  a.st={dist:d[N],dur:t[N],gain:0,loss:0,avgHR:hr.reduce((x,y)=>x+y,0)/hr.length,maxHR:Math.max(...hr),kcal:t[N]/60*12,load:Math.round(t[N]/3600*Math.max(0,hr.reduce((x,y)=>x+y,0)/hr.length-70)*1.6),avgV:d[N]/t[N]*3.6};EX.push(a)}
 {const N=90,t=[],hr=[];let h=100;
  for(let i=0;i<=N;i++){t.push(i*20);const sp=i<10?0:(Math.floor(i/18)%2?1:.55);h+=((100+sp*62)-h)*.12+(r()-.5)*3;hr.push(h)}
  const a={id:'p2_ct',who:'p2',date:new Date(2026,9,20,7,10),sport:'run',place:'home',name:'Crosstrainer',seed:2,dist:0,gain:0,gps:false};
  a.tr={ele:null,hr,v:t.map(()=>0),d:t.map(()=>0),t,nod:true,nov:true};a.zones=[0,0,0,0,0];
  const av=hr.reduce((x,y)=>x+y,0)/hr.length;a.st={dist:0,dur:t[N],gain:0,loss:0,avgHR:av,maxHR:Math.max(...hr),kcal:t[N]/60*9,load:Math.round(t[N]/3600*Math.max(0,av-70)*1.6),avgV:0};EX.push(a)}
 {const a=makeAct('p1','p1_ne',new Date(2026,9,17,16,40),'run','home',555,6.4,0);a.tr.ele=null;a.st.gain=0;a.st.loss=0;EX.push(a)}}
ACTS=[...JA,...KA,...JT,...EX].sort((a,b)=>b.date-a.date);
byId=Object.fromEntries(ACTS.map(a=>[a.id,a]));
/* Tageswerte */
TODAYV={
 p1:{rlevel:'PRIME',rfac:[{n:'Schlaf (letzte Nacht)',pct:96,fb:'VERY_GOOD'},{n:'Erholungszeit',pct:100,fb:'GOOD',x:'0 h'},{n:'Belastung (akut/chronisch)',pct:91,fb:'GOOD',x:'412 akut'},{n:'Stressverlauf',pct:88,fb:'GOOD'},{n:'HRV',pct:95,fb:'VERY_GOOD',x:'84 ms Wochen-Ø'},{n:'Schlafverlauf',pct:82,fb:'MODERATE'}],steps:100,goal:7920,bb:71,rhr:51,rhr7:47,hrv:73,hrvW:84,sleep:82,stress:21,ready:97,status:'Peaking',vo2:54,kcal:595,slp:414,deep:131,light:228,rem:55,awake:4,need:400,sr:284,sl:94,sm:0,sh:0,sleepx:{dur:'excellent',stress:'excellent',wake:'good',rest:'good',fb:'positive_optimal_structure',ins:'positive_restful_evening',st:{deep:{v:20,lo:16,hi:33},rem:{v:31,lo:21,hi:31},light:{v:49,lo:30,hi:64}}}},
 p2:{rlevel:'HIGH',rfac:[{n:'Schlaf (letzte Nacht)',pct:90,fb:'GOOD'},{n:'Erholungszeit',pct:100,fb:'GOOD',x:'0 h'},{n:'Belastung (akut/chronisch)',pct:84,fb:'GOOD'},{n:'Stressverlauf',pct:93,fb:'VERY_GOOD'},{n:'HRV',pct:70,fb:'MODERATE',x:'56 ms Wochen-Ø'},{n:'Schlafverlauf',pct:88,fb:'GOOD'}],steps:65,goal:10000,bb:89,rhr:51,rhr7:50,hrv:56,hrvW:56,sleep:87,stress:16,ready:79,status:'Maintaining',vo2:55,kcal:422,slp:448,deep:60,light:282,rem:106,awake:1,need:460,sr:355,sl:12,sm:0,sh:0}};
DAILY={};
for(const w of['p1','p2']){const r=rng(w==='p1'?5:9),r2=rng(w==='p1'?77:78),T=TODAYV[w],days=[];
 const as=ACTS.filter(a=>a.who===w);
 for(let i=0;i<=ND;i++){const d=dAt(i),we=d.getDay()===0||d.getDay()===6;
  const dayActs=as.filter(a=>dayOf(a.date)===i);
  const act=dayActs.reduce((s,a)=>({dist:s.dist+a.st.dist/1000,asc:s.asc+a.st.gain,load:s.load+a.st.load,dur:s.dur+a.st.dur/3600}),{dist:0,asc:0,load:0,dur:0});
  const base=w==='p1'?5200:7600,cl=(x,a,b)=>Math.max(a,Math.min(b,x));
  const sleep=Math.round((w==='p1'?84:82)+r()*10),slp=Math.round(T.need+(r()-.35)*80),deep=Math.round(slp*(.12+r()*.06)),rem=Math.round(slp*(.19+r()*.06)),stress=Math.round(14+r()*16+act.dur*4+Math.max(0,(T.need-slp)/5)),prev=i?days[i-1].load:0;
  const o={steps:Math.round(base+(we?1500:0)+dayActs.length*4200+r()*2600),rhr:Math.round((w==='p1'?47:50)+3*Math.sin(i/21)+r()*3),hrv:Math.round((w==='p1'?78:52)+10*Math.sin(i/13)+r()*12),sleep,slp,deep,rem,light:slp-deep-rem,awake:Math.round(4+r()*18),need:T.need,bb:Math.round(cl(48+(sleep-75)*1.8+(slp-T.need)/10+r()*14,30,100)),stress,sr:Math.round(620-stress*8),sl:Math.round(stress*5),sm:Math.round(Math.max(0,(stress-24)*5)),sh:Math.round(Math.max(0,(stress-38)*4)),ready:Math.round(cl(48+(sleep-75)*1.3-prev*.12+r()*14,28,98)),kg:+((w==='p1'?78:61)+Math.sin(i/17)*.5+r()*.3).toFixed(1),vo2:Math.round((w==='p1'?53:54)+Math.sin(i/40)+r()*.8),kcal:Math.round((w==='p1'?2250:1900)+act.dur*620),dist:act.dist,ascent:act.asc,load:act.load,dur:act.dur,hrmin:Math.round((w==='p1'?47:50)-3+r2()*4),hrmax:Math.round(105+r2()*40+(dayActs.length?35:0)),imm:i>=ND-9&&i<ND?Math.round(dayActs.length?30+r2()*50:r2()*14):null,imh:i>=ND-9&&i<ND?Math.round(dayActs.length?8+r2()*22:0):null};
  {const we=[0,6].includes(dAt(i).getDay()),bd=Math.round((w==='p1'?-50:-80)+r()*95+(we?55:0));if(i%9===4){o.bed=null;o.wake=null}else{o.bed=bd;o.wake=bd+slp+o.awake+11}}
  if(i===ND)Object.assign(o,{steps:T.steps,rhr:T.rhr,hrv:T.hrv,sleep:T.sleep,slp:T.slp,deep:T.deep,rem:T.rem,light:T.light,awake:T.awake,bb:T.bb,stress:T.stress,sr:T.sr,sl:T.sl,sm:T.sm,sh:T.sh,ready:T.ready,kcal:T.kcal,kg:w==='p1'?78:61,vo2:T.vo2});
  days.push(o)}
 DAILY[w]=days}
/* Runde 2, nur Beispieldaten im Mockup (im Live-Betrieb kommen diese Werte aus den Sensoren) */
{const wake=TODAY.getTime()+(6*60+40)*6e4;
 for(const w of['p1','p2']){const T=TODAYV[w],la=ACTS.find(x=>x.who===w&&x.gps);
  T.sleept={bed:wake-(T.slp+T.awake+11)*6e4,wake,src:'personal'};{const d0=DAILY[w][ND];d0.bed=Math.round((T.sleept.bed-TODAY.getTime())/6e4);d0.wake=Math.round((wake-TODAY.getTime())/6e4)}
  T.bedrec={bed:TODAY.getTime()+(22*60+30)*6e4,wake:TODAY.getTime()+(29*60+30)*6e4,need:T.need};
  T.sync=w==='p2'?{ageH:21}:null;T.key=w==='p1'?{days:9}:null;
  T.str2={max:w==='p1'?61:48,sit:w==='p1'?204:240,act:w==='p1'?2:9};
  T.hrvband=w==='p1'?{lo:81,hi:102}:{lo:47,hi:66};
  T.age=w==='p1'?{fa:29.1,ca:37,ach:31.5,comp:{bmi:20.9,rhr:46,vd:4,vm:486}}:{fa:33.4,ca:38,ach:null,comp:null};
  T.fl={up:w==='p1'?3.2:6.5,goal:10};T.imgoal=150;
  T.zn=w==='p1'?{fl:[103,121,141,161,181],max:201,lthr:169}:{fl:[92,111,132,150,169],max:188,lthr:158};
  if(la)T.last={id:la.id,aer:w==='p1'?1.1:2.4,ana:w==='p1'?1.2:0.4,load:w==='p1'?33:61}}}
}
/* ---------- Zustand ---------- */
function initState(){S={tab:'heute',who:'p1',sel:null,sports:new Set(),range:null,play:false,day:ND,card:null,dspan:7,preset:'30',metric:'steps',span:'week',dtab:'profil',dmet:'hr',bedSel:null,heartSel:null,cursor:null,view:null}}
const TABS=[['heute','Heute','sun','var(--tc-h)'],['tour','Touren','map','var(--tc-t)'],['trend','Trends','chart','var(--tc-s)']];
let WHO=[['p1',PERS.p1.n],['p2',PERS.p2.n],['both','Beide (Test)']];
function persons(){return S.who==='both'?['p1','p2']:[S.who]}
let NV='dock';const NVSW=false;
function navVariant(){const top=$('.top');if(!top)return;let sw=$('#nvsw'),t2=$('#tabs2');
 if(NVSW){if(!sw){sw=document.createElement('div');sw.id='nvsw';sw.className='hvsw';top.parentNode.insertBefore(sw,top);sw.onclick=e=>{const b=e.target.closest('[data-nv]');if(b){NV=b.dataset.nv;render()}}}sw.innerHTML=[['dock','Jetzt'],['top','A Segment oben'],['bar','B Leiste unten'],['title','C Überschrift']].map(([k,n])=>`<button data-nv="${k}" aria-pressed="${NV===k}">${n}</button>`).join('')}
 if(!t2){t2=document.createElement('nav');t2.id='tabs2';t2.setAttribute('aria-label','Bereich');top.parentNode.insertBefore(t2,top.nextSibling);t2.onclick=e=>{const b=e.target.closest('[data-k]');if(b)setTab(b.dataset.k)}}
 const d=$('#tabs');d.classList.toggle('nvhide',NV==='top'||NV==='title');d.classList.toggle('nvbar',NV==='bar');
 t2.className=NV==='top'?'seg nvtop':NV==='title'?'nvtitle':'';t2.hidden=!(NV==='top'||NV==='title');
 t2.innerHTML=NV==='top'?TABS.map(([k,n,i,c])=>`<button data-k="${k}" style="--tc:${c}" aria-pressed="${S.tab===k}">${ic(i,18)}<span>${n}</span></button>`).join(''):NV==='title'?TABS.map(([k,n])=>`<button data-k="${k}" ${S.tab===k?'aria-current="page"':''}>${n}</button>`).join(''):'';
 const w=$('.wrap');if(w)w.classList.toggle('nvnodock',NV!=='dock')}
let topRO=null;
function topH(){const t=$('.top'),w=$('.wrap');if(!t||!w)return;const set=()=>w.style.setProperty('--toph',t.offsetHeight+'px');set();if(!topRO&&window.ResizeObserver){topRO=new ResizeObserver(set);topRO.observe(t)}}
function mountHeader(){
 $('#tabs').innerHTML=TABS.map(([k,n,i,c])=>`<button data-k="${k}" style="--tc:${c}" ${S.tab===k?'aria-current="page"':''}>${ic(i,24)}<span>${n}</span></button>`).join('');
 topH();navVariant();$('#who').className='chips2 whot';$('#who').innerHTML=WHO.filter(([k])=>k!=='both').map(([k,n])=>`<button data-k="${k}" style="--pc:var(${PERS[k].c})" aria-pressed="${S.who===k||S.who==='both'}"><span class="dot"></span>${n}</button>`).join('')+(WHO.some(x=>x[0]==='both')?`<button class="cmpb" data-k="both" aria-pressed="${S.who==='both'}" aria-label="Beide vergleichen">${ic('cmp',20)}</button>`:'')+`<button class="cmpb" data-k="src" aria-label="Datenquelle" title="Datenquelle">${ic('sliders',20)}</button>`}
$('#tabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;setTab(b.dataset.k)};
$('#who').onclick=e=>{const b=e.target.closest('button');if(!b)return;const k=b.dataset.k;if(k==='src'){openSource();return}let nw;if(k==='both')nw=S.who==='both'?(S.last1||'p1'):'both';else nw=k;if(S.who!=='both')S.last1=S.who;if(nw!=='both')S.last1=nw;if(nw===S.who)return;S.who=nw;S.sel=null;S.card=null;S.kpi=null;S.pwin=null;render()};
function setTab(k){S.tab=k;S.play=false;clearInterval(playT);render()}
let playT=0;
function render(){closeSheet(true);if(S.tab!=='heute')S.card=null;if(S.tab!=='trend'){S.kpi=null;S.rsp=null;S.cspo=null;S.more=false}mountHeader();({heute:vHeute,tour:vTour,trend:vTrend})[S.tab]()}
/* ---------- Hilfen: Diagramme ---------- */
function spark(vals,color){const w=100,h=22,mn=Math.min(...vals),mx=Math.max(...vals),sp=mx-mn||1;const p=vals.map((v,i)=>`${(i/(vals.length-1)*w).toFixed(1)},${(h-3-(v-mn)/sp*(h-6)).toFixed(1)}`);return`<svg class="sp" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${p.join(' ')}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke"/><circle cx="${w}" cy="${p[p.length-1].split(',')[1]}" r="2.4" fill="${color}"/></svg>`}
function ring(pct,color,val,label,sub){const R=32,C=2*Math.PI*R,p=Math.max(0,Math.min(1,pct));return`<div class="ring"><svg width="84" height="84" viewBox="0 0 84 84"><circle cx="42" cy="42" r="${R}" fill="none" stroke="var(--surface2)" stroke-width="9"/><circle cx="42" cy="42" r="${R}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(C*p).toFixed(1)} ${C}" transform="rotate(-90 42 42)"/><text x="42" y="47" text-anchor="middle" font-size="16" font-weight="650" fill="var(--text)">${val}</text></svg><span class="sm">${label}</span><span class="sm muted">${sub||''}</span></div>`}
function scrollChart(box,o){
 const W=Math.max(260,box.clientWidth||320),H=o.h||190,mL=46,mR=6,t=10,b=24,viewW=W-mL-mR,n=o.n,slot=viewW/o.vis,totalW=Math.max(viewW,n*slot),S0=o.series,line=o.mode==='line',k=S0.length;
 let lo,hi,tot=null;
 if(line){const all=nn(S0.flatMap(s=>s.v).concat(o.band||[])),mn=all.length?Math.min(...all):0,mx=all.length?Math.max(...all):1,pd=(mx-mn)*.15||1;lo=mn-pd;hi=mx+pd}
 else{tot=Array.from({length:n},(_,i)=>o.mode==='stack'?sumA(S0.map(x=>x.v[i])):maxA(S0.map(x=>x.v[i])));hi=Math.max(...nn(tot),ok(o.goal)?o.goal:0)*1.1||1;lo=0}
 const Y=v=>t+(1-(v-lo)/(hi-lo))*(H-t-b),yf=o.yfmt||f0;
 let yl='',gl='';for(let q=0;q<=3;q++){const v=lo+(hi-lo)*q/3,y=Y(v);yl+=`<text x="${mL-8}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--text2)">${yf(v)}</text>`;gl+=`<line x1="0" x2="${totalW}" y1="${y}" y2="${y}" stroke="var(--grid)"/>`}
 const cid='cp'+Math.random().toString(36).slice(2,7),gap=slot>16?Math.min(10,slot*.24):1.5;
 let marks='';
 if(!line)for(let i=0;i<n;i++){let acc=0;S0.forEach((s,si)=>{let x,w;if(o.mode==='stack'){w=slot-gap;const wc=Math.min(w,k>1?w:24);x=i*slot+gap/2+(w-wc)/2;w=wc}else{w=(slot-gap)/k;const wc=Math.min(w,k>1?16:24);x=i*slot+gap/2+si*w+(w-wc)/2;w=Math.max(1,wc-(k>1?1.5:0))}
  const h=s.v[i];if(!ok(h))return;const y0=Y(o.mode==='stack'?acc+h:h),y1=o.mode==='stack'?Y(acc):H-b;acc+=h;const rx=(o.mode==='stack'&&k>1)?0:Math.min(5,w/2),ext=rx?rx:0;
  marks+=`<rect x="${x.toFixed(1)}" y="${y0.toFixed(1)}" width="${Math.max(1,w).toFixed(1)}" height="${Math.max(0,y1-y0-(o.mode==='stack'&&si?1:0)+ext).toFixed(1)}" rx="${rx}" fill="${s.c}"/>`})}
 else{S0.forEach(s=>{const segs=[];let cur=[];s.v.forEach((v,i)=>{if(ok(v))cur.push(((i+.5)*slot).toFixed(1)+','+Y(v).toFixed(1));else if(cur.length){segs.push(cur);cur=[]}});if(cur.length)segs.push(cur); /* Lücke = Linie unterbrochen */
  marks+=segs.map(g=>g.length>1?`<polyline points="${g.join(' ')}" fill="none" stroke="${s.c}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`:'').join('');marks+=s.v.map((v,i)=>ok(v)&&(slot>=12||!ok(s.v[i-1])&&!ok(s.v[i+1]))?`<circle cx="${((i+.5)*slot).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${slot>=30?3.5:2.5}" fill="${s.c}"/>`:'').join('')})}
 const band=o.band?`<rect x="0" width="${totalW}" y="${Y(o.band[1])}" height="${Math.max(0,Y(o.band[0])-Y(o.band[1]))}" fill="var(--text)" opacity=".07"/>`:'';
 const goal=ok(o.goal)&&o.goal?`<line x1="0" x2="${totalW}" y1="${Y(o.goal)}" y2="${Y(o.goal)}" stroke="var(--text2)" stroke-dasharray="4 4"/>`:'';
 const selr=o.sel>=0?`<rect x="${(o.sel*slot).toFixed(1)}" y="${t-4}" width="${slot.toFixed(1)}" height="${H-t-b+4}" rx="8" fill="var(--text)" opacity=".07"/>`:'';
 const ev=slot>=44?1:slot>=22?2:slot>=11?7:slot>=5?14:28;let xl='';for(let i=0;i<n;i++)if(i%ev===0||i===o.sel&&slot>=22)xl+=`<text x="${((i+.5)*slot).toFixed(1)}" y="${H-7}" text-anchor="middle" font-size="11" ${i===o.sel?'font-weight="700" fill="var(--text)"':'fill="var(--text2)"'}>${o.short(i)}</text>`;
 box.style.position='relative';
 box.innerHTML=`<div class="sc"><svg class="yax" width="${mL}" height="${H}" aria-hidden="true">${yl}</svg><div class="scl"><svg width="${totalW}" height="${H}" role="img" aria-label="${o.aria||'Verlauf'}"><defs><clipPath id="${cid}"><rect x="0" y="0" width="${totalW}" height="${H-b}"/></clipPath></defs>${gl}${selr}${band}${goal}<g clip-path="url(#${cid})">${marks}</g>${xl}</svg></div></div><div class="tip" hidden></div>`;
 const scl=$('.scl',box),svg=$('.scl svg',box),tip=$('.tip',box),clamp=(x,a,c)=>Math.max(a,Math.min(c,x));
 let a0=o.pwin!=null?o.pwin:null;if(a0==null||(o.sel>=0&&(o.sel<a0||o.sel>a0+o.vis-1)))a0=o.sel>=0?clamp(Math.round(o.sel-(o.vis-1)/2),0,Math.max(0,n-o.vis)):Math.max(0,n-o.vis);
 scl.scrollLeft=a0*slot;
 const ix=e=>{const r=svg.getBoundingClientRect();return clamp(Math.floor((e.clientX-r.left)/slot),0,n-1)};
 svg.onpointermove=e=>{if(e.pointerType==='touch')return;const i=ix(e);tip.hidden=false;tip.style.left=clamp(scl.offsetLeft+(i+.5)*slot-scl.scrollLeft,70,W-70)+'px';const tv=line?S0.map(s=>s.v[i]).find(ok):tot[i];tip.style.top=(ok(tv)?Y(tv):(H-b)/2)+'px';const tf=v=>ok(v)?(o.tfmt||f0)(v):'–';tip.innerHTML=o.labels(i)+'<br>'+(o.mode==='stack'&&k>1?S0.map(s=>s.n+' '+tf(s.v[i])).join(' · '):S0.map(s=>(k>1?s.n+' ':'')+tf(s.v[i])).join(' · '))};
 svg.onpointerleave=()=>{tip.hidden=true};
 if(o.onPick)svg.onclick=e=>o.onPick(ix(e));svg.style.cursor=o.onPick?'pointer':'default';
 let raf=0;const upd=()=>{const a=clamp(Math.round(scl.scrollLeft/slot),0,Math.max(0,n-o.vis));o.onWindow&&o.onWindow(a,Math.min(n-1,a+o.vis-1));tip.hidden=true};
 scl.addEventListener('scroll',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(upd)},{passive:true});upd();
 return{scl,slot}}
/* ---------- Insights ---------- */
const avgA=a=>{const v=nn(a);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null};
const ACW={};
function acwrSeries(w){if(ACW[w])return ACW[w];const L=DAILY[w].map(d=>d.load);return ACW[w]=L.map((_,i)=>{if(i<27)return null;let a=0,c=0;for(let k=0;k<28;k++){const v=L[i-k];if(!ok(v))return null;c+=v;if(k<7)a+=v}return c?a/(c/4):null})}
const hh2=h=>String(Math.floor(h)).padStart(2,'0')+':'+String(Math.round(h%1*60)).padStart(2,'0');
const tm=m=>{m=((Math.round(m)%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
const fc=v=>f1(v);
/* Tagesverlauf (Beispielkurven) */
function dayCurve(w,i,kind){const d=DAILY[w][i],r=rng(i*131+(w==='p1'?3:7)+kind.length),acts=ACTS.filter(a=>a.who===w&&dayOf(a.date)===i),now=i===ND?6.7:24;
 const inAct=h=>acts.find(a=>{const s=a.date.getHours()+a.date.getMinutes()/60,e=s+a.st.dur/3600;return h+1>s&&h<e});
 const arr=Array(24).fill(null);
 if(kind==='steps'){const W=h=>h<6||h>=22?0:h<7?.4:h<10?1.6:h<12?1:h<14?1.4:h<17?.9:h<20?1.5:.7,ws=[];let tot=0;for(let h=0;h<24;h++){ws[h]=h>now?0:W(h)*(.7+.6*r())*(inAct(h)?2.4:1);tot+=ws[h]}for(let h=0;h<24;h++)arr[h]=h>now?null:Math.round(ws[h]/(tot||1)*d.steps);return arr}
 if(kind==='bb'){for(let h=0;h<=6&&h<=now;h++)arr[h]=Math.max(8,d.bb-(6-h)*(7+r()*2));let v=d.bb;for(let h=7;h<24&&h<=now;h++){if(h>=22)v+=2.5;else v-=2+d.stress/28+(inAct(h)?9:0)+r()*1.2;v=Math.max(6,Math.min(100,v));arr[h]=v}return arr}
 for(let h=0;h<24;h++){if(h>now)continue;const slp=h<6||h>=22,a=inAct(h);
  arr[h]=kind==='stress'?(slp?6+r()*6:Math.min(95,d.stress*(.7+.9*r())+(a?30:0))):(slp?d.rhr+1+r()*4:d.rhr+16+r()*12+(a?58+r()*22:0))}
 return arr}
function dayChart(box,vals,o){const W=Math.max(260,box.clientWidth||320),H=o.h||140,m={l:40,r:6,t:8,b:22},sl=(W-m.l-m.r)/24,Y=v=>m.t+(1-(v-o.lo)/(o.hi-o.lo))*(H-m.t-m.b);
 let g='';for(let q=0;q<=2;q++){const v=o.lo+(o.hi-o.lo)*q/2,y=Y(v);g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y}" y2="${y}" stroke="var(--grid)"/><text x="${m.l-6}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--text2)">${f0(v)}</text>`}
 let xl='';for(let h=0;h<=24;h+=6)xl+=`<text x="${m.l+h*sl}" y="${H-6}" text-anchor="${h===0?'start':h===24?'end':'middle'}" font-size="11" fill="var(--text2)">${h===24?'24':h} Uhr</text>`;
 let marks='';const pts=vals.map((v,h)=>v==null?null:[m.l+(h+.5)*sl,Y(v)]).filter(Boolean);
 if(o.bars)vals.forEach((v,h)=>{if(v==null)return;const lv=o.solid?100:v<26?20:v<51?46:v<76?76:100;marks+=`<rect x="${(m.l+h*sl+1.5).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${(sl-3).toFixed(1)}" height="${(H-m.b-Y(v)+4).toFixed(1)}" rx="3" fill="color-mix(in srgb,${o.c} ${lv}%,var(--surface2))"/>`});
 else if(pts.length){marks+=`<path d="M${pts[0][0]},${H-m.b} ${pts.map(p=>'L'+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')} L${pts[pts.length-1][0]},${H-m.b} Z" fill="${o.c}" opacity=".16"/><polyline points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="none" stroke="${o.c}" stroke-width="2.4" stroke-linejoin="round"/>`}
 box.style.position='relative';box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${o.aria||'Tagesverlauf'}">${g}${xl}${marks}</svg><div class="tip" hidden></div>`;
 const svg=$('svg',box),tip=$('.tip',box);svg.onpointermove=e=>{const r=svg.getBoundingClientRect(),h=Math.max(0,Math.min(23,Math.floor(((e.clientX-r.left)/r.width*W-m.l)/sl)));if(vals[h]==null){tip.hidden=true;return}tip.hidden=false;tip.style.left=Math.max(60,Math.min(W-60,m.l+(h+.5)*sl))+'px';tip.style.top=Y(vals[h])+'px';tip.innerHTML=hh2(h)+' Uhr<br>'+o.fmt(vals[h])};svg.onpointerleave=()=>{tip.hidden=true}}
/* Schlafphasen als Zeitstrahl */
function stagesFor(w,i){const d=DAILY[w][i],r=rng(i*57+(w==='p1'?1:2)),tot=d.slp+d.awake,cyc=Math.max(3,Math.round(tot/90)),seg=[],want={d:d.deep,r:d.rem,l:d.light,a:d.awake};
 for(let c=0;c<cyc;c++){const f=c/(cyc-1||1);seg.push(['l',1+r()*.6]);seg.push(['d',(1.6-f*1.3)*(.8+r()*.4)]);seg.push(['l',.6+r()*.5]);seg.push(['r',(.4+f*1.4)*(.8+r()*.4)]);if(r()<.5&&c<cyc-1)seg.push(['a',.15+r()*.2])}
 const sum={d:0,r:0,l:0,a:0};seg.forEach(s=>sum[s[0]]+=s[1]);return seg.map(([k,v])=>({k,min:v/sum[k]*want[k]}))}
function hypno(box,w,i){const st=stagesFor(w,i),tot=st.reduce((s,x)=>s+x.min,0),W=Math.max(260,box.clientWidth||320),H=150,m={l:56,r:8,t:6,b:22},rowH=(H-m.t-m.b)/4,wake=360+(i%5)*6,start=wake-tot;
 const rows={a:0,r:1,l:2,d:3},nm={a:'Wach',r:'REM',l:'Leicht',d:'Tief'},cs={a:'var(--text2)',r:mix('--c-sleep',62),l:mix('--c-sleep',32),d:'var(--c-sleep)'},X=t=>m.l+t/tot*(W-m.l-m.r);
 let g='',x='',t0=0,prev=null;Object.entries(rows).forEach(([k,r])=>{g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${m.t+(r+.5)*rowH}" y2="${m.t+(r+.5)*rowH}" stroke="var(--grid)"/><text x="${m.l-8}" y="${m.t+(r+.5)*rowH+4}" text-anchor="end" font-size="11" fill="var(--text2)">${nm[k]}</text>`});
 st.forEach((s,j)=>{const x0=X(t0),w0=Math.max(1.5,X(t0+s.min)-x0),y=m.t+rows[s.k]*rowH+4;if(prev!=null){const yp=m.t+rows[prev]*rowH+rowH/2,yc=y+(rowH-8)/2;x+=`<line x1="${x0}" x2="${x0}" y1="${yp}" y2="${yc}" stroke="var(--sep)" stroke-width="1.5"/>`}x+=`<rect x="${x0.toFixed(1)}" y="${y}" width="${w0.toFixed(1)}" height="${rowH-8}" rx="4" fill="${cs[s.k]}" data-j="${j}"/>`;t0+=s.min;prev=s.k});
 let xl='';for(let q=0;q<=4;q++){const t=tot*q/4;xl+=`<text x="${X(t)}" y="${H-6}" text-anchor="${q===0?'start':q===4?'end':'middle'}" font-size="11" fill="var(--text2)">${tm(start+t)}</text>`}
 box.style.position='relative';box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Schlafphasen von ${tm(start)} bis ${tm(wake)}">${g}${x}${xl}</svg><div class="tip" hidden></div>`;
 const svg=$('svg',box),tip=$('.tip',box),cum=[];let c0=0;st.forEach(s=>{cum.push(c0);c0+=s.min});
 svg.onpointermove=e=>{const r=svg.getBoundingClientRect(),t=((e.clientX-r.left)/r.width*W-m.l)/(W-m.l-m.r)*tot;let j=cum.findIndex((c,q)=>t>=c&&t<c+st[q].min);if(j<0){tip.hidden=true;return}const s=st[j];tip.hidden=false;tip.style.left=Math.max(70,Math.min(W-70,X(cum[j]+s.min/2)))+'px';tip.style.top=(m.t+rows[s.k]*rowH)+'px';tip.innerHTML=nm[s.k]+' '+hm(s.min*60)+'<br>'+tm(start+cum[j])+' bis '+tm(start+cum[j]+s.min)};svg.onpointerleave=()=>{tip.hidden=true}}
/* Garmins eigene Einstufung der Trainingsbereitschaft (Attribute des Sensors); die Karte bewertet nichts selbst */
const RLV={PRIME:'Optimal',HIGH:'Hoch',MODERATE:'Mäßig',LOW:'Niedrig',POOR:'Schlecht'},RFB={VERY_GOOD:'sehr gut',GOOD:'gut',MODERATE:'mäßig',POOR:'schlecht',VERY_POOR:'sehr schlecht'};
const rLevel=(w,di)=>{const T=TODAYV[w];if(di!==ND||!T||T.rlevel==null||T.rlevel==='')return null;return RLV[T.rlevel]||String(T.rlevel).toLowerCase()};
const rFb=x=>x==null||x===''?null:(RFB[x]||String(x).toLowerCase());
const rFacs=(w,di)=>di===ND&&TODAYV[w]&&Array.isArray(TODAYV[w].rfac)?TODAYV[w].rfac:[];
/* Tempo pro Kilometer */
function kmBars(box,a,W,m){const T=a.tr,rows=[];let from=0,k=1;for(let i=1;i<T.d.length;i++)if(T.d[i]>=k*1000){rows.push({k,v:(T.d[i]-T.d[from])/(T.t[i]-T.t[from])*3.6});from=i;k++}
 if(rows.length<2){box.innerHTML='<div class="muted sm">Zu kurz für ein Tempo pro Kilometer.</div>';return}
 const pace=a.sport==='run'||a.sport==='hike',mean=avgA(rows.map(r=>r.v)),mx=Math.max(...rows.map(r=>r.v))*1.12,H=104,t=14,b=18,D1=T.d[T.d.length-1],uw=W-m.l-m.r,bw=1000/D1*uw,Y=v=>t+(1-v/mx)*(H-t-b);
 const fmt=v=>pace?pc(3600/v)+' /km':f1(v)+' km/h';
 const bars=rows.map(r=>`<rect x="${(m.l+(r.k-1)*bw+bw*.09).toFixed(1)}" y="${Y(r.v).toFixed(1)}" width="${(bw*.82).toFixed(1)}" height="${(H-b-Y(r.v)).toFixed(1)}" rx="3" fill="var(${PERS[a.who].c})" opacity="${r.v>=mean?1:.45}"><title>${r.k}. km: ${fmt(r.v)}</title></rect>`).join('');
 box.innerHTML=`<div class="muted sm" style="margin:8px 0 0">Tempo pro Kilometer. Kräftige Balken: schneller als der Schnitt (${fmt(mean)}), blasse: langsamer.</div><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Tempo pro Kilometer"><line x1="${m.l}" x2="${W-m.r}" y1="${Y(mean)}" y2="${Y(mean)}" stroke="var(--text2)" stroke-dasharray="4 3"/><text x="${m.l-5}" y="${Y(mean)+4}" text-anchor="end" font-size="11" fill="var(--text2)">Ø</text>${bars}${rows.filter((_,i)=>rows.length<=14||i%2===0).map(r=>`<text x="${m.l+(r.k-.5)*bw}" y="${H-4}" text-anchor="middle" font-size="11" fill="var(--text2)">${r.k}</text>`).join('')}</svg>`}
/* Gemeinsame Touren */
function jointOf(a){return ACTS.find(x=>x.who!==a.who&&(x.joint===a.id||a.joint===x.id))}
function jointHtml(a){const b=jointOf(a);if(!b)return'';const J=a.who==='p1'?a:b,K=a.who==='p1'?b:a,row=(n,fj,fk,better)=>`<tr><td>${n}</td><td${better==='j'?' style="font-weight:700"':''}>${fj}</td><td${better==='k'?' style="font-weight:700"':''}>${fk}</td></tr>`;
 return`<div class="note" style="margin-bottom:14px"><b>Gemeinsame Tour mit ${PERS[a.who==='p1'?'p2':'p1'].n}</b><div style="overflow-x:auto"><table class="tbl"><tr><th></th><th><span class="dot" style="background:var(--p1);margin-right:6px"></span>${PERS.p1.n}</th><th><span class="dot" style="background:var(--p2);margin-right:6px"></span>${PERS.p2.n}</th></tr>${row('Zeit',hm(J.st.dur),hm(K.st.dur),J.st.dur<K.st.dur?'j':'k')}${row('Ø Tempo',f1(J.st.avgV)+' km/h',f1(K.st.avgV)+' km/h',J.st.avgV>K.st.avgV?'j':'k')}${row('Ø Puls',f0(J.st.avgHR)+' bpm',f0(K.st.avgHR)+' bpm','')}${row('Max. Puls',f0(J.st.maxHR)+' bpm',f0(K.st.maxHR)+' bpm','')}${row('Trainingslast',J.st.load,K.st.load,'')}${row('kcal',f0(J.st.kcal),f0(K.st.kcal),'')}</table></div><div class="muted sm">Fett: schneller. Die zweite Strecke ist auf der Karte gestrichelt eingeblendet.</div></div>`}
/* Tourenliste nach Sportart */
function tourList(w,sport,a,b){const l=ACTS.filter(x=>x.who===w&&x.sport===sport&&dayOf(x.date)>=a&&dayOf(x.date)<=b);return l.length?`<div class="tl">${l.map(x=>`<button class="arow" data-open="${x.id}"><span class="mr">${routeSvg(x)||`<span class="av" style="background:var(${PERS[w].c})">${ic(x.sport,20)}</span>`}</span><span class="t"><b>${esc(ttl(x))}</b><span class="muted sm">${dfmt(x.date,{weekday:'short',day:'numeric',month:'numeric'})}</span></span><span class="r">${x.gps?f1(x.st.dist/1000)+' km':hm(x.st.dur)}<span class="muted sm">${x.gps?f0(x.st.gain)+' m ↑ · ':''}${hm(x.st.dur)}</span></span>${ic('next',16)}</button>`).join('')}</div>`:'<div class="muted sm">Keine Touren.</div>'}
/* Rekorde */
function recordsFor(w){const as=ACTS.filter(a=>a.who===w),g=as.filter(a=>a.gps),d=DAILY[w],best=(arr,f,dir)=>arr.length?arr.reduce((p,c)=>(dir*f(c)>dir*f(p)?c:p)):null,out=[];
 const lt=best(g,a=>a.st.dist,1),ma=best(g,a=>a.st.gain,1),fr=best(g.filter(a=>a.sport==='run'&&a.st.dist>=5000),a=>a.st.avgV,1),fb=best(g.filter(a=>a.sport==='mtb'&&a.st.dist>=20000),a=>a.st.avgV,1);
 if(lt)out.push(['Längste Tour',f1(lt.st.dist/1000)+' km',lt.date,'open',lt.id]);if(ma)out.push(['Meiste Höhenmeter',f0(ma.st.gain)+' m',ma.date,'open',ma.id]);
 if(fr)out.push(['Schnellster Lauf ab 5 km',pc(3600/fr.st.avgV)+' /km',fr.date,'open',fr.id]);if(fb)out.push(['Schnellste Rad-Tour ab 20 km',f1(fb.st.avgV)+' km/h',fb.date,'open',fb.id]);
 const idx=(k,dir)=>{let bi=-1;d.forEach((x,i)=>{if(ok(x[k])&&(bi<0||dir*x[k]>dir*d[bi][k]))bi=i});return bi}; /* Tage ohne Wert zählen nicht */
 for(const[n,k,dir,un]of[['Bester Schlafwert','sleep',1,''],['Niedrigster Ruhepuls','rhr',-1,' bpm'],['Höchste HRV','hrv',1,' ms'],['Meiste Schritte','steps',1,'']]){const i=idx(k,dir);if(i>=0)out.push([n,f0(d[i][k])+un,dAt(i),'day',i])}
 let bs=0,be=0,cur=0;for(let i=0;i<d.length;i++){if(!ok(d[i].dist)){cur=0;continue}if(as.some(a=>!a.live&&dayOf(a.date)===i)){cur++;if(cur>bs){bs=cur;be=i}}else cur=0}
 if(bs)out.push(['Längste Serie aktiver Tage',bs+' Tage',dAt(be),'day',be]);return out}
function recordsHtml(ps){return ps.map(w=>`<div class="card"><div class="who"><span class="dot" style="background:var(${PERS[w].c})"></span>${PERS[w].n}<span class="sm muted" style="margin-left:auto;font-weight:400">Persönliche Rekorde 2026</span></div><div class="recs">${recordsFor(w).map(r=>`<button class="rec" ${r[3]==='open'?`data-open="${r[4]}"`:`data-day="${r[4]}"`}><span class="muted sm">${r[0]}</span><b>${r[1]}</b><span class="muted sm">${dfmt(r[2],{day:'numeric',month:'long'})}</span></button>`).join('')}</div></div>`).join('')}
/* Zusammenhänge: Schlaf gegen Folgewerte */
const ZY={stress:['Stress','stress',''],bb:['Body Battery','bb',' %'],ready:['Bereitschaft','ready',' %'],hrv:['HRV','hrv',' ms']};
function pearson(x,y){const mx=avgA(x),my=avgA(y);let sxy=0,sxx=0,syy=0;for(let i=0;i<x.length;i++){sxy+=(x[i]-mx)*(y[i]-my);sxx+=(x[i]-mx)**2;syy+=(y[i]-my)**2}return sxx&&syy?sxy/Math.sqrt(sxx*syy):0}
function scatterCard(ps){const box=$('#zcard');if(!box)return;const k=S.zy||'stress',Z=ZY[k];
 box.innerHTML=`<h2 class="h2">Zusammenhänge</h2><div class="muted sm" style="margin:-6px 0 10px">Schlafdauer der Nacht gegen den Wert am selben Tag. Jeder Punkt ist ein Tag, r ist der Korrelationskoeffizient (−1 bis 1). Tage mit fehlendem Wert fehlen.</div><div class="chips" id="zc" style="margin-bottom:10px">${Object.entries(ZY).map(([q,v])=>`<button class="chip" data-z="${q}" aria-pressed="${k===q}">${v[0]}</button>`).join('')}</div><div class="chartbox" id="zp"></div><div id="zt" style="margin-top:8px"></div>`;
 $('#zc').onclick=e=>{const b=e.target.closest('[data-z]');if(b){S.zy=b.dataset.z;scatterCard(ps)}};
 const sets=ps.map(w=>({w,pts:DAILY[w].map((d,i)=>({x:ok(d.slp)?d.slp/60:null,y:d[Z[1]],i})).filter(p=>ok(p.x)&&ok(p.y))})),all=sets.flatMap(s=>s.pts);
 if(!all.length){$('#zp').innerHTML='<div class="muted sm">Keine Tage mit beiden Werten.</div>';$('#zt').innerHTML='';return}
 const X0=Math.min(...all.map(p=>p.x))-.2,X1=Math.max(...all.map(p=>p.x))+.2,Y0=Math.min(...all.map(p=>p.y)),Y1=Math.max(...all.map(p=>p.y)),yp=(Y1-Y0)*.1||1;
 const bx=$('#zp'),W=Math.max(260,bx.clientWidth||320),H=240,m={l:46,r:10,t:10,b:30},X=v=>m.l+(v-X0)/(X1-X0)*(W-m.l-m.r),Y=v=>m.t+(1-(v-(Y0-yp))/((Y1+yp)-(Y0-yp)))*(H-m.t-m.b);
 let g='';for(let q=0;q<=3;q++){const v=(Y0-yp)+((Y1+yp)-(Y0-yp))*q/3;g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${m.l-6}" y="${Y(v)+4}" text-anchor="end" font-size="11" fill="var(--text2)">${f0(v)}</text>`}
 for(let q=0;q<=4;q++){const v=X0+(X1-X0)*q/4;g+=`<text x="${X(v)}" y="${H-10}" text-anchor="middle" font-size="11" fill="var(--text2)">${f1(v)} h</text>`}
 let dots='',lines='',txt='';
 for(const s of sets){const c=`var(${PERS[s.w].c})`;dots+=s.pts.map(p=>`<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.6" fill="${c}" opacity=".55" data-i="${p.i}" data-w="${s.w}"/>`).join('');
  if(s.pts.length<3)continue;const xs=s.pts.map(p=>p.x),ys=s.pts.map(p=>p.y),r=pearson(xs,ys),mx=avgA(xs),my=avgA(ys),sx=Math.sqrt(avgA(xs.map(v=>(v-mx)**2)))||1,sy=Math.sqrt(avgA(ys.map(v=>(v-my)**2)));const sl=r*sy/sx;
  lines+=`<line x1="${X(X0)}" y1="${Y(my+sl*(X0-mx))}" x2="${X(X1)}" y2="${Y(my+sl*(X1-mx))}" stroke="${c}" stroke-width="2.4"/>`;
  txt+=`<div style="margin:4px 0"><span class="dot" style="background:${c};margin-right:8px"></span><b>${PERS[s.w].n}</b> r = ${r.toFixed(2).replace('.',',')} (${s.pts.length} Tage)</div>`}
 bx.style.position='relative';bx.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Streudiagramm Schlafdauer gegen ${Z[0]}">${g}${dots}${lines}</svg><div class="tip" hidden></div>`;
 const svg=$('svg',bx),tip=$('.tip',bx);svg.onpointermove=e=>{const c=e.target.closest('circle');if(!c){tip.hidden=true;return}const p=DAILY[c.dataset.w][+c.dataset.i];tip.hidden=false;tip.style.left=Math.max(70,Math.min(W-70,+c.getAttribute('cx')))+'px';tip.style.top=c.getAttribute('cy')+'px';tip.innerHTML=PERS[c.dataset.w].n+', '+dfmt(dAt(c.dataset.i),{weekday:'short',day:'numeric',month:'numeric'})+'<br>'+hmm(p.slp)+' Schlaf, '+Z[0]+' '+f0(p[Z[1]])+Z[2]};svg.onpointerleave=()=>{tip.hidden=true};
 $('#zt').innerHTML=txt}
/* Belastungsbalance im Verlauf */
function acwrCard(ps){const box=$('#acard');if(!box)return;const n=ND+1-28,ser=n>0?ps.map(w=>({n:PERS[w].n,c:`var(${PERS[w].c})`,v:acwrSeries(w).slice(28)})):[];
 if(!ser.some(x=>x.v.some(ok))){box.hidden=true;box.innerHTML='';return}box.hidden=false;
 box.innerHTML=`<h2 class="h2">Belastungsbalance im Verlauf</h2><div class="muted sm" style="margin:-6px 0 8px">Trainingslast der letzten 7 Tage geteilt durch den 4-Wochen-Schnitt. Nur Tage, für die 28 Tage Trainingslast vorliegen.</div><div class="prange" id="ar"></div><div class="chartbox" id="ac"></div>`;
 scrollChart($('#ac'),{mode:'line',n,vis:42,h:200,series:ser,yfmt:v=>v.toFixed(1).replace('.',','),tfmt:v=>v.toFixed(2).replace('.',','),labels:i=>dfmt(dAt((i+28)),{weekday:'short',day:'numeric',month:'numeric'}),short:i=>dfmt(dAt((i+28)),{day:'numeric',month:'numeric'}),sel:-1,pwin:S.awin,aria:'Belastungsbalance',onWindow:(a,b)=>{S.awin=a;$('#ar').textContent=dfmt(dAt((a+28)),{day:'numeric',month:'long'})+' bis '+dfmt(dAt((b+28)),{day:'numeric',month:'long'})}})}

/* ---------- v6: Pop-up-Fenster im Bubble-Stil ---------- */
let SH=null;
function openSheet(o){let el=SH;const had=!!el;
 if(!el){el=document.createElement('div');el.className='sheetwrap';
  el.innerHTML=`<div class="sheetbg" data-x></div><div class="sheet" role="dialog" aria-modal="true"><div class="sgrip" aria-hidden="true"></div><div class="shead"><span class="sico"></span><h2 class="stitle"></h2><button class="sx" data-x aria-label="Schließen">${ic('x',20)}</button></div><div class="sbody"></div></div>`;
  root.appendChild(el);SH=el;el._prev=root.activeElement;requestAnimationFrame(()=>el.classList.add('on'));
  el.onclick=e=>{if(e.target.closest('[data-x]')){closeSheet();return}const h=SH&&SH._o&&SH._o.onClick;if(h&&h(e))return;
   const op=e.target.closest('[data-open]');if(op){const id=op.dataset.open;closeSheet(true);S.sel=id;S.preset='all';S.range=null;S.tab='tour';render();return}
   const dy=e.target.closest('[data-day]');if(dy){const d=+dy.dataset.day;closeSheet(true);S.day=d;S.tab='heute';render()}};
  const sh=$('.sheet',el);let y0=null;const hd=$('.shead',el),gr=$('.sgrip',el);
  const dn=e=>{if(e.target.closest('.sx'))return;y0=e.clientY;sh.style.transition='none'},mv=e=>{if(y0==null)return;const dy=Math.max(0,e.clientY-y0);sh.style.transform=innerWidth<700?`translateY(${dy}px)`:''},up=e=>{if(y0==null)return;const dy=e.clientY-y0;y0=null;sh.style.transition='';sh.style.transform='';if(dy>90&&innerWidth<700)closeSheet()};
  for(const h of[hd,gr]){h.onpointerdown=dn;h.onpointermove=mv;h.onpointerup=up;h.onpointercancel=up}}
 const body=$('.sbody',el),st=body.scrollTop;el._o=o;$('.stitle',el).textContent=o.title;el.querySelector('.sheet').setAttribute('aria-label',o.title);
 const ic0=$('.sico',el);ic0.innerHTML=ic(o.icon,24);ic0.style.color=`var(${o.color})`;body.innerHTML=o.body;body.scrollTop=st;if(!had)$('.sx',el).focus();return el}
function closeSheet(silent){const el=SH;if(!el)return;SH=null;const o=el._o;el.classList.remove('on');setTimeout(()=>el.remove(),200);try{el._prev&&el._prev.isConnected&&el._prev.focus()}catch(_){}if(!silent&&o&&o.onClose)o.onClose()}
function trapTab(e){if(e.key==='Tab'&&SH){const q=[...SH.querySelectorAll('button:not([disabled]),input,select,[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null);if(!q.length)return;const cur=SH.getRootNode().activeElement,i=q.indexOf(cur);if(e.shiftKey&&(i<=0)){e.preventDefault();q[q.length-1].focus()}else if(!e.shiftKey&&(i===q.length-1||i<0)){e.preventDefault();q[0].focus()}}}

/* ---------- Heute ---------- */
const dayLabel=i=>dfmt(dAt(i),{weekday:'short',day:'numeric',month:'numeric'});
const hmm=m=>{if(!ok(m))return'–';m=Math.round(m);return Math.floor(m/60)+' h '+String(m%60).padStart(2,'0')+' min'};
const mix=(p,k)=>`color-mix(in srgb,var(${p}) ${k}%,var(--surface))`;
const CARDS=[['sleep','Schlaf','--c-sleep','moon'],['rec','Erholung','--c-heart','heart'],['act','Aktivität','--c-act','run'],['str','Stress','--c-str','bolt']];
const ttl=a=>(a.live?'Live: ':'')+(a.sname||a.name);
function stackBar(parts){const tot=sumA(parts.map(p=>p.v));if(!tot)return'<div class="zones"></div>';return`<div class="zones">${parts.filter(p=>ok(p.v)).map(p=>`<i style="width:${Math.max(0,p.v/tot*100)}%;background:${p.c}"></i>`).join('')}</div>`}
function legendRow(parts,fmt){return`<div class="lg">${parts.map(p=>`<span><i class="dot" style="background:${p.c}"></i>${p.n} ${ok(p.v)?fmt(p.v):'–'}</span>`).join('')}</div>`}
function meter(p,c){return`<div class="meter"><i style="width:${ok(p)?Math.max(0,Math.min(100,p)):0}%;background:${c}"></i></div>`}
const sleepParts=d=>[{n:'Tief',v:d.deep,c:'var(--c-sleep)'},{n:'REM',v:d.rem,c:mix('--c-sleep',62)},{n:'Leicht',v:d.light,c:mix('--c-sleep',32)},{n:'Wach',v:d.awake,c:'var(--sep)'}];
const stressParts=d=>[{n:'Ruhe',v:d.sr,c:mix('--c-str',18)},{n:'Niedrig',v:d.sl,c:mix('--c-str',46)},{n:'Mittel',v:d.sm,c:mix('--c-str',76)},{n:'Hoch',v:d.sh,c:'var(--c-str)'}];
function cardHtml(w,k,d){const T=TODAYV[w],open=S.card===w+k,meta=CARDS.find(x=>x[0]===k);let big,sub,viz;
 if(k==='sleep'){big=hmm(d.slp);sub=`Schlafwert ${f0(d.sleep)}${ok(T.need)?' · Bedarf '+hmm(T.need):''}`;const p=sleepParts(d);viz=stackBar(p)+legendRow(p.slice(0,3),v=>hm(v*60))}
 else if(k==='rec'){big=f0(d.hrv)+' <small>ms HRV</small>';sub=`Ruhepuls ${uv(d.rhr,' bpm')} · 7-Tage-Ø ${f0(T.rhr7)}`;viz=meter(d.bb,'var(--c-heart)')+`<div class="lg"><span>Body Battery ${uv(d.bb,' %')}</span><span>HRV-Ø Woche ${uv(T.hrvW,' ms')}</span></div>`}
 else if(k==='act'){const gp=ok(T.goal)&&T.goal>0&&ok(d.steps)?d.steps/T.goal*100:null;big=f0(d.steps)+' <small>Schritte</small>';sub=`Ziel ${f0(T.goal)} · ${uv(gp,' %')}`;viz=meter(gp,'var(--c-act)')+`<div class="lg"><span>${f0(d.kcal)} kcal gesamt</span><span>${f1(d.dist)} km Training</span></div>`}
 else if(k==='body'){const w0=DAILY[w][Math.max(0,ND-30)].kg,dd=ok(d.kg)&&ok(w0)?d.kg-w0:null;big=f1(d.kg)+' <small>kg</small>';sub=`VO2max ${f0(d.vo2)} · 30 Tage ${dd==null?'–':(dd>=0?'+':'−')+f1(Math.abs(dd))+' kg'}`;viz=`<div class="lg"><span>Körperfett und Fitnessalter: noch keine Messwerte.</span></div>`}
 else{big=f0(d.stress)+' <small>Ø Level</small>';sub='Garmin-Stresslevel, Tagesmittel';const p=stressParts(d);viz=stackBar(p)+legendRow(p.slice(0,2),v=>hm(v*60))}
 return`<button class="dcard" style="--cc:var(${meta[2]})" data-w="${w}" data-k="${k}" aria-expanded="${open}"><div class="dh2"><span class="ico">${ic(meta[3],16)}</span>${meta[1]}<span class="chev">${ic(open?'x':'next',16)}</span></div><div class="bigv">${big}</div><div class="muted sm">${sub}</div>${viz}</button>`}
/* Keine Einordnungen oder Tipps: nur noch die Stand-Zeile */
function analyseHtml(w,di,stand){if(di!==ND||!stand)return'';return`<div class="muted sm stand">${stand}</div>`}
let HV='c';const HVSW=false;
function hvSwitch(){if(!HVSW)return'';return`<div class="hvsw" role="group" aria-label="Kopf-Entwurf">${[['o','Jetzt'],['a','A'],['b','B'],['c','C']].map(([k,n])=>`<button data-hv="${k}" aria-pressed="${HV===k}">${n}</button>`).join('')}</div>`}
function gauge(v,size,sw,k,txt,fs){const R=(size-sw)/2-1,C=2*Math.PI*R,c=size/2;return`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="var(--surface2)" stroke-width="${sw}"/><circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="${k}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${(C*(ok(v)?Math.max(0,Math.min(100,v)):0)/100).toFixed(1)} ${C}" transform="rotate(-90 ${c} ${c})"/><text x="${c}" y="${c+fs*.35}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="var(--text)">${txt}</text></svg>`}
/* Kopf: nur Garmins Zahlen und Garmins eigene Stufe, neutrale Farben */
function heroHtml(w,di,d,T){const bb=bbNow(w,di),lv=rLevel(w,di),R=44,C=2*Math.PI*R,cR='var(--c-act)',cB='var(--c-heart)',cS='var(--c-sleep)',sub=di===ND?'Trainingsstatus '+T.status+' · VO2max '+f0(T.vo2):'Schlaf '+f0(d.sleep)+' · Body Battery '+uv(d.bb,' %'),head='Trainingsbereitschaft'+(lv?': '+esc(lv):'');
 if(HV==='a')return`<div class="hA"><button class="gk" data-ins="rdy" data-w="${w}" aria-label="Bereitschaft ${f0(d.ready)}, Details">${gauge(d.ready,64,7,cR,f0(d.ready),20)}<span><span class="muted sm">Bereitschaft</span><b>${lv?esc(lv):'–'}</b></span></button><button class="gk" data-ins="bat" data-w="${w}" aria-label="Body Battery ${f0(bb)}, Details">${gauge(bb,64,7,cB,f0(bb),20)}<span><span class="muted sm">Body Battery</span><b>${uv(bb,' %')}</b></span></button></div>`;
 if(HV==='b')return`<div class="hB"><div class="hbt">${head}</div><div class="muted hbs">${sub}</div><button class="mrow" data-ins="rdy" data-w="${w}"><span>Bereitschaft</span><div class="meter"><i style="width:${ok(d.ready)?d.ready:0}%;background:${cR}"></i></div><b>${f0(d.ready)}</b>${ic('next',16)}</button><button class="mrow" data-ins="bat" data-w="${w}"><span>Body Battery</span><div class="meter"><i style="width:${ok(bb)?bb:0}%;background:${cB}"></i></div><b>${uv(bb,' %')}</b>${ic('next',16)}</button></div>`;
 if(HV==='c')return`<div class="hC"><div class="hct">${head}</div><div class="muted sm">${sub}</div><div class="hcr"><button data-ins="rdy" data-w="${w}">${gauge(d.ready,60,6,cR,f0(d.ready),18)}<span class="sm">Bereitschaft</span></button><button data-ins="bat" data-w="${w}">${gauge(bb,60,6,cB,f0(bb),18)}<span class="sm">Body Battery</span></button><button class="dcard" data-w="${w}" data-k="sleep">${gauge(d.sleep,60,6,cS,f0(d.sleep),18)}<span class="sm">Schlaf</span></button></div></div>`;
 return`<div class="hero"><button class="ringb" data-ins="rdy" data-w="${w}" aria-label="Bereitschaft ${f0(d.ready)} von 100, Details öffnen">${gauge(d.ready,104,10,cR,f0(d.ready),26)}</button>  <div><div class="muted sm">Bereitschaft</div><div class="big">${lv?esc(lv):'–'}</div><div class="muted sm" style="margin-top:4px">${sub}</div></div>${bbRing(w,di)}</div>`}
function personHeute(w,di){const d=DAILY[w][di],T=TODAYV[w],as=ACTS.filter(a=>a.who===w&&dayOf(a.date)===di),
 ex=as.length?as:[ACTS.find(a=>a.who===w&&dayOf(a.date)<=di)].filter(Boolean),R=44,C=2*Math.PI*R;
 const open=CARDS.map(c=>c[0]).find(k=>S.card===w+k);
 return`<div class="pstack">${hintsHtml(w,di)}${analyseHtml(w,di,`${di===ND?'Stand '+(LIVE?standHM(w):'06:40')+', aus Home Assistant':(LIVE?'Home Assistant':'Beispieldaten')}`)}<section class="card">
 ${hvSwitch()}${heroHtml(w,di,d,T)}
 <div class="cg">${CARDS.map(c=>cardHtml(w,c[0],d)).join('')}</div>
 <h2 class="h2" style="margin-top:18px">${as.length?'Aktivitäten dieses Tages':'Zuletzt'}</h2>
 ${ex.length?ex.map(a=>`<button class="arow" data-open="${a.id}"><span class="mr">${routeSvg(a)||`<span class="av" style="background:var(${PERS[w].c})">${ic(a.sport,20)}</span>`}</span><span class="t"><b>${esc(ttl(a))}</b><span class="muted sm">${dfmt(a.date,{weekday:'short',day:'numeric',month:'numeric'})} · ${SP[a.sport].n}</span></span><span class="r">${a.gps?f1(a.st.dist/1000)+' km':hm(a.st.dur)}<span class="muted sm">${a.gps?f0(a.st.gain)+' m ↑ · ':''}${hm(a.st.dur)}</span></span>${ic('next',16)}</button>`).join(''):'<div class="muted">Noch keine Aktivität.</div>'}</section></div>`}
function weekSum(w,off){const d=DAILY[w],e=ND-off,s=e<0?[]:d.slice(Math.max(0,e-6),e+1),cov=s.length===7&&s.every(x=>ok(x.dist));return{dist:cov?sumA(s.map(x=>x.dist)):null,asc:cov?sumA(s.map(x=>x.ascent)):null,dur:cov?sumA(s.map(x=>x.dur)):null,load:cov?sumA(s.map(x=>x.load)):null,n:cov?ACTS.filter(a=>a.who===w&&!a.live&&dayOf(a.date)>e-7&&dayOf(a.date)<=e).length:null}}
function routeSvg(a){if(!a.w)return'';let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const[x,y]of a.w){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
 const s=Math.min(100/(x1-x0||1e-9),100/(y1-y0||1e-9)),ox=(120-(x1-x0)*s)/2,oy=(110-(y1-y0)*s)/2;
 return`<svg viewBox="0 0 120 110"><polyline fill="none" stroke="${col(a.who)}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" points="${a.w.filter((_,i)=>i%2===0).map(([x,y])=>((x-x0)*s+ox).toFixed(1)+','+((y-y0)*s+oy).toFixed(1)).join(' ')}"/></svg>`}
/* ---------- v5: Ampel-Daten, Paar-Ansicht ---------- */
const pc=s=>{if(!ok(s))return'–';s=Math.round(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const KN2={dist:'Distanz in km',ascent:'Aufstieg in m',dur:'Zeit in h',load:'Trainingslast',steps:'Schritte',slp:'Schlafdauer',rhr:'Ruhepuls in bpm',hrv:'HRV in ms'};
const bbNow=(w,di)=>di===ND&&TODAYV[w]&&TODAYV[w].bb!=null?TODAYV[w].bb:DAILY[w][di].bb;
function bbRing(w,di){const v=bbNow(w,di);return`<button class="bbw" data-ins="bat" data-w="${w}" aria-label="Body Battery ${f0(v)} Prozent, Details öffnen">${gauge(v,80,8,'var(--c-heart)',f0(v),20)}<span class="muted sm">Body Battery</span></button>`}
function miniBars(vals,lab,col){const W=300,H=96,n=vals.length,bw=W/(n||1),mx=Math.max(100,...nn(vals));return`<svg viewBox="0 0 ${W} ${H+18}" width="100%" role="img" aria-label="Verlauf">${vals.map((v,i)=>ok(v)?`<rect x="${(i*bw+2).toFixed(1)}" y="${(H-v/mx*H).toFixed(1)}" width="${(bw-4).toFixed(1)}" height="${(v/mx*H).toFixed(1)}" rx="3" fill="${col}"><title>${lab[2]?lab[2](i)+': ':''}${f0(v)}</title></rect>`:'').join('')}<text x="2" y="${H+14}" font-size="11" fill="var(--text2)">${lab[0]}</text><text x="${W-2}" y="${H+14}" text-anchor="end" font-size="11" fill="var(--text2)">${lab[1]}</text></svg>`}
/* ---------- Datenquelle (eigene Integration bevorzugt, sonst Garmin Connect) ---------- */
let DEMOSRC='auto';
const isLive=()=>typeof LIVE!=='undefined'&&LIVE;
const SRCM=[['auto','Automatisch'],['personal','Nur eigene'],['connect','Nur Connect']];
const SRCL={steps:'Schritte',bb:'Body Battery',stress:'Ø Stress',rhr:'Ruhepuls',hrv:'HRV letzte Nacht',sleep:'Schlafwert',kcal:'Kalorien',goal:'Schrittziel',ready:'Trainingsbereitschaft'};
const SRCU={steps:'',bb:' %',stress:'',rhr:' bpm',hrv:' ms',sleep:'',kcal:' kcal',goal:'',ready:''};
const srcModeNow=()=>isLive()?srcNow():DEMOSRC;
/* Wahl je Messwert: Live auf diesem Gerät gemerkt (localStorage), im Mockup nur im Speicher. 'auto' = der globalen Wahl folgen */
let DEMOBY={};
const rowSel=k=>isLive()?srcRowMode(k):DEMOBY[k]||'auto';
const rowEff=k=>{const r=rowSel(k);return r==='auto'?srcModeNow():r};
/* Beispiel: Trainingsbereitschaft gibt es nur bei Connect, alles andere hat beide Quellen (Mockup: Connect weicht leicht ab) */
function srcBoth(w,k){const T=TODAYV[w];if(isLive())return T&&T.both&&T.both[k]||{personal:null,connect:null};const v=T?T[k]:null;if(!ok(v))return{personal:null,connect:null};return k==='ready'?{personal:null,connect:v}:{personal:v,connect:k==='steps'?Math.round(v*.97):v}}
function srcOf(w,k){if(isLive()){const T=TODAYV[w];return T&&T.src?T.src[k]||null:null}const b=srcBoth(w,k),m=rowEff(k);if(m==='connect')return b.connect!=null?'connect':null;if(m==='personal')return b.personal!=null?'personal':b.connect!=null?'connect':null;return b.personal!=null?'personal':b.connect!=null?'connect':null}
function srcTag(s){return s==='personal'?'<span class="srctag e">Eigene</span>':s==='connect'?'<span class="srctag">Connect</span>':'<span class="muted">Verlauf</span>'}
function openSource(){
 const m=srcModeNow(),ws=persons(),note={auto:'Eigene Daten werden bevorzugt. Fehlt ein Wert, nimmt die Karte Garmin Connect.',personal:'Nur die eigene Integration. Fehlt dort ein Wert, steht „–“. Werte, die nur Connect liefert (zum Beispiel die Trainingsbereitschaft), kommen weiter von Connect.',connect:'Nur die bisherige Integration (Garmin Connect).'}[m];
 const fv=(v,k)=>ok(v)?f0(v)+SRCU[k]:'–';
 const tbl=w=>{const T=TODAYV[w];return`${ws.length>1?`<h3 class="insh">${esc(PERS[w].n)}</h3>`:''}<div class="srclist">${Object.keys(SRCL).map(k=>{const b=srcBoth(w,k),only=k==='ready',sel=rowSel(k);
   const seg=only?'<span class="muted sm">Gibt es nur bei Connect</span>':`<div class="seg srcseg s" role="group" aria-label="Quelle für ${SRCL[k]}">${SRCM.map(([x,n])=>`<button data-src="${x}" data-key="${k}" aria-pressed="${sel===x}">${x==='auto'?'Auto':x==='personal'?'Eigene':'Connect'}</button>`).join('')}</div>`;
   return`<div class="srcrow"><div class="srchead"><b>${SRCL[k]}</b>${srcTag(srcOf(w,k))}</div><div class="srcvals muted sm"><span>Eigene ${fv(b.personal,k)}</span><span>Connect ${fv(b.connect,k)}</span></div>${seg}</div>`}).join('')}</div>`};
 const body=`<div class="ins"><p class="muted">Woher die Karte die heutigen Werte nimmt.${isLive()?'':' Im Mockup sind es Beispielwerte.'}</p>
  <h3 class="insh">Alle Messwerte</h3>
  <div class="seg srcseg" role="group" aria-label="Datenquelle">${SRCM.map(([k,n])=>`<button data-src="${k}" aria-pressed="${m===k}">${n}</button>`).join('')}</div>
  <p class="muted sm" style="margin:6px 0 10px">${note} Gilt für alle Messwerte, die unten nicht einzeln gewählt sind.</p>${ws.map(tbl).join('')}
  <p class="muted sm" style="margin-top:10px">Die Wahl gilt für Heute, Verläufe und die Verlaufsansicht und wird auf diesem Gerät gemerkt. „Auto“ folgt der Wahl oben. Die Konfiguration (source, source_by) bleibt die Vorgabe, bis hier etwas gewählt wird.</p></div>`;
 openSheet({title:'Datenquelle',icon:'sliders',color:'--c-body',body,onClick:e=>{const b=e.target.closest('[data-src]');if(!b)return false;
  const v=b.dataset.src,key=b.dataset.key||null;if(isLive()){switchSource(v,key).then(()=>openSource())}else{if(key)DEMOBY[key]=v;else DEMOSRC=v;openSource()}return true}})}
/* ---------- Schlaf: Teilwerte und Garmins Einordnung (nur eigene Integration) ---------- */
const SLQ={excellent:['Sehr gut',100],good:['Gut',75],fair:['Mittel',50],poor:['Schwach',25]};
const SLFB={negative_discontinuous:'Unterbrochener Schlaf',negative_light:'Zu leichter Schlaf',negative_long_but_not_restorative:'Lang, aber wenig erholsam',negative_not_enough_rem:'Zu wenig REM-Schlaf',negative_not_restorative:'Wenig erholsam',negative_short_and_nonrecovering:'Kurz und wenig erholsam',negative_short_and_poor_structure:'Kurz mit schwachem Aufbau',positive_calm:'Ruhiger Schlaf',positive_continuous:'Durchgehender Schlaf',positive_deep:'Tiefer Schlaf',positive_highly_recovering:'Sehr erholsam',positive_long_and_continuous:'Lang und durchgehend',positive_long_and_deep:'Lang und tief',positive_long_and_refreshing:'Lang und erfrischend',positive_optimal_structure:'Optimaler Aufbau der Nacht',positive_recovering:'Erholsam',positive_refreshing:'Erfrischend',positive_short_but_recovering:'Kurz, aber erholsam',positive_short_but_refreshing:'Kurz, aber erfrischend'};
const SLIN={negative_acclimatization_in_progress:'Die Höhenanpassung stört den Schlaf',negative_late_strenuous_exercise:'Spätes, intensives Training',negative_strenuous_exercise:'Intensives Training',negative_stressful_day:'Stressiger Tag',positive_acclimatization_in_progress:'Höhenanpassung läuft',positive_exercise:'Training hat geholfen',positive_late_bed_time:'Später ins Bett gegangen',positive_restful_day:'Ruhiger Tag',positive_restful_evening:'Ruhiger Abend'};
function sleepxHtml(w,di){const T=TODAYV[w],x=di===ND&&T&&T.sleepx;if(!x)return'';
 const q=[['Dauer',x.dur],['Stress',x.stress],['Aufwachen',x.wake],['Unruhe',x.rest]].filter(([,v])=>SLQ[v]).map(([n,v])=>`<div class="srow"><span>${n}</span><div class="sbar"><i style="width:${SLQ[v][1]}%;background:var(--c-sleep)"></i></div><b>${SLQ[v][0]}</b></div>`).join('');
 const st=[['Tiefschlaf','deep'],['REM','rem'],['Leichtschlaf','light']].filter(([,k])=>x.st&&x.st[k]).map(([n,k])=>{const o=x.st[k],has=o.lo!=null&&o.hi!=null;return`<div class="srow"><span>${n}</span><div class="sbar">${has?`<u style="left:${o.lo}%;width:${o.hi-o.lo}%"></u>`:''}<i style="width:${Math.min(100,o.v)}%;background:color-mix(in srgb,var(--c-sleep) 70%,var(--surface))"></i></div><b>${o.v} %${has?` <span class="muted sm">(Ideal ${o.lo}–${o.hi})</span>`:''}</b></div>`}).join('');
 const fb=SLFB[x.fb],ins=SLIN[x.ins],tx=fb||ins?`<p>Garmin: ${[fb,ins].filter(Boolean).map(esc).join('. ')}.</p>`:'';
 if(!q&&!st&&!tx)return'';
 return`<div class="sx2"><b>Teilwerte des Schlafwerts</b>${q}${st?`<div class="muted sm" style="margin-top:8px">Anteile der Nacht, grauer Bereich = Idealbereich</div>${st}`:''}${tx}${isLive()?'':'<div class="muted sm" style="margin-top:6px">Beispieldaten</div>'}</div>`}
/* ---------- Runde 2: Schlafzeiten, HRV-Nacht, Stress-Zusatz, Wochenziel, Fitnessalter, Trainingseffekt, Pulszonen ---------- */
const clk=ms=>new Date(ms).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
const exNote=()=>isLive()?'':'<div class="muted sm" style="margin-top:6px">Beispieldaten</div>';
/* Schlafzeiten: ins Bett, aufgestanden, Zeit im Bett gegen Schlafdauer; Fenster von 18 Uhr am Vorabend bis 12 Uhr */
function hintsHtml(w,di){const T=TODAYV[w];if(di!==ND||!T)return'';const nm=S.who==='both'?PERS[w].n+': ':'',o=[];
 if(T.sync)o.push(['Die Uhr hat sich '+(ok(T.sync.ageH)?'zuletzt vor '+Math.round(T.sync.ageH)+' h':'länger nicht')+' abgeglichen. Die Werte können älter sein.']);
 if(T.key)o.push([T.key.days>0?'Der Garmin-Schlüssel läuft in '+T.key.days+(T.key.days===1?' Tag':' Tagen')+' ab. Danach kommen keine Daten mehr, bis ein neuer eingetragen ist.':'Der Garmin-Schlüssel ist abgelaufen. Es kommen keine neuen Daten, bis ein neuer eingetragen ist.']);
 return o.map(x=>`<div class="hint" role="note">${ic('warn')}<span>${nm?'<b>'+esc(nm.slice(0,-2))+'</b> ':''}${esc(x[0])}</span></div>`).join('')}
function bedrecHtml(w,di){const T=TODAYV[w],x=di===ND&&T&&T.bedrec;if(!x)return'';const k=[];
 if(x.bed!=null&&x.wake!=null)k.push(`<div><b>${clk(x.bed)}</b><span>Ins Bett</span></div><div><b>${clk(x.wake)}</b><span>Aufstehen</span></div>`);
 if(ok(x.need))k.push(`<div><b>${hmm(x.need)}</b><span>Schlafbedarf</span></div>`);
 return k.length?`<div class="sx2"><b>Empfehlung für heute Abend</b><div class="kv kvt" style="margin-top:8px">${k.join('')}</div><p class="muted sm">Zeiten und Bedarf von Garmin, nichts selbst gerechnet.</p></div>`:''}
/* Schlafwert-Stufen (Garmin, aus Erinnerung, nicht geprüft): ab 80 gut, ab 90 sehr gut */
function scoreScale(v){if(!ok(v))return'';const X=x=>(Math.max(50,Math.min(100,x))-50)/50*100,st=v>=90?'sehr gut':v>=80?'gut':'darunter';
 return`<div class="sx2 sscale"><b>Schlafwert ${f0(v)}</b> <span class="muted sm">${st}</span><div class="ssc" role="img" aria-label="Schlafwert ${f0(v)} auf der Skala 50 bis 100, Markierungen bei 80 und 90"><i class="ssb" style="left:${X(80)}%"></i><i class="ssb" style="left:${X(90)}%"></i><i class="ssd" style="left:${X(v)}%"></i></div><div class="ssl"><span style="left:0">50</span><span style="left:${X(80)}%">80 gut</span><span style="left:${X(90)}%">90 sehr gut</span><span style="left:100%">100</span></div></div>`}
/* Letzte 7 Nächte klein: Phasen gestapelt (Dauer) und Schlafwert-Linie, nur Nächte mit Werten */
function miniNights(w,di){const rows=[];for(let i=Math.max(0,di-6);i<=di;i++)rows.push({i,d:DAILY[w][i]});
 const tot=d=>(ok(d.deep)||ok(d.rem)||ok(d.light)||ok(d.awake))?[d.deep,d.rem,d.light,d.awake].reduce((a,b)=>a+(ok(b)?b:0),0):(ok(d.slp)&&d.slp>0?d.slp:0);
 if(!rows.some(r=>tot(r.d)>0||ok(r.d.sleep)))return'';
 const W=360,H=130,m={l:30,r:28,t:14,b:20},w2=W-m.l-m.r,h=H-m.t-m.b,n=rows.length,cw=w2/n,bw=Math.min(24,cw*.6),hU=Math.max(8,Math.ceil(Math.max(...rows.map(r=>tot(r.d)))/60)),Y=min=>m.t+h-min/60/hU*h,Y3=v=>m.t+h-(Math.max(50,Math.min(100,v))-50)/50*h,X=k=>m.l+(k+.5)*cw;
 const col=['var(--c-sleep)','color-mix(in srgb,var(--c-sleep) 62%,transparent)','color-mix(in srgb,var(--c-sleep) 32%,transparent)','var(--sep)'];
 let g='';for(let t=0;t<=hU;t+=4)g+=`<line class="g" x1="${m.l}" x2="${W-m.r}" y1="${Y(t*60)}" y2="${Y(t*60)}"/><text x="${m.l-5}" y="${Y(t*60)+4}" text-anchor="end">${t} h</text>`;
 for(const t of[50,100])g+=`<text x="${W-m.r+5}" y="${Y3(t)+4}">${t}</text>`;
 rows.forEach((r,k)=>{const d=r.d,t=tot(d);if(t>0){const parts=(ok(d.deep)||ok(d.rem)||ok(d.light)||ok(d.awake))?[d.deep,d.rem,d.light,d.awake].map(v=>ok(v)?v:0):[0,0,d.slp,0];let acc=0;
   parts.forEach((v,n2)=>{if(!(v>0))return;g+=`<rect x="${X(k)-bw/2}" y="${Y(acc+v)}" width="${bw}" height="${Math.max(1,Y(acc)-Y(acc+v)-.6)}" style="fill:${col[n2]};opacity:${r.i===di?1:.7}"/>`;acc+=v})}
  g+=`<text x="${X(k)}" y="${H-5}" text-anchor="middle">${dfmt(dAt(r.i),{day:'numeric',month:'numeric'})}</text>`});
 let seg=[];const fl=()=>{if(seg.length>1)g+=`<polyline points="${seg.join(' ')}" style="fill:none;stroke:var(--text);stroke-width:1.6;stroke-linejoin:round"/>`;seg=[]};
 rows.forEach((r,k)=>{if(!ok(r.d.sleep)){fl();return}seg.push(X(k).toFixed(1)+','+Y3(r.d.sleep).toFixed(1))});fl();
 rows.forEach((r,k)=>{if(ok(r.d.sleep))g+=`<circle cx="${X(k)}" cy="${Y3(r.d.sleep)}" r="${r.i===di?4:2.6}" style="fill:var(--text);stroke:var(--surface);stroke-width:1.4"/>`});
 return`<div class="sx2"><b>Letzte 7 Nächte</b><div class="mnights"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Schlafphasen und Schlafwert der letzten 7 Nächte">${g}</svg></div><div class="muted sm">Balken: Schlafdauer in Phasen. Linie: Schlafwert (rechte Achse).</div></div>`}
function sleeptHtml(w,di){const T=TODAYV[w],x=di===ND&&T&&T.sleept,d=DAILY[w][di];if(!x||!ok(x.bed)||!ok(x.wake))return'';
 const inbed=(x.wake-x.bed)/6e4;if(!(inbed>0))return'';const sl=ok(d.slp)&&d.slp>0?d.slp:null,H=36e5;
 /* Garmins Empfehlung gilt für die kommende Nacht: gleiche Uhrzeiten, einen Tag früher auf derselben Achse */
 const r0=T.bedrec,back=ms=>{const q=new Date(ms);q.setDate(q.getDate()-1);return q.getTime()},rec0=r0&&ok(r0.bed)&&ok(r0.wake)&&r0.wake>r0.bed?{bed:back(r0.bed),wake:back(r0.wake)}:null;
 /* Achse eng am Schlaf: volle Stunde vor Bett bis volle Stunde nach Aufstehen; die Empfehlung nur, wenn sie höchstens drei Stunden darüber hinausgeht (dann wird die Achse erweitert), sonst weggelassen */
 let t0=Math.floor(x.bed/H)*H,t1=Math.ceil(x.wake/H)*H;const rec=rec0&&rec0.bed>=t0-3*H&&rec0.wake<=t1+3*H?rec0:null;if(rec){t0=Math.min(t0,Math.floor(rec.bed/H)*H);t1=Math.max(t1,Math.ceil(rec.wake/H)*H)}const nH=Math.round((t1-t0)/H);
 const W=360,ml=8,mr=14,pw=W-ml-mr,X=ms=>ml+(ms-t0)/(t1-t0)*pw,hb=12,yt=12,y1=yt+10,hp=y1+hb+(rec?4:0),Ht=hp+(rec?34:22),step=nH>8?2:1;
 const HM=ms=>{const q=new Date(ms);return String(q.getHours()).padStart(2,'0')+':'+String(q.getMinutes()).padStart(2,'0')};
 let g='';for(let i=0;i<=nH;i+=1){const ms=t0+i*H;g+=`<line class="g" x1="${X(ms)}" x2="${X(ms)}" y1="${y1-6}" y2="${hp+4}"/>`;if(i%step===0)g+=`<text x="${Math.max(ml+10,Math.min(W-mr-10,X(ms)))}" y="${hp+16}" text-anchor="middle">${HM(ms)}</text>`}
 const xb=X(x.bed),xw=X(x.wake),rr=3,mx=(xb+xw)/2,stg=ok(d.deep)||ok(d.rem)||ok(d.light);
 g+=`<rect class="wbar" x="${xb}" y="${y1}" width="${xw-xb}" height="${hb}" rx="${rr}" style="fill:${stg?'var(--sep)':'color-mix(in srgb,var(--c-sleep) 78%,transparent)'}"/>`;
 {const tie=ok(d.deep)?d.deep:0,re=ok(d.rem)?d.rem:0,le=ok(d.light)?d.light:0;let acc=0;
  [[tie,'var(--c-sleep)'],[re,'color-mix(in srgb,var(--c-sleep) 62%,transparent)'],[le,'color-mix(in srgb,var(--c-sleep) 32%,transparent)']].forEach(([v,c])=>{if(!(v>0))return;const a=Math.min(acc,inbed),b=Math.min(acc+v,inbed);g+=`<rect class="wseg" x="${xb+(xw-xb)*a/inbed}" y="${y1}" width="${Math.max(1,(xw-xb)*(b-a)/inbed)}" height="${hb}" style="fill:${c}"/>`;acc+=v})}
 g+=`<text class="sout" x="${xb}" y="${yt}" text-anchor="start">${clk(x.bed)}</text><text class="sout" x="${xw}" y="${yt}" text-anchor="end">${clk(x.wake)}</text>`;
 if(xw-xb>=150)g+=`<text class="sout sdur" x="${mx}" y="${yt}" text-anchor="middle">${hmm(inbed)}</text>`;
 if(rec){const rb=X(rec.bed),rw=X(rec.wake),ry=y1-3,rh=hb+6;g+=`<rect class="srec" x="${rb}" y="${ry}" width="${rw-rb}" height="${rh}" rx="${rh/2}" style="fill:none;stroke:var(--c-sleep);stroke-width:1;stroke-dasharray:3 3"/>`;
  g+=`<text x="${ml}" y="${Ht-4}" text-anchor="start">Gestrichelt: Empfehlung Garmin ${clk(r0.bed)}–${clk(r0.wake)}</text>`}
 const al=`Ins Bett ${clk(x.bed)}, aufgestanden ${clk(x.wake)}, ${hmm(inbed)} im Bett${sl!=null?', '+hmm(sl)+' geschlafen':''}${rec?'. Empfehlung von Garmin: '+clk(r0.bed)+' bis '+clk(r0.wake):''}`;
 return`<div class="sx2"><b>Schlafzeiten</b><div class="kv kvt" style="margin-top:8px"><div><b>${clk(x.bed)}</b><span>Ins Bett</span></div><div><b>${clk(x.wake)}</b><span>Aufgestanden</span></div>${sl!=null?`<div><b>${hmm(sl)}</b><span>Geschlafen</span></div>`:''}</div>
 <div class="swin2" tabindex="0" role="img" aria-label="${esc(al)}"><svg viewBox="0 0 ${W} ${Ht}">${g}</svg></div>${stg?'<div class="lg" style="margin-top:4px">'+[['Tief','var(--c-sleep)'],['REM','color-mix(in srgb,var(--c-sleep) 62%,transparent)'],['Leicht','color-mix(in srgb,var(--c-sleep) 32%,transparent)'],['Wach','var(--sep)']].map(([n,c])=>`<span><i class="dot" style="background:${c}"></i>${n}</span>`).join('')+'</div><div class="muted sm">Die Reihenfolge der Phasen im Balken ist nicht der echte Verlauf, Garmin liefert nur die Summen.</div>':''}${exNote()}</div>`}
/* HRV in der Nacht: Verlauf aus den Verlaufssensoren, Bandbreite „ausgeglichen“ nur bei Connect */
function hrvDemo(w,di){const r=rng(di*29+(w==='p1'?5:9)),base=DAILY[w][di].hrv||60,pts=[];for(let m=20;m<=7*60;m+=5){const h=m/60;pts.push([h,Math.max(25,base+14*Math.sin(h*1.3)+(r()-.5)*22)])}return pts}
function hrvChartHtml(w,di,dl){return`<div class="dday"><b>HRV in der Nacht zu ${dl}</b><div class="chartbox" id="ddv-${w}" style="margin-top:8px"></div><div class="muted sm" id="ddvn-${w}" style="margin-top:6px"></div></div>`}
function hrvPaint(box,w,di,pts,live){const T=TODAYV[w],d=DAILY[w][di],now=di===ND,band=now&&T&&T.hrvband,mx=Math.max(...pts.map(p=>p[1])),mn=Math.min(...pts.map(p=>p[1]));
 denseChart($('#ddv-'+w,box),pts,{c:'var(--c-sleep)',lo:Math.max(0,Math.floor((Math.min(mn,band?band.lo:mn)-10)/20)*20),hi:Math.ceil((Math.max(mx,band?band.hi:mx)+10)/20)*20,fmt:v=>f0(v)+' ms',aria:'HRV in der Nacht',ref:band?[{v:band.lo,n:'ausgeglichen ab '+f0(band.lo)},{v:band.hi,n:'bis '+f0(band.hi)}]:[]});
 $('#ddvn-'+w,box).textContent=(live?'Messungen der Uhr in der Nacht. ':'Beispielkurve. ')+(ok(d.hrv)?'Ø der Nacht: '+f0(d.hrv)+' ms. ':'')+(band?'Der Bereich „ausgeglichen“ ist Garmins persönliche Spanne.':'')}
/* Stress: alle Anteile in Zeit und Zusatzwerte */
function stressExtraHtml(w,di){const d=DAILY[w][di],T=TODAYV[w],p=stressParts(d),has=p.some(x=>ok(x.v)),x=di===ND&&T&&T.str2;if(!has&&!x)return'';
 return`<div class="sx2">${has?`<b>Verteilung des Tages</b>${stackBar(p)}${legendRow(p,v=>hm(v*60))}`:''}${x?`<div class="kv kvt" style="margin-top:8px">${ok(x.max)?`<div><b>${f0(x.max)}</b><span>Höchster Stresslevel</span></div>`:''}${ok(x.sit)?`<div><b>${hmm(x.sit)}</b><span>Sitzende Zeit</span></div>`:''}${ok(x.act)?`<div><b>${hmm(x.act)}</b><span>Sehr aktive Zeit</span></div>`:''}</div>`:''}${exNote()}</div>`}
/* Wochenziel Intensitätsminuten (intensive Minuten zählen doppelt, Garmins Regel) und Etagen heute */
function weekGoalHtml(w,di){const days=DAILY[w],T=TODAYV[w],wd=(dAt(di).getDay()+6)%7,mon=di-wd,names=['Mo','Di','Mi','Do','Fr','Sa','So'];
 const vs=names.map((_,i)=>{const j=mon+i,d=j>=0&&j<=ND?days[j]:null;return d&&(ok(d.imm)||ok(d.imh))?(d.imm||0)+2*(d.imh||0):null});
 const n=vs.filter(v=>v!=null).length,sum=vs.reduce((a,v)=>a+(v||0),0),goal=T&&T.imgoal,fl=di===ND&&T&&T.fl;if(!n&&!fl)return'';
 const mx=Math.max(goal?goal/2:30,...vs.filter(v=>v!=null));
 const bars=n?`<div class="wkb" role="img" aria-label="Intensitätsminuten je Tag der Woche">${vs.map((v,i)=>`<div>${v!=null&&v>0?`<span>${v}</span>`:''}<i class="${v==null?'na':''}" style="height:${v==null?4:Math.max(3,v/mx*100)}%"></i><span>${names[i]}</span></div>`).join('')}</div>`:'';
 return`<div class="sx2"><b>Wochenziel</b>${n?`<div class="srow" style="margin-top:8px"><span>Intensität</span>${meter(goal?sum/goal*100:0,'var(--c-act)')}<b>${f0(sum)}${goal?' von '+f0(goal):''} min</b></div>${bars}<p class="muted sm">Intensive Minuten zählen doppelt. Tage ohne Messwert sind grau (${n} von ${names.length} Tagen haben Werte).</p>`:''}${fl?`<div class="srow"><span>Etagen hoch</span>${meter(fl.up/fl.goal*100,'var(--c-act)')}<b>${f1(fl.up)} von ${f0(fl.goal)}</b></div>`:''}${exNote()}</div>`}
/* Fitnessalter gegen kalendarisches Alter */
function ageHtml(w){const T=TODAYV[w],a=T&&T.age;if(!a||!ok(a.fa)||!ok(a.ca))return'';
 const pts=[a.fa,a.ca,...(ok(a.ach)?[a.ach]:[])],lo=Math.floor(Math.min(...pts)-3),hi=Math.ceil(Math.max(...pts)+3),X=v=>(v-lo)/(hi-lo)*100,diff=a.ca-a.fa,c=a.comp;
 return`<div class="sx2"><b>Fitnessalter</b><div class="agel" role="img" aria-label="Fitnessalter ${f1(a.fa)}, kalendarisches Alter ${f0(a.ca)}"><s></s><span style="left:${X(Math.min(a.fa,a.ca))}%;width:${Math.abs(X(a.ca)-X(a.fa))}%"></span><b style="left:${X(a.fa)}%">${f1(a.fa)}</b>${ok(a.ach)?`<b class="ach" style="left:${X(a.ach)}%"></b>`:''}<b class="cal" style="left:${X(a.ca)}%">${f0(a.ca)}</b></div>
 <div class="kv kvt"><div><b>${f1(a.fa)} J</b><span>Fitnessalter</span></div><div><b>${f0(a.ca)} J</b><span>Kalendarisch</span></div><div><b>${diff>=0?'−':'+'}${f1(Math.abs(diff))} J</b><span>Differenz</span></div>${ok(a.ach)?`<div><b>${f1(a.ach)} J</b><span>Erreichbar</span></div>`:''}</div>
 ${c&&(ok(c.bmi)||ok(c.rhr)||ok(c.vm))?`<div class="muted sm" style="margin-top:6px">Fließt ein: ${[ok(c.bmi)?'BMI '+f1(c.bmi):'',ok(c.rhr)?'Ruhepuls '+f0(c.rhr)+' bpm':'',ok(c.vm)?f0(c.vm)+' intensive Minuten pro Woche':'',ok(c.vd)?f1(c.vd)+' intensive Tage pro Woche':''].filter(Boolean).join(' · ')}.</div>`:''}${exNote()}</div>`}
/* Trainingseffekt: nur für die letzte Aktivität, die Garmin dazu meldet */
function teHtml(a){const L=TODAYV[a.who]&&TODAYV[a.who].last;if(!L||L.id!==a.id)return'';
 const row=(n,v)=>ok(v)?`<div class="srow"><span>${n}</span>${meter(v/5*100,'var(--c-heart)')}<b>${f1(v)} von 5</b></div>`:'';
 const h=row('Aerob',L.aer)+row('Anaerob',L.ana);if(!h&&!ok(L.load))return'';
 return`<div class="sx2" style="margin-bottom:12px"><b>Trainingseffekt</b>${h}${ok(L.load)?`<div class="muted sm" style="margin-top:6px">Trainingsbelastung ${f0(L.load)}</div>`:''}${exNote()}</div>`}
/* Pulszonen: Grenzen aus Garmins Einstellung (Maximalpuls), Laktatschwelle als Hinweis */
const znRange=(w,i)=>{const z=TODAYV[w]&&TODAYV[w].zn;if(!z)return'';const lo=z.fl[i],hi=i<4?z.fl[i+1]-1:z.max;return ok(lo)?` · ${f0(lo)}${ok(hi)?'–'+f0(hi):'+'} bpm`:''};
const znNote=(w)=>{const z=TODAYV[w]&&TODAYV[w].zn;if(!z)return'';let t='Die Grenzen der Zonen stammen aus Garmins Einstellung'+(ok(z.max)?' (Maximalpuls '+f0(z.max)+' bpm)':'')+'.';
 if(ok(z.lthr)){let zi=-1;for(let i=0;i<5;i++)if(z.lthr>=z.fl[i])zi=i;t+=` Deine Laktatschwelle liegt bei ${f0(z.lthr)} bpm${zi>=0?', also in Zone '+(zi+1):''}.`}return`<div class="muted sm" style="margin-top:8px">${t}</div>`};
/* ---------- Dichte Tagesverläufe (Minutentakt, aus den Verlaufssensoren) ---------- */
function denseChart(box,pts,o){const W=Math.max(260,box.clientWidth||320),H=o.h||150,m={l:40,r:6,t:8,b:22},w=W-m.l-m.r,X=h=>m.l+h/24*w,Y=v=>m.t+(1-(v-o.lo)/(o.hi-o.lo))*(H-m.t-m.b);
 let g='';for(let q=0;q<=2;q++){const v=o.lo+(o.hi-o.lo)*q/2,y=Y(v);g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y}" y2="${y}" stroke="var(--grid)"/><text x="${m.l-6}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--text2)">${f0(v)}</text>`}
 for(let h=0;h<=24;h+=6)g+=`<text x="${X(h)}" y="${H-6}" text-anchor="${h===0?'start':h===24?'end':'middle'}" font-size="11" fill="var(--text2)">${h===24?'24':h} Uhr</text>`;
 for(const r of o.ref||[])if(ok(r.v))g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${Y(r.v)}" y2="${Y(r.v)}" stroke="var(--text2)" stroke-dasharray="4 3" stroke-width="1"/><text x="${W-m.r}" y="${Y(r.v)-4}" text-anchor="end" font-size="11" fill="var(--text2)">${r.n}</text>`;
 /* Lücken über 45 Minuten werden nicht überbrückt */
 const segs=[];let cur=[];for(const p of pts){if(cur.length&&p[0]-cur[cur.length-1][0]>.75){segs.push(cur);cur=[]}cur.push(p)}if(cur.length)segs.push(cur);
 let marks='';for(const sg of segs){const d=sg.map((p,i)=>(i?'L':'M')+X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' ');
  if(sg.length>1)marks+=`<path d="${d} L${X(sg[sg.length-1][0]).toFixed(1)},${H-m.b} L${X(sg[0][0]).toFixed(1)},${H-m.b} Z" fill="${o.c}" opacity=".13"/>`;
  marks+=`<path d="${d}" fill="none" stroke="${o.c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`}
 const e=pts[pts.length-1];marks+=`<circle cx="${X(e[0])}" cy="${Y(e[1])}" r="4" fill="${o.c}" stroke="var(--surface)" stroke-width="2"/>`;
 box.style.position='relative';box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${o.aria||'Tagesverlauf'}">${g}${marks}</svg><div class="tip" hidden></div>`;
 const svg=$('svg',box),tip=$('.tip',box);svg.onpointermove=ev=>{const r=svg.getBoundingClientRect(),h=((ev.clientX-r.left)/r.width*W-m.l)/w*24;let b=pts[0];for(const p of pts)if(Math.abs(p[0]-h)<Math.abs(b[0]-h))b=p;if(Math.abs(b[0]-h)>.75){tip.hidden=true;return}tip.hidden=false;tip.style.left=Math.max(60,Math.min(W-60,X(b[0])))+'px';tip.style.top=Y(b[1])+'px';tip.innerHTML=hh2(b[0])+' Uhr<br>'+o.fmt(b[1])};svg.onpointerleave=()=>{tip.hidden=true}}
function denseSummary(pts,unit){let lo=pts[0],hi=pts[0];for(const p of pts){if(p[1]<lo[1])lo=p;if(p[1]>hi[1])hi=p}return`Höchster Wert ${f0(hi[1])}${unit} um ${hh2(hi[0])} Uhr, niedrigster ${f0(lo[1])}${unit} um ${hh2(lo[0])} Uhr.`}
/* Mockup: Beispielkurve aus dem Stundenmodell, nur in der Demo */
function denseDemo(w,di,kind){const hr=dayCurve(w,di,kind),r=rng(di*17+(w==='p1'?1:2)+kind.length),st=kind==='bb'?3:5,pts=[];
 for(let m=0;m<=24*60;m+=st){const h=m/60,i=Math.min(23,Math.floor(h));if(hr[i]==null)continue;const j=Math.min(23,Math.max(0,h%1<.5?i-1:i+1)),a=hr[i],b=hr[j]==null?a:hr[j],t=Math.abs(h%1-.5),v=a+(b-a)*t+(r()-.5)*(kind==='bb'?1:7);pts.push([h,kind==='bb'?Math.max(2,Math.min(100,v)):Math.max(38,v)])}
 return pts.length>=4?pts:null}
function openInsight(w,k){const di=S.day,d=DAILY[w][di],now=di===ND,nm=PERS[w].n,lv=rLevel(w,di),fs=rFacs(w,di),i0=Math.max(0,di-13);
 const body=k==='rdy'?`<div class="ins"><div class="insbig"><b>${f0(d.ready)}</b>${lv?`<span>${esc(lv)}</span>`:''}</div>${lv?'<p class="muted">Einstufung laut Garmin.</p>':''}
  ${fs.length?`<h3 class="insh">Faktoren laut Garmin</h3><table class="tbl"><tr><th>Faktor</th><th>Anteil</th><th>Garmin</th></tr>${fs.map(x=>`<tr><td>${esc(x.n)}${x.x?` <span class="muted sm">${esc(x.x)}</span>`:''}</td><td style="white-space:nowrap">${ok(x.pct)?f0(x.pct)+' %':'–'}</td><td>${x.fb?esc(rFb(x.fb)):'–'}</td></tr>`).join('')}</table>`:''}
  <h3 class="insh">Bereitschaft der letzten 14 Tage</h3>${miniBars(DAILY[w].slice(i0,di+1).map(x=>x.ready),[dayLabel(i0),dayLabel(di),i=>dayLabel(i0+i)],'var(--c-act)')}
  <h3 class="insh">So kommt der Wert zustande</h3><p class="muted">Garmin berechnet die Trainingsbereitschaft selbst aus diesen Faktoren: Schlaf der letzten Nacht, Erholungszeit, Belastung (akut zu chronisch), Stressverlauf, HRV und Schlafverlauf. Die Karte zeigt Garmins Zahl und Einstufung unverändert${now?'':'; für frühere Tage liefert Garmin nur die Zahl'}.</p></div>`
 :`<div class="ins"><div class="insbig"><b>${uv(bbNow(w,di),' %')}</b><span class="muted">${now?'jetzt':'Tagesmittel'}</span></div><p>${esc(bbText(w,di))}</p><div id="dp-${w}"></div>
  <h3 class="insh">Was die Body Battery beeinflusst</h3><p class="muted">Sie lädt sich im Schlaf und in Ruhe auf. Stress, Bewegung und Training entladen sie. Je höher der Wert am Morgen, desto mehr Spielraum hast du für den Tag.</p></div>`;
 openSheet({title:(k==='rdy'?'Bereitschaft: ':'Body Battery: ')+nm,icon:k==='rdy'?'spark':'bolt',color:k==='rdy'?'--c-act':'--c-heart',body,onClose:()=>{S.card=null;vHeute()}});
 if(k==='bat')dayBlock(w,'rec')}
function bbText(w,di){const v=bbNow(w,di),d=DAILY[w][di];return di===ND?`Aktueller Wert von Garmin: ${uv(v,' %')}.`:`Tagesmittel: ${uv(d.bb,' %')}.`}
function actRows(w,di){const as=ACTS.filter(a=>a.who===w&&dayOf(a.date)===di),ex=as.length?as:[ACTS.find(a=>a.who===w&&dayOf(a.date)<=di)].filter(Boolean);
 return`<h2 class="h2" style="margin-top:6px">${as.length?'Aktivitäten dieses Tages':'Zuletzt'}</h2>`+(ex.length?ex.map(a=>`<button class="arow" data-open="${a.id}"><span class="mr">${routeSvg(a)||`<span class="av" style="background:var(${PERS[w].c})">${ic(a.sport,20)}</span>`}</span><span class="t"><b>${esc(ttl(a))}</b><span class="muted sm">${dfmt(a.date,{weekday:'short',day:'numeric',month:'numeric'})} · ${SP[a.sport].n}</span></span><span class="r">${a.gps?f1(a.st.dist/1000)+' km':hm(a.st.dur)}<span class="muted sm">${a.gps?f0(a.st.gain)+' m ↑ · ':''}${hm(a.st.dur)}</span></span>${ic('next',16)}</button>`).join(''):'<div class="muted">Noch keine Aktivität.</div>')}
function pairHeute(di){const ws=['p1','p2'],D2={p1:DAILY.p1[di],p2:DAILY.p2[di]};
 const head=ws.map(w=>hintsHtml(w,di)).join('')+`<div class="pair phead">${ws.map(w=>`<div class="who" style="margin:0"><span class="dot" style="background:var(${PERS[w].c})"></span>${PERS[w].n}</div>`).join('')}</div>`;
 const cmpRow=(lab,k,f)=>`<div class="pc-l">${lab}</div>${ws.map(w=>{const x=f(w);return x==null?'<div></div>':`<button class="pc-r" data-ins="${k}" data-w="${w}" aria-label="${lab} ${PERS[w].n} ${x.t}"><span class="pc-v"><b>${x.t}</b></span><span class="pc-bar"><i style="width:${ok(x.v)?Math.max(0,Math.min(100,x.v)):0}%;background:var(${PERS[w].c})"></i></span></button>`}).join('')}`;
 const heroes=`<div class="pcmp"><div></div>${ws.map(w=>{const lv=rLevel(w,di);return`<div class="pc-h"><b><span class="dot" style="background:var(${PERS[w].c})"></span>${PERS[w].n}</b><span class="sm">${lv?'Garmin: '+esc(lv):'&nbsp;'}</span></div>`}).join('')}
  ${cmpRow('Bereitschaft','rdy',w=>({v:D2[w].ready,t:f0(D2[w].ready)}))}
  ${cmpRow('Body Battery','bat',w=>{const b=bbNow(w,di);return{v:b,t:f0(b)}})}
  ${cmpRow('Schlaf','sleep',w=>({v:D2[w].sleep,t:f0(D2[w].sleep)}))}</div>`;
 const tile=k=>{const meta=CARDS.find(c=>c[0]===k),open=S.card==='pair'+k;
  const v=w=>{const d=D2[w],T=TODAYV[w];let big,sub,p=null;
   if(k==='sleep'){big=hmm(d.slp);sub='Schlafwert '+f0(d.sleep);p=ok(d.slp)&&ok(T.need)&&T.need>0?d.slp/T.need*100:null}
   else if(k==='rec'){big=f0(d.hrv)+' <small>ms HRV</small>';sub='Ruhepuls '+uv(d.rhr,' bpm');p=d.bb}
   else if(k==='act'){big=f0(d.steps)+' <small>Schritte</small>';p=ok(d.steps)&&ok(T.goal)&&T.goal>0?d.steps/T.goal*100:null;sub=ok(p)?f0(p)+' % vom Ziel':'Ziel –'}
   else if(k==='str'){big=f0(d.stress)+' <small>Ø Level</small>';sub='Garmin-Tagesmittel';p=d.stress}
   else{big=f1(d.kg)+' <small>kg</small>';sub='VO2max '+f0(d.vo2)}
   return`<div class="pcell"><div class="bigv" style="font-size:20px">${big}</div><div class="muted sm">${sub}</div>${!ok(p)?'':meter(p,`var(${PERS[w].c})`)}</div>`};
  return`<button class="dcard pcard" style="--cc:var(${meta[2]})" data-w="pair" data-k="${k}" aria-expanded="${open}"><div class="dh2"><span class="ico">${ic(meta[3],16)}</span>${meta[1]}<span class="chev">${ic(open?'x':'next',16)}</span></div><div class="pair">${ws.map(v).join('')}</div></button>`};
 return`<section class="card pairc"><div class="muted sm" style="margin-bottom:10px">${PERS.p1.n} und ${PERS.p2.n} nebeneinander, ohne Wertung. Jede Person hat ihre eigene Skala.</div>${heroes}<div class="pgrid">${CARDS.map(c=>tile(c[0])).join('')}</div></section><div class="cols">${ws.map(w=>`<section class="card"><div class="who"><span class="dot" style="background:var(${PERS[w].c})"></span>${PERS[w].n}</div>${actRows(w,di)}</section>`).join('')}</div>`}
function pairPanel(k){const box=$('#dp-pair');if(!box)return;const n=ND+1,vis=S.dspan,ws=['p1','p2'];
 const F={sleep:['slp','Schlafdauer pro Nacht','group'],rec:['hrv','HRV','line'],act:['steps','Schritte pro Tag','group'],str:['stress','Ø Stresslevel pro Tag','group'],body:['vo2','VO2max','line']}[k],f=F[0];
 const fm={sleep:{y:v=>f1(v/60)+' h',t:hmm},rec:{y:f0,t:v=>f0(v)+' ms'},act:{y:f0,t:f0},str:{y:f0,t:f0},body:{y:f0,t:f0}}[k],kv=k==='sleep'?hmm:f0;
 const lab=i=>dfmt(dAt(i),{weekday:'long',day:'numeric',month:'long'}),short=i=>{const d=dAt(i);return vis<=7?dfmt(d,{weekday:'short',day:'numeric'}).replace('.',''):dfmt(d,{day:'numeric',month:'numeric'})},avg=avgA;
 box.innerHTML=`<div class="dtop"><b>${CARDS.find(c=>c[0]===k)[1]}: ${F[1]}</b><div class="seg">${[[7,'Woche'],[30,'Monat'],[90,'3 Monate']].map(([x,t])=>`<button data-ds="${x}" aria-pressed="${vis===x}">${t}</button>`).join('')}</div></div><div class="lg" style="margin:6px 0">${ws.map(w=>`<span><i class="dot" style="background:var(${PERS[w].c})"></i>${PERS[w].n}</span>`).join('')}</div><div class="prange" id="pr"></div><div class="chartbox" id="pc1"></div><div class="ptab" id="pk" style="margin-top:10px"></div><div class="muted sm" style="margin-top:8px">Nach links wischen für frühere Tage. Auf einen Tag tippen, um ihn oben anzuzeigen.</div>`;
 const upd=(a,b)=>{S.pwin=a;$('#pr',box).textContent=dfmt(dAt(a),{day:'numeric',month:'long'})+' bis '+dfmt(dAt(b),{day:'numeric',month:'long',year:'numeric'});
  const s=w=>DAILY[w].slice(a,b+1).map(d=>d[f]);$('#pk',box).innerHTML=`<div class="prow ph"><span></span>${ws.map(w=>`<span><i class="dot" style="background:var(${PERS[w].c})"></i>${PERS[w].n}</span>`).join('')}</div>`+[['Durchschnitt',x=>avg(x)],['Höchster Tag',maxA],['Niedrigster Tag',minA]].map(([t,g])=>`<div class="prow"><span class="pl">${t}</span>${ws.map(w=>`<span class="pv"><b>${kv(g(s(w)))}</b></span>`).join('')}</div>`).join('')};
 scrollChart($('#pc1',box),{n,vis,labels:lab,short,sel:S.day,pwin:S.pwin,onPick:i=>{S.day=i;vHeute()},onWindow:upd,mode:F[2],h:k==='sleep'?190:170,series:ws.map(w=>({n:PERS[w].n,c:`var(${PERS[w].c})`,v:DAILY[w].map(d=>d[f])})),yfmt:fm.y,tfmt:fm.t,aria:F[1]+', '+PERS.p1.n+' und '+PERS.p2.n})}
function kpiRows(c,p,okp){const P=k=>p?p[k]:null,dt=(a,b)=>pct(okp,a,b);return[['Aktivitäten',f0(c.n),okp&&ok(c.n)&&ok(P('n'))?(c.n-P('n')>0?'+':'')+(c.n-P('n')):'',null],['Distanz',uv(c.dist,' km'),dt(c.dist,P('dist')),'dist'],['Aufstieg',uv(c.asc,' m'),dt(c.asc,P('asc')),'ascent'],['Zeit',uv(c.dur,' h',f1),dt(c.dur,P('dur')),'dur'],['Trainingslast',f0(c.load),dt(c.load,P('load')),'load'],['Ø Schritte',f0(c.steps),dt(c.steps,P('steps')),'steps'],['Ø Schlaf',hmm(c.sleep),dt(c.sleep,P('sleep')),'slp'],['Ø Ruhepuls',uv(c.rhr,' bpm'),dt(c.rhr,P('rhr')),'rhr'],['Ø HRV',uv(c.hrv,' ms'),dt(c.hrv,P('hrv')),'hrv']]}
/* Veränderung in Prozent, nur wenn beide Seiten echte Werte haben */
const pct=(okp,a,b)=>okp&&ok(a)&&ok(b)&&b?(a>=b?'+':'')+Math.round((a-b)/b*100)+' %':'';
function pairTable(a,b,pa,okp){const ws=['p1','p2'],R=ws.map(w=>kpiRows(rangeSum(w,a,b),okp?rangeSum(w,pa,a-1):null,okp));
 return`<div class="ptab" style="margin-top:14px"><div class="prow ph"><span></span>${ws.map(w=>`<span><i class="dot" style="background:var(${PERS[w].c})"></i>${PERS[w].n}</span>`).join('')}</div>${R[0].map((r,i)=>{const q=R[1][i],inner=`<span class="pl">${r[0]}</span>${[r,q].map(x=>`<span class="pv"><b>${x[1]}</b><span class="delta">${x[2]?x[2]+' gegen davor':''}</span></span>`).join('')}`;return r[3]?`<button class="prow" data-kpi="${r[3]}" data-w="pair" aria-pressed="${S.kpi==='pair|'+r[3]}">${inner}</button>`:`<div class="prow">${inner}</div>`}).join('')}</div>`}
function recordsPairHtml(){const ws=['p1','p2'],R=ws.map(recordsFor),labels=[...new Set([...R[0],...R[1]].map(x=>x[0]))];
 return`<div class="card"><div class="who">Persönliche Rekorde 2026<span class="lg" style="margin-left:auto;font-weight:400">${ws.map(w=>`<span><i class="dot" style="background:var(${PERS[w].c})"></i>${PERS[w].n}</span>`).join('')}</span></div><div class="recs">${labels.map(l=>`<div class="rec pairrec"><span class="muted sm">${l}</span>${ws.map((w,j)=>{const x=R[j].find(q=>q[0]===l);return x?`<button class="pr2" ${x[3]==='open'?`data-open="${x[4]}"`:`data-day="${x[4]}"`}><i class="dot" style="background:var(${PERS[w].c})"></i><b>${x[1]}</b><span class="muted sm">${dfmt(x[2],{day:'numeric',month:'numeric'})}</span></button>`:'<span class="muted sm">–</span>'}).join('')}</div>`).join('')}</div></div>`}
function moreBtn(){const b=$('#zlaunch');if(!b)return;b.innerHTML=`<button class="morebtn" id="zmore"><span><b>Mehr: Zusammenhänge</b><span class="muted sm">Schlafdauer gegen Stress, Body Battery, Bereitschaft und HRV</span></span>${ic('next',16)}</button>`;$('#zmore').onclick=()=>{S.more=true;vTrend()}}
function vHeute(){const v=$('#view'),di=S.day;
 const strip=Array.from({length:7},(_,k)=>ND-6+k).filter(i=>i>=0);
 v.innerHTML=`<div class="daybar"><button class="ib" id="dpv" aria-label="Vorheriger Tag" ${di<=0?'disabled':''}>${ic('prev')}</button><div class="dl"><b>${di===ND?'Heute':dayLabel(di)}</b><span class="muted sm">${dfmt(dAt(di),{weekday:'long',day:'numeric',month:'long'})}</span></div><button class="ib" id="dnx" aria-label="Nächster Tag" ${di>=ND?'disabled':''}>${ic('next')}</button><label class="ib datebtn" aria-label="Datum wählen">${ic('calendar')}<input type="date" id="dpick" min="${iso(0)}" max="${iso(ND)}" value="${iso(di)}"></label>
 <div class="strip" role="group" aria-label="Letzte sieben Tage">${strip.map(i=>{const has=ACTS.some(a=>persons().includes(a.who)&&dayOf(a.date)===i);return`<button data-d="${i}" aria-pressed="${i===di}"><span class="muted sm">${dfmt(dAt(i),{weekday:'short'}).replace('.','')}</span><b>${dAt(i).getDate()}</b><i class="pd" style="visibility:${has?'visible':'hidden'}"></i></button>`}).join('')}</div></div>
 ${liveBanner()}${S.who==='both'?pairHeute(di):`<div class="cols">${persons().map(w=>personHeute(w,di)).join('')}</div>`}`;
 v.onclick=e=>{const o=e.target.closest('[data-open]');if(o){S.sel=o.dataset.open;S.preset='all';S.range=null;S.tab='tour';render();return}
  if(e.target.closest('#dpv')){S.day=Math.max(0,S.day-1);return vHeute()}if(e.target.closest('#dnx')){S.day=Math.min(ND,S.day+1);return vHeute()}
  const s=e.target.closest('.strip button');if(s){S.day=+s.dataset.d;return vHeute()}
  const hv=e.target.closest('[data-hv]');if(hv){HV=hv.dataset.hv;return vHeute()}const ins=e.target.closest('[data-ins]');if(ins){const key=ins.dataset.w+ins.dataset.ins;S.card=S.card===key?null:key;return vHeute()}const c=e.target.closest('.dcard');if(c){const key=c.dataset.w+c.dataset.k;S.card=S.card===key?null:key;return vHeute()}
  const sp=e.target.closest('[data-ds]');if(sp){S.dspan=+sp.dataset.ds;S.pwin=null;return vHeute()}};
 const dp=$('#dpick');if(dp){dp.onclick=()=>{try{dp.showPicker&&dp.showPicker()}catch(_){}};dp.onchange=()=>{const [y,m,d]=dp.value.split('-').map(Number);if(!y)return;S.day=Math.max(0,Math.min(ND,Math.round((Date.UTC(y,m-1,d)-Date.UTC(START.getFullYear(),START.getMonth(),START.getDate()))/D)));S.pwin=null;vHeute()}}
 {const pk=CARDS.map(c=>c[0]).find(k=>S.card==='pair'+k);let w0=null,k0=pk;if(pk)w0='pair';else for(const w of persons()){const k=CARDS.map(c=>c[0]).find(k=>S.card===w+k);if(k){w0=w;k0=k}}
  if(w0){const meta=CARDS.find(c=>c[0]===k0);openSheet({title:meta[1]+(w0==='pair'?': '+PERS.p1.n+' und '+PERS.p2.n:': '+PERS[w0].n),icon:meta[3],color:meta[2],body:`<div id="dp-${w0}"></div>`,onClose:()=>{S.card=null;vHeute()},onClick:e=>{const sp=e.target.closest('[data-ds]');if(sp){S.dspan=+sp.dataset.ds;S.pwin=null;vHeute();return true}}});if(w0==='pair')pairPanel(k0);else panel(w0,k0)}else{const ik=persons().map(w=>[w,['rdy','bat'].find(k=>S.card===w+k)]).find(x=>x[1]);if(ik)openInsight(ik[0],ik[1]);else closeSheet(true)}}}
function panel0(w,k){const box=$('#dp-'+w);if(!box)return;const n=ND+1,vis=S.dspan,days=DAILY[w],meta=CARDS.find(x=>x[0]===k),T=TODAYV[w];
 const lab=i=>dfmt(dAt(i),{weekday:'long',day:'numeric',month:'long'}),short=i=>{const d=dAt(i);return vis<=7?dfmt(d,{weekday:'short',day:'numeric'}).replace('.',''):dfmt(d,{day:'numeric',month:'numeric'})};
 const pick=i=>{S.day=i;vHeute()},avg=avgA,col2=(f)=>days.map(d=>d[f]);
 const titles={sleep:'Schlafdauer pro Nacht',rec:'HRV und Ruhepuls',act:'Schritte pro Tag',str:'Ø Stresslevel pro Tag',body:'Gewicht und VO2max'};
 box.innerHTML=`<div class="dtop"><b>${meta[1]}: ${titles[k]}</b><div class="seg">${[[7,'Woche'],[30,'Monat'],[90,'3 Monate']].map(([x,t])=>`<button data-ds="${x}" aria-pressed="${vis===x}">${t}</button>`).join('')}</div></div><div class="prange" id="pr"></div><div class="chartbox" id="pc1"></div>${k==='rec'||k==='body'?'<div class="chartbox" id="pc2" style="margin-top:6px"></div>':''}<div class="kv" id="pk" style="margin-top:12px"></div><div class="muted sm" style="margin-top:8px">Nach links wischen für frühere Tage. Auf einen Tag tippen, um ihn oben anzuzeigen.${(typeof LIVE!=='undefined'&&LIVE)?'':' Echte Verlaufsdaten gibt es erst ab 18.10., davor Beispieldaten.'}</div>`;
 let kvf,c1;const sel=S.day,upd=(a,b)=>{S.pwin=a;const sl=days.slice(a,b+1);$('#pr',box).textContent=dfmt(dAt(a),{day:'numeric',month:'long'})+' bis '+dfmt(dAt(b),{day:'numeric',month:'long',year:'numeric'});$('#pk',box).innerHTML=kvf(sl).map(([x,y])=>`<div><b>${x}</b><span>${y}</span></div>`).join('')};
 const base={n,vis,labels:lab,short,sel,pwin:S.pwin,onPick:pick,onWindow:upd};
 if(k==='sleep'){const cs=['var(--c-sleep)',mix('--c-sleep',62),mix('--c-sleep',32),'var(--sep)'];
  kvf=sl=>[[hmm(avg(sl.map(d=>d.slp))),'Ø Schlafdauer'],[f0(avg(sl.map(d=>d.sleep))),'Ø Schlafwert'],[hmm(avg(sl.map(d=>d.deep))),'Ø Tiefschlaf'],[hmm(maxA(sl.map(d=>d.slp))),'Längste Nacht']];
  c1=scrollChart($('#pc1',box),{...base,mode:'stack',series:[['deep','Tief'],['rem','REM'],['light','Leicht'],['awake','Wach']].map(([f,nm],j)=>({n:nm,c:cs[j],v:col2(f)})),yfmt:v=>f1(v/60)+' h',tfmt:hmm,goal:T.need,aria:'Schlafdauer pro Nacht'})}
 else if(k==='rec'){const h=col2('hrv');
  kvf=sl=>[[uv(avg(sl.map(d=>d.hrv)),' ms'),'Ø HRV'],[uv(avg(sl.map(d=>d.rhr)),' bpm'),'Ø Ruhepuls'],[uv(avg(sl.map(d=>d.bb)),' %'),'Ø Body Battery'],[uv(minA(sl.map(d=>d.rhr)),' bpm'),'Niedrigster Ruhepuls']];
  c1=scrollChart($('#pc1',box),{...base,mode:'line',h:150,series:[{n:'HRV',c:'var(--c-heart)',v:h}],tfmt:v=>f0(v)+' ms',aria:'HRV Nacht'});
  const c2=scrollChart($('#pc2',box),{...base,onWindow:null,onPick:pick,mode:'line',h:110,series:[{n:'Ruhepuls',c:mix('--c-heart',70),v:col2('rhr')}],tfmt:v=>f0(v)+' bpm',aria:'Ruhepuls'});
  const sy=(x,y)=>x.scl.addEventListener('scroll',()=>{if(y.scl.scrollLeft!==x.scl.scrollLeft)y.scl.scrollLeft=x.scl.scrollLeft});sy(c1,c2);sy(c2,c1);
}
 else if(k==='act'){kvf=sl=>[[f0(avg(sl.map(d=>d.steps))),'Ø Schritte'],[ok(T.goal)?sl.filter(d=>ok(d.steps)&&d.steps>=T.goal).length+' von '+nn(sl.map(d=>d.steps)).length:'–','Tage mit Ziel'],[uv(sumA(sl.map(d=>d.dist)),' km'),'Training gesamt'],[f0(avg(sl.map(d=>d.kcal)))+' kcal','Ø Verbrauch']];
  c1=scrollChart($('#pc1',box),{...base,mode:'stack',series:[{n:'Schritte',c:'var(--c-act)',v:col2('steps')}],tfmt:f0,goal:T.goal,aria:'Schritte pro Tag'})}
 else if(k==='str'){kvf=sl=>[[f0(avg(sl.map(d=>d.stress))),'Ø Level'],[f0(maxA(sl.map(d=>d.stress))),'Höchster Tageswert'],[f0(minA(sl.map(d=>d.stress))),'Niedrigster Tageswert'],[uv(avg(sl.map(d=>d.sr)),' min'),'Ø Ruhe pro Tag']];
  c1=scrollChart($('#pc1',box),{...base,mode:'stack',series:[{n:'Stress',c:'var(--c-str)',v:col2('stress')}],tfmt:f0,aria:'Stress pro Tag'})}
 else{kvf=sl=>{const kg=nn(sl.map(d=>d.kg)),vo=nn(sl.map(d=>d.vo2)),dk=kg.length>1?kg[kg.length-1]-kg[0]:null;return[[uv(kg[kg.length-1],' kg',f1),'Gewicht zuletzt'],[uv(avg(kg),' kg',f1),'Ø Gewicht'],[f0(vo[vo.length-1]),'VO2max zuletzt'],[dk==null?'–':(dk>=0?'+':'−')+f1(Math.abs(dk))+' kg','Veränderung']]};
  c1=scrollChart($('#pc1',box),{...base,mode:'line',h:150,series:[{n:'Gewicht',c:'var(--c-body)',v:col2('kg')}],yfmt:v=>f1(v),tfmt:v=>f1(v)+' kg',aria:'Gewicht'});
  const c2=scrollChart($('#pc2',box),{...base,onWindow:null,mode:'line',h:110,series:[{n:'VO2max',c:mix('--c-body',70),v:col2('vo2')}],tfmt:f0,aria:'VO2max'});
  const sy=(x,y)=>x.scl.addEventListener('scroll',()=>{if(y.scl.scrollLeft!==x.scl.scrollLeft)y.scl.scrollLeft=x.scl.scrollLeft});sy(c1,c2);sy(c2,c1)}}

function panel(w,k){panel0(w,k);dayBlock(w,k);if(k==='act'){const bx=$('#dp-'+w);if(bx)bx.insertAdjacentHTML('beforeend',ageHtml(w))}}
let DAYSRC=null;
function dayBlock(w,k){const box=$('#dp-'+w);if(!box||k==='body')return;const di=S.day,dl=dfmt(dAt(di),{weekday:'long',day:'numeric',month:'long'}),T={sleep:'Schlafphasen in der Nacht zu '+dl,rec:'Body Battery am '+dl,act:'Schritte am '+dl,str:'Stress am '+dl}[k];
 box.insertAdjacentHTML(k==='act'?'afterbegin':'beforeend',`<div class="dday"><b>${T}</b><div class="chartbox" id="dd-${w}" style="margin-top:8px"></div><div class="muted sm" id="ddn-${w}" style="margin-top:6px"></div></div>`);
 const b=$('#dd-'+w,box),n=$('#ddn-'+w,box),d=DAILY[w][di],now=di===ND;
 if(k==='sleep'&&DAYSRC){const P=sleepParts(d);b.innerHTML=stackBar(P)+legendRow(P,hmm)+scoreScale(d.sleep)+sleeptHtml(w,di)+bedrecHtml(w,di)+sleepxHtml(w,di)+miniNights(w,di);n.textContent='Garmin liefert nur die Summen der Schlafphasen, nicht ihren Verlauf in der Nacht.';return}
 if(k==='sleep'){hypno(b,w,di);b.insertAdjacentHTML('beforeend',scoreScale(d.sleep)+sleeptHtml(w,di)+bedrecHtml(w,di)+sleepxHtml(w,di)+miniNights(w,di));n.textContent='Atemfrequenz und Sauerstoffsättigung liefert die Uhr noch nicht. Sobald Werte ankommen, erscheinen sie hier über den Schlafphasen. Fahre über die Balken für Zeit und Dauer.';return}
 const kind={rec:'bb',act:'steps',str:'stress'}[k];
 const paint=R=>{if(!b.isConnected)return;const c=R?R[kind]:dayCurve(w,di,kind),dense=k==='rec'&&R&&(R.bbd||R.hrd||R.hrvd),has=c&&c.some(x=>x!=null);if(!has&&!dense){const dd=b.closest('.dday');if(dd){const x=k==='str'?stressExtraHtml(w,di):k==='act'?weekGoalHtml(w,di):'';if(x)dd.insertAdjacentHTML('beforebegin',x);dd.remove()}return}
  if(k==='rec'){const bd=R?R.bbd:denseDemo(w,di,'bb'),hd=R?R.hrd:denseDemo(w,di,'hr');
   if(bd){denseChart(b,bd,{c:'var(--c-heart)',lo:0,hi:100,fmt:v=>f0(v)+' %',aria:'Body Battery im Tagesverlauf'});n.textContent=(R?'Alle paar Minuten ein Wert von der Uhr. ':'Beispielkurve. ')+denseSummary(bd,' %')+(now&&ok(d.bb)?' Bis jetzt: '+d.bb+' %.':'')}
   else if(has){dayChart(b,c,{c:'var(--c-heart)',lo:0,hi:100,fmt:v=>f0(v)+' %',aria:'Body Battery im Tagesverlauf'});n.textContent='Body Battery lädt im Schlaf und entlädt sich durch Stress und Training.'+(now&&ok(d.bb)?' Bis jetzt: '+d.bb+' %.':'')}
   else{const dd=b.closest('.dday');if(dd)dd.remove()}
   if(hd){if(!$('#ddh-'+w,box)){box.insertAdjacentHTML('beforeend',`<div class="dday"><b>Puls am ${dl}</b><div class="chartbox" id="ddh-${w}" style="margin-top:8px"></div><div class="muted sm" id="ddhn-${w}" style="margin-top:6px"></div></div>`);
     denseChart($('#ddh-'+w,box),hd,{c:'var(--c-heart)',lo:40,hi:Math.max(100,Math.ceil(Math.max(...hd.map(p=>p[1]))/20)*20),fmt:v=>f0(v)+' bpm',aria:'Puls im Tagesverlauf',ref:[{v:d.rhr,n:'Ruhepuls '+f0(d.rhr)}]});
     $('#ddhn-'+w,box).textContent=(R?'Alle paar Minuten ein Wert von der Uhr. ':'Beispielkurve. ')+denseSummary(hd,' bpm')}}
    const vd=R?R.hrvd:hrvDemo(w,di);if(vd&&vd.length>=4&&!$('#ddv-'+w,box)){box.insertAdjacentHTML('beforeend',hrvChartHtml(w,di,dl));hrvPaint(box,w,di,vd,!!R)}}
  else if(k==='act'){const v=c.map(x=>x||0),sum=v.reduce((x,y)=>x+y,0),mx=Math.max(...v),hi=Math.max(500,Math.ceil(mx/500)*500),top=v.indexOf(mx);dayChart(b,c,{c:'var(--c-act)',lo:0,hi,bars:true,solid:true,fmt:x=>f0(x)+' Schritte',aria:'Schritte im Tagesverlauf'});n.textContent=`Schritte pro Stunde. Summe ${f0(sum)}${now?' bis jetzt':''}, Ziel ${f0(d.goal)}.${mx>0?` Aktivste Stunde: ${top} bis ${top+1} Uhr mit ${f0(mx)} Schritten.`:''}`;n.insertAdjacentHTML('beforebegin',weekGoalHtml(w,di))}
  else{dayChart(b,c,{c:'var(--c-str)',lo:0,hi:100,bars:true,fmt:x=>f0(x)+' Stresslevel',aria:'Stress im Tagesverlauf'});n.textContent='Garmin-Stresslevel pro Stunde. Training zählt als Aktivitätsstress.';n.insertAdjacentHTML('beforebegin',stressExtraHtml(w,di))}};
 if(DAYSRC){b.innerHTML='<div class="muted sm">Lade Tagesverlauf…</div>';DAYSRC(w,di).then(paint,e=>{console.log('DAYERR',e&&e.message);paint({})})}else paint(null)}
/* ---------- Touren ---------- */
const MON=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
function dayPreset(){return S.range?null:S.preset==='today'?[TODAY.getTime(),TODAY.getTime()+D]:S.preset==='yest'?[TODAY.getTime()-D,TODAY.getTime()]:null}
function filtered(){const ps=persons(),dp=dayPreset(),lo=dp?new Date(dp[0]):S.range?S.range[0]:S.preset==='all'?new Date(0):new Date(TODAY.getTime()-((+S.preset||30)-1)*D),hi=dp?new Date(dp[1]):S.range?S.range[1]:new Date(TODAY.getTime()+D);return ACTS.filter(a=>ps.includes(a.who)&&(!S.sports.size||S.sports.has(a.sport))&&a.date>=lo&&a.date<hi)}
let MV={x:0,y:0,z:5},mapCv,mctx,mW=0,mH=0,tween=null,raf=0;
/* Touren-Fenster (Bottom-Sheet, Handy) */
const MQ_M='(max-width:640px)',DET_PX={s:150,m:.46,l:.88};
function insetPx(){const t=$('#tsheet'),mb=$('#mapbox');if(!t||!mb||!matchMedia(MQ_M).matches)return 0;const d=t.dataset.d,th=($('.top')||{}).offsetHeight||0,tgt=d==='s'?DET_PX.s:d==='l'?innerHeight-th-8:DET_PX[d]*innerHeight;return Math.max(0,Math.round(tgt-(innerHeight-mb.getBoundingClientRect().bottom)))}
const isM=()=>matchMedia(MQ_M).matches;
function fpills(){const a=$('#fps'),b=$('#fpd');if(!a||!b)return;const n=S.sports.size,pn={today:'Heute',yest:'Gestern',7:'7 Tage',30:'30 Tage',90:'90 Tage',all:'Alles'};
 a.innerHTML=(n===1?ic([...S.sports][0],16):'')+'<span>'+(n===0?'Alle Sportarten':n===1?SP[[...S.sports][0]].n:n+' Sportarten')+'</span>'+ic('next',14);
 b.innerHTML='<span>'+(S.range?dfmt(S.range[0],{day:'numeric',month:'numeric'})+(S.range[1]-S.range[0]>D?' bis '+dfmt(new Date(S.range[1]-D),{day:'numeric',month:'numeric'}):''):pn[S.preset]||'30 Tage')+'</span>'+ic('next',14)}
function fpopClose(){const p=$('#fpop');if(p)p.hidden=true;$$('.fpill').forEach(x=>x.setAttribute('aria-expanded','false'))}
function wireFilterBar(){fpills();const p=$('#fpop');if(!p)return;
 $$('.fpill').forEach(b=>b.onclick=()=>{closePick();const open=!p.hidden&&p.dataset.sec===b.dataset.sec;fpopClose();if(open)return;p.dataset.sec=b.dataset.sec;p.hidden=false;b.setAttribute('aria-expanded','true')});
 $('#mapbox').addEventListener('pointerdown',e=>{if(!e.target.closest('.fpill,.fpop'))fpopClose()});
 $('#tclose').onclick=deselect}
function deselect(){S.sel=null;S.cursor=null;if(S.pick){S.pick=null;const pk=$('#pick');if(pk)pk.remove()}$$('.row').forEach(r=>r.setAttribute('aria-current','false'));detail();drawMap();drawScrub();curlab();setDetent('s');fitList(filtered().filter(a=>a.gps),50)}
function layoutTour(){const m=matchMedia(MQ_M).matches,sw=$('.scrubwrap'),tsb=$('#tsb'),mc=$('.mapcol'),lh=$('.lhead'),fp=$('#fpop'),ls=$('.list');if(lh&&fp&&ls){if(m&&lh.parentNode!==fp)fp.appendChild(lh);else if(!m&&lh.parentNode!==ls)ls.insertBefore(lh,ls.firstChild)}if(!sw||!tsb||!mc)return;if(m&&sw.parentNode!==tsb)tsb.insertBefore(sw,tsb.firstChild);else if(!m&&sw.parentNode!==mc)mc.appendChild(sw)}
let sheetMQ=false;
function setDetent(d,refit){const t=$('#tsheet');if(!t)return;setTimeout(placePick,120);setTimeout(placePick,380);t.dataset.d=d;$('#grab').setAttribute('aria-expanded',String(d!=='s'));const mb=$('#mapbox');if(mb)mb.style.setProperty('--ins',insetPx()+'px');if(d!=='l'){const b=$('#tsb');if(b)b.scrollTop=0}if(d==='l')closePick();if(refit&&S.sel&&d!=='l'){const a=byId[S.sel];if(a&&a.gps)fitList([a],60)}}
function wireSheet(){const t=$('#tsheet'),g=$('#grab');if(!t||!g)return;
 if(!sheetMQ){sheetMQ=true;matchMedia(MQ_M).addEventListener('change',()=>{layoutTour();setDetent('m')})}
 const ord=['s','m','l'];let y0=null,moved=0;
 g.onpointerdown=e=>{y0=e.clientY;moved=0;g.setPointerCapture(e.pointerId);t.style.transition='none'};
 g.onpointermove=e=>{if(y0==null)return;const dy=e.clientY-y0;moved=Math.max(moved,Math.abs(dy));t.style.transform=`translateY(calc(100% - var(--vis) + ${dy}px))`};
 g.onpointerup=e=>{if(y0==null)return;const dy=e.clientY-y0;y0=null;t.style.transition='';t.style.transform='';const i=ord.indexOf(t.dataset.d);if(moved<6){setDetent(ord[(i+1)%3],true);return}if(dy<-40)setDetent(ord[Math.min(2,i+1)],true);else if(dy>40)setDetent(ord[Math.max(0,i-1)],true);else setDetent(t.dataset.d)};
 g.onpointercancel=()=>{y0=null;t.style.transition='';t.style.transform=''};
 g.onkeydown=e=>{const i=ord.indexOf(t.dataset.d);if(e.key==='ArrowUp'){e.preventDefault();setDetent(ord[Math.min(2,i+1)],true)}else if(e.key==='ArrowDown'){e.preventDefault();setDetent(ord[Math.max(0,i-1)],true)}else if(e.key==='Escape')setDetent('s')};
 g.onclick=e=>{if(e.detail===0)setDetent(ord[(ord.indexOf(t.dataset.d)+1)%3],true)};
 setDetent(t.dataset.d)}
function vTour(){
 const v=$('#view');
 v.innerHTML=`<div class="tour"><div class="mapcol"><div class="mapbox" id="mapbox"><div id="mlmap"></div><canvas id="map" aria-label="Karte mit Aktivitäten"></canvas>
 <div class="ov fb" id="fbar"><button class="fpill" id="fps" data-sec="sport" aria-expanded="false"></button><button class="fpill" id="fpd" data-sec="date" aria-expanded="false"></button></div><div class="fpop" id="fpop" hidden></div>
 <div class="ov tl" id="regions"></div><div class="ov tr"><button class="ib" id="zi" aria-label="Vergrößern">${ic('plus')}</button><button class="ib" id="zo" aria-label="Verkleinern">${ic('minus')}</button><button class="ib" id="zf" aria-label="Alles zeigen">${ic('fit')}</button></div>
 <div class="ov bl" id="legend"></div></div>
 <div class="scrubwrap"><div class="scrubrow"><button class="ib" id="pv" aria-label="Vorherige">${ic('prev')}</button><button class="ib" id="pp" aria-label="Abspielen">${ic('play')}</button><button class="ib" id="nx" aria-label="Nächste">${ic('next')}</button><div class="cur" id="curlab"></div></div><canvas id="scrub" aria-label="Zeitstrahl aller Aktivitäten"></canvas></div></div>
 <div class="tsheet" id="tsheet" data-d="m"><button class="grabber" id="grab" aria-label="Touren-Fenster: Höhe ändern" aria-expanded="true"><i></i></button><div class="tsb" id="tsb"><button class="ib tclose" id="tclose" aria-label="Tour abwählen">${ic('close')}</button>
 <div class="tsum" id="tsum"></div><div class="det" id="det"></div>
 <div class="list"><div class="lhead"><div class="chips" id="sports"></div><div class="range" id="rangebar"></div></div><div class="rows" id="rows"></div></div></div></div></div>`;
 mapCv=$('#map');mctx=mapCv.getContext('2d');
 const ro=new ResizeObserver(()=>{sizeMap();drawMap();drawScrub();if(S.sel)detail()});ro.observe($('#mapbox'));ro.observe($('#scrub'));
 wireMap();wireScrub();
 $('#sports').innerHTML=Object.entries(SP).map(([k,s])=>`<button class="chip" data-s="${k}" aria-pressed="${S.sports.has(k)}">${ic(k,16)}${s.n}</button>`).join('');
 $('#sports').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.sports.has(b.dataset.s)?S.sports.delete(b.dataset.s):S.sports.add(b.dataset.s);afterFilter()};
 $('#pv').onclick=()=>step(-1);$('#nx').onclick=()=>step(1);$('#pp').onclick=togglePlay;
 $('#zi').onclick=()=>zoomBy(1);$('#zo').onclick=()=>zoomBy(-1);$('#zf').onclick=()=>{fitList(filtered().filter(a=>a.gps),40)};
 const fl=filtered();if(!S.sel||!fl.find(a=>a.id===S.sel))S.sel=isM()?null:(fl.find(a=>a.gps)||fl[0]||{}).id||null;
 $('#tsheet').dataset.d=isM()&&!S.sel?'s':'m';
 if(isM())scrollTo(0,0);layoutTour();wireSheet();wireFilterBar();sizeMap();buildRows();rangebar();legend();regions();
 if(S.sel){const a=byId[S.sel];if(a.gps)fitList([a],60,true);detail()}else fitList(fl.filter(a=>a.gps),40,true);
 drawMap();drawScrub();curlab()}
function afterFilter(){closePick();const fl=filtered();if(!fl.find(a=>a.id===S.sel))S.sel=isM()?null:(fl.find(a=>a.gps)||fl[0]||{}).id||null;$$('#sports button').forEach(b=>b.setAttribute('aria-pressed',S.sports.has(b.dataset.s)));buildRows();rangebar();regions();detail();drawMap();drawScrub();curlab();const a=S.sel&&byId[S.sel];fitList(a&&a.gps?[a]:fl.filter(x=>x.gps),50)}
const isoD=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function rangebar(){const b=$('#rangebar'),fl=filtered(),g=fl.filter(a=>a.gps),km=g.reduce((s,a)=>s+a.st.dist/1000,0),hh=fl.reduce((s,a)=>s+a.st.dur/3600,0),up=g.reduce((s,a)=>s+a.st.gain,0);
 b.innerHTML=`<div class="seg" id="presets">${[['today','Heute'],['yest','Gestern'],['7','7 Tage'],['30','30 Tage'],['90','90 Tage'],['all','Alles']].map(([k,n])=>`<button data-p="${k}" aria-pressed="${!S.range&&S.preset===k}">${n}</button>`).join('')}</div>`+`<label class="dl2">Von <input type="date" id="tf" min="${iso(0)}" max="${iso(ND)}" value="${isoD(new Date(axis()[0]))}"></label><label class="dl2">Bis <input type="date" id="tt" min="${iso(0)}" max="${iso(ND)}" value="${isoD(new Date(axis()[1]-D))}"></label>`+(S.range?`<button class="chip" id="clr">${dfmt(S.range[0],{day:'numeric',month:'numeric'})}${S.range[1]-S.range[0]>D?' bis '+dfmt(new Date(S.range[1]-D),{day:'numeric',month:'numeric'}):''} ${ic('x',14)}</button>`:'')+`<div class="kv sumkv"><div><b>${fl.length}</b><span>Aktivitäten</span></div><div><b>${f0(km)} km</b><span>Distanz</span></div><div><b>${f0(hh)} h</b><span>Zeit</span></div><div><b>${f0(up)} m</b><span>Aufstieg</span></div></div>`;
 {const ts=$('#tsum');if(ts)ts.innerHTML=`<b>${fl.length} ${fl.length===1?'Tour':'Touren'}</b> <span class="muted">· ${f0(km)} km · ${f0(hh)} h</span>`}fpills();
 $('#presets').onclick=e=>{const x=e.target.closest('button');if(!x)return;S.preset=x.dataset.p;S.range=null;afterFilter()};const tf=$('#tf'),tt=$('#tt'),dch=()=>{if(!tf.value||!tt.value)return;const q=v=>{const [y,m,d]=v.split('-').map(Number);return new Date(y,m-1,d)};let a=q(tf.value),b=q(tt.value);if(b<a)[a,b]=[b,a];if(b>TODAY)b=new Date(TODAY);if(a>b)a=new Date(b);S.range=[a,new Date(b.getTime()+D)];S.preset='custom';afterFilter()};tf.onchange=dch;tt.onchange=dch;const c=$('#clr');if(c)c.onclick=()=>{S.range=null;S.preset='30';afterFilter()}}
function legend(){$('#legend').innerHTML=persons().map(w=>`<span class="dot" style="background:var(${PERS[w].c});margin-right:4px"></span>${PERS[w].n}`).join(' &nbsp; ')+' &nbsp;·&nbsp; '+attrib()}
function regions(){const fl=filtered().filter(a=>a.gps),ks=[...new Set(fl.map(a=>a.place))];$('#regions').innerHTML=ks.map(k=>`<button class="chip" data-p="${k}">${PL[k].n}</button>`).join('');$('#regions').onclick=e=>{const b=e.target.closest('button');if(!b)return;fitList(fl.filter(a=>a.place===b.dataset.p),50)}}
function buildRows(){const fl=filtered();let cur='',h='';
 for(const a of fl){const m=a.date.getFullYear()+'-'+a.date.getMonth();if(m!==cur){cur=m;h+=`<div class="mh">${MON[a.date.getMonth()]} ${a.date.getFullYear()}</div>`}
  h+=`<button class="row" data-id="${a.id}" aria-current="${a.id===S.sel}"><span class="av" style="background:var(${PERS[a.who].c})">${ic(a.sport,18)}</span><span class="t"><b>${esc(ttl(a))}</b><span class="muted sm">${dfmt(a.date,{weekday:'short',day:'numeric',month:'numeric'})} · ${a.date.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}${S.who==='both'?' · '+PERS[a.who].n:''}${jointOf(a)?' · zu zweit':''}</span></span><span class="r">${a.gps?f1(a.st.dist/1000)+' km':hm(a.st.dur)}<div class="muted sm" style="font-weight:400">${a.gps?hm(a.st.dur):''}</div></span></button>`}
 $('#rows').innerHTML=h||'<div class="card muted">Keine Aktivitäten im Filter.</div>';
 $('#rows').onclick=e=>{const b=e.target.closest('.row');if(b){select(b.dataset.id,{fly:true});if(innerWidth<641){const dt=$('#det');dt&&dt.scrollIntoView({behavior:'smooth',block:'start'})}}}}
function select(id,o={}){fpopClose();const wasS=matchMedia(MQ_M).matches&&$('#tsheet')&&$('#tsheet').dataset.d==='s';if(matchMedia(MQ_M).matches&&$('#tsheet')&&$('#tsheet').dataset.d!=='m')setDetent('m');if(S.pick){S.pick=null;const pk=$('#pick');if(pk)pk.remove()}S.sel=id;S.cursor=null;$$('.row').forEach(r=>r.setAttribute('aria-current',r.dataset.id===id));const r=$(`.row[data-id="${id}"]`);if(r&&!o.noScroll){const box=$('#rows'),t=r.offsetTop-box.offsetTop;if(t<box.scrollTop||t+r.offsetHeight>box.scrollTop+box.clientHeight)box.scrollTo({top:t-box.clientHeight/2,behavior:o.fast?'auto':'smooth'})}
 const a=byId[id];if((o.fly||wasS)&&a.gps)fitList([a],60,o.fast);detail();drawMap();drawScrub();curlab()}
function curlab(){const a=byId[S.sel],ts=$('#tsheet');if(ts)ts.dataset.sel=a?'1':'0';$('#curlab').innerHTML=a?`<span class="dot" style="background:var(${PERS[a.who].c})"></span> ${esc(ttl(a))} <span class="muted sm" style="font-weight:400">· ${dfmt(a.date,{weekday:'short',day:'numeric',month:'long',year:'numeric'})}</span>`:'Keine Auswahl';$('#pp').innerHTML=ic(S.play?'pause':'play')}
function step(dir){const fl=filtered().slice().reverse(),i=fl.findIndex(a=>a.id===S.sel);if(!fl.length)return;const j=Math.max(0,Math.min(fl.length-1,i+dir));select(fl[j].id,{fly:true});return j!==i}
function togglePlay(){S.play=!S.play;clearInterval(playT);if(S.play){const fl=filtered();if(fl[0]&&S.sel===fl[0].id)select(fl[fl.length-1].id,{fly:true});playT=setInterval(()=>{if(!step(1)){S.play=false;clearInterval(playT);curlab()}},1500)}curlab()}
/* Karte */
function sizeMap(){const b=$('#mapbox');if(!b)return;mW=b.clientWidth;mH=b.clientHeight;mapCv.width=mW*dpr;mapCv.height=mH*dpr}
function fitList(list,pad,instant){if(!list.length)return;let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const a of list)for(let i=0;i<a.w.length;i+=3){const[x,y]=a.w[i];x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
 const z=Math.max(3,Math.min(list.length===1?15.2:13,Math.log2(Math.min((mW-2*pad)/((x1-x0)||1e-6),(Math.max(120,mH-insetPx()-topIns())-2*pad)/((y1-y0)||1e-6)))));go({x:(x0+x1)/2,y:(y0+y1)/2+(insetPx()-topIns())/2/2**z,z},instant)}
const topIns=()=>matchMedia(MQ_M).matches?56:0;
function go(t,instant){cancelAnimationFrame(tween&&tween.id);if(instant||matchMedia('(prefers-reduced-motion:reduce)').matches){MV=t;drawMap();return}
 const f=Object.assign({},MV),t0=performance.now(),ms=520;const tick=now=>{let k=Math.min(1,(now-t0)/ms);k=1-Math.pow(1-k,3);MV={x:f.x+(t.x-f.x)*k,y:f.y+(t.y-f.y)*k,z:f.z+(t.z-f.z)*k};drawMap();if(k<1)tween.id=requestAnimationFrame(tick)};tween={id:requestAnimationFrame(tick)}}
function zoomBy(d){go({x:MV.x,y:MV.y,z:Math.max(3,Math.min(17,MV.z+d))})}
const sx=x=>(x-MV.x)*2**MV.z+mW/2,sy=y=>(y-MV.y)*2**MV.z+mH/2;
const inv=(px,py)=>[(px-mW/2)/2**MV.z+MV.x,(py-mH/2)/2**MV.z+MV.y];
function latlon(x,y){const lon=x/256*360-180,n=Math.PI-2*Math.PI*y/256;return[180/Math.PI*Math.atan(Math.sinh(n)),lon]}
function clusters(){const m={};for(const a of filtered())if(a.gps){const k=a.place;(m[k]=m[k]||{k,n:{p1:0,p2:0},p:W0(PL[k].lat,PL[k].lon)}).n[a.who]++}return Object.values(m)}
function drawMap(){if(!mctx||!mW)return;const c=mctx;c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle=css('--field');c.clearRect(0,0,mW,mH);drawBase(c);
 /* Raster */
 const[a0,b0]=inv(0,0),[a1,b1]=inv(mW,mH),[la0,lo0]=latlon(a0,b0),[la1,lo1]=latlon(a1,b1);
 const degPx=360/(256*2**MV.z),steps=[.0005,.001,.002,.005,.01,.02,.05,.1,.2,.5,1,2,5,10,20],st=steps.find(s=>s/degPx>=90)||20;
 c.strokeStyle=TILES?'rgba(0,0,0,0)':css('--grid');c.lineWidth=1;c.fillStyle=css('--text2');c.font='10px -apple-system,system-ui,sans-serif';c.beginPath();
 for(let lo=Math.ceil(lo0/st)*st;lo<=lo1;lo+=st){const x=Math.round(sx((lo+180)/360*256))+.5;c.moveTo(x,0);c.lineTo(x,mH)}
 for(let la=Math.ceil(la1/st)*st;la<=la0;la+=st){const y=Math.round(sy(W0(la,0)[1]))+.5;c.moveTo(0,y);c.lineTo(mW,y)}c.stroke();
 const fl=filtered().filter(a=>a.gps),sel=byId[S.sel];
 if(MV.z<8.3){ // gebündelt
  for(const cl of clusters()){const x=sx(cl.p[0]),y=sy(cl.p[1]),tot=cl.n.p1+cl.n.p2;if(x<-40||x>mW+40||y<-40||y>mH+40)continue;const R=16+Math.min(14,tot/3);
   if(cl.n.p1&&cl.n.p2){const fr=cl.n.p1/tot;c.fillStyle=col('p1');c.beginPath();c.moveTo(x,y);c.arc(x,y,R,-Math.PI/2,-Math.PI/2+2*Math.PI*fr);c.fill();c.fillStyle=col('p2');c.beginPath();c.moveTo(x,y);c.arc(x,y,R,-Math.PI/2+2*Math.PI*fr,3*Math.PI/2);c.fill();c.fillStyle=css('--surface');c.beginPath();c.arc(x,y,R-5,0,7);c.fill()}
   else{c.fillStyle=col(cl.n.p1?'p1':'p2');c.beginPath();c.arc(x,y,R,0,7);c.fill();c.fillStyle='#fff'}
   c.font='600 13px -apple-system,system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';if(cl.n.p1&&cl.n.p2)c.fillStyle=css('--text');c.fillText(tot,x,y+.5);
   c.fillStyle=css('--text');c.font='600 11px -apple-system,system-ui,sans-serif';c.fillText(PL[cl.k].n,x,y+R+11)}}
 else{
  c.lineJoin='round';c.lineCap='round';
  const tm=fl.map(a=>a.date.getTime()),t0=Math.min(...tm),tsp=(Math.max(...tm)-t0)||1,cand=new Set((S.pick||[]).map(a=>a.id));
  for(const a of fl.slice().sort((x,y)=>x.date-y.date)){if(a.id===S.sel)continue;const k=(a.date.getTime()-t0)/tsp;path(c,a);c.strokeStyle=col(a.who);c.globalAlpha=cand.has(a.id)?.9:.1+.5*k;c.lineWidth=cand.has(a.id)?3.5:1.5+.8*k;c.stroke()}c.globalAlpha=1}
 if(sel&&sel.gps){path(c,sel);c.strokeStyle=css('--surface');c.lineWidth=8;c.stroke();c.strokeStyle=col(sel.who);c.lineWidth=4.5;c.stroke();const pj=jointOf(sel);if(pj&&pj.gps){path(c,pj);c.setLineDash([9,6]);c.strokeStyle=col(pj.who);c.lineWidth=3;c.stroke();c.setLineDash([])}
  const w=sel.w,n=w.length-1;ringAt(c,w[0],col(sel.who),6);dotAt(c,w[n],col(sel.who),7,true);if(sel.live)livePulse(c,w[n],col(sel.who));
  if(MV.z>=11){const every=MV.z>=13?1:5;c.font='600 10px -apple-system,system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';for(let k=every;k*1000<sel.st.dist;k+=every){const i=kmIndex(sel,k*1000);if(i<0)break;const x=sx(w[i][0]),y=sy(w[i][1]);c.fillStyle=css('--surface');c.beginPath();c.arc(x,y,9,0,7);c.fill();c.strokeStyle=col(sel.who);c.lineWidth=1.5;c.stroke();c.fillStyle=css('--text');c.fillText(k,x,y+.5)}}
  if(S.cursor!=null){const ci=sel.tr&&sel.tr.wi?sel.tr.wi[S.cursor]:S.cursor,w2=(sel.wc||sel.w)[ci];if(w2)dotAt(c,w2,css('--text'),7,true)}}}
function path(c,a){c.beginPath();const s=MV.z<10?4:MV.z<12?2:1;for(let i=0;i<a.w.length;i+=s){const x=sx(a.w[i][0]),y=sy(a.w[i][1]);i?c.lineTo(x,y):c.moveTo(x,y)}const l=a.w[a.w.length-1];c.lineTo(sx(l[0]),sy(l[1]))}
function ringAt(c,p,color,r){const x=sx(p[0]),y=sy(p[1]);c.fillStyle=css('--surface');c.beginPath();c.arc(x,y,r+2,0,7);c.fill();c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.arc(x,y,r-1,0,7);c.stroke()}
let liveRaf=0;
function livePulse(c,p,color){if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;const x=sx(p[0]),y=sy(p[1]),k=(performance.now()%1600)/1600;c.save();c.globalAlpha=.55*(1-k);c.strokeStyle=color;c.lineWidth=2.5;c.beginPath();c.arc(x,y,10+16*k,0,7);c.stroke();c.restore();
 if(!liveRaf)liveRaf=requestAnimationFrame(()=>{liveRaf=0;const a=byId[S.sel];if(S.tab==='tour'&&a&&a.live)drawMap()})}
function dotAt(c,p,color,r,ring){const x=sx(p[0]),y=sy(p[1]);c.fillStyle=ring?css('--surface'):color;c.beginPath();c.arc(x,y,r+(ring?3:2),0,7);c.fill();c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,7);c.fill()}
function wireMap(){const cv=mapCv,P=new Map();let moved=0,pd=0;
 cv.onpointerdown=e=>{cv.setPointerCapture(e.pointerId);P.set(e.pointerId,[e.clientX,e.clientY]);moved=0;pd=[...P.values()].length===2?dist2():0;cancelAnimationFrame(tween&&tween.id)};
 const dist2=()=>{const[a,b]=[...P.values()];return Math.hypot(a[0]-b[0],a[1]-b[1])||1};
 cv.onpointermove=e=>{if(!P.has(e.pointerId))return;const o=P.get(e.pointerId);const dx=e.clientX-o[0],dy=e.clientY-o[1];P.set(e.pointerId,[e.clientX,e.clientY]);moved+=Math.abs(dx)+Math.abs(dy);
  if(P.size===2){const nd=dist2();if(pd){const r=cv.getBoundingClientRect(),[a,b]=[...P.values()],mx=(a[0]+b[0])/2-r.left,my=(a[1]+b[1])/2-r.top;zoomAt(mx,my,Math.log2(nd/pd));}pd=nd}
  else{MV.x-=dx/2**MV.z;MV.y-=dy/2**MV.z;drawMap()}};
 const up=e=>{const had=P.has(e.pointerId);P.delete(e.pointerId);pd=0;if(had&&P.size===0&&moved<6)click(e)};
 cv.onpointerup=up;cv.onpointercancel=e=>{P.delete(e.pointerId)};
 cv.onwheel=e=>{e.preventDefault();const r=cv.getBoundingClientRect();zoomAt(e.clientX-r.left,e.clientY-r.top,-e.deltaY*.0022)};
 cv.ondblclick=e=>{const r=cv.getBoundingClientRect();zoomAt(e.clientX-r.left,e.clientY-r.top,1)}}
function zoomAt(px,py,d){const[wx,wy]=inv(px,py),z=Math.max(3,Math.min(17,MV.z+d));MV.z=z;MV.x=wx-(px-mW/2)/2**z;MV.y=wy-(py-mH/2)/2**z;drawMap()}
function click(e){const r=mapCv.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
 if(MV.z<8.3){for(const cl of clusters()){if(Math.hypot(sx(cl.p[0])-px,sy(cl.p[1])-py)<34){fitList(filtered().filter(a=>a.gps&&a.place===cl.k),50);return}}return}
 const hit=[];for(const a of filtered()){if(!a.gps)continue;let m=1e9;for(let i=0;i<a.w.length;i+=2){const d=Math.hypot(sx(a.w[i][0])-px,sy(a.w[i][1])-py);if(d<m)m=d}if(m<16)hit.push([m,a])}
 hit.sort((x,y)=>y[1].date-x[1].date);
 if(hit.length>1){S.pick=hit.map(h=>h[1]);pickSheet();drawMap();return}
 closePick();if(hit.length)select(hit[0][1].id,{fly:false})}
function placePick(){const el=$('#pick'),mb=$('#mapbox'),t=$('#tsheet');if(!el||!mb)return;if(matchMedia(MQ_M).matches&&t){const mr=mb.getBoundingClientRect(),tr=t.getBoundingClientRect();el.style.bottom=Math.max(8,Math.round(mr.bottom-tr.top+8))+'px';el.style.maxHeight=Math.max(120,Math.round(tr.top-mr.top-16))+'px'}else{el.style.bottom='';el.style.maxHeight=''}}
function closePick(){const el=$('#pick');if(el)el.remove();if(S.pick){S.pick=null;drawMap()}}
function pickSheet(){let el=$('#pick');if(!el){el=document.createElement('div');el.id='pick';el.className='pick';$('#mapbox').appendChild(el)}
 el.innerHTML=`<div class="pickh"><b>${S.pick.length} Touren hier</b><button class="ib" id="pickx" aria-label="Schließen">${ic('close')}</button></div><div class="pickl">${S.pick.map(a=>`<button class="row" data-pid="${a.id}" aria-current="${a.id===S.sel}"><span class="av" style="background:var(${PERS[a.who].c})">${ic(a.sport,18)}</span><span class="t"><b>${esc(ttl(a))}</b><span class="muted sm">${dfmt(a.date,{weekday:'short',day:'numeric',month:'numeric',year:'2-digit'})}${S.who==='both'?' · '+PERS[a.who].n:''}</span></span><span class="r">${f1(a.st.dist/1000)} km<div class="muted sm" style="font-weight:400">${hm(a.st.dur)}</div></span></button>`).join('')}</div>`;
 el.onpointerdown=e=>e.stopPropagation();el.onwheel=e=>e.stopPropagation();$('#pickx').onclick=closePick;
 $$('[data-pid]',el).forEach(b=>{b.onclick=()=>{const id=b.dataset.pid;S.pick=null;el.remove();select(id,{fly:false});drawMap()};b.onmouseenter=()=>{};});
 if(matchMedia(MQ_M).matches&&$('#tsheet')&&$('#tsheet').dataset.d!=='s')setDetent('s');placePick();setTimeout(placePick,120);setTimeout(placePick,380)}

/* Zeitstrahl */
function axis(){const dp=dayPreset();if(dp)return dp;return[S.range?S.range[0].getTime():S.preset==='all'?START.getTime():TODAY.getTime()-(+S.preset||30)*D,S.range?S.range[1].getTime():TODAY.getTime()+D]}
function drawScrub(){const cv=$('#scrub');if(!cv)return;const w=cv.clientWidth,h=68;cv.width=w*dpr;cv.height=h*dpr;const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
 const[T0,T1]=axis(),X=t=>(t-T0)/(T1-T0)*w,span=(T1-T0)/D;
 c.font='11px -apple-system,system-ui,sans-serif';c.fillStyle=css('--text2');c.textAlign='left';c.strokeStyle=css('--grid');
 if(span>120){for(let m=0;m<12;m++){const x=X(new Date(TODAY.getFullYear(),m,1).getTime());c.beginPath();c.moveTo(x+.5,0);c.lineTo(x+.5,h-16);c.stroke();c.fillText(MON[m].slice(0,3),x+3,h-3)}}
 else{const st=span>14?7:1;for(let t=T0;t<T1;t+=st*D){const x=X(t);c.beginPath();c.moveTo(x+.5,0);c.lineTo(x+.5,h-16);c.stroke();c.fillText(dfmt(new Date(t),{day:'numeric',month:'numeric'}),x+3,h-3)}}
 const fl=filtered(),base=h-17;
 for(const a of fl){const x=X(a.date.getTime()),hh=Math.max(7,Math.min(base-6,(a.gps?a.st.dist/1000:12)*1.1)),sel=a.id===S.sel,bw=span<=40?4:2;c.fillStyle=col(a.who);c.globalAlpha=sel?1:.7;c.fillRect(x-(sel?bw/2+1:bw/2),base-hh,sel?bw+2:bw,hh)}c.globalAlpha=1;
 const a=byId[S.sel];if(a&&a.date.getTime()>=T0&&a.date.getTime()<T1){const x=X(a.date.getTime());c.strokeStyle=css('--text');c.lineWidth=1.5;c.beginPath();c.moveTo(x,0);c.lineTo(x,base);c.stroke();c.fillStyle=css('--text');c.beginPath();c.arc(x,3,4,0,7);c.fill()}}
function wireScrub(){const cv=$('#scrub');let down=false;const pick=e=>{const[T0,T1]=axis(),r=cv.getBoundingClientRect(),t=T0+(e.clientX-r.left)/r.width*(T1-T0);const fl=filtered();if(!fl.length)return;let b=fl[0],bd=1e18;for(const a of fl){const d=Math.abs(a.date.getTime()-t);if(d<bd){bd=d;b=a}}if(b.id!==S.sel)select(b.id,{fly:true,fast:true})};
 cv.onpointerdown=e=>{down=true;cv.setPointerCapture(e.pointerId);S.play=false;clearInterval(playT);pick(e)};cv.onpointermove=e=>{if(down)pick(e)};cv.onpointerup=()=>{down=false}}
/* Kennzahlen einer Tour: fehlende Werte als Strich, nie als 0 (wie in der inReach-App) */
function eleStats(a){const e=a.tr&&a.tr.ele;if(!e||e.length<2)return null;let l=0,ref=e[0];for(const h of e){if(h-ref>=3)ref=h;else if(ref-h>=3){l+=ref-h;ref=h}}return{loss:Math.round(l),min:Math.min(...e),max:Math.max(...e)}}
const has=v=>v!=null&&isFinite(v)&&v>0;
function tourKv(a,s,pace,avgTxt){const es=eleStats(a),k=[],add=(v,l)=>k.push(`<div><b>${v}</b><span>${l}</span></div>`);
 if(a.gps||has(s.dist))add(f1(s.dist/1000)+'\u00a0km','Distanz');add(hm(s.dur),'Zeit');
 if(a.gps||has(s.avgV))add(avgTxt,pace?'Ø Pace':'Ø Tempo');
 if(a.gps||es){if(es)add(f0(s.gain)+'\u00a0/\u00a0'+f0(es.loss)+'\u00a0m','Anstieg / Abstieg');else if(has(s.gain))add(f0(s.gain)+'\u00a0m','Aufstieg');if(es)add(f0(es.min)+'\u00a0/\u00a0'+f0(es.max)+'\u00a0m','Höhe min / max')}
 if(has(s.avgHR)&&has(s.maxHR))add(f0(s.avgHR)+'\u00a0/\u00a0'+f0(s.maxHR)+'\u00a0bpm','Puls Ø / max');else if(has(s.avgHR))add(f0(s.avgHR)+'\u00a0bpm','Ø Puls');else if(has(s.maxHR))add(f0(s.maxHR)+'\u00a0bpm','Max. Puls');
 if(!a.live){add(f0(s.kcal),'kcal');add(s.load,'Trainingslast')}
 return k.join('')}
/* Details */
function detail(){const box=$('#det');if(!box)return;const a=byId[S.sel];if(!a){box.innerHTML='';return}
 if(needTr(a))loadTr(a).then(ok=>{if(ok&&S.sel===a.id&&S.tab==='tour'&&!SH){const el=$('#det');if(el){if(a.gps)fitList([a],60,true);detail();drawMap()}}});
 const s=a.st,sp=SP[a.sport],pace=a.sport==='run'||a.sport==='hike';
 const avgPace=sec=>pc(sec);
 const avgTxt=(a.gps||has(s.avgV))?(!has(s.avgV)?'–':pace?avgPace(3600/s.avgV)+' /km':f1(s.avgV)+' km/h'):'';
 box.innerHTML=`<div class="card"><div class="dh"><span class="pill" style="--pc:var(${PERS[a.who].c})">${PERS[a.who].n}</span><h3>${a.live?'<span class="ldot" title="Live"></span>':''}${esc(ttl(a))}</h3><span class="muted sm">${sp.n} · ${dfmt(a.date,{weekday:'long',day:'numeric',month:'long'})}, ${a.date.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</span></div>${a.sname?`<div class="muted sm" style="margin:-6px 0 12px"><span class="chip" style="min-height:24px;padding:0 9px;font-size:12px">Titel von Strava</span> Garmin-Name: ${esc(a.name)}</div>`:''}
 <div class="kv kvt" style="margin-bottom:14px">${tourKv(a,s,pace,avgTxt)}${a.sx?`<div><b>${a.sx.ach}</b><span>Strava-Erfolge</span></div><div><b>${a.sx.pr}</b><span>Bestzeiten (PR)</span></div>${a.sx.pow?`<div><b>${a.sx.pow} W</b><span>Ø Leistung</span></div>`:''}${a.sx.cad?`<div><b>${a.sx.cad} spm</b><span>Ø Kadenz</span></div>`:''}${a.sx.gear?`<div class="kvl"><b>${esc(a.sx.gear)}</b><span>Fahrrad</span></div>`:''}<div class="kvl"><b>${esc(a.sx.dev)}</b><span>Gerät</span></div>`:''}</div><div id="dmore">
 ${teHtml(a)}${jointHtml(a)}${a.tr?`<div class="seg" id="dt" style="margin-bottom:10px">${[['profil','Profil'],['splits','Splits'],['zonen','Pulszonen']].filter(([k])=>!(k==='splits'&&a.tr.nod)).map(([k,n])=>`<button data-k="${k}" aria-pressed="${dtabOf(a)===k}">${n}</button>`).join('')}</div><div id="dbody"></div>`:`<div class="note">${a.live?'Höhenprofil, Tempo und Splits liefert das inReach-Add-on, sobald es angebunden ist.':a.gps?'Höhenprofil, Tempo und Splits kommen mit dem Archiv. Pulszonen gibt es schon.':'Keine GPS-Route bei dieser Aktivität. Pulszonen gibt es trotzdem.'}</div><div id="dbody" style="margin-top:10px"></div>`}
 </div></div>`;
 const dt=$('#dt');if(dt)dt.onclick=e=>{const b=e.target.closest('button');if(!b)return;S.dtab=b.dataset.k;$$('#dt button').forEach(x=>x.setAttribute('aria-pressed',x===b));dbody(a)};
 dbody(a)}
/* Welche Ansicht gilt: ohne Verlauf nur Pulszonen; ohne Distanz gibt es keine Splits */
const dtabOf=a=>!a.tr?'zonen':(S.dtab==='splits'&&a.tr.nod)?'profil':S.dtab;
/* Welche Kurve unter der Höhe läuft: Puls oder Tempo, je nachdem, was die Quelle liefert */
const dmetOf=a=>{const T=a.tr;if(!T)return S.dmet;if(S.dmet==='hr'&&T.nohr)return T.nov?null:'v';if(S.dmet==='v'&&T.nov)return T.nohr?null:'hr';return S.dmet};
const roHint=a=>a.w?'Fahre mit dem Finger oder der Maus über das Profil: der Punkt wandert auf der Karte mit. Tippen blendet das Tempo pro Kilometer ein oder aus.':a.tr&&a.tr.nod?'Fahre mit dem Finger oder der Maus über das Profil.':'Fahre mit dem Finger oder der Maus über das Profil. Tippen blendet das Tempo pro Kilometer ein oder aus.';
function zonesOf(a){const z=[0,0,0,0,0],T=a.tr;if(a.zones&&a.zones.some(x=>x>0))return a.zones.slice();if(!T||T.nohr)return z;for(let i=1;i<T.hr.length;i++){const h=T.hr[i],k=h<111?0:h<130?1:h<148?2:h<167?3:4;z[k]+=T.t[i]-T.t[i-1]}return z}
function dbody(a){const b=$('#dbody');if(!b)return;if(a.live&&!a.tr){b.innerHTML='';return}const k=dtabOf(a);
 if(k==='profil'){b.innerHTML=`<div class="chips" style="margin-bottom:6px">${[['hr','Puls'],['v','Tempo']].filter(([k2])=>!(k2==='hr'&&a.tr.nohr)&&!(k2==='v'&&a.tr.nov)).map(([k2,n])=>`<button class="chip" data-m="${k2}" aria-pressed="${dmetOf(a)===k2}">${n}</button>`).join('')}</div><div class="ro" id="ro">${roHint(a)}</div><div class="chartbox" id="pf"></div><div id="pacebox" class="chartbox"></div>`;
  $$('.chip',b).forEach(c=>c.onclick=()=>{S.dmet=c.dataset.m;dbody(a)});profile(a)}
 else if(k==='splits'){const T=a.tr,rows=[];let from=0,km=1;const pace=a.sport==='run'||a.sport==='hike';
  const mk=(i0,i1,k2)=>{const dd=T.d[i1]-T.d[i0],tt=T.t[i1]-T.t[i0];let g=0,l=0,hs=0;for(let i=i0+1;i<=i1;i++){if(T.ele){const de=T.ele[i]-T.ele[i-1];de>0?g+=de:l-=de}if(!T.nohr)hs+=T.hr[i]}return{k:k2,dd,tt,g,l,hr:hs/(i1-i0),v:dd/tt*3.6}};
  for(let i=1;i<T.d.length;i++)if(T.d[i]>=km*1000){rows.push(mk(from,i,km));from=i;km++}
  if(T.d[T.d.length-1]-T.d[from]>60)rows.push(mk(from,T.d.length-1,km));
  const vmax=Math.max(...rows.map(r=>r.v));
  b.innerHTML=`<div style="overflow-x:auto"><table class="tbl"><tr><th>km</th><th>${pace?'Pace':'Tempo'}</th><th></th>${T.ele?'<th>↑ m</th><th>↓ m</th>':''}${T.nohr?'':'<th>Puls</th>'}</tr>${rows.map(r=>`<tr><td>${r.dd<990?f1(r.dd/1000):r.k}</td><td>${pace?Math.floor(3600/r.v/60)+':'+String(Math.round(3600/r.v%60)).padStart(2,'0'):f1(r.v)}</td><td style="width:34%"><div class="bar"><i style="width:${r.v/vmax*100}%;background:var(${PERS[a.who].c})"></i></div></td>${T.ele?`<td>${f0(r.g)}</td><td>${f0(r.l)}</td>`:''}${T.nohr?'':`<td>${f0(r.hr)}</td>`}</tr>`).join('')}</table></div>`}
 else{const z=zonesOf(a),tot=z.reduce((x,y)=>x+y,0)||1;if(!z.some(v=>v>0)){b.innerHTML='<div class="muted">Keine Pulszonen von Garmin für diese Aktivität.</div>';return}const cs=['#8DA2B8','#4FA6A0','#7FB24A','#E0A21C','#D3322B'],nm=['Zone 1 Erholung','Zone 2 Grundlage','Zone 3 Tempo','Zone 4 Schwelle','Zone 5 Maximal'].map((t,i)=>t+znRange(a.who,i));
  const hard=(z[3]+z[4])/tot*100;
  b.innerHTML=`<div class="zones">${z.map((v,i)=>`<i style="width:${Math.max(.5,v/tot*100)}%;background:${cs[i]}" title="${nm[i]}"></i>`).join('')}</div><table class="tbl">${z.map((v,i)=>`<tr><td><span class="dot" style="background:${cs[i]};margin-right:8px"></span>${nm[i]}</td><td>${hm(v)}</td><td>${Math.round(v/tot*100)} %</td></tr>`).join('')}</table>
  <div class="note" style="margin-top:10px">${Math.round(hard)} % der Zeit in Zone 4 und 5.</div>${znNote(a.who)}`}}
function profile(a){const box=$('#pf');if(!box)return;const T=a.tr,W=box.clientWidth||600,m={l:40,r:8},n=T.t.length,tx=!!T.nod,xs=tx?T.t:T.d,D1=xs[n-1]||1;
 /* Höhe nur mit Höhenwerten, darunter Puls oder Tempo nur, wenn die Quelle sie liefert; x-Achse = Distanz, ohne Distanz die Zeit */
 const dm=dmetOf(a),arr=dm==='hr'?T.hr:dm==='v'?T.v.map(v=>v*3.6):null,hasE=!!T.ele,hasS=!!arr;
 const h1=hasE?110:0,h2=hasS?(hasE?84:110):0,gap=hasE&&hasS?14:0,H=h1+h2+gap+22;
 const X=i=>m.l+xs[i]/D1*(W-m.l-m.r);
 const c=col(a.who);let g='';
 let Ye=()=>0,emn=0,emx=0;
 if(hasE){emn=Math.min(...T.ele);emx=Math.max(...T.ele);const ep=(emx-emn)*.1||5;Ye=v=>6+(1-(v-(emn-ep))/((emx+ep)-(emn-ep)))*(h1-12);
  for(let k=0;k<=2;k++){const v=emn+(emx-emn)*k/2,y=Ye(v);g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y}" y2="${y}" stroke="var(--grid)"/><text x="${m.l-5}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--text2)">${f0(v)}</text>`}}
 let Yv=()=>0;
 if(hasS){const vmn=Math.min(...arr),vmx=Math.max(...arr),vp=(vmx-vmn)*.1||1,o2=h1+gap;Yv=v=>o2+6+(1-(v-(vmn-vp))/((vmx+vp)-(vmn-vp)))*(h2-12);
  for(let k=0;k<=2;k++){const v=vmn+(vmx-vmn)*k/2,y=Yv(v);g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y}" y2="${y}" stroke="var(--grid)"/><text x="${m.l-5}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--text2)">${(dm==='v'&&vmx-vmn<3?f1:f0)(v)}</text>`}}
 let xl='';
 if(tx){const mins=D1/60,st=[1,2,5,10,15,20,30,60,120].find(q=>mins/q<=6)||180;for(let k=0;k*st*60<=D1;k++){const x=m.l+k*st*60/D1*(W-m.l-m.r);xl+=`<text x="${x}" y="${H-4}" text-anchor="${!k?'start':k*st*60>D1*.96?'end':'middle'}" font-size="11" fill="var(--text2)">${k*st} min</text>`}}
 else{const kmStep=D1>30000?10:D1>12000?5:D1>5000?2:1;for(let k=0;k*1000<=D1;k+=kmStep){const x=m.l+k*1000/D1*(W-m.l-m.r);xl+=`<text x="${x}" y="${H-4}" text-anchor="middle" font-size="11" fill="var(--text2)">${k} km</text>`}}
 let paths='';
 if(hasE){const area=`M${X(0)},${h1} `+T.ele.map((e,i)=>`L${X(i).toFixed(1)},${Ye(e).toFixed(1)}`).join(' ')+` L${X(n-1)},${h1} Z`;
  paths+=`<path d="${area}" fill="${c}" fill-opacity=".18"/><path d="${area.replace(/ Z$/,'').replace(/^M[^L]*L/,'M')}" fill="none" stroke="${c}" stroke-width="1.8"/>`}
 if(hasS){const line=arr.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+','+Yv(v).toFixed(1)).join(' ');paths+=`<path d="${line}" fill="none" stroke="${c}" stroke-width="1.8"/>`}
 box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><text x="${m.l}" y="10" font-size="11" fill="var(--text2)" dy="-0"> </text>${g}${xl}${paths}<line id="cur" y1="0" y2="${H-18}" stroke="var(--text)" visibility="hidden"/></svg>`;
 const svg=$('svg',box),cur=$('#cur',box),ro=$('#ro');
 const mv=e=>{const r=svg.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W,dd=Math.max(0,Math.min(D1,(x-m.l)/(W-m.l-m.r)*D1));let lo=0,hi=n-1;while(lo<hi){const mid=lo+hi>>1;xs[mid]<dd?lo=mid+1:hi=mid}
  cur.setAttribute('x1',X(lo));cur.setAttribute('x2',X(lo));cur.setAttribute('visibility','visible');if(a.w){S.cursor=lo;drawMap()}
  const pace=a.sport==='run'||a.sport==='hike',sv=T.v[lo]*3.6,tt=Math.round(T.t[lo]),parts=[];
  parts.push(`<b>${tx?Math.floor(tt/60)+':'+String(tt%60).padStart(2,'0')+' min':f1(T.d[lo]/1000)+' km'}</b>`);
  if(T.ele)parts.push(f0(T.ele[lo])+' m');
  if(!T.nohr)parts.push(f0(T.hr[lo])+' bpm');
  if(!T.nov)parts.push(pace?pc(3600/sv)+' /km':f1(sv)+' km/h');
  ro.innerHTML=parts.join(' · ')};
 svg.onpointermove=mv;svg.onpointerdown=mv;const pbx=$('#pacebox'),showPace=()=>{pbx.innerHTML='';if(S.pace&&!tx)kmBars(pbx,a,W,m)};svg.onclick=()=>{if(tx)return;S.pace=!S.pace;showPace()};showPace();svg.onpointerleave=()=>{cur.setAttribute('visibility','hidden');if(a.w){S.cursor=null;drawMap()}ro.textContent=roHint(a)}}
/* ---------- Trends ---------- */
const MET={steps:{n:'Schritte',k:'steps',agg:'sum',u:''},dist:{n:'Distanz',k:'dist',agg:'sum',u:' km'},ascent:{n:'Aufstieg',k:'ascent',agg:'sum',u:' m'},dur:{n:'Dauer',k:'dur',agg:'sum',u:' h'},load:{n:'Trainingslast',k:'load',agg:'sum',u:''},rhr:{n:'Ruhepuls',k:'rhr',agg:'mean',u:' bpm'},hrv:{n:'HRV',k:'hrv',agg:'mean',u:' ms'},sleep:{n:'Schlafwert',k:'sleep',agg:'mean',u:''}};
const VIS={week:7,month:30,quarter:90,year:26};
function buckets(w,mk){const d=DAILY[w],M=MET[mk],idx=[];if(S.span==='year'){for(let s=0;s<=ND;s+=7)idx.push([s,Math.min(ND,s+6)])}else for(let i=0;i<=ND;i++)idx.push([i,i]);
 return idx.map(([a,b])=>{const sl=d.slice(a,b+1).map(x=>x[M.k]);return{a,b,v:M.agg==='sum'?sumA(sl):avgA(sl)}})}
/* nur mit 28 Tagen lückenloser Trainingslast, sonst null (Karte ausgeblendet) */
function acwr(w){const L=DAILY[w].slice(Math.max(0,ND-27),ND+1).map(d=>d.load);if(L.length<28||!L.every(ok))return null;const ac=sumA(L.slice(-7)),ch=sumA(L)/4;return ch?{ac,ch,r:ac/ch}:null}
const dl=(a,b)=>ok(a)&&ok(b)&&b?Math.round((a-b)/b*100):null;
function heat(w,W){const weeks=Math.max(8,Math.min(W<520?20:26,Math.floor((W-34)/13))),end=ND,endWd=(dAt(end).getDay()+6)%7,cell=Math.max(10,Math.min(28,Math.floor((W-34)/weeks)-3)),gap=3,H=7*(cell+gap)+18;
 let rects='',months='',lastM=-1;let c0=0;while(c0<weeks-1&&end-((weeks-1-c0)*7+(endWd-6))<0)c0++;
 for(let c=c0;c<weeks;c++){for(let r=0;r<7;r++){const idx=end-((weeks-1-c)*7+(endWd-r));if(idx>end||idx<0)continue;const dd=DAILY[w][idx],ld=dd.load,gap=!ok(ld),lv=gap||ld<=0?0:ld<25?1:ld<55?2:ld<100?3:4,pc=[0,26,48,74,100][lv],dt=dAt(idx),n=ACTS.filter(a=>a.who===w&&dayOf(a.date)===idx).length;
  rects+=`<rect x="${34+(c-c0)*(cell+gap)}" y="${18+r*(cell+gap)}" width="${cell}" height="${cell}" rx="3" fill="${lv?`color-mix(in srgb,var(${PERS[w].c}) ${pc}%,var(--emp))`:'var(--emp)'}" data-i="${idx}" data-n="${gap?0:n}" ${idx===S.day&&false?'':''}><title>${dfmt(dt,{weekday:'short',day:'numeric',month:'numeric'})}: ${gap?'keine Daten':n?n+' Aktivität'+(n>1?'en':'')+', Last '+f0(ld):'keine Aktivität'}</title></rect>`;
  if(r===0&&dt.getMonth()!==lastM){lastM=dt.getMonth();months+=`<text x="${34+(c-c0)*(cell+gap)}" y="11" font-size="11" fill="var(--text2)">${MON[lastM].slice(0,3)}</text>`}}}
 const wd=['Mo','Mi','Fr'].map((t,i)=>`<text x="0" y="${18+i*2*(cell+gap)+cell-2}" font-size="11" fill="var(--text2)">${t}</text>`).join('');
 return`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Aktivitätskalender ${PERS[w].n}">${months}${wd}${rects}</svg>`}
const iso=i=>{const d=dAt(i);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const RQ=[['w0','Diese Woche'],['w1','Letzte Woche'],['m0','Dieser Monat'],['m1','Letzter Monat'],['d30','Letzte 30 Tage'],['y0','Dieses Jahr']];
function rIdx(k){const wd=(dAt(ND).getDay()+6)%7,mon=ND-wd,m0=Math.max(0,dayOf(new Date(TODAY.getFullYear(),TODAY.getMonth(),1))),pm=Math.max(0,dayOf(new Date(TODAY.getFullYear(),TODAY.getMonth()-1,1)));return{w0:[mon,ND],w1:[mon-7,mon-1],m0:[m0,ND],m1:[pm,m0-1],d30:[ND-29,ND],y0:[0,ND]}[k]}
function rangeSum(w,a,b){const days=DAILY[w].slice(a,b+1),cov=days.some(d=>ok(d.dist)),as=ACTS.filter(x=>x.who===w&&!x.live&&dayOf(x.date)>=a&&dayOf(x.date)<=b&&ok((DAILY[w][dayOf(x.date)]||{}).dist)),av=f=>avgA(days.map(d=>d[f])),sm=f=>cov?as.reduce((s,x)=>s+(f(x)||0),0):null;
 /* Aktivitätssummen nur über Tage, die die Quelle abdeckt; sonst null */
 return{n:cov?as.length:null,dist:sm(x=>x.st.dist/1000),asc:sm(x=>x.st.gain),dur:sm(x=>x.st.dur/3600),load:sm(x=>x.st.load),steps:av('steps'),sleep:av('slp'),rhr:av('rhr'),hrv:av('hrv'),as}}
function rangeCard(){const box=$('#rcard');if(!box)return;const r=S.rng||(S.rng={key:'w0',a:rIdx('w0')[0],b:ND}),ps=persons();
 const KS=[null,'dist','ascent','dur','load','steps','slp','rhr','hrv'],KN={dist:'Distanz in km',ascent:'Aufstieg in m',dur:'Zeit in h',load:'Trainingslast',steps:'Schritte',slp:'Schlafdauer',rhr:'Ruhepuls in bpm',hrv:'HRV in ms'};
 const show=()=>{const L=r.b-r.a+1,pa=r.a-L,okp=pa>=0;
  const dtx=(c,p)=>{const x=pct(okp,c,p);return x?x+' gegen davor':''};
  box.innerHTML=`<h2 class="h2">Zeitraum auswerten</h2><div class="chips" id="rq">${RQ.map(([k,n])=>`<button class="chip" data-rq="${k}" aria-pressed="${r.key===k}">${n}</button>`).join('')}</div>
  <div class="rangein"><label>Von <input type="date" id="rf" min="${iso(0)}" max="${iso(ND)}" value="${iso(r.a)}"></label><label>Bis <input type="date" id="rt" min="${iso(0)}" max="${iso(ND)}" value="${iso(r.b)}"></label><span class="muted sm">${L} Tage${okp?', verglichen mit den '+L+' Tagen davor':''}</span></div>
  ${ps.length>1?pairTable(r.a,r.b,pa,okp):''}<div class="cols" style="margin-top:14px" ${ps.length>1?'data-pm="1"':''}>${ps.map(w=>{const c=rangeSum(w,r.a,r.b),p=okp?rangeSum(w,pa,r.a-1):null,P=k=>p?p[k]:null,best=c.as.filter(x=>x.gps).sort((x,y)=>y.st.dist-x.st.dist)[0],mx={};for(const x of c.as)mx[x.sport]=(mx[x.sport]||0)+x.st.dur/3600;const e=Object.entries(mx).sort((x,y)=>y[1]-x[1]),mh=Math.max(...e.map(x=>x[1]),1);
   const T=[[f0(c.n),'Aktivitäten',okp&&ok(c.n)&&ok(P('n'))?(c.n-P('n')>0?'+':'')+(c.n-P('n'))+' gegen davor':''],[uv(c.dist,' km'),'Distanz',dtx(c.dist,P('dist'))],[uv(c.asc,' m'),'Aufstieg',dtx(c.asc,P('asc'))],[uv(c.dur,' h',f1),'Zeit',dtx(c.dur,P('dur'))],[f0(c.load),'Trainingslast',dtx(c.load,P('load'))],[f0(c.steps),'Ø Schritte',dtx(c.steps,P('steps'))],[hmm(c.sleep),'Ø Schlaf',dtx(c.sleep,P('sleep'))],[uv(c.rhr,' bpm'),'Ø Ruhepuls',dtx(c.rhr,P('rhr'))],[uv(c.hrv,' ms'),'Ø HRV',dtx(c.hrv,P('hrv'))]];
   return`<div class="card" style="box-shadow:none"><div class="who"><span class="dot" style="background:var(${PERS[w].c})"></span>${PERS[w].n}</div><div class="kv">${T.map(([a,b,d],qi)=>KS[qi]?`<button class="kvb" data-w="${w}" data-kpi="${KS[qi]}" aria-pressed="${S.kpi===w+'|'+KS[qi]}"><b>${a}</b><span>${b}</span><span class="delta">${d}</span></button>`:`<div><b>${a}</b><span>${b}</span><span class="delta">${d}</span></div>`).join('')}</div>
   ${!ok(c.n)?'<div class="muted" style="margin-top:10px">Für diesen Zeitraum liegen keine Aktivitätsdaten vor.</div>':e.length?`<div style="margin-top:12px">${e.map(([s,h])=>`<button class="srow" data-rsp="${w}|${s}" aria-expanded="${S.rsp===w+'|'+s}"><span>${ic(s,18)}${SP[s].n}</span><div class="bar"><i style="width:${h/mh*100}%;background:var(${PERS[w].c})"></i></div><b>${f1(h)} h</b></button>`).join('')}</div>`:'<div class="muted" style="margin-top:10px">Keine Aktivitäten im Zeitraum.</div>'}
   ${best?`<button class="arow" data-open="${best.id}" style="margin-top:6px"><span class="mr">${routeSvg(best)}</span><span class="t"><b>${esc(ttl(best))}</b><span class="muted sm">Längste Tour · ${dfmt(best.date,{weekday:'short',day:'numeric',month:'numeric'})}</span></span><span class="r">${f1(best.st.dist/1000)} km<span class="muted sm">${f0(best.st.gain)} m ↑</span></span>${ic('next',16)}</button>`:''}</div>`}).join('')}</div>
  <button class="btn p" id="ropen" style="margin-top:12px">Touren dieses Zeitraums auf der Karte</button>`;
  $('#rq').onclick=e=>{const b=e.target.closest('[data-rq]');if(!b)return;const x=rIdx(b.dataset.rq);r.key=b.dataset.rq;r.a=x[0];r.b=x[1];show()};
  const pd=v=>{const[y,m,d]=v.split('-').map(Number);return Math.round((Date.UTC(y,m-1,d)-Date.UTC(START.getFullYear(),START.getMonth(),START.getDate()))/D)};
  const ch=()=>{const f=$('#rf').value,t=$('#rt').value;if(!f||!t)return;let a=pd(f),b=pd(t);if(b<a)[a,b]=[b,a];a=Math.max(0,Math.min(ND,a));b=Math.max(0,Math.min(ND,b));r.a=a;r.b=b;r.key='custom';show()};
  $('#rf').onchange=ch;$('#rt').onchange=ch;
  $('#ropen').onclick=()=>{S.range=[dAt(r.a),dAt((r.b+1))];S.preset='custom';S.sel=null;S.tab='tour';render()};
  $$('[data-open]',box).forEach(b=>b.onclick=()=>{S.sel=b.dataset.open;S.preset='all';S.range=null;S.tab='tour';render()});
  $$('[data-kpi]',box).forEach(b=>b.onclick=()=>{const key=b.dataset.w+'|'+b.dataset.kpi;S.kpi=S.kpi===key?null:key;show()});
  $$('[data-rsp]',box).forEach(b=>b.onclick=()=>{S.rsp=S.rsp===b.dataset.rsp?null:b.dataset.rsp;show()});
  {const pw=S.kpi?S.kpi.split('|')[0]:'',kk0=S.kpi?S.kpi.split('|')[1]:'',wantK=S.kpi&&((pw==='pair'&&ps.length>1)||ps.includes(pw));
   if(wantK)openSheet({kind:'kpi',title:KN2[kk0]+(pw==='pair'?': '+PERS.p1.n+' und '+PERS.p2.n:': '+PERS[pw].n),icon:'chart',color:pw==='pair'?'--c-act':PERS[pw].c,body:`<div class="prange">${dfmt(dAt(r.a),{day:'numeric',month:'long'})} bis ${dfmt(dAt(r.b),{day:'numeric',month:'long',year:'numeric'})}, pro Tag</div><div class="chartbox" id="kc-${pw}"></div>`,onClose:()=>{S.kpi=null;show()}});
   else if(S.rsp&&ps.includes(S.rsp.split('|')[0])){const[rw,rs]=S.rsp.split('|');openSheet({kind:'rsp',title:SP[rs].n+': '+PERS[rw].n,icon:rs,color:PERS[rw].c,body:tourList(rw,rs,r.a,r.b),onClose:()=>{S.rsp=null;show()}})}
   else if(SH&&SH._o&&(SH._o.kind==='kpi'||SH._o.kind==='rsp'))closeSheet(true)}
  if(S.kpi&&S.kpi.startsWith('pair|')&&ps.length>1){const kk=S.kpi.split('|')[1],cb=$('#kc-pair');if(cb){const sum=['dist','ascent','dur','load','steps'].includes(kk),L2=r.b-r.a+1;scrollChart(cb,{mode:sum?'group':'line',n:L2,vis:Math.min(L2,30),h:180,series:ps.map(w=>({n:PERS[w].n,c:`var(${PERS[w].c})`,v:DAILY[w].slice(r.a,r.b+1).map(d=>d[kk])})),labels:i=>dfmt(dAt((r.a+i)),{weekday:'short',day:'numeric',month:'numeric'}),short:i=>dfmt(dAt((r.a+i)),{day:'numeric',month:'numeric'}),tfmt:kk==='slp'?hmm:f1,yfmt:kk==='slp'?(x=>f1(x/60)+' h'):f0,sel:-1,aria:KN2[kk]+', '+PERS.p1.n+' und '+PERS.p2.n})}}
  if(S.kpi){const[kw,kk]=S.kpi.split('|'),cb=$('#kc-'+kw);if(cb&&ps.includes(kw)){const vals=DAILY[kw].slice(r.a,r.b+1).map(d=>d[kk]),sum=['dist','ascent','dur','load','steps'].includes(kk);scrollChart(cb,{mode:sum?'stack':'line',n:vals.length,vis:Math.min(vals.length,45),h:170,series:[{n:KN[kk],c:`var(${PERS[kw].c})`,v:vals}],labels:i=>dfmt(dAt((r.a+i)),{weekday:'short',day:'numeric',month:'numeric'}),short:i=>dfmt(dAt((r.a+i)),{day:'numeric',month:'numeric'}),tfmt:kk==='slp'?hmm:f1,yfmt:kk==='slp'?(x=>f1(x/60)+' h'):f0,sel:-1,aria:KN[kk]})}}};
 show()}
function bedCard(ps){const box=$('#bcard');if(!box)return;const n=S.span==='week'?7:S.span==='month'?30:90,from=Math.max(0,ND-n+1),idx=[];for(let i=from;i<=ND;i++)idx.push(i);
 const has=d=>ok(d.bed)&&ok(d.wake),rowOf=(w,i)=>DAILY[w][i],vals=ps.flatMap(w=>idx.map(i=>rowOf(w,i)).filter(has));
 const head=`<h2 class="h2">Schlafzeiten</h2><div class="muted sm" style="margin:-6px 0 10px">Schlafphasen je Nacht von Bett bis Aufstehen (${n} Tage), dazu der Schlafwert als Linie (rechte Achse). Garmin liefert nur die Summen der Phasen, ihre Reihenfolge in der Nacht ist hier nicht echt. Nächte ohne Wert bleiben leer. Tippe auf eine Nacht oder wähle sie mit den Pfeiltasten.</div>`;
 if(!vals.length){box.innerHTML=head+'<div class="muted">Noch keine Schlafzeiten im Verlauf.</div>';return}
 /* Garmins Empfehlung gilt nur für die kommende Nacht und erscheint nur, wenn Garmin sie liefert (nichts wird selbst berechnet) */
 const nextMid=new Date(TODAY.getFullYear(),TODAY.getMonth(),TODAY.getDate()+1).getTime(),
  rec=ps.map(w=>{const r=TODAYV[w]&&TODAYV[w].bedrec;return r&&ok(r.bed)&&ok(r.wake)&&r.wake>r.bed?{bed:Math.round((r.bed-nextMid)/6e4),wake:Math.round((r.wake-nextMid)/6e4)}:null}),anyRec=rec.some(Boolean),ns=idx.length+(anyRec?1:0);
 const fm=v=>{v=((Math.round(v)%1440)+1440)%1440;return String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0')},hc=m=>Math.floor(m/60)+':'+String(Math.round(m%60)).padStart(2,'0');
 /* Auswahl: letzte Nacht mit Wert, sonst die vom Nutzer gewählte (Nacht-Index oder 'rec') */
 const lastI=Math.max(...ps.flatMap(w=>idx.filter(i=>has(rowOf(w,i)))));
 let sel=S.bedSel;if(!(sel==='rec'&&anyRec)&&!(Number.isInteger(sel)&&sel>=from&&sel<=ND))sel=lastI;
 const dTot=d=>(ok(d.deep)||ok(d.rem)||ok(d.light)||ok(d.awake))?[d.deep,d.rem,d.light,d.awake].reduce((a,b)=>a+(ok(b)?b:0),0):(ok(d.slp)&&d.slp>0?d.slp:0),
  lo=Math.floor(Math.min(...vals.map(d=>d.bed),...rec.filter(Boolean).map(r=>r.bed),0)/120)*120-60,hi=Math.ceil(Math.max(...vals.map(d=>d.wake),...rec.filter(Boolean).map(r=>r.wake))/120)*120+60;
 const W=Math.max(300,box.clientWidth-32||600),m={l:42,r:36,t:16,b:22},w=W-m.l-m.r,h1=200,H=m.t+h1+m.b,colw=w/ns;
 const Y=v=>m.t+(v-lo)/(hi-lo)*h1,X=k=>m.l+(k+.5)/ns*w,bw=Math.max(4,Math.min(22,colw*(ps.length>1?.36:.62))),offOf=pi=>ps.length>1?(pi?bw/2+1:-bw/2-1):0;
 const Y3=v=>m.t+h1-(Math.max(50,Math.min(100,v))-50)/50*h1;
 const kOf=i=>i===undefined?-1:i-from,selK=sel==='rec'?idx.length:kOf(sel);
 let g=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Schlafphasen je Nacht (Tief, REM, Leicht, Wach) und der Schlafwert als Linie">`;
 /* Wochenenden (Aufstehtag Samstag oder Sonntag) und gewählte Nacht */
 idx.forEach((i,k)=>{const dw=dAt(i).getDay();if(dw===0||dw===6)g+=`<rect class="bwe" x="${m.l+k*colw}" y="${m.t}" width="${colw}" height="${h1}" style="fill:var(--text);opacity:.05"/>`});
 if(selK>=0)g+=`<rect class="bsel" x="${m.l+selK*colw}" y="${m.t}" width="${colw}" height="${h1}" rx="4" style="fill:var(--surface2)"/>`;
 for(let t=Math.ceil(lo/120)*120;t<=hi;t+=120){const hh=((t%1440)+1440)%1440/60;g+=`<line class="g" x1="${m.l}" x2="${W-m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${m.l-6}" y="${Y(t)+4}" text-anchor="end">${String(hh).padStart(2,'0')}:00</text>`}
 /* Schlafwert-Stufen von Garmin: ab 80 gut, ab 90 sehr gut (gestrichelt, rechte Achse) */
 for(const t of[80,90])g+=`<line class="bgood" x1="${m.l}" x2="${W-m.r}" y1="${Y3(t)}" y2="${Y3(t)}" style="stroke:var(--text2);stroke-width:1;stroke-dasharray:4 4;opacity:.7"/>`;
 const PAIR=ps.length>1,SC=[0,1,2,3].map(n=>pc=>PAIR?[`var(${pc})`,`color-mix(in srgb,var(${pc}) 62%,transparent)`,`color-mix(in srgb,var(${pc}) 32%,transparent)`,'var(--sep)'][n]:['var(--c-sleep)',`color-mix(in srgb,var(--c-sleep) 62%,transparent)`,`color-mix(in srgb,var(--c-sleep) 32%,transparent)`,'var(--sep)'][n]);
  /* Balken je Nacht: Schlafphasen gestapelt (Tief unten, dann REM, Leicht, Wach), letzte Nacht kräftiger, Schlafdauer darüber wenn Platz ist */
 const lab=colw>=(ps.length>1?58:34);
 ps.forEach((pw,pi)=>{const last=Math.max(...idx.filter(i=>has(rowOf(pw,i))&&dTot(rowOf(pw,i))>0),-1);idx.forEach((i,k)=>{const d=rowOf(pw,i),tot=dTot(d);if(!(tot>0)||!has(d))return;const x=X(k)+offOf(pi)-bw/2,pc=PERS[pw].c;
  const parts=(ok(d.deep)||ok(d.rem)||ok(d.light)||ok(d.awake))?[d.deep,d.rem,d.light,d.awake].map(v=>ok(v)?v:0):[0,0,d.slp,0];parts[3]=Math.max(parts[3],d.wake-d.bed-parts[0]-parts[1]-parts[2]);let acc=0,seg='';
  parts.forEach((v,n)=>{if(!(v>0))return;const y0=Y(d.bed+acc),y1=Y(d.bed+acc+v),r=n===3||(acc+v>=d.wake-d.bed-.01)?Math.min(5,bw/2):0;seg+=`<rect x="${x}" y="${y0}" width="${bw}" height="${Math.max(1,y1-y0-.8)}" rx="${r?Math.min(4,bw/2):0}" style="fill:${SC[n](pc)}"/>`;acc+=v});
  g+=`<g class="bbar${i===last?' blast':''}" data-i="${i}" style="opacity:${i===last?1:.6}">${seg}</g>`;
  if(lab&&ok(d.slp)&&d.slp>0)g+=`<text class="bdur" x="${X(k)+offOf(pi)}" y="${Y(d.bed)-5}" text-anchor="middle">${hc(d.slp)}</text>`})});
 /* Empfehlung für die kommende Nacht: gestrichelter Rahmen in Höhe der empfohlenen Zeit im Bett */
 if(anyRec)ps.forEach((pw,pi)=>{const r=rec[pi];if(!r)return;g+=`<rect class="brec" x="${X(idx.length)+offOf(pi)-bw/2}" y="${Y(r.bed)}" width="${bw}" height="${Math.max(2,Y(r.wake)-Y(r.bed))}" rx="${Math.min(5,bw/2)}" style="fill:none;stroke:var(${PERS[pw].c});stroke-width:1;stroke-dasharray:3 2"/>`});
 /* Schlafwert als Linie im selben Plot, rechte Achse 50 bis 100 */
 for(const t of[50,75,100])g+=`<text x="${W-m.r+6}" y="${Y3(t)+4}" style="fill:var(--text2)">${t}</text>`;
 ps.forEach((pw,pi)=>{
  let seg=[];const flush=()=>{if(seg.length>1)g+=`<polyline class="bsc" points="${seg.join(' ')}" style="fill:none;stroke:${PAIR?'var('+PERS[pw].c+')':'var(--text)'};stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round"/>`;seg=[]};
  idx.forEach((i,k)=>{const d=rowOf(pw,i);if(!ok(d.sleep)){flush();return}seg.push((X(k)+offOf(pi)).toFixed(1)+','+Y3(d.sleep).toFixed(1))});flush();
  idx.forEach((i,k)=>{const d=rowOf(pw,i);if(ok(d.sleep))g+=`<circle class="bsd" cx="${X(k)+offOf(pi)}" cy="${Y3(d.sleep)}" r="${i===sel?4:2.6}" style="fill:${PAIR?'var('+PERS[pw].c+')':'var(--text)'};stroke:var(--surface);stroke-width:1.4"/>`})});
 const step=Math.ceil(idx.length/6);idx.forEach((i,k)=>{if(k%step===0||k===idx.length-1)g+=`<text x="${X(k)}" y="${H-6}" text-anchor="middle">${dfmt(dAt(i),{day:'numeric',month:'numeric'})}</text>`});
 g+='</svg>';
 /* Details der gewählten Nacht */
 const nm=w=>ps.length>1?`<div class="sm" style="font-weight:600;margin:8px 0 2px"><span class="dot" style="background:var(${PERS[w].c});margin-right:6px"></span>${esc(PERS[w].n)}</div>`:'';
 const cur0=sel==='rec'?idx.length:sel-from,nav=t=>`<div class="bdh"><div style="font-weight:600">${t}</div><div class="bnav"><button type="button" class="ib" data-bn="-1" aria-label="Vorherige Nacht"${cur0<=0?' disabled':''}>${ic('prev',20)}</button><button type="button" class="ib" data-bn="1" aria-label="Nächste Nacht"${cur0>=ns-1?' disabled':''}>${ic('next',20)}</button></div></div>`;
 let det;
 if(sel==='rec'){const rows=ps.map((pw,pi)=>{const r=rec[pi];if(!r)return'';return nm(pw)+`<div class="kv kvt"><div><b>${fm(r.bed)}</b><span>Ins Bett</span></div><div><b>${fm(r.wake)}</b><span>Aufstehen</span></div><div><b>${hmm(r.wake-r.bed)}</b><span>Im Bett</span></div></div>`}).join('');
  det=`<div class="bdet" aria-live="polite">${nav('Empfehlung von Garmin für heute Nacht')}${rows}</div>`}
 else{const dt=dAt(sel),rows=ps.map(pw=>{const d=rowOf(pw,sel);if(!has(d)&&!ok(d.slp)&&!ok(d.sleep))return nm(pw)+'<div class="muted sm">Keine Werte für diese Nacht.</div>';
   return nm(pw)+`<div class="kv kvt"><div><b>${has(d)?fm(d.bed):'–'}</b><span>Ins Bett</span></div><div><b>${has(d)?fm(d.wake):'–'}</b><span>Aufgestanden</span></div><div><b>${has(d)?hmm(d.wake-d.bed):'–'}</b><span>Im Bett</span></div><div><b>${ok(d.slp)&&d.slp>0?hmm(d.slp):'–'}</b><span>Geschlafen</span></div><div><b>${ok(d.sleep)?f0(d.sleep):'–'}</b><span>Schlafwert</span></div></div>`}).join('');
  det=`<div class="bdet" aria-live="polite">${nav('Nacht auf '+esc(dfmt(dt,{weekday:'long',day:'numeric',month:'long'})))}${rows}</div>`}
 const rg=ps.map(pw=>{const r=idx.map(i=>rowOf(pw,i)).filter(has);if(!r.length)return'';const b=r.map(d=>d.bed),a=r.map(d=>d.wake),av=x=>x.reduce((s,y)=>s+y,0)/x.length;
  return`<div class="sm"><b>${ps.length>1?esc(PERS[pw].n)+': ':''}</b>Ins Bett ${fm(Math.min(...b))} bis ${fm(Math.max(...b))}, aufgestanden ${fm(Math.min(...a))} bis ${fm(Math.max(...a))}, Ø ${fm(av(b))} und ${fm(av(a))} <span class="muted">(${r.length} von ${idx.length} Nächten)</span></div>`}).join('');
 const pc0=PERS[ps[0]].c,lg=`<div class="lg bleg">${[['Tief',0],['REM',1],['Leicht',2],['Wach',3]].map(([n,k])=>`<span><i class="bsw" style="background:${SC[k](pc0)};height:9px;border-radius:3px"></i>${n}</span>`).join('')}<span><i class="bsw" style="border-top:2px dashed var(--text2);opacity:.7"></i>gut ab 80, sehr gut ab 90</span><span><i class="bsw" style="border-top:2px solid var(--text)"></i>Schlafwert</span>${anyRec?'<span><i class="bsw" style="border:1.5px dashed var(--text2);height:9px;border-radius:3px"></i>Empfehlung für heute Nacht (Garmin)</span>':''}<span><i class="bsw" style="background:var(--text);opacity:.08;height:9px"></i>Wochenende</span><span><i class="bsw" style="background:var(--text2);height:9px;border-radius:3px"></i>letzte Nacht kräftig</span></div>`;
 box.innerHTML=head+`<div class="bplot" tabindex="0" role="group" aria-label="Schlafzeiten je Nacht, mit Pfeiltasten eine Nacht wählen">${g}</div>${lg}${det}<div class="rg">${rg}</div>`;
 const pl=box.querySelector('.bplot'),pick=k=>{k=Math.max(0,Math.min(ns-1,k));S.bedSel=k>=idx.length?'rec':idx[k];bedCard(ps);const p2=$('#bcard .bplot');if(p2&&box._kb)p2.focus()},
  at=e=>{const r=pl.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W;return Math.floor((x-m.l)/w*ns)};
 box.querySelectorAll('.bnav .ib').forEach(bt=>bt.addEventListener('click',()=>{const d=+bt.dataset.bn;box._kb=false;pick(cur0+d);const q=$('#bcard .bnav .ib[data-bn="'+d+'"]')||$('#bcard .bnav .ib:not([disabled])');if(q&&!q.disabled)q.focus();else if(q)$('#bcard .bnav .ib:not([disabled])')&&$('#bcard .bnav .ib:not([disabled])').focus()}));
 pl.addEventListener('pointerdown',e=>{box._kb=false;pick(at(e))});
 pl.addEventListener('pointermove',e=>{if(e.buttons&&e.pointerType!=='touch'){box._kb=false;pick(at(e))}});
 pl.addEventListener('keydown',e=>{const cur=sel==='rec'?idx.length:sel-from,d={ArrowLeft:-1,ArrowRight:1}[e.key];let k=null;if(d)k=cur+d;else if(e.key==='Home')k=0;else if(e.key==='End')k=ns-1;if(k==null)return;e.preventDefault();box._kb=true;pick(k)})}
/* Herz-Trends: Ruhepuls, Ruhepuls mit HRV, Tagesbereich Minimum bis Maximum (alles aus den Tageswerten, nichts berechnet ausser dem Durchschnitt der angezeigten Tage) */
function heartCards(ps){const box=$('#hcard');if(!box)return;const n=S.span==='week'?7:S.span==='month'?30:90,from=Math.max(0,ND-n+1),idx=[];for(let i=from;i<=ND;i++)idx.push(i);
 const col=w=>ps.length>1?`var(${PERS[w].c})`:'var(--c-heart)',row=(w,i)=>DAILY[w][i],ns=idx.length,hasR=d=>ok(d.hrmin)&&ok(d.hrmax)&&d.hrmax>=d.hrmin;
 /* HRV-Schalter: Standard an, Wahl nur pro Gerät (localStorage, Fallback Speicher) */
 if(S.heartHrv===undefined){let v=true;try{const q=localStorage.getItem('fitness-card-heart-hrv');if(q==='0')v=false}catch(e){}S.heartHrv=v}
 const rv=ps.flatMap(w=>idx.map(i=>row(w,i).rhr).filter(ok)),hv=ps.flatMap(w=>idx.map(i=>row(w,i).hrv).filter(ok)),
  mm=ps.flatMap(w=>idx.map(i=>row(w,i)).filter(hasR).flatMap(d=>[d.hrmin,d.hrmax])),anyMM=mm.length>0,showH=S.heartHrv&&hv.length>0;
 const head=`<h2 class="h2">Herz</h2><div class="muted sm" style="margin:-6px 0 10px">Ruhepuls je Tag${anyMM?' mit Pulsbereich (niedrigster bis höchster Puls)':''}${hv.length?', dazu HRV':''} (${n} Tage). Tage ohne Wert bleiben leer. Tippe auf einen Tag oder wähle ihn mit den Pfeiltasten.</div>`;
 if(!rv.length&&!anyMM){box.innerHTML=head+'<div class="muted">Keine Herzwerte im Verlauf.</div>';return}
 const W=Math.max(300,box.clientWidth-32||600),m={l:38,r:showH?40:14,t:12,b:24},pw=W-m.l-m.r,h=190,H=m.t+h+m.b,colw=pw/ns,X=k=>m.l+(k+.5)/ns*pw;
 const axis=(vs,pad,step)=>{const lo=Math.floor((Math.min(...vs)-pad)/step)*step,hi=Math.ceil((Math.max(...vs)+pad)/step)*step,t=[];for(let v=lo;v<=hi;v+=step)t.push(v);return{lo,hi,Y:v=>m.t+h-(v-lo)/(hi-lo)*h,ticks:t}};
 const A=axis([...rv,...mm],3,anyMM?20:5),B=showH?axis(hv,3,10):null;
 const kOf=i=>i-from;let sel=S.heartSel;if(!(Number.isInteger(sel)&&sel>=from&&sel<=ND))sel=ND;
 const bw=Math.max(4,Math.min(18,colw*(ps.length>1?.34:.55))),off=pi=>ps.length>1?(pi?bw/2+1:-bw/2-1):0;
 let g=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ruhepuls je Tag in bpm${anyMM?', Pulsbereich als Balken':''}${showH?', HRV in ms gestrichelt':''}">`;
 g+=`<rect class="hsel" x="${m.l+kOf(sel)*colw}" y="${m.t}" width="${colw}" height="${h}" rx="4" style="fill:var(--surface2)"/>`;
 A.ticks.forEach(v=>{g+=`<line class="g" x1="${m.l}" x2="${W-m.r}" y1="${A.Y(v)}" y2="${A.Y(v)}"/><text x="${m.l-6}" y="${A.Y(v)+4}" text-anchor="end">${v}</text>`});
 if(B)B.ticks.forEach(v=>{g+=`<text x="${W-m.r+6}" y="${B.Y(v)+4}" style="fill:var(--text2)">${v}</text>`});
 /* Pulsbereich: blasse Balken Minimum bis Maximum */
 ps.forEach((w,pi)=>idx.forEach((i,j)=>{const d=row(w,i);if(!hasR(d))return;const y0=A.Y(d.hrmax),y1=A.Y(d.hrmin);g+=`<rect class="hbar" data-i="${i}" x="${X(j)+off(pi)-bw/2}" y="${y0}" width="${bw}" height="${Math.max(2,y1-y0)}" rx="${Math.min(4,bw/2)}" style="fill:${col(w)};opacity:.3"/>`}));
 const line=(w,k,Ax,dash,sw)=>{let seg=[],o='';const fl=()=>{if(seg.length>1)o+=`<polyline class="${k==='rhr'?'hl':'hh'}" points="${seg.join(' ')}" style="fill:none;stroke:${col(w)};stroke-width:${sw};${dash?'stroke-dasharray:5 3;':''}stroke-linejoin:round;stroke-linecap:round"/>`;seg=[]};
  idx.forEach((i,j)=>{const v=row(w,i)[k];if(!ok(v)){fl();return}seg.push(X(j).toFixed(1)+','+Ax.Y(v).toFixed(1))});fl();return o};
 const avgOf=(w,k)=>{const v=idx.map(i=>row(w,i)[k]).filter(ok);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
 ps.forEach((w,pi)=>{const av=avgOf(w,'rhr');if(av!=null)g+=`<line class="bavg" x1="${m.l}" x2="${W-m.r}" y1="${A.Y(av)}" y2="${A.Y(av)}" style="stroke:${col(w)};stroke-width:1;stroke-dasharray:2 4;opacity:.6"/>`;
  g+=line(w,'rhr',A,false,1.8);
  idx.forEach((i,j)=>{const v=row(w,i).rhr;if(ok(v))g+=`<circle class="hd" cx="${X(j)}" cy="${A.Y(v)}" r="${i===sel?4:2.6}" style="fill:${col(w)};stroke:var(--surface);stroke-width:1.4"/>`});
  if(showH){g+=line(w,'hrv',B,true,1.5);idx.forEach((i,j)=>{const v=row(w,i).hrv;if(ok(v))g+=`<circle class="hv" cx="${X(j)}" cy="${B.Y(v)}" r="${i===sel?3.4:2}" style="fill:var(--surface);stroke:${col(w)};stroke-width:1.3"/>`})}});
 const st=Math.ceil(ns/6);idx.forEach((i,j)=>{if(j%st===0||j===ns-1)g+=`<text x="${X(j)}" y="${H-6}" text-anchor="middle">${dfmt(dAt(i),{day:'numeric',month:'numeric'})}</text>`});
 g+='</svg>';
 const nm=w=>ps.length>1?`<span><i class="dot" style="background:${col(w)};margin-right:6px"></i>${esc(PERS[w].n)}</span>`:'';
 const lg=`<div class="lg bleg">${ps.map(w=>`<span>${nm(w)||'<i class="bsw" style="border-top:2px solid var(--c-heart)"></i>Ruhepuls'}${avgOf(w,'rhr')!=null?' Ø '+f0(avgOf(w,'rhr'))+' bpm':''}</span>`).join('')}<span><i class="bsw" style="border-top:2px dashed var(--text2);opacity:.6"></i>Durchschnitt</span>${anyMM?`<span><i class="bsw" style="background:${ps.length>1?'var(--text2)':'var(--c-heart)'};opacity:.3;height:9px;border-radius:3px"></i>Minimum bis Maximum</span>`:''}${showH?`<span><i class="bsw" style="border-top:2px dashed ${ps.length>1?'var(--text)':'var(--c-heart)'}"></i>HRV (rechts)</span>`:''}</div>`;
 const chip=hv.length?`<div class="chips" style="margin:8px 0 0"><button type="button" class="chip" id="hrvTog" aria-pressed="${S.heartHrv}">HRV</button></div>`:'';
 const dt=dAt(sel),cur=sel-from,nav=t=>`<div class="bdh"><div style="font-weight:600">${t}</div><div class="bnav"><button type="button" class="ib" data-hn="-1" aria-label="Vorheriger Tag"${cur<=0?' disabled':''}>${ic('prev',20)}</button><button type="button" class="ib" data-hn="1" aria-label="Nächster Tag"${cur>=ns-1?' disabled':''}>${ic('next',20)}</button></div></div>`;
 const rows=ps.map(w=>{const d=row(w,sel),mmT=hasR(d)?f0(d.hrmin)+'–'+f0(d.hrmax)+' bpm':'–';
  return(ps.length>1?`<div class="sm" style="font-weight:600;margin:8px 0 2px">${nm(w)}</div>`:'')+`<div class="kv kvt"><div><b>${ok(d.rhr)?f0(d.rhr)+' bpm':'–'}</b><span>Ruhepuls</span></div>${anyMM?`<div><b>${mmT}</b><span>Niedrigster bis höchster</span></div>`:''}${hv.length?`<div><b>${ok(d.hrv)?f0(d.hrv)+' ms':'–'}</b><span>HRV</span></div>`:''}</div>`}).join('');
 box.innerHTML=head+`<div class="bplot hplot" tabindex="0" role="group" aria-label="Herzwerte je Tag, mit Pfeiltasten einen Tag wählen">${g}</div>${lg}${chip}<div class="bdet" aria-live="polite">${nav(esc(dfmt(dt,{weekday:'long',day:'numeric',month:'long'})))}${rows}</div>`;
 const pl=box.querySelector('.hplot'),pick=k=>{k=Math.max(0,Math.min(ns-1,k));S.heartSel=idx[k];heartCards(ps);const q=$('#hcard .hplot');if(q&&box._kb)q.focus()},at=e=>{const r=pl.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W;return Math.floor((x-m.l)/pw*ns)};
 box.querySelectorAll('.bnav .ib').forEach(bt=>bt.addEventListener('click',()=>{const d=+bt.dataset.hn;box._kb=false;pick(cur+d);const q=$('#hcard .bnav .ib[data-hn="'+d+'"]');const f=q&&!q.disabled?q:$('#hcard .bnav .ib:not([disabled])');if(f)f.focus()}));
 const tg=box.querySelector('#hrvTog');if(tg)tg.addEventListener('click',()=>{S.heartHrv=!S.heartHrv;try{localStorage.setItem('fitness-card-heart-hrv',S.heartHrv?'1':'0')}catch(e){}box._kb=false;heartCards(ps);const q=$('#hcard #hrvTog');if(q)q.focus()});
 pl.addEventListener('pointerdown',e=>{box._kb=false;pick(at(e))});
 pl.addEventListener('pointermove',e=>{if(e.buttons&&e.pointerType!=='touch'){box._kb=false;pick(at(e))}});
 pl.addEventListener('keydown',e=>{const d={ArrowLeft:-1,ArrowRight:1}[e.key];let k=null;if(d)k=cur+d;else if(e.key==='Home')k=0;else if(e.key==='End')k=ns-1;if(k==null)return;e.preventDefault();box._kb=true;pick(k)})}
function vTrend(){const v=$('#view'),ps=persons(),M=MET[S.metric];
 const wk=ps.map(w=>{const a=weekSum(w,0),b=weekSum(w,7);return`<div class="card"><div class="who"><span class="dot" style="background:var(${PERS[w].c})"></span>${PERS[w].n}<span class="sm muted" style="margin-left:auto;font-weight:400">letzte 7 Tage gegen die 7 davor</span></div><div class="kv">${[['Distanz',uv(a.dist,' km'),dl(a.dist,b.dist)],['Aufstieg',uv(a.asc,' m'),dl(a.asc,b.asc)],['Dauer',uv(a.dur,' h',f1),dl(a.dur,b.dur)],['Aktivitäten',f0(a.n),ok(a.n)&&ok(b.n)?a.n-b.n:null]].map(([n,val,d],i)=>`<div><b>${val}</b><span>${n}</span><span class="delta">${d==null?'':(d>0?'+':'')+d+(i===3?'':' %')+' zur Vorwoche'}</span></div>`).join('')}</div></div>`}).join('');
 const sports=ps.map(w=>{const lo=ND-29,m={};for(const a of ACTS)if(a.who===w&&!a.live&&dayOf(a.date)>=lo&&ok((DAILY[w][dayOf(a.date)]||{}).dist))m[a.sport]=(m[a.sport]||0)+a.st.dur/3600;const e=Object.entries(m).sort((x,y)=>y[1]-x[1]),mx=Math.max(...e.map(x=>x[1]),1);
  return`<div class="card"><div class="who"><span class="dot" style="background:var(${PERS[w].c})"></span>${PERS[w].n}<span class="sm muted" style="margin-left:auto;font-weight:400">Sportarten, 30 Tage</span></div>${e.map(([s,h])=>`<button class="srow" data-csp="${w}|${s}" aria-expanded="${S.cspo===w+'|'+s}"><span>${ic(s,18)}${SP[s].n}</span><div class="bar"><i style="width:${h/mx*100}%;background:var(${PERS[w].c})"></i></div><b>${f1(h)} h</b></button>`).join('')||'<div class="muted">Keine Aktivitäten.</div>'}</div>`}).join('');
 const load=ps.map(w=>{const A=acwr(w);if(!A)return'';const pos=Math.max(0,Math.min(100,A.r/2*100));return`<div class="card"><div class="who"><span class="dot" style="background:var(${PERS[w].c})"></span>${PERS[w].n}<span class="sm muted" style="margin-left:auto;font-weight:400">Belastungsbalance</span></div><div class="acwr"><i style="left:calc(${pos}% - 2px)"></i></div><div class="lgx"><span>0</span><span>1</span><span>2</span></div><div style="margin-top:8px"><b>${A.r.toFixed(2).replace('.',',')}</b></div><div class="muted sm">Trainingslast der letzten 7 Tage (${f0(A.ac)}) im Verhältnis zum 4-Wochen-Schnitt (${f0(A.ch)}).</div></div>`}).join('');
 v.innerHTML=`<div class="stack">
 <section class="card" id="rcard"></section>
 <section class="card"><h2 class="h2">Aktivitätskalender</h2><div class="muted sm" style="margin:-6px 0 10px">Je dunkler, desto höher die Trainingslast. Tippe auf einen Tag mit Aktivität, dann öffnet sich die Tour.</div>${ps.map(w=>`<div class="heatwrap" data-w="${w}">${ps.length>1?`<div class="sm" style="font-weight:600;margin:6px 0 2px">${PERS[w].n}</div>`:''}<div class="hm"></div></div>`).join('')}</section>
 <section class="card"><div class="chips" id="mets" style="margin-bottom:10px">${Object.entries(MET).map(([k,m])=>`<button class="chip" data-k="${k}" aria-pressed="${S.metric===k}">${m.n}</button>`).join('')}</div>
 <div class="tbar" style="margin-bottom:10px"><div class="seg" id="spans">${[['week','Woche'],['month','Monat'],['quarter','3 Monate'],['year','Jahr']].map(([k,n])=>`<button data-k="${k}" aria-pressed="${S.span===k}">${n}</button>`).join('')}</div><span class="muted sm" id="trange"></span></div>
 <div class="chartbox" id="tc"></div><div class="kv" id="tk" style="margin-top:14px"></div></section>
 <section class="card bedc" id="bcard"></section>
 <section class="card bedc" id="hcard"></section>
 <div class="cols">${sports}</div><div class="cols">${load}</div>
 <section class="card" id="acard"></section>
 ${ps.length>1?recordsPairHtml():`<div class="cols">${recordsHtml(ps)}</div>`}
 <section class="card" id="zlaunch"></section>
 <p class="muted sm" style="margin:0">${LIVE?'Echte Daten aus Home Assistant'+(OFF>0?', Verlauf ab '+dateNote():'')+'.':'Echte Verlaufsdaten aus dem Recorder gibt es erst ab 18.10.2026, alles davor sind Beispieldaten.'}</p></div>`;
 rangeCard();bedCard(ps);heartCards(ps);acwrCard(ps);moreBtn();
 {const kd=SH&&SH._o&&SH._o.kind;if(kd!=='kpi'&&kd!=='rsp'){if(S.cspo){const[cw,cs]=S.cspo.split('|');if(ps.includes(cw))openSheet({kind:'csp',title:SP[cs].n+': '+PERS[cw].n+', 30 Tage',icon:cs,color:PERS[cw].c,body:tourList(cw,cs,ND-29,ND),onClose:()=>{S.cspo=null;vTrend()}})}else if(S.more)openSheet({kind:'more',title:'Zusammenhänge',icon:'chart',color:'--c-sleep',body:'<section id="zcard"></section>',onClose:()=>{S.more=false;vTrend()}}),scatterCard(ps);else closeSheet(true)}}
 const doHeat=()=>$$('.heatwrap',v).forEach(h=>{const w=h.dataset.w,box=$('.hm',h);box.innerHTML=heat(w,Math.max(280,box.clientWidth||600))});doHeat();
 v.onclick=e=>{const o=e.target.closest('[data-open]');if(o&&!o.closest('#rcard')){S.sel=o.dataset.open;S.preset='all';S.range=null;S.tab='tour';render();return}const sp=e.target.closest('[data-csp]');if(sp){S.cspo=S.cspo===sp.dataset.csp?null:sp.dataset.csp;vTrend();return}const dy=e.target.closest('[data-day]');if(dy){S.day=+dy.dataset.day;S.tab='heute';render();return}const r=e.target.closest('rect[data-i]');if(!r||!+r.dataset.n)return;const w=r.closest('.heatwrap').dataset.w,idx=+r.dataset.i;const a=ACTS.find(x=>x.who===w&&dayOf(x.date)===idx);S.range=[dAt(idx),dAt((idx+1))];S.preset='custom';S.sel=a.id;S.tab='tour';render()};
 $('#mets').onclick=e=>{const b=e.target.closest('button');if(b){S.metric=b.dataset.k;vTrend()}};$('#spans').onclick=e=>{const b=e.target.closest('button');if(b){S.span=b.dataset.k;S.twin=null;vTrend()}};
const draw=()=>{if(!$('#tc'))return;const B=ps.map(w=>buckets(w,S.metric)),wkS=S.span==='year',dt=i=>dAt(B[0][i].a),canopen=['dist','ascent','dur','load'].includes(S.metric);
  const lab=i=>wkS?'Woche '+dfmt(dt(i),{day:'numeric',month:'numeric'})+' bis '+dfmt(dAt(B[0][i].b),{day:'numeric',month:'numeric'}):dfmt(dt(i),{weekday:'short',day:'numeric',month:'numeric'});
  scrollChart($('#tc'),{mode:M.agg==='sum'?'group':'line',h:250,series:ps.map((w,pi)=>({n:PERS[w].n,c:`var(${PERS[w].c})`,v:B[pi].map(x=>x.v)})),n:B[0].length,vis:VIS[S.span],labels:lab,short:i=>wkS?'KW'+(Math.floor(B[0][i].a/7)+1):S.span==='week'?dfmt(dt(i),{weekday:'short',day:'numeric'}).replace('.',''):dfmt(dt(i),{day:'numeric',month:'numeric'}),tfmt:v=>f0(v)+M.u,sel:-1,pwin:S.twin,aria:M.n+' Verlauf',
   onPick:canopen?i=>{S.range=[dt(i),dAt((B[0][i].b+1))];S.preset='custom';S.sel=null;S.tab='tour';render()}:null,
   onWindow:(a,b)=>{S.twin=a;S.thist={from:dt(a),to:new Date(START.getTime()+B[0][b].b*D+D)};const L=b-a+1;$('#trange').textContent=dfmt(dt(a),{day:'numeric',month:'long'})+' bis '+dfmt(dAt(B[0][b].b),{day:'numeric',month:'long'})+(canopen?' · Balken antippen öffnet die Touren':'');
    $('#tk').innerHTML=ps.map((w,pi)=>{const vals=B[pi].slice(a,b+1).map(x=>x.v),prev=B[pi].slice(Math.max(0,a-L),a).map(x=>x.v),cur=M.agg==='sum'?sumA(vals):avgA(vals),pv=prev.length===L?(M.agg==='sum'?sumA(prev):avgA(prev)):null,d=dl(cur,pv);
     return`<div><b><span class="dot" style="background:var(${PERS[w].c});margin-right:6px"></span>${PERS[w].n}</b><span>${M.agg==='sum'?'Summe':'Durchschnitt'}</span></div><div><b>${uv(cur,M.u)}</b><span>im Zeitfenster</span></div><div><b>${uv(maxA(vals),M.u)}</b><span>Maximum</span></div><div><b>${d==null?'–':(d>=0?'+':'')+d+' %'}</b><span>gegen davor</span></div>`}).join('')}})};
 draw();const ro=new ResizeObserver(()=>{draw();doHeat()});ro.observe($('#tc'))}
/* ---------- Live-Modus: echte Daten aus Home Assistant ---------- */
let ACOV=0;
const FD=self.FitnessData,UNAME={p1:'p1',p2:'p2'},PUN={},PMATCH={p2:null};
const puOf=w=>PUN[w]||UNAME[w];
const SRCKEY='fitness-card-source';
function srcStored(){try{const v=localStorage.getItem(SRCKEY);return v==='auto'||v==='personal'||v==='connect'?v:null}catch(e){return null}}
let SRCCFG={};
const SRCBYKEY='fitness-card-source-by';
/* Wahl je Messwert auf diesem Gerät: {schlüssel: auto|personal|connect}; auto = der globalen Wahl folgen (schlägt source_by aus der Konfiguration) */
function srcByStored(){try{const o=JSON.parse(localStorage.getItem(SRCBYKEY)||'{}'),r={};for(const[k,v]of Object.entries(o||{}))if(v==='auto'||v==='personal'||v==='connect')r[k]=v;return r}catch(e){return{}}}
function srcRowMode(k){const o=srcByStored()[k];return o||(SRCCFG.source_by&&SRCCFG.source_by[k])||'auto'}
function applySource(){const g=srcStored()||SRCCFG.source||'auto',by=Object.assign({},SRCCFG.source_by||{});for(const[k,v]of Object.entries(srcByStored()))by[k]=v==='auto'?g:v;FD.setSourceConfig({source:g,source_by:by})}
const srcNow=()=>srcStored()||SRCCFG.source||'auto';
function applyCfg(cfg){if(cfg.names){if(cfg.names.p1)PERS.p1.n=cfg.names.p1;if(cfg.names.p2)PERS.p2.n=cfg.names.p2}
 if(cfg.entities)Object.assign(UNAME,cfg.entities);if(cfg.personal_entities)Object.assign(PUN,cfg.personal_entities);SRCCFG={source:cfg.source,source_by:cfg.source_by};applySource();PMATCH.p2=cfg.person_match&&cfg.person_match.p2?new RegExp(cfg.person_match.p2,'i'):null}
const whoOfName=s=>PMATCH.p2&&PMATCH.p2.test(s||'')?'p2':'p1';
const slug=s=>String(s||'ort').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||'ort';
function mapLiveAct(w,a){
 const key=slug(a.place);
 if(!PL[key]){const st=a.start||(a.w&&a.w[0])||[48.77,9.18];PL[key]={n:a.place||'Unterwegs',lat:st[0],lon:st[1],el:0,sp:1}}
 const o=Object.assign({},a,{who:w,place:key,tr:null,joint:null,sname:a.sname||null});
 o.ll=a.w;o.w=a.w&&a.w.length>1?a.w.map(p=>W0(p[0],p[1])):null;o.gps=!!o.w;
 o.st=Object.assign({},a.st,{avgHR:a.st.avgHR||0,maxHR:a.st.maxHR||0,maxV:a.st.maxV||0});
 return o}
const DKEYS=['imm','imh','steps','kcal','goal','rhr','hrv','sleep','slp','deep','rem','light','awake','need','bb','stress','sr','sl','sm','sh','vo2','kg','ready','bed','wake','hrmin','hrmax'];
/* Keine Lücken füllen: fehlt ein Wert, bleibt er null (auch Schritte und kcal) */
const isNum=v=>v!=null&&typeof v!=='boolean'&&isFinite(v);
function buildDaily(rows,acts,cov){
 const n=rows.length,days=rows.map(r=>({}));
 for(const k of DKEYS)rows.forEach((r,i)=>{const v=r[k];days[i][k]=!isNum(v)||r.missing?null:(k==='kg'||k==='vo2')?Math.round(v*10)/10:Math.round(v)});
 /* Aktivitätssummen nur im abgedeckten Fenster (sonst null), dort 0 an Tagen ohne Aktivität */
 days.forEach((d,i)=>{const inW=i>=cov&&!rows[i].missing;d.dist=inW?0:null;d.ascent=inW?0:null;d.load=inW?0:null;d.dur=inW?0:null;d.missing=!!rows[i].missing});
 for(const a of acts){const i=dayOf(a.date);if(i<0||i>=n)continue;const d=days[i];if(d.dist==null)continue;d.dist+=(a.st.dist||0)/1000;d.ascent+=a.st.gain||0;d.load+=a.st.load||0;d.dur+=(a.st.dur||0)/3600}
 return days}
/* Garmins eigene Trainingsbereitschaft: Stufe und Faktoren aus den Sensor-Attributen */
const RFACS=[['sleepScore','Schlaf (letzte Nacht)'],['recoveryTime','Erholungszeit','recoveryTime',' h'],['acwr','Belastung (akut/chronisch)','acuteLoad',' akut'],['stressHistory','Stressverlauf'],['hrv','HRV','hrvWeeklyAverage',' ms Wochen-Ø'],['sleepHistory','Schlafverlauf']];
function readReadiness(st,w,T){const e=st['sensor.garmin_'+UNAME[w]+'_trainingsbereitschaft'],at=(e&&e.attributes)||{};
 T.rlevel=at.level!=null&&at.level!==''?String(at.level):null;
 T.rfac=RFACS.map(([k,n,xk,xu])=>{const fb=at[k+'FactorFeedback'],pc=parseFloat(at[k+'FactorPercent']),xv=xk?parseFloat(at[xk]):NaN;
  if((fb==null||fb==='')&&!isNum(pc))return null;return{n,pct:isNum(pc)?pc:null,fb:fb==null||fb===''?null:String(fb),x:isNum(xv)?Math.round(xv)+xu:null}}).filter(Boolean)}
function detectJoint(list){
 for(const k of list.filter(a=>a.who==='p2'))for(const j of list.filter(a=>a.who==='p1')){
  if(k.sport===j.sport&&Math.abs(k.date-j.date)<30*6e4&&Math.abs(k.st.dist-j.st.dist)<=Math.max(300,j.st.dist*.15)){k.joint=j.id;break}}}
async function loadLive(hass,cfg,who){
 HASSREF=hass;
 const tz=(hass.config&&hass.config.time_zone)||'Europe/Berlin',todayAbs=FD.dayIndex(Date.now(),tz),srcs={},covs={};
 for(const w of who){srcs[w]=await FD.combine(FD.recorderSource(hass,UNAME[w],{personal:puOf(w)}),FD.archiveSource({enabled:!!cfg.archive}));covs[w]=await srcs[w].coverage()}
 const froms=who.map(w=>covs[w].archiveEnabled?0:covs[w].recorderFrom).filter(x=>x!=null);
 if(!froms.length)throw new Error('Noch keine Garmin-Daten im Recorder');
 const off=Math.min(...froms);
 const raw={};for(const w of who){const[rows,acts]=await Promise.all([srcs[w].daily(off,todayAbs),srcs[w].activities(off,todayAbs)]);raw[w]={rows,acts}}
 /* in den Zustand schreiben */
 OFF=off;START=new Date(2026,0,1+off);TODAY=new Date(2026,0,1+todayAbs);ND=todayAbs-off;
 ACTS=[];DAILY={};TODAYV={};
 for(const w of who)for(const a of raw[w].acts)ACTS.push(mapLiveAct(w,a));
 ACTS.sort((a,b)=>b.date-a.date);detectJoint(ACTS);byId=Object.fromEntries(ACTS.map(a=>[a.id,a]));
 ACOV=Math.max(0,Math.min(ND,dayOf(new Date(Date.now()-35*864e5))));
 for(const w of who){const d=DAILY[w]=buildDaily(raw[w].rows,ACTS.filter(a=>a.who===w),ACOV),L=d[d.length-1],last7=d.slice(-7),av=k=>{const v=last7.map(x=>x[k]).filter(isNum);return v.length?Math.round(v.reduce((s,x)=>s+x,0)/v.length):null};
  const st=hass.states&&hass.states['sensor.garmin_'+UNAME[w]+'_trainingsstatus'],stx=st&&st.state&&!['unknown','unavailable'].includes(st.state)?st.state:'';
  const hwv=FD.pickState(hass.states||{},puOf(w),UNAME[w],'hrv_wochendurchschnitt').v;
  TODAYV[w]={steps:L.steps,goal:L.goal,bb:L.bb,rhr:L.rhr,rhr7:av('rhr'),hrv:L.hrv,hrvW:isNum(hwv)?hwv:av('hrv'),rlevel:null,rfac:[],sleep:L.sleep,stress:L.stress,ready:L.ready,status:stx.replace(/_/g,' ').toLowerCase().replace(/^./,c=>c.toUpperCase())||'–',vo2:L.vo2,kcal:L.kcal,slp:L.slp,deep:L.deep,light:L.light,rem:L.rem,awake:L.awake,need:L.need,sr:L.sr,sl:L.sl,sm:L.sm,sh:L.sh}}
 for(const k of Object.keys(ACW))delete ACW[k];
 await refreshLive(hass,who);
 return{off,todayAbs,archive:!!cfg.archive}}

const nowHM=()=>new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
function kmIndex(a,m){let d=a.tr?a.tr.d:a._cd;if(!d){const p=a.ll||[];d=[0];for(let i=1;i<p.length;i++){const la=(p[i][0]+p[i-1][0])/2*Math.PI/180;d.push(d[i-1]+Math.hypot((p[i][0]-p[i-1][0])*111320,(p[i][1]-p[i-1][1])*111320*Math.cos(la)))}
  const sc=d[d.length-1]?a.st.dist/d[d.length-1]:1;d=d.map(x=>x*sc);a._cd=d}
 const i=d.findIndex(x=>x>=m);return i>=0&&a.tr&&a.tr.wi?a.tr.wi[i]:i}
/* Kartenkacheln (CARTO, wie die HA-Karte), nur im Live-Modus */
let TILES=false,cfgRef=null;const TC=new Map();let tRaf=0;
function tileImg(z,x,y,dark){const k=(dark?'d':'l')+z+'/'+x+'/'+y;let im=TC.get(k);
 if(!im){im=new Image();im.onload=()=>{if(!tRaf)tRaf=requestAnimationFrame(()=>{tRaf=0;drawMap()})};
  im.src='https://tile.openstreetmap.org/'+z+'/'+x+'/'+y+'.png';
  TC.set(k,im);if(TC.size>500)TC.delete(TC.keys().next().value)}
 return im}
function drawTiles(c){const dark=host.getAttribute('data-theme')==='dark',Z=Math.max(0,Math.min(18,Math.round(MV.z))),n=2**Z,ts=256/n,[wx0,wy0]=inv(0,0),[wx1,wy1]=inv(mW,mH);
 const x0=Math.max(0,Math.floor(wx0/ts)),x1=Math.min(n-1,Math.floor(wx1/ts)),y0=Math.max(0,Math.floor(wy0/ts)),y1=Math.min(n-1,Math.floor(wy1/ts));
 if((x1-x0+1)*(y1-y0+1)>80)return;
 for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){const im=tileImg(Z,tx,ty,dark);if(!im.complete||!im.naturalWidth)continue;const sz=ts*2**MV.z;c.drawImage(im,Math.floor(sx(tx*ts)),Math.floor(sy(ty*ts)),Math.ceil(sz)+1,Math.ceil(sz)+1)}
 c.save();c.globalCompositeOperation='saturation';c.fillStyle='#808080';c.fillRect(0,0,mW,mH);c.globalCompositeOperation='source-over';if(dark){c.fillStyle='rgba(18,20,24,.62)';c.fillRect(0,0,mW,mH)}c.restore()}
/* ---------- Laufende LiveTracks (inReach-App) ---------- */
const LSPORT={running:'run',trail_running:'run',walking:'hike',hiking:'hike',cycling:'mtb',mountain_biking:'mtb',biking:'mtb',road_biking:'mtb',skiing:'ski',snowboarding:'ski',swimming:'swim'};
const isLiveSensor=(id,s)=>/^binary_sensor\.garmin_inreach_relay_livetrack_/.test(id)&&s&&s.state==='on';
function liveSig(hass){return Object.entries(hass.states||{}).filter(([id,s])=>isLiveSensor(id,s)).map(([id,s])=>id+'@'+(s.attributes.last_update||'')).sort().join('|')}
async function loadLiveTracks(hass,who){
 HASSREF=hass;const out=[];
 for(const[id,s]of Object.entries(hass.states||{})){if(!isLiveSensor(id,s))continue;
  const at=s.attributes||{},w=whoOfName(at.person);if(!who.includes(w))continue;
  const tr=Object.values(hass.states).find(x=>x.entity_id.startsWith('device_tracker.garmin_inreach_relay_position_')&&at.person&&String((x.attributes||{}).friendly_name||'').includes(at.person));
  let pts=[],T=null,nopts=true;
  if(tr&&at.start){try{const h=await hass.callWS({type:'history/history_during_period',start_time:at.start,end_time:new Date().toISOString(),entity_ids:[tr.entity_id],include_start_time_state:false,significant_changes_only:false,minimal_response:false,no_attributes:false});
   const all=(h[tr.entity_id]||[]).map(x=>x.a||x.attributes).filter(a=>a),rows=all.filter(a=>a.latitude!=null);
   pts=rows.map(a=>[a.latitude,a.longitude]);
   const lt=rows.filter(a=>a.source==='livetrack'),mine=lt.filter(a=>!at.session_id||a.livetrack_session===at.session_id);
   const la=all.filter(a=>a.source==='livetrack'),lm=la.filter(a=>!at.session_id||a.livetrack_session===at.session_id);
   T=trFromRows(lm.length>=2?lm:la);nopts=!lt.length}catch(_){}}
  if(at.distance_m>0)nopts=false;
  if(!pts.length){const pe=hass.states['person.'+UNAME[w]],pa=pe&&pe.attributes,src=pa&&pa.latitude!=null?pa:(tr&&tr.attributes.latitude!=null?tr.attributes:null);if(src)pts=[[src.latitude,src.longitude]]} /* ohne Punkte: letzte Position der Person aus HA (Handy oder Garmin, was neuer ist), nicht die Garmin-Position */
  if(pts.length===1)pts=[pts[0],pts[0]];
  const dist=at.distance_m||0,dur=at.duration_s||0,last=pts[pts.length-1]||[48.77,9.18];
  PL.live={n:'LiveTrack',lat:last[0],lon:last[1],el:0,sp:1};
  const o={id:'live_'+(at.session_id||id),who:w,source:'live',live:true,date:new Date(at.start||Date.now()),sport:LSPORT[String(at.activity||'').toLowerCase()]||'hike',name:at.session_name||'LiveTrack',sname:null,
   gps:pts.length>1,place:'live',ll:pts,w:pts.length>1?pts.map(p=>W0(p[0],p[1])):null,tr:null,joint:null,zones:[0,0,0,0,0],
   st:{dist,dur,elapsed:dur,gain:0,loss:0,avgHR:at.heart_rate||0,maxHR:0,kcal:0,load:0,avgV:dur?dist/dur*3.6:0,maxV:0},liveAt:at.last_update||null,nopts:nopts,startAt:at.start||null};if(T)applyTr(o,T,true);out.push(o)}
 return out}
/* Aktuelle Werte direkt aus den Sensoren (die Tageszeile aus dem Recorder hinkt hinterher) */
const NOWK={steps:'schritte',bb:'body_battery',stress:'durchschnittliches_stresslevel',rhr:'ruhepuls',hrv:'hrv_letzte_nacht_durchschnitt',sleep:'schlafwert',ready:'trainingsbereitschaft',kcal:'kalorien',goal:'tagliches_schrittziel'};
const NOWAT={};
/* Teilwerte des Schlafwerts und Garmins Einordnung: gibt es nur bei der eigenen Integration */
function readSleepx(st,w){if(FD.sourceMode('sleep')==='connect')return null;const pu=puOf(w),g=n=>st['sensor.'+pu+'_'+n],bad=['unknown','unavailable','invalid',''];
 const sv=n=>{const e=g(n);return e&&e.state!=null&&!bad.includes(e.state)?String(e.state):null};
 const pc=n=>{const e=g(n),v=e?parseFloat(e.state):NaN;if(!isFinite(v))return null;const a=e.attributes||{};return{v:Math.round(v),lo:isNum(a.optimalStart)?a.optimalStart:null,hi:isNum(a.optimalEnd)?a.optimalEnd:null}};
 const o={dur:sv('schlafwert_dauer'),stress:sv('schlafwert_stress'),wake:sv('schlafwert_aufwachen'),rest:sv('schlafwert_unruhe'),fb:sv('schlaf_feedback'),ins:sv('schlaf_einblick'),st:{deep:pc('schlafwert_tiefschlaf'),rem:pc('schlafwert_rem'),light:pc('schlafwert_leichtschlaf')}};
 return Object.entries(o).some(([k,v])=>k==='st'?Object.values(v).some(Boolean):v)?o:null}
let ME=null;
/* Quelle wechseln: Wahl merken, alles neu laden (Tageswerte, Verlauf) und Ansicht behalten */
async function switchSource(m,key){try{if(key){const o=srcByStored();o[key]=m;localStorage.setItem(SRCBYKEY,JSON.stringify(o))}else localStorage.setItem(SRCKEY,m)}catch(e){}applySource();if(!LIVE||!HASSREF||!ME)return;
 const keep={who:S.who,tab:S.tab,day:S.day};await startLive(HASSREF,cfgRef,ME);Object.assign(S,keep);render()}
/* Runde 2: Schlafzeiten, Stress-Zusatz, HRV-Bandbreite, Alter, Etagen, Pulszonen, Trainingseffekt. Was fehlt, bleibt null und wird nicht angezeigt. */
function readExtras(st,w,T){const pu=puOf(w),cu=UNAME[w],num=v=>{v=parseFloat(v);return isFinite(v)?v:null},ent=n=>st['sensor.'+pu+'_'+n],pers=k=>FD.sourceMode(k)!=='connect',px=n=>FD.pickState(st,pu,cu,n);
 const bed=FD.pickTs(st,pu,cu,'schlafenszeit'),wk=FD.pickTs(st,pu,cu,'aufwachzeit');
 T.sleept=bed.ms!=null&&wk.ms!=null&&wk.ms>bed.ms&&wk.ms-bed.ms<24*36e5?{bed:bed.ms,wake:wk.ms,src:bed.src}:null;
 const mx=px('maximales_stresslevel'),si=px('inaktive_zeit'),sa=px('sehr_aktive_zeit');
 T.str2=mx.v!=null||si.v!=null||sa.v!=null?{max:mx.v,sit:si.v,act:sa.v}:null;
 T.hrvband=null;if(FD.sourceMode('hrv')!=='personal'){const e=st['sensor.garmin_'+cu+'_hrv_basiswert'],at=e&&e.attributes;if(at&&num(at.balancedLow)!=null&&num(at.balancedUpper)!=null)T.hrvband={lo:num(at.balancedLow),hi:num(at.balancedUpper)}}
 const fa=px('fitnessalter'),ca=px('chronologisches_alter'),ach=px('erreichbares_fitnessalter'),fe=fa.src==='personal'?ent('fitnessalter'):null,cp=fe&&fe.attributes&&fe.attributes.components||{},cv=k=>cp[k]&&num(cp[k].value);
 T.age=fa.v!=null&&ca.v!=null?{fa:fa.v,ca:ca.v,ach:ach.v,comp:fe?{bmi:cv('bmi'),rhr:cv('rhr'),vd:cv('vigorousDaysAvg'),vm:cv('vigorousMinutesAvg')}:null}:null;
 const up=px('etagen_aufwarts'),gl=px('ziel_etagen_aufwarts');T.fl=up.v!=null&&gl.v>0?{up:up.v,goal:gl.v}:null;
 const ig=px('ziel_intensitatsminuten');T.imgoal=ig.v>0?Math.round(ig.v):null;
 T.zn=null;const mp=pers('zones')&&ent('maximalpuls_eingestellt');
 if(mp&&mp.attributes){const fl=[1,2,3,4,5].map(i=>num(mp.attributes['zone_'+i+'_floor']));if(fl.every(v=>v!=null)&&fl.every((v,i)=>!i||v>fl[i-1]))T.zn={fl,max:num(mp.state),lthr:px('laktatschwellen_herzfrequenz').v}}
 /* Runde 3: Empfehlung für heute Abend (nur was Garmin liefert), Hinweise zu Abgleich und Schlüssel */
 {const ob=FD.pickTs(st,pu,cu,'optimale_schlafenszeit'),ow=FD.pickTs(st,pu,cu,'optimale_aufwachzeit'),nd=px('nachster_schlafbedarf');
  T.bedrec=ob.ms!=null&&ow.ms!=null&&ow.ms>ob.ms&&ow.ms-ob.ms<24*36e5?{bed:ob.ms,wake:ow.ms,need:nd.v!=null&&nd.v>0?Math.round(nd.v):null}:(nd.v!=null&&nd.v>0?{bed:null,wake:null,need:Math.round(nd.v)}:null);
  const sy=FD.pickTs(st,pu,cu,'zuletzt_synchronisiert'),ov=st['binary_sensor.'+pu+'_uhr_synchronisation_uberfallig'],now=Date.now();
  const ageH=sy.ms!=null&&now>=sy.ms?(now-sy.ms)/36e5:null,over=pers('sync')&&ov&&ov.state==='on';
  T.sync=ageH!=null&&(over||ageH>18)?{ageH}:(over?{ageH:null}:null);
  const ke=pers('sync')&&ent('api_schlussel_lauft_ab'),kt=ke&&ke.state&&!['unknown','unavailable',''].includes(ke.state)?Date.parse(ke.state):NaN;
  T.key=isFinite(kt)?{days:Math.ceil((kt-now)/864e5)}:null;T.key=T.key&&T.key.days<14?T.key:null}
 T.last=null;const la=pers('te')&&ent('letzte_aktivitat');
 if(la&&la.attributes&&la.attributes.activityId!=null){const g=n=>{const e=ent('letzte_aktivitat_'+n);return e?num(e.state):null},aer=g('aerober_trainingseffekt'),ana=g('anaerober_trainingseffekt'),ld=g('trainingsbelastung');
  if(aer!=null||ana!=null||ld!=null)T.last={id:'g'+la.attributes.activityId,aer,ana,load:ld}}}
function applyNow(hass,who){const st=hass&&hass.states||{};for(const w of who){const T=TODAYV[w],d=DAILY[w]&&DAILY[w][ND];if(!T)continue;let lu=0;
 T.src={};T.both={};for(const [k,n] of Object.entries(NOWK)){const rp=FD.pickState(st,puOf(w),UNAME[w],n,'personal'),rc=FD.pickState(st,puOf(w),UNAME[w],n,'connect');T.both[k]={personal:rp.src==='personal'&&rp.v!=null?Math.round(rp.v):null,connect:rc.v!=null?Math.round(rc.v):null};}
 for(const [k,n] of Object.entries(NOWK)){const r=FD.pickState(st,puOf(w),UNAME[w],n,FD.sourceMode(k));if(r.v==null)continue;const e=r.e,v=r.v;T[k]=Math.round(v);T.src[k]=r.src;if(d)d[k]=Math.round(v);const t=Date.parse(e.last_updated||e.last_changed||'');if(isFinite(t)&&t>lu)lu=t}
 readReadiness(st,w,T);T.sleepx=readSleepx(st,w);readExtras(st,w,T);
 if(lu)NOWAT[w]=lu}}
const standHM=w=>NOWAT[w]?new Date(NOWAT[w]).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):nowHM();
async function refreshLive(hass,who){
 applyNow(hass,who);DAYSRC=dayReal;
 const lv=await loadLiveTracks(hass,who);
 ACTS=ACTS.filter(a=>!a.live).concat(lv).sort((a,b)=>b.date-a.date);byId=Object.fromEntries(ACTS.map(a=>[a.id,a]));
 if(S&&S.sel&&!byId[S.sel])S.sel=null}
/* Tagesverlauf aus dem HA-Recorder: Schritte je Stunde und Body Battery. Stress und Herzfrequenz liefert Garmin nicht als Tagesverlauf, dafür gibt es keine Kurve. */
async function dayReal(w,di){const hass=HASSREF,out={};if(!hass||!hass.states)return out;
 const u=UNAME[w],pu=puOf(w),t0=dAt(di).getTime(),t1=Math.min(Date.now(),t0+864e5),H=36e5,mode=FD.sourceMode;
 const hist=(id,attrs)=>hass.callWS({type:'history/history_during_period',start_time:new Date(t0).toISOString(),end_time:new Date(t1).toISOString(),entity_ids:[id],include_start_time_state:true,significant_changes_only:false,minimal_response:false,no_attributes:!attrs}).then(h=>h[id]||[]);
 const tsOf=x=>x.lu!=null?x.lu*1000:x.lc!=null?x.lc*1000:Date.parse(x.last_updated||x.last_changed);
 /* Stundenwerte: Schritte (Zuwachs je Stunde) und Body Battery (Mittel je Stunde). Kandidaten nach Quellenwahl, der erste mit brauchbaren Daten gewinnt */
 for(const [k,name] of [['steps','schritte'],['bb','body_battery']]){
  for(const id of FD.candidateIds(hass.states,pu,u,name,mode(k))){
   try{const rows=(await hist(id,false)).map(x=>({t:Math.max(t0,tsOf(x)),v:parseFloat(x.s!=null?x.s:x.state)})).filter(x=>isFinite(x.t)&&isFinite(x.v)).sort((p,q)=>p.t-q.t);
    if(!rows.length)continue;
    /* Schritte sind ein Tageszähler: beginnt die Aufzeichnung erst spät am Tag, wäre der erste Zuwachs falsch -> nächste Quelle */
    if(k==='steps'&&rows[0].t>t0+2*H)continue;
    const at=t=>{let v=null;for(const r of rows){if(r.t<=t)v=r.v;else break}return v},arr=Array(24).fill(null);
    for(let i=0;i<24;i++){const a=t0+i*H,b=a+H;if(a>=t1)break;const e=at(Math.min(b,t1));
     if(k==='steps'){if(e==null)continue;const p=at(a);let d=p==null?e:e-p;if(d<0)d=e;arr[i]=Math.round(d)}
     else{const inH=rows.filter(r=>r.t>=a&&r.t<b).map(r=>r.v);const v=inH.length?inH.reduce((x,y)=>x+y,0)/inH.length:e;if(v!=null)arr[i]=v}}
    out[k]=arr;break}catch(e){}}}
 /* Dichte Verläufe (Minutentakt) gibt es nur bei der eigenen Integration; die Zeit steht im Attribut measured_at, sonst gilt der Zeitpunkt des Eintrags */
 {
  for(const [k,name,mk] of [['bbd','body_battery_verlauf','bb'],['hrd','puls_verlauf','hr'],['hrvd','hrv_verlauf','hrv']]){const id='sensor.'+pu+'_'+name;if(mode(mk)==='connect'||!hass.states[id])continue;
   try{const seen=new Set(),pts=[];for(const x of await hist(id,true)){const at=x.a||x.attributes||{},t=at.measured_at?Date.parse(at.measured_at):tsOf(x),v=parseFloat(x.s!=null?x.s:x.state);
     if(!isFinite(t)||!isFinite(v)||t<t0||t>t1||seen.has(t))continue;seen.add(t);pts.push([(t-t0)/H,v])}
    pts.sort((p,q)=>p[0]-q[0]);if(pts.length>=4)out[k]=pts}catch(e){}}}
 return out}
function liveBanner(){
 const ls=ACTS.filter(a=>a.live&&persons().includes(a.who));if(!ls.length)return'';
 return ls.map(a=>`<button class="arow card" data-open="${a.id}" style="width:100%;text-align:left;margin-bottom:14px"><span class="mr"><span class="av" style="background:var(${PERS[a.who].c})">${ic(a.sport,20)}</span></span><span class="t"><b><span class="ldot"></span>${PERS[a.who].n} ${a.nopts?'hat Live-Track gestartet':'ist live unterwegs'}</b><span class="muted sm">${a.nopts?esc(a.name)+(a.startAt?' · seit '+new Date(a.startAt).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):'')+' · noch keine Punkte':esc(a.name)+' · '+SP[a.sport].n+(a.st.avgHR?' · '+f0(a.st.avgHR)+' bpm':'')}</span></span>${a.nopts?'':`<span class="r">${f1(a.st.dist/1000)} km<span class="muted sm">${hm(a.st.dur)}</span></span>`}${ic('next',16)}</button>`).join('')}

/* ---------- Vektorkarte (MapLibre + OpenFreeMap) als Untergrund, Stil aus dem inReach-Add-on ---------- */
let BM='vector',VEC=null,VECSTATE='',VECCUR=null;
const VECJS='https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/';
const VPAL = {
  light: { bg: '#f4f2ed', wood: '#d3e6c4', grass: '#dfeccf', park: '#cde4bd', urban: '#ece9e3', water: '#a6d0f0', building: '#e3dfd7',
    minor: '#ffffff', major: '#ffffff', casing: '#d6d1c7', motorway: '#f6d282', mwCasing: '#ddb35a', path: '#c6c0b4', rail: '#c9c4bb', border: '#b9a8c9', label: '#3c3c43', halo: '#ffffff', water_label: '#4a7aa8' },
  dark: { bg: '#21403a', wood: '#25493d', grass: '#274b40', park: '#2a5244', urban: '#283e3c', water: '#1b2c66', building: '#30474a',
    minor: '#455a63', major: '#58707b', casing: '#21403a', motorway: '#77899a', mwCasing: '#21403a', path: '#3c5358', rail: '#3e5459', border: '#7e6b93', label: '#e3e9ee', halo: '#21403a', water_label: '#8fb0e6' },
};

function vecStyle(dark){
  const c = dark ? VPAL.dark : VPAL.light;
  const road = (cls) => ['match', ['get', 'class'], cls, true, false];
  const w = (a,b) => ['interpolate', ['exponential', 1.6], ['zoom'], 8, a, 18, b];
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': c.bg } },
      { id: 'urban', type: 'fill', source: 'omt', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood', 'commercial', 'industrial', 'retail']]], paint: { 'fill-color': c.urban } },
      { id: 'grass', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['grass', 'farmland', 'wetland']]], paint: { 'fill-color': c.grass, 'fill-opacity': 0.7 } },
      { id: 'wood', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], paint: { 'fill-color': c.wood } },
      { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': c.park } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': c.water } },
      { id: 'river', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: { 'line-color': c.water, 'line-width': w(0.6, 5) } },
      { id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': c.building } },
      { id: 'border', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['<=', ['get', 'admin_level'], 4], paint: { 'line-color': c.border, 'line-width': 1, 'line-dasharray': [2, 2] } },
      { id: 'path', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 13, filter: road(['path', 'track']), paint: { 'line-color': c.path, 'line-width': 1, 'line-dasharray': [2, 1.5] } },
      { id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: road(['rail', 'transit']), paint: { 'line-color': c.rail, 'line-width': 1 } },
      { id: 'major-case', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: road(['primary', 'secondary', 'tertiary', 'trunk']), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.casing, 'line-width': w(1.6, 22) } },
      { id: 'minor', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 12, filter: road(['minor', 'service']), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.minor, 'line-width': w(0.5, 12) } },
      { id: 'major', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: road(['primary', 'secondary', 'tertiary', 'trunk']), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.major, 'line-width': w(1, 18) } },
      { id: 'motorway-case', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: road(['motorway']), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.mwCasing, 'line-width': w(2, 24) } },
      { id: 'motorway', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: road(['motorway']), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.motorway, 'line-width': w(1.4, 20) } },
      { id: 'road-label', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 13, layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:de'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': 11 }, paint: { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 1.2 } },
      { id: 'water-label', type: 'symbol', source: 'omt', 'source-layer': 'water_name', layout: { 'text-field': ['coalesce', ['get', 'name:de'], ['get', 'name']], 'text-font': ['Noto Sans Italic'], 'text-size': 12 }, paint: { 'text-color': c.water_label, 'text-halo-color': c.water, 'text-halo-width': 1 } },
      { id: 'place', type: 'symbol', source: 'omt', 'source-layer': 'place', filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'suburb', 'hamlet']]], layout: { 'text-field': ['coalesce', ['get', 'name:de'], ['get', 'name']], 'text-font': ['Noto Sans Bold'], 'text-size': ['match', ['get', 'class'], 'city', 16, 'town', 14, 12] }, paint: { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 1.5 } },
    ],
  };
}


function vecLoad(base){
 if(self.maplibregl)return Promise.resolve(self.maplibregl);
 if(self.__mlLoad)return self.__mlLoad;
 return self.__mlLoad=new Promise((ok,no)=>{const s=document.createElement('script');s.src=base+'maplibre-gl.js';s.onload=()=>self.maplibregl?ok(self.maplibregl):no(new Error('MapLibre fehlt'));s.onerror=()=>{self.__mlLoad=null;no(new Error('MapLibre nicht ladbar'))};document.head.appendChild(s)})}
async function vecCss(base){
 if(root.querySelector('#mlcss'))return;const st=document.createElement('style');st.id='mlcss';root.appendChild(st);
 try{const r=await fetch(base+'maplibre-gl.css');st.textContent=await r.text()}catch(e){}}
function vecDark(){return host.getAttribute('data-theme')==='dark'}
function vecFail(){VECSTATE='failed';if(VEC){try{VEC.remove()}catch(e){}VEC=null}if($('#legend'))legend();if(S&&S.tab==='tour')drawMap()}
function vecEnsure(){
 const box=$('#mlmap');if(!box||BM!=='vector'||VECSTATE==='failed')return;
 if(VEC&&VEC.getContainer()!==box){try{VEC.remove()}catch(e){}VEC=null;if(VECSTATE==='ready')VECSTATE=''}
 if(VEC||VECSTATE==='loading')return;
 VECSTATE='loading';const base=(cfgRef&&cfgRef.maplibre_url)||VECJS;vecCss(base);
 vecLoad(base).then(ml=>{const b=$('#mlmap');if(!b){VECSTATE='';return}
  const[la,lo]=latlon(MV.x,MV.y);const dk=vecDark();
  VEC=new ml.Map({container:b,style:vecStyle(dk),interactive:false,attributionControl:false,fadeDuration:0,center:[lo,la],zoom:MV.z-1});VEC._dark=dk;VECCUR=null;
  let miss=0;VEC.on('error',e=>{const er=e&&e.error||{};if((er.status>=400||/fetch|network|load failed/i.test(er.message||''))&&++miss>=8&&!VEC.loaded())vecFail()});
  VEC.once('style.load',()=>{VECSTATE='ready';if($('#legend'))legend();drawMap()});
  setTimeout(()=>{if(VECSTATE==='loading')vecFail()},12000)}).catch(vecFail)}
function vecSync(){
 if(!VEC||VECSTATE!=='ready')return;const dk=vecDark();
 if(VEC._dark!==dk){VEC._dark=dk;VEC.setStyle(vecStyle(dk))}
 const k=mW+'x'+mH;if(VECCUR!==k){VECCUR=k;VEC.resize()}
 const[la,lo]=latlon(MV.x,MV.y);VEC.jumpTo({center:[lo,la],zoom:MV.z-1})}
const vecOn=()=>BM==='vector'&&VECSTATE==='ready';
function osmOn(){return BM==='osm'}
function drawBase(c){
 if(BM==='vector')vecEnsure();
 if(vecOn()){vecSync();TILES=true;return}
 c.fillStyle=css('--field');c.fillRect(0,0,mW,mH);
 TILES=osmOn();if(TILES)drawTiles(c)}
const attrib=()=>vecOn()?'© OpenStreetMap · OpenFreeMap':osmOn()?'© OpenStreetMap-Mitwirkende':BM==='vector'&&VECSTATE!=='failed'?'Karte lädt …':'Raster statt Karte';

/* ---------- Höhe, Puls, Tempo aus dem Tracker-Verlauf (das Add-on schreibt sie je LiveTrack-Punkt) ---------- */
let HASSREF=null;
const trackerOf=(hass,w)=>Object.values(hass.states||{}).find(x=>x.entity_id.startsWith('device_tracker.garmin_inreach_relay_position_')&&!/inreach_\d+$|messengerapp/.test(x.entity_id)&&whoOfName(String((x.attributes||{}).friendly_name||''))===w);
function climbOf(h){let g=0,l=0,ref=null;for(const x of h){if(ref==null){ref=x;continue}if(x-ref>=3){g+=x-ref;ref=x}else if(ref-x>=3){l+=ref-x;ref=x}}return{gain:Math.round(g),loss:Math.round(l)}}
function hav(a,b,c,d){const r=Math.PI/180,p=(c-a)*r/2,q=(d-b)*r/2,h=Math.sin(p)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(q)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(h)))}
function trFromRows(rows){
 /* Ein Punkt gilt mit Zeit (sent_at) und mindestens einem Messwert (Höhe, Puls, Tempo oder Distanz); Position ist optional.
    Nichts wird erfunden: was im Verlauf fehlt, wird nicht gezeichnet (nohr, nov, nod, ele=null). */
 const meas=a=>a.altitude_m!=null||a.elevation_m!=null||a.heart_rate>0||a.speed_ms!=null||a.speed_kmh!=null||a.distance_m!=null;
 const R=rows.filter(a=>a&&a.sent_at&&meas(a)).map(a=>({t:Date.parse(a.sent_at)/1000,a})).filter(r=>isFinite(r.t)).sort((x,y)=>x.t-y.t);
 const U=[];for(const r of R)if(!U.length||r.t>U[U.length-1].t)U.push(r);
 if(U.length<2)return null;
 const step=Math.ceil(U.length/1500),P=step>1?U.filter((_,i)=>i%step===0||i===U.length-1):U;
 const hasPos=a=>a.latitude!=null&&a.longitude!=null,npos=P.filter(r=>hasPos(r.a)).length,pos=npos>=2;
 const hasEle=P.filter(r=>r.a.altitude_m!=null||r.a.elevation_m!=null).length>=P.length*.5; /* wie bisher: mindestens die Hälfte der Punkte */
 const anyD=P.some(r=>r.a.distance_m!=null),anyS=P.some(r=>r.a.speed_ms!=null||r.a.speed_kmh!=null),anyH=P.some(r=>r.a.heart_rate>0);
 if(!hasEle&&!anyD&&!anyS&&!anyH)return null;
 const t0=P[0].t,lat=[],lon=[],ele=[],hr=[],v=[],d=[],t=[];let le=null,lh=0,dd=0,pi=-1;
 P.forEach((r,i)=>{const a=r.a,hp=pos&&hasPos(a);t.push(r.t-t0);lat.push(hp?a.latitude:null);lon.push(hp?a.longitude:null);
  const e=a.altitude_m!=null?a.altitude_m:a.elevation_m;if(e!=null)le=e;ele.push(le);
  if(a.heart_rate>0)lh=a.heart_rate;hr.push(lh);
  if(a.distance_m!=null)dd=Math.max(dd,a.distance_m);else if(hp&&pi>=0)dd+=hav(lat[pi],lon[pi],a.latitude,a.longitude);if(hp)pi=i;d.push(dd);
  v.push(a.speed_ms!=null?a.speed_ms:a.speed_kmh!=null?a.speed_kmh/3.6:null)});
 const nod=!anyD&&!pos;
 if(hasEle){const first=ele.find(x=>x!=null);for(let i=0;i<ele.length&&ele[i]==null;i++)ele[i]=first}
 /* Tempo: gemeldeter Wert; fehlt er an einzelnen Punkten, kommt er aus Distanz und Zeit (nur mit echter Distanz), sonst gilt der letzte gemeldete Wert */
 const nov=!anyS&&nod;let lv=null;
 for(let i=0;i<v.length;i++){if(v[i]!=null){lv=v[i];continue}
  if(nod){v[i]=lv!=null?lv:0;continue}
  const a=Math.max(0,i-2),b=Math.min(v.length-1,i+2),dt=t[b]-t[a];v[i]=dt>0?Math.max(0,(d[b]-d[a])/dt):0}
 const T={lat:pos?lat:null,lon:pos?lon:null,ele:hasEle?ele:null,hr,v,d:nod?t.map(()=>0):d,t,npos:pos?npos:0};
 if(!anyH)T.nohr=true;if(nod)T.nod=true;if(nov)T.nov=true;return T}
function applyTr(a,T,live){
 /* Karte nur mit Positionen; ohne Positionen bleibt, was die Aktivität schon hat (Route aus route_vereinfacht oder nichts) */
 a.tr=T;a._trd=1;
 if(T.lat&&T.npos>=2){const idx=[];T.lat.forEach((la,i)=>{if(la!=null)idx.push(i)});
  const ll=idx.map(i=>[T.lat[i],T.lon[i]]),ww=ll.map(p=>W0(p[0],p[1]));
  /* Deckt der Verlauf (LiveTrack) die Tour nicht vollständig ab (später gestartet, Lücken, früher beendet), bleibt die volle Route aus dem Routen-Sensor gezeichnet.
     Der Verlauf liefert dann nur die Position für den Cursor im Profil (wc). */
  let plen=0;for(let i=1;i<ll.length;i++)plen+=hav(ll[i-1][0],ll[i-1][1],ll[i][0],ll[i][1]);
  const keep=!live&&a.w&&a.w.length>1&&a.st&&a.st.dist>0&&plen<a.st.dist*.97;
  if(keep){a.wc=ww}else{a.ll=ll;a.w=ww;a.gps=a.w.length>1;a.wc=null}
  if(idx.length<T.lat.length){/* Lücken in den Positionen: Profilpunkt ohne eigene Position zeigt die zuletzt bekannte, davor keine (-1) */
   let k=-1,j=0;T.wi=T.t.map((_,i)=>{while(j<idx.length&&idx[j]<=i){k=j;j++}return k})}}
 const c=T.ele?climbOf(T.ele):{gain:a.st.gain||0,loss:a.st.loss||0},hrs=T.nohr?[]:T.hr.filter(x=>x>0),n=T.d.length-1;
 if(live){const dist=T.nod?(a.st.dist||0):Math.max(a.st.dist||0,T.d[n]),dur=Math.max(a.st.dur||0,T.t[n]);
  a.st=Object.assign({},a.st,{dist,dur,elapsed:dur,gain:c.gain,loss:c.loss,avgHR:hrs.length?hrs.reduce((x,y)=>x+y,0)/hrs.length:a.st.avgHR,maxHR:hrs.length?Math.max(...hrs):0,avgV:dur?dist/dur*3.6:0,maxV:T.nov?(a.st.maxV||0):Math.max(...T.v)*3.6})}
 else{if(!(a.st.gain>0))a.st.gain=c.gain;if(!(a.st.loss>0))a.st.loss=c.loss;if(!(a.st.maxHR>0)&&hrs.length)a.st.maxHR=Math.max(...hrs)}}
const needTr=a=>LIVE&&HASSREF&&!a.live&&!a.tr&&!a._trTried&&a.st&&a.st.dur>0;
async function loadTr(a){
 a._trTried=true;const hass=HASSREF,ent=trackerOf(hass,a.who);if(!ent)return false;
 const t0=a.date.getTime(),t1=t0+a.st.dur*1000;
 try{const h=await hass.callWS({type:'history/history_during_period',start_time:new Date(t0-6e5).toISOString(),end_time:new Date(t1+9e5).toISOString(),entity_ids:[ent.entity_id],include_start_time_state:false,significant_changes_only:false,minimal_response:false,no_attributes:false});
  const rows=(h[ent.entity_id]||[]).map(x=>x.a||x.attributes).filter(r=>r&&r.source==='livetrack');
  const by={};for(const r of rows){const k=r.livetrack_session||'?';(by[k]=by[k]||[]).push(r)}
  const best=Object.values(by).sort((x,y)=>y.length-x.length)[0];if(!best||best.length<20)return false;
  const T=trFromRows(best);if(!T||T.t[T.t.length-1]<a.st.dur*.5)return false;
  applyTr(a,T,false);return true}catch(e){return false}}

/* ---------- Lang drücken auf eine Kachel: Datensatz im HA-Verlauf öffnen ---------- */
const HLP={sleep:['schlafwert','gesamtschlafdauer','tiefschlaf','rem_schlaf'],rec:['hrv_letzte_nacht_durchschnitt','ruhepuls','body_battery'],act:['schritte','kalorien'],str:['durchschnittliches_stresslevel'],body:['gewicht','vo2max']};
const HLM={steps:['schritte'],rhr:['ruhepuls'],hrv:['hrv_letzte_nacht_durchschnitt'],sleep:['schlafwert','gesamtschlafdauer']};
function idsFor(ws,names){const ids=[],st=HASSREF.states||{};for(const x of ws)for(const n of names){const r=FD.pickState(st,puOf(x),UNAME[x],n),id=r.src==='personal'?FD.personalId(puOf(x),n):r.src==='connect'?FD.connectId(UNAME[x],n):FD.candidateIds(st,puOf(x),UNAME[x],n)[0];if(id&&st[id])ids.push(id)}return ids}
function goHistory(ids,from,to){if(!ids.length)return false;const q=new URLSearchParams({entity_id:ids.join(','),start_date:from.toISOString(),end_date:to.toISOString()});history.pushState(null,'','/history?'+q.toString());window.dispatchEvent(new CustomEvent('location-changed',{detail:{replace:false}}));return true}
function trendHistory(){
 if(!LIVE||!HASSREF||!S.thist)return false;const names=HLM[S.metric];if(!names)return false;
 return goHistory(idsFor(persons(),names),S.thist.from,S.thist.to)}
function historyTo(card){
 if(!LIVE||!HASSREF)return false;
 const k=card.dataset.k,w=card.dataset.w,ws=w==='pair'?['p1','p2']:[w],names=HLP[k];if(!names)return false;
 const ids=idsFor(ws,names);
 if(!ids.length)return false;
 const d0=new Date(START.getFullYear(),START.getMonth(),START.getDate()+(S.day||0)),from=new Date(d0.getTime()-(k==='sleep'||k==='rec'?6*36e5:0)),to=new Date(d0.getFullYear(),d0.getMonth(),d0.getDate()+1);
 return goHistory(ids,from,to)}
(function initLongPress(){
 let tm=0,x0=0,y0=0,fired=0;
 const stop=()=>{clearTimeout(tm);tm=0};
 root.addEventListener('pointerdown',e=>{const c=e.target.closest&&e.target.closest('.dcard'),tr=!c&&e.target.closest&&e.target.closest('#tc,#tk,#mets');if(!(c||tr)||e.button>0)return;x0=e.clientX;y0=e.clientY;stop();
  tm=setTimeout(()=>{tm=0;if(c?historyTo(c):trendHistory())fired=Date.now()},550)});
 root.addEventListener('pointermove',e=>{if(tm&&Math.hypot(e.clientX-x0,e.clientY-y0)>10)stop()});
 for(const t of['pointerup','pointercancel','pointerleave'])root.addEventListener(t,stop);
 root.addEventListener('click',e=>{if(Date.now()-fired<800){e.stopPropagation();e.preventDefault()}},true);
 root.addEventListener('contextmenu',e=>{if(e.target.closest&&e.target.closest('.dcard,#tc,#tk,#mets'))e.preventDefault()});
 /* Tastatur: Pfeile blättern Tag (Heute) oder Tour (Touren), Esc schließt das Blatt */
 if(host._kh)document.removeEventListener('keydown',host._kh);
 host._kh=e=>{if(!host.isConnected||!started||SH||e.altKey||e.ctrlKey||e.metaKey)return;const t=e.composedPath&&e.composedPath()[0];if(t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName||''))return;
  const d=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0;if(!d)return;
  if(S.tab==='heute'){const n=Math.max(0,Math.min(ND,S.day+d));if(n!==S.day){S.day=n;S.pwin=null;e.preventDefault();render()}}
  else if(S.tab==='tour'&&S.sel){e.preventDefault();step(d)}};
 document.addEventListener('keydown',host._kh);
 const hb=root.querySelector('#hamb');if(hb){hb.hidden=!(host._cfg&&host._cfg.menu);hb.onclick=()=>host.dispatchEvent(new Event('hass-toggle-menu',{bubbles:true,composed:true}))}
})();

const dateNote=()=>dfmt(START,{day:"numeric",month:"long"});
function redrawTheme(){if(S&&S.tab==='tour'){drawMap();drawScrub()}}
function showMsg(t){$('#view').innerHTML='<div class="card muted">'+esc(t)+'</div>'}
let started=false;
function startDemo(){BM='none';TILES=false;initDemo();initState();WHO=[['p1',PERS.p1.n],['p2',PERS.p2.n],['both','Beide (Test)']];started=true;$('.demo').hidden=false;render()}
async function startLive(hass,cfg,me){
 applyCfg(cfg);WHO=[['p1',PERS.p1.n],['p2',PERS.p2.n],['both','Beide']];
 const who=cfg.pair?['p1','p2']:[me];
 $('.demo').hidden=true;showMsg('Daten werden geladen …');
 try{await loadLive(hass,cfg,who)}catch(e){showMsg('Daten konnten nicht geladen werden: '+(e&&e.message||e));return false}
 LIVE=true;ME=me;cfgRef=cfg;BM=cfg.basemap||(cfg.tiles===false?'none':'vector');TILES=false;initState();S.who=me;
 WHO=who.map(k=>[k,PERS[k].n]);if(who.length>1)WHO.push(['both','Beide']);
 started=true;render();return true}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&SH)closeSheet()});
document.addEventListener('keydown',trapTab);
return{startDemo,startLive,refreshLive:async(h,cfg,me)=>{if(!started||!LIVE)return;await refreshLive(h,cfg.pair?['p1','p2']:[me]);if(!SH)render()},redrawTheme,get started(){return started},render:()=>{if(started&&!SH)render()}}

}
class FitnessCard extends HTMLElement{
 constructor(){super();this._root=this.attachShadow({mode:'open'});this._cfg={};this._hass=null;this._app=null;this._tid=0}
 setConfig(c){this._cfg=Object.assign({pair:false,archive:false,demo:false,users:{}},c||{});try{this._build()}catch(e){console.error('fitness-card v7',e);this._root.innerHTML='<div style="padding:16px;font:14px system-ui;color:#b3261e;white-space:pre-wrap">fitness-card v7: '+String(e&&e.stack||e).replace(/</g,'&lt;')+'</div>'}}
 getCardSize(){return 14}
 getGridOptions(){return{columns:'full',rows:'auto'}}
 static getStubConfig(){return{demo:true}}
 _build(){
  const r=this._root;r.innerHTML='<style>'+CSS+'</style><div class="app">'+HTML+'</div>';
  this._app=createApp(this,r,{});this._started=false;this._dark=null;
  if(this._cfg.demo){this._app.startDemo();this._started=true}else if(this._hass)this._begin()}
 set hass(h){
  this._hass=h;const dark=!!(h.themes&&h.themes.darkMode);
  if(dark!==this._dark){this._dark=dark;this.setAttribute('data-theme',dark?'dark':'light');if(this._app&&this._app.started)this._app.redrawTheme()}
  if(!this._started&&this._app&&!this._cfg.demo)this._begin();
  else if(this._app&&this._app.started&&!this._cfg.demo){const sig=liveSigOf(h);if(sig!==this._lsig&&Date.now()-(this._lt||0)>20000){this._lsig=sig;this._lt=Date.now();const me=this._me();if(me)this._app.refreshLive(h,this._cfg,me)}}}
 _me(){const c=this._cfg,id=this._hass&&this._hass.user&&this._hass.user.id;if(c.person)return c.person;
  for(const k of['p1','p2'])if(c.users&&c.users[k]===id)return k;return null}
 async _begin(){
  const me=this._me();this._started=true;
  if(!me){this._root.querySelector('#view').innerHTML='<div class="card muted">Dieser Nutzer ist der Karte nicht zugeordnet (Option users oder person).</div>';return}
  let ok=false;try{ok=await this._app.startLive(this._hass,this._cfg,me)}catch(e){console.error('fitness-card v7 live',e);const v=this._root.querySelector('#view');if(v)v.innerHTML='<div class="card muted" style="white-space:pre-wrap">fitness-card v7: '+String(e&&e.stack||e).replace(/</g,'&lt;')+'</div>'}
  clearInterval(this._tid);if(ok)this._tid=setInterval(()=>{if(!this._app)return;this._app.startLive(this._hass,this._cfg,me)},15*60*1000)}
 connectedCallback(){if(this._kh)document.addEventListener('keydown',this._kh)}
 disconnectedCallback(){clearInterval(this._tid);if(this._kh)document.removeEventListener('keydown',this._kh)}
}
customElements.define('fitness-card',FitnessCard);
window.customCards=window.customCards||[];window.customCards.push({type:'fitness-card',name:'Fitness',description:'Fitness-Zeitstrahl für zwei Personen'});
})();
