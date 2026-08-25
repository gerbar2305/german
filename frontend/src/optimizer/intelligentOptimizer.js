import compactStrategy from "./strategies/compactStrategy.js";
import balancedStrategy from "./strategies/balancedStrategy.js";
import heavyFirstStrategy from "./strategies/heavyFirstStrategy.js";
import stackingStrategy from "./strategies/stackingStrategy.js";

import { evaluateSolution } from "./evaluateSolution.js";

import {
  createInitialExtremePoints,
  updateExtremePoints,
} from "./extremePoints.js";

const EPSILON = 0.0001;

const COLORS = [
  "#2f58b1",
  "#16a34a",
  "#ea580c",
  "#9333ea",
  "#0891b2",
  "#dc2626",
  "#ca8a04",
  "#4f46e5",
];

const STRATEGIES = [
  compactStrategy,
  balancedStrategy,
  heavyFirstStrategy,
  stackingStrategy,
];

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getProductVolume(product) {
  return (
    toNumber(product?.length_m) *
    toNumber(product?.width_m) *
    toNumber(product?.height_m)
  );
}

function getProductColor(product) {
  const numericId = Number(product?.id);

  if (Number.isFinite(numericId)) {
    return COLORS[Math.abs(numericId) % COLORS.length];
  }

  const hash = [...String(product?.name || "")].reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  );

  return COLORS[Math.abs(hash) % COLORS.length];
}

function getMaximumWeight(capacity) {
  return toNumber(
    capacity?.max_payload_kg ??
      capacity?.max_weight_kg ??
      capacity?.payload_capacity_kg ??
      capacity?.capacity_kg
  );
}

function getOrientations(product, strategy) {
  const length = toNumber(product?.length_m);
  const width = toNumber(product?.width_m);
  const height = toNumber(product?.height_m);

  const orientations = [
    {
      length,
      width,
      height,
      rotated: false,
      rotationY: 0,
    },
  ];

  if (
    product?.rotatable &&
    Math.abs(length - width) > EPSILON
  ) {
    orientations.push({
      length: width,
      width: length,
      height,
      rotated: true,
      rotationY: 90,
    });
  }

  if (strategy.orientationOrder === "rotated_first") {
    orientations.reverse();
  }

  return orientations.filter(
    (orientation) =>
      orientation.length > 0 &&
      orientation.width > 0 &&
      orientation.height > 0
  );
}

function buildUnits(selectedItems) {
  const units = [];

  selectedItems.forEach((selectedItem) => {
    const quantity = toNumber(selectedItem?.quantity);

    for (let unit = 0; unit < quantity; unit += 1) {
      units.push({
        product: selectedItem.product,
        unit: unit + 1,
      });
    }
  });

  return units;
}

function sortUnits(units, strategy) {
  return [...units].sort((first, second) => {
    const firstVolume = getProductVolume(first.product);
    const secondVolume = getProductVolume(second.product);

    const firstWeight = toNumber(first.product?.weight_kg);
    const secondWeight = toNumber(second.product?.weight_kg);

    if (strategy.preferStacking) {
      const firstStackable =
        first.product?.stackable !== false ? 1 : 0;

      const secondStackable =
        second.product?.stackable !== false ? 1 : 0;

      if (firstStackable !== secondStackable) {
        return secondStackable - firstStackable;
      }
    }

    if (strategy.order === "weight_desc") {
      return (
        secondWeight - firstWeight ||
        secondVolume - firstVolume
      );
    }

    return (
      secondVolume - firstVolume ||
      secondWeight - firstWeight
    );
  });
}

function boxesOverlap(first, second) {
  return !(
    first.x + first.length <= second.x + EPSILON ||
    first.x >= second.x + second.length - EPSILON ||
    first.y + first.width <= second.y + EPSILON ||
    first.y >= second.y + second.width - EPSILON ||
    first.z + first.height <= second.z + EPSILON ||
    first.z >= second.z + second.height - EPSILON
  );
}

