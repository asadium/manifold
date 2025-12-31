import { useState, useEffect, useRef } from "react";
import { Target, DeploymentStatus, getDeploymentLogs, DeploymentLog } from "../api";
import ChevronIcon from "./ChevronIcon";
import "./DeploymentPanel.css";

interface DeploymentPanelProps {
  targets: Target[];
  deployments: DeploymentStatus[];
}

export default function DeploymentPanel({ targets, deployments }: DeploymentPanelProps) {
  const [expandedDeployments, setExpandedDeployments] = useState<Set<number>>(new Set());
  const [deploymentLogs, setDeploymentLogs] = useState<Record<number, DeploymentLog[]>>({});
  const [loadingLogs, setLoadingLogs] = useState<Set<number>>(new Set());
  const logRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const pollingIntervals = useRef<Record<number, number | null>>({});

  const toggleDeployment = async (deploymentId: number) => {
    const newExpanded = new Set(expandedDeployments);
    if (newExpanded.has(deploymentId)) {
      newExpanded.delete(deploymentId);
      // Stop polling when collapsed
      if (pollingIntervals.current[deploymentId]) {
        clearInterval(pollingIntervals.current[deploymentId]!);
        pollingIntervals.current[deploymentId] = null;
      }
    } else {
      newExpanded.add(deploymentId);
      // Start polling for logs when expanded
      if (!deploymentLogs[deploymentId]) {
        await fetchLogs(deploymentId);
      }
      startLogPolling(deploymentId);
    }
    setExpandedDeployments(newExpanded);
  };

  const fetchLogs = async (deploymentId: number) => {
    try {
      setLoadingLogs(prev => new Set(prev).add(deploymentId));
      const logs = await getDeploymentLogs(deploymentId);
      setDeploymentLogs(prev => ({ ...prev, [deploymentId]: logs }));
    } catch (err) {
      console.error(`Failed to fetch logs for deployment ${deploymentId}:`, err);
    } finally {
      setLoadingLogs(prev => {
        const newSet = new Set(prev);
        newSet.delete(deploymentId);
        return newSet;
      });
    }
  };

  const startLogPolling = (deploymentId: number) => {
    // Clear any existing interval
    if (pollingIntervals.current[deploymentId]) {
      clearInterval(pollingIntervals.current[deploymentId]!);
    }

    // Poll immediately
    fetchLogs(deploymentId);

    // Then poll every 500ms
    pollingIntervals.current[deploymentId] = window.setInterval(() => {
      fetchLogs(deploymentId);
    }, 500);
  };

  const scrollLogsToBottom = (deploymentId: number) => {
    setTimeout(() => {
      const logElement = logRefs.current[deploymentId];
      if (logElement) {
        logElement.scrollTop = logElement.scrollHeight;
      }
    }, 50);
  };

  // Auto-poll for running deployments
  useEffect(() => {
    deployments.forEach(deployment => {
      if (deployment.status === "running" || deployment.status === "queued") {
        if (!pollingIntervals.current[deployment.id]) {
          startLogPolling(deployment.id);
        }
      } else {
        // Stop polling for completed deployments
        if (pollingIntervals.current[deployment.id]) {
          clearInterval(pollingIntervals.current[deployment.id]!);
          pollingIntervals.current[deployment.id] = null;
        }
      }
    });

    return () => {
      Object.values(pollingIntervals.current).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployments]);

  // Scroll logs to bottom when they update
  useEffect(() => {
    expandedDeployments.forEach(deploymentId => {
      if (deploymentLogs[deploymentId]) {
        scrollLogsToBottom(deploymentId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploymentLogs, expandedDeployments]);

  const getTargetName = (targetId: number) => {
    const target = targets.find(t => t.id === targetId);
    return target ? `${target.name} (${target.address})` : `Target ${targetId}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "status-success";
      case "failed":
        return "status-failed";
      case "running":
        return "status-running";
      case "queued":
        return "status-queued";
      default:
        return "";
    }
  };

  if (deployments.length === 0) {
    return (
      <div className="deployment-panel">
        <h2>Deployments</h2>
        <div className="deployments-empty">No deployments yet. Click "+ Deploy" to create one.</div>
      </div>
    );
  }

  return (
    <div className="deployment-panel">
      <h2>Deployments</h2>
      <div className="deployments-list">
        {deployments.map((deployment) => {
          const isExpanded = expandedDeployments.has(deployment.id);
          const logs = deploymentLogs[deployment.id] || [];
          const isLoadingLogs = loadingLogs.has(deployment.id);
          const isPolling = pollingIntervals.current[deployment.id] !== null;

          return (
            <div key={deployment.id} className="deployment-card">
              <div className="deployment-card-header" onClick={() => toggleDeployment(deployment.id)}>
                <div className="deployment-card-info">
                  <span className="deployment-id">#{deployment.id}</span>
                  <span className="deployment-target">{getTargetName(deployment.target_id)}</span>
                  {deployment.container_name && (
                    <span className="deployment-container">{deployment.container_name}</span>
                  )}
                  {deployment.compose_file_path && (
                    <span className="deployment-compose">{deployment.compose_file_path}</span>
                  )}
                  <span className={`deployment-status ${getStatusColor(deployment.status)}`}>
                    {deployment.status}
                  </span>
                </div>
                <div className="deployment-card-actions">
                  <span className="expand-icon">
                    <ChevronIcon isOpen={isExpanded} />
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="deployment-card-content">
                  <div className="deployment-details">
                    <div className="deployment-detail-item">
                      <strong>Status:</strong> {deployment.status}
                    </div>
                    <div className="deployment-detail-item">
                      <strong>Message:</strong> {deployment.message}
                    </div>
                    {deployment.image && (
                      <div className="deployment-detail-item">
                        <strong>Image:</strong> {deployment.image}
                      </div>
                    )}
                    {deployment.container_name && (
                      <div className="deployment-detail-item">
                        <strong>Container:</strong> {deployment.container_name}
                      </div>
                    )}
                    {deployment.compose_file_path && (
                      <div className="deployment-detail-item">
                        <strong>Compose File:</strong> {deployment.compose_file_path}
                      </div>
                    )}
                    <div className="deployment-detail-item">
                      <strong>Created:</strong> {new Date(deployment.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="deployment-logs-section">
                    <h4>Deployment Logs</h4>
                    {isLoadingLogs && logs.length === 0 ? (
                      <div className="logs-loading">Loading logs...</div>
                    ) : logs.length === 0 ? (
                      <div className="logs-empty">No logs available yet.</div>
                    ) : (
                      <div
                        ref={(el) => {
                          if (el) {
                            logRefs.current[deployment.id] = el;
                            scrollLogsToBottom(deployment.id);
                          }
                        }}
                        className="deployment-logs"
                        onWheel={(e) => {
                          const element = e.currentTarget;
                          const isAtTop = element.scrollTop === 0;
                          const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
                          
                          if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
                            return;
                          }
                          e.stopPropagation();
                        }}
                      >
                        {logs.map((log: DeploymentLog, index: number) => {
                          const logClass = `log-entry log-${log.level.toLowerCase()}`;
                          const timestamp = new Date(log.timestamp).toLocaleTimeString();
                          return (
                            <div key={index} className={logClass}>
                              <span className="log-timestamp">[{timestamp}]</span>
                              <span className="log-level">[{log.level}]</span>
                              <span className="log-message">{log.message}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {isPolling && (
                      <div className="log-status">
                        <span className="log-status-indicator">●</span> Streaming logs...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
