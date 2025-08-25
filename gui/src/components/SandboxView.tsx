import React, { useState } from 'react';

function SandboxView() {
  const [hypothesis, setHypothesis] = useState("What if chocolate was safe for cats?");
  const [activeTab, setActiveTab] = useState('impact');

  const impactAssessment = {
    risk: "HIGH RISK",
    dependentBeliefs: 12,
    contradictions: [
      {
        belief: "(is_toxic_to chocolate dogs)",
        confidence: 0.95,
        issue: "contradiction"
      }
    ],
    schemaReliabilityDrop: {
      schema: "SpeciesToxicityTransfer",
      from: 0.90,
      to: 0.45
    }
  };

  const moderateImpact = {
    systemTrustDecrease: 15,
    contradictionRate: {
      value: 0.08,
      threshold: 0.05
    }
  };

  const mitigationOptions = [
    "Reduce petblog.com trust score to 0.30",
    "Add species-specific metabolism data"
  ];

  const relatedScenarios = [
    {
      scenario: "What if vetdb.org trust was 0.70?",
      risk: "Contradiction risk: 45%"
    },
    {
      scenario: "What if cats metabolize theobromine 3x faster?",
      confidence: "Toxicity confidence: 0.92"
    },
    {
      scenario: "What if new study shows safe doses?",
      requirement: "Would require dose-threshold schema"
    }
  ];

  return (
    <div className="sandbox-view">
      <div className="sandbox-header">
        <h2>🧪 WHAT-IF ANALYSIS: "{hypothesis}"</h2>
      </div>

      <div className="sandbox-tabs">
        <button 
          className={activeTab === 'impact' ? 'active' : ''}
          onClick={() => setActiveTab('impact')}
        >
          Impact Assessment
        </button>
        <button 
          className={activeTab === 'scenarios' ? 'active' : ''}
          onClick={() => setActiveTab('scenarios')}
        >
          Related Scenarios
        </button>
      </div>

      {activeTab === 'impact' && (
        <div className="sandbox-content">
          <div className="impact-section">
            <h3>IMPACT ASSESSMENT</h3>
            
            <div className="risk-assessment">
              <h4>🔴 {impactAssessment.risk}: {impactAssessment.dependentBeliefs} dependent beliefs at risk</h4>
              <ul>
                <li>{impactAssessment.contradictions[0].belief} [{impactAssessment.contradictions[0].confidence}] - {impactAssessment.contradictions[0].issue}</li>
              </ul>
              <p>• {impactAssessment.schemaReliabilityDrop.schema} schema reliability would drop to {impactAssessment.schemaReliabilityDrop.to}</p>
            </div>

            <div className="moderate-impact">
              <h4>🟡 MODERATE IMPACT:</h4>
              <p>• System trust score would decrease by {moderateImpact.systemTrustDecrease}%</p>
              <p>• Contradiction rate would reach {moderateImpact.contradictionRate.value} (exceeds {moderateImpact.contradictionRate.threshold} threshold)</p>
            </div>

            <div className="mitigation-options">
              <h4>🟢 MITIGATION OPTIONS:</h4>
              <ul>
                {mitigationOptions.map((option, index) => (
                  <li key={index}>• {option}</li>
                ))}
              </ul>
            </div>

            <div className="sandbox-actions">
              <button className="accept-button">ACCEPT HYPOTHESIS</button>
              <button className="modify-button">MODIFY</button>
              <button className="reject-button">REJECT</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'scenarios' && (
        <div className="scenarios-section">
          <h3>RELATED SCENARIOS</h3>
          {relatedScenarios.map((scenario, index) => (
            <div key={index} className="scenario-item">
              <p>• {scenario.scenario} → {scenario.risk || scenario.confidence || scenario.requirement}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SandboxView;