import type { DataSource } from "./api";
import type { AgentData } from "./scoring";

const API_BASE = "https://api-market.daydreams.systems/api";

export function createTaskmarketDataSource(): DataSource {
  return {
    async getAgentStats(address: string): Promise<AgentData | null> {
      const res = await fetch(`${API_BASE}/agents/stats?address=${address}`);
      if (!res.ok) return null;

      const data = await res.json() as any;
      if (!data.address) return null;

      return {
        registered: data.agentId !== null,
        completedTasks: data.completedTasks ?? 0,
        ratedTasks: data.ratedTasks ?? 0,
        totalStars: data.totalStars ?? 0,
        averageRating: data.averageRating ?? 0,
        totalEarnings: data.totalEarnings ?? "0",
        skills: data.skills ?? [],
        recentRatings: (data.recentRatings ?? []).map((r: any) => ({
          taskId: r.taskId ?? "",
          rating: r.rating ?? 0,
          createdAt: r.createdAt ?? new Date().toISOString(),
        })),
      };
    },

    async getIdentityStatus(address: string): Promise<{ registered: boolean; agentId: string | null }> {
      const res = await fetch(`${API_BASE}/identity/status?address=${address}`);
      if (!res.ok) return { registered: false, agentId: null };

      const data = await res.json() as any;
      return {
        registered: data.registered ?? false,
        agentId: data.agentId ?? null,
      };
    },
  };
}
