const { test, expect, fixture, placePoint } = require("./helpers");

// Le logo est-il enregistré dans la base du navigateur ?
const savedLogo = (page) => page.evaluate(() => new Promise((res) => {
  const req = indexedDB.open("easyroute", 1);
  req.onsuccess = () => {
    const get = req.result.transaction("fonts").objectStore("fonts").get("logo");
    get.onsuccess = () => res(!!get.result); get.onerror = () => res(false);
  };
  req.onerror = () => res(false);
}));

test("la session est reprise après réouverture, « Nouveau lieu » repart de zéro", async ({ page }) => {
  await page.fill("#contactName", "Julien");
  await page.click('#appSeg [data-v="waze"]');
  await placePoint(page, "catering", 0.6, 0.6);
  await page.click("#zoomIn");
  await page.waitForTimeout(800); // sauvegarde automatique
  await page.reload();
  await expect(page.locator("#contactName")).toHaveValue("Julien");
  await expect(page.locator('#appSeg [data-v="waze"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#zoomVal")).toHaveText("19");
  await expect(page.locator("#poiPlace-catering")).toHaveText("Déplacer");
  await page.click("#venueNew");
  await expect(page.locator("#venueNew")).toHaveText("Tout effacer ?");
  await page.click("#venueNew");
  await expect(page.locator("#name")).toHaveValue("");
  await page.reload();
  await expect(page.locator("#name")).toHaveValue("");
});

test("lieux enregistrés : enregistrer, recharger, mettre à jour, supprimer", async ({ page }) => {
  await page.fill("#contactName", "Julien");
  await page.click("#venueSave");
  await expect(page.locator("#status")).toHaveText(/Lieu enregistré/);
  await page.click("#venueNew"); await page.click("#venueNew");
  const id = await page.locator("#venueSel option").nth(1).getAttribute("value");
  await page.selectOption("#venueSel", id);
  await expect(page.locator("#name")).toHaveValue("Espace Culturel du Bois-Des-Arts");
  await expect(page.locator("#contactName")).toHaveValue("Julien");
  await page.click("#venueSave");
  await expect(page.locator("#status")).toHaveText(/Lieu mis à jour/);
  await page.click("#venueDel"); await page.click("#venueDel");
  await expect(page.locator("#venueSel option")).toHaveText(["Aucun lieu enregistré"]);
});

test("lieux : export puis import d’un fichier", async ({ page }) => {
  await expect(page.locator("#venueExport")).toBeDisabled();
  await page.click("#venueSave");
  await page.fill("#name", "Le Phare");
  await page.click("#venueSave");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#venueExport")]);
  const file = await download.path();
  // On vide la liste, puis on réimporte
  for (let i = 0; i < 2; i++) {
    await page.selectOption("#venueSel", await page.locator("#venueSel option").nth(1).getAttribute("value"));
    await page.click("#venueDel"); await page.click("#venueDel");
    await expect(page.locator("#status")).toHaveText(/Lieu supprimé/);
    await expect(page.locator("#venueSel option")).toHaveCount(i === 0 ? 2 : 1);
  }
  await page.setInputFiles("#venueImport", file);
  await expect(page.locator("#status")).toHaveText("Import terminé : 2 ajoutés.");
  await page.setInputFiles("#venueImport", file);
  await expect(page.locator("#status")).toHaveText("Import terminé : 2 déjà à jour.");
  await page.setInputFiles("#venueImport", { name: "x.json", mimeType: "application/json", buffer: Buffer.from('{"x":1}') });
  await expect(page.locator("#status")).toHaveText("Ce fichier n’est pas un export de lieux Easy Route.");
});

test("le logo est mémorisé, puis oublié avec « Retirer »", async ({ page }) => {
  await page.setInputFiles("#logoFile", fixture("logo-marges.png"));
  await expect(page.locator("#logoClear")).toBeEnabled();
  await expect.poll(() => savedLogo(page)).toBe(true); // enregistré sur l'appareil
  await page.reload();
  await expect(page.locator("#logoClear")).toBeEnabled();
  await page.click("#logoClear");
  await expect.poll(() => savedLogo(page)).toBe(false);
  await page.reload();
  await expect(page.locator("#logoClear")).toBeDisabled();
});
