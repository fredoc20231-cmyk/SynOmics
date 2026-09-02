/**
 * Deterministic tests for the Module C audit trail. No network.
 * Run: `npx tsx tests/audit_smoke.ts`
 */
import os from 'os';
import path from 'path';
import fs from 'fs';

const TMP = path.join(os.tmpdir(), `synomics_audit_test_${Date.now()}.jsonl`);
process.env.SYNOMICS_AUDIT_LOG = TMP; // must be set before importing the module

let passed = 0;
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`FAIL: ${name}`); process.exit(1); }
  passed++;
  console.log(`ok: ${name}`);
}

async function main() {
  const audit = await import('../server/audit.ts');

  // sha256 is deterministic and correct length.
  const h1 = audit.sha256('hello');
  check('sha256 deterministic', h1 === audit.sha256('hello') && h1.length === 64);

  // summarizeParams keeps small scalars, hashes large/sensitive values.
  const summary = audit.summarizeParams({
    method: 'needleman_wunsch',
    seq_type: 'protein',
    content: 'X'.repeat(5000),           // sensitive/large -> hashed
    counts: { A: [1, 2, 3], B: [4, 5, 6] }, // object -> hashed
    threshold: 5e-8,                      // scalar -> kept
  });
  check('scalar params preserved', summary.method === 'needleman_wunsch' && summary.threshold === 5e-8);
  check('sensitive key hashed not stored', !!summary.content?.sha256 && summary.content.bytes >= 5000 && summary.content.type === 'string' && summary.content.raw === undefined);
  check('object param hashed', !!summary.counts?.sha256 && summary.counts.type === 'object');

  // recordAudit appends and readAudit returns it with a generated id+timestamp.
  const rec = audit.recordAudit({ tool: '/api/synomics/deseq2', method: 'POST', status: 'success', inputSha256: h1, durationMs: 42, params: summary });
  check('recordAudit assigns id + timestamp', !!rec.id && !!rec.timestamp);
  const back = audit.readAudit(10);
  check('readAudit returns the record', back.length >= 1 && back[back.length - 1].id === rec.id);
  check('audit record carries provenance fields', back[back.length - 1].tool === '/api/synomics/deseq2' && back[back.length - 1].status === 'success');

  // Append-only: a second record does not overwrite the first.
  audit.recordAudit({ tool: '/api/synomics/gwas', method: 'POST', status: 'success' });
  const two = audit.readAudit(10);
  check('append-only (both records present)', two.length >= 2 && two[two.length - 1].tool === '/api/synomics/gwas');

  // The on-disk file is valid JSONL (one JSON object per line).
  const lines = fs.readFileSync(TMP, 'utf8').split('\n').filter((l) => l.trim());
  check('valid JSONL on disk', lines.every((l) => { try { JSON.parse(l); return true; } catch { return false; } }));

  fs.unlinkSync(TMP);
  console.log(`\nALL ${passed} AUDIT TESTS PASSED`);
}

main().catch((e) => { console.error(e); process.exit(1); });
