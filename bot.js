require("dotenv").config();
const{Client,GatewayIntentBits,PermissionsBitField,ChannelType,ModalBuilder,TextInputBuilder,TextInputStyle,ActionRowBuilder,EmbedBuilder,Events,REST,Routes,SlashCommandBuilder}=require("discord.js");
const{db}=require("./database");
const E=require("./embeds");
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildInvites]});

// ========== READY + AUTO DEPLOY ==========
client.once(Events.ClientReady,async()=>{
console.log(`\n  Bot aktif: ${client.user.tag} | ${client.guilds.cache.size} sunucu\n`);
client.user.setActivity("/panel | Studio Bot v6");
try{console.log("  Komutlar kaydediliyor...");
const c=[
new SlashCommandBuilder().setName("setup").setDescription("Sunucuyu kur").setDefaultMemberPermissions(0),
new SlashCommandBuilder().setName("panel").setDescription("Bug paneli").setDefaultMemberPermissions(0),
new SlashCommandBuilder().setName("admin-panel").setDescription("Admin paneli").setDefaultMemberPermissions(0),
new SlashCommandBuilder().setName("ticket-panel").setDescription("Ticket paneli").setDefaultMemberPermissions(0),
new SlashCommandBuilder().setName("sugg-panel").setDescription("Oneri paneli").setDefaultMemberPermissions(0),
new SlashCommandBuilder().setName("beta-panel").setDescription("Beta paneli").setDefaultMemberPermissions(0),
new SlashCommandBuilder().setName("beta-admin").setDescription("Beta key yonetim").setDefaultMemberPermissions(0),
new SlashCommandBuilder().setName("verify-panel").setDescription("Dogrulama paneli").setDefaultMemberPermissions(0),
new SlashCommandBuilder().setName("reaction-roles").setDescription("Platform secim paneli").setDefaultMemberPermissions(0),
new SlashCommandBuilder().setName("automod-panel").setDescription("AutoMod paneli").setDefaultMemberPermissions(0),
new SlashCommandBuilder().setName("bug").setDescription("Bug gor").addIntegerOption(o=>o.setName("id").setDescription("ID").setRequired(true)),
new SlashCommandBuilder().setName("bugs").setDescription("Bug listesi").addStringOption(o=>o.setName("filtre").setDescription("Durum").addChoices({name:"Aktif",value:"all"},{name:"Acik",value:"open"},{name:"Devam",value:"in-progress"},{name:"Cozulen",value:"resolved"},{name:"Kapali",value:"closed"})),
new SlashCommandBuilder().setName("bug-assign").setDescription("Bug ata").addIntegerOption(o=>o.setName("id").setDescription("ID").setRequired(true)).addUserOption(o=>o.setName("kisi").setDescription("Kisi").setRequired(true)),
new SlashCommandBuilder().setName("bug-search").setDescription("Bug ara").addStringOption(o=>o.setName("kelime").setDescription("Kelime").setRequired(true)),
new SlashCommandBuilder().setName("dashboard").setDescription("Dashboard"),
new SlashCommandBuilder().setName("stats").setDescription("Istatistik"),
new SlashCommandBuilder().setName("my-bugs").setDescription("Bana atananlar"),
new SlashCommandBuilder().setName("profil").setDescription("Oyuncu profili").addUserOption(o=>o.setName("kisi").setDescription("Kisi")),
new SlashCommandBuilder().setName("liderlik").setDescription("Liderlik tablosu"),
new SlashCommandBuilder().setName("dev-register").setDescription("Gelistirici kayit").addStringOption(o=>o.setName("uzmanlik").setDescription("Uzmanlik").setRequired(true).addChoices({name:"Gameplay",value:"gameplay"},{name:"Grafik",value:"graphics"},{name:"Ses",value:"audio"},{name:"Network",value:"network"},{name:"UI/UX",value:"ui"},{name:"AI",value:"ai"},{name:"QA",value:"qa"},{name:"Genel",value:"general"})).addStringOption(o=>o.setName("rol").setDescription("Rol").addChoices({name:"Developer",value:"developer"},{name:"Lead",value:"lead"},{name:"Tester",value:"tester"})),
new SlashCommandBuilder().setName("dev-list").setDescription("Gelistiriciler"),
new SlashCommandBuilder().setName("role-give").setDescription("Rol ver").setDefaultMemberPermissions(0).addUserOption(o=>o.setName("kisi").setDescription("Kisi").setRequired(true)).addStringOption(o=>o.setName("rol").setDescription("Rol").setRequired(true).addChoices({name:"Developer",value:"Developer"},{name:"3D Artist",value:"3D Artist"},{name:"Moderator",value:"Moderator"},{name:"Lead Developer",value:"Lead Developer"},{name:"QA Tester",value:"QA Tester"},{name:"Sound Designer",value:"Sound Designer"},{name:"Game Designer",value:"Game Designer"})),
new SlashCommandBuilder().setName("role-remove").setDescription("Rol al").setDefaultMemberPermissions(0).addUserOption(o=>o.setName("kisi").setDescription("Kisi").setRequired(true)).addStringOption(o=>o.setName("rol").setDescription("Rol").setRequired(true).addChoices({name:"Developer",value:"Developer"},{name:"3D Artist",value:"3D Artist"},{name:"Moderator",value:"Moderator"},{name:"Lead Developer",value:"Lead Developer"},{name:"QA Tester",value:"QA Tester"},{name:"Sound Designer",value:"Sound Designer"},{name:"Game Designer",value:"Game Designer"})),
new SlashCommandBuilder().setName("warn").setDescription("Uyari ver").setDefaultMemberPermissions(0).addUserOption(o=>o.setName("kisi").setDescription("Kisi").setRequired(true)).addStringOption(o=>o.setName("sebep").setDescription("Sebep").setRequired(true)),
new SlashCommandBuilder().setName("warnings").setDescription("Uyarilar").addUserOption(o=>o.setName("kisi").setDescription("Kisi").setRequired(true)),
new SlashCommandBuilder().setName("note").setDescription("Not ekle").setDefaultMemberPermissions(0).addUserOption(o=>o.setName("kisi").setDescription("Kisi").setRequired(true)).addStringOption(o=>o.setName("not").setDescription("Not").setRequired(true)),
new SlashCommandBuilder().setName("notes").setDescription("Notlar").addUserOption(o=>o.setName("kisi").setDescription("Kisi").setRequired(true)),
new SlashCommandBuilder().setName("ticket-close").setDescription("Ticket kapat").addStringOption(o=>o.setName("sebep").setDescription("Sebep")),
new SlashCommandBuilder().setName("sugg-respond").setDescription("Oneriye yanit").setDefaultMemberPermissions(0).addIntegerOption(o=>o.setName("id").setDescription("ID").setRequired(true)).addStringOption(o=>o.setName("durum").setDescription("Durum").setRequired(true).addChoices({name:"Kabul",value:"approved"},{name:"Plan",value:"planned"},{name:"Red",value:"rejected"},{name:"Yapildi",value:"done"})).addStringOption(o=>o.setName("yanit").setDescription("Yanit").setRequired(true)),
new SlashCommandBuilder().setName("announce").setDescription("Duyuru").setDefaultMemberPermissions(0).addStringOption(o=>o.setName("baslik").setDescription("Baslik").setRequired(true)).addStringOption(o=>o.setName("icerik").setDescription("Icerik").setRequired(true)).addStringOption(o=>o.setName("tur").setDescription("Tur").setRequired(true).addChoices({name:"Duyuru",value:"general"},{name:"Guncelleme",value:"update"},{name:"Yama",value:"patchnote"},{name:"Etkinlik",value:"event"},{name:"Onemli",value:"important"})).addBooleanOption(o=>o.setName("ping").setDescription("@everyone?")),
new SlashCommandBuilder().setName("giveaway").setDescription("Cekilis baslat").setDefaultMemberPermissions(0).addStringOption(o=>o.setName("odul").setDescription("Odul").setRequired(true)).addIntegerOption(o=>o.setName("sure").setDescription("Sure (dakika)").setRequired(true)).addIntegerOption(o=>o.setName("kazanan").setDescription("Kazanan sayisi")),
new SlashCommandBuilder().setName("giveaway-end").setDescription("Cekilisi bitir").setDefaultMemberPermissions(0).addIntegerOption(o=>o.setName("id").setDescription("ID").setRequired(true)),
new SlashCommandBuilder().setName("poll").setDescription("Anket olustur").setDefaultMemberPermissions(0).addStringOption(o=>o.setName("soru").setDescription("Soru").setRequired(true)).addStringOption(o=>o.setName("secenekler").setDescription("Virgul ile: A,B,C,D").setRequired(true)).addIntegerOption(o=>o.setName("sure").setDescription("Sure (dakika)")),
new SlashCommandBuilder().setName("poll-end").setDescription("Anketi bitir").setDefaultMemberPermissions(0).addIntegerOption(o=>o.setName("id").setDescription("ID").setRequired(true)),
new SlashCommandBuilder().setName("beta-addkeys").setDescription("Key ekle").setDefaultMemberPermissions(0).addStringOption(o=>o.setName("keyler").setDescription("KEY1,KEY2").setRequired(true)),
new SlashCommandBuilder().setName("beta-pool").setDescription("Key havuzu").setDefaultMemberPermissions(0),
new SlashCommandBuilder().setName("beta-pending").setDescription("Bekleyen basvurular").setDefaultMemberPermissions(0),
new SlashCommandBuilder().setName("beta-used").setDescription("Dagitilan keyler").setDefaultMemberPermissions(0),
new SlashCommandBuilder().setName("automod-word").setDescription("Yasakli kelime").setDefaultMemberPermissions(0).addStringOption(o=>o.setName("islem").setDescription("ekle/sil").setRequired(true).addChoices({name:"Ekle",value:"add"},{name:"Sil",value:"remove"})).addStringOption(o=>o.setName("kelime").setDescription("Kelime").setRequired(true)),
];
const rest=new REST().setToken(process.env.BOT_TOKEN);
await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID,process.env.GUILD_ID),{body:c.map(x=>x.toJSON())});
console.log(`  ${c.length} komut kaydedildi!\n`);
}catch(e){console.error("  Komut hatasi:",e.message);}
// Cache invites
try{const g=client.guilds.cache.first();if(g){const inv=await g.invites.fetch();db.storeInvites(inv.map(i=>({code:i.code,uses:i.uses,inviter:i.inviter?.id})));}}catch{}
});

