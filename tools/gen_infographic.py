# -*- coding: utf-8 -*-
"""Infografías y capturas de la ficha del Likert Survey Pro 1.1 (1366x768, assets/) con la plantilla común de la web.

Plantilla: C:/tcviz/datos/demo_rtm/infografias.py (la misma del Radar, el Treemap y el Marimekko). El texto de la
infografía general sale de la ficha web (C:/tcviz/web/src/data.js, producto likert-survey-pro); lo que allí sigue en
1.0.0.1 (sin small multiples, estilos, altura de fila ni drilldown) se corrige aquí abajo hasta que se actualice la web.
Las imágenes son del simulador (tools/simulador/capturas/60_* a 62_*): carga el visual real con una encuesta de clima
ficticia y fija (harness.py, FICHA_Q). Ninguna lleva la marca de agua "Pro preview" (la build de prueba fuerza Pro), y
por eso ningún pie dice "Power BI Desktop".

    node build-test.js && python tools/simulador/harness.py ficha && python tools/gen_infographic.py
Salida: assets/infographic.png, infographic-pro.png, Screenshot_1..3.png (cinco imágenes: el máximo de la oferta);
docs/infographic.html e infographic-pro.html autocontenidos. Los HTML de trabajo y los PNG 2x quedan en .tmp/ficha.
"""
import base64, html, mimetypes, os, re, shutil, subprocess, sys, tempfile
sys.path.insert(0, r"C:\tcviz\datos\demo_rtm")
import infografias as I
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAP = os.path.join(ROOT, "tools", "simulador", "capturas")
ASSETS = os.path.join(ROOT, "assets")
OUT = os.path.join(ROOT, ".tmp", "ficha")
os.makedirs(OUT, exist_ok=True)
e = html.escape
CSS = I.CSS % {"pop": I.uri(os.path.join(I.BASE, "tema", "Poppins"))}
LOGO = I.uri(os.path.join(I.WEB, "logos", "tcviz-logo-light.svg"))
cap = lambda n: I.uri(os.path.join(CAP, n + ".png"))

P = {p["id"]: p for p in I.productos()}["likert-survey-pro"]
# ── 1.1 frente a la ficha web 1.0.0.1 (CHANGELOG.md, capabilities.json, computeAttemptedPro en src/visual.ts) ──
FREE = ["Bars centred on the neutral answer, 3 neutral treatments",
        "Percentages or counts; Scale order fixes the order",
        "Row height automatic (fills the visual) or fixed",
        "Drilldown on Question, value axis and gridlines",
        "Report theme, data labels, tooltips, cross-filtering",
        "Accessibility: patterns, high contrast, keyboard",
        "Bookmarks, on-object formatting, 12 languages"]
PRO = ["Top box and bottom box beside every bar",
       "NPS pill with its own colours",
       "A benchmark line across every question",
       "Question groups with each block's mean",
       "Per-block colours",
       "Small multiples: one chart per region, wave…",
       "The six collection styles"]
P["features"] = [{"name": x, "free": True} for x in FREE]
P["freemium"]["pro"] = PRO
P["quickStart"] = P["quickStart"][:3] + ["Pro: groups, top box, NPS, a benchmark, small multiples or a collection style."]
# Tres pozos y el resto en una línea, como el Radar: con más, la tarjeta de campos se corta por abajo.
ROLES = {r["role"]: r for r in P["dataRoles"]}
P["dataRoles"] = [ROLES["Question"], ROLES["Response"], ROLES["Value"]]
RESTO = ["Scale order", "Group (Pro)", "Small multiples (Pro)", "Tooltips"]
DATOS = "Sample data: a fictitious employee survey, 240 answers per question"


def autocontenido(h_html, destino):
    """Copia el HTML con cada file:/// incrustado como data URI, para que docs/ no apunte a C:/."""
    t = open(h_html, encoding="utf-8").read()

    def incrusta(m):
        ruta = m.group(1).replace("file:///", "").replace("/", os.sep)
        tipo = mimetypes.guess_type(ruta)[0] or ("font/ttf" if ruta.endswith(".ttf") else "application/octet-stream")
        return "data:%s;base64,%s" % (tipo, base64.b64encode(open(ruta, "rb").read()).decode())
    t = re.sub(r"(file:///[^'\")\s]+)", incrusta, t)
    open(destino, "w", encoding="utf-8", newline="\n").write(t)


