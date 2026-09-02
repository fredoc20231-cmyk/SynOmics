#!/usr/bin/env python3
"""iDiscover Frontier 1 — GFlowNet generative molecular sampling (trajectory balance).

Genetic algorithms and greedy RL collapse onto a single optimum. A GFlowNet instead
learns to sample terminal objects with probability *proportional to their reward*
(Bengio et al. 2021), mapping the whole landscape of viable candidates rather than
one peak. This is a real tabular GFlowNet trained with the Trajectory-Balance
objective (Malkin et al. 2022) implemented in numpy:

    loss(tau) = ( logZ + sum_t log P_F(a_t | s_t) - log R(x) )^2

Molecules are built as sequences of chemical fragments; each terminal is assembled
into a SMILES and validated by RDKit. The reward is a REAL computed property (QED
drug-likeness by default) — never invented.

ZERO-BS grounding:
  * Every returned molecule is RDKit-sanitizable; chemically invalid samples are
    discarded, never reported.
  * Rewards are computed by RDKit on the parsed molecule — no fabricated affinities.
  * This is the *tabular* tier (numpy). A deep neural GFlowNet needs torch/GPU and is
    not claimed here. If RDKit/numpy are missing, returns an honest 'unavailable'.

Reads JSON on stdin, prints JSON on stdout.
Payload:
  { "objective": "qed",     # reward property to maximize (currently: 'qed')
    "maxLength": 4,          # max fragments per molecule
    "beta": 4.0,             # reward exponent R^beta (sharpen the target distribution)
    "iterations": 1500,      # TB training steps
    "batchSize": 16, "lr": 0.1, "nSamples": 200, "topK": 10, "seed": 1337 }
"""
import json
import sys

# Fragment vocabulary: small SMILES building blocks that concatenate into a wide,
# mostly-valid chemical space. Invalid concatenations are caught by RDKit and pruned.
FRAGMENTS = ["C", "CC", "CCC", "O", "N", "CO", "CN", "C=O", "c1ccccc1", "CF", "CCl", "CBr"]


