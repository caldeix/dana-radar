# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según
[SemVer](https://semver.org/lang/es/).

## [0.1.1] - 2026-10-23

SemVer: 0.1.0 → 0.1.1 (PATCH)

### Cambiado
- El workflow de avisos pasa de cada 15 a cada 20 minutos, en los minutos 7, 27 y 47, para evitar los
  retrasos del cron de GitHub en el minuto 0. Con el latido de 30 min, la hora de los datos se renueva
  como mucho cada 40 min y queda por debajo del aviso de datos viejos (1 h).

## [0.1.0] - 2026-10-22

Primera versión (MVP).

### Añadido
- Fetcher en Python que lee el canal RSS de avisos de AEMET, descarga los CAP 1.2 y genera
  `site/data/alerts.geojson` con los avisos naranja y rojo de lluvias, tormentas y costeros.
- Workflow de GitHub Actions cada 15 min que solo hace commit cuando cambian los datos (más un latido
  cada 30 min) y publica la web en GitHub Pages.
- Mapa oscuro (OpenFreeMap) con los avisos dibujados como nubes animadas por nivel, vistas de Península y
  Canarias, popup con el detalle de todos los avisos del punto pulsado, leyenda, hora de la última
  comprobación con aviso si tiene más de 1 h, estado "sin avisos" y descargo de fuente no oficial.
