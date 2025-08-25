import { WorldModel } from '../world-model.js';
import { GoalConstraints } from '../types.js';

export interface GoalCompositionRequest {
  text: string;
}

export interface GoalCompositionResponse {
  suggestedGoal: string;
  detectedEntities: string[];
  priority: number;
  factors: string[];
  constraints?: GoalConstraints;
}

/**
 * A module for intelligent goal composition, using the WorldModel to enhance its suggestions.
 */
export class GoalCompositionModule {
  private worldModel: WorldModel;

  constructor(worldModel: WorldModel) {
    this.worldModel = worldModel;
  }

  /**
   * Parses trust constraints from the input text.
   * Example format: "Diagnose cat illness --trust-source=vetdb.org:0.9,some-other-source:0.7"
   * @param text The input text.
   * @returns A tuple containing the cleaned text and the parsed constraints.
   */
  private parseTrustConstraints(text: string): [string, GoalConstraints] {
    const constraints: GoalConstraints = {};
    const trustRegex = /--trust-source=([\w.-]+:\d\.\d+,?)+/g;
    const match = text.match(trustRegex);

    if (!match) {
      return [text, {}];
    }

    const cleanedText = text.replace(trustRegex, '').trim();
    const sourcesStr = match[0].replace('--trust-source=', '');
    const required_sources: Record<string, number> = {};

    sourcesStr.split(',').forEach(part => {
      const [source, scoreStr] = part.split(':');
      if (source && scoreStr) {
        const score = parseFloat(scoreStr);
        if (!isNaN(score)) {
          required_sources[source] = score;
        }
      }
    });

    if (Object.keys(required_sources).length > 0) {
      constraints.required_sources = required_sources;
    }

    return [cleanedText, constraints];
  }

  public compose(request: GoalCompositionRequest): GoalCompositionResponse {
    const [cleanedText, constraints] = this.parseTrustConstraints(request.text);
    const lowerText = cleanedText.toLowerCase();

    // TODO: Enhance entity detection using the WorldModel.
    // For now, we continue with simple keyword matching on the cleaned text.
    const detectedEntities: string[] = [];
    const factors: string[] = [];
    let priority = 0.5; // Base priority
    let suggestedGoal = cleanedText;

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
    if (constraints.required_sources && Object.keys(constraints.required_sources).length > 0) {
        priority += 0.1;
        factors.push('Specific trust constraints provided (+0.10)');
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
      constraints,
    };
  }
}