function getSupportRatio(candidate, placedItems) {
  if (candidate.z <= EPSILON) {
    return 1;
  }

  const candidateArea =
    candidate.length * candidate.width;

  if (candidateArea <= EPSILON) {
    return 0;
  }

  let supportedArea = 0;

  placedItems.forEach((item) => {
    const sameLevel =
      Math.abs(
        item.z + item.height - candidate.z
      ) <= EPSILON;

    if (
      !sameLevel ||
      item.product?.stackable === false
    ) {
      return;
    }

    const overlapX = Math.max(
      0,
      Math.min(
        candidate.x + candidate.length,
        item.x + item.length
      ) - Math.max(candidate.x, item.x)
    );

    const overlapY = Math.max(
      0,
      Math.min(
        candidate.y + candidate.width,
        item.y + item.width
      ) - Math.max(candidate.y, item.y)
    );

    supportedArea += overlapX * overlapY;
  });

  return Math.min(
    1,
    supportedArea / candidateArea
  );
}

function isInsideContainer(candidate, dimensions) {
  return (
    candidate.x >= -EPSILON &&
    candidate.y >= -EPSILON &&
    candidate.z >= -EPSILON &&
    candidate.x + candidate.length <=
      dimensions.length + EPSILON &&
    candidate.y + candidate.width <=
      dimensions.width + EPSILON &&
    candidate.z + candidate.height <=
      dimensions.height + EPSILON
  );
}

/*
  Calcula cómo quedaría el centro de gravedad
  y el balance global si colocamos este candidato.
*/
function getProjectedBalance({
  placedItems,
  candidate,
  candidateWeight,
  dimensions,
}) {
  let totalWeight = 0;

  let momentX = 0;
  let momentY = 0;

  let leftWeight = 0;
  let rightWeight = 0;

  placedItems.forEach((item) => {
    const weight = Math.max(
      toNumber(item?.product?.weight_kg),
      EPSILON
    );

    const centerX =
      toNumber(item.x) +
      toNumber(item.length) / 2;

    const centerY =
      toNumber(item.y) +
      toNumber(item.width) / 2;

    totalWeight += weight;

    momentX += weight * centerX;
    momentY += weight * centerY;

    if (centerY <= dimensions.width / 2) {
      leftWeight += weight;
    } else {
      rightWeight += weight;
    }
  });

  const weight = Math.max(
    toNumber(candidateWeight),
    EPSILON
  );

  const candidateCenterX =
    candidate.x + candidate.length / 2;

  const candidateCenterY =
    candidate.y + candidate.width / 2;

  totalWeight += weight;

  momentX += weight * candidateCenterX;
  momentY += weight * candidateCenterY;

  if (candidateCenterY <= dimensions.width / 2) {
    leftWeight += weight;
  } else {
    rightWeight += weight;
  }

  const centerX =
    totalWeight > 0
      ? momentX / totalWeight
      : dimensions.length / 2;

  const centerY =
    totalWeight > 0
      ? momentY / totalWeight
      : dimensions.width / 2;

  const longitudinalOffset =
    dimensions.length > 0
      ? Math.abs(
          centerX - dimensions.length / 2
        ) / dimensions.length
      : 0;

  const lateralOffset =
    dimensions.width > 0
      ? Math.abs(
          centerY - dimensions.width / 2
        ) / dimensions.width
      : 0;

  const lateralDistributionDifference =
    totalWeight > 0
      ? Math.abs(
          leftWeight - rightWeight
        ) / totalWeight
      : 0;

  return {
    totalWeight,
    centerX,
    centerY,
    longitudinalOffset,
    lateralOffset,
    lateralDistributionDifference,
    leftWeight,
    rightWeight,
  };
}

