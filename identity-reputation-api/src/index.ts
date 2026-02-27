import { createIdentityAPI } from "./api";
import { createTaskmarketDataSource } from "./datasource";

const dataSource = createTaskmarketDataSource();
const app = createIdentityAPI(dataSource);

const port = parseInt(process.env.PORT || "3000");

console.log(`Identity Reputation API running on http://localhost:${port}`);
console.log("Endpoints:");
console.log("  GET /v1/identity/reputation?agentAddress=0x...");
console.log("  GET /v1/identity/history?agentAddress=0x...");
console.log("  GET /v1/identity/trust-breakdown?agentAddress=0x...");

export default {
  port,
  fetch: app.fetch,
};
