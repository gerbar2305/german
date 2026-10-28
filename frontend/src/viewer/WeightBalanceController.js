import { getItemDimensions } from "./ViewerUtils.js";

function numberOrZero(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function getItemWeight(item) {
  return numberOrZero(
    item?.weight_kg ??
      item?.product?.weight_kg ??
      item?.product?.weight ??
      0
  );
}

export function calculateWeightBalance({
  capacity,
  placedItems = [],
}) {
  const length = numberOrZero(
    capacity?.internal_length_m
  );

  const width = numberOrZero(
    capacity?.internal_width_m
  );

  const height = numberOrZero(
    capacity?.internal_height_m
  );

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

  const declaredMaxPayload =
    numberOrZero(
      capacity?.max_payload_kg ??
        capacity?.max_weight_kg ??
        capacity?.payload_kg
    );

  const derivedPayload =
    maxGrossWeight > 0 &&
    maxGrossWeight >= tareWeight
      ? maxGrossWeight -
        tareWeight
      : 0;

  const maxPayload =
    declaredMaxPayload > 0
      ? declaredMaxPayload
      : derivedPayload;

  let totalWeight = 0;

  let momentX = 0;
  let momentY = 0;
  let momentZ = 0;

  let frontWeight = 0;
  let backWeight = 0;
  let leftWeight = 0;
  let rightWeight = 0;

  const activeItems =
    placedItems.filter(
      (item) =>
        !item?.standby
    );

  activeItems.forEach(
    (item) => {
      const weight =
        getItemWeight(item);

      if (weight <= 0) {
        return;
      }

      const dimensions =
        getItemDimensions(item);

      const centerX =
        numberOrZero(item.x) +
        numberOrZero(
          dimensions.length
        ) /
          2;

      const centerY =
        numberOrZero(item.y) +
        numberOrZero(
          dimensions.width
        ) /
          2;

      const centerZ =
        numberOrZero(item.z) +
        numberOrZero(
          dimensions.height
        ) /
          2;

      totalWeight += weight;

      momentX +=
        weight *
        centerX;

      momentY +=
        weight *
        centerY;

      momentZ +=
        weight *
        centerZ;

      /*
  Repartimos el peso según la parte
  física del producto que queda
  delante y detrás del centro.
*/
const itemStartX =
  numberOrZero(item.x);

const itemEndX =
  itemStartX +
  numberOrZero(
    dimensions.length
  );

const middleX =
  length / 2;

const itemLength =
  Math.max(
    numberOrZero(
      dimensions.length
    ),
    0.0001
  );

const frontLength =
  Math.max(
    0,
    Math.min(
      itemEndX,
      middleX
    ) -
      itemStartX
  );

const backLength =
  Math.max(
    0,
    itemEndX -
      Math.max(
        itemStartX,
        middleX
      )
  );

frontWeight +=
  weight *
  (frontLength / itemLength);

backWeight +=
  weight *
  (backLength / itemLength);

      /*
  Repartimos el peso según la parte
  física del producto que queda
  a la izquierda y a la derecha
  del centro.
*/
const itemStartY =
  numberOrZero(item.y);

const itemEndY =
  itemStartY +
  numberOrZero(
    dimensions.width
  );

const middleY =
  width / 2;

const itemWidth =
  Math.max(
    numberOrZero(
      dimensions.width
    ),
    0.0001
  );

const leftWidth =
  Math.max(
    0,
    Math.min(
      itemEndY,
      middleY
    ) -
      itemStartY
  );

const rightWidth =
  Math.max(
    0,
    itemEndY -
      Math.max(
        itemStartY,
        middleY
      )
  );

leftWeight +=
  weight *
  (leftWidth / itemWidth);

rightWeight +=
  weight *
  (rightWidth / itemWidth);
    }
  );

  const grossWeight =
    tareWeight +
    totalWeight;

  const payloadRemaining =
    maxPayload > 0
      ? Math.max(
          0,
          maxPayload -
            totalWeight
        )
      : null;

  const grossRemaining =
    maxGrossWeight > 0
      ? Math.max(
          0,
          maxGrossWeight -
            grossWeight
        )
      : null;

  const payloadUsagePercent =
    maxPayload > 0
      ? (
          totalWeight /
          maxPayload
        ) *
        100
      : 0;

  const grossUsagePercent =
    maxGrossWeight > 0
      ? (
          grossWeight /
          maxGrossWeight
        ) *
        100
      : 0;

  const center =
    totalWeight > 0
      ? {
          x:
            momentX /
            totalWeight,

          y:
            momentY /
            totalWeight,

          z:
            momentZ /
            totalWeight,
        }
      : {
          x:
            length / 2,

          y:
            width / 2,

          z: 0,
        };

  const percentage = (
    value
  ) =>
    totalWeight > 0
      ? (
          value /
          totalWeight
        ) *
        100
      : 0;

  const longitudinalOffset =
    length > 0
      ? (
          (
            center.x -
            length / 2
          ) /
          length
        ) *
        100
      : 0;

  const lateralOffset =
    width > 0
      ? (
          (
            center.y -
            width / 2
          ) /
          width
        ) *
        100
      : 0;

  const warnings = [];

  if (
    Math.abs(
      lateralOffset
    ) > 10
  ) {
    warnings.push(
      lateralOffset < 0
        ? "La carga está concentrada hacia la izquierda."
        : "La carga está concentrada hacia la derecha."
    );
  }

  if (
    Math.abs(
      longitudinalOffset
    ) > 10
  ) {
    warnings.push(
      longitudinalOffset < 0
        ? "La carga está concentrada hacia el frente."
        : "La carga está concentrada hacia el fondo."
    );
  }

  if (
    maxPayload > 0 &&
    totalWeight >
      maxPayload
  ) {
    warnings.push(
      `La mercadería supera la carga útil máxima por ${(
        totalWeight -
        maxPayload
      ).toFixed(0)} kg.`
    );
  }

  if (
    maxGrossWeight > 0 &&
    grossWeight >
      maxGrossWeight
  ) {
    warnings.push(
      `El peso bruto actual supera el peso bruto máximo por ${(
        grossWeight -
        maxGrossWeight
      ).toFixed(0)} kg.`
    );
  }

  if (
    declaredMaxPayload > 0 &&
    derivedPayload > 0 &&
    Math.abs(
      declaredMaxPayload -
        derivedPayload
    ) > 1
  ) {
    warnings.push(
      `La carga útil declarada (${declaredMaxPayload.toFixed(
        0
      )} kg) no coincide con peso bruto máximo menos tara (${derivedPayload.toFixed(
        0
      )} kg).`
    );
  }

  /*
    =================================================
    CÁLCULO DE EJES
    =================================================
  */

  let axleLoads = null;

  const frontAxleX =
    Number(
      capacity?.front_axle_position_m
    );

  const rearAxleX =
    Number(
      capacity?.rear_axle_position_m
    );

  const frontAxleMax =
    numberOrZero(
      capacity?.front_axle_max_kg
    );

  const rearAxleMax =
    numberOrZero(
      capacity?.rear_axle_max_kg
    );

  /*
    NUEVOS DATOS:

    Peso que soporta cada eje
    con el vehículo vacío.
  */

  const frontAxleTare =
    numberOrZero(
      capacity?.front_axle_tare_kg
    );

  const rearAxleTare =
    numberOrZero(
      capacity?.rear_axle_tare_kg
    );

  const axleTareConfigured =
    frontAxleTare > 0 ||
    rearAxleTare > 0;

  if (
    totalWeight > 0 &&
    Number.isFinite(
      frontAxleX
    ) &&
    Number.isFinite(
      rearAxleX
    ) &&
    rearAxleX >
      frontAxleX
  ) {
    const wheelbase =
      rearAxleX -
      frontAxleX;

    /*
      Reacción producida por
      la MERCADERÍA.
    */

    let rearCargoLoad =
      totalWeight *
      (
        (
          center.x -
          frontAxleX
        ) /
        wheelbase
      );

    let frontCargoLoad =
      totalWeight -
      rearCargoLoad;

    if (
      rearCargoLoad < 0
    ) {
      warnings.push(
        "El centro de la carga se encuentra por delante del eje delantero."
      );
    }

    if (
      frontCargoLoad < 0
    ) {
      warnings.push(
        "El centro de la carga se encuentra por detrás del eje trasero."
      );
    }

    frontCargoLoad =
      Math.max(
        0,
        frontCargoLoad
      );

    rearCargoLoad =
      Math.max(
        0,
        rearCargoLoad
      );

    /*
      =================================================
      PESO REAL SOBRE CADA EJE
      =================================================

      Si conocemos el peso en vacío de cada eje:

      peso total eje =
        tara del eje +
        reacción de mercadería

      Si todavía no lo conocemos,
      mantenemos el comportamiento anterior.
    */

    const frontTotalLoad =
      axleTareConfigured
        ? frontAxleTare +
          frontCargoLoad
        : frontCargoLoad;

    const rearTotalLoad =
      axleTareConfigured
        ? rearAxleTare +
          rearCargoLoad
        : rearCargoLoad;

    const frontUsagePercent =
      frontAxleMax > 0
        ? (
            frontTotalLoad /
            frontAxleMax
          ) *
          100
        : 0;

    const rearUsagePercent =
      rearAxleMax > 0
        ? (
            rearTotalLoad /
            rearAxleMax
          ) *
          100
        : 0;

    const frontRemaining =
      frontAxleMax > 0
        ? Math.max(
            0,
            frontAxleMax -
              frontTotalLoad
          )
        : null;

    const rearRemaining =
      rearAxleMax > 0
        ? Math.max(
            0,
            rearAxleMax -
              rearTotalLoad
          )
        : null;

    const frontOverload =
      frontAxleMax > 0
        ? Math.max(
            0,
            frontTotalLoad -
              frontAxleMax
          )
        : 0;

    const rearOverload =
      rearAxleMax > 0
        ? Math.max(
            0,
            rearTotalLoad -
              rearAxleMax
          )
        : 0;

    if (
      frontOverload > 0
    ) {
      warnings.push(
        axleTareConfigured
          ? `El peso total sobre el eje delantero supera su límite configurado por ${frontOverload.toFixed(
              0
            )} kg.`
          : `La carga transmitida al eje delantero supera su límite configurado por ${frontOverload.toFixed(
              0
            )} kg.`
      );
    }

    if (
      rearOverload > 0
    ) {
      warnings.push(
        axleTareConfigured
          ? `El peso total sobre el eje trasero supera su límite configurado por ${rearOverload.toFixed(
              0
            )} kg.`
          : `La carga transmitida al eje trasero supera su límite configurado por ${rearOverload.toFixed(
              0
            )} kg.`
      );
    }

    /*
      Comprobación de coherencia
      entre tara total y suma de
      tara por ejes.
    */

    const axleTareTotal =
      frontAxleTare +
      rearAxleTare;

    const axleTareDifference =
      tareWeight > 0 &&
      axleTareConfigured
        ? Math.abs(
            axleTareTotal -
              tareWeight
          )
        : 0;

    if (
      axleTareConfigured &&
      tareWeight > 0 &&
      axleTareDifference >
        10
    ) {
      warnings.push(
        `La suma del peso en vacío de los ejes (${axleTareTotal.toFixed(
          0
        )} kg) no coincide con la tara total del vehículo (${tareWeight.toFixed(
          0
        )} kg).`
      );
    }

    axleLoads = {
      configured: true,

      wheelbase,

      frontPosition:
        frontAxleX,

      rearPosition:
        rearAxleX,

      /*
        MERCADERÍA
      */

      frontCargoLoad,
      rearCargoLoad,

      /*
        VEHÍCULO VACÍO
      */

      frontTareLoad:
        frontAxleTare,

      rearTareLoad:
        rearAxleTare,

      axleTareTotal,

      axleTareDifference,

      tareConfigured:
        axleTareConfigured,

      /*
        PESO TOTAL REAL SOBRE EJES
      */

      frontTotalLoad,
      rearTotalLoad,

      /*
        Compatibilidad con el código
        existente.

        front / rear ahora representan
        el valor que debe controlar
        el operador.

        Si hay tara por eje:
          total real.

        Si no:
          reacción de mercadería.
      */

      front:
        frontTotalLoad,

      rear:
        rearTotalLoad,

      frontMax:
        frontAxleMax,

      rearMax:
        rearAxleMax,

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

      includesTare:
        axleTareConfigured,

      calculationMode:
        axleTareConfigured
          ? "gross_axle_load"
          : "cargo_reaction",
    };
  }

  return {
    totalWeight,
    maxPayload,

    center,

    centerPercent: {
      x:
        length > 0
          ? (
              center.x /
              length
            ) *
            100
          : 50,

      y:
        width > 0
          ? (
              center.y /
              width
            ) *
            100
          : 50,

      z:
        height > 0
          ? (
              center.z /
              height
            ) *
            100
          : 0,
    },

    distribution: {
      front:
        percentage(
          frontWeight
        ),

      back:
        percentage(
          backWeight
        ),

      left:
        percentage(
          leftWeight
        ),

      right:
        percentage(
          rightWeight
        ),
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

    activeItemCount:
      activeItems.length,
  };
}