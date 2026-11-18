# -*- coding: utf-8 -*-
"""Compara número a número la build actual (.tmp/drop) con la 1.0.0.1 publicada (_releases/) con los mismos datos.

Lee de cada uno las puntuaciones de bloque (círculos), Top/Bottom box y NPS. La 1.0.0.1 sin licenseManager entra en
vista previa Pro al editar (viewMode 1), así que dibuja bloques, cajas y NPS igual que la build de prueba Pro.

Uso:  node build-test.js && python tools/simulador/comparar_v10.py
"""
import asyncio, io, json, os, sys, tempfile, zipfile, glob
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness as H

ROOT = H.ROOT
rel = sorted(glob.glob(os.path.join(ROOT, "_releases", "*1.0.0.1.pbiviz")))[-1]
z = zipfile.ZipFile(rel)
d = json.loads(z.read([n for n in z.namelist() if n.endswith(".pbiviz.json")][0]))
TMP = tempfile.mkdtemp()
JS10 = os.path.join(TMP, "v10.js")
io.open(JS10, "w", encoding="utf-8").write(d["content"]["js"])
GUID10 = d["visual"]["guid"]

# dataView de Desktop con una medida en Value y otra (o la misma) en Scale order
DV = r"""
window.__dv2 = function(spec){
  const rows = spec.rows, cats = [];
  const col = (name, q, role, vals) => ({ source: { displayName: name, queryName: q, roles: {[role]: true} }, values: vals, identity: vals.map((v,i)=>({i})) });
  if (spec.groupWell) cats.push(col('Block', 'Survey.Block', 'group', rows.map(r => r.group)));
  if (spec.hier) cats.push(col('Block', 'Survey.Block Hierarchy.Block', 'question', rows.map(r => r.group)));
  cats.push(col('Question', spec.hier ? 'Survey.Block Hierarchy.Question' : 'Survey.Question', 'question', rows.map(r => r.question)));
  const values = [], groups = [];
  spec.responses.forEach((name, k) => {
    const code = k + 1;
    let g;
    if (spec.same) {
      // Value y Scale order con el MISMO campo (Sum of Response): Power BI entrega una columna con los dos roles.
      const v = { source: { displayName: 'Sum of Response', queryName: 'Sum(Survey.Response)', roles: { value: true, order: true }, groupName: name, isMeasure: true },
                  values: rows.map(r => r.counts[k] * code) };
      values.push(v); g = { name, values: [v] };
    } else {
      const v = { source: { displayName: 'Count', queryName: 'Count(Survey.Id)', roles: { value: true }, groupName: name, isMeasure: true }, values: rows.map(r => r.counts[k]) };
      const o = { source: { displayName: 'Order', queryName: 'Min(Survey.Response)', roles: { order: true }, groupName: name, isMeasure: true }, values: rows.map(() => code) };
      values.push(v, o); g = { name, values: [v, o] };
    }
    groups.push(g);
  });
  values.grouped = () => groups;
  return { metadata: { columns: cats.map(c => c.source).concat(values.map(v => v.source)), objects: spec.objects }, categorical: { categories: cats, values } };
};
"""

READ = """() => {
  const t = Array.from(document.querySelectorAll('svg text')).map(x => x.textContent);
  return { circles: t.filter(x => /^-?\\d+(\\.\\d)?$/.test(x) || /^\\d+%$/.test(x) && false).slice(0, 0),
           texts: t };
}"""


async def run(b, js, guid, spec, view):
    pg = await b.new_page(viewport={"width": 1200, "height": 700})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.set_content("<html><body style='margin:0'><div id='host' style='position:relative;width:1200px;height:700px'></div></body></html>")
    await pg.add_script_tag(content=H.STUB)
    await pg.add_script_tag(content=DV)
    await pg.add_script_tag(path=js)
    await pg.evaluate("(g) => { window.__v = powerbi.visuals.plugins[g].create({ element: document.getElementById('host'), host: __host }); }", guid)
    for _ in range(2):   # la 1.0 repinta tras resolver la licencia
        await pg.evaluate("([sp, vm]) => __v.update({ dataViews: [__dv2(sp)], viewport: {width: 1200, height: 700}, type: 2, operationKind: 0, viewMode: vm })", [spec, view])
        await pg.wait_for_timeout(300)
    res = await pg.evaluate("""() => {
        const t = Array.from(document.querySelectorAll('svg text'));
        const circ = Array.from(document.querySelectorAll('svg circle')).filter(c => !c.closest('defs'));
        // la cifra del círculo es el texto con el mismo cx
        const scores = circ.map(c => { const x = c.getAttribute('cx'), y = +c.getAttribute('cy');
            const m = t.find(e => e.getAttribute('x') === x && Math.abs(+e.getAttribute('y') - y) < 12); return m ? m.textContent : '?'; });
        const boxes = t.map(e => e.textContent).filter(s => / \\/ /.test(s) && /%/.test(s));
        const nps = t.map(e => e.textContent).filter(s => /^[+-]\\d+$/.test(s));
        const note = (document.querySelector('.lk-note') || {}).textContent || '';
        return { scores, boxes, nps, aviso: /aggregation/.test(note) };
    }""")
    await pg.close()
    return res, errs


