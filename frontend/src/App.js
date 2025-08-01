import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [dashboardStats, setDashboardStats] = useState({});
  const [marketData, setMarketData] = useState({});
  const [signals, setSignals] = useState([]);
  const [trades, setTrades] = useState([]);
  const [portfolio, setPortfolio] = useState({});
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USD');
  const [botStatus, setBotStatus] = useState('STOPPED');
  const [loading, setLoading] = useState(false);

  // Fetch dashboard data
  const fetchDashboardStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard-stats`);
      setDashboardStats(response.data);
      setBotStatus(response.data.bot_status);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const fetchSignals = async () => {
    try {
      const response = await axios.get(`${API}/signals?limit=20`);
      setSignals(response.data);
    } catch (error) {
      console.error('Error fetching signals:', error);
    }
  };

  const fetchTrades = async () => {
    try {
      const response = await axios.get(`${API}/trades?limit=10`);
      setTrades(response.data);
    } catch (error) {
      console.error('Error fetching trades:', error);
    }
  };

  const fetchPortfolio = async () => {
    try {
      const response = await axios.get(`${API}/portfolio`);
      setPortfolio(response.data);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    }
  };

  const fetchMarketData = async (symbol) => {
    try {
      const response = await axios.get(`${API}/market-data/${symbol}?limit=50`);
      setMarketData({ ...marketData, [symbol]: response.data });
    } catch (error) {
      console.error('Error fetching market data:', error);
    }
  };

  const startBot = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/start-trading`);
      setBotStatus('RUNNING');
      await fetchDashboardStats();
    } catch (error) {
      console.error('Error starting bot:', error);
    }
    setLoading(false);
  };

  const stopBot = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/stop-trading`);
      setBotStatus('STOPPED');
      await fetchDashboardStats();
    } catch (error) {
      console.error('Error stopping bot:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardStats();
    fetchSignals();
    fetchTrades();
    fetchPortfolio();
    
    // Fetch data for popular symbols
    const symbols = ['BITCOIN/USD', 'ETHEREUM/USD', 'XAU/USD', 'USD/EUR'];
    symbols.forEach(symbol => fetchMarketData(symbol));

    // Set up polling
    const interval = setInterval(() => {
      fetchDashboardStats();
      fetchSignals();
      fetchTrades();
      fetchPortfolio();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2 
    }).format(value || 0);
  };

  const formatPercentage = (value) => {
    const color = value >= 0 ? 'text-green-500' : 'text-red-500';
    return <span className={color}>{value >= 0 ? '+' : ''}{value?.toFixed(2)}%</span>;
  };

  const getSignalColor = (signalType) => {
    switch(signalType) {
      case 'BUY': return 'bg-green-100 text-green-800 border-green-200';
      case 'SELL': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getConfidenceBar = (confidence) => {
    const width = Math.min(confidence, 100);
    const color = confidence >= 70 ? 'bg-green-500' : confidence >= 40 ? 'bg-yellow-500' : 'bg-red-500';
    return (
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-300`} style={{width: `${width}%`}}></div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">₿</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">HTF Trading Bot</h1>
                <p className="text-gray-300 text-sm">AI-Powered Trading Assistant</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                botStatus === 'RUNNING' 
                  ? 'bg-green-900/50 text-green-300 border border-green-500/50' 
                  : 'bg-red-900/50 text-red-300 border border-red-500/50'
              }`}>
                {botStatus === 'RUNNING' ? '🟢 ACTIVE' : '🔴 INACTIVE'}
              </div>
              
              {botStatus === 'STOPPED' ? (
                <button
                  onClick={startBot}
                  disabled={loading}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? 'Starting...' : 'Start Bot'}
                </button>
              ) : (
                <button
                  onClick={stopBot}
                  disabled={loading}
                  className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? 'Stopping...' : 'Stop Bot'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm mb-1">Total Balance</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(dashboardStats.total_balance)}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <span className="text-blue-400 text-xl">💰</span>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm mb-1">Total P&L</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(dashboardStats.total_pnl)}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <span className="text-purple-400 text-xl">📈</span>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm mb-1">Active Positions</p>
                <p className="text-2xl font-bold text-white">{dashboardStats.active_positions || 0}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <span className="text-green-400 text-xl">🎯</span>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm mb-1">Total Trades</p>
                <p className="text-2xl font-bold text-white">{dashboardStats.total_trades || 0}</p>
              </div>
              <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <span className="text-orange-400 text-xl">⚡</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Trading Signals */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">🤖 AI Trading Signals</h2>
                <div className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm">
                  {signals.length} Active
                </div>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {signals.length > 0 ? signals.map((signal, index) => (
                  <div key={signal.id || index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-white">{signal.symbol}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSignalColor(signal.signal_type)}`}>
                          {signal.signal_type}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-300 mb-1">Confidence</div>
                        <div className="text-sm font-bold text-white">{signal.confidence?.toFixed(0)}%</div>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      {getConfidenceBar(signal.confidence)}
                    </div>
                    
                    <p className="text-sm text-gray-300 mb-2">{signal.reasoning}</p>
                    
                    {signal.price_target && (
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Target: {formatCurrency(signal.price_target)}</span>
                        <span>Stop Loss: {formatCurrency(signal.stop_loss)}</span>
                      </div>
                    )}
                  </div>
                )) : (
                  <div className="text-center py-8 text-gray-400">
                    <p>No signals available yet.</p>
                    <p className="text-sm mt-2">Start the bot to begin generating AI trading signals.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Portfolio & Recent Trades */}
          <div className="space-y-6">
            {/* Portfolio Positions */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-bold text-white mb-4">💼 Portfolio</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Available Balance</span>
                  <span className="text-white font-medium">{formatCurrency(portfolio.available_balance)}</span>
                </div>
                
                {portfolio.positions && Object.keys(portfolio.positions).length > 0 ? (
                  Object.entries(portfolio.positions).map(([symbol, quantity]) => (
                    <div key={symbol} className="flex justify-between items-center bg-white/5 rounded-lg p-3">
                      <span className="text-white font-medium">{symbol}</span>
                      <span className="text-gray-300">{quantity.toFixed(4)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm text-center py-4">No positions yet</p>
                )}
              </div>
            </div>

            {/* Recent Trades */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-bold text-white mb-4">📊 Recent Trades</h3>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {trades.length > 0 ? trades.slice(0, 5).map((trade, index) => (
                  <div key={trade.id || index} className="bg-white/5 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-medium">{trade.symbol}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.trade_type === 'BUY' 
                          ? 'bg-green-900/50 text-green-300' 
                          : 'bg-red-900/50 text-red-300'
                      }`}>
                        {trade.trade_type}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Qty: {trade.quantity?.toFixed(4)}</span>
                      <span>Price: {formatCurrency(trade.entry_price)}</span>
                    </div>
                    {trade.pnl !== null && (
                      <div className="text-xs mt-1">
                        P&L: {formatCurrency(trade.pnl)}
                      </div>
                    )}
                  </div>
                )) : (
                  <p className="text-gray-400 text-sm text-center py-4">No trades yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;