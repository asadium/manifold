import { useState, FormEvent } from "react";
import { Target, previewDeployment, applyDeployment, DeploymentPreviewResponse, DeploymentStatus } from "../api";
import "./DeploymentForm.css";

interface DeploymentFormProps {
  targets: Target[];
  onDeploy?: (deployment: DeploymentStatus) => void;
  onClose?: () => void;
}

type DeploymentType = "single" | "compose";

export default function DeploymentForm({ targets, onDeploy, onClose }: DeploymentFormProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<number | "">("");
  const [deploymentType, setDeploymentType] = useState<DeploymentType>("single");
  // Single container fields
  const [image, setImage] = useState("");
  const [containerName, setContainerName] = useState("");
  const [ports, setPorts] = useState("");
  // Docker Compose field
  const [composeFilePath, setComposeFilePath] = useState("");
  
  const [previewResult, setPreviewResult] = useState<DeploymentPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!selectedTargetId) {
      setError("Please select a VM target");
      return;
    }
    
    if (deploymentType === "single") {
      if (!image || !containerName) {
        setError("Please fill in image and container name");
        return;
      }
    } else {
      if (!composeFilePath) {
        setError("Please provide a Docker Compose file path");
        return;
      }
    }

    setLoading(true);
    setError(null);
    setPreviewResult(null);

    try {
      const result = await previewDeployment({
        targetId: selectedTargetId as number,
        image: deploymentType === "single" ? image : undefined,
        containerName: deploymentType === "single" ? containerName : undefined,
        ports: deploymentType === "single" ? (ports || undefined) : undefined,
        composeFilePath: deploymentType === "compose" ? composeFilePath : undefined,
      });
      setPreviewResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview deployment");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedTargetId) {
      setError("Please select a VM target");
      return;
    }

    if (deploymentType === "single") {
      if (!image || !containerName) {
        setError("Please fill in image and container name");
        return;
      }
    } else {
      if (!composeFilePath) {
        setError("Please provide a Docker Compose file path");
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const result = await applyDeployment({
        targetId: selectedTargetId as number,
        image: deploymentType === "single" ? image : undefined,
        containerName: deploymentType === "single" ? containerName : undefined,
        ports: deploymentType === "single" ? (ports || undefined) : undefined,
        composeFilePath: deploymentType === "compose" ? composeFilePath : undefined,
      });
      
      if (onDeploy) {
        onDeploy(result);
      }
      if (onClose) {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply deployment");
      setLoading(false);
    }
  };

  const isFormValid = () => {
    if (!selectedTargetId) return false;
    if (deploymentType === "single") {
      return !!(image && containerName);
    } else {
      return !!composeFilePath;
    }
  };

  return (
    <div className="deployment-form">
      <form onSubmit={handleApply}>
        <div className="form-group">
          <label htmlFor="target-select">VM Target</label>
          <select
            id="target-select"
            value={selectedTargetId}
            onChange={(e) => setSelectedTargetId(e.target.value ? Number(e.target.value) : "")}
            required
          >
            <option value="">Select a VM target...</option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name} ({target.address})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Deployment Type</label>
          <div className="deployment-type-selector">
            <label className="radio-label">
              <input
                type="radio"
                name="deployment-type"
                value="single"
                checked={deploymentType === "single"}
                onChange={(e) => setDeploymentType(e.target.value as DeploymentType)}
              />
              Single Container
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="deployment-type"
                value="compose"
                checked={deploymentType === "compose"}
                onChange={(e) => setDeploymentType(e.target.value as DeploymentType)}
              />
              Docker Compose
            </label>
          </div>
        </div>

        {deploymentType === "single" ? (
          <>
            <div className="form-group">
              <label htmlFor="image">Docker Image</label>
              <input
                id="image"
                type="text"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                required
                placeholder="e.g., nginx:latest or myapp:v1.0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="container-name">Container Name</label>
              <input
                id="container-name"
                type="text"
                value={containerName}
                onChange={(e) => setContainerName(e.target.value)}
                required
                placeholder="e.g., my-nginx-container"
              />
            </div>

            <div className="form-group">
              <label htmlFor="ports">Port Mapping (Optional)</label>
              <input
                id="ports"
                type="text"
                value={ports}
                onChange={(e) => setPorts(e.target.value)}
                placeholder="e.g., 8080:80 or 8080:80,8443:443"
              />
            </div>
          </>
        ) : (
          <div className="form-group">
            <label htmlFor="compose-file">Docker Compose File Path</label>
            <input
              id="compose-file"
              type="text"
              value={composeFilePath}
              onChange={(e) => setComposeFilePath(e.target.value)}
              required
              placeholder="e.g., /path/to/docker-compose.yml"
            />
            <small className="form-hint">
              Path to the docker-compose.yml file on the VM
            </small>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        {previewResult && (
          <div className="preview-result">
            <h4>Preview:</h4>
            <p>{previewResult.summary}</p>
          </div>
        )}

        <div className="button-group">
          <button
            type="button"
            onClick={handlePreview}
            disabled={loading || !isFormValid()}
            className="preview-button"
          >
            {loading ? "Loading..." : "Preview"}
          </button>
          <button
            type="submit"
            disabled={loading || !isFormValid()}
            className="apply-button"
          >
            {loading ? "Deploying..." : "Deploy"}
          </button>
        </div>
      </form>
    </div>
  );
}

