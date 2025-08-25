
import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import { CognitiveCore } from './cognitive-core';
import { AgendaImpl } from './agenda';
import { WorldModelImpl } from './world-model';
import { PerceptionSubsystem } from './modules/perception';
import { AttentionModuleImpl } from './modules/attention';
import { CognitiveItem, UUID } from './types';
import { RECIPE_SUGGESTION_SCHEMA_ATOM } from './utils';

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

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
const worldModel = new WorldModelImpl(768); // Assuming an embedding dimension of 768
const attentionModule = new AttentionModuleImpl();
const perception = new PerceptionSubsystem(worldModel, attentionModule);

const cognitiveCore = new CognitiveCore(agenda, worldModel);

// Initialize the cognitive core
cognitiveCore.initialize().then(() => {
  cognitiveCore.start();
  
  // Add some initial items for demonstration
  console.log('Adding initial items for demonstration...');
  
  // Example 1: User input leading to a goal
  const userInput = "My cat seems sick after eating chocolate.";
  const userInputAtom = worldModel.find_or_create_atom(userInput, {
    type: 'Observation',
    source: 'user_input',
    trust_score: 0.6,
  });

  const initialGoal = perception.process(`GOAL: Diagnose cat illness`);
  if (initialGoal) {
    agenda.push(initialGoal);
  }

  // Example 2: A simple belief
  const factBelief = perception.process(`BELIEF: (is_toxic_to chocolate dog)`);
  if (factBelief) {
    // Set higher trust for this belief
    const updatedFactBelief = {
      ...factBelief,
      truth: { frequency: 1.0, confidence: 0.95 }
    };
    const factAtom = worldModel.get_atom(factBelief.atom_id);
    if (factAtom) {
      factAtom.meta.trust_score = 0.95;
    }
    agenda.push(updatedFactBelief);
  }

  // Add cooking domain data
  worldModel.add_atom(RECIPE_SUGGESTION_SCHEMA_ATOM);

  const ingredient1 = perception.process(`BELIEF: (ingredient_available chicken)`);
  if (ingredient1) {
    agenda.push(ingredient1[0]);
  }
  const ingredient2 = perception.process(`BELIEF: (ingredient_available rice)`);
  if (ingredient2) {
    agenda.push(ingredient2[0]);
  }
  
  console.log('Initial items added to Agenda.');
});

// Store connected WebSocket clients
const clients = new Set<WebSocket>();

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);
  
  // Send initial state
  const state = {
    agenda: agenda.getItems(),
    worldModel: worldModel.get_all_atoms(),
    goalTree: serializeGoalTree(cognitiveCore.getModules().goalTree.get_goal_tree()),
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

function broadcast(data: any) {
  const jsonData = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonData);
    }
  });
}

// Periodically broadcast the state
setInterval(() => {
  const goalTree = serializeGoalTree(cognitiveCore.getModules().goalTree.get_goal_tree());

  // --- DEBUGGING: Log the goal tree structure ---
  if (Object.keys(goalTree).length > 0) {
    console.log('Broadcasting Goal Tree Structure:', JSON.stringify(goalTree, null, 2));
  }
  // --- END DEBUGGING ---

  const state = {
    agenda: agenda.getItems(),
    worldModel: worldModel.get_all_atoms(),
    goalTree: goalTree,
  };
  broadcast(state);
}, 1000);

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
    const newItem = perception.process(data);
    if (newItem) {
      agenda.push(newItem);
      res.status(200).json({ message: 'Input processed successfully', newItem });
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
import { GoalCompositionModule } from './modules/goal-composition';
const goalComposer = new GoalCompositionModule();

app.post('/api/compose-goal', (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Missing text in request body.' });
  }
  try {
    const composition = goalComposer.compose({ text });
    res.json(composition);
  } catch (error) {
    console.error('Error composing goal:', error);
    res.status(500).json({ error: 'Failed to compose goal.' });
  }
});

const port = 3001;
server.listen(port, () => {
  console.log(`Server is listening on http://localhost:${port}`);
  console.log(`WebSocket server is running on ws://localhost:${port}`);
});
