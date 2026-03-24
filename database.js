const fs=require("fs"),path=require("path"),DB=path.join(__dirname,"data.json");
const DEF={bugs:[],comments:[],developers:[],configs:[],history:[],warnings:[],notes:[],welcomes:[],betaKeys:[],usedKeys:[],betaApps:[],tickets:[],suggestions:[],announcements:[],members:[],invites:[],giveaways:[],polls:[],automod:{banned_words:[],max_caps:70,max_mentions:5,spam_count:5,spam_ms:3000},nBug:1,nApp:1,nTkt:1,nSug:1,nGiv:1,nPol:1};
function ld(){try{if(fs.existsSync(DB)){const d=JSON.parse(fs.readFileSync(DB,"utf-8"));for(const k of Object.keys(DEF))if(!(k in d))d[k]=typeof DEF[k]==="object"&&!Array.isArray(DEF[k])?{...DEF[k]}:Array.isArray(DEF[k])?[]:DEF[k];return d;}}catch(e){console.error("DB:",e.message);}return JSON.parse(JSON.stringify(DEF));}
function sv(d){fs.writeFileSync(DB,JSON.stringify(d,null,2),"utf-8");}
function now(){return new Date().toISOString().replace("T"," ").slice(0,19);}
function pad(n){return String(n).padStart(4,"0");}
function so(s){return{critical:1,high:2,medium:3,low:4}[s]||5;}
const db={
// MEMBERS & LEVELING (score = invites*50 + bugs*30 + messages)
getMem(uid){const d=ld();let m=d.members.find(x=>x.uid===uid);if(!m){m={uid,name:"",xp:0,lvl:0,bugs:0,invs:0,msgs:0,joined:now()};d.members.push(m);sv(d);}return m;},
updMem(uid,u){const d=ld();let m=d.members.find(x=>x.uid===uid);if(!m){m={uid,name:"",xp:0,lvl:0,bugs:0,invs:0,msgs:0,joined:now()};d.members.push(m);}Object.assign(m,u);sv(d);},
trackMsg(uid,name){const d=ld();let m=d.members.find(x=>x.uid===uid);if(!m){m={uid,name,xp:0,lvl:0,bugs:0,invs:0,msgs:0,joined:now()};d.members.push(m);}m.name=name;m.msgs++;m.xp=m.invs*50+m.bugs*30+m.msgs;const nl=Math.floor(m.xp/100);const up=nl>m.lvl;m.lvl=nl;sv(d);return{xp:m.xp,lvl:m.lvl,up};},
incBugs(uid){const d=ld();const m=d.members.find(x=>x.uid===uid);if(m){m.bugs++;m.xp=m.invs*50+m.bugs*30+m.msgs;m.lvl=Math.floor(m.xp/100);sv(d);}},
incInvs(uid){const d=ld();const m=d.members.find(x=>x.uid===uid);if(m){m.invs++;m.xp=m.invs*50+m.bugs*30+m.msgs;m.lvl=Math.floor(m.xp/100);sv(d);}},
topMembers(){return ld().members.map(m=>({...m,score:m.invs*50+m.bugs*30+m.msgs})).sort((a,b)=>b.score-a.score).slice(0,15);},
storeInvs(inv){const d=ld();d.invites=inv;sv(d);},
getInvs(){return ld().invites;},
// BUGS
mkBug(f){const d=ld();const b={id:d.nBug++,tag:`GAME-${pad(d.nBug-1)}`,title:f.title,desc:f.desc,steps:f.steps||"",sev:f.sev,status:"open",plat:f.plat||"all",cat:f.cat||"gameplay",by:f.uid,byN:f.name,to:null,toN:null,chId:null,msgId:null,thId:null,at:now(),upd:now(),resAt:null,resNote:null,votes:[]};d.bugs.push(b);d.history.push({bid:b.id,act:"created",by:f.name,at:now()});sv(d);return b;},
getBug(id){return ld().bugs.find(b=>b.id===id)||null;},
assignBug(id,uid,n){const d=ld(),b=d.bugs.find(x=>x.id===id);if(!b)return;b.to=uid;b.toN=n;b.status="in-progress";b.upd=now();d.history.push({bid:id,act:"assigned",by:n,at:now(),det:n});sv(d);},
resolveBug(id,note,by){const d=ld(),b=d.bugs.find(x=>x.id===id);if(!b)return;b.status="resolved";b.resNote=note;b.resAt=now();b.upd=now();d.history.push({bid:id,act:"resolved",by,at:now(),det:note});sv(d);},
closeBug(id,by){const d=ld(),b=d.bugs.find(x=>x.id===id);if(!b)return;b.status="closed";b.upd=now();d.history.push({bid:id,act:"closed",by,at:now()});sv(d);},
reopenBug(id,by){const d=ld(),b=d.bugs.find(x=>x.id===id);if(!b)return;b.status="open";b.resAt=null;b.resNote=null;b.upd=now();d.history.push({bid:id,act:"reopened",by,at:now()});sv(d);},
unassignBug(id,by){const d=ld(),b=d.bugs.find(x=>x.id===id);if(!b)return;b.to=null;b.toN=null;b.status="open";b.upd=now();d.history.push({bid:id,act:"unassigned",by,at:now()});sv(d);},
setRef(id,ch,msg){const d=ld(),b=d.bugs.find(x=>x.id===id);if(b){b.chId=ch;b.msgId=msg;sv(d);}},
setTh(id,th){const d=ld(),b=d.bugs.find(x=>x.id===id);if(b){b.thId=th;sv(d);}},
vote(id,uid){const d=ld(),b=d.bugs.find(x=>x.id===id);if(!b)return 0;const i=b.votes.indexOf(uid);if(i>=0)b.votes.splice(i,1);else b.votes.push(uid);sv(d);return b.votes.length;},
bugsBy(s){return ld().bugs.filter(b=>b.status===s).sort((a,b)=>so(a.sev)-so(b.sev)).slice(0,25);},
bugsActive(){return ld().bugs.filter(b=>["open","in-progress"].includes(b.status)).sort((a,b)=>so(a.sev)-so(b.sev)).slice(0,25);},
bugsDev(uid){return ld().bugs.filter(b=>b.to===uid&&["open","in-progress"].includes(b.status)).slice(0,25);},
bugsUser(uid){return ld().bugs.filter(b=>b.by===uid).reverse().slice(0,25);},
bugsSev(s){return ld().bugs.filter(b=>b.sev===s&&["open","in-progress"].includes(b.status)).slice(0,25);},
bugsCat(c){return ld().bugs.filter(b=>b.cat===c&&["open","in-progress"].includes(b.status)).sort((a,b)=>so(a.sev)-so(b.sev)).slice(0,25);},
search(q){const l=q.toLowerCase();return ld().bugs.filter(b=>b.title.toLowerCase().includes(l)||b.desc.toLowerCase().includes(l)||b.tag.toLowerCase().includes(l)).reverse().slice(0,15);},
addCmt(bid,uid,n,txt){const d=ld();d.comments.push({bid,uid,name:n,txt,at:now()});sv(d);},
getCmts(bid){return ld().comments.filter(c=>c.bid===bid).slice(-10);},
getHist(bid){return ld().history.filter(h=>h.bid===bid).slice(-15);},
// DEVS
regDev(uid,n,role,spec){const d=ld(),i=d.developers.findIndex(x=>x.uid===uid);const dv={uid,name:n,role,spec,resolved:0,at:now()};if(i>=0){dv.resolved=d.developers[i].resolved;d.developers[i]=dv;}else d.developers.push(dv);sv(d);},
devs(){return[...ld().developers].sort((a,b)=>b.resolved-a.resolved);},
incRes(uid){const d=ld(),dv=d.developers.find(x=>x.uid===uid);if(dv){dv.resolved++;sv(d);}},
devLb(){return[...ld().developers].sort((a,b)=>b.resolved-a.resolved).slice(0,10);},
// WARNINGS/NOTES
warn(uid,n,reason,by){const d=ld();d.warnings.push({uid,name:n,reason,by,at:now()});sv(d);return d.warnings.filter(w=>w.uid===uid).length;},
warns(uid){return ld().warnings.filter(w=>w.uid===uid);},
note(uid,n,note,by){const d=ld();d.notes.push({uid,name:n,note,by,at:now()});sv(d);},
notes(uid){return ld().notes.filter(n=>n.uid===uid);},
welcome(uid,n){const d=ld();d.welcomes.push({uid,name:n,at:now()});sv(d);},
// CONFIG
getCfg(gid){return ld().configs.find(c=>c.gid===gid)||null;},
setCfg(gid,data){const d=ld(),i=d.configs.findIndex(c=>c.gid===gid);if(i>=0)d.configs[i]={gid,...data};else d.configs.push({gid,...data});sv(d);},
// AUTOMOD
getAM(){return ld().automod;},
addBan(w){const d=ld();if(!d.automod.banned_words.includes(w.toLowerCase())){d.automod.banned_words.push(w.toLowerCase());sv(d);}},
rmBan(w){const d=ld();d.automod.banned_words=d.automod.banned_words.filter(x=>x!==w.toLowerCase());sv(d);},
// BETA
addKeys(keys){const d=ld();let n=0;keys.forEach(k=>{if(!d.betaKeys.find(x=>x.key===k)&&!d.usedKeys.find(x=>x.key===k)){d.betaKeys.push({key:k,at:now()});n++;}});sv(d);return{added:n,total:d.betaKeys.length};},
usedKeys(){return ld().usedKeys;},
clearKeys(){const d=ld();const n=d.betaKeys.length;d.betaKeys=[];sv(d);return n;},
applyBeta(uid,n,reason,plat){const d=ld();if(d.betaApps.find(a=>a.uid===uid&&a.status==="pending"))return{err:"pending"};if(d.usedKeys.find(x=>x.uid===uid))return{err:"has_key"};const a={id:d.nApp++,uid,name:n,reason,plat,status:"pending",at:now(),reviewer:null,reviewAt:null,key:null};d.betaApps.push(a);sv(d);return a;},
getApp(id){return ld().betaApps.find(a=>a.id===id)||null;},
apps(s){return s?ld().betaApps.filter(a=>a.status===s):ld().betaApps;},
approveApp(id,rev){const d=ld(),a=d.betaApps.find(x=>x.id===id);if(!a||a.status!=="pending")return{err:"invalid"};if(!d.betaKeys.length)return{err:"no_keys"};const k=d.betaKeys.shift();a.status="approved";a.reviewer=rev;a.reviewAt=now();a.key=k.key;d.usedKeys.push({key:k.key,uid:a.uid,name:a.name,at:now()});sv(d);return{app:a,key:k.key};},
rejectApp(id,rev){const d=ld(),a=d.betaApps.find(x=>x.id===id);if(!a||a.status!=="pending")return{err:"invalid"};a.status="rejected";a.reviewer=rev;a.reviewAt=now();sv(d);return a;},
betaSt(){const d=ld();return{pool:d.betaKeys.length,used:d.usedKeys.length,pending:d.betaApps.filter(a=>a.status==="pending").length,approved:d.betaApps.filter(a=>a.status==="approved").length,rejected:d.betaApps.filter(a=>a.status==="rejected").length};},
// TICKETS
mkTkt(uid,n,cat,desc){const d=ld();const t={id:d.nTkt++,tag:`TKT-${pad(d.nTkt-1)}`,uid,name:n,cat,desc,status:"open",chId:null,claimUid:null,claimN:null,at:now(),closedAt:null,closeReason:null};d.tickets.push(t);sv(d);return t;},
getTkt(id){return ld().tickets.find(t=>t.id===id)||null;},
getTktByCh(ch){return ld().tickets.find(t=>t.chId===ch)||null;},
setTktCh(id,ch){const d=ld(),t=d.tickets.find(x=>x.id===id);if(t){t.chId=ch;sv(d);}},
claimTkt(id,uid,n){const d=ld(),t=d.tickets.find(x=>x.id===id);if(t){t.claimUid=uid;t.claimN=n;sv(d);}},
closeTkt(id,r){const d=ld(),t=d.tickets.find(x=>x.id===id);if(t){t.status="closed";t.closedAt=now();t.closeReason=r||"Closed";sv(d);}},
openTkts(){return ld().tickets.filter(t=>t.status==="open");},
tktSt(){const t=ld().tickets;return{total:t.length,open:t.filter(x=>x.status==="open").length,closed:t.filter(x=>x.status==="closed").length};},
// SUGGESTIONS
mkSug(uid,n,title,desc,cat){const d=ld();const s={id:d.nSug++,tag:`IDEA-${pad(d.nSug-1)}`,uid,name:n,title,desc,cat:cat||"general",status:"open",up:[],dn:[],resp:null,respBy:null,msgId:null,chId:null,at:now()};d.suggestions.push(s);sv(d);return s;},
getSug(id){return ld().suggestions.find(s=>s.id===id)||null;},
setSugMsg(id,ch,msg){const d=ld(),s=d.suggestions.find(x=>x.id===id);if(s){s.chId=ch;s.msgId=msg;sv(d);}},
voteSug(id,uid,type){const d=ld(),s=d.suggestions.find(x=>x.id===id);if(!s)return null;s.up=s.up.filter(u=>u!==uid);s.dn=s.dn.filter(u=>u!==uid);if(type==="up")s.up.push(uid);else s.dn.push(uid);sv(d);return{up:s.up.length,dn:s.dn.length};},
respSug(id,st,resp,by){const d=ld(),s=d.suggestions.find(x=>x.id===id);if(!s)return null;s.status=st;s.resp=resp;s.respBy=by;sv(d);return s;},
sugs(st){const a=ld().suggestions;return(st?a.filter(s=>s.status===st):a).sort((a,b)=>(b.up.length-b.dn.length)-(a.up.length-a.dn.length)).slice(0,25);},
topSugs(){return ld().suggestions.filter(s=>s.status==="open").sort((a,b)=>(b.up.length-b.dn.length)-(a.up.length-a.dn.length)).slice(0,10);},
// GIVEAWAY
mkGiv(prize,dur,winners,host){const d=ld();const g={id:d.nGiv++,prize,ends:new Date(Date.now()+dur).toISOString(),winCt:winners,host,chId:null,msgId:null,entries:[],status:"active",winners:[],at:now()};d.giveaways.push(g);sv(d);return g;},
getGiv(id){return ld().giveaways.find(g=>g.id===id)||null;},
enterGiv(id,uid){const d=ld(),g=d.giveaways.find(x=>x.id===id);if(!g||g.status!=="active"||g.entries.includes(uid))return false;g.entries.push(uid);sv(d);return true;},
endGiv(id){const d=ld(),g=d.giveaways.find(x=>x.id===id);if(!g)return null;g.status="ended";const pool=[...g.entries],w=[];for(let i=0;i<g.winCt&&pool.length;i++){const idx=Math.floor(Math.random()*pool.length);w.push(pool.splice(idx,1)[0]);}g.winners=w;sv(d);return{winners:w,prize:g.prize,count:g.entries.length};},
activeGivs(){return ld().giveaways.filter(g=>g.status==="active");},
// POLLS
mkPoll(q,opts,dur,author){const d=ld();const p={id:d.nPol++,q,opts:opts.map(o=>({t:o,v:[]})),dur,author,status:"active",msgId:null,chId:null,at:now(),ends:dur?new Date(Date.now()+dur).toISOString():null};d.polls.push(p);sv(d);return p;},
getPoll(id){return ld().polls.find(p=>p.id===id)||null;},
votePoll(id,oi,uid){const d=ld(),p=d.polls.find(x=>x.id===id);if(!p||p.status!=="active")return null;p.opts.forEach(o=>{o.v=o.v.filter(v=>v!==uid);});if(p.opts[oi])p.opts[oi].v.push(uid);sv(d);return p;},
endPoll(id){const d=ld(),p=d.polls.find(x=>x.id===id);if(p){p.status="ended";sv(d);}return p;},
setPollMsg(id,ch,msg){const d=ld(),p=d.polls.find(x=>x.id===id);if(p){p.chId=ch;p.msgId=msg;sv(d);}},
// ANNOUNCEMENTS
mkAnn(title,content,type,by){const d=ld();d.announcements.push({title,content,type,by,at:now()});sv(d);},
// STATS
bugStats(){const b=ld().bugs;return{total:b.length,open:b.filter(x=>x.status==="open").length,prog:b.filter(x=>x.status==="in-progress").length,resolved:b.filter(x=>x.status==="resolved").length,closed:b.filter(x=>x.status==="closed").length,critical:b.filter(x=>x.sev==="critical"&&["open","in-progress"].includes(x.status)).length,high:b.filter(x=>x.sev==="high"&&["open","in-progress"].includes(x.status)).length,today:b.filter(x=>x.at.startsWith(new Date().toISOString().slice(0,10))).length};},
};
module.exports={db};
