import React, { useEffect, useMemo, useRef, useState } from "react";
import LoadViewer3D from "./LoadViewer3D.jsx";
import arrangeProducts from "./optimizer/arrangeProducts.js";
import { runIntelligentOptimization } from "./optimizer/intelligentOptimizer.js";
import { calculateWeightBalance } from "./viewer/WeightBalanceController.js";
import { generateLoadReport } from "./reports/LoadReportGenerator.js";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000/api/v1";

export default function Optimizer({ token, onEditLoad }) {
  const [vehicles, setVehicles] = useState([]);
  const [containers, setContainers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loads, setLoads] = useState([]);

  const [selectedLoadId, setSelectedLoadId] = useState("");
  const [selectedLoad, setSelectedLoad] = useState(null);

  const [savingOptimization, setSavingOptimization] =
    useState(false);

  const [savingPlan, setSavingPlan] = useState(false);
  const [planMessage, setPlanMessage] = useState("");

  const [unitType, setUnitType] = useState("container");
  const [selectedUnitId, setSelectedUnitId] = useState("");

  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [quantity, setQuantity] = useState(1);
  const [selectedItems, setSelectedItems] = useState([]);

  const [optimizationResult, setOptimizationResult] = useState({
    placed: [],
    rejected: [],
  });

  const [error, setError] = useState("");

  const [runningIntelligent, setRunningIntelligent] =
    useState(false);

  const [intelligentResult, setIntelligentResult] =
    useState(null);

  const [historyIndex, setHistoryIndex] = useState(-1);

  const historyRef = useRef([]);
  const applyingHistoryRef = useRef(false);

  useEffect(() => {
    if (!token) return;

    async function loadData() {
      try {
        const headers = {
          Authorization: `Bearer ${token}`,
        };

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
          throw new Error(
            "No se pudieron cargar los datos."
          );
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

  useEffect(() => {
    const requestedLoadId =
      localStorage.getItem("gerbar_open_load_id");

    if (
      !requestedLoadId ||
      loads.length === 0 ||
      products.length === 0 ||
      selectedLoadId
    ) {
      return;
    }

    handleLoadSelection({
      target: {
        value: requestedLoadId,
      },
    });
  }, [loads, products]);

  const availableUnits = useMemo(
    () =>
      unitType === "vehicle"
        ? vehicles
        : containers,
    [unitType, vehicles, containers]
  );

  const selectedCapacity = useMemo(
    () =>
      availableUnits.find(
        (unit) =>
          String(unit.id) ===
          String(selectedUnitId)
      ),
    [availableUnits, selectedUnitId]
  );

  const activePlacedItems = useMemo(
    () =>
      optimizationResult.placed.filter(
        (item) => !item.standby
      ),
    [optimizationResult.placed]
  );

  const standbyItems = useMemo(
    () =>
      optimizationResult.placed.filter(
        (item) => item.standby
      ),
    [optimizationResult.placed]
  );

  const totalSelectedUnits = useMemo(
    () =>
      selectedItems.reduce(
        (total, item) =>
          total + Number(item.quantity),
        0
      ),
    [selectedItems]
  );

  const containerVolume = useMemo(() => {
    if (!selectedCapacity) return 0;

    return (
      Number(
        selectedCapacity.internal_length_m || 0
      ) *
      Number(
        selectedCapacity.internal_width_m || 0
      ) *
      Number(
        selectedCapacity.internal_height_m || 0
      )
    );
  }, [selectedCapacity]);

  const usedVolume = useMemo(
    () =>
      activePlacedItems.reduce(
        (total, item) =>
          total +
          Number(item.length || 0) *
            Number(item.width || 0) *
            Number(item.height || 0),
        0
      ),
    [activePlacedItems]
  );

  const volumePercentage = containerVolume
    ? Math.min(
        100,
        (usedVolume / containerVolume) * 100
      )
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
      activePlacedItems.reduce(
        (total, item) =>
          total +
          Number(
            item.product?.weight_kg || 0
          ),
        0
      ),
    [activePlacedItems]
  );

  const weightBalance = useMemo(
    () =>
      calculateWeightBalance({
        capacity: selectedCapacity,
        placedItems: activePlacedItems,
      }),
    [selectedCapacity, activePlacedItems]
  );

  const weightPercentage = maximumWeight
    ? Math.min(
        100,
        (usedWeight / maximumWeight) * 100
      )
    : 0;

  function serializePlan(
    result = optimizationResult
  ) {
    const serializeItem = (item) => ({
      product_id:
        item.product?.id ??
        item.product_id ??
        null,

      instanceId:
        item.instanceId ?? null,

      unit:
        item.unit ?? null,

      x: Number(item.x || 0),
      y: Number(item.y || 0),
      z: Number(item.z || 0),

      length: Number(
        item.length ||
          item.product?.length_m ||
          0
      ),

      width: Number(
        item.width ||
          item.product?.width_m ||
          0
      ),

      height: Number(
        item.height ||
          item.product?.height_m ||
          0
      ),

      rotationY: Number(
        item.rotationY || 0
      ),

      orientation:
        item.orientation ||
        "VERTICAL",

      color:
        item.color || "",

      reason:
        item.reason || "",

      locked:
        Boolean(item.locked),

      standby:
        Boolean(item.standby),

      standbyOrigin:
        item.standbyOrigin || null,
    });

    return {
      version: 1,
      savedAt: new Date().toISOString(),
      unitType,
      capacityId: Number(selectedUnitId),

      placed:
        result.placed.map(
          serializeItem
        ),

      rejected:
        result.rejected.map(
          serializeItem
        ),
    };
  }

  function restorePlan(load) {
    if (!load?.plan_data) return false;

    try {
      const parsed = JSON.parse(
        load.plan_data
      );

      const restoreItem = (item) => {
        const product = products.find(
          (productItem) =>
            String(productItem.id) ===
            String(item.product_id)
        );

        if (!product) {
          throw new Error(
            `No se encontró el producto ${item.product_id} del plan guardado.`
          );
        }

        return {
          ...item,
          product,

          rotationY:
            Number(
              item.rotationY || 0
            ),

          locked:
            Boolean(item.locked),

          standby:
            Boolean(item.standby),

          standbyOrigin:
            item.standbyOrigin || null,
        };
      };

      const restoredResult = {
        placed:
          Array.isArray(parsed.placed)
            ? parsed.placed.map(
                restoreItem
              )
            : [],

        rejected:
          Array.isArray(parsed.rejected)
            ? parsed.rejected.map(
                restoreItem
              )
            : [],
      };

      setOptimizationResult(
        restoredResult
      );

      resetHistory(
        restoredResult
      );

      setPlanMessage(
        "Plan guardado reabierto correctamente."
      );

      return true;
    } catch (restoreError) {
      setError(
        restoreError.message
      );

      return false;
    }
  }

  async function savePlan(
    result = optimizationResult,
    silent = false
  ) {
    if (!selectedLoad) {
      if (!silent) {
        setError(
          "Selecciona una orden para guardar el plan."
        );
      }

      return;
    }

    if (result.placed.length === 0) {
      if (!silent) {
        setError(
          "Primero optimiza o reabre un plan."
        );
      }

      return;
    }

    setSavingPlan(true);

    if (!silent) {
      setPlanMessage("");
    }

    try {
      const response = await fetch(
        `${API_URL}/loads/${selectedLoad.id}/plan`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify({
            plan_data:
              JSON.stringify(
                serializePlan(result)
              ),

            plan_version: 1,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail ===
            "string"
            ? data.detail
            : "No se pudo guardar el plan."
        );
      }

      setSelectedLoad(data);

      setLoads((current) =>
        current.map((load) =>
          load.id === data.id
            ? data
            : load
        )
      );

      if (!silent) {
        setPlanMessage(
          "Plan de carga guardado."
        );
      }
    } catch (saveError) {
      setError(
        saveError.message
      );
    } finally {
      setSavingPlan(false);
    }
  }

  function handleReopenPlan() {
    if (!selectedLoad?.plan_data) {
      setError(
        "Esta orden todavía no tiene un plan guardado."
      );

      return;
    }

    setError("");
    restorePlan(selectedLoad);
  }

  async function handleReoptimize() {
    if (
      !window.confirm(
        "¿Reoptimizar la orden? La distribución visible será reemplazada."
      )
    ) {
      return;
    }

    await handleOptimize();
  }
  async function handleIntelligentReoptimize() {
  if (
    !window.confirm(
      "¿Reoptimizar la orden con IA? La distribución visible será reemplazada por una nueva solución inteligente."
    )
  ) {
    return;
  }

  await handleIntelligentOptimize();
}

  function resetHistory(result) {
    historyRef.current = [
      JSON.parse(
        JSON.stringify(result)
      ),
    ];

    setHistoryIndex(0);
  }

  function pushHistory(result) {
    if (
      applyingHistoryRef.current
    ) {
      applyingHistoryRef.current =
        false;

      return;
    }

    const current =
      historyRef.current.slice(
        0,
        historyIndex + 1
      );

    current.push(
      JSON.parse(
        JSON.stringify(result)
      )
    );

    const limited =
      current.slice(-50);

    historyRef.current =
      limited;

    setHistoryIndex(
      limited.length - 1
    );
  }

  function undoPlanChange() {
    if (historyIndex <= 0) return;

    const nextIndex =
      historyIndex - 1;

    applyingHistoryRef.current =
      true;

    setOptimizationResult(
      JSON.parse(
        JSON.stringify(
          historyRef.current[
            nextIndex
          ]
        )
      )
    );

    setHistoryIndex(
      nextIndex
    );

    setPlanMessage(
      "Cambio deshecho."
    );
  }

  function redoPlanChange() {
    if (
      historyIndex < 0 ||
      historyIndex >=
        historyRef.current.length - 1
    ) {
      return;
    }

    const nextIndex =
      historyIndex + 1;

    applyingHistoryRef.current =
      true;

    setOptimizationResult(
      JSON.parse(
        JSON.stringify(
          historyRef.current[
            nextIndex
          ]
        )
      )
    );

    setHistoryIndex(
      nextIndex
    );

    setPlanMessage(
      "Cambio rehecho."
    );
  }

  function handleLoadSelection(event) {
    const loadId =
      event.target.value;

    setSelectedLoadId(loadId);

    const emptyResult = {
      placed: [],
      rejected: [],
    };

    setOptimizationResult(
      emptyResult
    );

    resetHistory(
      emptyResult
    );

    setError("");
    setPlanMessage("");

    if (!loadId) {
      setSelectedLoad(null);
      setSelectedItems([]);

      return;
    }

    const load = loads.find(
      (item) =>
        String(item.id) ===
        String(loadId)
    );

    if (!load) {
      setError(
        "No se encontró la orden seleccionada."
      );

      return;
    }

    try {
      const loadItems =
        load.items.map((item) => {
          const product =
            products.find(
              (productItem) =>
                String(
                  productItem.id
                ) ===
                String(
                  item.product_id
                )
            );

          if (!product) {
            throw new Error(
              `No se encontró el producto ${item.product_id}.`
            );
          }

          return {
            product,
            quantity:
              Number(
                item.quantity
              ),
          };
        });

      if (load.container_id) {
        setUnitType(
          "container"
        );

        setSelectedUnitId(
          String(
            load.container_id
          )
        );
      } else if (
        load.vehicle_id
      ) {
        setUnitType(
          "vehicle"
        );

        setSelectedUnitId(
          String(
            load.vehicle_id
          )
        );
      } else {
        throw new Error(
          "La orden no tiene unidad asignada."
        );
      }

      setSelectedLoad(load);
      setSelectedItems(
        loadItems
      );

      const requestedLoadId =
        localStorage.getItem(
          "gerbar_open_load_id"
        );

      if (
        load.plan_data &&
        (
          requestedLoadId ===
            String(load.id) ||
          load.status ===
            "optimized" ||
          load.status ===
            "warning"
        )
      ) {
        restorePlan(load);
      }

      if (
        requestedLoadId ===
        String(load.id)
      ) {
        localStorage.removeItem(
          "gerbar_open_load_id"
        );
      }
    } catch (loadError) {
      setSelectedLoad(null);
      setSelectedItems([]);

      setError(
        loadError.message
      );
    }
  }

  async function saveOptimizationResult(
    result
  ) {
    if (!selectedLoad) return;

    setSavingOptimization(
      true
    );

    try {
      const activeResultItems =
        result.placed.filter(
          (item) =>
            !item.standby
        );

      const balance =
        calculateWeightBalance({
          capacity:
            selectedCapacity,

          placedItems:
            activeResultItems,
        });

      const totalWeight =
        activeResultItems.reduce(
          (total, item) =>
            total +
            Number(
              item.product
                ?.weight_kg || 0
            ),
          0
        );

      const totalVolume =
        activeResultItems.reduce(
          (total, item) =>
            total +
            Number(
              item.length || 0
            ) *
              Number(
                item.width || 0
              ) *
              Number(
                item.height || 0
              ),
          0
        );

      const response =
        await fetch(
          `${API_URL}/loads/${selectedLoad.id}/optimization`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                status:
                  result.rejected
                    .length > 0
                    ? "warning"
                    : "optimized",

                total_weight_kg:
                  totalWeight,

                total_volume_m3:
                  totalVolume,

                center_of_gravity_x:
                  balance.center.x,

                center_of_gravity_y:
                  balance.center.y,

                center_of_gravity_z:
                  balance.center.z,

                report_path: "",
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail ===
            "string"
            ? data.detail
            : "No se pudo guardar la optimización."
        );
      }

      setSelectedLoad(data);

      setLoads((current) =>
        current.map((load) =>
          load.id === data.id
            ? data
            : load
        )
      );
    } catch (saveError) {
      setError(
        saveError.message
      );
    } finally {
      setSavingOptimization(
        false
      );
    }
  }

  function handleUnitTypeChange(
    event
  ) {
    setUnitType(
      event.target.value
    );

    setSelectedUnitId("");

    setOptimizationResult({
      placed: [],
      rejected: [],
    });

    setIntelligentResult(null);
  }

  function handleAddProduct() {
    setError("");

    const product =
      products.find(
        (item) =>
          String(item.id) ===
          String(
            selectedProductId
          )
      );

    const numericQuantity =
      Number(quantity);

    if (!product) {
      setError(
        "Selecciona un producto."
      );

      return;
    }

    if (
      !Number.isInteger(
        numericQuantity
      ) ||
      numericQuantity <= 0
    ) {
      setError(
        "La cantidad debe ser mayor que cero."
      );

      return;
    }

    setSelectedItems(
      (currentItems) => {
        const existingItem =
          currentItems.find(
            (item) =>
              item.product.id ===
              product.id
          );

        if (existingItem) {
          return currentItems.map(
            (item) =>
              item.product.id ===
              product.id
                ? {
                    ...item,

                    quantity:
                      item.quantity +
                      numericQuantity,
                  }
                : item
          );
        }

        return [
          ...currentItems,
          {
            product,
            quantity:
              numericQuantity,
          },
        ];
      }
    );

    setSelectedProductId("");
    setQuantity(1);
  }

  function handleRemoveProduct(
    productId
  ) {
    setSelectedItems(
      (currentItems) =>
        currentItems.filter(
          (item) =>
            item.product.id !==
            productId
        )
    );

    setOptimizationResult({
      placed: [],
      rejected: [],
    });

    setIntelligentResult(null);
  }

  async function handleOptimize() {
    setError("");
    setIntelligentResult(null);

    if (!selectedCapacity) {
      setError(
        "Selecciona un vehículo o contenedor."
      );

      return;
    }

    if (
      selectedItems.length === 0
    ) {
      setError(
        "Agrega al menos un producto."
      );

      return;
    }

    const result =
      arrangeProducts(
        selectedCapacity,
        selectedItems
      );

    setOptimizationResult(
      result
    );

    resetHistory(
      result
    );

    if (selectedLoad) {
      await saveOptimizationResult(
        result
      );

      await savePlan(
        result,
        true
      );

      setPlanMessage(
        "Optimización y plan guardados."
      );
    }
  }

  async function handleIntelligentOptimize() {
    setError("");
    setPlanMessage("");
    setRunningIntelligent(true);

    if (!selectedCapacity) {
      setError(
        "Selecciona un vehículo o contenedor."
      );

      setRunningIntelligent(false);

      return;
    }

    if (
      selectedItems.length === 0
    ) {
      setError(
        "Agrega al menos un producto."
      );

      setRunningIntelligent(false);

      return;
    }
const selectedCargoWeight =
  selectedItems.reduce(
    (total, item) =>
      total +
      Number(
        item.product?.weight_kg || 0
      ) *
        Number(item.quantity || 0),
    0
  );

const vehicleTare =
  Number(
    selectedCapacity?.tare_weight_kg || 0
  );

const maxPayload =
  Number(
    selectedCapacity?.max_payload_kg || 0
  );

const maxGross =
  Number(
    selectedCapacity?.max_gross_weight_kg || 0
  );

const frontAxleMax =
  Number(
    selectedCapacity?.front_axle_max_kg || 0
  );

const rearAxleMax =
  Number(
    selectedCapacity?.rear_axle_max_kg || 0
  );

const frontAxleTare =
  Number(
    selectedCapacity?.front_axle_tare_kg || 0
  );

const rearAxleTare =
  Number(
    selectedCapacity?.rear_axle_tare_kg || 0
  );

const grossWeight =
  vehicleTare +
  selectedCargoWeight;

const availableAxleCapacity =
  Math.max(
    0,
    frontAxleMax -
      frontAxleTare
  ) +
  Math.max(
    0,
    rearAxleMax -
      rearAxleTare
  );

const impossibleReasons = [];

if (
  maxPayload > 0 &&
  selectedCargoWeight >
    maxPayload
) {
  impossibleReasons.push(
    `La mercadería supera la carga útil máxima por ${(
      selectedCargoWeight -
      maxPayload
    ).toFixed(0)} kg.`
  );
}

if (
  maxGross > 0 &&
  grossWeight >
    maxGross
) {
  impossibleReasons.push(
    `El peso bruto supera el máximo permitido por ${(
      grossWeight -
      maxGross
    ).toFixed(0)} kg.`
  );
}

if (
  frontAxleMax > 0 &&
  rearAxleMax > 0 &&
  selectedCargoWeight >
    availableAxleCapacity
) {
  impossibleReasons.push(
    `Los ejes no tienen capacidad suficiente. Faltan ${(
      selectedCargoWeight -
      availableAxleCapacity
    ).toFixed(0)} kg.`
  );
}

if (
  impossibleReasons.length >
  0
) {
  setError(
    `Carga físicamente imposible. ${impossibleReasons.join(
      " "
    )}`
  );

  setRunningIntelligent(false);

  return;
}
    await new Promise(
      (resolve) =>
        window.setTimeout(
          resolve,
          60
        )
    );

    try {
      const result =
        runIntelligentOptimization(
          selectedCapacity,
          selectedItems
        );

      const cleanResult = {
        placed:
          result.placed,

        rejected:
          result.rejected,
      };

      setOptimizationResult(
        cleanResult
      );

      setIntelligentResult(
        result.intelligence
      );

      resetHistory(
        cleanResult
      );

      if (selectedLoad) {
        await saveOptimizationResult(
          cleanResult
        );

        await savePlan(
          cleanResult,
          true
        );

        setPlanMessage(
          "Optimización inteligente y plan guardados."
        );
      }
    } catch (optimizationError) {
      setError(
        optimizationError?.message ||
          "No se pudo completar la optimización inteligente."
      );
    } finally {
      setRunningIntelligent(false);
    }
  }

  useEffect(() => {
    function handleEditorShortcuts(
      event
    ) {
      const activeElement =
        document.activeElement;

      const isWriting =
        activeElement?.tagName ===
          "INPUT" ||
        activeElement?.tagName ===
          "TEXTAREA" ||
        activeElement?.tagName ===
          "SELECT";

      if (isWriting) return;

      if (
        event.ctrlKey &&
        event.key.toLowerCase() ===
          "z"
      ) {
        event.preventDefault();

        event.shiftKey
          ? redoPlanChange()
          : undoPlanChange();
      }

      if (
        event.ctrlKey &&
        event.key.toLowerCase() ===
          "y"
      ) {
        event.preventDefault();
        redoPlanChange();
      }
    }

    window.addEventListener(
      "keydown",
      handleEditorShortcuts
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleEditorShortcuts
      );
  }, [historyIndex]);

  function handleGenerateReport() {
    if (
      !selectedCapacity ||
      activePlacedItems.length === 0
    ) {
      setError(
        "Primero selecciona una unidad y deja al menos un bulto dentro del contenedor."
      );

      return;
    }

    const client =
      selectedLoad?.client_name ||
      window.prompt(
        "Nombre del cliente:",
        "INMOVE"
      ) ||
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
      ) ||
      "Plan de carga";

    const declaredTare =
      Number(
        selectedCapacity
          .tare_weight_kg ??
          selectedCapacity
            .empty_weight_kg ??
          selectedCapacity
            .own_weight_kg ??
          selectedCapacity
            .vehicle_weight_kg ??
          selectedCapacity
            .container_weight_kg ??
          0
      );

    const tareWeight =
      Math.max(
        0,
        Number.isFinite(
          declaredTare
        )
          ? declaredTare
          : 0
      );

    if (tareWeight <= 0) {
      setError(
        "La unidad seleccionada no tiene tara registrada. Editá el vehículo o contenedor y cargá la tara antes de generar el informe."
      );

      return;
    }

    const grossWeight =
      usedWeight +
      tareWeight;

    let viewerImage = "";

    try {
      const canvas =
        document.querySelector(
          ".load-viewer-3d canvas"
        );

      if (canvas) {
        viewerImage =
          canvas.toDataURL(
            "image/png",
            1
          );
      }
    } catch (captureError) {
      console.warn(
        "No se pudo capturar la vista 3D:",
        captureError
      );
    }

    generateLoadReport({
      client,
      project,
      unitType,

      capacity:
        selectedCapacity,

      placedItems:
        activePlacedItems,

      rejectedItems:
        optimizationResult.rejected,

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

      logistics:
        selectedLoad
          ? {
              reference:
                selectedLoad.reference,

              bookingNumber:
                selectedLoad.booking_number,

              vesselName:
                selectedLoad.vessel_name,

              voyageNumber:
                selectedLoad.voyage_number,

              loadingPort:
                selectedLoad.loading_port,

              destinationPort:
                selectedLoad.destination_port,

              loadingDate:
                selectedLoad.loading_date,

              sailingDate:
                selectedLoad.sailing_date,

              carrierName:
                selectedLoad.carrier_name,

              operatorName:
                selectedLoad.operator_name,

              notes:
                selectedLoad.notes,
            }
          : {},
    });
  }

  return (
    <main className="optimizer-page">
      <div className="page-heading">
        <div>
          <h1>
            Optimizador de carga
          </h1>

          <p>
            Configura la unidad y los productos para generar una distribución automática.
          </p>
        </div>
      </div>

      {error && (
        <div className="form-error">
          {error}
        </div>
      )}

      {planMessage && (
        <div className="plan-success-message">
          {planMessage}
        </div>
      )}

      <div className="optimizer-layout">
        <section className="optimizer-card">
          <h2>
            Configurar optimización
          </h2>

          <label>
            Orden de carga

            <select
              value={selectedLoadId}
              onChange={
                handleLoadSelection
              }
            >
              <option value="">
                Modo manual / seleccionar orden
              </option>

              {loads.map(
                (load) => (
                  <option
                    key={load.id}
                    value={load.id}
                  >
                    {load.reference}

                    {load.client_name
                      ? ` · ${load.client_name}`
                      : ""}

                    {load.status
                      ? ` · ${load.status}`
                      : ""}
                  </option>
                )
              )}
            </select>
          </label>

          {selectedLoad && (
            <div className="load-order-summary">
              <strong>
                {selectedLoad.reference}
              </strong>

              <span>
                Cliente:{" "}
                {selectedLoad.client_name ||
                  "—"}
              </span>

              <span>
                Proyecto:{" "}
                {selectedLoad.project_name ||
                  "—"}
              </span>

              <span>
                Estado:{" "}
                {selectedLoad.status ||
                  "pending"}
              </span>

              {selectedLoad.booking_number && (
                <span>
                  Booking:{" "}
                  {
                    selectedLoad.booking_number
                  }
                </span>
              )}

              {(selectedLoad.loading_port ||
                selectedLoad.destination_port) && (
                <span>
                  Ruta:{" "}
                  {selectedLoad.loading_port ||
                    "—"}{" "}
                  →{" "}
                  {selectedLoad.destination_port ||
                    "—"}
                </span>
              )}

              {selectedLoad.vessel_name && (
                <span>
                  Buque:{" "}
                  {
                    selectedLoad.vessel_name
                  }

                  {selectedLoad.voyage_number
                    ? ` · Viaje ${selectedLoad.voyage_number}`
                    : ""}
                </span>
              )}

              <button
                type="button"
                className="plan-secondary-button"
                onClick={() =>
                  onEditLoad?.(
                    selectedLoad.id
                  )
                }
                style={{
                  marginTop: 8,
                }}
              >
                ✏️ Editar datos y productos de la orden
              </button>
            </div>
          )}

          <label>
            Tipo de unidad

            <select
              value={unitType}
              onChange={
                handleUnitTypeChange
              }
              disabled={
                Boolean(
                  selectedLoad
                )
              }
            >
              <option value="container">
                Contenedor
              </option>

              <option value="vehicle">
                Vehículo
              </option>
            </select>
          </label>

          <label>
            Unidad disponible

            <select
              value={
                selectedUnitId
              }
              onChange={(event) =>
                setSelectedUnitId(
                  event.target.value
                )
              }
              disabled={
                Boolean(
                  selectedLoad
                )
              }
            >
              <option value="">
                Seleccionar unidad
              </option>

              {availableUnits.map(
                (unit) => (
                  <option
                    key={unit.id}
                    value={unit.id}
                  >
                    {unit.name ||
                      unit.plate ||
                      `Unidad ${unit.id}`}
                  </option>
                )
              )}
            </select>
          </label>

          {!selectedLoad && (
            <div className="optimizer-product-form">
              <label>
                Producto

                <select
                  value={
                    selectedProductId
                  }
                  onChange={(event) =>
                    setSelectedProductId(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Seleccionar producto
                  </option>

                  {products.map(
                    (product) => (
                      <option
                        key={product.id}
                        value={product.id}
                      >
                        {
                          product.name
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Cantidad

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={
                    quantity
                  }
                  onChange={(event) =>
                    setQuantity(
                      event.target.value
                    )
                  }
                />
              </label>

              <button
                type="button"
                className="primary-button"
                onClick={
                  handleAddProduct
                }
              >
                Agregar producto
              </button>
            </div>
          )}

          <div className="selected-products">
            <div className="section-title-row">
              <h3>
                Productos seleccionados
              </h3>

              <span>
                {totalSelectedUnits} unidades
              </span>
            </div>

            {selectedItems.length ===
            0 ? (
              <p className="empty-message">
                Todavía no agregaste productos.
              </p>
            ) : (
              selectedItems.map(
                (item) => (
                  <div
                    key={
                      item.product.id
                    }
                    className="selected-product-row"
                  >
                    <div>
                      <strong>
                        {
                          item.product
                            .name
                        }
                      </strong>

                      <span>
                        {
                          item.quantity
                        }{" "}
                        unidades
                      </span>
                    </div>

                    <button
                      type="button"
                      className="danger-button"
                      onClick={() =>
                        handleRemoveProduct(
                          item.product.id
                        )
                      }
                      disabled={
                        Boolean(
                          selectedLoad
                        )
                      }
                    >
                      Quitar
                    </button>
                  </div>
                )
              )
            )}
          </div>

          <button
            type="button"
            className="optimize-button"
            onClick={
              handleOptimize
            }
          >
            {savingOptimization
              ? "Guardando resultado..."
              : selectedLoad
                ? "Optimizar orden"
                : "Optimizar carga"}
          </button>

          <button
            type="button"
            className="intelligent-optimize-button"
            onClick={
              handleIntelligentOptimize
            }
            disabled={
              runningIntelligent ||
              savingOptimization
            }
          >
            {runningIntelligent
              ? "🧠 Comparando estrategias..."
              : "🧠 Optimización inteligente"}
          </button>

          <small className="intelligent-optimize-help">
            Compara Compacta,
            Balanceada, Pesados primero
            y Apilado eficiente, y
            selecciona automáticamente
            la mejor solución.
          </small>
        </section>

        <section className="optimizer-viewer-card">
          <div className="section-title-row">
            <div>
              <h2>
                Vista 3D de la carga
              </h2>

              <p>
                Arrastra con el mouse para rotar y usa la rueda para acercar.
              </p>
            </div>

            <div className="plan-toolbar-actions">
              <button
                type="button"
                className="editor-history-button"
                onClick={
                  undoPlanChange
                }
                disabled={
                  historyIndex <= 0
                }
              >
                ↶ Deshacer
              </button>

              <button
                type="button"
                className="editor-history-button"
                onClick={
                  redoPlanChange
                }
                disabled={
                  historyIndex < 0 ||
                  historyIndex >=
                    historyRef.current
                      .length -
                      1
                }
              >
                ↷ Rehacer
              </button>

              {selectedLoad?.plan_data && (
                <button
                  type="button"
                  className="plan-secondary-button"
                  onClick={
                    handleReopenPlan
                  }
                >
                  👁 Reabrir plan
                </button>
              )}

              {selectedLoad && (
                <button
                  type="button"
                  className="plan-secondary-button"
                  onClick={
                    handleReoptimize
                  }
                  disabled={
                    savingOptimization
                  }
                >
                  🔄 Reoptimizar
                </button>
              )}
              {activePlacedItems.length > 0 && (
  <button
    type="button"
    className="intelligent-optimize-button"
    onClick={handleIntelligentReoptimize}
    disabled={
      runningIntelligent ||
      savingOptimization
    }
  >
    {runningIntelligent
      ? "🧠 Reoptimizando..."
      : "🧠 Reoptimizar IA"}
  </button>
)}

              <button
                type="button"
                className="plan-save-button"
                onClick={() =>
                  savePlan()
                }
                disabled={
                  !selectedLoad ||
                  optimizationResult
                    .placed.length ===
                    0 ||
                  savingPlan
                }
              >
                {savingPlan
                  ? "Guardando..."
                  : "💾 Guardar plan"}
              </button>

              <button
                type="button"
                className="report-button"
                onClick={
                  handleGenerateReport
                }
                disabled={
                  !selectedCapacity ||
                  activePlacedItems.length ===
                    0
                }
              >
                📄 Generar informe
              </button>
            </div>
          </div>

          {intelligentResult && (
  <section className="intelligent-result-card">
    <div className="intelligent-result-header">
      <div>
        <span>
          MEJOR ESTRATEGIA
        </span>

        <strong>
          {intelligentResult.strategyName}
        </strong>

        <small>
          {intelligentResult.strategyDescription}
        </small>
      </div>

      <div className="intelligent-result-score">
        <b>
          {intelligentResult.qualityScore.toFixed(0)}
        </b>

        <small>
          /100
        </small>
      </div>
    </div>

    <div className="intelligent-result-stats">
      <div>
        <span>
          Alternativas
        </span>

        <strong>
          {intelligentResult.alternativesAnalyzed}
        </strong>
      </div>

      <div>
        <span>
          Colocados
        </span>

        <strong>
          {intelligentResult?.metrics?.placedCount}
        </strong>
      </div>

      <div>
        <span>
          Rechazados
        </span>

        <strong>
          {intelligentResult?.metrics?.rejectedCount}
        </strong>
      </div>

      <div>
        <span>
          Volumen
        </span>

        <strong>
          {intelligentResult?.metrics?.volumePercentage.toFixed(1)}%
        </strong>
      </div>
    </div>

    {intelligentResult?.metrics?.feasibilityStatus ===
      "impossible" && (
      <div
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 10,
          border: "1px solid #fecaca",
          background: "#fef2f2",
        }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: 16,
            marginBottom: 8,
          }}
        >
          🔴 Carga físicamente imposible
        </div>

        <div
          style={{
            fontSize: 13,
            marginBottom: 10,
          }}
        >
          La mercadería excede uno o más límites físicos de la unidad.
          Redistribuirla no puede solucionar estos excesos.
        </div>

        {Array.isArray(
          intelligentResult?.metrics?.impossibleReasons
        ) &&
          intelligentResult?.metrics?.impossibleReasons.length > 0 && (
            <div
              style={{
                display: "grid",
                gap: 6,
              }}
            >
              {intelligentResult?.metrics?.impossibleReasons.map(
                (reason, index) => (
                  <div
                    key={`${reason}-${index}`}
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    ⚠️ {reason}
                  </div>
                )
              )}
            </div>
          )}

        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: "1px solid #fecaca",
            fontSize: 12,
          }}
        >
          Mercadería:{" "}
          <strong>
            {Number(
              intelligentResult?.metrics?.totalWeight || 0
            ).toLocaleString("es-UY")}{" "}
            kg
          </strong>

          {" · "}

          Peso bruto:{" "}
          <strong>
            {Number(
              intelligentResult?.metrics?.grossWeight || 0
            ).toLocaleString("es-UY")}{" "}
            kg
          </strong>

          {" · "}

          Capacidad disponible de ejes:{" "}
          <strong>
            {Number(
              intelligentResult?.metrics?.axleCargoCapacity || 0
            ).toLocaleString("es-UY")}{" "}
            kg
          </strong>
        </div>
      </div>
    )}

    {intelligentResult?.metrics?.feasibilityStatus ===
      "redistribute" && (
      <div
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 10,
          border: "1px solid #fde68a",
          background: "#fffbeb",
        }}
      >
        <div
          style={{
            fontWeight: 800,
            marginBottom: 6,
          }}
        >
          🟡 Carga viable — requiere redistribución
        </div>

        <div
          style={{
            fontSize: 13,
          }}
        >
          El peso total puede transportarse, pero la distribución actual
          sobrecarga al menos uno de los ejes.
        </div>
      </div>
    )}

    {intelligentResult?.metrics?.feasibilityStatus ===
      "feasible" && (
      <div
        style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 10,
          border: "1px solid #bbf7d0",
          background: "#f0fdf4",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        🟢 Carga físicamente viable
      </div>
    )}
  </section>
)}

              {intelligentResult?.metrics
                ?.feasibilityStatus ===
                "redistribute" && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 16,
                    borderRadius: 10,
                    border:
                      "1px solid #fde68a",
                    background:
                      "#fffbeb",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      marginBottom: 6,
                    }}
                  >
                    🟡 Carga viable — requiere redistribución
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                    }}
                  >
                    El peso total puede transportarse,
                    pero la distribución actual
                    sobrecarga al menos uno de los
                    ejes. La Optimización Inteligente
                    debe buscar una posición
                    longitudinal más favorable.
                  </div>
                </div>
              )}

              {intelligentResult?.metrics
                ?.feasibilityStatus ===
                "feasible" && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 10,
                    border:
                      "1px solid #bbf7d0",
                    background:
                      "#f0fdf4",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  🟢 Carga físicamente viable
                </div>
              )}
              
          <LoadViewer3D
            capacity={
              selectedCapacity
            }

            placedItems={
              optimizationResult.placed
            }

            onItemsChange={(
              newPlacedItems
            ) => {
              const nextResult = {
                ...optimizationResult,

                placed:
                  newPlacedItems,
              };

              setOptimizationResult(
                nextResult
              );

              pushHistory(
                nextResult
              );

              if (selectedLoad) {
                window.clearTimeout(
                  window.__gerbarPlanSaveTimer
                );

                window.__gerbarPlanSaveTimer =
                  window.setTimeout(
                    () => {
                      savePlan(
                        nextResult,
                        true
                      );
                    },
                    900
                  );
              }
            }}
          />

          {optimizationResult.placed.length >
            0 && (
            <div className="product-legend">
              <h3>
                Referencias de productos
              </h3>

              <div className="product-legend-list">
                {Array.from(
                  new Map(
                    optimizationResult.placed.map(
                      (item) => [
                        item.product.id,
                        item,
                      ]
                    )
                  ).values()
                ).map((item) => (
                  <div
                    key={
                      item.product.id
                    }
                    className="product-legend-item"
                  >
                    <span
                      className="product-legend-color"
                      style={{
                        backgroundColor:
                          item.color,
                      }}
                    />

                    <span>
                      {
                        item.product
                          .name
                      }

                      {item.standby
                        ? " · STAND BY"
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {standbyItems.length >
            0 && (
            <div className="standby-warning">
              ⚠️ Hay{" "}
              {standbyItems.length}{" "}
              bulto
              {standbyItems.length ===
              1
                ? ""
                : "s"}{" "}
              en stand by fuera de la
              unidad. Reingresalos
              antes de cerrar el plan
              definitivo.
            </div>
          )}

          <div className="optimizer-stats">
            <div>
              <span>
                Productos colocados
              </span>

              <strong>
                {
                  activePlacedItems.length
                }
              </strong>
            </div>

            <div>
              <span>
                Productos rechazados
              </span>

              <strong>
                {
                  optimizationResult
                    .rejected.length
                }
              </strong>
            </div>

            <div>
              <span>
                Bultos en stand by
              </span>

              <strong>
                {
                  standbyItems.length
                }
              </strong>
            </div>

            <div className="usage-stat">
              <div className="usage-stat-header">
                <span>
                  Volumen utilizado
                </span>

                <strong>
                  {volumePercentage.toFixed(
                    1
                  )}
                  %
                </strong>
              </div>

              <div className="usage-progress">
                <div
                  className="usage-progress-fill"
                  style={{
                    width: `${volumePercentage}%`,
                  }}
                />
              </div>

              <small>
                {usedVolume.toFixed(
                  2
                )}{" "}
                m³ de{" "}
                {containerVolume.toFixed(
                  2
                )}{" "}
                m³
              </small>
            </div>

            <div className="usage-stat">
              <div className="usage-stat-header">
                <span>
                  Peso utilizado
                </span>

                <strong>
                  {maximumWeight
                    ? `${weightPercentage.toFixed(
                        1
                      )}%`
                    : "Sin límite"}
                </strong>
              </div>

              <div className="usage-progress">
                <div
                  className="usage-progress-fill"
                  style={{
                    width: `${maximumWeight
                      ? weightPercentage
                      : 0}%`,
                  }}
                />
              </div>

              <small>
                {usedWeight.toFixed(
                  0
                )}{" "}
                kg

                {maximumWeight
                  ? ` de ${maximumWeight.toFixed(
                      0
                    )} kg`
                  : ""}
              </small>
            </div>
          </div>

          {activePlacedItems.length >
            0 && (
            <section className="weight-balance-card">
              <div className="weight-balance-header">
                <div>
                  <span className="weight-balance-eyebrow">
                    DISTRIBUCIÓN DE PESO
                  </span>

                  <h3>
                    Balance de la carga
                  </h3>
                </div>

                <div
                  className={`weight-balance-status ${
                    weightBalance
                      ?.warnings
                      ?.length >
                    0
                      ? "weight-balance-status-warning"
                      : "weight-balance-status-ok"
                  }`}
                >
                  {weightBalance
                    ?.warnings
                    ?.length >
                  0
                    ? "⚠️ Revisar"
                    : "✓ Equilibrada"}
                </div>
              </div>

              <div className="weight-balance-layout">
                <div className="weight-balance-distribution">
                  <div className="balance-axis">
                    <div className="balance-axis-title">
                      <span>
                        Distribución longitudinal
                      </span>
                    </div>

                    <div className="balance-values">
                      <span>
                        Frente{" "}
                        <strong>
                          {Number(
                            weightBalance
                              ?.distribution
                              ?.front ||
                              0
                          ).toFixed(
                            1
                          )}
                          %
                        </strong>
                      </span>

                      <span>
                        Fondo{" "}
                        <strong>
                          {Number(
                            weightBalance
                              ?.distribution
                              ?.back ||
                              0
                          ).toFixed(
                            1
                          )}
                          %
                        </strong>
                      </span>
                    </div>

                    <div className="balance-bar">
                      <div
                        className="balance-bar-primary"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              Number(
                                weightBalance
                                  ?.distribution
                                  ?.front ||
                                  0
                              )
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="balance-axis">
                    <div className="balance-axis-title">
                      <span>
                        Distribución lateral
                      </span>
                    </div>

                    <div className="balance-values">
                      <span>
                        Izquierda{" "}
                        <strong>
                          {Number(
                            weightBalance
                              ?.distribution
                              ?.left ||
                              0
                          ).toFixed(
                            1
                          )}
                          %
                        </strong>
                      </span>

                      <span>
                        Derecha{" "}
                        <strong>
                          {Number(
                            weightBalance
                              ?.distribution
                              ?.right ||
                              0
                          ).toFixed(
                            1
                          )}
                          %
                        </strong>
                      </span>
                    </div>

                    <div className="balance-bar">
                      <div
                        className="balance-bar-primary"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              Number(
                                weightBalance
                                  ?.distribution
                                  ?.left ||
                                  0
                              )
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="center-gravity-panel">
                  <span className="center-gravity-title">
                    CENTRO DE GRAVEDAD
                  </span>

                  <div className="center-gravity-grid">
                    <div>
                      <span>
                        X · Largo
                      </span>

                      <strong>
                        {Number(
                          weightBalance
                            ?.center
                            ?.x ||
                            0
                        ).toFixed(
                          2
                        )}{" "}
                        m
                      </strong>
                    </div>

                    <div>
                      <span>
                        Y · Ancho
                      </span>

                      <strong>
                        {Number(
                          weightBalance
                            ?.center
                            ?.y ||
                            0
                        ).toFixed(
                          2
                        )}{" "}
                        m
                      </strong>
                    </div>

                    <div>
                      <span>
                        Z · Altura
                      </span>

                      <strong>
                        {Number(
                          weightBalance
                            ?.center
                            ?.z ||
                            0
                        ).toFixed(
                          2
                        )}{" "}
                        m
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {unitType === "vehicle" &&
                weightBalance?.axleLoads
                  ?.configured && (
                  <section
                    style={{
                      marginTop: 18,
                      padding: 16,
                      border:
                        "1px solid #dbe3ee",
                      borderRadius: 10,
                      background:
                        "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                        gap: 12,
                        marginBottom:
                          14,
                      }}
                    >
                      <div>
                        <span
                          style={{
                            display:
                              "block",
                            fontSize:
                              11,
                            fontWeight:
                              700,
                            color:
                              "#64748b",
                          }}
                        >
                          DISTRIBUCIÓN POR EJES
                        </span>

                        <h3
                          style={{
                            margin:
                              "3px 0 0",
                          }}
                        >
                          Carga transmitida por la mercadería
                        </h3>
                      </div>

                      <span
                        style={{
                          fontSize:
                            12,
                          color:
                            "#64748b",
                        }}
                      >
                        Distancia entre ejes:{" "}
                        {Number(
                          weightBalance
                            .axleLoads
                            .wheelbase ||
                            0
                        ).toFixed(
                          2
                        )}{" "}
                        m
                      </span>
                    </div>

                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "repeat(2, minmax(0, 1fr))",
                        gap: 14,
                      }}
                    >
                      <div
                        style={{
                          padding:
                            14,
                          border:
                            "1px solid #dbe3ee",
                          borderRadius:
                            9,
                          background:
                            "#ffffff",
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            alignItems:
                              "center",
                            marginBottom:
                              8,
                          }}
                        >
                          <strong>
                            Eje delantero
                          </strong>

                          <span>
                            {weightBalance
                              .axleLoads
                              .frontOverloaded
                              ? "🔴 Sobrecarga"
                              : Number(
                                    weightBalance
                                      .axleLoads
                                      .frontUsagePercent ||
                                      0
                                  ) >=
                                  90
                                ? "🟡 Alto"
                                : "🟢 Correcto"}
                          </span>
                        </div>

                        <div className="usage-progress">
                          <div
                            className="usage-progress-fill"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  0,
                                  Number(
                                    weightBalance
                                      .axleLoads
                                      .frontUsagePercent ||
                                      0
                                  )
                                )
                              )}%`,
                            }}
                          />
                        </div>

                        <div
                          style={{
                            marginTop:
                              9,
                          }}
                        >
                          <strong
                            style={{
                              fontSize:
                                18,
                            }}
                          >
                            {Number(
                              weightBalance
                                .axleLoads
                                .frontCargoLoad ||
                                0
                            ).toLocaleString(
                              "es-UY",
                              {
                                maximumFractionDigits:
                                  0,
                              }
                            )}{" "}
                            kg
                          </strong>

                          {Number(
                            weightBalance
                              .axleLoads
                              .frontMax ||
                              0
                          ) >
                            0 && (
                            <span
                              style={{
                                display:
                                  "block",
                                marginTop:
                                  3,
                                color:
                                  "#64748b",
                              }}
                            >
                              Máximo configurado:{" "}
                              {Number(
                                weightBalance
                                  .axleLoads
                                  .frontMax
                              ).toLocaleString(
                                "es-UY",
                                {
                                  maximumFractionDigits:
                                    0,
                                }
                              )}{" "}
                              kg
                            </span>
                          )}

                          {Number(
                            weightBalance
                              .axleLoads
                              .frontMax ||
                              0
                          ) >
                            0 && (
                            <span
                              style={{
                                display:
                                  "block",
                                marginTop:
                                  3,
                              }}
                            >
                              Utilización:{" "}
                              <strong>
                                {Number(
                                  weightBalance
                                    .axleLoads
                                    .frontUsagePercent ||
                                    0
                                ).toFixed(
                                  1
                                )}
                                %
                              </strong>
                            </span>
                          )}

                          {weightBalance
                            .axleLoads
                            .frontOverloaded && (
                            <div
                              style={{
                                marginTop:
                                  8,
                                fontWeight:
                                  700,
                              }}
                            >
                              ⚠️ Exceso:{" "}
                              {Number(
                                weightBalance
                                  .axleLoads
                                  .frontOverload ||
                                  0
                              ).toLocaleString(
                                "es-UY",
                                {
                                  maximumFractionDigits:
                                    0,
                                }
                              )}{" "}
                              kg
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          padding:
                            14,
                          border:
                            "1px solid #dbe3ee",
                          borderRadius:
                            9,
                          background:
                            "#ffffff",
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            alignItems:
                              "center",
                            marginBottom:
                              8,
                          }}
                        >
                          <strong>
                            Eje trasero
                          </strong>

                          <span>
                            {weightBalance
                              .axleLoads
                              .rearOverloaded
                              ? "🔴 Sobrecarga"
                              : Number(
                                    weightBalance
                                      .axleLoads
                                      .rearUsagePercent ||
                                      0
                                  ) >=
                                  90
                                ? "🟡 Alto"
                                : "🟢 Correcto"}
                          </span>
                        </div>

                        <div className="usage-progress">
                          <div
                            className="usage-progress-fill"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  0,
                                  Number(
                                    weightBalance
                                      .axleLoads
                                      .rearUsagePercent ||
                                      0
                                  )
                                )
                              )}%`,
                            }}
                          />
                        </div>

                        <div
                          style={{
                            marginTop:
                              9,
                          }}
                        >
                          <strong
                            style={{
                              fontSize:
                                18,
                            }}
                          >
                            {Number(
                              weightBalance
                                .axleLoads
                                .rearCargoLoad ||
                                0
                            ).toLocaleString(
                              "es-UY",
                              {
                                maximumFractionDigits:
                                  0,
                              }
                            )}{" "}
                            kg
                          </strong>

                          {Number(
                            weightBalance
                              .axleLoads
                              .rearMax ||
                              0
                          ) >
                            0 && (
                            <span
                              style={{
                                display:
                                  "block",
                                marginTop:
                                  3,
                                color:
                                  "#64748b",
                              }}
                            >
                              Máximo configurado:{" "}
                              {Number(
                                weightBalance
                                  .axleLoads
                                  .rearMax
                              ).toLocaleString(
                                "es-UY",
                                {
                                  maximumFractionDigits:
                                    0,
                                }
                              )}{" "}
                              kg
                            </span>
                          )}

                          {Number(
                            weightBalance
                              .axleLoads
                              .rearMax ||
                              0
                          ) >
                            0 && (
                            <span
                              style={{
                                display:
                                  "block",
                                marginTop:
                                  3,
                              }}
                            >
                              Utilización:{" "}
                              <strong>
                                {Number(
                                  weightBalance
                                    .axleLoads
                                    .rearUsagePercent ||
                                    0
                                ).toFixed(
                                  1
                                )}
                                %
                              </strong>
                            </span>
                          )}

                          {weightBalance
                            .axleLoads
                            .rearOverloaded && (
                            <div
                              style={{
                                marginTop:
                                  8,
                                fontWeight:
                                  700,
                              }}
                            >
                              ⚠️ Exceso:{" "}
                              {Number(
                                weightBalance
                                  .axleLoads
                                  .rearOverload ||
                                  0
                              ).toLocaleString(
                                "es-UY",
                                {
                                  maximumFractionDigits:
                                    0,
                                }
                              )}{" "}
                              kg
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop:
                          10,
                        fontSize:
                          12,
                        color:
                          "#64748b",
                      }}
                    >
                      ℹ️ Este cálculo representa la reacción producida por la mercadería cargada. Todavía no incluye la distribución de la tara del vehículo entre los ejes.
                    </div>
                  </section>
                )}

              {weightBalance
                ?.warnings
                ?.length > 0 ? (
                <div className="weight-balance-warnings">
                  {weightBalance.warnings.map(
                    (
                      warning,
                      index
                    ) => (
                      <div
                        key={`${warning}-${index}`}
                      >
                        ⚠️{" "}
                        {
                          warning
                        }
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="weight-balance-ok-message">
                  ✓ La distribución de peso se encuentra dentro de los parámetros de equilibrio.
                </div>
              )}
            </section>
          )}

          {optimizationResult.rejected.length >
            0 && (
            <div className="rejected-products">
              <h3>
                Productos sin espacio
              </h3>

              {optimizationResult.rejected.map(
                (
                  item,
                  index
                ) => (
                  <div
                    key={`${item.product.id}-${item.unit}-${index}`}
                    className="rejected-product-row"
                  >
                    <span>
                      {
                        item.product
                          .name
                      }{" "}
                      — unidad{" "}
                      {
                        item.unit
                      }
                    </span>

                    <small>
                      {
                        item.reason
                      }
                    </small>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}