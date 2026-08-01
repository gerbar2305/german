import React, { useEffect, useMemo, useState } from "react";

const API_URL = "http://127.0.0.1:8000/api/v1";

export default function Loads({ token, onCountChange }) {
  const [loads, setLoads] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [containers, setContainers] = useState([]);
  const [products, setProducts] = useState([]);

  const [reference, setReference] = useState("");
  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [vehicleId, setVehicleId] = useState("");
  const [containerId, setContainerId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [items, setItems] = useState([]);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
      const [
        loadsData,
        vehiclesData,
        containersData,
        productsData,
      ] = await Promise.all([
        fetchList("loads"),
        fetchList("vehicles"),
        fetchList("containers"),
        fetchList("products"),
      ]);

      setLoads(loadsData);
      setVehicles(vehiclesData);
      setContainers(containersData);
      setProducts(productsData);
      onCountChange(loadsData.length);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function addProduct() {
    if (!selectedProductId) {
      setMessage("Selecciona un producto.");
      return;
    }

    if (Number(quantity) < 1) {
      setMessage("La cantidad debe ser mayor que cero.");
      return;
    }

    const product = products.find(
      (item) => item.id === Number(selectedProductId)
    );

    if (!product) {
      setMessage("Producto no encontrado.");
      return;
    }

    const existingItem = items.find(
      (item) => item.product_id === product.id
    );

    if (existingItem) {
      setItems((current) =>
        current.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + Number(quantity),
              }
            : item
        )
      );
    } else {
      setItems((current) => [
        ...current,
        {
          product_id: product.id,
          quantity: Number(quantity),
          product,
        },
      ]);
    }

    setSelectedProductId("");
    setQuantity(1);
    setMessage("");
  }

  function removeItem(productId) {
    setItems((current) =>
      current.filter((item) => item.product_id !== productId)
    );
  }

  const totals = useMemo(() => {
    return items.reduce(
      (result, item) => {
        const unitVolume =
          item.product.length_m *
          item.product.width_m *
          item.product.height_m;

        result.weight += item.product.weight_kg * item.quantity;
        result.volume += unitVolume * item.quantity;
        result.units += item.quantity;

        return result;
      },
      {
        weight: 0,
        volume: 0,
        units: 0,
      }
    );
  }, [items]);

  const selectedCapacity = useMemo(() => {
    if (containerId) {
      return containers.find(
        (item) => item.id === Number(containerId)
      );
    }

    if (vehicleId) {
      return vehicles.find(
        (item) => item.id === Number(vehicleId)
      );
    }

    return null;
  }, [containerId, vehicleId, containers, vehicles]);

  const capacityVolume = selectedCapacity
    ? selectedCapacity.internal_length_m *
      selectedCapacity.internal_width_m *
      selectedCapacity.internal_height_m
    : 0;

  const volumePercentage =
    capacityVolume > 0
      ? (totals.volume / capacityVolume) * 100
      : 0;

  const weightPercentage =
    selectedCapacity?.max_payload_kg > 0
      ? (totals.weight / selectedCapacity.max_payload_kg) * 100
      : 0;

  async function createLoad(event) {
    event.preventDefault();

    if (!reference.trim()) {
      setMessage("Ingresa una referencia para la carga.");
      return;
    }

    if (!clientName.trim()) {
      setMessage("Ingresa el nombre del cliente.");
      return;
    }

    if (!vehicleId && !containerId) {
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
      reference: reference.trim(),
      client_name: clientName.trim(),
      project_name: projectName.trim(),
      notes: notes.trim(),
      vehicle_id: vehicleId ? Number(vehicleId) : null,
      container_id: containerId ? Number(containerId) : null,
      items: items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
    };

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
        body: JSON.stringify(
          editingId
            ? { ...payload, status: "pending" }
            : payload
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : "No fue posible crear la carga";

        throw new Error(detail);
      }

      setReference("");
      setClientName("");
      setProjectName("");
      setNotes("");
      setVehicleId("");
      setContainerId("");
      setItems([]);
      setEditingId(null);
      setMessage(
        editingId
          ? "Orden de carga actualizada."
          : "Orden de carga creada como pendiente."
      );

      await loadData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function getProduct(productId) {
    return products.find((product) => product.id === productId);
  }

  function getVehicle(vehicleIdValue) {
    return vehicles.find((vehicle) => vehicle.id === vehicleIdValue);
  }

  function getContainer(containerIdValue) {
    return containers.find(
      (container) => container.id === containerIdValue
    );
  }

  function startEditing(load) {
    setEditingId(load.id);
    setReference(load.reference || "");
    setClientName(load.client_name || "");
    setProjectName(load.project_name || "");
    setNotes(load.notes || "");
    setVehicleId(load.vehicle_id ? String(load.vehicle_id) : "");
    setContainerId(load.container_id ? String(load.container_id) : "");
    setItems(
      load.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        product: getProduct(item.product_id),
      }))
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() {
    setEditingId(null);
    setReference("");
    setClientName("");
    setProjectName("");
    setNotes("");
    setVehicleId("");
    setContainerId("");
    setItems([]);
    setMessage("");
  }

  async function deleteLoad(loadId) {
    if (!window.confirm("¿Eliminar esta orden de carga?")) return;

    const response = await fetch(`${API_URL}/loads/${loadId}`, {
      method: "DELETE",
      headers: authHeaders,
    });

    if (!response.ok) {
      setMessage("No fue posible eliminar la carga.");
      return;
    }

    if (editingId === loadId) cancelEditing();
    await loadData();
    setMessage("Orden de carga eliminada.");
  }

  return (
    <div className="module-page">
      <section className="load-layout">
        <form className="form-card load-form" onSubmit={createLoad}>
          <h2>{editingId ? "Editar orden de carga" : "Nueva orden de carga"}</h2>

          <label htmlFor="reference">Referencia</label>
          <input
            id="reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Ejemplo: CARGA-001"
            required
          />

          <label htmlFor="client_name">Cliente</label>
          <input
            id="client_name"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            placeholder="Ejemplo: INMOVE"
            required
          />

          <label htmlFor="project_name">Proyecto / operación</label>
          <input
            id="project_name"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Ejemplo: Exportación Brasil"
          />

          <label htmlFor="notes">Observaciones</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows="4"
            placeholder="Indicaciones especiales de la operación"
          />

          <label htmlFor="vehicle">Vehículo</label>
          <select
            id="vehicle"
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
          >
            <option value="">Sin vehículo</option>

            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.name} · {vehicle.plate}
              </option>
            ))}
          </select>

          <label htmlFor="container">Contenedor</label>
          <select
            id="container"
            value={containerId}
            onChange={(event) => setContainerId(event.target.value)}
          >
            <option value="">Sin contenedor</option>

            {containers.map((container) => (
              <option key={container.id} value={container.id}>
                {container.code} · {container.container_type}
              </option>
            ))}
          </select>

          <hr className="form-divider" />

          <h3>Agregar productos</h3>

          <label htmlFor="product">Producto</label>
          <select
            id="product"
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

          <label htmlFor="quantity">Cantidad</label>
          <input
            id="quantity"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />

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
                : "Guardar orden pendiente"}
          </button>

          {editingId && (
            <button
              type="button"
              className="secondary-action"
              onClick={cancelEditing}
            >
              Cancelar edición
            </button>
          )}

          {message && <p className="form-message">{message}</p>}
        </form>

        <div className="load-content">
          <section className="table-card">
            <div className="table-heading">
              <h2>Productos de la carga</h2>
              <span>{totals.units} unidades</span>
            </div>

            {items.length === 0 ? (
              <div className="empty-state compact-empty">
                <span>📦</span>
                <h3>La carga está vacía</h3>
                <p>Selecciona productos y cantidades.</p>
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
                      const productVolume =
                        item.product.length_m *
                        item.product.width_m *
                        item.product.height_m;

                      return (
                        <tr key={item.product_id}>
                          <td>
                            {item.product.sku} · {item.product.name}
                          </td>

                          <td>{item.quantity}</td>

                          <td>
                            {(
                              item.product.weight_kg * item.quantity
                            ).toLocaleString()}{" "}
                            kg
                          </td>

                          <td>
                            {(
                              productVolume * item.quantity
                            ).toFixed(3)}{" "}
                            m³
                          </td>

                          <td>
                            <button
                              type="button"
                              className="delete-button"
                              onClick={() =>
                                removeItem(item.product_id)
                              }
                            >
                              Quitar
                            </button>
                          </td>
                          <td>
                            <div className="table-actions">
                              <button
                                type="button"
                                className="edit-button"
                                onClick={() => startEditing(load)}
                              >
                                Editar
                              </button>
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
              <strong>{totals.weight.toLocaleString()} kg</strong>
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

          {(volumePercentage > 100 || weightPercentage > 100) && (
            <div className="capacity-warning">
              ⚠️ La carga supera la capacidad seleccionada.
            </div>
          )}

          <section className="table-card">
            <div className="table-heading">
              <h2>Cargas registradas</h2>
              <span>{loads.length} cargas</span>
            </div>

            {loads.length === 0 ? (
              <div className="empty-state compact-empty">
                <span>🚚</span>
                <h3>No hay cargas registradas</h3>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Referencia</th>
                      <th>Cliente</th>
                      <th>Proyecto</th>
                      <th>Estado</th>
                      <th>Unidad</th>
                      <th>Productos</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {loads.map((load) => {
                      const vehicle = getVehicle(load.vehicle_id);
                      const container = getContainer(load.container_id);

                      return (
                        <tr key={load.id}>
                          <td><strong>{load.reference}</strong></td>
                          <td>{load.client_name || "—"}</td>
                          <td>{load.project_name || "—"}</td>
                          <td>
                            <span className={`load-status load-status-${load.status || "pending"}`}>
                              {load.status === "optimized"
                                ? "Optimizada"
                                : load.status === "error"
                                  ? "Error"
                                  : "Pendiente"}
                            </span>
                          </td>

                          <td>
                            {container
                              ? container.code
                              : vehicle
                                ? vehicle.name
                                : "Sin asignar"}
                          </td>

                          <td>
                            {load.items.map((item) => {
                              const product = getProduct(item.product_id);

                              return (
                                <div key={item.id}>
                                  {product?.name || `Producto ${item.product_id}`}
                                  {" × "}
                                  {item.quantity}
                                </div>
                              );
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}