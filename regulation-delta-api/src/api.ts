import { Hono } from "hono";
import {
  deltaInputSchema,
  deltaOutputSchema,
  impactInputSchema,
  impactOutputSchema,
  mapControlsInputSchema,
  mapControlsOutputSchema,
  type DeltaOutput,
  type ImpactOutput,
  type MapControlsOutput,
} from "./schemas";
import {
  computeFreshness,
  computeDeltas,
  computeImpacts,
  computeControlMapping,
} from "./regulation";

export interface DataSource {
  getRegulationData(jurisdiction: string): Promise<{ jurisdiction: string; available: boolean } | null>;
}

export function createRegulationAPI(dataSource: DataSource) {
  const app = new Hono();

  // GET /v1/regulations/delta
  app.get("/v1/regulations/delta", async (c) => {
    const raw = {
      jurisdiction: c.req.query("jurisdiction"),
      industry: c.req.query("industry"),
      since: c.req.query("since"),
      source_priority: c.req.query("source_priority"),
    };

    const parsed = deltaInputSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { jurisdiction, industry, since, source_priority } = parsed.data;
    const fetchedAt = new Date();

    const regData = await dataSource.getRegulationData(jurisdiction);
    if (!regData) {
      return c.json({ error: { code: "JURISDICTION_NOT_FOUND", message: `No regulation data found for jurisdiction: ${jurisdiction}` } }, 404);
    }

    const deltas = computeDeltas(jurisdiction, since, industry, source_priority);

    const output: DeltaOutput = {
      jurisdiction,
      deltas,
      total_changes: deltas.length,
      freshness: computeFreshness(fetchedAt),
    };

    deltaOutputSchema.parse(output);
    return c.json(output);
  });

  // GET /v1/regulations/impact
  app.get("/v1/regulations/impact", async (c) => {
    const raw = {
      jurisdiction: c.req.query("jurisdiction"),
      industry: c.req.query("industry"),
      ruleId: c.req.query("ruleId"),
      control_framework: c.req.query("control_framework"),
    };

    const parsed = impactInputSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { jurisdiction, industry, ruleId, control_framework } = parsed.data;
    const fetchedAt = new Date();

    const regData = await dataSource.getRegulationData(jurisdiction);
    if (!regData) {
      return c.json({ error: { code: "JURISDICTION_NOT_FOUND", message: `No regulation data found for jurisdiction: ${jurisdiction}` } }, 404);
    }

    const impacts = computeImpacts(jurisdiction, industry, ruleId, control_framework);

    const output: ImpactOutput = {
      jurisdiction,
      impacts,
      total_impacts: impacts.length,
      freshness: computeFreshness(fetchedAt),
    };

    impactOutputSchema.parse(output);
    return c.json(output);
  });

  // POST /v1/regulations/map-controls
  app.post("/v1/regulations/map-controls", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } }, 400);
    }

    const parsed = mapControlsInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { ruleId, control_framework, jurisdiction } = parsed.data;
    const fetchedAt = new Date();

    const regData = await dataSource.getRegulationData(jurisdiction);
    if (!regData) {
      return c.json({ error: { code: "JURISDICTION_NOT_FOUND", message: `No regulation data found for jurisdiction: ${jurisdiction}` } }, 404);
    }

    const mapping = computeControlMapping(ruleId, control_framework, jurisdiction);

    const output: MapControlsOutput = {
      ruleId,
      control_framework,
      jurisdiction,
      mapped_controls: mapping.mapped_controls,
      total_mapped: mapping.total_mapped,
      coverage_score: mapping.coverage_score,
      freshness: computeFreshness(fetchedAt),
    };

    mapControlsOutputSchema.parse(output);
    return c.json(output);
  });

  return app;
}
