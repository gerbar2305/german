const heavyFirstStrategy = {
  id: "heavy_first",
  name: "Pesados primero",
  description: "Coloca primero los productos más pesados y penaliza el apilado alto.",
  order: "weight_desc",
  orientationOrder: "normal_first",
  weights: {
    height: 1_500_000,
    lateral: 8_000,
    depth: 90,
    support: 150_000,
    freeSpace: 1,
    balanceX: 90_000,
    balanceY: 130_000,
  },
};

export default heavyFirstStrategy;
