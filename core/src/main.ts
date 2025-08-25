import { AgendaImpl } from './agenda';
import { WorldModelImpl } from './world-model';
import { CognitiveCore } from './cognitive-core';
import { AttentionValue, CognitiveItem, CognitiveItemType, newCognitiveItemId, SemanticAtomMetadata, UUID } from './types';
import { GOAL_DECOMPOSITION_SCHEMA_ATOM } from './utils';
import { PerceptionModule } from './perception';

async function main() {
  console.log('Starting Senars2 Cognitive Agent...');

  // 1. Initialize Core Components
  const agenda = new AgendaImpl();
  const worldModel = new WorldModelImpl(768); // Assuming an embedding dimension of 768
  const cognitiveCore = new CognitiveCore(agenda, worldModel);

  // 2. Initialize Cognitive Core (registers system schemas, starts reflection)
  await cognitiveCore.initialize();

  // 3. Start the Cognitive Core worker loop
  cognitiveCore.start();

  // --- Simulate Initial Input ---
  console.log('Simulating initial user input...');

  // Example 1: User input leading to a goal
  const userInput = "My cat seems sick after eating chocolate.";
  const userInputAtom = worldModel.find_or_create_atom(userInput, {
    type: 'Observation',
    source: 'user_input',
    trust_score: 0.6,
  });

  const initialGoal: CognitiveItem = {
    id: newCognitiveItemId(),
    atom_id: userInputAtom.id,
    type: 'GOAL',
    label: 'Diagnose cat illness',
    attention: (cognitiveCore as any).modules.attention.calculate_initial({
      id: newCognitiveItemId(),
      atom_id: userInputAtom.id,
      type: 'GOAL',
      label: 'Diagnose cat illness',
      attention: { priority: 0, durability: 0 }, // Placeholder attention
      stamp: { timestamp: Date.now(), parent_ids: [], schema_id: GOAL_DECOMPOSITION_SCHEMA_ATOM.id },
    }),
    stamp: {
      timestamp: Date.now(),
      parent_ids: [],
      schema_id: GOAL_DECOMPOSITION_SCHEMA_ATOM.id, // This goal will trigger decomposition
      module: 'PerceptionSubsystem',
    },
    goal_status: 'active',
  };
  agenda.push(initialGoal);

  // Example 2: A simple belief
  const factAtom = worldModel.find_or_create_atom(
    '(is_toxic_to chocolate dog)',
    { type: 'Fact', source: 'vetdb.org', trust_score: 0.95 }
  );
  const factBelief: CognitiveItem = {
    id: newCognitiveItemId(),
    atom_id: factAtom.id,
    type: 'BELIEF',
    truth: { frequency: 1.0, confidence: 0.95 },
    attention: (cognitiveCore as any).modules.attention.calculate_initial({
      id: newCognitiveItemId(),
      atom_id: factAtom.id,
      type: 'BELIEF',
      label: 'Chocolate toxic to dogs',
      attention: { priority: 0, durability: 0 }, // Placeholder attention
      stamp: { timestamp: Date.now(), parent_ids: [], schema_id: 'initial-fact-schema' as UUID },
      truth: { frequency: 1.0, confidence: 0.95 },
    }),
    stamp: {
      timestamp: Date.now(),
      parent_ids: [],
      schema_id: 'initial-fact-schema' as UUID,
      module: 'PerceptionSubsystem',
    },
    label: 'Chocolate toxic to dogs',
  };
  agenda.push(factBelief);

  console.log('Initial items pushed to Agenda.');

  // Keep the process alive for a while to observe cognitive cycles
  // In a real application, this would be managed by a server or UI loop.
  // setTimeout(() => {
  //   console.log('Stopping Senars2 Cognitive Agent.');
  //   cognitiveCore.stop();
  // }, 60000);
}

main().catch(console.error);