import type {
  Freshness,
  RiskFactor,
  ScoreOutput,
  LeadTimeOutput,
  DisruptionAlert,
  AlertType,
  AlertSeverity,
  DriftDirection,
} from "./schemas";

export interface SupplierData {
  supplierId: string;
  totalOrders: number;
  fulfilledOrders: number;
  onTimeOrders: number;
  defectiveOrders: number;
  avgLeadTimeDays: number;
  leadTimeStdDev: number;
  categories: string[];
  regions: string[];
  activeAlerts: Array<{
    type: AlertType;
    severity: AlertSeverity;
    probability: number;
    description: string;
    detectedAt: string;
  }>;
}

export interface ScoringConfig {
  stalenessThresholdSeconds: number;
  weights: {
    fillRate: number;
    onTimeRate: number;
    defectRate: number;
    alertPenalty: number;
  };
}

export const DEFAULT_CONFIG: ScoringConfig = {
  stalenessThresholdSeconds: 300,
  weights: {
    fillRate: 0.35,
    onTimeRate: 0.30,
    defectRate: 0.25,
    alertPenalty: 0.10,
  },
};

// --- Deterministic hash from supplierId ---

export function hashSupplierId(supplierId: string): number {
  let hash = 0;
  for (let i = 0; i < supplierId.length; i++) {
    const char = supplierId.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

// --- Seeded pseudo-random ---

export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// --- Freshness ---

export function computeFreshness(
  fetchedAt: Date,
  now: Date = new Date(),
  stalenessThreshold: number = DEFAULT_CONFIG.stalenessThresholdSeconds
): Freshness {
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - fetchedAt.getTime()) / 1000));
  return {
    timestamp: fetchedAt.toISOString(),
    ageSeconds,
    stale: ageSeconds > stalenessThreshold,
  };
}

// --- Fill Rate ---

export function computeFillRate(data: SupplierData): number {
  if (data.totalOrders === 0) return 0;
  return Math.round((data.fulfilledOrders / data.totalOrders) * 100) / 100;
}

// --- On-Time Rate ---

export function computeOnTimeRate(data: SupplierData): number {
  if (data.fulfilledOrders === 0) return 0;
  return Math.round((data.onTimeOrders / data.fulfilledOrders) * 100) / 100;
}

// --- Defect Rate ---

export function computeDefectRate(data: SupplierData): number {
  if (data.fulfilledOrders === 0) return 0;
  return Math.round((data.defectiveOrders / data.fulfilledOrders) * 100) / 100;
}

// --- Confidence ---

export function computeConfidence(data: SupplierData): number {
  if (data.totalOrders === 0) return 0;
  const orderFactor = Math.min(1, Math.log10(data.totalOrders + 1) / Math.log10(1000));
  const fulfillmentFactor = data.fulfilledOrders > 0
    ? Math.min(1, data.fulfilledOrders / data.totalOrders)
    : 0;
  return Math.round((orderFactor * 0.7 + fulfillmentFactor * 0.3) * 100) / 100;
}

// --- Risk Factors ---

export function computeRiskFactors(data: SupplierData): RiskFactor[] {
  const factors: RiskFactor[] = [];

  const fillRate = computeFillRate(data);
  if (fillRate < 0.8) {
    factors.push({
      factor: "low_fill_rate",
      severity: fillRate < 0.5 ? "high" : "medium",
      description: `Fill rate is ${(fillRate * 100).toFixed(0)}%, below 80% threshold`,
    });
  }

  const onTimeRate = computeOnTimeRate(data);
  if (onTimeRate < 0.85) {
    factors.push({
      factor: "late_deliveries",
      severity: onTimeRate < 0.6 ? "high" : "medium",
      description: `On-time delivery rate is ${(onTimeRate * 100).toFixed(0)}%, below 85% threshold`,
    });
  }

  const defectRate = computeDefectRate(data);
  if (defectRate > 0.05) {
    factors.push({
      factor: "high_defect_rate",
      severity: defectRate > 0.15 ? "high" : "medium",
      description: `Defect rate is ${(defectRate * 100).toFixed(1)}%, above 5% threshold`,
    });
  }

  if (data.totalOrders < 10) {
    factors.push({
      factor: "limited_history",
      severity: "low",
      description: `Only ${data.totalOrders} orders on record, limited data for assessment`,
    });
  }

  for (const alert of data.activeAlerts) {
    if (alert.severity === "critical" || alert.severity === "high") {
      factors.push({
        factor: `active_${alert.type}_alert`,
        severity: alert.severity === "critical" ? "high" : "medium",
        description: alert.description,
      });
    }
  }

  return factors;
}

// --- Reliability Grade ---

export function computeReliabilityGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

// --- Supplier Score ---

export function computeSupplierScore(
  data: SupplierData,
  config: ScoringConfig = DEFAULT_CONFIG
): number {
  const fillRate = computeFillRate(data);
  const onTimeRate = computeOnTimeRate(data);
  const defectRate = computeDefectRate(data);

  const fillScore = fillRate * 100;
  const onTimeScore = onTimeRate * 100;
  const defectScore = (1 - defectRate) * 100;

  // Alert penalty: reduce score based on active high/critical alerts
  const criticalAlerts = data.activeAlerts.filter(
    (a) => a.severity === "critical" || a.severity === "high"
  ).length;
  const alertScore = Math.max(0, 100 - criticalAlerts * 25);

  const { weights } = config;
  const raw =
    fillScore * weights.fillRate +
    onTimeScore * weights.onTimeRate +
    defectScore * weights.defectRate +
    alertScore * weights.alertPenalty;

  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100;
}