// ========== LOG ==========
async function log(guild,msg){try{const c=db.getConfig(guild.id);if(!c?.log_channel_id)return;const ch=guild.channels.cache.get(c.log_channel_id);if(ch)await ch.send(`\`${new Date().toLocaleString("tr-TR")}\` ${msg}`);}catch{}}

// ========== WELCOME + INVITE TRACKING ==========
client.on(Events.GuildMemberAdd,async(member)=>{try{
const cfg=db.getConfig(member.guild.id);
db.addWelcome(member.id,member.displayName);
db.getMember(member.id);db.updateMember(member.id,{username:member.displayName,joined_at:new Date().toLocaleString("tr-TR")});
// Invite tracking
try{const newInv=await member.guild.invites.fetch();const oldInv=db.getStoredInvites();const used=newInv.find(i=>{const old=oldInv.find(o=>o.code===i.code);return old&&i.uses>old.uses;});if(used?.inviter){db.incInvites(used.inviter.id);db.addXP(used.inviter.id,50);await log(member.guild,`📨 ${member.displayName} davet edildi (by <@${used.inviter.id}> +50XP)`);}db.storeInvites(newInv.map(i=>({code:i.code,uses:i.uses,inviter:i.inviter?.id})));}catch{}
// Welcome message
if(cfg?.welcome_channel_id){const ch=member.guild.channels.cache.get(cfg.welcome_channel_id);if(ch)await ch.send({content:`<@${member.id}>`,embeds:[new EmbedBuilder().setTitle("Hosgeldin!").setColor(0x00cc00).setDescription(`<@${member.id}> sunucuya katildi!\nUye sayisi: **${member.guild.memberCount}**`).setThumbnail(member.user.displayAvatarURL()).setTimestamp()]});}
}catch{}});

// ========== AUTOMOD (MESSAGE) ==========
client.on(Events.MessageCreate,async(msg)=>{
if(msg.author.bot||!msg.guild)return;
// Track XP
const result=db.trackMessage(msg.author.id,msg.author.displayName);
if(result.leveled){const cfg=db.getConfig(msg.guild.id);
try{await msg.channel.send(`🎉 <@${msg.author.id}> **Seviye ${result.level}** oldu!`);}catch{}
// Auto role on level
const lvlRoles={5:"Aktif Oyuncu",10:"Deneyimli",25:"Veteran",50:"Efsane"};
if(lvlRoles[result.level]){try{const role=msg.guild.roles.cache.find(r=>r.name===lvlRoles[result.level]);if(role)await msg.member.roles.add(role);}catch{}}}
// Automod checks
const am=db.getAutomod();if(!am)return;
const content=msg.content.toLowerCase();
// Banned words
if(am.banned_words?.some(w=>content.includes(w))){try{await msg.delete();await msg.channel.send({content:`<@${msg.author.id}> yasakli kelime kullanimi!`,}).then(m=>setTimeout(()=>m.delete().catch(()=>{}),5000));await log(msg.guild,`🛡️ AutoMod: ${msg.author.displayName} yasakli kelime`);}catch{}return;}
// Caps check
if(msg.content.length>10){const caps=msg.content.replace(/[^A-Z]/g,"").length;const pct=caps/msg.content.length*100;if(pct>(am.max_caps_percent||70)){try{await msg.delete();await msg.channel.send({content:`<@${msg.author.id}> cok fazla BUYUK HARF!`}).then(m=>setTimeout(()=>m.delete().catch(()=>{}),5000));}catch{}return;}}
// Mention spam
const mentions=msg.mentions.users.size+msg.mentions.roles.size;if(mentions>(am.max_mentions||5)){try{await msg.delete();await msg.channel.send({content:`<@${msg.author.id}> cok fazla mention!`}).then(m=>setTimeout(()=>m.delete().catch(()=>{}),5000));}catch{}return;}
});

// ========== INTERACTION ROUTER ==========
client.on(Events.InteractionCreate,async(ix)=>{try{
if(ix.isChatInputCommand())return await handleCmd(ix);
if(ix.isButton())return await handleBtn(ix);
if(ix.isModalSubmit())return await handleModal(ix);
if(ix.isStringSelectMenu())return await handleSelect(ix);
}catch(err){console.error("HATA:",err.message,err.stack);const r={content:"Hata olustu.",ephemeral:true};if(ix.replied||ix.deferred)await ix.followUp(r).catch(()=>{});else await ix.reply(r).catch(()=>{});}});

