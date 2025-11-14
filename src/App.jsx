import React, { useState, useEffect } from 'react';
import { Download, Upload, Trash2, Plus, Settings, BarChart3, Trophy, Users } from 'lucide-react';

// Storage utilities with proper error handling
const storage = {
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return defaultValue;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  }
};

// Player pool data
const PLAYER_POOL = {
  'Alpha': ['Aiden Foster', 'Austin Green', 'Brian Hayes', 'Caleb Jackson', 'Daniel King'],
  'Beta': ['Ethan Lewis', 'Frank Miller', 'George Nelson', 'Henry Owens', 'Isaac Parker'],
  'Gamma': ['James Quinn', 'Kevin Roberts', 'Liam Scott', 'Mason Taylor', 'Noah Upton'],
  'Delta': ['Oliver Vance', 'Patrick White', 'Quinn Xavier', 'Ryan Young', 'Samuel Zimmerman'],
  'Epsilon': ['Thomas Anderson', 'Ulysses Brown', 'Victor Carter', 'William Davis', 'Xavier Evans'],
  'Zeta': ['Zachary Ford', 'Adam Gray', 'Benjamin Hill', 'Charles Irving', 'David Jenkins']
};

function App() {
  const [teams, setTeams] = useState(() => storage.get('bbl-teams', { team1: [], team2: [] }));
  const [stats, setStats] = useState(() => storage.get('bbl-stats', {}));
  const [currentInning, setCurrentInning] = useState(1);
  const [currentTeam, setCurrentTeam] = useState('team1');
  const [currentBatter, setCurrentBatter] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  // Handle PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Save teams and stats to localStorage
  useEffect(() => {
    storage.set('bbl-teams', teams);
  }, [teams]);

  useEffect(() => {
    storage.set('bbl-stats', stats);
  }, [stats]);

  const handleInstallClick = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const addPlayerToTeam = (team, player) => {
    if (!teams[team].includes(player)) {
      setTeams(prev => ({
        ...prev,
        [team]: [...prev[team], player]
      }));
    }
  };

  const removePlayerFromTeam = (team, playerIndex) => {
    setTeams(prev => ({
      ...prev,
      [team]: prev[team].filter((_, i) => i !== playerIndex)
    }));
  };

  const recordResult = (result) => {
    const team = currentTeam;
    const player = teams[team][currentBatter];
    
    if (!player) return;

    // Update stats
    setStats(prev => {
      const playerStats = prev[player] || { singles: 0, doubles: 0, triples: 0, homeRuns: 0, outs: 0 };
      
      const newStats = {
        ...prev,
        [player]: {
          ...playerStats,
          singles: playerStats.singles + (result === 'single' ? 1 : 0),
          doubles: playerStats.doubles + (result === 'double' ? 1 : 0),
          triples: playerStats.triples + (result === 'triple' ? 1 : 0),
          homeRuns: playerStats.homeRuns + (result === 'homeRun' ? 1 : 0),
          outs: playerStats.outs + (result === 'out' ? 1 : 0),
        }
      };
      
      return newStats;
    });

    // Move to next batter
    const nextBatter = (currentBatter + 1) % teams[team].length;
    setCurrentBatter(nextBatter);

    // If we've cycled through all batters, switch teams
    if (nextBatter === 0) {
      if (currentTeam === 'team1') {
        setCurrentTeam('team2');
      } else {
        setCurrentTeam('team1');
        setCurrentInning(prev => prev + 1);
      }
    }
  };

  const calculateBattingAverage = (playerStats) => {
    const hits = playerStats.singles + playerStats.doubles + playerStats.triples + playerStats.homeRuns;
    const atBats = hits + playerStats.outs;
    return atBats > 0 ? (hits / atBats).toFixed(3) : '.000';
  };

  const exportStats = () => {
    const data = {
      teams,
      stats,
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beer-baseball-stats-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importStats = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.teams) setTeams(data.teams);
        if (data.stats) setStats(data.stats);
        alert('Stats imported successfully!');
      } catch (error) {
        alert('Error importing stats: Invalid file format');
      }
    };
    reader.readAsText(file);
  };

  const clearAllStats = () => {
    if (window.confirm('Are you sure you want to clear all stats? This cannot be undone.')) {
      setStats({});
      setTeams({ team1: [], team2: [] });
      setCurrentInning(1);
      setCurrentTeam('team1');
      setCurrentBatter(0);
      storage.remove('bbl-stats');
      storage.remove('bbl-teams');
    }
  };

  const BaseballDiamond = () => (
    <div className="relative w-64 h-64 mx-auto my-8">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {/* Diamond */}
        <path
          d="M 100 20 L 180 100 L 100 180 L 20 100 Z"
          fill="#16a34a"
          stroke="#ffffff"
          strokeWidth="3"
        />
        {/* Bases */}
        <circle cx="100" cy="20" r="8" fill="white" />
        <circle cx="180" cy="100" r="8" fill="white" />
        <circle cx="100" cy="180" r="8" fill="white" />
        <circle cx="20" cy="100" r="8" fill="white" />
        {/* Home plate */}
        <path d="M 100 180 L 95 185 L 95 195 L 105 195 L 105 185 Z" fill="white" />
        {/* Labels */}
        <text x="100" y="15" textAnchor="middle" fill="white" fontSize="10">2B</text>
        <text x="185" y="105" textAnchor="middle" fill="white" fontSize="10">1B</text>
        <text x="15" y="105" textAnchor="middle" fill="white" fontSize="10">3B</text>
        <text x="100" y="205" textAnchor="middle" fill="white" fontSize="10">HOME</text>
      </svg>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-900 text-white">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 flex items-center justify-center gap-3">
            <Trophy className="w-10 h-10 text-yellow-400" />
            Beer Baseball
            <Trophy className="w-10 h-10 text-yellow-400" />
          </h1>
          <p className="text-xl text-green-200">Delta Upsilon League</p>
          <p className="text-sm text-green-300 mt-2">Inning: {currentInning} | Current Team: {currentTeam === 'team1' ? 'Team 1' : 'Team 2'}</p>
        </header>

        {/* Install PWA Button */}
        {installPrompt && (
          <div className="mb-4 flex justify-center">
            <button
              onClick={handleInstallClick}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Download className="w-5 h-5" />
              Install App
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 justify-center mb-6">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors min-h-[44px]"
          >
            <Settings className="w-5 h-5" />
            Team Setup
          </button>
          <button
            onClick={() => setShowStats(!showStats)}
            className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors min-h-[44px]"
          >
            <BarChart3 className="w-5 h-5" />
            Stats
          </button>
          <button
            onClick={exportStats}
            className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors min-h-[44px]"
          >
            <Download className="w-5 h-5" />
            Export
          </button>
          <label className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer min-h-[44px]">
            <Upload className="w-5 h-5" />
            Import
            <input type="file" accept=".json" onChange={importStats} className="hidden" />
          </label>
          <button
            onClick={clearAllStats}
            className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors min-h-[44px]"
          >
            <Trash2 className="w-5 h-5" />
            Clear All
          </button>
        </div>

        {/* Team Setup */}
        {showSettings && (
          <div className="bg-green-800 rounded-lg p-6 mb-6 shadow-xl">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Users className="w-6 h-6" />
              Team Setup
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {['team1', 'team2'].map((team) => (
                <div key={team} className="bg-green-900 rounded-lg p-4">
                  <h3 className="text-xl font-semibold mb-3">
                    {team === 'team1' ? 'Team 1' : 'Team 2'}
                  </h3>
                  
                  {/* Current Team Members */}
                  <div className="mb-4 space-y-2">
                    {teams[team].length === 0 ? (
                      <p className="text-green-300 italic">No players added yet</p>
                    ) : (
                      teams[team].map((player, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-green-800 p-2 rounded">
                          <span>{player}</span>
                          <button
                            onClick={() => removePlayerFromTeam(team, idx)}
                            className="text-red-400 hover:text-red-300 min-h-[44px] min-w-[44px] flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Players from Pool */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-green-200">Add from Player Pool:</h4>
                    {Object.entries(PLAYER_POOL).map(([house, players]) => (
                      <div key={house} className="bg-green-800 p-2 rounded">
                        <p className="font-semibold text-sm mb-1">{house}</p>
                        <div className="flex flex-wrap gap-1">
                          {players.map((player) => (
                            <button
                              key={player}
                              onClick={() => addPlayerToTeam(team, player)}
                              disabled={teams[team].includes(player) || teams[team === 'team1' ? 'team2' : 'team1'].includes(player)}
                              className={`text-xs px-2 py-1 rounded min-h-[36px] ${
                                teams[team].includes(player) || teams[team === 'team1' ? 'team2' : 'team1'].includes(player)
                                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                  : 'bg-green-600 hover:bg-green-500'
                              }`}
                            >
                              <Plus className="w-3 h-3 inline mr-1" />
                              {player.split(' ')[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats View */}
        {showStats && (
          <div className="bg-green-800 rounded-lg p-6 mb-6 shadow-xl overflow-x-auto">
            <h2 className="text-2xl font-bold mb-4">Player Statistics</h2>
            {Object.keys(stats).length === 0 ? (
              <p className="text-green-300 italic">No stats recorded yet</p>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-green-600">
                    <th className="pb-2 pr-4">Player</th>
                    <th className="pb-2 pr-4">1B</th>
                    <th className="pb-2 pr-4">2B</th>
                    <th className="pb-2 pr-4">3B</th>
                    <th className="pb-2 pr-4">HR</th>
                    <th className="pb-2 pr-4">Outs</th>
                    <th className="pb-2">AVG</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats).map(([player, playerStats]) => (
                    <tr key={player} className="border-b border-green-700">
                      <td className="py-2 pr-4">{player}</td>
                      <td className="py-2 pr-4">{playerStats.singles}</td>
                      <td className="py-2 pr-4">{playerStats.doubles}</td>
                      <td className="py-2 pr-4">{playerStats.triples}</td>
                      <td className="py-2 pr-4">{playerStats.homeRuns}</td>
                      <td className="py-2 pr-4">{playerStats.outs}</td>
                      <td className="py-2">{calculateBattingAverage(playerStats)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Baseball Diamond */}
        <BaseballDiamond />

        {/* Current Batter */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold mb-2">Current Batter</h3>
          <p className="text-xl text-green-200">
            {teams[currentTeam][currentBatter] || 'No player selected'}
          </p>
        </div>

        {/* Game Controls */}
        {teams[currentTeam].length > 0 && (
          <div className="bg-green-800 rounded-lg p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-4 text-center">Record Result</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <button
                onClick={() => recordResult('single')}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-3 rounded-lg font-semibold transition-colors min-h-[44px]"
              >
                Single
              </button>
              <button
                onClick={() => recordResult('double')}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-3 rounded-lg font-semibold transition-colors min-h-[44px]"
              >
                Double
              </button>
              <button
                onClick={() => recordResult('triple')}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-3 rounded-lg font-semibold transition-colors min-h-[44px]"
              >
                Triple
              </button>
              <button
                onClick={() => recordResult('homeRun')}
                className="bg-yellow-600 hover:bg-yellow-500 px-4 py-3 rounded-lg font-semibold transition-colors min-h-[44px]"
              >
                Home Run
              </button>
              <button
                onClick={() => recordResult('out')}
                className="bg-red-600 hover:bg-red-500 px-4 py-3 rounded-lg font-semibold transition-colors min-h-[44px] col-span-2 md:col-span-1"
              >
                Out
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-green-300 text-sm">
          <p>Beer Baseball App v1.0.0</p>
          <p className="mt-1">© {new Date().getFullYear()} Delta Upsilon League</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
