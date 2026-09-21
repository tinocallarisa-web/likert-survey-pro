/**
 * Genera docs/changelog.html a partir de CHANGELOG.md, con el estilo de las demás páginas.
 * Sin dependencias: un Markdown completo no hace falta para un changelog.
 *
 *   node scripts/build-changelog.js
 *
 * Se publica en docs/ porque es lo que sirve GitHub Pages. Un CHANGELOG.md que no se sirve
 * no cuenta como señal de actividad de release para quien rastrea el marketplace.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MD = path.join(ROOT, "CHANGELOG.md");
const OUT = path.join(ROOT, "docs", "changelog.html");

const version = JSON.parse(fs.readFileSync(path.join(ROOT, "pbiviz.json"), "utf8")).visual.version;
const md = fs.readFileSync(MD, "utf8");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// `code`, **negrita** y *cursiva*, aplicados después de escapar el HTML.
function inline(s) {
    return esc(s)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
}

const out = [];
let enLista = false;
const cerrarLista = () => { if (enLista) { out.push("</ul>"); enLista = false; } };

md.split(/\r?\n/).forEach((linea) => {
    const l = linea.trim();
    if (!l || l === "---") { cerrarLista(); return; }
    if (l.startsWith("## ")) { cerrarLista(); out.push(`<h2>${inline(l.slice(3))}</h2>`); return; }
    if (l.startsWith("### ")) { cerrarLista(); out.push(`<h3>${inline(l.slice(4))}</h3>`); return; }
    if (l.startsWith("# ")) { return; }                       // el título va en el <h1>
    if (l.startsWith("- ")) {
        if (!enLista) { out.push("<ul>"); enLista = true; }
        out.push(`<li>${inline(l.slice(2))}</li>`);
        return;
    }
    if (enLista) { out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, " " + inline(l) + "</li>"); return; }
    out.push(`<p>${inline(l)}</p>`);
});
cerrarLista();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Changelog — Likert Survey Pro | TCViz</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #333; line-height: 1.7; }
    h1 { color: #0078D4; margin-bottom: 4px; }
    h2 { margin-top: 2em; color: #1a1a2e; border-bottom: 2px solid #e0e0e0; padding-bottom: 6px; }
    h3 { margin-top: 1.3em; color: #333; font-size: 1.05rem; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: .9em; }
    nav a { color: #0078D4; text-decoration: none; margin-right: 20px; }
    footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: .9rem; color: #888; }
  </style>
</head>
<body>
  <h1>Changelog — Likert Survey Pro</h1>
  <p><strong>Current version:</strong> ${version} · <a href="mailto:support@tcviz.com">support@tcviz.com</a></p>
  <nav><a href="support.html">Support</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a></nav>
${out.join("\n")}
  <footer>TCViz — Likert Survey Pro.</footer>
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, "utf8");
console.log(`changelog.html escrito para v${version} (${html.length} bytes)`);
