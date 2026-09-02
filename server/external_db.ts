/**
 * Real external biomedical database clients.
 *
 * ZERO HALLUCINATION: every function performs a REAL HTTP request to a REAL
 * public API and returns the normalized real response, or an explicit honest
 * error. There is NO fabricated fallback data anywhere in this module — if a
 * host is unreachable (e.g. blocked by an egress policy) the caller receives
 * `status: 'unavailable'` with the upstream status/message, never invented
 * gene coordinates, accessions, or annotations.
 *
 * The normalization helpers are pure and unit-tested against the providers'
 * documented JSON schemas. Live end-to-end verification requires an environment
 * whose egress policy permits these hosts.
 */

export type DbStatus = 'success' | 'not_found' | 'unavailable';

export interface DbResult<T = any> {
  source: string;
  query: Record<string, any>;
  status: DbStatus;
  url: string;
  data?: T;
  error?: string;
  upstreamStatus?: number;
  fetchedAt: string;
}

interface CacheEntry { expires: number; value: DbResult; }
const CACHE = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1h

function cacheGet(key: string): DbResult | undefined {
  const hit = CACHE.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expires) { CACHE.delete(key); return undefined; }
  return hit.value;
}
function cacheSet(key: string, value: DbResult, ttl = DEFAULT_TTL_MS) {
  CACHE.set(key, { expires: Date.now() + ttl, value });
}

interface FetchOutcome { ok: boolean; status: number; json?: any; error?: string; }

