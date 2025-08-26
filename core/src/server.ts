import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { CognitiveCore } from './cognitive-core.js';
import { Agenda, AgendaImpl } from './agenda.js';
import { WorldModel, WorldModelImpl } from './world-model.js';
import { PerceptionSubsystem } from './modules/perception.js';
import { AttentionModuleImpl } from './modules/attention.js';
import { CognitiveItem, UUID } from './types.js';
import { RECIPE_SUGGESTION_SCHEMA_ATOM } from './system-schemas.js';
import { GoalCompositionModule } from './modules/goal-composition.js';
import { GoalTreeManager } from './modules/goal-tree.js';
import { SandboxService } from './sandbox-service.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Helper to convert Map to a JSON-serializable object
function serializeGoalTree(goalTree: Map<UUID, { item: CognitiveItem; children: Set<UUID> }>) {
  const obj: Record<UUID, { item: CognitiveItem; children: UUID[] }> = {};
  for (const [key, value] of goalTree.entries()) {
    obj[key] = {
      item: value.item,
      children: Array.from(value.children),
    };
  }
  return obj;
}

// Initialize core components
const agenda = new AgendaImpl();
const worldModel = new WorldModelImpl();
const attentionModule = new AttentionModuleImpl();
const perception = new PerceptionSubsystem(worldModel, attentionModule);

const cognitiveCore = new CognitiveCore(agenda, worldModel);
const goalTreeManager = cognitiveCore.getModules().goalTree;
const sandboxService = new SandboxService(worldModel, agenda);


// Store connected WebSocket clients
const clients = new Set<WebSocket>();

function broadcast(data: any) {
  const jsonData = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonData);
    }
  });
}


// --- Event-based broadcasting ---

function setupEventBroadcasting(agenda: Agenda, worldModel: WorldModel, goalTreeManager: GoalTreeManager) {
    agenda.on('item_added', (item) => broadcast({ type: 'agenda_item_added', payload: item }));
    agenda.on('item_removed', (item) => broadcast({ type: 'agenda_item_removed', payload: item }));
    agenda.on('item_updated', (item) => broadcast({ type: 'agenda_item_updated', payload: item }));

    worldModel.on('atom_added', (atom) => broadcast({ type: 'world_model_atom_added', payload: atom }));
    worldModel.on('atom_updated', (atom) => broadcast({ type: 'world_model_atom_updated', payload: atom }));
    worldModel.on('atom_removed', (atom) => broadcast({ type: 'world_model_atom_removed', payload: atom }));
    worldModel.on('item_added', (item) => broadcast({ type: 'world_model_item_added', payload: item }));
    worldModel.on('item_updated', (item) => broadcast({ type: 'world_model_item_updated', payload: item }));
    worldModel.on('item_removed', (item) => broadcast({ type: 'world_model_item_removed', payload: item }));

    goalTreeManager.on('goal_added', (goal) => broadcast({ type: 'goal_tree_goal_added', payload: goal }));
    goalTreeManager.on('goal_updated', (goal) => broadcast({ type: 'goal_tree_goal_updated', payload: goal }));
    goalTreeManager.on('decomposed', (data) => broadcast({ type: 'goal_tree_decomposed', payload: data }));
}


// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);
  
  // Send initial state
  const state = {
    type: 'full_state',
    payload: {
        agenda: agenda.getItems(),
        worldModel: worldModel.get_all_atoms(),
        worldModelItems: worldModel.get_all_items(),
        goalTree: serializeGoalTree(cognitiveCore.getModules().goalTree.get_goal_tree()),
    }
  };
  
  ws.send(JSON.stringify(state));
  
  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});


// Initialize the cognitive core
cognitiveCore.initialize().then(async () => {
  setupEventBroadcasting(agenda, worldModel, goalTreeManager);
  cognitiveCore.start();

  // Add some initial items for demonstration
  console.log('Adding initial items for demonstration...');

  // Example 1: User input leading to a goal
  const initialGoalItems = await perception.process(`GOAL: Diagnose cat illness`);
  if (initialGoalItems.length > 0) {
    agenda.push(initialGoalItems[0]);
  }

  // Example 2: A simple belief
  const factBeliefItems = await perception.process(`BELIEF: (is_toxic_to chocolate dog)`);
  if (factBeliefItems.length > 0) {
    // Set higher trust for this belief
    const updatedFactBelief = factBeliefItems[0];
    if (updatedFactBelief.truth) {
        updatedFactBelief.truth.confidence = 0.95;
    }
    worldModel.update_atom(updatedFactBelief.atom_id, {
        trust_score: 0.95,
        source: 'vetdb.org'
    });
    agenda.push(updatedFactBelief);
  }

  // Add cooking domain data
  worldModel.add_atom(RECIPE_SUGGESTION_SCHEMA_ATOM);

  const ingredient1Items = await perception.process(`BELIEF: (ingredient_available chicken)`);
  if (ingredient1Items.length > 0) {
    agenda.push(ingredient1Items[0]);
  }
  const ingredient2Items = await perception.process(`BELIEF: (ingredient_available rice)`);
  if (ingredient2Items.length > 0) {
    agenda.push(ingredient2Items[0]);
  }

  console.log('Initial items added to Agenda.');
});


