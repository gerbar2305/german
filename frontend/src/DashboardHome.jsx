import React, { useEffect, useMemo, useState } from "react";

const API_URL = "http://127.0.0.1:8000/api/v1";

const STATUS_LABELS = {
  pending: "Pendiente",
  optimizing: "Optimizando",
  optimized: "Optimizada",
  warning: "Con advertencias",
  error: "Error",
};

function getStatusClass(status) {
  if (status === "optimized") return "control-status success";
  if (status === "warning") return "control-status warning";
  if (status === "error") return "control-status error";
  if (status === "optimizing") return "control-status info";
  return "control-status pending";
}

export default function DashboardHome({
  token,
  counts,
  onNavigate,
}) {
  const [loads, setLoads] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRecentOrders() {
      try {
        const response = await fetch(`${API_URL}/loads`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("No fue posible cargar las órdenes.");
        }

        setLoads(await response.json());
      } catch (requestError) {
        setError(requestError.message);
      }
    }

    loadRecentOrders();
  }, [token]);

  const metrics = useMemo(() => {
    const pending = loads.filter(
      (load) => !load.status || load.status === "pending"
    ).length;

    const optimized = loads.filter(
      (load) =>
        load.status === "optimized" ||
        load.status === "warning"
    ).length;

    const errorCount = loads.filter(
      (load) => load.status === "error"
    ).length;

    const optimizedLoads = loads.filter(
      (load) =>
        load.status === "optimized" ||
        load.status === "warning"
    );

    const optimizedWeight = optimizedLoads.reduce(
      (total, load) =>
        total + Number(load.total_weight_kg || 0),
      0
    );

    const optimizedVolume = optimizedLoads.reduce(
      (total, load) =>
        total + Number(load.total_volume_m3 || 0),
      0
    );

    const utilizationValues = optimizedLoads
      .map((load) => Number(load.volume_utilization_percent || 0))
      .filter((value) => value > 0);

    const averageUtilization =
      utilizationValues.length > 0
        ? utilizationValues.reduce(
            (total, value) => total + value,
            0
          ) / utilizationValues.length
        : 0;

    const latestOptimization = optimizedLoads
      .filter((load) => load.optimized_at)
      .sort(
        (a, b) =>
          new Date(b.optimized_at) -
          new Date(a.optimized_at)
      )[0] || null;

    return {
      pending,
      optimized,
      errorCount,
      optimizedWeight,
      optimizedVolume,
      averageUtilization,
      latestOptimization,
    };
  }, [loads]);

  const recentLoads = loads.slice(0, 6);

  return (
    <div className="control-center">
      <section className="control-hero">
        <div>
          <span className="control-eyebrow">
            OPERACIÓN LOGÍSTICA
          </span>
          <h2>Bienvenido al Centro de Control</h2>
          <p>
            Gestioná órdenes, unidades y optimizaciones desde
            una sola pantalla.
          </p>
        </div>

        <button
          type="button"
          className="control-primary-action"
          onClick={() => onNavigate("loads")}
        >
          + Nueva orden de carga
        </button>
      </section>

      <section className="control-kpi-grid">
        <button
          type="button"
          className="control-kpi-card pending-card"
          onClick={() => onNavigate("loads")}
        >
          <span className="control-kpi-icon">🟡</span>
          <div>
            <small>Órdenes pendientes</small>
            <strong>{metrics.pending}</strong>
          </div>
        </button>

        <button
          type="button"
          className="control-kpi-card success-card"
          onClick={() => onNavigate("loads")}
        >
          <span className="control-kpi-icon">✅</span>
          <div>
            <small>Órdenes optimizadas</small>
            <strong>{metrics.optimized}</strong>
          </div>
        </button>

        <button
          type="button"
          className="control-kpi-card"
          onClick={() => onNavigate("containers")}
        >
          <span className="control-kpi-icon">📦</span>
          <div>
            <small>Contenedores</small>
            <strong>{counts.containers}</strong>
          </div>
        </button>

        <button
          type="button"
          className="control-kpi-card"
          onClick={() => onNavigate("vehicles")}
        >
          <span className="control-kpi-icon">🚛</span>
          <div>
            <small>Vehículos</small>
            <strong>{counts.vehicles}</strong>
          </div>
        </button>

        <button
          type="button"
          className="control-kpi-card"
          onClick={() => onNavigate("products")}
        >
          <span className="control-kpi-icon">📋</span>
          <div>
            <small>Productos</small>
            <strong>{counts.products}</strong>
          </div>
        </button>

        <article className="control-kpi-card static error-card">
          <span className="control-kpi-icon">⚠️</span>
          <div>
            <small>Órdenes con error</small>
            <strong>{metrics.errorCount}</strong>
          </div>
        </article>
      </section>

      <section className="control-main-grid">
        <article className="control-panel control-orders-panel">
          <div className="control-panel-heading">
            <div>
              <h3>Actividad reciente</h3>
              <p>Últimas órdenes registradas</p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate("loads")}
            >
              Ver todas
            </button>
          </div>

          {error && (
            <div className="control-error">{error}</div>
          )}

          {recentLoads.length === 0 ? (
            <div className="control-empty">
              <span>🧾</span>
              <strong>No hay órdenes todavía</strong>
              <p>Creá la primera orden de carga.</p>
            </div>
          ) : (
            <div className="control-orders-list">
              {recentLoads.map((load) => (
                <div
                  key={load.id}
                  className="control-order-row"
                >
                  <div className="control-order-main">
                    <strong>{load.reference}</strong>
                    <span>
                      {load.client_name || "Sin cliente"}
                    </span>
                  </div>

                  <div className="control-order-project">
                    {load.project_name || "Sin proyecto"}
                  </div>

                  <span
                    className={getStatusClass(
                      load.status || "pending"
                    )}
                  >
                    {STATUS_LABELS[load.status] || "Pendiente"}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      onNavigate(
                        load.status === "pending"
                          ? "optimizer"
                          : "loads"
                      )
                    }
                  >
                    {load.status === "pending"
                      ? "Optimizar"
                      : "Ver"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </article>

        <aside className="control-side-column">
          <article className="control-panel">
            <div className="control-panel-heading">
              <div>
                <h3>Resumen optimizado</h3>
                <p>Datos acumulados</p>
              </div>
            </div>

            <div className="control-total-row">
              <span>Peso optimizado</span>
              <strong>
                {metrics.optimizedWeight.toLocaleString("es-UY")} kg
              </strong>
            </div>

            <div className="control-total-row">
              <span>Volumen optimizado</span>
              <strong>
                {metrics.optimizedVolume.toFixed(2)} m³
              </strong>
            </div>

            <div className="control-total-row">
              <span>Utilización promedio</span>
              <strong>
                {metrics.averageUtilization > 0
                  ? `${metrics.averageUtilization.toFixed(1)}%`
                  : "Sin datos"}
              </strong>
            </div>

            <div className="control-total-row">
              <span>Última optimización</span>
              <strong>
                {metrics.latestOptimization?.optimized_at
                  ? new Intl.DateTimeFormat("es-UY", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(
                      new Date(
                        metrics.latestOptimization.optimized_at
                      )
                    )
                  : "Sin datos"}
              </strong>
            </div>

            {metrics.latestOptimization && (
              <div className="control-latest-order">
                <span>Última orden</span>
                <strong>
                  {metrics.latestOptimization.reference}
                </strong>
                <small>
                  {metrics.latestOptimization.client_name ||
                    "Sin cliente"}
                </small>
              </div>
            )}
          </article>

          <article className="control-panel">
            <div className="control-panel-heading">
              <div>
                <h3>Acciones rápidas</h3>
                <p>Atajos frecuentes</p>
              </div>
            </div>

            <div className="control-quick-actions">
              <button onClick={() => onNavigate("loads")}>
                🧾 Nueva orden
              </button>
              <button onClick={() => onNavigate("optimizer")}>
                ⚙️ Optimizar
              </button>
              <button onClick={() => onNavigate("products")}>
                📋 Nuevo producto
              </button>
              <button onClick={() => onNavigate("containers")}>
                📦 Nuevo contenedor
              </button>
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
