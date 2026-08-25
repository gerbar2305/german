import { isValidPlacement } from "./CollisionDetector.js";

import { getSnappedCandidate } from "./SnapController.js";

import { getRotatedFootprint } from "./ViewerUtils.js";

const SNAP_THRESHOLD = 0.05;
const EPSILON = 0.0001;


/*
  Devuelve todas las alturas posibles donde
  podría apoyarse el bulto.

  Siempre empezamos por el piso (z = 0).

  Después probamos la parte superior de cada
  bulto existente.

  Al ordenarlas de menor a mayor conseguimos
  que GerBar coloque el bulto en la posición
  válida MÁS BAJA posible.
*/
function getCandidateLevels({
  placedItems,
  movingIndex,
}) {
  const levels = [0];

  placedItems.forEach((item, index) => {
    if (index === movingIndex) {
      return;
    }

    if (item?.standby) {
      return;
    }

    const itemZ =
      Number(item?.z || 0);

    const itemHeight =
      Number(
        item?.height ??
          item?.product?.height_m ??
          0
      );

    if (itemHeight <= 0) {
      return;
    }

    const top =
      itemZ + itemHeight;

    if (
      Number.isFinite(top) &&
      top >= 0
    ) {
      levels.push(top);
    }
  });

  /*
    Eliminamos alturas duplicadas.

    Ejemplo:
    si hay 20 cajas de 1 m de alto,
    no necesitamos probar z=1 veinte veces.
  */
  const uniqueLevels =
    Array.from(
      new Set(
        levels.map((level) =>
          Number(level.toFixed(4))
        )
      )
    );

  uniqueLevels.sort(
    (first, second) =>
      first - second
  );

  return uniqueLevels;
}


export function calculateDragPlacement({
  intersectionPoint,
  dragOffset,
  dimensions,
  currentZ,
  placedItems,
  movingIndex,
  capacity,
}) {
  const rotationY =
    Number(
      dimensions.rotationY || 0
    );

  const footprint =
    getRotatedFootprint(
      dimensions.length,
      dimensions.width,
      rotationY
    );

  const centerX =
    intersectionPoint.x -
    dragOffset.x;

  const centerZ =
    intersectionPoint.z -
    dragOffset.z;

  /*
    Posición horizontal que está indicando
    el mouse.
  */
  const baseCandidate = {
    x:
      centerX -
      footprint.length / 2,

    y:
      centerZ -
      footprint.width / 2,

    z: 0,

    length:
      dimensions.length,

    width:
      dimensions.width,

    height:
      dimensions.height,

    rotationY,
  };

  /*
    Probamos primero el piso.

    Si el piso está ocupado, probamos después
    la parte superior de otros bultos.

    Esto permite:

    APILADO -> PISO
    PISO -> APILADO
    SEGUNDO NIVEL -> PRIMER NIVEL
    etc.
  */
  const levels =
    getCandidateLevels({
      placedItems,
      movingIndex,
    });

  let firstInvalidCandidate = null;

  for (const level of levels) {
    const rawCandidate = {
      ...baseCandidate,
      z: level,
    };

    const snappedCandidate =
      getSnappedCandidate({
        candidate:
          rawCandidate,

        placedItems,

        movingIndex,

        capacity,

        threshold:
          SNAP_THRESHOLD,
      });

    /*
      Forzamos nuevamente el nivel vertical
      elegido.

      El Snap debe ayudar principalmente con
      X/Y; la altura la estamos resolviendo
      nosotros buscando el nivel válido más bajo.
    */
    const candidate = {
      ...snappedCandidate,
      z: level,
    };

    if (!firstInvalidCandidate) {
      firstInvalidCandidate =
        candidate;
    }

    const valid =
      isValidPlacement({
        candidate,
        placedItems,
        movingIndex,
        capacity,
      });

    if (valid) {
      return {
        candidate,
        valid: true,
      };
    }
  }

  /*
    Si no encontramos ningún nivel válido,
    mostramos el bulto en una posición de
    previsualización inválida.

    Conservamos como referencia la altura
    anterior únicamente para que el usuario
    vea claramente dónde está intentando moverlo.
  */
  const fallbackRaw = {
    ...baseCandidate,
    z: Math.max(
      0,
      Number(currentZ || 0)
    ),
  };

  const fallbackCandidate =
    getSnappedCandidate({
      candidate:
        fallbackRaw,

      placedItems,

      movingIndex,

      capacity,

      threshold:
        SNAP_THRESHOLD,
    });

  return {
    candidate:
      firstInvalidCandidate ||
      fallbackCandidate,

    valid: false,
  };
}


export function applyDragPreview({
  mesh,
  outline,
  candidate,
  dimensions,
  valid,
}) {
  const footprint =
    getRotatedFootprint(
      dimensions.length,
      dimensions.width,
      candidate.rotationY
    );

  /*
    X = largo del vehículo/contenedor
    Z de Three.js = ancho
    Y de Three.js = altura
  */
  mesh.position.x =
    candidate.x +
    footprint.length / 2;

  mesh.position.z =
    candidate.y +
    footprint.width / 2;

  /*
    IMPORTANTE:
    antes esta línea no existía.

    Ahora el bulto sube y baja visualmente
    cuando GerBar encuentra piso o una
    superficie de apoyo.
  */
  mesh.position.y =
    Number(candidate.z || 0) +
    Number(dimensions.height || 0) / 2;

  if (outline) {
    outline.position.copy(
      mesh.position
    );
  }

  mesh.material.color.set(
    valid
      ? "#22c55e"
      : "#ef4444"
  );

  mesh.material.emissive.set(
    valid
      ? "#14532d"
      : "#7f1d1d"
  );

  if (outline) {
    outline.material.color.set(
      valid
        ? "#166534"
        : "#991b1b"
    );
  }
}


export function updateDraggedItem({
  placedItems,
  movingIndex,
  position,
}) {
  return placedItems.map(
    (item, index) =>
      index === movingIndex
        ? {
            ...item,

            x: Number(
              position.x.toFixed(4)
            ),

            y: Number(
              position.y.toFixed(4)
            ),

            z: Number(
              position.z.toFixed(4)
            ),
          }
        : item
  );
}