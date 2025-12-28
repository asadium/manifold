const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

export type TargetType = "kubernetes" | "vm";

export interface Target {
  id: number;
  name: string;
  type: TargetType;
  address: string;
  created_at: string;
}

export interface TargetCreate {
  name: string;
  type: TargetType;
  address: string;
}

export interface DeploymentPreviewResponse {
  ok: boolean;
  target_id: number;
  manifest_path: string;
  summary: string;
}

export interface DeploymentStatus {
  id: number;
  target_id: number;
  status: "queued" | "running" | "success" | "failed";
  message: string;
  created_at: string;
}

export async function getTargets(): Promise<Target[]> {
  const response = await fetch(`${API_BASE}/targets`);
  if (!response.ok) {
    throw new Error(`Failed to fetch targets: ${response.statusText}`);
  }
  return response.json();
}

export async function createTarget(payload: TargetCreate): Promise<Target> {
  const response = await fetch(`${API_BASE}/targets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to create target: ${response.statusText}`);
  }
  return response.json();
}

export async function previewDeployment(
  targetId: number,
  manifestPath: string
): Promise<DeploymentPreviewResponse> {
  const response = await fetch(`${API_BASE}/deployments/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target_id: targetId,
      manifest_path: manifestPath,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to preview deployment: ${response.statusText}`);
  }
  return response.json();
}

export async function applyDeployment(
  targetId: number,
  manifestPath: string
): Promise<DeploymentStatus> {
  const response = await fetch(`${API_BASE}/deployments/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target_id: targetId,
      manifest_path: manifestPath,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to apply deployment: ${response.statusText}`);
  }
  return response.json();
}

