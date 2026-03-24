require("dotenv").config();
const{Client,GatewayIntentBits:I,PermissionsBitField:P,ChannelType:CH,ModalBuilder:MB,TextInputBuilder:TI,TextInputStyle:TS,ActionRowBuilder:AR,EmbedBuilder:EB,Events:EV,REST,Routes,SlashCommandBuilder:SC}=require("discord.js");
const{db}=require("./database");
const E=require("./embeds");
const cl=new Client({intents:[I.Guilds,I.GuildMembers,I.GuildMessages,I.MessageContent,I.GuildInvites]});

cl.once(EV.ClientReady,async()=>{
console.log(`\n  Bot online: ${cl.user.tag} | ${cl.guilds.cache.size} servers\n`);
cl.user.setActivity("/setup | Studio Bot v7");
try{console.log("  Registering commands...");
const cmds=[
new SC().setName("setup").setDescription("Setup server (channels + roles + panels)").setDefaultMemberPermissions(0),
new SC().setName("reset").setDescription("Delete all bot channels and categories").setDefaultMemberPermissions(0),
new SC().setName("panel").setDescription("Place bug panel").setDefaultMemberPermissions(0),
new SC().setName("admin-panel").setDescription("Place admin panel").setDefaultMemberPermissions(0),
new SC().setName("ticket-panel").setDescription("Place ticket panel").setDefaultMemberPermissions(0),
new SC().setName("sugg-panel").setDescription("Place suggestion panel").setDefaultMemberPermissions(0),
new SC().setName("beta-panel").setDescription("Place beta panel").setDefaultMemberPermissions(0),
new SC().setName("beta-admin").setDescription("Place beta key mgmt panel").setDefaultMemberPermissions(0),
new SC().setName("verify-panel").setDescription("Place verification panel").setDefaultMemberPermissions(0),
new SC().setName("reaction-roles").setDescription("Place platform select panel").setDefaultMemberPermissions(0),
new SC().setName("automod-panel").setDescription("Place automod panel").setDefaultMemberPermissions(0),
new SC().setName("bug").setDescription("View bug").addIntegerOption(o=>o.setName("id").setDescription("Bug ID").setRequired(true)),
new SC().setName("bugs").setDescription("List bugs").addStringOption(o=>o.setName("filter").setDescription("Status").addChoices({name:"Active",value:"all"},{name:"Open",value:"open"},{name:"In Progress",value:"in-progress"},{name:"Resolved",value:"resolved"},{name:"Closed",value:"closed"})),
new SC().setName("bug-assign").setDescription("Assign bug").addIntegerOption(o=>o.setName("id").setDescription("ID").setRequired(true)).addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),
new SC().setName("bug-search").setDescription("Search bugs").addStringOption(o=>o.setName("query").setDescription("Query").setRequired(true)),
new SC().setName("dashboard").setDescription("Bug dashboard"),
new SC().setName("stats").setDescription("Statistics"),
new SC().setName("my-bugs").setDescription("Bugs assigned to me"),
new SC().setName("profile").setDescription("Player profile").addUserOption(o=>o.setName("user").setDescription("User")),
new SC().setName("leaderboard").setDescription("Top players"),
new SC().setName("dev-register").setDescription("Register as developer").addStringOption(o=>o.setName("specialty").setDescription("Specialty").setRequired(true).addChoices({name:"Gameplay",value:"gameplay"},{name:"Graphics",value:"graphics"},{name:"Audio",value:"audio"},{name:"Network",value:"network"},{name:"UI/UX",value:"ui"},{name:"AI",value:"ai"},{name:"QA",value:"qa"},{name:"General",value:"general"})).addStringOption(o=>o.setName("role").setDescription("Role").addChoices({name:"Developer",value:"developer"},{name:"Lead",value:"lead"},{name:"Tester",value:"tester"})),
new SC().setName("dev-list").setDescription("Developer list"),
new SC().setName("role-give").setDescription("Give role").setDefaultMemberPermissions(0).addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)).addStringOption(o=>o.setName("role").setDescription("Role").setRequired(true).addChoices({name:"Developer",value:"Developer"},{name:"3D Artist",value:"3D Artist"},{name:"Moderator",value:"Moderator"},{name:"Lead Developer",value:"Lead Developer"},{name:"QA Tester",value:"QA Tester"},{name:"Sound Designer",value:"Sound Designer"},{name:"Game Designer",value:"Game Designer"})),
new SC().setName("role-remove").setDescription("Remove role").setDefaultMemberPermissions(0).addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)).addStringOption(o=>o.setName("role").setDescription("Role").setRequired(true).addChoices({name:"Developer",value:"Developer"},{name:"3D Artist",value:"3D Artist"},{name:"Moderator",value:"Moderator"},{name:"Lead Developer",value:"Lead Developer"},{name:"QA Tester",value:"QA Tester"},{name:"Sound Designer",value:"Sound Designer"},{name:"Game Designer",value:"Game Designer"})),
new SC().setName("warn").setDescription("Warn user").setDefaultMemberPermissions(0).addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)).addStringOption(o=>o.setName("reason").setDescription("Reason").setRequired(true)),
new SC().setName("warnings").setDescription("View warnings").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),
new SC().setName("note").setDescription("Add note").setDefaultMemberPermissions(0).addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)).addStringOption(o=>o.setName("text").setDescription("Note").setRequired(true)),
new SC().setName("notes").setDescription("View notes").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),
new SC().setName("ticket-close").setDescription("Close ticket").addStringOption(o=>o.setName("reason").setDescription("Reason")),
new SC().setName("sugg-respond").setDescription("Respond to suggestion").setDefaultMemberPermissions(0).addIntegerOption(o=>o.setName("id").setDescription("ID").setRequired(true)).addStringOption(o=>o.setName("status").setDescription("Status").setRequired(true).addChoices({name:"Approved",value:"approved"},{name:"Planned",value:"planned"},{name:"Rejected",value:"rejected"},{name:"Done",value:"done"})).addStringOption(o=>o.setName("response").setDescription("Response").setRequired(true)),
new SC().setName("announce").setDescription("Make announcement").setDefaultMemberPermissions(0).addStringOption(o=>o.setName("title").setDescription("Title").setRequired(true)).addStringOption(o=>o.setName("content").setDescription("Content").setRequired(true)).addStringOption(o=>o.setName("type").setDescription("Type").setRequired(true).addChoices({name:"Announcement",value:"general"},{name:"Update",value:"update"},{name:"Patch Notes",value:"patchnote"},{name:"Event",value:"event"},{name:"Important",value:"important"})).addBooleanOption(o=>o.setName("ping").setDescription("@everyone?")),
new SC().setName("giveaway").setDescription("Start giveaway").setDefaultMemberPermissions(0).addStringOption(o=>o.setName("prize").setDescription("Prize").setRequired(true)).addIntegerOption(o=>o.setName("duration").setDescription("Duration (minutes)").setRequired(true)).addIntegerOption(o=>o.setName("winners").setDescription("Winners")),
new SC().setName("giveaway-end").setDescription("End giveaway").setDefaultMemberPermissions(0).addIntegerOption(o=>o.setName("id").setDescription("ID").setRequired(true)),
new SC().setName("poll").setDescription("Create poll").setDefaultMemberPermissions(0).addStringOption(o=>o.setName("question").setDescription("Question").setRequired(true)).addStringOption(o=>o.setName("options").setDescription("Comma separated: A,B,C").setRequired(true)).addIntegerOption(o=>o.setName("duration").setDescription("Duration (minutes)")),
new SC().setName("poll-end").setDescription("End poll").setDefaultMemberPermissions(0).addIntegerOption(o=>o.setName("id").setDescription("ID").setRequired(true)),
new SC().setName("beta-addkeys").setDescription("Add keys").setDefaultMemberPermissions(0).addStringOption(o=>o.setName("keys").setDescription("KEY1,KEY2").setRequired(true)),
new SC().setName("beta-pool").setDescription("Key pool status").setDefaultMemberPermissions(0),
new SC().setName("beta-pending").setDescription("Pending applications").setDefaultMemberPermissions(0),
new SC().setName("beta-used").setDescription("Distributed keys").setDefaultMemberPermissions(0),
new SC().setName("automod-word").setDescription("Manage banned words").setDefaultMemberPermissions(0).addStringOption(o=>o.setName("action").setDescription("Action").setRequired(true).addChoices({name:"Add",value:"add"},{name:"Remove",value:"remove"})).addStringOption(o=>o.setName("word").setDescription("Word").setRequired(true)),
];
await new REST().setToken(process.env.BOT_TOKEN).put(Routes.applicationGuildCommands(process.env.CLIENT_ID,process.env.GUILD_ID),{body:cmds.map(x=>x.toJSON())});
console.log(`  ${cmds.length} commands registered!\n`);
}catch(e){console.error("  Cmd error:",e.message);}
try{const g=cl.guilds.cache.first();if(g){const inv=await g.invites.fetch();db.storeInvs(inv.map(i=>({code:i.code,uses:i.uses,inv:i.inviter?.id})));}}catch{}
});

