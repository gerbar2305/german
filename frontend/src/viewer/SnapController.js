const DEFAULT_THRESHOLD = 0.05;
const EPSILON = 0.0001;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getDimensions(item) {
  return {
    length: toNumber(item.length ?? item.product?.length_m, 1),
    width: toNumber(item.width ?? item.product?.width_m, 1),
    height: toNumber(item.height ?? item.product?.height_m, 1),
  };
}

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
  if (!candidate || !capacity) {
    return candidate;
  }

  const containerLength = toNumber(
    capacity.internal_length_m
  );

  const containerWidth = toNumber(
    capacity.internal_width_m
  );

  const xTargets = [
    0,
    containerLength - candidate.length,
  ];

  const yTargets = [
    0,
    containerWidth - candidate.width,
  ];

  placedItems.forEach((item, index) => {
    if (index === movingIndex) {
      return;
    }

    const dimensions = getDimensions(item);
    const itemX = toNumber(item.x);
    const itemY = toNumber(item.y);
    const itemZ = toNumber(item.z);

    const sameLevel =
      Math.abs(
        itemZ - toNumber(candidate.z)
      ) <= Math.max(threshold, EPSILON);

    if (!sameLevel) {
      return;
    }

    xTargets.push(
      itemX - candidate.length,
      itemX + dimensions.length,
      itemX,
      itemX +
        dimensions.length -
        candidate.length
    );

    yTargets.push(
      itemY - candidate.width,
      itemY + dimensions.width,
      itemY,
      itemY +
        dimensions.width -
        candidate.width
    );
  });

  return {
    ...candidate,
    x: Number(
      closest(
        toNumber(candidate.x),
        unique(xTargets),
        threshold
      ).toFixed(4)
    ),
    y: Number(
      closest(
        toNumber(candidate.y),
        unique(yTargets),
        threshold
      ).toFixed(4)
    ),
  };
}
