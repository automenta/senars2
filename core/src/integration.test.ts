import { AgendaImpl } from './agenda.js';
import { WorldModelImpl } from './world-model.js';
import { CognitiveCore } from './cognitive-core.js';
import { PerceptionSubsystem } from './modules/perception.js';
import { AttentionModuleImpl } from './modules/attention.js';

describe('Integration Test', () => {
  it('should process a simple goal and belief', async () => {
    // Initialize core components
    const agenda = new AgendaImpl();
    const worldModel = new WorldModelImpl();
    const attentionModule = new AttentionModuleImpl();
    const perception = new PerceptionSubsystem(worldModel, attentionModule);
    
    const cognitiveCore = new CognitiveCore(agenda, worldModel);
    
    // Initialize the cognitive core
    await cognitiveCore.initialize();
    
    // Add a simple belief
    const beliefItems = await perception.process('BELIEF: (is_toxic_to chocolate dog)');
    expect(beliefItems.length).toBeGreaterThan(0);
    if (beliefItems.length > 0) {
      agenda.push(beliefItems[0]);
    }
    
    // Add a simple goal
    const goalItems = await perception.process('GOAL: Diagnose cat illness');
    expect(goalItems.length).toBeGreaterThan(0);
    if (goalItems.length > 0) {
      agenda.push(goalItems[0]);
    }
    
    // Check that items were added to agenda
    expect(agenda.size()).toBe(2);
    
    // The items are not yet in the world model until processed by the core
    
    console.log('Integration test passed');
  }, 10000); // 10 second timeout
});