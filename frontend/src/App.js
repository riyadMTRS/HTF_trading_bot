import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [dashboardStats, setDashboardStats] = useState({});
  const [marketData, setMarketData] = useState({});
  const [signals, setSignals] = useState([]);
  const [trades, setTrades] = useState([]);
  const [portfolio, setPortfolio] = useState({});
  const [selectedMarket, setSelectedMarket] = useState('crypto');
  const [selectedSymbol, setSelectedSymbol] = useState('BITCOIN/USD');
  const [botStatus, setBotStatus] = useState('STOPPED');
  const [loading, setLoading] = useState(false);
  const [strategyLogs, setStrategyLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  // Market symbols configuration
  const marketSymbols = {
    crypto: ['BITCOIN/USD', 'ETHEREUM/USD', 'BINANCECOIN/USD', 'CARDANO/USD', 'SOLANA/USD'],
    forex: ['USD/EUR', 'USD/GBP', 'USD/JPY', 'EUR/GBP'],
    gold: ['XAU/USD']
  };

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
      
      // Create strategy logs from signals
      const logs = response.data.slice(0, 10).map(signal => ({
        id: signal.id,
        timestamp: signal.timestamp,
        symbol: signal.symbol,
        action: signal.signal_type,
        reasoning: signal.reasoning,
        confidence: signal.confidence,
        type: 'signal'
      }));
      setStrategyLogs(logs);
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
      const data = response.data.map((item, index) => ({
        time: new Date(item.timestamp).toLocaleTimeString(),
        price: item.price,
        volume: item.volume || 0,
        change: item.change_24h || 0,
        index: index
      }));
      setMarketData({ ...marketData, [symbol]: data });
    } catch (error) {
      console.error('Error fetching market data:', error);
    }
  };

  const fetchIndicators = async (symbol) => {
    try {
      const response = await axios.get(`${API}/indicators/${symbol}?limit=20`);
      return response.data;
    } catch (error) {
      console.error('Error fetching indicators:', error);
      return [];
    }
  };

  const startBot = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/start-trading`);
      setBotStatus('RUNNING');
      await fetchDashboardStats();
      
      // Add strategy log entry
      setStrategyLogs(prev => [{
        id: Date.now(),
        timestamp: new Date().toISOString(),
        symbol: 'SYSTEM',
        action: 'START',
        reasoning: 'Trading bot activated. Beginning market analysis and data collection across crypto, forex, and gold markets.',
        confidence: 100,
        type: 'system'
      }, ...prev.slice(0, 9)]);
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
      
      // Add strategy log entry
      setStrategyLogs(prev => [{
        id: Date.now(),
        timestamp: new Date().toISOString(),
        symbol: 'SYSTEM',
        action: 'STOP',
        reasoning: 'Trading bot deactivated. All market analysis and trading activities halted.',
        confidence: 100,
        type: 'system'
      }, ...prev.slice(0, 9)]);
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
    
    // Fetch data for all symbols in current market
    marketSymbols[selectedMarket].forEach(symbol => fetchMarketData(symbol));

    // Set up polling
    const interval = setInterval(() => {
      fetchDashboardStats();
      fetchSignals();
      fetchTrades();
      fetchPortfolio();
      // Refresh market data for selected symbol
      fetchMarketData(selectedSymbol);
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [selectedMarket, selectedSymbol]);

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

  const currentMarketData = marketData[selectedSymbol] || [];
  const latestPrice = currentMarketData.length > 0 ? currentMarketData[currentMarketData.length - 1]?.price : 0;
  const priceChange = currentMarketData.length > 1 ? 
    ((latestPrice - currentMarketData[currentMarketData.length - 2]?.price) / currentMarketData[currentMarketData.length - 2]?.price * 100) : 0;

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
                <p className="text-gray-300 text-sm">AI-Powered Multi-Market Trading System</p>
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

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex space-x-1 bg-white/10 backdrop-blur-md rounded-lg p-1">
          {[
            { id: 'overview', name: 'Overview', icon: '📊' },
            { id: 'markets', name: 'Markets', icon: '💹' },
            { id: 'strategy', name: 'Strategy', icon: '🧠' },
            { id: 'portfolio', name: 'Portfolio', icon: '💼' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-white/20 text-white shadow-lg' 
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                    <p className={`text-2xl font-bold ${dashboardStats.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(dashboardStats.total_pnl)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-purple-400 text-xl">📈</span>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-300 text-sm mb-1">Active Signals</p>
                    <p className="text-2xl font-bold text-white">{signals.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-green-400 text-xl">🎯</span>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-300 text-sm mb-1">Markets Tracked</p>
                    <p className="text-2xl font-bold text-white">{dashboardStats.symbols_tracked || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-orange-400 text-xl">🌐</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">🤖 Recent AI Activity</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {strategyLogs.length > 0 ? strategyLogs.slice(0, 5).map((log, index) => (
                  <div key={log.id || index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-sm text-gray-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="font-bold text-white">{log.symbol}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          log.action === 'BUY' ? 'bg-green-900/50 text-green-300' :
                          log.action === 'SELL' ? 'bg-red-900/50 text-red-300' :
                          log.type === 'system' ? 'bg-blue-900/50 text-blue-300' :
                          'bg-gray-900/50 text-gray-300'
                        }`}>
                          {log.action}
                        </span>
                      </div>
                      {log.confidence && (
                        <span className="text-sm text-gray-300">{log.confidence}% confidence</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300">{log.reasoning}</p>
                  </div>
                )) : (
                  <p className="text-gray-400 text-center py-8">No activity yet. Start the bot to begin AI analysis.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Markets Tab */}
        {activeTab === 'markets' && (
          <div className="space-y-6">
            {/* Market Selection */}
            <div className="flex space-x-1 bg-white/10 backdrop-blur-md rounded-lg p-1">
              {Object.keys(marketSymbols).map(market => (
                <button
                  key={market}
                  onClick={() => {
                    setSelectedMarket(market);
                    setSelectedSymbol(marketSymbols[market][0]);
                  }}
                  className={`px-4 py-2 rounded-md font-medium capitalize transition-all ${
                    selectedMarket === market 
                      ? 'bg-white/20 text-white shadow-lg' 
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {market} {market === 'crypto' ? '₿' : market === 'forex' ? '💱' : '🥇'}
                </button>
              ))}
            </div>

            {/* Symbol Selection */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <div className="flex flex-wrap gap-3 mb-6">
                {marketSymbols[selectedMarket].map(symbol => (
                  <button
                    key={symbol}
                    onClick={() => setSelectedSymbol(symbol)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      selectedSymbol === symbol 
                        ? 'bg-purple-600 text-white shadow-lg' 
                        : 'bg-white/10 text-gray-300 hover:text-white hover:bg-white/20'
                    }`}
                  >
                    {symbol}
                  </button>
                ))}
              </div>

              {/* Current Price Display */}
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-white">{selectedSymbol}</h3>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-white">{formatCurrency(latestPrice)}</p>
                    <p className="text-lg">{formatPercentage(priceChange)}</p>
                  </div>
                </div>
              </div>

              {/* Price Chart */}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={currentMarketData}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1f2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#f3f4f6'
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#8b5cf6" 
                      fillOpacity={1} 
                      fill="url(#colorPrice)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Strategy Tab */}
        {activeTab === 'strategy' && (
          <div className="space-y-6">
            {/* AI Signals */}
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

            {/* Strategy Log */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-bold text-white mb-4">🧠 Strategy Analysis Log</h3>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {strategyLogs.map((log, index) => (
                  <div key={log.id || index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-xs text-gray-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        <span className="font-bold text-white">{log.symbol}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          log.action === 'BUY' ? 'bg-green-900/50 text-green-300' :
                          log.action === 'SELL' ? 'bg-red-900/50 text-red-300' :
                          log.type === 'system' ? 'bg-blue-900/50 text-blue-300' :
                          'bg-gray-900/50 text-gray-300'
                        }`}>
                          {log.action}
                        </span>
                      </div>
                      {log.confidence && log.type !== 'system' && (
                        <span className="text-sm text-gray-300">{log.confidence}%</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300">{log.reasoning}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            {/* Portfolio Summary */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-bold text-white mb-4">💼 Portfolio Summary</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-gray-300 text-sm mb-1">Total Balance</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(portfolio.total_balance)}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-gray-300 text-sm mb-1">Available</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(portfolio.available_balance)}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-gray-300 text-sm mb-1">Total P&L</p>
                  <p className={`text-2xl font-bold ${portfolio.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(portfolio.total_pnl)}
                  </p>
                </div>
              </div>
              
              {/* Active Positions */}
              <div className="space-y-3">
                <h4 className="text-md font-bold text-white">Active Positions</h4>
                {portfolio.positions && Object.keys(portfolio.positions).length > 0 ? (
                  Object.entries(portfolio.positions).map(([symbol, quantity]) => (
                    <div key={symbol} className="flex justify-between items-center bg-white/5 rounded-lg p-3">
                      <span className="text-white font-medium">{symbol}</span>
                      <div className="text-right">
                        <span className="text-gray-300">{quantity.toFixed(4)} units</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm text-center py-4">No positions yet</p>
                )}
              </div>
            </div>

            {/* Recent Trades */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-bold text-white mb-4">📊 Trading History</h3>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {trades.length > 0 ? trades.map((trade, index) => (
                  <div key={trade.id || index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="text-white font-medium">{trade.symbol}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          trade.trade_type === 'BUY' 
                            ? 'bg-green-900/50 text-green-300' 
                            : 'bg-red-900/50 text-red-300'
                        }`}>
                          {trade.trade_type}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          trade.status === 'OPEN' 
                            ? 'bg-yellow-900/50 text-yellow-300' 
                            : 'bg-gray-900/50 text-gray-300'
                        }`}>
                          {trade.status}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(trade.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-300">
                      <span>Qty: {trade.quantity?.toFixed(4)}</span>
                      <span>Entry: {formatCurrency(trade.entry_price)}</span>
                      {trade.exit_price && <span>Exit: {formatCurrency(trade.exit_price)}</span>}
                    </div>
                    {trade.pnl !== null && trade.pnl !== undefined && (
                      <div className="text-sm mt-2 text-right">
                        <span className={trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                          P&L: {formatCurrency(trade.pnl)}
                        </span>
                      </div>
                    )}
                  </div>
                )) : (
                  <p className="text-gray-400 text-sm text-center py-4">No trades yet</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;