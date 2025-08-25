import { useState } from 'react';
import './App.css';
import AgendaView from './components/AgendaView';
import WorldModelView from './components/WorldModelView';
import ReflectionView from './components/ReflectionView';
import SettingsView from './components/SettingsView';
import SandboxView from './components/SandboxView';
import './components/Layout.css'; // Import the new layout CSS

function App() {
  const [activeView, setActiveView] = useState('Agenda');

  const renderView = () => {
    switch (activeView) {
      case 'Agenda':
        return <AgendaView />;
      case 'World Model':
        return <WorldModelView />;
      case 'Reflection':
        return <ReflectionView />;
      case 'Settings':
        return <SettingsView />;
      case 'Sandbox':
        return <SandboxView />;
      default:
        return <AgendaView />;
    }
  };

  return (
    <div className="app-container">
      <header className="top-bar">
        <div className="logo">COGNITIVE AGENT</div>
        <nav className="nav-tabs">
          <button onClick={() => setActiveView('Agenda')} className={activeView === 'Agenda' ? 'active' : ''}>Agenda</button>
          <button onClick={() => setActiveView('World Model')} className={activeView === 'World Model' ? 'active' : ''}>World Model</button>
          <button onClick={() => setActiveView('Reflection')} className={activeView === 'Reflection' ? 'active' : ''}>Reflection</button>
          <button onClick={() => setActiveView('Settings')} className={activeView === 'Settings' ? 'active' : ''}>Settings</button>
          <button onClick={() => setActiveView('Sandbox')} className={activeView === 'Sandbox' ? 'active' : ''}>🧪 Sandbox</button>
        </nav>
        <div className="search-bar">
          <input type="text" placeholder="🔍 Search" />
        </div>
      </header>
      <main className="main-content">
        {renderView()}
      </main>
    </div>
  );
}

export default App;