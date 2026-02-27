import { Hono } from "hono";
import {
  reputationInputSchema,
  reputationOutputSchema,
  historyInputSchema,
  historyOutputSchema,
  trustBreakdownInputSchema,
  trustBreakdownOutputSchema,
  type ReputationOutput,
  type HistoryOutput,
  type TrustBreakdownOutput,
} from "./schemas";
import {
  computeTrustScore,
  computeTrustComponents,
  computeConfidence,
  computeCompletionRate,
  computeDisputeRate,
  computeFreshness,
  getIdentityState,
  type AgentData,
} from "./scoring";

export interface DataSource {
  getAgentStats(address: string): Promise<AgentData | null>;
  getIdentityStatus(address: string): Promise<{ registered: boolean; agentId: string | null }>;
}

export function createIdentityAPI(dataSource: DataSource) {
  const app = new Hono();

  app.get("/v1/identity/reputation", async (c) => {
    const raw = {
      agentAddress: c.req.query("agentAddress"),
      chain: c.req.query("chain"),
      timeframe: c.req.query("timeframe"),
    };

    const parsed = reputationInputSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { agentAddress } = parsed.data;
    const fetchedAt = new Date();

    const [stats, identity] = await Promise.all([
      dataSource.getAgentStats(agentAddress),
      dataSource.getIdentityStatus(agentAddress),
    ]);

    if (!stats) {
      return c.json({ error: { code: "AGENT_NOT_FOUND", message: "Agent not found" } }, 404);
    }

    const agentData: AgentData = { ...stats, registered: identity.registered };
    const output: ReputationOutput = {
      agentAddress,
      trustScore: computeTrustScore(agentData),
      completionRate: computeCompletionRate(agentData),
      disputeRate: computeDisputeRate(agentData),
      totalTasks: agentData.completedTasks,
      onchainIdentityState: getIdentityState(identity.registered),
      confidence: computeConfidence(agentData),
      freshness: computeFreshness(fetchedAt),
    };

    reputationOutputSchema.parse(output);
    return c.json(output);
  });

  app.get("/v1/identity/history", async (c) => {
    const raw = {
      agentAddress: c.req.query("agentAddress"),
      chain: c.req.query("chain"),
      limit: c.req.query("limit"),
      offset: c.req.query("offset"),
    };

    const parsed = historyInputSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { agentAddress, limit, offset } = parsed.data;
    const fetchedAt = new Date();

    const stats = await dataSource.getAgentStats(agentAddress);
    if (!stats) {
      return c.json({ error: { code: "AGENT_NOT_FOUND", message: "Agent not found" } }, 404);
    }

    // Build history from recent ratings (best available data)
    const allEntries = stats.recentRatings.map((r) => ({
      taskId: r.taskId,
      role: "worker" as const,
      status: "completed" as const,
      reward: "0",
      rating: r.rating,
      counterparty: "0x0000000000000000000000000000000000000000",
      completedAt: r.createdAt,
      evidenceUrls: [],
    }));

    const entries = allEntries.slice(offset, offset + limit);

    const output: HistoryOutput = {
      agentAddress,
      entries,
      total: allEntries.length,
      freshness: computeFreshness(fetchedAt),
    };

    historyOutputSchema.parse(output);
    return c.json(output);
  });

  app.get("/v1/identity/trust-breakdown", async (c) => {
    const raw = {
      agentAddress: c.req.query("agentAddress"),
      chain: c.req.query("chain"),
      evidenceDepth: c.req.query("evidenceDepth"),
    };

    const parsed = trustBreakdownInputSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { agentAddress } = parsed.data;
    const fetchedAt = new Date();

    const [stats, identity] = await Promise.all([
      dataSource.getAgentStats(agentAddress),
      dataSource.getIdentityStatus(agentAddress),
    ]);

    if (!stats) {
      return c.json({ error: { code: "AGENT_NOT_FOUND", message: "Agent not found" } }, 404);
    }

    const agentData: AgentData = { ...stats, registered: identity.registered };

    const output: TrustBreakdownOutput = {
      agentAddress,
      overallTrustScore: computeTrustScore(agentData),
      components: computeTrustComponents(agentData),
      confidence: computeConfidence(agentData),
      freshness: computeFreshness(fetchedAt),
    };

    trustBreakdownOutputSchema.parse(output);
    return c.json(output);
  });

  return app;
}
