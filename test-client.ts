import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

const ws = new WebSocket('ws://localhost:8080');

const receivedMessages: any[] = [];
let testState = {
    connected: false,
    goalCreatedResponse: false,
    goalsListResponse: false,
    goalAddedBroadcast: false,
    testGoalId: ''
};

// Keep track of test success to set exit code
let testsPassed = true;

ws.on('open', () => {
    console.log('[Client] Connected to WebSocket server.');
    testState.connected = true;

    // 1. Create a new goal
    const goalText = "Test goal from automated client";
    console.log(`[Client] Sending CREATE_GOAL request for: "${goalText}"`);
    sendMessage({
        type: 'CREATE_GOAL',
        payload: { text: goalText }
    });

    // 2. Ask for all goals after a delay
    setTimeout(() => {
        console.log('[Client] Sending GET_ALL_GOALS request.');
        sendMessage({
            type: 'GET_ALL_GOALS',
            payload: {}
        });
    }, 1500); // Wait 1.5 seconds

    // 3. End the test after a while
    setTimeout(() => {
        console.log('\n\n--- TEST RESULTS ---');
        console.log('Received messages:', JSON.stringify(receivedMessages, null, 2));

        // Verify results
        if (!testState.connected) {
            console.error('❌ Test Failed: Did not connect.');
            testsPassed = false;
        }
        if (!testState.goalCreatedResponse) {
            console.error('❌ Test Failed: Did not receive response for CREATE_GOAL.');
            testsPassed = false;
        }
        if (!testState.goalsListResponse) {
            console.error('❌ Test Failed: Did not receive response for GET_ALL_GOALS.');
            testsPassed = false;
        }
        if (!testState.goalAddedBroadcast) {
            console.error('❌ Test Failed: Did not receive broadcast for new goal.');
            testsPassed = false;
        }

        if (testsPassed) {
            console.log('✅ All tests passed!');
        } else {
            console.error('❌ Some tests failed.');
        }

        ws.close();
    }, 4000); // Wait 4 seconds total
});

ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    receivedMessages.push(message);

    // Check for broadcast messages
    if (message.type === 'goal_added' && message.payload?.goal?.label?.includes('Test goal')) {
        console.log('[Client] ✅ Received goal_added broadcast.');
        testState.goalAddedBroadcast = true;
    }

    // Check for direct responses (which are not nested in a 'payload' and have a 'requestId')
    if (message.requestId) {
        if (message.message === 'Goal created') {
            console.log('[Client] ✅ Received CREATE_GOAL confirmation.');
            testState.goalCreatedResponse = true;
            testState.testGoalId = message.goalId;
        }
        if (message.goals) {
            console.log('[Client] ✅ Received GET_ALL_GOALS response.');
            testState.goalsListResponse = true;
            if (message.goals.some((g:any) => g.id === testState.testGoalId)) {
                console.log('[Client] ✅ Verified new goal exists in goals list.');
            } else {
                console.error('[Client] ❌ ERROR: New goal not found in GET_ALL_GOALS response.');
                testsPassed = false;
            }
        }
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