async function log(g,m){try{const c=db.getCfg(g.id);if(!c?.logCh)return;const ch=g.channels.cache.get(c.logCh);if(ch)await ch.send(`\`${new Date().toISOString().slice(0,19)}\` ${m}`);}catch{}}

// WELCOME + INVITE TRACK
cl.on(EV.GuildMemberAdd,async(mb)=>{try{
const cfg=db.getCfg(mb.guild.id);db.welcome(mb.id,mb.displayName);db.getMem(mb.id);db.updMem(mb.id,{name:mb.displayName,joined:new Date().toISOString().slice(0,19)});
try{const ni=await mb.guild.invites.fetch();const oi=db.getInvs();const u=ni.find(i=>{const o=oi.find(x=>x.code===i.code);return o&&i.uses>o.uses;});if(u?.inviter){db.incInvs(u.inviter.id);await log(mb.guild,`📨 ${mb.displayName} invited by <@${u.inviter.id}> (+50 XP)`);}db.storeInvs(ni.map(i=>({code:i.code,uses:i.uses,inv:i.inviter?.id})));}catch{}
if(cfg?.welCh){const ch=mb.guild.channels.cache.get(cfg.welCh);if(ch)await ch.send({content:`<@${mb.id}>`,embeds:[new EB().setTitle("Welcome!").setColor(0x00cc00).setDescription(`<@${mb.id}> joined the server!\nMembers: **${mb.guild.memberCount}**`).setThumbnail(mb.user.displayAvatarURL()).setTimestamp()]});}
}catch{}});

// AUTOMOD + XP
cl.on(EV.MessageCreate,async(msg)=>{
if(msg.author.bot||!msg.guild)return;
const r=db.trackMsg(msg.author.id,msg.author.displayName);
if(r.up){try{await msg.channel.send(`🎉 <@${msg.author.id}> reached **Level ${r.lvl}**!`);}catch{}
const lr={5:"Active Player",10:"Experienced",25:"Veteran",50:"Legend"};if(lr[r.lvl])try{const rl=msg.guild.roles.cache.find(x=>x.name===lr[r.lvl]);if(rl)await msg.member.roles.add(rl);}catch{}}
const am=db.getAM();if(!am)return;const ct=msg.content.toLowerCase();
if(am.banned_words?.some(w=>ct.includes(w))){try{await msg.delete();await msg.channel.send(`<@${msg.author.id}> banned word detected!`).then(m=>setTimeout(()=>m.delete().catch(()=>{}),5000));await log(msg.guild,`🛡️ AutoMod: ${msg.author.displayName} banned word`);}catch{}return;}
if(msg.content.length>10){const caps=msg.content.replace(/[^A-Z]/g,"").length;if(caps/msg.content.length*100>(am.max_caps||70)){try{await msg.delete();await msg.channel.send(`<@${msg.author.id}> too many CAPS!`).then(m=>setTimeout(()=>m.delete().catch(()=>{}),5000));}catch{}return;}}
if(msg.mentions.users.size+msg.mentions.roles.size>(am.max_mentions||5)){try{await msg.delete();await msg.channel.send(`<@${msg.author.id}> too many mentions!`).then(m=>setTimeout(()=>m.delete().catch(()=>{}),5000));}catch{}}
});

cl.on(EV.InteractionCreate,async(ix)=>{try{
if(ix.isChatInputCommand())return await hCmd(ix);
if(ix.isButton())return await hBtn(ix);
if(ix.isModalSubmit())return await hMod(ix);
if(ix.isStringSelectMenu())return await hSel(ix);
}catch(er){console.error("ERR:",er.message);const r={content:"An error occurred.",ephemeral:true};if(ix.replied||ix.deferred)await ix.followUp(r).catch(()=>{});else await ix.reply(r).catch(()=>{});}});

