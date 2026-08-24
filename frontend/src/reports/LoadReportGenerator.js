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

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getCapacityName(capacity, unitType) {
  return (
    capacity?.name ||
    capacity?.code ||
    capacity?.plate ||
    `${
      unitType === "vehicle" ? "Vehículo" : "Contenedor"
    } ${capacity?.id ?? ""}`
  );
}

/* =========================================================
   PESOS DE LA UNIDAD
   ========================================================= */

function getCapacityTare(capacity, stats, weightBalance) {
  return (
    Number(
      weightBalance?.tareWeight ??
        stats?.tareWeight ??
        capacity?.tare_weight_kg ??
        capacity?.empty_weight_kg ??
        capacity?.own_weight_kg ??
        capacity?.vehicle_weight_kg ??
        capacity?.container_weight_kg ??
        0
    ) || 0
  );
}

function getMaxGrossWeight(capacity, weightBalance) {
  return (
    Number(
      weightBalance?.maxGrossWeight ??
        capacity?.max_gross_weight_kg ??
        capacity?.gross_weight_kg ??
        capacity?.max_gross_kg ??
        0
    ) || 0
  );
}

function getMaxPayload(
  capacity,
  stats,
  weightBalance,
  tareWeight,
  maxGrossWeight
) {
  const declared =
    Number(
      weightBalance?.maxPayload ??
        stats?.maximumWeight ??
        capacity?.max_payload_kg ??
        capacity?.max_weight_kg ??
        capacity?.payload_kg ??
        0
    ) || 0;

  if (declared > 0) {
    return declared;
  }

  if (maxGrossWeight > 0 && maxGrossWeight >= tareWeight) {
    return maxGrossWeight - tareWeight;
  }

  return 0;
}

/* =========================================================
   AGRUPAR PRODUCTOS
   ========================================================= */

function groupProducts(placedItems = []) {
  const grouped = new Map();

  placedItems.forEach((item) => {
    const product = item?.product || {};

    const key = String(
      product.id ??
        product.sku ??
        product.name ??
        "producto"
    );

    if (!grouped.has(key)) {
      grouped.set(key, {
        sku: product.sku || "",
        name: product.name || "Producto",
        quantity: 0,

        unitWeight: Number(
          product.weight_kg ||
            item.weight_kg ||
            0
        ),

        unitVolume:
          Number(
            item.length ||
              product.length_m ||
              0
          ) *
          Number(
            item.width ||
              product.width_m ||
              0
          ) *
          Number(
            item.height ||
              product.height_m ||
              0
          ),
      });
    }

    grouped.get(key).quantity += 1;
  });

  return Array.from(grouped.values());
}

