import type {
  Freshness,
  DeltaEntry,
  ImpactEntry,
  MappedControl,
  SemanticChangeType,
  ImpactLevel,
  RemediationUrgency,
  EstimatedEffort,
  GapStatus,
} from "./schemas";

// --- Configuration ---

export const DEFAULT_STALENESS_THRESHOLD = 300; // 5 minutes

// --- Freshness ---

export function computeFreshness(
  fetchedAt: Date,
  now: Date = new Date(),
  stalenessThreshold: number = DEFAULT_STALENESS_THRESHOLD
): Freshness {
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - fetchedAt.getTime()) / 1000));
  return {
    timestamp: fetchedAt.toISOString(),
    ageSeconds,
    stale: ageSeconds > stalenessThreshold,
  };
}

// --- Deterministic seeded RNG ---

export function seedFromInput(...parts: (string | undefined)[]): number {
  const str = parts.filter(Boolean).join("|");
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1; // ensure positive
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

// --- Regulation Data Templates ---

const CHANGE_TYPES: SemanticChangeType[] = [
  "new_rule", "amendment", "repeal", "guidance_update", "enforcement_action",
];

const IMPACT_LEVELS: ImpactLevel[] = ["low", "medium", "high", "critical"];
const REMEDIATION_URGENCIES: RemediationUrgency[] = ["immediate", "short_term", "planned"];
const ESTIMATED_EFFORTS: EstimatedEffort[] = ["minimal", "moderate", "significant", "major"];
const GAP_STATUSES: GapStatus[] = ["compliant", "partial_gap", "full_gap", "not_assessed"];

const RULE_TOPICS = [
  "Data Privacy Requirements",
  "Cybersecurity Framework Update",
  "Financial Reporting Standards",
  "Anti-Money Laundering Provisions",
  "Consumer Protection Guidelines",
  "Environmental Disclosure Requirements",
  "Digital Asset Regulations",
  "Cross-Border Data Transfer Rules",
  "AI Governance Framework",
  "Supply Chain Due Diligence",
  "Whistleblower Protection Act",
  "Corporate Governance Standards",
];

const SUMMARIES = [
  "Introduces mandatory reporting requirements for covered entities",
  "Amends existing framework to address emerging technological risks",
  "Establishes new baseline controls for critical infrastructure",
  "Updates compliance deadlines and enforcement mechanisms",
  "Expands scope of covered activities and regulated parties",
  "Implements risk-based approach to regulatory compliance",
  "Revises penalty structure for non-compliance",
  "Adds requirements for third-party vendor management",
  "Mandates periodic security assessments and audits",
  "Strengthens requirements for incident response and notification",
  "Introduces ESG reporting obligations for listed companies",
  "Updates cross-border data handling requirements",
];

const AGENCIES: Record<string, string[]> = {
  US: ["SEC", "CFTC", "FTC", "OCC", "FINRA", "EPA", "DOJ"],
  GB: ["FCA", "PRA", "ICO", "CMA", "HMRC", "EA"],
  DE: ["BaFin", "BSI", "BKartA", "BMF", "BAFA"],
  FR: ["AMF", "ACPR", "CNIL", "DGCCRF"],
  JP: ["FSA", "JFSA", "METI", "BOJ"],
  SG: ["MAS", "IMDA", "CSA", "PDPC"],
  AU: ["ASIC", "APRA", "OAIC", "ACCC"],
};

function getAgencies(jurisdiction: string): string[] {
  return AGENCIES[jurisdiction] || ["REG", "GOV", "AUTH"];
}

const SOC2_CONTROLS = [
  { id: "CC6.1", name: "Logical Access Controls" },
  { id: "CC6.2", name: "User Authentication" },
  { id: "CC6.3", name: "Access Authorization" },
  { id: "CC7.1", name: "System Monitoring" },
  { id: "CC7.2", name: "Anomaly Detection" },
  { id: "CC8.1", name: "Change Management" },
  { id: "CC9.1", name: "Risk Mitigation" },
  { id: "A1.1", name: "Availability Commitments" },
  { id: "PI1.1", name: "Processing Integrity" },
  { id: "C1.1", name: "Confidentiality Commitments" },
];

const ISO27001_CONTROLS = [
  { id: "A.5.1", name: "Information Security Policies" },
  { id: "A.6.1", name: "Organization of Information Security" },
  { id: "A.8.1", name: "Asset Management" },
  { id: "A.9.1", name: "Access Control Policy" },
  { id: "A.9.2", name: "User Access Management" },
  { id: "A.10.1", name: "Cryptographic Controls" },
  { id: "A.12.1", name: "Operational Procedures" },
  { id: "A.12.4", name: "Logging and Monitoring" },
  { id: "A.14.1", name: "Security Requirements" },
  { id: "A.16.1", name: "Incident Management" },
];

const NIST_CONTROLS = [
  { id: "AC-1", name: "Access Control Policy" },
  { id: "AC-2", name: "Account Management" },
  { id: "AU-1", name: "Audit and Accountability Policy" },
  { id: "AU-6", name: "Audit Review and Analysis" },
  { id: "CM-1", name: "Configuration Management Policy" },
  { id: "IA-1", name: "Identification and Authentication Policy" },
  { id: "IR-1", name: "Incident Response Policy" },
  { id: "RA-1", name: "Risk Assessment Policy" },
  { id: "SC-1", name: "System and Communications Protection" },
  { id: "SI-1", name: "System and Information Integrity" },
];

const GDPR_CONTROLS = [
  { id: "Art.5", name: "Principles of Processing" },
  { id: "Art.6", name: "Lawfulness of Processing" },
  { id: "Art.13", name: "Information to Data Subject" },
  { id: "Art.17", name: "Right to Erasure" },
  { id: "Art.25", name: "Data Protection by Design" },
  { id: "Art.30", name: "Records of Processing" },
  { id: "Art.32", name: "Security of Processing" },
  { id: "Art.33", name: "Breach Notification" },
  { id: "Art.35", name: "Data Protection Impact Assessment" },
  { id: "Art.44", name: "Transfer Restrictions" },
];

const FRAMEWORK_CONTROLS: Record<string, { id: string; name: string }[]> = {
  soc2: SOC2_CONTROLS,
  iso27001: ISO27001_CONTROLS,
  nist: NIST_CONTROLS,
  gdpr: GDPR_CONTROLS,
};

const REMEDIATION_TEMPLATES = [
  "Review and update existing policies",
  "Implement additional technical controls",
  "Conduct staff training and awareness sessions",
  "Perform gap analysis against new requirements",
  "Update incident response procedures",
  "Enhance monitoring and logging capabilities",
  "Revise vendor management processes",
  "Document compliance evidence",
  "Engage external assessors for validation",
  "Update data handling procedures",
];

// --- Compute Deltas ---

export function computeDeltas(
  jurisdiction: string,
  since: string,
  industry?: string,
  sourcePriority: "official" | "all" = "all"
): DeltaEntry[] {
  const seed = seedFromInput(jurisdiction, industry || "__none__", since);
  const rng = seededRandom(seed);

  const agencies = getAgencies(jurisdiction);
  const baseCount = 3 + Math.floor(rng() * 5); // 3-7 deltas
  const count = sourcePriority === "official" ? Math.max(1, Math.floor(baseCount * 0.6)) : baseCount;

  const deltas: DeltaEntry[] = [];

  for (let i = 0; i < count; i++) {
    const agency = pick(agencies, rng);
    const ruleNum = String(Math.floor(rng() * 900) + 100);
    const topic = pick(RULE_TOPICS, rng);
    const changeType = pick(CHANGE_TYPES, rng);
    const summary = pick(SUMMARIES, rng);

    // Generate dates deterministically
    const year = 2025;
    const pubMonth = 1 + Math.floor(rng() * 6);
    const pubDay = 1 + Math.floor(rng() * 28);
    const effMonth = pubMonth + 3 + Math.floor(rng() * 6);
    const effYear = effMonth > 12 ? year + 1 : year;
    const effMonthNorm = effMonth > 12 ? effMonth - 12 : effMonth;
    const effDay = 1 + Math.floor(rng() * 28);

    const pad = (n: number) => String(n).padStart(2, "0");

    deltas.push({
      ruleId: `${jurisdiction}-${agency}-${ruleNum}`,
      title: `${topic} (${agency})`,
      semantic_change_type: changeType,
      summary,
      effective_date: `${effYear}-${pad(effMonthNorm)}-${pad(effDay)}`,
      published_date: `${year}-${pad(pubMonth)}-${pad(pubDay)}`,
      source_url: `https://regulatory.gov/${jurisdiction.toLowerCase()}/${agency.toLowerCase()}/rules/${ruleNum}`,
      urgency_score: Math.round(rng() * 100),
    });
  }

  return deltas;
}

// --- Compute Impacts ---

export function computeImpacts(
  jurisdiction: string,
  industry?: string,
  ruleId?: string,
  controlFramework: string = "all"
): ImpactEntry[] {
  const seed = seedFromInput(jurisdiction, industry || "__none__");
  const rng = seededRandom(seed);

  const agencies = getAgencies(jurisdiction);
  const count = 3 + Math.floor(rng() * 4); // 3-6 impacts

  const impacts: ImpactEntry[] = [];

  for (let i = 0; i < count; i++) {
    const agency = pick(agencies, rng);
    const ruleNum = String(Math.floor(rng() * 900) + 100);
    const thisRuleId = `${jurisdiction}-${agency}-${ruleNum}`;
    const topic = pick(RULE_TOPICS, rng);
    const impactLevel = pick(IMPACT_LEVELS, rng);
    const urgency = pick(REMEDIATION_URGENCIES, rng);
    const effort = pick(ESTIMATED_EFFORTS, rng);
    const summary = pick(SUMMARIES, rng);

    // Generate affected controls
    const frameworkKeys = controlFramework === "all"
      ? Object.keys(FRAMEWORK_CONTROLS)
      : [controlFramework];
    const controlPool: string[] = [];
    for (const fw of frameworkKeys) {
      const controls = FRAMEWORK_CONTROLS[fw];
      if (controls) {
        const numControls = 1 + Math.floor(rng() * 3);
        const selected = pickN(controls, numControls, rng);
        controlPool.push(...selected.map(c => `${fw.toUpperCase()}-${c.id}`));
      }
    }

    impacts.push({
      ruleId: thisRuleId,
      title: `Impact: ${topic}`,
      affected_controls: controlPool.length > 0 ? controlPool : ["GENERAL-001"],
      impact_level: impactLevel,
      remediation_urgency: urgency,
      estimated_effort: effort,
      description: `${summary}. Affects ${controlPool.length} control(s) at ${impactLevel} level.`,
    });
  }

  // Filter by ruleId if specified
  if (ruleId) {
    return impacts.filter(i => i.ruleId === ruleId);
  }

  return impacts;
}

// --- Compute Control Mapping ---

export function computeControlMapping(
  ruleId: string,
  controlFramework: "soc2" | "iso27001" | "nist" | "gdpr",
  jurisdiction: string
): { mapped_controls: MappedControl[]; total_mapped: number; coverage_score: number } {
  const seed = seedFromInput(ruleId, controlFramework, jurisdiction);
  const rng = seededRandom(seed);

  const controls = FRAMEWORK_CONTROLS[controlFramework] || [];
  const numMapped = 2 + Math.floor(rng() * Math.min(5, controls.length));
  const selectedControls = pickN(controls, numMapped, rng);

  const mappedControls: MappedControl[] = selectedControls.map(ctrl => {
    const confidence = Math.round((0.5 + rng() * 0.5) * 100) / 100; // 0.50-1.00
    const gapStatus = pick(GAP_STATUSES, rng);
    const numSteps = 1 + Math.floor(rng() * 3);
    const steps = pickN(REMEDIATION_TEMPLATES, numSteps, rng);

    return {
      controlId: `${controlFramework.toUpperCase()}-${ctrl.id}`,
      controlName: ctrl.name,
      mapping_confidence: confidence,
      gap_status: gapStatus,
      remediation_steps: steps,
    };
  });

  const coverageScore = Math.round((mappedControls.length / controls.length) * 100) / 100;

  return {
    mapped_controls: mappedControls,
    total_mapped: mappedControls.length,
    coverage_score: Math.min(1, coverageScore),
  };
}
