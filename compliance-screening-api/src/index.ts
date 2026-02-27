import { createScreeningAPI } from "./api";
import { createComplianceDataSource } from "./datasource";

const dataSource = createComplianceDataSource();
const app = createScreeningAPI(dataSource);

const port = parseInt(process.env.PORT || "3000");

console.log(`Compliance Screening API running on http://localhost:${port}`);
console.log("Endpoints:");
console.log("  POST /v1/screening/check");
console.log("  GET  /v1/screening/exposure-chain?address=0x...");
console.log("  GET  /v1/screening/jurisdiction-risk?jurisdiction=US");

export default {
  port,
  fetch: app.fetch,
};
