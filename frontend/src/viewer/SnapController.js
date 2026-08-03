import {
  getItemFootprint,
  getRotatedFootprint,
  toNumber,
} from "./ViewerUtils.js";

const DEFAULT_THRESHOLD = 0.05;
const EPSILON = 0.0001;

function closest(value, targets, threshold) {
  let best = value;
  let bestDistance = threshold + EPSILON;

  for (const target of targets) {
    const distance = Math.abs(value - target);
    if (distance <= threshold && distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }

  return best;
}

function unique(values) {
  return [
    ...new Set(
      values
        .filter(Number.isFinite)
        .map((value) => Number(value.toFixed(6)))
    ),
  ];
}

export function getSnappedCandidate({
  candidate,
  placedItems = [],
  movingIndex = null,
  capacity,
  threshold = DEFAULT_THRESHOLD,
}) {
  if (!candidate || !capacity) return candidate;

  const containerLength = toNumber(capacity.internal_length_m);
  const containerWidth = toNumber(capacity.internal_width_m);
  const footprint = getRotatedFootprint(
    candidate.length,
    candidate.width,
    candidate.rotationY
  );

  const xTargets = [0, containerLength - footprint.length];
  const yTargets = [0, containerWidth - footprint.width];

  placedItems.forEach((item, index) => {
    if (index === movingIndex) return;

    const itemFootprint = getItemFootprint(item);
    const itemX = toNumber(item.x);
    const itemY = toNumber(item.y);
    const itemZ = toNumber(item.z);

    if (
      Math.abs(itemZ - toNumber(candidate.z)) >
      Math.max(threshold, EPSILON)
    ) {
      return;
    }

    xTargets.push(
      itemX - footprint.length,
      itemX + itemFootprint.length,
      itemX,
      itemX + itemFootprint.length - footprint.length
    );

    yTargets.push(
      itemY - footprint.width,
      itemY + itemFootprint.width,
      itemY,
      itemY + itemFootprint.width - footprint.width
    );
  });

  return {
    ...candidate,
    x: Number(
      closest(toNumber(candidate.x), unique(xTargets), threshold).toFixed(4)
    ),
    y: Number(
      closest(toNumber(candidate.y), unique(yTargets), threshold).toFixed(4)
    ),
  };
}
