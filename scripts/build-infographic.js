/**
 * Genera docs/infographic-1366x768.png — la imagen de la oferta en AppSource.
 *
 *   node scripts/build-infographic.js
 *
 * El SVG es la fuente: cambiar un dato o un color y regenerar sale gratis, y así la
 * infografia no acaba siendo un PNG suelto que nadie sabe rehacer. Paleta Nord, la misma
 * del sistema de iconos en test_visuales/iconos/icons.js.
 *
 * sharp vive en el repo de la web; aqui solo se reutiliza, como hace generar.js.
 */
const fs = require("fs");
const path = require("path");
const sharp = require(path.join("C:", "tcviz", "web", "node_modules", "sharp"));

const OUT = path.join(__dirname, "..", "docs");
// Partner Center exige 1366x768 para la imagen de la oferta. El dibujo se compone en
// 1280x720 y el viewBox lo escala: es la misma proporcion (16:9) y al ser vectorial no
// pierde nitidez, asi que no hay que recolocar nada a mano.
const W = 1280, H = 720;
const SALIDA_W = 1366, SALIDA_H = 768;

// ── Paleta Nord ──────────────────────────────────────────────────────────────
const TINTA = "#2E3440", GRIS = "#4C566A", NIEVE = "#ECEFF4", BORDE = "#D8DEE9";
const AZUL = "#5E81AC", HIELO = "#88C0D0", VERDE = "#A3BE8C", ROJO = "#BF616A";

/** Mezcla dos hex. Se usa para la rampa divergente, igual que hace el visual. */
function mix(a, b, t) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
    const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
    const c = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
    return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

/** Cinco puntos de escala: rojo -> neutro -> verde, como la rampa por defecto. */
const ESCALA = [ROJO, mix(ROJO, BORDE, 0.5), BORDE, mix(BORDE, VERDE, 0.5), VERDE];

