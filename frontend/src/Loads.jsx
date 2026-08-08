import React, { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

const EMPTY_FORM = {
  reference: "",
  client_name: "",
  project_name: "",
  vessel_name: "",
  voyage_number: "",
  booking_number: "",
  loading_port: "",
  destination_port: "",
  loading_date: "",
  sailing_date: "",
  carrier_name: "",
  operator_name: "",
  notes: "",
  vehicle_id: "",
  container_id: "",
};

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function statusText(status) {
  if (status === "optimized") return "Optimizada";
  if (status === "warning") return "Con advertencias";
  if (status === "error") return "Error";
  return "Pendiente";
}

export default function Loads({ token, onCountChange, onOpenOptimizer }) {
  const [loads, setLoads] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [containers, setContainers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  async function fetchList(endpoint) {
    const response = await fetch(`${API_URL}/${endpoint}`, {
      headers: authHeaders,
    });

    if (!response.ok) {
      throw new Error(`No se pudo cargar ${endpoint}`);
    }

    return response.json();
  }

  async function loadData() {
    try {
      const [loadsData, vehiclesData, containersData, productsData] =
        await Promise.all([
          fetchList("loads"),
          fetchList("vehicles"),
          fetchList("containers"),
          fetchList("products"),
        ]);

      setLoads(loadsData);
      setVehicles(vehiclesData);
      setContainers(containersData);
      setProducts(productsData);
      onCountChange?.(loadsData.length);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleFormChange(event) {
    const { name, value } = event.target;

    if (name === "vehicle_id" && value) {
      setForm((current) => ({
        ...current,
        vehicle_id: value,
        container_id: "",
      }));
      return;
    }

    if (name === "container_id" && value) {
      setForm((current) => ({
        ...current,
        container_id: value,
        vehicle_id: "",
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function addProduct() {
    const product = products.find(
      (item) => item.id === Number(selectedProductId)
    );
    const numericQuantity = Number(quantity);

    if (!product) {
      setMessage("Selecciona un producto.");
      return;
    }

    if (!Number.isInteger(numericQuantity) || numericQuantity < 1) {
      setMessage("La cantidad debe ser mayor que cero.");
      return;
    }

    setItems((current) => {
      const existing = current.find(
        (item) => item.product_id === product.id
      );

      if (existing) {
        return current.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + numericQuantity,
              }
            : item
        );
      }

      return [
        ...current,
        {
          product_id: product.id,
          quantity: numericQuantity,
          product,
        },
      ];
    });

    setSelectedProductId("");
    setQuantity(1);
    setMessage("");
  }

  function removeItem(productId) {
    setItems((current) =>
      current.filter((item) => item.product_id !== productId)
    );
  }

  const totals = useMemo(
    () =>
      items.reduce(
        (result, item) => {
          const product = item.product;
          if (!product) return result;

          const unitVolume =
            Number(product.length_m || 0) *
            Number(product.width_m || 0) *
            Number(product.height_m || 0);

          result.weight +=
            Number(product.weight_kg || 0) * item.quantity;
          result.volume += unitVolume * item.quantity;
          result.units += item.quantity;
          return result;
        },
        { weight: 0, volume: 0, units: 0 }
      ),
    [items]
  );

  const selectedCapacity = useMemo(() => {
    if (form.container_id) {
      return containers.find(
        (item) => item.id === Number(form.container_id)
      );
    }

    if (form.vehicle_id) {
      return vehicles.find(
        (item) => item.id === Number(form.vehicle_id)
      );
    }

    return null;
  }, [form.container_id, form.vehicle_id, containers, vehicles]);

  const capacityVolume = selectedCapacity
    ? Number(selectedCapacity.internal_length_m || 0) *
      Number(selectedCapacity.internal_width_m || 0) *
      Number(selectedCapacity.internal_height_m || 0)
    : 0;

  const volumePercentage =
    capacityVolume > 0
      ? (totals.volume / capacityVolume) * 100
      : 0;

  const weightPercentage =
    Number(selectedCapacity?.max_payload_kg || 0) > 0
      ? (totals.weight / Number(selectedCapacity.max_payload_kg)) * 100
      : 0;

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSelectedProductId("");
    setQuantity(1);
    setItems([]);
  }

  function startEditing(load) {
    setEditingId(load.id);
    setMessage("");

    setForm({
      reference: load.reference || "",
      client_name: load.client_name || "",
      project_name: load.project_name || "",
      vessel_name: load.vessel_name || "",
      voyage_number: load.voyage_number || "",
      booking_number: load.booking_number || "",
      loading_port: load.loading_port || "",
      destination_port: load.destination_port || "",
      loading_date: toDateTimeLocal(load.loading_date),
      sailing_date: toDateTimeLocal(load.sailing_date),
      carrier_name: load.carrier_name || "",
      operator_name: load.operator_name || "",
      notes: load.notes || "",
      vehicle_id: load.vehicle_id ? String(load.vehicle_id) : "",
      container_id: load.container_id ? String(load.container_id) : "",
    });

    setItems(
      load.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        product: products.find(
          (product) => product.id === item.product_id
        ),
      }))
    );

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveLoad(event) {
    event.preventDefault();

    if (!form.reference.trim()) {
      setMessage("Ingresa una referencia.");
      return;
    }

    if (!form.client_name.trim()) {
      setMessage("Ingresa el cliente.");
      return;
    }

    if (!form.vehicle_id && !form.container_id) {
      setMessage("Selecciona un vehículo o un contenedor.");
      return;
    }

    if (items.length === 0) {
      setMessage("Agrega al menos un producto.");
      return;
    }

    setLoading(true);
    setMessage("");

    const payload = {
      ...form,
      reference: form.reference.trim(),
      client_name: form.client_name.trim(),
      project_name: form.project_name.trim(),
      loading_date: form.loading_date || null,
      sailing_date: form.sailing_date || null,
      vehicle_id: form.vehicle_id ? Number(form.vehicle_id) : null,
      container_id: form.container_id ? Number(form.container_id) : null,
      items: items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
    };

    if (editingId) {
      payload.status = "pending";
    }

    try {
      const response = await fetch(
        editingId
          ? `${API_URL}/loads/${editingId}`
          : `${API_URL}/loads`,
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "No fue posible guardar la orden."
        );
      }

      resetForm();
      setMessage(
        editingId
          ? "Orden logística actualizada."
          : "Orden logística creada."
      );
      await loadData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteLoad(loadId) {
    if (!window.confirm("¿Eliminar esta orden de carga?")) return;

    const response = await fetch(`${API_URL}/loads/${loadId}`, {
      method: "DELETE",
      headers: authHeaders,
    });

    if (!response.ok) {
      setMessage("No fue posible eliminar la orden.");
      return;
    }

    if (editingId === loadId) resetForm();
    await loadData();
    setMessage("Orden eliminada.");
  }

  const filteredLoads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return loads.filter((load) => {
      const matchesSearch = !q || [load.reference, load.client_name, load.project_name, load.booking_number]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
      const matchesStatus = statusFilter === "all"
        ? true
        : statusFilter === "planned"
          ? Boolean(load.plan_data)
          : (load.status || "pending") === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [loads, search, statusFilter]);

  function duplicateLoad(load) {
    setEditingId(null);
    setMessage("Copia preparada. Cambia la referencia y guarda la nueva orden.");
    setForm({
      reference: `${load.reference}-COPIA`,
      client_name: load.client_name || "",
      project_name: load.project_name || "",
      vessel_name: load.vessel_name || "",
      voyage_number: load.voyage_number || "",
      booking_number: load.booking_number || "",
      loading_port: load.loading_port || "",
      destination_port: load.destination_port || "",
      loading_date: toDateTimeLocal(load.loading_date),
      sailing_date: toDateTimeLocal(load.sailing_date),
      carrier_name: load.carrier_name || "",
      operator_name: load.operator_name || "",
      notes: load.notes || "",
      vehicle_id: load.vehicle_id ? String(load.vehicle_id) : "",
      container_id: load.container_id ? String(load.container_id) : "",
    });
    setItems(load.items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      product: products.find((product) => product.id === item.product_id),
    })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getUnitName(load) {
    if (load.container_id) {
      return (
        containers.find((item) => item.id === load.container_id)?.code ||
        "Contenedor"
      );
    }

    return (
      vehicles.find((item) => item.id === load.vehicle_id)?.name ||
      "Vehículo"
    );
  }

  return (
    <div className="module-page loads-professional-page">
      <section className="loads-toolbar">
        <div><strong>Gestión completa de órdenes</strong><span>Crea, busca y abre cargas directamente en el Optimizador.</span></div>
        <div className="loads-toolbar-filters">
          <input type="search" placeholder="Buscar referencia, cliente o proyecto..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Todos los estados</option><option value="pending">Pendientes</option><option value="optimized">Optimizadas</option><option value="warning">Con advertencias</option><option value="planned">Con plan guardado</option>
          </select>
        </div>
      </section>
      <section className="load-layout">
        <form className="form-card load-form" onSubmit={saveLoad}>
          <h2>
            {editingId
              ? "Editar orden logística"
              : "Nueva orden logística"}
          </h2>

          <div className="load-form-grid">
            <label>
              Referencia
              <input
                name="reference"
                value={form.reference}
                onChange={handleFormChange}
                required
              />
            </label>

            <label>
              Cliente
              <input
                name="client_name"
                value={form.client_name}
                onChange={handleFormChange}
                required
              />
            </label>

            <label>
              Proyecto / operación
              <input
                name="project_name"
                value={form.project_name}
                onChange={handleFormChange}
              />
            </label>

            <label>
              Booking
              <input
                name="booking_number"
                value={form.booking_number}
                onChange={handleFormChange}
              />
            </label>

            <label>
              Buque
              <input
                name="vessel_name"
                value={form.vessel_name}
                onChange={handleFormChange}
              />
            </label>

            <label>
              Viaje
              <input
                name="voyage_number"
                value={form.voyage_number}
                onChange={handleFormChange}
              />
            </label>

            <label>
              Puerto de carga
              <input
                name="loading_port"
                value={form.loading_port}
                onChange={handleFormChange}
              />
            </label>

            <label>
              Puerto de destino
              <input
                name="destination_port"
                value={form.destination_port}
                onChange={handleFormChange}
              />
            </label>

            <label>
              Fecha de carga
              <input
                name="loading_date"
                type="datetime-local"
                value={form.loading_date}
                onChange={handleFormChange}
              />
            </label>

            <label>
              Fecha de zarpe
              <input
                name="sailing_date"
                type="datetime-local"
                value={form.sailing_date}
                onChange={handleFormChange}
              />
            </label>

            <label>
              Transportista
              <input
                name="carrier_name"
                value={form.carrier_name}
                onChange={handleFormChange}
              />
            </label>

            <label>
              Operador responsable
              <input
                name="operator_name"
                value={form.operator_name}
                onChange={handleFormChange}
              />
            </label>
          </div>

          <label>
            Vehículo
            <select
              name="vehicle_id"
              value={form.vehicle_id}
              onChange={handleFormChange}
            >
              <option value="">Sin vehículo</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name} · {vehicle.plate}
                </option>
              ))}
            </select>
          </label>

          <label>
            Contenedor
            <select
              name="container_id"
              value={form.container_id}
              onChange={handleFormChange}
            >
              <option value="">Sin contenedor</option>
              {containers.map((container) => (
                <option key={container.id} value={container.id}>
                  {container.code} · {container.container_type}
                </option>
              ))}
            </select>
          </label>

          <label>
            Observaciones
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleFormChange}
              rows="4"
            />
          </label>

          <hr className="form-divider" />

          <h3>Agregar productos</h3>

          <label>
            Producto
            <select
              value={selectedProductId}
              onChange={(event) =>
                setSelectedProductId(event.target.value)
              }
            >
              <option value="">Seleccionar producto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} · {product.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Cantidad
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="secondary-action"
            onClick={addProduct}
          >
            Agregar producto
          </button>

          <button type="submit" disabled={loading}>
            {loading
              ? "Guardando..."
              : editingId
                ? "Guardar cambios"
                : "Guardar orden"}
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

        <div className="load-content">
          <section className="table-card">
            <div className="table-heading">
              <h2>Productos de la orden</h2>
              <span>{totals.units} unidades</span>
            </div>

            {items.length === 0 ? (
              <div className="empty-state compact-empty">
                <span>📦</span>
                <h3>La orden está vacía</h3>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Peso total</th>
                      <th>Volumen total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const product = item.product;
                      const productVolume =
                        Number(product?.length_m || 0) *
                        Number(product?.width_m || 0) *
                        Number(product?.height_m || 0);

                      return (
                        <tr key={item.product_id}>
                          <td>
                            {product?.sku} · {product?.name}
                          </td>
                          <td>{item.quantity}</td>
                          <td>
                            {(
                              Number(product?.weight_kg || 0) *
                              item.quantity
                            ).toLocaleString("es-UY")} kg
                          </td>
                          <td>
                            {(productVolume * item.quantity).toFixed(3)} m³
                          </td>
                          <td>
                            <button
                              type="button"
                              className="delete-button"
                              onClick={() => removeItem(item.product_id)}
                            >
                              Quitar
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

          <section className="load-summary">
            <article>
              <span>Unidades</span>
              <strong>{totals.units}</strong>
            </article>
            <article>
              <span>Peso total</span>
              <strong>{totals.weight.toLocaleString("es-UY")} kg</strong>
            </article>
            <article>
              <span>Volumen total</span>
              <strong>{totals.volume.toFixed(3)} m³</strong>
            </article>
            <article>
              <span>Ocupación estimada</span>
              <strong>{volumePercentage.toFixed(1)}%</strong>
            </article>
            <article>
              <span>Capacidad de peso</span>
              <strong>{weightPercentage.toFixed(1)}%</strong>
            </article>
          </section>

          <section className="table-card">
            <div className="table-heading">
              <h2>Órdenes logísticas</h2>
              <span>{loads.length} órdenes</span>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Referencia</th>
                    <th>Cliente</th>
                    <th>Booking</th>
                    <th>Ruta</th>
                    <th>Estado</th>
                    <th>Unidad</th>
                    <th>Plan</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoads.map((load) => (
                    <tr key={load.id}>
                      <td><strong>{load.reference}</strong></td>
                      <td>{load.client_name || "—"}</td>
                      <td>{load.booking_number || "—"}</td>
                      <td>
                        {(load.loading_port || "—")}
                        {" → "}
                        {(load.destination_port || "—")}
                      </td>
                      <td>
                        <span
                          className={`load-status load-status-${load.status || "pending"}`}
                        >
                          {statusText(load.status)}
                        </span>
                      </td>
                      <td>{getUnitName(load)}</td>
                      <td>{load.plan_data ? <span className="plan-saved-badge">✓ Guardado</span> : <span className="plan-empty-badge">Sin plan</span>}</td>
                      <td>
                        <div className="table-actions table-actions-wrap">
                          <button type="button" className="load-open-optimizer-button" onClick={() => onOpenOptimizer?.(load.id, "reopen")}>{load.plan_data ? "Abrir plan" : "Optimizar"}</button>
                          <button
                            type="button"
                            className="edit-button"
                            onClick={() => startEditing(load)}
                          >
                            Editar
                          </button>
                          <button type="button" className="load-duplicate-button" onClick={() => duplicateLoad(load)}>Duplicar</button>
                          <button
                            type="button"
                            className="delete-button"
                            onClick={() => deleteLoad(load.id)}
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
          </section>
        </div>
      </section>
    </div>
  );
}