/*
  Calcula la zona longitudinal en la que debería
  quedar el centro de gravedad para respetar
  ambos límites de eje.

  Fórmulas:

  Eje delantero =
    W * (rearX - centerX) / wheelbase

  Eje trasero =
    W * (centerX - frontX) / wheelbase

  De ahí obtenemos:

  centerX mínimo para no exceder eje delantero

  centerX máximo para no exceder eje trasero
*/
function getAxleSafeZone({
  capacity,
  totalWeight,
}) {
  const frontAxlePosition = Number(
    capacity?.front_axle_position_m
  );

  const rearAxlePosition = Number(
    capacity?.rear_axle_position_m
  );

  const frontAxleMax = toNumber(
    capacity?.front_axle_max_kg
  );

  const rearAxleMax = toNumber(
    capacity?.rear_axle_max_kg
  );

  if (
    totalWeight <= 0 ||
    !Number.isFinite(frontAxlePosition) ||
    !Number.isFinite(rearAxlePosition) ||
    rearAxlePosition <= frontAxlePosition
  ) {
    return null;
  }

  const wheelbase =
    rearAxlePosition - frontAxlePosition;

  let minimumCenterX =
    frontAxlePosition;

  let maximumCenterX =
    rearAxlePosition;

  if (frontAxleMax > 0) {
    minimumCenterX =
      rearAxlePosition -
      (frontAxleMax * wheelbase) /
        totalWeight;
  }

  if (rearAxleMax > 0) {
    maximumCenterX =
      frontAxlePosition +
      (rearAxleMax * wheelbase) /
        totalWeight;
  }

  /*
    No dejamos que la zona teórica salga
    de la distancia física entre los ejes.
  */
  minimumCenterX = Math.max(
    frontAxlePosition,
    minimumCenterX
  );

  maximumCenterX = Math.min(
    rearAxlePosition,
    maximumCenterX
  );

  const feasible =
    minimumCenterX <=
    maximumCenterX + EPSILON;

  /*
    Si existe una zona legal, apuntamos
    hacia su centro.

    Si no existe porque la carga total es
    demasiado grande para ambos límites,
    apuntamos al punto que reparte mejor
    el compromiso.
  */
  const targetCenterX = feasible
    ? (
        minimumCenterX +
        maximumCenterX
      ) / 2
    : (
        minimumCenterX +
        maximumCenterX
      ) / 2;

  return {
    frontAxlePosition,
    rearAxlePosition,
    frontAxleMax,
    rearAxleMax,
    wheelbase,
    minimumCenterX,
    maximumCenterX,
    targetCenterX,
    feasible,
  };
}

