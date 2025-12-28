import { useEffect, useState } from "react";
import { getTargets, Target } from "../api";
import "./TargetList.css";

interface TargetListProps {
  onRefresh?: () => void;
}

export default function TargetList(_props: TargetListProps) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTargets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTargets();
      setTargets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load targets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, []);

  if (loading) {
    return <div className="target-list-loading">Loading targets...</div>;
  }

  if (error) {
    return (
      <div className="target-list-error">
        <p>Error: {error}</p>
        <button onClick={fetchTargets}>Retry</button>
      </div>
    );
  }

  if (targets.length === 0) {
    return <div className="target-list-empty">No targets found. Create one to get started.</div>;
  }

  return (
    <div className="target-list">
      <h2>Targets</h2>
      <table className="target-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Type</th>
            <th>Address</th>
            <th>Created At</th>
          </tr>
        </thead>
        <tbody>
          {targets.map((target) => (
            <tr key={target.id}>
              <td>{target.id}</td>
              <td>{target.name}</td>
              <td>{target.type}</td>
              <td>{target.address}</td>
              <td>{new Date(target.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

