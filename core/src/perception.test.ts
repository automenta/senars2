import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PerceptionSubsystem } from './modules/perception.js';
import { WorldModel } from './world-model.js';
import { AttentionModule } from './modules/attention.js';
import { UUID } from './types.js';

// Mocking the dependencies
const mockWorldModel = {
  find_or_create_atom: jest.fn((content: any, meta: any) => {
    return { id: 'mock-atom-id' as UUID, content, meta, embedding: [] };
  }),
  add_atom: jest.fn(),
  add_item: jest.fn(),
  get_atom: jest.fn(),
  get_item: jest.fn(),
  query_by_semantic: jest.fn(),
  query_by_symbolic: jest.fn(),
  query_by_structure: jest.fn(),
  revise_belief: jest.fn(),
  register_schema_atom: jest.fn(),
  get_all_items: jest.fn(),
  update_item: jest.fn(),
} as jest.Mocked<WorldModel>;

const mockAttentionModule = {
  calculate_initial: jest.fn(() => ({ priority: 0.5, durability: 0.5 })),
  calculate_derived: jest.fn(),
  update_on_access: jest.fn(),
  run_decay_cycle: jest.fn(),
} as jest.Mocked<AttentionModule>;

describe('PerceptionSubsystem', () => {
  let perception: PerceptionSubsystem;

  beforeEach(() => {
    jest.clearAllMocks();
    // The constructor of PerceptionSubsystem takes the modules, not the subsystem itself
    perception = new PerceptionSubsystem(mockWorldModel, mockAttentionModule);
  });

  it('should parse a GOAL with metadata correctly', async () => {
    const input = 'GOAL: Test this goal { "source": "test", "trust_score": 0.9, "schema_id": "test-schema" }';
    const result = await perception.process(input);

    expect(result).toHaveLength(1);
    const item = result[0];
    expect(item.type).toBe('GOAL');
    expect(item.label).toContain('Test this goal');
    expect(item.stamp.schema_id).toBe('test-schema');

    expect(mockWorldModel.find_or_create_atom).toHaveBeenCalledWith(
      'Test this goal',
      expect.objectContaining({
        source: 'test',
        trust_score: 0.9,
      })
    );
  });

  it('should parse a BELIEF with confidence', async () => {
    const input = 'BELIEF: The sky is blue { "confidence": 0.95 }';
    const result = await perception.process(input);

    expect(result).toHaveLength(1);
    const item = result[0];
    expect(item.type).toBe('BELIEF');
    expect(item.truth?.confidence).toBe(0.95);

    expect(mockAttentionModule.calculate_initial).toHaveBeenCalledWith(
      expect.objectContaining({
        truth: { frequency: 1.0, confidence: 0.95 },
      })
    );
  });

  it('should handle plain string input without metadata', async () => {
    const input = 'BELIEF: This is a simple fact';
    const result = await perception.process(input);

    expect(result).toHaveLength(1);
    const item = result[0];
    expect(item.type).toBe('BELIEF');
    expect(item.truth?.confidence).toBe(0.6); // default
    expect(mockWorldModel.find_or_create_atom).toHaveBeenCalledWith(
      'This is a simple fact',
      expect.objectContaining({
        source: 'user_input',
        trust_score: 0.6,
      })
    );
  });

  describe('perceiveFile (CodebaseTransducer)', () => {
    it('should correctly process a file input into a BELIEF item', async () => {
      const filePath = '/app/src/main.ts';
      const fileContent = 'console.log("hello world");';

      const items = await perception.perceiveFile(filePath, fileContent);

      expect(items).toHaveLength(1);
      const item = items[0];

      expect(item.type).toBe('BELIEF');
      expect(item.label).toBe(`File: ${filePath}`);
      expect(item.truth?.confidence).toBe(1.0);

      // Check that the atom was created with the correct metadata
      expect(mockWorldModel.find_or_create_atom).toHaveBeenCalledWith(
        fileContent,
        expect.objectContaining({
          type: 'Code',
          source: 'file_system',
          path: filePath,
          trust_score: 1.0
        })
      );

      // Check that the initial attention was calculated for the new item
      expect(mockAttentionModule.calculate_initial).toHaveBeenCalledWith(
        expect.objectContaining({
          label: `File: ${filePath}`,
          type: 'BELIEF'
        })
      );
    });
  });
});
