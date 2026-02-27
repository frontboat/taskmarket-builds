import type { Freshness, AnomalyEntry, ComparableGeo, DataPoint } from "./schemas";

export const STALENESS_THRESHOLD_SECONDS = 300; // 5 minutes

/**
 * Simple deterministic hash from geoCode + category.
 * Produces a positive integer seed for all downstream computations.
 */
export function hashSeed(geoCode: string, category: string): number {
  const str = `${geoCode}:${category}`;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash || 1; // ensure positive
}

/**
 * Deterministic pseudo-random from a seed. Returns [0, 1).
 */
export function seededRandom(seed: number): number {
  // Simple LCG
  const a = 1664525;
  const c = 1013904223;
  const m = 2 ** 32;
  const next = (a * seed + c) >>> 0;
  return (next % m) / m;
}

/**
 * Compute demand index (0-200, 100=baseline) for a geo+category.
 * Deterministic: same inputs always produce the same result.
 */
export function computeDemandIndex(
  geoCode: string,
  category: string,
  seasonalityMode: "raw" | "adjusted"
): number {
  const seed = hashSeed(geoCode, category);
  const base = seededRandom(seed);
  // Map to 0-200 range with 100 as baseline
  let index = Math.round(base * 200);

  if (seasonalityMode === "adjusted") {
    // Apply a small seasonal adjustment based on a different seed offset
    const seasonalSeed = hashSeed(geoCode, category + ":seasonal");
    const adjustment = (seededRandom(seasonalSeed) - 0.5) * 20; // +/-10
    index = Math.round(Math.max(0, Math.min(200, index + adjustment)));
  }

  return index;
}

/**
 * Compute velocity (positive = growing, negative = shrinking).
 * Deterministic from geo+category.
 */
export function computeVelocity(geoCode: string, category: string): number {
  const seed = hashSeed(geoCode, category + ":velocity");
  const raw = seededRandom(seed);
  // Map to [-15, 15] range
  const velocity = (raw - 0.5) * 30;
  return Math.round(velocity * 100) / 100;
}

/**
 * Compute confidence interval around a demand index.
 * Higher confidence narrows the interval.
 */
export function computeConfidenceInterval(
  demandIndex: number,
  confidence: number
): { lower: number; upper: number } {
  // Width inversely proportional to confidence
  const maxWidth = 40;
  const width = maxWidth * (1 - confidence);
  const half = width / 2;
  const lower = Math.max(0, Math.round(demandIndex - half));
  const upper = Math.min(200, Math.round(demandIndex + half));
  return { lower, upper };
}

/**
 * Generate comparable geos for a given geo+type+category.
 * Returns 3 comparable geos with deterministic indices and similarity scores.
 */
export function computeComparableGeos(
  geoCode: string,
  geoType: string,
  category: string
): ComparableGeo[] {
  const prefixes: Record<string, string[]> = {
    zip: ["10001", "30301", "60601", "98101", "33101"],
    city: ["new-york", "chicago", "miami", "denver", "portland"],
    state: ["NY", "IL", "FL", "CO", "OR"],
    country: ["UK", "CA", "AU", "DE", "FR"],
  };

  const pool = (prefixes[geoType] || prefixes["zip"]).filter(
    (code) => code !== geoCode
  );

  const results: ComparableGeo[] = [];
  for (let i = 0; i < Math.min(3, pool.length); i++) {
    const compCode = pool[i];
    const compIndex = computeDemandIndex(compCode, category, "adjusted");
    const simSeed = hashSeed(geoCode + compCode, category + ":similarity");
    const similarity = Math.round((0.5 + seededRandom(simSeed) * 0.5) * 100) / 100;
    results.push({
      geoCode: compCode,
      demand_index: compIndex,
      similarity,
    });
  }

  return results;
}

/**
 * Compute trend data points over a lookback window.
 */
