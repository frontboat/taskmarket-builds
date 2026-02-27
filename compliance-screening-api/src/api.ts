import { Hono } from "hono";
import {
  screeningCheckInputSchema,
  screeningCheckOutputSchema,
  exposureChainInputSchema,
  exposureChainOutputSchema,
  jurisdictionRiskInputSchema,
  jurisdictionRiskOutputSchema,
  type ScreeningCheckOutput,
  type ExposureChainOutput,
  type JurisdictionRiskOutput,
} from "./schemas";
import {
  generateDeterministicMatches,
  determineScreeningStatus,
  computeMatchConfidence,
  computeScreeningConfidence,
  generateEvidenceBundle,
  generateExposureChain,
  computeAggregateRisk,
  computeJurisdictionRiskScore,
  computeJurisdictionRiskLevel,
  generateRiskFactors,
  getSanctionsPrograms,
  computeLastUpdated,
  computeFreshness,
} from "./screening";

export interface DataSource {
  checkEntity(entityName: string, entityType: string): Promise<{ found: boolean }>;
  getAddressInfo(address: string): Promise<{ exists: boolean } | null>;
  getJurisdictionData(jurisdiction: string): Promise<{ supported: boolean } | null>;
}

export function createScreeningAPI(dataSource: DataSource) {
  const app = new Hono();

  // POST /v1/screening/check
  app.post("/v1/screening/check", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } }, 400);
    }

    const parsed = screeningCheckInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { entityName, entityType, identifiers, addresses, jurisdictions } = parsed.data;
    const fetchedAt = new Date();

    const entityCheck = await dataSource.checkEntity(entityName, entityType);

    const matches = generateDeterministicMatches(entityName, entityType);
    const screeningStatus = determineScreeningStatus(matches);
    const matchConfidence = computeMatchConfidence(matches);
    const confidence = computeScreeningConfidence(
      matches,
      !!identifiers && identifiers.length > 0,
      !!addresses && addresses.length > 0
    );
    const evidenceBundle = generateEvidenceBundle(entityName, matches);

    const output: ScreeningCheckOutput = {
      entityName,
      screening_status: screeningStatus,
      match_confidence: matchConfidence,
      matches,
      evidence_bundle: evidenceBundle,
      confidence,
      freshness: computeFreshness(fetchedAt),
    };

    screeningCheckOutputSchema.parse(output);
    return c.json(output);
  });

  // GET /v1/screening/exposure-chain
  app.get("/v1/screening/exposure-chain", async (c) => {
    const raw = {
      address: c.req.query("address"),
      ownershipDepth: c.req.query("ownershipDepth"),
    };

    const parsed = exposureChainInputSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { address, ownershipDepth } = parsed.data;
    const fetchedAt = new Date();

    const addressInfo = await dataSource.getAddressInfo(address);
    if (!addressInfo) {
      return c.json({ error: { code: "ADDRESS_NOT_FOUND", message: "Address not found" } }, 404);
    }

    const chain = generateExposureChain(address, ownershipDepth);
    const aggregateRisk = computeAggregateRisk(chain);

    const output: ExposureChainOutput = {
      address,
      chain,
      aggregate_risk: aggregateRisk,
      total_entities_scanned: chain.length,
      freshness: computeFreshness(fetchedAt),
    };

    exposureChainOutputSchema.parse(output);
    return c.json(output);
  });

  // GET /v1/screening/jurisdiction-risk
  app.get("/v1/screening/jurisdiction-risk", async (c) => {
    const raw = {
      jurisdiction: c.req.query("jurisdiction"),
      industry: c.req.query("industry"),
    };

    const parsed = jurisdictionRiskInputSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { jurisdiction, industry } = parsed.data;
    const fetchedAt = new Date();

    const jurisdictionData = await dataSource.getJurisdictionData(jurisdiction);
    if (!jurisdictionData) {
      return c.json({ error: { code: "JURISDICTION_NOT_FOUND", message: "Jurisdiction not found" } }, 404);
    }

    const riskScore = computeJurisdictionRiskScore(jurisdiction, industry);
    const riskLevel = computeJurisdictionRiskLevel(riskScore);
    const riskFactors = generateRiskFactors(jurisdiction, industry);
    const sanctionsPrograms = getSanctionsPrograms(jurisdiction);
    const lastUpdated = computeLastUpdated(jurisdiction);

    const output: JurisdictionRiskOutput = {
      jurisdiction,
      risk_score: riskScore,
      risk_level: riskLevel,
      risk_factors: riskFactors,
      sanctions_programs: sanctionsPrograms,
      last_updated: lastUpdated,
      freshness: computeFreshness(fetchedAt),
    };

    jurisdictionRiskOutputSchema.parse(output);
    return c.json(output);
  });

  return app;
}
