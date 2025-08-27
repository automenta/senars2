import { logger } from './lib/logger';
import { Agenda } from './components/agenda';
import { WorldModel } from './components/world-model';
import { EventBus } from './core/event-bus';
import { WorkerPool } from './core/worker-pool';
import { ReflectionLoop } from './core/reflection';
import { ActionSubsystem } from './components/action';
import { PerceptionSubsystem } from './components/perception';

import { AttentionModule } from './modules/attention';
import { ResonanceModule } from './modules/resonance';
import { SchemaMatcher } from './modules/schema-matcher';
import { GoalTreeManager } from './modules/goal-tree-manager';

import { LogExecutor } from './executors/log-executor';
import { WebSocketExecutor } from './executors/websocket-executor';
import { TextTransducer } from './transducers/text-transducer';
import { WebSocketTransducer } from './transducers/websocket-transducer';
import { WebSocketServer } from './websocket-server';

import { testTriggerSchema, testTriggerSchemaAtom } from './schemas/test-trigger-schema';
import { createGoalSchema, createGoalSchemaAtom, getAllGoalsSchema, getAllGoalsSchemaAtom } from './schemas/websocket_api_schema';
import { SemanticAtom } from '@cognitive-arch/types';

const NUM_WORKERS = 4;
const WEBSOCKET_PORT = 8080;

async function main() {
    logger.info("--- System Initialization ---");

    const eventBus = new EventBus();
    const agenda = new Agenda();
    const worldModel = await WorldModel.create(eventBus);
    const actionSubsystem = new ActionSubsystem(worldModel);
    const perceptionSubsystem = new PerceptionSubsystem(worldModel, agenda);

    const webSocketServer = new WebSocketServer(WEBSOCKET_PORT, perceptionSubsystem, eventBus, agenda);

    const attentionModule = new AttentionModule();
    const resonanceModule = new ResonanceModule();
    const schemaMatcher = new SchemaMatcher();
    const goalTreeManager = new GoalTreeManager();

    // Register I/O components
    actionSubsystem.register_executor(new LogExecutor());
    actionSubsystem.register_executor(new WebSocketExecutor(webSocketServer));
    perceptionSubsystem.register_transducer(new TextTransducer());
    perceptionSubsystem.register_transducer(new WebSocketTransducer());

    const workerPool = new WorkerPool(
        NUM_WORKERS,
        agenda,
        worldModel,
        resonanceModule,
        schemaMatcher,
        attentionModule,
        goalTreeManager,
        actionSubsystem
    );

    const reflectionLoop = new ReflectionLoop(worldModel, agenda, attentionModule, 1000);

    logger.info("--- Scenario Setup ---");
    // Register system schemas
    await worldModel.add_atom(testTriggerSchemaAtom);
    await schemaMatcher.register_schema(testTriggerSchema, worldModel);

    // Register WebSocket API schemas
    await worldModel.add_atom(createGoalSchemaAtom);
    await schemaMatcher.register_schema(createGoalSchema, worldModel);
    await worldModel.add_atom(getAllGoalsSchemaAtom);
    await schemaMatcher.register_schema(getAllGoalsSchema, worldModel);

    logger.info("All schemas registered. System is ready for controlled execution.");

    logger.info("--- System Online ---");
    workerPool.start();
    reflectionLoop.start();
    webSocketServer.start();

    // The system will now run indefinitely, processing inputs from the WebSocket server.
}

main().catch((err) => logger.error("An unhandled error occurred", err));
