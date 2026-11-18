# -*- coding: utf-8 -*-
"""Simulador Playwright del Likert Survey Pro: capturas y comprobaciones automáticas.

Carga el bundle de la última build de prueba (.tmp/drop/visual.js) con un host simulado y un dataView categorical
agrupado por respuesta (values.grouped()), como el que entrega Power BI con el mapeo del visual.
No reproduce el motor de Power BI: tooltips, menús, marcadores y licencia reales solo se ven en Desktop.

Uso:  node build-test.js         && python tools/simulador/harness.py pro    → capturas Pro + comprobaciones
      node build-test.js --free  && python tools/simulador/harness.py free   → Free / vista previa / selección
Las capturas van a tools/simulador/capturas/. Sale con código 1 si alguna comprobación falla.
"""
import asyncio, io, json, os, random, sys
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BUNDLE = os.path.join(ROOT, ".tmp", "drop", "visual.js")
CSS = os.path.join(ROOT, ".tmp", "drop", "visual.css")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "capturas")
GUID = json.load(io.open(os.path.join(ROOT, ".tmp", "drop", "pbiviz.json"), encoding="utf-8"))["visual"]["guid"]

RESP = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"]
BLOCKS = {
    "Engagement": ["I am proud to work here", "I would recommend this company", "I see myself here in two years", "My work gives me energy"],
    "Management": ["My manager gives useful feedback", "Decisions are explained to us", "I trust senior leadership"],
    "Workplace": ["I have the tools I need", "My workload is manageable", "Sales rep service is fast and friendly"],
}
REGIONS = ["North", "South", "East", "West", "Central"]

STUB = r"""
window.__ev = []; window.__sel = []; window.__persist = []; window.__fetch = 0; window.__warn = [];
window.powerbi = { visuals: { plugins: {} }, extensibility: {} };
(function(){
 const PAL = ['#118DFF','#12239E','#E66C37','#6B007B','#E044A7','#744EC2','#D9B300','#D64550'];
 let pi = 0; const pmap = {};
 function mkId(k){ return { __k:k, getKey(){return k;}, getSelector(){return {k};}, equals(o){return !!o && o.__k===k;}, includes(o){ return !!o && o.__k===k; } }; }
 window.__mkId = mkId;
 window.__host = {
  eventService: { renderingStarted(){ __ev.push('S'); }, renderingFinished(){ __ev.push('F'); }, renderingFailed(o,m){ __ev.push('X'); console.error('FAILED', m); } },
  createSelectionManager(){ return { select(ids){ __sel = (Array.isArray(ids)?ids:[ids]).map(i=>i.__k); window.__selIds = Array.isArray(ids)?ids:[ids]; return Promise.resolve([]); },
     clear(){ __sel = []; window.__selIds = []; return Promise.resolve(); }, getSelectionIds(){ return window.__selIds || []; },
     hasSelection(){ return (window.__selIds||[]).length>0; }, registerOnSelectCallback(cb){ window.__onSel = cb; }, showContextMenu(){ return Promise.resolve(); } }; },
  createSelectionIdBuilder(){ const k=[]; return { withCategory(c,i){ k.push(c.source.queryName+'='+c.values[i]); return this; },
     withMeasure(m){ k.push(m); return this; }, withSeries(vals, g){ k.push('s='+g.name); return this; }, createSelectionId(){ return mkId(k.join('|')); } }; },
  createLocalizationManager(){ return { getDisplayName(k){ return k; } }; },
  tooltipService: { show(){}, move(){}, hide(){} },
  subSelectionService: { subSelect(){}, updateRegionOutlines(){} },
  hostCapabilities: { allowInteractions: true }, locale: 'en-US',
  colorPalette: { isHighContrast:false, foreground:{value:'#252423'}, background:{value:'#FFFFFF'}, foregroundSelected:{value:'#1AEBFF'},
    foregroundNeutralSecondary:{value:'#605E5C'}, backgroundNeutral:{value:'#E1DFDD'}, hyperlink:{value:'#118DFF'},
    getColor(k){ if (!(k in pmap)) pmap[k] = PAL[(pi++) % PAL.length]; return {value: pmap[k]}; } },
  fetchMoreData(){ window.__fetch++; return window.__fetchOk === true; }, persistProperties(p){ __persist.push(p); }, launchUrl(){},
  displayWarningIcon(t, m){ __warn.push(m); }, hideWarningIcon(){},
 };
})();
// dataView categorical agrupado por respuesta, como el de Power BI
window.__dv = function(spec){
  const rows = spec.rows;   // [{group, question, question2, panel, counts:[..]}]
  const cats = [];
  const col = (name, q, role, vals) => ({ source: { displayName: name, queryName: q, roles: {[role]: true} }, values: vals, identity: vals.map((v,i)=>({i})) });
  if (spec.group) cats.push(col('Block', 'Survey.Block', 'group', rows.map(r => r.group)));
  cats.push(col('Question', 'Survey.Question', 'question', rows.map(r => r.question)));
  if (spec.question2) cats.push(col('Item', 'Survey.Item', 'question', rows.map(r => r.question2)));
  if (spec.panel) cats.push(col('Region', 'Survey.Region', 'panel', rows.map(r => r.panel)));
  const values = []; const groups = [];
  spec.responses.forEach((name, k) => {
    const v = { source: { displayName: 'Answers', queryName: 'Sum(Survey.Answers)', roles: { value: true }, groupName: name, format: spec.format || '#,0', isMeasure: true },
                values: rows.map(r => r.counts[k]) };
    if (spec.dynFormat) v.objects = rows.map(() => ({ general: { formatString: spec.dynFormat } }));
    const o = { source: { displayName: 'Order', queryName: 'Min(Scale.Order)', roles: { order: true }, groupName: name }, values: rows.map(() => k + 1) };
    values.push(v); values.push(o);
    groups.push({ name, values: [v, o], objects: spec.scaleObjects ? spec.scaleObjects[k] : undefined });
  });
  values.grouped = () => groups;
  const columns = cats.map(c => c.source).concat([{ displayName: 'Response', roles: { response: true } }]).concat(values.map(v => v.source));
  const md = { columns, objects: spec.objects || {} };
  if (spec.segment) md.segment = {};
  return { metadata: md, categorical: { categories: cats, values } };
};
"""


