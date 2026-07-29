import {
  createInitialSpace,
  orientationFitsSpace,
  pruneFreeSpaces,
  splitFreeSpace,
} from "./freeSpace.js";

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

function getProductColor(product) {
  const numericId = Number(product.id);

  if (Number.isFinite(numericId)) {
    return COLORS[Math.abs(numericId) % COLORS.length];
  }

  const name = String(product.name || "");

  const hash = [...name].reduce(
    (total, character) =>
      total + character.charCodeAt(0),
    0
  );

  return COLORS[hash % COLORS.length];
}

function getOrientations(product) {
  const length = Number(product.length_m || 0);
  const width = Number(product.width_m || 0);
  const height = Number(product.height_m || 0);

  const orientations = [
    {
      length,
      width,
      height,
      rotated: false,
    },
  ];

  if (product.rotatable && length !== width) {
    orientations.push({
      length: width,
      width: length,
      height,
      rotated: true,
    });
  }

  return orientations.filter(
    (orientation) =>
      orientation.length > 0 &&
      orientation.width > 0 &&
      orientation.height > 0
  );
}

function boxesOverlap(a, b) {
  return !(
    a.x + a.length <= b.x + EPSILON ||
    a.x >= b.x + b.length - EPSILON ||
    a.y + a.width <= b.y + EPSILON ||
    a.y >= b.y + b.width - EPSILON ||
    a.z + a.height <= b.z + EPSILON ||
    a.z >= b.z + b.height - EPSILON
  );
}

function getSupportRatio(candidate, placedItems) {
  if (candidate.z <= EPSILON) {
    return 1;
  }

  const candidateArea =
    candidate.length * candidate.width;

  if (!candidateArea) {
    return 0;
  }

  let supportedArea = 0;

  placedItems.forEach((item) => {
    const itemTop = item.z + item.height;

    const sameLevel =
      Math.abs(itemTop - candidate.z) < EPSILON;

    if (!sameLevel || !item.product?.stackable) {
      return;
    }

    const overlapX =
      Math.min(
        candidate.x + candidate.length,
        item.x + item.length
      ) - Math.max(candidate.x, item.x);

    const overlapY =
      Math.min(
        candidate.y + candidate.width,
        item.y + item.width
      ) - Math.max(candidate.y, item.y);

    if (overlapX > 0 && overlapY > 0) {
      supportedArea += overlapX * overlapY;
    }
  });

  return Math.min(
    1,
    supportedArea / candidateArea
  );
}

function canPlace(candidate, placedItems) {
  const collision = placedItems.some((item) =>
    boxesOverlap(candidate, item)
  );

  if (collision) {
    return false;
  }

  return (
    getSupportRatio(candidate, placedItems) >= 0.8
  );
}

function getMaximumWeight(capacity) {
  return Number(
    capacity.max_weight_kg ||
      capacity.payload_capacity_kg ||
      capacity.capacity_kg ||
      0
  );
}

function getUsedWeight(placedItems) {
  return placedItems.reduce(
    (total, item) =>
      total +
      Number(item.product?.weight_kg || 0),
    0
  );
}

function buildUnits(selectedItems) {
  const units = [];

  selectedItems.forEach((selectedItem) => {
    const quantity = Number(
      selectedItem.quantity || 0
    );

    for (
      let unit = 0;
      unit < quantity;
      unit += 1
    ) {
      units.push({
        product: selectedItem.product,
        unit: unit + 1,
      });
    }
  });

  return units;
}

function getProductVolume(product) {
  return (
    Number(product.length_m || 0) *
    Number(product.width_m || 0) *
    Number(product.height_m || 0)
  );
}

function sortUnits(units) {
  return [...units].sort((a, b) => {
    const volumeDifference =
      getProductVolume(b.product) -
      getProductVolume(a.product);

    if (volumeDifference !== 0) {
      return volumeDifference;
    }

    return (
      Number(b.product.weight_kg || 0) -
      Number(a.product.weight_kg || 0)
    );
  });
}

function scoreCandidate(candidate, space, placedItems) {
  const unusedVolume =
    space.length * space.width * space.height -
    candidate.length *
      candidate.width *
      candidate.height;

  const supportPenalty =
    (1 -
      getSupportRatio(candidate, placedItems)) *
    100000;

  const heightPenalty =
    candidate.z * 1000000;

  const lateralPenalty =
    candidate.y * 10000;

  const depthPenalty =
    candidate.x * 100;

  return (
    heightPenalty +
    lateralPenalty +
    depthPenalty +
    supportPenalty +
    unusedVolume
  );
}

export default function arrangeProducts(
  capacity,
  selectedItems
) {
  if (!capacity) {
    return {
      placed: [],
      rejected: [],
    };
  }

  const dimensions = {
    length: Number(
      capacity.internal_length_m || 0
    ),
    width: Number(
      capacity.internal_width_m || 0
    ),
    height: Number(
      capacity.internal_height_m || 0
    ),
  };

  if (
    dimensions.length <= 0 ||
    dimensions.width <= 0 ||
    dimensions.height <= 0
  ) {
    return {
      placed: [],
      rejected: buildUnits(selectedItems).map(
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

  let freeSpaces = [
    createInitialSpace(dimensions),
  ];

  const maximumWeight =
    getMaximumWeight(capacity);

  const units = sortUnits(
    buildUnits(selectedItems)
  );

  units.forEach((unit, itemIndex) => {
    const productWeight = Number(
      unit.product.weight_kg || 0
    );

    const currentWeight =
      getUsedWeight(placed);

    if (
      maximumWeight > 0 &&
      currentWeight + productWeight >
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

    freeSpaces.forEach((space, spaceIndex) => {
      getOrientations(unit.product).forEach(
        (orientation) => {
          if (
            !orientationFitsSpace(
              orientation,
              space
            )
          ) {
            return;
          }

          const candidate = {
            x: space.x,
            y: space.y,
            z: space.z,
            length: orientation.length,
            width: orientation.width,
            height: orientation.height,
            rotated: orientation.rotated,
          };

          if (!canPlace(candidate, placed)) {
            return;
          }

          candidates.push({
            candidate,
            space,
            spaceIndex,
            score: scoreCandidate(
              candidate,
              space,
              placed
            ),
          });
        }
      );
    });

    candidates.sort(
      (a, b) => a.score - b.score
    );

    const selected = candidates[0];

    if (!selected) {
      rejected.push({
        product: unit.product,
        unit: unit.unit,
        reason:
          "No se encontró un espacio libre compatible",
      });

      return;
    }

    const placedItem = {
      id: `${unit.product.id}-${unit.unit}-${itemIndex}`,
      product: unit.product,
      ...selected.candidate,
      color: getProductColor(
        unit.product
      ),
    };

    placed.push(placedItem);

    const remainingSpaces =
      splitFreeSpace(
        selected.space,
        placedItem
      );

    freeSpaces = freeSpaces.filter(
      (_, index) =>
        index !== selected.spaceIndex
    );

    freeSpaces.push(...remainingSpaces);

    freeSpaces =
      pruneFreeSpaces(freeSpaces);
  });

  return {
    placed,
    rejected,
  };
}