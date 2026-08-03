export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeRotation(value) {
  const number = toNumber(value, 0);
  return ((number % 360) + 360) % 360;
}

export function getRotationY(item) {
  return normalizeRotation(item?.rotationY ?? item?.rotation_y ?? 0);
}

export function getCapacityDimensions(capacity) {
  return {
    length: toNumber(capacity?.internal_length_m),
    width: toNumber(capacity?.internal_width_m),
    height: toNumber(capacity?.internal_height_m),
  };
}

export function getItemDimensions(item) {
  return {
    length: toNumber(item?.length ?? item?.product?.length_m, 1),
    width: toNumber(item?.width ?? item?.product?.width_m, 1),
    height: toNumber(item?.height ?? item?.product?.height_m, 1),
  };
}

export function getRotatedFootprint(length, width, rotationY = 0) {
  const angle = normalizeRotation(rotationY) * Math.PI / 180;
  const cosine = Math.abs(Math.cos(angle));
  const sine = Math.abs(Math.sin(angle));

  return {
    length: length * cosine + width * sine,
    width: length * sine + width * cosine,
  };
}

export function getItemFootprint(item) {
  const dimensions = getItemDimensions(item);
  return getRotatedFootprint(
    dimensions.length,
    dimensions.width,
    getRotationY(item)
  );
}

export function getItemPosition(item) {
  return {
    x: toNumber(item?.x),
    y: toNumber(item?.y),
    z: toNumber(item?.z),
  };
}

export function getProductColor(item, index = 0) {
  const colors = [
    "#2563eb", "#16a34a", "#ea580c", "#9333ea",
    "#0891b2", "#dc2626", "#ca8a04", "#4f46e5",
  ];

  return item?.color || colors[index % colors.length];
}

export function createItemKey(item, index) {
  return String(
    item?.instanceId ??
      item?.load_item_id ??
      item?.id ??
      index
  );
}
