import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  getItemDimensions,
  getProductColor,
  getRotatedFootprint,
  getRotationY,
} from "./viewer/ViewerUtils.js";
import {
  isValidPlacement,
} from "./viewer/CollisionDetector.js";
import {
  applyDragPreview,
  calculateDragPlacement,
  updateDraggedItem,
} from "./viewer/DragController.js";
import {
  calculateClearances,
} from "./viewer/MeasurementController.js";
import {
  calculateWeightBalance,
} from "./viewer/WeightBalanceController.js";

export default function LoadViewer3D({
  capacity,
  placedItems = [],
  onItemsChange,
}) {
  const containerRef = useRef(null);
  const onItemsChangeRef = useRef(onItemsChange);

  const [selectedItemIndex, setSelectedItemIndex] =
    useState(null);
  const [editMode, setEditMode] = useState(false);
  const [dragMeasurements, setDragMeasurements] = useState(null);

  function normalizeRotation(value) {
    const number = Number(value || 0);
    return ((number % 360) + 360) % 360;
  }

  function applySelectedRotation(nextRotation) {
    if (
      selectedItemIndex === null ||
      !placedItems[selectedItemIndex]
    ) {
      return;
    }

    const item = placedItems[selectedItemIndex];

    if (item.product?.rotatable === false) {
      window.alert("Este producto no permite rotación.");
      return;
    }

    const rotationY = normalizeRotation(nextRotation);
    const candidate = {
      x: Number(item.x || 0),
      y: Number(item.y || 0),
      z: Number(item.z || 0),
      length: Number(item.length || item.product?.length_m || 1),
      width: Number(item.width || item.product?.width_m || 1),
      height: Number(item.height || item.product?.height_m || 1),
      rotationY,
    };

    const valid = isValidPlacement({
      candidate,
      placedItems,
      movingIndex: selectedItemIndex,
      capacity,
    });

    if (!valid) {
      window.alert(
        "No se puede aplicar ese ángulo porque el producto chocaría con otra carga o saldría del contenedor."
      );
      return;
    }

    const updatedItems = placedItems.map((placedItem, index) =>
      index === selectedItemIndex
        ? {
            ...placedItem,
            rotationY,
            orientation:
              rotationY === 0
                ? "VERTICAL"
                : `ROTATED_${rotationY}`,
          }
        : placedItem
    );

    if (typeof onItemsChangeRef.current === "function") {
      onItemsChangeRef.current(updatedItems);
    }
  }

  function rotateSelectedBy(step) {
    if (
      selectedItemIndex === null ||
      !placedItems[selectedItemIndex]
    ) {
      return;
    }

    applySelectedRotation(
      Number(placedItems[selectedItemIndex].rotationY || 0) + step
    );
  }

  function applySelectedOrientation({
    length,
    width,
    height,
    orientation,
    rotationY = 0,
  }) {
    if (
      selectedItemIndex === null ||
      !placedItems[selectedItemIndex]
    ) {
      return;
    }

    const item = placedItems[selectedItemIndex];

    const candidate = {
      x: Number(item.x || 0),
      y: Number(item.y || 0),
      z: Number(item.z || 0),
      length: Number(length),
      width: Number(width),
      height: Number(height),
      rotationY: normalizeRotation(rotationY),
    };

    const valid = isValidPlacement({
      candidate,
      placedItems,
      movingIndex: selectedItemIndex,
      capacity,
    });

    if (!valid) {
      window.alert(
        "No se puede aplicar esta orientación porque el producto chocaría con otra carga o saldría del contenedor."
      );
      return;
    }

    const updatedItems = placedItems.map(
      (placedItem, index) => {
        if (index !== selectedItemIndex) {
          return placedItem;
        }

        return {
          ...placedItem,
          length: candidate.length,
          width: candidate.width,
          height: candidate.height,
          orientation,
          rotationY: candidate.rotationY,
        };
      }
    );

    if (
      typeof onItemsChangeRef.current ===
      "function"
    ) {
      onItemsChangeRef.current(updatedItems);
    }
  }

  function rotateSelectedItem() {
    rotateSelectedBy(90);
  }

  function laySelectedItemOnLength() {
    if (
      selectedItemIndex === null ||
      !placedItems[selectedItemIndex]
    ) {
      return;
    }

    const item = placedItems[selectedItemIndex];

    if (item.product?.tiltable === false) {
      window.alert(
        "Este producto debe permanecer vertical y no puede acostarse."
      );
      return;
    }

    const currentLength = Number(
      item.length || 1
    );

    const currentWidth = Number(
      item.width || 1
    );

    const currentHeight = Number(
      item.height ||
        item.product?.height_m ||
        1
    );

    applySelectedOrientation({
      length: currentLength,
      width: currentHeight,
      height: currentWidth,
      orientation: "LAY_ON_LENGTH",
      rotationY: 0,
    });
  }

  function laySelectedItemOnWidth() {
    if (
      selectedItemIndex === null ||
      !placedItems[selectedItemIndex]
    ) {
      return;
    }

    const item = placedItems[selectedItemIndex];

    if (item.product?.tiltable === false) {
      window.alert(
        "Este producto debe permanecer vertical y no puede acostarse."
      );
      return;
    }

    const currentLength = Number(
      item.length || 1
    );

    const currentWidth = Number(
      item.width || 1
    );

    const currentHeight = Number(
      item.height ||
        item.product?.height_m ||
        1
    );

    applySelectedOrientation({
      length: currentHeight,
      width: currentWidth,
      height: currentLength,
      orientation: "LAY_ON_WIDTH",
      rotationY: 0,
    });
  }

  useEffect(() => {
    onItemsChangeRef.current = onItemsChange;
  }, [onItemsChange]);

  const selectedItem = useMemo(() => {
    if (
      selectedItemIndex === null ||
      !placedItems[selectedItemIndex]
    ) {
      return null;
    }

    return placedItems[selectedItemIndex];
  }, [placedItems, selectedItemIndex]);

  const weightBalance = useMemo(
    () => calculateWeightBalance({ capacity, placedItems }),
    [capacity, placedItems]
  );

useEffect(() => {
  function handleKeyDown(event) {
    if (
      event.key.toLowerCase() !== "r" ||
      selectedItemIndex === null ||
      !editMode
    ) {
      return;
    }

    const activeElement =
      document.activeElement;

    const isWriting =
      activeElement?.tagName === "INPUT" ||
      activeElement?.tagName === "TEXTAREA" ||
      activeElement?.tagName === "SELECT";

    if (isWriting) {
      return;
    }

    event.preventDefault();
    rotateSelectedBy(event.shiftKey ? -15 : 15);
  }

  window.addEventListener(
    "keydown",
    handleKeyDown
  );

  return () => {
    window.removeEventListener(
      "keydown",
      handleKeyDown
    );
  };
}, [
  selectedItemIndex,
  placedItems,
  capacity,
  onItemsChange,
  editMode,
]);

  useEffect(() => {
    if (
      selectedItemIndex !== null &&
      !placedItems[selectedItemIndex]
    ) {
      setSelectedItemIndex(null);
    }
  }, [placedItems, selectedItemIndex]);

  useEffect(() => {
    const element = containerRef.current;

    if (!element || !capacity) {
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#eef2f6");

    const width = element.clientWidth || 800;
    const height = element.clientHeight || 500;

    const camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.1,
      1000
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });

    renderer.setSize(width, height);

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2)
    );

    element.innerHTML = "";
    element.appendChild(renderer.domElement);

    renderer.domElement.style.cursor =
      editMode ? "pointer" : "grab";

    const controls = new OrbitControls(
      camera,
      renderer.domElement
    );

    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enabled = !editMode;

    const containerLength = Number(
      capacity.internal_length_m || 0
    );

    const containerWidth = Number(
      capacity.internal_width_m || 0
    );

    const containerHeight = Number(
      capacity.internal_height_m || 0
    );

    const largestDimension = Math.max(
      containerLength,
      containerWidth,
      containerHeight,
      1
    );

    camera.position.set(
      containerLength * 0.95,
      containerHeight * 1.25,
      containerWidth * 1.65
    );

    controls.target.set(
      containerLength * 0.5,
      containerHeight * 0.25,
      containerWidth / 2
    );

    controls.minDistance =
      largestDimension * 0.45;

    controls.maxDistance =
      largestDimension * 5;

    controls.maxPolarAngle =
      Math.PI * 0.48;

    controls.update();

    camera.near = Math.max(
      largestDimension / 100,
      0.01
    );

    camera.far = largestDimension * 100;
    camera.updateProjectionMatrix();

    const ambientLight =
      new THREE.AmbientLight(0xffffff, 1.5);

    scene.add(ambientLight);

    const directionalLight =
      new THREE.DirectionalLight(
        0xffffff,
        2.5
      );

    directionalLight.position.set(
      containerLength,
      containerHeight * 2,
      containerWidth
    );

    scene.add(directionalLight);

    // Piso
    const floorGeometry =
      new THREE.BoxGeometry(
        containerLength,
        0.04,
        containerWidth
      );

    const floorMaterial =
      new THREE.MeshStandardMaterial({
        color: "#cbd5e1",
        roughness: 0.8,
      });

    const floor = new THREE.Mesh(
      floorGeometry,
      floorMaterial
    );

    floor.position.set(
      containerLength / 2,
      -0.02,
      containerWidth / 2
    );

    scene.add(floor);

    // Bordes del contenedor
    const containerGeometry =
      new THREE.BoxGeometry(
        containerLength,
        containerHeight,
        containerWidth
      );

    const containerEdges =
      new THREE.EdgesGeometry(
        containerGeometry
      );

    const containerLines =
      new THREE.LineSegments(
        containerEdges,
        new THREE.LineBasicMaterial({
          color: "#475569",
        })
      );

    containerLines.position.set(
      containerLength / 2,
      containerHeight / 2,
      containerWidth / 2
    );

    scene.add(containerLines);

    // Cuadrícula
    const gridSize = Math.max(
      containerLength,
      containerWidth
    );

    const grid = new THREE.GridHelper(
      gridSize,
      Math.max(Math.ceil(gridSize), 10),
      "#64748b",
      "#cbd5e1"
    );

    grid.scale.set(
      containerLength / gridSize,
      1,
      containerWidth / gridSize
    );

    grid.position.set(
      containerLength / 2,
      0.01,
      containerWidth / 2
    );

    scene.add(grid);

    // Indicador del centro de gravedad proyectado sobre el piso.
    if (weightBalance.totalWeight > 0) {
      const markerRadius = Math.max(
        Math.min(containerLength, containerWidth) * 0.035,
        0.06
      );

      const cgGeometry = new THREE.CylinderGeometry(
        markerRadius,
        markerRadius,
        0.035,
        32
      );
      const cgMaterial = new THREE.MeshStandardMaterial({
        color: "#ef4444",
        emissive: "#7f1d1d",
        emissiveIntensity: 0.35,
      });
      const cgMarker = new THREE.Mesh(cgGeometry, cgMaterial);
      cgMarker.position.set(
        weightBalance.center.x,
        0.035,
        weightBalance.center.y
      );
      scene.add(cgMarker);

      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(weightBalance.center.x, 0.05, weightBalance.center.y),
        new THREE.Vector3(
          weightBalance.center.x,
          Math.max(weightBalance.center.z, 0.25),
          weightBalance.center.y
        ),
      ]);
      const lineMaterial = new THREE.LineBasicMaterial({ color: "#dc2626" });
      scene.add(new THREE.Line(lineGeometry, lineMaterial));
    }

    function getDimensions(item) {
      return getItemDimensions(item);
    }

    function boxesOverlap(first, second) {
      const epsilon = 0.0001;

      return (
        first.x <
          second.x + second.length - epsilon &&
        first.x + first.length >
          second.x + epsilon &&
        first.y <
          second.y + second.width - epsilon &&
        first.y + first.width >
          second.y + epsilon &&
        first.z <
          second.z + second.height - epsilon &&
        first.z + first.height >
          second.z + epsilon
      );
    }

    function isInsideContainer(candidate) {
      const epsilon = 0.0001;

      return (
        candidate.x >= -epsilon &&
        candidate.y >= -epsilon &&
        candidate.z >= -epsilon &&
        candidate.x + candidate.length <=
          containerLength + epsilon &&
        candidate.y + candidate.width <=
          containerWidth + epsilon &&
        candidate.z + candidate.height <=
          containerHeight + epsilon
      );
    }

    function isValidPosition(
      candidate,
      movingIndex
    ) {
      if (!isInsideContainer(candidate)) {
        return false;
      }

      return !placedItems.some(
        (otherItem, otherIndex) => {
          if (otherIndex === movingIndex) {
            return false;
          }

          const dimensions =
            getDimensions(otherItem);

          const otherBox = {
            x: Number(otherItem.x || 0),
            y: Number(otherItem.y || 0),
            z: Number(otherItem.z || 0),
            ...dimensions,
          };

          return boxesOverlap(
            candidate,
            otherBox
          );
        }
      );
    }

    const productMeshes = [];
    const outlines = [];

    placedItems.forEach((item, index) => {
      const dimensions = getDimensions(item);

      const geometry =
        new THREE.BoxGeometry(
          dimensions.length,
          dimensions.height,
          dimensions.width
        );

      const isSelected =
        index === selectedItemIndex;

      const originalColor =
        getProductColor(item, index);

      const material =
        new THREE.MeshStandardMaterial({
          color: isSelected
            ? "#facc15"
            : originalColor,
          transparent: true,
          opacity: isSelected ? 1 : 0.88,
          roughness: 0.55,
          emissive: isSelected
            ? new THREE.Color("#713f12")
            : new THREE.Color("#000000"),
          emissiveIntensity:
            isSelected ? 0.25 : 0,
        });

      const box = new THREE.Mesh(
        geometry,
        material
      );

      const rotationY = getRotationY(item);
      const footprint = getRotatedFootprint(
        dimensions.length,
        dimensions.width,
        rotationY
      );

      box.position.set(
        Number(item.x || 0) + footprint.length / 2,
        Number(item.z || 0) + dimensions.height / 2,
        Number(item.y || 0) + footprint.width / 2
      );

      box.rotation.y = THREE.MathUtils.degToRad(rotationY);

      box.userData = {
        type: "product",
        itemIndex: index,
        originalColor,
        dimensions,
        rotationY,
        footprint,
      };

      productMeshes.push(box);
      scene.add(box);

      const edges =
        new THREE.EdgesGeometry(geometry);

      const outline =
        new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({
            color: isSelected
              ? "#f59e0b"
              : "#ffffff",
          })
        );

      outline.position.copy(box.position);
      outline.rotation.y = box.rotation.y;
      outlines[index] = outline;

      scene.add(outline);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const dragPlane = new THREE.Plane(
      new THREE.Vector3(0, 1, 0),
      0
    );

    const intersectionPoint =
      new THREE.Vector3();

    const dragOffset = new THREE.Vector3();

    let dragging = false;
    let draggedMesh = null;
    let draggedIndex = null;
    let draggedOutline = null;
    let originalPosition = null;
    let proposedPosition = null;
    let validDrop = false;
    let activePointerId = null;

    function updatePointer(event) {
      const rectangle =
        renderer.domElement.getBoundingClientRect();

      pointer.x =
        ((event.clientX - rectangle.left) /
          rectangle.width) *
          2 -
        1;

      pointer.y =
        -(
          (event.clientY - rectangle.top) /
          rectangle.height
        ) *
          2 +
        1;
    }

    function markSelected(index) {
      productMeshes.forEach(
        (mesh, meshIndex) => {
          const selected = meshIndex === index;

          mesh.material.color.set(
            selected
              ? "#facc15"
              : mesh.userData.originalColor
          );

          mesh.material.emissive.set(
            selected
              ? "#713f12"
              : "#000000"
          );

          mesh.material.emissiveIntensity =
            selected ? 0.25 : 0;

          mesh.material.opacity =
            selected ? 1 : 0.88;

          if (outlines[meshIndex]) {
            outlines[
              meshIndex
            ].material.color.set(
              selected
                ? "#f59e0b"
                : "#ffffff"
            );
          }
        }
      );
    }

    function handlePointerDown(event) {
      if (event.button !== 0) {
        return;
      }

      if (!editMode) {
        return;
      }

      updatePointer(event);

      raycaster.setFromCamera(
        pointer,
        camera
      );

      const intersections =
        raycaster.intersectObjects(
          productMeshes,
          false
        );

      if (intersections.length === 0) {
        setSelectedItemIndex(null);
        markSelected(null);
        return;
      }

      const mesh =
        intersections[0].object;

      const index =
        mesh.userData.itemIndex;

      setSelectedItemIndex(index);
      markSelected(index);

      const item = placedItems[index];

      // Por ahora solo se mueven productos
      // apoyados directamente en el piso.
      if (Number(item.z || 0) > 0.0001) {
        renderer.domElement.style.cursor =
          "not-allowed";

        return;
      }

      dragging = true;
      draggedMesh = mesh;
      draggedIndex = index;
      draggedOutline = outlines[index];

      originalPosition =
        mesh.position.clone();

      proposedPosition = {
        x: Number(item.x || 0),
        y: Number(item.y || 0),
        z: Number(item.z || 0),
      };

      setDragMeasurements(
        calculateClearances({
          candidate: {
            ...proposedPosition,
            ...mesh.userData.dimensions,
          },
          capacity,
          placedItems,
          movingIndex: index,
        })
      );

      activePointerId = event.pointerId;

      renderer.domElement.setPointerCapture(
        event.pointerId
      );

      controls.enabled = false;

      renderer.domElement.style.cursor =
        "grabbing";

      dragPlane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(
          0,
          mesh.position.y,
          0
        )
      );

      if (
        raycaster.ray.intersectPlane(
          dragPlane,
          intersectionPoint
        )
      ) {
        dragOffset.copy(
          intersectionPoint
        );

        dragOffset.sub(mesh.position);
      }
    }

    function handlePointerMove(event) {
      if (
        !dragging ||
        !draggedMesh ||
        draggedIndex === null
      ) {
        return;
      }

      updatePointer(event);

      raycaster.setFromCamera(
        pointer,
        camera
      );

      if (
        !raycaster.ray.intersectPlane(
          dragPlane,
          intersectionPoint
        )
      ) {
        return;
      }

      const dimensions = {
        ...draggedMesh.userData.dimensions,
        rotationY: draggedMesh.userData.rotationY,
      };

      const dragPlacement = calculateDragPlacement({
        intersectionPoint,
        dragOffset,
        dimensions,
        currentZ: placedItems[draggedIndex].z,
        placedItems,
        movingIndex: draggedIndex,
        capacity,
      });

      validDrop = dragPlacement.valid;
      proposedPosition = {
        x: dragPlacement.candidate.x,
        y: dragPlacement.candidate.y,
        z: dragPlacement.candidate.z,
      };

      setDragMeasurements(
        calculateClearances({
          candidate: dragPlacement.candidate,
          capacity,
          placedItems,
          movingIndex: draggedIndex,
        })
      );

      applyDragPreview({
        mesh: draggedMesh,
        outline: draggedOutline,
        candidate: dragPlacement.candidate,
        dimensions,
        valid: validDrop,
      });
    }

    function finishDragging(event) {
      if (!dragging || !draggedMesh) {
        return;
      }

      if (
        activePointerId !== null &&
        renderer.domElement.hasPointerCapture(
          activePointerId
        )
      ) {
        renderer.domElement.releasePointerCapture(
          activePointerId
        );
      }

      controls.enabled = !editMode;
      renderer.domElement.style.cursor =
        editMode ? "pointer" : "grab";

      if (validDrop && proposedPosition) {
        const updatedItems = updateDraggedItem({
          placedItems,
          movingIndex: draggedIndex,
          position: proposedPosition,
        });

        if (
          typeof onItemsChangeRef.current ===
          "function"
        ) {
          onItemsChangeRef.current(
            updatedItems
          );
        }
      } else {
        draggedMesh.position.copy(
          originalPosition
        );

        if (draggedOutline) {
          draggedOutline.position.copy(
            originalPosition
          );
        }

        markSelected(draggedIndex);
      }

      dragging = false;
      draggedMesh = null;
      draggedIndex = null;
      draggedOutline = null;
      originalPosition = null;
      proposedPosition = null;
      validDrop = false;
      activePointerId = null;
      setDragMeasurements(null);
    }

    renderer.domElement.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    renderer.domElement.addEventListener(
      "pointermove",
      handlePointerMove
    );

    renderer.domElement.addEventListener(
      "pointerup",
      finishDragging
    );

    renderer.domElement.addEventListener(
      "pointercancel",
      finishDragging
    );

    let animationId;

    function animate() {
      animationId =
        requestAnimationFrame(animate);

      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    const resizeObserver =
      new ResizeObserver(() => {
        const newWidth =
          element.clientWidth;

        const newHeight =
          element.clientHeight;

        if (!newWidth || !newHeight) {
          return;
        }

        camera.aspect =
          newWidth / newHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(
          newWidth,
          newHeight
        );
      });

    resizeObserver.observe(element);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();

      renderer.domElement.removeEventListener(
        "pointerdown",
        handlePointerDown
      );

      renderer.domElement.removeEventListener(
        "pointermove",
        handlePointerMove
      );

      renderer.domElement.removeEventListener(
        "pointerup",
        finishDragging
      );

      renderer.domElement.removeEventListener(
        "pointercancel",
        finishDragging
      );

      controls.dispose();

      scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }

        if (object.material) {
          if (
            Array.isArray(object.material)
          ) {
            object.material.forEach(
              (material) => {
                material.dispose();
              }
            );
          } else {
            object.material.dispose();
          }
        }
      });

      renderer.dispose();
      element.innerHTML = "";
    };
  }, [
    capacity,
    placedItems,
    selectedItemIndex,
    editMode,
    weightBalance,
  ]);

  if (!capacity) {
    return (
      <div className="viewer-empty">
        <span>🚚</span>

        <h3>
          Selecciona un vehículo o contenedor
        </h3>

        <p>
          La vista 3D aparecerá en este espacio.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`load-viewer-wrapper ${
        editMode ? "edit-mode-active" : ""
      }`}
      style={{ position: "relative" }}
    >
      <div className="viewer-toolbar">
        <div>
          <strong>Vista 3D</strong>

          <span>
            {editMode
              ? "Mové los productos con el mouse · Snap magnético activo"
              : "Rotá la cámara y usá la rueda para acercar"}
          </span>
        </div>

        <button
          type="button"
          className={`edit-mode-button ${
            editMode ? "active" : ""
          }`}
          onClick={() => {
            setEditMode((current) => !current);
            setSelectedItemIndex(null);
          }}
        >
          {editMode
            ? "🟢 Modo edición ON"
            : "🖱️ Modo edición OFF"}
        </button>
      </div>

      <div
        style={{
          position: "absolute",
          top: 76,
          left: 16,
          zIndex: 19,
          width: 255,
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(255, 255, 255, 0.94)",
          color: "#0f172a",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.18)",
          fontSize: 13,
        }}
      >
        <strong style={{ display: "block", marginBottom: 8 }}>
          ⚖️ Balance de la carga
        </strong>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Peso total</span>
          <strong>{weightBalance.totalWeight.toFixed(0)} kg</strong>
        </div>

        <div style={{ marginTop: 8, opacity: 0.8 }}>
          Centro de gravedad: X {weightBalance.center.x.toFixed(2)} m · Y {weightBalance.center.y.toFixed(2)} m
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Frente {weightBalance.distribution.front.toFixed(1)}%</span>
            <span>Fondo {weightBalance.distribution.back.toFixed(1)}%</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span>Izquierda {weightBalance.distribution.left.toFixed(1)}%</span>
            <span>Derecha {weightBalance.distribution.right.toFixed(1)}%</span>
          </div>
        </div>

        {weightBalance.axleLoads && (
          <div style={{ marginTop: 9, paddingTop: 8, borderTop: "1px solid #cbd5e1" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Eje delantero</span>
              <strong>{weightBalance.axleLoads.front.toFixed(0)} kg</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span>Eje trasero</span>
              <strong>{weightBalance.axleLoads.rear.toFixed(0)} kg</strong>
            </div>
          </div>
        )}

        {weightBalance.warnings.length > 0 ? (
          <div style={{ marginTop: 10, color: "#b45309", fontWeight: 600 }}>
            ⚠️ {weightBalance.warnings[0]}
          </div>
        ) : weightBalance.totalWeight > 0 ? (
          <div style={{ marginTop: 10, color: "#15803d", fontWeight: 600 }}>
            ✓ Distribución equilibrada
          </div>
        ) : (
          <div style={{ marginTop: 10, opacity: 0.65 }}>
            Agregá productos con peso para calcular el balance.
          </div>
        )}
      </div>

      {dragMeasurements && (
        <div
          style={{
            position: "absolute",
            top: 76,
            right: 16,
            zIndex: 20,
            minWidth: 210,
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(15, 23, 42, 0.92)",
            color: "#ffffff",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.28)",
            pointerEvents: "none",
            fontSize: 13,
          }}
        >
          <strong style={{ display: "block", marginBottom: 8 }}>
            📏 Espacios disponibles
          </strong>

          {[
            ["Frente", dragMeasurements.front],
            ["Fondo", dragMeasurements.back],
            ["Izquierda", dragMeasurements.left],
            ["Derecha", dragMeasurements.right],
            ["Caja más cercana", dragMeasurements.nearestBox],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 18,
                marginTop: 5,
              }}
            >
              <span style={{ opacity: 0.78 }}>{label}</span>
              <strong
                style={{
                  color:
                    value !== null && value <= 0.05
                      ? "#86efac"
                      : "#ffffff",
                }}
              >
                {value === null ? "—" : `${value.toFixed(2)} m`}
              </strong>
            </div>
          ))}
        </div>
      )}

      <div
        ref={containerRef}
        className="load-viewer-3d"
      />

      {selectedItem && (
        <div className="selected-item-panel">
          <div className="selected-item-header">
            <div>
              <span className="selected-item-label">
                Producto seleccionado
              </span>

              <h3>
                {selectedItem.product?.name ||
                  "Producto"}
              </h3>
            </div>

            <button
              type="button"
              className="selected-item-close"
              onClick={() =>
                setSelectedItemIndex(null)
              }
            >
              ×
            </button>
          </div>

          <div className="selected-item-data">
            <div>
              <span>Peso</span>

              <strong>
                {Number(
                  selectedItem.product
                    ?.weight_kg || 0
                ).toFixed(0)}{" "}
                kg
              </strong>
            </div>

            <div>
              <span>Largo</span>

              <strong>
                {Number(
                  selectedItem.length || 0
                ).toFixed(2)}{" "}
                m
              </strong>
            </div>

            <div>
              <span>Ancho</span>

              <strong>
                {Number(
                  selectedItem.width || 0
                ).toFixed(2)}{" "}
                m
              </strong>
            </div>

            <div>
              <span>Alto</span>

              <strong>
                {Number(
                  selectedItem.height ||
                    selectedItem.product
                      ?.height_m ||
                    0
                ).toFixed(2)}{" "}
                m
              </strong>
            </div>

            <div>
              <span>Posición X</span>

              <strong>
                {Number(
                  selectedItem.x || 0
                ).toFixed(2)}
              </strong>
            </div>

            <div>
              <span>Posición Y</span>

              <strong>
                {Number(
                  selectedItem.y || 0
                ).toFixed(2)}
              </strong>
            </div>

            <div>
              <span>Posición Z</span>

              <strong>
                {Number(
                  selectedItem.z || 0
                ).toFixed(2)}
              </strong>
            </div>


            <div>
              <span>Orientación</span>

              <strong>
                {selectedItem.orientation === "LAY_ON_LENGTH"
                  ? "Acostado sobre largo"
                  : selectedItem.orientation === "LAY_ON_WIDTH"
                    ? "Acostado sobre ancho"
                    : `${normalizeRotation(selectedItem.rotationY || 0)}°`}
              </strong>
            </div>

            <div>
              <span>Movimiento</span>

              <strong>
                {Number(
                  selectedItem.z || 0
                ) <= 0.0001
                  ? "Se puede arrastrar"
                  : "Producto apilado"}
              </strong>
            </div>
          </div>

          <p className="selected-item-help">
            {editMode
              ? "Mantené presionado el botón izquierdo del mouse y arrastrá el producto. Verde indica una posición válida y rojo una posición inválida."
              : "Activá el Modo edición para mover o rotar este producto."}
          </p>

          <div className="selected-item-actions">
            <div className="orientation-actions rotation-360-controls">
              <label className="rotation-select-label">
                Rotación horizontal
                <select
                  value={normalizeRotation(selectedItem.rotationY || 0)}
                  onChange={(event) =>
                    applySelectedRotation(Number(event.target.value))
                  }
                  disabled={
                    !editMode ||
                    selectedItem.product?.rotatable === false
                  }
                >
                  {Array.from(
                    { length: 24 },
                    (_, index) => index * 15
                  ).map((angle) => (
                    <option key={angle} value={angle}>
                      {angle}°
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => rotateSelectedBy(-15)}
                disabled={!editMode || selectedItem.product?.rotatable === false}
              >
                ↺ −15°
              </button>

              <button
                type="button"
                onClick={() => rotateSelectedBy(15)}
                disabled={!editMode || selectedItem.product?.rotatable === false}
              >
                ↻ +15°
              </button>

              <button
                type="button"
                onClick={() => applySelectedRotation(0)}
                disabled={!editMode || selectedItem.product?.rotatable === false}
              >
                Restablecer
              </button>

              <button
                type="button"
                onClick={laySelectedItemOnLength}
                disabled={!editMode || selectedItem.product?.tiltable === false}
              >
                ▰ Acostar sobre largo
              </button>

              <button
                type="button"
                onClick={laySelectedItemOnWidth}
                disabled={!editMode || selectedItem.product?.tiltable === false}
              >
                ▰ Acostar sobre ancho
              </button>
            </div>

            <span>
              R gira +15° y Shift+R gira −15°. Cada ángulo valida límites,
              colisiones y Snap automáticamente.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}