function toNumber(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function getWeight(item) {
  return toNumber(
    item?.product?.weight_kg ??
      item?.weight_kg
  );
}

export function evaluateSolution({
  capacity,
  result,
  strategy,
}) {
  const length = toNumber(
    capacity?.internal_length_m
  );

  const width = toNumber(
    capacity?.internal_width_m
  );

  const height = toNumber(
    capacity?.internal_height_m
  );

  const capacityVolume =
    length *
    width *
    height;

  let usedVolume = 0;
  let totalWeight = 0;

  let momentX = 0;
  let momentY = 0;
  let momentZ = 0;
  /*
    Distribución lateral real del peso.

    Permite medir cuánto peso queda
    a la izquierda y cuánto a la derecha
    del centro de la unidad.
  */
  let leftWeight = 0;
  let rightWeight = 0;

  result.placed.forEach((item) => {
    if (item?.standby) {
      return;
    }

    const itemVolume =
      toNumber(item.length) *
      toNumber(item.width) *
      toNumber(item.height);

    const weight =
      getWeight(item);

    const centerX =
      toNumber(item.x) +
      toNumber(item.length) / 2;

    const centerY =
      toNumber(item.y) +
      toNumber(item.width) / 2;

    const centerZ =
      toNumber(item.z) +
      toNumber(item.height) / 2;

    usedVolume +=
      itemVolume;

    totalWeight +=
      weight;

    momentX +=
      weight *
      centerX;

    momentY +=
      weight *
      centerY;

    momentZ +=
      weight *
      centerZ;
          if (
      centerY <=
      width / 2
    ) {
      leftWeight +=
        weight;
    } else {
      rightWeight +=
        weight;
    }
  });

  const center =
    totalWeight > 0
      ? {
          x:
            momentX /
            totalWeight,

          y:
            momentY /
            totalWeight,

          z:
            momentZ /
            totalWeight,
        }
      : {
          x:
            length / 2,

          y:
            width / 2,

          z: 0,
        };

  const volumePercentage =
    capacityVolume > 0
      ? (
          usedVolume /
          capacityVolume
        ) *
        100
      : 0;

  const longitudinalDeviation =
    length > 0
      ? Math.abs(
          center.x -
            length / 2
        ) /
        length
      : 0;

  const lateralDeviation =
    width > 0
      ? Math.abs(
          center.y -
            width / 2
        ) /
        width
      : 0;

  const centerHeightRatio =
    height > 0
      ? center.z /
        height
      : 0;
  const lateralWeightDifference =
    totalWeight > 0
      ? Math.abs(
          leftWeight -
          rightWeight
        ) /
        totalWeight
      : 0;

  const leftWeightPercentage =
    totalWeight > 0
      ? (
          leftWeight /
          totalWeight
        ) *
        100
      : 0;

  const rightWeightPercentage =
    totalWeight > 0
      ? (
          rightWeight /
          totalWeight
        ) *
        100
      : 0;

  const activePlacedItems =
    result.placed.filter(
      (item) =>
        !item?.standby
    );

  const placedCount =
    activePlacedItems.length;

  const rejectedCount =
    result.rejected.length;

  /*
    ==========================================
    PESOS GENERALES DEL VEHÍCULO
    ==========================================
  */

  const vehicleTare =
    toNumber(
      capacity?.tare_weight_kg
    );

  const maxGrossWeight =
    toNumber(
      capacity?.max_gross_weight_kg
    );

  const maxPayload =
    toNumber(
      capacity?.max_payload_kg
    );

  const grossWeight =
    vehicleTare +
    totalWeight;

  const payloadOverload =
    maxPayload > 0
      ? Math.max(
          0,
          totalWeight -
            maxPayload
        )
      : 0;

  const grossOverload =
    maxGrossWeight > 0
      ? Math.max(
          0,
          grossWeight -
            maxGrossWeight
        )
      : 0;

  /*
    ==========================================
    CONTROL REAL DE EJES
    ==========================================
  */

  const frontAxlePosition =
    Number(
      capacity?.front_axle_position_m
    );

  const rearAxlePosition =
    Number(
      capacity?.rear_axle_position_m
    );

  const frontAxleMax =
    toNumber(
      capacity?.front_axle_max_kg
    );

  const rearAxleMax =
    toNumber(
      capacity?.rear_axle_max_kg
    );

  /*
    Peso propio soportado por cada eje
    con el vehículo vacío.
  */

  const frontAxleTare =
    toNumber(
      capacity?.front_axle_tare_kg
    );

  const rearAxleTare =
    toNumber(
      capacity?.rear_axle_tare_kg
    );

  const axleTareConfigured =
    frontAxleTare > 0 ||
    rearAxleTare > 0;

  const axleTareTotal =
    frontAxleTare +
    rearAxleTare;

  const axleTareDifference =
    axleTareConfigured &&
    vehicleTare > 0
      ? Math.abs(
          axleTareTotal -
            vehicleTare
        )
      : 0;

  /*
    Capacidad que queda disponible
    para mercadería en cada eje.
  */

  const frontCargoCapacity =
    frontAxleMax > 0
      ? Math.max(
          0,
          frontAxleMax -
            frontAxleTare
        )
      : 0;

  const rearCargoCapacity =
    rearAxleMax > 0
      ? Math.max(
          0,
          rearAxleMax -
            rearAxleTare
        )
      : 0;

  const axleCargoCapacity =
    frontCargoCapacity +
    rearCargoCapacity;

  const bothAxleLimitsConfigured =
    frontAxleMax > 0 &&
    rearAxleMax > 0;

  /*
    Esta es una validación GLOBAL.

    Si la mercadería pesa más que todo el
    margen disponible sumando ambos ejes,
    ninguna distribución longitudinal
    puede solucionar el problema.
  */

  const axleCapacityShortfall =
    bothAxleLimitsConfigured
      ? Math.max(
          0,
          totalWeight -
            axleCargoCapacity
        )
      : 0;

  const frontTareOverload =
    frontAxleMax > 0
      ? Math.max(
          0,
          frontAxleTare -
            frontAxleMax
        )
      : 0;

  const rearTareOverload =
    rearAxleMax > 0
      ? Math.max(
          0,
          rearAxleTare -
            rearAxleMax
        )
      : 0;

  let axleConfigured = false;

  /*
    Reacciones producidas por
    la mercadería.
  */

  let frontCargoAxleLoad = 0;
  let rearCargoAxleLoad = 0;

  /*
    Peso total real sobre los ejes.
  */

  let frontAxleLoad = 0;
  let rearAxleLoad = 0;

  let frontAxleOverload = 0;
  let rearAxleOverload = 0;

  let frontAxleUsagePercent = 0;
  let rearAxleUsagePercent = 0;

  let wheelbase = 0;

  if (
    totalWeight > 0 &&
    Number.isFinite(
      frontAxlePosition
    ) &&
    Number.isFinite(
      rearAxlePosition
    ) &&
    rearAxlePosition >
      frontAxlePosition
  ) {
    axleConfigured = true;

    wheelbase =
      rearAxlePosition -
      frontAxlePosition;

    /*
      Equilibrio estático de la mercadería.

      R trasero =
      W ×
      (CG - eje delantero)
      / distancia entre ejes

      R delantero =
      W - R trasero
    */

    rearCargoAxleLoad =
      totalWeight *
      (
        (
          center.x -
          frontAxlePosition
        ) /
        wheelbase
      );

    frontCargoAxleLoad =
      totalWeight -
      rearCargoAxleLoad;

    /*
      Para la evaluación normal
      evitamos mostrar cargas negativas.
    */

    frontCargoAxleLoad =
      Math.max(
        0,
        frontCargoAxleLoad
      );

    rearCargoAxleLoad =
      Math.max(
        0,
        rearCargoAxleLoad
      );

    /*
      Peso REAL:

      tara del eje
      +
      reacción de mercadería.
    */

    frontAxleLoad =
      axleTareConfigured
        ? frontAxleTare +
          frontCargoAxleLoad
        : frontCargoAxleLoad;

    rearAxleLoad =
      axleTareConfigured
        ? rearAxleTare +
          rearCargoAxleLoad
        : rearCargoAxleLoad;

    if (
      frontAxleMax > 0
    ) {
      frontAxleUsagePercent =
        (
          frontAxleLoad /
          frontAxleMax
        ) *
        100;

      frontAxleOverload =
        Math.max(
          0,
          frontAxleLoad -
            frontAxleMax
        );
    }

    if (
      rearAxleMax > 0
    ) {
      rearAxleUsagePercent =
        (
          rearAxleLoad /
          rearAxleMax
        ) *
        100;

      rearAxleOverload =
        Math.max(
          0,
          rearAxleLoad -
            rearAxleMax
        );
    }
  }

  const totalAxleOverload =
    frontAxleOverload +
    rearAxleOverload;

  const axleOverloaded =
    totalAxleOverload >
    0;

  /*
    ==========================================
    VIABILIDAD FÍSICA DE LA CARGA
    ==========================================

    Acá distinguimos:

    1) imposible por peso;
    2) imposible por capacidad total de ejes;
    3) viable pero mal distribuida;
    4) viable y correctamente distribuida.
  */

  const impossibleReasons = [];

  if (
    payloadOverload > 0
  ) {
    impossibleReasons.push(
      `La mercadería supera la carga útil máxima por ${payloadOverload.toFixed(
        0
      )} kg.`
    );
  }

  if (
    grossOverload > 0
  ) {
    impossibleReasons.push(
      `El peso bruto supera el máximo permitido por ${grossOverload.toFixed(
        0
      )} kg.`
    );
  }

  if (
    axleCapacityShortfall > 0
  ) {
    impossibleReasons.push(
      `Los ejes no tienen capacidad suficiente para esta mercadería. Faltan ${axleCapacityShortfall.toFixed(
        0
      )} kg de capacidad combinada.`
    );
  }

  if (
    frontTareOverload > 0
  ) {
    impossibleReasons.push(
      `El eje delantero ya supera su máximo con el vehículo vacío por ${frontTareOverload.toFixed(
        0
      )} kg.`
    );
  }

  if (
    rearTareOverload > 0
  ) {
    impossibleReasons.push(
      `El eje trasero ya supera su máximo con el vehículo vacío por ${rearTareOverload.toFixed(
        0
      )} kg.`
    );
  }

  const physicallyFeasible =
    impossibleReasons.length ===
    0;

  let feasibilityStatus =
    "feasible";

  if (
    !physicallyFeasible
  ) {
    feasibilityStatus =
      "impossible";
  } else if (
    axleOverloaded
  ) {
    /*
      Hay capacidad global suficiente,
      pero la distribución actual necesita
      mover peso longitudinalmente.
    */
    feasibilityStatus =
      "redistribute";
  }

  /*
    También penalizamos acercarnos
    demasiado al máximo del eje.
  */

  const frontAxleHighUsage =
    frontAxleMax > 0
      ? Math.max(
          0,
          frontAxleUsagePercent -
            90
        )
      : 0;

  const rearAxleHighUsage =
    rearAxleMax > 0
      ? Math.max(
          0,
          rearAxleUsagePercent -
            90
        )
      : 0;

  const axleHighUsagePenalty =
    frontAxleHighUsage +
    rearAxleHighUsage;

  /*
    ==========================================
    PUNTUACIÓN GENERAL
    ==========================================
  */

  const impossibleWeightPenalty =
    (
      payloadOverload +
      grossOverload +
      axleCapacityShortfall +
      frontTareOverload +
      rearTareOverload
    ) *
    100_000;

  const rawScore =
    placedCount *
      1_000_000 -

    rejectedCount *
      1_500_000 +

    volumePercentage *
      1_500 -

    longitudinalDeviation *
      120_000 -

    lateralDeviation *
      180_000 -

    centerHeightRatio *
      45_000 -

    /*
      Sobrecarga real según
      la distribución actual.
    */
    totalAxleOverload *
      30_000 -

    /*
      Evitamos trabajar demasiado
      cerca del límite.
    */
    axleHighUsagePenalty *
      6_000 -

    /*
      Penalización enorme para una carga
      físicamente imposible.
    */
    impossibleWeightPenalty -

    /*
      Tara incoherente.
    */
    axleTareDifference *
      100;

  const axleQualityPenalty =
    axleOverloaded
      ? Math.min(
          75,
          35 +
            totalAxleOverload /
              100
        )
      : axleHighUsagePenalty *
        0.5;

  const tareQualityPenalty =
    axleTareDifference >
      10
      ? Math.min(
          10,
          axleTareDifference /
            100
        )
      : 0;

  /*
    Si la carga es imposible,
    la calidad no debería presentarse
    como una buena solución.
  */

  const impossibleQualityPenalty =
    physicallyFeasible
      ? 0
      : 80;

    const qualityScore =
    Math.max(
      0,
      Math.min(
        100,

        100 -

          rejectedCount *
            20 -

          longitudinalDeviation *
            100 -

          lateralDeviation *
            150 -

          lateralWeightDifference *
            120 -

          centerHeightRatio *
            20 -

          axleQualityPenalty -

          tareQualityPenalty -

          impossibleQualityPenalty
      )
    );

  return {
    strategyId:
      strategy.id,

    strategyName:
      strategy.name,

    rawScore,
    qualityScore,

    placedCount,
    rejectedCount,

    usedVolume,
    volumePercentage,

    /*
      ======================================
      PESOS GENERALES
      ======================================
    */

    totalWeight,

    vehicleTare,

    grossWeight,
    maxGrossWeight,

    maxPayload,

    payloadOverload,
    grossOverload,

        center,

    longitudinalDeviation,
    lateralDeviation,

    lateralWeightDifference,
    leftWeightPercentage,
    rightWeightPercentage,

    centerHeightRatio,

    /*
      ======================================
      VIABILIDAD
      ======================================
    */

    physicallyFeasible,
    feasibilityStatus,
    impossibleReasons,

    /*
      ======================================
      MÉTRICAS DE EJES
      ======================================
    */

    axleConfigured,

    wheelbase,

    frontAxlePosition,
    rearAxlePosition,

    /*
      Reacción de la mercadería.
    */

    frontCargoAxleLoad,
    rearCargoAxleLoad,

    /*
      Tara soportada por eje.
    */

    frontAxleTare,
    rearAxleTare,

    axleTareConfigured,
    axleTareTotal,
    axleTareDifference,

    /*
      Capacidad disponible
      para mercadería.
    */

    frontCargoCapacity,
    rearCargoCapacity,

    axleCargoCapacity,
    axleCapacityShortfall,

    /*
      Peso real por eje.
    */

    frontAxleLoad,
    rearAxleLoad,

    frontAxleMax,
    rearAxleMax,

    frontAxleUsagePercent,
    rearAxleUsagePercent,

    frontAxleOverload,
    rearAxleOverload,

    frontTareOverload,
    rearTareOverload,

    totalAxleOverload,
    axleOverloaded,

    axleHighUsagePenalty,

    axleCalculationMode:
      axleTareConfigured
        ? "gross_axle_load"
        : "cargo_reaction",
  };
}