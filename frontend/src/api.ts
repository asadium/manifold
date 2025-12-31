const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

export interface Target {
  id: number;
  name: string;
  address: string;
  ssh_key_path: string;
  ssh_user: string;
  created_at: string;
}

export interface TargetCreate {
  name: string;
  address: string;
  ssh_key_path: string;
  ssh_user?: string;
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

export interface DeploymentLog {
  timestamp: string;
  level: string;
  message: string;
}

export async function getDeploymentLogs(deploymentId: number): Promise<DeploymentLog[]> {
  const response = await fetch(`${API_BASE}/deployments/${deploymentId}/logs`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get deployment logs: ${errorText}`);
  }
  return response.json();
}

export interface Container {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
}

export async function getTargetContainers(targetId: number): Promise<Container[]> {
  const response = await fetch(`${API_BASE}/targets/${targetId}/containers`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get containers: ${errorText}`);
  }
  return response.json();
}

export async function getContainerLogs(targetId: number, containerName: string, lines: number = 100): Promise<string> {
  const response = await fetch(`${API_BASE}/targets/${targetId}/containers/${encodeURIComponent(containerName)}/logs?lines=${lines}`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get container logs: ${errorText}`);
  }
  const data = await response.json();
  return data.logs;
}

export async function getContainerEnv(targetId: number, containerName: string): Promise<Record<string, string>> {
  const response = await fetch(`${API_BASE}/targets/${targetId}/containers/${encodeURIComponent(containerName)}/env`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get container env: ${errorText}`);
  }
  const data = await response.json();
  return data.env;
}

export async function updateContainerEnv(targetId: number, containerName: string, env: Record<string, string>): Promise<string> {
  const response = await fetch(`${API_BASE}/targets/${targetId}/containers/${encodeURIComponent(containerName)}/env`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ env }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update container env: ${errorText}`);
  }
  const data = await response.json();
  return data.message;
}

export async function getTargetEnv(targetId: number): Promise<Record<string, string>> {
  const response = await fetch(`${API_BASE}/targets/${targetId}/env`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get target env: ${errorText}`);
  }
  const data = await response.json();
  return data.env;
}

export async function updateTargetEnv(targetId: number, env: Record<string, string>): Promise<string> {
  const response = await fetch(`${API_BASE}/targets/${targetId}/env`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ env }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update target env: ${errorText}`);
  }
  const data = await response.json();
  return data.message;
}

