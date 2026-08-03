import {
  getCapacityDimensions,
  getItemDimensions,
  getItemPosition,
  getRotatedFootprint,
  getRotationY,
  normalizeRotation,
} from "./ViewerUtils.js";

const EPSILON = 0.0001;

function verticalRangesOverlap(first, second) {
  return (
    first.z < second.z + second.height - EPSILON &&
    first.z + first.height > second.z + EPSILON
  );
}

function getRectangleCorners(box) {
  const angle = normalizeRotation(box.rotationY) * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const footprint = getRotatedFootprint(
    box.length,
    box.width,
    box.rotationY
  );

  const centerX = box.x + footprint.length / 2;
  const centerY = box.y + footprint.width / 2;
  const halfLength = box.length / 2;
  const halfWidth = box.width / 2;

  return [
    [-halfLength, -halfWidth],
    [halfLength, -halfWidth],
    [halfLength, halfWidth],
    [-halfLength, halfWidth],
  ].map(([localX, localY]) => ({
    x: centerX + localX * cosine - localY * sine,
    y: centerY + localX * sine + localY * cosine,
  }));
}

function getAxes(corners) {
  return [0, 1].map((index) => {
    const current = corners[index];
    const next = corners[(index + 1) % corners.length];
    const edgeX = next.x - current.x;
    const edgeY = next.y - current.y;
    const length = Math.hypot(edgeX, edgeY) || 1;

    return {
      x: -edgeY / length,
      y: edgeX / length,
    };
  });
}

function project(corners, axis) {
  const values = corners.map(
    (point) => point.x * axis.x + point.y * axis.y
  );

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function boxesOverlap(first, second) {
  if (!verticalRangesOverlap(first, second)) {
    return false;
  }

  const firstCorners = getRectangleCorners(first);
  const secondCorners = getRectangleCorners(second);
  const axes = [...getAxes(firstCorners), ...getAxes(secondCorners)];

  return axes.every((axis) => {
    const firstProjection = project(firstCorners, axis);
    const secondProjection = project(secondCorners, axis);

    return (
      firstProjection.min < secondProjection.max - EPSILON &&
      firstProjection.max > secondProjection.min + EPSILON
    );
  });
}

export function isInsideContainer(candidate, capacity) {
  const dimensions = getCapacityDimensions(capacity);
  const corners = getRectangleCorners(candidate);

  return (
    corners.every(
      (corner) =>
        corner.x >= -EPSILON &&
        corner.y >= -EPSILON &&
        corner.x <= dimensions.length + EPSILON &&
        corner.y <= dimensions.width + EPSILON
    ) &&
    candidate.z >= -EPSILON &&
    candidate.z + candidate.height <= dimensions.height + EPSILON
  );
}

export function buildItemBox(item) {
  return {
    ...getItemPosition(item),
    ...getItemDimensions(item),
    rotationY: getRotationY(item),
  };
}

export function isValidPlacement({
  candidate,
  placedItems,
  movingIndex,
  capacity,
}) {
  const normalizedCandidate = {
    ...candidate,
    rotationY: normalizeRotation(candidate.rotationY),
  };

  if (!isInsideContainer(normalizedCandidate, capacity)) {
    return false;
  }

  return !placedItems.some((otherItem, otherIndex) => {
    if (otherIndex === movingIndex) return false;

    return boxesOverlap(
      normalizedCandidate,
      buildItemBox(otherItem)
    );
  });
}
