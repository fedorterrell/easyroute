// Easy Route — stockage des fiches pour les liens courts (Cloudflare Worker + base D1).
//
// Liaison requise (Worker > Settings > Bindings) : base D1, nom de variable « DB ».
// Variable facultative : ALLOWED_ORIGINS = sites autorisés à créer des fiches, séparés par des virgules.
//
//   POST /f         corps {"d": "<fiche>"}                 ->  {"id": "k7Qp2xA9bC", "key": "<clé secrète>"}
//   PUT  /f/<id>    corps {"d": "<fiche>", "key": "<clé>"} ->  {"id": "k7Qp2xA9bC"}   (même lien, contenu mis à jour)
//   GET  /f/<id>                                           ->  {"d": "<fiche>"}
//   GET  /health                                           ->  ok
//
// Chaque fiche reçoit un identifiant aléatoire (impossible à deviner) et une clé secrète que seul
// l'appareil qui l'a créée connaît : lui seul peut la modifier ensuite. La base ne garde qu'une
// empreinte SHA-256 de la clé, jamais la clé elle-même.

const DEFAULT_ORIGINS = ["https://fedorterrell.github.io"];
const MAX_LENGTH = 16 * 1024;             // une fiche fait environ 1 Ko
const KEEP_DAYS = 400;                    // durée de conservation après la dernière modification
const ID_LENGTH = 10;                     // 62^10 combinaisons
const KEY_LENGTH = 24;                    // 62^24 combinaisons
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

let tableReady = false;
async function ensureTable(db) {
  if (tableReady) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS fiches (id TEXT PRIMARY KEY, data TEXT NOT NULL, created INTEGER NOT NULL)").run();
  // Colonnes ajoutées avec la mise à jour des fiches (sans effet si elles existent déjà)
  for (const col of ["key_hash TEXT", "updated INTEGER"]) {
    try { await db.prepare("ALTER TABLE fiches ADD COLUMN " + col).run(); } catch (_) { /* déjà présente */ }
  }
  tableReady = true;
}

function allowedOrigins(env) {
  return env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS;
}
function isAllowed(origin, env) {
  return allowedOrigins(env).includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
}
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": isAllowed(origin, env) ? origin : allowedOrigins(env)[0],
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
}

function randomToken(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) out += ALPHABET[b % 62]; // léger biais sans importance ici
  return out;
}
async function sha256(text) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...hash].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// Lit et vérifie le corps {"d": …, "key": …}
async function readBody(request) {
  const body = await request.text();
  if (!body || body.length > MAX_LENGTH) return { error: ["Fiche trop grande.", 413] };
  let parsed;
  try { parsed = JSON.parse(body); } catch (_) { return { error: ["Format invalide.", 400] }; }
  const d = parsed && parsed.d;
  if (typeof d !== "string" || !/^[0-9][A-Za-z0-9_-]+$/.test(d)) return { error: ["Format invalide.", 400] };
  return { d, key: typeof parsed.key === "string" ? parsed.key : "" };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/health") return new Response("ok", { headers: cors });
    if (!env.DB) return json({ error: "Base D1 non reliée (variable DB)." }, 500, cors);
    const m = url.pathname.match(/^\/f\/([0-9A-Za-z]{6,16})$/);

    // Créer une fiche (uniquement depuis Easy Route)
    if (request.method === "POST" && url.pathname === "/f") {
      if (!isAllowed(request.headers.get("Origin") || "", env)) return json({ error: "Origine non autorisée." }, 403, cors);
      const body = await readBody(request);
      if (body.error) return json({ error: body.error[0] }, body.error[1], cors);
      await ensureTable(env.DB);
      const id = randomToken(ID_LENGTH), key = randomToken(KEY_LENGTH), now = Date.now();
      await env.DB.prepare("INSERT INTO fiches (id, data, created, key_hash, updated) VALUES (?, ?, ?, ?, ?)")
        .bind(id, body.d, now, await sha256(key), now).run();
      // Ménage de temps en temps : fiches non modifiées depuis KEEP_DAYS
      if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM fiches WHERE COALESCE(updated, created) < ?").bind(now - KEEP_DAYS * 864e5).run();
      return json({ id, key }, 200, cors);
    }

    // Mettre à jour une fiche (même lien), avec sa clé
    if (request.method === "PUT" && m) {
      if (!isAllowed(request.headers.get("Origin") || "", env)) return json({ error: "Origine non autorisée." }, 403, cors);
      const body = await readBody(request);
      if (body.error) return json({ error: body.error[0] }, body.error[1], cors);
      await ensureTable(env.DB);
      const row = await env.DB.prepare("SELECT key_hash FROM fiches WHERE id = ?").bind(m[1]).first();
      if (!row) return json({ error: "Fiche introuvable ou expirée." }, 404, cors);
      if (!row.key_hash || !body.key || row.key_hash !== await sha256(body.key)) return json({ error: "Clé invalide." }, 403, cors);
      await env.DB.prepare("UPDATE fiches SET data = ?, updated = ? WHERE id = ?").bind(body.d, Date.now(), m[1]).run();
      return json({ id: m[1] }, 200, cors);
    }

    // Lire une fiche (pas de cache : une fiche peut avoir été mise à jour)
    if (request.method === "GET" && m) {
      await ensureTable(env.DB);
      const row = await env.DB.prepare("SELECT data FROM fiches WHERE id = ?").bind(m[1]).first();
      if (!row) return json({ error: "Fiche introuvable ou expirée." }, 404, cors);
      return json({ d: row.data }, 200, { ...cors, "Cache-Control": "no-store" });
    }

    return json({ error: "Adresse inconnue." }, 404, cors);
  },
};
