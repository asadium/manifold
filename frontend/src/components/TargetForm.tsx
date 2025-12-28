import { useState, FormEvent } from "react";
import { createTarget } from "../api";
import "./TargetForm.css";

interface TargetFormProps {
  onSuccess?: () => void;
}

export default function TargetForm({ onSuccess }: TargetFormProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createTarget({ name, address });
      // Reset form
      setName("");
      setAddress("");
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
      <h2>Create VM Target</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g., Production Server"
          />
        </div>

        <div className="form-group">
          <label htmlFor="address">IP Address or Hostname</label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            placeholder="e.g., 192.168.1.100 or server.example.com"
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

