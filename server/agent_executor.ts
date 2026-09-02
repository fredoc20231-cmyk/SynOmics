import { invokeTool, toolSchemasForLLM, getTool, TOOL_REGISTRY } from './tool_registry.ts';

/**
 * Real agent tool-use loop.
 *
 * Unlike an LLM that *describes* running tools, this executor actually invokes
 * the registry tools (real computation in synomics_engine.py), observes the
 * genuine results, supports data-flow between steps, and only then synthesizes.
 * Every observation in the returned run is a real engine output or an honest
 * error — nothing is fabricated.
 */

export interface PlanStep {
  tool: string;
  input?: Record<string, any>;
  thought?: string;
  /**
   * Optional data-flow: pull inputs from a previous step's result, e.g.
   * { counts: { fromStep: 0, path: 'data.counts' } }. This lets a plan chain
   * ingest_file -> differential_expression on genuinely parsed data.
   */
  inputFrom?: Record<string, { fromStep: number; path: string }>;
}

export interface ExecutedStep {
  stepIndex: number;
  tool: string;
  thought?: string;
  input: Record<string, any>;
  observation: { ok: boolean; summary: string; result?: any; error?: string };
}

function resolvePath(obj: any, dotted: string): any {
  return dotted.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

/** Produce a short, honest summary string from a real tool result. */
function summarize(tool: string, result: any): string {
  if (!result || typeof result !== 'object') return 'Completed.';
  if (result.detectedFormat) {
    const s = result.summary || {};
    return `Parsed ${result.detectedFormat.toUpperCase()} (${Object.entries(s).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}).`;
  }
  if (Array.isArray(result.differentialExpression)) {
    const sig = result.differentialExpression.filter((r: any) => r.isSignificant).length;
    return `Differential expression on ${result.differentialExpression.length} genes; ${sig} significant.`;
  }
  if (result.alignmentScore !== undefined) {
    return `Alignment score ${result.alignmentScore}, identity ${result.identityPct}%.`;
  }
  if (result.significantHits !== undefined) {
    return `GWAS: ${result.significantHits} genome-wide significant hit(s), λ_GC=${result.genomicInflationLambda}.`;
  }
  if (result.newick) {
    return `Phylogenetic tree built (${(result.taxa || result.leaves || []).length || 'n'} taxa).`;
  }
  if (result.enrichment) {
    const terms = Array.isArray(result.enrichment) ? result.enrichment.length : 0;
    return `Enrichment computed for ${terms} term(s).`;
  }
  if (result.alphaDiversity || result.betaDiversity) {
    return `Microbiome diversity + ordination computed (${result.sampleCount ?? '?'} samples).`;
  }
  const keys = Object.keys(result).slice(0, 4).join(', ');
  return `Completed (${keys}${Object.keys(result).length > 4 ? ', …' : ''}).`;
}

/** Execute a plan for real, chaining data between steps. Never throws on a tool failure. */
export async function executePlan(steps: PlanStep[]): Promise<ExecutedStep[]> {
  const executed: ExecutedStep[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const input: Record<string, any> = { ...(step.input || {}) };
    if (step.inputFrom) {
      for (const [param, ref] of Object.entries(step.inputFrom)) {
        const source = executed[ref.fromStep]?.observation?.result;
        const value = source ? resolvePath(source, ref.path) : undefined;
        if (value !== undefined) input[param] = value;
      }
    }
    const inv = await invokeTool(step.tool, input);
    executed.push({
      stepIndex: i,
      tool: step.tool,
      thought: step.thought,
      input,
      observation: inv.ok
        ? { ok: true, summary: summarize(step.tool, inv.result), result: inv.result }
        : { ok: false, summary: `Tool '${step.tool}' did not complete.`, error: inv.error },
    });
  }
  return executed;
}

/** Ask Gemini to produce a plan of REAL tool calls constrained to the registry. Requires an ai client. */
export async function planWithGemini(query: string, ai: any): Promise<PlanStep[]> {
  const schemas = toolSchemasForLLM();
  const systemInstruction = `You are the SynOmics planning agent. Produce a concise plan of REAL tool calls to answer the user's request.
You may ONLY use these tools (call them by exact name); do not invent tools or fabricate results — the server executes each call for real:
${JSON.stringify(schemas, null, 2)}

Return STRICT JSON: { "plan": [ { "thought": "...", "tool": "<name>", "input": { ... } } ] }.
Only include a tool if you have the inputs it requires. If the request cannot be served by these tools, return { "plan": [] }.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Request: "${query}"`,
    config: { systemInstruction, responseMimeType: 'application/json', temperature: 0.1 },
  });
  const text = response.text || '{}';
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : { plan: [] };
  }
  const plan: PlanStep[] = Array.isArray(parsed?.plan) ? parsed.plan : [];
  // Drop any hallucinated tool names.
  return plan.filter((s) => s && typeof s.tool === 'string' && getTool(s.tool));
}

