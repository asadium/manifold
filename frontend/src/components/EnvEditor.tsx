import { useState } from "react";
import "./EnvEditor.css";

interface EnvEditorProps {
  env: Record<string, string>;
  onSave: (env: Record<string, string>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  isSaving?: boolean;
}

export default function EnvEditor({ env, onSave, onCancel, isLoading, isSaving }: EnvEditorProps) {
  const [edits, setEdits] = useState<Record<string, string>>(env);
  const [isEditing, setIsEditing] = useState(false);

  const updateVar = (key: string, value: string) => {
    setEdits(prev => ({ ...prev, [key]: value }));
  };

  const updateKey = (oldKey: string, newKey: string) => {
    const value = edits[oldKey];
    setEdits(prev => {
      const updated = { ...prev };
      delete updated[oldKey];
      updated[newKey] = value;
      return updated;
    });
  };

  const addVar = () => {
    setEdits(prev => ({ ...prev, [`NEW_KEY_${Date.now()}`]: "" }));
  };

  const removeVar = (key: string) => {
    setEdits(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const handleSave = async () => {
    await onSave(edits);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEdits(env);
    setIsEditing(false);
    onCancel();
  };

  if (isLoading) {
    return <div className="env-loading">Loading environment variables...</div>;
  }

  if (isEditing) {
    return (
      <div className="env-editor">
        {Object.entries(edits).map(([key, value]) => (
          <div key={key} className="env-var-row">
            <input
              type="text"
              className="env-key-input"
              value={key}
              onChange={(e) => updateKey(key, e.target.value)}
              placeholder="KEY"
            />
            <input
              type="text"
              className="env-value-input"
              value={value}
              onChange={(e) => updateVar(key, e.target.value)}
              placeholder="VALUE"
            />
            <button className="remove-env-var-button" onClick={() => removeVar(key)}>×</button>
          </div>
        ))}
        <button className="add-env-var-button" onClick={addVar}>+ Add Variable</button>
        <div className="env-editor-actions">
          <button className="save-env-button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button className="cancel-env-button" onClick={handleCancel} disabled={isSaving}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="env-display">
      {Object.keys(env).length === 0 ? (
        <div className="env-empty">No environment variables</div>
      ) : (
        <>
          {Object.entries(env).map(([key, value]) => (
            <div key={key} className="env-var-item">
              <span className="env-var-key">{key}</span>
              <span className="env-var-value">{value || '(empty)'}</span>
            </div>
          ))}
          <button className="edit-env-button" onClick={() => setIsEditing(true)}>Edit</button>
        </>
      )}
    </div>
  );
}

