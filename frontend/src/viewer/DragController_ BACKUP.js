import { isValidPlacement } from "./CollisionDetector.js";
import { getSnappedCandidate } from "./SnapController.js";
import { getRotatedFootprint } from "./ViewerUtils.js";

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
  const rotationY = Number(dimensions.rotationY || 0);
  const footprint = getRotatedFootprint(
    dimensions.length,
    dimensions.width,
    rotationY
  );

  const centerX = intersectionPoint.x - dragOffset.x;
  const centerZ = intersectionPoint.z - dragOffset.z;

  const rawCandidate = {
    x: centerX - footprint.length / 2,
    y: centerZ - footprint.width / 2,
    z: Number(currentZ || 0),
    length: dimensions.length,
    width: dimensions.width,
    height: dimensions.height,
    rotationY,
  };

  const candidate = getSnappedCandidate({
    candidate: rawCandidate,
    placedItems,
    movingIndex,
    capacity,
    threshold: SNAP_THRESHOLD,
  });

  return {
    candidate,
    valid: isValidPlacement({
      candidate,
      placedItems,
      movingIndex,
      capacity,
    }),
  };
}

export function applyDragPreview({
  mesh,
  outline,
  candidate,
  dimensions,
  valid,
}) {
  const footprint = getRotatedFootprint(
    dimensions.length,
    dimensions.width,
    candidate.rotationY
  );

  mesh.position.x = candidate.x + footprint.length / 2;
  mesh.position.z = candidate.y + footprint.width / 2;

  if (outline) outline.position.copy(mesh.position);

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
  return placedItems.map((item, index) =>
    index === movingIndex
      ? {
          ...item,
          x: Number(position.x.toFixed(4)),
          y: Number(position.y.toFixed(4)),
          z: Number(position.z.toFixed(4)),
        }
      : item
  );
}
