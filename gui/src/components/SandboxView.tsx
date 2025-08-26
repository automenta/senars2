import React, { useState } from 'react';
import { SandboxHypothesis, SandboxResult } from '../../../core/src/sandbox-service';
import { CognitiveItem } from '../types';
import { apiClient } from '../apiClient';
import './SandboxView.css';
import { AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';

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
        type: 'add_item',
        item: {
            id: 'hypothesis-item' as any,
            atom_id: 'hypothesis-atom' as any,
            type: 'BELIEF',
            truth: { frequency: 0.0, confidence: 0.99 },
            label: hypothesisText,
            attention: { priority: 1.0, durability: 1.0 },
            stamp: { timestamp: Date.now(), parent_ids: [], schema_id: 'hypothesis-schema' as any },
        }
      };

      const data = await apiClient.runSandbox(hypothesis, steps);
      setResult(data);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderCognitiveItem = (item: CognitiveItem) => (
    <div key={item.id} className="cognitive-item-summary">
        <span className={`item-type-badge ${item.type}`}>{item.type}</span>
        <span className="item-label">{item.label || item.id}</span>
        {item.truth && <span className="item-truth">T: {item.truth.confidence.toFixed(2)}</span>}
        {item.attention && <span className="item-priority">P: {item.attention.priority.toFixed(2)}</span>}
    </div>
  )

  return (
    <div className="view-container sandbox-view">
      <div className="sandbox-header">
        <h2>🧪 What-If Analysis Sandbox</h2>
        <p>Introduce a temporary, hypothetical belief into the system and observe the immediate cognitive reaction.</p>
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
        <button onClick={handleRunSandbox} disabled={isLoading || !hypothesisText}>
          {isLoading ? 'Running...' : 'Run Sandbox'}
        </button>
      </div>

        {error && <div className="error-box"><strong>Error:</strong> {error}</div>}

        {result && (
            <div className="sandbox-results">
                <h3>Sandbox Results</h3>

                <h4>New Items on Agenda ({result.newItems.length}):</h4>
                <div className="results-list">
                    {result.newItems.length > 0
                        ? result.newItems.map(renderCognitiveItem)
                        : <p>No new items were added to the agenda.</p>
                    }
                </div>

                <h4>Impacted Items in World Model ({result.impactedItems.length}):</h4>
                <div className="results-list">
                    {result.impactedItems.length > 0
                        ? result.impactedItems.map(renderCognitiveItem)
                        : <p>No existing items in the world model were impacted.</p>
                    }
                </div>
            </div>
        )}
    </div>
  );
}

export default SandboxView;