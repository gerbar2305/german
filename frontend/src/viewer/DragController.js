import { isValidPlacement } from "./CollisionDetector.js";
import { getSnappedCandidate } from "./SnapController.js";

const SNAP_THRESHOLD = 0.05;

export function calculateDragPlacement({
  intersectionPoint,
  dragOffset,
  dimensions,
  currentZ,
  placedItems,
  movingIndex,
  capacity,
}) {
  const centerX = intersectionPoint.x - dragOffset.x;
  const centerZ = intersectionPoint.z - dragOffset.z;

  const rawCandidate = {
    x: centerX - dimensions.length / 2,
    y: centerZ - dimensions.width / 2,
    z: Number(currentZ || 0),
    length: dimensions.length,
    width: dimensions.width,
    height: dimensions.height,
  };

  const candidate = getSnappedCandidate({
    candidate: rawCandidate,
    placedItems,
    movingIndex,
    capacity,
    threshold: SNAP_THRESHOLD,
  });

  const valid = isValidPlacement({
    candidate,
    placedItems,
    movingIndex,
    capacity,
  });

  return { candidate, valid };
}

export function applyDragPreview({
  mesh,
  outline,
  candidate,
  dimensions,
  valid,
}) {
  mesh.position.x = candidate.x + dimensions.length / 2;
  mesh.position.z = candidate.y + dimensions.width / 2;

  if (outline) {
    outline.position.copy(mesh.position);
  }

  mesh.material.color.set(valid ? "#22c55e" : "#ef4444");
  mesh.material.emissive.set(valid ? "#14532d" : "#7f1d1d");

  if (outline) {
    outline.material.color.set(valid ? "#166534" : "#991b1b");
  }
}

export function updateDraggedItem({
  placedItems,
  movingIndex,
  position,
}) {
  return placedItems.map((item, index) => {
    if (index !== movingIndex) {
      return item;
    }

    return {
      ...item,
      x: Number(position.x.toFixed(4)),
      y: Number(position.y.toFixed(4)),
      z: Number(position.z.toFixed(4)),
    };
  });
}
