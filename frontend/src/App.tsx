import { useState, useEffect } from "react";
import { getTargets, Target } from "./api";
import TargetList from "./components/TargetList";
import TargetForm from "./components/TargetForm";
import DeploymentPanel from "./components/DeploymentPanel";
import "./App.css";

function App() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshTargets = async () => {
    try {
      const data = await getTargets();
      setTargets(data);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Failed to refresh targets:", err);
    }
  };

  useEffect(() => {
    refreshTargets();
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Deploy Portal</h1>
      </header>
      <main className="app-main">
        <div className="app-column">
          <TargetList key={refreshKey} />
          <TargetForm onSuccess={refreshTargets} />
        </div>
        <div className="app-column">
          <DeploymentPanel targets={targets} />
        </div>
      </main>
    </div>
  );
}

export default App;

