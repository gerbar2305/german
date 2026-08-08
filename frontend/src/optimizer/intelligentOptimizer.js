import {
  createInitialSpace,
  orientationFitsSpace,
  pruneFreeSpaces,
  splitFreeSpace,
} from "./freeSpace.js";

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
      const firstStackable = first.product?.stackable !== false ? 1 : 0;
      const secondStackable = second.product?.stackable !== false ? 1 : 0;
      if (firstStackable !== secondStackable) {
        return secondStackable - firstStackable;
      }
    }

    if (strategy.order === "weight_desc") {
      return secondWeight - firstWeight || secondVolume - firstVolume;
    }

    return secondVolume - firstVolume || secondWeight - firstWeight;
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

  const candidateArea = candidate.length * candidate.width;

  if (candidateArea <= EPSILON) {
    return 0;
  }

  let supportedArea = 0;

  placedItems.forEach((item) => {
    const sameLevel =
      Math.abs(item.z + item.height - candidate.z) <= EPSILON;

    if (!sameLevel || item.product?.stackable === false) {
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

  return Math.min(1, supportedArea / candidateArea);
}

function canPlace(candidate, placedItems) {
  const collision = placedItems.some((item) =>
    boxesOverlap(candidate, item)
  );

  if (collision) {
    return false;
  }

  return getSupportRatio(candidate, placedItems) + EPSILON >= 0.8;
}

function scoreCandidate({
  candidate,
  space,
  placedItems,
  dimensions,
  strategy,
}) {
  const unusedVolume =
    space.length * space.width * space.height -
    candidate.length * candidate.width * candidate.height;

  const supportPenalty =
    (1 - getSupportRatio(candidate, placedItems)) *
    strategy.weights.support;

  const centerX = candidate.x + candidate.length / 2;
  const centerY = candidate.y + candidate.width / 2;

  const distanceX =
    Math.abs(centerX - dimensions.length / 2) /
    Math.max(dimensions.length, EPSILON);

  const distanceY =
    Math.abs(centerY - dimensions.width / 2) /
    Math.max(dimensions.width, EPSILON);

  return (
    candidate.z * strategy.weights.height +
    candidate.y * strategy.weights.lateral +
    candidate.x * strategy.weights.depth +
    supportPenalty +
    unusedVolume * strategy.weights.freeSpace +
    distanceX * strategy.weights.balanceX +
    distanceY * strategy.weights.balanceY
  );
}

function isInsideContainer(candidate, dimensions) {
  return (
    candidate.x >= -EPSILON &&
    candidate.y >= -EPSILON &&
    candidate.z >= -EPSILON &&
    candidate.x + candidate.length <= dimensions.length + EPSILON &&
    candidate.y + candidate.width <= dimensions.width + EPSILON &&
    candidate.z + candidate.height <= dimensions.height + EPSILON
  );
}

function runStrategy(capacity, selectedItems, strategy) {
  const dimensions = {
    length: toNumber(capacity?.internal_length_m),
    width: toNumber(capacity?.internal_width_m),
    height: toNumber(capacity?.internal_height_m),
  };

  const units = sortUnits(buildUnits(selectedItems), strategy);

  if (
    dimensions.length <= 0 ||
    dimensions.width <= 0 ||
    dimensions.height <= 0
  ) {
    return {
      placed: [],
      rejected: units.map((unit) => ({
        product: unit.product,
        unit: unit.unit,
        reason: "La unidad no tiene dimensiones internas válidas",
      })),
    };
  }

  const placed = [];
  const rejected = [];
  let extremePoints = createInitialExtremePoints();
  const maximumWeight = getMaximumWeight(capacity);
  let usedWeight = 0;

  units.forEach((unit, itemIndex) => {
    const productWeight = toNumber(unit.product?.weight_kg);

    if (maximumWeight > 0 && usedWeight + productWeight > maximumWeight) {
      rejected.push({
        product: unit.product,
        unit: unit.unit,
        reason: "Supera el peso máximo permitido",
      });
      return;
    }

    const candidates = [];

    extremePoints.forEach((point) => {
      getOrientations(unit.product, strategy).forEach((orientation) => {
        const candidate = {
          x: point.x,
          y: point.y,
          z: point.z,
          length: orientation.length,
          width: orientation.width,
          height: orientation.height,
          rotated: orientation.rotated,
          rotationY: orientation.rotationY,
        };

        if (!isInsideContainer(candidate, dimensions)) return;
        if (placed.some((item) => boxesOverlap(candidate, item))) return;

        const support = getSupportRatio(candidate, placed);
        if (support + EPSILON < 0.8) return;

        const centerX = candidate.x + candidate.length / 2;
        const centerY = candidate.y + candidate.width / 2;
        const distanceX = Math.abs(centerX - dimensions.length / 2) / Math.max(dimensions.length, EPSILON);
        const distanceY = Math.abs(centerY - dimensions.width / 2) / Math.max(dimensions.width, EPSILON);
        const stackingBonus = strategy.preferStacking && candidate.z > EPSILON
          ? toNumber(strategy.weights.stackingBonus, 320000)
          : 0;

        const score =
          candidate.z * toNumber(strategy.weights.height) +
          candidate.y * toNumber(strategy.weights.lateral) +
          candidate.x * toNumber(strategy.weights.depth) +
          (1 - support) * toNumber(strategy.weights.support) +
          distanceX * toNumber(strategy.weights.balanceX) +
          distanceY * toNumber(strategy.weights.balanceY) -
          stackingBonus;

        candidates.push({ candidate, score });
      });
    });

    candidates.sort((a, b) => a.score - b.score);
    const selected = candidates[0];

    if (!selected) {
      rejected.push({
        product: unit.product,
        unit: unit.unit,
        reason: "No se encontró una posición extrema compatible",
      });
      return;
    }

    const placedItem = {
      id: `${strategy.id}-${unit.product.id}-${unit.unit}-${itemIndex}`,
      instanceId: `${strategy.id}-${unit.product.id}-${unit.unit}-${itemIndex}`,
      product: unit.product,
      unit: unit.unit,
      ...selected.candidate,
      orientation: selected.candidate.rotationY === 90 ? "ROTATED_90" : "VERTICAL",
      color: getProductColor(unit.product),
      locked: false,
    };

    placed.push(placedItem);
    usedWeight += productWeight;
    extremePoints = updateExtremePoints({
      currentPoints: extremePoints,
      placedItem,
      placedItems: placed,
      dimensions,
    });
  });

  return { placed, rejected };
}

function getFloorFootprint(result) {
  return result.placed.reduce((total, item) => {
    if (Number(item.z || 0) > EPSILON) {
      return total;
    }

    return (
      total +
      toNumber(item.length) *
        toNumber(item.width)
    );
  }, 0);
}

export function runIntelligentOptimization(
  capacity,
  selectedItems
) {
  const alternatives = STRATEGIES.map((strategy) => {
    const result = runStrategy(
      capacity,
      selectedItems,
      strategy
    );

    const evaluation = evaluateSolution({
      capacity,
      result,
      strategy,
    });

    return {
      strategy,
      result,
      evaluation,
      floorFootprint: getFloorFootprint(result),
    };
  }).sort((first, second) => {
    const placedDifference =
      second.evaluation.placedCount -
      first.evaluation.placedCount;

    if (placedDifference !== 0) {
      return placedDifference;
    }

    const rejectedDifference =
      first.evaluation.rejectedCount -
      second.evaluation.rejectedCount;

    if (rejectedDifference !== 0) {
      return rejectedDifference;
    }

    const floorDifference =
      first.floorFootprint -
      second.floorFootprint;

    if (Math.abs(floorDifference) > EPSILON) {
      return floorDifference;
    }

    return (
      second.evaluation.rawScore -
      first.evaluation.rawScore
    );
  });

  const best = alternatives[0];

  if (!best) {
    return {
      placed: [],
      rejected: [],
      intelligence: {
        alternativesAnalyzed: 0,
        strategyName: "Sin estrategia",
        qualityScore: 0,
        alternatives: [],
      },
    };
  }

  return {
    placed: best.result.placed,
    rejected: best.result.rejected,
    intelligence: {
      alternativesAnalyzed: alternatives.length,
      strategyName: best.strategy.name,
      strategyDescription: best.strategy.description,
      qualityScore: best.evaluation.qualityScore,
      metrics: best.evaluation,
      alternatives: alternatives.map((alternative) => ({
        strategyId: alternative.strategy.id,
        strategyName: alternative.strategy.name,
        qualityScore: alternative.evaluation.qualityScore,
        placedCount: alternative.evaluation.placedCount,
        rejectedCount: alternative.evaluation.rejectedCount,
        volumePercentage: alternative.evaluation.volumePercentage,
        floorFootprint: alternative.floorFootprint,
      })),
    },
  };
}

export function getAvailableStrategies() {
  return STRATEGIES.map((strategy) => ({
    id: strategy.id,
    name: strategy.name,
    description: strategy.description,
  }));
}
