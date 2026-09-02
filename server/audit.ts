import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Module C — deterministic audit trail & provenance.
 *
 * Every analytical request is recorded as one immutable, append-only JSONL line
 * so any result can be reproduced and defended (21 CFR Part 11 / GxP style).
 * We log WHAT ran, WITH which parameters (exact scalars; large/sensitive inputs
 * are stored as a SHA-256 + byte count rather than raw content), the input and
 * output hashes, the outcome status, and timing. No fabricated fields.
 *
 * Storage: append-only JSONL at SYNOMICS_AUDIT_LOG, defaulting to a writable
 * temp path (Cloud Run only permits /tmp). JSONL (one record per line) is used
 * instead of a single JSON array so concurrent appends never corrupt the file.
 */

const AUDIT_PATH = process.env.SYNOMICS_AUDIT_LOG || path.join(os.tmpdir(), 'synomics_audit.jsonl');

// Keys whose values may be large or contain user data: stored as hash + size,
// never raw, so the audit log stays reproducible without copying datasets.
const REDACT_KEYS = new Set([
  'content', 'text', 'rawMatrix', 'cells', 'geneNames', 'cellTypes', 'counts',
  'geneCounts', 'samples', 'otuTable', 'otu_table', 'pdbText', 'summaryStats',
  'summary_stats', 'variants', 'taxa', 'nodes', 'edges', 'code', 'script', 'plan', 'files',
]);

const MAX_INLINE_JSON = 512; // values whose JSON exceeds this are hashed, not stored

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function hashRef(value: unknown) {
  const json = safeJson(value);
  return { sha256: sha256(json), bytes: Buffer.byteLength(json, 'utf8'), type: Array.isArray(value) ? 'array' : typeof value };
}

function safeJson(value: unknown): string {
  try { return JSON.stringify(value) ?? 'null'; } catch { return '"[unserializable]"'; }
}

/** Reproducible parameter summary: exact small scalars kept; big/sensitive → hash+size. */
export function summarizeParams(body: any): Record<string, any> {
  if (!body || typeof body !== 'object') return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(body)) {
    if (REDACT_KEYS.has(k) || (v && typeof v === 'object')) {
      out[k] = hashRef(v);
    } else if (typeof v === 'string' && v.length > MAX_INLINE_JSON) {
      out[k] = hashRef(v);
    } else {
      out[k] = v; // exact scalar (number/bool/short string) preserved for reproducibility
    }
  }
  return out;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  tool: string;              // route path or tool name
  method?: string;
  engineVersion?: string;
  params?: Record<string, any>;
  inputSha256?: string;
  outputSha256?: string;
  status?: string | number;  // outcome status (HTTP code or result.status)
  durationMs?: number;
  sessionId?: string;
}

/** Append one immutable audit record. Never throws into the request path. */
export function recordAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'> & Partial<Pick<AuditEntry, 'id' | 'timestamp'>>): AuditEntry {
  const full: AuditEntry = {
    id: entry.id || crypto.randomUUID(),
    timestamp: entry.timestamp || new Date().toISOString(),
    ...entry,
  };
  try {
    fs.appendFileSync(AUDIT_PATH, JSON.stringify(full) + '\n', 'utf8');
  } catch {
    /* auditing must never break the request; a failed write is swallowed */
  }
  return full;
}

/** Read the most recent audit records (newest last). */
export function readAudit(limit = 100): AuditEntry[] {
  try {
    if (!fs.existsSync(AUDIT_PATH)) return [];
    const lines = fs.readFileSync(AUDIT_PATH, 'utf8').split('\n').filter((l) => l.trim());
    return lines.slice(-limit).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as AuditEntry[];
  } catch {
    return [];
  }
}

export function auditLogPath(): string { return AUDIT_PATH; }

/**
 * Express middleware. Audits mutating requests and external-DB reads (the
 * analytical surface); skips pure discovery/health GETs to keep the log signal
 * high. Records input hash + param summary before, output hash + status after.
 */
export function auditMiddleware(engineVersion?: string) {
  return function (req: any, res: any, next: any) {
    const p: string = req.path || req.url || '';
    // Only audit the analytical API surface.
    if (!p.startsWith('/api/synomics') && !p.startsWith('/api/biomni')) return next();
    // Skip pure discovery/read endpoints so the log stays high-signal.
    if (p.endsWith('/audit-log') || p.endsWith('/health') || p.endsWith('/tools') || p.endsWith('/agent-tools')) return next();
    const isMutating = req.method !== 'GET' && req.method !== 'HEAD';
    const isDbRead = p.includes('/db/');
    if (!isMutating && !isDbRead) return next();

    const start = Date.now();
    const params = summarizeParams(req.body);
    const inputSha256 = sha256(safeJson({ query: req.query, body: req.body ?? null }));

    let captured: any;
    const origJson = res.json.bind(res);
    res.json = (body: any) => { captured = body; return origJson(body); };

    res.on('finish', () => {
      const status = (captured && typeof captured === 'object' && 'status' in captured) ? captured.status : res.statusCode;
      recordAudit({
        tool: p,
        method: req.method,
        engineVersion,
        params,
        inputSha256,
        outputSha256: captured !== undefined ? sha256(safeJson(captured)) : undefined,
        status,
        durationMs: Date.now() - start,
        sessionId: req.headers?.['x-synomics-session'] || undefined,
      });
    });

    next();
  };
}