/** Cuatro preguntas, porcentajes por punto de escala. Suman 100. */
const PREGUNTAS = [
    { q: "I know what is expected of me", v: [4, 8, 13, 45, 30] },
    { q: "Decisions are explained clearly", v: [28, 34, 18, 15, 5] },
    { q: "I get useful feedback", v: [12, 22, 21, 30, 15] },
    { q: "I can balance work and life", v: [18, 24, 20, 27, 11] },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FUENTE = "Segoe UI, Arial, Helvetica, sans-serif";

function txt(x, y, s, size, fill, opts = {}) {
    const a = opts.anchor ? ` text-anchor="${opts.anchor}"` : "";
    const w = opts.weight ? ` font-weight="${opts.weight}"` : "";
    return `<text x="${x}" y="${y}" font-family="${FUENTE}" font-size="${size}" `
         + `fill="${fill}"${a}${w}>${esc(s)}</text>`;
}

const ALTO_BARRA = 30, PASO = 62;

/** Apilado clásico: todas las barras arrancan del mismo cero. */
function apilado(x0, y0, ancho) {
    let out = "";
    PREGUNTAS.forEach((p, i) => {
        const y = y0 + i * PASO;
        let x = x0;
        p.v.forEach((v, k) => {
            const w = (v / 100) * ancho;
            out += `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" `
                 + `height="${ALTO_BARRA}" fill="${ESCALA[k]}"/>`;
            x += w;
        });
    });
    // El cero, que es lo que hace que no se pueda comparar: todas pegadas a el.
    out += `<line x1="${x0}" y1="${y0 - 10}" x2="${x0}" y2="${y0 + PASO * 4 - 20}" `
         + `stroke="${GRIS}" stroke-width="2"/>`;
    return out;
}

/**
 * Divergente: el neutro partido por la mitad marca el centro de cada barra.
 * El centro y la media anchura estan calculados contra el caso peor de PREGUNTAS: la de
 * mas negativo (71% a la izquierda) no puede pisar el separador de x=620, y la de mas
 * positivo (81,5% a la derecha) no puede salirse del margen de 1232. Si se cambian los
 * datos hay que rehacer esa cuenta, o una barra se sale del lienzo sin avisar.
 */
function divergente(cx, y0, media) {
    let out = "";
    PREGUNTAS.forEach((p, i) => {
        const y = y0 + i * PASO;
        // Izquierda del eje: los dos negativos y medio neutro.
        const izq = p.v[0] + p.v[1] + p.v[2] / 2;
        let x = cx - (izq / 100) * media * 2;
        p.v.forEach((v, k) => {
            const w = (v / 100) * media * 2;
            out += `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" `
                 + `height="${ALTO_BARRA}" fill="${ESCALA[k]}"/>`;
            x += w;
        });
    });
    out += `<line x1="${cx}" y1="${y0 - 10}" x2="${cx}" y2="${y0 + PASO * 4 - 20}" `
         + `stroke="${TINTA}" stroke-width="3"/>`;
    return out;
}

/** Pastilla de la franja inferior. */
function chip(x, y, w, titulo, cuerpo, acento) {
    return `<rect x="${x}" y="${y}" width="${w}" height="76" rx="10" fill="#FFFFFF" `
         + `stroke="${BORDE}" stroke-width="2"/>`
         + `<rect x="${x}" y="${y}" width="6" height="76" rx="3" fill="${acento}"/>`
         + txt(x + 22, y + 31, titulo, 17, TINTA, { weight: "600" })
         + txt(x + 22, y + 56, cuerpo, 15, GRIS);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SALIDA_W}" height="${SALIDA_H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#FFFFFF"/>

  <!-- Cabecera -->
  <rect x="0" y="0" width="${W}" height="104" fill="${TINTA}"/>
  <!-- El icono del sistema TCViz, copiado de test_visuales/iconos/icons.js sin retocar:
       si diverge, la ficha y el panel de Power BI dejan de parecer el mismo producto. -->
  <g transform="translate(48,20) scale(0.213)">
    <rect x="10" y="10" width="280" height="280" rx="54" fill="${NIEVE}" stroke="${BORDE}" stroke-width="4"/>
    <g stroke="${TINTA}" stroke-width="12" stroke-linejoin="round">
      <rect x="96"  y="78"  width="54" height="42" fill="${HIELO}"/>
      <rect x="150" y="78"  width="78" height="42" fill="${VERDE}"/>
      <rect x="72"  y="136" width="78" height="42" fill="${HIELO}"/>
      <rect x="150" y="136" width="48" height="42" fill="${AZUL}"/>
      <rect x="110" y="194" width="40" height="42" fill="${HIELO}"/>
      <rect x="150" y="194" width="86" height="42" fill="${AZUL}"/>
    </g>
    <path d="M150 62 V250" fill="none" stroke="${TINTA}" stroke-width="12" stroke-linecap="round"/>
  </g>
  ${txt(140, 52, "Likert Survey Pro", 34, "#FFFFFF", { weight: "700" })}
  ${txt(140, 82, "Diverging stacked bars for Likert and survey data", 18, HIELO)}
  ${txt(1232, 68, "TCViz", 22, BORDE, { anchor: "end", weight: "600" })}

  <!-- Izquierda: el problema -->
  ${txt(48, 158, "A NORMAL STACKED BAR", 15, GRIS, { weight: "700" })}
  ${apilado(64, 186, 480)}
  ${txt(48, 452, "Every bar starts at zero.", 19, TINTA, { weight: "600" })}
  ${txt(48, 480, "Which of these four questions is the worst?", 17, GRIS)}
  ${txt(48, 504, "You have to read the numbers to find out.", 17, GRIS)}

  <!-- Separador -->
  <line x1="620" y1="150" x2="620" y2="520" stroke="${BORDE}" stroke-width="2"/>

  <!-- Derecha: la solucion -->
  ${txt(668, 158, "LIKERT SURVEY PRO", 15, AZUL, { weight: "700" })}
  ${divergente(915, 186, 190)}
  ${txt(668, 452, "Centred on the neutral response.", 19, TINTA, { weight: "600" })}
  ${txt(668, 480, "Disagreement grows left, agreement right,", 17, GRIS)}
  ${txt(668, 504, "from one shared axis. You read it at a glance.", 17, GRIS)}

  <!-- Franja inferior -->
  <rect x="0" y="548" width="${W}" height="172" fill="${NIEVE}"/>
  ${chip(48, 580, 380, "Free", "The complete diverging scale. Nothing hidden.", VERDE)}
  ${chip(450, 580, 400, "Pro", "Top/Bottom box · NPS · Benchmark · Groups", AZUL)}
  ${chip(872, 580, 360, "No network access", "privileges: []. No data leaves the report.", HIELO)}
  ${txt(640, 692, "tcviz.com", 15, GRIS, { anchor: "middle" })}
</svg>`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "infographic.svg"), svg, "utf8");

(async () => {
    const nombre = `infographic-${SALIDA_W}x${SALIDA_H}.png`;
    const file = path.join(OUT, nombre);
    await sharp(Buffer.from(svg)).resize(SALIDA_W, SALIDA_H).png().toFile(file);
    const meta = await sharp(file).metadata();
    const { size } = fs.statSync(file);
    console.log(`${nombre} escrito: ${meta.width}x${meta.height}, ${(size / 1024).toFixed(0)} KB`);
})();
