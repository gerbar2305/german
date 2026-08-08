function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getWeight(item) {
  return toNumber(item?.product?.weight_kg ?? item?.weight_kg);
}

export function evaluateSolution({
  capacity,
  result,
  strategy,
}) {
  const length = toNumber(capacity?.internal_length_m);
  const width = toNumber(capacity?.internal_width_m);
  const height = toNumber(capacity?.internal_height_m);

  const capacityVolume = length * width * height;

  let usedVolume = 0;
  let totalWeight = 0;
  let momentX = 0;
  let momentY = 0;
  let momentZ = 0;

  result.placed.forEach((item) => {
    const itemVolume =
      toNumber(item.length) *
      toNumber(item.width) *
      toNumber(item.height);

    const weight = getWeight(item);

    const centerX = toNumber(item.x) + toNumber(item.length) / 2;
    const centerY = toNumber(item.y) + toNumber(item.width) / 2;
    const centerZ = toNumber(item.z) + toNumber(item.height) / 2;

    usedVolume += itemVolume;
    totalWeight += weight;
    momentX += weight * centerX;
    momentY += weight * centerY;
    momentZ += weight * centerZ;
  });

  const center = totalWeight > 0
    ? {
        x: momentX / totalWeight,
        y: momentY / totalWeight,
        z: momentZ / totalWeight,
      }
    : {
        x: length / 2,
        y: width / 2,
        z: 0,
      };

  const volumePercentage =
    capacityVolume > 0
      ? (usedVolume / capacityVolume) * 100
      : 0;

  const longitudinalDeviation =
    length > 0
      ? Math.abs(center.x - length / 2) / length
      : 0;

  const lateralDeviation =
    width > 0
      ? Math.abs(center.y - width / 2) / width
      : 0;

  const centerHeightRatio =
    height > 0 ? center.z / height : 0;

  const placedCount = result.placed.length;
  const rejectedCount = result.rejected.length;

  const rawScore =
    placedCount * 1_000_000 -
    rejectedCount * 1_500_000 +
    volumePercentage * 1_500 -
    longitudinalDeviation * 120_000 -
    lateralDeviation * 180_000 -
    centerHeightRatio * 45_000;

  const qualityScore = Math.max(
    0,
    Math.min(
      100,
      100 -
        rejectedCount * 20 -
        longitudinalDeviation * 100 -
        lateralDeviation * 150 -
        centerHeightRatio * 20
    )
  );

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    rawScore,
    qualityScore,
    placedCount,
    rejectedCount,
    usedVolume,
    volumePercentage,
    totalWeight,
    center,
    longitudinalDeviation,
    lateralDeviation,
    centerHeightRatio,
  };
}
