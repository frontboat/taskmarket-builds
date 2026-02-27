import { createRiskAPI } from "./api";
import { createMockDataSource } from "./datasource";

const dataSource = createMockDataSource();
const app = createRiskAPI(dataSource);

const port = parseInt(process.env.PORT || "3000");

console.log(`Graph Intelligence API running on http://localhost:${port}`);
console.log("Endpoints:");
console.log("  POST /v1/risk/score");
console.log("  GET  /v1/risk/exposure-paths?address=0x...");
console.log("  GET  /v1/risk/entity-profile?address=0x...");

export default {
  port,
  fetch: app.fetch,
};
