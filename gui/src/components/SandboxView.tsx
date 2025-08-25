import React, { useState } from 'react';
import { SandboxHypothesis, SandboxResult } from '../../../core/src/sandbox-service';

const API_URL = 'http://localhost:3001/api/sandbox/run';

function SandboxView() {
  const [hypothesisText, setHypothesisText] = useState('');
  const [steps, setSteps] = useState(10);
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunSandbox = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setResult(null);

      const hypothesis: SandboxHypothesis = {
        type: 'add_item', // For now, we only support adding items
        item: {
            // This is a simplified item for the hypothesis.
            // A real implementation would have a more structured way to create this.
            id: 'hypothesis-item' as any,
            atom_id: 'hypothesis-atom' as any,
            type: 'BELIEF',
            truth: { frequency: 0.0, confidence: 0.99 }, // e.g., "chocolate is NOT toxic to cats"
            label: hypothesisText,
            attention: { priority: 1.0, durability: 1.0 },
            stamp: { timestamp: Date.now(), parent_ids: [], schema_id: 'hypothesis-schema' as any },
        }
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hypothesis, steps }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="sandbox-view">
      <div className="sandbox-header">
        <h2>🧪 WHAT-IF ANALYSIS</h2>
      </div>

      <div className="sandbox-controls">
        <div className="form-group">
            <label htmlFor="hypothesis">Hypothesis (as a belief label):</label>
            <input
                type="text"
                id="hypothesis"
                value={hypothesisText}
                onChange={(e) => setHypothesisText(e.target.value)}
                placeholder="e.g., Chocolate is safe for cats"
            />
        </div>
        <div className="form-group">
            <label htmlFor="steps">Cognitive Steps to Run:</label>
            <input
                type="number"
                id="steps"
                value={steps}
                onChange={(e) => setSteps(parseInt(e.target.value, 10))}
            />
        </div>
        <button onClick={handleRunSandbox} disabled={isLoading}>
          {isLoading ? 'Running...' : 'Run Sandbox'}
        </button>
      </div>

        {error && <div className="error">Error: {error}</div>}

        {result && (
            <div className="sandbox-results">
                <h3>Sandbox Results</h3>
                <h4>New Items on Agenda:</h4>
                <pre>{JSON.stringify(result.newItems, null, 2)}</pre>
                <h4>Impacted Items:</h4>
                <pre>{JSON.stringify(result.impactedItems, null, 2)}</pre>
            </div>
        )}
    </div>
  );
}

export default SandboxView;