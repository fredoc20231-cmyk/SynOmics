/**
 * Deterministic, network-free tests for the real agent tool-use loop.
 * Every observation asserted here is a genuine engine output. No LLM key needed.
 * Run: `npx tsx tests/agent_smoke.ts`
 */
import { executePlan, runAgent } from '../server/agent_executor.ts';
import { invokeTool, TOOL_REGISTRY } from '../server/tool_registry.ts';

let passed = 0;
function check(name: string, cond: boolean) {
  if (!cond) {
    console.error(`FAIL: ${name}`);
    process.exit(1);
  }
  passed++;
  console.log(`ok: ${name}`);
}

async function main() {
  // 1. Direct tool invocation runs real computation.
  const align = await invokeTool('align_sequences', {
    seq1: 'MKTAYIAKQR', seq2: 'MKTAYIAKQC', method: 'needleman_wunsch', seq_type: 'protein',
  });
  check('invokeTool align_sequences ok', align.ok === true && Math.abs(align.result.identityPct - 90) < 1e-6);

  // 2. Unknown tool -> honest error, not a crash.
  const bad = await invokeTool('does_not_exist', {});
  check('unknown tool honest error', bad.ok === false && !!bad.error);

  // 3. Missing required param -> honest error.
  const missing = await invokeTool('align_sequences', { seq1: 'MK' });
  check('missing required param honest error', missing.ok === false && /Missing required/.test(missing.error || ''));

  // 4. Real multi-step pipeline with data-flow: ingest a CSV, then run
  //    differential expression on the GENUINELY parsed counts.
  const csv = 'gene,c1,c2,c3,t1,t2,t3\nGENEA,10,11,12,50,52,55\nGENEB,100,98,101,20,22,19\n';
  const steps = await executePlan([
    { tool: 'ingest_file', input: { filename: 'expr.csv', content: csv } },
    {
      tool: 'differential_expression',
      input: { conditions: ['control', 'control', 'control', 'treated', 'treated', 'treated'] },
      inputFrom: { counts: { fromStep: 0, path: 'data.geneCounts' } },
    },
  ]);
  check('pipeline step 0 ingested matrix', steps[0].observation.ok && steps[0].observation.result.detectedFormat === 'matrix');
  const de = steps[1].observation.result?.differentialExpression;
  check('pipeline step 1 ran DE on parsed counts', steps[1].observation.ok && Array.isArray(de) && de.length === 2);
  check('pipeline DE found significant genes', de.some((r: any) => r.isSignificant));

  // 5. runAgent with uploaded files auto-plans real ingestion.
  const runFiles = await runAgent({ query: 'inspect this', files: [{ filename: 'x.fasta', content: '>a\nMKTAYIAKQR\n>b\nMKTAYIAKQC\n' }] });
  check('runAgent(files) executes real ingestion', runFiles.status === 'success' && runFiles.planSource === 'files' && runFiles.toolsExecuted === 1);
  check('runAgent(files) deterministic synthesis without key', runFiles.synthesisSource === 'deterministic');

  // 6. runAgent with no plan / files / key -> honest needs_input, never fabricated.
  const runNone = await runAgent({ query: 'do everything' });
  check('runAgent needs_input honest', runNone.status === 'needs_input' && /GEMINI_API_KEY|explicit/.test(runNone.message || ''));

  // 7. Registry is non-trivial and every tool is executable (engine or handler).
  check('registry populated', TOOL_REGISTRY.length >= 10 && TOOL_REGISTRY.every((t) => !!t.engineCommand || !!t.handler));

  console.log(`\nALL ${passed} AGENT SMOKE TESTS PASSED`);
}

main().catch((e) => { console.error(e); process.exit(1); });
