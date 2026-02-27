import { createProvenanceAPI } from "./api";
import { createMockDataSource } from "./datasource";

const dataSource = createMockDataSource();
const app = createProvenanceAPI(dataSource);

const port = parseInt(process.env.PORT || "3000");

console.log(`Data Provenance API running on http://localhost:${port}`);
console.log("Endpoints:");
console.log("  GET  /v1/provenance/lineage?datasetId=...");
console.log("  GET  /v1/provenance/freshness?datasetId=...");
console.log("  POST /v1/provenance/verify-hash");

export default {
  port,
  fetch: app.fetch,
};
