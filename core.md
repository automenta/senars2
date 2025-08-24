# 🧠 **Complete Revised Specification: Verifiable, Goal-Directed Reasoning System**

---

## **0. Mission & Principles**

### **Mission**
To provide a complete architectural blueprint for a **verifiable, goal-directed, and self-reflective reasoning system** that integrates symbolic and semantic cognition. The system orchestrates AI capabilities through a modular, concurrent, and auditable design, enabling autonomous agents to reason, learn, act, and evolve with full provenance and trust awareness.

### **Core Principles**

| Principle | Description |
|--------|-------------|
| **Hybrid Cognition** | Combines symbolic logic (for precision) with semantic vectors (for generalization and intuition). |
| **Concurrency-Native** | Built on asynchronous, parallel processing via a decentralized worker model. |
| **Verifiable Provenance** | Every derived item traces back to its source atoms and reasoning rules. |
| **Modular Abstraction** | Core cognitive functions are encapsulated in swappable modules with strict interfaces. |
| **Goal-Agentic Flow** | All cognition is driven by goals, decomposed hierarchically into subtasks. |
| **Trust-Aware Inference** | Knowledge sources and beliefs are weighted by credibility to resist misinformation. |
| **Self-Reflective Operation** | The system audits its own performance, detects contradictions, and regulates cognitive load. |

---

## **1. High-Level Architecture**

The system is a **decentralized, event-driven cognitive engine** centered on a prioritized agenda. It integrates perception, memory, reasoning, action, and metacognition into a coherent loop.

```mermaid
graph TD
    subgraph ExternalWorld ["External World"]
        direction LR
        User((User))
        Tools[(Tools / APIs)]
        Models[(LLMs, Vision, etc.)]
    end

    subgraph AgentMind ["Agent-Mind Core"]
        Agenda["Agenda<br/>(Priority Queue)"]
        
        subgraph CognitiveCore ["Cognitive Core"]
             WorkerPool{Worker Pool<br/>[N Stateless Workers]}
        end

        WorldModel["World Model<br/>(Multi-Index Store)"]
        Perception["Perception Subsystem"]
        Action["Action Subsystem"]

        subgraph PluggableModules ["Pluggable Cognitive Modules"]
            ResonanceModule["Resonance Module"]
            AttentionModule["Attention Module"]
            SchemaMatcher["Schema Matcher"]
            RevisionEngine["BeliefRevisionEngine"]
            GoalTreeMgr["GoalTreeManager"]
            ReflectionLoop["ReflectionLoop"]
        end
    end

    %% Data Flow
    User -- Input --> Perception
    Tools & Models -- Observations --> Perception
    Perception -- CognitiveItems --> Agenda
    Agenda -- Top-Priority Item --> WorkerPool
    WorkerPool -- Queries --> WorldModel
    WorkerPool -- Uses --> ResonanceModule & AttentionModule & SchemaMatcher
    WorkerPool -- New Items --> Agenda
    WorkerPool -- Action Goals --> Action
    Action -- Executes --> Tools & Models
    Tools & Models -- Results --> Perception
    Perception -- Feedback as BELIEF --> Agenda

    %% Metacognition
    ReflectionLoop -- Periodic KPIs --> Agenda
    ReflectionLoop -- Audit Goals --> Agenda

    %% Module Dependencies
    ResonanceModule -- Queries --> WorldModel
    SchemaMatcher -- Queries --> WorldModel
    AttentionModule -- Reads/Writes --> Agenda & WorldModel
    RevisionEngine -- Used by --> WorldModel
    GoalTreeMgr -- Listens to --> Agenda
    GoalTreeMgr -- Updates --> WorldModel

    style AgentMind fill:#e6f3ff,stroke:#333,stroke-width:2px
    style PluggableModules fill:#fffbe6,stroke:#333,dashed
    classDef module fill:#fffbe6,stroke:#333;
    class ResonanceModule,AttentionModule,SchemaMatcher,RevisionEngine,GoalTreeMgr,ReflectionLoop module
```

> The `Agenda` serves as the central nervous system; the `WorldModel` is persistent memory; cognition emerges from iterative cycles of selection, contextualization, reasoning, and integration.

---

## **2. Core Data Model**