/*
  Calcula las reacciones proyectadas y genera
  una penalización dirigida.

  Esta es la parte que hace que la IA no se
  limite a detectar una sobrecarga al final:
  ahora busca activamente desplazar el centro
  de gravedad hacia la zona segura.
*/
function getProjectedAxlePenalty({
  capacity,
  projectedBalance,
}) {
  const safeZone = getAxleSafeZone({
    capacity,
    totalWeight:
      projectedBalance.totalWeight,
  });

  if (!safeZone) {
    return {
      penalty: 0,
      frontLoad: 0,
      rearLoad: 0,
      frontOverload: 0,
      rearOverload: 0,
      totalOverload: 0,
      safeZone: null,
    };
  }

  const {
    frontAxlePosition,
    rearAxlePosition,
    frontAxleMax,
    rearAxleMax,
    wheelbase,
    minimumCenterX,
    maximumCenterX,
    targetCenterX,
  } = safeZone;

  const totalWeight =
    projectedBalance.totalWeight;

  const rawRearLoad =
    totalWeight *
    (
      (
        projectedBalance.centerX -
        frontAxlePosition
      ) /
      wheelbase
    );

  const rawFrontLoad =
    totalWeight - rawRearLoad;

  const frontLoad =
    Math.max(0, rawFrontLoad);

  const rearLoad =
    Math.max(0, rawRearLoad);

  const frontOverload =
    frontAxleMax > 0
      ? Math.max(
          0,
          frontLoad - frontAxleMax
        )
      : 0;

  const rearOverload =
    rearAxleMax > 0
      ? Math.max(
          0,
          rearLoad - rearAxleMax
        )
      : 0;

  const totalOverload =
    frontOverload +
    rearOverload;

  const frontUsagePercent =
    frontAxleMax > 0
      ? (
          frontLoad /
          frontAxleMax
        ) *
        100
      : 0;

  const rearUsagePercent =
    rearAxleMax > 0
      ? (
          rearLoad /
          rearAxleMax
        ) *
        100
      : 0;

  /*
    Si estamos delante del mínimo seguro,
    hay que mover carga hacia atrás.

    Si estamos detrás del máximo seguro,
    hay que mover carga hacia adelante.
  */
  let distanceOutsideSafeZone = 0;

  if (
    projectedBalance.centerX <
    minimumCenterX
  ) {
    distanceOutsideSafeZone =
      minimumCenterX -
      projectedBalance.centerX;
  } else if (
    projectedBalance.centerX >
    maximumCenterX
  ) {
    distanceOutsideSafeZone =
      projectedBalance.centerX -
      maximumCenterX;
  }

  /*
    Incluso dentro de la zona legal,
    premiamos acercarnos al centro de
    la zona segura para conservar margen.
  */
  const distanceToTarget =
    Math.abs(
      projectedBalance.centerX -
      targetCenterX
    );

  const frontHighUsage =
    frontAxleMax > 0
      ? Math.max(
          0,
          frontUsagePercent - 90
        )
      : 0;

  const rearHighUsage =
    rearAxleMax > 0
      ? Math.max(
          0,
          rearUsagePercent - 90
        )
      : 0;

  /*
    SOBRECARGA:
    penalización extremadamente fuerte.
  */
  const overloadPenalty =
    totalOverload *
    80_000;

  /*
    ZONA SEGURA:
    este valor empuja directamente el
    centro X hacia una posición legal.
  */
  const safeZonePenalty =
    distanceOutsideSafeZone *
    25_000_000;

  /*
    Dentro de la zona legal seguimos
    buscando margen.
  */
  const targetPenalty =
    distanceToTarget *
    450_000;

  /*
    Prevención a partir del 90%.
  */
  const highUsagePenalty =
    (
      frontHighUsage +
      rearHighUsage
    ) *
    20_000;

  /*
    Evitamos centros fuera de la distancia
    física entre ambos ejes.
  */
  const outsideWheelbasePenalty =
    rawFrontLoad < 0 ||
    rawRearLoad < 0
      ? 100_000_000
      : 0;

  return {
    penalty:
      overloadPenalty +
      safeZonePenalty +
      targetPenalty +
      highUsagePenalty +
      outsideWheelbasePenalty,

    frontLoad,
    rearLoad,

    frontOverload,
    rearOverload,
    totalOverload,

    frontUsagePercent,
    rearUsagePercent,

    safeZone,
    distanceOutsideSafeZone,
    distanceToTarget,
  };
}

