import { useState, FormEvent } from "react";
import { createTarget } from "../api";
import "./TargetForm.css";

interface TargetFormProps {
  onSuccess?: () => void;
}

export default function TargetForm({ onSuccess }: TargetFormProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [sshKeyPath, setSshKeyPath] = useState("");
  const [sshUser, setSshUser] = useState("root");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createTarget({ 
        name, 
        address, 
        ssh_key_path: sshKeyPath,
        ssh_user: sshUser || "root"
      });
      // Reset form
      setName("");
      setAddress("");
      setSshKeyPath("");
      setSshUser("root");
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

        <div className="form-group">
          <label htmlFor="ssh-key-path">SSH Private Key Path</label>
          <input
            id="ssh-key-path"
            type="text"
            value={sshKeyPath}
            onChange={(e) => setSshKeyPath(e.target.value)}
            required
            placeholder="e.g., /Users/username/.ssh/id_rsa"
          />
          <small className="form-hint">
            Local path to SSH private key file
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="ssh-user">SSH Username</label>
          <input
            id="ssh-user"
            type="text"
            value={sshUser}
            onChange={(e) => setSshUser(e.target.value)}
            placeholder="root (default)"
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

