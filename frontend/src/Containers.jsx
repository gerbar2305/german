import React, { useEffect, useMemo, useState } from "react";

const API_URL = "http://127.0.0.1:8000/api/v1";

const CONTAINER_PRESETS = {
  "20ft": {
    internal_length_m: 5.9,
    internal_width_m: 2.35,
    internal_height_m: 2.39,
    tare_weight_kg: 2200,
    max_gross_weight_kg: 30480,
  },
  "40ft": {
    internal_length_m: 12.03,
    internal_width_m: 2.35,
    internal_height_m: 2.39,
    tare_weight_kg: 3700,
    max_gross_weight_kg: 30480,
  },
  "40ft-high-cube": {
    internal_length_m: 12.03,
    internal_width_m: 2.35,
    internal_height_m: 2.69,
    tare_weight_kg: 3900,
    max_gross_weight_kg: 30480,
  },
  "45ft-high-cube": {
    internal_length_m: 13.55,
    internal_width_m: 2.35,
    internal_height_m: 2.69,
    tare_weight_kg: 4800,
    max_gross_weight_kg: 30480,
  },
  reefer: {
    internal_length_m: 11.58,
    internal_width_m: 2.29,
    internal_height_m: 2.54,
    tare_weight_kg: 4600,
    max_gross_weight_kg: 34000,
  },
  "open-top": {
    internal_length_m: 12.03,
    internal_width_m: 2.35,
    internal_height_m: 2.35,
    tare_weight_kg: 3900,
    max_gross_weight_kg: 30480,
  },
};

function buildInitialForm(type = "40ft") {
  const preset = CONTAINER_PRESETS[type];

  return {
    code: "",
    container_type: type,
    internal_length_m: String(preset.internal_length_m),
    internal_width_m: String(preset.internal_width_m),
    internal_height_m: String(preset.internal_height_m),
    tare_weight_kg: String(preset.tare_weight_kg),
    max_gross_weight_kg: String(preset.max_gross_weight_kg),
  };
}

function formatKg(value) {
  return `${Number(value || 0).toLocaleString("es-UY")} kg`;
}

export default function Containers({ token, onCountChange }) {
  const [containers, setContainers] = useState([]);
  const [form, setForm] = useState(buildInitialForm());
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const calculatedPayload = useMemo(() => {
    const gross = Number(form.max_gross_weight_kg || 0);
    const tare = Number(form.tare_weight_kg || 0);

    return Math.max(0, gross - tare);
  }, [form.max_gross_weight_kg, form.tare_weight_kg]);

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
      onCountChange?.(data.length);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadContainers();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === "container_type") {
      const preset = CONTAINER_PRESETS[value];

      setForm((current) => ({
        ...current,
        container_type: value,
        internal_length_m: String(preset.internal_length_m),
        internal_width_m: String(preset.internal_width_m),
        internal_height_m: String(preset.internal_height_m),
        tare_weight_kg: String(preset.tare_weight_kg),
        max_gross_weight_kg: String(preset.max_gross_weight_kg),
      }));

      return;
    }

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm(buildInitialForm());
    setEditingId(null);
  }

  function startEditing(container) {
    setEditingId(container.id);
    setMessage("");

    setForm({
      code: container.code || "",
      container_type: container.container_type || "40ft",
      internal_length_m: String(container.internal_length_m ?? ""),
      internal_width_m: String(container.internal_width_m ?? ""),
      internal_height_m: String(container.internal_height_m ?? ""),
      tare_weight_kg: String(container.tare_weight_kg ?? 0),
      max_gross_weight_kg: String(
        container.max_gross_weight_kg ??
          Number(container.max_payload_kg || 0) +
            Number(container.tare_weight_kg || 0)
      ),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const tareWeight = Number(form.tare_weight_kg);
    const maxGrossWeight = Number(form.max_gross_weight_kg);

    if (maxGrossWeight <= tareWeight) {
      setMessage(
        "El peso bruto máximo debe ser mayor que la tara del contenedor."
      );
      setLoading(false);
      return;
    }

    const payload = {
      code: form.code.trim(),
      container_type: form.container_type,
      internal_length_m: Number(form.internal_length_m),
      internal_width_m: Number(form.internal_width_m),
      internal_height_m: Number(form.internal_height_m),
      tare_weight_kg: tareWeight,
      max_gross_weight_kg: maxGrossWeight,
      max_payload_kg: maxGrossWeight - tareWeight,
    };

    try {
      const url = editingId
        ? `${API_URL}/containers/${editingId}`
        : `${API_URL}/containers`;

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
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
            : editingId
              ? "No fue posible actualizar el contenedor"
              : "No fue posible registrar el contenedor";

        throw new Error(detail);
      }

      resetForm();
      setMessage(
        editingId
          ? "Contenedor actualizado correctamente."
          : "Contenedor registrado correctamente."
      );
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

      if (editingId === containerId) {
        resetForm();
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
          <h2>
            {editingId
              ? "Editar contenedor"
              : "Nuevo contenedor"}
          </h2>

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

          <p className="container-preset-note">
            Valores orientativos según el tipo. Confirmá siempre la tara y
            el peso bruto máximo indicados en la placa CSC del contenedor.
          </p>

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

          <div className="container-weight-grid">
            <div>
              <label htmlFor="tare_weight_kg">Tara / peso propio (kg)</label>
              <input
                id="tare_weight_kg"
                name="tare_weight_kg"
                type="number"
                step="1"
                min="0"
                value={form.tare_weight_kg}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label htmlFor="max_gross_weight_kg">
                Peso bruto máximo (kg)
              </label>
              <input
                id="max_gross_weight_kg"
                name="max_gross_weight_kg"
                type="number"
                step="1"
                min="1"
                value={form.max_gross_weight_kg}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="payload-calculation">
            <span>Carga útil máxima calculada</span>
            <strong>{formatKg(calculatedPayload)}</strong>
            <small>Peso bruto máximo − tara</small>
          </div>

          <button type="submit" disabled={loading}>
            {loading
              ? "Guardando..."
              : editingId
                ? "Guardar cambios"
                : "Registrar contenedor"}
          </button>

          {editingId && (
            <button
              type="button"
              className="secondary-form-button"
              onClick={resetForm}
            >
              Cancelar edición
            </button>
          )}

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
                    <th>Tara</th>
                    <th>Peso bruto máx.</th>
                    <th>Carga útil</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {containers.map((container) => {
                    const volume =
                      Number(container.internal_length_m) *
                      Number(container.internal_width_m) *
                      Number(container.internal_height_m);

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
                        <td>{formatKg(container.tare_weight_kg)}</td>
                        <td>
                          {formatKg(container.max_gross_weight_kg)}
                        </td>
                        <td>{formatKg(container.max_payload_kg)}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="edit-button"
                              onClick={() => startEditing(container)}
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              className="delete-button"
                              onClick={() =>
                                deleteContainer(container.id)
                              }
                            >
                              Eliminar
                            </button>
                          </div>
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
