import {
  getCapacityDimensions,
  getItemDimensions,
  getItemPosition,
  getRotatedFootprint,
  getRotationY,
  normalizeRotation,
} from "./ViewerUtils.js";

const EPSILON = 0.0001;
const MIN_SUPPORT_RATIO = 0.8;
const SUPPORT_SAMPLES = 20;

function verticalRangesOverlap(first, second) {
  return (
    first.z < second.z + second.height - EPSILON &&
    first.z + first.height > second.z + EPSILON
  );
}

function getRectangleCorners(box) {
  const angle =
    (normalizeRotation(box.rotationY) * Math.PI) / 180;

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
    x:
      centerX +
      localX * cosine -
      localY * sine,

    y:
      centerY +
      localX * sine +
      localY * cosine,
  }));
}

function getAxes(corners) {
  return [0, 1].map((index) => {
    const current = corners[index];
    const next =
      corners[(index + 1) % corners.length];

    const edgeX = next.x - current.x;
    const edgeY = next.y - current.y;

    const length =
      Math.hypot(edgeX, edgeY) || 1;

    return {
      x: -edgeY / length,
      y: edgeX / length,
    };
  });
}

function project(corners, axis) {
  const values = corners.map(
    (point) =>
      point.x * axis.x +
      point.y * axis.y
  );

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function pointInsideRectangle(point, box) {
  const corners = getRectangleCorners(box);
  const axes = getAxes(corners);

  return axes.every((axis) => {
    const rectangleProjection =
      project(corners, axis);

    const pointProjection =
      point.x * axis.x +
      point.y * axis.y;

    return (
      pointProjection >=
        rectangleProjection.min -
          EPSILON &&
      pointProjection <=
        rectangleProjection.max +
          EPSILON
    );
  });
}

function getCandidateSamplePoint(
  candidate,
  column,
  row
) {
  const angle =
    (normalizeRotation(
      candidate.rotationY
    ) *
      Math.PI) /
    180;

  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);

  const footprint = getRotatedFootprint(
    candidate.length,
    candidate.width,
    candidate.rotationY
  );

  const centerX =
    candidate.x +
    footprint.length / 2;

  const centerY =
    candidate.y +
    footprint.width / 2;

  const localX =
    -candidate.length / 2 +
    ((column + 0.5) /
      SUPPORT_SAMPLES) *
      candidate.length;

  const localY =
    -candidate.width / 2 +
    ((row + 0.5) /
      SUPPORT_SAMPLES) *
      candidate.width;

  return {
    x:
      centerX +
      localX * cosine -
      localY * sine,

    y:
      centerY +
      localX * sine +
      localY * cosine,
  };
}

export function boxesOverlap(
  first,
  second
) {
  if (
    !verticalRangesOverlap(
      first,
      second
    )
  ) {
    return false;
  }

  const firstCorners =
    getRectangleCorners(first);

  const secondCorners =
    getRectangleCorners(second);

  const axes = [
    ...getAxes(firstCorners),
    ...getAxes(secondCorners),
  ];

  return axes.every((axis) => {
    const firstProjection =
      project(firstCorners, axis);

    const secondProjection =
      project(secondCorners, axis);

    return (
      firstProjection.min <
        secondProjection.max -
          EPSILON &&
      firstProjection.max >
        secondProjection.min +
          EPSILON
    );
  });
}

export function isInsideContainer(
  candidate,
  capacity
) {
  const dimensions =
    getCapacityDimensions(capacity);

  const corners =
    getRectangleCorners(candidate);

  return (
    corners.every(
      (corner) =>
        corner.x >= -EPSILON &&
        corner.y >= -EPSILON &&
        corner.x <=
          dimensions.length +
            EPSILON &&
        corner.y <=
          dimensions.width +
            EPSILON
    ) &&
    candidate.z >= -EPSILON &&
    candidate.z +
      candidate.height <=
      dimensions.height +
        EPSILON
  );
}

export function buildItemBox(item) {
  return {
    ...getItemPosition(item),
    ...getItemDimensions(item),
    rotationY: getRotationY(item),
  };
}

export function getSupportRatio({
  candidate,
  placedItems = [],
  movingIndex = null,
}) {
  /*
   * Los productos apoyados en el piso
   * tienen soporte completo.
   */
  if (
    Number(candidate.z || 0) <=
    EPSILON
  ) {
    return 1;
  }

  const supportingItems =
    placedItems
      .map((item, index) => ({
        item,
        index,
        box: buildItemBox(item),
      }))
      .filter(({ item, index, box }) => {
        if (index === movingIndex) {
          return false;
        }

        const supportTop =
          box.z + box.height;

        const sameLevel =
          Math.abs(
            supportTop -
              candidate.z
          ) <= EPSILON;

        const canSupport =
          item.product?.stackable !==
          false;

        return (
          sameLevel &&
          canSupport
        );
      });

  if (
    supportingItems.length === 0
  ) {
    return 0;
  }

  let supportedSamples = 0;

  const totalSamples =
    SUPPORT_SAMPLES *
    SUPPORT_SAMPLES;

  for (
    let row = 0;
    row < SUPPORT_SAMPLES;
    row += 1
  ) {
    for (
      let column = 0;
      column < SUPPORT_SAMPLES;
      column += 1
    ) {
      const point =
        getCandidateSamplePoint(
          candidate,
          column,
          row
        );

      const supported =
        supportingItems.some(
          ({ box }) =>
            pointInsideRectangle(
              point,
              box
            )
        );

      if (supported) {
        supportedSamples += 1;
      }
    }
  }

  return (
    supportedSamples /
    totalSamples
  );
}

export function isValidPlacement({
  candidate,
  placedItems = [],
  movingIndex = null,
  capacity,
  minimumSupportRatio = MIN_SUPPORT_RATIO,
}) {
  const normalizedCandidate = {
    ...candidate,
    rotationY: normalizeRotation(
      candidate.rotationY
    ),
  };

  if (
    !isInsideContainer(
      normalizedCandidate,
      capacity
    )
  ) {
    return false;
  }

  const hasCollision =
    placedItems.some(
      (
        otherItem,
        otherIndex
      ) => {
        if (
          otherIndex === movingIndex
        ) {
          return false;
        }

        return boxesOverlap(
          normalizedCandidate,
          buildItemBox(otherItem)
        );
      }
    );

  if (hasCollision) {
    return false;
  }

  const supportRatio =
    getSupportRatio({
      candidate:
        normalizedCandidate,
      placedItems,
      movingIndex,
    });

  return (
    supportRatio +
      EPSILON >=
    minimumSupportRatio
  );
}