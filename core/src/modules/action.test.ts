import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ActionSubsystem, ReadFileExecutor } from './action.js';
import { PerceptionSubsystem } from './perception.js';
import { WorldModel } from '../world-model.js';
import { CognitiveItem, newCognitiveItemId, UUID } from '../types.js';

// Since the global read_file is declared, we need to provide a mock implementation for it in the test environment.
const mockReadFile = jest.fn<() => Promise<string>>();
(global as any).read_file = mockReadFile;


describe('ReadFileExecutor', () => {
    let perceptionSubsystem: PerceptionSubsystem;
    let readFileExecutor: ReadFileExecutor;

    beforeEach(() => {
        // Mock dependencies
        const mockWorldModel = {} as WorldModel;
        const mockAttentionModule = {
            calculate_initial: jest.fn(() => ({ priority: 0.5, durability: 0.5 })),
        } as any;

        perceptionSubsystem = new PerceptionSubsystem(mockWorldModel, mockAttentionModule);
        jest.spyOn(perceptionSubsystem, 'perceiveFile');

        readFileExecutor = new ReadFileExecutor(perceptionSubsystem);
        mockReadFile.mockClear();
    });

    it('should not execute if the goal is not a read_file action', async () => {
        const goal: CognitiveItem = {
            id: newCognitiveItemId(),
            atom_id: 'atom1' as UUID,
            type: 'GOAL',
            label: 'some other action',
            attention: { priority: 0.8, durability: 0.8 },
            stamp: { timestamp: Date.now(), parent_ids: [], schema_id: 's1' as UUID },
        };

        const result = await readFileExecutor.execute(goal);
        expect(result).toBeNull();
        expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('should execute a read_file goal and call the perception subsystem', async () => {
        const filePath = '/app/test.txt';
        const fileContent = 'This is a test file.';
        const goal: CognitiveItem = {
            id: newCognitiveItemId(),
            atom_id: 'atom2' as UUID,
            type: 'GOAL',
            label: `action: read_file ${filePath}`,
            attention: { priority: 0.8, durability: 0.8 },
            stamp: { timestamp: Date.now(), parent_ids: [], schema_id: 's1' as UUID },
        };

        // Setup mock return values
        mockReadFile.mockResolvedValue(fileContent);
        const mockBelief = { id: newCognitiveItemId() } as CognitiveItem;
        (perceptionSubsystem.perceiveFile as jest.Mock).mockResolvedValue([mockBelief]);

        const result = await readFileExecutor.execute(goal);

        // Verify the results
        expect(result).toBe(mockBelief);
        expect(mockReadFile).toHaveBeenCalledWith(filePath);
        expect(perceptionSubsystem.perceiveFile).toHaveBeenCalledWith(filePath, fileContent);
    });

    it('should return null if the file path is missing', async () => {
        const goal: CognitiveItem = {
            id: newCognitiveItemId(),
            atom_id: 'atom3' as UUID,
            type: 'GOAL',
            label: 'action: read_file ', // Empty file path
            attention: { priority: 0.8, durability: 0.8 },
            stamp: { timestamp: Date.now(), parent_ids: [], schema_id: 's1' as UUID },
        };

        const result = await readFileExecutor.execute(goal);
        expect(result).toBeNull();
        expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('should return null and log an error if reading the file fails', async () => {
        const filePath = '/app/nonexistent.txt';
        const goal: CognitiveItem = {
            id: newCognitiveItemId(),
            atom_id: 'atom4' as UUID,
            type: 'GOAL',
            label: `action: read_file ${filePath}`,
            attention: { priority: 0.8, durability: 0.8 },
            stamp: { timestamp: Date.now(), parent_ids: [], schema_id: 's1' as UUID },
        };

        const error = new Error('File not found');
        mockReadFile.mockRejectedValue(error);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const result = await readFileExecutor.execute(goal);

        expect(result).toBeNull();
        expect(mockReadFile).toHaveBeenCalledWith(filePath);
        expect(consoleErrorSpy).toHaveBeenCalledWith(`Error reading file ${filePath} for goal ${goal.id}:`, error);

        consoleErrorSpy.mockRestore();
    });
});
