import React, { useEffect, useMemo, useState } from "react";
import LoadViewer3D from "./LoadViewer3D.jsx";
import arrangeProducts from "./optimizer/arrangeProducts.js";
import { calculateWeightBalance } from "./viewer/WeightBalanceController.js";
import { generateLoadReport } from "./reports/LoadReportGenerator.js";

const API_URL = "http://127.0.0.1:8000/api/v1";

export default function Optimizer({ token }) {
  const [vehicles, setVehicles] = useState([]);
  const [containers, setContainers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loads, setLoads] = useState([]);
  const [selectedLoadId, setSelectedLoadId] = useState("");
  const [selectedLoad, setSelectedLoad] = useState(null);
  const [savingOptimization, setSavingOptimization] = useState(false);
  const [unitType, setUnitType] = useState("container");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedItems, setSelectedItems] = useState([]);
  const [optimizationResult, setOptimizationResult] = useState({
    placed: [],
    rejected: [],
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;

    async function loadData() {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [
          vehiclesResponse,
          containersResponse,
          productsResponse,
          loadsResponse,
        ] = await Promise.all([
          fetch(`${API_URL}/vehicles`, { headers }),
          fetch(`${API_URL}/containers`, { headers }),
          fetch(`${API_URL}/products`, { headers }),
          fetch(`${API_URL}/loads`, { headers }),
        ]);

        if (
          !vehiclesResponse.ok ||
          !containersResponse.ok ||
          !productsResponse.ok ||
          !loadsResponse.ok
        ) {
          throw new Error("No se pudieron cargar los datos.");
        }

        const [
          vehiclesData,
          containersData,
          productsData,
          loadsData,
        ] = await Promise.all([
          vehiclesResponse.json(),
          containersResponse.json(),
          productsResponse.json(),
          loadsResponse.json(),
        ]);

        setVehicles(vehiclesData);
        setContainers(containersData);
        setProducts(productsData);
        setLoads(loadsData);
      } catch (requestError) {
        setError(requestError.message);
      }
    }

    loadData();
  }, [token]);

  const availableUnits = useMemo(
    () => (unitType === "vehicle" ? vehicles : containers),
    [unitType, vehicles, containers]
  );

  const selectedCapacity = useMemo(
    () =>
      availableUnits.find(
        (unit) => String(unit.id) === String(selectedUnitId)
      ),
    [availableUnits, selectedUnitId]
  );

  const totalSelectedUnits = useMemo(
    () =>
      selectedItems.reduce(
        (total, item) => total + Number(item.quantity),
        0
      ),
    [selectedItems]
  );

  const containerVolume = useMemo(() => {
    if (!selectedCapacity) return 0;
    return (
      Number(selectedCapacity.internal_length_m || 0) *
      Number(selectedCapacity.internal_width_m || 0) *
      Number(selectedCapacity.internal_height_m || 0)
    );
  }, [selectedCapacity]);

  const usedVolume = useMemo(
    () =>
      optimizationResult.placed.reduce(
        (total, item) =>
          total +
          Number(item.length || 0) *
            Number(item.width || 0) *
            Number(item.height || 0),
        0
      ),
    [optimizationResult.placed]
  );

  const volumePercentage = containerVolume
    ? Math.min(100, (usedVolume / containerVolume) * 100)
    : 0;

  const maximumWeight = useMemo(() => {
    if (!selectedCapacity) return 0;
    return Number(
      selectedCapacity.max_payload_kg ||
        selectedCapacity.max_weight_kg ||
        selectedCapacity.payload_capacity_kg ||
        selectedCapacity.capacity_kg ||
        0
    );
  }, [selectedCapacity]);

  const usedWeight = useMemo(
    () =>
      optimizationResult.placed.reduce(
        (total, item) => total + Number(item.product?.weight_kg || 0),
        0
      ),
    [optimizationResult.placed]
  );

  const weightBalance = useMemo(
    () =>
      calculateWeightBalance({
        capacity: selectedCapacity,
        placedItems: optimizationResult.placed,
      }),
    [selectedCapacity, optimizationResult.placed]
  );

  const weightPercentage = maximumWeight
    ? Math.min(100, (usedWeight / maximumWeight) * 100)
    : 0;

  function handleLoadSelection(event) {
    const loadId = event.target.value;
    setSelectedLoadId(loadId);
    setOptimizationResult({ placed: [], rejected: [] });
    setError("");

    if (!loadId) {
      setSelectedLoad(null);
      setSelectedItems([]);
      return;
    }

    const load = loads.find(
      (item) => String(item.id) === String(loadId)
    );

    if (!load) {
      setError("No se encontró la orden seleccionada.");
      return;
    }

    try {
      const loadItems = load.items.map((item) => {
        const product = products.find(
          (productItem) =>
            String(productItem.id) === String(item.product_id)
        );

        if (!product) {
          throw new Error(
            `No se encontró el producto ${item.product_id}.`
          );
        }

        return {
          product,
          quantity: Number(item.quantity),
        };
      });

      if (load.container_id) {
        setUnitType("container");
        setSelectedUnitId(String(load.container_id));
      } else if (load.vehicle_id) {
        setUnitType("vehicle");
        setSelectedUnitId(String(load.vehicle_id));
      } else {
        throw new Error("La orden no tiene unidad asignada.");
      }

      setSelectedLoad(load);
      setSelectedItems(loadItems);
    } catch (loadError) {
      setSelectedLoad(null);
      setSelectedItems([]);
      setError(loadError.message);
    }
  }

  async function saveOptimizationResult(result) {
    if (!selectedLoad) return;

    setSavingOptimization(true);

    try {
      const balance = calculateWeightBalance({
        capacity: selectedCapacity,
        placedItems: result.placed,
      });

      const totalWeight = result.placed.reduce(
        (total, item) =>
          total + Number(item.product?.weight_kg || 0),
        0
      );

      const totalVolume = result.placed.reduce(
        (total, item) =>
          total +
          Number(item.length || 0) *
            Number(item.width || 0) *
            Number(item.height || 0),
        0
      );

      const response = await fetch(
        `${API_URL}/loads/${selectedLoad.id}/optimization`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status:
              result.rejected.length > 0
                ? "warning"
                : "optimized",
            total_weight_kg: totalWeight,
            total_volume_m3: totalVolume,
            center_of_gravity_x: balance.center.x,
            center_of_gravity_y: balance.center.y,
            center_of_gravity_z: balance.center.z,
            report_path: "",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "No se pudo guardar la optimización."
        );
      }

      setSelectedLoad(data);
      setLoads((current) =>
        current.map((load) =>
          load.id === data.id ? data : load
        )
      );
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingOptimization(false);
    }
  }

  function handleUnitTypeChange(event) {
    setUnitType(event.target.value);
    setSelectedUnitId("");
    setOptimizationResult({ placed: [], rejected: [] });
  }

  function handleAddProduct() {
    setError("");
    const product = products.find(
      (item) => String(item.id) === String(selectedProductId)
    );
    const numericQuantity = Number(quantity);

    if (!product) {
      setError("Selecciona un producto.");
      return;
    }

    if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) {
      setError("La cantidad debe ser mayor que cero.");
      return;
    }

    setSelectedItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.product.id === product.id
      );

      if (existingItem) {
        return currentItems.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + numericQuantity }
            : item
        );
      }

      return [...currentItems, { product, quantity: numericQuantity }];
    });

    setSelectedProductId("");
    setQuantity(1);
  }

  function handleRemoveProduct(productId) {
    setSelectedItems((currentItems) =>
      currentItems.filter((item) => item.product.id !== productId)
    );
    setOptimizationResult({ placed: [], rejected: [] });
  }

  async function handleOptimize() {
    setError("");

    if (!selectedCapacity) {
      setError("Selecciona un vehículo o contenedor.");
      return;
    }

    if (selectedItems.length === 0) {
      setError("Agrega al menos un producto.");
      return;
    }

    const result = arrangeProducts(
      selectedCapacity,
      selectedItems
    );

    setOptimizationResult(result);

    if (selectedLoad) {
      await saveOptimizationResult(result);
    }
  }

  function handleGenerateReport() {
    if (!selectedCapacity || optimizationResult.placed.length === 0) {
      setError("Primero selecciona una unidad y optimiza una carga.");
      return;
    }

    const client =
      selectedLoad?.client_name ||
      window.prompt("Nombre del cliente:", "INMOVE") ||
      "INMOVE";

    const project =
      selectedLoad?.project_name ||
      selectedLoad?.reference ||
      window.prompt(
        "Nombre del proyecto o referencia:",
        selectedCapacity.name ||
          selectedCapacity.code ||
          selectedCapacity.plate ||
          "Plan de carga"
      ) || "Plan de carga";

    const declaredTare = Number(
      selectedCapacity.tare_weight_kg ??
        selectedCapacity.empty_weight_kg ??
        selectedCapacity.own_weight_kg ??
        selectedCapacity.vehicle_weight_kg ??
        selectedCapacity.container_weight_kg ??
        0
    );

    let tareWeight = Math.max(
      0,
      Number.isFinite(declaredTare)
        ? declaredTare
        : 0
    );

    if (tareWeight <= 0) {
      const tareInput = window.prompt(
        "Este contenedor no tiene tara registrada. Ingresá la tara en kg:",
        "0"
      );

      tareWeight = Math.max(
        0,
        Number(tareInput || 0) || 0
      );
    }

    const grossWeight = usedWeight + tareWeight;

    let viewerImage = "";
    try {
      const canvas = document.querySelector(".load-viewer-3d canvas");
      if (canvas) {
        viewerImage = canvas.toDataURL("image/png", 1);
      }
    } catch (captureError) {
      console.warn("No se pudo capturar la vista 3D:", captureError);
    }

    generateLoadReport({
      client,
      project,
      unitType,
      capacity: selectedCapacity,
      placedItems: optimizationResult.placed,
      rejectedItems: optimizationResult.rejected,
      viewerImage,
      stats: {
        usedWeight,
        tareWeight,
        grossWeight,
        maximumWeight,
        weightPercentage,
        usedVolume,
        containerVolume,
        volumePercentage,
      },
      weightBalance,
      logistics: selectedLoad
        ? {
            reference: selectedLoad.reference,
            bookingNumber: selectedLoad.booking_number,
            vesselName: selectedLoad.vessel_name,
            voyageNumber: selectedLoad.voyage_number,
            loadingPort: selectedLoad.loading_port,
            destinationPort: selectedLoad.destination_port,
            loadingDate: selectedLoad.loading_date,
            sailingDate: selectedLoad.sailing_date,
            carrierName: selectedLoad.carrier_name,
            operatorName: selectedLoad.operator_name,
            notes: selectedLoad.notes,
          }
        : {},
    });
  }

  return (
    <main className="optimizer-page">
      <div className="page-heading">
        <div>
          <h1>Optimizador de carga</h1>
          <p>Configura la unidad y los productos para generar una distribución automática.</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="optimizer-layout">
        <section className="optimizer-card">
          <h2>Configurar optimización</h2>

          <label>
            Orden de carga
            <select
              value={selectedLoadId}
              onChange={handleLoadSelection}
            >
              <option value="">
                Modo manual / seleccionar orden
              </option>
              {loads.map((load) => (
                <option key={load.id} value={load.id}>
                  {load.reference}
                  {load.client_name
                    ? ` · ${load.client_name}`
                    : ""}
                  {load.status
                    ? ` · ${load.status}`
                    : ""}
                </option>
              ))}
            </select>
          </label>

          {selectedLoad && (
            <div className="load-order-summary">
              <strong>{selectedLoad.reference}</strong>
              <span>
                Cliente: {selectedLoad.client_name || "—"}
              </span>
              <span>
                Proyecto: {selectedLoad.project_name || "—"}
              </span>
              <span>
                Estado: {selectedLoad.status || "pending"}
              </span>
              {selectedLoad.booking_number && (
                <span>Booking: {selectedLoad.booking_number}</span>
              )}
              {(selectedLoad.loading_port || selectedLoad.destination_port) && (
                <span>
                  Ruta: {selectedLoad.loading_port || "—"} →{" "}
                  {selectedLoad.destination_port || "—"}
                </span>
              )}
              {selectedLoad.vessel_name && (
                <span>
                  Buque: {selectedLoad.vessel_name}
                  {selectedLoad.voyage_number
                    ? ` · Viaje ${selectedLoad.voyage_number}`
                    : ""}
                </span>
              )}
            </div>
          )}

          <label>
            Tipo de unidad
            <select
              value={unitType}
              onChange={handleUnitTypeChange}
              disabled={Boolean(selectedLoad)}
            >
              <option value="container">Contenedor</option>
              <option value="vehicle">Vehículo</option>
            </select>
          </label>

          <label>
            Unidad disponible
            <select
              value={selectedUnitId}
              onChange={(event) => setSelectedUnitId(event.target.value)}
              disabled={Boolean(selectedLoad)}
            >
              <option value="">Seleccionar unidad</option>
              {availableUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name || unit.plate || `Unidad ${unit.id}`}
                </option>
              ))}
            </select>
          </label>

          {!selectedLoad && (
          <div className="optimizer-product-form">
            <label>
              Producto
              <select
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
              >
                <option value="">Seleccionar producto</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
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

            <button type="button" className="primary-button" onClick={handleAddProduct}>
              Agregar producto
            </button>
          </div>
          )}

          <div className="selected-products">
            <div className="section-title-row">
              <h3>Productos seleccionados</h3>
              <span>{totalSelectedUnits} unidades</span>
            </div>

            {selectedItems.length === 0 ? (
              <p className="empty-message">Todavía no agregaste productos.</p>
            ) : (
              selectedItems.map((item) => (
                <div key={item.product.id} className="selected-product-row">
                  <div>
                    <strong>{item.product.name}</strong>
                    <span>{item.quantity} unidades</span>
                  </div>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => handleRemoveProduct(item.product.id)}
                    disabled={Boolean(selectedLoad)}
                  >
                    Quitar
                  </button>
                </div>
              ))
            )}
          </div>

          <button type="button" className="optimize-button" onClick={handleOptimize}>
            {savingOptimization
              ? "Guardando resultado..."
              : selectedLoad
                ? "Optimizar orden"
                : "Optimizar carga"}
          </button>
        </section>

        <section className="optimizer-viewer-card">
          <div className="section-title-row">
            <div>
              <h2>Vista 3D de la carga</h2>
              <p>Arrastra con el mouse para rotar y usa la rueda para acercar.</p>
            </div>

            <button
              type="button"
              className="report-button"
              onClick={handleGenerateReport}
              disabled={!selectedCapacity || optimizationResult.placed.length === 0}
            >
              📄 Generar informe
            </button>
          </div>

          <LoadViewer3D
  capacity={selectedCapacity}
  placedItems={optimizationResult.placed}
  onItemsChange={(newPlacedItems) => {
    setOptimizationResult((currentResult) => ({
      ...currentResult,
      placed: newPlacedItems,
    }));
  }}
