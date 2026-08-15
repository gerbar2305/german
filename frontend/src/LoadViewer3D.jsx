import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import * as THREE from "three";
import "./viewer/LoadViewer3DPro.css";
import "./viewer/LoadViewer3DStandby.css";
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
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const onItemsChangeRef = useRef(onItemsChange);
  const cameraActionsRef = useRef(null);
  const cameraStateRef = useRef(null);
  const standbyCameraFitRequestedRef = useRef(false);

  const [selectedItemIndex, setSelectedItemIndex] =
    useState(null);
  const [editMode, setEditMode] = useState(false);
  const [dragMeasurements, setDragMeasurements] = useState(null);
  const [labelMode, setLabelMode] = useState("code-description");
  const [isFullscreen, setIsFullscreen] = useState(false);

  function normalizeRotation(value) {
    const number = Number(value || 0);
    return ((number % 360) + 360) % 360;
  }

  function emitItems(updatedItems) {
    if (typeof onItemsChangeRef.current === "function") {
      onItemsChangeRef.current(updatedItems);
    }
  }

  function isItemLocked(item) {
    return Boolean(item?.locked);
  }

  function isStandby(item) {
    return Boolean(item?.standby);
  }

  function getProductCode(item) {
    return String(
      item?.product?.code ??
      item?.product?.sku ??
      item?.product?.reference ??
      item?.product?.id ??
      item?.unit ??
      "—"
    );
  }

  function getProductDescription(item) {
    return String(
      item?.product?.description ??
      item?.product?.name ??
      "Producto"
    );
  }

  function buildItemLabel(item) {
    const code = getProductCode(item);
    const description = getProductDescription(item);

    if (labelMode === "code") return code;
    if (labelMode === "description") return description;
    if (labelMode === "hidden") return "";
    return `${code} · ${description}`;
  }

  async function toggleFullscreen() {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    try {
      if (!document.fullscreenElement) {
        await wrapper.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (fullscreenError) {
      console.warn("No se pudo cambiar a pantalla completa:", fullscreenError);
    }
  }

  function moveSelectedToStandby() {
    if (
      selectedItemIndex === null ||
      !placedItems[selectedItemIndex]
    ) {
      return;
    }

    const selected = placedItems[selectedItemIndex];

    if (selected.locked) {
      window.alert("Desbloqueá el bulto antes de pasarlo a stand by.");
      return;
    }

    standbyCameraFitRequestedRef.current = true;

    emitItems(
      placedItems.map((item, index) =>
        index === selectedItemIndex
          ? {
              ...item,
              standby: true,
              standbyOrigin: {
                x: Number(item.x || 0),
                y: Number(item.y || 0),
                z: Number(item.z || 0),
              },
            }
          : item
      )
    );
  }

  function returnSelectedFromStandby() {
    if (
      selectedItemIndex === null ||
      !placedItems[selectedItemIndex]
    ) {
      return;
    }

    const item = placedItems[selectedItemIndex];
    if (!item.standby) return;

    const dimensions = getItemDimensions(item);
    const origin = item.standbyOrigin || { x: 0, y: 0, z: 0 };
    const candidate = {
      x: Number(origin.x || 0),
      y: Number(origin.y || 0),
      z: Number(origin.z || 0),
      length: dimensions.length,
      width: dimensions.width,
      height: dimensions.height,
      rotationY: getRotationY(item),
    };

    const activeItems = placedItems.filter(
      (other, index) => index !== selectedItemIndex && !other.standby
    );

    const valid = isValidPlacement({
      candidate,
      placedItems: activeItems,
      movingIndex: null,
      capacity,
    });

    if (!valid) {
      window.alert(
        "La posición original todavía está ocupada. Mové primero los bultos del interior y luego volvé a intentar."
      );
      return;
    }

    emitItems(
      placedItems.map((placedItem, index) =>
        index === selectedItemIndex
          ? {
              ...placedItem,
              standby: false,
              x: Number(candidate.x.toFixed(4)),
              y: Number(candidate.y.toFixed(4)),
              z: Number(candidate.z.toFixed(4)),
            }
          : placedItem
      )
    );
  }

  function toggleSelectedLock() {
    if (selectedItemIndex === null || !placedItems[selectedItemIndex]) return;

    emitItems(
      placedItems.map((item, index) =>
        index === selectedItemIndex
          ? { ...item, locked: !item.locked }
          : item
      )
    );
  }

  function deleteSelectedItem() {
    if (selectedItemIndex === null || !placedItems[selectedItemIndex]) return;
    if (!window.confirm("¿Eliminar este pallet del plan de carga?")) return;

    const updatedItems = placedItems.filter(
      (_, index) => index !== selectedItemIndex
    );

    setSelectedItemIndex(null);
    emitItems(updatedItems);
  }

  function duplicateSelectedItem() {
    if (selectedItemIndex === null || !placedItems[selectedItemIndex]) return;

    const source = placedItems[selectedItemIndex];
    const dimensions = getItemDimensions(source);
    const rotationY = getRotationY(source);
    const footprint = getRotatedFootprint(
      dimensions.length,
      dimensions.width,
      rotationY
    );

    const offsets = [
      [footprint.length + 0.05, 0],
      [0, footprint.width + 0.05],
      [-(footprint.length + 0.05), 0],
      [0, -(footprint.width + 0.05)],
    ];

    let candidate = null;

    for (const [dx, dy] of offsets) {
      const nextCandidate = {
        x: Number(source.x || 0) + dx,
        y: Number(source.y || 0) + dy,
        z: Number(source.z || 0),
        length: dimensions.length,
        width: dimensions.width,
        height: dimensions.height,
        rotationY,
      };

      if (
        isValidPlacement({
          candidate: nextCandidate,
          placedItems,
          movingIndex: null,
          capacity,
        })
      ) {
        candidate = nextCandidate;
        break;
      }
    }

    if (!candidate) {
      window.alert("No hay espacio libre junto al pallet para duplicarlo.");
      return;
    }

    const duplicatedItem = {
      ...source,
      x: Number(candidate.x.toFixed(4)),
      y: Number(candidate.y.toFixed(4)),
      z: Number(candidate.z.toFixed(4)),
      instanceId: `${source.instanceId || source.id || "item"}-copy-${Date.now()}`,
      locked: false,
    };

    const updatedItems = [...placedItems, duplicatedItem];
    emitItems(updatedItems);
    setSelectedItemIndex(updatedItems.length - 1);
  }

  function applySelectedRotation(nextRotation) {
    if (
      selectedItemIndex === null ||
      !placedItems[selectedItemIndex]
    ) {
      return;
    }

    const item = placedItems[selectedItemIndex];

    if (isStandby(item)) {
      window.alert("Reingresá el bulto al contenedor antes de rotarlo.");
      return;
    }

    if (isItemLocked(item)) {
      window.alert("Este pallet está bloqueado.");
      return;
    }

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

    if (isStandby(item)) {
      window.alert("Reingresá el bulto al contenedor antes de rotarlo.");
      return;
    }

    if (isItemLocked(item)) {
      window.alert("Este pallet está bloqueado.");
      return;
    }

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

    if (isItemLocked(item)) {
      window.alert("Este pallet está bloqueado.");
      return;
    }

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

    if (isItemLocked(item)) {
      window.alert("Este pallet está bloqueado.");
      return;
    }

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

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);


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
    () => calculateWeightBalance({
      capacity,
      placedItems: placedItems.filter((item) => !item.standby),
    }),
    [capacity, placedItems]
  );

  const stability = useMemo(() => {
    if (!weightBalance.totalWeight) {
      return {
        score: 0,
        level: "empty",
        label: "Sin carga",
        description: "Agregá productos con peso para analizar la estabilidad.",
      };
    }

    const longitudinalDeviation = Math.abs(
      50 - Number(weightBalance.centerPercent?.x ?? 50)
    );

    const lateralDeviation = Math.abs(
      50 - Number(weightBalance.centerPercent?.y ?? 50)
    );

    const heightPercentage = Number(
      weightBalance.centerPercent?.z ?? 0
    );

    const payloadPercentage =
      weightBalance.maxPayload > 0
        ? (weightBalance.totalWeight / weightBalance.maxPayload) * 100
        : 0;

    const penalty =
      longitudinalDeviation * 1.1 +
      lateralDeviation * 1.8 +
      Math.max(0, heightPercentage - 40) * 0.7 +
      Math.max(0, payloadPercentage - 90) * 1.4 +
      weightBalance.warnings.length * 7;

    const score = Math.max(0, Math.min(100, 100 - penalty));

    if (score >= 85) {
      return {
        score,
        level: "excellent",
        label: "Excelente",
        description: "La carga está bien centrada y presenta una distribución estable.",
      };
    }

    if (score >= 65) {
      return {
        score,
        level: "acceptable",
        label: "Aceptable",
        description: "La distribución es utilizable, aunque conviene revisar los desbalances.",
      };
    }

    return {
      score,
      level: "risk",
      label: "Riesgosa",
      description: "Conviene redistribuir la carga antes de confirmar el plan.",
    };
  }, [weightBalance]);

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
    controls.enabled = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableRotate = !editMode;
    controls.screenSpacePanning = true;
    controls.zoomSpeed = 0.9;
    controls.panSpeed = 0.8;
    controls.rotateSpeed = 0.65;

    // En modo edición el botón izquierdo queda reservado para las cajas.
    // El botón derecho continúa desplazando la cámara y la rueda mantiene el zoom.
    controls.mouseButtons.LEFT = editMode
      ? null
      : THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;

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

    // Ejes XYZ para orientar al operador dentro del contenedor.
    const axesSize = Math.max(
      Math.min(largestDimension * 0.18, 1.5),
      0.35
    );
    const axesHelper = new THREE.AxesHelper(axesSize);
    axesHelper.position.set(0.03, 0.03, 0.03);
    scene.add(axesHelper);

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
          if (
            otherIndex === movingIndex ||
            otherItem?.standby
          ) {
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

    // Zona temporal fuera del contenedor para reorganizar la carga.
    const standbyZoneWidth = Math.max(containerLength * 0.22, 2.2);
    const standbyZoneDepth = Math.max(containerWidth, 2.2);
    const standbyZoneGeometry = new THREE.PlaneGeometry(
      standbyZoneWidth,
      standbyZoneDepth
    );
    const standbyZoneMaterial = new THREE.MeshBasicMaterial({
      color: "#e2e8f0",
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });
    const standbyZone = new THREE.Mesh(
      standbyZoneGeometry,
      standbyZoneMaterial
    );
    standbyZone.rotation.x = -Math.PI / 2;
    standbyZone.position.set(
      containerLength + standbyZoneWidth / 2 + Math.max(containerWidth * 0.35, 1.2),
      0.015,
      containerWidth / 2
    );
    scene.add(standbyZone);

    const standbyZoneEdges = new THREE.EdgesGeometry(standbyZoneGeometry);
    const standbyZoneOutline = new THREE.LineSegments(
      standbyZoneEdges,
      new THREE.LineBasicMaterial({ color: "#64748b" })
    );
    standbyZoneOutline.rotation.x = -Math.PI / 2;
    standbyZoneOutline.position.copy(standbyZone.position);
    scene.add(standbyZoneOutline);

    const productMeshes = [];
    const outlines = [];
    const standbyGap = Math.max(containerWidth * 0.35, 1.2);
    const standbyBaseX = containerLength + standbyGap;
    let standbyCursorZ = 0;

    function createLabelSprite(text, selected = false) {
      if (!text) return null;

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const fontSize = 28 * pixelRatio;
      context.font = `700 ${fontSize}px Arial`;

      const paddingX = 18 * pixelRatio;
      const paddingY = 10 * pixelRatio;
      const measured = context.measureText(text);
      canvas.width = Math.ceil(measured.width + paddingX * 2);
      canvas.height = Math.ceil(fontSize + paddingY * 2);

      context.font = `700 ${fontSize}px Arial`;
      context.fillStyle = selected
        ? "rgba(250, 204, 21, 0.96)"
        : "rgba(15, 23, 42, 0.88)";
      context.strokeStyle = "rgba(255,255,255,0.9)";
      context.lineWidth = 2 * pixelRatio;
      context.beginPath();
      context.roundRect(
        1,
        1,
        canvas.width - 2,
        canvas.height - 2,
        9 * pixelRatio
      );
      context.fill();
      context.stroke();

      context.fillStyle = selected ? "#422006" : "#ffffff";
      context.textBaseline = "middle";
      context.fillText(text, paddingX, canvas.height / 2);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;

      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      });

      const sprite = new THREE.Sprite(material);
      const aspect = canvas.width / canvas.height;
      const labelHeight = Math.max(largestDimension * 0.055, 0.28);
      sprite.scale.set(labelHeight * aspect, labelHeight, 1);
      sprite.renderOrder = 1000;
      sprite.userData.isProductLabel = true;
      return sprite;
    }

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

      const isLocked = isItemLocked(item);

      const originalColor =
        getProductColor(item, index);

      const material =
        new THREE.MeshStandardMaterial({
          color: isSelected
            ? "#facc15"
            : isLocked
              ? "#64748b"
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

      if (item.standby) {
        box.position.set(
          standbyBaseX + footprint.length / 2,
          dimensions.height / 2,
          standbyCursorZ + footprint.width / 2
        );
        standbyCursorZ += footprint.width + 0.18;
      } else {
        box.position.set(
          Number(item.x || 0) + footprint.length / 2,
          Number(item.z || 0) + dimensions.height / 2,
          Number(item.y || 0) + footprint.width / 2
        );
      }

      box.rotation.y = THREE.MathUtils.degToRad(rotationY);

      box.userData = {
        type: "product",
        itemIndex: index,
        originalColor,
        dimensions,
        rotationY,
        footprint,
        locked: isLocked,
        standby: Boolean(item.standby),
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

      const label = createLabelSprite(
        buildItemLabel(item),
        isSelected
      );

      if (label) {
        label.position.set(
          box.position.x,
          box.position.y + dimensions.height / 2 + 0.16,
          box.position.z
        );
        scene.add(label);
      }
    });

    function getBounds(loadOnly = false) {
      const bounds = new THREE.Box3();
      const objects =
        loadOnly && productMeshes.length > 0
          ? productMeshes
          : [floor, containerLines, ...productMeshes];

      objects.forEach((object) => {
        object.updateMatrixWorld(true);
        bounds.expandByObject(object);
      });

      if (bounds.isEmpty()) {
        bounds.set(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(
            Math.max(containerLength, 1),
            Math.max(containerHeight, 1),
            Math.max(containerWidth, 1)
          )
        );
      }

      return bounds;
    }

    function fitCamera({
      view = "isometric",
      loadOnly = false,
      margin = 1.28,
    } = {}) {
      const bounds = getBounds(loadOnly);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();

      bounds.getCenter(center);
      bounds.getSize(size);

      const radius = Math.max(
        size.length() / 2,
        largestDimension * 0.12,
        0.5
      );

      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov =
        2 *
        Math.atan(
          Math.tan(verticalFov / 2) *
            Math.max(camera.aspect, 0.1)
        );

      const limitingFov = Math.min(verticalFov, horizontalFov);
      const distance =
        (radius / Math.max(Math.sin(limitingFov / 2), 0.1)) *
        margin;

      const directions = {
        isometric: new THREE.Vector3(1.15, 0.82, 1.35),
        top: new THREE.Vector3(0.001, 1, 0.001),
        front: new THREE.Vector3(-1, 0.18, 0),
        side: new THREE.Vector3(0, 0.18, 1),
      };

      const direction =
        directions[view]?.clone() ||
        directions.isometric.clone();

      direction.normalize();

      camera.up.set(0, 1, 0);

      if (view === "top") {
        camera.up.set(0, 0, -1);
      }

      camera.position.copy(
        center.clone().add(direction.multiplyScalar(distance))
      );

      controls.target.copy(center);
      controls.minDistance = Math.max(radius * 0.18, 0.15);
      controls.maxDistance = Math.max(radius * 12, largestDimension * 6);

      camera.near = Math.max(distance / 500, 0.01);
      camera.far = Math.max(distance * 30, largestDimension * 100);
      camera.updateProjectionMatrix();

      controls.update();
    }

    cameraActionsRef.current = {
      fitAll: () =>
        fitCamera({
          view: "isometric",
          loadOnly: false,
        }),
      fitLoad: () =>
        fitCamera({
          view: "isometric",
          loadOnly: true,
          margin: 1.38,
        }),
      isometric: () =>
        fitCamera({
          view: "isometric",
          loadOnly: false,
        }),
      top: () =>
        fitCamera({
          view: "top",
          loadOnly: false,
          margin: 1.22,
        }),
      front: () =>
        fitCamera({
          view: "front",
          loadOnly: false,
          margin: 1.25,
        }),
      side: () =>
        fitCamera({
          view: "side",
          loadOnly: false,
          margin: 1.25,
        }),
    };

    // Mantiene exactamente la cámara que dejó el operador al editar.
    if (cameraStateRef.current) {
      const saved = cameraStateRef.current;
      camera.position.fromArray(saved.position);
      camera.up.fromArray(saved.up);
      controls.target.fromArray(saved.target);
      camera.near = saved.near;
      camera.far = saved.far;
      camera.updateProjectionMatrix();
      controls.update();
    } else {
      fitCamera({
        view: "isometric",
        loadOnly: false,
      });
    }

    function saveCameraState() {
      cameraStateRef.current = {
        position: camera.position.toArray(),
        target: controls.target.toArray(),
        up: camera.up.toArray(),
        near: camera.near,
        far: camera.far,
      };
    }

    controls.addEventListener("change", saveCameraState);

    if (standbyCameraFitRequestedRef.current) {
      standbyCameraFitRequestedRef.current = false;
      fitCamera({
        view: "isometric",
        loadOnly: false,
        margin: 1.42,
      });
      saveCameraState();
    }

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
    let dragStartedFromStandby = false;

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

      if (isItemLocked(item)) {
        renderer.domElement.style.cursor = "not-allowed";
        return;
      }

      dragging = true;
      draggedMesh = mesh;
      draggedIndex = index;
      draggedOutline = outlines[index];
      dragStartedFromStandby = isStandby(item);

      originalPosition =
        mesh.position.clone();

      proposedPosition = dragStartedFromStandby
        ? {
            x: 0,
            y: 0,
            z: 0,
          }
        : {
            x: Number(item.x || 0),
            y: Number(item.y || 0),
            z: Number(item.z || 0),
          };

      if (!dragStartedFromStandby) {
        setDragMeasurements(
          calculateClearances({
            candidate: {
              ...proposedPosition,
              ...mesh.userData.dimensions,
            },
            capacity,
            placedItems: placedItems.filter((item) => !item.standby),
            movingIndex: index,
          })
        );
      } else {
        setDragMeasurements(null);
      }

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
        currentZ: dragStartedFromStandby
          ? 0
          : Number(placedItems[draggedIndex].z || 0),
        placedItems: placedItems.filter((item) => !item.standby),
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
          placedItems: placedItems.filter((item) => !item.standby),
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

      controls.enabled = true;
      renderer.domElement.style.cursor =
        editMode ? "pointer" : "grab";

      if (validDrop && proposedPosition) {
        let updatedItems;

        if (dragStartedFromStandby) {
          updatedItems = placedItems.map((item, index) =>
            index === draggedIndex
              ? {
                  ...item,
                  x: Number(proposedPosition.x.toFixed(4)),
                  y: Number(proposedPosition.y.toFixed(4)),
                  z: Number(proposedPosition.z.toFixed(4)),
                  standby: false,
                  standbyOrigin: null,
                }
              : item
          );
        } else {
          updatedItems = updateDraggedItem({
            placedItems,
            movingIndex: draggedIndex,
            position: proposedPosition,
          });
        }

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
      dragStartedFromStandby = false;
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

        // Recalcula la proyección para evitar recortes al cambiar el tamaño.
        camera.updateProjectionMatrix();
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

      saveCameraState();
      controls.removeEventListener("change", saveCameraState);
      cameraActionsRef.current = null;
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
      ref={wrapperRef}
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
              ? "Arrastrá cajas con botón izquierdo · Mové la cámara con botón derecho · Rueda para zoom"
              : "Botón izquierdo rota · Botón derecho desplaza · Rueda acerca"}
          </span>
        </div>

        <div className="viewer-camera-actions">
          <button
            type="button"
            onClick={() => cameraActionsRef.current?.fitAll()}
            title="Encuadrar el contenedor y toda la carga"
          >
            ⛶ Ajustar todo
          </button>

          <button
            type="button"
            onClick={() => cameraActionsRef.current?.fitLoad()}
            title="Centrar solamente los productos"
            disabled={placedItems.length === 0}
          >
            🎯 Centrar carga
          </button>

          <button
            type="button"
            onClick={() => cameraActionsRef.current?.isometric()}
            title="Vista isométrica"
          >
            ◩ Isométrica
          </button>

          <button
            type="button"
            onClick={() => cameraActionsRef.current?.top()}
            title="Vista superior"
          >
            ⬆ Superior
          </button>

          <button
            type="button"
            onClick={() => cameraActionsRef.current?.front()}
            title="Vista frontal"
          >
            ▣ Frontal
          </button>

          <button
            type="button"
            onClick={() => cameraActionsRef.current?.side()}
            title="Vista lateral"
          >
            ▤ Lateral
          </button>
        </div>

        <div className="viewer-identification-controls">
          <label>
            Identificar bultos
            <select
              value={labelMode}
              onChange={(event) => setLabelMode(event.target.value)}
            >
              <option value="code-description">Código + descripción</option>
              <option value="code">Solo código</option>
              <option value="description">Solo descripción</option>
              <option value="hidden">Ocultar etiquetas</option>
            </select>
          </label>

          <button
            type="button"
            className="viewer-fullscreen-button"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? "🗗 Salir pantalla completa" : "⛶ Pantalla completa"}
          </button>
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

      <aside className={`intelligent-balance-panel ${stability.level}`}>
        <div className="intelligent-balance-heading">
          <div>
            <span>ANÁLISIS EN TIEMPO REAL</span>
            <strong>⚖️ Balance y estabilidad</strong>
          </div>

          <div className={`stability-score ${stability.level}`}>
            <b>{stability.score.toFixed(0)}</b>
            <small>/100</small>
          </div>
        </div>

        <div className={`stability-status ${stability.level}`}>
          <span className="stability-dot" />
          <div>
            <strong>{stability.label}</strong>
            <small>{stability.description}</small>
          </div>
        </div>

        <div className="balance-kpi-grid">
          <div>
            <span>Peso total</span>
            <strong>{weightBalance.totalWeight.toFixed(0)} kg</strong>
          </div>
          <div>
            <span>Centro X</span>
            <strong>{weightBalance.center.x.toFixed(2)} m</strong>
          </div>
          <div>
            <span>Centro Y</span>
            <strong>{weightBalance.center.y.toFixed(2)} m</strong>
          </div>
          <div>
            <span>Centro Z</span>
            <strong>{weightBalance.center.z.toFixed(2)} m</strong>
          </div>
        </div>

        <div className="balance-distribution-block">
          <div className="balance-row-label">
            <span>Frente {weightBalance.distribution.front.toFixed(1)}%</span>
            <span>Fondo {weightBalance.distribution.back.toFixed(1)}%</span>
          </div>
          <div className="balance-split-bar">
            <div
              className="front"
              style={{ width: `${weightBalance.distribution.front}%` }}
            />
            <div
              className="back"
              style={{ width: `${weightBalance.distribution.back}%` }}
            />
          </div>
        </div>

        <div className="balance-distribution-block">
          <div className="balance-row-label">
            <span>Izquierda {weightBalance.distribution.left.toFixed(1)}%</span>
            <span>Derecha {weightBalance.distribution.right.toFixed(1)}%</span>
          </div>
          <div className="balance-split-bar lateral">
            <div
              className="left"
              style={{ width: `${weightBalance.distribution.left}%` }}
            />
            <div
              className="right"
              style={{ width: `${weightBalance.distribution.right}%` }}
            />
          </div>
        </div>

        <div className="cg-position-map">
          <span className="cg-map-label front-label">Frente</span>
          <span className="cg-map-label back-label">Fondo</span>
          <span className="cg-map-label left-label">Izq.</span>
          <span className="cg-map-label right-label">Der.</span>
          <div
            className={`cg-map-point ${stability.level}`}
            style={{
              left: `${Math.min(98, Math.max(2, weightBalance.centerPercent?.x ?? 50))}%`,
              top: `${Math.min(96, Math.max(4, weightBalance.centerPercent?.y ?? 50))}%`,
            }}
            title="Centro de gravedad"
          />
        </div>

        {weightBalance.axleLoads && (
          <div className="axle-loads">
            <div>
              <span>Eje delantero</span>
              <strong>{weightBalance.axleLoads.front.toFixed(0)} kg</strong>
            </div>
            <div>
              <span>Eje trasero</span>
              <strong>{weightBalance.axleLoads.rear.toFixed(0)} kg</strong>
            </div>
          </div>
        )}

        {weightBalance.warnings.length > 0 && (
          <div className="balance-warnings">
            {weightBalance.warnings.slice(0, 3).map((warning) => (
              <p key={warning}>⚠️ {warning}</p>
            ))}
          </div>
        )}
      </aside>

      {dragMeasurements && (
        <div
          style={{
            position: "absolute",
bottom: 18,
left: 18,
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

              {selectedItem.locked && (
                <span className="selected-item-locked-badge">
                  🔒 Pallet bloqueado
                </span>
              )}
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
              <span>Código</span>
              <strong>{getProductCode(selectedItem)}</strong>
            </div>

            <div>
              <span>Descripción</span>
              <strong>{getProductDescription(selectedItem)}</strong>
            </div>

            <div>
              <span>Estado</span>
              <strong>
                {selectedItem.standby ? "Stand by exterior" : "Dentro de unidad"}
              </strong>
            </div>

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
                {selectedItem.locked
                  ? "Bloqueado"
                  : Number(selectedItem.z || 0) <= 0.0001
                    ? "Se puede arrastrar"
                    : "Producto apilado"}
              </strong>
            </div>
          </div>

          <p className="selected-item-help">
            {editMode
              ? selectedItem.standby
                ? "Este bulto está en STAND BY. Arrastralo con el botón izquierdo hacia cualquier espacio libre del contenedor. Verde indica que puede reingresar."
                : "Mantené presionado el botón izquierdo del mouse y arrastrá el producto. Verde indica una posición válida y rojo una posición inválida."
              : "Activá el Modo edición para mover, sacar a stand by o rotar este producto."}
          </p>

          <div className="selected-item-actions">
            <div className="professional-item-toolbar">
              <button
                type="button"
                onClick={toggleSelectedLock}
                className={selectedItem.locked ? "locked-action" : ""}
              >
                {selectedItem.locked ? "🔓 Desbloquear" : "🔒 Bloquear"}
              </button>

              <button
                type="button"
                onClick={duplicateSelectedItem}
                disabled={!editMode}
              >
                📄 Duplicar
              </button>

              {!selectedItem.standby ? (
  <button
    type="button"
    onClick={moveSelectedToStandby}
    disabled={!editMode || selectedItem.locked}
    className="standby-editor-action"
  >
    📤 Pasar a stand by
  </button>
) : (
  <button
    type="button"
    onClick={returnSelectedFromStandby}
    disabled={!editMode}
    className="standby-return-action"
  >
    📥 Reingresar al contenedor
  </button>
)}

              <button
                type="button"
                onClick={deleteSelectedItem}
                disabled={!editMode}
                className="danger-editor-action"
              >
                🗑 Eliminar
              </button>
            </div>

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
                    selectedItem.standby ||
                    selectedItem.locked ||
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
                disabled={!editMode || selectedItem.standby || selectedItem.locked || selectedItem.product?.rotatable === false}
              >
                ↺ −15°
              </button>

              <button
                type="button"
                onClick={() => rotateSelectedBy(15)}
                disabled={!editMode || selectedItem.standby || selectedItem.locked || selectedItem.product?.rotatable === false}
              >
                ↻ +15°
              </button>

              <button
                type="button"
                onClick={() => applySelectedRotation(0)}
                disabled={!editMode || selectedItem.standby || selectedItem.locked || selectedItem.product?.rotatable === false}
              >
                Restablecer
              </button>

              <button
                type="button"
                onClick={laySelectedItemOnLength}
                disabled={!editMode || selectedItem.standby || selectedItem.locked || selectedItem.product?.tiltable === false}
              >
                ▰ Acostar sobre largo
              </button>

              <button
                type="button"
                onClick={laySelectedItemOnWidth}
                disabled={!editMode || selectedItem.standby || selectedItem.locked || selectedItem.product?.tiltable === false}
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