// ========== COMMANDS ==========
async function handleCmd(ix){const c=ix.commandName;
// SETUP
if(c==="setup"){if(!ix.member.permissions.has(PermissionsBitField.Flags.Administrator))return ix.reply({content:"Admin gerekli.",ephemeral:true});await ix.deferReply();try{const g=ix.guild;console.log("Setup basliyor...");
const fr=async(n,col)=>g.roles.cache.find(r=>r.name===n)||await g.roles.create({name:n,color:col,reason:"Studio Bot"});
const rl={};for(const[n,col]of[["Developer",0x3498db],["3D Artist",0xe91e63],["Moderator",0xe74c3c],["Lead Developer",0xf39c12],["QA Tester",0x2ecc71],["Sound Designer",0x9b59b6],["Game Designer",0x1abc9c],["Aktif Oyuncu",0x11806a],["Deneyimli",0x1f8b4c],["Veteran",0xc27c0e],["Efsane",0xa84300],["PC Player",0x3498db],["PS Player",0x2e4057],["Xbox Player",0x107c10],["Mobile Player",0xe67e22],["Beta Tester",0x9b59b6]]){rl[n]=await fr(n,col);console.log(`  Rol: ${n}`);}
let cat=g.channels.cache.find(ch=>ch.name==="Studio Hub"&&ch.type===ChannelType.GuildCategory);if(!cat)cat=await g.channels.create({name:"Studio Hub",type:ChannelType.GuildCategory});
const cd=[{name:"dogrulama",topic:"Kural kabul"},{name:"platform-sec",topic:"Reaction role"},{name:"bug-panel",topic:"Bug raporla"},{name:"oneriler",topic:"Oneri gonder"},{name:"destek-ticket",topic:"Destek"},{name:"beta-basvuru",topic:"Beta"},{name:"beta-key-yonetim",topic:"Key yonetim"},{name:"beta-inceleme",topic:"Onay/red"},{name:"cekilisler",topic:"Cekilisler"},{name:"anketler",topic:"Anketler"},{name:"duyurular",topic:"Duyurular"},{name:"admin-panel",topic:"Admin"},{name:"automod",topic:"AutoMod"},{name:"bot-log",topic:"Log"},{name:"hosgeldin",topic:"Karsilama"},{name:"genel-sohbet",topic:"Sohbet"}];
const chs={};for(const d of cd){chs[d.name]=g.channels.cache.find(ch=>ch.name===d.name&&ch.parentId===cat.id)||await g.channels.create({name:d.name,type:ChannelType.GuildText,parent:cat.id,topic:d.topic});console.log(`  Kanal: ${d.name}`);}
db.setConfig(g.id,{bug_channel_id:chs["bug-panel"].id,admin_channel_id:chs["admin-panel"].id,ticket_channel_id:chs["destek-ticket"].id,sugg_channel_id:chs["oneriler"].id,beta_channel_id:chs["beta-basvuru"].id,beta_admin_id:chs["beta-key-yonetim"].id,beta_review_id:chs["beta-inceleme"].id,announce_channel_id:chs["duyurular"].id,log_channel_id:chs["bot-log"].id,welcome_channel_id:chs["hosgeldin"].id,verify_channel_id:chs["dogrulama"].id,giveaway_channel_id:chs["cekilisler"].id,poll_channel_id:chs["anketler"].id,automod_channel_id:chs["automod"].id,dev_role_id:rl["Developer"].id,lead_role_id:rl["Lead Developer"].id,tester_role_id:rl["QA Tester"].id});
// Place panels
await chs["dogrulama"].send({embeds:[E.verifyPanel()],components:[E.verifyBtn()]});
await chs["platform-sec"].send({embeds:[E.reactionRolePanel()],components:E.reactionRoleBtns()});
await chs["bug-panel"].send({embeds:[E.bugPanel()],components:E.bugPanelBtns()});
await chs["oneriler"].send({embeds:[E.suggPanel()],components:E.suggPanelBtns()});
await chs["destek-ticket"].send({embeds:[E.ticketPanel(db.ticketStats())],components:E.ticketPanelBtns()});
await chs["beta-basvuru"].send({embeds:[E.betaPanel(db.betaStats())],components:E.betaPanelBtns()});
await chs["beta-key-yonetim"].send({embeds:[E.betaAdminPanel(db.betaStats())],components:E.betaAdminBtns()});
await chs["admin-panel"].send({embeds:[E.adminPanel(db.getStats(),db.ticketStats(),db.betaStats())],components:E.adminBtns()});
await chs["automod"].send({embeds:[E.automodPanel(db.getAutomod())],components:[E.automodBtns()]});
console.log("  Paneller ok");
await ix.editReply({embeds:[new EmbedBuilder().setTitle("Kurulum Tamamlandi!").setColor(0x00cc00).setDescription(`**${Object.keys(chs).length} kanal** + **${Object.keys(rl).length} rol** olusturuldu!`).addFields({name:"Kanallar",value:Object.values(chs).map(ch=>`${ch}`).join("\n")}).setTimestamp()]});console.log("Setup tamamlandi!\n");
}catch(e){console.error("SETUP:",e.message,e.stack);await ix.editReply({content:`Hata: ${e.message}`}).catch(()=>{});}return;}
// PANELS
if(c==="panel"){await ix.channel.send({embeds:[E.bugPanel()],components:E.bugPanelBtns()});return ix.reply({content:"Ok.",ephemeral:true});}
if(c==="admin-panel"){await ix.channel.send({embeds:[E.adminPanel(db.getStats(),db.ticketStats(),db.betaStats())],components:E.adminBtns()});return ix.reply({content:"Ok.",ephemeral:true});}
if(c==="ticket-panel"){await ix.channel.send({embeds:[E.ticketPanel(db.ticketStats())],components:E.ticketPanelBtns()});return ix.reply({content:"Ok.",ephemeral:true});}
if(c==="sugg-panel"){await ix.channel.send({embeds:[E.suggPanel()],components:E.suggPanelBtns()});return ix.reply({content:"Ok.",ephemeral:true});}
if(c==="beta-panel"){await ix.channel.send({embeds:[E.betaPanel(db.betaStats())],components:E.betaPanelBtns()});return ix.reply({content:"Ok.",ephemeral:true});}
if(c==="beta-admin"){await ix.channel.send({embeds:[E.betaAdminPanel(db.betaStats())],components:E.betaAdminBtns()});return ix.reply({content:"Ok.",ephemeral:true});}
if(c==="verify-panel"){await ix.channel.send({embeds:[E.verifyPanel()],components:[E.verifyBtn()]});return ix.reply({content:"Ok.",ephemeral:true});}
if(c==="reaction-roles"){await ix.channel.send({embeds:[E.reactionRolePanel()],components:E.reactionRoleBtns()});return ix.reply({content:"Ok.",ephemeral:true});}
if(c==="automod-panel"){await ix.channel.send({embeds:[E.automodPanel(db.getAutomod())],components:[E.automodBtns()]});return ix.reply({content:"Ok.",ephemeral:true});}
// BUG
if(c==="bug"){const bug=db.getBug(ix.options.getInteger("id"));if(!bug)return ix.reply({content:"Yok.",ephemeral:true});return ix.reply({embeds:[E.bugCard(bug,db.getHistory(bug.id),db.getComments(bug.id))],components:E.bugBtns(bug)});}
if(c==="bug-assign"){const bid=ix.options.getInteger("id"),u=ix.options.getUser("kisi"),bug=db.getBug(bid);if(!bug)return ix.reply({content:"Yok.",ephemeral:true});db.assignBug(bid,u.id,u.displayName);const up=db.getBug(bid);await ix.reply({content:`**${up.tag}** → <@${u.id}>`,embeds:[E.bugCard(up,db.getHistory(bid))],components:E.bugBtns(up)});try{await u.send(`Bug: **${up.tag}: ${up.title}**`);}catch{}return log(ix.guild,`👤 ${up.tag} → ${u.displayName}`);}
if(c==="bugs"){const f=ix.options.getString("filtre")||"all";return ix.reply({embeds:[E.listEmbed(f==="all"?db.listActive():db.listByStatus(f),"📋 Buglar")],components:[E.filterSelect()]});}
if(c==="bug-search"){return ix.reply({embeds:[E.listEmbed(db.search(ix.options.getString("kelime")),`🔎 Arama`)]});}
if(c==="dashboard"){return ix.reply({embeds:[E.dashEmbed(db.getStats(),db.leaderboard())]});}
if(c==="stats"){return ix.reply({embeds:[E.statsEmbed(db.getStats(),db.leaderboard())]});}
if(c==="my-bugs"){return ix.reply({embeds:[E.listEmbed(db.listByDev(ix.user.id),`📌 ${ix.user.displayName}`)]});}
// PROFILE & LEADERBOARD
if(c==="profil"){const u=ix.options.getUser("kisi")||ix.user;const m=db.getMember(u.id);m.username=u.displayName;const lb=db.leaderboardMembers();const rank=lb.findIndex(x=>x.user_id===u.id)+1;return ix.reply({embeds:[E.profileCard(m,rank||"?")]});}
if(c==="liderlik"){return ix.reply({embeds:[E.leaderboardEmbed(db.leaderboardMembers())]});}
// DEV
if(c==="dev-register"){const sp=ix.options.getString("uzmanlik"),rl=ix.options.getString("rol")||"developer";db.registerDev(ix.user.id,ix.user.displayName,rl,sp);const cfg=db.getConfig(ix.guildId);if(cfg){try{const m={developer:cfg.dev_role_id,lead:cfg.lead_role_id,tester:cfg.tester_role_id};if(m[rl])await ix.member.roles.add(m[rl]);}catch{}}await ix.reply({content:`**${ix.user.displayName}** kayit! ${sp} | ${rl}`});return log(ix.guild,`🛠️ ${ix.user.displayName} (${sp})`);}
if(c==="dev-list"){const devs=db.listDevs();if(!devs.length)return ix.reply({content:"Yok.",ephemeral:true});return ix.reply({embeds:[new EmbedBuilder().setTitle("👥 Ekip").setColor(0x5865f2).setDescription(devs.map(d=>`**${d.username}** — ${d.role} | ${d.specialty} | ${d.bugs_resolved}`).join("\n"))]});}
// ROLES
if(c==="role-give"){const u=ix.options.getUser("kisi"),rn=ix.options.getString("rol");const role=ix.guild.roles.cache.find(r=>r.name===rn);if(!role)return ix.reply({content:"Rol yok.",ephemeral:true});await(await ix.guild.members.fetch(u.id)).roles.add(role);await ix.reply({content:`${role} → <@${u.id}>`});return log(ix.guild,`🎭 ${rn} → ${u.displayName}`);}
if(c==="role-remove"){const u=ix.options.getUser("kisi"),rn=ix.options.getString("rol");const role=ix.guild.roles.cache.find(r=>r.name===rn);if(!role)return ix.reply({content:"Rol yok.",ephemeral:true});await(await ix.guild.members.fetch(u.id)).roles.remove(role);await ix.reply({content:`${role} ← <@${u.id}>`});return log(ix.guild,`🎭 ${rn} ← ${u.displayName}`);}
// WARN/NOTE
if(c==="warn"){const u=ix.options.getUser("kisi"),s=ix.options.getString("sebep");const cnt=db.addWarning(u.id,u.displayName,s,ix.user.displayName);await ix.reply({embeds:[new EmbedBuilder().setTitle("Uyari").setColor(0xff0000).setDescription(`<@${u.id}> uyarildi.\n**Sebep:** ${s}\n**Toplam:** ${cnt}`)]});try{await u.send(`Uyari: ${s} (${cnt})`);}catch{}return log(ix.guild,`⚠️ ${u.displayName}: ${s}`);}
if(c==="warnings"){const u=ix.options.getUser("kisi"),w=db.getWarnings(u.id);if(!w.length)return ix.reply({content:"Yok.",ephemeral:true});return ix.reply({embeds:[new EmbedBuilder().setTitle("Uyarilar").setColor(0xff0000).setDescription(w.map((x,i)=>`**${i+1}.** ${x.reason} — ${x.by}`).join("\n"))],ephemeral:true});}
if(c==="note"){const u=ix.options.getUser("kisi"),n=ix.options.getString("not");db.addNote(u.id,u.displayName,n,ix.user.displayName);await ix.reply({content:"Not eklendi.",ephemeral:true});return log(ix.guild,`📝 ${u.displayName}: ${n}`);}
if(c==="notes"){const u=ix.options.getUser("kisi"),n=db.getNotes(u.id);if(!n.length)return ix.reply({content:"Yok.",ephemeral:true});return ix.reply({embeds:[new EmbedBuilder().setTitle("Notlar").setColor(0x3498db).setDescription(n.map(x=>`**${x.by}** (${x.at}): ${x.note}`).join("\n"))],ephemeral:true});}
// TICKET
if(c==="ticket-close"){const t=db.getTicketByChannel(ix.channelId);if(!t)return ix.reply({content:"Ticket degil.",ephemeral:true});db.closeTicket(t.id,ix.options.getString("sebep")||"Kapatildi");await ix.reply({embeds:[new EmbedBuilder().setTitle(`${t.tag} Kapatildi`).setColor(0x95a5a6).setDescription(`Kapatan: ${ix.user.displayName}\n10sn sonra silinecek.`)]});await log(ix.guild,`🔒 ${t.tag}`);setTimeout(async()=>{try{await ix.channel.delete();}catch{}},10000);return;}
// SUGGESTION RESPOND
if(c==="sugg-respond"){const sid=ix.options.getInteger("id"),st=ix.options.getString("durum"),yn=ix.options.getString("yanit");const s=db.respondSugg(sid,st,yn,ix.user.displayName);if(!s)return ix.reply({content:"Yok.",ephemeral:true});await ix.reply({embeds:[E.suggCard(s)]});try{const u=await client.users.fetch(s.user_id);await u.send({embeds:[new EmbedBuilder().setTitle("Onerine Yanit!").setColor(0xf39c12).setDescription(`**${s.tag}:** ${s.title}\nDurum: **${st}**\n${yn}`)]});}catch{}return log(ix.guild,`💡 ${s.tag} → ${st}`);}
// ANNOUNCE
if(c==="announce"){const t=ix.options.getString("baslik"),ic=ix.options.getString("icerik"),tur=ix.options.getString("tur"),ping=ix.options.getBoolean("ping");const cfg=db.getConfig(ix.guildId);const ch=cfg?.announce_channel_id?ix.guild.channels.cache.get(cfg.announce_channel_id):ix.channel;await(ch||ix.channel).send({content:ping?"@everyone":"",embeds:[E.announceEmbed(t,ic,tur,ix.user.displayName)]});db.createAnnouncement(t,ic,tur,ix.user.displayName);await ix.reply({content:"Duyuru gonderildi.",ephemeral:true});return log(ix.guild,`📢 ${t}`);}
// GIVEAWAY
if(c==="giveaway"){const prize=ix.options.getString("odul"),mins=ix.options.getInteger("sure"),winners=ix.options.getInteger("kazanan")||1;const cfg=db.getConfig(ix.guildId);const ch=cfg?.giveaway_channel_id?ix.guild.channels.cache.get(cfg.giveaway_channel_id):ix.channel;const g=db.createGiveaway(prize,mins*60000,winners,ix.user.displayName,null,null);const msg=await(ch||ix.channel).send({embeds:[E.giveawayEmbed(g)],components:[E.giveawayBtn(g.id)]});g.channel_id=ch?.id;g.message_id=msg.id;await ix.reply({content:`Cekilis #${g.id} baslatildi!`,ephemeral:true});await log(ix.guild,`🎁 Cekilis: ${prize} (${mins}dk)`);
// Auto end
setTimeout(async()=>{const result=db.endGiveaway(g.id);if(!result)return;try{const gch=ix.guild.channels.cache.get(g.channel_id);if(gch){const gmsg=await gch.messages.fetch(msg.id);await gmsg.edit({embeds:[E.giveawayEmbed(db.getGiveaway(g.id))],components:[]});await gch.send(`🎉 **${prize}** kazanan: ${result.winners.map(w=>`<@${w}>`).join(", ")||"Katilimci yok!"}`);}}catch{}},mins*60000);return;}
if(c==="giveaway-end"){const gid=ix.options.getInteger("id");const result=db.endGiveaway(gid);if(!result)return ix.reply({content:"Cekilis yok.",ephemeral:true});await ix.reply({content:`Kazanan: ${result.winners.map(w=>`<@${w}>`).join(", ")||"Yok"}`});return;}
// POLL
if(c==="poll"){const q=ix.options.getString("soru"),opts=ix.options.getString("secenekler").split(",").map(o=>o.trim()).filter(o=>o),mins=ix.options.getInteger("sure");const p=db.createPoll(q,opts,mins?mins*60000:null,ix.user.displayName);const cfg=db.getConfig(ix.guildId);const ch=cfg?.poll_channel_id?ix.guild.channels.cache.get(cfg.poll_channel_id):ix.channel;const msg=await(ch||ix.channel).send({embeds:[E.pollEmbed(p)],components:E.pollBtns(p)});db.setPollMsg(p.id,ch?.id||ix.channelId,msg.id);await ix.reply({content:`Anket #${p.id} olusturuldu!`,ephemeral:true});
if(mins){setTimeout(async()=>{const ep=db.endPoll(p.id);if(!ep)return;try{const pch=ix.guild.channels.cache.get(ep.channel_id);if(pch){const pmsg=await pch.messages.fetch(ep.message_id);await pmsg.edit({embeds:[E.pollEmbed(ep)],components:[]});}}catch{}},mins*60000);}return;}
if(c==="poll-end"){const pid=ix.options.getInteger("id");const p=db.endPoll(pid);if(!p)return ix.reply({content:"Anket yok.",ephemeral:true});await ix.reply({embeds:[E.pollEmbed(p)]});return;}
// BETA
if(c==="beta-addkeys"){const keys=ix.options.getString("keyler").split(/[,\n;]+/).map(k=>k.trim()).filter(k=>k.length>2);const r=db.addKeys(keys);await ix.reply({content:`**${r.added}** key eklendi. Toplam: **${r.total}**`,ephemeral:true});return log(ix.guild,`🔑 ${r.added} key eklendi`);}
if(c==="beta-pool"){return ix.reply({embeds:[E.betaStatsEmbed(db.betaStats())],ephemeral:true});}
if(c==="beta-pending"){const apps=db.listApps("pending");if(!apps.length)return ix.reply({content:"Yok.",ephemeral:true});return ix.reply({embeds:apps.slice(0,5).map(a=>E.betaAppCard(a)),components:apps.slice(0,5).map(a=>E.betaAppBtns(a.id)),ephemeral:true});}
if(c==="beta-used"){const used=db.listUsedKeys();if(!used.length)return ix.reply({content:"Yok.",ephemeral:true});return ix.reply({embeds:[new EmbedBuilder().setTitle("Dagitilan Keyler").setColor(0x9b59b6).setDescription(used.map(k=>`\`${k.key.slice(0,8)}...\` → **${k.claimed_by_name}**`).join("\n").slice(0,4000))],ephemeral:true});}
// AUTOMOD
if(c==="automod-word"){const islem=ix.options.getString("islem"),kelime=ix.options.getString("kelime");if(islem==="add")db.addBannedWord(kelime);else db.removeBannedWord(kelime);return ix.reply({content:`"${kelime}" ${islem==="add"?"eklendi":"silindi"}.`,ephemeral:true});}
}

