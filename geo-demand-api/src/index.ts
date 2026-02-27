import { createDemandAPI } from "./api";
import { createMockDataSource } from "./datasource";

const dataSource = createMockDataSource();
const app = createDemandAPI(dataSource);

const port = parseInt(process.env.PORT || "3000");

console.log(`Geo Demand Pulse Index API running on http://localhost:${port}`);
console.log("Endpoints:");
console.log("  GET /v1/demand/index?geoType=zip&geoCode=90210&category=plumbing");
console.log("  GET /v1/demand/trend?geoType=city&geoCode=seattle&category=cleaning");
console.log("  GET /v1/demand/anomalies?geoType=state&geoCode=CA");

export default {
  port,
  fetch: app.fetch,
};
