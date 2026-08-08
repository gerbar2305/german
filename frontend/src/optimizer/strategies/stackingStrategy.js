const stackingStrategy = {
  id: "stacking",
  name: "Apilado eficiente",
  description:
    "Prioriza productos apilables para liberar superficie de piso y aprovechar la altura.",
  order: "volume_desc",
  orientationOrder: "normal_first",
  preferStacking: true,

  weights: {
    height: 80000,
    lateral: 6000,
    depth: 70,
    support: 180000,
    freeSpace: 0.8,
    balanceX: 70000,
    balanceY: 90000,
    stackingBonus: 320000,
  },
};

export default stackingStrategy;