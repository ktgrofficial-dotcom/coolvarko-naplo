// Coolvarko Napló — napi emlékeztető kiküldése (GitHub Actions futtatja óránként délután).
// Munkanapon a beállított időponttól óránként (legfeljebb 3×) értesítést küld annak, aki aznap még
// nem szerepel a naplóban (szabadság/beteg/jelzett távollét és ünnepnap kivételével). Az utolsó üzenet
// a távollét okát kéri, és ekkor megy az admin-összesítő.
// Kézi indítás: MOD=proba → minden feliratkozott eszközre próbaüzenet; MOD=most → az utolsó (távollétet kérő) üzenet azonnal, a napi számláló léptetése nélkül.
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const MOD = (process.env.MOD || "normal").trim();
const URL_APP = process.env.APP_URL || "https://ktgrofficial-dotcom.github.io/coolvarko-naplo/";
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "null");
if (!sa) { console.error("Hiányzik a FIREBASE_SERVICE_ACCOUNT titok."); process.exit(1); }
initializeApp({ credential: cert(sa) });
const db = getFirestore(), msg = getMessaging();

// ── Budapesti idő ──
const most = new Date();
const reszek = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false, weekday: "short" }).formatToParts(most).map(p => [p.type, p.value]));
const MA = `${reszek.year}-${reszek.month}-${reszek.day}`, ORA = +reszek.hour % 24, HETNAP = reszek.weekday; // Mon..Sun

// ── Ünnepnapok (ugyanaz, mint az appban) ──
const pad2 = n => String(n).padStart(2, "0"), ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function husvet(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,da);}
function unnepek(y){ const u={}; ["01-01","03-15","05-01","08-20","10-23","11-01","12-25","12-26"].forEach(d=>u[`${y}-${d}`]=1);
  const h=husvet(y); [-2,0,1,49,50].forEach(n=>{const d=new Date(h);d.setDate(d.getDate()+n);u[ymd(d)]=1;}); return u; }

const keresztnev = n => (n || "").trim().split(/\s+/).slice(-1)[0] || "";
const szia = n => keresztnev(n) && n !== "Admin" ? `Szia ${keresztnev(n)}!` : "Szia!";

async function kuld(token, data) {
  try {
    await msg.send({ token, data, webpush: { headers: { Urgency: "high", TTL: "21600" }, fcmOptions: { link: URL_APP } } });
    return "ok";
  } catch (e) {
    const c = e.code || e.errorInfo?.code || "";
    if (/registration-token-not-registered|invalid-registration-token|invalid-argument/.test(c)) {
      await db.collection("pushTokenek").doc(token).delete().catch(() => {});
      return "torolve";
    }
    console.warn("Küldési hiba:", c, e.message); return "hiba";
  }
}

const JEL_NEV = { szabadsag: "szabadság", beteg: "beteg", hianyzes: "nem dolgozott" };

