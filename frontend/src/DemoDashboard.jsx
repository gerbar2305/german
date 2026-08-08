import React from "react";
import GerBarLogo from "./branding/GerBarLogo.jsx";

function DemoMetric({ icon, label, value, detail, onClick }) {
  const content = (
    <>
      <div className="demo-metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </>
  );

  return onClick ? (
    <button type="button" className="demo-metric-card" onClick={onClick}>
      {content}
    </button>
  ) : (
    <article className="demo-metric-card">{content}</article>
  );
}

export default function DemoDashboard({ counts, onNavigate }) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <section className="demo-dashboard">
      <div className="demo-hero">
        <div className="demo-hero-content">
          <span className="demo-badge">DEMO EDITION 1.0 · INMOVE</span>
          <h2>{greeting}, Germán</h2>
          <p>
            Planificación inteligente de cargas, balance de peso y simulación 3D
            desde un único centro de control.
          </p>

          <div className="demo-hero-actions">
            <button type="button" onClick={() => onNavigate("optimizer")}>
              🧠 Nueva optimización IA
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => onNavigate("loads")}
            >
              🧾 Ver órdenes de carga
            </button>
          </div>
        </div>

        <div className="demo-hero-brand">
          <GerBarLogo />
          <div className="demo-live-status">
            <span />
            Sistema disponible para demostración
          </div>
        </div>
      </div>

      <div className="demo-metric-grid">
        <DemoMetric
          icon="🚛"
          label="Vehículos"
          value={counts.vehicles}
          detail="Unidades registradas"
          onClick={() => onNavigate("vehicles")}
        />
        <DemoMetric
          icon="📦"
          label="Contenedores"
          value={counts.containers}
          detail="Capacidades disponibles"
          onClick={() => onNavigate("containers")}
        />
        <DemoMetric
          icon="📋"
          label="Productos"
          value={counts.products}
          detail="Catálogo logístico"
          onClick={() => onNavigate("products")}
        />
        <DemoMetric
          icon="🧾"
          label="Planes de carga"
          value={counts.loads}
          detail="Órdenes creadas"
          onClick={() => onNavigate("loads")}
        />
      </div>

      <div className="demo-showcase-grid">
        <article className="demo-showcase-card demo-ai-card">
          <div className="demo-card-heading">
            <div>
              <span>OPTIMIZACIÓN INTELIGENTE</span>
              <h3>La IA compara múltiples estrategias</h3>
            </div>
            <div className="demo-score">96</div>
          </div>

          <div className="demo-strategy-list">
            <div><span>Compacta</span><b>Completada</b></div>
            <div><span>Balanceada</span><b>Completada</b></div>
            <div><span>Pesados primero</span><b>Completada</b></div>
            <div><span>Apilado eficiente</span><b>Seleccionada</b></div>
          </div>

          <button type="button" onClick={() => onNavigate("optimizer")}>
            Abrir optimizador
          </button>
        </article>

        <article className="demo-showcase-card">
          <div className="demo-card-heading">
            <div>
              <span>CALIDAD DEL PLAN</span>
              <h3>Indicadores en tiempo real</h3>
            </div>
          </div>

          {[
            ["Volumen", 91],
            ["Peso", 84],
            ["Estabilidad", 94],
            ["Centro de gravedad", 95],
          ].map(([label, value]) => (
            <div className="demo-quality-row" key={label}>
              <div>
                <span>{label}</span>
                <strong>{value}%</strong>
              </div>
              <div className="demo-progress">
                <span style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
        </article>

        <article className="demo-showcase-card demo-feature-card">
          <span>CAPACIDADES DESTACADAS</span>
          <h3>Preparado para una demo ejecutiva</h3>
          <div className="demo-feature-list">
            <div>✓ Visor 3D profesional</div>
            <div>✓ Arrastre y rotación manual</div>
            <div>✓ Balance y centro de gravedad</div>
            <div>✓ Guardado de planes</div>
            <div>✓ Informe PDF</div>
            <div>✓ Comparación de estrategias</div>
          </div>
        </article>
      </div>
    </section>
  );
}
