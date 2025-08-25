import { AgendaImpl } from './agenda';
import { WorldModelImpl } from './world-model';
import { CognitiveCore } from './cognitive-core';
import { PerceptionModule } from './perception';
import { AttentionModuleImpl } from './modules/attention';

describe('Integration Test', () => {
  it('should process a simple goal and belief', async () => {
    // Initialize core components
    const agenda = new AgendaImpl();
    const worldModel = new WorldModelImpl(768);
    const attentionModule = new AttentionModuleImpl();
    const perception = new PerceptionModule(worldModel, attentionModule);
    
    const cognitiveCore = new CognitiveCore(agenda, worldModel);
    
    // Initialize the cognitive core
    await cognitiveCore.initialize();
    
    // Add a simple belief
    const beliefItem = perception.process('BELIEF: (is_toxic_to chocolate dog)');
    expect(beliefItem).not.toBeNull();
    if (beliefItem) {
      agenda.push(beliefItem);
    }
    
    // Add a simple goal
    const goalItem = perception.process('GOAL: Diagnose cat illness');
    expect(goalItem).not.toBeNull();
    if (goalItem) {
      agenda.push(goalItem);
    }
    
    // Check that items were added to agenda
    expect(agenda.size()).toBe(2);
    
    // Check that items were added to world model
    const allItems = worldModel.get_all_items();
    expect(allItems.length).toBe(2);
    
    const allAtoms = worldModel.get_all_atoms();
    expect(allAtoms.length).toBe(2);
    
    console.log('Integration test passed');
  }, 10000); // 10 second timeout
});