import {
  getItemFootprint,
  getRotatedFootprint,
} from "./ViewerUtils.js";

function clampDistance(value) {
  if (!Number.isFinite(value)) return null;
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
  const footprint = getRotatedFootprint(
    candidate.length,
    candidate.width,
    candidate.rotationY
  );

  const result = {
    front: clampDistance(candidate.x),
    back: clampDistance(
      containerLength - candidate.x - footprint.length
    ),
    left: clampDistance(candidate.y),
    right: clampDistance(
      containerWidth - candidate.y - footprint.width
    ),
    nearestBox: null,
  };

  let nearest = Infinity;

  placedItems.forEach((item, index) => {
    if (index === movingIndex) return;

    const otherFootprint = getItemFootprint(item);
    const other = {
      x: Number(item.x || 0),
      y: Number(item.y || 0),
      z: Number(item.z || 0),
      length: otherFootprint.length,
      width: otherFootprint.width,
      height: Number(item.height || item.product?.height_m || 1),
    };

    if (
      !rangesOverlap(
        candidate.z,
        candidate.z + candidate.height,
        other.z,
        other.z + other.height
      )
    ) {
      return;
    }

    if (
      rangesOverlap(
        candidate.y,
        candidate.y + footprint.width,
        other.y,
        other.y + other.width
      )
    ) {
      const before = candidate.x - (other.x + other.length);
      const after = other.x - (candidate.x + footprint.length);

      if (before >= -0.0001) nearest = Math.min(nearest, Math.max(0, before));
      if (after >= -0.0001) nearest = Math.min(nearest, Math.max(0, after));
    }

    if (
      rangesOverlap(
        candidate.x,
        candidate.x + footprint.length,
        other.x,
        other.x + other.length
      )
    ) {
      const before = candidate.y - (other.y + other.width);
      const after = other.y - (candidate.y + footprint.width);

      if (before >= -0.0001) nearest = Math.min(nearest, Math.max(0, before));
      if (after >= -0.0001) nearest = Math.min(nearest, Math.max(0, after));
    }
  });

  result.nearestBox = Number.isFinite(nearest)
    ? clampDistance(nearest)
    : null;

  return result;
}