/*
  Mantiene las capas superiores repartidas
  izquierda / derecha y favorece filas
  continuas.
*/
function getLayerPlacementPenalty({
  candidate,
  placedItems,
  dimensions,
  strategy,
}) {
  const sameLayerItems =
    placedItems.filter(
      (item) =>
        Math.abs(
          Number(item.z || 0) -
            Number(candidate.z || 0)
        ) <= EPSILON
    );

  if (sameLayerItems.length === 0) {
    return 0;
  }

  const balanceWeight =
    Math.max(
      1,
      Math.abs(
        toNumber(
          strategy.weights.balanceY,
          100000
        )
      )
    );

  const candidateCenterY =
    candidate.y +
    candidate.width / 2;

  let leftCount = 0;
  let rightCount = 0;

  sameLayerItems.forEach((item) => {
    const itemCenterY =
      Number(item.y || 0) +
      Number(item.width || 0) / 2;

    if (
      itemCenterY <=
      dimensions.width / 2
    ) {
      leftCount += 1;
    } else {
      rightCount += 1;
    }
  });

  const candidateIsLeft =
    candidateCenterY <=
    dimensions.width / 2;

  const projectedLeft =
    leftCount +
    (candidateIsLeft ? 1 : 0);

  const projectedRight =
    rightCount +
    (candidateIsLeft ? 0 : 1);

  const projectedCount =
    projectedLeft +
    projectedRight;

  const sideImbalance =
    projectedCount > 0
      ? Math.abs(
          projectedLeft -
            projectedRight
        ) / projectedCount
      : 0;

  const touchingSameLayer =
    sameLayerItems.some((item) => {
      const itemX =
        Number(item.x || 0);

      const itemY =
        Number(item.y || 0);

      const itemLength =
        Number(item.length || 0);

      const itemWidth =
        Number(item.width || 0);

      const touchesX =
        (
          Math.abs(
            candidate.x -
              (itemX + itemLength)
          ) <= EPSILON ||
          Math.abs(
            candidate.x +
              candidate.length -
              itemX
          ) <= EPSILON
        ) &&
        candidate.y <
          itemY + itemWidth - EPSILON &&
        candidate.y +
          candidate.width >
          itemY + EPSILON;

      const touchesY =
        (
          Math.abs(
            candidate.y -
              (itemY + itemWidth)
          ) <= EPSILON ||
          Math.abs(
            candidate.y +
              candidate.width -
              itemY
          ) <= EPSILON
        ) &&
        candidate.x <
          itemX +
            itemLength -
            EPSILON &&
        candidate.x +
          candidate.length >
          itemX + EPSILON;

      return touchesX || touchesY;
    });

  let nearestDistance =
    Number.POSITIVE_INFINITY;

  sameLayerItems.forEach((item) => {
    const itemCenterX =
      Number(item.x || 0) +
      Number(item.length || 0) / 2;

    const itemCenterY =
      Number(item.y || 0) +
      Number(item.width || 0) / 2;

    const candidateCenterX =
      candidate.x +
      candidate.length / 2;

    const distance =
      Math.hypot(
        candidateCenterX -
          itemCenterX,

        candidateCenterY -
          itemCenterY
      );

    nearestDistance =
      Math.min(
        nearestDistance,
        distance
      );
  });

  const normalizedDistance =
    Number.isFinite(nearestDistance)
      ? nearestDistance /
        Math.max(
          dimensions.length,
          dimensions.width,
          EPSILON
        )
      : 0;

  const sidePenalty =
    sideImbalance *
    balanceWeight *
    10;

  const distancePenalty =
    normalizedDistance *
    balanceWeight *
    2;

  const adjacencyBonus =
    touchingSameLayer
      ? balanceWeight * 3
      : 0;

  return (
    sidePenalty +
    distancePenalty -
    adjacencyBonus
  );
}

