import { useState } from 'react';
import './App.css';
import AgendaView from './components/AgendaView';
import WorldModelView from './components/WorldModelView';
import ReflectionView from './components/ReflectionView';
import SandboxView from './components/SandboxView';
import SettingsView from './components/SettingsView';
import StatusBar from './components/StatusBar';
import NewGoalForm from './components/NewGoalForm'; // Import the form
import { useAgentState } from './hooks/useAgentState';
import { Menu, Search, BrainCircuit, Book, FlaskConical, Settings } from 'lucide-react';
import './components/Layout.css';

type View = 'Agenda' | 'World Model' | 'Reflection' | 'Sandbox' | 'Settings';

const viewIcons = {
  'Agenda': <BrainCircuit size={18} />,
  'World Model': <Book size={18} />,
  'Reflection': <FlaskConical size={18} />,
  'Sandbox': <FlaskConical size={18} />,
  'Settings': <Settings size={18} />,
};

function App() {
  const { state, isConnected, error } = useAgentState();
  const [activeView, setActiveView] = useState<View>('Agenda');
  const [isNewGoalFormOpen, setIsNewGoalFormOpen] = useState(false); // State for the modal

  const renderView = () => {
    switch (activeView) {
      case 'Agenda':
        // Pass down the state and the function to open the form
        return <AgendaView
                  agendaItems={state.agenda}
                  goalTree={state.goalTree}
                  worldModel={state.worldModel}
                  onNewGoalClick={() => setIsNewGoalFormOpen(true)}
               />;
      case 'World Model':
        return <WorldModelView worldModelAtoms={state.worldModel} worldModelItems={state.worldModelItems} />;
      case 'Reflection':
        return <ReflectionView />;
      case 'Sandbox':
        return <SandboxView />;
      case 'Settings':
        return <SettingsView />;
      default:
        return <AgendaView
                  agendaItems={state.agenda}
                  goalTree={state.goalTree}
                  worldModel={state.worldModel}
                  onNewGoalClick={() => setIsNewGoalFormOpen(true)}
               />;
    }
  };

  return (
    <div className="app-container">
      {/* Conditionally render the modal */}
      {isNewGoalFormOpen && <NewGoalForm onClose={() => setIsNewGoalFormOpen(false)} />}

      <header className="top-bar">
        <div className="logo">🧠 COGNITIVE AGENT</div>
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Search across World Model..." />
        </div>
        <nav className="nav-actions">
          <button className="menu-button"><Menu size={20} /></button>
        </nav>
      </header>
      <div className="main-content-area">
        <nav className="view-navigation">
          {(['Agenda', 'World Model', 'Reflection', 'Sandbox', 'Settings'] as View[]).map(view => (
            <button
              key={view}
              className={`nav-button ${activeView === view ? 'active' : ''}`}
              onClick={() => setActiveView(view)}
            >
              {viewIcons[view]}
              <span>{view}</span>
            </button>
          ))}
        </nav>
        <main className="view-panel">
          {renderView()}
        </main>
      </div>
      <StatusBar isConnected={isConnected} error={error} />
    </div>
  );
}

export default App;