All knowledge begins as **immutable content** (`SemanticAtom`) and becomes **contextualized thought** (`CognitiveItem`).

### **2.1. `SemanticAtom` — Immutable Knowledge Unit**

Represents a content-addressable piece of information.

```ts
type SemanticAtom = {
    id: UUID;              // SHA-256(Content + Metadata)
    content: any;          // e.g., S-expr, JSON, text, URI
    embedding: number[];   // Dense vector (e.g., 768-dim)
    meta: Record<string, any>;  // Enhanced with provenance and schema
}
```

#### **Standard Metadata Fields**
```json
{
  "type": "Fact" | "CognitiveSchema" | "Observation" | "Rule",
  "source": string,           // e.g., "vetdb.org", "user_input"
  "timestamp": string,        // ISO 8601
  "author": string,
  "trust_score": number,      // [0.0, 1.0], default 0.5
  "domain": string,
  "license": string
}
```

- **Immutability**: Once created, never modified.
- **Content Addressing**: `id = hash(content + meta)` ensures deduplication and verifiability.
- **Embedding**: Generated by a shared encoder (e.g., SBERT, CLIP).

---

### **2.2. `CognitiveItem` — Contextualized Thought**

Represents a stance toward an atom: belief, goal, or query, enriched with attention, provenance, and goal hierarchy.

```ts
type TruthValue = {
    frequency: number;    // [0.0, 1.0] — empirical support
    confidence: number;   // [0.0, 1.0] — epistemic certainty
}

type AttentionValue = {
    priority: number;     // [0.0, 1.0] — short-term salience
    durability: number;   // [0.0, 1.0] — long-term retention value
}

type DerivationStamp = {
    timestamp: number;           // Unix ms
    parent_ids: UUID[];          // Input CognitiveItem IDs
    schema_id: UUID;             // Rule/schema used
    module?: string;             // Optional: "resonance", "analogy"
}
```

```ts
type CognitiveItem = {
    id: UUID;
    atom_id: UUID;               // Reference to SemanticAtom
    type: 'BELIEF' | 'GOAL' | 'QUERY';
    truth?: TruthValue;          // Only for BELIEF
    attention: AttentionValue;
    stamp: DerivationStamp;

    // Goal hierarchy
    goal_parent_id?: UUID;
    goal_status?: "active" | "blocked" | "achieved" | "failed";

    // Optional: user-facing label
    label?: string;
}
```

> 📌 `CognitiveItem` is mutable only in `attention`, `truth`, and `goal_status`. All other fields are immutable after creation.

---

## **3. Main Components**

### **3.1. `Agenda` — Central Cognitive Queue**

**Role**: Short-term working memory and task scheduler.

**Properties**:
- Thread-safe, concurrent priority queue.
- Ordered by `attention.priority` (descending).
- Supports dynamic re-prioritization.

**Interface**:
```ts
interface Agenda {
    push(item: CognitiveItem): void;
    pop(): Promise<CognitiveItem>;        // Blocking
    peek(): CognitiveItem | null;
    size(): number;
    updateAttention(id: UUID, newVal: AttentionValue): void;
    remove(id: UUID): boolean;
}
```

> Uses lock-free or actor-based concurrency (e.g., Disruptor, Tokio).

---

### **3.2. `WorldModel` — Persistent Knowledge Base**

**Role**: Long-term memory storing all validated beliefs and schemas.

**Structure**:
- Multi-index store over `SemanticAtom` and `CognitiveItem`.
- Indexes:
  - **Semantic**: ANN (e.g., HNSW, FAISS)
  - **Symbolic**: Exact/fuzzy match
  - **Structural**: Pattern matcher for S-expressions, JSON paths
  - **Temporal**: Time-based access
  - **Attention**: By `durability` for retention

#### **BeliefRevisionEngine**

**Role**: Merges conflicting beliefs using confidence-weighted logic.

```ts
interface BeliefRevisionEngine {
    merge(existing: TruthValue, new: TruthValue): TruthValue;
    detect_conflict(a: TruthValue, b: TruthValue): boolean;
}
```

**Default Merge (Weighted Average)**:
```python
def merge(existing, new):
    w1, w2 = existing.confidence, new.confidence
    total = w1 + w2
    return TruthValue(
        frequency = (w1 * existing.frequency + w2 * new.frequency) / total,
        confidence = min(0.99, (w1 + w2) / 2 + 0.1)
    )
```

