import { AgendaImpl } from './agenda.js';
import { WorldModelImpl } from './world-model.js';
import { CognitiveCore } from './cognitive-core.js';
import { CognitiveItem, UUID } from './types.js';
import { GOAL_DECOMPOSITION_SCHEMA_ATOM } from './system-schemas.js';
import { PerceptionSubsystem } from './modules/perception.js';

async function main() {
  console.log('Starting Senars2 Cognitive Agent...');

  // 1. Initialize Core Components
  const agenda = new AgendaImpl();
  const worldModel = new WorldModelImpl();
  const cognitiveCore = new CognitiveCore(agenda, worldModel);

  // 2. Initialize Cognitive Core (registers system schemas, starts reflection)
  await cognitiveCore.initialize();

  // 3. Start the Cognitive Core worker loop
  cognitiveCore.start();

  // --- Simulate Initial Input ---
  const perception = new PerceptionSubsystem(worldModel, cognitiveCore.getModules().attention);
  console.log('Simulating initial user input...');

  // Example 1: User input leading to a goal
  // Create an observation atom for the user's raw input, separate from the goal.
  const userInput = "My cat seems sick after eating chocolate.";
  worldModel.find_or_create_atom(userInput, {
    type: 'Observation',
    source: 'user_input',
    trust_score: 0.6,
  });

  const initialGoalItems = await perception.process("GOAL: Diagnose cat illness");
  if (initialGoalItems.length > 0) {
    const initialGoal = initialGoalItems[0];
    // Manually set a different schema for decomposition, as the original code did.
    initialGoal.stamp.schema_id = GOAL_DECOMPOSITION_SCHEMA_ATOM.id;
    agenda.push(initialGoal);
  }

  // Example 2: A simple belief
  const factBeliefItems = await perception.process("BELIEF: (is_toxic_to chocolate dog)");
  if (factBeliefItems.length > 0) {
    const factBelief = factBeliefItems[0];
    // Manually update trust/confidence as the original code did
    if (factBelief.truth) {
      factBelief.truth.confidence = 0.95;
    }
    const factAtom = worldModel.get_atom(factBelief.atom_id);
    if (factAtom) {
      factAtom.meta.source = 'vetdb.org';
      factAtom.meta.trust_score = 0.95;
    }
    // Recalculate attention with the new confidence
    factBelief.attention = cognitiveCore.getModules().attention.calculate_initial(factBelief);
    agenda.push(factBelief);
  }

  console.log('Initial items pushed to Agenda.');

  // Keep the process alive for a while to observe cognitive cycles
  // In a real application, this would be managed by a server or UI loop.
  // setTimeout(() => {
  //   console.log('Stopping Senars2 Cognitive Agent.');
  //   cognitiveCore.stop();
  // }, 60000);
}

main().catch(console.error);