export function computeTrendDataPoints(
  geoCode: string,
  category: string,
  lookbackWindow: string
): DataPoint[] {
  const dayMap: Record<string, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "365d": 365,
  };
  const days = dayMap[lookbackWindow] || 30;

  // Generate one data point per day for 7d, every 3 days for 30d, every 7 days for 90d, every 14 days for 365d
  let step = 1;
  if (days === 30) step = 3;
  else if (days === 90) step = 7;
  else if (days === 365) step = 14;

  const baseDate = new Date("2026-02-26");
  const points: DataPoint[] = [];

  for (let d = days; d >= 0; d -= step) {
    const date = new Date(baseDate.getTime() - d * 86400000);
    const dateStr = date.toISOString().split("T")[0];

    // Deterministic index for each date point
    const daySeed = hashSeed(geoCode, category + `:day:${dateStr}`);
    const baseVal = seededRandom(daySeed);
    const index = Math.round(Math.max(0, Math.min(200, baseVal * 200)));

    // Velocity for this point
    const velSeed = hashSeed(geoCode, category + `:vel:${dateStr}`);
    const vel = Math.round(((seededRandom(velSeed) - 0.5) * 20) * 100) / 100;

    points.push({
      date: dateStr,
      demand_index: index,
      velocity: vel,
    });
  }

  return points;
}

/**
 * Compute trend direction based on data points.
 */
export function computeTrendDirection(
  geoCode: string,
  category: string,
  lookbackWindow: string
): "accelerating" | "stable" | "decelerating" | "volatile" {
  const seed = hashSeed(geoCode, category + `:trend:${lookbackWindow}`);
  const val = seededRandom(seed);
  const directions: Array<"accelerating" | "stable" | "decelerating" | "volatile"> = [
    "accelerating",
    "stable",
    "decelerating",
    "volatile",
  ];
  return directions[Math.floor(val * 4)];
}

/**
 * Compute trend strength (0-1).
 */
export function computeTrendStrength(
  geoCode: string,
  category: string,
  lookbackWindow: string
): number {
  const seed = hashSeed(geoCode, category + `:strength:${lookbackWindow}`);
  return Math.round(seededRandom(seed) * 100) / 100;
}

/**
 * Compute anomalies for a geo, optionally filtered by category.
 * Only returns anomalies whose confidence meets the threshold.
 */
export function computeAnomalies(
  geoCode: string,
  geoType: string,
  category: string | undefined,
  threshold: number
): AnomalyEntry[] {
  const categories = category
    ? [category]
    : ["plumbing", "electrical", "cleaning", "tutoring", "delivery"];

  const anomalyTypes: Array<"spike" | "drop" | "seasonal_deviation" | "trend_break"> = [
    "spike",
    "drop",
    "seasonal_deviation",
    "trend_break",
  ];

  const severities: Array<"low" | "medium" | "high" | "critical"> = [
    "low",
    "medium",
    "high",
    "critical",
  ];

  const descriptions: Record<string, string> = {
    spike: "Demand spike detected: significantly above baseline",
    drop: "Demand drop detected: significantly below baseline",
    seasonal_deviation: "Demand deviates from expected seasonal pattern",
    trend_break: "Sudden break in previously established trend",
  };

  const allAnomalies: AnomalyEntry[] = [];

  for (const cat of categories) {
    // Generate a few potential anomalies per category
    for (let i = 0; i < 3; i++) {
      const seed = hashSeed(geoCode, cat + `:anomaly:${i}`);
      const confidence = Math.round(seededRandom(seed) * 100) / 100;

      if (confidence >= threshold) {
        const typeSeed = hashSeed(geoCode, cat + `:atype:${i}`);
        const sevSeed = hashSeed(geoCode, cat + `:asev:${i}`);

        const anomalyType = anomalyTypes[Math.floor(seededRandom(typeSeed) * 4)];
        const severity = severities[Math.floor(seededRandom(sevSeed) * 4)];

        allAnomalies.push({
          category: cat,
          anomaly_type: anomalyType,
          severity,
          confidence,
          detected_at: new Date("2026-02-26T12:00:00.000Z").toISOString(),
          description: descriptions[anomalyType],
        });
      }
    }
  }

  return allAnomalies;
}

/**
 * Compute confidence score for a geo+category combination.
 */
export function computeConfidence(geoCode: string, category: string): number {
  const seed = hashSeed(geoCode, category + ":confidence");
  // Confidence generally between 0.5 and 1.0 for realistic results
  const raw = seededRandom(seed);
  return Math.round((0.5 + raw * 0.5) * 100) / 100;
}

/**
 * Compute freshness metadata.
 */
export function computeFreshness(
  fetchedAt: Date,
  now: Date = new Date(),
  stalenessThreshold: number = STALENESS_THRESHOLD_SECONDS
): Freshness {
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - fetchedAt.getTime()) / 1000));
  return {
    timestamp: fetchedAt.toISOString(),
    ageSeconds,
    stale: ageSeconds > stalenessThreshold,
  };
}