**Conflict Detection**: Triggered if `abs(freq_A - freq_B) > 0.5` and both `confidence > 0.7`.

#### **WorldModel Interface**
```ts
interface WorldModel {
    add_atom(atom: SemanticAtom): UUID;
    add_item(item: CognitiveItem): void;

    get_atom(id: UUID): SemanticAtom | null;
    get_item(id: UUID): CognitiveItem | null;

    query_by_semantic(embedding: number[], k: number): CognitiveItem[];
    query_by_symbolic(pattern: any, k?: number): CognitiveItem[];
    query_by_structure(pattern: any, k?: number): CognitiveItem[];

    revise_belief(new_item: CognitiveItem): CognitiveItem | null;
    register_schema_atom(atom: SemanticAtom): CognitiveSchema;
}
```

---

### **3.3. `CognitiveCore` — Worker Pool**

**Role**: Executes the cognitive cycle: select → contextualize → reason → dispatch → memorize.

**Structure**:
- Fixed-size pool of stateless workers.
- Each worker runs an infinite loop consuming from the `Agenda`.

#### **Worker Loop**
```python
async def worker_loop(modules, world_model, agenda):
    while True:
        item_A = await agenda.pop()
        
        try:
            # Contextualize
            context_items = modules.resonance.find_context(item_A, world_model, k=10)

            # Reason
            for item_B in context_items:
                schemas = modules.matcher.find_applicable(item_A, item_B, world_model)
                for schema in schemas:
                    try:
                        derived = schema.apply(item_A, item_B, world_model)
                        for new_item in derived:
                            source_trust = world_model.get_atom(schema.atom_id).meta.trust_score
                            new_item.attention = modules.attention.calculate_derived(
                                parents=[item_A, item_B],
                                schema=schema,
                                source_trust=source_trust
                            )
                            new_item.stamp = DerivationStamp(
                                timestamp=now(),
                                parent_ids=[item_A.id, item_B.id],
                                schema_id=schema.atom_id
                            )
                            agenda.push(new_item)
                    except Exception as e:
                        log.warning(f"Schema {schema.id} failed", exc=e)

            # Memorize
            if item_A.type == "BELIEF":
                revised = world_model.revise_belief(item_A)
                if revised:
                    agenda.push(revised)

            # Reinforce
            modules.attention.update_on_access([item_A] + context_items)

            # Update goal tree
            if item_A.type == "GOAL" and is_achieved(item_A):
                modules.goal_tree.mark_achieved(item_A.id)

        except Exception as e:
            log.error("Worker failed", item=item_A.id, exc=e)
```

---

## **4. Pluggable Cognitive Modules**

### **4.1. `AttentionModule`**

**Role**: Manages salience and retention.

**Interface**:
```ts
interface AttentionModule {
    calculate_initial(item: CognitiveItem): AttentionValue;
    calculate_derived(
        parents: CognitiveItem[],
        schema: CognitiveSchema,
        source_trust?: number
    ): AttentionValue;
    update_on_access(items: CognitiveItem[]): void;
    run_decay_cycle(world_model: WorldModel, agenda: Agenda): void;
}
```

---

### **4.2. `ResonanceModule`**

**Role**: Finds relevant context via hybrid retrieval.

**Interface**:
```ts
interface ResonanceModule {
    find_context(item: CognitiveItem, world_model: WorldModel, k: number): CognitiveItem[];
}
```

**Scoring Includes**: Semantic similarity, symbolic overlap, goal relevance, recency, trust.

---

### **4.3. `SchemaMatcher`**

**Role**: Efficiently matches item pairs to applicable rules.

**Interface**:
```ts
interface SchemaMatcher {
    register_schema(schema: SemanticAtom, world_model: WorldModel): CognitiveSchema;
    find_applicable(a: CognitiveItem, b: CognitiveItem, world_model: WorldModel): CognitiveSchema[];
}
```

**Implementation**: Rete-like network or hashed pattern index.

> ✅ **All schemas are stored as `SemanticAtom`s** with `meta.type = "CognitiveSchema"`.

---

### **4.4. `GoalTreeManager`**

