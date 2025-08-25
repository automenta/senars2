import React, { useState } from 'react';

function SettingsView() {
  const [settings, setSettings] = useState({
    theme: 'light',
    notifications: true,
    autoRefresh: true,
    refreshInterval: 5000,
    trustThreshold: 0.7,
    contradictionThreshold: 0.05,
    memoryCompaction: true,
    compactInterval: 3600000
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : 
              type === 'number' ? Number(value) : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Settings saved:', settings);
    // In a real app, you would send these settings to the backend
  };

  return (
    <div className="settings-view">
      <h2>Settings</h2>
      
      <form onSubmit={handleSubmit} className="settings-form">
        <div className="setting-group">
          <h3>Appearance</h3>
          <div className="setting-item">
            <label htmlFor="theme">Theme:</label>
            <select 
              id="theme" 
              name="theme" 
              value={settings.theme} 
              onChange={handleChange}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto</option>
            </select>
          </div>
        </div>

        <div className="setting-group">
          <h3>Notifications</h3>
          <div className="setting-item">
            <label htmlFor="notifications">
              <input
                type="checkbox"
                id="notifications"
                name="notifications"
                checked={settings.notifications}
                onChange={handleChange}
              />
              Enable notifications
            </label>
          </div>
        </div>

        <div className="setting-group">
          <h3>Data Refresh</h3>
          <div className="setting-item">
            <label htmlFor="autoRefresh">
              <input
                type="checkbox"
                id="autoRefresh"
                name="autoRefresh"
                checked={settings.autoRefresh}
                onChange={handleChange}
              />
              Auto-refresh data
            </label>
          </div>
          <div className="setting-item">
            <label htmlFor="refreshInterval">Refresh interval (ms):</label>
            <input
              type="number"
              id="refreshInterval"
              name="refreshInterval"
              value={settings.refreshInterval}
              onChange={handleChange}
              min="1000"
              step="1000"
            />
          </div>
        </div>

        <div className="setting-group">
          <h3>Trust & Contradictions</h3>
          <div className="setting-item">
            <label htmlFor="trustThreshold">Minimum trust threshold:</label>
            <input
              type="number"
              id="trustThreshold"
              name="trustThreshold"
              value={settings.trustThreshold}
              onChange={handleChange}
              min="0"
              max="1"
              step="0.05"
            />
          </div>
          <div className="setting-item">
            <label htmlFor="contradictionThreshold">Contradiction threshold:</label>
            <input
              type="number"
              id="contradictionThreshold"
              name="contradictionThreshold"
              value={settings.contradictionThreshold}
              onChange={handleChange}
              min="0"
              max="1"
              step="0.01"
            />
          </div>
        </div>

        <div className="setting-group">
          <h3>Memory Management</h3>
          <div className="setting-item">
            <label htmlFor="memoryCompaction">
              <input
                type="checkbox"
                id="memoryCompaction"
                name="memoryCompaction"
                checked={settings.memoryCompaction}
                onChange={handleChange}
              />
              Enable automatic memory compaction
            </label>
          </div>
          <div className="setting-item">
            <label htmlFor="compactInterval">Compaction interval (ms):</label>
            <input
              type="number"
              id="compactInterval"
              name="compactInterval"
              value={settings.compactInterval}
              onChange={handleChange}
              min="60000"
              step="60000"
            />
          </div>
        </div>

        <button type="submit" className="save-button">Save Settings</button>
      </form>
    </div>
  );
}

export default SettingsView;