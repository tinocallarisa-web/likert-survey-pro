/**
 * build-test.js — Likert Survey Pro
 *
 * USO: node build-test.js            → Pro forzado, guid <real>_test
 *      node build-test.js --free     → licencia real (Free), guid <real>_testfree
 *
 * El modo --free es el ÚNICO con el que se pueden probar la vista previa Pro, su marca
 * de agua y los avisos de compra: con Pro forzado no se muestran, por diseño.
 *
 * Parchea → empaqueta → RESTAURA. El fuente queda siempre en estado producción.
 * Cada modo tiene su guid para poder importar los dos a la vez en Desktop.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = __dirname;
const VISUAL_TS = path.join(ROOT, "src", "visual.ts");
const PBIVIZ_JSON = path.join(ROOT, "pbiviz.json");

const forceFree = process.argv.includes("--free");
const suffix = forceFree ? "_testfree" : "_test";

// El ancla es el inicializador con ISPRO_MARKER. Si cambia, se actualiza ESTE script,
// nunca el fuente para encajar con él.
const MARKER = "private isPro: boolean = false; // ISPRO_MARKER";
const PATCHED = "private isPro: boolean = true; // ISPRO_MARKER";

const originalTs = fs.readFileSync(VISUAL_TS, "utf8");
const originalPbiviz = fs.readFileSync(PBIVIZ_JSON, "utf8");
const pbivizObj = JSON.parse(originalPbiviz);

if (!forceFree && !originalTs.includes(MARKER)) {
    console.error("ISPRO_MARKER no encontrado en visual.ts. Abortado.");
    process.exit(1);
}

let restored = false;
function restore() {
    if (restored) { return; }
    restored = true;
    fs.writeFileSync(VISUAL_TS, originalTs, "utf8");
    fs.writeFileSync(PBIVIZ_JSON, originalPbiviz, "utf8");
    console.log("Ficheros restaurados a estado produccion.");
}
process.on("exit", restore);
process.on("SIGINT", () => { restore(); process.exit(1); });
process.on("uncaughtException", (e) => { console.error(e); restore(); process.exit(1); });

try {
    console.log("\nBuild TEST — " + pbivizObj.visual.displayName + " v" + pbivizObj.visual.version);
    console.log("Tier: " + (forceFree ? "Free (licencia real)" : "Pro (forzado)"));

    fs.writeFileSync(VISUAL_TS, forceFree ? originalTs : originalTs.replace(MARKER, PATCHED), "utf8");
    pbivizObj.visual.guid = pbivizObj.visual.guid + suffix;
    fs.writeFileSync(PBIVIZ_JSON, JSON.stringify(pbivizObj, null, 2), "utf8");

    execSync("npx pbiviz package", { stdio: "inherit", cwd: ROOT });
    console.log("\nBuild TEST listo en dist/. Importalo en Power BI Desktop y prueba.");
} finally {
    restore();
}
