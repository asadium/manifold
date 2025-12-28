import { useState, FormEvent } from "react";
import { Target, previewDeployment, applyDeployment, DeploymentPreviewResponse, DeploymentStatus } from "../api";
import "./DeploymentPanel.css";

interface DeploymentPanelProps {
  targets: Target[];
}

export default function DeploymentPanel({ targets }: DeploymentPanelProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<number | "">("");
  const [manifestPath, setManifestPath] = useState("");
  const [previewResult, setPreviewResult] = useState<DeploymentPreviewResponse | null>(null);
  const [deploymentResult, setDeploymentResult] = useState<DeploymentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTargetId || !manifestPath) {
      setError("Please select a target and enter a manifest path");
      return;
    }

    setLoading(true);
    setError(null);
    setPreviewResult(null);

    try {
      const result = await previewDeployment(selectedTargetId as number, manifestPath);
      setPreviewResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview deployment");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTargetId || !manifestPath) {
      setError("Please select a target and enter a manifest path");
      return;
    }

    setLoading(true);
    setError(null);
    setDeploymentResult(null);

    try {
      const result = await applyDeployment(selectedTargetId as number, manifestPath);
      setDeploymentResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply deployment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="deployment-panel">
      <h2>Deployments</h2>
      
      <form className="deployment-form">
        <div className="form-group">
          <label htmlFor="target-select">Target</label>
          <select
            id="target-select"
            value={selectedTargetId}
            onChange={(e) => setSelectedTargetId(e.target.value ? Number(e.target.value) : "")}
            required
          >
            <option value="">Select a target...</option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name} ({target.type})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="manifest-path">Manifest Path</label>
          <input
            id="manifest-path"
            type="text"
            value={manifestPath}
            onChange={(e) => setManifestPath(e.target.value)}
            required
            placeholder="e.g., /path/to/manifest.yaml"
          />
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="button-group">
          <button
            type="button"
            onClick={handlePreview}
            disabled={loading || !selectedTargetId || !manifestPath}
            className="preview-button"
          >
            {loading ? "Loading..." : "Preview"}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={loading || !selectedTargetId || !manifestPath}
            className="apply-button"
          >
            {loading ? "Loading..." : "Deploy"}
          </button>
        </div>
      </form>

      {(previewResult || deploymentResult) && (
        <div className="result-section">
          <h3>Result</h3>
          <pre className="result-json">
            {JSON.stringify(previewResult || deploymentResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

