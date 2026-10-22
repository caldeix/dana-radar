# DANA Radar

![versión](https://img.shields.io/badge/versión-0.1.0-orange) ![licencia](https://img.shields.io/badge/licencia-MIT-blue)

Mapa web, estático y gratuito, que dibuja como una nube los avisos **naranja** y **rojo** de AEMET por
**lluvias, tormentas y fenómenos costeros**, con el color de su nivel.

**Web:** https://caldeix.github.io/dana-radar/

> **Fuente no oficial.** Este mapa puede ir con retraso o fallar. Consulta siempre los
> [avisos de AEMET](https://www.aemet.es/es/eltiempo/prediccion/avisos), sigue las indicaciones de
> Protección Civil y, en una emergencia, llama al **112**.

## Cómo funciona

```
AEMET (RSS + CAP)  ──cada 15 min──▶  GitHub Actions  ──▶  site/data/alerts.geojson  ──▶  GitHub Pages
                                     (fetcher Python)       (commit si cambia)            (navegador)
```

- El navegador **nunca** llama a AEMET: solo lee `data/alerts.geojson` desde la propia web. AEMET recibe
  las peticiones de una ejecución del workflow, no una por visitante.
- El mapa base es de [OpenFreeMap](https://openfreemap.org) (teselas vectoriales, sin API key), no de los
  servidores de OpenStreetMap.
- Las ES-Alert que llegan al móvil no tienen un feed público con sus zonas; los avisos de AEMET suelen
  precederlas, por eso se usan como fuente.

### Fuente de datos (resultado del spike, 22/10/2026)

- Canal RSS 2.0 de AEMET para toda España:
  `https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/rss/CAP_AFAE_wah_RSS.xml`.
  Cada `<item>` es un aviso y su `<link>` apunta a un mensaje **CAP 1.2** en XML sin comprimir.
- El título del item tiene la forma `Aviso. Nivel naranja. Lluvias. Zona`; el fetcher lo usa para no
  descargar los CAP que ya se sabe que no se van a mostrar.
- Cada CAP trae dos `<info>` (`es-ES` y `en-GB`); se usa solo `es-ES`. Campos utilizados:

  | Campo CAP | Uso |
  |---|---|
  | `eventCode` `AEMET-Meteoalerta fenomeno` | `PR;Lluvias`, `TO;Tormentas`, `CO;Costeros` (el resto se descarta) |
  | `parameter` `AEMET-Meteoalerta nivel` | `amarillo`, `naranja`, `rojo` (se muestran naranja y rojo) |
  | `onset`, `expires` | Inicio y fin (con zona horaria; se guardan en UTC) |
  | `area/areaDesc`, `area/polygon` | Zona y polígono `lat,lon lat,lon ...` (se pasa a GeoJSON `lon,lat`) |
  | `description`, `instruction`, `parameter` `probabilidad` | Texto del popup |

- El canal puede listar avisos ya caducados: se filtran en el fetcher y otra vez en el navegador.
- Se ignoran los mensajes `msgType = Cancel` y los que no son `status = Actual`.

### Formato de `site/data/alerts.geojson`

`FeatureCollection` con `updated_at` (UTC, última comprobación correcta de AEMET) y una feature por zona:

```json
{
  "type": "Feature",
  "id": "2.49.0.0.724.0.ES.20261022093129.663901COCO24041792661489#0",
  "properties": {
    "nivel": "naranja", "codigo": "CO", "fenomeno": "Costeros", "zona": "Costa - Litoral cántabro",
    "inicio": "2026-10-23T03:00:00Z", "fin": "2026-10-23T21:59:59Z",
    "descripcion": "...", "instrucciones": "...", "probabilidad": "40%-70%"
  },
  "geometry": { "type": "Polygon", "coordinates": [[[-3.15, 43.35], ...]] }
}
```

El fichero solo se reescribe si cambian los avisos o, como latido, cada 30 min (para que la web sepa
que el fetcher sigue vivo y avise si los datos tienen más de 1 h).

## Estructura

| Ruta | Qué es |
|---|---|
| `fetcher/fetch_alerts.py` | Descarga y conversión a GeoJSON (solo biblioteca estándar de Python) |
| `.github/workflows/update-alerts.yml` | Cron cada 15 min + lanzamiento manual; commit solo si hay cambios |
| `.github/workflows/pages.yml` | Publica `site/` en GitHub Pages |
| `site/` | Web estática: `index.html`, `app.js`, `style.css` y `data/alerts.geojson` |

La web es HTML + JS sin build. Librerías por CDN con versión fijada e integridad SRI: Leaflet 1.9.4,
MapLibre GL 5.24.0 y `@maplibre/maplibre-gl-leaflet` 0.1.4. Las nubes son los polígonos de Leaflet en SVG
con un filtro `feTurbulence` + `feDisplacementMap` + `feGaussianBlur` y una animación de opacidad (se
desactiva con `prefers-reduced-motion`; en móvil se usa un filtro más ligero).

## Uso en local

```bash
python fetcher/fetch_alerts.py
python -m http.server 8765 --directory site
```

y abrir http://localhost:8765.

## Puesta en marcha en GitHub

1. *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
2. *Actions → Actualizar avisos → Run workflow* para la primera ejecución.
3. GitHub desactiva los workflows programados de repos públicos tras 60 días sin actividad en el repo:
   si pasa, se reactivan desde la pestaña *Actions*.

Para pararlo todo: desactivar el workflow *Actualizar avisos* en la pestaña *Actions*.

## Licencias y atribuciones

- Código: [MIT](LICENSE).
- Avisos: © [AEMET](https://www.aemet.es). La [nota legal de AEMET](https://www.aemet.es/es/nota_legal)
  permite reutilizar su información, también con fines comerciales, citando la fuente y sin alterar su
  sentido (Ley 37/2007 de reutilización de la información del sector público). El mapa muestra
  "Fuente: AEMET" y la fecha de la última actualización.
- Mapa base: [OpenFreeMap](https://openfreemap.org), © [OpenMapTiles](https://www.openmaptiles.org/),
  datos © [colaboradores de OpenStreetMap](https://www.openstreetmap.org/copyright).

## Changelog

Ver [CHANGELOG.md](CHANGELOG.md).
