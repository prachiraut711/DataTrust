export interface HealthResponse {
  status: string;
  service: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API health check failed with status ${response.status}`);
  }

  return response.json();
}