/** Ask Gemini to synthesize over the REAL observations. Requires an ai client. */
async function synthesizeWithGemini(query: string, executed: ExecutedStep[], ai: any): Promise<any> {
  const observations = executed.map((s) => ({ tool: s.tool, ok: s.observation.ok, summary: s.observation.summary, result: s.observation.result, error: s.observation.error }));
  const systemInstruction = `You are SynOmics synthesizing results. You are given REAL tool outputs. Base every statement ONLY on these observations; do not invent numbers. If evidence is insufficient, say so.
Return STRICT JSON: { "keyInsights": [..], "biologicalInterpretation": "..", "recommendedNextSteps": [..], "caveats": [..] }.`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Request: "${query}"\nReal tool observations:\n${JSON.stringify(observations)}`,
    config: { systemInstruction, responseMimeType: 'application/json', temperature: 0.2 },
  });
  const text = response.text || '{}';
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : { keyInsights: [], biologicalInterpretation: text };
  }
}

export interface AgentRunInput {
  query?: string;
  plan?: PlanStep[];
  files?: Array<{ filename?: string; name?: string; content?: string; text?: string }>;
  ai?: any;
}

export interface AgentRunResult {
  status: 'success' | 'needs_input';
  query: string;
  planSource: 'explicit' | 'files' | 'gemini';
  toolsExecuted: number;
  steps: ExecutedStep[];
  synthesis: any;
  synthesisSource: 'gemini' | 'deterministic';
  availableTools: string[];
  message?: string;
}

/**
 * Run the agent. Planning may come from an explicit plan, from uploaded files
 * (auto ingestion), or from Gemini. Execution and observation are ALWAYS real.
 * Without a Gemini key, autonomous free-text planning is unavailable — that is
 * reported honestly rather than faked.
 */
export async function runAgent(inputArg: AgentRunInput): Promise<AgentRunResult> {
  const query = inputArg.query || '';
  const availableTools = TOOL_REGISTRY.map((t) => t.name);
  let plan: PlanStep[] = [];
  let planSource: AgentRunResult['planSource'] = 'explicit';

  if (Array.isArray(inputArg.plan) && inputArg.plan.length) {
    plan = inputArg.plan;
    planSource = 'explicit';
  } else if (Array.isArray(inputArg.files) && inputArg.files.length) {
    plan = inputArg.files.map((f) => ({
      thought: `Ingest ${f.filename || f.name || 'uploaded file'} into structured records.`,
      tool: 'ingest_file',
      input: { filename: f.filename || f.name || '', content: f.content ?? f.text ?? '' },
    }));
    planSource = 'files';
  } else if (inputArg.ai) {
    plan = await planWithGemini(query, inputArg.ai);
    planSource = 'gemini';
  } else {
    return {
      status: 'needs_input',
      query,
      planSource: 'explicit',
      toolsExecuted: 0,
      steps: [],
      synthesis: null,
      synthesisSource: 'deterministic',
      availableTools,
      message: 'Autonomous free-text planning requires GEMINI_API_KEY. Provide an explicit `plan` (array of {tool, input}) or upload `files`, and the tools will run for real.',
    };
  }

  if (!plan.length) {
    return {
      status: 'needs_input',
      query,
      planSource,
      toolsExecuted: 0,
      steps: [],
      synthesis: null,
      synthesisSource: 'deterministic',
      availableTools,
      message: 'No applicable tools could be planned for this request from the available real toolset.',
    };
  }

  const steps = await executePlan(plan);
  const succeeded = steps.filter((s) => s.observation.ok).length;

  let synthesis: any;
  let synthesisSource: AgentRunResult['synthesisSource'];
  if (inputArg.ai) {
    try {
      synthesis = await synthesizeWithGemini(query, steps, inputArg.ai);
      synthesisSource = 'gemini';
    } catch (err: any) {
      synthesis = deterministicSynthesis(steps);
      synthesisSource = 'deterministic';
    }
  } else {
    synthesis = deterministicSynthesis(steps);
    synthesisSource = 'deterministic';
  }

  return {
    status: 'success',
    query,
    planSource,
    toolsExecuted: succeeded,
    steps,
    synthesis,
    synthesisSource,
    availableTools,
    ...(synthesisSource === 'deterministic'
      ? { message: 'Results are real tool outputs. Natural-language synthesis requires GEMINI_API_KEY; a factual summary is provided instead.' }
      : {}),
  };
}

/** A factual, no-LLM summary built only from real observations. */
function deterministicSynthesis(steps: ExecutedStep[]) {
  return {
    keyInsights: steps.map((s) => `${s.tool}: ${s.observation.summary}`),
    toolsSucceeded: steps.filter((s) => s.observation.ok).map((s) => s.tool),
    toolsFailed: steps.filter((s) => !s.observation.ok).map((s) => ({ tool: s.tool, error: s.observation.error })),
    note: 'Factual summary of real tool outputs (no language model used).',
  };
}
