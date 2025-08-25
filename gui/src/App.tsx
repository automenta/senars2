import './App.css';
import CognitiveFlowView from './components/CognitiveFlowView';
import { Menu, Search } from 'lucide-react'; // Using lucide-react for icons
import './components/Layout.css';

function App() {
  // The main view is now the CognitiveFlowView, replacing the tab-based navigation.
  // Other views can be accessed through a dropdown menu or other UI elements if needed.
  return (
    <div className="app-container">
      <header className="top-bar">
        <div className="logo">🧠 COGNITIVE AGENT</div>
        <nav className="nav-actions">
          {/* Placeholder for future navigation like a dropdown menu */}
          <button className="menu-button"><Menu size={20} /></button>
        </nav>
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Search across World Model..." />
        </div>
      </header>
      <main className="main-content">
        <CognitiveFlowView />
      </main>
    </div>
  );
}

export default App;