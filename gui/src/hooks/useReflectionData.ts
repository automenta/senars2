import { useState, useEffect } from 'react';
import { ReflectionData } from '../../../core/src/modules/reflection';

const API_URL = 'http://localhost:3001/api/reflection';

export function useReflectionData() {
  const [data, setData] = useState<ReflectionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        setData(result);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Optionally, you could poll for this data or listen on the websocket for updates
    const interval = setInterval(fetchData, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);

  }, []);

  return { data, isLoading, error };
}
