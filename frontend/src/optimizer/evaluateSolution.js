function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
    length * width * height;

  let usedVolume = 0;
  let totalWeight = 0;

  let momentX = 0;
  let momentY = 0;
  let momentZ = 0;

  result.placed.forEach((item) => {
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

    usedVolume += itemVolume;
    totalWeight += weight;

    momentX +=
      weight * centerX;

    momentY +=
      weight * centerY;

    momentZ +=
      weight * centerZ;
  });

  const center =
    totalWeight > 0
      ? {
          x: momentX / totalWeight,
          y: momentY / totalWeight,
          z: momentZ / totalWeight,
        }
      : {
          x: length / 2,
          y: width / 2,
          z: 0,
        };

  const volumePercentage =
    capacityVolume > 0
      ? (usedVolume / capacityVolume) * 100
      : 0;

  const longitudinalDeviation =
    length > 0
      ? Math.abs(
          center.x - length / 2
        ) / length
      : 0;

  const lateralDeviation =
    width > 0
      ? Math.abs(
          center.y - width / 2
        ) / width
      : 0;

  const centerHeightRatio =
    height > 0
      ? center.z / height
      : 0;

  const placedCount =
    result.placed.length;

  const rejectedCount =
    result.rejected.length;

  /*
    -------------------------------------------------
    CONTROL DE EJES
    -------------------------------------------------

    Por ahora representa solamente la reacción
    producida por la mercadería.

    Todavía no incluye la tara repartida por eje.
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

  let axleConfigured = false;

  let frontAxleLoad = 0;
  let rearAxleLoad = 0;

  let frontAxleOverload = 0;
  let rearAxleOverload = 0;

  let frontAxleUsagePercent = 0;
  let rearAxleUsagePercent = 0;

  if (
    totalWeight > 0 &&
    Number.isFinite(frontAxlePosition) &&
    Number.isFinite(rearAxlePosition) &&
    rearAxlePosition >
      frontAxlePosition
  ) {
    axleConfigured = true;

    const wheelbase =
      rearAxlePosition -
      frontAxlePosition;

    /*
      Equilibrio estático:

      R trasero =
      Peso ×
      (Centro X - eje delantero)
      / distancia entre ejes

      R delantero =
      Peso - R trasero
    */

    rearAxleLoad =
      totalWeight *
      (
        (
          center.x -
          frontAxlePosition
        ) /
        wheelbase
      );

    frontAxleLoad =
      totalWeight -
      rearAxleLoad;

    /*
      No usamos reacciones negativas
      para puntuar una solución normal.
    */

    frontAxleLoad =
      Math.max(
        0,
        frontAxleLoad
      );

    rearAxleLoad =
      Math.max(
        0,
        rearAxleLoad
      );

    if (frontAxleMax > 0) {
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

    if (rearAxleMax > 0) {
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
    totalAxleOverload > 0;

  /*
    Penalizamos también acercarse demasiado
    al máximo del eje.

    Así, si tenemos dos soluciones legales,
    la IA prefiere la que deja más margen.
  */

  const frontAxleHighUsage =
    frontAxleMax > 0
      ? Math.max(
          0,
          frontAxleUsagePercent - 90
        )
      : 0;

  const rearAxleHighUsage =
    rearAxleMax > 0
      ? Math.max(
          0,
          rearAxleUsagePercent - 90
        )
      : 0;

  const axleHighUsagePenalty =
    frontAxleHighUsage +
    rearAxleHighUsage;

  /*
    -------------------------------------------------
    PUNTUACIÓN GENERAL
    -------------------------------------------------
  */

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
      Una sobrecarga real de eje tiene que
      ser muchísimo más costosa que una
      pequeña mejora geométrica.
    */
    totalAxleOverload *
      25_000 -

    /*
      También evitamos trabajar demasiado
      cerca del máximo cuando existe
      otra solución más holgada.
    */
    axleHighUsagePenalty *
      5_000;

  const axleQualityPenalty =
    axleOverloaded
      ? Math.min(
          70,
          30 +
            totalAxleOverload /
              100
        )
      : axleHighUsagePenalty *
        0.5;

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

          centerHeightRatio *
            20 -

          axleQualityPenalty
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

    totalWeight,

    center,

    longitudinalDeviation,
    lateralDeviation,
    centerHeightRatio,

    /*
      Métricas de ejes
    */

    axleConfigured,

    frontAxleLoad,
    rearAxleLoad,

    frontAxleMax,
    rearAxleMax,

    frontAxleUsagePercent,
    rearAxleUsagePercent,

    frontAxleOverload,
    rearAxleOverload,

    totalAxleOverload,
    axleOverloaded,

    axleHighUsagePenalty,
  };
}