function runStrategy(
  capacity,
  selectedItems,
  strategy
) {
  const dimensions = {
    length: toNumber(
      capacity?.internal_length_m
    ),

    width: toNumber(
      capacity?.internal_width_m
    ),

    height: toNumber(
      capacity?.internal_height_m
    ),
  };

  const units = sortUnits(
    buildUnits(selectedItems),
    strategy
  );

  if (
    dimensions.length <= 0 ||
    dimensions.width <= 0 ||
    dimensions.height <= 0
  ) {
    return {
      placed: [],

      rejected: units.map(
        (unit) => ({
          product: unit.product,
          unit: unit.unit,
          reason:
            "La unidad no tiene dimensiones internas válidas",
        })
      ),
    };
  }

  const placed = [];
  const rejected = [];

  let extremePoints =
    createInitialExtremePoints();

  const maximumWeight =
    getMaximumWeight(capacity);

  let usedWeight = 0;

  units.forEach(
    (unit, itemIndex) => {
      const productWeight =
        toNumber(
          unit.product?.weight_kg
        );

      if (
        maximumWeight > 0 &&
        usedWeight +
          productWeight >
          maximumWeight
      ) {
        rejected.push({
          product: unit.product,
          unit: unit.unit,
          reason:
            "Supera el peso máximo permitido",
        });

        return;
      }

      const candidates = [];

      extremePoints.forEach(
        (point) => {
          getOrientations(
            unit.product,
            strategy
          ).forEach(
            (orientation) => {
              const candidate = {
                x: point.x,
                y: point.y,
                z: point.z,

                length:
                  orientation.length,

                width:
                  orientation.width,

                height:
                  orientation.height,

                rotated:
                  orientation.rotated,

                rotationY:
                  orientation.rotationY,
              };

              if (
                !isInsideContainer(
                  candidate,
                  dimensions
                )
              ) {
                return;
              }

              if (
                placed.some(
                  (item) =>
                    boxesOverlap(
                      candidate,
                      item
                    )
                )
              ) {
                return;
              }

              const support =
                getSupportRatio(
                  candidate,
                  placed
                );

              if (
                support + EPSILON <
                0.8
              ) {
                return;
              }

              const centerX =
                candidate.x +
                candidate.length / 2;

              const centerY =
                candidate.y +
                candidate.width / 2;

              const distanceX =
                Math.abs(
                  centerX -
                    dimensions.length / 2
                ) /
                Math.max(
                  dimensions.length,
                  EPSILON
                );

              const distanceY =
                Math.abs(
                  centerY -
                    dimensions.width / 2
                ) /
                Math.max(
                  dimensions.width,
                  EPSILON
                );

              const projectedBalance =
                getProjectedBalance({
                  placedItems:
                    placed,

                  candidate,

                  candidateWeight:
                    productWeight,

                  dimensions,
                });

              const projectedAxles =
                getProjectedAxlePenalty({
                  capacity,
                  projectedBalance,
                });

              const stackingBonus =
                strategy.preferStacking &&
                candidate.z > EPSILON
                  ? toNumber(
                      strategy.weights
                        .stackingBonus,
                      320000
                    )
                  : 0;

              /*
                Conservamos el balance general,
                pero la seguridad de ejes pasa
                a ser una prioridad muy fuerte.
              */
              const globalLongitudinalPenalty =
                projectedBalance
                  .longitudinalOffset *
                toNumber(
                  strategy.weights
                    .balanceX,
                  1
                ) *
                2;

              const globalLateralPenalty =
                projectedBalance
                  .lateralOffset *
                toNumber(
                  strategy.weights
                    .balanceY,
                  1
                ) *
                8;

              const sideDistributionPenalty =
                projectedBalance
                  .lateralDistributionDifference *
                toNumber(
                  strategy.weights
                    .balanceY,
                  1
                ) *
                10;

              const layerPlacementPenalty =
                getLayerPlacementPenalty({
                  candidate,

                  placedItems:
                    placed,

                  dimensions,

                  strategy,
                });

              const centeredLateralPenalty =
                Math.abs(
                  centerY -
                    dimensions.width / 2
                ) *
                toNumber(
                  strategy.weights
                    .lateral
                );

              /*
                IMPORTANTE:

                El antiguo candidate.x puro
                favorecía sistemáticamente
                cargar desde el frente.

                Ahora reducimos muchísimo esa
                preferencia cuando existen ejes
                configurados.
              */
              const hasAxleConfiguration =
                Boolean(
                  projectedAxles.safeZone
                );

              const depthPenalty =
                candidate.x *
                toNumber(
                  strategy.weights.depth
                ) *
                (
                  hasAxleConfiguration
                    ? 0.08
                    : 1
                );

              const score =
                candidate.z *
                  toNumber(
                    strategy.weights.height
                  ) +

                centeredLateralPenalty +

                depthPenalty +

                (1 - support) *
                  toNumber(
                    strategy.weights.support
                  ) +

                distanceX *
                  toNumber(
                    strategy.weights.balanceX
                  ) +

                distanceY *
                  toNumber(
                    strategy.weights.balanceY
                  ) +

                globalLongitudinalPenalty +

                globalLateralPenalty +

                sideDistributionPenalty +

                layerPlacementPenalty +

                /*
                  NUEVA PRIORIDAD:
                  corrección longitudinal
                  dirigida por los ejes.
                */
                projectedAxles.penalty -

                stackingBonus;

              candidates.push({
                candidate,
                score,
                projectedAxles,
              });
            }
          );
        }
      );

      candidates.sort(
        (first, second) =>
          first.score -
          second.score
      );

      const selected =
        candidates[0];

      if (!selected) {
        rejected.push({
          product:
            unit.product,

          unit:
            unit.unit,

          reason:
            "No se encontró una posición extrema compatible",
        });

        return;
      }

      const placedItem = {
        id:
          `${strategy.id}-${unit.product.id}-${unit.unit}-${itemIndex}`,

        instanceId:
          `${strategy.id}-${unit.product.id}-${unit.unit}-${itemIndex}`,

        product:
          unit.product,

        unit:
          unit.unit,

        ...selected.candidate,

        orientation:
          selected.candidate
            .rotationY === 90
            ? "ROTATED_90"
            : "VERTICAL",

        color:
          getProductColor(
            unit.product
          ),

        locked: false,
      };

      placed.push(placedItem);

      usedWeight +=
        productWeight;

      extremePoints =
        updateExtremePoints({
          currentPoints:
            extremePoints,

          placedItem,

          placedItems:
            placed,

          dimensions,
        });
    }
  );

  return {
    placed,
    rejected,
  };
}

