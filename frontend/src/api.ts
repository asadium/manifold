const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

export interface Target {
  id: number;
  name: string;
  address: string;
  created_at: string;
}

export interface TargetCreate {
  name: string;
  address: string;
}

export interface DeploymentPreviewResponse {
  ok: boolean;
  target_id: number;
  image?: string;
  container_name?: string;
  ports?: string;
  compose_file_path?: string;
  summary: string;
}

export interface DeploymentStatus {
  id: number;
  target_id: number;
  image?: string;
  container_name?: string;
  compose_file_path?: string;
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

export interface DeploymentRequest {
  targetId: number;
  // Single container deployment
  image?: string;
  containerName?: string;
  ports?: string;
  // Docker Compose deployment
  composeFilePath?: string;
}

export async function previewDeployment(
  request: DeploymentRequest
): Promise<DeploymentPreviewResponse> {
  const body: any = {
    target_id: request.targetId,
  };
  
  if (request.composeFilePath) {
    body.compose_file_path = request.composeFilePath;
  } else {
    body.image = request.image;
    body.container_name = request.containerName;
    if (request.ports) {
      body.ports = request.ports;
    }
  }
  
  const response = await fetch(`${API_BASE}/deployments/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to preview deployment: ${errorText}`);
  }
  return response.json();
}

export async function applyDeployment(
  request: DeploymentRequest
): Promise<DeploymentStatus> {
  const body: any = {
    target_id: request.targetId,
  };
  
  if (request.composeFilePath) {
    body.compose_file_path = request.composeFilePath;
  } else {
    body.image = request.image;
    body.container_name = request.containerName;
    if (request.ports) {
      body.ports = request.ports;
    }
  }
  
  const response = await fetch(`${API_BASE}/deployments/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to apply deployment: ${errorText}`);
  }
  return response.json();
}

