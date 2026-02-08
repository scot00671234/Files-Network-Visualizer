import { useState, useEffect } from 'react';
import NetworkGraph, { type GraphData } from './components/NetworkGraph';
import './App.css';

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/graph');
      if (!res.ok) throw new Error(`Server API Error: ${res.statusText}`);
      const data = await res.json();
      setGraphData(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerIngest = async () => {
    try {
      await fetch('/api/ingest', { method: 'POST' });
      alert("Ingestion triggered. Please wait 10-20 seconds and refresh.");
    } catch (e) {
      alert("Failed to trigger ingestion");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="App">
      <div className="sidebar">
        <h1>Epstein Network</h1>
        <p>Visualizing the connections from LittleSis & Public Records.</p>

        <div className="search-container">
          <input
            type="text"
            placeholder="Search person or org..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="stats-container">
          <div className="stat-item">
            <span className="stat-label">Nodes</span>
            <span className="stat-value">{graphData.nodes.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Connections</span>
            <span className="stat-value">{graphData.links.length}</span>
          </div>
        </div>

        {/* Status Indicators */}
        <div style={{ marginTop: '20px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
          {isLoading && <p style={{ color: '#aaa', margin: 0 }}>📡 Connecting to server...</p>}
          {error && (
            <div>
              <p style={{ color: '#ff5252', margin: '0 0 10px 0' }}>⚠️ {error}</p>
              <button
                onClick={fetchData}
                style={{ padding: '8px 16px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
              >
                Retry Connection
              </button>
            </div>
          )}
          {!isLoading && !error && graphData.nodes.length === 0 && (
            <div>
              <p style={{ color: '#aaa' }}>Database is empty (0 nodes).</p>
              <button
                onClick={triggerIngest}
                style={{ width: '100%', padding: '10px', background: '#4a90e2', border: 'none', color: 'white', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
              >
                Start Data Ingestion
              </button>
            </div>
          )}
        </div>
      </div>

      <NetworkGraph data={graphData} searchTerm={searchTerm} />
    </div>
  );
}

export default App;
