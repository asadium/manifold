import { useState, FormEvent } from "react";
import { createTarget, TargetType } from "../api";
import "./TargetForm.css";

interface TargetFormProps {
  onSuccess?: () => void;
}

export default function TargetForm({ onSuccess }: TargetFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<TargetType>("kubernetes");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createTarget({ name, type, address });
      // Reset form
      setName("");
      setAddress("");
      setType("kubernetes");
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create target");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="target-form">
      <h2>Create Target</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g., Production Cluster"
          />
        </div>

        <div className="form-group">
          <label htmlFor="type">Type</label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as TargetType)}
            required
          >
            <option value="kubernetes">Kubernetes</option>
            <option value="vm">VM</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="address">Address</label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            placeholder="e.g., cluster.example.com or 192.168.1.100"
          />
        </div>

        {error && <div className="form-error">{error}</div>}

        <button type="submit" disabled={loading} className="submit-button">
          {loading ? "Creating..." : "Create Target"}
        </button>
      </form>
    </div>
  );
}

