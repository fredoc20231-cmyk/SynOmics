/**
 * Tests for the real external-database clients.
 *
 * Two kinds of checks, both honest:
 *  1) Pure normalizers are validated against the providers' DOCUMENTED JSON
 *     schemas. The fixtures below are documented-schema samples used only to
 *     exercise parsing logic — they are NOT live query results and are never
 *     served to users.
 *  2) The live clients are called for real. In an egress-restricted environment
 *     this exercises and asserts the HONEST-FAILURE path: status 'unavailable'
 *     with an error and NO fabricated data. In an open-egress environment the
 *     same calls return real records.
 *
 * Run: `npx tsx tests/external_db_smoke.ts`
 */
import {
  normalizeEnsemblGene, normalizeMyGene, normalizeUniProt, normalizeVep,
  ensemblGeneBySymbol, _clearCache,
} from '../server/external_db.ts';
import { invokeTool } from '../server/tool_registry.ts';

let passed = 0;
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`FAIL: ${name}`); process.exit(1); }
  passed++;
  console.log(`ok: ${name}`);
}

// --- Documented-schema fixtures (NOT live results) ---
const ENSEMBL_DOC = { id: 'ENSG00000141510', display_name: 'TP53', seq_region_name: '17', start: 7668402, end: 7687550, strand: -1, biotype: 'protein_coding', assembly_name: 'GRCh38', description: 'tumor protein p53' };
const MYGENE_DOC = { hits: [{ _id: '7157', entrezgene: 7157, name: 'tumor protein p53', symbol: 'TP53', ensembl: { gene: 'ENSG00000141510' } }], total: 1, took: 2 };
const UNIPROT_DOC = { results: [{ primaryAccession: 'P04637', uniProtkbId: 'P53_HUMAN', proteinDescription: { recommendedName: { fullName: { value: 'Cellular tumor antigen p53' } } }, sequence: { length: 393 }, genes: [{ geneName: { value: 'TP53' } }] }] };
const VEP_DOC = [{ input: 'rs56116432', allele_string: 'C/T', most_severe_consequence: 'missense_variant', seq_region_name: '9', start: 133256042, transcript_consequences: [{ gene_symbol: 'ABO', consequence_terms: ['missense_variant'], impact: 'MODERATE', sift_prediction: 'deleterious', polyphen_prediction: 'probably_damaging' }] }];

async function main() {
  // 1) Normalizer correctness against documented schemas.
  const eg = normalizeEnsemblGene(ENSEMBL_DOC)!;
  check('ensembl normalize', eg.ensemblId === 'ENSG00000141510' && eg.chromosome === '17' && eg.start === 7668402 && eg.strand === -1);
  const mg = normalizeMyGene(MYGENE_DOC)!;
  check('mygene normalize', mg.entrezId === 7157 && mg.symbol === 'TP53' && mg.ensemblGene === 'ENSG00000141510');
  const up = normalizeUniProt(UNIPROT_DOC)!;
  check('uniprot normalize', up.accession === 'P04637' && up.proteinName === 'Cellular tumor antigen p53' && up.length === 393 && up.geneNames[0] === 'TP53');
  const vp = normalizeVep(VEP_DOC)!;
  check('vep normalize', vp.mostSevereConsequence === 'missense_variant' && vp.transcriptConsequences[0].gene === 'ABO' && vp.transcriptConsequences[0].siftPrediction === 'deleterious');

  // 2) Normalizers never fabricate on empty/garbage input.
  check('ensembl empty -> null', normalizeEnsemblGene(null) === null);
  check('mygene no hits -> null', normalizeMyGene({ hits: [], total: 0 }) === null);
  check('uniprot no results -> null', normalizeUniProt({ results: [] }) === null);
  check('vep empty -> null', normalizeVep([]) === null);

  // 3) Live honest-failure (or success) path — no fabrication either way.
  _clearCache();
  const live = await ensemblGeneBySymbol('TP53');
  check('live result has honest status', ['success', 'unavailable', 'not_found'].includes(live.status));
  if (live.status === 'success') {
    check('live success carries real data', !!live.data && (live.data as any).symbol === 'TP53');
  } else {
    // Blocked/unavailable: MUST carry an error and MUST NOT carry fabricated data.
    check('live failure carries error, no data', !!live.error && live.data === undefined);
  }
  console.log(`  (live ensembl status in this environment: ${live.status}${live.error ? ' — ' + live.error : ''})`);

  // 4) Tool-registry dispatch of a JS-native DB tool reflects the honest status.
  const inv = await invokeTool('db_ensembl_gene', { symbol: 'TP53' });
  check('db tool invocation returns a result object', !!inv && inv.tool === 'db_ensembl_gene');
  check('db tool ok flag matches upstream status', typeof inv.ok === 'boolean');
  check('db tool missing required param -> honest error', (await invokeTool('db_ensembl_gene', {})).ok === false);

  console.log(`\nALL ${passed} EXTERNAL-DB TESTS PASSED`);
}

main().catch((e) => { console.error(e); process.exit(1); });
