import React from 'react';
import './StatusBar.css';

interface StatusBarProps {
  isConnected: boolean;
  error: string | null;
}

const StatusBar: React.FC<StatusBarProps> = ({ isConnected, error }) => {
  let statusText = 'Connecting...';
  let statusClass = 'connecting';

  if (error) {
    statusText = `Error: ${error}`;
    statusClass = 'error';
  } else if (isConnected) {
    statusText = 'Connected';
    statusClass = 'connected';
  }

  return (
    <footer className={`status-bar ${statusClass}`}>
      <div className="status-indicator"></div>
      <span className="status-text">{statusText}</span>
    </footer>
  );
};

export default StatusBar;
