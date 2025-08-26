const API_BASE_URL = 'http://localhost:3001/api';

async function post(endpoint: string, body: any) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred.' }));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

async function get(endpoint: string) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred.' }));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }
    return response.json();
}

export const apiClient = {
  getReflectionData: () => {
    return get('/reflection');
  },

  runSandbox: (hypothesis: any, steps: number) => {
    return post('/sandbox/run', { hypothesis, steps });
  },

  composeGoal: (text: string) => {
    return post('/compose-goal', { text });
  },

  submitInput: (data: string) => {
    return post('/input', { data });
  },
};