function getFloorFootprint(result) {
  return result.placed.reduce(
    (total, item) => {
      if (
        Number(item.z || 0) >
        EPSILON
      ) {
        return total;
      }

      return (
        total +
        toNumber(item.length) *
          toNumber(item.width)
      );
    },
    0
  );
}

function getSolutionBalance(
  capacity,
  result
) {
  const width =
    toNumber(
      capacity?.internal_width_m
    );

  const length =
    toNumber(
      capacity?.internal_length_m
    );

  let totalWeight = 0;

  let momentX = 0;
  let momentY = 0;

  let leftWeight = 0;
  let rightWeight = 0;

  result.placed.forEach(
    (item) => {
      const weight =
        Math.max(
          toNumber(
            item?.product?.weight_kg
          ),
          EPSILON
        );

      const centerX =
        toNumber(item.x) +
        toNumber(item.length) / 2;

      const centerY =
        toNumber(item.y) +
        toNumber(item.width) / 2;

      totalWeight += weight;

      momentX +=
        weight * centerX;

      momentY +=
        weight * centerY;

      if (
        centerY <= width / 2
      ) {
        leftWeight += weight;
      } else {
        rightWeight += weight;
      }
    }
  );

  if (totalWeight <= 0) {
    return {
      lateralDifference: 0,
      longitudinalOffset: 0,
      lateralOffset: 0,
    };
  }

  const centerX =
    momentX / totalWeight;

  const centerY =
    momentY / totalWeight;

  return {
    lateralDifference:
      Math.abs(
        leftWeight -
          rightWeight
      ) /
      totalWeight,

    longitudinalOffset:
      length > 0
        ? Math.abs(
            centerX -
              length / 2
          ) /
          length
        : 0,

    lateralOffset:
      width > 0
        ? Math.abs(
            centerY -
              width / 2
          ) /
          width
        : 0,
  };
}

