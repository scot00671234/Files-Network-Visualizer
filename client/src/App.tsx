import { useState } from 'react';
import NetworkGraph from './components/NetworkGraph';
import './App.css'; // Ensure this imports standard css, we moved styles to index.css mostly

function App() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="App">
      <div className="sidebar">
        <h1>Epstein Network</h1>
        <p>Visualizing the connections from LittleSis & Public Records.</p>

        <div style={{ pointerEvents: 'auto' }}>
          <input
            type="text"
            placeholder="Search entity..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ marginTop: '20px', fontSize: '0.8rem', color: '#666' }}>
          <p><strong>Stats:</strong></p>
          <p>Node Count: Loading...</p>
          <p>Edge Count: Loading...</p>
        </div>
      </div>
      <NetworkGraph />
    </div>
  );
}

export default App;
