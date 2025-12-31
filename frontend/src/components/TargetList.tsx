import { useEffect, useState, useRef } from "react";
import { getTargets, Target, getTargetContainers, getContainerLogs, getContainerEnv, updateContainerEnv, getTargetEnv, updateTargetEnv, Container } from "../api";
import "./TargetList.css";

interface TargetListProps {
  onRefresh?: () => void;
}

export default function TargetList(_props: TargetListProps) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTargets, setExpandedTargets] = useState<Set<number>>(new Set());
  const [targetContainers, setTargetContainers] = useState<Record<number, Container[]>>({});
  const [containerLogs, setContainerLogs] = useState<Record<string, string>>({});
  const [containerEnv, setContainerEnv] = useState<Record<string, Record<string, string>>>({});
  const [targetEnv, setTargetEnv] = useState<Record<number, Record<string, string>>>({});
  const [editingEnv, setEditingEnv] = useState<Set<string>>(new Set());
  const [editingTargetEnv, setEditingTargetEnv] = useState<Set<number>>(new Set());
  const [envEdits, setEnvEdits] = useState<Record<string, Record<string, string>>>({});
  const [targetEnvEdits, setTargetEnvEdits] = useState<Record<number, Record<string, string>>>({});
  const [visibleLogs, setVisibleLogs] = useState<Set<string>>(new Set());
  const [visibleEnv, setVisibleEnv] = useState<Set<string>>(new Set());
  const [visibleTargetEnv, setVisibleTargetEnv] = useState<Set<number>>(new Set());
  const [loadingContainers, setLoadingContainers] = useState<Set<number>>(new Set());
  const [loadingLogs, setLoadingLogs] = useState<Set<string>>(new Set());
  const [loadingEnv, setLoadingEnv] = useState<Set<string>>(new Set());
  const [loadingTargetEnv, setLoadingTargetEnv] = useState<Set<number>>(new Set());
  const [savingEnv, setSavingEnv] = useState<Set<string>>(new Set());
  const [savingTargetEnv, setSavingTargetEnv] = useState<Set<number>>(new Set());
  const logRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  // Scroll logs to bottom when they become visible
  useEffect(() => {
    visibleLogs.forEach(logKey => {
      if (containerLogs[logKey]) {
        setTimeout(() => {
          const logElement = logRefs.current[logKey];
          if (logElement) {
            logElement.scrollTop = logElement.scrollHeight;
          }
        }, 100);
      }
    });
  }, [visibleLogs, containerLogs]);

  const toggleTarget = async (targetId: number) => {
    const newExpanded = new Set(expandedTargets);
    if (newExpanded.has(targetId)) {
      newExpanded.delete(targetId);
    } else {
      newExpanded.add(targetId);
      // Fetch containers when expanding
      if (!targetContainers[targetId]) {
        await fetchContainers(targetId);
      }
    }
    setExpandedTargets(newExpanded);
  };

  const fetchContainers = async (targetId: number) => {
    try {
      setLoadingContainers(prev => new Set(prev).add(targetId));
      const containers = await getTargetContainers(targetId);
      setTargetContainers(prev => ({ ...prev, [targetId]: containers }));
    } catch (err) {
      console.error(`Failed to fetch containers for target ${targetId}:`, err);
      setTargetContainers(prev => ({ ...prev, [targetId]: [] }));
    } finally {
      setLoadingContainers(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetId);
        return newSet;
      });
    }
  };

  const fetchContainerLogs = async (targetId: number, containerName: string) => {
    const logKey = `${targetId}-${containerName}`;
    if (containerLogs[logKey]) {
      return; // Already loaded
    }

    try {
      setLoadingLogs(prev => new Set(prev).add(logKey));
      const logs = await getContainerLogs(targetId, containerName, 100);
      setContainerLogs(prev => ({ ...prev, [logKey]: logs }));
      
      // Scroll to bottom after logs are loaded
      setTimeout(() => {
        const logElement = logRefs.current[logKey];
        if (logElement) {
          logElement.scrollTop = logElement.scrollHeight;
        }
      }, 100);
    } catch (err) {
      console.error(`Failed to fetch logs for container ${containerName}:`, err);
      setContainerLogs(prev => ({ ...prev, [logKey]: `Error loading logs: ${err instanceof Error ? err.message : 'Unknown error'}` }));
    } finally {
      setLoadingLogs(prev => {
        const newSet = new Set(prev);
        newSet.delete(logKey);
        return newSet;
      });
    }
  };

  const toggleContainerLogs = async (targetId: number, containerName: string) => {
    const logKey = `${targetId}-${containerName}`;
    const newVisibleLogs = new Set(visibleLogs);
    
    if (newVisibleLogs.has(logKey)) {
      // Hide logs
      newVisibleLogs.delete(logKey);
      setVisibleLogs(newVisibleLogs);
    } else {
      // Show logs - fetch if not already loaded
      if (!containerLogs[logKey] && !loadingLogs.has(logKey)) {
        await fetchContainerLogs(targetId, containerName);
      }
      newVisibleLogs.add(logKey);
      setVisibleLogs(newVisibleLogs);
      
      // Scroll to bottom after showing logs
      setTimeout(() => {
        const logElement = logRefs.current[logKey];
        if (logElement) {
          logElement.scrollTop = logElement.scrollHeight;
        }
      }, 100);
    }
  };

  const fetchContainerEnv = async (targetId: number, containerName: string) => {
    const envKey = `${targetId}-${containerName}`;
    if (containerEnv[envKey]) {
      return; // Already loaded
    }

    try {
      setLoadingEnv(prev => new Set(prev).add(envKey));
      const env = await getContainerEnv(targetId, containerName);
      setContainerEnv(prev => ({ ...prev, [envKey]: env }));
      setEnvEdits(prev => ({ ...prev, [envKey]: { ...env } }));
    } catch (err) {
      console.error(`Failed to fetch env for container ${containerName}:`, err);
      setContainerEnv(prev => ({ ...prev, [envKey]: {} }));
      setEnvEdits(prev => ({ ...prev, [envKey]: {} }));
    } finally {
      setLoadingEnv(prev => {
        const newSet = new Set(prev);
        newSet.delete(envKey);
        return newSet;
      });
    }
  };

  const toggleContainerEnv = async (targetId: number, containerName: string) => {
    const envKey = `${targetId}-${containerName}`;
    const newVisibleEnv = new Set(visibleEnv);
    
    if (newVisibleEnv.has(envKey)) {
      // Hide env
      newVisibleEnv.delete(envKey);
      setVisibleEnv(newVisibleEnv);
      setEditingEnv(prev => {
        const newSet = new Set(prev);
        newSet.delete(envKey);
        return newSet;
      });
    } else {
      // Show env - fetch if not already loaded
      if (!containerEnv[envKey] && !loadingEnv.has(envKey)) {
        await fetchContainerEnv(targetId, containerName);
      }
      newVisibleEnv.add(envKey);
      setVisibleEnv(newVisibleEnv);
    }
  };

  const startEditingEnv = (envKey: string) => {
    setEditingEnv(prev => new Set(prev).add(envKey));
    // Initialize edits with current env if not already set
    if (!envEdits[envKey]) {
      setEnvEdits(prev => ({ ...prev, [envKey]: { ...containerEnv[envKey] } }));
    }
  };

  const cancelEditingEnv = (envKey: string) => {
    setEditingEnv(prev => {
      const newSet = new Set(prev);
      newSet.delete(envKey);
      return newSet;
    });
    // Reset edits to original env
    setEnvEdits(prev => ({ ...prev, [envKey]: { ...containerEnv[envKey] } }));
  };

  const updateEnvVar = (envKey: string, key: string, value: string) => {
    setEnvEdits(prev => ({
      ...prev,
      [envKey]: {
        ...prev[envKey],
        [key]: value,
      },
    }));
  };

  const addEnvVar = (envKey: string) => {
    const newKey = `NEW_KEY_${Date.now()}`;
    setEnvEdits(prev => ({
      ...prev,
      [envKey]: {
        ...prev[envKey],
        [newKey]: "",
      },
    }));
  };

  const removeEnvVar = (envKey: string, key: string) => {
    setEnvEdits(prev => {
      const newEnv = { ...prev[envKey] };
      delete newEnv[key];
      return {
        ...prev,
        [envKey]: newEnv,
      };
    });
  };

  const saveEnvVars = async (targetId: number, containerName: string) => {
    const envKey = `${targetId}-${containerName}`;
    const envToSave = envEdits[envKey] || {};

    try {
      setSavingEnv(prev => new Set(prev).add(envKey));
      await updateContainerEnv(targetId, containerName, envToSave);
      // Update the stored env vars
      setContainerEnv(prev => ({ ...prev, [envKey]: envToSave }));
      setEditingEnv(prev => {
        const newSet = new Set(prev);
        newSet.delete(envKey);
        return newSet;
      });
      // Refresh containers list
      await fetchContainers(targetId);
    } catch (err) {
      console.error(`Failed to save env vars for container ${containerName}:`, err);
      alert(`Failed to save environment variables: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSavingEnv(prev => {
        const newSet = new Set(prev);
        newSet.delete(envKey);
        return newSet;
      });
    }
  };

  const fetchTargetEnv = async (targetId: number) => {
    if (targetEnv[targetId]) {
      return; // Already loaded
    }

    try {
      setLoadingTargetEnv(prev => new Set(prev).add(targetId));
      const env = await getTargetEnv(targetId);
      setTargetEnv(prev => ({ ...prev, [targetId]: env }));
      setTargetEnvEdits(prev => ({ ...prev, [targetId]: { ...env } }));
    } catch (err) {
      console.error(`Failed to fetch env for target ${targetId}:`, err);
      setTargetEnv(prev => ({ ...prev, [targetId]: {} }));
      setTargetEnvEdits(prev => ({ ...prev, [targetId]: {} }));
    } finally {
      setLoadingTargetEnv(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetId);
        return newSet;
      });
    }
  };

  const toggleTargetEnv = async (targetId: number) => {
    const newVisibleTargetEnv = new Set(visibleTargetEnv);
    
    if (newVisibleTargetEnv.has(targetId)) {
      // Hide env
      newVisibleTargetEnv.delete(targetId);
      setVisibleTargetEnv(newVisibleTargetEnv);
      setEditingTargetEnv(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetId);
        return newSet;
      });
    } else {
      // Show env - fetch if not already loaded
      if (!targetEnv[targetId] && !loadingTargetEnv.has(targetId)) {
        await fetchTargetEnv(targetId);
      }
      newVisibleTargetEnv.add(targetId);
      setVisibleTargetEnv(newVisibleTargetEnv);
    }
  };

  const startEditingTargetEnv = (targetId: number) => {
    setEditingTargetEnv(prev => new Set(prev).add(targetId));
    // Initialize edits with current env if not already set
    if (!targetEnvEdits[targetId]) {
      setTargetEnvEdits(prev => ({ ...prev, [targetId]: { ...targetEnv[targetId] } }));
    }
  };

  const cancelEditingTargetEnv = (targetId: number) => {
    setEditingTargetEnv(prev => {
      const newSet = new Set(prev);
      newSet.delete(targetId);
      return newSet;
    });
    // Reset edits to original env
    setTargetEnvEdits(prev => ({ ...prev, [targetId]: { ...targetEnv[targetId] } }));
  };

  const updateTargetEnvVar = (targetId: number, key: string, value: string) => {
    setTargetEnvEdits(prev => ({
      ...prev,
      [targetId]: {
        ...prev[targetId],
        [key]: value,
      },
    }));
  };

  const addTargetEnvVar = (targetId: number) => {
    const newKey = `NEW_KEY_${Date.now()}`;
    setTargetEnvEdits(prev => ({
      ...prev,
      [targetId]: {
        ...prev[targetId],
        [newKey]: "",
      },
    }));
  };

  const removeTargetEnvVar = (targetId: number, key: string) => {
    setTargetEnvEdits(prev => {
      const newEnv = { ...prev[targetId] };
      delete newEnv[key];
      return {
        ...prev,
        [targetId]: newEnv,
      };
    });
  };

  const saveTargetEnvVars = async (targetId: number) => {
    const envToSave = targetEnvEdits[targetId] || {};

    try {
      setSavingTargetEnv(prev => new Set(prev).add(targetId));
      await updateTargetEnv(targetId, envToSave);
      // Update the stored env vars
      setTargetEnv(prev => ({ ...prev, [targetId]: envToSave }));
      setEditingTargetEnv(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetId);
        return newSet;
      });
    } catch (err) {
      console.error(`Failed to save env vars for target ${targetId}:`, err);
      alert(`Failed to save environment variables: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSavingTargetEnv(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetId);
        return newSet;
      });
    }
  };

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

  return (
    <div className="target-list">
      <h2>Targets</h2>
      {targets.length === 0 ? (
        <div className="targets-empty">No targets found. Click "+ Create Target" to create one.</div>
      ) : (
        <div className="targets-container">
        {targets.map((target) => {
          const isExpanded = expandedTargets.has(target.id);
          const containers = targetContainers[target.id] || [];
          const isLoadingContainers = loadingContainers.has(target.id);

          return (
            <div key={target.id} className="target-card">
              <div className="target-card-header" onClick={() => toggleTarget(target.id)}>
                <div className="target-card-info">
                  <span className="target-id">#{target.id}</span>
                  <span className="target-card-name">{target.name}</span>
                  <span className="target-card-address">{target.address}</span>
                  <span className="target-card-user">{target.ssh_user}</span>
                  {containers.length > 0 && (
                    <span className="target-containers-count">{containers.length} container{containers.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="target-card-actions">
                  <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                </div>
              </div>

              {isExpanded && (
                <div className="target-card-content">
                  <div className="target-env-section">
                    <div className="target-env-header">
                      <h4>VM Environment Variables</h4>
                      <button
                        className="view-env-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTargetEnv(target.id);
                        }}
                        disabled={loadingTargetEnv.has(target.id)}
                      >
                        {loadingTargetEnv.has(target.id) ? 'Loading...' : visibleTargetEnv.has(target.id) ? 'Hide Env' : 'View Env'}
                      </button>
                    </div>
                    {visibleTargetEnv.has(target.id) && (
                      <div className="target-env-content">
                        {loadingTargetEnv.has(target.id) && !targetEnv[target.id] ? (
                          <div className="env-loading">Loading environment variables...</div>
                        ) : editingTargetEnv.has(target.id) ? (
                          <div className="env-editor">
                            {Object.entries(targetEnvEdits[target.id] || {}).map(([key, value]) => (
                              <div key={key} className="env-var-row">
                                <input
                                  type="text"
                                  className="env-key-input"
                                  value={key}
                                  onChange={(e) => {
                                    const newKey = e.target.value;
                                    const oldValue = targetEnvEdits[target.id][key];
                                    setTargetEnvEdits(prev => {
                                      const newEnv = { ...prev[target.id] };
                                      delete newEnv[key];
                                      newEnv[newKey] = oldValue;
                                      return { ...prev, [target.id]: newEnv };
                                    });
                                  }}
                                  placeholder="KEY"
                                />
                                <input
                                  type="text"
                                  className="env-value-input"
                                  value={value}
                                  onChange={(e) => updateTargetEnvVar(target.id, key, e.target.value)}
                                  placeholder="VALUE"
                                />
                                <button
                                  className="remove-env-var-button"
                                  onClick={() => removeTargetEnvVar(target.id, key)}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <button
                              className="add-env-var-button"
                              onClick={() => addTargetEnvVar(target.id)}
                            >
                              + Add Variable
                            </button>
                            <div className="env-editor-actions">
                              <button
                                className="save-env-button"
                                onClick={() => saveTargetEnvVars(target.id)}
                                disabled={savingTargetEnv.has(target.id)}
                              >
                                {savingTargetEnv.has(target.id) ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                className="cancel-env-button"
                                onClick={() => cancelEditingTargetEnv(target.id)}
                                disabled={savingTargetEnv.has(target.id)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="env-display">
                            {!targetEnv[target.id] || Object.keys(targetEnv[target.id]).length === 0 ? (
                              <div className="env-empty">No environment variables</div>
                            ) : (
                              <>
                                {Object.entries(targetEnv[target.id]).map(([key, value]) => (
                                  <div key={key} className="env-var-item">
                                    <span className="env-var-key">{key}</span>
                                    <span className="env-var-value">{value || '(empty)'}</span>
                                  </div>
                                ))}
                                <button
                                  className="edit-env-button"
                                  onClick={() => startEditingTargetEnv(target.id)}
                                >
                                  Edit
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {isLoadingContainers ? (
                    <div className="containers-loading">Loading containers...</div>
                  ) : containers.length === 0 ? (
                    <div className="containers-empty">No containers found on this target.</div>
                  ) : (
                    <div className="containers-list">
                      {containers.map((container) => {
                        const logKey = `${target.id}-${container.name}`;
                        const hasLogsLoaded = containerLogs[logKey] !== undefined;
                        const isLogsVisible = visibleLogs.has(logKey);
                        const isLoadingLogs = loadingLogs.has(logKey);

                        const envKey = `${target.id}-${container.name}`;
                        const hasEnvLoaded = containerEnv[envKey] !== undefined;
                        const isEnvVisible = visibleEnv.has(envKey);
                        const isLoadingEnv = loadingEnv.has(envKey);
                        const isEditingEnv = editingEnv.has(envKey);
                        const isSavingEnv = savingEnv.has(envKey);
                        const currentEnv = envEdits[envKey] || containerEnv[envKey] || {};

                        return (
                          <div key={container.id} className="container-card">
                            <div className="container-header">
                              <div className="container-info">
                                <span className="container-name">{container.name}</span>
                                <span className="container-image">{container.image}</span>
                                <span className={`container-status status-${container.status.toLowerCase().includes('up') ? 'running' : 'stopped'}`}>
                                  {container.status}
                                </span>
                                {container.ports && <span className="container-ports">{container.ports}</span>}
                              </div>
                              <div className="container-actions">
                                <button
                                  className="view-logs-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleContainerLogs(target.id, container.name);
                                  }}
                                  disabled={isLoadingLogs}
                                >
                                  {isLoadingLogs ? 'Loading...' : isLogsVisible ? 'Hide Logs' : 'View Logs'}
                                </button>
                                <button
                                  className="view-env-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleContainerEnv(target.id, container.name);
                                  }}
                                  disabled={isLoadingEnv}
                                >
                                  {isLoadingEnv ? 'Loading...' : isEnvVisible ? 'Hide Env' : 'View Env'}
                                </button>
                              </div>
                            </div>
                            {isLogsVisible && hasLogsLoaded && (
                              <div className="container-logs">
                                <div 
                                  ref={(el) => { 
                                    if (el) {
                                      logRefs.current[logKey] = el;
                                      // Scroll to bottom when element is mounted or becomes visible
                                      setTimeout(() => {
                                        el.scrollTop = el.scrollHeight;
                                      }, 50);
                                    }
                                  }}
                                  className="container-logs-content"
                                  onWheel={(e) => {
                                    // Prevent page scroll when scrolling inside logs
                                    const element = e.currentTarget;
                                    const isAtTop = element.scrollTop === 0;
                                    const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
                                    
                                    if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
                                      // Allow scroll to continue to parent if at boundaries
                                      return;
                                    }
                                    // Prevent event from bubbling to parent
                                    e.stopPropagation();
                                  }}
                                >
                                  <pre>{containerLogs[logKey]}</pre>
                                </div>
                              </div>
                            )}
                            {isEnvVisible && (
                              <div className="container-env">
                                <div className="container-env-header">
                                  <h4>Environment Variables</h4>
                                  {!isEditingEnv && (
                                    <button
                                      className="edit-env-button"
                                      onClick={() => startEditingEnv(envKey)}
                                    >
                                      Edit
                                    </button>
                                  )}
                                </div>
                                {isLoadingEnv && !hasEnvLoaded ? (
                                  <div className="env-loading">Loading environment variables...</div>
                                ) : isEditingEnv ? (
                                  <div className="env-editor">
                                    {Object.entries(currentEnv).map(([key, value]) => (
                                      <div key={key} className="env-var-row">
                                        <input
                                          type="text"
                                          className="env-key-input"
                                          value={key}
                                          onChange={(e) => {
                                            const newKey = e.target.value;
                                            const oldValue = currentEnv[key];
                                            setEnvEdits(prev => {
                                              const newEnv = { ...prev[envKey] };
                                              delete newEnv[key];
                                              newEnv[newKey] = oldValue;
                                              return { ...prev, [envKey]: newEnv };
                                            });
                                          }}
                                          placeholder="KEY"
                                        />
                                        <input
                                          type="text"
                                          className="env-value-input"
                                          value={value}
                                          onChange={(e) => updateEnvVar(envKey, key, e.target.value)}
                                          placeholder="VALUE"
                                        />
                                        <button
                                          className="remove-env-var-button"
                                          onClick={() => removeEnvVar(envKey, key)}
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      className="add-env-var-button"
                                      onClick={() => addEnvVar(envKey)}
                                    >
                                      + Add Variable
                                    </button>
                                    <div className="env-editor-actions">
                                      <button
                                        className="save-env-button"
                                        onClick={() => saveEnvVars(target.id, container.name)}
                                        disabled={isSavingEnv}
                                      >
                                        {isSavingEnv ? 'Saving...' : 'Save'}
                                      </button>
                                      <button
                                        className="cancel-env-button"
                                        onClick={() => cancelEditingEnv(envKey)}
                                        disabled={isSavingEnv}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="env-display">
                                    {Object.keys(currentEnv).length === 0 ? (
                                      <div className="env-empty">No environment variables</div>
                                    ) : (
                                      Object.entries(currentEnv).map(([key, value]) => (
                                        <div key={key} className="env-var-item">
                                          <span className="env-var-key">{key}</span>
                                          <span className="env-var-value">{value || '(empty)'}</span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}

