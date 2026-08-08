import React, { useEffect, useState } from "react";
import Vehicles from "./Vehicles.jsx";
import Containers from "./Containers.jsx";
import Products from "./Products.jsx";
import Loads from "./Loads.jsx";
import Optimizer from "./Optimizer.jsx";
import DemoDashboard from "./DemoDashboard.jsx";
import GerBarLogo from "./branding/GerBarLogo.jsx";
import "./styles.css";
import "./demo/DemoExperience.css";

const API_URL = "http://127.0.0.1:8000/api/v1";

export default function App() {
  const [email, setEmail] = useState("admin@gerbar.local");
  const [password, setPassword] = useState("Admin123!");
  const [token, setToken] = useState(
    localStorage.getItem("gerbar_token") || ""
  );

  const [activePage, setActivePage] = useState("dashboard");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [counts, setCounts] = useState({
    vehicles: 0,
    containers: 0,
    products: 0,
    loads: 0,
  });

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Los datos ingresados no son válidos"
        );
      }

      localStorage.setItem("gerbar_token", data.access_token);
      setToken(data.access_token);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCounts() {
    if (!token) return;

    const modules = [
      ["vehicles", "vehicles"],
      ["containers", "containers"],
      ["products", "products"],
      ["loads", "loads"],
    ];

    const newCounts = {
      vehicles: 0,
      containers: 0,
      products: 0,
      loads: 0,
    };

    await Promise.all(
      modules.map(async ([key, endpoint]) => {
        try {
          const response = await fetch(`${API_URL}/${endpoint}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            const data = await response.json();
            newCounts[key] = data.length;
          }
        } catch {
          newCounts[key] = 0;
        }
      })
    );

    setCounts(newCounts);
  }

  useEffect(() => {
    loadCounts();
  }, [token, activePage]);

  function logout() {
    localStorage.removeItem("gerbar_token");
    setToken("");
    setActivePage("dashboard");
  }

  if (!token) {
    return (
      <main className="demo-login-page">
        <div className="demo-login-backdrop" />

        <section className="demo-login-shell">
          <div className="demo-login-story">
            <span className="demo-badge">DEMO EDITION 1.0</span>
            <GerBarLogo />

            <h1>Intelligent Cargo Optimization System</h1>
            <p>
              Optimización por IA, balance de peso, centro de gravedad y
              simulación 3D para operaciones logísticas.
            </p>

            <div className="demo-login-features">
              <span>✓ Optimización multicriterio</span>
              <span>✓ Editor 3D interactivo</span>
              <span>✓ Planes e informes</span>
            </div>
          </div>

          <div className="demo-login-card">
            <div>
              <span>ACCESO DE DEMOSTRACIÓN</span>
              <h2>Ingresar a GerBar</h2>
              <p>Demo ejecutiva preparada para INMOVE.</p>
            </div>

            <form onSubmit={handleLogin}>
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />

              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />

              <button type="submit" disabled={loading}>
                {loading ? "Ingresando..." : "Ingresar a la demo"}
              </button>

              {message && <p className="error-message">{message}</p>}
            </form>

            <small>GerBar Load Planner · INMOVE · Demo interna</small>
          </div>
        </section>
      </main>
    );
  }

  const pageTitles = {
    dashboard: "Centro de control",
    vehicles: "Gestión de vehículos",
    containers: "Gestión de contenedores",
    products: "Gestión de productos",
    loads: "Órdenes de carga",
    optimizer: "Optimizador inteligente",
  };

  return (
    <main className="dashboard demo-app-shell">
      <aside className="sidebar demo-sidebar">
        <GerBarLogo compact />

        <div className="demo-edition-label">
          <span>DEMO EDITION</span>
          <strong>1.0</strong>
        </div>

        <nav>
          {[
            ["dashboard", "⌂ Centro de control"],
            ["vehicles", "🚛 Vehículos"],
            ["containers", "📦 Contenedores"],
            ["products", "📋 Productos"],
            ["loads", "🧾 Cargas"],
            ["optimizer", "🧠 Optimizador IA"],
          ].map(([page, label]) => (
            <button
              key={page}
              className={activePage === page ? "nav-active" : ""}
              onClick={() => setActivePage(page)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="demo-sidebar-footer">
          <span className="demo-live-dot" />
          Sistema operativo
        </div>
      </aside>

      <section className="dashboard-content demo-content">
        <header className="topbar demo-topbar">
          <div>
            <span className="demo-topbar-eyebrow">GERBAR LOAD PLANNER</span>
            <h1>{pageTitles[activePage]}</h1>
            <p>Demo ejecutiva para presentación interna</p>
          </div>

          <div className="demo-user-area">
            <div>
              <strong>Germán Barrios</strong>
              <span>Administrador de demo</span>
            </div>

            <button className="logout-button" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
        </header>

        {activePage === "dashboard" && (
          <DemoDashboard counts={counts} onNavigate={setActivePage} />
        )}

        {activePage === "vehicles" && (
          <Vehicles
            token={token}
            onCountChange={(total) =>
              setCounts((current) => ({ ...current, vehicles: total }))
            }
          />
        )}

        {activePage === "containers" && (
          <Containers
            token={token}
            onCountChange={(total) =>
              setCounts((current) => ({ ...current, containers: total }))
            }
          />
        )}

        {activePage === "products" && (
          <Products
            token={token}
            onCountChange={(total) =>
              setCounts((current) => ({ ...current, products: total }))
            }
          />
        )}

        {activePage === "loads" && (
          <Loads
            token={token}
            onCountChange={(total) =>
              setCounts((current) => ({ ...current, loads: total }))
            }
          />
        )}

        {activePage === "optimizer" && <Optimizer token={token} />}
      </section>
    </main>
  );
}
