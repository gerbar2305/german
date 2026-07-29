import { getItemDimensions } from "./ViewerUtils.js";

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getItemWeight(item) {
  return numberOrZero(
    item?.weight_kg ??
      item?.product?.weight_kg ??
      item?.product?.weight ??
      0
  );
}

export function calculateWeightBalance({ capacity, placedItems = [] }) {
  const length = numberOrZero(capacity?.internal_length_m);
  const width = numberOrZero(capacity?.internal_width_m);
  const height = numberOrZero(capacity?.internal_height_m);

  let totalWeight = 0;
  let momentX = 0;
  let momentY = 0;
  let momentZ = 0;
  let frontWeight = 0;
  let backWeight = 0;
  let leftWeight = 0;
  let rightWeight = 0;

  placedItems.forEach((item) => {
    const weight = getItemWeight(item);
    if (weight <= 0) return;

    const dimensions = getItemDimensions(item);
    const centerX = numberOrZero(item.x) + dimensions.length / 2;
    const centerY = numberOrZero(item.y) + dimensions.width / 2;
    const centerZ = numberOrZero(item.z) + dimensions.height / 2;

    totalWeight += weight;
    momentX += weight * centerX;
    momentY += weight * centerY;
    momentZ += weight * centerZ;

    if (centerX <= length / 2) frontWeight += weight;
    else backWeight += weight;

    if (centerY <= width / 2) leftWeight += weight;
    else rightWeight += weight;
  });

  const center = totalWeight > 0
    ? {
        x: momentX / totalWeight,
        y: momentY / totalWeight,
        z: momentZ / totalWeight,
      }
    : { x: length / 2, y: width / 2, z: 0 };

  const percentage = (value) =>
    totalWeight > 0 ? (value / totalWeight) * 100 : 0;

  const longitudinalOffset = length > 0
    ? ((center.x - length / 2) / length) * 100
    : 0;
  const lateralOffset = width > 0
    ? ((center.y - width / 2) / width) * 100
    : 0;

  const warnings = [];
  if (Math.abs(lateralOffset) > 10) {
    warnings.push(
      lateralOffset < 0
        ? "La carga está concentrada hacia la izquierda."
        : "La carga está concentrada hacia la derecha."
    );
  }
  if (Math.abs(longitudinalOffset) > 10) {
    warnings.push(
      longitudinalOffset < 0
        ? "La carga está concentrada hacia el frente."
        : "La carga está concentrada hacia el fondo."
    );
  }

  const maxPayload = numberOrZero(
    capacity?.max_payload_kg ?? capacity?.max_weight_kg ?? capacity?.payload_kg
  );
  if (maxPayload > 0 && totalWeight > maxPayload) {
    warnings.push(
      `El peso total supera la capacidad declarada por ${(totalWeight - maxPayload).toFixed(0)} kg.`
    );
  }

  // Cálculo opcional de reacción en dos ejes. Solo se muestra cuando el
  // vehículo tiene posiciones de ejes configuradas en metros.
  let axleLoads = null;
  const frontAxleX = Number(capacity?.front_axle_position_m);
  const rearAxleX = Number(capacity?.rear_axle_position_m);
  if (
    totalWeight > 0 &&
    Number.isFinite(frontAxleX) &&
    Number.isFinite(rearAxleX) &&
    rearAxleX > frontAxleX
  ) {
    const wheelbase = rearAxleX - frontAxleX;
    const rear = totalWeight * ((center.x - frontAxleX) / wheelbase);
    const front = totalWeight - rear;
    axleLoads = {
      front: Math.max(0, front),
      rear: Math.max(0, rear),
    };
  }

  return {
    totalWeight,
    maxPayload,
    center,
    centerPercent: {
      x: length > 0 ? (center.x / length) * 100 : 50,
      y: width > 0 ? (center.y / width) * 100 : 50,
      z: height > 0 ? (center.z / height) * 100 : 0,
    },
    distribution: {
      front: percentage(frontWeight),
      back: percentage(backWeight),
      left: percentage(leftWeight),
      right: percentage(rightWeight),
    },
    warnings,
    axleLoads,
  };
}
