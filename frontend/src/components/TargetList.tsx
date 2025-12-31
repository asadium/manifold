import { useEffect, useState, useRef } from "react";
import { getTargets, Target, getTargetContainers, getContainerLogs, getContainerEnv, updateContainerEnv, getTargetEnv, updateTargetEnv, deleteContainer, Container } from "../api";
import Modal from "./Modal";
import EnvEditor from "./EnvEditor";
import "./TargetList.css";

type ContainerFilter = "running" | "exited" | "stopped";

const getKey = (targetId: number, containerName: string) => `${targetId}-${containerName}`;
const parseKey = (key: string): [number, string] | null => {
  const idx = key.indexOf('-');
  if (idx <= 0) return null;
  const targetId = parseInt(key.substring(0, idx), 10);
  const containerName = key.substring(idx + 1);
  return isNaN(targetId) ? null : [targetId, containerName];
};

const scrollToBottom = (element: HTMLElement) => {
  requestAnimationFrame(() => {
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  });
};

const filterContainers = (containers: Container[], filters: Set<ContainerFilter>): Container[] => {
  if (filters.size === 0) return containers;
  return containers.filter(c => {
    const status = c.status.toLowerCase();
    for (const filter of filters) {
      if (filter === "running" && (status.includes("up") || status.includes("running"))) return true;
      if (filter === "exited" && status.startsWith("exited")) return true;
      if (filter === "stopped" && (status.includes("stopped") || status.includes("paused"))) return true;
    }
    return false;
  });
};

interface TargetListProps {
  refreshTrigger?: number;
}

