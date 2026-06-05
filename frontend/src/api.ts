const API_BASE_URL = typeof import.meta.env.VITE_API_URL === 'string' ? import.meta.env.VITE_API_URL : 'http://localhost:5000';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('asyncflow_token');
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    try {
      const errBody = await response.json();
      errorMessage = errBody.message || errorMessage;
    } catch {
      // Keep default
    }
    throw new Error(errorMessage);
  }

  // Handle empty or 204 responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  auth: {
    register: (body: any) => request<any>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body: any) => request<any>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    me: () => request<any>('/api/auth/me'),
    getUsers: () => request<any[]>('/api/auth/users'),
  },
  projects: {
    list: () => request<any[]>('/api/projects'),
    get: (id: string) => request<any>(`/api/projects/${id}`),
    create: (body: any) => request<any>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => request<any>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => request<any>(`/api/projects/${id}`, { method: 'DELETE' }),
    leave: (id: string) => request<any>(`/api/projects/${id}/leave`, { method: 'POST' }),
  },
  team: {
    addParticipant: (projectId: string, body: any) => request<any>(`/api/projects/${projectId}/participants`, { method: 'POST', body: JSON.stringify(body) }),
    removeParticipant: (projectId: string, userId: string) => request<any>(`/api/projects/${projectId}/participants/${userId}`, { method: 'DELETE' }),
    updateRole: (projectId: string, userId: string, roleName: string) => request<any>(`/api/projects/${projectId}/participants/${userId}/role`, { method: 'PUT', body: JSON.stringify({ roleName }) }),
  },
  issues: {
    list: (projectId: string, search?: string, onlyMyIssues?: boolean) => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (onlyMyIssues) params.append('onlyMyIssues', 'true');
      return request<any[]>(`/api/projects/${projectId}/issues?${params.toString()}`);
    },
    get: (id: string) => request<any>(`/api/issues/${id}`),
    create: (projectId: string, body: any) => request<any>(`/api/projects/${projectId}/issues`, { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => request<any>(`/api/issues/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    updateStatus: (id: string, statusId: number) => request<any>(`/api/issues/${id}/status`, { method: 'PUT', body: JSON.stringify({ statusId }) }),
    delete: (id: string) => request<any>(`/api/issues/${id}`, { method: 'DELETE' }),
  },
  comments: {
    list: (issueId: string) => request<any[]>(`/api/issues/${issueId}/comments`),
    create: (issueId: string, body: any) => request<any>(`/api/issues/${issueId}/comments`, { method: 'POST', body: JSON.stringify(body) }),
  }
};
