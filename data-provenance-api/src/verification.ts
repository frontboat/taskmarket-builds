import type { Freshness, LineageNode, LineageEdge } from "./schemas";

// ============================================================
// Data types
// ============================================================

export interface SourceRecord {
  sourceId: string;
  type: string;
  updatedAt: string;
  dataPoints: number;
  parentDatasetId: string | null;
  transformType: string;
}

export interface DatasetRecord {
  datasetId: string;
  sources: SourceRecord[];
  content: string;
  lastUpdated: string;
}

// ============================================================
// Freshness computation
// ============================================================

export const DEFAULT_STALENESS_THRESHOLD_SECONDS = 300; // 5 minutes

export function computeFreshness(
  fetchedAt: Date,
  now: Date = new Date(),
  stalenessThreshold: number = DEFAULT_STALENESS_THRESHOLD_SECONDS
): Freshness {
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - fetchedAt.getTime()) / 1000));
  return {
    timestamp: fetchedAt.toISOString(),
    ageSeconds,
    stale: ageSeconds > stalenessThreshold,
  };
}

export function computeStaleness(lastUpdated: Date, now: Date = new Date()): number {
  return Math.max(0, now.getTime() - lastUpdated.getTime());
}

export function computeSlaStatus(
  stalenessMs: number | null,
  maxStalenessMs: number
): "fresh" | "stale" | "unknown" {
  if (stalenessMs === null) return "unknown";
  return stalenessMs <= maxStalenessMs ? "fresh" : "stale";
}

// ============================================================
// Confidence computation
// ============================================================

export function computeConfidence(dataPoints: number): number {
  if (dataPoints === 0) return 0;
  // Log scale: approaches 1.0 as data points grow
  const score = Math.min(1, Math.log10(dataPoints + 1) / Math.log10(10000));
  return Math.round(score * 100) / 100;
}

// ============================================================
// Hash computation & verification
// ============================================================

const ALGORITHM_MAP: Record<string, string> = {
  sha256: "SHA-256",
  sha384: "SHA-384",
  sha512: "SHA-512",
};

export async function computeHash(
  data: string,
  algorithm: "sha256" | "sha384" | "sha512"
): Promise<string> {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);
  const digestName = ALGORITHM_MAP[algorithm];
  const hashBuffer = await crypto.subtle.digest(digestName, encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyHash(
  data: string,
  expectedHash: string,
  algorithm: "sha256" | "sha384" | "sha512"
): Promise<{ verified: boolean; computedHash: string; match: boolean; bytesVerified: number }> {
  const computedHash = await computeHash(data, algorithm);
  const match = computedHash.toLowerCase() === expectedHash.toLowerCase();
  const encoder = new TextEncoder();
  const bytesVerified = encoder.encode(data).length;
  return {
    verified: match,
    computedHash,
    match,
    bytesVerified,
  };
}

// ============================================================
// Lineage graph construction
// ============================================================

export interface LineageGraph {
  datasetId: string;
  nodes: LineageNode[];
  edges: LineageEdge[];
}

export function buildLineageGraph(
  records: DatasetRecord[],
  datasetId: string,
  maxDepth: number
): LineageGraph {
  const nodes: LineageNode[] = [];
  const edges: LineageEdge[] = [];
  const visited = new Set<string>();

  function traverse(currentDatasetId: string, depth: number) {
    if (depth <= 0 || visited.has(currentDatasetId)) return;
    visited.add(currentDatasetId);

    const record = records.find((r) => r.datasetId === currentDatasetId);
    if (!record) return;

    for (const source of record.sources) {
      // Only add if not already in the node list
      if (!nodes.some((n) => n.sourceId === source.sourceId)) {
        nodes.push({
          sourceId: source.sourceId,
          type: source.type,
          updatedAt: source.updatedAt,
          dataPoints: source.dataPoints,
        });
      }

      edges.push({
        from: source.sourceId,
        to: currentDatasetId,
        transformType: source.transformType,
      });

      // Recurse into parent datasets if they exist
      if (source.parentDatasetId) {
        traverse(source.parentDatasetId, depth - 1);
      }
    }
  }

  traverse(datasetId, maxDepth);

  return { datasetId, nodes, edges };
}

// ============================================================
// Lineage scoring
// ============================================================

export function computeLineageScore(nodes: LineageNode[]): number {
  if (nodes.length === 0) return 0;

  const now = Date.now();
  const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year in ms

  // Score based on recency and data point coverage
  const scores = nodes.map((node) => {
    const age = Math.max(0, now - new Date(node.updatedAt).getTime());
    const recencyScore = Math.max(0, 1 - age / maxAge);
    const dataScore = Math.min(1, Math.log10(node.dataPoints + 1) / 5);
    return recencyScore * 0.7 + dataScore * 0.3;
  });

  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return Math.round(avg * 100) / 100;
}

// ============================================================
// Attestation reference generation
// ============================================================

export function generateAttestationRef(
  datasetId: string,
  algorithm: string
): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `att-${datasetId}-${algorithm}-${timestamp}-${random}`;
}
