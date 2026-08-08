const EPSILON = 0.0001;

function keyOf(point) {
  return [point.x, point.y, point.z]
    .map((value) => Number(value).toFixed(4))
    .join("|");
}

function isInsidePoint(point, dimensions) {
  return (
    point.x >= -EPSILON &&
    point.y >= -EPSILON &&
    point.z >= -EPSILON &&
    point.x <= dimensions.length + EPSILON &&
    point.y <= dimensions.width + EPSILON &&
    point.z <= dimensions.height + EPSILON
  );
}

function pointInsideBox(point, box) {
  return (
    point.x > box.x + EPSILON &&
    point.x < box.x + box.length - EPSILON &&
    point.y > box.y + EPSILON &&
    point.y < box.y + box.width - EPSILON &&
    point.z > box.z + EPSILON &&
    point.z < box.z + box.height - EPSILON
  );
}

export function createInitialExtremePoints() {
  return [{ x: 0, y: 0, z: 0 }];
}

export function updateExtremePoints({
  currentPoints = [],
  placedItem,
  placedItems = [],
  dimensions,
}) {
  const next = [
    ...currentPoints,
    { x: placedItem.x + placedItem.length, y: placedItem.y, z: placedItem.z },
    { x: placedItem.x, y: placedItem.y + placedItem.width, z: placedItem.z },
  ];

  if (placedItem.product?.stackable !== false) {
    next.push({
      x: placedItem.x,
      y: placedItem.y,
      z: placedItem.z + placedItem.height,
    });
  }

  placedItems.forEach((item) => {
    next.push(
      { x: placedItem.x + placedItem.length, y: item.y, z: Math.max(placedItem.z, item.z) },
      { x: item.x, y: placedItem.y + placedItem.width, z: Math.max(placedItem.z, item.z) }
    );
  });

  const unique = new Map();
  next.forEach((point) => {
    if (!isInsidePoint(point, dimensions)) return;
    if (placedItems.some((box) => pointInsideBox(point, box))) return;
    unique.set(keyOf(point), {
      x: Math.max(0, Number(point.x.toFixed(4))),
      y: Math.max(0, Number(point.y.toFixed(4))),
      z: Math.max(0, Number(point.z.toFixed(4))),
    });
  });

  return [...unique.values()].sort(
    (a, b) => a.z - b.z || a.x - b.x || a.y - b.y
  );
}
