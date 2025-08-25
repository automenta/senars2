import React, { useState } from 'react';
import Layout from './components/Layout';
import AgendaView from './components/AgendaView';
import WorldModelView from './components/WorldModelView';
import ReflectionView from './components/ReflectionView';
import SettingsView from './components/SettingsView';

type View = 'Agenda' | 'World Model' | 'Reflection' | 'Settings';

function App() {
  const [activeView, setActiveView] = useState<View>('Agenda');

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
      default:
        return <AgendaView />;
    }
  };

  return (
    <Layout activeView={activeView} onNavigate={setActiveView}>
      {renderView()}
    </Layout>
  );
}

export default App;