async def main():
    objs = {"boxes": {"show": True, "showNps": True}}
    rows = H.survey(10, False)
    casos = {
        "Group + Question, Value=Count, Order=Min(code)": dict(groupWell=True, same=False),
        "Group + Question, Value=Order=Sum of Response": dict(groupWell=True, same=True),
        "Jerarquía expandida, Value=Order=Sum of Response": dict(hier=True, same=True),
        "Jerarquía expandida, Value=Count, Order=Min(code)": dict(hier=True, same=False),
    }
    fallos = 0
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for nombre, c in casos.items():
            spec = {"rows": rows, "responses": H.RESP, "objects": objs, **c}
            # la 1.0 no conocía la jerarquía: se compara con su caso equivalente (Block en Group)
            spec10 = dict(spec, hier=False, groupWell=True) if c.get("hier") else spec
            new, e1 = await run(b, H.BUNDLE, H.GUID, spec, 1)
            old, e0 = await run(b, JS10, GUID10, spec10, 1)
            # Con Scale order = Suma, la 1.0 daba una "media" que dependía del orden de filas: la 1.1 usa la
            # posición 1..5 y avisa. Ahí se exige: mismas cajas y NPS que la 1.0, medias entre 1 y 5 y el aviso.
            if c.get("same"):
                ok = (new["boxes"] == old["boxes"] and new["nps"] == old["nps"] and new["aviso"]
                      and all(1 <= float(x) <= 5 for x in new["scores"]))
            else:
                ok = new["scores"] == old["scores"] and new["boxes"] == old["boxes"] and new["nps"] == old["nps"] and not new["aviso"]
            fallos += not ok
            print(("OK    " if ok else "DISTINTO ") + nombre)
            print("   1.0.0.1  bloques", old["scores"], "| cajas", old["boxes"][:3], "| NPS", old["nps"][:3])
            print("   actual   bloques", new["scores"], "| cajas", new["boxes"][:3], "| NPS", new["nps"][:3], "| aviso:", new["aviso"])
            if e0 or e1:
                print("   errores:", e0, e1)
        # Mismas filas en otro orden (como al expandir una jerarquía): con Scale order = Sum, ¿cambia el resultado?
        import random
        sh = list(rows); random.Random(3).shuffle(sh)
        for nombre, c in (("Sum of Response, filas en otro orden", dict(groupWell=True, same=True)),
                          ("Count + Min(code), filas en otro orden", dict(groupWell=True, same=False))):
            for etiqueta, js, guid in (("1.0.0.1", JS10, GUID10), ("actual ", H.BUNDLE, H.GUID)):
                a, _ = await run(b, js, guid, {"rows": rows, "responses": H.RESP, "objects": objs, **c}, 1)
                s2, _ = await run(b, js, guid, {"rows": sh, "responses": H.RESP, "objects": objs, **c}, 1)
                estable = sorted(a['scores']) == sorted(s2['scores']) and sorted(a['boxes']) == sorted(s2['boxes'])  # las filas cambian de sitio, los números no
                print(f"{nombre} [{etiqueta}]: bloques {a['scores']} -> {s2['scores']}, cajas {a['boxes'][:2]} -> {s2['boxes'][:2]}  {'ESTABLE' if estable else 'CAMBIA CON EL ORDEN DE FILAS'}")
                if etiqueta.strip() == "actual" and not estable:
                    fallos += 1
        await b.close()
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    asyncio.run(main())