// ========== BUTTONS ==========
async function handleBtn(ix){const id=ix.customId;
// VERIFY
if(id==="verify_accept"){const cfg=db.getConfig(ix.guildId);const memberRole=ix.guild.roles.cache.find(r=>r.name==="Verified")||await ix.guild.roles.create({name:"Verified",color:0x2ecc71});try{await ix.member.roles.add(memberRole);}catch{}await ix.reply({content:"Dogrulandi! Sunucuya hosgeldin.",ephemeral:true});return log(ix.guild,`✅ ${ix.user.displayName} dogrulandi`);}
// REACTION ROLES
if(id.startsWith("rrole_")){const roleName=id.replace("rrole_","");const role=ix.guild.roles.cache.find(r=>r.name===roleName);if(!role)return ix.reply({content:"Rol bulunamadi.",ephemeral:true});if(ix.member.roles.cache.has(role.id)){await ix.member.roles.remove(role);return ix.reply({content:`${role} kaldirildi.`,ephemeral:true});}else{await ix.member.roles.add(role);return ix.reply({content:`${role} verildi!`,ephemeral:true});}}
// BUG PANEL
if(id==="open_report"){const m=new ModalBuilder().setCustomId("bug_report_modal").setTitle("Bug Raporu");m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("title").setLabel("Bug Basligi").setStyle(TextInputStyle.Short).setMaxLength(120).setRequired(true)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("description").setLabel("Detayli Aciklama").setStyle(TextInputStyle.Paragraph).setMaxLength(1500).setRequired(true)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("steps").setLabel("Tekrarlama Adimlari").setStyle(TextInputStyle.Paragraph).setMaxLength(800).setRequired(false)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("severity").setLabel("Ciddiyet (critical/high/medium/low)").setStyle(TextInputStyle.Short).setPlaceholder("medium").setMaxLength(10).setRequired(true)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("platform").setLabel("Platform (pc/ps/xbox/mobile/all)").setStyle(TextInputStyle.Short).setPlaceholder("pc").setMaxLength(15).setRequired(false)));return ix.showModal(m);}
if(id==="my_bugs")return ix.reply({embeds:[E.listEmbed(db.listByReporter(ix.user.id),`📝 ${ix.user.displayName}`)],ephemeral:true});
if(id==="open_dashboard")return ix.reply({embeds:[E.dashEmbed(db.getStats(),db.leaderboard())],ephemeral:true});
if(id==="open_leaderboard")return ix.reply({embeds:[E.leaderboardEmbed(db.leaderboardMembers())],ephemeral:true});
// ADMIN
if(id==="admin_bugs")return ix.reply({embeds:[E.listEmbed(db.listActive(),"📋 Aktif")],components:[E.filterSelect()],ephemeral:true});
if(id==="admin_critical")return ix.reply({embeds:[E.listEmbed(db.listBySeverity("critical"),"🚨 Kritik")],ephemeral:true});
if(id==="admin_tickets"){const t=db.listOpenTickets();return ix.reply({embeds:[new EmbedBuilder().setTitle("🎫 Acik Ticketlar").setColor(0xe74c3c).setDescription(t.length?t.map(x=>`**${x.tag}** ${x.category} — <@${x.user_id}>${x.claimed_by?` → <@${x.claimed_by}>`:""}`).join("\n"):"Yok.")],ephemeral:true});}
if(id==="admin_refresh")return ix.update({embeds:[E.adminPanel(db.getStats(),db.ticketStats(),db.betaStats())],components:E.adminBtns()});
if(id==="admin_members"){const lb=db.leaderboardMembers().slice(0,10);return ix.reply({embeds:[E.leaderboardEmbed(lb)],ephemeral:true});}
if(id==="admin_automod")return ix.reply({embeds:[E.automodPanel(db.getAutomod())],ephemeral:true});
if(id==="admin_giveaways"){const gs=db.listActiveGiveaways();return ix.reply({embeds:[new EmbedBuilder().setTitle("🎁 Aktif Cekilisler").setColor(0xf39c12).setDescription(gs.length?gs.map(g=>`#${g.id} **${g.prize}** — ${g.entries.length} katilimci`).join("\n"):"Aktif cekilis yok.")],ephemeral:true});}
if(id==="admin_stats")return ix.reply({embeds:[E.statsEmbed(db.getStats(),db.leaderboard())],ephemeral:true});
// AUTOMOD
if(id==="automod_words"){const am=db.getAutomod();return ix.reply({embeds:[new EmbedBuilder().setTitle("🚫 Yasakli Kelimeler").setColor(0xe74c3c).setDescription(am.banned_words?.length?am.banned_words.map(w=>`\`${w}\``).join(", "):"Liste bos.")],ephemeral:true});}
if(id==="automod_settings")return ix.reply({embeds:[E.automodPanel(db.getAutomod())],ephemeral:true});
// TICKET
if(id.startsWith("ticket_")){const cat=id.replace("ticket_","");const m=new ModalBuilder().setCustomId(`ticketmodal_${cat}`).setTitle("Destek Ticket");m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("desc").setLabel("Sorununu anlat").setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true)));return ix.showModal(m);}
if(id.startsWith("tktclaim_")){const tid=parseInt(id.split("_")[1]);db.claimTicket(tid,ix.user.id,ix.user.displayName);await ix.reply({content:`🙋 **${ix.user.displayName}** sahiplendi.`});return;}
if(id.startsWith("tktclose_")){const tid=parseInt(id.split("_")[1]);const t=db.getTicket(tid);db.closeTicket(tid,`${ix.user.displayName}`);await ix.reply({embeds:[new EmbedBuilder().setTitle(`${t?.tag||"Ticket"} Kapatildi`).setColor(0x95a5a6).setDescription("10sn sonra silinecek.")]});await log(ix.guild,`🔒 ${t?.tag}`);setTimeout(async()=>{try{await ix.channel.delete();}catch{}},10000);return;}
// SUGGESTION
if(id==="sugg_create"){const m=new ModalBuilder().setCustomId("sugg_modal").setTitle("Oneri Gonder");m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("title").setLabel("Oneri Basligi").setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("desc").setLabel("Detayli Aciklama").setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("cat").setLabel("Kategori (gameplay/gorsel/topluluk/diger)").setStyle(TextInputStyle.Short).setPlaceholder("gameplay").setMaxLength(15).setRequired(false)));return ix.showModal(m);}
if(id==="sugg_top"){const top=db.topSuggs();if(!top.length)return ix.reply({content:"Yok.",ephemeral:true});return ix.reply({embeds:[new EmbedBuilder().setTitle("🔥 En Populer").setColor(0xf39c12).setDescription(top.map((s,i)=>`**${i+1}.** ${s.tag} — ${s.title} (net: **${(s.upvotes?.length||0)-(s.downvotes?.length||0)}**)`).join("\n"))],ephemeral:true});}
if(id==="sugg_mine"){const mine=db.listSuggs().filter(s=>s.user_id===ix.user.id);return ix.reply({embeds:[new EmbedBuilder().setTitle("📌 Onerilerin").setColor(0xf39c12).setDescription(mine.length?mine.map(s=>`${s.tag} — ${s.title} (${s.status})`).join("\n"):"Yok.")],ephemeral:true});}
if(id.startsWith("svup_")||id.startsWith("svdn_")){const type=id.startsWith("svup_")?"up":"down";const sid=parseInt(id.split("_")[1]);db.voteSugg(sid,ix.user.id,type);const s=db.getSugg(sid);return ix.update({embeds:[E.suggCard(s)],components:[E.suggVoteBtns(sid),E.suggAdminBtns(sid)]});}
if(id.startsWith("saccept_")||id.startsWith("splanned_")||id.startsWith("sreject_")||id.startsWith("sdone_")){const p=id.split("_");const smap={saccept:"approved",splanned:"planned",sreject:"rejected",sdone:"done"};const m=new ModalBuilder().setCustomId(`suggres_${smap[p[0]]}_${p[1]}`).setTitle("Yanit");m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("response").setLabel("Ekip yaniti").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)));return ix.showModal(m);}
// BETA
if(id==="beta_apply"){const m=new ModalBuilder().setCustomId("beta_apply_modal").setTitle("Beta Basvurusu");m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("Neden katilmak istiyorsun?").setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(true)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("platform").setLabel("Platform (PC/PS/Xbox/Mobile)").setStyle(TextInputStyle.Short).setMaxLength(20).setRequired(true)));return ix.showModal(m);}
if(id==="beta_status"){const apps=db.listApps().filter(a=>a.user_id===ix.user.id);if(!apps.length)return ix.reply({content:"Basvurun yok.",ephemeral:true});return ix.reply({embeds:[E.betaAppCard(apps[apps.length-1])],ephemeral:true});}
if(id==="beta_stats")return ix.reply({embeds:[E.betaStatsEmbed(db.betaStats())],ephemeral:true});
if(id==="beta_addkeys_btn"){const m=new ModalBuilder().setCustomId("beta_addkeys_modal").setTitle("Key Yukle");m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("keys").setLabel("Her satira bir key").setStyle(TextInputStyle.Paragraph).setMaxLength(4000).setRequired(true)));return ix.showModal(m);}
if(id==="beta_pending_btn"){const apps=db.listApps("pending");if(!apps.length)return ix.reply({content:"Yok.",ephemeral:true});return ix.reply({embeds:apps.slice(0,5).map(a=>E.betaAppCard(a)),components:apps.slice(0,5).map(a=>E.betaAppBtns(a.id)),ephemeral:true});}
if(id==="beta_used_btn"){const used=db.listUsedKeys();if(!used.length)return ix.reply({content:"Yok.",ephemeral:true});return ix.reply({embeds:[new EmbedBuilder().setTitle("📦 Dagitilanlar").setColor(0x9b59b6).setDescription(used.map(k=>`\`${k.key.slice(0,8)}...\` → **${k.claimed_by_name}**`).join("\n").slice(0,4000))],ephemeral:true});}
if(id==="beta_refresh")return ix.update({embeds:[E.betaAdminPanel(db.betaStats())],components:E.betaAdminBtns()});
if(id.startsWith("betaok_")){const aid=parseInt(id.split("_")[1]);const r=db.approveApp(aid,ix.user.displayName);if(r.error==="no_keys")return ix.reply({content:"Key yok!",ephemeral:true});if(r.error)return ix.reply({content:r.error,ephemeral:true});try{const u=await client.users.fetch(r.app.user_id);await u.send({embeds:[new EmbedBuilder().setTitle("🎉 Beta Onaylandi!").setColor(0x00cc00).setDescription(`Key'in:\n\`\`\`\n${r.key}\n\`\`\`\nKimseyle paylasmamalisin.`)]});const member=await ix.guild.members.fetch(r.app.user_id);const btRole=ix.guild.roles.cache.find(x=>x.name==="Beta Tester");if(btRole)await member.roles.add(btRole);}catch{}await ix.update({embeds:[E.betaAppCard(db.getApp(aid))],components:[]});return log(ix.guild,`✅ Beta #${aid} → ${r.app.user_name}`);}
if(id.startsWith("betano_")){const aid=parseInt(id.split("_")[1]);const r=db.rejectApp(aid,ix.user.displayName);if(r.error)return ix.reply({content:r.error,ephemeral:true});try{const u=await client.users.fetch(r.user_id);await u.send({embeds:[new EmbedBuilder().setTitle("Beta Reddedildi").setColor(0xff0000).setDescription("Ileride tekrar dene.")]});}catch{}await ix.update({embeds:[E.betaAppCard(db.getApp(aid))],components:[]});return log(ix.guild,`❌ Beta #${aid}`);}
// GIVEAWAY
if(id.startsWith("genter_")){const gid=parseInt(id.split("_")[1]);const ok=db.enterGiveaway(gid,ix.user.id);return ix.reply({content:ok?"🎉 Katildin!":"Zaten katildin.",ephemeral:true});}
// POLL
if(id.startsWith("pvote_")){const p=id.split("_");const pid=parseInt(p[1]),oidx=parseInt(p[2]);const poll=db.votePoll(pid,oidx,ix.user.id);if(!poll)return ix.reply({content:"Anket kapali.",ephemeral:true});return ix.update({embeds:[E.pollEmbed(poll)],components:E.pollBtns(poll)});}
// BUG ACTIONS
const parts=id.split("_"),act=parts[0],bid=parseInt(parts[1]);if(isNaN(bid))return;
const bug=db.getBug(bid);if(!bug)return ix.reply({content:"Yok.",ephemeral:true});
if(act==="claim"){db.assignBug(bid,ix.user.id,ix.user.displayName);const u=db.getBug(bid);await ix.update({embeds:[E.bugCard(u,db.getHistory(bid))],components:E.bugBtns(u)});return log(ix.guild,`🙋 ${u.tag} → ${ix.user.displayName}`);}
if(act==="unassign"){db.unassignBug(bid,ix.user.displayName);const u=db.getBug(bid);return ix.update({embeds:[E.bugCard(u,db.getHistory(bid))],components:E.bugBtns(u)});}
if(act==="resolve"){const m=new ModalBuilder().setCustomId(`resolve_${bid}`).setTitle(`${bug.tag} Cozum`);m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("note").setLabel("Nasil cozdun?").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)));return ix.showModal(m);}
if(act==="close"){db.closeBug(bid,ix.user.displayName);const u=db.getBug(bid);await ix.update({embeds:[E.bugCard(u,db.getHistory(bid))],components:E.bugBtns(u)});return log(ix.guild,`🔒 ${u.tag}`);}
if(act==="reopen"){db.reopenBug(bid,ix.user.displayName);const u=db.getBug(bid);await ix.update({embeds:[E.bugCard(u,db.getHistory(bid))],components:E.bugBtns(u)});return log(ix.guild,`🔓 ${u.tag}`);}
if(act==="upvote"){db.toggleUpvote(bid,ix.user.id);const u=db.getBug(bid);return ix.update({embeds:[E.bugCard(u,db.getHistory(bid),db.getComments(bid))],components:E.bugBtns(u)});}
if(act==="comment"){const m=new ModalBuilder().setCustomId(`comment_${bid}`).setTitle(`${bug.tag} Yorum`);m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("text").setLabel("Yorumun").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)));return ix.showModal(m);}
if(act==="thread"){if(bug.thread_id){const ex=ix.guild.channels.cache.get(bug.thread_id);if(ex)return ix.reply({content:`<#${bug.thread_id}>`,ephemeral:true});}const th=await ix.channel.threads.create({name:`${bug.tag} ${bug.title.slice(0,50)}`,autoArchiveDuration:1440});db.setThread(bid,th.id);await th.send({embeds:[new EmbedBuilder().setTitle(`🧵 ${bug.tag}`).setColor(0x5865f2).setDescription(bug.description.slice(0,300))]});return ix.reply({content:`<#${th.id}>`,ephemeral:true});}
if(act==="history"){const h=db.getHistory(bid);if(!h.length)return ix.reply({content:"Yok.",ephemeral:true});return ix.reply({embeds:[new EmbedBuilder().setTitle(`📜 ${bug.tag}`).setColor(0x5865f2).setDescription(h.map(x=>`\`${x.at}\` ▸ **${x.action}** (${x.by})`).join("\n").slice(0,4000))],ephemeral:true});}
}

