---
title: "Mars Genesis Demo Video: Narration Transcript"
length: "2:30 - 3:00"
target: "YouTube / landing page / agentos.sh blog embed"
companion_post: "/blog/inside-mars-genesis-ai-colony-simulation"
---

# Mars Genesis Demo Video: Narration Transcript

Narration script for a screen-recorded demo of the Paracosm dashboard running a single full Mars Genesis simulation. Paced for roughly 2 minutes 45 seconds of voiceover. Record the full simulation at normal speed, then speed-ramp the middle turns so total video duration comes in at 2:30-3:00 after editing.

Timestamps below assume a normal-speed opening and closing with the middle turns sped up 2-4x. Adjust the exact ramp points to the actual length of your recorded simulation.

---

## Opening: The First Thirty Seconds (0:00 - 0:30)

**[SHOT: dashboard at Turn 0, Mars Genesis scenario loaded, seed visible in top-right badge, 100 colonists spawned in the roster panel]**

**VO:** This is Mars Genesis. One hundred colonists, six turns, fifty simulated years on the same seed. Every person on screen carries a full HEXACO personality profile, a running mood, and a memory system that decides what they remember from every crisis.

**[CUT: zoom into a single colonist card in the roster, show HEXACO bars and department assignment]**

**VO:** This is Dr. Amara Okonkwo. Chief Medical Officer. High Conscientiousness, high Emotionality, moderate Openness. Her traits are going to decide which details she notices, how strongly her memory encodes them, and under pressure, which tools she writes.

---

## Turn Zero: Personality Feeds Promotions (0:30 - 0:45)

**[SHOT: promotion cards appearing, candidate HEXACO profiles visible on hover]**

**VO:** Before turn one, the commander reads the HEXACO profile of every promotion candidate and picks department heads. The agents running this are AgentOS agents with the HEXACO vector wired directly into their memory encoding weights. Same roster, different commander personality, different promotions.

---

## Turn One: The Crisis (0:45 - 1:15)

**[SHOT: advance to Turn 1. Event Director card appears. Dust storm event animates in with risk probability and relevant departments tagged]**

**VO:** Turn one. The Event Director reads world state, aggregate crew mood from the last reaction pass, a research packet of real Mars radiation data, and emits a storm event. Each relevant department kicks off a parallel analysis.

**[CUT: Medical department card animates open. A forge_tool card appears mid-analysis, showing a radiation dose calculator with input schema, sandbox code, and three test cases]**

**VO:** Dr. Okonkwo's first move is not to pick an option. She writes a tool. A radiation dose calculator, with its own input schema, sandboxed JavaScript, and test cases. The LLM judge reviews it for safety and correctness.

**[HIGHLIGHT: forge verdict pill showing "PASS, confidence 0.87"]**

**VO:** Approved. Confidence 0.87. The tool runs inside a V8 isolate, executes against her test cases, returns a projected exposure, and that number lands in the report the commander reads.

---

## Memory, Live (1:15 - 1:45)

**[SPEED RAMP: 3x. Turns 2 and 3 roll by. Agent reactions stream in on the right. Colonist cards pulse as their mood shifts. The memory tab opens on one colonist showing new memories landing with strength scores]**

**VO:** While this runs, every alive colonist reacts to the crisis on a cheap model in parallel. Each reaction feeds the cognitive memory pipeline. HEXACO attention weights decide what gets encoded strongly. Yerkes-Dodson says moderate arousal encodes best. Flashbulb detection fires for anything above intensity 0.8. The storm hits that threshold for half the crew.

**[CUT: memory graph visualization showing edges strengthening between related memories]**

**VO:** The memory graph walks spreading activation across related nodes, so when a colonist recalls the storm later, connected memories come back with it. Unrelated memories decay by an Ebbinghaus curve and get soft-deleted below the threshold.

---

## Tool Reuse and Toolbox (1:45 - 2:00)

