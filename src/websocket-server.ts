import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { PerceptionSubsystem } from './components/perception';
import { EventBus } from './core/event-bus';

export class WebSocketServer {
    private wss: WSServer;
    public clients: Map<string, WebSocket> = new Map();
    private perceptionSubsystem: PerceptionSubsystem;
    private eventBus: EventBus;

    constructor(port: number, perceptionSubsystem: PerceptionSubsystem, eventBus: EventBus) {
        this.wss = new WSServer({ port });
        this.perceptionSubsystem = perceptionSubsystem;
        this.eventBus = eventBus;
    }

    public start() {
        // Subscribe to all cognitive events and broadcast them
        this.eventBus.all_events$.subscribe(event => {
            this.broadcast(event);
        });

        this.wss.on('connection', (ws: WebSocket) => {
            const clientId = uuidv4();
            this.clients.set(clientId, ws);
            console.log(`[WebSocket] Client connected: ${clientId}`);

            ws.on('message', (message: string) => {
                try {
                    const parsedMessage = JSON.parse(message.toString());
                    // Add clientId to the message so the system can respond
                    const messageWithClient = { ...parsedMessage, clientId };
                    this.perceptionSubsystem.process(messageWithClient, 'websocket_input');
                } catch (error) {
                    console.error(`[WebSocket] Error parsing message from ${clientId}:`, error);
                    ws.send(JSON.stringify({ error: 'Invalid JSON message' }));
                }
            });

            ws.on('close', () => {
                this.clients.delete(clientId);
                console.log(`[WebSocket] Client disconnected: ${clientId}`);
            });

            ws.on('error', (error) => {
                console.error(`[WebSocket] Error with client ${clientId}:`, error);
                this.clients.delete(clientId);
            });
        });

        console.log(`[WebSocket] Server started on port ${this.wss.options.port}`);
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
            console.log(`[WebSocket] Could not send message to client ${clientId}, client not found or connection not open.`);
        }
    }

    public getConnectedClientsCount(): number {
        return this.clients.size;
    }
}
