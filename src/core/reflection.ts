import { WorldModel, Agenda } from '../types/interfaces';
import { CognitiveItem, SemanticAtom, UUID } from '../types/data';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

// Helper to create a new goal item and its underlying atom
function createSystemGoal(content: any, priority: number): { atom: SemanticAtom, item: CognitiveItem } {
    const contentStr = JSON.stringify(content);
    // Use a UUID for the atom ID for system goals to avoid collisions with content-hashed atoms
    const atomId = uuidv4();

    const atom: SemanticAtom = {
        id: atomId,
        content: content,
        embedding: [], // System goals may not need embeddings
        meta: {
            type: 'Fact', // The goal's content is a fact
            source: 'system_reflection',
            timestamp: new Date().toISOString(),
            author: 'system',
            trust_score: 1.0, // System goals are trusted
            domain: 'system',
            license: 'internal'
        }
    };

    const item: CognitiveItem = {
        id: uuidv4(),
        atom_id: atom.id,
        type: 'GOAL',
        attention: {
            priority: priority,
            durability: 0.9
        },
        stamp: {
            timestamp: Date.now(),
            parent_ids: [], // System goals have no parents
            schema_id: 'system_reflection_rule' as UUID,
        },
        goal_status: 'active',
        label: `System Goal: ${JSON.stringify(content)}`
    };

    return { atom, item };
}


export class ReflectionLoop {
    private timer: NodeJS.Timeout | null = null;
    private running: boolean = false;

    constructor(
        private worldModel: WorldModel,
        private agenda: Agenda,
        private interval: number = 60000, // default to 60 seconds
        private thresholds = {
            memory: 1000000,
            contradiction: 0.05
        }
    ) {}

    public start() {
        if (this.running) return;
        this.running = true;
        console.log(`Reflection loop started. Running every ${this.interval / 1000}s.`);
        this.timer = setInterval(() => this.run_cycle(), this.interval);
    }

    public stop() {
        if (!this.running) return;
        this.running = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        console.log("Reflection loop stopped.");
    }

    private async run_cycle() {
        console.log("ReflectionLoop: Running self-audit cycle.");
        this.check_memory_pressure();
        this.check_contradiction_rate();
        // In a real system, more checks would go here (e.g., unused schemas).
    }

    private check_memory_pressure() {
        const current_size = this.worldModel.size();
        if (current_size > this.thresholds.memory) {
            console.log(`ReflectionLoop: Memory pressure detected (${current_size} atoms). Pushing compaction goal.`);
            const { atom, item } = createSystemGoal(['compact', 'memory'], 0.8);
            this.worldModel.add_atom(atom);
            this.agenda.push(item);
        }
    }

    private check_contradiction_rate() {
        // This is a simplified check. A real one would query for a KPI belief.
        // e.g., world_model.query_by_symbolic({ 'atom.content': ['kpi', 'contradiction_rate', '?'] })
        // For now, we'll just simulate it.
        const simulated_rate = Math.random() * 0.1; // Simulate a rate between 0 and 0.1
        if (simulated_rate > this.thresholds.contradiction) {
            console.log(`ReflectionLoop: High contradiction rate detected (${simulated_rate.toFixed(2)}). Pushing audit goal.`);
            const { atom, item } = createSystemGoal(['run', 'belief_audit'], 0.95);
            this.worldModel.add_atom(atom);
            this.agenda.push(item);
        }
    }
}