async function fetchJson(url: string, timeoutMs = 15000, accept = 'application/json'): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: accept, 'User-Agent': 'SynOmics/AdvancedBioinformaticsPlatform' }, signal: controller.signal });
    const status = res.status;
    let json: any;
    try { json = await res.json(); } catch { json = undefined; }
    if (!res.ok) {
      const msg = (json && (json.error || json.message)) || `HTTP ${status}`;
      return { ok: false, status, error: String(msg) };
    }
    return { ok: true, status, json };
  } catch (err: any) {
    // Network failure / abort / blocked host — honest, no fabrication.
    return { ok: false, status: 0, error: err?.name === 'AbortError' ? `Request timed out after ${timeoutMs}ms` : (err?.message || String(err)) };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Pure normalizers (unit-tested). Each maps a provider's documented JSON to a
// stable, minimal shape. They never invent values — missing fields stay null.
// ---------------------------------------------------------------------------

export function normalizeEnsemblGene(j: any) {
  if (!j || typeof j !== 'object') return null;
  return {
    ensemblId: j.id ?? null,
    symbol: j.display_name ?? null,
    chromosome: j.seq_region_name ?? null,
    start: typeof j.start === 'number' ? j.start : null,
    end: typeof j.end === 'number' ? j.end : null,
    strand: typeof j.strand === 'number' ? j.strand : null,
    biotype: j.biotype ?? null,
    assembly: j.assembly_name ?? null,
    description: j.description ?? null,
  };
}

export function normalizeMyGene(j: any) {
  const hit = j && Array.isArray(j.hits) ? j.hits[0] : undefined;
  if (!hit) return null;
  return {
    entrezId: hit.entrezgene ?? null,
    symbol: hit.symbol ?? null,
    name: hit.name ?? null,
    ensemblGene: hit.ensembl?.gene ?? (Array.isArray(hit.ensembl) ? hit.ensembl[0]?.gene ?? null : null),
    summary: hit.summary ?? null,
    totalHits: typeof j.total === 'number' ? j.total : null,
  };
}

export function normalizeUniProt(j: any) {
  const r = j && Array.isArray(j.results) ? j.results[0] : undefined;
  if (!r) return null;
  return {
    accession: r.primaryAccession ?? null,
    entryId: r.uniProtkbId ?? null,
    proteinName: r.proteinDescription?.recommendedName?.fullName?.value
      ?? r.proteinDescription?.submissionNames?.[0]?.fullName?.value ?? null,
    length: r.sequence?.length ?? null,
    geneNames: Array.isArray(r.genes) ? r.genes.map((g: any) => g.geneName?.value).filter(Boolean) : [],
  };
}

export function normalizeVep(arr: any) {
  const first = Array.isArray(arr) ? arr[0] : undefined;
  if (!first) return null;
  return {
    input: first.input ?? null,
    alleles: first.allele_string ?? null,
    mostSevereConsequence: first.most_severe_consequence ?? null,
    location: (first.seq_region_name != null && first.start != null) ? `${first.seq_region_name}:${first.start}` : null,
    transcriptConsequences: Array.isArray(first.transcript_consequences)
      ? first.transcript_consequences.slice(0, 5).map((tc: any) => ({
          gene: tc.gene_symbol ?? tc.gene_id ?? null,
          consequenceTerms: tc.consequence_terms ?? [],
          impact: tc.impact ?? null,
          siftPrediction: tc.sift_prediction ?? null,
          polyphenPrediction: tc.polyphen_prediction ?? null,
        }))
      : [],
  };
}

// ---------------------------------------------------------------------------
// Real API clients
// ---------------------------------------------------------------------------

function result<T>(source: string, query: Record<string, any>, url: string, outcome: FetchOutcome, normalize: (j: any) => T | null): DbResult<T> {
  const base = { source, query, url, fetchedAt: new Date().toISOString() };
  if (!outcome.ok) {
    // status 0 => network/egress failure (host unreachable); 4xx/5xx => upstream.
    if (outcome.status === 404) return { ...base, status: 'not_found', upstreamStatus: 404, error: 'No record found.' };
    return { ...base, status: 'unavailable', upstreamStatus: outcome.status || undefined, error: outcome.error || 'Upstream request failed.' };
  }
  const data = normalize(outcome.json);
  if (data == null) return { ...base, status: 'not_found', upstreamStatus: outcome.status, error: 'No matching record in response.' };
  return { ...base, status: 'success', upstreamStatus: outcome.status, data };
}

/** Ensembl REST — gene coordinates/biotype by symbol. */
export async function ensemblGeneBySymbol(symbol: string, species = 'homo_sapiens'): Promise<DbResult> {
  const url = `https://rest.ensembl.org/lookup/symbol/${encodeURIComponent(species)}/${encodeURIComponent(symbol)}?content-type=application/json;expand=0`;
  const key = `ensembl:${species}:${symbol}`;
  const cached = cacheGet(key); if (cached) return cached;
  const out = await fetchJson(url);
  const res = result('ensembl', { symbol, species }, url, out, normalizeEnsemblGene);
  if (res.status === 'success') cacheSet(key, res);
  return res;
}

/** MyGene.info — gene annotation (entrez, name, ensembl, summary) by symbol. */
export async function myGeneBySymbol(symbol: string, species = 'human'): Promise<DbResult> {
  const url = `https://mygene.info/v3/query?q=symbol:${encodeURIComponent(symbol)}&species=${encodeURIComponent(species)}&fields=symbol,name,entrezgene,ensembl.gene,summary&size=1`;
  const key = `mygene:${species}:${symbol}`;
  const cached = cacheGet(key); if (cached) return cached;
  const out = await fetchJson(url);
  const res = result('mygene', { symbol, species }, url, out, normalizeMyGene);
  if (res.status === 'success') cacheSet(key, res);
  return res;
}

/** UniProt REST — canonical protein entry by gene symbol + organism. */
export async function uniProtByGene(symbol: string, organismId = 9606): Promise<DbResult> {
  const query = `gene:${symbol} AND organism_id:${organismId}`;
  const url = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(query)}&fields=accession,id,protein_name,length,gene_names&format=json&size=1`;
  const key = `uniprot:${organismId}:${symbol}`;
  const cached = cacheGet(key); if (cached) return cached;
  const out = await fetchJson(url);
  const res = result('uniprot', { symbol, organismId }, url, out, normalizeUniProt);
  if (res.status === 'success') cacheSet(key, res);
  return res;
}

/** Ensembl VEP — variant effect prediction by dbSNP rsID. */
export async function vepByRsId(rsid: string, species = 'human'): Promise<DbResult> {
  const url = `https://rest.ensembl.org/vep/${encodeURIComponent(species)}/id/${encodeURIComponent(rsid)}?content-type=application/json`;
  const key = `vep:${species}:${rsid}`;
  const cached = cacheGet(key); if (cached) return cached;
  const out = await fetchJson(url);
  const res = result('ensembl_vep', { rsid, species }, url, out, normalizeVep);
  if (res.status === 'success') cacheSet(key, res);
  return res;
}

/** For tests: clear the in-memory cache. */
export function _clearCache() { CACHE.clear(); }
