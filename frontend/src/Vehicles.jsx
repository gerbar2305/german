import React, { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000/api/v1";

const initialForm = {
  name: "",
  plate: "",
  vehicle_type: "truck",
  internal_length_m: "",
  internal_width_m: "",
  internal_height_m: "",
  max_payload_kg: "",
};

export default function Vehicles({ token, onCountChange }) {
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadVehicles() {
    try {
      const response = await fetch(`${API_URL}/vehicles`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("No fue posible cargar los vehículos");
      }

      const data = await response.json();
      setVehicles(data);
      onCountChange(data.length);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadVehicles();
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
      const response = await fetch(`${API_URL}/vehicles`, {
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
            : "No fue posible registrar el vehículo";

        throw new Error(detail);
      }

      setForm(initialForm);
      setMessage("Vehículo registrado correctamente.");
      await loadVehicles();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteVehicle(vehicleId) {
    const confirmed = window.confirm(
      "¿Seguro que deseas eliminar este vehículo?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/vehicles/${vehicleId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("No fue posible eliminar el vehículo");
      }

      await loadVehicles();
      setMessage("Vehículo eliminado correctamente.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="module-page">
      <div className="module-heading">
        <div>
          <h1>Vehículos</h1>
          <p>Administra los camiones y unidades de transporte.</p>
        </div>
      </div>

      <section className="vehicle-layout">
        <form className="form-card" onSubmit={handleSubmit}>
          <h2>Nuevo vehículo</h2>

          <label htmlFor="name">Nombre o identificación</label>
          <input
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Ejemplo: Camión 01"
            required
          />

          <label htmlFor="plate">Matrícula</label>
          <input
            id="plate"
            name="plate"
            value={form.plate}
            onChange={handleChange}
            placeholder="Ejemplo: ABC 1234"
            required
          />

          <label htmlFor="vehicle_type">Tipo de vehículo</label>
          <select
            id="vehicle_type"
            name="vehicle_type"
            value={form.vehicle_type}
            onChange={handleChange}
          >
            <option value="truck">Camión</option>
            <option value="trailer">Semirremolque</option>
            <option value="van">Furgón</option>
            <option value="pickup">Camioneta</option>
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
            {loading ? "Guardando..." : "Registrar vehículo"}
          </button>

          {message && <p className="form-message">{message}</p>}
        </form>

        <section className="table-card">
          <div className="table-heading">
            <h2>Vehículos registrados</h2>
            <span>{vehicles.length} unidades</span>
          </div>

          {vehicles.length === 0 ? (
            <div className="empty-state">
              <span>🚛</span>
              <h3>No hay vehículos registrados</h3>
              <p>Completa el formulario para registrar la primera unidad.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Matrícula</th>
                    <th>Tipo</th>
                    <th>Dimensiones</th>
                    <th>Carga máxima</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id}>
                      <td>{vehicle.name}</td>
                      <td>{vehicle.plate}</td>
                      <td>{vehicle.vehicle_type}</td>
                      <td>
                        {vehicle.internal_length_m} ×{" "}
                        {vehicle.internal_width_m} ×{" "}
                        {vehicle.internal_height_m} m
                      </td>
                      <td>
                        {vehicle.max_payload_kg.toLocaleString()} kg
                      </td>
                      <td>
                        <button
                          className="delete-button"
                          onClick={() => deleteVehicle(vehicle.id)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}