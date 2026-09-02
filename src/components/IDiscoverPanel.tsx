import React, { useState } from 'react';
import { Sparkles, GitBranch, Dna, ShieldCheck, Play, AlertTriangle, Loader2, FlaskConical } from 'lucide-react';

/**
 * iDiscover — frontend surface for the four "monumental frontier" engines.
 *
 * Every panel calls a REAL backend route and renders REAL computed output (or an
 * honest error). Nothing here fabricates results. "Load example input" only fills
 * the INPUT fields with a small, user-initiated example so the user can run the
 * real engine; the displayed numbers always come from the server.
 *
 * Palette (CLAUDE.md §2): #FFFFFF canvas, #0A192F structure, #00B4D8 interactive,
 * #F8F9FA panels. Tabular/scientific data uses a monospace face.
 */

type FrontierId = 'cellular_reversion' | 'gflownet' | 'hyper_causal' | 'federated_zkp';

const NAVY = '#0A192F';
const CYAN = '#00B4D8';
const PANEL = '#F8F9FA';

const FRONTIERS: { id: FrontierId; title: string; blurb: string; icon: React.ReactNode }[] = [
  { id: 'cellular_reversion', title: 'Biological Git', blurb: 'Optimal-Transport cellular-state reversion', icon: <GitBranch className="w-4 h-4" /> },
  { id: 'gflownet', title: 'GFlowNet', blurb: 'Reward-proportional generative chemistry', icon: <FlaskConical className="w-4 h-4" /> },
  { id: 'hyper_causal', title: 'Hyper-NOTEARS', blurb: 'Hypergraph (multi-way) causal discovery', icon: <Dna className="w-4 h-4" /> },
  { id: 'federated_zkp', title: 'Federated ZKP', blurb: 'Zero-knowledge federated biomarker discovery', icon: <ShieldCheck className="w-4 h-4" /> },
];

const ROUTES: Record<FrontierId, string> = {
  cellular_reversion: '/api/synomics/idiscover/cellular-reversion',
  gflownet: '/api/synomics/idiscover/gflownet-sample',
  hyper_causal: '/api/synomics/idiscover/hyper-causal-discovery',
  federated_zkp: '/api/synomics/idiscover/federated-zkp',
};

const mono = { fontFamily: "'Fira Code','JetBrains Mono',monospace" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-semibold mb-1" style={{ color: NAVY }}>{label}</span>
      {children}
    </label>
  );
}

function ta(v: string, set: (s: string) => void, rows = 4, ph = '') {
  return (
    <textarea
      value={v}
      onChange={(e) => set(e.target.value)}
      rows={rows}
      placeholder={ph}
      spellCheck={false}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2"
      style={{ ...mono, boxShadow: 'none' }}
    />
  );
}

