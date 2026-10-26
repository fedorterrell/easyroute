// Outils communs aux tests : page sans réseau extérieur, et quelques gestes sur le plan.
const path = require("path");
const { test: base, expect } = require("@playwright/test");

const QR_LIB = require.resolve("qrcode-generator/qrcode.js");

// Faux service des liens courts (remplace le Worker Cloudflare pendant les tests)
const shortStore = new Map();
const WORKER = /easyroute-fiches\.[a-z0-9-]+\.workers\.dev/;
async function setupRoutes(context, { workerDown = false } = {}) {
  // Pas d'appel aux services extérieurs pendant les tests : tuiles, géocodage, polices Google.
  await context.route(/arcgisonline|nominatim|photon|fonts\.(googleapis|gstatic)/, (r) => r.abort());
  // Bibliothèque QR servie en local (pas de dépendance au CDN)
  await context.route(/qrcode\.min\.js/, (r) => r.fulfill({ path: QR_LIB, contentType: "text/javascript" }));
  await context.route(WORKER, async (r) => {
    if (workerDown) return r.abort();
    const req = r.request(), url = new URL(req.url()), cors = { "Access-Control-Allow-Origin": "*" };
    if (req.method() === "POST" && url.pathname === "/f") {
      const d = JSON.parse(req.postData()).d;
      const id = "T" + require("crypto").createHash("sha256").update(d).digest("hex").slice(0, 9);
      shortStore.set(id, d);
      return r.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ id }) });
    }
    const m = url.pathname.match(/^\/f\/(.+)$/);
    if (req.method() === "GET" && m && shortStore.has(m[1])) return r.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ d: shortStore.get(m[1]) }) });
    return r.fulfill({ status: 404, headers: cors, contentType: "application/json", body: '{"error":"introuvable"}' });
  });
}

const test = base.extend({
  workerDown: [false, { option: true }],
  page: async ({ page, workerDown }, use) => {
    await setupRoutes(page.context(), { workerDown });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.locator("#url")).not.toBeEmpty();
    await use(page);
    expect(errors, "erreurs JavaScript dans la page").toEqual([]);
  },
});

const fixture = (name) => path.join(__dirname, "fixtures", name);

// Toucher le plan à une position relative (0..1)
async function tapSheet(page, fx, fy) {
  const box = await page.locator("#sheet").boundingBox();
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

async function placePoint(page, key, fx, fy) {
  await page.click(`#poiPlace-${key}`);
  await tapSheet(page, fx, fy);
  await expect(page.locator(`#poiPlace-${key}`)).toHaveText("Déplacer");
}

const message = (page) => page.locator("#msg").inputValue();

// Ouvre un lien de fiche comme un équipier : autre navigateur, rien d'enregistré
async function openAsTeam(browser, url) {
  const ctx = await browser.newContext();
  await setupRoutes(ctx);
  const team = await ctx.newPage();
  await team.goto(url.replace(/^https?:\/\/[^/]+\/(easyroute\/)?/, "/"));
  return team;
}

module.exports = { test, expect, fixture, tapSheet, placePoint, message, setupRoutes, openAsTeam };
