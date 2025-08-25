import React from 'react';
import './Layout.css';

type View = 'Agenda' | 'World Model' | 'Reflection' | 'Settings';

interface LayoutProps {
  children: React.ReactNode;
  activeView: View;
  onNavigate: (view: View) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onNavigate }) => {
  return (
    <div className="layout">
      <header className="app-header">
        <div className="logo">
          <span>🧠</span>
          <h1>COGNITIVE AGENT</h1>
        </div>
        <nav>
          {(['Agenda', 'World Model', 'Reflection', 'Settings'] as View[]).map((view) => (
            <button
              key={view}
              className={activeView === view ? 'active' : ''}
              onClick={() => onNavigate(view)}
            >
              {view}
            </button>
          ))}
        </nav>
        <div className="search-bar">
          <input type="search" placeholder="🔍 Search..." />
        </div>
      </header>
      <main className="main-content">{children}</main>
    </div>
  );
};

export default Layout;
