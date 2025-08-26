import React, { useEffect, useRef } from 'react';
import { CognitiveItem } from './types';
import CognitiveItemCard from './CognitiveItemCard';
import './EventLog.css';

type EventLogProps = {
  items: CognitiveItem[];
};

const EventLog: React.FC<EventLogProps> = ({ items }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [items]);

  return (
    <div className="event-log-container">
      <h3>Cognitive Item Stream</h3>
      <div className="event-log" ref={logContainerRef}>
        {items.map((item) => (
          <CognitiveItemCard key={item.id} item={item} />
        ))}
        {items.length === 0 && <p>No items to display yet. Waiting for server...</p>}
      </div>
    </div>
  );
};

export default EventLog;
