---
name: Pulse quick readiness recheck
description: Rules for rechecking microphone, speaker, and network without forcing a redundant full Pulse readiness run.
---

A voluntary quick recheck may reuse an existing valid NEXUS Pulse readiness result only after three manual checks pass: local microphone voice detection, speaker playback confirmation, and acceptable network latency.

**Why:** Current device and network conditions can change even while the saved deep readiness result remains valid. The three quick checks provide fresh confidence without repeating every full check.

**How to apply:** Enable the quick path only while readiness is still valid and no full diagnostic run has started. A failed or warning quick check requires the full run. Once that starts, its results are authoritative and quick checks must never bypass it.

The quick latency check should sample for roughly five seconds rather than report a single instant. In a full run, microphone voice detection must be followed immediately by interactive speaker confirmation; only then may network, SIP, and account checks continue.

Microphone and speaker checks use focused modal steps in both quick and full runs. The full run automatically advances from the microphone result to speaker confirmation; the main readiness view shows their final states rather than duplicating the interaction.

Microphone readiness requires a sustained voice-level signal, not one above-threshold frame, because device startup noise can otherwise create a false pass. Speaker confirmation must offer explicit heard and did-not-hear outcomes; a negative answer blocks readiness.