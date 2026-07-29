export function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

export function getCapacityDimensions(capacity) {
  return {
    length: toNumber(
      capacity?.internal_length_m
    ),
    width: toNumber(
      capacity?.internal_width_m
    ),
    height: toNumber(
      capacity?.internal_height_m
    ),
  };
}

export function getItemDimensions(item) {
  return {
    length: toNumber(item?.length, 1),
    width: toNumber(item?.width, 1),
    height: toNumber(
      item?.height ??
        item?.product?.height_m,
      1
    ),
  };
}

export function getItemPosition(item) {
  return {
    x: toNumber(item?.x),
    y: toNumber(item?.y),
    z: toNumber(item?.z),
  };
}

export function getProductColor(
  item,
  index = 0
) {
  const colors = [
    "#2563eb",
    "#16a34a",
    "#ea580c",
    "#9333ea",
    "#0891b2",
    "#dc2626",
    "#ca8a04",
    "#4f46e5",
  ];

  return (
    item?.color ||
    colors[index % colors.length]
  );
}

export function createItemKey(
  item,
  index
) {
  return String(
    item?.instanceId ??
      item?.load_item_id ??
      item?.id ??
      index
  );
}