// REST API endpoints
app.use(express.json()); // Enable JSON body parsing

app.get('/api/state', (req, res) => {
  const state = {
    agenda: agenda.getItems(),
    worldModel: worldModel.get_all_atoms(),
    goalTree: serializeGoalTree(cognitiveCore.getModules().goalTree.get_goal_tree()),
  };
  res.json(state);
});

app.post('/api/input', async (req, res) => {
  const { data } = req.body;
  if (!data) {
    return res.status(400).json({ error: 'Missing data in request body.' });
  }

  try {
    const newItems = await perception.process(data);
    if (newItems && newItems.length > 0) {
      newItems.forEach(item => agenda.push(item));
      res.status(200).json({ message: 'Input processed successfully', newItems });
    } else {
      res.status(400).json({ error: 'Failed to process input.' });
    }
  } catch (error) {
    console.error('Error processing input:', error);
    res.status(500).json({ error: 'Failed to process input.' });
  }
});

// Add a route to get goal tree information
app.get('/api/goal-tree', (req, res) => {
  try {
    const goalTree = serializeGoalTree(cognitiveCore.getModules().goalTree.get_goal_tree());
    res.json({ goalTree });
  } catch (error) {
    console.error('Error getting goal tree:', error);
    res.status(500).json({ error: 'Failed to get goal tree.' });
  }
});

// Add a route to mark a goal as achieved
app.post('/api/goal/:id/achieve', (req, res) => {
  try {
    const goalId = req.params.id as UUID;
    cognitiveCore.getModules().goalTree.mark_achieved(goalId);
    res.status(200).json({ message: `Goal ${goalId} marked as achieved.` });
  } catch (error) {
    console.error('Error marking goal as achieved:', error);
    res.status(500).json({ error: 'Failed to mark goal as achieved.' });
  }
});

// --- New Goal Composition Endpoint ---
app.get('/api/reflection', (req, res) => {
    const reflectionData = cognitiveCore.getModules().reflection.getReflectionData();
    res.json(reflectionData);
});

app.post('/api/compose-goal', async (req, res) => {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Missing text in request body.' });
    }
    try {
      // 1. Use the integrated module to compose the goal
      const composition = cognitiveCore.getModules().goalComposition.compose({ text });

      // 2. Use the perception subsystem to create the basic cognitive item
      const goalText = `GOAL: ${composition.suggestedGoal}`;
      const newItems = await perception.process(goalText);

      if (!newItems || newItems.length === 0) {
        return res.status(500).json({ error: 'Failed to create a cognitive item for the composed goal.' });
      }

      const composedGoalItem = newItems[0];

      // 3. Enhance the item with the composition results
      composedGoalItem.label = composition.suggestedGoal; // Ensure label is set
      composedGoalItem.attention.priority = composition.priority; // Override priority
      if (composition.constraints) {
        composedGoalItem.constraints = composition.constraints; // Add constraints
      }

      // 4. Push the fully formed goal to the agenda
      agenda.push(composedGoalItem);

      res.status(200).json({ message: 'Goal composed and added to agenda.', item: composedGoalItem });
    } catch (error) {
      console.error('Error composing goal:', error);
      res.status(500).json({ error: 'Failed to compose goal.' });
    }
  });

app.post('/api/sandbox/run', async (req, res) => {
    const { hypothesis, steps } = req.body;
    if (!hypothesis) {
        return res.status(400).json({ error: 'Missing hypothesis in request body.' });
    }
    try {
        const result = await sandboxService.run_what_if(hypothesis, steps);
        res.json(result);
    } catch (error) {
        console.error('Error running sandbox:', error);
        res.status(500).json({ error: 'Failed to run sandbox.' });
    }
});

const port = 3001;
server.listen(port, () => {
  console.log(`Server is listening on http://localhost:${port}`);
  console.log(`WebSocket server is running on ws://localhost:${port}`);
});