/* =========================================================
   GENERADOR DEL INFORME
   ========================================================= */

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
  logistics = {},
}) {
  const reportWindow = window.open(
    "",
    "_blank",
    "width=1100,height=850"
  );

  if (!reportWindow) {
    window.alert(
      "El navegador bloqueó la ventana del informe. Habilita las ventanas emergentes para GerBar."
    );

    return;
  }

  /* =======================================================
     CÁLCULO DE PESOS
     ======================================================= */

  const cargoWeight =
    Number(
      weightBalance?.totalWeight ??
        stats?.usedWeight ??
        0
    ) || 0;

  const tareWeight = getCapacityTare(
    capacity,
    stats,
    weightBalance
  );

  const maxGrossWeight = getMaxGrossWeight(
    capacity,
    weightBalance
  );

  const maxPayload = getMaxPayload(
    capacity,
    stats,
    weightBalance,
    tareWeight,
    maxGrossWeight
  );

  // Peso bruto real = tara + mercadería
  const grossWeight =
    tareWeight + cargoWeight;

  const payloadRemaining =
    maxPayload > 0
      ? Math.max(
          0,
          maxPayload - cargoWeight
        )
      : 0;

  const grossRemaining =
    maxGrossWeight > 0
      ? Math.max(
          0,
          maxGrossWeight - grossWeight
        )
      : 0;

  const payloadPercentage =
    maxPayload > 0
      ? (cargoWeight / maxPayload) * 100
      : 0;

  const grossPercentage =
    maxGrossWeight > 0
      ? (grossWeight / maxGrossWeight) * 100
      : 0;

  const overweightPayload =
    maxPayload > 0
      ? Math.max(
          0,
          cargoWeight - maxPayload
        )
      : 0;

  const overweightGross =
    maxGrossWeight > 0
      ? Math.max(
          0,
          grossWeight - maxGrossWeight
        )
      : 0;

  /* =======================================================
     ADVERTENCIAS
     ======================================================= */

  const reportWarnings = [
    ...(weightBalance?.warnings || []),
  ];

  if (overweightPayload > 0) {
    reportWarnings.push(
      `La mercadería supera la carga útil máxima por ${formatNumber(
        overweightPayload,
        0
      )} kg.`
    );
  }

  if (overweightGross > 0) {
    reportWarnings.push(
      `El peso bruto actual supera el peso bruto máximo por ${formatNumber(
        overweightGross,
        0
      )} kg.`
    );
  }

  const uniqueWarnings = [
    ...new Set(reportWarnings),
  ];

  /* =======================================================
     PRODUCTOS
     ======================================================= */

  const groupedProducts =
    groupProducts(placedItems);

  const productRows = groupedProducts
    .map(
      (item) => `
        <tr>
          <td>
            ${escapeHtml(
              item.sku || "—"
            )}
          </td>

          <td>
            ${escapeHtml(item.name)}
          </td>

          <td class="number">
            ${item.quantity}
          </td>

          <td class="number">
            ${formatNumber(
              item.unitWeight,
              0
            )} kg
          </td>

          <td class="number">
            ${formatNumber(
              item.unitWeight *
                item.quantity,
              0
            )} kg
          </td>

          <td class="number">
            ${formatNumber(
              item.unitVolume *
                item.quantity,
              2
            )} m³
          </td>
        </tr>
      `
    )
    .join("");

  /* =======================================================
     PRODUCTOS RECHAZADOS
     ======================================================= */

  const rejectedRows =
    rejectedItems.length > 0
      ? rejectedItems
          .map(
            (item, index) => `
              <tr>
                <td>
                  ${escapeHtml(
                    item?.product?.sku ||
                      "—"
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    item?.product?.name ||
                      "Producto"
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    item?.unit ??
                      index + 1
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    item?.reason ||
                      "Sin espacio disponible"
                  )}
                </td>
              </tr>
            `
          )
          .join("")
      : `
        <tr>
          <td colspan="4">
            No hubo productos rechazados.
          </td>
        </tr>
      `;

  /* =======================================================
     ADVERTENCIAS DEL INFORME
     ======================================================= */

  const warnings =
    uniqueWarnings.length > 0
      ? `
        <ul>
          ${uniqueWarnings
            .map(
              (warning) =>
                `<li>${escapeHtml(
                  warning
                )}</li>`
            )
            .join("")}
        </ul>
      `
      : `
        <p class="ok">
          ✓ Distribución y pesos dentro de los parámetros configurados.
        </p>
      `;

  /* =======================================================
     IMAGEN 3D
     ======================================================= */

  const imageSection = viewerImage
    ? `
      <section class="image-section">

        <h2>
          Vista 3D del plan de carga
        </h2>

        <div class="image-frame">

          <img
            src="${viewerImage}"
            alt="Vista 3D de la carga"
          />

        </div>

      </section>
    `
    : `
      <section>

        <h2>Vista 3D</h2>

        <p>
          No fue posible capturar la imagen del visor.
        </p>

      </section>
    `;

  /* =======================================================
     FECHA
     ======================================================= */

  const date =
    new Intl.DateTimeFormat("es-UY", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date());

  /* =======================================================
     HTML DEL INFORME
     ======================================================= */

  const html = `
<!doctype html>

<html lang="es">

<head>

<meta charset="utf-8" />

<title>
Informe GerBar - ${escapeHtml(project)}
</title>

<style>

@page {
  size: A4;
  margin: 12mm;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  color: #172033;

  background: #ffffff;

  font-size: 11px;

  line-height: 1.35;
}

/* =========================
   CABECERA
   ========================= */

header {
  display: flex;

  justify-content:
    space-between;

  gap: 24px;

  padding-bottom: 14px;

  border-bottom:
    3px solid #1d4ed8;
}

.brand h1 {
  margin: 0;

  font-size: 24px;

  color: #0f172a;
}

.brand p {
  margin: 4px 0 0;

  color: #64748b;
}

.meta {
  text-align: right;

  line-height: 1.6;
}

h2 {
  margin:
    18px 0 9px;

  font-size: 15px;

  color: #0f172a;
}

/* =========================
   DATOS LOGÍSTICOS
   ========================= */

.logistics-grid {

  display: grid;

  grid-template-columns:
    repeat(3, 1fr);

  gap: 8px;
}

.logistics-item {

  padding: 9px 10px;

  border:
    1px solid #dbe3ee;

  border-radius: 7px;

  background: #f8fafc;

  min-height: 50px;
}

.logistics-item span,
.card span {

  display: block;

  color: #64748b;

  font-size: 9px;

  font-weight: 700;

  letter-spacing: .04em;
}

.logistics-item strong,
.card strong {

  display: block;

  margin-top: 4px;

  font-size: 13px;

  color: #0f172a;
}

/* =========================
   UNIDAD
   ========================= */

.unit-panel {

  padding: 10px 12px;

  border:
    1px solid #dbe3ee;

  border-radius: 8px;

  background: #ffffff;
}

.unit-panel p {

  margin: 4px 0;
}

/* =========================
   TARJETAS DE PESOS
   ========================= */

.cards {

  display: grid;

  grid-template-columns:
    repeat(3, 1fr);

  gap: 8px;

  margin-top: 14px;
}

.card {

  padding: 10px 11px;

  border:
    1px solid #dbe3ee;

  border-radius: 8px;

  background: #f8fafc;

  min-height: 58px;
}

.card.critical {

  border-color: #ef4444;

  background: #fef2f2;
}

.card.good {

  border-color: #86efac;

  background: #f0fdf4;
}

/* =========================
   ECUACIÓN DE PESO
   ========================= */

.weight-equation {

  margin-top: 10px;

  padding: 10px 12px;

  border-radius: 8px;

  background: #eff6ff;

  border:
    1px solid #bfdbfe;

  text-align: center;

  font-size: 13px;
}

.weight-equation strong {

  color: #1d4ed8;
}

/* =========================
   VISTA 3D
   ========================= */

.image-frame {

  height: 320px;

  overflow: hidden;

  border:
    1px solid #cbd5e1;

  border-radius: 8px;

  background: #eef2f6;

  display: flex;

  align-items: center;

  justify-content: center;
}

.image-frame img {

  display: block;

  width: 100%;

  height: 100%;

  object-fit: cover;

  transform: scale(1.22);

  transform-origin:
    center center;
}

/* =========================
   BALANCE
   ========================= */

.two-columns {

  display: grid;

  grid-template-columns:
    1fr 1fr;

  gap: 12px;
}

.panel {

  padding: 10px 12px;

  border:
    1px solid #dbe3ee;

  border-radius: 8px;
}

.panel p {

  margin: 4px 0;
}

/* =========================
   TABLAS
   ========================= */

table {

  width: 100%;

  border-collapse:
    collapse;

  margin-top: 7px;
}

th,
td {

  padding: 7px;

  border:
    1px solid #dbe3ee;

  text-align: left;

  vertical-align: top;
}

th {

  background: #eff6ff;

  color: #1e3a8a;

  font-size: 10px;
}

.number {

  text-align: right;

  white-space: nowrap;
}

/* =========================
   ADVERTENCIAS
   ========================= */

.ok {

  color: #15803d;

  font-weight: 700;
}

.warning {

  color: #b45309;
}

.warning ul {

  margin:
    6px 0 0 18px;

  padding: 0;
}

/* =========================
   PIE
   ========================= */

footer {

  margin-top: 16px;

  padding-top: 9px;

  border-top:
    1px solid #dbe3ee;

  color: #64748b;

  text-align: center;

  font-size: 9px;
}

/* =========================
   BOTÓN PDF
   ========================= */

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
  font-weight: 700;
  cursor: pointer;
  font-size: 11px;
}

.pdf-button {
  background: #1d4ed8;
  color: white;
}

.print-button {
  background: #334155;
  color: white;
}

.print-actions button:hover {
  opacity: 0.9;
}
/* =========================
   IMPRESIÓN
   ========================= */

@media print {

  .print-actions {
    display: none;
  }

  section,
  .panel,
  table,
  .cards {

    break-inside: avoid;
  }
}

</style>

</head>

<body>

<div class="print-actions">

<button
  class="pdf-button"
  onclick="window.print()"
  title="Selecciona Guardar como PDF en el cuadro de impresión"
>
💾 Guardar PDF
</button>

<button
  class="print-button"
  onclick="window.print()"
  title="Enviar el informe a una impresora"
>
🖨 Imprimir
</button>

</div>

<header>

<div class="brand">

<h1>
🚛 GerBar Load Planner
</h1>

<p>
Informe profesional de planificación de carga
</p>

</div>

<div class="meta">

<strong>Cliente:</strong>
${escapeHtml(client)}

<br />

<strong>Proyecto:</strong>
${escapeHtml(project)}

<br />

<strong>Referencia:</strong>
${escapeHtml(
  logistics.reference || "—"
)}

<br />

<strong>Fecha:</strong>
${escapeHtml(date)}

</div>

</header>

<!-- DATOS LOGÍSTICOS -->

<section>

<h2>Datos logísticos</h2>

<div class="logistics-grid">

<div class="logistics-item">

<span>BOOKING</span>

<strong>
${escapeHtml(
  logistics.bookingNumber || "—"
)}
</strong>

</div>

<div class="logistics-item">

<span>BUQUE</span>

<strong>
${escapeHtml(
  logistics.vesselName || "—"
)}
</strong>

</div>

<div class="logistics-item">

<span>VIAJE</span>

<strong>
${escapeHtml(
  logistics.voyageNumber || "—"
)}
</strong>

</div>

<div class="logistics-item">

<span>PUERTO DE CARGA</span>

<strong>
${escapeHtml(
  logistics.loadingPort || "—"
)}
</strong>

</div>

<div class="logistics-item">

<span>PUERTO DE DESTINO</span>

<strong>
${escapeHtml(
  logistics.destinationPort || "—"
)}
</strong>

</div>

<div class="logistics-item">

<span>FECHA DE CARGA</span>

<strong>
${escapeHtml(
  formatDate(
    logistics.loadingDate
  )
)}
</strong>

</div>

<div class="logistics-item">

<span>FECHA DE ZARPE</span>

<strong>
${escapeHtml(
  formatDate(
    logistics.sailingDate
  )
)}
</strong>

</div>

<div class="logistics-item">

<span>TRANSPORTISTA</span>

<strong>
${escapeHtml(
  logistics.carrierName || "—"
)}
</strong>

</div>

<div class="logistics-item">

<span>OPERADOR</span>

<strong>
${escapeHtml(
  logistics.operatorName || "—"
)}
</strong>

</div>

</div>

</section>

<!-- UNIDAD -->

<section>

<h2>Unidad seleccionada</h2>

<div class="unit-panel">

<p>

<strong>Tipo:</strong>

${
  unitType === "vehicle"
    ? "Vehículo"
    : "Contenedor"
}

</p>

<p>

<strong>Unidad:</strong>

${escapeHtml(
  getCapacityName(
    capacity,
    unitType
  )
)}

</p>

<p>

<strong>
Dimensiones internas:
</strong>

${formatNumber(
  capacity?.internal_length_m,
  2
)} m ×

${formatNumber(
  capacity?.internal_width_m,
  2
)} m ×

${formatNumber(
  capacity?.internal_height_m,
  2
)} m

</p>

</div>

</section>

<!-- PESOS -->

<section>

<h2>
Pesos y utilización
</h2>

<div class="cards">

<div class="card">

<span>
BULTOS COLOCADOS
</span>

<strong>
${placedItems.length}
</strong>

</div>

<div class="card">

<span>
PESO MERCADERÍA
</span>

<strong>
${formatNumber(
  cargoWeight,
  0
)} kg
</strong>

</div>

<div class="card">

<span>
TARA / PESO PROPIO
</span>

<strong>
${formatNumber(
  tareWeight,
  0
)} kg
</strong>

</div>

<div class="card ${
    overweightGross > 0
      ? "critical"
      : "good"
  }">

<span>
PESO BRUTO ACTUAL
</span>

<strong>
${formatNumber(
  grossWeight,
  0
)} kg
</strong>

</div>

<div class="card">

<span>
CARGA ÚTIL MÁXIMA
</span>

<strong>

${
  maxPayload > 0
    ? `${formatNumber(
        maxPayload,
        0
      )} kg`
    : "No definida"
}

</strong>

</div>

<div class="card ${
    overweightPayload > 0
      ? "critical"
      : ""
  }">

<span>
CARGA ÚTIL RESTANTE
</span>

<strong>

${
  maxPayload > 0
    ? `${formatNumber(
        payloadRemaining,
        0
      )} kg`
    : "No definida"
}

</strong>

</div>

<div class="card">

<span>
PESO BRUTO MÁXIMO
</span>

<strong>

${
  maxGrossWeight > 0
    ? `${formatNumber(
        maxGrossWeight,
        0
      )} kg`
    : "No definido"
}

</strong>

</div>

<div class="card">

<span>
USO DE CARGA ÚTIL
</span>

<strong>

${
  maxPayload > 0
    ? `${formatNumber(
        payloadPercentage,
        1
      )}%`
    : "Sin límite"
}

</strong>

</div>

<div class="card">

<span>
USO DE PESO BRUTO
</span>

<strong>

${
  maxGrossWeight > 0
    ? `${formatNumber(
        grossPercentage,
        1
      )}%`
    : "Sin límite"
}

</strong>

</div>

<div class="card">

<span>
MARGEN PESO BRUTO
</span>

<strong>

${
  maxGrossWeight > 0
    ? `${formatNumber(
        grossRemaining,
        0
      )} kg`
    : "No definido"
}

</strong>

</div>

<div class="card">

<span>
VOLUMEN UTILIZADO
</span>

<strong>

${formatNumber(
  stats?.volumePercentage,
  1
)}%

</strong>

</div>

</div>

<div class="weight-equation">

${formatNumber(
  tareWeight,
  0
)} kg de tara

+

${formatNumber(
  cargoWeight,
  0
)} kg de mercadería

=

<strong>

${formatNumber(
  grossWeight,
  0
)} kg de peso bruto actual

</strong>

</div>

</section>

${imageSection}

<!-- BALANCE -->

<section>

<h2>
Balance y centro de gravedad
</h2>

<div class="two-columns">

<div class="panel">

<p>

<strong>
Centro X:
</strong>

${formatNumber(
  weightBalance?.center?.x,
  2
)} m

</p>

<p>

<strong>
Centro Y:
</strong>

${formatNumber(
  weightBalance?.center?.y,
  2
)} m

</p>

<p>

<strong>
Centro Z:
</strong>

${formatNumber(
  weightBalance?.center?.z,
  2
)} m

</p>

</div>

<div class="panel">

<p>

<strong>
Frente / Fondo:
</strong>

${formatNumber(
  weightBalance?.distribution?.front,
  1
)}%

/

${formatNumber(
  weightBalance?.distribution?.back,
  1
)}%

</p>

<p>

<strong>
Izquierda / Derecha:
</strong>

${formatNumber(
  weightBalance?.distribution?.left,
  1
)}%

/

${formatNumber(
  weightBalance?.distribution?.right,
  1
)}%

</p>

<div class="warning">

${warnings}

</div>

</div>

</div>

</section>

<!-- PRODUCTOS -->

<section>

<h2>
Resumen de productos
</h2>

<table>

<thead>

<tr>

<th>SKU</th>

<th>Producto</th>

<th class="number">
Cantidad
</th>

<th class="number">
Peso unitario
</th>

<th class="number">
Peso total
</th>

<th class="number">
Volumen total
</th>

</tr>

</thead>

<tbody>

${productRows}

</tbody>

</table>

</section>

<!-- RECHAZADOS -->

<section>

<h2>
Productos rechazados
</h2>

<table>

<thead>

<tr>

<th>SKU</th>

<th>Producto</th>

<th>Unidad</th>

<th>Motivo</th>

</tr>

</thead>

<tbody>

${rejectedRows}

</tbody>

</table>

</section>

<!-- OBSERVACIONES -->

<section>

<h2>
Observaciones
</h2>

<div class="panel">

${escapeHtml(
  logistics.notes ||
    "Sin observaciones."
)}

</div>

</section>

<footer>

Generado por
GerBar Load Planner · INMOVE

</footer>

</body>

</html>
`;

  /* =======================================================
     ABRIR INFORME
     ======================================================= */

  reportWindow.document.open();

  reportWindow.document.write(
    html
  );

  reportWindow.document.close();

  reportWindow.focus();
}