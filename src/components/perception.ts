import { logger } from '../lib/logger';
import { Agenda, WorldModel, Transducer } from '@cognitive-arch/types';

export class PerceptionSubsystem {
    private transducers: Transducer[] = [];

    constructor(
        private worldModel: WorldModel,
        private agenda: Agenda
    ) {}

    register_transducer(transducer: Transducer): void {
        this.transducers.push(transducer);
        logger.info(`Registered transducer: ${transducer.constructor.name}`);
    }

    /**
     * Processes raw external data, converts it into cognitive items, and adds them to the system.
     * @param data The raw data to process (e.g., a string, a JSON object).
     * @param source A string identifying the origin of the data (e.g., 'user_input', 'api:weather.com').
     */
    process(data: any, source: string): void {
        let processed = false;
        for (const transducer of this.transducers) {
            const result = transducer.process(data, source);
            if (result) {
                logger.info(`Data from '${source}' processed by ${transducer.constructor.name}.`);

                // Add the new atom and item to the core components
                this.worldModel.add_atom(result.atom);
                this.worldModel.add_item(result.item);
                this.agenda.push(result.item);

                logger.info(`Pushed new item to agenda: ${result.item.label ?? result.item.id}`);
                processed = true;
                break; // Stop after the first successful transducer
            }
        }

        if (!processed) {
            logger.warn(`No transducer found for data from source '${source}'.`);
        }
    }
}
