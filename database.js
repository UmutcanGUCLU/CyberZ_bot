const fs = require("fs");
const path = require("path");
const DB = path.join(__dirname, "data.json");

const DEF = {
  bugs: [], comments: [], developers: [], configs: [], history: [],
  warnings: [], notes: [], welcomes: [],
  betaKeys: [], usedKeys: [], betaApps: [],
  tickets: [], suggestions: [], announcements: [],
  members: [], invites: [], giveaways: [], polls: [],
  automod: { banned_words: ["kufur1","kufur2"], max_caps_percent: 70, max_mentions: 5, max_emojis: 10, spam_interval: 3000, spam_count: 5 },
  nextBugId: 1, nextAppId: 1, nextTicketId: 1, nextSuggId: 1, nextGiveId: 1, nextPollId: 1,
};

function load() {
  try { if (fs.existsSync(DB)) { const d = JSON.parse(fs.readFileSync(DB, "utf-8")); for (const k of Object.keys(DEF)) { if (!(k in d)) d[k] = typeof DEF[k]==="object" && !Array.isArray(DEF[k]) ? {...DEF[k]} : Array.isArray(DEF[k]) ? [] : DEF[k]; } return d; } } catch (e) { console.error("DB err:", e.message); }
  return JSON.parse(JSON.stringify(DEF));
}
function save(d) { fs.writeFileSync(DB, JSON.stringify(d, null, 2), "utf-8"); }
function now() { return new Date().toLocaleString("tr-TR"); }
function pad(n) { return String(n).padStart(4, "0"); }
function sevOrd(s) { return { critical:1, high:2, medium:3, low:4 }[s] || 5; }

