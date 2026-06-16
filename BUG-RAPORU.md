# CyberZ Bot — Bug İnceleme Raporu

Tarih: 2026-06-16 · Kapsam: `bot.js`, `src/interactions/*`, `src/embedsFor.js`, `src/db.js`, `src/i18n.js`

---

## 1) "I Accept the Rules" → "Etkileşim başarısız oldu" (BİRİNCİL ŞÜPHELİ)

**Dosya:** `src/interactions/buttons.js:340-363`

```js
if (id === "verify_accept") {
  ...
  const r = ix.guild.roles.cache.find(x => x.name === "Verified")
    || await ix.guild.roles.create({ name: "Verified", color: 0x2ecc71 });  // ⚠️ try/catch YOK
  try { await ix.member.roles.add(r); } catch {}   // ⚠️ hata sessizce yutuluyor
  db.updMem(ix.user.id, { verified: true });
  return ix.reply({ content: t("verify.verified"), ephemeral: true });
}
```

**Sorun:**
- Handler interaction'ı **defer etmiyor**; tek await olan rol işlemi başarısız/yavaş olursa 3 sn içinde yanıt gitmez → Discord "Etkileşim başarısız oldu" gösterir.
- `roles.create(...)` **try/catch ile korunmuyor**. "Verified" rolü cache'te yoksa ve botun **Manage Roles (Rolleri Yönet)** yetkisi yoksa, çağrı reddedilir → handler ack'lemeden hata fırlatır.
- `roles.add` ise `catch {}` ile yutuluyor: botun rolü **hiyerarşide "Verified" rolünün altındaysa** rol atanamaz ama kullanıcıya yine **"✅ Verified!"** mesajı gider — yani sessiz başarısızlık (yanlış başarı).

**İlk kontrol edilecekler (en olası gerçek neden):**
1. Botun **Manage Roles** yetkisi var mı?
2. Sunucu ayarları → Roller'de **bot rolü "Verified" rolünün ÜSTÜNDE mi**? Değilse rol atanamaz.
3. Bot online ve gateway bağlı mı (tıklama anında çevrimdışıysa da bu hata çıkar)?

**Önerilen düzeltme:** handler başında `await ix.deferReply({ ephemeral: true })`, rol oluşturma/atamayı `try/catch` içine al, başarısızlıkta kullanıcıya net hata ver (sahte "Verified" mesajı verme).

---

## 2) Doğrulama paneli açıklaması "en" / "tr" olarak görünüyor (KESİN BUG)

**Dosya:** `src/embedsFor.js:21` + çağrı yerleri `commands.js:135`, `modals.js:312`

`embedsFor` wrapper'ı `verifyP`'ye dili zaten otomatik bağlıyor:
```js
wrapped.verifyP = (customRules = null) => base.verifyP(lang, customRules);
```
Ama çağıranlar bir de elle `lang` geçiyor:
```js
E.verifyP(lang, cfg?.verifyRules)   // ⚠️ customRules = "en" oluyor
```
Sonuç: `base.verifyP("en", "en")` → `.setDescription(customRules || ...)` = **"en"**. Panelde kurallar yerine düz "en" yazısı çıkar; admin'in kaydettiği özel kurallar (`cfg.verifyRules`) **tamamen yok sayılır**.

> Not: `/setup` içindeki `buildPanelPosters` `E.verifyP()` diye argümansız çağırdığı için **doğru** çalışır. Bug sadece `/verify-panel` komutunda ve kural düzenlemede.

**Düzeltme:** çağrıları `E.verifyP(cfg?.verifyRules)` ve `embedsMod.verifyP(newRules)` yap (baştaki `lang`'i kaldır).

---

## 3) `db.setCfg` tüm config'i eziyor — merge etmiyor (KESİN BUG)

**Dosya:** `src/db.js:424-430`

```js
setCfg(gid, data) {
  ...
  if (i >= 0) d.configs[i] = { gid, ...data };   // ⚠️ mevcut alanlar siliniyor
  ...
}
```

Mevcut config ile birleştirmiyor, baştan yazıyor. Etkileri:
- `/verify-panel` → `setCfg({ verifyMsgId, verifyPanelCh })` çağırınca `welCh`, `verifyRules`, `lang` gibi **diğer tüm ayarları siler**.
- Kural düzenleme (`modals.js:302`) → `setCfg({ verifyRules })` çağırınca **`verifyPanelCh` ve `verifyMsgId` silinir**. Hemen ardından kod bu alanları okuyup paneli "yerinde güncellemeye" çalışıyor; alanlar artık `undefined` olduğu için **panel hiç güncellenmez** — oysa kullanıcıya "Panel otomatik güncellendi" mesajı gider (yanlış bilgi).

**Düzeltme:** `setCfg`'i merge'leyen hale getir: `d.configs[i] = { ...d.configs[i], ...data }`.

---

## 4) İkincil / sağlamlık notları

- **Süreç dayanıklılığı (`bot.js:279-284`):** `uncaughtException` yalnızca `ECONNRESET/ENOTFOUND/ETIMEDOUT` için yeniden bağlanıyor; diğer beklenmeyen hatalarda süreç bozuk durumda ayakta kalabilir → tüm butonlar "etkileşim başarısız" verebilir.
- **Test boşluğu:** `test-flows.js`/`test-runtime.js` `verify_accept` buton akışını ve panel render'ını **hiç test etmiyor** — yukarıdaki #1 ve #2 bu yüzden yakalanmamış.
- **Kök dizindeki `embeds.js` / `database.js` / `bot.js` mükerrer/eski sürüm:** aktif kod `src/` altında. Kafa karışıklığını önlemek için eski kopyalar temizlenmeli.
- Verification kanalı `hideFromVerified: true` (serverTemplate.js:42) — kullanıcı doğrulandıktan sonra kanalı göremez; bu tasarım gereği, bug değil.

---

## Öncelik sırası
1. **#1** — botun **Manage Roles** yetkisi + **rol hiyerarşisi** (bot rolü "Verified" üstünde) kontrolü; handler'ı defer + try/catch ile sağlamlaştır.
2. **#3** — `setCfg` merge düzeltmesi (veri kaybını durdurur).
3. **#2** — `verifyP` çağrı imzası düzeltmesi (panel metni).
