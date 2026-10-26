const { test, expect, placePoint, message, openAsTeam } = require("./helpers");

async function ficheLink(page) {
  await page.click("#tabMsg");
  await expect(page.locator("#ficheOpen")).toHaveAttribute("href", /#s=T[0-9a-f]{9}$/);
  await expect(page.locator("#ficheState")).toHaveText("Lien court prêt.");
  return page.getAttribute("#ficheOpen", "href");
}

test("le lien de fiche figure dans le message et ouvre la fiche en lecture seule", async ({ page, context }) => {
  await page.fill("#eventName", "Concert Test");
  await page.fill("#callDate", "2026-10-24");
  await page.fill("#callTime", "08:30");
  await page.fill("#contactName", "Julien");
  await page.fill("#contactPhone", "06 12 34 56 78");
  await page.fill("#poiLabel-loges", "Loges — porte B");
  await placePoint(page, "loges", 0.6, 0.6);
  const url = await ficheLink(page);
  expect(url.length).toBeLessThan(60);
  expect(await message(page)).toContain("🔗 Fiche complète (plan, accès, itinéraires) :\n" + url);

  // Un équipier ouvre le lien sur son propre téléphone (autre navigateur, rien d'enregistré)
  const team = await openAsTeam(context.browser(), url);
  await expect(team.locator("#ficheView")).toBeVisible();
  await expect(team.locator(".wrap > .grid")).toBeHidden();
  await expect(team.locator("#fTitle")).toHaveText("Concert Test");
  await expect(team.locator("#fPlace")).toHaveText("Espace Culturel du Bois-Des-Arts");
  await expect(team.locator("#fInfos")).toContainText("samedi 24 octobre à 8h30");
  await expect(team.locator('#fInfos a[href^="tel:"]')).toHaveAttribute("href", "tel:0612345678");
  await expect(team.locator("#fRoutes .froute")).toHaveCount(2);
  await expect(team.locator("#fRoutes .froute").nth(1)).toContainText("Loges — porte B");
  await expect(team.locator("#fRoutes a", { hasText: "Waze" }).first()).toHaveAttribute("href", /^https:\/\/waze\.com\/ul\?ll=46\.18/);
  await expect(team.locator("#fCal a")).toHaveAttribute("href", /calendar\.google\.com/);
  await expect(team.locator("#fSheetSlot #sheet")).toBeVisible();
  // La fiche n'écrase pas la session de l'appareil
  expect(await team.evaluate(() => localStorage.getItem("easyroute.session"))).toBeNull();
  // Ouvrir dans l'éditeur (confirmation en deux touches)
  await team.click("#fEdit"); await team.click("#fEdit");
  await expect(team.locator("#ficheView")).toBeHidden();
  await expect(team.locator("#name")).toHaveValue("Espace Culturel du Bois-Des-Arts");
  await expect(team.locator("#contactName")).toHaveValue("Julien");
  await expect(team.locator("#poiLabel-loges")).toHaveValue("Loges — porte B");
  expect(await team.evaluate(() => location.hash)).toBe("");
  await team.close();
});

test("un lien de fiche abîmé affiche un message et l’éditeur normal", async ({ page }) => {
  await page.goto("/#fiche=1abc"); // même onglet : la page se recharge d'elle-même
  await expect(page.locator("#status")).toHaveText(/lien de fiche est incomplet/);
  await expect(page.locator("#ficheView")).toBeHidden();
});

test("on peut retirer le lien de fiche du message", async ({ page }) => {
  await ficheLink(page);
  await page.uncheck("#lkFiche");
  expect(await message(page)).not.toContain("Fiche complète");
});

test("lien court inconnu ou expiré : message clair", async ({ page }) => {
  await page.goto("/#s=Tinconnu00");
  await expect(page.locator("#status")).toHaveText(/introuvable ou a expiré/);
  await expect(page.locator("#ficheView")).toBeHidden();
});

test.describe("service des liens courts injoignable", () => {
  test.use({ workerDown: true });
  test("le message garde le lien long, qui ouvre la fiche", async ({ page, context }) => {
    await page.fill("#contactName", "Julien");
    await page.click("#tabMsg");
    await expect(page.locator("#ficheState")).toHaveText(/injoignable/);
    const url = await page.getAttribute("#ficheOpen", "href");
    expect(url).toMatch(/#fiche=1/);
    expect(await message(page)).toContain(url);
    const team = await openAsTeam(context.browser(), url);
    await expect(team.locator("#ficheView")).toBeVisible();
    await expect(team.locator("#fInfos")).toContainText("Julien");
    await team.context().close();
  });
});
