import type { DataSource } from "./api";
import type { DatasetRecord } from "./verification";

const API_BASE = "https://api-market.daydreams.systems/api";

export function createLiveDataSource(): DataSource {
  return {
    async getDatasetRecord(datasetId: string): Promise<DatasetRecord | null> {
      const res = await fetch(`${API_BASE}/provenance/dataset?datasetId=${datasetId}`);
      if (!res.ok) return null;

      const data = (await res.json()) as any;
      if (!data.datasetId) return null;

      return {
        datasetId: data.datasetId,
        sources: (data.sources ?? []).map((s: any) => ({
          sourceId: s.sourceId ?? "",
          type: s.type ?? "unknown",
          updatedAt: s.updatedAt ?? new Date().toISOString(),
          dataPoints: s.dataPoints ?? 0,
          parentDatasetId: s.parentDatasetId ?? null,
          transformType: s.transformType ?? "unknown",
        })),
        content: data.content ?? "",
        lastUpdated: data.lastUpdated ?? new Date().toISOString(),
      };
    },

    async getAllRecords(): Promise<DatasetRecord[]> {
      const res = await fetch(`${API_BASE}/provenance/datasets`);
      if (!res.ok) return [];

      const data = (await res.json()) as any;
      if (!Array.isArray(data.datasets)) return [];

      return data.datasets.map((d: any) => ({
        datasetId: d.datasetId ?? "",
        sources: (d.sources ?? []).map((s: any) => ({
          sourceId: s.sourceId ?? "",
          type: s.type ?? "unknown",
          updatedAt: s.updatedAt ?? new Date().toISOString(),
          dataPoints: s.dataPoints ?? 0,
          parentDatasetId: s.parentDatasetId ?? null,
          transformType: s.transformType ?? "unknown",
        })),
        content: d.content ?? "",
        lastUpdated: d.lastUpdated ?? new Date().toISOString(),
      }));
    },
  };
}

export function createMockDataSource(): DataSource {
  const records: DatasetRecord[] = [
    {
      datasetId: "ds-demo-001",
      sources: [
        {
          sourceId: "src-weather-api",
          type: "api",
          updatedAt: new Date(Date.now() - 120000).toISOString(),
          dataPoints: 5000,
          parentDatasetId: null,
          transformType: "ingest",
        },
        {
          sourceId: "src-sensor-db",
          type: "database",
          updatedAt: new Date(Date.now() - 180000).toISOString(),
          dataPoints: 12000,
          parentDatasetId: null,
          transformType: "etl",
        },
      ],
      content: "aggregated weather and sensor data payload",
      lastUpdated: new Date(Date.now() - 60000).toISOString(),
    },
    {
      datasetId: "ds-demo-002",
      sources: [
        {
          sourceId: "src-derived-analytics",
          type: "derived",
          updatedAt: new Date(Date.now() - 300000).toISOString(),
          dataPoints: 800,
          parentDatasetId: "ds-demo-001",
          transformType: "aggregation",
        },
      ],
      content: "derived analytics dataset",
      lastUpdated: new Date(Date.now() - 240000).toISOString(),
    },
  ];

  return {
    async getDatasetRecord(datasetId: string): Promise<DatasetRecord | null> {
      return records.find((r) => r.datasetId === datasetId) ?? null;
    },
    async getAllRecords(): Promise<DatasetRecord[]> {
      return records;
    },
  };
}