def survey(n_questions=10, panels=False, seed=7, group=True):
    rnd = random.Random(seed)
    qs = []
    for b, items in BLOCKS.items():
        qs += [(b, q) for q in items]
    while len(qs) < n_questions:
        k = len(qs) + 1
        qs.append((list(BLOCKS)[k % 3], f"Additional survey item number {k}"))
    qs = qs[:n_questions]
    rows = []
    for (b, q) in qs:
        bias = rnd.uniform(-0.8, 1.4)
        for p in (REGIONS if panels else [None]):
            base = [max(2, int(rnd.gauss(30, 8) + (i - 2) * bias * 12)) for i in range(5)]
            rows.append({"group": b, "question": q, "panel": p, "counts": base})
    return rows


def spec(n=10, group=True, panel=False, objects=None, **kw):
    s = {"rows": survey(n, panel), "responses": RESP, "group": group, "panel": panel, "objects": objects or {}}
    s.update(kw)
    return s


FAILS = []


def check(ok, what):
    print(("    OK   " if ok else "    FALLO ") + what)
    if not ok:
        FAILS.append(what)


async def page(browser, W, H, licence=None, locale="en-US", hc=False):
    pg = await browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=2)
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.set_content(f"<html><body style='margin:0;background:#FFFFFF'><div id='host' style='position:relative;width:{W}px;height:{H}px;overflow:hidden'></div></body></html>")
    await pg.add_style_tag(path=CSS)
    await pg.add_script_tag(content=STUB)
    await pg.evaluate("(l) => { __host.locale = l; }", locale)
    if hc:
        await pg.evaluate("() => { const p = __host.colorPalette; p.isHighContrast = true; p.foreground = {value:'#FFFF00'}; p.background = {value:'#000000'}; p.foregroundSelected = {value:'#00FFFF'}; }")
    if licence == "none":   # licencia leída: sin planes -> vista previa al editar
        await pg.evaluate("() => { __host.licenseManager = { getAvailableServicePlans(){ return Promise.resolve({ plans: [], isLicenseUnsupportedEnv: false, isLicenseInfoAvailable: true }); }, notifyFeatureBlocked(m){ (window.__notes = window.__notes||[]).push(m); return Promise.resolve(true); }, notifyLicenseRequired(){ return Promise.resolve(true); }, clearLicenseNotification(){ return Promise.resolve(true); } }; }")
    await pg.add_script_tag(path=BUNDLE)
    await pg.evaluate("(g) => { window.__v = powerbi.visuals.plugins[g].create({ element: document.getElementById('host'), host: __host }); }", GUID)
    return pg, errs