def render(h_html, nombre):
    png2x = os.path.join(OUT, nombre + "@2x.png")
    png1x = os.path.join(ASSETS, nombre + ".png")
    subprocess.run([I.EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
                    "--allow-file-access-from-files", f"--screenshot={png2x}", "--window-size=1366,768", I.uri(h_html)],
                   capture_output=True, timeout=90)
    Image.open(png2x).convert("RGB").resize((1366, 768), Image.LANCZOS).save(png1x, optimize=True)
    print("  ", os.path.relpath(png1x, ROOT))


def cabecera(titulo, sub, tier='<span class="pill free">Free</span><span class="pill pro">Pro</span>'):
    return (f'<div class="cab"><img class="logo" src="{LOGO}"><div class="sep"></div>'
            f'<div><h1>{e(titulo)}</h1><p>{e(sub)}</p></div><div class="tier">{tier}</div></div><div class="raya"></div>')


PIE = (f'<div class="fin"><span>tcviz.com · Power BI custom visual · {e(P["name"])}</span>'
       f'<span>{e(DATOS)} · drawn by the visual, Report theme</span></div>')


def pagina(nombre, cuerpo, extra_css=""):
    h = os.path.join(OUT, nombre + ".html")
    open(h, "w", encoding="utf-8").write(f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}{extra_css}</style></head><body>{cuerpo}</body></html>')
    return h


# 1. Infografía general: plantilla común de la web, con la imagen principal en el centro
tmp = tempfile.mkdtemp()
try:
    shutil.copy(os.path.join(CAP, "60_central.png"), os.path.join(tmp, "central_99.png"))
    exp, I.EXP = I.EXP, tmp
    ficha = I.ficha(P, 99, "Which block pulls engagement down?")
    I.EXP = exp
    viejo = "Sample report on Begudes Nord, a fictitious drinks company — Power BI Desktop, TCViz theme"
    assert viejo in ficha   # la imagen es del simulador y con otros datos: el pie de la plantilla mentiría
    ficha = ficha.replace(viejo, DATOS + " — drawn by the visual, Report theme; groups, top box, NPS and benchmark are Pro")
    fin_campos = '</div></div>\n<div class="der">'
    assert ficha.count(fin_campos) == 1
    ficha = ficha.replace(fin_campos, f'<div class="mas">+ {len(RESTO)} more: {e(", ".join(RESTO))}</div>' + fin_campos)
    h1 = os.path.join(OUT, "infographic.html")
    open(h1, "w", encoding="utf-8").write(ficha)
    render(h1, "infographic")
    autocontenido(h1, os.path.join(ROOT, "docs", "infographic.html"))
finally:
    shutil.rmtree(tmp, ignore_errors=True)

# 2. Free frente a Pro con el mismo dato
DOS = """.dos{position:absolute;left:24px;right:24px;top:115px;bottom:40px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
.dos .card{padding:14px 16px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.dos .im{flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center}
.dos img{max-width:100%;max-height:100%;border-radius:4px;display:block;border:1px solid #EEE}
.dos h2{font-size:16px} .dos .f h2{color:#3E9C5B} .dos .p h2{color:#2B6CB0}
.dos ul{list-style:none;margin-top:10px;columns:2;column-gap:18px}
.dos li{font-size:12.5px;line-height:1.35;padding-left:16px;position:relative;margin-bottom:6px;break-inside:avoid}
.dos .f li:before{content:'✓';color:#3E9C5B;position:absolute;left:0;font-weight:700}
.dos .p li:before{content:'+';color:#2B6CB0;position:absolute;left:0;font-weight:700}
.sub{font-size:12.5px;color:#666;margin:-4px 0 8px}"""
li = lambda xs: "".join(f"<li>{e(x)}</li>" for x in xs)
free_items = ["Every question, every answer, no cap", "Neutral split, positive or left out", "Rows fill the visual",
              "Axis, gridlines, drilldown", "Filtering, bookmarks, keyboard", "Report theme, 12 languages"]
pro_items = ["One chart per region, same questions", "Question groups with block means", "Top box, bottom box and NPS",
             "A benchmark line", "Per-block colours", "Six collection styles"]
h2 = pagina("infographic-pro", cabecera("Free reads the survey. Pro compares who said it.", f'{P["name"]} — the same employee survey, without and with a licence.') + f"""
<div class="dos">
<div class="card f"><h2>Free — the whole survey, correct</h2><div class="sub">All four regions added together: the real company total, nothing hidden.</div>
<div class="im"><img src="{cap('60_free')}"></div><ul>{li(free_items)}</ul></div>
<div class="card p"><h2>Pro — one chart per region, in blocks</h2><div class="sub">Small multiples by Region; the questions keep their order in every panel.</div>
<div class="im"><img src="{cap('60_pro_sm')}"></div><ul>{li(pro_items)}</ul></div>
</div>
<div class="fin"><span>tcviz.com · Power BI custom visual · {e(P["name"])}</span><span>Without a licence, Pro features are drawn working under a "Pro preview" watermark while you edit.</span></div>""", DOS)
render(h2, "infographic-pro")
autocontenido(h2, os.path.join(ROOT, "docs", "infographic-pro.html"))