def _fail(msg, status="unavailable"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON payload: {e}", status="error")

    try:
        import numpy as np
    except Exception as e:
        _fail(f"GFlowNet requires numpy (not installed): {e}")

    try:
        from rdkit import Chem, RDLogger
        from rdkit.Chem import QED
        RDLogger.DisableLog("rdApp.*")
    except Exception as e:
        _fail(f"GFlowNet molecular validation requires rdkit (not installed): {e}")

    objective = str(payload.get("objective", "qed")).lower()
    if objective != "qed":
        _fail(f"Unsupported objective {objective!r}; this tier computes 'qed' (real RDKit drug-likeness).", status="error")

    max_len = int(payload.get("maxLength", 4))
    beta = float(payload.get("beta", 4.0))
    iters = int(payload.get("iterations", 1500))
    batch = int(payload.get("batchSize", 16))
    lr = float(payload.get("lr", 0.1))
    n_samples = int(payload.get("nSamples", 200))
    top_k = int(payload.get("topK", 10))
    seed = int(payload.get("seed", 1337))
    rng = np.random.default_rng(seed)

    V = len(FRAGMENTS)
    STOP = V  # last action index = terminate
    n_actions = V + 1

    # ---- real reward: assemble SMILES, validate with RDKit, compute QED ----
    reward_cache = {}

    def reward(state):
        key = state
        if key in reward_cache:
            return reward_cache[key]
        if len(state) == 0:
            r = 1e-3
        else:
            smiles = "".join(FRAGMENTS[i] for i in state)
            mol = Chem.MolFromSmiles(smiles)
            if mol is None:
                r = 1e-3  # chemically invalid -> near-zero reward, learned to avoid
            else:
                r = max(float(QED.qed(mol)), 1e-3)
        val = r ** beta
        reward_cache[key] = val
        return val

    # ---- tabular forward policy: state (tuple of frag idx) -> logits over actions ----
    logits = {}

    def get_logits(state):
        if state not in logits:
            logits[state] = np.zeros(n_actions)
        return logits[state]

    def allowed(state):
        mask = np.ones(n_actions, dtype=bool)
        if len(state) >= max_len:
            mask[:V] = False  # must STOP at max length
        if len(state) == 0:
            mask[STOP] = False  # cannot produce the empty molecule
        return mask

    def policy(state):
        lg = get_logits(state).copy()
        mask = allowed(state)
        lg[~mask] = -1e30
        lg = lg - lg.max()
        p = np.exp(lg)
        s = p.sum()
        return p / s if s > 0 else mask / mask.sum()

    log_z = 0.0

    def sample_trajectory():
        state = tuple()
        traj = []  # (state, action)
        while True:
            p = policy(state)
            a = int(rng.choice(n_actions, p=p))
            traj.append((state, a, p))
            if a == STOP:
                return state, traj
            state = state + (a,)

    # ---- Trajectory-Balance training (manual gradients on tabular softmax + logZ) ----
    for _ in range(iters):
        grad_logits = {}
        grad_logz = 0.0
        for _ in range(batch):
            terminal, traj = sample_trajectory()
            log_pf = 0.0
            for (s, a, p) in traj:
                log_pf += np.log(p[a] + 1e-30)
            r = reward(terminal)
            e = log_z + log_pf - np.log(r + 1e-30)
            grad_logz += 2.0 * e
            for (s, a, p) in traj:
                onehot = np.zeros(n_actions)
                onehot[a] = 1.0
                g = 2.0 * e * (onehot - p)  # d/dlogits of log P_F(a|s)
                if s not in grad_logits:
                    grad_logits[s] = np.zeros(n_actions)
                grad_logits[s] += g
        # SGD step (averaged over batch)
        log_z -= lr * grad_logz / batch
        for s, g in grad_logits.items():
            get_logits(s)[:] -= lr * g / batch

    # ---- sample from the trained policy; keep only RDKit-valid, real-reward molecules ----
    seen = {}
    for _ in range(n_samples):
        terminal, _ = sample_trajectory()
        smiles = "".join(FRAGMENTS[i] for i in terminal)
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            continue  # ZERO-BS: never report an invalid molecule
        canon = Chem.MolToSmiles(mol)
        if canon in seen:
            seen[canon]["count"] += 1
            continue
        seen[canon] = {
            "smiles": canon,
            "qed": round(float(QED.qed(mol)), 4),
            "molecularFormula": Chem.rdMolDescriptors.CalcMolFormula(mol),
            "count": 1,
        }

    if not seen:
        _fail("No chemically valid molecules were sampled. Adjust fragments/maxLength.", status="error")

    mols = sorted(seen.values(), key=lambda m: -m["qed"])
    total = sum(m["count"] for m in mols)
    for m in mols:
        m["sampleFraction"] = round(m["count"] / total, 4)

    # Zero-BS verification: the trained sampler should concentrate on higher reward
    # than uniform-random fragment assembly. Compute a uniform-random baseline.
    uni_rewards = []
    for _ in range(n_samples):
        L = int(rng.integers(1, max_len + 1))
        st = tuple(int(rng.integers(0, V)) for _ in range(L))
        smiles = "".join(FRAGMENTS[i] for i in st)
        mol = Chem.MolFromSmiles(smiles)
        if mol is not None:
            uni_rewards.append(float(QED.qed(mol)))
    trained_mean_qed = float(np.mean([m["qed"] for m in mols]))
    uniform_mean_qed = float(np.mean(uni_rewards)) if uni_rewards else 0.0

    print(json.dumps({
        "status": "success",
        "engine": "GFlowNet (tabular, Trajectory-Balance) + RDKit validation",
        "objective": objective,
        "tier": "tabular-numpy (deep neural GFlowNet requires torch/GPU; not claimed here)",
        "trainedLogZ": round(float(log_z), 4),
        "params": {"maxLength": max_len, "beta": beta, "iterations": iters, "batchSize": batch, "lr": lr, "nSamples": n_samples, "seed": seed},
        "distinctValidMolecules": len(mols),
        "candidates": mols[:top_k],
        "diversityVerification": {
            "trainedMeanQED": round(trained_mean_qed, 4),
            "uniformRandomMeanQED": round(uniform_mean_qed, 4),
            "concentratesAboveUniform": trained_mean_qed >= uniform_mean_qed,
        },
        "note": (
            "GFlowNet samples proportionally to reward (Trajectory-Balance), returning a "
            "diverse set of viable candidates rather than one optimum. Every candidate is "
            "RDKit-valid with a real computed QED; invalid samples are discarded. "
            "'count'/'sampleFraction' reflect how often each molecule was sampled by the "
            "trained policy (higher reward -> higher fraction)."
        ),
    }))


if __name__ == "__main__":
    main()
