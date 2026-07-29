import React, { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000/api/v1";

const initialForm = {
  code: "",
  container_type: "40ft",
  internal_length_m: "",
  internal_width_m: "",
  internal_height_m: "",
  max_payload_kg: "",
};

export default function Containers({ token, onCountChange }) {
  const [containers, setContainers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadContainers() {
    try {
      const response = await fetch(`${API_URL}/containers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("No fue posible cargar los contenedores");
      }

      const data = await response.json();
      setContainers(data);
      onCountChange(data.length);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadContainers();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const payload = {
      ...form,
      internal_length_m: Number(form.internal_length_m),
      internal_width_m: Number(form.internal_width_m),
      internal_height_m: Number(form.internal_height_m),
      max_payload_kg: Number(form.max_payload_kg),
    };

    try {
      const response = await fetch(`${API_URL}/containers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : "No fue posible registrar el contenedor";

        throw new Error(detail);
      }

      setForm(initialForm);
      setMessage("Contenedor registrado correctamente.");
      await loadContainers();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteContainer(containerId) {
    const confirmed = window.confirm(
      "¿Seguro que deseas eliminar este contenedor?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/containers/${containerId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("No fue posible eliminar el contenedor");
      }

      await loadContainers();
      setMessage("Contenedor eliminado correctamente.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="module-page">
      <section className="vehicle-layout">
        <form className="form-card" onSubmit={handleSubmit}>
          <h2>Nuevo contenedor</h2>

          <label htmlFor="code">Código o identificación</label>
          <input
            id="code"
            name="code"
            value={form.code}
            onChange={handleChange}
            placeholder="Ejemplo: CONT-001"
            required
          />

          <label htmlFor="container_type">Tipo de contenedor</label>
          <select
            id="container_type"
            name="container_type"
            value={form.container_type}
            onChange={handleChange}
          >
            <option value="20ft">20 pies estándar</option>
            <option value="40ft">40 pies estándar</option>
            <option value="40ft-high-cube">40 pies High Cube</option>
            <option value="45ft-high-cube">45 pies High Cube</option>
            <option value="reefer">Refrigerado</option>
            <option value="open-top">Open Top</option>
          </select>

          <div className="dimensions-grid">
            <div>
              <label htmlFor="internal_length_m">Largo interno (m)</label>
              <input
                id="internal_length_m"
                name="internal_length_m"
                type="number"
                step="0.01"
                min="0.01"
                value={form.internal_length_m}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label htmlFor="internal_width_m">Ancho interno (m)</label>
              <input
                id="internal_width_m"
                name="internal_width_m"
                type="number"
                step="0.01"
                min="0.01"
                value={form.internal_width_m}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label htmlFor="internal_height_m">Alto interno (m)</label>
              <input
                id="internal_height_m"
                name="internal_height_m"
                type="number"
                step="0.01"
                min="0.01"
                value={form.internal_height_m}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <label htmlFor="max_payload_kg">Carga máxima (kg)</label>
          <input
            id="max_payload_kg"
            name="max_payload_kg"
            type="number"
            step="0.01"
            min="0.01"
            value={form.max_payload_kg}
            onChange={handleChange}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Registrar contenedor"}
          </button>

          {message && <p className="form-message">{message}</p>}
        </form>

        <section className="table-card">
          <div className="table-heading">
            <h2>Contenedores registrados</h2>
            <span>{containers.length} unidades</span>
          </div>

          {containers.length === 0 ? (
            <div className="empty-state">
              <span>📦</span>
              <h3>No hay contenedores registrados</h3>
              <p>Completa el formulario para registrar el primero.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Tipo</th>
                    <th>Dimensiones</th>
                    <th>Volumen</th>
                    <th>Carga máxima</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {containers.map((container) => {
                    const volume =
                      container.internal_length_m *
                      container.internal_width_m *
                      container.internal_height_m;

                    return (
                      <tr key={container.id}>
                        <td>{container.code}</td>
                        <td>{container.container_type}</td>
                        <td>
                          {container.internal_length_m} ×{" "}
                          {container.internal_width_m} ×{" "}
                          {container.internal_height_m} m
                        </td>
                        <td>{volume.toFixed(2)} m³</td>
                        <td>
                          {container.max_payload_kg.toLocaleString()} kg
                        </td>
                        <td>
                          <button
                            className="delete-button"
                            onClick={() =>
                              deleteContainer(container.id)
                            }
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}