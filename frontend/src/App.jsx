import React, { useEffect, useState } from "react";
import Vehicles from "./Vehicles.jsx";
import Containers from "./Containers.jsx";
import Products from "./Products.jsx";
import Loads from "./Loads.jsx";
import Optimizer from "./Optimizer.jsx";
import DashboardHome from "./DashboardHome.jsx";
import "./styles.css";

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : "Los datos ingresados no son válidos";

        throw new Error(detail);
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
            headers: {
              Authorization: `Bearer ${token}`,
            },
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
      <main className="login-page">
        <section className="login-card">
          <div className="login-brand">
            <span>🚛</span>
            <div>
              <h1>GerBar</h1>
              <p>Load Planner</p>
            </div>
          </div>

          <div className="login-heading">
            <h2>Iniciar sesión</h2>
            <p>Ingresa tus datos para acceder al sistema.</p>
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
              {loading ? "Ingresando..." : "Ingresar"}
            </button>

            {message && <p className="error-message">{message}</p>}
          </form>

          <small className="login-footer">
            GerBar Load Planner · Inmove
          </small>
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
    optimizer: "Optimizador de carga",
    reports: "Reportes",
  };

  return (
    <main className="dashboard">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-icon">🚛</span>
          <div>
            <strong>GerBar</strong>
            <small>Load Planner</small>
          </div>
        </div>

        <nav>
          {[
            ["dashboard", "🏠 Dashboard"],
            ["vehicles", "🚛 Vehículos"],
            ["containers", "📦 Contenedores"],
            ["products", "📋 Productos"],
            ["loads", "🧾 Cargas"],
            ["optimizer", "⚙️ Optimizador"],
          ].map(([page, label]) => (
            <button
              key={page}
              className={activePage === page ? "nav-active" : ""}
              onClick={() => setActivePage(page)}
            >
              {label}
            </button>
          ))}

          <button disabled>📄 Reportes</button>
        </nav>
      </aside>

      <section className="dashboard-content">
        <header className="topbar">
          <div>
            <h1>{pageTitles[activePage]}</h1>
            <p>GerBar Load Planner</p>
          </div>

          <button className="logout-button" onClick={logout}>
            Cerrar sesión
          </button>
        </header>

        {activePage === "dashboard" && (
          <DashboardHome
            token={token}
            counts={counts}
            onNavigate={setActivePage}
          />
        )}

        {activePage === "vehicles" && (
          <Vehicles
            token={token}
            onCountChange={(total) =>
              setCounts((current) => ({
                ...current,
                vehicles: total,
              }))
            }
          />
        )}

        {activePage === "containers" && (
          <Containers
            token={token}
            onCountChange={(total) =>
              setCounts((current) => ({
                ...current,
                containers: total,
              }))
            }
          />
        )}

        {activePage === "products" && (
          <Products
            token={token}
            onCountChange={(total) =>
              setCounts((current) => ({
                ...current,
                products: total,
              }))
            }
          />
        )}

        {activePage === "loads" && (
          <Loads
            token={token}
            onCountChange={(total) =>
              setCounts((current) => ({
                ...current,
                loads: total,
              }))
            }
          />
        )}

        {activePage === "optimizer" && (
          <Optimizer token={token} />
        )}
      </section>
    </main>
  );
}
