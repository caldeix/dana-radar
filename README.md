# 🌧️ DANA Radar

> **Mapa web gratuito que dibuja como una nube los avisos naranja y rojo de AEMET** por lluvias, tormentas y
> fenómenos costeros en toda España.

[![Web](https://img.shields.io/badge/Web-GitHub%20Pages-ff7a1a?style=for-the-badge&logo=githubpages&logoColor=white)](https://caldeix.github.io/dana-radar/)
[![Datos](https://img.shields.io/badge/Datos-AEMET%20Meteoalerta-0b5ea8?style=for-the-badge)](https://www.aemet.es/es/eltiempo/prediccion/avisos)
[![Fetcher](https://img.shields.io/badge/Fetcher-Python%203.12-3776ab?style=for-the-badge&logo=python&logoColor=white)](fetcher)
[![Mapa](https://img.shields.io/badge/Mapa-Leaflet%20%2B%20MapLibre-199900?style=for-the-badge&logo=leaflet&logoColor=white)](site)
[![Versión](https://img.shields.io/badge/Versión-0.1.1-ff2d2d?style=for-the-badge)](CHANGELOG.md)
[![Licencia](https://img.shields.io/badge/Licencia-MIT-blue?style=for-the-badge)](LICENSE)

DANA Radar lee cada 20 minutos los avisos oficiales de AEMET (Plan Meteoalerta), los convierte en un
GeoJSON y los pinta sobre un mapa oscuro como una **nube animada** sobre la zona afectada, con el color de
su nivel. No tiene backend ni base de datos: todo es una web estática en GitHub Pages y un workflow de
GitHub Actions, con coste 0 €.

---

## ✨ Funciones

- 🗺️ **Mapa oscuro de España** con teselas vectoriales de OpenFreeMap
- ☁️ **Avisos como nubes** con textura de ruido, desenfoque y animación lenta
- 🟠 **Color por nivel**: naranja (riesgo importante) y rojo (riesgo extraordinario)
- 🌫️ **Avisos previstos más tenues** que los que ya están en vigor
- 📍 **Popup con todos los avisos del punto pulsado**: fenómeno, nivel, zona, inicio, fin, descripción,
  probabilidad y recomendaciones
- 🏝️ **Vistas Península y Canarias**, con contador de avisos activos en Canarias
- ⏱️ **Hora de la última comprobación** de AEMET y aviso si los datos tienen más de 1 h
- 🧹 **Filtro de caducados en el navegador**, aunque el GeoJSON todavía no se haya regenerado
- ✅ **Estado "No hay avisos activos"** cuando no hay nada que mostrar
- 📱 **Adaptado a móvil**, con un filtro más ligero y sin animación si el sistema pide reducir movimiento
- 🔁 **Actualización automática**: la web vuelve a pedir los datos cada 5 minutos

---

## 🇪🇸 Por qué existe

Tras las DANA, las alertas ES-Alert llegan al móvil pero no se publican en un feed abierto con sus zonas.
Los avisos de AEMET sí, y suelen precederlas. Este proyecto los junta en un mapa que se entiende de un
vistazo para:

- ver rápido qué zonas están en naranja o rojo,
- saber desde cuándo y hasta cuándo,
- y tener a mano el enlace a AEMET y el 112.

> ⚠️ **Descargo:** es un proyecto personal y **no** es una fuente oficial. Puede ir con retraso o fallar.
> Consulta siempre los [avisos de AEMET](https://www.aemet.es/es/eltiempo/prediccion/avisos), sigue las
> indicaciones de Protección Civil y, en una emergencia, llama al **112**.

---

## 🧱 Tecnologías

### Web (`site/`)
- **HTML + JavaScript sin build**, librerías por CDN con versión fijada e integridad SRI
- **Leaflet 1.9.4** para los avisos (polígonos SVG) y la interacción
- **MapLibre GL 5.24.0** + **`@maplibre/maplibre-gl-leaflet` 0.1.4** para el mapa base vectorial
- Filtros SVG `feTurbulence` + `feDisplacementMap` + `feGaussianBlur` para el efecto nube

### Datos (`fetcher/`)
- **Python 3.12**, solo biblioteca estándar (sin dependencias que instalar)
- **GitHub Actions** con cron cada 20 minutos y lanzamiento manual
- **GitHub Pages** con origen GitHub Actions

---

## 📡 Fuentes de datos

- **AEMET, canal RSS de avisos de España**: lista de avisos vigentes, uno por item
- **AEMET, mensajes CAP 1.2 (Meteoalerta)**: nivel, fenómeno, vigencia, texto y polígono de cada zona
- **OpenFreeMap**: teselas vectoriales del mapa base, sin API key
- **OpenMapTiles + OpenStreetMap**: esquema y datos cartográficos del mapa base

El navegador **nunca** llama a AEMET ni a `tile.openstreetmap.org`: solo lee `data/alerts.geojson` desde
la propia web. AEMET recibe las peticiones de una ejecución del workflow, no una por visitante.

---

## 📁 Estructura del proyecto

```text
dana-radar/
├── .github/workflows/
│   ├── update-alerts.yml   # cron cada 20 min: descarga avisos y hace commit si cambian
│   └── pages.yml           # publica site/ en GitHub Pages
├── fetcher/
│   └── fetch_alerts.py     # RSS + CAP de AEMET → GeoJSON
├── site/
│   ├── index.html          # página y filtros SVG de las nubes
│   ├── app.js              # mapa, capa de nubes, popup y estados
│   ├── style.css
│   └── data/alerts.geojson # avisos activos (lo genera el workflow)
├── CHANGELOG.md
├── LICENSE
└── README.md
```

---

## 🚀 Puesta en marcha (local)

### 1) Descargar los avisos actuales

```bash
python fetcher/fetch_alerts.py
```

### 2) Servir la web

```bash
python -m http.server 8765 --directory site
```

Abrir: **http://localhost:8765**

---

## ⚙️ Configuración

Constantes al principio de `fetcher/fetch_alerts.py`:

| Constante | Valor | Para qué |
|---|---|---|
| `RSS_URL` | Canal RSS de avisos de España | Fuente de los avisos |
| `NIVELES` | `naranja`, `rojo` | Niveles que se muestran |
| `FENOMENOS` | `PR` Lluvias, `TO` Tormentas, `CO` Costeros | Fenómenos que se muestran |
| `LATIDO` | 30 min | Cada cuánto se reescribe la hora aunque no cambien los avisos |
| `PAUSA_ENTRE_CAP` | 0,3 s | Pausa entre descargas para no cargar a AEMET |

Constantes al principio de `site/app.js`:

| Constante | Valor | Para qué |
|---|---|---|
| `ESTILO_MAPA` | `tiles.openfreemap.org/styles/dark` | Estilo del mapa base |
| `RECARGA_MS` | 5 min | Cada cuánto la web vuelve a pedir los datos |
| `DATOS_VIEJOS_MS` | 1 h | A partir de cuándo se avisa de datos viejos |

No hay secretos ni API keys.

---

## ☁️ Despliegue en GitHub (gratis)

1. *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
2. *Actions → Actualizar avisos → Run workflow* para la primera ejecución.
3. A partir de ahí el cron se ejecuta solo cada 20 minutos (minutos 7, 27 y 47 de cada hora) y publica
   la web cuando cambian los datos.
4. GitHub desactiva los workflows programados de repos públicos tras 60 días sin actividad: si pasa, se
   reactivan desde la pestaña *Actions*.

Para pararlo todo: desactivar el workflow *Actualizar avisos* en la pestaña *Actions*.

---

## 🔬 Cómo se leen los avisos

Cada item del RSS de AEMET enlaza a un mensaje **CAP 1.2** en XML. El título (`Aviso. Nivel naranja.
Lluvias. Zona`) sirve para no descargar los que no se van a mostrar; el filtro de verdad se repite sobre
el CAP. De cada mensaje se usa solo el bloque `es-ES`:

| Campo CAP | Uso |
|---|---|
| `eventCode` `AEMET-Meteoalerta fenomeno` | Fenómeno (`PR;Lluvias`, `TO;Tormentas`, `CO;Costeros`…) |
| `parameter` `AEMET-Meteoalerta nivel` | `amarillo`, `naranja` o `rojo` |
| `onset`, `expires` | Inicio y fin (se guardan en UTC) |
| `area/areaDesc`, `area/polygon` | Zona y polígono `lat,lon` (se pasa a GeoJSON `lon,lat`) |
| `description`, `instruction`, `parameter` `probabilidad` | Texto del popup |

Se descartan los avisos caducados (el canal a veces los sigue listando), los mensajes `Cancel` y los que no
son `Actual`. La salida tiene orden estable para que git solo vea cambios cuando cambian los avisos:

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

---

## 📄 Licencia

Código bajo licencia **MIT**. Ver [LICENSE](LICENSE).

- **Avisos:** © [AEMET](https://www.aemet.es). Su [nota legal](https://www.aemet.es/es/nota_legal) permite
  reutilizarlos, también con fines comerciales, citando la fuente y sin alterar su sentido.
- **Mapa base:** [OpenFreeMap](https://openfreemap.org), © [OpenMapTiles](https://www.openmaptiles.org/),
  datos © [colaboradores de OpenStreetMap](https://www.openstreetmap.org/copyright).

Cambios de cada versión en [CHANGELOG.md](CHANGELOG.md).

---

## 🙌 Contribuir

Las sugerencias y los avisos de fallos son bienvenidos: abre un *issue* en el repositorio.
