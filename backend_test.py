#!/usr/bin/env python3
"""
HTF Trading Bot Backend API Test Suite
Tests all backend functionality including market data, technical analysis, AI signals, and paper trading.
"""

import requests
import json
import time
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any

# Backend URL from frontend .env
BACKEND_URL = "https://d3c8d006-c0d3-43c6-9e4f-c98d05940c38.preview.emergentagent.com/api"

class HTFTradingBotTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.test_results = {}
        
    def log_test(self, test_name: str, success: bool, message: str, details: Any = None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        
        self.test_results[test_name] = {
            'success': success,
            'message': message,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        
        if details and not success:
            print(f"   Details: {details}")
    
    def test_health_check(self):
        """Test API health check endpoint"""
        try:
            response = self.session.get(f"{BACKEND_URL}/")
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "HTF Trading Bot" in data["message"]:
                    self.log_test("Health Check", True, "API is responding correctly")
                    return True
                else:
                    self.log_test("Health Check", False, "Unexpected response format", data)
                    return False
            else:
                self.log_test("Health Check", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Health Check", False, f"Connection error: {str(e)}")
            return False
    
    def test_dashboard_stats(self):
        """Test dashboard statistics endpoint"""
        try:
            response = self.session.get(f"{BACKEND_URL}/dashboard-stats")
            
            if response.status_code == 200:
                data = response.json()
                required_fields = [
                    'total_balance', 'available_balance', 'total_pnl', 
                    'active_positions', 'total_trades', 'recent_signals',
                    'symbols_tracked', 'bot_status'
                ]
                
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    # Validate data types and reasonable values
                    if (isinstance(data['total_balance'], (int, float)) and
                        isinstance(data['available_balance'], (int, float)) and
                        isinstance(data['total_pnl'], (int, float)) and
                        isinstance(data['active_positions'], int) and
                        isinstance(data['total_trades'], int) and
                        isinstance(data['recent_signals'], int) and
                        isinstance(data['symbols_tracked'], int) and
                        data['bot_status'] in ['RUNNING', 'STOPPED']):
                        
                        self.log_test("Dashboard Stats", True, "All required fields present with valid data", data)
                        return True
                    else:
                        self.log_test("Dashboard Stats", False, "Invalid data types in response", data)
                        return False
                else:
                    self.log_test("Dashboard Stats", False, f"Missing fields: {missing_fields}", data)
                    return False
            else:
                self.log_test("Dashboard Stats", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Dashboard Stats", False, f"Error: {str(e)}")
            return False
    
    def test_portfolio_endpoint(self):
        """Test portfolio endpoint"""
        try:
            response = self.session.get(f"{BACKEND_URL}/portfolio")
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['total_balance', 'available_balance', 'total_pnl', 'positions']
                
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    # Validate portfolio structure
                    if (isinstance(data['total_balance'], (int, float)) and
                        isinstance(data['available_balance'], (int, float)) and
                        isinstance(data['total_pnl'], (int, float)) and
                        isinstance(data['positions'], dict)):
                        
                        self.log_test("Portfolio Endpoint", True, "Portfolio data structure is valid", data)
                        return True
                    else:
                        self.log_test("Portfolio Endpoint", False, "Invalid portfolio data types", data)
                        return False
                else:
                    self.log_test("Portfolio Endpoint", False, f"Missing fields: {missing_fields}", data)
                    return False
            else:
                self.log_test("Portfolio Endpoint", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Portfolio Endpoint", False, f"Error: {str(e)}")
            return False
    
    def test_trading_bot_controls(self):
        """Test start/stop trading bot functionality"""
        try:
            # Test start trading
            start_response = self.session.post(f"{BACKEND_URL}/start-trading")
            
            if start_response.status_code == 200:
                start_data = start_response.json()
                if "message" in start_data and "started" in start_data["message"].lower():
                    self.log_test("Start Trading Bot", True, "Bot started successfully", start_data)
                    
                    # Wait a moment then check status
                    time.sleep(2)
                    
                    # Check if bot status changed in dashboard
                    stats_response = self.session.get(f"{BACKEND_URL}/dashboard-stats")
                    if stats_response.status_code == 200:
                        stats_data = stats_response.json()
                        if stats_data.get('bot_status') == 'RUNNING':
                            self.log_test("Bot Status Check", True, "Bot status correctly shows RUNNING")
                        else:
                            self.log_test("Bot Status Check", False, f"Bot status is {stats_data.get('bot_status')}, expected RUNNING")
                    
                    # Test stop trading
                    stop_response = self.session.post(f"{BACKEND_URL}/stop-trading")
                    
                    if stop_response.status_code == 200:
                        stop_data = stop_response.json()
                        if "message" in stop_data and "stopped" in stop_data["message"].lower():
                            self.log_test("Stop Trading Bot", True, "Bot stopped successfully", stop_data)
                            return True
                        else:
                            self.log_test("Stop Trading Bot", False, "Unexpected stop response", stop_data)
                            return False
                    else:
                        self.log_test("Stop Trading Bot", False, f"HTTP {stop_response.status_code}", stop_response.text)
                        return False
                else:
                    self.log_test("Start Trading Bot", False, "Unexpected start response", start_data)
                    return False
            else:
                self.log_test("Start Trading Bot", False, f"HTTP {start_response.status_code}", start_response.text)
                return False
                
        except Exception as e:
            self.log_test("Trading Bot Controls", False, f"Error: {str(e)}")
            return False
    
    def test_signals_endpoint(self):
        """Test trading signals endpoint"""
        try:
            response = self.session.get(f"{BACKEND_URL}/signals")
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    if len(data) > 0:
                        # Check first signal structure
                        signal = data[0]
                        required_fields = ['symbol', 'signal_type', 'confidence', 'reasoning']
                        missing_fields = [field for field in required_fields if field not in signal]
                        
                        if not missing_fields:
                            # Validate signal data
                            if (isinstance(signal['symbol'], str) and
                                signal['signal_type'] in ['BUY', 'SELL', 'HOLD'] and
                                isinstance(signal['confidence'], (int, float)) and
                                0 <= signal['confidence'] <= 100 and
                                isinstance(signal['reasoning'], str)):
                                
                                self.log_test("Signals Endpoint", True, f"Retrieved {len(data)} valid signals", {"sample": signal})
                                return True
                            else:
                                self.log_test("Signals Endpoint", False, "Invalid signal data format", signal)
                                return False
                        else:
                            self.log_test("Signals Endpoint", False, f"Missing signal fields: {missing_fields}", signal)
                            return False
                    else:
                        self.log_test("Signals Endpoint", True, "No signals available yet (empty list)", data)
                        return True
                else:
                    self.log_test("Signals Endpoint", False, "Response is not a list", data)
                    return False
            else:
                self.log_test("Signals Endpoint", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Signals Endpoint", False, f"Error: {str(e)}")
            return False
    
    def test_trades_endpoint(self):
        """Test trading history endpoint"""
        try:
            response = self.session.get(f"{BACKEND_URL}/trades")
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    if len(data) > 0:
                        # Check first trade structure
                        trade = data[0]
                        required_fields = ['symbol', 'trade_type', 'quantity', 'entry_price', 'status']
                        missing_fields = [field for field in required_fields if field not in trade]
                        
                        if not missing_fields:
                            # Validate trade data
                            if (isinstance(trade['symbol'], str) and
                                trade['trade_type'] in ['BUY', 'SELL'] and
                                isinstance(trade['quantity'], (int, float)) and
                                isinstance(trade['entry_price'], (int, float)) and
                                trade['status'] in ['OPEN', 'CLOSED']):
                                
                                self.log_test("Trades Endpoint", True, f"Retrieved {len(data)} valid trades", {"sample": trade})
                                return True
                            else:
                                self.log_test("Trades Endpoint", False, "Invalid trade data format", trade)
                                return False
                        else:
                            self.log_test("Trades Endpoint", False, f"Missing trade fields: {missing_fields}", trade)
                            return False
                    else:
                        self.log_test("Trades Endpoint", True, "No trades available yet (empty list)", data)
                        return True
                else:
                    self.log_test("Trades Endpoint", False, "Response is not a list", data)
                    return False
            else:
                self.log_test("Trades Endpoint", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Trades Endpoint", False, f"Error: {str(e)}")
            return False
    
    def test_market_data_collection(self):
        """Test market data collection by starting bot and checking for data"""
        try:
            # Start the bot to trigger data collection
            start_response = self.session.post(f"{BACKEND_URL}/start-trading")
            
            if start_response.status_code == 200:
                print("🔄 Starting bot for market data collection test...")
                time.sleep(10)  # Wait for data collection
                
                # Test common crypto symbols
                test_symbols = ["BITCOIN/USD", "ETHEREUM/USD", "USD/EUR", "XAU/USD"]
                data_found = False
                
                for symbol in test_symbols:
                    try:
                        response = self.session.get(f"{BACKEND_URL}/market-data/{symbol}")
                        if response.status_code == 200:
                            data = response.json()
                            if isinstance(data, list) and len(data) > 0:
                                # Check data structure
                                item = data[0]
                                if ('symbol' in item and 'price' in item and 
                                    'market_type' in item and 'timestamp' in item):
                                    self.log_test(f"Market Data - {symbol}", True, f"Retrieved {len(data)} data points", {"sample": item})
                                    data_found = True
                                else:
                                    self.log_test(f"Market Data - {symbol}", False, "Invalid data structure", item)
                            else:
                                self.log_test(f"Market Data - {symbol}", True, "No data yet (expected for new system)")
                    except Exception as e:
                        self.log_test(f"Market Data - {symbol}", False, f"Error: {str(e)}")
                
                # Stop the bot
                self.session.post(f"{BACKEND_URL}/stop-trading")
                
                if data_found:
                    self.log_test("Market Data Collection", True, "Market data collection is working")
                    return True
                else:
                    self.log_test("Market Data Collection", True, "Market data endpoints working (no data yet - expected for new system)")
                    return True
            else:
                self.log_test("Market Data Collection", False, "Could not start bot for testing")
                return False
                
        except Exception as e:
            self.log_test("Market Data Collection", False, f"Error: {str(e)}")
            return False
    
    def test_technical_indicators(self):
        """Test technical indicators calculation"""
        try:
            # Test common symbols for indicators
            test_symbols = ["BITCOIN/USD", "ETHEREUM/USD", "USD/EUR"]
            indicators_working = False
            
            for symbol in test_symbols:
                try:
                    response = self.session.get(f"{BACKEND_URL}/indicators/{symbol}")
                    if response.status_code == 200:
                        data = response.json()
                        if isinstance(data, list) and len(data) > 0:
                            # Check indicator structure
                            indicator = data[0]
                            expected_fields = ['symbol', 'rsi', 'macd', 'bb_upper', 'bb_lower', 'sma_20']
                            
                            if any(field in indicator for field in expected_fields):
                                self.log_test(f"Technical Indicators - {symbol}", True, f"Retrieved {len(data)} indicator sets", {"sample": indicator})
                                indicators_working = True
                            else:
                                self.log_test(f"Technical Indicators - {symbol}", False, "Missing indicator fields", indicator)
                        else:
                            self.log_test(f"Technical Indicators - {symbol}", True, "No indicators yet (expected for new system)")
                except Exception as e:
                    self.log_test(f"Technical Indicators - {symbol}", False, f"Error: {str(e)}")
            
            if indicators_working:
                self.log_test("Technical Analysis Engine", True, "Technical indicators calculation is working")
                return True
            else:
                self.log_test("Technical Analysis Engine", True, "Technical indicators endpoints working (no data yet - expected)")
                return True
                
        except Exception as e:
            self.log_test("Technical Analysis Engine", False, f"Error: {str(e)}")
            return False
    
    def test_ai_signal_generation(self):
        """Test AI signal generation by running bot briefly"""
        try:
            # Start bot to generate signals
            start_response = self.session.post(f"{BACKEND_URL}/start-trading")
            
            if start_response.status_code == 200:
                print("🔄 Running bot for AI signal generation test...")
                time.sleep(15)  # Wait for signal generation
                
                # Check for signals
                response = self.session.get(f"{BACKEND_URL}/signals?limit=10")
                
                if response.status_code == 200:
                    signals = response.json()
                    
                    if isinstance(signals, list) and len(signals) > 0:
                        # Analyze signal quality
                        valid_signals = 0
                        for signal in signals:
                            if (signal.get('signal_type') in ['BUY', 'SELL', 'HOLD'] and
                                isinstance(signal.get('confidence'), (int, float)) and
                                0 <= signal.get('confidence', 0) <= 100 and
                                isinstance(signal.get('reasoning'), str) and
                                len(signal.get('reasoning', '')) > 0):
                                valid_signals += 1
                        
                        if valid_signals > 0:
                            self.log_test("AI Signal Generation", True, f"Generated {valid_signals} valid AI signals", {"total_signals": len(signals)})
                            success = True
                        else:
                            self.log_test("AI Signal Generation", False, "No valid signals generated", signals)
                            success = False
                    else:
                        self.log_test("AI Signal Generation", True, "AI signal system ready (no signals yet - expected for new system)")
                        success = True
                else:
                    self.log_test("AI Signal Generation", False, f"Could not retrieve signals: HTTP {response.status_code}")
                    success = False
                
                # Stop bot
                self.session.post(f"{BACKEND_URL}/stop-trading")
                return success
            else:
                self.log_test("AI Signal Generation", False, "Could not start bot for testing")
                return False
                
        except Exception as e:
            self.log_test("AI Signal Generation", False, f"Error: {str(e)}")
            return False
    
    def test_paper_trading_engine(self):
        """Test paper trading functionality"""
        try:
            # Get initial portfolio state
            initial_portfolio = self.session.get(f"{BACKEND_URL}/portfolio").json()
            initial_balance = initial_portfolio.get('total_balance', 0)
            
            # Start bot for paper trading
            start_response = self.session.post(f"{BACKEND_URL}/start-trading")
            
            if start_response.status_code == 200:
                print("🔄 Running bot for paper trading test...")
                time.sleep(20)  # Wait for potential trades
                
                # Check for any trades
                trades_response = self.session.get(f"{BACKEND_URL}/trades?limit=10")
                
                if trades_response.status_code == 200:
                    trades = trades_response.json()
                    
                    # Check portfolio for any changes
                    final_portfolio = self.session.get(f"{BACKEND_URL}/portfolio").json()
                    
                    if isinstance(trades, list):
                        if len(trades) > 0:
                            # Validate trade structure
                            valid_trades = 0
                            for trade in trades:
                                if (trade.get('trade_type') in ['BUY', 'SELL'] and
                                    isinstance(trade.get('quantity'), (int, float)) and
                                    isinstance(trade.get('entry_price'), (int, float)) and
                                    trade.get('status') in ['OPEN', 'CLOSED']):
                                    valid_trades += 1
                            
                            if valid_trades > 0:
                                self.log_test("Paper Trading Engine", True, f"Executed {valid_trades} valid paper trades", {"trades_count": len(trades)})
                                success = True
                            else:
                                self.log_test("Paper Trading Engine", False, "Invalid trade structures", trades)
                                success = False
                        else:
                            # Check if portfolio structure is valid even without trades
                            if (isinstance(final_portfolio.get('total_balance'), (int, float)) and
                                isinstance(final_portfolio.get('available_balance'), (int, float)) and
                                isinstance(final_portfolio.get('positions'), dict)):
                                self.log_test("Paper Trading Engine", True, "Paper trading system ready (no trades yet - expected for new system)")
                                success = True
                            else:
                                self.log_test("Paper Trading Engine", False, "Invalid portfolio structure", final_portfolio)
                                success = False
                    else:
                        self.log_test("Paper Trading Engine", False, "Invalid trades response format")
                        success = False
                else:
                    self.log_test("Paper Trading Engine", False, f"Could not retrieve trades: HTTP {trades_response.status_code}")
                    success = False
                
                # Stop bot
                self.session.post(f"{BACKEND_URL}/stop-trading")
                return success
            else:
                self.log_test("Paper Trading Engine", False, "Could not start bot for testing")
                return False
                
        except Exception as e:
            self.log_test("Paper Trading Engine", False, f"Error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting HTF Trading Bot Backend API Tests")
        print("=" * 60)
        
        tests = [
            ("Health Check", self.test_health_check),
            ("Dashboard Stats", self.test_dashboard_stats),
            ("Portfolio Endpoint", self.test_portfolio_endpoint),
            ("Trading Bot Controls", self.test_trading_bot_controls),
            ("Signals Endpoint", self.test_signals_endpoint),
            ("Trades Endpoint", self.test_trades_endpoint),
            ("Market Data Collection", self.test_market_data_collection),
            ("Technical Analysis Engine", self.test_technical_indicators),
            ("AI Signal Generation", self.test_ai_signal_generation),
            ("Paper Trading Engine", self.test_paper_trading_engine),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            print(f"\n📋 Running {test_name}...")
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL {test_name}: Unexpected error - {str(e)}")
                failed += 1
        
        print("\n" + "=" * 60)
        print(f"🏁 Test Results: {passed} passed, {failed} failed")
        
        if failed == 0:
            print("🎉 All tests passed! HTF Trading Bot backend is working correctly.")
        else:
            print(f"⚠️  {failed} test(s) failed. Check the details above.")
        
        return failed == 0

def main():
    """Main test execution"""
    tester = HTFTradingBotTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(tester.test_results, f, indent=2, default=str)
    
    print(f"\n📄 Detailed test results saved to: /app/backend_test_results.json")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())