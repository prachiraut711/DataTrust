import type { AuthResponse, User } from "@/types/auth";
import type { Dataset, DatasetDetail } from "@/types/dataset";
import type { DatasetProfileResponse } from "@/types/profile";
import type {
  QualityEvaluationResponse,
  QualityRule,
  QualityRuleCreate,
  QualityRuleUpdate,
} from "@/types/quality";


export interface HealthResponse {
  status: string;
  service: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        if (typeof errorData.detail === "string") {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map((d: { msg?: string }) => d.msg || "Validation error").join(", ");
        }
      }
    } catch {
      // Use fallback status text if response is not JSON
      if (response.statusText) {
        errorMessage = response.statusText;
      }
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`, {
    headers: {
      Accept: "application/json",
    },
  });
  return handleResponse<HealthResponse>(response);
}

export async function registerApi(data: {
  email: string;
  password: string;
  full_name: string;
}): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<AuthResponse>(response);
}

export async function loginApi(data: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<AuthResponse>(response);
}

export async function getMeApi(token: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  return handleResponse<User>(response);
}

export async function getDatasetsApi(token: string): Promise<Dataset[]> {
  const response = await fetch(`${API_BASE_URL}/api/datasets`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  return handleResponse<Dataset[]>(response);
}

export async function getDatasetDetailApi(token: string, id: string): Promise<DatasetDetail> {
  const response = await fetch(`${API_BASE_URL}/api/datasets/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  return handleResponse<DatasetDetail>(response);
}

export async function uploadDatasetApi(token: string, formData: FormData): Promise<DatasetDetail> {
  const response = await fetch(`${API_BASE_URL}/api/datasets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      // Let browser set multipart/form-data boundary automatically
    },
    body: formData,
  });
  return handleResponse<DatasetDetail>(response);
}

export async function deleteDatasetApi(
  token: string,
  id: string
): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/datasets/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  return handleResponse<{ status: string; message: string }>(response);
}

export async function getDatasetProfileApi(
  token: string,
  id: string
): Promise<DatasetProfileResponse> {
  const response = await fetch(`${API_BASE_URL}/api/datasets/${id}/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  return handleResponse<DatasetProfileResponse>(response);
}

export async function getQualityRulesApi(
  token: string,
  datasetId: string
): Promise<QualityRule[]> {
  const response = await fetch(`${API_BASE_URL}/api/datasets/${datasetId}/quality-rules`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  return handleResponse<QualityRule[]>(response);
}

export async function createQualityRuleApi(
  token: string,
  datasetId: string,
  rule: QualityRuleCreate
): Promise<QualityRule> {
  const response = await fetch(`${API_BASE_URL}/api/datasets/${datasetId}/quality-rules`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(rule),
  });
  return handleResponse<QualityRule>(response);
}

export async function updateQualityRuleApi(
  token: string,
  datasetId: string,
  ruleId: string,
  rule: QualityRuleUpdate
): Promise<QualityRule> {
  const response = await fetch(
    `${API_BASE_URL}/api/datasets/${datasetId}/quality-rules/${ruleId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(rule),
    }
  );
  return handleResponse<QualityRule>(response);
}

export async function deleteQualityRuleApi(
  token: string,
  datasetId: string,
  ruleId: string
): Promise<{ status: string; message: string }> {
  const response = await fetch(
    `${API_BASE_URL}/api/datasets/${datasetId}/quality-rules/${ruleId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );
  return handleResponse<{ status: string; message: string }>(response);
}

export async function evaluateQualityRulesApi(
  token: string,
  datasetId: string
): Promise<QualityEvaluationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/datasets/${datasetId}/quality/evaluate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  return handleResponse<QualityEvaluationResponse>(response);
}