async def upd(pg, sp, W, H, view=0, op=0, fmt=False):
    await pg.evaluate("([sp, W, H, vm, op, fm]) => __v.update({ dataViews: sp ? [__dv(sp)] : [], viewport: {width: W, height: H}, type: 2, operationKind: op, viewMode: vm, formatMode: fm })",
                      [sp, W, H, view, op, fmt])
    await pg.wait_for_timeout(250)


async def shot(browser, name, sp, W, H, view=0, **kw):
    pg, errs = await page(browser, W, H, **kw)
    await upd(pg, sp, W, H, view)
    await pg.screenshot(path=os.path.join(OUT, name + ".png"))
    ev = await pg.evaluate("() => __ev.join('')")
    info = await pg.evaluate("() => ({ segs: document.querySelectorAll('[data-seg]').length, note: (document.querySelector('.lk-note')||{}).textContent || '', wm: (document.querySelector('.tcviz-wm')||{style:{}}).style.display })")
    await pg.close()
    print(f"  {name:30s} {W}x{H}  eventos {ev}  tramos {info['segs']}  nota «{info['note'][:70]}»  {'ERRORES: ' + '; '.join(errs[:3]) if errs else ''}")
    check(not errs, name + ": sin errores de consola")
    check(ev == "SF", name + ": un par de eventos por update")
    return info


async def bar_metrics(pg):
    return await pg.evaluate("""() => {
        const sc = document.querySelector('.lk-scroll');
        const segs = Array.from(document.querySelectorAll('[data-seg] rect:first-child'));
        const hs = segs.map(r => +r.getAttribute('height')); const ys = segs.map(r => +r.getAttribute('y') + +r.getAttribute('height'));
        return { barH: hs.length ? Math.max(...hs) : 0, bottom: ys.length ? Math.max(...ys) : 0, scrollH: sc.clientHeight,
                 scrollable: sc.scrollHeight > sc.clientHeight + 1, overflowY: getComputedStyle(sc).overflowY,
                 note: (document.querySelector('.lk-note')||{}).textContent || '' };
    }""")


