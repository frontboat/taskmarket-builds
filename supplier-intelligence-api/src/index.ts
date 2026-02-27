import { createSupplierAPI } from "./api";
import { createMockDataSource } from "./datasource";

const dataSource = createMockDataSource();
const app = createSupplierAPI(dataSource);

const port = parseInt(process.env.PORT || "3000");

console.log(`Supplier Intelligence API running on http://localhost:${port}`);
console.log("Endpoints:");
console.log("  GET /v1/suppliers/score?supplierId=...");
console.log("  GET /v1/suppliers/lead-time-forecast?supplierId=...");
console.log("  GET /v1/suppliers/disruption-alerts?supplierId=...");

export default {
  port,
  fetch: app.fetch,
};