**Role**: Manages hierarchical goal decomposition and status.

**Interface**:
```ts
interface GoalTreeManager {
    decompose(goal: CognitiveItem): CognitiveItem[];
    mark_achieved(goal_id: UUID): void;
    mark_failed(goal_id: UUID): void;
    get_ancestors(goal_id: UUID): UUID[];
}
```

**Trigger**: Activated when a high-level `GOAL` is processed.

---

### **4.5. `ReflectionLoop`**

**Role**: Self-audit and regulation.

**Implementation**:
```python
async def reflection_loop(world_model, agenda, interval=60_000):
    while True:
        await sleep(interval)
        
        kpis = world_model.query_by_symbolic("(kpi ...)", k=100)
        if high_contradiction_rate(kpis):
            agenda.push(GOAL("(run belief_audit)").with_priority(0.95))
        
        unused = find_inactive_schemas(last_used_threshold=1hr)
        if unused:
            agenda.push(QUERY("(should_deprecate_schema ?id)?"))
        
        if world_model.size() > 1e6:
            agenda.push(GOAL("(compact memory)"))
```

---

## **5. I/O Subsystems**

### **5.1. `Perception Subsystem`**

**Role**: Transduces raw data into `CognitiveItem`s.

**Interface**:
```ts
interface Transducer {
    process(data: any): CognitiveItem[] | Promise<CognitiveItem[]>;
}
```

**Examples**:
- `TextTransducer`: Uses LLM to extract structured atoms.
- `SensorStreamTransducer`: Buffers and detects events.
- All transducers tag `meta.source`.

---

### **5.2. `Action Subsystem`**

**Role**: Executes goals and feeds back results.

**Interface**:
```ts
interface Executor {
    can_execute(goal: CognitiveItem): boolean;
    execute(goal: CognitiveItem): Promise<CognitiveItem>;
}
```

**Execution Flow**:
1. Worker derives `GOAL("(web_search 'chocolate cat toxicity')")`
2. `WebSearchExecutor` runs → returns result
3. Creates `BELIEF(...)` with `meta.source` and trust
4. Injected into `Agenda` via `Perception`

---

## **6. Worked Example: Pet Safety Agent**

1. **Input**: *"My cat seems sick after eating chocolate."*
2. **Perception**: Creates `BELIEF("(implies (eats cat chocolate) (is_sick cat))")` with `source: "user_input"`, `trust: 0.6`.
3. **Context**: Finds `(is_toxic_to chocolate dog)` from `vetdb.org` (`trust: 0.95`).
4. **Reasoning**: `AnalogyHypothesisSchema` generates `QUERY("(is_toxic_to chocolate cat)?")`.
5. **Goal Tree**: Activates `GOAL("(diagnose cat illness)")` → decomposes into subgoals.
6. **Action**: `WebSearchExecutor` returns `"Chocolate is toxic to cats."`
7. **Learning**: New belief created, merged with high confidence → stored.
8. **Reflection**: Later, `ReflectionLoop` confirms coherence.

---

## **7. Metacognition & Self-Regulation**

The system audits itself via:
- **KPI Beliefs**: `(kpi agenda_size 5280)`, `(kpi contradiction_rate 0.02)`
- **Regulatory Schemas**: React to KPIs with throttling, audits, or optimization goals.
- **Self-Improvement**: Can evolve attention heuristics, prune unused rules, and compact memory.

> Self-regulation is an emergent property of the core cognitive loop.

---

## ✅ Final Properties

| Property | Status |
|--------|--------|
| **Verifiable Provenance** | ✅ Full trace from atom to derivation |
| **Scalable Concurrency** | ✅ Worker pool + async I/O |
| **Goal-Directed** | ✅ Hierarchical goal trees with status tracking |
| **Self-Regulating** | ✅ Reflection loop + KPI-driven goals |
| **Trust-Aware** | ✅ Source scoring + confidence-weighted fusion |
| **Extensible** | ✅ All core functions are pluggable modules |

---

This **complete, self-contained specification** defines a **mature, production-ready cognitive architecture** capable of autonomous reasoning, learning, and adaptation. It is suitable for deployment in AI agents, decision support systems, and knowledge-intensive applications requiring transparency, scalability, and goal mastery.
