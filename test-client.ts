import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

const ws = new WebSocket('ws://localhost:8080');

// Keep track of test success to set exit code
let testsPassed = false;

// State to track the received items
const receivedItems = {
  initialBelief: false,
  derivedGoal: false,
  executionBelief: false,
};

ws.on('open', () => {
    console.log('[Client] Connected to WebSocket server.');

    // 1. Initiate the test by sending a special message
    console.log('[Client] Sending INITIATE_TEST message.');
    sendMessage({
        type: 'INITIATE_TEST',
        payload: {}
    });

    // 2. End the test after a short delay
    setTimeout(() => {
        console.log('\n\n--- E2E TEST RESULTS ---');
        console.log('Final state:', JSON.stringify(receivedItems, null, 2));

        if (receivedItems.initialBelief && receivedItems.derivedGoal && receivedItems.executionBelief) {
            testsPassed = true;
            console.log('✅✅✅ All test items received in order. E2E Test PASSED!');
        } else {
            console.error('❌❌❌ E2E Test FAILED. Did not receive all expected items.');
            if (!receivedItems.initialBelief) console.error('  - Missing initial test BELIEF.');
            if (!receivedItems.derivedGoal) console.error('  - Missing derived GOAL from schema.');
            if (!receivedItems.executionBelief) console.error('  - Missing final BELIEF from executor.');
        }

        ws.close();
    }, 4000); // Wait 4 seconds for all events to propagate
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log(`[Client] Received message: ${message.label}`);

        // Check for the initial belief created by the transducer
        if (message.type === 'BELIEF' && message.label === 'Test Trigger Belief') {
            console.log('[Client] ✅ Received initial test BELIEF.');
            receivedItems.initialBelief = true;
        }

        // Check for the goal created by the test schema
        if (message.type === 'GOAL' && message.label === 'Goal: Log system test message') {
            console.log('[Client] ✅ Received derived GOAL from schema.');
            receivedItems.derivedGoal = true;
        }

        // Check for the belief created by the log executor
        if (message.type === 'BELIEF' && message.label?.startsWith('Result of logging:')) {
            console.log('[Client] ✅ Received final BELIEF from executor.');
            receivedItems.executionBelief = true;
        }
    } catch (e) {
        console.error('[Client] Error parsing message:', e);
    }
});

ws.on('close', () => {
    console.log('[Client] Disconnected from WebSocket server.');
    // Exit with a success or failure code
    process.exit(testsPassed ? 0 : 1);
});

ws.on('error', (error) => {
    console.error('[Client] WebSocket error:', error.message);
    testsPassed = false;
    ws.close();
});

function sendMessage(message: any) {
    const requestId = uuidv4();
    const messageWithId = { ...message, requestId };
    ws.send(JSON.stringify(messageWithId));
}
