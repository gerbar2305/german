const balancedStrategy = {
  id: "balanced",
  name: "Balanceada",
  description: "Busca una distribución más centrada longitudinal y lateralmente.",
  order: "weight_desc",
  orientationOrder: "rotated_first",
  weights: {
    height: 900_000,
    lateral: 5_000,
    depth: 60,
    support: 120_000,
    freeSpace: 0.8,
    balanceX: 180_000,
    balanceY: 240_000,
  },
};

export default balancedStrategy;