// --- Lead Time Forecast ---

export function computeLeadTimeForecast(
  data: SupplierData,
  horizonDays: number
): {
  lead_time_p50: number;
  lead_time_p95: number;
  drift_direction: DriftDirection;
  drift_magnitude: number;
  historical_variance: number;
} {
  const p50 = Math.round(data.avgLeadTimeDays * 100) / 100;
  const p95 = Math.round((data.avgLeadTimeDays + 1.645 * data.leadTimeStdDev) * 100) / 100;

  // Drift based on ratio of stdDev to mean
  const cv = data.avgLeadTimeDays > 0 ? data.leadTimeStdDev / data.avgLeadTimeDays : 0;

  let drift_direction: DriftDirection;
  if (cv < 0.15) {
    drift_direction = "stable";
  } else if (cv < 0.3) {
    drift_direction = "improving";
  } else {
    drift_direction = "degrading";
  }

  // Scale drift_magnitude by horizon
  const horizonFactor = Math.min(1, horizonDays / 365);
  const drift_magnitude = Math.round(Math.min(1, cv * horizonFactor) * 100) / 100;

  const historical_variance = Math.round(data.leadTimeStdDev * data.leadTimeStdDev * 100) / 100;

  return {
    lead_time_p50: p50,
    lead_time_p95: Math.max(p50, p95),
    drift_direction,
    drift_magnitude,
    historical_variance,
  };
}

// --- Disruption Alerts ---

export function filterAlertsByRiskTolerance(
  alerts: DisruptionAlert[],
  riskTolerance: "low" | "medium" | "high"
): DisruptionAlert[] {
  const thresholds: Record<string, number> = {
    low: 0.1,
    medium: 0.3,
    high: 0.6,
  };
  const threshold = thresholds[riskTolerance];
  return alerts.filter((a) => a.disruption_probability >= threshold);
}

export function buildDisruptionAlerts(data: SupplierData): DisruptionAlert[] {
  return data.activeAlerts.map((alert) => ({
    supplierId: data.supplierId,
    alert_type: alert.type,
    severity: alert.severity,
    disruption_probability: alert.probability,
    affected_categories: [...data.categories],
    affected_regions: [...data.regions],
    detected_at: alert.detectedAt,
    description: alert.description,
  }));
}

// --- Generate deterministic mock data from supplierId ---

export function generateSupplierData(supplierId: string, category?: string, region?: string): SupplierData {
  const hash = hashSupplierId(supplierId);
  const rng = seededRandom(hash);

  const totalOrders = Math.floor(rng() * 500) + 10;
  const fillPct = 0.7 + rng() * 0.3;
  const fulfilledOrders = Math.floor(totalOrders * fillPct);
  const onTimePct = 0.6 + rng() * 0.4;
  const onTimeOrders = Math.floor(fulfilledOrders * onTimePct);
  const defectPct = rng() * 0.15;
  const defectiveOrders = Math.floor(fulfilledOrders * defectPct);
  const avgLeadTimeDays = 3 + rng() * 25;
  const leadTimeStdDev = 1 + rng() * 8;

  const allCategories = ["electronics", "raw_materials", "packaging", "chemicals", "textiles", "machinery"];
  const allRegions = ["north_america", "europe", "asia_pacific", "latin_america", "middle_east", "africa"];

  const catCount = 1 + Math.floor(rng() * 3);
  const categories: string[] = category ? [category] : [];
  if (categories.length === 0) {
    for (let i = 0; i < catCount; i++) {
      const idx = Math.floor(rng() * allCategories.length);
      const cat = allCategories[idx];
      if (!categories.includes(cat)) categories.push(cat);
    }
  }

  const regCount = 1 + Math.floor(rng() * 2);
  const regions: string[] = region ? [region] : [];
  if (regions.length === 0) {
    for (let i = 0; i < regCount; i++) {
      const idx = Math.floor(rng() * allRegions.length);
      const reg = allRegions[idx];
      if (!regions.includes(reg)) regions.push(reg);
    }
  }

  const alertTypes: AlertType[] = ["weather", "geopolitical", "financial", "logistics", "quality"];
  const alertSeverities: AlertSeverity[] = ["low", "medium", "high", "critical"];
  const alertCount = Math.floor(rng() * 4);
  const activeAlerts: SupplierData["activeAlerts"] = [];

  for (let i = 0; i < alertCount; i++) {
    const typeIdx = Math.floor(rng() * alertTypes.length);
    const sevIdx = Math.floor(rng() * alertSeverities.length);
    activeAlerts.push({
      type: alertTypes[typeIdx],
      severity: alertSeverities[sevIdx],
      probability: Math.round(rng() * 100) / 100,
      description: `${alertTypes[typeIdx]} disruption risk detected for supplier ${supplierId}`,
      detectedAt: new Date(Date.now() - Math.floor(rng() * 7 * 24 * 3600 * 1000)).toISOString(),
    });
  }

  return {
    supplierId,
    totalOrders,
    fulfilledOrders,
    onTimeOrders,
    defectiveOrders,
    avgLeadTimeDays: Math.round(avgLeadTimeDays * 100) / 100,
    leadTimeStdDev: Math.round(leadTimeStdDev * 100) / 100,
    categories,
    regions,
    activeAlerts,
  };
}
