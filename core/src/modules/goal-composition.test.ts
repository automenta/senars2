import { GoalCompositionModule } from './goal-composition.js';
import { WorldModel } from '../world-model.js';

// Mock the WorldModel
const mockWorldModel = {} as WorldModel;

describe('GoalCompositionModule', () => {
  let module: GoalCompositionModule;

  beforeEach(() => {
    // Pass the mock WorldModel to the constructor
    module = new GoalCompositionModule(mockWorldModel);
  });

  it('should be created', () => {
    expect(module).toBeTruthy();
  });

  describe('compose', () => {
    it('should parse a single trust constraint from the input text', () => {
      const request = {
        text: 'Diagnose cat illness --trust-source=vetdb.org:0.9',
      };
      const response = module.compose(request);

      expect(response.suggestedGoal).toBe('Diagnose condition of cat, sick');
      expect(response.constraints).toBeDefined();
      expect(response.constraints?.required_sources).toEqual({
        'vetdb.org': 0.9,
      });
      expect(response.factors).toContain('Specific trust constraints provided (+0.10)');
    });

    it('should parse multiple trust constraints from the input text', () => {
        const request = {
          text: 'Find treatment for dog --trust-source=vetdb.org:0.9,medical_journal:0.85',
        };
        const response = module.compose(request);

        expect(response.suggestedGoal).toBe('Find treatment for dog');
        expect(response.constraints).toBeDefined();
        expect(response.constraints?.required_sources).toEqual({
          'vetdb.org': 0.9,
          'medical_journal': 0.85
        });
        expect(response.factors).toContain('Specific trust constraints provided (+0.10)');
      });

    it('should handle text with no constraints', () => {
      const request = {
        text: 'Just a normal goal',
      };
      const response = module.compose(request);

      expect(response.suggestedGoal).toBe('Just a normal goal');
      expect(response.constraints).toEqual({});
      expect(response.factors).not.toContain('Specific trust constraints provided (+0.10)');
    });

    it('should correctly suggest a goal based on keywords', () => {
        const request = {
          text: 'My cat seems sick after eating chocolate',
        };
        const response = module.compose(request);

        expect(response.suggestedGoal).toBe('Diagnose chocolate toxicity in cat');
        expect(response.detectedEntities).toEqual(['cat', 'chocolate', 'sick']);
      });
  });
});
