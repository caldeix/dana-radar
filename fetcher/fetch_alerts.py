"""Descarga los avisos CAP de AEMET (Meteoalerta) y los guarda como GeoJSON.

Flujo: canal RSS de avisos de España -> un mensaje CAP 1.2 por aviso -> filtro
(nivel, fenómeno, caducidad, idioma) -> FeatureCollection con orden estable.

Solo usa la biblioteca estándar para que el workflow no tenga que instalar nada.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

RSS_URL = "https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/rss/CAP_AFAE_wah_RSS.xml"
USER_AGENT = "dana-radar/0.1 (+https://github.com/caldeix/dana-radar)"
IDIOMA = "es-ES"

# Niveles y fenómenos que se muestran (P-2 y P-3 del plan).
NIVELES = ("naranja", "rojo")
FENOMENOS = {"PR": "Lluvias", "TO": "Tormentas", "CO": "Costeros"}

# Aunque los datos no cambien, se reescribe updated_at con esta frecuencia para
# que la web sepa que el fetcher sigue vivo (latido).
LATIDO = timedelta(minutes=30)

PAUSA_ENTRE_CAP = 0.3  # segundos, para no castigar a AEMET
TIMEOUT = 30

CAP_NS = {"cap": "urn:oasis:names:tc:emergency:cap:1.2"}
TITULO_RSS = re.compile(r"^Aviso\. Nivel (?P<nivel>\w+)\. (?P<fenomeno>[^.]+)\.", re.IGNORECASE)


def descargar(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read()


def enlaces_rss(rss_xml: bytes) -> list[str]:
    """Enlaces a los CAP del canal, descartando los que el título ya deja fuera.

    El título ("Aviso. Nivel naranja. Lluvias. Zona") solo sirve para ahorrar
    descargas; el filtro de verdad se repite sobre el CAP.
    """
    raiz = ET.fromstring(rss_xml)
    nombres = {n.lower() for n in FENOMENOS.values()}
    enlaces = []
    for item in raiz.iter("item"):
        enlace = (item.findtext("link") or "").strip()
        if not enlace:
            continue
        m = TITULO_RSS.match((item.findtext("title") or "").strip())
        if m and (m["nivel"].lower() not in NIVELES or m["fenomeno"].strip().lower() not in nombres):
            continue
        enlaces.append(enlace)
    return sorted(set(enlaces))


def _texto(nodo: ET.Element, ruta: str) -> str:
    return (nodo.findtext(ruta, default="", namespaces=CAP_NS) or "").strip()


def _valor(info: ET.Element, etiqueta: str, nombre: str) -> str:
    for nodo in info.findall(f"cap:{etiqueta}", CAP_NS):
        if _texto(nodo, "cap:valueName") == nombre:
            return _texto(nodo, "cap:value")
    return ""


def _anillo(poligono: str) -> list[list[float]]:
    """'lat,lon lat,lon ...' (CAP) -> [[lon, lat], ...] (GeoJSON), cerrado."""
    puntos = []
    for par in poligono.split():
        lat, lon = (float(v) for v in par.split(","))
        puntos.append([lon, lat])
    if puntos and puntos[0] != puntos[-1]:
        puntos.append(puntos[0])
    return puntos


def _iso_utc(valor: str) -> str:
    return datetime.fromisoformat(valor).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parsear_cap(cap_xml: bytes) -> list[dict]:
    """Features GeoJSON de un mensaje CAP (una por <area> con polígono), sin filtrar."""
    raiz = ET.fromstring(cap_xml)
    if _texto(raiz, "cap:status") != "Actual" or _texto(raiz, "cap:msgType") == "Cancel":
        return []
    identificador = _texto(raiz, "cap:identifier")

    features = []
    for info in raiz.findall("cap:info", CAP_NS):
        if _texto(info, "cap:language") != IDIOMA:
            continue
        codigo, _, nombre = _valor(info, "eventCode", "AEMET-Meteoalerta fenomeno").partition(";")
        nivel = _valor(info, "parameter", "AEMET-Meteoalerta nivel").lower()
        for n_area, area in enumerate(info.findall("cap:area", CAP_NS)):
            anillos = [_anillo(p.text or "") for p in area.findall("cap:polygon", CAP_NS)]
            anillos = [a for a in anillos if len(a) >= 4]
            if not anillos:
                continue
            geometria = (
                {"type": "Polygon", "coordinates": anillos[:1]}
                if len(anillos) == 1
                else {"type": "MultiPolygon", "coordinates": [[a] for a in anillos]}
            )
            features.append({
                "type": "Feature",
                "id": f"{identificador}#{n_area}",
                "properties": {
                    "nivel": nivel,
                    "codigo": codigo,
                    "fenomeno": FENOMENOS.get(codigo, nombre),
                    "zona": _texto(area, "cap:areaDesc"),
                    "inicio": _iso_utc(_texto(info, "cap:onset") or _texto(info, "cap:effective")),
                    "fin": _iso_utc(_texto(info, "cap:expires")),
                    "descripcion": _texto(info, "cap:description"),
                    "instrucciones": _texto(info, "cap:instruction"),
                    "probabilidad": _valor(info, "parameter", "AEMET-Meteoalerta probabilidad"),
                },
                "geometry": geometria,
            })
    return features


def filtrar(features: list[dict], ahora: datetime) -> list[dict]:
    salida = []
    for f in features:
        p = f["properties"]
        if p["nivel"] not in NIVELES or p["codigo"] not in FENOMENOS:
            continue
        if datetime.fromisoformat(p["fin"]) <= ahora:
            continue
        salida.append(f)
    return sorted(salida, key=lambda f: (f["properties"]["inicio"], f["properties"]["zona"], f["id"]))


def coleccion(features: list[dict], ahora: datetime) -> dict:
    return {
        "type": "FeatureCollection",
        "updated_at": ahora.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "AEMET - Plan Meteoalerta",
        "features": features,
    }


def hay_que_escribir(anterior: dict | None, features: list[dict], ahora: datetime) -> bool:
    """Solo se reescribe si cambian los avisos o si toca el latido."""
    if not anterior:
        return True
    if anterior.get("features") != features:
        return True
    try:
        ultima = datetime.fromisoformat(anterior["updated_at"].replace("Z", "+00:00"))
    except (KeyError, ValueError):
        return True
    return ahora - ultima >= LATIDO


def serializar(datos: dict) -> str:
    return json.dumps(datos, ensure_ascii=False, indent=1, sort_keys=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default="site/data/alerts.geojson", help="Fichero GeoJSON de salida")
    ap.add_argument("--rss", default=RSS_URL, help="URL del canal RSS de avisos")
    args = ap.parse_args(argv)

    ahora = datetime.now(timezone.utc).replace(microsecond=0)
    enlaces = enlaces_rss(descargar(args.rss))
    print(f"{len(enlaces)} avisos candidatos en el RSS")

    features = []
    for i, enlace in enumerate(enlaces):
        if i:
            time.sleep(PAUSA_ENTRE_CAP)
        features.extend(parsear_cap(descargar(enlace)))
    features = filtrar(features, ahora)
    print(f"{len(features)} zonas con aviso tras filtrar")

    salida = Path(args.out)
    anterior = None
    if salida.exists():
        try:
            anterior = json.loads(salida.read_text(encoding="utf-8"))
        except ValueError:
            anterior = None

    if not hay_que_escribir(anterior, features, ahora):
        print("Sin cambios: no se reescribe el fichero")
        return 0

    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(serializar(coleccion(features, ahora)), encoding="utf-8", newline="\n")
    print(f"Escrito {salida}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