// ===== COMMANDS =====
async function hCmd(ix){const c=ix.commandName;
if(c==="setup"){if(!ix.member.permissions.has(P.Flags.Administrator))return ix.reply({content:"Admin required.",ephemeral:true});await ix.deferReply();try{const g=ix.guild;
const mk=async(n,col)=>g.roles.cache.find(r=>r.name===n)||await g.roles.create({name:n,color:col});
const rl={};for(const[n,col]of[["Developer",0x3498db],["3D Artist",0xe91e63],["Moderator",0xe74c3c],["Lead Developer",0xf39c12],["QA Tester",0x2ecc71],["Sound Designer",0x9b59b6],["Game Designer",0x1abc9c],["Active Player",0x11806a],["Experienced",0x1f8b4c],["Veteran",0xc27c0e],["Legend",0xa84300],["PC Player",0x3498db],["PS Player",0x2e4057],["Xbox Player",0x107c10],["Mobile Player",0xe67e22],["Beta Tester",0x9b59b6],["Verified",0x2ecc71]]){rl[n]=await mk(n,col);}
const mkCat=async(n)=>g.channels.cache.find(ch=>ch.name===n&&ch.type===CH.GuildCategory)||await g.channels.create({name:n,type:CH.GuildCategory});
const cats={};
cats.welcome=await mkCat("Welcome");
cats.community=await mkCat("Community");
cats.feedback=await mkCat("Game Feedback");
cats.support=await mkCat("Support");
cats.beta=await mkCat("Beta Program");
cats.announce=await mkCat("Announcements");
cats.mgmt=await mkCat("Management");
// Admin-only perms for Management
try{await cats.mgmt.permissionOverwrites.set([{id:g.id,deny:["ViewChannel"]},{id:cl.user.id,allow:["ViewChannel"]},{id:rl["Developer"].id,allow:["ViewChannel"]},{id:rl["Lead Developer"].id,allow:["ViewChannel"]},{id:rl["Moderator"].id,allow:["ViewChannel"]}]);}catch{}
const mkCh=async(n,cat,topic)=>g.channels.cache.find(ch=>ch.name===n&&ch.parentId===cat.id)||await g.channels.create({name:n,type:CH.GuildText,parent:cat.id,topic});
const ch={};
ch.verify=await mkCh("verification",cats.welcome,"Accept rules");
ch.welcome=await mkCh("welcome",cats.welcome,"New members");
ch.general=await mkCh("general-chat",cats.community,"General chat");
ch.platform=await mkCh("platform-select",cats.community,"Choose platform");
ch.giveaway=await mkCh("giveaways",cats.community,"Giveaways");
ch.polls=await mkCh("polls",cats.community,"Polls");
ch.bugs=await mkCh("bug-reports",cats.feedback,"Report bugs");
ch.sugg=await mkCh("suggestions",cats.feedback,"Suggestions");
ch.ticket=await mkCh("support-tickets",cats.support,"Open ticket");
ch.beta=await mkCh("beta-apply",cats.beta,"Beta applications");
ch.ann=await mkCh("announcements",cats.announce,"Announcements");
ch.patch=await mkCh("patch-notes",cats.announce,"Patch notes");
ch.admin=await mkCh("admin-panel",cats.mgmt,"Admin");
ch.automod=await mkCh("automod",cats.mgmt,"AutoMod");
ch.botlog=await mkCh("bot-log",cats.mgmt,"Logs");
ch.betamgmt=await mkCh("beta-key-mgmt",cats.mgmt,"Key management");
ch.betarev=await mkCh("beta-review",cats.mgmt,"Review applications");
db.setCfg(g.id,{bugCh:ch.bugs.id,adminCh:ch.admin.id,tktCh:ch.ticket.id,sugCh:ch.sugg.id,betaCh:ch.beta.id,betaAdm:ch.betamgmt.id,betaRev:ch.betarev.id,annCh:ch.ann.id,patchCh:ch.patch.id,logCh:ch.botlog.id,welCh:ch.welcome.id,verifyCh:ch.verify.id,givCh:ch.giveaway.id,pollCh:ch.polls.id,amCh:ch.automod.id,devRole:rl["Developer"].id,leadRole:rl["Lead Developer"].id,testRole:rl["QA Tester"].id});
await ch.verify.send({embeds:[E.verifyP()],components:[E.verifyB()]});
await ch.platform.send({embeds:[E.rrP()],components:E.rrB()});
await ch.bugs.send({embeds:[E.bugP()],components:E.bugBP()});
await ch.sugg.send({embeds:[E.sugP()],components:E.sugBP()});
await ch.ticket.send({embeds:[E.tktP(db.tktSt())],components:E.tktBP()});
await ch.beta.send({embeds:[E.betaP(db.betaSt())],components:E.betaBP()});
await ch.betamgmt.send({embeds:[E.betaAP(db.betaSt())],components:E.betaABP()});
await ch.admin.send({embeds:[E.adminP(db.bugStats(),db.tktSt(),db.betaSt())],components:E.adminBP()});
await ch.automod.send({embeds:[E.amP(db.getAM())],components:[E.amB()]});
await ix.editReply({embeds:[new EB().setTitle("✅ Setup Complete!").setColor(0x00cc00).setDescription(`**7 categories** | **17 channels** | **${Object.keys(rl).length} roles**\n\nAll panels placed automatically.`).setTimestamp()]});
}catch(e){console.error("SETUP:",e.message,e.stack);await ix.editReply({content:`Error: ${e.message}`}).catch(()=>{});}return;}
if(c==="reset"){if(!ix.member.permissions.has(P.Flags.Administrator))return ix.reply({content:"Admin required.",ephemeral:true});await ix.deferReply();try{const g=ix.guild;const catNames=["Welcome","Community","Game Feedback","Support","Beta Program","Announcements","Management","Tickets"];let deleted=0;for(const name of catNames){const cat=g.channels.cache.find(ch=>ch.name===name&&ch.type===CH.GuildCategory);if(cat){const children=g.channels.cache.filter(ch=>ch.parentId===cat.id);for(const[,ch]of children){try{await ch.delete();deleted++;}catch{}}try{await cat.delete();deleted++;}catch{}}}await ix.editReply({embeds:[new EB().setTitle("🗑️ Reset Complete").setColor(0xff0000).setDescription(`**${deleted}** channels/categories deleted.\n\nRun \`/setup\` to recreate everything.`).setTimestamp()]});}catch(e){await ix.editReply({content:`Error: ${e.message}`}).catch(()=>{});}return;}
if(c==="panel"){await ix.channel.send({embeds:[E.bugP()],components:E.bugBP()});return ix.reply({content:"Done.",ephemeral:true});}
if(c==="admin-panel"){await ix.channel.send({embeds:[E.adminP(db.bugStats(),db.tktSt(),db.betaSt())],components:E.adminBP()});return ix.reply({content:"Done.",ephemeral:true});}
if(c==="ticket-panel"){await ix.channel.send({embeds:[E.tktP(db.tktSt())],components:E.tktBP()});return ix.reply({content:"Done.",ephemeral:true});}
if(c==="sugg-panel"){await ix.channel.send({embeds:[E.sugP()],components:E.sugBP()});return ix.reply({content:"Done.",ephemeral:true});}
if(c==="beta-panel"){await ix.channel.send({embeds:[E.betaP(db.betaSt())],components:E.betaBP()});return ix.reply({content:"Done.",ephemeral:true});}
if(c==="beta-admin"){await ix.channel.send({embeds:[E.betaAP(db.betaSt())],components:E.betaABP()});return ix.reply({content:"Done.",ephemeral:true});}
if(c==="verify-panel"){await ix.channel.send({embeds:[E.verifyP()],components:[E.verifyB()]});return ix.reply({content:"Done.",ephemeral:true});}
if(c==="reaction-roles"){await ix.channel.send({embeds:[E.rrP()],components:E.rrB()});return ix.reply({content:"Done.",ephemeral:true});}
if(c==="automod-panel"){await ix.channel.send({embeds:[E.amP(db.getAM())],components:[E.amB()]});return ix.reply({content:"Done.",ephemeral:true});}
if(c==="bug"){const b=db.getBug(ix.options.getInteger("id"));if(!b)return ix.reply({content:"Not found.",ephemeral:true});return ix.reply({embeds:[E.bugE(b,db.getHist(b.id),db.getCmts(b.id))],components:E.bugBB(b)});}
if(c==="bug-assign"){const id=ix.options.getInteger("id"),u=ix.options.getUser("user");const b=db.getBug(id);if(!b)return ix.reply({content:"Not found.",ephemeral:true});db.assignBug(id,u.id,u.displayName);const up=db.getBug(id);await ix.reply({embeds:[E.bugE(up,db.getHist(id))],components:E.bugBB(up)});try{await u.send(`Bug assigned: **${up.tag}: ${up.title}**`);}catch{}return log(ix.guild,`👤 ${up.tag} → ${u.displayName}`);}
if(c==="bugs"){const f=ix.options.getString("filter")||"all";return ix.reply({embeds:[E.listE(f==="all"?db.bugsActive():db.bugsBy(f),"📋 Bugs")],components:[E.filtS()]});}
if(c==="bug-search")return ix.reply({embeds:[E.listE(db.search(ix.options.getString("query")),"🔎 Search")]});
if(c==="dashboard")return ix.reply({embeds:[E.dashE(db.bugStats(),db.devLb())]});
if(c==="stats")return ix.reply({embeds:[E.statE(db.bugStats(),db.devLb())]});
if(c==="my-bugs")return ix.reply({embeds:[E.listE(db.bugsDev(ix.user.id),`📌 ${ix.user.displayName}`)]});
if(c==="profile"){const u=ix.options.getUser("user")||ix.user;const m=db.getMem(u.id);m.name=u.displayName;const lb=db.topMembers();return ix.reply({embeds:[E.profE(m,(lb.findIndex(x=>x.uid===u.id)+1)||"?")]});}
if(c==="leaderboard")return ix.reply({embeds:[E.lbE(db.topMembers())]});
if(c==="dev-register"){const sp=ix.options.getString("specialty"),rl=ix.options.getString("role")||"developer";db.regDev(ix.user.id,ix.user.displayName,rl,sp);const cfg=db.getCfg(ix.guildId);if(cfg){try{const m={developer:cfg.devRole,lead:cfg.leadRole,tester:cfg.testRole};if(m[rl])await ix.member.roles.add(m[rl]);}catch{}}return ix.reply({content:`**${ix.user.displayName}** registered! ${sp} | ${rl}`});}
if(c==="dev-list"){const d=db.devs();if(!d.length)return ix.reply({content:"None.",ephemeral:true});return ix.reply({embeds:[new EB().setTitle("👥 Team").setColor(0x5865f2).setDescription(d.map(x=>`**${x.name}** — ${x.role} | ${x.spec} | ${x.resolved} resolved`).join("\n"))]});}
if(c==="role-give"){const u=ix.options.getUser("user"),rn=ix.options.getString("role");const r=ix.guild.roles.cache.find(x=>x.name===rn);if(!r)return ix.reply({content:"Role not found.",ephemeral:true});await(await ix.guild.members.fetch(u.id)).roles.add(r);return ix.reply({content:`${r} → <@${u.id}>`});}
if(c==="role-remove"){const u=ix.options.getUser("user"),rn=ix.options.getString("role");const r=ix.guild.roles.cache.find(x=>x.name===rn);if(!r)return ix.reply({content:"Role not found.",ephemeral:true});await(await ix.guild.members.fetch(u.id)).roles.remove(r);return ix.reply({content:`${r} ← <@${u.id}>`});}
if(c==="warn"){const u=ix.options.getUser("user"),r=ix.options.getString("reason");const cnt=db.warn(u.id,u.displayName,r,ix.user.displayName);await ix.reply({embeds:[new EB().setTitle("⚠️ Warning").setColor(0xff0000).setDescription(`<@${u.id}> warned.\n**Reason:** ${r}\n**Total:** ${cnt}`)]});try{await u.send(`Warning: ${r} (Total: ${cnt})`);}catch{}return log(ix.guild,`⚠️ ${u.displayName}: ${r}`);}
if(c==="warnings"){const u=ix.options.getUser("user"),w=db.warns(u.id);if(!w.length)return ix.reply({content:"None.",ephemeral:true});return ix.reply({embeds:[new EB().setTitle("Warnings").setColor(0xff0000).setDescription(w.map((x,i)=>`**${i+1}.** ${x.reason} — ${x.by}`).join("\n"))],ephemeral:true});}
if(c==="note"){const u=ix.options.getUser("user"),t=ix.options.getString("text");db.note(u.id,u.displayName,t,ix.user.displayName);return ix.reply({content:"Note added.",ephemeral:true});}
if(c==="notes"){const u=ix.options.getUser("user"),n=db.notes(u.id);if(!n.length)return ix.reply({content:"None.",ephemeral:true});return ix.reply({embeds:[new EB().setTitle("Notes").setColor(0x3498db).setDescription(n.map(x=>`**${x.by}**: ${x.note}`).join("\n"))],ephemeral:true});}
if(c==="ticket-close"){const t=db.getTktByCh(ix.channelId);if(!t)return ix.reply({content:"Not a ticket.",ephemeral:true});db.closeTkt(t.id,ix.options.getString("reason")||"Closed");await ix.reply({embeds:[new EB().setTitle(`${t.tag} Closed`).setColor(0x95a5a6).setDescription("Channel will be deleted in 10s.")]});await log(ix.guild,`🔒 ${t.tag}`);setTimeout(async()=>{try{await ix.channel.delete();}catch{}},10000);return;}
if(c==="sugg-respond"){const id=ix.options.getInteger("id"),st=ix.options.getString("status"),rsp=ix.options.getString("response");const s=db.respSug(id,st,rsp,ix.user.displayName);if(!s)return ix.reply({content:"Not found.",ephemeral:true});await ix.reply({embeds:[E.sugC(s)]});try{const u=await cl.users.fetch(s.uid);await u.send({embeds:[new EB().setTitle("Suggestion Response!").setColor(0xf39c12).setDescription(`**${s.tag}:** ${s.title}\nStatus: **${st}**\n${rsp}`)]});}catch{}return log(ix.guild,`💡 ${s.tag} → ${st}`);}
if(c==="announce"){const t=ix.options.getString("title"),ct=ix.options.getString("content"),tp=ix.options.getString("type"),ping=ix.options.getBoolean("ping");const cfg=db.getCfg(ix.guildId);const ch=cfg?.annCh?ix.guild.channels.cache.get(cfg.annCh):ix.channel;await(ch||ix.channel).send({content:ping?"@everyone":"",embeds:[E.annE(t,ct,tp,ix.user.displayName)]});db.mkAnn(t,ct,tp,ix.user.displayName);return ix.reply({content:"Sent!",ephemeral:true});}
if(c==="giveaway"){const prize=ix.options.getString("prize"),mins=ix.options.getInteger("duration"),win=ix.options.getInteger("winners")||1;const cfg=db.getCfg(ix.guildId);const ch=cfg?.givCh?ix.guild.channels.cache.get(cfg.givCh):ix.channel;const g=db.mkGiv(prize,mins*60000,win,ix.user.displayName);const msg=await(ch||ix.channel).send({embeds:[E.givE(g)],components:[E.givB(g.id)]});g.chId=ch?.id;g.msgId=msg.id;await ix.reply({content:`Giveaway #${g.id} started!`,ephemeral:true});
setTimeout(async()=>{const r=db.endGiv(g.id);if(!r)return;try{const gch=ix.guild.channels.cache.get(g.chId);if(gch){const gm=await gch.messages.fetch(msg.id);await gm.edit({embeds:[E.givE(db.getGiv(g.id))],components:[]});await gch.send(`🎉 **${prize}** winner: ${r.winners.map(w=>`<@${w}>`).join(", ")||"No entries!"}`);}}catch{}},mins*60000);return;}
if(c==="giveaway-end"){const r=db.endGiv(ix.options.getInteger("id"));if(!r)return ix.reply({content:"Not found.",ephemeral:true});return ix.reply({content:`Winner: ${r.winners.map(w=>`<@${w}>`).join(", ")||"None"}`});}
if(c==="poll"){const q=ix.options.getString("question"),opts=ix.options.getString("options").split(",").map(o=>o.trim()).filter(o=>o),mins=ix.options.getInteger("duration");const p=db.mkPoll(q,opts,mins?mins*60000:null,ix.user.displayName);const cfg=db.getCfg(ix.guildId);const ch=cfg?.pollCh?ix.guild.channels.cache.get(cfg.pollCh):ix.channel;const msg=await(ch||ix.channel).send({embeds:[E.polE(p)],components:E.polB(p)});db.setPollMsg(p.id,ch?.id||ix.channelId,msg.id);await ix.reply({content:`Poll #${p.id} created!`,ephemeral:true});
if(mins)setTimeout(async()=>{const ep=db.endPoll(p.id);if(!ep)return;try{const pc=ix.guild.channels.cache.get(ep.chId);if(pc){const pm=await pc.messages.fetch(ep.msgId);await pm.edit({embeds:[E.polE(ep)],components:[]});}}catch{}},mins*60000);return;}
if(c==="poll-end"){const p=db.endPoll(ix.options.getInteger("id"));if(!p)return ix.reply({content:"Not found.",ephemeral:true});return ix.reply({embeds:[E.polE(p)]});}
if(c==="beta-addkeys"){const keys=ix.options.getString("keys").split(/[,\n;]+/).map(k=>k.trim()).filter(k=>k.length>2);const r=db.addKeys(keys);return ix.reply({content:`**${r.added}** keys added. Pool: **${r.total}**`,ephemeral:true});}
if(c==="beta-pool")return ix.reply({embeds:[E.betaSE(db.betaSt())],ephemeral:true});
if(c==="beta-pending"){const a=db.apps("pending");if(!a.length)return ix.reply({content:"None.",ephemeral:true});return ix.reply({embeds:a.slice(0,5).map(x=>E.betaC(x)),components:a.slice(0,5).map(x=>E.betaCB(x.id)),ephemeral:true});}
if(c==="beta-used"){const u=db.usedKeys();if(!u.length)return ix.reply({content:"None.",ephemeral:true});return ix.reply({embeds:[new EB().setTitle("📦 Distributed").setColor(0x9b59b6).setDescription(u.map(k=>`\`${k.key.slice(0,8)}...\` → **${k.name}**`).join("\n").slice(0,4000))],ephemeral:true});}
if(c==="automod-word"){const act=ix.options.getString("action"),w=ix.options.getString("word");if(act==="add")db.addBan(w);else db.rmBan(w);return ix.reply({content:`"${w}" ${act==="add"?"added":"removed"}.`,ephemeral:true});}
}

