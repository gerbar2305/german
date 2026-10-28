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

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function getProductVolume(product) {
  return (
    toNumber(product?.length_m) *
    toNumber(product?.width_m) *
    toNumber(product?.height_m)
  );
}

function getProductColor(product) {
  const numericId =
    Number(product?.id);

  if (Number.isFinite(numericId)) {
    return COLORS[
      Math.abs(numericId) %
        COLORS.length
    ];
  }

  const hash = [
    ...String(
      product?.name || ""
    ),
  ].reduce(
    (total, character) =>
      total +
      character.charCodeAt(0),
    0
  );

  return COLORS[
    Math.abs(hash) %
      COLORS.length
  ];
}

function getMaximumWeight(capacity) {
  return toNumber(
    capacity?.max_payload_kg ??
      capacity?.max_weight_kg ??
      capacity?.payload_capacity_kg ??
      capacity?.capacity_kg
  );
}

function getOrientations(
  product,
  strategy
) {
  const length =
    toNumber(product?.length_m);

  const width =
    toNumber(product?.width_m);

  const height =
    toNumber(product?.height_m);

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
    Math.abs(
      length - width
    ) > EPSILON
  ) {
    orientations.push({
      length: width,
      width: length,
      height,
      rotated: true,
      rotationY: 90,
    });
  }

  if (
    strategy.orientationOrder ===
    "rotated_first"
  ) {
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

  selectedItems.forEach(
    (selectedItem) => {
      const quantity =
        toNumber(
          selectedItem?.quantity
        );

      for (
        let unit = 0;
        unit < quantity;
        unit += 1
      ) {
        units.push({
          product:
            selectedItem.product,

          unit:
            unit + 1,
        });
      }
    }
  );

  return units;
}

function sortUnits(
  units,
  strategy
) {
  return [...units].sort(
    (first, second) => {
      const firstVolume =
        getProductVolume(
          first.product
        );
const firstTotalWeight =
  toNumber(
    first.product?.weight_kg
  ) *
  first.quantity;

const secondTotalWeight =
  toNumber(
    second.product?.weight_kg
  ) *
  second.quantity;
      const secondVolume =
        getProductVolume(
          second.product
        );

      const firstWeight =
        toNumber(
          first.product
            ?.weight_kg
        );

      const secondWeight =
        toNumber(
          second.product
            ?.weight_kg
        );

      if (
        strategy.preferStacking
      ) {
        const firstStackable =
          first.product
            ?.stackable !== false
            ? 1
            : 0;

        const secondStackable =
          second.product
            ?.stackable !== false
            ? 1
            : 0;

        if (
          firstStackable !==
          secondStackable
        ) {
          return (
            secondStackable -
            firstStackable
          );
        }
      }

      if (
        strategy.order ===
        "weight_desc"
      ) {
        return (
          secondWeight -
            firstWeight ||
          secondVolume -
            firstVolume
        );
      }

      return (
        secondVolume -
          firstVolume ||
        secondWeight -
          firstWeight
      );
    }
  );
}

function boxesOverlap(
  first,
  second
) {
  return !(
    first.x +
      first.length <=
      second.x +
        EPSILON ||

    first.x >=
      second.x +
        second.length -
        EPSILON ||

    first.y +
      first.width <=
            second.y +
        EPSILON ||

    first.y >=
      second.y +
        second.width -
        EPSILON ||

    first.z +
      first.height <=
      second.z +
        EPSILON ||

    first.z >=
      second.z +
        second.height -
        EPSILON
  );
}

function getSupportRatio(
  candidate,
  placedItems
) {
  if (
    candidate.z <=
    EPSILON
  ) {
    return 1;
  }

  const candidateArea =
    candidate.length *
    candidate.width;

  if (
    candidateArea <=
    EPSILON
  ) {
    return 0;
  }

  let supportedArea = 0;

  placedItems.forEach(
    (item) => {
      const sameLevel =
        Math.abs(
          item.z +
            item.height -
            candidate.z
        ) <= EPSILON;

      if (
        !sameLevel ||
        item.product
          ?.stackable === false
      ) {
        return;
      }

      const overlapX =
        Math.max(
          0,
          Math.min(
            candidate.x +
              candidate.length,

            item.x +
              item.length
          ) -
            Math.max(
              candidate.x,
              item.x
            )
        );

      const overlapY =
        Math.max(
          0,
          Math.min(
            candidate.y +
              candidate.width,

            item.y +
              item.width
          ) -
            Math.max(
              candidate.y,
              item.y
            )
        );

      supportedArea +=
        overlapX *
        overlapY;
    }
  );

  return Math.min(
    1,
    supportedArea /
      candidateArea
  );
}

function isInsideContainer(
  candidate,
  dimensions
) {
  return (
    candidate.x >=
      -EPSILON &&

    candidate.y >=
      -EPSILON &&

    candidate.z >=
      -EPSILON &&

    candidate.x +
      candidate.length <=
      dimensions.length +
        EPSILON &&

    candidate.y +
      candidate.width <=
      dimensions.width +
        EPSILON &&

    candidate.z +
      candidate.height <=
      dimensions.height +
        EPSILON
  );
}

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

  placedItems.forEach(
    (item) => {
      const weight =
        Math.max(
          toNumber(
            item?.product
              ?.weight_kg
          ),
          EPSILON
        );

      const itemCenterX =
        toNumber(item.x) +
        toNumber(
          item.length
        ) / 2;

      const itemCenterY =
        toNumber(item.y) +
        toNumber(
          item.width
        ) / 2;

      totalWeight +=
        weight;

      momentX +=
        weight *
        itemCenterX;

      momentY +=
        weight *
        itemCenterY;

      if (
        itemCenterY <=
        dimensions.width / 2
      ) {
        leftWeight +=
          weight;
      } else {
        rightWeight +=
          weight;
      }
    }
  );

  const weight =
    Math.max(
      toNumber(
        candidateWeight
      ),
      EPSILON
    );

  const candidateCenterX =
    candidate.x +
    candidate.length / 2;

  const candidateCenterY =
    candidate.y +
    candidate.width / 2;

  totalWeight += weight;

  momentX +=
    weight *
    candidateCenterX;

  momentY +=
    weight *
    candidateCenterY;

  if (
    candidateCenterY <=
    dimensions.width / 2
  ) {
    leftWeight += weight;
  } else {
    rightWeight += weight;
  }

  const centerX =
    totalWeight > 0
      ? momentX /
        totalWeight
      : dimensions.length / 2;

  const centerY =
    totalWeight > 0
      ? momentY /
        totalWeight
      : dimensions.width / 2;

  const longitudinalOffset =
    dimensions.length > 0
      ? Math.abs(
          centerX -
            dimensions.length / 2
        ) /
        dimensions.length
      : 0;

  const lateralOffset =
    dimensions.width > 0
      ? Math.abs(
          centerY -
            dimensions.width / 2
        ) /
        dimensions.width
      : 0;

  const lateralDistributionDifference =
    totalWeight > 0
      ? Math.abs(
          leftWeight -
            rightWeight
        ) /
        totalWeight
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
function getAxleSafeZone({
  capacity,
  totalWeight,
}) {
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

  const frontAxleTare =
    toNumber(
      capacity?.front_axle_tare_kg
    );

  const rearAxleTare =
    toNumber(
      capacity?.rear_axle_tare_kg
    );

  if (
    totalWeight <= 0 ||
    !Number.isFinite(
      frontAxlePosition
    ) ||
    !Number.isFinite(
      rearAxlePosition
    ) ||
    rearAxlePosition <=
      frontAxlePosition
  ) {
    return null;
  }

  const wheelbase =
    rearAxlePosition -
    frontAxlePosition;

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

  let minimumCenterX =
    frontAxlePosition;

  let maximumCenterX =
    rearAxlePosition;

  if (
    frontAxleMax > 0
  ) {
    minimumCenterX =
      rearAxlePosition -
      (
        frontCargoCapacity *
        wheelbase
      ) /
        totalWeight;
  }

  if (
    rearAxleMax > 0
  ) {
    maximumCenterX =
      frontAxlePosition +
      (
        rearCargoCapacity *
        wheelbase
      ) /
        totalWeight;
  }

  minimumCenterX =
    Math.max(
      frontAxlePosition,
      minimumCenterX
    );

  maximumCenterX =
    Math.min(
      rearAxlePosition,
      maximumCenterX
    );

  const feasible =
    minimumCenterX <=
    maximumCenterX +
      EPSILON;

  const targetCenterX =
    (
      minimumCenterX +
      maximumCenterX
    ) /
    2;

  return {
    frontAxlePosition,
    rearAxlePosition,

    frontAxleMax,
    rearAxleMax,

    frontAxleTare,
    rearAxleTare,

    frontCargoCapacity,
    rearCargoCapacity,

    wheelbase,

    minimumCenterX,
    maximumCenterX,
    targetCenterX,

    feasible,
  };
}