// ========== MODALS ==========
async function handleModal(ix){const id=ix.customId;
if(id==="bug_report_modal"){const title=ix.fields.getTextInputValue("title"),desc=ix.fields.getTextInputValue("description"),steps=ix.fields.getTextInputValue("steps")||"";let sev=ix.fields.getTextInputValue("severity").toLowerCase().trim(),plat=(ix.fields.getTextInputValue("platform")||"all").toLowerCase().trim();if(!["critical","high","medium","low"].includes(sev))sev="medium";if(!["pc","playstation","ps","xbox","mobile","all"].includes(plat))plat="all";const bug=db.createBug({title,description:desc,steps,severity:sev,platform:plat,category:"gameplay",userId:ix.user.id,userName:ix.user.displayName});db.incBugReported(ix.user.id);db.addXP(ix.user.id,30);const cfg=db.getConfig(ix.guildId);const ch=cfg?.bug_channel_id?ix.guild.channels.cache.get(cfg.bug_channel_id):ix.channel;const msg=await(ch||ix.channel).send({content:`🐛 **Yeni** — ${bug.tag} — <@${ix.user.id}> (+30 XP)`,embeds:[E.bugCard(bug,db.getHistory(bug.id))],components:E.bugBtns(bug)});db.setMsgRef(bug.id,(ch||ix.channel).id,msg.id);await ix.reply({content:`**${bug.tag}** olusturuldu! +30 XP`,ephemeral:true});await log(ix.guild,`🐛 ${bug.tag} — ${title} (${sev})`);if(sev==="critical"&&cfg?.dev_role_id)await(ch||ix.channel).send(`🚨 **KRITIK!** <@&${cfg.dev_role_id}> — ${bug.tag}`);return;}
if(id.startsWith("resolve_")){const bid=parseInt(id.split("_")[1]),note=ix.fields.getTextInputValue("note"),bug=db.getBug(bid);if(!bug)return ix.reply({content:"Yok.",ephemeral:true});db.resolveBug(bid,note,ix.user.displayName);if(bug.assigned_to)db.incResolved(bug.assigned_to);const u=db.getBug(bid);await ix.update({embeds:[E.bugCard(u,db.getHistory(bid))],components:E.bugBtns(u)});await log(ix.guild,`✅ ${u.tag}: ${note}`);if(bug.reported_by!==ix.user.id){try{const rp=await client.users.fetch(bug.reported_by);await rp.send(`Cozuldu! **${u.tag}** — ${note}`);}catch{}}return;}
if(id.startsWith("comment_")){const bid=parseInt(id.split("_")[1]),txt=ix.fields.getTextInputValue("text");db.addComment(bid,ix.user.id,ix.user.displayName,txt);const u=db.getBug(bid);return ix.update({embeds:[E.bugCard(u,db.getHistory(bid),db.getComments(bid))],components:E.bugBtns(u)});}
if(id.startsWith("ticketmodal_")){const cat=id.replace("ticketmodal_",""),desc=ix.fields.getTextInputValue("desc");const t=db.createTicket(ix.user.id,ix.user.displayName,cat,desc);const g=ix.guild;let tc=g.channels.cache.find(ch=>ch.name==="Tickets"&&ch.type===ChannelType.GuildCategory);if(!tc)tc=await g.channels.create({name:"Tickets",type:ChannelType.GuildCategory});const ch=await g.channels.create({name:`ticket-${t.id}-${ix.user.displayName.toLowerCase().replace(/[^a-z0-9]/g,"")}`,type:ChannelType.GuildText,parent:tc.id,permissionOverwrites:[{id:g.id,deny:["ViewChannel"]},{id:ix.user.id,allow:["ViewChannel","SendMessages","ReadMessageHistory"]},{id:client.user.id,allow:["ViewChannel","SendMessages","ManageChannels"]}]});const cfg=db.getConfig(ix.guildId);if(cfg?.dev_role_id)try{await ch.permissionOverwrites.create(cfg.dev_role_id,{ViewChannel:true,SendMessages:true});}catch{}if(cfg?.lead_role_id)try{await ch.permissionOverwrites.create(cfg.lead_role_id,{ViewChannel:true,SendMessages:true});}catch{}db.setTicketChannel(t.id,ch.id);await ch.send({content:`<@${ix.user.id}>`,embeds:[E.ticketEmbed(t)],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`tktclaim_${t.id}`).setLabel("Sahiplen").setStyle(ButtonStyle.Primary).setEmoji("🙋"),new ButtonBuilder().setCustomId(`tktclose_${t.id}`).setLabel("Kapat").setStyle(ButtonStyle.Danger).setEmoji("🔒"))]});await ix.reply({content:`<#${ch.id}>`,ephemeral:true});return log(ix.guild,`🎫 ${t.tag} — ${ix.user.displayName}`);}
if(id==="sugg_modal"){const title=ix.fields.getTextInputValue("title"),desc=ix.fields.getTextInputValue("desc");let cat=(ix.fields.getTextInputValue("cat")||"genel").toLowerCase().trim();const s=db.createSuggestion(ix.user.id,ix.user.displayName,title,desc,cat);const cfg=db.getConfig(ix.guildId);const ch=cfg?.sugg_channel_id?ix.guild.channels.cache.get(cfg.sugg_channel_id):ix.channel;const msg=await(ch||ix.channel).send({content:`💡 **Yeni Oneri** — ${s.tag}`,embeds:[E.suggCard(s)],components:[E.suggVoteBtns(s.id),E.suggAdminBtns(s.id)]});db.setSuggMsg(s.id,(ch||ix.channel).id,msg.id);await ix.reply({content:`**${s.tag}** gonderildi!`,ephemeral:true});return log(ix.guild,`💡 ${s.tag} — ${title}`);}
if(id.startsWith("suggres_")){const p=id.split("_"),st=p[1],sid=parseInt(p[2]),resp=ix.fields.getTextInputValue("response");const s=db.respondSugg(sid,st,resp,ix.user.displayName);if(!s)return ix.reply({content:"Yok.",ephemeral:true});await ix.update({embeds:[E.suggCard(s)],components:[E.suggVoteBtns(sid)]});try{const u=await client.users.fetch(s.user_id);await u.send({embeds:[new EmbedBuilder().setTitle("Onerine Yanit!").setColor(0xf39c12).setDescription(`**${s.tag}:** ${s.title}\nDurum: **${st}**\n${resp}`)]});}catch{}return log(ix.guild,`💡 ${s.tag} → ${st}`);}
if(id==="beta_apply_modal"){const reason=ix.fields.getTextInputValue("reason"),platform=ix.fields.getTextInputValue("platform");const r=db.applyBeta(ix.user.id,ix.user.displayName,reason,platform);if(r.error==="already_pending")return ix.reply({content:"Zaten bekliyor.",ephemeral:true});if(r.error==="already_has_key")return ix.reply({content:"Zaten key'in var.",ephemeral:true});await ix.reply({content:`Basvuru #${r.id} alindi!`,ephemeral:true});const cfg=db.getConfig(ix.guildId);const rch=cfg?.beta_review_id?ix.guild.channels.cache.get(cfg.beta_review_id):null;if(rch)await rch.send({content:`📨 **Beta #${r.id}**`,embeds:[E.betaAppCard(r)],components:[E.betaAppBtns(r.id)]});return log(ix.guild,`📨 Beta #${r.id} — ${ix.user.displayName}`);}
if(id==="beta_addkeys_modal"){const keys=ix.fields.getTextInputValue("keys").split(/[\n,;]+/).map(k=>k.trim()).filter(k=>k.length>2);const r=db.addKeys(keys);await ix.reply({content:`**${r.added}** key eklendi. Toplam: **${r.total}**`,ephemeral:true});return log(ix.guild,`🔑 ${r.added} key`);}
}

// ========== SELECT ==========
async function handleSelect(ix){if(ix.customId!=="filter_bugs")return;const v=ix.values[0];let bugs,title;if(v==="all"){bugs=db.listActive();title="Aktif";}else if(v.startsWith("sev_")){const s=v.replace("sev_","");bugs=db.listBySeverity(s);title=E.SEV[s]?.l||s;}else if(v.startsWith("cat_")){const cc=v.replace("cat_","");bugs=db.listByCategory(cc);title=E.CAT[cc]||cc;}else{bugs=db.listByStatus(v);title=E.STAT[v]?.l||v;}await ix.update({embeds:[E.listEmbed(bugs,`📋 ${title}`)],components:[E.filterSelect()]});}

// ========== START ==========
process.on("unhandledRejection",e=>{console.error("Hata:",e.message);});
process.on("uncaughtException",e=>{console.error("Hata:",e.message);if(["ECONNRESET","ENOTFOUND","ETIMEDOUT"].includes(e.code))setTimeout(()=>start(),5000);});
async function start(){try{console.log("Baglaniliyor...");await client.login(process.env.BOT_TOKEN);}catch(e){console.error("Baglanti:",e.message);setTimeout(()=>start(),10000);}}
start();
