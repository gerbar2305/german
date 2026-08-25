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

  const tareWeight = numberOrZero(
    capacity?.tare_weight_kg ??
      capacity?.tare_kg ??
      capacity?.empty_weight_kg
  );

  const maxGrossWeight = numberOrZero(
    capacity?.max_gross_weight_kg ??
      capacity?.gross_weight_kg ??
      capacity?.max_gross_kg
  );

  const declaredMaxPayload = numberOrZero(
    capacity?.max_payload_kg ??
      capacity?.max_weight_kg ??
      capacity?.payload_kg
  );

  const derivedPayload =
    maxGrossWeight > 0 && maxGrossWeight >= tareWeight
      ? maxGrossWeight - tareWeight
      : 0;

  const maxPayload =
    declaredMaxPayload > 0 ? declaredMaxPayload : derivedPayload;

  let totalWeight = 0;
  let momentX = 0;
  let momentY = 0;
  let momentZ = 0;
  let frontWeight = 0;
  let backWeight = 0;
  let leftWeight = 0;
  let rightWeight = 0;

  const activeItems = placedItems.filter((item) => !item?.standby);

  activeItems.forEach((item) => {
    const weight = getItemWeight(item);
    if (weight <= 0) return;

    const dimensions = getItemDimensions(item);

    const centerX =
      numberOrZero(item.x) + numberOrZero(dimensions.length) / 2;

    const centerY =
      numberOrZero(item.y) + numberOrZero(dimensions.width) / 2;

    const centerZ =
      numberOrZero(item.z) + numberOrZero(dimensions.height) / 2;

    totalWeight += weight;

    momentX += weight * centerX;
    momentY += weight * centerY;
    momentZ += weight * centerZ;

    if (centerX <= length / 2) frontWeight += weight;
    else backWeight += weight;

    if (centerY <= width / 2) leftWeight += weight;
    else rightWeight += weight;
  });

  const grossWeight = tareWeight + totalWeight;

  const payloadRemaining =
    maxPayload > 0 ? Math.max(0, maxPayload - totalWeight) : null;

  const grossRemaining =
    maxGrossWeight > 0
      ? Math.max(0, maxGrossWeight - grossWeight)
      : null;

  const payloadUsagePercent =
    maxPayload > 0 ? (totalWeight / maxPayload) * 100 : 0;

  const grossUsagePercent =
    maxGrossWeight > 0 ? (grossWeight / maxGrossWeight) * 100 : 0;

  const center =
    totalWeight > 0
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

  const percentage = (value) =>
    totalWeight > 0 ? (value / totalWeight) * 100 : 0;

  const longitudinalOffset =
    length > 0
      ? ((center.x - length / 2) / length) * 100
      : 0;

  const lateralOffset =
    width > 0
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

  if (maxPayload > 0 && totalWeight > maxPayload) {
    warnings.push(
      `La mercadería supera la carga útil máxima por ${(
        totalWeight - maxPayload
      ).toFixed(0)} kg.`
    );
  }

  if (maxGrossWeight > 0 && grossWeight > maxGrossWeight) {
    warnings.push(
      `El peso bruto actual supera el peso bruto máximo por ${(
        grossWeight - maxGrossWeight
      ).toFixed(0)} kg.`
    );
  }

  if (
    declaredMaxPayload > 0 &&
    derivedPayload > 0 &&
    Math.abs(declaredMaxPayload - derivedPayload) > 1
  ) {
    warnings.push(
      `La carga útil declarada (${declaredMaxPayload.toFixed(
        0
      )} kg) no coincide con peso bruto máximo menos tara (${derivedPayload.toFixed(
        0
      )} kg).`
    );
  }

    let axleLoads = null;

  const frontAxleX = Number(
    capacity?.front_axle_position_m
  );

  const rearAxleX = Number(
    capacity?.rear_axle_position_m
  );

  const frontAxleMax = numberOrZero(
    capacity?.front_axle_max_kg
  );

  const rearAxleMax = numberOrZero(
    capacity?.rear_axle_max_kg
  );

  if (
    totalWeight > 0 &&
    Number.isFinite(frontAxleX) &&
    Number.isFinite(rearAxleX) &&
    rearAxleX > frontAxleX
  ) {
    const wheelbase =
      rearAxleX - frontAxleX;

    /*
      Reacciones producidas únicamente por
      la mercadería cargada.

      Fórmula de equilibrio estático:

      Rtrasero =
        Peso ×
        (CentroCarga - EjeDelantero)
        / DistanciaEntreEjes

      Rdelantero =
        Peso - Rtrasero
    */

    let rearCargoLoad =
      totalWeight *
      ((center.x - frontAxleX) /
        wheelbase);

    let frontCargoLoad =
      totalWeight - rearCargoLoad;

    /*
      Si el centro de carga queda por fuera
      de la distancia entre ejes, matemáticamente
      podría producir una reacción negativa.

      Para la interfaz evitamos mostrar
      valores negativos, pero dejamos advertencia.
    */

    if (rearCargoLoad < 0) {
      warnings.push(
        "El centro de la carga se encuentra por delante del eje delantero."
      );
    }

    if (frontCargoLoad < 0) {
      warnings.push(
        "El centro de la carga se encuentra por detrás del eje trasero."
      );
    }

    frontCargoLoad =
      Math.max(0, frontCargoLoad);

    rearCargoLoad =
      Math.max(0, rearCargoLoad);

    const frontUsagePercent =
      frontAxleMax > 0
        ? (frontCargoLoad /
            frontAxleMax) *
          100
        : 0;

    const rearUsagePercent =
      rearAxleMax > 0
        ? (rearCargoLoad /
            rearAxleMax) *
          100
        : 0;

    const frontRemaining =
      frontAxleMax > 0
        ? Math.max(
            0,
            frontAxleMax -
              frontCargoLoad
          )
        : null;

    const rearRemaining =
      rearAxleMax > 0
        ? Math.max(
            0,
            rearAxleMax -
              rearCargoLoad
          )
        : null;

    const frontOverload =
      frontAxleMax > 0
        ? Math.max(
            0,
            frontCargoLoad -
              frontAxleMax
          )
        : 0;

    const rearOverload =
      rearAxleMax > 0
        ? Math.max(
            0,
            rearCargoLoad -
              rearAxleMax
          )
        : 0;

    /*
      Estas advertencias son sobre
      la reacción de la mercadería.

      Más adelante agregaremos la tara
      distribuida por eje para obtener
      peso total real por eje.
    */

    if (frontOverload > 0) {
      warnings.push(
        `La carga transmitida al eje delantero supera su límite configurado por ${frontOverload.toFixed(
          0
        )} kg.`
      );
    }

    if (rearOverload > 0) {
      warnings.push(
        `La carga transmitida al eje trasero supera su límite configurado por ${rearOverload.toFixed(
          0
        )} kg.`
      );
    }

    axleLoads = {
      configured: true,

      wheelbase,

      frontPosition: frontAxleX,
      rearPosition: rearAxleX,

      /*
        Peso generado por la mercadería
      */
      frontCargoLoad,
      rearCargoLoad,

      /*
        Mantengo front/rear por compatibilidad
        con cualquier código anterior.
      */
      front: frontCargoLoad,
      rear: rearCargoLoad,

      frontMax: frontAxleMax,
      rearMax: rearAxleMax,

      frontUsagePercent,
      rearUsagePercent,

      frontRemaining,
      rearRemaining,

      frontOverload,
      rearOverload,

      frontOverloaded:
        frontOverload > 0,

      rearOverloaded:
        rearOverload > 0,

      /*
        Importante:
        todavía no incluye distribución
        de la tara del vehículo.
      */
      includesTare: false,
      calculationMode: "cargo_reaction",
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

    tareWeight,
    maxGrossWeight,
    grossWeight,
    payloadRemaining,
    grossRemaining,
    payloadUsagePercent,
    grossUsagePercent,
    declaredMaxPayload,
    derivedPayload,
    activeItemCount: activeItems.length,
  };
}