export const IDiscoverPanel: React.FC = () => {
  const [active, setActive] = useState<FrontierId>('cellular_reversion');

  // per-frontier inputs
  const [crSource, setCrSource] = useState('');
  const [crTarget, setCrTarget] = useState('');
  const [crGenes, setCrGenes] = useState('');

  const [gfIter, setGfIter] = useState('800');
  const [gfSamples, setGfSamples] = useState('200');
  const [gfTopK, setGfTopK] = useState('8');

  const [hcMode, setHcMode] = useState<'discover' | 'verify'>('discover');
  const [hcData, setHcData] = useState('');
  const [hcAdj, setHcAdj] = useState('');
  const [hcVars, setHcVars] = useState('');

  const [fzSites, setFzSites] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const post = async (id: FrontierId, body: any) => {
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await fetch(ROUTES[id], {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data?.status === 'success') setResult(data);
      else setError(data?.error || data?.message || `Engine returned status "${data?.status}".`);
    } catch (e: any) {
      setError(`Request failed: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const parseJson = (s: string, name: string) => {
    try { return JSON.parse(s); } catch { throw new Error(`${name} is not valid JSON.`); }
  };

  const run = () => {
    try {
      if (active === 'cellular_reversion') {
        const body: any = { sourceMatrix: parseJson(crSource, 'Source (diseased) matrix'), targetMatrix: parseJson(crTarget, 'Target (healthy) matrix') };
        if (crGenes.trim()) body.genes = crGenes.split(',').map((g) => g.trim()).filter(Boolean);
        return post('cellular_reversion', body);
      }
      if (active === 'gflownet') {
        return post('gflownet', { objective: 'qed', iterations: Number(gfIter) || 800, nSamples: Number(gfSamples) || 200, topK: Number(gfTopK) || 8 });
      }
      if (active === 'hyper_causal') {
        const body: any = {};
        if (hcVars.trim()) body.variables = hcVars.split(',').map((v) => v.trim()).filter(Boolean);
        if (hcMode === 'discover') body.data = parseJson(hcData, 'Data matrix');
        else body.adjacency = parseJson(hcAdj, 'Adjacency matrix');
        return post('hyper_causal', body);
      }
      if (active === 'federated_zkp') {
        return post('federated_zkp', { sites: parseJson(fzSites, 'Sites'), alpha: 0.01 });
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const loadExample = () => {
    setResult(null); setError(null);
    if (active === 'cellular_reversion') {
      setCrSource('[[5,0,3],[6,0,2],[5,1,3]]');
      setCrTarget('[[0,5,3],[1,6,3],[0,5,2]]');
      setCrGenes('TP53, MYC, ACTB');
    } else if (active === 'hyper_causal') {
      if (hcMode === 'verify') { setHcAdj('[[0,0.8,0],[0,0,0.8],[0.8,0,0]]'); setHcVars('A, B, C'); }
      else { setHcData('[[0.4,1.1,0.44],[-0.7,0.3,-0.21],[1.2,-0.5,-0.6],[0.9,0.8,0.72],[-1.1,-0.2,0.22],[0.1,1.4,0.14],[-0.9,-1.0,0.9],[1.5,0.2,0.3]]'); setHcVars('X, Y, Z'); }
    } else if (active === 'federated_zkp') {
      setFzSites(JSON.stringify([
        { name: 'HospitalA', durations: [5, 8, 2, 9, 3, 11, 4, 7], events: [1, 1, 1, 0, 1, 0, 1, 1], groups: [1, 0, 1, 0, 1, 0, 1, 0] },
        { name: 'HospitalB', durations: [3, 10, 6, 12, 2, 14, 5, 9], events: [1, 0, 1, 0, 1, 0, 1, 1], groups: [1, 0, 1, 0, 1, 0, 1, 0] },
      ], null, 0));
    }
  };

  return (
    <div className="h-full overflow-auto bg-white" style={{ color: NAVY }}>
      {/* Header */}
      <div className="px-6 py-5 border-b" style={{ borderColor: '#E6E9EE' }}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" style={{ color: CYAN }} />
          <h2 className="text-xl font-bold" style={{ color: NAVY }}>iDiscover — Frontier Engines</h2>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Four code-grounded discovery engines. Every result below is computed by a real backend engine — never fabricated.
          Missing or unavailable outputs are shown as honest errors.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-0">
        {/* Frontier selector */}
        <div className="border-r p-3 space-y-2" style={{ borderColor: '#E6E9EE', background: PANEL }}>
          {FRONTIERS.map((f) => {
            const on = active === f.id;
            return (
              <button
                key={f.id}
                onClick={() => { setActive(f.id); setResult(null); setError(null); }}
                className="w-full text-left rounded-lg px-3 py-2.5 transition-colors border"
                style={{
                  background: on ? NAVY : '#FFFFFF',
                  color: on ? '#FFFFFF' : NAVY,
                  borderColor: on ? NAVY : '#E6E9EE',
                }}
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <span style={{ color: on ? CYAN : CYAN }}>{f.icon}</span>{f.title}
                </div>
                <div className="text-xs mt-0.5" style={{ color: on ? '#B7C4D6' : '#64748B' }}>{f.blurb}</div>
              </button>
            );
          })}
        </div>

        {/* Input + result */}
        <div className="p-5">
          {active === 'cellular_reversion' && (
            <div>
              <Field label="Source (diseased) matrix — rows = cells, cols = genes (JSON)">{ta(crSource, setCrSource, 3, '[[5,0,3],[6,0,2]]')}</Field>
              <Field label="Target (healthy) matrix — same gene columns (JSON)">{ta(crTarget, setCrTarget, 3, '[[0,5,3],[1,6,3]]')}</Field>
              <Field label="Gene names (comma-separated, optional)"><input value={crGenes} onChange={(e) => setCrGenes(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" style={mono} placeholder="TP53, MYC, ACTB" /></Field>
            </div>
          )}

          {active === 'gflownet' && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Training iterations"><input value={gfIter} onChange={(e) => setGfIter(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" style={mono} /></Field>
              <Field label="Samples"><input value={gfSamples} onChange={(e) => setGfSamples(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" style={mono} /></Field>
              <Field label="Top-K candidates"><input value={gfTopK} onChange={(e) => setGfTopK(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" style={mono} /></Field>
              <p className="col-span-3 text-xs text-slate-500">Objective: maximize <b>QED</b> (real RDKit drug-likeness). Every returned molecule is RDKit-valid with a real computed reward.</p>
            </div>
          )}

          {active === 'hyper_causal' && (
            <div>
              <div className="flex gap-2 mb-3">
                {(['discover', 'verify'] as const).map((m) => (
                  <button key={m} onClick={() => { setHcMode(m); setResult(null); setError(null); }}
                    className="px-3 py-1 rounded-lg text-xs font-semibold border"
                    style={{ background: hcMode === m ? CYAN : '#FFFFFF', color: hcMode === m ? '#FFFFFF' : NAVY, borderColor: hcMode === m ? CYAN : '#E6E9EE' }}>
                    {m === 'discover' ? 'Discover from data' : 'Verify adjacency (loop check)'}
                  </button>
                ))}
              </div>
              {hcMode === 'discover'
                ? <Field label="Data matrix — rows = samples, cols = nodes (JSON)">{ta(hcData, setHcData, 4, '[[..],[..]]')}</Field>
                : <Field label="Weighted adjacency W[i][j] = edge i→j (JSON)">{ta(hcAdj, setHcAdj, 4, '[[0,0.8,0],[0,0,0.8],[0.8,0,0]]')}</Field>}
              <Field label="Node names (comma-separated, optional)"><input value={hcVars} onChange={(e) => setHcVars(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" style={mono} placeholder="X, Y, Z" /></Field>
            </div>
          )}

          {active === 'federated_zkp' && (
            <div>
              <Field label="Sites — [{ name, durations[], events[0/1], groups[0/1] }, …] (JSON)">{ta(fzSites, setFzSites, 6, '[{"name":"SiteA","durations":[..],"events":[..],"groups":[..]}]')}</Field>
              <p className="text-xs text-slate-500">Raw patient rows never leave a site; only additive (O-E, V) statistics are shared, secured by Pedersen commitments + Schnorr zero-knowledge proofs.</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            <button onClick={run} disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: CYAN }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run engine
            </button>
            {(active === 'cellular_reversion' || active === 'hyper_causal' || active === 'federated_zkp') && (
              <button onClick={loadExample} className="px-3 py-2 rounded-lg text-xs font-medium border" style={{ borderColor: '#E6E9EE', color: NAVY }}>
                Load example input
              </button>
            )}
          </div>

          {/* Result / error */}
          <div className="mt-5">
            {error && (
              <div className="rounded-lg border p-3 flex items-start gap-2" style={{ borderColor: '#FCA5A5', background: '#FEF2F2' }}>
                <AlertTriangle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
            {result && <ResultView id={active} data={result} />}
            {!result && !error && !loading && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-400" style={{ borderColor: '#E6E9EE' }}>
                No results yet — provide input and run the engine. Results are computed live by the backend.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: '#E6E9EE', background: PANEL }}>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-bold" style={{ ...mono, color: NAVY }}>{value}</div>
    </div>
  );
}

const ResultView: React.FC<{ id: FrontierId; data: any }> = ({ id, data }) => {
  return (
    <div className="space-y-4">
      {id === 'cellular_reversion' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Wasserstein distance" value={data.wassersteinDistance} />
            <Stat label="Solver" value={<span className="text-xs">{data.approximate ? 'Sinkhorn (approx)' : 'exact EMD'}</span>} />
            <Stat label="Source cells" value={data.sourceCells} />
            <Stat label="Target cells" value={data.targetCells} />
          </div>
          <table className="w-full text-xs border-collapse" style={mono}>
            <thead><tr style={{ background: NAVY, color: '#fff' }}><th className="text-left px-2 py-1">#</th><th className="text-left px-2 py-1">Gene</th><th className="text-left px-2 py-1">Direction</th><th className="text-right px-2 py-1">Mean shift</th></tr></thead>
            <tbody>{(data.revertCommits || []).map((c: any) => (
              <tr key={c.rank} className="border-b" style={{ borderColor: '#E6E9EE' }}><td className="px-2 py-1">{c.rank}</td><td className="px-2 py-1 font-semibold">{c.gene}</td><td className="px-2 py-1" style={{ color: c.direction === 'UP' ? '#0E7490' : '#B91C1C' }}>{c.direction}</td><td className="px-2 py-1 text-right">{c.meanShift}</td></tr>
            ))}</tbody>
          </table>
        </>
      )}

      {id === 'gflownet' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Distinct valid molecules" value={data.distinctValidMolecules} />
            <Stat label="Trained mean QED" value={data.diversityVerification?.trainedMeanQED} />
            <Stat label="Uniform mean QED" value={data.diversityVerification?.uniformRandomMeanQED} />
            <Stat label="Beats uniform" value={data.diversityVerification?.concentratesAboveUniform ? 'yes' : 'no'} />
          </div>
          <table className="w-full text-xs border-collapse" style={mono}>
            <thead><tr style={{ background: NAVY, color: '#fff' }}><th className="text-left px-2 py-1">SMILES</th><th className="text-left px-2 py-1">Formula</th><th className="text-right px-2 py-1">QED</th><th className="text-right px-2 py-1">Sampled</th></tr></thead>
            <tbody>{(data.candidates || []).map((c: any, i: number) => (
              <tr key={i} className="border-b" style={{ borderColor: '#E6E9EE' }}><td className="px-2 py-1">{c.smiles}</td><td className="px-2 py-1">{c.molecularFormula}</td><td className="px-2 py-1 text-right">{c.qed}</td><td className="px-2 py-1 text-right">{c.sampleFraction}</td></tr>
            ))}</tbody>
          </table>
        </>
      )}

      {id === 'hyper_causal' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="Mode" value={<span className="text-sm">{data.mode}</span>} />
            <Stat label="Acyclicity residual h" value={data.acyclicityResidual} />
            <Stat label="Certified DAG" value={(data.acyclicityResidual <= data.epsilon) ? 'yes' : 'no'} />
          </div>
          {data.causalOrder && <div className="text-xs" style={mono}><b>Causal order:</b> {data.causalOrder.join(' → ')}</div>}
          {data.hyperedges && (
            <table className="w-full text-xs border-collapse" style={mono}>
              <thead><tr style={{ background: NAVY, color: '#fff' }}><th className="text-left px-2 py-1">Hyperedge (joint cause)</th><th className="text-right px-2 py-1">Strength</th></tr></thead>
              <tbody>{data.hyperedges.map((h: any, i: number) => (
                <tr key={i} className="border-b" style={{ borderColor: '#E6E9EE' }}><td className="px-2 py-1">{h.relation}</td><td className="px-2 py-1 text-right">{h.strength}</td></tr>
              ))}</tbody>
            </table>
          )}
          {data.edges && <div className="text-xs text-slate-600">Verified acyclic graph with {data.edges.length} edge(s).</div>}
        </>
      )}

      {id === 'federated_zkp' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Log-rank Z" value={data.logRankZ} />
            <Stat label="p-value" value={typeof data.pValue === 'number' ? data.pValue.toExponential(2) : data.pValue} />
            <Stat label="Cryptographically verified" value={data.verified ? 'yes' : 'no'} />
            <Stat label="Significant (α=0.01)" value={data.biomarkerSignificant ? 'yes' : 'no'} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded" style={{ background: data.crypto?.allZkProofsValid ? '#ECFEFF' : '#FEF2F2', color: NAVY }}>ZK proofs valid: {String(data.crypto?.allZkProofsValid)}</span>
            <span className="px-2 py-1 rounded" style={{ background: data.crypto?.homomorphicAggregateVerified ? '#ECFEFF' : '#FEF2F2', color: NAVY }}>Homomorphic aggregate verified: {String(data.crypto?.homomorphicAggregateVerified)}</span>
          </div>
          <table className="w-full text-xs border-collapse" style={mono}>
            <thead><tr style={{ background: NAVY, color: '#fff' }}><th className="text-left px-2 py-1">Site</th><th className="text-right px-2 py-1">Patients</th><th className="text-right px-2 py-1">O-E</th><th className="text-right px-2 py-1">Variance</th><th className="text-left px-2 py-1">ZK ✓</th></tr></thead>
            <tbody>{(data.sites || []).map((s: any, i: number) => (
              <tr key={i} className="border-b" style={{ borderColor: '#E6E9EE' }}><td className="px-2 py-1">{s.site}</td><td className="px-2 py-1 text-right">{s.nPatients}</td><td className="px-2 py-1 text-right">{s.observedMinusExpected}</td><td className="px-2 py-1 text-right">{s.variance}</td><td className="px-2 py-1">{s.zkProofValid ? '✓' : '✗'}</td></tr>
            ))}</tbody>
          </table>
        </>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-slate-500">Raw engine response (JSON)</summary>
        <pre className="mt-2 p-3 rounded-lg overflow-auto" style={{ ...mono, background: PANEL, color: NAVY }}>{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
};
