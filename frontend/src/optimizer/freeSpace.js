const EPSILON = 0.0001;

export function createInitialSpace(dimensions) {
  return {
    x: 0,
    y: 0,
    z: 0,
    length: dimensions.length,
    width: dimensions.width,
    height: dimensions.height,
  };
}

export function orientationFitsSpace(orientation, space) {
  return (
    orientation.length <= space.length + EPSILON &&
    orientation.width <= space.width + EPSILON &&
    orientation.height <= space.height + EPSILON
  );
}

function isValidSpace(space) {
  return (
    space.length > EPSILON &&
    space.width > EPSILON &&
    space.height > EPSILON
  );
}

function spaceContains(a, b) {
  return (
    b.x >= a.x - EPSILON &&
    b.y >= a.y - EPSILON &&
    b.z >= a.z - EPSILON &&
    b.x + b.length <= a.x + a.length + EPSILON &&
    b.y + b.width <= a.y + a.width + EPSILON &&
    b.z + b.height <= a.z + a.height + EPSILON
  );
}

export function splitFreeSpace(space, placedItem) {
  const newSpaces = [];

  const remainingLength =
    space.length - placedItem.length;

  const remainingWidth =
    space.width - placedItem.width;

  const remainingHeight =
    space.height - placedItem.height;

  // Espacio a la derecha.
  if (remainingLength > EPSILON) {
    newSpaces.push({
      x: space.x + placedItem.length,
      y: space.y,
      z: space.z,
      length: remainingLength,
      width: space.width,
      height: space.height,
    });
  }

  // Espacio al costado.
  if (remainingWidth > EPSILON) {
    newSpaces.push({
      x: space.x,
      y: space.y + placedItem.width,
      z: space.z,
      length: placedItem.length,
      width: remainingWidth,
      height: space.height,
    });
  }

  // Espacio encima, solamente si el producto permite apilado.
  if (
    placedItem.product?.stackable &&
    remainingHeight > EPSILON
  ) {
    newSpaces.push({
      x: space.x,
      y: space.y,
      z: space.z + placedItem.height,
      length: placedItem.length,
      width: placedItem.width,
      height: remainingHeight,
    });
  }

  return newSpaces.filter(isValidSpace);
}

export function pruneFreeSpaces(spaces) {
  const validSpaces = spaces.filter(isValidSpace);

  return validSpaces.filter((space, index) => {
    return !validSpaces.some((otherSpace, otherIndex) => {
      if (index === otherIndex) {
        return false;
      }

      return spaceContains(otherSpace, space);
    });
  });
}