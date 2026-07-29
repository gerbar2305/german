import { getItemDimensions } from "./ViewerUtils.js";

function clampDistance(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Number(value.toFixed(4)));
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  const epsilon = 0.0001;
  return aStart < bEnd - epsilon && aEnd > bStart + epsilon;
}

export function calculateClearances({
  candidate,
  capacity,
  placedItems = [],
  movingIndex = null,
}) {
  const containerLength = Number(capacity?.internal_length_m || 0);
  const containerWidth = Number(capacity?.internal_width_m || 0);

  const result = {
    front: clampDistance(candidate.x),
    back: clampDistance(
      containerLength - candidate.x - candidate.length
    ),
    left: clampDistance(candidate.y),
    right: clampDistance(
      containerWidth - candidate.y - candidate.width
    ),
    nearestBox: null,
  };

  let nearest = Infinity;

  placedItems.forEach((item, index) => {
    if (index === movingIndex) {
      return;
    }

    const dimensions = getItemDimensions(item);
    const other = {
      x: Number(item.x || 0),
      y: Number(item.y || 0),
      z: Number(item.z || 0),
      ...dimensions,
    };

    const sameHeightBand = rangesOverlap(
      candidate.z,
      candidate.z + candidate.height,
      other.z,
      other.z + other.height
    );

    if (!sameHeightBand) {
      return;
    }

    const overlapY = rangesOverlap(
      candidate.y,
      candidate.y + candidate.width,
      other.y,
      other.y + other.width
    );

    if (overlapY) {
      const before = candidate.x - (other.x + other.length);
      const after = other.x - (candidate.x + candidate.length);

      if (before >= -0.0001) nearest = Math.min(nearest, Math.max(0, before));
      if (after >= -0.0001) nearest = Math.min(nearest, Math.max(0, after));
    }

    const overlapX = rangesOverlap(
      candidate.x,
      candidate.x + candidate.length,
      other.x,
      other.x + other.length
    );

    if (overlapX) {
      const before = candidate.y - (other.y + other.width);
      const after = other.y - (candidate.y + candidate.width);

      if (before >= -0.0001) nearest = Math.min(nearest, Math.max(0, before));
      if (after >= -0.0001) nearest = Math.min(nearest, Math.max(0, after));
    }
  });

  result.nearestBox = Number.isFinite(nearest)
    ? clampDistance(nearest)
    : null;

  return result;
}
