export const IDS = Object.freeze({
  workout: "11111111-1111-4111-8111-111111111111",
  meal: "22222222-2222-4222-8222-222222222222",
  sleep: "33333333-3333-4333-8333-333333333333",
  weight: "44444444-4444-4444-8444-444444444444",
  second: "55555555-5555-4555-8555-555555555555",
});

const TIME = "2026-07-31T00:00:00.000Z";

export function workout(overrides = {}) {
  return {
    id: IDS.workout,
    date: "2026-07-31",
    type: "running",
    durationMinutes: 30,
    intensity: 2,
    source: "appleWatch",
    averageHeartRateBpm: 130,
    distanceMeters: 4_000,
    guidedSession: null,
    note: "",
    createdAt: TIME,
    updatedAt: TIME,
    ...overrides,
  };
}

export function meal(overrides = {}) {
  return {
    id: IDS.meal,
    date: "2026-07-31",
    mealType: "breakfast",
    trackingMode: "precise",
    confidence: "high",
    items: [{
      id: "77777777-7777-4777-8777-777777777777",
      foodRef: "builtin:egg-boiled",
      name: "鸡蛋",
      foodState: "cooked",
      grams: 50,
      inputUnit: "piece",
      inputQuantity: 1,
      unitGrams: 50,
      source: "builtIn",
      confidence: "high",
      energyKcalPer100g: 155,
      proteinGramsPer100g: 12.6,
      fatGramsPer100g: 10.6,
      carbsGramsPer100g: 1.1,
    }],
    fullnessScore: null,
    note: "",
    createdAt: TIME,
    updatedAt: TIME,
    ...overrides,
  };
}

export function sleep(overrides = {}) {
  return {
    id: IDS.sleep,
    date: "2026-07-31",
    sleepTime: "23:00",
    wakeTime: "06:30",
    qualityScore: 4,
    awakeCount: 1,
    note: "",
    createdAt: TIME,
    updatedAt: TIME,
    ...overrides,
  };
}

export function weight(overrides = {}) {
  return {
    id: IDS.weight,
    date: "2026-07-31",
    weightGrams: 82_450,
    bodyFatBasisPoints: 2_660,
    note: "",
    createdAt: TIME,
    updatedAt: TIME,
    ...overrides,
  };
}
