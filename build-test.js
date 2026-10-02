/**
 * build-test.js — Likert Survey Pro
 *
 * USO: node build-test.js            → Pro forzado, guid <real>_test
 *      node build-test.js --free     → licencia real (Free), guid <real>_testfree
 *      añadir --events               → contador de eventos de render en pantalla (guid ...ev)
 *                                      Verde "OK 1:1": cada update() de Power BI emitio un
 *                                      renderingStarted y un Finished/Failed. Rojo: el fallo
 *                                      del rechazo 1200.1.2 (02-10-2026).
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
const events = process.argv.includes("--events");
const suffix = (forceFree ? "_testfree" : "_test") + (events ? "ev" : "");

// --events: instrumentacion SOLO en el paquete de prueba. Envuelve el eventService y cuenta.
const EV_ANCHOR = "        this.events = options.host.eventService;";
const EV_CODE = EV_ANCHOR + `
        { // DBG-EVENTS (solo build de prueba)
            const real: any = this.events;
            const st: any = { upd: 0, s: 0, f: 0, x: 0, open: false, err: [] };
            (this as any).__ev = st;
            const box = document.createElement("div");
            box.style.cssText = "position:absolute;left:2px;bottom:2px;z-index:99;font:11px Consolas,monospace;padding:2px 6px;pointer-events:none;color:#fff;";
            st.paint = () => {
                const ok = st.err.length === 0 && st.s === st.upd && st.f + st.x === st.upd;
                box.style.background = ok ? "rgba(16,124,16,0.88)" : "rgba(196,43,28,0.92)";
                box.textContent = "EVENTS updates=" + st.upd + " started=" + st.s + " finished=" + st.f + " failed=" + st.x
                    + (ok ? "  OK 1:1" : "  ERROR " + st.err.slice(-2).join(" | "));
            };
            this.events = {
                renderingStarted: (o: any) => { if (st.open) { st.err.push("inicio doble"); } st.open = true; st.s++; st.paint(); real.renderingStarted(o); },
                renderingFinished: (o: any) => { if (!st.open) { st.err.push("fin sin inicio"); } st.open = false; st.f++; st.paint(); real.renderingFinished(o); },
                renderingFailed: (o: any, r?: any) => { if (!st.open) { st.err.push("fallo sin inicio"); } st.open = false; st.x++; st.paint(); real.renderingFailed(o, r); }
            } as any;
            window.setInterval(() => { if (this.root && box.parentNode !== this.root) { this.root.appendChild(box); } st.paint(); }, 500);
        }`;
const UPD_ANCHOR = "    public update(options: VisualUpdateOptions): void {";
const UPD_CODE = UPD_ANCHOR + "\n        (this as any).__ev.upd++; // DBG-EVENTS";

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

    let ts = forceFree ? originalTs : originalTs.replace(MARKER, PATCHED);
    if (events) {
        if (!ts.includes(EV_ANCHOR) || !ts.includes(UPD_ANCHOR)) {
            console.error("Anclas de --events no encontradas en visual.ts. Actualiza ESTE script.");
            process.exit(1);
        }
        ts = ts.replace(EV_ANCHOR, EV_CODE).replace(UPD_ANCHOR, UPD_CODE);
        console.log("Instrumentacion de eventos: ON");
    }
    fs.writeFileSync(VISUAL_TS, ts, "utf8");
    pbivizObj.visual.guid = pbivizObj.visual.guid + suffix;
    fs.writeFileSync(PBIVIZ_JSON, JSON.stringify(pbivizObj, null, 2), "utf8");

    execSync("npx pbiviz package", { stdio: "inherit", cwd: ROOT });
    console.log("\nBuild TEST listo en dist/. Importalo en Power BI Desktop y prueba.");
} finally {
    restore();
}