/>

{optimizationResult.placed.length > 0 && (
  <div className="product-legend">
    <h3>Referencias de productos</h3>

    <div className="product-legend-list">
      {Array.from(
        new Map(
          optimizationResult.placed.map((item) => [
            item.product.id,
            item,
          ])
        ).values()
      ).map((item) => (
        <div
          key={item.product.id}
          className="product-legend-item"
        >
          <span
            className="product-legend-color"
            style={{
              backgroundColor: item.color,
            }}
          />

          <span>{item.product.name}</span>
        </div>
      ))}
    </div>
  </div>
)}
          <div className="optimizer-stats">
            <div>
              <span>Productos colocados</span>
              <strong>{optimizationResult.placed.length}</strong>
            </div>
            <div>
              <span>Productos rechazados</span>
              <strong>{optimizationResult.rejected.length}</strong>
            </div>
            <div className="usage-stat">
              <div className="usage-stat-header">
                <span>Volumen utilizado</span>
                <strong>{volumePercentage.toFixed(1)}%</strong>
              </div>
              <div className="usage-progress">
                <div
                  className="usage-progress-fill"
                  style={{ width: `${volumePercentage}%` }}
                />
              </div>
              <small>
                {usedVolume.toFixed(2)} m³ de {containerVolume.toFixed(2)} m³
              </small>
            </div>
            <div className="usage-stat">
              <div className="usage-stat-header">
                <span>Peso utilizado</span>
                <strong>
                  {maximumWeight ? `${weightPercentage.toFixed(1)}%` : "Sin límite"}
                </strong>
              </div>
              <div className="usage-progress">
                <div
                  className="usage-progress-fill"
                  style={{ width: `${maximumWeight ? weightPercentage : 0}%` }}
                />
              </div>
              <small>
                {usedWeight.toFixed(0)} kg
                {maximumWeight ? ` de ${maximumWeight.toFixed(0)} kg` : ""}
              </small>
            </div>
          </div>

          {optimizationResult.rejected.length > 0 && (
            <div className="rejected-products">
              <h3>Productos sin espacio</h3>
              {optimizationResult.rejected.map((item, index) => (
                <div
                  key={`${item.product.id}-${item.unit}-${index}`}
                  className="rejected-product-row"
                >
                  <span>{item.product.name} — unidad {item.unit}</span>
                  <small>{item.reason}</small>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}