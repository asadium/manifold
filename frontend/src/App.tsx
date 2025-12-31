import { useState, useEffect } from "react";
import { getTargets, Target, DeploymentStatus } from "./api";
import TargetList from "./components/TargetList";
import TargetForm from "./components/TargetForm";
import DeploymentForm from "./components/DeploymentForm";
import DeploymentPanel from "./components/DeploymentPanel";
import Modal from "./components/Modal";
import "./App.css";
import "./dark-mode.css";

function App() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetListRefreshTrigger, setTargetListRefreshTrigger] = useState(0);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showDeploymentModal, setShowDeploymentModal] = useState(false);
  const [deployments, setDeployments] = useState<DeploymentStatus[]>([]);
  
  // Dark mode state - defaults to system preference
  const [darkMode, setDarkMode] = useState<boolean | null>(null);

  const refreshTargets = async () => {
    try {
      const data = await getTargets();
      setTargets(data);
      setTargetListRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error("Failed to refresh targets:", err);
    }
  };

  const refreshDeployments = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api"}/deployments`);
      if (response.ok) {
        const data = await response.json();
        setDeployments(data);
      }
    } catch (err) {
      console.error("Failed to refresh deployments:", err);
    }
  };

  useEffect(() => {
    refreshTargets();
    refreshDeployments();
    
    // Poll for deployment updates
    const interval = setInterval(refreshDeployments, 2000);
    return () => clearInterval(interval);
  }, []);

  // Initialize dark mode from system preference
  useEffect(() => {
    if (darkMode === null) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(prefersDark);
    }
  }, [darkMode]);

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode === true) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if user hasn't manually set dark mode
      if (darkMode === null || darkMode === e.matches) {
        setDarkMode(e.matches);
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [darkMode]);

  const handleDeploymentCreated = (deployment: DeploymentStatus) => {
    setDeployments(prev => [...prev, deployment]);
    refreshDeployments();
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-content">
          <h1>Manifold</h1>
          <div className="app-header-actions">
            <div className="dark-mode-toggle">
              <label className="dark-mode-switch">
                <input
                  type="checkbox"
                  checked={darkMode === true}
                  onChange={(e) => setDarkMode(e.target.checked)}
                />
                <span className="dark-mode-slider"></span>
              </label>
              <span className="dark-mode-label">Dark Mode</span>
            </div>
            <button className="action-button" onClick={() => setShowTargetModal(true)}>
              + Create Target
            </button>
            <button className="action-button primary" onClick={() => setShowDeploymentModal(true)}>
              + Deploy
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="app-column">
          <TargetList refreshTrigger={targetListRefreshTrigger} />
        </div>
        <div className="app-column">
          <DeploymentPanel targets={targets} deployments={deployments} />
        </div>
      </main>

      <Modal
        isOpen={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        title="Create VM Target"
      >
        <TargetForm
          onSuccess={() => {
            refreshTargets();
            setShowTargetModal(false);
          }}
          onClose={() => setShowTargetModal(false)}
        />
      </Modal>

      <Modal
        isOpen={showDeploymentModal}
        onClose={() => setShowDeploymentModal(false)}
        title="Deploy Container"
      >
        <DeploymentForm
          targets={targets}
          onDeploy={handleDeploymentCreated}
          onClose={() => setShowDeploymentModal(false)}
        />
      </Modal>
    </div>
  );
}

export default App;

