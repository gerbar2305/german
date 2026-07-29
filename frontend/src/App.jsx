import React, { useEffect, useState } from "react";
import Vehicles from "./Vehicles.jsx";
import Containers from "./Containers.jsx";
import Products from "./Products.jsx";
import Loads from "./Loads.jsx";
import Optimizer from "./Optimizer.jsx";
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
    if (!token) {
      return;
    }

    const modules = [
      ["vehicles", "vehicles"],
      ["containers", "containers"],
      ["products", "products"],
      ["loads", "loads"],
    ];

    const newCounts = { ...counts };

    for (const [key, endpoint] of modules) {
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
    }

    setCounts(newCounts);
  }

  useEffect(() => {
    loadCounts();
  }, [token]);

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
          <button
            className={activePage === "dashboard" ? "nav-active" : ""}
            onClick={() => setActivePage("dashboard")}
          >
            Dashboard
          </button>

          <button
            className={activePage === "vehicles" ? "nav-active" : ""}
            onClick={() => setActivePage("vehicles")}
          >
            Vehículos
          </button>

          <button
  className={activePage === "containers" ? "nav-active" : ""}
  onClick={() => setActivePage("containers")}
>
  Contenedores
</button>
          <button
  className={activePage === "products" ? "nav-active" : ""}
  onClick={() => setActivePage("products")}
>
  Productos
</button>
          <button
  className={activePage === "loads" ? "nav-active" : ""}
  onClick={() => setActivePage("loads")}
>
  Cargas
</button>
          <button
  className={activePage === "optimizer" ? "nav-active" : ""}
  onClick={() => setActivePage("optimizer")}
>
  Optimizador
  </button>
          <button disabled>Reportes</button>
        </nav>
      </aside>

      <section className="dashboard-content">
        <header className="topbar">
          <div>
            <h1>
  {activePage === "dashboard" && "Panel principal"}
  {activePage === "vehicles" && "Gestión de vehículos"}
  {activePage === "containers" && "Gestión de contenedores"}
  {activePage === "products" && "Gestión de productos"}
  {activePage === "loads" && "Gestión de cargas"}
  {activePage === "optimizer" && "Optimizador de carga"}
  {activePage === "reports" && "Reportes"}
</h1>        

            <p>GerBar Load Planner</p>
          </div>

          <button className="logout-button" onClick={logout}>
            Cerrar sesión
          </button>
        </header>

        {activePage === "dashboard" && (
          <>
            <div className="summary-grid">
              <article
                className="summary-card clickable-card"
                onClick={() => setActivePage("vehicles")}
              >
                <span>🚛</span>
                <strong>{counts.vehicles}</strong>
                <p>Vehículos</p>
              </article>

              <article className="summary-card">
                <span>📦</span>
                <strong>{counts.containers}</strong>
                <p>Contenedores</p>
              </article>

              <article className="summary-card">
                <span>📋</span>
                <strong>{counts.products}</strong>
                <p>Productos</p>
              </article>

              <article
  className="summary-card clickable-card"
  onClick={() => setActivePage("loads")}
>
  <span>⚙️</span>
  <strong>{counts.loads}</strong>
  <p>Cargas activas</p>
</article>
            </div>

            <section className="welcome-card">
              <h2>Sistema conectado correctamente</h2>

              <p>
                Ya puedes registrar vehículos y consultar los datos guardados
                en la base de datos.
              </p>

              <button
                className="primary-action"
                onClick={() => setActivePage("vehicles")}
              >
                Registrar primer vehículo
              </button>
            </section>
          </>
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