const db = {
  // ==================== MEMBERS & LEVELING ====================
  getMember(uid) {
    const d = load();
    let m = d.members.find(x => x.user_id === uid);
    if (!m) { m = { user_id: uid, username: "", xp: 0, level: 0, bugs_reported: 0, invites: 0, messages: 0, joined_at: now(), daily_streak: 0, last_daily: null }; d.members.push(m); save(d); }
    return m;
  },
  updateMember(uid, updates) {
    const d = load(); let m = d.members.find(x => x.user_id === uid);
    if (!m) { m = { user_id: uid, username: "", xp: 0, level: 0, bugs_reported: 0, invites: 0, messages: 0, joined_at: now(), daily_streak: 0, last_daily: null }; d.members.push(m); }
    Object.assign(m, updates); save(d);
  },
  addXP(uid, amount) {
    const d = load(); let m = d.members.find(x => x.user_id === uid);
    if (!m) { m = { user_id: uid, username: "", xp: 0, level: 0, bugs_reported: 0, invites: 0, messages: 0, joined_at: now() }; d.members.push(m); }
    m.xp += amount;
    const newLvl = Math.floor(m.xp / 100);
    const leveled = newLvl > m.level;
    m.level = newLvl;
    save(d);
    return { xp: m.xp, level: m.level, leveled };
  },
  incBugReported(uid) {
    const d = load(); const m = d.members.find(x => x.user_id === uid);
    if (m) { m.bugs_reported = (m.bugs_reported||0) + 1; save(d); }
  },
  incInvites(uid) {
    const d = load(); const m = d.members.find(x => x.user_id === uid);
    if (m) { m.invites = (m.invites||0) + 1; save(d); }
  },
  // Score = (invites * 50) + (bugs_reported * 30) + (messages)
  getMemberScore(uid) {
    const m = this.getMember(uid);
    return (m.invites||0) * 50 + (m.bugs_reported||0) * 30 + (m.messages||0);
  },
  leaderboardMembers() {
    const d = load();
    return d.members.map(m => ({
      ...m, score: (m.invites||0) * 50 + (m.bugs_reported||0) * 30 + (m.messages||0)
    })).sort((a, b) => b.score - a.score).slice(0, 15);
  },
  // Track message for XP
  trackMessage(uid, username) {
    const d = load(); let m = d.members.find(x => x.user_id === uid);
    if (!m) { m = { user_id: uid, username, xp: 0, level: 0, bugs_reported: 0, invites: 0, messages: 0, joined_at: now() }; d.members.push(m); }
    m.username = username; m.messages = (m.messages||0) + 1;
    m.xp = (m.invites||0) * 50 + (m.bugs_reported||0) * 30 + m.messages;
    const newLvl = Math.floor(m.xp / 100);
    const leveled = newLvl > m.level;
    m.level = newLvl;
    save(d);
    return { xp: m.xp, level: m.level, leveled };
  },

  // ==================== INVITES ====================
  storeInvites(guildInvites) {
    const d = load(); d.invites = guildInvites; save(d);
  },
  getStoredInvites() { return load().invites; },

  // ==================== BUGS (same as before) ====================
  createBug(f) { const d=load(); const bug={id:d.nextBugId++,tag:`GAME-${pad(d.nextBugId-1)}`,title:f.title,description:f.description,steps:f.steps||"",severity:f.severity,status:"open",platform:f.platform||"all",category:f.category||"gameplay",reported_by:f.userId,reported_by_name:f.userName,assigned_to:null,assigned_to_name:null,channel_id:null,message_id:null,thread_id:null,created_at:now(),updated_at:now(),resolved_at:null,resolution_note:null,upvotes:[]}; d.bugs.push(bug); d.history.push({bug_id:bug.id,action:"olusturuldu",by:f.userName,at:now()}); save(d); return bug; },
  getBug(id) { return load().bugs.find(b=>b.id===id)||null; },
  assignBug(bid,uid,name) { const d=load(),b=d.bugs.find(x=>x.id===bid); if(!b)return; b.assigned_to=uid;b.assigned_to_name=name;b.status="in-progress";b.updated_at=now(); d.history.push({bug_id:bid,action:"atandi",by:name,at:now(),detail:name}); save(d); },
  resolveBug(bid,note,by) { const d=load(),b=d.bugs.find(x=>x.id===bid); if(!b)return; b.status="resolved";b.resolution_note=note;b.resolved_at=now();b.updated_at=now(); d.history.push({bug_id:bid,action:"cozuldu",by,at:now(),detail:note}); save(d); },
  closeBug(bid,by) { const d=load(),b=d.bugs.find(x=>x.id===bid); if(!b)return; b.status="closed";b.updated_at=now(); d.history.push({bug_id:bid,action:"kapatildi",by,at:now()}); save(d); },
  reopenBug(bid,by) { const d=load(),b=d.bugs.find(x=>x.id===bid); if(!b)return; b.status="open";b.resolved_at=null;b.resolution_note=null;b.updated_at=now(); d.history.push({bug_id:bid,action:"acildi",by,at:now()}); save(d); },
  unassignBug(bid,by) { const d=load(),b=d.bugs.find(x=>x.id===bid); if(!b)return; b.assigned_to=null;b.assigned_to_name=null;b.status="open";b.updated_at=now(); d.history.push({bug_id:bid,action:"birakildi",by,at:now()}); save(d); },
  setMsgRef(bid,chId,msgId) { const d=load(),b=d.bugs.find(x=>x.id===bid); if(b){b.channel_id=chId;b.message_id=msgId;save(d);} },
  setThread(bid,tid) { const d=load(),b=d.bugs.find(x=>x.id===bid); if(b){b.thread_id=tid;save(d);} },
  toggleUpvote(bid,uid) { const d=load(),b=d.bugs.find(x=>x.id===bid); if(!b)return 0; const i=b.upvotes.indexOf(uid); if(i>=0)b.upvotes.splice(i,1);else b.upvotes.push(uid); save(d); return b.upvotes.length; },
  listByStatus(s) { return load().bugs.filter(b=>b.status===s).sort((a,b)=>sevOrd(a.severity)-sevOrd(b.severity)).slice(0,25); },
  listActive() { return load().bugs.filter(b=>["open","in-progress"].includes(b.status)).sort((a,b)=>sevOrd(a.severity)-sevOrd(b.severity)).slice(0,25); },
  listByDev(uid) { return load().bugs.filter(b=>b.assigned_to===uid&&["open","in-progress"].includes(b.status)).slice(0,25); },
  listByReporter(uid) { return load().bugs.filter(b=>b.reported_by===uid).reverse().slice(0,25); },
  listBySeverity(s) { return load().bugs.filter(b=>b.severity===s&&["open","in-progress"].includes(b.status)).slice(0,25); },
  listByCategory(c) { return load().bugs.filter(b=>b.category===c&&["open","in-progress"].includes(b.status)).sort((a,b)=>sevOrd(a.severity)-sevOrd(b.severity)).slice(0,25); },
  search(q) { const l=q.toLowerCase(); return load().bugs.filter(b=>b.title.toLowerCase().includes(l)||b.description.toLowerCase().includes(l)||b.tag.toLowerCase().includes(l)).reverse().slice(0,15); },
  addComment(bid,uid,name,text) { const d=load(); d.comments.push({bug_id:bid,author_id:uid,author_name:name,content:text,created_at:now()}); save(d); },
  getComments(bid) { return load().comments.filter(c=>c.bug_id===bid).slice(-10); },
  getHistory(bid) { return load().history.filter(h=>h.bug_id===bid).slice(-15); },

  // ==================== DEVELOPERS ====================
  registerDev(uid,name,role,spec) { const d=load(),i=d.developers.findIndex(x=>x.user_id===uid); const dev={user_id:uid,username:name,role,specialty:spec,bugs_resolved:0,joined_at:now()}; if(i>=0){dev.bugs_resolved=d.developers[i].bugs_resolved;d.developers[i]=dev;}else d.developers.push(dev); save(d); },
  listDevs() { return [...load().developers].sort((a,b)=>b.bugs_resolved-a.bugs_resolved); },
  incResolved(uid) { const d=load(),dev=d.developers.find(x=>x.user_id===uid); if(dev){dev.bugs_resolved++;save(d);} },
  leaderboard() { return [...load().developers].sort((a,b)=>b.bugs_resolved-a.bugs_resolved).slice(0,10); },

  // ==================== WARNINGS/NOTES ====================
  addWarning(uid,uname,reason,by) { const d=load(); d.warnings.push({user_id:uid,username:uname,reason,by,at:now()}); save(d); return d.warnings.filter(w=>w.user_id===uid).length; },
  getWarnings(uid) { return load().warnings.filter(w=>w.user_id===uid); },
  addNote(uid,uname,note,by) { const d=load(); d.notes.push({user_id:uid,username:uname,note,by,at:now()}); save(d); },
  getNotes(uid) { return load().notes.filter(n=>n.user_id===uid); },
  addWelcome(uid,name) { const d=load(); d.welcomes.push({user_id:uid,username:name,at:now()}); save(d); },

  // ==================== CONFIG ====================
  getConfig(gid) { return load().configs.find(c=>c.guild_id===gid)||null; },
  setConfig(gid,data) { const d=load(),i=d.configs.findIndex(c=>c.guild_id===gid); const cfg={guild_id:gid,...data}; if(i>=0)d.configs[i]=cfg;else d.configs.push(cfg); save(d); },

  // ==================== AUTOMOD ====================
  getAutomod() { return load().automod; },
  setAutomod(settings) { const d=load(); d.automod={...d.automod,...settings}; save(d); },
  addBannedWord(w) { const d=load(); if(!d.automod.banned_words.includes(w.toLowerCase())){d.automod.banned_words.push(w.toLowerCase());save(d);} },
  removeBannedWord(w) { const d=load(); d.automod.banned_words=d.automod.banned_words.filter(x=>x!==w.toLowerCase()); save(d); },

  // ==================== BETA KEYS ====================
  addKeys(keys) { const d=load(); let added=0; keys.forEach(k=>{if(!d.betaKeys.find(x=>x.key===k)&&!d.usedKeys.find(x=>x.key===k)){d.betaKeys.push({key:k,added_at:now()});added++;}}); save(d); return{added,total:d.betaKeys.length}; },
  keyPoolCount() { return load().betaKeys.length; },
  listUsedKeys() { return load().usedKeys; },
  clearKeyPool() { const d=load(); const cnt=d.betaKeys.length; d.betaKeys=[]; save(d); return cnt; },
  applyBeta(userId,userName,reason,platform) { const d=load(); if(d.betaApps.find(a=>a.user_id===userId&&a.status==="pending"))return{error:"already_pending"}; if(d.usedKeys.find(x=>x.claimed_by===userId))return{error:"already_has_key"}; const app={id:d.nextAppId++,user_id:userId,user_name:userName,reason,platform,status:"pending",created_at:now(),reviewed_by:null,reviewed_at:null,key_given:null}; d.betaApps.push(app); save(d); return app; },
  getApp(id) { return load().betaApps.find(a=>a.id===id)||null; },
  listApps(status) { return status?load().betaApps.filter(a=>a.status===status):load().betaApps; },
  approveApp(appId,reviewerName) { const d=load(),app=d.betaApps.find(a=>a.id===appId); if(!app||app.status!=="pending")return{error:"invalid"}; if(!d.betaKeys.length)return{error:"no_keys"}; const keyObj=d.betaKeys.shift(); app.status="approved";app.reviewed_by=reviewerName;app.reviewed_at=now();app.key_given=keyObj.key; d.usedKeys.push({key:keyObj.key,claimed_by:app.user_id,claimed_by_name:app.user_name,claimed_at:now(),added_at:keyObj.added_at}); save(d); return{app,key:keyObj.key}; },
  rejectApp(appId,reviewerName) { const d=load(),app=d.betaApps.find(a=>a.id===appId); if(!app||app.status!=="pending")return{error:"invalid"}; app.status="rejected";app.reviewed_by=reviewerName;app.reviewed_at=now(); save(d); return app; },
  betaStats() { const d=load(); return{pool:d.betaKeys.length,used:d.usedKeys.length,pending:d.betaApps.filter(a=>a.status==="pending").length,approved:d.betaApps.filter(a=>a.status==="approved").length,rejected:d.betaApps.filter(a=>a.status==="rejected").length,total_apps:d.betaApps.length}; },

  // ==================== TICKETS ====================
  createTicket(userId,userName,category,description) { const d=load(); const t={id:d.nextTicketId++,tag:`TKT-${pad(d.nextTicketId-1)}`,user_id:userId,user_name:userName,category,description,status:"open",channel_id:null,claimed_by:null,claimed_by_name:null,created_at:now(),closed_at:null,close_reason:null}; d.tickets.push(t); save(d); return t; },
  getTicket(id) { return load().tickets.find(t=>t.id===id)||null; },
  getTicketByChannel(chId) { return load().tickets.find(t=>t.channel_id===chId)||null; },
  setTicketChannel(id,chId) { const d=load(),t=d.tickets.find(x=>x.id===id); if(t){t.channel_id=chId;save(d);} },
  claimTicket(id,uid,name) { const d=load(),t=d.tickets.find(x=>x.id===id); if(t){t.claimed_by=uid;t.claimed_by_name=name;save(d);} },
  closeTicket(id,reason) { const d=load(),t=d.tickets.find(x=>x.id===id); if(t){t.status="closed";t.closed_at=now();t.close_reason=reason||"Kapatildi";save(d);} },
  listOpenTickets() { return load().tickets.filter(t=>t.status==="open"); },
  ticketStats() { const t=load().tickets; return{total:t.length,open:t.filter(x=>x.status==="open").length,closed:t.filter(x=>x.status==="closed").length,unclaimed:t.filter(x=>x.status==="open"&&!x.claimed_by).length}; },

  // ==================== SUGGESTIONS ====================
  createSuggestion(userId,userName,title,description,category) { const d=load(); const s={id:d.nextSuggId++,tag:`IDEA-${pad(d.nextSuggId-1)}`,user_id:userId,user_name:userName,title,description,category:category||"genel",status:"open",upvotes:[],downvotes:[],admin_response:null,admin_name:null,message_id:null,channel_id:null,created_at:now()}; d.suggestions.push(s); save(d); return s; },
  getSugg(id) { return load().suggestions.find(s=>s.id===id)||null; },
  setSuggMsg(id,chId,msgId) { const d=load(),s=d.suggestions.find(x=>x.id===id); if(s){s.channel_id=chId;s.message_id=msgId;save(d);} },
  voteSugg(id,userId,type) { const d=load(),s=d.suggestions.find(x=>x.id===id); if(!s)return null; s.upvotes=s.upvotes.filter(u=>u!==userId);s.downvotes=s.downvotes.filter(u=>u!==userId); if(type==="up")s.upvotes.push(userId);else if(type==="down")s.downvotes.push(userId); save(d); return{up:s.upvotes.length,down:s.downvotes.length}; },
  respondSugg(id,status,response,adminName) { const d=load(),s=d.suggestions.find(x=>x.id===id); if(!s)return null; s.status=status;s.admin_response=response;s.admin_name=adminName; save(d); return s; },
  listSuggs(status) { const all=load().suggestions; return (status?all.filter(s=>s.status===status):all).sort((a,b)=>(b.upvotes.length-b.downvotes.length)-(a.upvotes.length-a.downvotes.length)).slice(0,25); },
  topSuggs() { return load().suggestions.filter(s=>s.status==="open").sort((a,b)=>(b.upvotes.length-b.downvotes.length)-(a.upvotes.length-a.downvotes.length)).slice(0,10); },

  // ==================== GIVEAWAY ====================
  createGiveaway(prize,duration,winners,hostName,channelId,messageId) { const d=load(); const g={id:d.nextGiveId++,prize,ends_at:new Date(Date.now()+duration).toISOString(),winner_count:winners,host:hostName,channel_id:channelId,message_id:messageId,entries:[],status:"active",winners_list:[],created_at:now()}; d.giveaways.push(g); save(d); return g; },
  getGiveaway(id) { return load().giveaways.find(g=>g.id===id)||null; },
  enterGiveaway(id,uid) { const d=load(),g=d.giveaways.find(x=>x.id===id); if(!g||g.status!=="active")return false; if(g.entries.includes(uid))return false; g.entries.push(uid); save(d); return true; },
  endGiveaway(id) {
    const d=load(),g=d.giveaways.find(x=>x.id===id); if(!g)return null;
    g.status="ended"; const winners=[];
    const pool=[...g.entries];
    for(let i=0;i<g.winner_count&&pool.length>0;i++){const idx=Math.floor(Math.random()*pool.length);winners.push(pool.splice(idx,1)[0]);}
    g.winners_list=winners; save(d); return{winners,prize:g.prize,entries:g.entries.length};
  },
  listActiveGiveaways() { return load().giveaways.filter(g=>g.status==="active"); },

  // ==================== POLLS ====================
  createPoll(question,options,duration,authorName) { const d=load(); const p={id:d.nextPollId++,question,options:options.map((o,i)=>({text:o,votes:[]})),duration,author:authorName,status:"active",message_id:null,channel_id:null,created_at:now(),ends_at:duration?new Date(Date.now()+duration).toISOString():null}; d.polls.push(p); save(d); return p; },
  getPoll(id) { return load().polls.find(p=>p.id===id)||null; },
  votePoll(id,optIdx,uid) { const d=load(),p=d.polls.find(x=>x.id===id); if(!p||p.status!=="active")return null; p.options.forEach(o=>{o.votes=o.votes.filter(v=>v!==uid);}); if(p.options[optIdx])p.options[optIdx].votes.push(uid); save(d); return p; },
  endPoll(id) { const d=load(),p=d.polls.find(x=>x.id===id); if(p){p.status="ended";save(d);} return p; },
  setPollMsg(id,chId,msgId) { const d=load(),p=d.polls.find(x=>x.id===id); if(p){p.channel_id=chId;p.message_id=msgId;save(d);} },

  // ==================== ANNOUNCEMENTS ====================
  createAnnouncement(title,content,type,authorName) { const d=load(); d.announcements.push({title,content,type,by:authorName,at:now()}); save(d); },

  // ==================== STATS ====================
  getStats() { const bugs=load().bugs; return{total:bugs.length,open:bugs.filter(b=>b.status==="open").length,in_progress:bugs.filter(b=>b.status==="in-progress").length,resolved:bugs.filter(b=>b.status==="resolved").length,closed:bugs.filter(b=>b.status==="closed").length,critical:bugs.filter(b=>b.severity==="critical"&&["open","in-progress"].includes(b.status)).length,high:bugs.filter(b=>b.severity==="high"&&["open","in-progress"].includes(b.status)).length,today:bugs.filter(b=>b.created_at.startsWith(new Date().toLocaleDateString("tr-TR"))).length}; },
};

module.exports = { db };
