import { isValidPlacement } from "./CollisionDetector.js";

import { getSnappedCandidate } from "./SnapController.js";

import { getRotatedFootprint } from "./ViewerUtils.js";


const SNAP_THRESHOLD = 0.05;
const EPSILON = 0.0001;


/*
  Devuelve los niveles verticales donde el
  producto podría colocarse.

  Siempre probamos primero el piso.

  Después agregamos la parte superior de cada
  producto que ya está dentro de la unidad.

  Los niveles se ordenan de menor a mayor para
  que GerBar prefiera siempre la colocación
  válida más baja.
*/
function getCandidateLevels({
  placedItems,
  movingIndex,
}) {
  const levels = [0];

  placedItems.forEach(
    (item, index) => {
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

      if (
        !Number.isFinite(itemHeight) ||
        itemHeight <= 0
      ) {
        return;
      }

      const top =
        itemZ + itemHeight;

      if (
        Number.isFinite(top) &&
        top > EPSILON
      ) {
        levels.push(top);
      }
    }
  );

  const uniqueLevels =
    Array.from(
      new Set(
        levels.map(
          (level) =>
            Number(
              level.toFixed(4)
            )
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

  const centerY =
    intersectionPoint.z -
    dragOffset.z;

  const baseCandidate = {
    x:
      centerX -
      footprint.length / 2,

    y:
      centerY -
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

    const candidate = {
      ...snappedCandidate,
      z: level,
    };

    /*
      Primero probamos la posición normal.

      Esto conserva el movimiento libre por el
      piso y las posiciones que SnapController
      ya puede resolver correctamente.
    */
    const normalValid =
      isValidPlacement({
        candidate,
        placedItems,
        movingIndex,
        capacity,
      });

    if (normalValid) {
      return {
        candidate,
        valid: true,
      };
    }

    if (!firstInvalidCandidate) {
      firstInvalidCandidate =
        candidate;
    }

    /*
      En el piso no necesitamos buscar un
      producto de apoyo.
    */
    if (level <= EPSILON) {
      continue;
    }

    /*
      Si estamos intentando un nivel elevado,
      buscamos todos los productos cuya parte
      superior coincida con ese nivel.

      No elegimos el primero que aparezca.

      Calculamos todas las posiciones de apoyo
      posibles y elegimos la que esté más cerca
      de la posición horizontal indicada por
      el mouse.
    */
    const supportCandidates = [];
    console.log(
  "DATOS CINTA APILADO",
  {
    movingIndex,
    centerX,
    centerY,
    footprint,
    level,
  }
);

    placedItems.forEach(
      (supportItem, supportIndex) => {
        if (
  supportItem?.product?.name === "cinta"
) {
  console.log(
    "CINTA COMO POSIBLE SOPORTE",
    {
      supportIndex,
      movingIndex,
      stackable:
        supportItem?.product?.stackable,
      x: supportItem?.x,
      y: supportItem?.y,
      z: supportItem?.z,
      length:
        supportItem?.length ??
        supportItem?.product?.length_m,
      width:
        supportItem?.width ??
        supportItem?.product?.width_m,
      height:
        supportItem?.height ??
        supportItem?.product?.height_m,
      rotationY:
        supportItem?.rotationY,
      level,
    }
  );
}
        if (
          supportIndex === movingIndex
        ) {
          return;
        }

        if (supportItem?.standby) {
          return;
        }

        if (
          supportItem?.product
            ?.stackable === false
        ) {
          return;
        }

        const supportZ =
          Number(
            supportItem?.z || 0
          );

        const supportHeight =
          Number(
            supportItem?.height ??
              supportItem?.product
                ?.height_m ??
              0
          );

        if (
          !Number.isFinite(
            supportHeight
          ) ||
          supportHeight <= 0
        ) {
          return;
        }

        const supportTop =
          supportZ +
          supportHeight;

        if (
          Math.abs(
            supportTop - level
          ) > EPSILON
        ) {
          return;
        }

        const supportRotation =
  Number(
    supportItem?.rotationY || 0
  );

const isSimpleSupportRotation =
  supportItem?.orientation ===
    "ROTATED_90" ||
  supportRotation === 90 ||
  supportRotation === 270;

const supportLength =
  isSimpleSupportRotation
    ? Number(
        supportItem?.product
          ?.length_m ??
          supportItem?.width ??
          0
      )
    : Number(
        supportItem?.length ??
          supportItem?.product
            ?.length_m ??
          0
      );

const supportWidth =
  isSimpleSupportRotation
    ? Number(
        supportItem?.product
          ?.width_m ??
          supportItem?.length ??
          0
      )
    : Number(
        supportItem?.width ??
          supportItem?.product
            ?.width_m ??
          0
      );

        if (
          supportLength <= 0 ||
          supportWidth <= 0
        ) {
          return;
        }

        const supportFootprint =
          getRotatedFootprint(
            supportLength,
            supportWidth,
            supportRotation
          );

        const supportCenterX =
  Number(
    supportItem?.x || 0
  ) +
  supportFootprint.length / 2;

const supportCenterY =
  Number(
    supportItem?.y || 0
  ) +
  supportFootprint.width / 2;

/*
  Si el soporte está rotado, X/Y guardados
  corresponden a la huella física que ocupa
  dentro del contenedor.

  Para apilar exactamente encima usamos
  directamente la posición del soporte.
*/
const supportAlignedX =
  Number(
    supportItem?.x || 0
  );

const supportAlignedY =
  Number(
    supportItem?.y || 0
  );

        /*
          Distancia entre el punto indicado
          por el mouse y el centro del soporte.

          Esta distancia es la que usaremos
          para decidir qué soporte quiere
          realmente el usuario.
        */
        const deltaX =
          centerX -
          supportCenterX;

        const deltaY =
          centerY -
          supportCenterY;

        const horizontalReach =
          supportFootprint.length /
            2 +
          footprint.length / 2;

        const lateralReach =
          supportFootprint.width /
            2 +
          footprint.width / 2;

        /*
          Ignoramos soportes demasiado alejados.

          De esta manera una caja de otra fila
          no puede "robar" el producto que el
          usuario está intentando colocar.
        */
        if (
          Math.abs(deltaX) >
            horizontalReach ||
          Math.abs(deltaY) >
            lateralReach
        ) {
          return;
        }

        const centeredCandidate = {
  ...candidate,

  x: supportAlignedX,

  y: supportAlignedY,

  z: level,
};

console.log(
  "CANDIDATO CENTRADO SOBRE SOPORTE",
  {
    supportIndex,
    supportName:
      supportItem?.product?.name,
    supportPosition: {
      x: supportItem?.x,
      y: supportItem?.y,
      z: supportItem?.z,
    },
    supportFootprint,
    centeredCandidate,
  }
);
        const valid =
          isValidPlacement({
            candidate:
              centeredCandidate,

            placedItems,

            movingIndex,

            capacity,
          });

        if (!valid) {
          return;
        }

        const distance =
          Math.hypot(
            deltaX,
            deltaY
          );

        supportCandidates.push({
          candidate:
            centeredCandidate,

          distance,
        });
      }
    );

    if (
      supportCandidates.length > 0
    ) {
      supportCandidates.sort(
        (first, second) =>
          first.distance -
          second.distance
      );

      return {
        candidate:
          supportCandidates[0]
            .candidate,

        valid: true,
      };
    }
  }

  /*
    Ninguna posición fue válida.

    Dejamos una previsualización roja para que
    el usuario pueda ver dónde está intentando
    colocar el producto.
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
    Coordenadas del visor:

    X = largo de la unidad
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
    Altura visual del producto.

    Esto permite que durante el arrastre
    el producto suba cuando encuentra un
    nivel válido de apilado y vuelva a bajar
    cuando regresa al piso.
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