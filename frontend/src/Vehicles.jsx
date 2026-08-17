import React, { useEffect, useMemo, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

const initialForm = {
  name: "",
  plate: "",
  vehicle_type: "truck",
  internal_length_m: "",
  internal_width_m: "",
  internal_height_m: "",
  tare_weight_kg: "",
  max_gross_weight_kg: "",
  max_payload_kg: "",
};

export default function Vehicles({ token, onCountChange }) {
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const calculatedPayload = useMemo(() => {
    const tare = Number(form.tare_weight_kg || 0);
    const gross = Number(form.max_gross_weight_kg || 0);

    if (tare >= 0 && gross > 0 && gross >= tare) {
      return gross - tare;
    }

    return 0;
  }, [form.tare_weight_kg, form.max_gross_weight_kg]);

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
      onCountChange?.(data.length);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadVehicles();
  }, [token]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => {
      const next = {
        ...current,
        [name]: value,
      };

      if (name === "tare_weight_kg" || name === "max_gross_weight_kg") {
        const tare = Number(
          name === "tare_weight_kg" ? value : next.tare_weight_kg || 0
        );
        const gross = Number(
          name === "max_gross_weight_kg"
            ? value
            : next.max_gross_weight_kg || 0
        );

        next.max_payload_kg =
          tare >= 0 && gross > 0 && gross >= tare
            ? String(gross - tare)
            : "";
      }

      return next;
    });
  }

  function startEditing(vehicle) {
    setEditingId(vehicle.id);
    setMessage("");
    setForm({
      name: vehicle.name || "",
      plate: vehicle.plate || "",
      vehicle_type: vehicle.vehicle_type || "truck",
      internal_length_m: String(vehicle.internal_length_m ?? ""),
      internal_width_m: String(vehicle.internal_width_m ?? ""),
      internal_height_m: String(vehicle.internal_height_m ?? ""),
      tare_weight_kg: String(vehicle.tare_weight_kg ?? 0),
      max_gross_weight_kg: String(vehicle.max_gross_weight_kg ?? 0),
      max_payload_kg: String(vehicle.max_payload_kg ?? 0),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(initialForm);
    setMessage("");
  }

  async function updateVehicle(vehicleId, payload) {
    let response = await fetch(`${API_URL}/vehicles/${vehicleId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 405) {
      response = await fetch(`${API_URL}/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    }

    return response;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const tareWeight = Number(form.tare_weight_kg);
    const maxGrossWeight = Number(form.max_gross_weight_kg);
    const maxPayload = Number(form.max_payload_kg);

    if (tareWeight < 0) {
      setMessage("La tara no puede ser negativa.");
      setLoading(false);
      return;
    }

    if (maxGrossWeight <= 0) {
      setMessage("Ingresá el peso bruto máximo.");
      setLoading(false);
      return;
    }

    if (maxGrossWeight < tareWeight) {
      setMessage("El peso bruto máximo no puede ser menor que la tara.");
      setLoading(false);
      return;
    }

    const payload = {
      ...form,
      internal_length_m: Number(form.internal_length_m),
      internal_width_m: Number(form.internal_width_m),
      internal_height_m: Number(form.internal_height_m),
      tare_weight_kg: tareWeight,
      max_gross_weight_kg: maxGrossWeight,
      max_payload_kg: maxPayload,
    };

    try {
      const response = editingId
        ? await updateVehicle(editingId, payload)
        : await fetch(`${API_URL}/vehicles`, {
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
      setEditingId(null);
      setMessage(
        editingId
          ? "Vehículo actualizado correctamente."
          : "Vehículo registrado correctamente."
      );
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
          <h2>{editingId ? "Editar vehículo" : "Nuevo vehículo"}</h2>

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

          <label htmlFor="tare_weight_kg">Tara / peso propio (kg)</label>
          <input
            id="tare_weight_kg"
            name="tare_weight_kg"
            type="number"
            step="0.01"
            min="0"
            value={form.tare_weight_kg}
            onChange={handleChange}
            placeholder="Ejemplo: 8500"
            required
          />

          <label htmlFor="max_gross_weight_kg">
            Peso bruto máximo (kg)
          </label>
          <input
            id="max_gross_weight_kg"
            name="max_gross_weight_kg"
            type="number"
            step="0.01"
            min="0.01"
            value={form.max_gross_weight_kg}
            onChange={handleChange}
            placeholder="Ejemplo: 40000"
            required
          />

          <label htmlFor="max_payload_kg">Carga útil máxima (kg)</label>
          <input
            id="max_payload_kg"
            name="max_payload_kg"
            type="number"
            step="0.01"
            min="0"
            value={form.max_payload_kg}
            readOnly
          />

          <small style={{ display: "block", marginTop: -6, marginBottom: 10 }}>
            Cálculo automático: peso bruto máximo − tara
            {calculatedPayload > 0
              ? ` = ${calculatedPayload.toLocaleString()} kg`
              : ""}
          </small>

          <button type="submit" disabled={loading}>
            {loading
              ? "Guardando..."
              : editingId
                ? "Guardar cambios"
                : "Registrar vehículo"}
          </button>

          {editingId && (
            <button
              type="button"
              className="secondary-action"
              onClick={cancelEditing}
              disabled={loading}
              style={{ marginTop: 8 }}
            >
              Cancelar edición
            </button>
          )}

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
                    <th>Tara</th>
                    <th>Peso bruto máx.</th>
                    <th>Carga útil</th>
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
                        {Number(vehicle.tare_weight_kg || 0).toLocaleString()} kg
                      </td>
                      <td>
                        {Number(
                          vehicle.max_gross_weight_kg || 0
                        ).toLocaleString()}{" "}
                        kg
                      </td>
                      <td>
                        {Number(vehicle.max_payload_kg || 0).toLocaleString()} kg
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="edit-button"
                            onClick={() => startEditing(vehicle)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="delete-button"
                            onClick={() => deleteVehicle(vehicle.id)}
                          >
                            Eliminar
                          </button>
                        </div>
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
