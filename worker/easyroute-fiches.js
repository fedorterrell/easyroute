// Easy Route — stockage des fiches pour les liens courts (Cloudflare Worker + base D1).
//
// Liaison requise (Worker > Settings > Bindings) : base D1, nom de variable « DB ».
// Variable facultative : ALLOWED_ORIGINS = sites autorisés à créer des fiches, séparés par des virgules.
//
//   POST /f        corps {"d": "<fiche compressée>"}  ->  {"id": "k7Qp2xA9bC"}
//   GET  /f/<id>                                      ->  {"d": "<fiche compressée>"}
//   GET  /health                                      ->  ok
//
// L'identifiant est tiré d'une empreinte SHA-256 de la fiche : la même fiche donne toujours
// le même lien, et un identifiant ne peut pas être deviné sans connaître la fiche.

const DEFAULT_ORIGINS = ["https://fedorterrell.github.io"];
const MAX_LENGTH = 16 * 1024;             // une fiche fait environ 1 Ko
const KEEP_DAYS = 400;                    // durée de conservation d'une fiche
const ID_LENGTH = 10;                     // 62^10 combinaisons
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

let tableReady = false;
async function ensureTable(db) {
  if (tableReady) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS fiches (id TEXT PRIMARY KEY, data TEXT NOT NULL, created INTEGER NOT NULL)").run();
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
}

async function makeId(text) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  let n = 0n;
  for (const b of hash.slice(0, 12)) n = (n << 8n) | BigInt(b);
  let id = "";
  for (let i = 0; i < ID_LENGTH; i++) { id += ALPHABET[Number(n % 62n)]; n /= 62n; }
  return id;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/health") return new Response("ok", { headers: cors });
    if (!env.DB) return json({ error: "Base D1 non reliée (variable DB)." }, 500, cors);

    // Créer une fiche (uniquement depuis Easy Route)
    if (request.method === "POST" && url.pathname === "/f") {
      if (!isAllowed(request.headers.get("Origin") || "", env)) return json({ error: "Origine non autorisée." }, 403, cors);
      const body = await request.text();
      if (!body || body.length > MAX_LENGTH) return json({ error: "Fiche trop grande." }, 413, cors);
      let d;
      try { d = JSON.parse(body).d; } catch (_) { return json({ error: "Format invalide." }, 400, cors); }
      if (typeof d !== "string" || !/^[0-9][A-Za-z0-9_-]+$/.test(d)) return json({ error: "Format invalide." }, 400, cors);
      await ensureTable(env.DB);
      const id = await makeId(d);
      await env.DB.prepare("INSERT OR IGNORE INTO fiches (id, data, created) VALUES (?, ?, ?)").bind(id, d, Date.now()).run();
      // Ménage de temps en temps : fiches plus vieilles que KEEP_DAYS
      if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM fiches WHERE created < ?").bind(Date.now() - KEEP_DAYS * 864e5).run();
      return json({ id }, 200, cors);
    }

    // Lire une fiche
    const m = url.pathname.match(/^\/f\/([0-9A-Za-z]{6,16})$/);
    if (request.method === "GET" && m) {
      await ensureTable(env.DB);
      const row = await env.DB.prepare("SELECT data FROM fiches WHERE id = ?").bind(m[1]).first();
      if (!row) return json({ error: "Fiche introuvable ou expirée." }, 404, cors);
      return json({ d: row.data }, 200, { ...cors, "Cache-Control": "public, max-age=3600" });
    }

    return json({ error: "Adresse inconnue." }, 404, cors);
  },
};
