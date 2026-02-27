import { createRegulationAPI } from "./api";
import { createRegulationDataSource } from "./datasource";

const dataSource = createRegulationDataSource();
const app = createRegulationAPI(dataSource);

const port = parseInt(process.env.PORT || "3000");

console.log(`Regulation Delta API running on http://localhost:${port}`);
console.log("Endpoints:");
console.log("  GET  /v1/regulations/delta?jurisdiction=US&since=2025-01-01");
console.log("  GET  /v1/regulations/impact?jurisdiction=US");
console.log("  POST /v1/regulations/map-controls");

export default {
  port,
  fetch: app.fetch,
};
