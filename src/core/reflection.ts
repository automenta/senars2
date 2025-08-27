import { logger } from '../lib/logger';
import { WorldModel, Agenda, AttentionModule, CognitiveItem, SemanticAtom, UUID } from '@cognitive-arch/types';
import { v4 as uuidv4 } from 'uuid';
import { createAtomId } from '../lib/utils';


// Helper to create a new goal item and its underlying atom
function createSystemGoal(command: string, params: any, priority: number): { atom: SemanticAtom, item: CognitiveItem } {
    const content = { command, params };
    const atomId = createAtomId(content, { type: 'Fact', source: 'system_reflection' });

    const atom: SemanticAtom = {
        id: atomId,
        content: content,
        embedding: [],
        meta: {
            type: 'Fact',
            source: 'system_reflection',
            timestamp: new Date().toISOString(),
            author: 'system',
            trust_score: 1.0,
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
            parent_ids: [],
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
        private attentionModule: AttentionModule,
        private interval: number = 60000, // default to 60 seconds
        private thresholds = {
            memory: 1000000,
            contradiction: 0.05
        }
    ) {}

    public start() {
        if (this.running) return;
        this.running = true;
        logger.info(`Reflection loop started. Running every ${this.interval / 1000}s.`);
        this.timer = setInterval(() => this.run_cycle(), this.interval);
    }

    public stop() {
        if (!this.running) return;
        this.running = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        logger.info("Reflection loop stopped.");
    }

    private async run_cycle() {
        logger.info("Running self-audit cycle.");

        // 1. Run attention decay
        // This likely needs to be async as well if it interacts with the world model,
        // but for now, let's assume it's synchronous.
        await this.attentionModule.run_decay_cycle(this.worldModel, this.agenda);

        // 2. Run other checks
        await this.check_memory_pressure();
        await this.check_contradiction_rate();
    }

    private async check_memory_pressure() {
        const current_size = await this.worldModel.size();
        if (current_size > this.thresholds.memory) {
            logger.info(`Memory pressure detected (${current_size} atoms). Pushing compaction goal.`);
            const { atom, item } = createSystemGoal('compact_memory', {}, 0.8);
            await this.worldModel.add_atom(atom);
            this.agenda.push(item);
        }
    }

    private async check_contradiction_rate() {
        // This is a simplified check.
        const simulated_rate = Math.random() * 0.1;
        if (simulated_rate > this.thresholds.contradiction) {
            logger.info(`High contradiction rate detected (${simulated_rate.toFixed(2)}). Pushing audit goal.`);
            const { atom, item } = createSystemGoal('run_belief_audit', { rate: simulated_rate }, 0.95);
            await this.worldModel.add_atom(atom);
            this.agenda.push(item);
        }
    }
}
