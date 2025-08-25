import { EventEmitter } from 'events';
import { Agenda } from '../agenda.js';
import { WorldModel } from '../world-model.js';
import { AttentionModule } from './attention.js';
import { CognitiveItem, newCognitiveItemId, SemanticAtomMetadata, UUID } from '../types.js';

export interface ReflectionData {
    kpis: {
        activeGoals: number;
        memoryUtilization: number; // as a percentage
        contradictionRate: number; // as a percentage
    };
    recommendations: {
        id: string;
        title: string;
        description: string;
        action: string;
    }[];
    insights: string[];
}

export interface ReflectionModule extends EventEmitter {
  start(): void;
  stop(): void;
  getReflectionData(): ReflectionData;
}

export class ReflectionModuleImpl extends EventEmitter implements ReflectionModule {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly interval: number; // in milliseconds
  private agenda: Agenda;
  private worldModel: WorldModel;
  private attentionModule: AttentionModule;
  private lastReflectionData: ReflectionData;

  constructor(agenda: Agenda, worldModel: WorldModel, attentionModule: AttentionModule, interval: number = 60000) {
    super();
    this.agenda = agenda;
    this.worldModel = worldModel;
    this.attentionModule = attentionModule;
    this.interval = interval;
    this.lastReflectionData = {
        kpis: { activeGoals: 0, memoryUtilization: 0, contradictionRate: 0 },
        recommendations: [],
        insights: [],
    };
  }

  getReflectionData(): ReflectionData {
      return this.lastReflectionData;
  }

  start(): void {
    if (this.intervalId) {
      console.warn('ReflectionModule is already running.');
      return;
    }
    console.log('Starting ReflectionModule...');
    this.intervalId = setInterval(() => this.run_reflection_cycle(), this.interval);
  }

  stop(): void {
    if (this.intervalId) {
      console.log('Stopping ReflectionModule...');
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async run_reflection_cycle(): Promise<void> {
    console.log('Running reflection cycle...');

    // Example 1: Check World Model size and suggest compaction
    const atomCount = this.worldModel.get_all_atoms().length;
    if (atomCount > 1000) { // Threshold for compaction
      console.log(`World Model size (${atomCount} atoms) exceeds threshold. Suggesting memory compaction.`);
      const compactGoalAtom = this.worldModel.find_or_create_atom(
        '(compact memory)',
        { type: 'Fact', source: 'system_reflection', trust_score: 1.0 }
      );
      const compactGoal: CognitiveItem = {
        id: newCognitiveItemId(),
        atom_id: compactGoalAtom.id,
        type: 'GOAL',
        attention: this.attentionModule.calculate_initial({
          type: 'GOAL',
          truth: undefined,
          stamp: {
            timestamp: Date.now(),
            parent_ids: [],
            schema_id: 'reflection-schema' as UUID,
            module: 'ReflectionModule',
          },
        }),
        stamp: {
          timestamp: Date.now(),
          parent_ids: [],
          schema_id: 'reflection-schema' as UUID,
          module: 'ReflectionModule',
        },
        label: 'Compact memory',
        goal_status: 'active',
      };
      this.agenda.push(compactGoal);
    }

    // Example 2: Detect high contradiction rate (placeholder logic)
    // In a real system, this would involve querying for beliefs and analyzing their truth values.
    const contradictionRate = Math.random() * 0.1; // Simulate a rate
    if (contradictionRate > 0.05) {
      console.warn(`High contradiction rate detected (${(contradictionRate * 100).toFixed(2)}%). Suggesting belief audit.`);
      const auditGoalAtom = this.worldModel.find_or_create_atom(
        '(run belief_audit)',
        { type: 'Fact', source: 'system_reflection', trust_score: 1.0 }
      );
      const auditGoal: CognitiveItem = {
        id: newCognitiveItemId(),
        atom_id: auditGoalAtom.id,
        type: 'GOAL',
        attention: this.attentionModule.calculate_initial({
          type: 'GOAL',
          truth: undefined,
          stamp: {
            timestamp: Date.now(),
            parent_ids: [],
            schema_id: 'reflection-schema' as UUID,
            module: 'ReflectionModule',
          },
        }),
        stamp: {
          timestamp: Date.now(),
          parent_ids: [],
          schema_id: 'reflection-schema' as UUID,
          module: 'ReflectionModule',
        },
        label: 'Run belief audit',
        goal_status: 'active',
      };
      this.agenda.push(auditGoal);
    }

    // TODO: Implement more sophisticated reflection mechanisms as per core.md
    // - Find inactive schemas
    // - Audit goals
    // - Self-improvement suggestions
  }
}