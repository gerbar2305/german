const compactStrategy = {
  id: "compact",
  name: "Compacta",
  description: "Prioriza volumen, baja altura y ocupación desde el frente.",
  order: "volume_desc",
  orientationOrder: "normal_first",
  weights: {
    height: 1_000_000,
    lateral: 10_000,
    depth: 100,
    support: 100_000,
    freeSpace: 1,
    balanceX: 15_000,
    balanceY: 20_000,
  },
};

export default compactStrategy;