// ===== BUTTONS =====
async function hBtn(ix){const id=ix.customId;
if(id==="verify_accept"){const r=ix.guild.roles.cache.find(x=>x.name==="Verified")||await ix.guild.roles.create({name:"Verified",color:0x2ecc71});try{await ix.member.roles.add(r);}catch{}return ix.reply({content:"✅ Verified! Welcome.",ephemeral:true});}
if(id.startsWith("rr_")){const rn=id.slice(3);const r=ix.guild.roles.cache.find(x=>x.name===rn);if(!r)return ix.reply({content:"Role not found.",ephemeral:true});if(ix.member.roles.cache.has(r.id)){await ix.member.roles.remove(r);return ix.reply({content:`${r} removed.`,ephemeral:true});}await ix.member.roles.add(r);return ix.reply({content:`${r} added!`,ephemeral:true});}
if(id==="open_report"){const m=new MB().setCustomId("m_bug").setTitle("Bug Report");m.addComponents(new AR().addComponents(new TI().setCustomId("t").setLabel("Bug Title").setStyle(TS.Short).setMaxLength(120).setRequired(true)),new AR().addComponents(new TI().setCustomId("d").setLabel("Description").setStyle(TS.Paragraph).setMaxLength(1500).setRequired(true)),new AR().addComponents(new TI().setCustomId("s").setLabel("Steps to Reproduce").setStyle(TS.Paragraph).setMaxLength(800).setRequired(false)),new AR().addComponents(new TI().setCustomId("v").setLabel("Severity (critical/high/medium/low)").setStyle(TS.Short).setPlaceholder("medium").setMaxLength(10).setRequired(true)),new AR().addComponents(new TI().setCustomId("p").setLabel("Platform (pc/ps/xbox/mobile/all)").setStyle(TS.Short).setPlaceholder("pc").setMaxLength(15).setRequired(false)));return ix.showModal(m);}
if(id==="my_bugs")return ix.reply({embeds:[E.listE(db.bugsUser(ix.user.id),`📝 ${ix.user.displayName}`)],ephemeral:true});
if(id==="open_dash")return ix.reply({embeds:[E.dashE(db.bugStats(),db.devLb())],ephemeral:true});
if(id==="open_lb")return ix.reply({embeds:[E.lbE(db.topMembers())],ephemeral:true});
if(id==="a_bugs")return ix.reply({embeds:[E.listE(db.bugsActive(),"📋 Active")],components:[E.filtS()],ephemeral:true});
if(id==="a_crit")return ix.reply({embeds:[E.listE(db.bugsSev("critical"),"🚨 Critical")],ephemeral:true});
if(id==="a_tkts"){const t=db.openTkts();return ix.reply({embeds:[new EB().setTitle("🎫 Open Tickets").setColor(0xe74c3c).setDescription(t.length?t.map(x=>`**${x.tag}** ${x.cat} — <@${x.uid}>${x.claimUid?` → <@${x.claimUid}>`:""}`).join("\n"):"None.")],ephemeral:true});}
if(id==="a_refresh")return ix.update({embeds:[E.adminP(db.bugStats(),db.tktSt(),db.betaSt())],components:E.adminBP()});
if(id==="a_members")return ix.reply({embeds:[E.lbE(db.topMembers())],ephemeral:true});
if(id==="a_automod")return ix.reply({embeds:[E.amP(db.getAM())],ephemeral:true});
if(id==="a_givs"){const g=db.activeGivs();return ix.reply({embeds:[new EB().setTitle("🎁 Active Giveaways").setColor(0xf39c12).setDescription(g.length?g.map(x=>`#${x.id} **${x.prize}** — ${x.entries.length} entries`).join("\n"):"None.")],ephemeral:true});}
if(id==="a_stats")return ix.reply({embeds:[E.statE(db.bugStats(),db.devLb())],ephemeral:true});
if(id==="am_words"){const am=db.getAM();return ix.reply({embeds:[new EB().setTitle("🚫 Banned Words").setColor(0xe74c3c).setDescription(am.banned_words?.length?am.banned_words.map(w=>`\`${w}\``).join(", "):"Empty.")],ephemeral:true});}
if(id==="am_cfg")return ix.reply({embeds:[E.amP(db.getAM())],ephemeral:true});
if(id.startsWith("tkt_")){const cat=id.slice(4);const m=new MB().setCustomId(`mt_${cat}`).setTitle("Support Ticket");m.addComponents(new AR().addComponents(new TI().setCustomId("d").setLabel("Describe your issue").setStyle(TS.Paragraph).setMaxLength(1000).setRequired(true)));return ix.showModal(m);}
if(id.startsWith("tc_")){const tid=parseInt(id.slice(3));db.claimTkt(tid,ix.user.id,ix.user.displayName);return ix.reply({content:`🙋 **${ix.user.displayName}** claimed this ticket.`});}
if(id.startsWith("tx_")){const tid=parseInt(id.slice(3));const t=db.getTkt(tid);db.closeTkt(tid,ix.user.displayName);await ix.reply({embeds:[new EB().setTitle(`${t?.tag||"Ticket"} Closed`).setColor(0x95a5a6).setDescription("Deleting in 10s.")]});await log(ix.guild,`🔒 ${t?.tag}`);setTimeout(async()=>{try{await ix.channel.delete();}catch{}},10000);return;}
if(id==="sug_create"){const m=new MB().setCustomId("m_sug").setTitle("Submit Suggestion");m.addComponents(new AR().addComponents(new TI().setCustomId("t").setLabel("Suggestion Title").setStyle(TS.Short).setMaxLength(100).setRequired(true)),new AR().addComponents(new TI().setCustomId("d").setLabel("Detailed Description").setStyle(TS.Paragraph).setMaxLength(1000).setRequired(true)),new AR().addComponents(new TI().setCustomId("c").setLabel("Category (gameplay/visual/community/other)").setStyle(TS.Short).setPlaceholder("gameplay").setMaxLength(15).setRequired(false)));return ix.showModal(m);}
if(id==="sug_top"){const t=db.topSugs();if(!t.length)return ix.reply({content:"None.",ephemeral:true});return ix.reply({embeds:[new EB().setTitle("🔥 Most Popular").setColor(0xf39c12).setDescription(t.map((s,i)=>`**${i+1}.** ${s.tag} — ${s.title} (net: **${(s.up?.length||0)-(s.dn?.length||0)}**)`).join("\n"))],ephemeral:true});}
if(id==="sug_mine"){const m=db.sugs().filter(s=>s.uid===ix.user.id);return ix.reply({embeds:[new EB().setTitle("📌 Your Suggestions").setColor(0xf39c12).setDescription(m.length?m.map(s=>`${s.tag} — ${s.title} (${s.status})`).join("\n"):"None.")],ephemeral:true});}
if(id.startsWith("su_")||id.startsWith("sd_")){const tp=id.startsWith("su_")?"up":"down";const sid=parseInt(id.slice(3));db.voteSug(sid,ix.user.id,tp);const s=db.getSug(sid);return ix.update({embeds:[E.sugC(s)],components:[E.sugVB(sid),E.sugAB(sid)]});}
if(id.startsWith("sa_")||id.startsWith("sp_")||id.startsWith("sr_")||id.startsWith("sx_")){const map={sa:"approved",sp:"planned",sr:"rejected",sx:"done"};const pre=id.slice(0,2),sid=parseInt(id.slice(3));const m=new MB().setCustomId(`ms_${map[pre]}_${sid}`).setTitle("Team Response");m.addComponents(new AR().addComponents(new TI().setCustomId("r").setLabel("Response").setStyle(TS.Paragraph).setRequired(true).setMaxLength(500)));return ix.showModal(m);}
if(id==="beta_apply"){const m=new MB().setCustomId("m_beta").setTitle("Beta Application");m.addComponents(new AR().addComponents(new TI().setCustomId("r").setLabel("Why do you want to join?").setStyle(TS.Paragraph).setMaxLength(500).setRequired(true)),new AR().addComponents(new TI().setCustomId("p").setLabel("Platform (PC/PS/Xbox/Mobile)").setStyle(TS.Short).setMaxLength(20).setRequired(true)));return ix.showModal(m);}
if(id==="beta_status"){const a=db.apps().filter(x=>x.uid===ix.user.id);if(!a.length)return ix.reply({content:"No application.",ephemeral:true});return ix.reply({embeds:[E.betaC(a[a.length-1])],ephemeral:true});}
if(id==="beta_stats")return ix.reply({embeds:[E.betaSE(db.betaSt())],ephemeral:true});
if(id==="bk_add"){const m=new MB().setCustomId("m_keys").setTitle("Upload Keys");m.addComponents(new AR().addComponents(new TI().setCustomId("k").setLabel("One key per line").setStyle(TS.Paragraph).setMaxLength(4000).setRequired(true)));return ix.showModal(m);}
if(id==="bk_pending"){const a=db.apps("pending");if(!a.length)return ix.reply({content:"None.",ephemeral:true});return ix.reply({embeds:a.slice(0,5).map(x=>E.betaC(x)),components:a.slice(0,5).map(x=>E.betaCB(x.id)),ephemeral:true});}
if(id==="bk_used"){const u=db.usedKeys();if(!u.length)return ix.reply({content:"None.",ephemeral:true});return ix.reply({embeds:[new EB().setTitle("📦 Distributed").setColor(0x9b59b6).setDescription(u.map(k=>`\`${k.key.slice(0,8)}...\` → **${k.name}**`).join("\n").slice(0,4000))],ephemeral:true});}
if(id==="bk_refresh")return ix.update({embeds:[E.betaAP(db.betaSt())],components:E.betaABP()});
if(id.startsWith("bok_")){const aid=parseInt(id.slice(4));const r=db.approveApp(aid,ix.user.displayName);if(r.err==="no_keys")return ix.reply({content:"No keys!",ephemeral:true});if(r.err)return ix.reply({content:r.err,ephemeral:true});try{const u=await cl.users.fetch(r.app.uid);await u.send({embeds:[new EB().setTitle("🎉 Beta Approved!").setColor(0x00cc00).setDescription(`Your key:\n\`\`\`\n${r.key}\n\`\`\`\nDo not share this key.`)]});const mb=await ix.guild.members.fetch(r.app.uid);const br=ix.guild.roles.cache.find(x=>x.name==="Beta Tester");if(br)await mb.roles.add(br);}catch{}await ix.update({embeds:[E.betaC(db.getApp(aid))],components:[]});return log(ix.guild,`✅ Beta #${aid} → ${r.app.name}`);}
if(id.startsWith("bno_")){const aid=parseInt(id.slice(4));const r=db.rejectApp(aid,ix.user.displayName);if(r.err)return ix.reply({content:r.err,ephemeral:true});try{const u=await cl.users.fetch(r.uid);await u.send({embeds:[new EB().setTitle("Beta Rejected").setColor(0xff0000).setDescription("You can try again later.")]});}catch{}await ix.update({embeds:[E.betaC(db.getApp(aid))],components:[]});return log(ix.guild,`❌ Beta #${aid}`);}
if(id.startsWith("ge_")){const ok=db.enterGiv(parseInt(id.slice(3)),ix.user.id);return ix.reply({content:ok?"🎉 Entered!":"Already entered.",ephemeral:true});}
if(id.startsWith("pv_")){const p=id.split("_"),pid=parseInt(p[1]),oi=parseInt(p[2]);const poll=db.votePoll(pid,oi,ix.user.id);if(!poll)return ix.reply({content:"Poll closed.",ephemeral:true});return ix.update({embeds:[E.polE(poll)],components:E.polB(poll)});}
// BUG ACTIONS
const ps=id.split("_"),act=ps[0],bid=parseInt(ps[1]);if(isNaN(bid))return;const bug=db.getBug(bid);if(!bug)return ix.reply({content:"Not found.",ephemeral:true});
if(act==="cl"){db.assignBug(bid,ix.user.id,ix.user.displayName);const u=db.getBug(bid);await ix.update({embeds:[E.bugE(u,db.getHist(bid))],components:E.bugBB(u)});return log(ix.guild,`🙋 ${u.tag} → ${ix.user.displayName}`);}
if(act==="ua"){db.unassignBug(bid,ix.user.displayName);const u=db.getBug(bid);return ix.update({embeds:[E.bugE(u,db.getHist(bid))],components:E.bugBB(u)});}
if(act==="rv"){const m=new MB().setCustomId(`mr_${bid}`).setTitle(`${bug.tag} Resolution`);m.addComponents(new AR().addComponents(new TI().setCustomId("n").setLabel("How did you fix it?").setStyle(TS.Paragraph).setRequired(true).setMaxLength(500)));return ix.showModal(m);}
if(act==="cx"){db.closeBug(bid,ix.user.displayName);const u=db.getBug(bid);await ix.update({embeds:[E.bugE(u,db.getHist(bid))],components:E.bugBB(u)});return log(ix.guild,`🔒 ${u.tag}`);}
if(act==="ro"){db.reopenBug(bid,ix.user.displayName);const u=db.getBug(bid);await ix.update({embeds:[E.bugE(u,db.getHist(bid))],components:E.bugBB(u)});return log(ix.guild,`🔓 ${u.tag}`);}
if(act==="vu"){db.vote(bid,ix.user.id);const u=db.getBug(bid);return ix.update({embeds:[E.bugE(u,db.getHist(bid),db.getCmts(bid))],components:E.bugBB(u)});}
if(act==="cm"){const m=new MB().setCustomId(`mc_${bid}`).setTitle(`${bug.tag} Comment`);m.addComponents(new AR().addComponents(new TI().setCustomId("t").setLabel("Your comment").setStyle(TS.Paragraph).setRequired(true).setMaxLength(500)));return ix.showModal(m);}
if(act==="th"){if(bug.thId){const ex=ix.guild.channels.cache.get(bug.thId);if(ex)return ix.reply({content:`<#${bug.thId}>`,ephemeral:true});}const th=await ix.channel.threads.create({name:`${bug.tag} ${bug.title.slice(0,50)}`,autoArchiveDuration:1440});db.setTh(bid,th.id);await th.send({embeds:[new EB().setTitle(`🧵 ${bug.tag}`).setColor(0x5865f2).setDescription(bug.desc.slice(0,300))]});return ix.reply({content:`<#${th.id}>`,ephemeral:true});}
if(act==="hi"){const h=db.getHist(bid);if(!h.length)return ix.reply({content:"None.",ephemeral:true});return ix.reply({embeds:[new EB().setTitle(`📜 ${bug.tag}`).setColor(0x5865f2).setDescription(h.map(x=>`\`${x.at}\` ▸ **${x.act}** (${x.by})`).join("\n").slice(0,4000))],ephemeral:true});}
}

