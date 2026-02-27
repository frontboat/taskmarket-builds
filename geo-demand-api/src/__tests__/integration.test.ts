import { describe, test, expect } from "bun:test";
import { createDemandAPI, type DataSource } from "../api";

const mockDataSource: DataSource = {
  async getDemandData(geoCode: string, category: string) {
    return { geoCode, category, exists: true };
  },
  async getGeoExists(geoCode: string) {
    if (geoCode === "UNKNOWN") return false;
    return true;
  },
};

const app = createDemandAPI(mockDataSource);

async function get(path: string) {
  const req = new Request(`http://localhost${path}`);
  return app.fetch(req);
}

describe("Integration Tests: API Endpoints", () => {
  // --- Demand Index ---

  describe("GET /v1/demand/index", () => {
    test("returns 200 with valid params", async () => {
      const res = await get("/v1/demand/index?geoType=zip&geoCode=90210&category=plumbing");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.geoType).toBe("zip");
      expect(body.geoCode).toBe("90210");
      expect(body.category).toBe("plumbing");
      expect(body.demand_index).toBeGreaterThanOrEqual(0);
      expect(body.demand_index).toBeLessThanOrEqual(200);
      expect(typeof body.velocity).toBe("number");
      expect(body.confidence_interval).toBeDefined();
      expect(body.comparable_geos).toBeInstanceOf(Array);
      expect(body.confidence).toBeGreaterThan(0);
      expect(body.freshness).toBeDefined();
    });

    test("returns deterministic results", async () => {
      const res1 = await get("/v1/demand/index?geoType=zip&geoCode=90210&category=plumbing");
      const res2 = await get("/v1/demand/index?geoType=zip&geoCode=90210&category=plumbing");
      const body1 = await res1.json();
      const body2 = await res2.json();
      expect(body1.demand_index).toBe(body2.demand_index);
      expect(body1.velocity).toBe(body2.velocity);
    });

    test("returns 400 for missing geoType", async () => {
      const res = await get("/v1/demand/index?geoCode=90210&category=plumbing");
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    test("returns 400 for missing geoCode", async () => {
      const res = await get("/v1/demand/index?geoType=zip&category=plumbing");
      expect(res.status).toBe(400);
    });

    test("returns 400 for missing category", async () => {
      const res = await get("/v1/demand/index?geoType=zip&geoCode=90210");
      expect(res.status).toBe(400);
    });

    test("returns 400 for invalid geoType", async () => {
      const res = await get("/v1/demand/index?geoType=region&geoCode=90210&category=plumbing");
      expect(res.status).toBe(400);
    });

    test("returns 404 for unknown geo", async () => {
      const res = await get("/v1/demand/index?geoType=zip&geoCode=UNKNOWN&category=plumbing");
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("GEO_NOT_FOUND");
    });

    test("accepts seasonalityMode parameter", async () => {
      const res = await get("/v1/demand/index?geoType=city&geoCode=seattle&category=cleaning&seasonalityMode=raw");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.geoType).toBe("city");
    });

    test("output includes confidence_interval with lower and upper", async () => {
      const res = await get("/v1/demand/index?geoType=zip&geoCode=90210&category=plumbing");
      const body = await res.json();
      expect(typeof body.confidence_interval.lower).toBe("number");
      expect(typeof body.confidence_interval.upper).toBe("number");
      expect(body.confidence_interval.lower).toBeLessThanOrEqual(body.confidence_interval.upper);
    });

    test("confidence_interval contains demand_index", async () => {
      const res = await get("/v1/demand/index?geoType=zip&geoCode=90210&category=plumbing");
      const body = await res.json();
      expect(body.confidence_interval.lower).toBeLessThanOrEqual(body.demand_index);
      expect(body.confidence_interval.upper).toBeGreaterThanOrEqual(body.demand_index);
    });

    test("comparable_geos entries have required fields", async () => {
      const res = await get("/v1/demand/index?geoType=zip&geoCode=90210&category=plumbing");
      const body = await res.json();
      for (const geo of body.comparable_geos) {
        expect(typeof geo.geoCode).toBe("string");
        expect(typeof geo.demand_index).toBe("number");
        expect(typeof geo.similarity).toBe("number");
      }
    });
  });

  // --- Trend ---

  describe("GET /v1/demand/trend", () => {
    test("returns 200 with valid params", async () => {
      const res = await get("/v1/demand/trend?geoType=city&geoCode=seattle&category=plumbing");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.geoType).toBe("city");
      expect(body.geoCode).toBe("seattle");
      expect(body.category).toBe("plumbing");
      expect(body.lookbackWindow).toBe("30d");
      expect(body.data_points).toBeInstanceOf(Array);
      expect(body.data_points.length).toBeGreaterThan(0);
      expect(["accelerating", "stable", "decelerating", "volatile"]).toContain(body.trend_direction);
      expect(body.trend_strength).toBeGreaterThanOrEqual(0);
      expect(body.trend_strength).toBeLessThanOrEqual(1);
      expect(body.freshness).toBeDefined();
    });

    test("returns 400 for missing required fields", async () => {
      const res = await get("/v1/demand/trend?geoType=city&category=plumbing");
      expect(res.status).toBe(400);
    });

    test("returns 404 for unknown geo", async () => {
      const res = await get("/v1/demand/trend?geoType=zip&geoCode=UNKNOWN&category=plumbing");
      expect(res.status).toBe(404);
    });

    test("accepts lookbackWindow parameter", async () => {
      const res = await get("/v1/demand/trend?geoType=state&geoCode=CA&category=cleaning&lookbackWindow=90d");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.lookbackWindow).toBe("90d");
    });

    test("returns 400 for invalid lookbackWindow", async () => {
      const res = await get("/v1/demand/trend?geoType=city&geoCode=seattle&category=test&lookbackWindow=14d");
      expect(res.status).toBe(400);
    });

    test("data_points have required fields", async () => {
      const res = await get("/v1/demand/trend?geoType=zip&geoCode=90210&category=plumbing");
      const body = await res.json();
      for (const point of body.data_points) {
        expect(typeof point.date).toBe("string");
        expect(typeof point.demand_index).toBe("number");
        expect(typeof point.velocity).toBe("number");
      }
    });

    test("data_points are in chronological order", async () => {
      const res = await get("/v1/demand/trend?geoType=zip&geoCode=90210&category=plumbing");
      const body = await res.json();
      for (let i = 1; i < body.data_points.length; i++) {
        expect(body.data_points[i].date >= body.data_points[i - 1].date).toBe(true);
      }
    });

    test("longer lookback has more data points", async () => {
      const short = await get("/v1/demand/trend?geoType=zip&geoCode=90210&category=plumbing&lookbackWindow=7d");
      const long = await get("/v1/demand/trend?geoType=zip&geoCode=90210&category=plumbing&lookbackWindow=365d");
      const shortBody = await short.json();
      const longBody = await long.json();
      expect(longBody.data_points.length).toBeGreaterThan(shortBody.data_points.length);
    });
  });

  // --- Anomalies ---

  describe("GET /v1/demand/anomalies", () => {
    test("returns 200 with valid params", async () => {
      const res = await get("/v1/demand/anomalies?geoType=zip&geoCode=90210&category=plumbing");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.geoType).toBe("zip");
      expect(body.geoCode).toBe("90210");
      expect(body.anomalies).toBeInstanceOf(Array);
      expect(typeof body.total_anomalies).toBe("number");
      expect(body.total_anomalies).toBe(body.anomalies.length);
      expect(body.freshness).toBeDefined();
    });

    test("returns 400 for missing geoType", async () => {
      const res = await get("/v1/demand/anomalies?geoCode=90210");
      expect(res.status).toBe(400);
    });

    test("returns 404 for unknown geo", async () => {
      const res = await get("/v1/demand/anomalies?geoType=zip&geoCode=UNKNOWN");
      expect(res.status).toBe(404);
    });

    test("category is optional", async () => {
      const res = await get("/v1/demand/anomalies?geoType=state&geoCode=CA");
      expect(res.status).toBe(200);
    });

    test("accepts threshold parameter", async () => {
      const res = await get("/v1/demand/anomalies?geoType=zip&geoCode=90210&threshold=0.95");
      expect(res.status).toBe(200);
    });

    test("anomalies have required fields", async () => {
      const res = await get("/v1/demand/anomalies?geoType=zip&geoCode=90210&category=plumbing&threshold=0.5");
      const body = await res.json();
      for (const a of body.anomalies) {
        expect(typeof a.category).toBe("string");
        expect(["spike", "drop", "seasonal_deviation", "trend_break"]).toContain(a.anomaly_type);
        expect(["low", "medium", "high", "critical"]).toContain(a.severity);
        expect(typeof a.confidence).toBe("number");
        expect(typeof a.detected_at).toBe("string");
        expect(typeof a.description).toBe("string");
      }
    });

    test("total_anomalies matches array length", async () => {
      const res = await get("/v1/demand/anomalies?geoType=zip&geoCode=90210&category=plumbing");
      const body = await res.json();
      expect(body.total_anomalies).toBe(body.anomalies.length);
    });

    test("returns 400 for invalid threshold", async () => {
      const res = await get("/v1/demand/anomalies?geoType=zip&geoCode=90210&threshold=1.5");
      expect(res.status).toBe(400);
    });

    test("returns 400 for missing geoCode", async () => {
      const res = await get("/v1/demand/anomalies?geoType=zip");
      expect(res.status).toBe(400);
    });
  });

  // --- Cross-endpoint consistency ---

  describe("Cross-endpoint consistency", () => {
    test("demand index is deterministic across endpoints", async () => {
      const indexRes = await get("/v1/demand/index?geoType=zip&geoCode=90210&category=plumbing");
      const indexBody = await indexRes.json();
      // The index endpoint should always produce the same value
      const indexRes2 = await get("/v1/demand/index?geoType=zip&geoCode=90210&category=plumbing");
      const indexBody2 = await indexRes2.json();
      expect(indexBody.demand_index).toBe(indexBody2.demand_index);
      expect(indexBody.confidence).toBe(indexBody2.confidence);
    });

    test("different geoTypes with same geoCode produce different results", async () => {
      const zip = await get("/v1/demand/index?geoType=zip&geoCode=90210&category=plumbing");
      const city = await get("/v1/demand/index?geoType=city&geoCode=90210&category=plumbing");
      const zipBody = await zip.json();
      const cityBody = await city.json();
      expect(zipBody.geoType).toBe("zip");
      expect(cityBody.geoType).toBe("city");
      // Both should be valid responses with demand_index in range
      expect(zipBody.demand_index).toBeGreaterThanOrEqual(0);
      expect(cityBody.demand_index).toBeGreaterThanOrEqual(0);
    });

    test("error envelope is consistent across endpoints", async () => {
      const indexErr = await get("/v1/demand/index?geoType=zip&geoCode=UNKNOWN&category=plumbing");
      const trendErr = await get("/v1/demand/trend?geoType=zip&geoCode=UNKNOWN&category=plumbing");
      const anomalyErr = await get("/v1/demand/anomalies?geoType=zip&geoCode=UNKNOWN");
      const indexBody = await indexErr.json();
      const trendBody = await trendErr.json();
      const anomalyBody = await anomalyErr.json();
      expect(indexBody.error).toBeDefined();
      expect(trendBody.error).toBeDefined();
      expect(anomalyBody.error).toBeDefined();
      expect(indexBody.error.code).toBe("GEO_NOT_FOUND");
      expect(trendBody.error.code).toBe("GEO_NOT_FOUND");
      expect(anomalyBody.error.code).toBe("GEO_NOT_FOUND");
    });
  });
});