export function runIntelligentOptimization(
  capacity,
  selectedItems
) {
  const alternatives =
    STRATEGIES.map(
      (strategy) => {
        const result =
          runStrategy(
            capacity,
            selectedItems,
            strategy
          );

        const evaluation =
          evaluateSolution({
            capacity,
            result,
            strategy,
          });

        return {
          strategy,
          result,
          evaluation,

          floorFootprint:
            getFloorFootprint(
              result
            ),

          balance:
            getSolutionBalance(
              capacity,
              result
            ),
        };
      }
    ).sort(
      (first, second) => {
        /*
          PRIORIDAD 1
          Mayor cantidad colocada.
        */
        const placedDifference =
          second.evaluation
            .placedCount -
          first.evaluation
            .placedCount;

        if (
          placedDifference !== 0
        ) {
          return placedDifference;
        }

        /*
          PRIORIDAD 2
          Menos rechazados.
        */
        const rejectedDifference =
          first.evaluation
            .rejectedCount -
          second.evaluation
            .rejectedCount;

        if (
          rejectedDifference !== 0
        ) {
          return rejectedDifference;
        }

        /*
          PRIORIDAD 3
          Menor sobrecarga de ejes.
        */
        const firstAxleOverload =
          Number(
            first.evaluation
              ?.totalAxleOverload ||
              0
          );

        const secondAxleOverload =
          Number(
            second.evaluation
              ?.totalAxleOverload ||
              0
          );

        const axleOverloadDifference =
          firstAxleOverload -
          secondAxleOverload;

        if (
          Math.abs(
            axleOverloadDifference
          ) > EPSILON
        ) {
          return axleOverloadDifference;
        }

        /*
          PRIORIDAD 4
          Si ninguna alternativa excede los
          ejes, preferimos la que trabaje con
          menor porcentaje de utilización
          máxima de eje.
        */
        const firstMaximumAxleUsage =
          Math.max(
            Number(
              first.evaluation
                ?.frontAxleUsagePercent ||
                0
            ),

            Number(
              first.evaluation
                ?.rearAxleUsagePercent ||
                0
            )
          );

        const secondMaximumAxleUsage =
          Math.max(
            Number(
              second.evaluation
                ?.frontAxleUsagePercent ||
                0
            ),

            Number(
              second.evaluation
                ?.rearAxleUsagePercent ||
                0
            )
          );

        const axleUsageDifference =
          firstMaximumAxleUsage -
          secondMaximumAxleUsage;

        if (
          Math.abs(
            axleUsageDifference
          ) > EPSILON
        ) {
          return axleUsageDifference;
        }

        /*
          PRIORIDAD 5
          Balance lateral 50 / 50.
        */
        const lateralDistributionDifference =
          first.balance
            .lateralDifference -
          second.balance
            .lateralDifference;

        if (
          Math.abs(
            lateralDistributionDifference
          ) > EPSILON
        ) {
          return lateralDistributionDifference;
        }

        /*
          PRIORIDAD 6
          Centro lateral.
        */
        const lateralCenterDifference =
          first.balance
            .lateralOffset -
          second.balance
            .lateralOffset;

        if (
          Math.abs(
            lateralCenterDifference
          ) > EPSILON
        ) {
          return lateralCenterDifference;
        }

        /*
          PRIORIDAD 7
          Balance longitudinal.
        */
        const longitudinalDifference =
          first.balance
            .longitudinalOffset -
          second.balance
            .longitudinalOffset;

        if (
          Math.abs(
            longitudinalDifference
          ) > EPSILON
        ) {
          return longitudinalDifference;
        }

        /*
          PRIORIDAD 8
          Calidad general.
        */
        const qualityDifference =
          second.evaluation
            .rawScore -
          first.evaluation
            .rawScore;

        if (
          Math.abs(
            qualityDifference
          ) > EPSILON
        ) {
          return qualityDifference;
        }

        /*
          PRIORIDAD 9
          Menor superficie de piso.
        */
        return (
          first.floorFootprint -
          second.floorFootprint
        );
      }
    );

  const best =
    alternatives[0];

  if (!best) {
    return {
      placed: [],
      rejected: [],

      intelligence: {
        alternativesAnalyzed: 0,
        strategyName:
          "Sin estrategia",
        qualityScore: 0,
        alternatives: [],
      },
    };
  }

  return {
    placed:
      best.result.placed,

    rejected:
      best.result.rejected,

    intelligence: {
      alternativesAnalyzed:
        alternatives.length,

      strategyName:
        best.strategy.name,

      strategyDescription:
        best.strategy.description,

      qualityScore:
        best.evaluation
          .qualityScore,

      metrics:
        best.evaluation,

      alternatives:
        alternatives.map(
          (alternative) => ({
            strategyId:
              alternative.strategy.id,

            strategyName:
              alternative.strategy.name,

            qualityScore:
              alternative.evaluation
                .qualityScore,

            placedCount:
              alternative.evaluation
                .placedCount,

            rejectedCount:
              alternative.evaluation
                .rejectedCount,

            volumePercentage:
              alternative.evaluation
                .volumePercentage,

            floorFootprint:
              alternative.floorFootprint,

            frontAxleLoad:
              Number(
                alternative.evaluation
                  ?.frontAxleLoad ||
                  0
              ),

            rearAxleLoad:
              Number(
                alternative.evaluation
                  ?.rearAxleLoad ||
                  0
              ),

            frontAxleUsagePercent:
              Number(
                alternative.evaluation
                  ?.frontAxleUsagePercent ||
                  0
              ),

            rearAxleUsagePercent:
              Number(
                alternative.evaluation
                  ?.rearAxleUsagePercent ||
                  0
              ),

            totalAxleOverload:
              Number(
                alternative.evaluation
                  ?.totalAxleOverload ||
                  0
              ),
          })
        ),
    },
  };
}

export function getAvailableStrategies() {
  return STRATEGIES.map(
    (strategy) => ({
      id: strategy.id,
      name: strategy.name,
      description:
        strategy.description,
    })
  );
}