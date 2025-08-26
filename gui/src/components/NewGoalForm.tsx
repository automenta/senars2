import React, { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';
import { apiClient } from '../apiClient';

interface NewGoalFormProps {
  onClose: () => void;
}

interface CompositionResponse {
  suggestedGoal: string;
  detectedEntities: string[];
  priority: number;
  factors: string[];
}

const NewGoalForm: React.FC<NewGoalFormProps> = ({ onClose }) => {
  const [goalText, setGoalText] = useState('');
  const [composition, setComposition] = useState<CompositionResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComposition = useCallback(debounce(async (text: string) => {
    if (text.trim().length < 10) { // Don't fetch for very short strings
      setComposition(null);
      return;
    }
    try {
      const data = await apiClient.composeGoal(text);
      setComposition(data);
    } catch (err) {
      console.error('Failed to fetch goal composition:', err);
      // Not showing this error to the user as it's a background process
    }
  }, 500), []); // 500ms debounce delay

  useEffect(() => {
    fetchComposition(goalText);
  }, [goalText, fetchComposition]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const textToSubmit = composition?.suggestedGoal || goalText;
    if (!textToSubmit.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await apiClient.submitInput(`GOAL: ${textToSubmit}`);
      console.log('Goal submitted successfully');
      setGoalText('');
      onClose(); // Close the form on successful submission
    } catch (err: any) {
      console.error('Error submitting goal:', err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="new-goal-form-overlay">
      <div className="new-goal-form">
        <header>
          <h3>Create a New Goal</h3>
          <button onClick={onClose} className="close-button">&times;</button>
        </header>
        <form onSubmit={handleSubmit}>
          {error && <p className="error-message">{error}</p>}
          <div className="form-group">
            <label htmlFor="goal-text">Goal Description</label>
            <textarea
              id="goal-text"
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              placeholder="e.g., My cat seems sick after eating chocolate"
              rows={4}
              required
            />
          </div>

          {composition && (
            <div className="intelligent-composition">
              <div className="detected-entities">
                <strong>Detected Entities:</strong>
                {composition.detectedEntities.map(e => <span key={e} className="entity-tag">{e}</span>)}
              </div>
              <p><strong>Suggested Goal:</strong> {composition.suggestedGoal}</p>
              <p><strong>Calculated Priority:</strong> {composition.priority} ({composition.factors.join(', ')})</p>
            </div>
          )}

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-button">Cancel</button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewGoalForm;
