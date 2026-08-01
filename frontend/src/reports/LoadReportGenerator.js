function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value, decimals = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(decimals) : "0";
}

function getCapacityName(capacity, unitType) {
  return (
    capacity?.name ||
    capacity?.code ||
    capacity?.plate ||
    `${unitType === "vehicle" ? "Vehículo" : "Contenedor"} ${capacity?.id ?? ""}`
  );
}

function groupProducts(placedItems = []) {
  const grouped = new Map();

  placedItems.forEach((item) => {
    const product = item?.product || {};
    const key = String(product.id ?? product.name ?? "producto");

    if (!grouped.has(key)) {
      grouped.set(key, {
        name: product.name || "Producto",
        quantity: 0,
        unitWeight: Number(product.weight_kg || item.weight_kg || 0),
        unitVolume:
          Number(item.length || 0) *
          Number(item.width || 0) *
          Number(item.height || product.height_m || 0),
      });
    }

    grouped.get(key).quantity += 1;
  });

  return Array.from(grouped.values());
}

export function generateLoadReport({
  client,
  project,
  unitType,
  capacity,
  placedItems = [],
  rejectedItems = [],
  viewerImage = "",
  stats,
  weightBalance,
}) {
  const reportWindow = window.open("", "_blank", "width=1100,height=850");

  if (!reportWindow) {
    window.alert(
      "El navegador bloqueó la ventana del informe. Habilita las ventanas emergentes para localhost."
    );
    return;
  }

  const groupedProducts = groupProducts(placedItems);
  const date = new Intl.DateTimeFormat("es-UY", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  const productRows = groupedProducts
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td class="number">${item.quantity}</td>
          <td class="number">${formatNumber(item.unitWeight, 0)} kg</td>
          <td class="number">${formatNumber(item.unitWeight * item.quantity, 0)} kg</td>
          <td class="number">${formatNumber(item.unitVolume * item.quantity, 2)} m³</td>
        </tr>`
    )
    .join("");

  const rejectedRows =
    rejectedItems.length > 0
      ? rejectedItems
          .map(
            (item, index) => `
              <tr>
                <td>${escapeHtml(item?.product?.name || "Producto")}</td>
                <td>${escapeHtml(item?.unit ?? index + 1)}</td>
                <td>${escapeHtml(item?.reason || "Sin espacio disponible")}</td>
              </tr>`
          )
          .join("")
      : `<tr><td colspan="3">No hubo productos rechazados.</td></tr>`;

  const warnings =
    weightBalance?.warnings?.length > 0
      ? `<ul>${weightBalance.warnings
          .map((warning) => `<li>${escapeHtml(warning)}</li>`)
          .join("")}</ul>`
      : `<p class="ok">✓ Distribución equilibrada.</p>`;

  const imageSection = viewerImage
    ? `<section class="image-section">
         <h2>Vista 3D del plan de carga</h2>
         <img src="${viewerImage}" alt="Vista 3D de la carga" />
       </section>`
    : `<section><h2>Vista 3D</h2><p>No fue posible capturar la imagen del visor.</p></section>`;

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Informe GerBar - ${escapeHtml(project)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #172033;
      background: #fff;
      font-size: 12px;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      padding-bottom: 16px;
      border-bottom: 3px solid #1d4ed8;
    }
    .brand h1 { margin: 0; font-size: 25px; color: #0f172a; }
    .brand p { margin: 4px 0 0; color: #64748b; }
    .meta { text-align: right; line-height: 1.6; }
    h2 { margin: 20px 0 10px; font-size: 16px; color: #0f172a; }
    .cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 16px;
    }
    .card {
      padding: 12px;
      border: 1px solid #dbe3ee;
      border-radius: 8px;
      background: #f8fafc;
    }
    .card span { display: block; color: #64748b; font-size: 10px; }
    .card strong { display: block; margin-top: 5px; font-size: 16px; }
    .two-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .panel {
      padding: 12px;
      border: 1px solid #dbe3ee;
      border-radius: 8px;
      background: #fff;
    }
    .panel p { margin: 5px 0; }
    .image-section img {
      display: block;
      width: 100%;
      max-height: 390px;
      object-fit: contain;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #eef2f6;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    th, td {
      padding: 8px;
      border: 1px solid #dbe3ee;
      text-align: left;
      vertical-align: top;
    }
    th { background: #eff6ff; color: #1e3a8a; }
    .number { text-align: right; }
    .ok { color: #15803d; font-weight: 700; }
    .warning { color: #b45309; }
    footer {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #dbe3ee;
      color: #64748b;
      text-align: center;
      font-size: 10px;
    }
    .print-actions {
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 10;
      display: flex;
      gap: 8px;
    }
    .print-actions button {
      padding: 10px 14px;
      border: 0;
      border-radius: 7px;
      background: #1d4ed8;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    }
    @media print {
      .print-actions { display: none; }
      section, .panel, table { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <button onclick="window.print()">Guardar como PDF / Imprimir</button>
  </div>

  <header>
    <div class="brand">
      <h1>🚛 GerBar Load Planner</h1>
      <p>Informe profesional de planificación de carga</p>
    </div>
    <div class="meta">
      <strong>Cliente:</strong> ${escapeHtml(client)}<br />
      <strong>Proyecto:</strong> ${escapeHtml(project)}<br />
      <strong>Fecha:</strong> ${escapeHtml(date)}
    </div>
  </header>

  <section>
    <h2>Unidad seleccionada</h2>
    <div class="panel">
      <p><strong>Tipo:</strong> ${unitType === "vehicle" ? "Vehículo" : "Contenedor"}</p>
      <p><strong>Unidad:</strong> ${escapeHtml(getCapacityName(capacity, unitType))}</p>
      <p><strong>Dimensiones internas:</strong>
        ${formatNumber(capacity?.internal_length_m, 2)} m ×
        ${formatNumber(capacity?.internal_width_m, 2)} m ×
        ${formatNumber(capacity?.internal_height_m, 2)} m
      </p>
    </div>
  </section>

  <div class="cards">
    <div class="card"><span>PRODUCTOS COLOCADOS</span><strong>${placedItems.length}</strong></div>
    <div class="card"><span>PESO DE LA CARGA</span><strong>${formatNumber(stats?.usedWeight, 0)} kg</strong></div>
    <div class="card"><span>TARA / PESO PROPIO</span><strong>${formatNumber(stats?.tareWeight, 0)} kg</strong></div>
    <div class="card"><span>PESO BRUTO TOTAL</span><strong>${formatNumber(stats?.grossWeight, 0)} kg</strong></div>
    <div class="card"><span>VOLUMEN UTILIZADO</span><strong>${formatNumber(stats?.volumePercentage, 1)}%</strong></div>
    <div class="card"><span>PESO DE CARGA UTILIZADO</span><strong>${stats?.maximumWeight ? `${formatNumber(stats?.weightPercentage, 1)}%` : "Sin límite"}</strong></div>
  </div>

  ${imageSection}

  <section>
    <h2>Balance y centro de gravedad</h2>
    <div class="two-columns">
      <div class="panel">
        <p><strong>Centro X:</strong> ${formatNumber(weightBalance?.center?.x, 2)} m</p>
        <p><strong>Centro Y:</strong> ${formatNumber(weightBalance?.center?.y, 2)} m</p>
        <p><strong>Centro Z:</strong> ${formatNumber(weightBalance?.center?.z, 2)} m</p>
      </div>
      <div class="panel">
        <p><strong>Frente / Fondo:</strong> ${formatNumber(weightBalance?.distribution?.front, 1)}% / ${formatNumber(weightBalance?.distribution?.back, 1)}%</p>
        <p><strong>Izquierda / Derecha:</strong> ${formatNumber(weightBalance?.distribution?.left, 1)}% / ${formatNumber(weightBalance?.distribution?.right, 1)}%</p>
        <div class="warning">${warnings}</div>
      </div>
    </div>
  </section>

  <section>
    <h2>Resumen de productos</h2>
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th class="number">Cantidad</th>
          <th class="number">Peso unitario</th>
          <th class="number">Peso total</th>
          <th class="number">Volumen total</th>
        </tr>
      </thead>
      <tbody>${productRows}</tbody>
    </table>
  </section>

  <section>
    <h2>Productos rechazados</h2>
    <table>
      <thead>
        <tr><th>Producto</th><th>Unidad</th><th>Motivo</th></tr>
      </thead>
      <tbody>${rejectedRows}</tbody>
    </table>
  </section>

  <footer>
    Generado por GerBar Load Planner · INMOVE
  </footer>
</body>
</html>`;

  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
  reportWindow.focus();
}
