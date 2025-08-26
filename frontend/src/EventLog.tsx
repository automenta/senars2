import React, { useEffect, useRef } from 'react';
import './EventLog.css';

type Event = {
  timestamp: string;
  data: string;
};

type EventLogProps = {
  events: Event[];
};

const EventLog: React.FC<EventLogProps> = ({ events }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="event-log-container">
      <h3>Agent Event Stream</h3>
      <div className="event-log" ref={logContainerRef}>
        {events.map((event, index) => (
          <div key={index} className="event-item">
            <span className="event-timestamp">{event.timestamp}</span>
            <pre className="event-data">{event.data}</pre>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventLog;