async function main() {
  const beallRef = db.collection("beallitasok").doc("push");
  const c = { be: true, ora: 17, ismetles: 3, szombat: false, adminOsszesito: true, ...((await beallRef.get()).data() || {}) };
  const ISM = Math.min(3, Math.max(1, Number(c.ismetles) || 3));
  const tokenek = (await db.collection("pushTokenek").get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const kor = c.kuldesNap === MA ? Number(c.kuldesKor || 0) : 0; // ma eddig hány emlékeztető ment ki
  console.log(`Budapest: ${MA} ${ORA}:xx (${HETNAP}), mód: ${MOD}, eszköz: ${tokenek.length}, mai kör eddig: ${kor}/${ISM}`);

  if (MOD === "proba") {
    let n = 0; for (const t of tokenek) if (await kuld(t.id, { title: "Coolvarko Napló – próba", body: `${szia(t.nev)} Ez egy próba értesítés, minden működik.`, tag: "proba", url: URL_APP }) === "ok") n++;
    console.log(`Próba elküldve: ${n}/${tokenek.length}`); return;
  }
  let k; // most kiküldendő kör (1..ISM)
  if (MOD === "most") k = ISM; // kézi teszt: az utolsó (távollétet kérő) üzenet, a napot nem lépteti
  else {
    if (!c.be) return console.log("Az emlékeztető ki van kapcsolva.");
    if (kor >= ISM) return console.log("Ma már minden emlékeztető kiment.");
    if (ORA < c.ora + kor || ORA >= 23) return console.log(`Még nincs itt a ${kor + 1}. emlékeztető ideje (${c.ora + kor}:00).`);
    if (kor > 0 && c.kuldesIdo && most - new Date(c.kuldesIdo) < 45 * 60000) return console.log("Az előző emlékeztető óta még nem telt el 45 perc.");
    if (HETNAP === "Sun" || (HETNAP === "Sat" && !c.szombat)) return console.log("Hétvége.");
    if (unnepek(+MA.slice(0, 4))[MA]) return console.log("Ünnepnap.");
    k = kor + 1;
  }
  const utolso = k === ISM;

  const munkasok = (await db.collection("munkasok").get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.aktiv !== false);
  const naplo = (await db.collection("naplo").where("datum", "==", MA).get()).docs.map(d => d.data());
  const rogzitett = new Set(naplo.flatMap(n => (n.brigad || []).map(w => (w.nev || "").trim())));
  const tavol = new Map();
  await Promise.all(munkasok.map(async m => {
    const j = await db.doc(`munkasok/${m.id}/jelenletek/${MA}`).get();
    if (j.exists && j.data().statusz) tavol.set(m.id, j.data());
  }));
  const hianyzik = munkasok.filter(m => !rogzitett.has((m.nev || "").trim()) && !tavol.has(m.id));
  console.log(`Aktív: ${munkasok.length}, rögzítve: ${rogzitett.size} név, távol: ${tavol.size}, hiányzik: ${hianyzik.length}, kör: ${k}/${ISM}`);

  let ok = 0, kihagy = 0;
  const hianyIds = new Set(hianyzik.map(m => m.id));
  for (const t of tokenek.filter(t => t.szerep === "worker")) {
    if (!hianyIds.has(t.mvId)) { kihagy++; continue; }
    const m = munkasok.find(x => x.id === t.mvId), sz = szia(m?.nev || t.nev);
    const data = utolso
      ? { title: "Még nincs beírva a mai nap", body: `${sz} Ha dolgoztál, rögzítsd a Coolvarko Naplóban. Ha ma nem dolgoztál, koppints ide, és írd be a távollét okát.`, tag: "emlekezteto-" + MA, url: URL_APP + "?tavol=1" }
      : k === 1
        ? { title: "Ma még nem rögzítettél", body: `${sz} Írd be a mai napot a Coolvarko Naplóba: hol dolgoztál és hány órát.`, tag: "emlekezteto-" + MA, url: URL_APP }
        : { title: "Még mindig hiányzik a mai nap", body: `${sz} Ne felejtsd el beírni a mai munkát a Coolvarko Naplóba.`, tag: "emlekezteto-" + MA, url: URL_APP };
    if (await kuld(t.id, data) === "ok") ok++;
  }
  if (c.adminOsszesito && utolso) {
    const nevek = hianyzik.map(m => m.nev).sort((a, b) => a.localeCompare(b, "hu"));
    const tav = munkasok.filter(m => tavol.has(m.id)).map(m => { const j = tavol.get(m.id); return `${m.nev} (${j.ok || JEL_NEV[j.statusz] || j.statusz})`; });
    let body = nevek.length ? `Nincs rögzítve (${nevek.length}): ${nevek.join(", ")}` : "Ma mindenki rögzítve van.";
    if (tav.length) body += ` · Távol: ${tav.join(", ")}`;
    for (const t of tokenek.filter(t => t.szerep === "admin")) if (await kuld(t.id, { title: "Mai napló – összesítő", body: body.slice(0, 300), tag: "osszesito-" + MA, url: URL_APP }) === "ok") ok++;
  }
  const eredmeny = `${ok} értesítés ment ki, ${kihagy} eszközre nem kellett (már rögzítve vagy távol)`;
  console.log(eredmeny);
  if (MOD === "most") return; // kézi kiküldés nem lépteti a napi számlálót
  await beallRef.set({ kuldesNap: MA, kuldesKor: k, kuldesIdo: most.toISOString(), utolso: MA, utolsoEredmeny: eredmeny, utolsoFutas: most.toISOString() }, { merge: true });
}
main().catch(e => { console.error(e); process.exit(1); });
