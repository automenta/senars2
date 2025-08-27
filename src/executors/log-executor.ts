import { logger } from "../lib/logger";
import { Executor, ExecutorResult, WorldModel, CognitiveItem, SemanticAtom } from "@cognitive-arch/types";
import { v4 as uuidv4 } from "uuid";
import { createAtomId } from "../lib/utils";

export class LogExecutor implements Executor {

    private async getGoalContent(goal: CognitiveItem, world_model: WorldModel): Promise<any | null> {
        const atom = await world_model.get_atom(goal.atom_id);
        return atom?.content ?? null;
    }

    async can_execute(goal: CognitiveItem, world_model: WorldModel): Promise<boolean> {
        const content = await this.getGoalContent(goal, world_model);
        return content && typeof content === 'object' && content.command === 'log';
    }

    async execute(goal: CognitiveItem, world_model: WorldModel): Promise<ExecutorResult> {
        const content = await this.getGoalContent(goal, world_model);
        const message = content?.message ?? 'No message provided.';

        logger.info(`[LogExecutor] ${message}`);

        const result_content = {
            result: 'Log command executed successfully.',
            logged_message: message,
        };
        const result_meta = {
            type: "Observation" as const,
            source: "LogExecutor",
            timestamp: new Date().toISOString(),
            author: "system" as const,
            trust_score: 1.0,
            domain: "system.action",
            license: "internal"
        };

        const result_atom_id = createAtomId(result_content, result_meta);

        const result_atom: SemanticAtom = {
            id: result_atom_id,
            content: result_content,
            embedding: [],
            meta: result_meta
        };

        const result_item: CognitiveItem = {
            id: uuidv4(),
            atom_id: result_atom.id,
            type: 'BELIEF',
            truth: { frequency: 1.0, confidence: 1.0 },
            attention: { priority: 0.8, durability: 0.6 },
            stamp: {
                timestamp: Date.now(),
                parent_ids: [goal.id],
                schema_id: 'executor:log' as any,
            },
            label: `Result of logging: "${message.substring(0, 20)}..."`
        };

        return { belief: result_item, atom: result_atom };
    }
}