// ===== MODALS =====
async function hMod(ix){const id=ix.customId;
if(id==="m_bug"){const t=ix.fields.getTextInputValue("t"),d=ix.fields.getTextInputValue("d"),s=ix.fields.getTextInputValue("s")||"";let v=ix.fields.getTextInputValue("v").toLowerCase().trim(),p=(ix.fields.getTextInputValue("p")||"all").toLowerCase().trim();if(!["critical","high","medium","low"].includes(v))v="medium";if(!["pc","playstation","ps","xbox","mobile","all"].includes(p))p="all";const b=db.mkBug({title:t,desc:d,steps:s,sev:v,plat:p,cat:"gameplay",uid:ix.user.id,name:ix.user.displayName});db.incBugs(ix.user.id);const cfg=db.getCfg(ix.guildId);const ch=cfg?.bugCh?ix.guild.channels.cache.get(cfg.bugCh):ix.channel;const msg=await(ch||ix.channel).send({content:`🐛 **New** — ${b.tag} — <@${ix.user.id}> (+30 XP)`,embeds:[E.bugE(b,db.getHist(b.id))],components:E.bugBB(b)});db.setRef(b.id,(ch||ix.channel).id,msg.id);await ix.reply({content:`**${b.tag}** created! +30 XP`,ephemeral:true});await log(ix.guild,`🐛 ${b.tag} — ${t} (${v})`);if(v==="critical"&&cfg?.devRole)await(ch||ix.channel).send(`🚨 **CRITICAL!** <@&${cfg.devRole}> — ${b.tag}`);return;}
if(id.startsWith("mr_")){const bid=parseInt(id.slice(3)),n=ix.fields.getTextInputValue("n"),b=db.getBug(bid);if(!b)return ix.reply({content:"Not found.",ephemeral:true});db.resolveBug(bid,n,ix.user.displayName);if(b.to)db.incRes(b.to);const u=db.getBug(bid);await ix.update({embeds:[E.bugE(u,db.getHist(bid))],components:E.bugBB(u)});await log(ix.guild,`✅ ${u.tag}: ${n}`);if(b.by!==ix.user.id)try{const rp=await cl.users.fetch(b.by);await rp.send(`Resolved! **${u.tag}** — ${n}`);}catch{}return;}
if(id.startsWith("mc_")){const bid=parseInt(id.slice(3)),t=ix.fields.getTextInputValue("t");db.addCmt(bid,ix.user.id,ix.user.displayName,t);const u=db.getBug(bid);return ix.update({embeds:[E.bugE(u,db.getHist(bid),db.getCmts(bid))],components:E.bugBB(u)});}
if(id.startsWith("mt_")){const cat=id.slice(3),d=ix.fields.getTextInputValue("d");const t=db.mkTkt(ix.user.id,ix.user.displayName,cat,d);const g=ix.guild;let tc=g.channels.cache.find(ch=>ch.name==="Tickets"&&ch.type===CH.GuildCategory);if(!tc)tc=await g.channels.create({name:"Tickets",type:CH.GuildCategory});const ch=await g.channels.create({name:`ticket-${t.id}-${ix.user.displayName.toLowerCase().replace(/[^a-z0-9]/g,"")}`,type:CH.GuildText,parent:tc.id,permissionOverwrites:[{id:g.id,deny:["ViewChannel"]},{id:ix.user.id,allow:["ViewChannel","SendMessages","ReadMessageHistory"]},{id:cl.user.id,allow:["ViewChannel","SendMessages","ManageChannels"]}]});const cfg=db.getCfg(ix.guildId);if(cfg?.devRole)try{await ch.permissionOverwrites.create(cfg.devRole,{ViewChannel:true,SendMessages:true});}catch{}if(cfg?.leadRole)try{await ch.permissionOverwrites.create(cfg.leadRole,{ViewChannel:true,SendMessages:true});}catch{}db.setTktCh(t.id,ch.id);const{ButtonBuilder:BB,ButtonStyle:BS}=require("discord.js");await ch.send({content:`<@${ix.user.id}>`,embeds:[E.tktE(t)],components:[new AR().addComponents(new BB().setCustomId(`tc_${t.id}`).setLabel("Claim").setStyle(BS.Primary).setEmoji("🙋"),new BB().setCustomId(`tx_${t.id}`).setLabel("Close").setStyle(BS.Danger).setEmoji("🔒"))]});await ix.reply({content:`<#${ch.id}>`,ephemeral:true});return log(ix.guild,`🎫 ${t.tag} — ${ix.user.displayName}`);}
if(id==="m_sug"){const t=ix.fields.getTextInputValue("t"),d=ix.fields.getTextInputValue("d");let c=(ix.fields.getTextInputValue("c")||"general").toLowerCase().trim();const s=db.mkSug(ix.user.id,ix.user.displayName,t,d,c);const cfg=db.getCfg(ix.guildId);const ch=cfg?.sugCh?ix.guild.channels.cache.get(cfg.sugCh):ix.channel;const msg=await(ch||ix.channel).send({content:`💡 **New Suggestion** — ${s.tag}`,embeds:[E.sugC(s)],components:[E.sugVB(s.id),E.sugAB(s.id)]});db.setSugMsg(s.id,(ch||ix.channel).id,msg.id);await ix.reply({content:`**${s.tag}** submitted!`,ephemeral:true});return log(ix.guild,`💡 ${s.tag} — ${t}`);}
if(id.startsWith("ms_")){const p=id.split("_"),st=p[1],sid=parseInt(p[2]),r=ix.fields.getTextInputValue("r");const s=db.respSug(sid,st,r,ix.user.displayName);if(!s)return ix.reply({content:"Not found.",ephemeral:true});await ix.update({embeds:[E.sugC(s)],components:[E.sugVB(sid)]});try{const u=await cl.users.fetch(s.uid);await u.send({embeds:[new EB().setTitle("Suggestion Response!").setColor(0xf39c12).setDescription(`**${s.tag}:** ${s.title}\nStatus: **${st}**\n${r}`)]});}catch{}return log(ix.guild,`💡 ${s.tag} → ${st}`);}
if(id==="m_beta"){const r=ix.fields.getTextInputValue("r"),p=ix.fields.getTextInputValue("p");const a=db.applyBeta(ix.user.id,ix.user.displayName,r,p);if(a.err==="pending")return ix.reply({content:"Already pending.",ephemeral:true});if(a.err==="has_key")return ix.reply({content:"Already have key.",ephemeral:true});await ix.reply({content:`Application #${a.id} received!`,ephemeral:true});const cfg=db.getCfg(ix.guildId);const rc=cfg?.betaRev?ix.guild.channels.cache.get(cfg.betaRev):null;if(rc)await rc.send({content:`📨 **Beta #${a.id}**`,embeds:[E.betaC(a)],components:[E.betaCB(a.id)]});return log(ix.guild,`📨 Beta #${a.id} — ${ix.user.displayName}`);}
if(id==="m_keys"){const keys=ix.fields.getTextInputValue("k").split(/[\n,;]+/).map(k=>k.trim()).filter(k=>k.length>2);const r=db.addKeys(keys);await ix.reply({content:`**${r.added}** keys added. Pool: **${r.total}**`,ephemeral:true});return log(ix.guild,`🔑 ${r.added} keys added`);}
}

// ===== SELECT MENU =====
async function hSel(ix){if(ix.customId!=="filt")return;const v=ix.values[0];let b,t;if(v==="all"){b=db.bugsActive();t="Active";}else if(v.startsWith("s_")){const s=v.slice(2);b=db.bugsSev(s);t=E.SEV[s]?.l||s;}else if(v.startsWith("c_")){const c=v.slice(2);b=db.bugsCat(c);t=E.CT[c]||c;}else{b=db.bugsBy(v);t=E.ST[v]?.l||v;}await ix.update({embeds:[E.listE(b,`📋 ${t}`)],components:[E.filtS()]});}

// ===== START =====
process.on("unhandledRejection",e=>console.error("Err:",e.message));
process.on("uncaughtException",e=>{console.error("Err:",e.message);if(["ECONNRESET","ENOTFOUND","ETIMEDOUT"].includes(e.code))setTimeout(()=>go(),5000);});
async function go(){try{console.log("Connecting...");await cl.login(process.env.BOT_TOKEN);}catch(e){console.error("Connect:",e.message);setTimeout(()=>go(),10000);}}
go();
