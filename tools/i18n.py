# -*- coding: utf-8 -*-
"""stringResources (12 idiomas) y src/strings.ts del Likert Survey Pro.

Fuentes de las claves en inglés:
  - capabilities.json: roles (nombre y descripción), tarjetas, propiedades y elementos de enumeración;
  - src/visual.ts: los textos propios, siempre como pares "Clave", "texto inglés";
  - displayName / description del visual (pbiviz.json).
Las traducciones van por TEXTO inglés: tools/i18n_likert.py (propias) y tools/i18n_comun.py (cartera).
Orden de cada fila: es, pt-BR, fr, de, it, nl, pl, ja, zh, ko (+ pt-PT, ver PT_PT).

Ejecutar desde la raíz:  python tools/i18n.py          → escribe
                         python tools/i18n.py --faltan → lista lo que no tiene traducción
Falla si alguna clave queda sin traducir: nada de claves en inglés en otro idioma por olvido.
"""
import io, json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from i18n_comun import T as COMUN  # noqa: E402
from i18n_likert import LK, PT_PT  # noqa: E402

L = ["es-ES", "pt-BR", "fr-FR", "de-DE", "it-IT", "nl-NL", "pl-PL", "ja-JP", "zh-CN", "ko-KR"]
T = dict(COMUN)
T.update(LK)
KEY = re.compile(r'"([A-Z][A-Za-z]*_[A-Za-z0-9_]+)"\s*,\s*"((?:[^"\\]|\\.)*)"')


def caps_keys(caps):
    en = {}
    for r in caps["dataRoles"]:
        en[r["displayNameKey"]] = r["displayName"]
        if r.get("descriptionKey"):
            en[r["descriptionKey"]] = r["description"]
    for o in caps["objects"].values():
        en[o["displayNameKey"]] = o["displayName"]
        for p in o["properties"].values():
            en[p["displayNameKey"]] = p["displayName"]
            for it in p["type"].get("enumeration", []):
                if it.get("displayNameKey"):
                    en[it["displayNameKey"]] = it["displayName"]
    return en


def main():
    caps = json.load(io.open(os.path.join(ROOT, "capabilities.json"), encoding="utf-8"))
    pb = json.load(io.open(os.path.join(ROOT, "pbiviz.json"), encoding="utf-8"))
    en = {"displayName": pb["visual"]["displayName"], "description": pb["visual"]["description"]}
    en.update(caps_keys(caps))
    # settings.ts: cada displayNameKey tiene que existir en capabilities (si no, Desktop no lo traduce).
    st = io.open(os.path.join(ROOT, "src", "settings.ts"), encoding="utf-8").read()
    huerfanas = sorted(set(re.findall(r'displayNameKey:\s*"([^"]+)"', st)) - set(en))
    if huerfanas:
        raise SystemExit("Claves de settings.ts que no están en capabilities.json: " + ", ".join(huerfanas))
    src = io.open(os.path.join(ROOT, "src", "visual.ts"), encoding="utf-8").read()
    for m in KEY.finditer(src):
        k, v = m.group(1), m.group(2).replace('\\"', '"')
        if k not in en:
            en[k] = v
    no_trad = {"displayName"}            # el nombre del producto no se traduce
    falta = sorted({v for k, v in en.items() if k not in no_trad and v not in T})
    if "--faltan" in sys.argv:
        for v in falta:
            print(json.dumps(v, ensure_ascii=False))
        print(len(falta), "sin traducir de", len(en))
        return
    if falta:
        raise SystemExit("Sin traducción (" + str(len(falta)) + "): " + " | ".join(falta))
    out = {"en-US": en}
    for i, lang in enumerate(L):
        out[lang] = {k: (v if k in no_trad else T[v][i]) for k, v in en.items()}
    # Portugués de Portugal: el de Brasil con los cambios de léxico de PT_PT.
    pt = dict(out["pt-BR"])
    for k, v in pt.items():
        for a, b in PT_PT:
            v = v.replace(a, b)
        pt[k] = v
    out["pt-PT"] = pt
    for lang, d in out.items():
        p = os.path.join(ROOT, "stringResources", lang)
        os.makedirs(p, exist_ok=True)
        io.open(os.path.join(p, "resources.resjson"), "w", encoding="utf-8", newline="\n").write(
            json.dumps(d, indent=2, ensure_ascii=False) + "\n")
    # Bundle: claves que NO están en capabilities (Desktop no las traduce con getDisplayName).
    capstxt = io.open(os.path.join(ROOT, "capabilities.json"), encoding="utf-8").read()
    runtime = sorted(k for k in en if f'"{k}"' not in capstxt and k not in ("displayName", "description"))
    tabla = {lang: {k: d[k] for k in runtime if d[k] != en[k]} for lang, d in out.items() if lang != "en-US"}
    ts = ["/**",
          " * Traducciones de los textos que escribe el propio visual (pantalla de inicio, guía, avisos, tooltips).",
          " * Power BI Desktop solo resuelve con getDisplayName las claves declaradas en capabilities.json, así",
          " * que estas viajan en el bundle. Generado por tools/i18n.py: no editar a mano.",
          " */",
          "export const STRINGS: Record<string, Record<string, string>> = " + json.dumps(tabla, ensure_ascii=False, indent=4) + ";", ""]
    io.open(os.path.join(ROOT, "src", "strings.ts"), "w", encoding="utf-8", newline="\n").write("\n".join(ts))
    # pbiviz.json: los 12 idiomas declarados
    pb["stringResources"] = ["stringResources/%s/resources.resjson" % l for l in ["en-US"] + L + ["pt-PT"]]
    io.open(os.path.join(ROOT, "pbiviz.json"), "w", encoding="utf-8", newline="\n").write(json.dumps(pb, indent=2, ensure_ascii=False) + "\n")
    print(len(en), "claves ·", len(out), "idiomas ·", len(runtime), "en el bundle")


if __name__ == "__main__":
    main()
