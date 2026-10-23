/* DANA Radar: pinta como nubes los avisos de site/data/alerts.geojson. */
(function () {
  "use strict";

  const DATOS_URL = "data/alerts.geojson";
  const ESTILO_MAPA = "https://tiles.openfreemap.org/styles/dark";
  const RECARGA_MS = 5 * 60 * 1000; // vuelve a pedir el GeoJSON
  const REPINTADO_MS = 60 * 1000; // quita caducados y revisa antigüedad
  const DATOS_VIEJOS_MS = 60 * 60 * 1000;

  const COLORES = { naranja: "#ff7a1a", rojo: "#ff2d2d" };
  const ORDEN_NIVEL = { rojo: 0, naranja: 1 };
  const VISTAS = {
    peninsula: L.latLngBounds([35.1, -9.6], [43.9, 4.5]),
    canarias: L.latLngBounds([27.6, -18.2], [29.5, -13.3]),
  };

  const $ = (id) => document.getElementById(id);
  const estado = $("estado");
  const resumen = $("resumen");
  const vacio = $("vacio");
  const nCanarias = $("n-canarias");

  // ---------- Mapa ----------

  const movil = window.matchMedia("(max-width: 600px)").matches;
  // Margen para que el panel (arriba a la izquierda) no tape la costa norte.
  const MARGEN = movil
    ? { paddingTopLeft: [10, 70], paddingBottomRight: [10, 80] }
    : { paddingTopLeft: [370, 30], paddingBottomRight: [30, 70] };

  const mapa = L.map("mapa", { zoomSnap: 0.5, minZoom: 4, maxZoom: 12, worldCopyJump: true });
  mapa.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  mapa.fitBounds(VISTAS.peninsula, MARGEN);

  const base = L.maplibreGL({
    style: ESTILO_MAPA,
    attribution:
      '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
      '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> ' +
      'Datos de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>',
  }).addTo(mapa);

  // El estilo de OpenFreeMap pide algún icono que no está en su sprite: se sustituye
  // por uno vacío para no llenar la consola de avisos.
  base.getMaplibreMap().on("styleimagemissing", (e) => {
    const gl = base.getMaplibreMap();
    if (!gl.hasImage(e.id)) gl.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
  });

  mapa.attributionControl.addAttribution(
    'Avisos: <a href="https://www.aemet.es/es/eltiempo/prediccion/avisos" target="_blank" rel="noopener">Fuente: AEMET</a>'
  );

  const renderer = L.svg({ padding: 0.5 });
  const capa = L.geoJSON(null, { renderer, style: estilo, onEachFeature: alPintar }).addTo(mapa);

  if (movil) $("panel").open = false;

  // ---------- Vistas Península / Canarias ----------

  document.querySelectorAll(".vistas button").forEach((boton) => {
    boton.addEventListener("click", () => {
      mapa.flyToBounds(VISTAS[boton.dataset.vista], { ...MARGEN, duration: 0.8 });
      document.querySelectorAll(".vistas button").forEach((b) => b.setAttribute("aria-pressed", String(b === boton)));
    });
  });

  // ---------- Datos ----------

  let coleccion = null;
  let errorCarga = null;

  async function cargar() {
    try {
      const resp = await fetch(DATOS_URL, { cache: "no-cache" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      coleccion = await resp.json();
      errorCarga = null;
    } catch (err) {
      console.warn("No se pudieron cargar los avisos:", err);
      errorCarga = err;
    }
    pintar();
  }

  function activos(ahora) {
    if (!coleccion || !Array.isArray(coleccion.features)) return [];
    return coleccion.features.filter((f) => new Date(f.properties.fin) > ahora);
  }

  function pintar() {
    const ahora = new Date();
    const lista = activos(ahora).sort(
      (a, b) => (ORDEN_NIVEL[b.properties.nivel] ?? 9) - (ORDEN_NIVEL[a.properties.nivel] ?? 9)
    ); // rojos al final para que queden encima
    capa.clearLayers();
    capa.addData(lista);

    const enCanarias = lista.filter((f) => dentroDe(f, VISTAS.canarias)).length;
    nCanarias.hidden = enCanarias === 0;
    nCanarias.textContent = enCanarias;

    const rojos = lista.filter((f) => f.properties.nivel === "rojo").length;
    resumen.textContent = lista.length
      ? `${lista.length} ${lista.length === 1 ? "zona" : "zonas"}${rojos ? ` · ${rojos} en rojo` : ""}`
      : "Sin avisos";
    vacio.hidden = !coleccion || lista.length > 0;

    pintarEstado(ahora);
  }

  function pintarEstado(ahora) {
    estado.className = "estado";
    if (!coleccion) {
      estado.classList.add("estado--error");
      estado.textContent = "No se han podido cargar los avisos. Consulta AEMET directamente.";
      return;
    }
    const actualizado = new Date(coleccion.updated_at);
    const viejo = ahora - actualizado > DATOS_VIEJOS_MS;
    let texto = `Datos comprobados: ${formatoFecha(actualizado)} (${haceCuanto(actualizado, ahora)}).`;
    if (viejo) {
      estado.classList.add("estado--viejo");
      texto = `⚠ ${texto} Tienen más de 1 h: puede que no estén al día.`;
    } else if (errorCarga) {
      estado.classList.add("estado--error");
      texto += " No se ha podido refrescar.";
    }
    estado.textContent = texto;
  }

  // ---------- Capa de nubes ----------

  function estilo(f) {
    const p = f.properties;
    const prevista = new Date(p.inicio) > new Date();
    const color = COLORES[p.nivel] || COLORES.naranja;
    return {
      className: `nube nube--${p.nivel}${prevista ? " nube--prevista" : ""}`,
      color,
      weight: 8,
      opacity: 0.8,
      fillColor: color,
      fillOpacity: 0.7,
      lineJoin: "round",
    };
  }

  function alPintar(f, layer) {
    layer.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      const aqui = activos(new Date()).filter((g) => contiene(g.geometry, e.latlng));
      if (!aqui.length) aqui.push(f);
      aqui.sort(
        (a, b) =>
          (ORDEN_NIVEL[a.properties.nivel] ?? 9) - (ORDEN_NIVEL[b.properties.nivel] ?? 9) ||
          a.properties.inicio.localeCompare(b.properties.inicio)
      );
      L.popup({ maxWidth: 320, autoPanPadding: [16, 96] })
        .setLatLng(e.latlng)
        .setContent(aqui.map(htmlAviso).join(""))
        .openOn(mapa);
    });
  }

  function htmlAviso(f) {
    const p = f.properties;
    const ahora = new Date();
    const inicio = new Date(p.inicio);
    const fin = new Date(p.fin);
    const vigor = inicio <= ahora ? "En vigor" : `Empieza ${haceCuanto(inicio, ahora)}`;
    return `
      <article class="aviso">
        <h3 class="aviso__cabecera">
          <span class="aviso__nivel aviso__nivel--${esc(p.nivel)}">${esc(p.nivel)}</span>${esc(p.fenomeno)}
        </h3>
        <p class="aviso__zona">${esc(p.zona)}</p>
        <p class="aviso__cuando"><span class="aviso__vigor">${vigor}</span><br>
          Del ${esc(formatoFecha(inicio))} al ${esc(formatoFecha(fin))}</p>
        ${p.descripcion ? `<p class="aviso__texto">${esc(p.descripcion)}</p>` : ""}
        ${p.probabilidad ? `<p class="aviso__instrucciones">Probabilidad: ${esc(p.probabilidad)}</p>` : ""}
        ${p.instrucciones ? `<p class="aviso__instrucciones">${esc(p.instrucciones)}</p>` : ""}
      </article>`;
  }

  // ---------- Utilidades ----------

  const FORMATO = new Intl.DateTimeFormat("es-ES", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
  const RELATIVO = new Intl.RelativeTimeFormat("es-ES", { numeric: "auto" });

  function formatoFecha(fecha) {
    return FORMATO.format(fecha);
  }

  function haceCuanto(fecha, ahora) {
    const min = Math.round((fecha - ahora) / 60000);
    if (Math.abs(min) < 60) return RELATIVO.format(min, "minute");
    const horas = Math.round(min / 60);
    if (Math.abs(horas) < 48) return RELATIVO.format(horas, "hour");
    return RELATIVO.format(Math.round(horas / 24), "day");
  }

  function esc(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function poligonos(geom) {
    return geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  }

  function contiene(geom, latlng) {
    const x = latlng.lng;
    const y = latlng.lat;
    return poligonos(geom).some((anillos) => {
      let dentro = false;
      for (const anillo of anillos) {
        for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
          const [xi, yi] = anillo[i];
          const [xj, yj] = anillo[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
        }
      }
      return dentro;
    });
  }

  function dentroDe(f, limites) {
    const [lon, lat] = poligonos(f.geometry)[0]?.[0]?.[0] || [];
    return lat !== undefined && limites.contains([lat, lon]);
  }

  cargar();
  setInterval(cargar, RECARGA_MS);
  setInterval(pintar, REPINTADO_MS);
})();
