import './App.css';
import CognitiveFlowView from './components/CognitiveFlowView';
import WorldModelView from './components/WorldModelView';
import StatusBar from './components/StatusBar';
import { useAgentState } from './hooks/useAgentState';
import { Menu, Search } from 'lucide-react';
import './components/Layout.css';

function App() {
  const { state, isConnected, error } = useAgentState();

  return (
    <div className="app-container">
      <header className="top-bar">
        <div className="logo">🧠 COGNITIVE AGENT</div>
        <nav className="nav-actions">
          <button className="menu-button"><Menu size={20} /></button>
        </nav>
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Search across World Model..." />
        </div>
      </header>
      <main className="main-content">
        <CognitiveFlowView />
        <WorldModelView
          worldModelAtoms={state.worldModel}
          worldModelItems={state.worldModelItems}
        />
      </main>
      <StatusBar isConnected={isConnected} error={error} />
    </div>
  );
}

export default App;