**[CUT: toolbox tab visible. Dr. Okonkwo's dose calculator now has a usage counter at 3. Engineering has forged a load analyzer. Agriculture has forged a yield projection tool]**

**VO:** The dose calculator from turn one is still in the session registry. Engineering reuses it during a later power event. After five uses above confidence 0.8, the promotion panel reviews it, and on approval it becomes an agent-tier tool that can be exported as a skill. That is how runtime forging becomes durable capability.

---

## Reports and Colony Visualization (2:00 - 2:20)

**[RETURN TO NORMAL SPEED. Reports tab open, department reports streaming in with inline citations back to the research packet]**

**VO:** Every department report carries citations to the scenario's knowledge bundle. The orchestrator guarantees provenance even when the language model forgets to cite, so the research packet's facts ride along with the report.

**[CUT: Colony Visualization tab, colonists rendered as cells colored by department. Some cells are dimmed where agents died]**

**VO:** The Colony Visualization renders every colonist as a cell. Survival, deaths, department distribution, and timeline divergence are all visible at a glance. This is the state heading into the final turn.

---

## Chat With a Survivor (2:20 - 2:40)

**[CUT: chat panel opens against a specific Mars-born engineer who survived all six turns. User types: "What do you remember about the radiation storm?"]**

**VO:** After the simulation ends, every surviving colonist is chat-ready. Their agent carries the exact HEXACO profile they ended with, every reaction they produced during the run, and the full colony roster. When I ask about the storm, the memory system retrieves the traces most relevant to that query, weighted by her personality and mood at the time.

**[SHOW: assistant reply streaming. Response references specific crew members by name, mentions the dose calculator by name, describes what she felt during the storm]**

**VO:** The reply is grounded in her actual memory. She names the people she worked with, references the dose calculator, and describes the storm through the lens of her traits. No confabulation.

---

## Close (2:40 - 2:50)

**[SHOT: cost StatsBar at the bottom showing total run cost across every director call, department analysis, judge review, and agent reaction]**

**VO:** Every LLM call is accounted for. Paracosm is open source. AgentOS is open source. The Mars Genesis scenario ships as a default. Install, run, watch one hundred agents decide, remember, and build tools they need.

**[FINAL SHOT: paracosm.agentos.sh URL, npm install command, GitHub link]**

**VO:** Paracosm. Built on AgentOS.

---

## Post-Production Notes

### Speed Ramps

Mark the raw recording with these anchor points and speed-ramp between them:

| Anchor | Source timecode (example) | Action |
|--------|--------------------------|--------|
| Simulation start | 0:00 | Normal speed through Turn 0 promotions |
| After Turn 1 forge + outcome | ~2:00 | Ramp to 3x |
| Turn 4 complete | ~5:30 | Ramp back to 1x |
| Chat panel open | ~6:00 | Normal speed to end |

### Captions

Caption every on-screen element the narration references:

- HEXACO bars (name each trait as it is mentioned)
- Department promotion cards (candidate name and score)
- forge_tool verdict pill ("PASS conf 0.87" or "FAIL reason")
- Toolbox tab tool names and usage counters
- Memory graph node labels when the graph overlay is visible
- Chat message timestamps and the colonist's name in the header

### On-Screen Overlays

- Lower-third with colonist name, department, and HEXACO vector whenever a colonist is named.
- Callout boxes pointing at specific UI elements when the narration names them.
- Persistent small badge top-right showing the seed value across the entire run, so viewers see the seed does not change.

### Where to Add Your Own Voice

The narration is written to be spoken in your own voice. Use it verbatim where it reads smoothly, paraphrase where your cadence differs. Places where your own voice lands best:

1. **0:00 - 0:08**: Open the hook in your own words. Punchier is better here.
2. **1:15 - 1:20**: As the speed ramp starts, break in with a one-liner like "while this runs, here is what the memory pipeline is doing every single turn." Signposts the time compression.
3. **2:40 - 2:50**: Closing line in your own words. End on the shortest sentence you are comfortable with.

### Captioning Timestamps

When the recording is finished, note the exact frame timecodes for each beat and send them back. Per-line caption cues styled for YouTube, social clips, and the embedded player on agentos.sh will be generated against those timings.
