/**
 * SynOmics Skills System — curated, declarative multi-tool workflows.
 *
 * A "skill" is a directory `skills/<name>/` containing:
 *   - skill.json : machine-readable manifest (ordered steps + input bindings)
 *   - SKILL.md   : human-readable curated-workflow documentation
 *
 * runSkill executes the steps in order against the REAL tool registry
 * (`invokeTool`), binding each step's inputs to literals, initial params, or the
 * results of prior steps (dot-path, incl. numeric indices) or a small library of
 * named transforms. It fabricates nothing: every value flowing between steps is a
 * real tool output, and a failing step stops the skill with an honest error.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';

import { invokeTool } from './tool_registry.ts';

export interface SkillStep {
  id: string;
  tool: string;
  inputs: Record<string, any>;
}
export interface SkillSpec {
  name: string;
  title: string;
  description: string;
  params?: Record<string, any>;
  steps: SkillStep[];
  output?: { primary?: string };
}

const SKILLS_DIR = path.join(process.cwd(), 'skills');

export function loadSkills(): SkillSpec[] {
  if (!existsSync(SKILLS_DIR)) return [];
  const out: SkillSpec[] = [];
  for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = path.join(SKILLS_DIR, entry.name, 'skill.json');
    if (!existsSync(manifest)) continue;
    try {
      const spec = JSON.parse(readFileSync(manifest, 'utf8')) as SkillSpec;
      if (spec && spec.name && Array.isArray(spec.steps)) out.push(spec);
    } catch {
      // skip malformed skill manifests rather than crash the registry
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function listSkills() {
  return loadSkills().map((s) => ({
    name: s.name,
    title: s.title,
    description: s.description,
    steps: s.steps.map((st) => ({ id: st.id, tool: st.tool })),
    params: s.params || {},
  }));
}

/** Walk a dot-path (with numeric indices) into a value; undefined if absent. */
function dotPath(obj: any, pathStr: string): any {
  if (!pathStr) return obj;
  let cur = obj;
  for (const key of pathStr.split('.')) {
    if (cur == null) return undefined;
    const idx = /^\d+$/.test(key) ? Number(key) : key;
    cur = cur[idx as any];
  }
  return cur;
}

/** Named transforms over prior step results. Real glue, no fabrication. */
function applyTransform(t: any, results: Record<string, any>): any {
  const stepRes = results[t.step];
  if (stepRes == null) throw new Error(`transform references unknown step '${t.step}'`);
  if (t.type === 'sigGenes') {
    const listPath = t.listPath || (stepRes.results ? 'results' : 'differentialExpression');
    const rows = dotPath(stepRes, listPath);
    if (!Array.isArray(rows)) throw new Error(`sigGenes: '${listPath}' is not a list`);
    const alpha = t.alpha ?? 0.05;
    const pKey = t.pvalueKey || 'padj';
    const geneKey = t.geneKey || 'gene';
    const lfcKey = t.lfcKey || 'log2FoldChangeShrunk';
    const dir = t.direction || 'any';
    return rows
      .filter((r: any) => r[pKey] != null && r[pKey] < alpha)
      .filter((r: any) => dir === 'any' || (dir === 'up' ? (r[lfcKey] || 0) > 0 : (r[lfcKey] || 0) < 0))
      .map((r: any) => r[geneKey]);
  }
  throw new Error(`unknown transform type '${t.type}'`);
}

function resolveInput(binding: any, params: Record<string, any>, results: Record<string, any>): any {
  if (binding == null || typeof binding !== 'object' || Array.isArray(binding)) return binding; // literal
  if ('value' in binding) return binding.value;
  if ('fromParams' in binding) return params[binding.fromParams];
  if ('fromStep' in binding) return dotPath(results[binding.fromStep.step], binding.fromStep.path || '');
  if ('transform' in binding) return applyTransform(binding.transform, results);
  return binding; // plain object literal
}

export async function runSkill(name: string, params: Record<string, any> = {}) {
  const skill = loadSkills().find((s) => s.name === name);
  if (!skill) return { ok: false, error: `Unknown skill '${name}'.`, skill: name };
  const results: Record<string, any> = {};
  const trace: any[] = [];
  for (const step of skill.steps) {
    let inputs: Record<string, any>;
    try {
      inputs = {};
      for (const [k, b] of Object.entries(step.inputs || {})) inputs[k] = resolveInput(b, params, results);
    } catch (err: any) {
      return { ok: false, skill: name, failedStep: step.id, error: `binding error: ${err.message}`, trace };
    }
    const res = await invokeTool(step.tool, inputs);
    trace.push({ id: step.id, tool: step.tool, ok: res.ok, error: res.error });
    if (!res.ok) {
      return { ok: false, skill: name, failedStep: step.id, error: res.error, trace, results };
    }
    results[step.id] = res.result;
  }
  const primary = skill.output?.primary;
  return {
    ok: true,
    skill: name,
    title: skill.title,
    steps: trace,
    results,
    primaryResult: primary ? results[primary] : undefined,
  };
}
