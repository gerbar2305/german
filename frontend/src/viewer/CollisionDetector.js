import {
  getCapacityDimensions,
  getItemDimensions,
  getItemPosition,
} from "./ViewerUtils.js";

const EPSILON = 0.0001;

export function boxesOverlap(
  first,
  second
) {
  return (
    first.x <
      second.x +
        second.length -
        EPSILON &&
    first.x + first.length >
      second.x + EPSILON &&
    first.y <
      second.y +
        second.width -
        EPSILON &&
    first.y + first.width >
      second.y + EPSILON &&
    first.z <
      second.z +
        second.height -
        EPSILON &&
    first.z + first.height >
      second.z + EPSILON
  );
}

export function isInsideContainer(
  candidate,
  capacity
) {
  const dimensions =
    getCapacityDimensions(capacity);

  return (
    candidate.x >= -EPSILON &&
    candidate.y >= -EPSILON &&
    candidate.z >= -EPSILON &&
    candidate.x + candidate.length <=
      dimensions.length + EPSILON &&
    candidate.y + candidate.width <=
      dimensions.width + EPSILON &&
    candidate.z + candidate.height <=
      dimensions.height + EPSILON
  );
}

export function buildItemBox(item) {
  return {
    ...getItemPosition(item),
    ...getItemDimensions(item),
  };
}

export function isValidPlacement({
  candidate,
  placedItems,
  movingIndex,
  capacity,
}) {
  if (
    !isInsideContainer(
      candidate,
      capacity
    )
  ) {
    return false;
  }

  return !placedItems.some(
    (otherItem, otherIndex) => {
      if (otherIndex === movingIndex) {
        return false;
      }

      return boxesOverlap(
        candidate,
        buildItemBox(otherItem)
      );
    }
  );
}