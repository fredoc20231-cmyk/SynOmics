/**
 * Skills System gate: the registry loads curated workflows and executes them
 * end-to-end against the REAL tool registry, chaining genuine outputs between
 * steps (no fabrication). Run: npx tsx tests/skills_smoke.ts
 */
import { listSkills, runSkill } from '../server/skills_registry.ts';

let passed = 0;
function check(name: string, cond: boolean, ctx?: unknown) {
  if (!cond) { console.error(`FAIL: ${name}`); if (ctx !== undefined) console.error('  ', JSON.stringify(ctx).slice(0, 400)); process.exit(1); }
  passed++; console.log(`ok: ${name}`);
}

(async () => {
  // ---- registry discovery ----
  const skills = listSkills();
  const names = skills.map((s) => s.name);
  check('registry lists rnaseq-de-enrichment', names.includes('rnaseq-de-enrichment'), names);
  check('registry lists orf-to-protein-params', names.includes('orf-to-protein-params'), names);
  check('each skill exposes ordered steps', skills.every((s) => s.steps.length >= 1));

  // ---- skill 1: ORF -> protein params (dot-path chaining) ----
  // A DNA sequence with a clear long ORF: ATG ... TAA.
  const dna = 'CCACCATGGCTAGCAAAGGTGAAGAACTGTTCACCGGCGTTGTTCCGATTCTGGTTGAACTGGATGGCGATGTTAACGGCCATAAATTCTAA';
  const s1 = await runSkill('orf-to-protein-params', { dna, minAA: 5 });
  check('orf-to-protein-params ok', s1.ok, s1);
  check('step trace has 2 steps', (s1 as any).steps.length === 2);
  check('both steps succeeded', (s1 as any).steps.every((t: any) => t.ok));
  const props = (s1 as any).primaryResult;
  check('protein params computed (real MW)', props && typeof props.molecularWeightDa === 'number' && props.molecularWeightDa > 0, props);

  // orf-to-protein-params honest failure when no ORF meets minAA
  const s1b = await runSkill('orf-to-protein-params', { dna: 'AAAAAAAAAAAA', minAA: 50 });
  check('no-ORF case fails honestly at step 2', s1b.ok === false && (s1b as any).failedStep === 'props', s1b);

  // ---- skill 2: RNA-seq DE -> over-representation (transform chaining) ----
  // Small labeled fixture: genes g0..g2 strongly up in treat and placed in PATHWAY_A.
  const conditions = ['c', 'c', 'c', 'c', 't', 't', 't', 't'];
  const counts: Record<string, number[]> = {};
  for (let g = 0; g < 12; g++) {
    const b = 100; const up = g < 3;
    counts['g' + g] = [b, b + 6, b - 5, b + 2, up ? b * 6 : b + 1, up ? b * 6 + 8 : b - 3, up ? b * 6 - 5 : b + 4, up ? b * 6 : b];
  }
  const geneSets = { PATHWAY_A: ['g0', 'g1', 'g2', 'g3'], PATHWAY_B: ['g8', 'g9', 'g10', 'g11'] };
  const s2 = await runSkill('rnaseq-de-enrichment', { counts, conditions, reference: 'c', geneSets, alpha: 0.05 });
  check('rnaseq-de-enrichment ok', s2.ok, (s2 as any).error || s2);
  check('DE step produced results', Array.isArray((s2 as any).results?.de?.results));
  const enr = (s2 as any).primaryResult;
  check('enrichment step ran on real sig-gene list', enr && enr.status === 'success', enr);
  // PATHWAY_A should surface (its genes are the up-regulated ones); enrichment returns rows.
  const rowsText = JSON.stringify(enr);
  check('PATHWAY_A appears in enrichment output', rowsText.includes('PATHWAY_A'), rowsText.slice(0, 300));

  // ---- unknown skill ----
  const s3 = await runSkill('does-not-exist', {});
  check('unknown skill -> honest error', s3.ok === false && !!s3.error);

  console.log(`\nALL ${passed} SKILLS TESTS PASSED`);
})();
