import { Hono } from "hono";
import {
  riskScoreInputSchema,
  riskScoreOutputSchema,
  exposurePathsInputSchema,
  exposurePathsOutputSchema,
  entityProfileInputSchema,
  entityProfileOutputSchema,
  type RiskScoreOutput,
  type ExposurePathsOutput,
  type EntityProfileOutput,
} from "./schemas";
import {
  computeRiskScore,
  computeRiskLevel,
  computeRiskFactors,
  computeSanctionsProximity,
  computeConfidence,
  computeExposurePaths,
  computeTotalExposure,
  computeEntityProfile,
  computeFreshness,
  type AddressRiskData,
} from "./risk-scoring";

export interface DataSource {
  getAddressData(address: string): Promise<AddressRiskData | null>;
}

export function createRiskAPI(dataSource: DataSource) {
  const app = new Hono();

  // POST /v1/risk/score
  app.post("/v1/risk/score", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
        400
      );
    }

    const parsed = riskScoreInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        400
      );
    }

    const { address } = parsed.data;
    const fetchedAt = new Date();

    const data = await dataSource.getAddressData(address);
    if (!data) {
      return c.json(
        { error: { code: "ADDRESS_NOT_FOUND", message: "Address not found" } },
        404
      );
    }

    const riskScore = computeRiskScore(address);
    const output: RiskScoreOutput = {
      address,
      risk_score: riskScore,
      risk_level: computeRiskLevel(riskScore),
      risk_factors: computeRiskFactors(address),
      sanctions_proximity: computeSanctionsProximity(address),
      confidence: computeConfidence(address),
      freshness: computeFreshness(fetchedAt),
    };

    riskScoreOutputSchema.parse(output);
    return c.json(output);
  });

  // GET /v1/risk/exposure-paths
  app.get("/v1/risk/exposure-paths", async (c) => {
    const raw = {
      address: c.req.query("address"),
      network: c.req.query("network"),
      threshold: c.req.query("threshold"),
      maxHops: c.req.query("maxHops"),
    };

    const parsed = exposurePathsInputSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        400
      );
    }

    const { address, maxHops, threshold } = parsed.data;
    const fetchedAt = new Date();

    const data = await dataSource.getAddressData(address);
    if (!data) {
      return c.json(
        { error: { code: "ADDRESS_NOT_FOUND", message: "Address not found" } },
        404
      );
    }

    const paths = computeExposurePaths(address, maxHops, threshold);
    const output: ExposurePathsOutput = {
      address,
      paths,
      total_exposure: computeTotalExposure(paths),
      highest_risk_path_score: paths.length > 0
        ? Math.max(...paths.map((p) => p.risk_contribution))
        : 0,
      freshness: computeFreshness(fetchedAt),
    };

    exposurePathsOutputSchema.parse(output);
    return c.json(output);
  });

  // GET /v1/risk/entity-profile
  app.get("/v1/risk/entity-profile", async (c) => {
    const raw = {
      address: c.req.query("address"),
      network: c.req.query("network"),
    };

    const parsed = entityProfileInputSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        400
      );
    }

    const { address } = parsed.data;
    const fetchedAt = new Date();

    const data = await dataSource.getAddressData(address);
    if (!data) {
      return c.json(
        { error: { code: "ADDRESS_NOT_FOUND", message: "Address not found" } },
        404
      );
    }

    const profile = computeEntityProfile(address);
    const output: EntityProfileOutput = {
      ...profile,
      freshness: computeFreshness(fetchedAt),
    };

    entityProfileOutputSchema.parse(output);
    return c.json(output);
  });

  return app;
}
