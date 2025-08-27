import { logger } from './lib/logger';
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { PerceptionSubsystem } from './components/perception';
import { EventBus } from './core/event-bus';
import { Agenda } from './components/agenda';
import { AttentionValue } from '@cognitive-arch/types';

export class WebSocketServer {
    private wss: WSServer;
    public clients: Map<string, WebSocket> = new Map();
    private perceptionSubsystem: PerceptionSubsystem;
    private eventBus: EventBus;
    private agenda: Agenda;

    constructor(port: number, perceptionSubsystem: PerceptionSubsystem, eventBus: EventBus, agenda: Agenda) {
        this.wss = new WSServer({ port });
        this.perceptionSubsystem = perceptionSubsystem;
        this.eventBus = eventBus;
        this.agenda = agenda;
    }

    public start() {
        // Subscribe to all cognitive events and broadcast them
        this.eventBus.all_events$.subscribe(event => {
            this.broadcast(event);
        });

        this.wss.on('connection', (ws: WebSocket) => {
            const clientId = uuidv4();
            this.clients.set(clientId, ws);
            logger.info(`Client connected: ${clientId}`);

            ws.on('message', (message: string) => {
                try {
                    const parsedMessage = JSON.parse(message.toString());
                    const messageWithClient = { ...parsedMessage, clientId };

                    switch (parsedMessage.request_type) {
                        case 'CANCEL_GOAL':
                            logger.info(`Received CANCEL_GOAL for goalId: ${parsedMessage.payload.goalId}`);
                            this.agenda.remove(parsedMessage.payload.goalId);
                            // Optional: send confirmation back to client
                            this.sendMessage(clientId, { status: 'success', message: `Goal ${parsedMessage.payload.goalId} cancelled.` });
                            break;
                        case 'PRIORITIZE_GOAL':
                            logger.info(`Received PRIORITIZE_GOAL for goalId: ${parsedMessage.payload.goalId}`);
                            const item = this.agenda.get(parsedMessage.payload.goalId);
                            if (item) {
                                const newAttention: AttentionValue = { ...item.attention, priority: 1.0 };
                                this.agenda.updateAttention(item.id, newAttention);
                                this.sendMessage(clientId, { status: 'success', message: `Goal ${parsedMessage.payload.goalId} prioritized.` });
                            }
                            break;
                        default:
                            // Pass to perception subsystem for normal processing
                            this.perceptionSubsystem.process(messageWithClient, 'websocket_input');
                    }
                } catch (error) {
                    logger.error(`Error parsing message from ${clientId}:`, error);
                    ws.send(JSON.stringify({ error: 'Invalid JSON message' }));
                }
            });

            ws.on('close', () => {
                this.clients.delete(clientId);
                logger.info(`Client disconnected: ${clientId}`);
            });

            ws.on('error', (error) => {
                logger.error(`Error with client ${clientId}:`, error);
                this.clients.delete(clientId);
            });
        });

        logger.info(`Server started on port ${this.wss.options.port}`);
    }

    public broadcast(message: any) {
        const serializedMessage = JSON.stringify(message);
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(serializedMessage);
            }
        });
    }

    public sendMessage(clientId: string, message: any) {
        const client = this.clients.get(clientId);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        } else {
            logger.warn(`Could not send message to client ${clientId}, client not found or connection not open.`);
        }
    }

    public getConnectedClientsCount(): number {
        return this.clients.size;
    }
}