export default function TargetList({ refreshTrigger }: TargetListProps = {}) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTargets, setExpandedTargets] = useState<Set<number>>(new Set());
  const [targetContainers, setTargetContainers] = useState<Record<number, Container[]>>({});
  const [containerLogs, setContainerLogs] = useState<Record<string, string>>({});
  const [containerEnv, setContainerEnv] = useState<Record<string, Record<string, string>>>({});
  const [targetEnv, setTargetEnv] = useState<Record<number, Record<string, string>>>({});
  const [visibleTargetEnv, setVisibleTargetEnv] = useState<Set<number>>(new Set());
  const [loadingContainers, setLoadingContainers] = useState<Set<number>>(new Set());
  const [loadingLogs, setLoadingLogs] = useState<Set<string>>(new Set());
  const [loadingEnv, setLoadingEnv] = useState<Set<string>>(new Set());
  const [loadingTargetEnv, setLoadingTargetEnv] = useState<Set<number>>(new Set());
  const [savingEnv, setSavingEnv] = useState<Set<string>>(new Set());
  const [savingTargetEnv, setSavingTargetEnv] = useState<Set<number>>(new Set());
  const [containerFilters, setContainerFilters] = useState<Record<number, Set<ContainerFilter>>>({});
  const [deletingContainers, setDeletingContainers] = useState<Set<string>>(new Set());
  const [deleteConfirmation, setDeleteConfirmation] = useState<{targetId: number, containerName: string} | null>(null);
  const [containerLogsMenus, setContainerLogsMenus] = useState<Set<string>>(new Set());
  const [containerEnvMenus, setContainerEnvMenus] = useState<Set<string>>(new Set());
  const [targetActionMenus, setTargetActionMenus] = useState<Set<number>>(new Set());
  const [filterMenus, setFilterMenus] = useState<Set<number>>(new Set());
  const logRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const initialScrollDone = useRef<Set<string>>(new Set());

  const fetchTargets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTargets();
      setTargets(data);
        setContainerFilters(prev => {
          const updated = { ...prev };
          data.forEach(t => { 
            if (!updated[t.id]) {
              updated[t.id] = new Set<ContainerFilter>(["running", "exited", "stopped"]);
            }
          });
          return updated;
        });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load targets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, [refreshTrigger]);

  useEffect(() => {
    if (expandedTargets.size === 0) return;
    const interval = setInterval(() => {
      expandedTargets.forEach(id => fetchContainers(id, true).catch(() => {}));
    }, 3000);
    return () => clearInterval(interval);
  }, [expandedTargets]);

  useEffect(() => {
    if (containerLogsMenus.size === 0) return;
    const interval = setInterval(() => {
      containerLogsMenus.forEach(key => {
        const parsed = parseKey(key);
        if (parsed) fetchContainerLogs(parsed[0], parsed[1], true, true).catch(() => {});
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [containerLogsMenus]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.container-expanded-section') || target.closest('.container-dropdown-button') ||
          target.closest('.target-action-menu-wrapper') || target.closest('.target-action-menu')) return;
      setContainerLogsMenus(new Set());
      setContainerEnvMenus(new Set());
      setTargetActionMenus(new Set());
      setFilterMenus(new Set());
    };
    if (containerLogsMenus.size > 0 || containerEnvMenus.size > 0 || targetActionMenus.size > 0 || filterMenus.size > 0) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [containerLogsMenus, containerEnvMenus, targetActionMenus, filterMenus]);

  const toggleTarget = async (targetId: number) => {
    setExpandedTargets(prev => {
      const updated = new Set(prev);
      if (updated.has(targetId)) {
        updated.delete(targetId);
      } else {
        updated.add(targetId);
        if (!targetContainers[targetId]) fetchContainers(targetId).catch(() => {});
      }
      return updated;
    });
  };

  const fetchContainers = async (targetId: number, silent = false) => {
    try {
      if (!silent) setLoadingContainers(prev => new Set(prev).add(targetId));
      const containers = await getTargetContainers(targetId);
      setTargetContainers(prev => ({ ...prev, [targetId]: containers }));
    } catch (err) {
      console.error(`Failed to fetch containers for target ${targetId}:`, err);
      if (!silent) setTargetContainers(prev => ({ ...prev, [targetId]: [] }));
    } finally {
      if (!silent) setLoadingContainers(prev => { const s = new Set(prev); s.delete(targetId); return s; });
    }
  };

  const fetchContainerLogs = async (targetId: number, containerName: string, skipScroll = false, silent = false) => {
    const key = getKey(targetId, containerName);
    try {
      if (!silent) setLoadingLogs(prev => new Set(prev).add(key));
      const el = logRefs.current[key];
      const wasAtBottom = el ? (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) : true;
      const logs = await getContainerLogs(targetId, containerName, 100);
      setContainerLogs(prev => ({ ...prev, [key]: logs }));
      if (!skipScroll && wasAtBottom) {
        setTimeout(() => {
          const newEl = logRefs.current[key];
          if (newEl) scrollToBottom(newEl);
        }, 100);
      } else if (skipScroll && wasAtBottom) {
        setTimeout(() => {
          const newEl = logRefs.current[key];
          if (newEl) scrollToBottom(newEl);
        }, 100);
      }
    } catch (err) {
      console.error(`Failed to fetch logs:`, err);
      if (!silent) setContainerLogs(prev => ({ ...prev, [key]: `Error: ${err instanceof Error ? err.message : 'Unknown'}` }));
    } finally {
      if (!silent) setLoadingLogs(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const toggleContainerLogs = async (targetId: number, containerName: string) => {
    const key = getKey(targetId, containerName);
    setContainerLogsMenus(prev => {
      const updated = new Set(prev);
      if (updated.has(key)) {
        updated.delete(key);
        initialScrollDone.current.delete(key);
      } else {
        setContainerEnvMenus(p => { const s = new Set(p); s.delete(key); return s; });
        if (!containerLogs[key] && !loadingLogs.has(key)) {
          fetchContainerLogs(targetId, containerName).catch(() => {});
        }
        updated.add(key);
      }
      return updated;
    });
  };

  const fetchContainerEnv = async (targetId: number, containerName: string) => {
    const key = getKey(targetId, containerName);
    if (containerEnv[key]) return;
    try {
      setLoadingEnv(prev => new Set(prev).add(key));
      const env = await getContainerEnv(targetId, containerName);
      setContainerEnv(prev => ({ ...prev, [key]: env }));
    } catch (err) {
      console.error(`Failed to fetch env:`, err);
      setContainerEnv(prev => ({ ...prev, [key]: {} }));
    } finally {
      setLoadingEnv(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const toggleContainerEnv = async (targetId: number, containerName: string) => {
    const key = getKey(targetId, containerName);
    setContainerEnvMenus(prev => {
      const updated = new Set(prev);
      if (updated.has(key)) {
        updated.delete(key);
      } else {
        setContainerLogsMenus(p => { const s = new Set(p); s.delete(key); return s; });
        if (!containerEnv[key] && !loadingEnv.has(key)) fetchContainerEnv(targetId, containerName).catch(() => {});
        updated.add(key);
      }
      return updated;
    });
  };

  const saveContainerEnv = async (targetId: number, containerName: string, env: Record<string, string>) => {
    const key = getKey(targetId, containerName);
    try {
      setSavingEnv(prev => new Set(prev).add(key));
      await updateContainerEnv(targetId, containerName, env);
      setContainerEnv(prev => ({ ...prev, [key]: env }));
      await fetchContainers(targetId);
    } catch (err) {
      alert(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSavingEnv(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const fetchTargetEnv = async (targetId: number) => {
    if (targetEnv[targetId]) return;
    try {
      setLoadingTargetEnv(prev => new Set(prev).add(targetId));
      const env = await getTargetEnv(targetId);
      setTargetEnv(prev => ({ ...prev, [targetId]: env }));
    } catch (err) {
      console.error(`Failed to fetch target env:`, err);
      setTargetEnv(prev => ({ ...prev, [targetId]: {} }));
    } finally {
      setLoadingTargetEnv(prev => { const s = new Set(prev); s.delete(targetId); return s; });
    }
  };

  const toggleTargetEnv = async (targetId: number) => {
    setVisibleTargetEnv(prev => {
      const updated = new Set(prev);
      if (updated.has(targetId)) {
        updated.delete(targetId);
      } else {
        if (!expandedTargets.has(targetId)) {
          setExpandedTargets(p => new Set(p).add(targetId));
          if (!targetContainers[targetId]) fetchContainers(targetId).catch(() => {});
        }
        if (!targetEnv[targetId] && !loadingTargetEnv.has(targetId)) fetchTargetEnv(targetId).catch(() => {});
        updated.add(targetId);
      }
      return updated;
    });
  };

  const saveTargetEnv = async (targetId: number, env: Record<string, string>) => {
    try {
      setSavingTargetEnv(prev => new Set(prev).add(targetId));
      await updateTargetEnv(targetId, env);
      setTargetEnv(prev => ({ ...prev, [targetId]: env }));
    } catch (err) {
      alert(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSavingTargetEnv(prev => { const s = new Set(prev); s.delete(targetId); return s; });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmation) return;
    const { targetId, containerName } = deleteConfirmation;
    const key = getKey(targetId, containerName);
    setDeleteConfirmation(null);
    try {
      setDeletingContainers(prev => new Set(prev).add(key));
      await deleteContainer(targetId, containerName);
      await fetchContainers(targetId);
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeletingContainers(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };


  if (loading) return <div className="target-list-loading">Loading targets...</div>;
  if (error) return (
    <div className="target-list-error">
      <p>Error: {error}</p>
      <button onClick={() => window.location.reload()}>Retry</button>
    </div>
  );

  return (
    <div className="target-list">
      <div className="target-list-header"><h2>Targets</h2></div>
      {targets.length === 0 ? (
        <div className="targets-empty">No targets found. Click "+ Create Target" to create one.</div>
      ) : (
        <div className="targets-container">
          {targets.map(target => {
            const isExpanded = expandedTargets.has(target.id);
            const allContainers = targetContainers[target.id] || [];
            const filters = containerFilters[target.id] || new Set<ContainerFilter>();
            const containers = filterContainers(allContainers, filters);
            const isLoadingContainers = loadingContainers.has(target.id);

            return (
              <div key={target.id} className="target-card">
                <div className="target-card-header">
                  <div className="target-card-info" onClick={() => toggleTarget(target.id)}>
                    <span className="target-id">#{target.id}</span>
                    <span className="target-card-name">{target.name}</span>
                    <span className="target-card-address">{target.address}</span>
                    <span className="target-card-user">{target.ssh_user}</span>
                    {allContainers.length > 0 && (
                      <span className="target-containers-count">{allContainers.length} container{allContainers.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  <div className="target-card-actions">
                    <div className="target-action-menu-wrapper">
                      <button
                        className="target-action-menu-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTargetActionMenus(prev => {
                            const s = new Set(prev);
                            s.has(target.id) ? s.delete(target.id) : s.add(target.id);
                            return s;
                          });
                        }}
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      >⋯</button>
                      {targetActionMenus.has(target.id) && (
                        <div className="target-action-menu">
                          <div className="target-action-menu-section target-action-menu-filter-section">
                            <button
                              className="target-action-menu-filter-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFilterMenus(prev => {
                                  const s = new Set(prev);
                                  s.has(target.id) ? s.delete(target.id) : s.add(target.id);
                                  return s;
                                });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              Filter: {filterMenus.has(target.id) ? '▼' : '▶'}
                            </button>
                            {filterMenus.has(target.id) && (
                              <div className="target-action-menu-checkboxes">
                                {(["running", "exited", "stopped"] as ContainerFilter[]).map(filter => (
                                  <label key={filter} className="target-action-menu-checkbox-label">
                                    <input
                                      type="checkbox"
                                      checked={filters.has(filter)}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        setContainerFilters(prev => {
                                          const updated = { ...prev };
                                          if (!updated[target.id]) updated[target.id] = new Set<ContainerFilter>();
                                          const filterSet = new Set(updated[target.id]);
                                          if (e.target.checked) {
                                            filterSet.add(filter);
                                          } else {
                                            filterSet.delete(filter);
                                          }
                                          updated[target.id] = filterSet;
                                          return updated;
                                        });
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      onMouseDown={(e) => e.stopPropagation()}
                                    />
                                    <span>{filter.charAt(0).toUpperCase() + filter.slice(1)}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            className="target-action-menu-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTargetActionMenus(new Set());
                              toggleTargetEnv(target.id);
                            }}
                            disabled={loadingTargetEnv.has(target.id)}
                          >
                            {loadingTargetEnv.has(target.id) ? 'Loading...' : visibleTargetEnv.has(target.id) ? 'Hide Env' : 'View Env'}
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="expand-icon" onClick={() => toggleTarget(target.id)}>{isExpanded ? '▼' : '▶'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="target-card-content">
                    {visibleTargetEnv.has(target.id) && (
                      <div className="target-env-section">
                        <div className="target-env-header"><h4>VM Environment Variables</h4></div>
                        <div className="target-env-content">
                          <EnvEditor
                            env={targetEnv[target.id] || {}}
                            onSave={(env) => saveTargetEnv(target.id, env)}
                            onCancel={() => {}}
                            isLoading={loadingTargetEnv.has(target.id) && !targetEnv[target.id]}
                            isSaving={savingTargetEnv.has(target.id)}
                          />
                        </div>
                      </div>
                    )}
                    {isLoadingContainers ? (
                      <div className="containers-loading">Loading containers...</div>
                    ) : containers.length === 0 ? (
                      <div className="containers-empty">No containers found on this target.</div>
                    ) : (
                      <div className="containers-list">
                        {containers.map(container => {
                          const logKey = getKey(target.id, container.name);
                          const envKey = logKey;
                          const isLogsOpen = containerLogsMenus.has(logKey);
                          const isEnvOpen = containerEnvMenus.has(envKey);

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
                                    className="container-dropdown-button"
                                    onClick={(e) => { e.stopPropagation(); toggleContainerLogs(target.id, container.name); }}
                                    disabled={loadingLogs.has(logKey)}
                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                  >Logs {isLogsOpen ? '▼' : '▶'}</button>
                                  <button
                                    className="container-dropdown-button"
                                    onClick={(e) => { e.stopPropagation(); toggleContainerEnv(target.id, container.name); }}
                                    disabled={loadingEnv.has(envKey)}
                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                  >Env {isEnvOpen ? '▼' : '▶'}</button>
                                  <button
                                    className="delete-container-icon"
                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmation({ targetId: target.id, containerName: container.name }); }}
                                    disabled={deletingContainers.has(logKey)}
                                    title="Delete container"
                                  >×</button>
                                </div>
                              </div>
                              {isLogsOpen && (
                                <div className="container-expanded-section container-logs-section expanded">
                                  {loadingLogs.has(logKey) && !containerLogs[logKey] ? (
                                    <div className="logs-loading">Loading logs...</div>
                                  ) : containerLogs[logKey] ? (
                                    <div
                                      ref={(el) => {
                                        if (el) {
                                          logRefs.current[logKey] = el;
                                          if (!initialScrollDone.current.has(logKey)) {
                                            initialScrollDone.current.add(logKey);
                                            setTimeout(() => scrollToBottom(el), 100);
                                          }
                                        }
                                      }}
                                      className="container-logs-content"
                                      onWheel={(e) => {
                                        const el = e.currentTarget;
                                        const atTop = el.scrollTop === 0;
                                        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
                                        if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) return;
                                        e.stopPropagation();
                                      }}
                                    ><pre>{containerLogs[logKey]}</pre></div>
                                  ) : null}
                                </div>
                              )}
                              {isEnvOpen && (
                                <div className="container-expanded-section container-env-section expanded">
                                  <EnvEditor
                                    env={containerEnv[envKey] || {}}
                                    onSave={(env) => saveContainerEnv(target.id, container.name, env)}
                                    onCancel={() => {}}
                                    isLoading={loadingEnv.has(envKey) && !containerEnv[envKey]}
                                    isSaving={savingEnv.has(envKey)}
                                  />
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

      <Modal isOpen={!!deleteConfirmation} onClose={() => setDeleteConfirmation(null)} title="Confirm Delete Container">
        {deleteConfirmation && (
          <div className="delete-confirmation-modal-content">
            <p>Are you sure you want to delete container <strong>{deleteConfirmation.containerName}</strong>? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="cancel-button" onClick={() => setDeleteConfirmation(null)}>Cancel</button>
              <button
                className="delete-button"
                onClick={handleDelete}
                disabled={deletingContainers.has(getKey(deleteConfirmation.targetId, deleteConfirmation.containerName))}
              >
                {deletingContainers.has(getKey(deleteConfirmation.targetId, deleteConfirmation.containerName)) ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