async def main(mode):
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        if mode == "pro":
            await shot(b, "01_basic", spec(group=False), 960, 560)
            await shot(b, "02_pro_blocks_boxes_nps", spec(objects={"boxes": {"show": True, "showNps": True}, "benchmark": {"show": True, "value": 60}}), 1100, 600)
            await shot(b, "03_small_multiples", spec(panel=True), 1280, 700)
            for st in ("boardroom", "ledger", "editorial", "signal", "aurora", "terrace"):
                await shot(b, "04_style_" + st, spec(objects={"style": {"template": st}, "boxes": {"showNps": True}}), 720, 420)
            await shot(b, "05_size_l", spec(objects={"boxes": {"show": True, "showNps": True}}), 900, 520)
            await shot(b, "05_size_m", spec(objects={"boxes": {"show": True, "showNps": True}}), 520, 330)
            i = await shot(b, "05_size_300x170", spec(objects={"boxes": {"show": True, "showNps": True}}), 300, 170)
            check(i["segs"] > 0, "300x170: dibuja las barras")
            await shot(b, "05_size_s", spec(n=5), 190, 130)
            await shot(b, "06_axes_grid_titles", spec(objects={"valueAxis": {"show": True, "showTitle": True}, "categoryAxis": {"showTitle": True},
                                                            "gridlines": {"show": True}}), 1000, 560)
            await shot(b, "07_landing", None, 640, 400)
            await shot(b, "07_landing_s", None, 300, 170)
            await shot(b, "08_guide", spec(), 960, 560, view=1)
            await shot(b, "09_high_contrast", spec(objects={"boxes": {"showNps": True}}), 960, 560, hc=True)
            await shot(b, "09_patterns", spec(objects={"accessibility": {"patterns": True}}), 960, 560)
            await shot(b, "10_drilldown_expanded", dict(spec(group=False), question2=True,
                       rows=[dict(r, question2=("Item " + str(k % 2 + 1))) for k, r in enumerate(survey(6, False))]), 960, 400)
            await shot(b, "11_locale_es", spec(objects={"valueAxis": {"show": True, "showTitle": True}}), 960, 560, locale="es-ES")
            await shot(b, "11_locale_ja", spec(objects={"valueAxis": {"show": True, "showTitle": True}}), 960, 560, locale="ja-JP")

            # Altura de fila: 3, 10 y 40 preguntas, visual bajo y alto, Automatic y Fixed.
            print("  Altura de fila")
            for n in (3, 10, 40):
                for (W, H) in ((900, 320), (900, 1000)):
                    pg, errs = await page(b, W, H)
                    await upd(pg, spec(n), W, H)
                    m = await bar_metrics(pg)
                    await pg.screenshot(path=os.path.join(OUT, f"12_rows_auto_{n}_{H}.png"))
                    await pg.close()
                    fill = m["bottom"] / max(1, m["scrollH"])
                    print(f"    auto  n={n:2d} {W}x{H}: barra {m['barH']:.1f}px, ocupa {fill:.0%} del alto, scroll={m['scrollable']}, nota «{m['note'][:60]}»")
                    check(m["barH"] <= 64.01, f"auto n={n} H={H}: barra <= 64 px")
                    if n == 10:
                        check(fill > 0.85, f"auto n={n} H={H}: las filas llenan el alto (sin media pantalla vacía)")
                    check(not errs, f"auto n={n} H={H}: sin errores")
            for scroll in (True, False):
                pg, errs = await page(b, 900, 320)
                await upd(pg, spec(40, objects={"layout": {"rowHeightMode": "fixed", "rowHeight": 30, "enableScroll": scroll}}), 900, 320)
                m = await bar_metrics(pg)
                await pg.screenshot(path=os.path.join(OUT, f"12_rows_fixed_40_scroll_{'on' if scroll else 'off'}.png"))
                await pg.close()
                print(f"    fixed 30px n=40 scroll={scroll}: barra {m['barH']:.1f}, scroll={m['scrollable']}, nota «{m['note'][:80]}»")
                if scroll:
                    check(m["scrollable"], "fixed + scroll: aparece el desplazamiento")
                else:
                    check("do not fit" in m["note"], "fixed sin scroll: aviso de las preguntas que no caben")

            # Formato dinámico (F11): la cadena que llega por valor manda sobre la de la columna.
            pg, errs = await page(b, 960, 500)
            await upd(pg, spec(objects={"scale": {"asPercent": False}}, dynFormat="0.0 \"resp\""), 960, 500)
            txt = await pg.evaluate("() => Array.from(document.querySelectorAll('svg text')).map(t => t.textContent).filter(t => /resp/.test(t)).slice(0,3)")
            await pg.close()
            check(len(txt) > 0, "F11: etiqueta con la cadena de formato dinámica " + str(txt))

            # Fetch More Data: con segmento pide más y emite su par de eventos; al no haber más, aviso visible.
            pg, errs = await page(b, 960, 500)
            await pg.evaluate("() => { window.__fetchOk = true; }")
            await upd(pg, spec(segment=True), 960, 500, op=0)
            f1 = await pg.evaluate("() => [__fetch, __ev.join('')]")
            await pg.evaluate("() => { window.__fetchOk = false; }")
            await upd(pg, spec(segment=True), 960, 500, op=1)
            f2 = await pg.evaluate("() => [__fetch, __ev.join(''), (document.querySelector('.lk-note')||{}).textContent, __warn.length]")
            await pg.close()
            print("    fetchMoreData:", f1, f2)
            check(f1[0] == 1 and f1[1] == "SF", "Fetch More Data: pide el siguiente bloque y cierra el par de eventos")
            check(f2[1] == "SFSF" and "first" in (f2[2] or "") and f2[3] >= 1, "Fetch More Data: aviso visible y icono cuando quedan filas sin llegar")

            # Formato en el lienzo: en modo formato hay subseleccionables y el clic no filtra.
            pg, errs = await page(b, 960, 560)
            await upd(pg, spec(objects={"valueAxis": {"show": True}, "gridlines": {"show": True}, "categoryAxis": {"showTitle": True}}), 960, 560, view=1, fmt=True)
            subs = await pg.evaluate("() => Array.from(document.querySelectorAll('[data-sub-selection-object-name]')).map(e => e.getAttribute('data-sub-selection-object-name'))")
            attrs = await pg.evaluate("() => { const e = document.querySelector('[data-sub-selection-object-name]'); return e ? String(e.className.baseVal ?? e.className) : ''; }")
            await pg.click("[data-seg]")
            sel = await pg.evaluate("() => __sel.length")
            await pg.close()
            names = sorted(set(subs))
            print("    on-object:", names, "| atributos:", attrs)
            check(len(names) >= 6, "On-object: barras, preguntas, leyenda, ejes, rejilla y fondo subseleccionables")
            check(sel == 0, "On-object: en modo formato el clic no filtra")

            # Marcadores: el callback de selección solo repinta (sin persistProperties) y casa por equals.
            pg, errs = await page(b, 960, 560)
            await upd(pg, spec(), 960, 560)
            await pg.click("[data-seg]")
            first = await pg.evaluate("() => __sel.slice()")
            await pg.evaluate("() => { window.__selIds = []; __persist.length = 0; }")
            await pg.evaluate("(keys) => __onSel(keys.map(k => __mkId(k)))", first)
            dim = await pg.evaluate("() => Array.from(document.querySelectorAll('[data-seg]')).filter(s => s.getAttribute('opacity') === '0.35').length")
            total = await pg.evaluate("() => document.querySelectorAll('[data-seg]').length")
            pers = await pg.evaluate("() => __persist.length")
            await pg.close()
            check(dim == total - 1, f"Marcador restaurado: se resalta el tramo guardado ({total - dim} de {total})")
            check(pers == 0, "Marcador: el callback no escribe propiedades")
        else:
            # Build --free: sin licencia (sin licenseManager) y con licencia leída sin planes (vista previa).
            i = await shot(b, "20_free_reading", spec(panel=True, objects={"boxes": {"show": True}, "style": {"template": "aurora"}}), 960, 560)
            check("not applied" in i["note"], "Free en lectura: dice qué funciones Pro no se aplican")
            pg, errs = await page(b, 960, 560)
            await upd(pg, spec(panel=True), 960, 560)
            n = await pg.evaluate("() => document.querySelectorAll('[data-seg]').length")
            await pg.click("[data-seg]")
            sel = await pg.evaluate("() => __sel.slice()")
            await pg.close()
            print("    Free, 5 regiones sumadas: tramos", n, "· identidades del primer clic:", len(sel))
            check(n == 50, "Free: small multiples apagado, una barra por pregunta (10 × 5 tramos)")
            check(len(sel) == 5, "Free: el clic selecciona las 5 filas que suma el tramo (todas las identidades)")
            i = await shot(b, "21_preview_panels", spec(panel=True, objects={"style": {"template": "boardroom"}}), 1280, 700, view=1, licence="none")
            check(i["wm"] == "flex", "Vista previa: marca de agua común visible")
            check("first 4 of 5" in i["note"], "Vista previa: primeros 4 paneles y aviso")
            pg, errs = await page(b, 960, 560, licence="none")
            await upd(pg, spec(objects={"boxes": {"show": True}}), 960, 560, view=1)
            await pg.wait_for_timeout(300)
            notes = await pg.evaluate("() => window.__notes || []")
            await pg.close()
            check(any("Top/Bottom" in x for x in notes), "Vista previa: aviso de Power BI con la función concreta")
        await b.close()
    print("\n" + ("TODO OK" if not FAILS else f"{len(FAILS)} FALLOS: " + " | ".join(FAILS)))
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "pro"))
