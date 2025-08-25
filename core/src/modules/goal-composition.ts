export interface GoalCompositionRequest {
  text: string;
}

export interface GoalCompositionResponse {
  suggestedGoal: string;
  detectedEntities: string[];
  priority: number;
  factors: string[];
}

// A simple rule-based system for intelligent goal composition
export class GoalCompositionModule {

  public compose(request: GoalCompositionRequest): GoalCompositionResponse {
    const { text } = request;
    const lowerText = text.toLowerCase();

    const detectedEntities: string[] = [];
    const factors: string[] = [];
    let priority = 0.5; // Base priority
    let suggestedGoal = text;

    // Entity Detection (simple keyword matching)
    if (lowerText.includes('cat')) detectedEntities.push('cat');
    if (lowerText.includes('dog')) detectedEntities.push('dog');
    if (lowerText.includes('chocolate')) detectedEntities.push('chocolate');
    if (lowerText.includes('sick') || lowerText.includes('ill')) detectedEntities.push('sick');

    // Priority Calculation
    if (lowerText.includes('sick') || lowerText.includes('illness') || lowerText.includes('toxic')) {
      priority += 0.30;
      factors.push('Medical urgency (+0.30)');
    }
    if (detectedEntities.length > 1) {
      priority += 0.15;
      factors.push('Multiple entities detected (+0.15)');
    }

    // Goal Suggestion
    if (lowerText.startsWith('diagnose')) {
      suggestedGoal = `Diagnose condition of ${detectedEntities.join(', ')}`;
    } else if (detectedEntities.includes('sick') && (detectedEntities.includes('cat') || detectedEntities.includes('dog'))) {
      const animal = detectedEntities.includes('cat') ? 'cat' : 'dog';
      const potentialToxin = detectedEntities.find(e => e !== animal && e !== 'sick');
      if (potentialToxin) {
        suggestedGoal = `Diagnose ${potentialToxin} toxicity in ${animal}`;
      } else {
        suggestedGoal = `Diagnose illness in ${animal}`;
      }
    }

    // Clamp priority between 0 and 1
    priority = Math.max(0, Math.min(1, priority));

    return {
      suggestedGoal,
      detectedEntities,
      priority: parseFloat(priority.toFixed(2)),
      factors,
    };
  }
}