function getProjectedAxlePenalty({
  capacity,
  projectedBalance,
}) {
  const safeZone =
    getAxleSafeZone({
      capacity,

      totalWeight:
        projectedBalance.totalWeight,
    });

  if (!safeZone) {
    return {
      penalty: 0,

      frontCargoLoad: 0,
      rearCargoLoad: 0,

      frontLoad: 0,
      rearLoad: 0,

      frontOverload: 0,
      rearOverload: 0,
      totalOverload: 0,

      frontUsagePercent: 0,
      rearUsagePercent: 0,

      safeZone: null,
    };
  }

  const {
    frontAxlePosition,
    rearAxlePosition,

    frontAxleMax,
    rearAxleMax,

    frontAxleTare,
    rearAxleTare,

    wheelbase,

    minimumCenterX,
    maximumCenterX,
    targetCenterX,
  } = safeZone;

  const totalWeight =
    projectedBalance.totalWeight;

  const rawRearCargoLoad =
    totalWeight *
    (
      (
        projectedBalance.centerX -
        frontAxlePosition
      ) /
      wheelbase
    );

  const rawFrontCargoLoad =
    totalWeight -
    rawRearCargoLoad;

  const frontCargoLoad =
    Math.max(
      0,
      rawFrontCargoLoad
    );

  const rearCargoLoad =
    Math.max(
      0,
      rawRearCargoLoad
    );

  const frontLoad =
    frontAxleTare +
    frontCargoLoad;

  const rearLoad =
    rearAxleTare +
    rearCargoLoad;

  const frontOverload =
    frontAxleMax > 0
      ? Math.max(
          0,
          frontLoad -
            frontAxleMax
        )
      : 0;

  const rearOverload =
    rearAxleMax > 0
      ? Math.max(
          0,
          rearLoad -
            rearAxleMax
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

  let distanceOutsideSafeZone =
    0;

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

  const distanceToTarget =
    Math.abs(
      projectedBalance.centerX -
      targetCenterX
    );

  const frontHighUsage =
    frontAxleMax > 0
      ? Math.max(
          0,
          frontUsagePercent -
            90
        )
      : 0;

  const rearHighUsage =
    rearAxleMax > 0
      ? Math.max(
          0,
          rearUsagePercent -
            90
        )
      : 0;

  const overloadPenalty =
    totalOverload *
    80_000;

  const safeZonePenalty =
    distanceOutsideSafeZone *
    25_000_000;

  const targetPenalty =
    distanceToTarget *
    450_000;

  const highUsagePenalty =
    (
      frontHighUsage +
      rearHighUsage
    ) *
    20_000;

  const outsideWheelbasePenalty =
    rawFrontCargoLoad < 0 ||
    rawRearCargoLoad < 0
      ? 100_000_000
      : 0;

  const tareAlreadyOverloaded =
    (
      frontAxleMax > 0 &&
      frontAxleTare >
        frontAxleMax
    ) ||
    (
      rearAxleMax > 0 &&
      rearAxleTare >
        rearAxleMax
    );

  const tareConfigurationPenalty =
    tareAlreadyOverloaded
      ? 250_000_000
      : 0;

  return {
    penalty:
      overloadPenalty +
      safeZonePenalty +
      targetPenalty +
      highUsagePenalty +
      outsideWheelbasePenalty +
      tareConfigurationPenalty,

    frontCargoLoad,
    rearCargoLoad,

    frontLoad,
    rearLoad,

    frontAxleTare,
    rearAxleTare,

    frontOverload,
    rearOverload,
    totalOverload,

    frontUsagePercent,
    rearUsagePercent,

    safeZone,

    distanceOutsideSafeZone,
    distanceToTarget,

    includesTare: true,
  };
}
/*
  Mantiene las capas repartidas
  izquierda / derecha y favorece
  posiciones continuas.
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
          Number(
            item.z || 0
          ) -
            Number(
              candidate.z || 0
            )
        ) <= EPSILON
    );

  if (
    sameLayerItems.length ===
    0
  ) {
    return 0;
  }

  const balanceWeight =
    Math.max(
      1,
      Math.abs(
        toNumber(
          strategy.weights
            .balanceY,
          100000
        )
      )
    );

  const candidateCenterY =
    candidate.y +
    candidate.width / 2;

  let leftCount = 0;
  let rightCount = 0;

  sameLayerItems.forEach(
    (item) => {
      const itemCenterY =
        Number(
          item.y || 0
        ) +
        Number(
          item.width || 0
        ) /
          2;

      if (
        itemCenterY <=
        dimensions.width / 2
      ) {
        leftCount += 1;
      } else {
        rightCount += 1;
      }
    }
  );

  const candidateIsLeft =
    candidateCenterY <=
    dimensions.width / 2;

  const projectedLeft =
    leftCount +
    (
      candidateIsLeft
        ? 1
        : 0
    );

  const projectedRight =
    rightCount +
    (
      candidateIsLeft
        ? 0
        : 1
    );

  const projectedCount =
    projectedLeft +
    projectedRight;

  const sideImbalance =
    projectedCount > 0
      ? Math.abs(
          projectedLeft -
            projectedRight
        ) /
        projectedCount
      : 0;

  const touchingSameLayer =
    sameLayerItems.some(
      (item) => {
        const itemX =
          Number(
            item.x || 0
          );

        const itemY =
          Number(
            item.y || 0
          );

        const itemLength =
          Number(
            item.length || 0
          );

        const itemWidth =
          Number(
            item.width || 0
          );

        const touchesX =
          (
            Math.abs(
              candidate.x -
                (
                  itemX +
                  itemLength
                )
            ) <= EPSILON ||

            Math.abs(
              candidate.x +
                candidate.length -
                itemX
            ) <= EPSILON
          ) &&
          candidate.y <
            itemY +
              itemWidth -
              EPSILON &&
          candidate.y +
            candidate.width >
            itemY +
              EPSILON;

        const touchesY =
          (
            Math.abs(
              candidate.y -
                (
                  itemY +
                  itemWidth
                )
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
            itemX +
              EPSILON;

        return (
          touchesX ||
          touchesY
        );
      }
    );

  let nearestDistance =
    Number.POSITIVE_INFINITY;

  sameLayerItems.forEach(
    (item) => {
      const itemCenterX =
        Number(
          item.x || 0
        ) +
        Number(
          item.length || 0
        ) /
          2;

      const itemCenterY =
        Number(
          item.y || 0
        ) +
        Number(
          item.width || 0
        ) /
          2;

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
    }
  );

  const normalizedDistance =
    Number.isFinite(
      nearestDistance
    )
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

/*
  Genera una grilla logística regular.
*/
function getRowPairPoints({
  extremePoints,
  orientation,
  dimensions,
}) {
  const points = [];

  const boxLength =
    Number(
      orientation.length || 0
    );

  const boxWidth =
    Number(
      orientation.width || 0
    );

  if (
    boxLength <= 0 ||
    boxWidth <= 0 ||
    dimensions.length <= 0 ||
    dimensions.width <= 0
  ) {
    return points;
  }

  const boxesPerRow =
    Math.floor(
      (
        dimensions.width +
        EPSILON
      ) /
      boxWidth
    );

  if (
    boxesPerRow < 1
  ) {
    return points;
  }

  const occupiedWidth =
    boxesPerRow *
    boxWidth;

  const startY =
    Math.max(
      0,
      (
        dimensions.width -
        occupiedWidth
      ) /
        2
    );

  const rowsOnFloor =
    Math.floor(
      (
        dimensions.length +
        EPSILON
      ) /
      boxLength
    );

  for (
    let row = 0;
    row < rowsOnFloor;
    row += 1
  ) {
    const x =
      row *
      boxLength;

    for (
      let column = 0;
      column < boxesPerRow;
      column += 1
    ) {
      const y =
        startY +
        column *
          boxWidth;

      points.push({
        x,
        y,
        z: 0,

        rowPair: true,
        floorGrid: true,

        rowColumn:
          column,

        rowColumns:
          boxesPerRow,

        rowIndex:
          row,
      });
    }
  }

  extremePoints.forEach(
    (point) => {
      const x =
        Number(
          point.x || 0
        );

      const z =
        Number(
          point.z || 0
        );

      for (
        let column = 0;
        column < boxesPerRow;
        column += 1
      ) {
        const y =
          startY +
          column *
            boxWidth;

        points.push({
          x,
          y,
          z,

          rowPair: true,

          floorGrid:
            z <= EPSILON,

          rowColumn:
            column,

          rowColumns:
            boxesPerRow,
        });
      }
    }
  );

  return points;
}

function runStrategy(
  capacity,
  selectedItems,
  strategy
) {
  const dimensions = {
    length:
      toNumber(
        capacity?.internal_length_m
      ),

    width:
      toNumber(
        capacity?.internal_width_m
      ),

    height:
      toNumber(
        capacity?.internal_height_m
      ),
  };

  const units =
    sortUnits(
      buildUnits(
        selectedItems
      ),
      strategy
    );

  if (
    dimensions.length <= 0 ||
    dimensions.width <= 0 ||
    dimensions.height <= 0
  ) {
    return {
      placed: [],

      rejected:
        units.map(
          (unit) => ({
            product:
              unit.product,

            unit:
              unit.unit,

            reason:
              "La unidad no tiene dimensiones internas válidas",
          })
        ),
    };
  }

  const placed = [];
  const rejected = [];

  const maximumWeight =
    getMaximumWeight(
      capacity
    );

  let usedWeight = 0;

  /*
    Centro geométrico de la unidad.
  */
  const centerX =
    dimensions.length / 2;

  const centerY =
    dimensions.width / 2;
      function buildFloorPositions(
    orientation
  ) {
    const positions = [];

    const boxLength =
      Number(
        orientation.length || 0
      );

    const boxWidth =
      Number(
        orientation.width || 0
      );

    if (
      boxLength <= 0 ||
      boxWidth <= 0
    ) {
      return positions;
    }

    const rows =
      Math.floor(
        (
          dimensions.length +
          EPSILON
        ) /
        boxLength
      );

    const columns =
      Math.floor(
        (
          dimensions.width +
          EPSILON
        ) /
        boxWidth
      );

    if (
      rows <= 0 ||
      columns <= 0
    ) {
      return positions;
    }

    const occupiedWidth =
      columns *
      boxWidth;

    const startY =
      Math.max(
        0,
        (
          dimensions.width -
          occupiedWidth
        ) / 2
      );

    /*
      Grilla regular de posiciones
      sobre el piso.
    */
    for (
      let row = 0;
      row < rows;
      row += 1
    ) {
      for (
        let column = 0;
        column < columns;
        column += 1
      ) {
        positions.push({
          x:
            row *
            boxLength,

          y:
            startY +
            column *
            boxWidth,

          z: 0,
        });
      }
    }

    /*
      Posición centrada longitudinalmente.

      Importante:
      boxLength ya está declarado antes,
      así evitamos el error que tenía
      el archivo anterior.
    */
    const centeredX =
      Math.max(
        0,
        Math.min(
          dimensions.length -
            boxLength,

          centerX -
            boxLength / 2
        )
      );

    /*
      Agregamos alternativas centradas
      usando exactamente las mismas
      columnas válidas de la grilla.
    */
    for (
      let column = 0;
      column < columns;
      column += 1
    ) {
      positions.push({
        x:
          centeredX,

        y:
          startY +
          column *
          boxWidth,

        z: 0,
      });
    }

    /*
      Puntos exactos pegados a las cargas
      ya colocadas.

      Esto es importante cuando mezclamos
      productos con medidas diferentes.
    */
    placed.forEach(
      (item) => {
        const itemX =
          Number(
            item.x || 0
          );

        const itemY =
          Number(
            item.y || 0
          );

        const itemLength =
          Number(
            item.length || 0
          );

        const itemWidth =
          Number(
            item.width || 0
          );

        /*
          Después del elemento.
        */
        positions.push({
          x:
            itemX +
            itemLength,

          y:
            itemY,

          z: 0,
        });

        /*
          Antes del elemento.
        */
        positions.push({
          x:
            itemX -
            boxLength,

          y:
            itemY,

          z: 0,
        });

        /*
          A un costado.
        */
        positions.push({
          x:
            itemX,

          y:
            itemY +
            itemWidth,

          z: 0,
        });

        /*
          Al otro costado.
        */
        positions.push({
          x:
            itemX,

          y:
            itemY -
            boxWidth,

          z: 0,
        });
      }
    );

    /*
      Eliminamos coordenadas repetidas.
    */
    const uniquePositions =
      new Map();

    positions.forEach(
      (position) => {
        const key =
          [
            Number(
              position.x
            ).toFixed(4),

            Number(
              position.y
            ).toFixed(4),

            Number(
              position.z
            ).toFixed(4),
          ].join("|");

        if (
          !uniquePositions.has(
            key
          )
        ) {
          uniquePositions.set(
            key,
            position
          );
        }
      }
    );

    return [
      ...uniquePositions.values(),
    ];
  }

  function buildStackPositions() {
    const positions = [];

    placed.forEach(
      (item) => {
        if (
          item.product
            ?.stackable === false
        ) {
          return;
        }

        positions.push({
          x:
            item.x,

          y:
            item.y,

          z:
            item.z +
            item.height,
        });
      }
    );

    return positions;
  }

  units.forEach(
    (unit, itemIndex) => {
      const productWeight =
        toNumber(
          unit.product
            ?.weight_kg
        );

      if (
        maximumWeight > 0 &&
        usedWeight +
          productWeight >
          maximumWeight
      ) {
        rejected.push({
          product:
            unit.product,

          unit:
            unit.unit,

          reason:
            "Supera el peso máximo permitido",
        });

        return;
      }

      const floorCandidates = [];
      const upperCandidates = [];

      const orientations =
        getOrientations(
          unit.product,
          strategy
        );

      orientations.forEach(
        (orientation) => {
          const floorPositions =
            buildFloorPositions(
              orientation
            );

          floorPositions.forEach(
            (point) => {
              const candidate = {
                x:
                  point.x,

                y:
                  point.y,

                z: 0,

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

              floorCandidates.push(
                candidate
              );
            }
          );

          const stackPositions =
            buildStackPositions();

          stackPositions.forEach(
            (point) => {
              const candidate = {
                x:
                  point.x,

                y:
                  point.y,

                z:
                  point.z,

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
                support +
                  EPSILON <
                0.8
              ) {
                return;
              }

              upperCandidates.push(
                candidate
              );
            }
          );
        }
      );
            function getFloorCandidatePriority(
        candidate
      ) {
        const remainingSameProduct =
          units
            .slice(itemIndex)
            .filter(
              (currentUnit) =>
                currentUnit
                  ?.product
                  ?.id ===
                unit.product?.id
            ).length;

        const boxesAcross =
          Math.max(
            1,
            Math.floor(
              (
                dimensions.width +
                EPSILON
              ) /
              candidate.width
            )
          );

        const rowsNeeded =
          Math.ceil(
            remainingSameProduct /
            boxesAcross
          );

        const batchLength =
          rowsNeeded *
          candidate.length;

        const unitsInRow =
          Math.min(
            remainingSameProduct,
            boxesAcross
          );

        const usedRowWidth =
          unitsInRow *
          candidate.width;

        const widthWaste =
          Math.max(
            0,
            dimensions.width -
              usedRowWidth
          );

        const rowFillRatio =
          dimensions.width > 0
            ? usedRowWidth /
              dimensions.width
            : 0;

        const canPlaceMultipleAcross =
          remainingSameProduct > 1 &&
          boxesAcross > 1;

        /*
          Detecta si esta posición queda
          exactamente al costado de otra
          unidad del mismo producto.
        */
        const formsSidePair =
          placed.some(
            (item) => {
              if (
                item?.product?.id !==
                unit.product?.id
              ) {
                return false;
              }

              const sameLevel =
                Math.abs(
                  Number(
                    item.z || 0
                  ) -
                  Number(
                    candidate.z || 0
                  )
                ) <= EPSILON;

              const overlapsX =
                candidate.x <
                  item.x +
                    item.length -
                    EPSILON &&
                candidate.x +
                  candidate.length >
                  item.x +
                    EPSILON;

              const touchesSide =
                Math.abs(
                  candidate.y -
                    (
                      item.y +
                      item.width
                    )
                ) <= EPSILON ||
                Math.abs(
                  candidate.y +
                    candidate.width -
                    item.y
                ) <= EPSILON;

              return (
                sameLevel &&
                overlapsX &&
                touchesSide
              );
            }
          );

        /*
          Calculamos cómo quedaría
          el centro de gravedad si
          colocáramos esta unidad.
        */
        const projectedBalance =
          getProjectedBalance({
            placedItems:
              placed,

            candidate,

            candidateWeight:
              productWeight,

            dimensions,
          });
/*
  Penalización fuerte de balance.

  Cuanto más se aleje el centro
  de gravedad proyectado del
  centro de la unidad, mayor
  será el costo de esta posición.
*/
const longitudinalBalancePenalty =
  projectedBalance.longitudinalOffset *
  1_000_000;

const lateralBalancePenalty =
  projectedBalance.lateralOffset *
  1_000_000;

const sideDistributionPenalty =
  projectedBalance
    .lateralDistributionDifference *
  500_000;

const totalBalancePenalty =
  longitudinalBalancePenalty +
  lateralBalancePenalty +
  sideDistributionPenalty;

        const axleProjection =
          getProjectedAxlePenalty({
            capacity,
            projectedBalance,
          });
          const layerPenalty =
  getLayerPlacementPenalty({
    candidate,
    placedItems:
      placed,
    dimensions,
    strategy,
  });

        const longitudinalDistance =
          Math.abs(
            candidate.x +
              candidate.length / 2 -
              centerX
          );

        const lateralDistance =
          Math.abs(
            candidate.y +
              candidate.width / 2 -
              centerY
          );

        return {
          formsSidePair,
          layerPenalty,
totalBalancePenalty,
          batchLength,
          widthWaste,
          rowFillRatio,
          boxesAcross,
          canPlaceMultipleAcross,

          projectedBalance,

          axlePenalty:
            axleProjection.penalty,

          axleOverload:
            axleProjection.totalOverload,

          longitudinalDistance,
          lateralDistance,
        };
      }

      floorCandidates.sort(
        (
          first,
          second
        ) => {
          const firstPriority =
            getFloorCandidatePriority(
              first
            );

          const secondPriority =
            getFloorCandidatePriority(
              second
            );
/*
  PRIMER BULTO:
  la pieza principal debe comenzar
  contra el frente de la unidad.

  No usamos nombres de productos.
  Simplemente se aplica al primer
  elemento ordenado por tamaño/peso.
*/
if (
  placed.length === 0
) {
  const firstFrontDistance =
    Math.abs(
      Number(first.x || 0)
    );
    const firstBalanceDiff =
  Math.abs(
    50 -
    Number(
      first.balance?.frontPercentage || 50
    )
  );

const secondBalanceDiff =
  Math.abs(
    50 -
    Number(
      second.balance?.frontPercentage || 50
    )
  );

if (
  Math.abs(
    firstBalanceDiff -
    secondBalanceDiff
  ) > 5
) {
  return (
    firstBalanceDiff -
    secondBalanceDiff
  );
}

  const secondFrontDistance =
    Math.abs(
      Number(second.x || 0)
    );

  if (
    Math.abs(
      firstFrontDistance -
      secondFrontDistance
    ) > EPSILON
  ) {
    return (
      firstFrontDistance -
      secondFrontDistance
    );
  }

  /*
    Si ambos están contra el frente,
    elegimos el que quede mejor
    centrado lateralmente.
  */
  const firstCenterY =
    Number(first.y || 0) +
    Number(first.width || 0) / 2;

  const secondCenterY =
    Number(second.y || 0) +
    Number(second.width || 0) / 2;

  return (
    Math.abs(
      firstCenterY -
      centerY
    ) -
    Math.abs(
      secondCenterY -
      centerY
    )
  );
}
          /*
            1. Evitamos sobrecargas
            de ejes.
          */
          if (
            Math.abs(
              firstPriority.axleOverload -
              secondPriority.axleOverload
            ) > EPSILON
          ) {
            return (
              firstPriority.axleOverload -
              secondPriority.axleOverload
            );
          }
/*
  Priorizamos posiciones compactas
  y continuas dentro de la misma capa.
*/
if (
  Math.abs(
    firstPriority.layerPenalty -
    secondPriority.layerPenalty
  ) > EPSILON
) {
  return (
    firstPriority.layerPenalty -
    secondPriority.layerPenalty
  );
}
          /*
            2. Mantener juntas las
            unidades iguales.
          */
          if (
            firstPriority.formsSidePair !==
            secondPriority.formsSidePair
          ) {
            return firstPriority.formsSidePair
              ? -1
              : 1;
          }

          /*
            3. Menor largo necesario
            para el lote.
          */
          if (
            Math.abs(
              firstPriority.batchLength -
              secondPriority.batchLength
            ) > EPSILON
          ) {
            return (
              firstPriority.batchLength -
              secondPriority.batchLength
            );
          }

          /*
            4. Si es posible colocar
            varias unidades lado a lado,
            priorizamos esa orientación.
          */
          if (
            firstPriority
              .canPlaceMultipleAcross !==
            secondPriority
              .canPlaceMultipleAcross
          ) {
            return firstPriority
              .canPlaceMultipleAcross
              ? -1
              : 1;
          }

          /*
            5. Mejor aprovechamiento
            del ancho.
          */
          if (
            Math.abs(
              firstPriority.rowFillRatio -
              secondPriority.rowFillRatio
            ) > EPSILON
          ) {
            return (
              secondPriority.rowFillRatio -
              firstPriority.rowFillRatio
            );
          }

          if (
            Math.abs(
              firstPriority.widthWaste -
              secondPriority.widthWaste
            ) > EPSILON
          ) {
            return (
              firstPriority.widthWaste -
              secondPriority.widthWaste
            );
          }

          /*
            6. Mejor balance
            longitudinal proyectado.
          */
          if (
            Math.abs(
              firstPriority
                .projectedBalance
                .longitudinalOffset -
              secondPriority
                .projectedBalance
                .longitudinalOffset
            ) > EPSILON
          ) {
            return (
              firstPriority
                .projectedBalance
                .longitudinalOffset -
              secondPriority
                .projectedBalance
                .longitudinalOffset
            );
          }

          /*
            7. Mejor reparto
            izquierda / derecha.
          */
          if (
            Math.abs(
              firstPriority
                .projectedBalance
                .lateralDistributionDifference -
              secondPriority
                .projectedBalance
                .lateralDistributionDifference
            ) > EPSILON
          ) {
            return (
              firstPriority
                .projectedBalance
                .lateralDistributionDifference -
              secondPriority
                .projectedBalance
                .lateralDistributionDifference
            );
          }

          if (
            Math.abs(
              firstPriority
                .projectedBalance
                .lateralOffset -
              secondPriority
                .projectedBalance
                .lateralOffset
            ) > EPSILON
          ) {
            return (
              firstPriority
                .projectedBalance
                .lateralOffset -
              secondPriority
                .projectedBalance
                .lateralOffset
            );
          }

          /*
            8. Penalización general
            de ejes.
          */
          if (
            Math.abs(
              firstPriority.axlePenalty -
              secondPriority.axlePenalty
            ) > EPSILON
          ) {
            return (
              firstPriority.axlePenalty -
              secondPriority.axlePenalty
            );
          }

          /*
            9. Cercanía geométrica
            al centro.
          */
          if (
            Math.abs(
              firstPriority.longitudinalDistance -
              secondPriority.longitudinalDistance
            ) > EPSILON
          ) {
            return (
              firstPriority.longitudinalDistance -
              secondPriority.longitudinalDistance
            );
          }

          if (
            Math.abs(
              firstPriority.lateralDistance -
              secondPriority.lateralDistance
            ) > EPSILON
          ) {
            return (
              firstPriority.lateralDistance -
              secondPriority.lateralDistance
            );
          }

          return (
            first.x -
              second.x ||
            first.y -
              second.y ||
            Number(
              first.rotationY || 0
            ) -
              Number(
                second.rotationY || 0
              )
          );
        }
      );
            upperCandidates.sort(
        (
          first,
          second
        ) =>
          first.z -
            second.z ||
          first.x -
            second.x ||
          first.y -
            second.y
      );

      const bestFloor =
  floorCandidates[0];

const bestUpper =
  upperCandidates[0];

let selected =
  bestFloor ||
  bestUpper;

/*
  APILADO COMPACTO AUTOMÁTICO

  Primero completamos una fila
  transversal del mismo producto.

  Cuando esa fila está completa,
  si existe una posición válida
  arriba, comenzamos la siguiente
  capa en lugar de extender la
  carga longitudinalmente.
*/
if (
  bestFloor &&
  bestUpper &&
  unit.product?.stackable !== false
) {
  const boxesAcross =
    Math.max(
      1,
      Math.floor(
        (
          dimensions.width +
          EPSILON
        ) /
        bestFloor.width
      )
    );

  const sameProductFloorItems =
    placed.filter(
      (item) =>
        item?.product?.id ===
          unit.product?.id &&
        Number(
          item.z || 0
        ) <= EPSILON
    );

  const firstRowComplete =
    sameProductFloorItems.length >=
    boxesAcross;

  if (firstRowComplete) {
    selected =
      bestUpper;
  }
}
      if (!selected) {
        rejected.push({
          product:
            unit.product,

          unit:
            unit.unit,

          reason:
            "No se encontró una posición válida",
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

        ...selected,

        orientation:
          selected.rotationY ===
          90
            ? "ROTATED_90"
            : "VERTICAL",

        color:
          getProductColor(
            unit.product
          ),

        locked:
          false,
      };

      placed.push(
        placedItem
      );

      usedWeight +=
        productWeight;
    }
  );
  
  return {
    placed,
    rejected,
  };
  /*
  Recentramos TODO el bloque compacto
  sin cambiar la distribución interna.

  Así mejoramos el balance longitudinal
  sin separar tolva, cintas y cajas.
*/
console.log(
  "ANTES DE RECENTER",
  {
    placedCount:
      placed.length,

    containerLength:
      dimensions.length,
  }
);
if (
  placed.length > 0 &&
  dimensions.length > 0
) {
  const minX =
    Math.min(
      ...placed.map(
        (item) => item.x
      )
    );

  const maxX =
    Math.max(
      ...placed.map(
        (item) =>
          item.x +
          item.length
      )
    );

  const blockLength =
    maxX - minX;

  const availableSpace =
    Math.max(
      0,
      dimensions.length -
      blockLength
    );

  const targetStartX =
    availableSpace / 2;

  const shiftX =
    targetStartX -
    minX;

  placed.forEach(
    (item) => {
      item.x += shiftX;
    }
  );
  console.log(
  "GROUPED RECENTER",
  {
    minX,
    maxX,
    blockLength,
    availableSpace,
    targetStartX,
    shiftX,
    finalCenterX:
      targetStartX +
      blockLength / 2,
  }
);
}
}

/*
  =====================================================
  PLANIFICADOR COMPACTO POR GRUPOS
  =====================================================

  Objetivo:

  1. Agrupar unidades iguales.
  2. Ordenar grupos por tamaño.
  3. Colocar el grupo dominante contra el frente.
  4. Completar cada fila transversalmente.
  5. Apilar automáticamente cuando corresponde.
  6. Continuar el siguiente grupo inmediatamente detrás.
*/
function runGroupedCompactStrategy(
  capacity,
  selectedItems,
  strategy
) {
  
  const dimensions = {
    length:
      toNumber(
        capacity?.internal_length_m
      ),

    width:
      toNumber(
        capacity?.internal_width_m
      ),

    height:
      toNumber(
        capacity?.internal_height_m
      ),
  };

  if (
    dimensions.length <= 0 ||
    dimensions.width <= 0 ||
    dimensions.height <= 0
  ) {
    return {
      placed: [],
      rejected: [],
    };
  }

  const maximumWeight =
    getMaximumWeight(
      capacity
    );

  let usedWeight = 0;

  const placed = [];
  const rejected = [];

  /*
    Convertimos los productos seleccionados
    en grupos completos.
  */
  const groups =
    selectedItems
      .map(
        (selectedItem) => ({
          product:
            selectedItem.product,

          quantity:
            Math.max(
              0,
              Math.floor(
                toNumber(
                  selectedItem.quantity
                )
              )
            ),
        })
      )
      .filter(
        (group) =>
          group.product &&
          group.quantity > 0
      );

  /*
    El producto físicamente dominante
    va primero.

    No usamos nombres como:
    tolva / cinta / caja.
  */
  groups.sort(
  (first, second) => {
    const firstLength =
      Math.max(
        toNumber(
          first.product?.length_m
        ),
        toNumber(
          first.product?.width_m
        )
      );

    const secondLength =
      Math.max(
        toNumber(
          second.product?.length_m
        ),
        toNumber(
          second.product?.width_m
        )
      );

    const firstFootprint =
      toNumber(
        first.product?.length_m
      ) *
      toNumber(
        first.product?.width_m
      );

    const secondFootprint =
      toNumber(
        second.product?.length_m
      ) *
      toNumber(
        second.product?.width_m
      );

    const firstVolume =
      getProductVolume(
        first.product
      );

    const secondVolume =
      getProductVolume(
        second.product
      );

    /*
      Primero van las piezas físicamente
      más largas.

      Esto mantiene delante elementos
      como tolvas y cintas, dejando las
      cajas pequeñas para después.
    */
    return (
  secondLength -
    firstLength ||

  secondFootprint -
    firstFootprint ||

  secondTotalWeight -
    firstTotalWeight ||

  secondVolume -
    firstVolume
);
  }
);

  /*
    cursorX marca dónde comienza
    el siguiente grupo.
  */
  let cursorX = 0;
  /*
  Guardaremos el inicio del bloque compacto.
  Más adelante podremos desplazar TODO el bloque
  para mejorar el balance sin separar productos.
*/
const compactBlockStartX =
  cursorX;  
  /*
    Recorremos cada grupo completo.
    Para cada producto elegiremos
    la orientación que permita formar
    el bloque más compacto.
  */
  groups.forEach(
    (group, groupIndex) => {
      const product =
        group.product;
        /*
  Peso individual del producto.
  Lo usaremos para evaluar la
  seguridad del apilado.
*/
const unitWeight =
  Math.max(
    0,
    toNumber(
      product?.weight_kg
    )
  );
              /*
        APILADO AUTOMÁTICO

        Si el producto permite apilado,
        calcularemos después cuántos niveles
        pueden utilizarse sin superar
        la altura disponible.
      */
      const canStack =
        product?.stackable !== false;

      const productHeight =
        toNumber(
          product?.height_m
        );

      const maximumStackLevels =
        canStack &&
        productHeight > 0
          ? Math.max(
              1,
              Math.floor(
                (
                  dimensions.height +
                  EPSILON
                ) /
                productHeight
              )
            )
          : 1;
      const orientations =
        getOrientations(
          product,
          strategy
        );

      if (
        orientations.length === 0
      ) {
        for (
          let unit = 1;
          unit <= group.quantity;
          unit += 1
        ) {
          rejected.push({
            product,
            unit,
            reason:
              "El producto no tiene dimensiones válidas",
          });
        }

        return;
      }

      /*
        Buscamos la orientación que
        necesite menos largo de carga.

        Así, por ejemplo, dos piezas
        que entren lado a lado tenderán
        a colocarse transversalmente.
      */
      const orientationOptions =
        orientations.map(
          (orientation) => {
            const across =
  Math.max(
    1,
    Math.floor(
      (
        dimensions.width +
        EPSILON
      ) /
      orientation.width
    )
  );

/*
  Cantidad de niveles posibles
  para este producto.
*/
const orientationStackLevels =
  canStack &&
  orientation.height > 0
    ? Math.max(
        1,
        Math.floor(
          (
            dimensions.height +
            EPSILON
          ) /
          orientation.height
        )
      )
    : 1;

/*
  Si el producto tiene definido un
  peso máximo soportado para apilado,
  lo respetamos.

  Si todavía no tiene ese dato,
  no inventamos un límite.
*/
const maximumStackWeight =
  toNumber(
    product?.max_stack_weight_kg
  );

const weightLimitedLevels =
  maximumStackWeight > 0 &&
  unitWeight > 0
    ? Math.max(
        1,
        Math.floor(
          maximumStackWeight /
          unitWeight
        ) + 1
      )
    : orientationStackLevels;

const levels =
  Math.max(
    1,
    Math.min(
      orientationStackLevels,
      weightLimitedLevels,
      group.quantity
    )
  );

/*
  Repartimos las unidades entre
  los niveles disponibles.

  Ejemplo:
  6 cajas, 3 por fila, 2 niveles
  => 3 abajo + 3 arriba.
*/
const unitsPerLevel =
  Math.min(
    across,
    Math.ceil(
      group.quantity /
      levels
    )
  );

const rows =
  Math.ceil(
    group.quantity /
    (
      unitsPerLevel *
      levels
    )
  );

const requiredLength =
  rows *
  orientation.length;

const usedHeight =
  levels *
  orientation.height;

            return {
  orientation,
  across,
  rows,
  levels,
  unitsPerLevel,
  requiredLength,
  usedHeight,
};
          }
        )
        .filter(
          (option) =>
            option.orientation.length <=
              dimensions.length +
                EPSILON &&
            option.orientation.width <=
              dimensions.width +
                EPSILON &&
            option.orientation.height <=
              dimensions.height +
                EPSILON
        );

      if (
        orientationOptions.length === 0
      ) {
        for (
          let unit = 1;
          unit <= group.quantity;
          unit += 1
        ) {
          rejected.push({
            product,
            unit,
            reason:
              "El producto no entra en la unidad",
          });
        }

        return;
      }

      orientationOptions.sort(
  (first, second) => {
    const firstAcross =
      Math.min(
        first.across,
        group.quantity
      );

    const secondAcross =
      Math.min(
        second.across,
        group.quantity
      );

    const firstRows =
      Math.ceil(
        group.quantity /
        firstAcross
      );

    const secondRows =
      Math.ceil(
        group.quantity /
        secondAcross
      );

    const firstLengthUsed =
      firstRows *
      first.orientation.length;

    const secondLengthUsed =
      secondRows *
      second.orientation.length;

    const firstWidthUsed =
      firstAcross *
      first.orientation.width;

    const secondWidthUsed =
      secondAcross *
      second.orientation.width;

    /*
      1. Primero buscamos la orientación
      que ocupe MENOS LARGO total.
      
      Para dos cintas largas, esto debe
      favorecer girarlas y ponerlas
      transversalmente si físicamente entran.
    */
    if (
      Math.abs(
        firstLengthUsed -
        secondLengthUsed
      ) > EPSILON
    ) {
      return (
        firstLengthUsed -
        secondLengthUsed
      );
    }

    /*
      2. Si ocupan el mismo largo,
      preferimos aprovechar más el ancho.
    */
    if (
      Math.abs(
        firstWidthUsed -
        secondWidthUsed
      ) > EPSILON
    ) {
      return (
        secondWidthUsed -
        firstWidthUsed
      );
    }

    /*
      3. Finalmente preferimos menos filas.
    */
    return (
      firstRows -
      secondRows
    );
  }
);

      const chosen =
        orientationOptions[0];

      const orientation =
        chosen.orientation;

      /*
        Cantidad máxima que podemos
        colocar lado a lado.
      */
      const across =
  Math.max(
    1,
    Math.min(
      chosen.across,
      group.quantity
    )
  );
/*
  Calculamos cuántos niveles verticales
  admite este producto.

  Primero llenaremos el piso y después
  comenzaremos a apilar.
*/
const maximumLayers =
  product?.stackable === false
    ? 1
    : Math.max(
        1,
        Math.floor(
          (
            dimensions.height +
            EPSILON
          ) /
          orientation.height
        )
      );
/*
  Evaluamos todas las cantidades posibles
  de niveles.

  Buscamos un equilibrio entre:
  - poco largo ocupado;
  - buen aprovechamiento del ancho;
  - poca altura innecesaria.
*/
let bestLayerCount = 1;
let bestLayerScore = Infinity;

for (
  let candidateLayers = 1;
  candidateLayers <= maximumLayers;
  candidateLayers += 1
) {
  const candidateUnitsPerSlice =
    across *
    candidateLayers;

  const candidateRows =
    Math.ceil(
      group.quantity /
      candidateUnitsPerSlice
    );

  const candidateLength =
    candidateRows *
    orientation.length;

  const candidateWidth =
    Math.min(
      across,
      group.quantity
    ) *
    orientation.width;

  const candidateHeight =
    candidateLayers *
    orientation.height;

  const candidateScore =
    candidateLength +
    candidateWidth +
    candidateHeight * 1.5;

  if (
    candidateScore <
    bestLayerScore
  ) {
    bestLayerScore =
      candidateScore;

    bestLayerCount =
      candidateLayers;
  }
}
/*
  Usamos la cantidad de niveles
  que obtuvo la mejor puntuación
  de compactación.
*/
const layers =
  Math.max(
    1,
    Math.min(
      maximumLayers,
      bestLayerCount
    )
  );

const unitsPerSlice =
  across * layers;
  /*
  Cantidad de filas longitudinales
  necesarias para este bloque.

  Esto nos permite evaluar la forma
  real del grupo antes de colocarlo.
*/
const requiredRows =
  Math.max(
    1,
    Math.ceil(
      group.quantity /
      unitsPerSlice
    )
  );

const blockLength =
  requiredRows *
  orientation.length;

const blockWidth =
  Math.min(
    across,
    group.quantity
  ) *
  orientation.width;

const blockHeight =
  layers *
  orientation.height;
  /*
  Puntuación geométrica del bloque.

  Menor puntuación = bloque más compacto.

  Penalizamos especialmente la altura
  para evitar torres innecesarias cuando
  existe espacio útil en el piso.
*/
const blockFootprint =
  blockLength *
  blockWidth;

const blockVolume =
  blockFootprint *
  blockHeight;

const compactnessScore =
  blockLength +
  blockWidth +
  blockHeight * 1.5;
      /*
        Centramos transversalmente
        la fila del grupo.
      */
      const rowItems =
        Math.min(
          group.quantity,
          across
        );

      const occupiedWidth =
        rowItems *
        orientation.width;

      const startY =
        Math.max(
          0,
          (
            dimensions.width -
            occupiedWidth
          ) / 2
        );
              /*
        Colocamos el grupo comenzando
        exactamente en cursorX.

        Cada fila ocupa el ancho y,
        cuando se completa, avanzamos
        longitudinalmente.
      */
      for (
        let unitIndex = 0;
        unitIndex < group.quantity;
        unitIndex += 1
      ) {
        /*
  Llenamos primero una fila completa
  en el piso y luego repetimos
  exactamente esa fila encima.
*/
/*
  Elegimos una cantidad equilibrada
  de unidades por nivel.

  Para 6 unidades intentará formar
  3 abajo + 3 arriba si físicamente
  caben y pueden apilarse.
*/
const availableLevels =
  canStack
    ? Math.max(
        1,
        Number(
          chosen.levels || 1
        )
      )
    : 1;

const desiredPerLayer =
  canStack
    ? Math.ceil(
        group.quantity /
        Math.min(
          2,
          availableLevels
        )
      )
    : group.quantity;

const unitsInLayer =
  Math.max(
    1,
    Math.min(
      across,
      desiredPerLayer
    )
  );

/*
  Distribución compacta por bloques.

  Primero llena transversalmente el piso.
  Después apila encima de esas posiciones.
  Cuando completa todos los niveles,
  recién avanza longitudinalmente.
*/
const row =
  Math.floor(
    unitIndex /
    unitsPerSlice
  );

const positionInSlice =
  unitIndex %
  unitsPerSlice;

const layer =
  Math.floor(
    positionInSlice /
    across
  );

const column =
  positionInSlice %
  across;

const x =
  cursorX +
  row *
    orientation.length;

const y =
  startY +
  column *
    orientation.width;

const z =
  layer *
  orientation.height;

const candidate = {
  x,
  y,
  z,

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

        /*
          Validación de peso.
        */
        const productWeight =
          toNumber(
            product?.weight_kg
          );

        if (
          maximumWeight > 0 &&
          usedWeight +
            productWeight >
            maximumWeight
        ) {
          rejected.push({
            product,
            unit:
              unitIndex + 1,
            reason:
              "Supera el peso máximo permitido",
          });

          continue;
        }

        /*
          Debe quedar completamente
          dentro de la unidad.
        */
        if (
          !isInsideContainer(
            candidate,
            dimensions
          )
        ) {
          rejected.push({
            product,
            unit:
              unitIndex + 1,
            reason:
              "No entra en el espacio disponible",
          });

          continue;
        }

        /*
          No puede solaparse con otro
          producto ya colocado.
        */
        if (
          placed.some(
            (item) =>
              boxesOverlap(
                candidate,
                item
              )
          )
        ) {
          rejected.push({
            product,
            unit:
              unitIndex + 1,
            reason:
              "La posición calculada está ocupada",
          });

          continue;
        }
/*
  Si la unidad va apilada,
  debe tener soporte suficiente
  debajo de su base.
*/
if (
  candidate.z > EPSILON
) {
  const support =
    getSupportRatio(
      candidate,
      placed
    );

  if (
    support + EPSILON < 0.8
  ) {
    rejected.push({
      product,
      unit:
        unitIndex + 1,
      reason:
        "No tiene apoyo suficiente para apilar",
    });

    continue;
  }
}
        const placedItem = {
          id:
            `grouped-${product.id}-${unitIndex + 1}-${groupIndex}`,

          instanceId:
            `grouped-${product.id}-${unitIndex + 1}-${groupIndex}`,

          product,

          unit:
            unitIndex + 1,

          ...candidate,

          orientation:
            candidate.rotationY === 90
              ? "ROTATED_90"
              : "VERTICAL",

          color:
            getProductColor(
              product
            ),

          locked: false,
        };

        placed.push(
          placedItem
        );

        usedWeight +=
          productWeight;
      }
            /*
        El siguiente grupo comienza
        inmediatamente después del
        espacio ocupado por este grupo.
      */
      /*
  Avanzamos solamente el largo
  realmente ocupado por el bloque.

  Si el grupo se apila en varios niveles,
  no reservamos largo extra innecesario.
*/
const groupGap =
  0.02;

/*
  Avanzamos solamente el largo
  realmente ocupado por el bloque,
  teniendo en cuenta el apilado.
*/
const longitudinalRows =
  Math.ceil(
    group.quantity /
    unitsPerSlice
  );

cursorX +=
  longitudinalRows *
  orientation.length;
  groupGap;
    }
  );
  /*
    Recentramos el bloque completo
    longitudinalmente sin modificar
    la distribución interna.
  */
  if (
    placed.length > 0 &&
    dimensions.length > 0
  ) {
    const minX =
      Math.min(
        ...placed.map(
          (item) => item.x
        )
      );

    const maxX =
      Math.max(
        ...placed.map(
          (item) =>
            item.x +
            item.length
        )
      );

    const blockLength =
      maxX - minX;

    const availableSpace =
      Math.max(
        0,
        dimensions.length -
        blockLength
      );

    const targetStartX =
      availableSpace / 2;

    const shiftX =
      targetStartX -
      minX;

    placed.forEach(
      (item) => {
        item.x += shiftX;
      }
    );

    
  }

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
            item?.product
              ?.weight_kg
          ),
          EPSILON
        );

      const itemCenterX =
        toNumber(
          item.x
        ) +
        toNumber(
          item.length
        ) /
          2;

      const itemCenterY =
        toNumber(
          item.y
        ) +
        toNumber(
          item.width
        ) /
          2;

      totalWeight +=
        weight;

      momentX +=
        weight *
        itemCenterX;

      momentY +=
        weight *
        itemCenterY;

      if (
        itemCenterY <=
        width / 2
      ) {
        leftWeight +=
          weight;
      } else {
        rightWeight +=
          weight;
      }
    }
  );

  if (
    totalWeight <= 0
  ) {
    return {
      lateralDifference: 0,
      longitudinalOffset: 0,
      lateralOffset: 0,
    };
  }

  const centerX =
    momentX /
    totalWeight;

  const centerY =
    momentY /
    totalWeight;

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
    /*
    Nueva alternativa compacta
    por grupos completos.
  */
  const groupedResult =
    runGroupedCompactStrategy(
      capacity,
      selectedItems,
      compactStrategy
    );

  const groupedEvaluation =
    evaluateSolution({
      capacity,
      result:
        groupedResult,
      strategy:
        compactStrategy,
    });
    const alternatives = [
    {
      strategy:
        compactStrategy,

      result:
        groupedResult,

      evaluation:
        groupedEvaluation,

      floorFootprint:
        getFloorFootprint(
          groupedResult
        ),

      balance:
        getSolutionBalance(
          capacity,
          groupedResult
        ),

      grouped:
        true,
    },

    ...STRATEGIES.map(
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

          grouped:
            false,
        };
      }
    ),
  ]
  .sort(
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
          placedDifference !==
          0
        ) {
          return placedDifference;
        }
        /*
  PRIORIDAD 1.5

  Si ambas alternativas colocan
  la misma cantidad de productos,
  damos prioridad al nuevo
  planificador compacto por grupos.
*/
if (
  first.grouped !==
  second.grouped
) {
  return first.grouped
    ? -1
    : 1;
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
          rejectedDifference !==
          0
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
          Menor utilización máxima
          de cualquiera de los ejes.
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
        alternativesAnalyzed:
          0,

        strategyName:
          "Sin estrategia",

        qualityScore:
          0,

        alternatives:
          [],
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
              alternative
                .strategy.id,

            strategyName:
              alternative
                .strategy.name,

            qualityScore:
              alternative
                .evaluation
                .qualityScore,

            placedCount:
              alternative
                .evaluation
                .placedCount,

            rejectedCount:
              alternative
                .evaluation
                .rejectedCount,

            volumePercentage:
              alternative
                .evaluation
                .volumePercentage,

            floorFootprint:
              alternative
                .floorFootprint,

            frontAxleLoad:
              Number(
                alternative
                  .evaluation
                  ?.frontAxleLoad ||
                  0
              ),

            rearAxleLoad:
              Number(
                alternative
                  .evaluation
                  ?.rearAxleLoad ||
                  0
              ),

            frontAxleUsagePercent:
              Number(
                alternative
                  .evaluation
                  ?.frontAxleUsagePercent ||
                  0
              ),

            rearAxleUsagePercent:
              Number(
                alternative
                  .evaluation
                  ?.rearAxleUsagePercent ||
                  0
              ),

            totalAxleOverload:
              Number(
                alternative
                  .evaluation
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
      id:
        strategy.id,

      name:
        strategy.name,

      description:
        strategy.description,
    })
  );
}