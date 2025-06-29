import React from 'react';
import HornDetector from './components/HornDetector';
import './App.css';

function App() {
  return (
    <div className="App">
      {/* Removed App-header class which might conflict with map sizing */}
      <div className="app-container">
        <h1 className="app-title">Vehicle Horn Detection System</h1>
        <div className="map-wrapper">
          <HornDetector />
        </div>
      </div>
    </div>
  );
}

export default App;