# 3. Capturas de la ficha: una idea por imagen
UNA = """.una{position:absolute;left:24px;right:24px;top:112px;bottom:40px;display:flex;gap:16px}
.una .card{padding:14px;display:flex;align-items:center;justify-content:center;flex:1;min-width:0}
.una img{max-width:100%;max-height:100%;display:block}
.una .lado{flex:0 0 330px;flex-direction:column;align-items:flex-start;justify-content:flex-start}
.una .lado h2{font-size:17px;margin-bottom:8px} .una .lado p{font-size:13.5px;line-height:1.45;color:#444;margin-bottom:10px}
.tres{position:absolute;left:24px;right:24px;top:112px;bottom:40px;display:grid;grid-template-columns:1.55fr 1fr;grid-template-rows:322px 1fr;gap:14px}
.tres .card{padding:10px;display:flex;flex-direction:column;align-items:flex-start;min-height:0;overflow:hidden}
.tres .l{grid-row:1 / span 2}
.tres img{display:block;border:1px solid #EEE}
.tres b{font-size:12.5px;margin-bottom:6px;color:#555}
.est{position:absolute;left:24px;right:24px;top:112px;bottom:40px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:1fr 1fr;gap:12px}
.est .card{padding:8px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.est img{flex:1 1 auto;min-height:0;width:100%;object-fit:contain;display:block;border-radius:3px} .est b{font-size:12.5px;margin-top:5px;color:#555}"""


def una(n, titulo, sub, img, lado_h, lado_p):
    ps = "".join(f"<p>{e(x)}</p>" for x in lado_p)
    h = pagina(f"Screenshot_{n}", cabecera(titulo, sub) + f"""<div class="una"><div class="card"><img src="{cap(img)}"></div>
<div class="card lado"><h2>{e(lado_h)}</h2>{ps}</div></div>""" + PIE, UNA)
    render(h, f"Screenshot_{n}")


una(1, "Which block pulls engagement down?", "Ten questions in three blocks, every bar centred on the neutral answer; block means, top box, NPS and a benchmark (Pro).",
    "60_hero", "Read it in one pass",
    ["Disagreement grows to the left of the centre line, agreement to the right, so the questions that lean negative stand out without reading a number.",
     "Management scores 2.9 on the 1–5 scale, against 3.5 for Engagement: \"Decisions are explained to us\" is 23% agree against 58% disagree, NPS −35.",
     "On the right, top 2 / bottom 2 box and the NPS pill; the dashed line is a 60% benchmark.",
     "Free draws the same centred bars for every question; groups, top box, NPS and the benchmark are Pro."])
w = lambda px: f"{px * 0.82:.0f}px"   # las tres a la misma escala: 0,82 px de imagen por px del visual
h3 = pagina("Screenshot_2", cabecera("Rows that fit the visual", "Row height Automatic: the rows share the height of the visual. The same settings in a large, medium and small slot, all at the same scale.") + f"""
<div class="tres"><div class="card l"><b>Large · 900 × 700 — the rows fill the height</b><img src="{cap('61_size_l')}" style="width:{w(900)}"></div>
<div class="card"><b>Medium · 520 × 330 — names shorten, nothing is dropped</b><img src="{cap('61_size_m')}" style="width:{w(520)}"></div>
<div class="card"><b>Small · 300 × 170 — rows keep a readable minimum and scroll</b><img src="{cap('61_size_s')}" style="width:{w(300)}"></div></div>""" + PIE, UNA)
render(h3, "Screenshot_2")
est = "".join(f'<div class="card"><img src="{cap("62_style_" + s)}"><b>{s.title()}</b></div>'
              for s in ("boardroom", "ledger", "editorial", "signal", "aurora", "terrace"))
h4 = pagina("Screenshot_3", cabecera("Six collection styles (Pro)", "The same looks as the rest of TCViz, so a page with other TCViz visuals reads as one report. Free keeps the Report theme.") +
            f'<div class="est">{est}</div>' + PIE.replace(", Report theme", ""), UNA)
render(h4, "Screenshot_3")
print("ok")
