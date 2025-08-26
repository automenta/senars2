import { Agenda, WorldModel, ResonanceModule, SchemaMatcher, AttentionModule, GoalTreeManager } from '../types/interfaces';
import { ActionSubsystem } from '../components/action';
import { CognitiveWorker } from './worker';

export class WorkerPool {
    private workers: CognitiveWorker[] = [];
    private running: boolean = false;

    constructor(
        private size: number,
        private agenda: Agenda,
        private worldModel: WorldModel,
        private resonanceModule: ResonanceModule,
        private schemaMatcher: SchemaMatcher,
        private attentionModule: AttentionModule,
        private goalTreeManager: GoalTreeManager,
        private actionSubsystem: ActionSubsystem
    ) {}

    public start() {
        if (this.running) return;
        this.running = true;
        console.log(`Starting worker pool with ${this.size} workers.`);
        for (let i = 0; i < this.size; i++) {
            const worker = new CognitiveWorker(
                this.agenda,
                this.worldModel,
                this.resonanceModule,
                this.schemaMatcher,
                this.attentionModule,
                this.goalTreeManager,
                this.actionSubsystem
            );
            this.workers.push(worker);
            // Start the worker's async loop.
            // We don't await this because we want all workers to run in parallel.
            worker.start();
            console.log(`Worker ${i + 1} started.`);
        }
    }

    public stop() {
        if (!this.running) return;
        this.running = false;
        console.log("Stopping all workers in the pool...");
        this.workers.forEach(worker => worker.stop());
        this.workers = [];
    }
}
