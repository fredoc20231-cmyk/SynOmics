#!/usr/bin/env python3
"""Physical-Digital closed loop — APEX Part 2 (robotic liquid handling).

Generates an Opentrons (apiLevel 2) Python protocol from a liquid-handling plan
AND deterministically verifies physical constraints BEFORE emitting it:
  * every transfer volume within the pipette's [min, max] range (volumes above
    the max are RE-CALCULATED into multiple aspirate/dispense steps, not faked);
  * deck slots unique and within the OT-2's capacity;
  * volumes positive and wells specified.
If a constraint cannot be satisfied by recalculation, the plan is reported
invalid with the exact violations — no invalid protocol is emitted. Pure stdlib.

Reads JSON on stdin, prints JSON.

Payload: { "pipette": {"model","maxVolume","minVolume"},
           "labware": [{"name","slot"}], "transfers": [{"source","dest","volume"}],
           "deckSlots": 11 }
"""
import json
import math
import sys

OT2_MAX_SLOTS = 11


def _fail(msg, status="error"):
    print(json.dumps({"status": status, "error": msg}))
    sys.exit(0)


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _fail(f"Invalid JSON payload: {e}")

    pipette = payload.get("pipette") or {}
    max_v = float(pipette.get("maxVolume", 0) or 0)
    min_v = float(pipette.get("minVolume", 0) or 0)
    model = pipette.get("model", "p300_single_gen2")
    labware = payload.get("labware") or []
    transfers = payload.get("transfers") or []
    deck_slots = int(payload.get("deckSlots", OT2_MAX_SLOTS))

    if max_v <= 0:
        _fail("pipette.maxVolume must be > 0.")
    if not transfers:
        _fail("At least one transfer is required.")

    violations = []

    # --- Deck constraints ---
    slots = [lw.get("slot") for lw in labware]
    if len(slots) != len(set(slots)):
        violations.append("Two labware assigned to the same deck slot.")
    for s in slots:
        if not isinstance(s, int) or s < 1 or s > deck_slots:
            violations.append(f"Labware slot {s!r} outside deck range 1..{deck_slots}.")
    if len(labware) > deck_slots:
        violations.append(f"Required slots {len(labware)} exceed available {deck_slots}.")

    # --- Volume constraints + recalculation (split oversize transfers) ---
    planned_steps = []
    recalculations = []
    for i, t in enumerate(transfers):
        vol = t.get("volume")
        src, dst = t.get("source"), t.get("dest")
        if src is None or dst is None:
            violations.append(f"Transfer {i}: source/dest wells required.")
            continue
        try:
            vol = float(vol)
        except (TypeError, ValueError):
            violations.append(f"Transfer {i}: volume must be numeric.")
            continue
        if vol <= 0:
            violations.append(f"Transfer {i}: volume must be positive.")
            continue
        if vol > max_v:
            # Recalculate: split into ceil(vol/max) near-equal aliquots.
            n_steps = math.ceil(vol / max_v)
            each = round(vol / n_steps, 3)
            if each < min_v and min_v > 0:
                violations.append(f"Transfer {i}: volume {vol}uL cannot be split to respect min {min_v}uL.")
                continue
            recalculations.append({"transfer": i, "requested": vol, "splitInto": n_steps, "eachUl": each})
            for _ in range(n_steps):
                planned_steps.append({"source": src, "dest": dst, "volume": each})
        elif min_v > 0 and vol < min_v:
            violations.append(f"Transfer {i}: volume {vol}uL below pipette minimum {min_v}uL.")
        else:
            planned_steps.append({"source": src, "dest": dst, "volume": round(vol, 3)})

    valid = len(violations) == 0

    result = {
        "status": "success",
        "valid": valid,
        "violations": violations,
        "recalculations": recalculations,
        "plannedSteps": planned_steps,
        "pipette": {"model": model, "minVolume": min_v, "maxVolume": max_v},
        "deckSlotsUsed": len(labware),
        "deckSlotsAvailable": deck_slots,
    }

    if valid:
        # Emit an Opentrons apiLevel-2 protocol with embedded runtime guards.
        lines = [
            "from opentrons import protocol_api",
            "",
            "metadata = {'apiLevel': '2.13', 'protocolName': 'SynOmics generated transfer',",
            "            'description': 'Auto-generated + physically validated by SynOmics.'}",
            "",
            "def run(protocol: protocol_api.ProtocolContext):",
            f"    MAX_VOL = {max_v}",
            "    # Physical guard: no step may exceed the pipette capacity.",
        ]
        for lw in labware:
            lines.append(f"    lw_{lw.get('slot')} = protocol.load_labware('{lw.get('name')}', {lw.get('slot')})")
        lines.append(f"    pipette = protocol.load_instrument('{model}', 'right')")
        for st in planned_steps:
            lines.append(f"    assert {st['volume']} <= MAX_VOL, 'volume exceeds pipette capacity'")
            lines.append(f"    pipette.transfer({st['volume']}, {st['source']!r}, {st['dest']!r})")
        result["protocolPython"] = "\n".join(lines)
        result["note"] = "Protocol is physically valid. Simulate with `opentrons_simulate` before running on hardware."
    else:
        result["note"] = "Plan is physically invalid; no protocol emitted. Fix the violations and retry."

    print(json.dumps(result))


if __name__ == "__main__":
    main()
