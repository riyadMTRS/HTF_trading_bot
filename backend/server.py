from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import asyncio
import aiohttp
import pandas as pd
import numpy as np
from scipy import stats
import json
import time
import threading
from concurrent.futures import ThreadPoolExecutor

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="HTF Trading Bot", description="High-Frequency Trading Bot with AI")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Global variables for data collection
data_collection_active = False
executor = ThreadPoolExecutor(max_workers=4)

# Models
class MarketData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str
    market_type: str  # forex, crypto, gold
    price: float
    volume: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    high_24h: Optional[float] = None
    low_24h: Optional[float] = None
    change_24h: Optional[float] = None

class TechnicalIndicators(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str
    rsi: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    bb_upper: Optional[float] = None
    bb_lower: Optional[float] = None
    bb_middle: Optional[float] = None
    sma_20: Optional[float] = None
    ema_12: Optional[float] = None
    ema_26: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class TradeSignal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str
    signal_type: str  # BUY, SELL, HOLD
    confidence: float  # 0-100
    reasoning: str
    price_target: Optional[float] = None
    stop_loss: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class PaperTrade(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str
    trade_type: str  # BUY, SELL
    quantity: float
    entry_price: float
    exit_price: Optional[float] = None
    status: str = "OPEN"  # OPEN, CLOSED
    pnl: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Portfolio(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    total_balance: float = 10000.0  # Starting with $10k paper money
    available_balance: float = 10000.0
    total_pnl: float = 0.0
    positions: Dict[str, float] = {}
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Market Data Collection Functions
async def fetch_crypto_data():
    """Fetch cryptocurrency data from CoinGecko"""
    try:
        async with aiohttp.ClientSession() as session:
            # Popular crypto symbols
            symbols = ['bitcoin', 'ethereum', 'binancecoin', 'cardano', 'solana']
            
            for symbol in symbols:
                url = f"https://api.coingecko.com/api/v3/simple/price?ids={symbol}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true"
                
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        if symbol in data:
                            market_data = MarketData(
                                symbol=f"{symbol.upper()}/USD",
                                market_type="crypto",
                                price=data[symbol]['usd'],
                                volume=data[symbol].get('usd_24h_vol', 0),
                                change_24h=data[symbol].get('usd_24h_change', 0)
                            )
                            await db.market_data.insert_one(market_data.dict())
                
                await asyncio.sleep(1)  # Rate limiting
                
    except Exception as e:
        logging.error(f"Error fetching crypto data: {e}")

async def fetch_forex_data():
    """Fetch forex data from Exchange Rates API"""
    try:
        async with aiohttp.ClientSession() as session:
            # Major forex pairs
            pairs = [('USD', 'EUR'), ('USD', 'GBP'), ('USD', 'JPY'), ('EUR', 'GBP')]
            
            url = "https://api.exchangerate-api.com/v4/latest/USD"
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    rates = data['rates']
                    
                    for base, quote in pairs:
                        if quote in rates:
                            rate = 1 / rates[quote] if base == 'USD' else rates[quote]
                            market_data = MarketData(
                                symbol=f"{base}/{quote}",
                                market_type="forex",
                                price=rate
                            )
                            await db.market_data.insert_one(market_data.dict())
                            
    except Exception as e:
        logging.error(f"Error fetching forex data: {e}")

async def fetch_gold_data():
    """Fetch gold price data"""
    try:
        async with aiohttp.ClientSession() as session:
            # Using metals-api.com free tier or backup method
            url = "https://api.metals.live/v1/spot/gold"
            
            try:
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        market_data = MarketData(
                            symbol="XAU/USD",
                            market_type="gold",
                            price=data.get('price', 2000.0)  # Fallback price
                        )
                        await db.market_data.insert_one(market_data.dict())
            except:
                # Fallback: simulate gold price around $2000
                import random
                base_price = 2000.0
                fluctuation = random.uniform(-50, 50)
                market_data = MarketData(
                    symbol="XAU/USD",
                    market_type="gold",
                    price=base_price + fluctuation
                )
                await db.market_data.insert_one(market_data.dict())
                
    except Exception as e:
        logging.error(f"Error fetching gold data: {e}")

# Technical Analysis Functions
def calculate_rsi(prices, window=14):
    """Calculate Relative Strength Index"""
    if len(prices) < window + 1:
        return None
        
    deltas = np.diff(prices)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    
    avg_gain = np.mean(gains[:window])
    avg_loss = np.mean(losses[:window])
    
    if avg_loss == 0:
        return 100
    
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def calculate_macd(prices, fast=12, slow=26, signal=9):
    """Calculate MACD"""
    if len(prices) < slow:
        return None, None
        
    ema_fast = pd.Series(prices).ewm(span=fast).mean()
    ema_slow = pd.Series(prices).ewm(span=slow).mean()
    
    macd = ema_fast - ema_slow
    macd_signal = macd.ewm(span=signal).mean()
    
    return macd.iloc[-1], macd_signal.iloc[-1]

def calculate_bollinger_bands(prices, window=20, std_dev=2):
    """Calculate Bollinger Bands"""
    if len(prices) < window:
        return None, None, None
        
    sma = np.mean(prices[-window:])
    std = np.std(prices[-window:])
    
    upper = sma + (std_dev * std)
    lower = sma - (std_dev * std)
    
    return upper, sma, lower

async def calculate_technical_indicators(symbol: str):
    """Calculate technical indicators for a symbol"""
    try:
        # Get last 100 price points
        cursor = db.market_data.find(
            {"symbol": symbol},
            sort=[("timestamp", -1)],
            limit=100
        )
        
        data = await cursor.to_list(length=100)
        if len(data) < 20:
            return None
            
        prices = [float(item['price']) for item in reversed(data)]
        
        # Calculate indicators
        rsi = calculate_rsi(prices)
        macd, macd_signal = calculate_macd(prices)
        bb_upper, bb_middle, bb_lower = calculate_bollinger_bands(prices)
        
        sma_20 = np.mean(prices[-20:]) if len(prices) >= 20 else None
        ema_12 = pd.Series(prices).ewm(span=12).mean().iloc[-1] if len(prices) >= 12 else None
        ema_26 = pd.Series(prices).ewm(span=26).mean().iloc[-1] if len(prices) >= 26 else None
        
        indicators = TechnicalIndicators(
            symbol=symbol,
            rsi=rsi,
            macd=macd,
            macd_signal=macd_signal,
            bb_upper=bb_upper,
            bb_middle=bb_middle,
            bb_lower=bb_lower,
            sma_20=sma_20,
            ema_12=ema_12,
            ema_26=ema_26
        )
        
        await db.technical_indicators.insert_one(indicators.dict())
        return indicators
        
    except Exception as e:
        logging.error(f"Error calculating indicators for {symbol}: {e}")
        return None

# AI Trading Logic
async def generate_trade_signal(symbol: str, indicators: TechnicalIndicators, current_price: float):
    """Generate AI-powered trade signals"""
    try:
        signals = []
        confidence = 0
        reasoning = []
        
        # RSI Analysis
        if indicators.rsi:
            if indicators.rsi < 30:
                signals.append("BUY")
                confidence += 25
                reasoning.append(f"RSI oversold ({indicators.rsi:.2f})")
            elif indicators.rsi > 70:
                signals.append("SELL")
                confidence += 25
                reasoning.append(f"RSI overbought ({indicators.rsi:.2f})")
        
        # MACD Analysis
        if indicators.macd and indicators.macd_signal:
            if indicators.macd > indicators.macd_signal:
                signals.append("BUY")
                confidence += 20
                reasoning.append("MACD bullish crossover")
            else:
                signals.append("SELL")
                confidence += 20
                reasoning.append("MACD bearish crossover")
        
        # Bollinger Bands Analysis
        if indicators.bb_upper and indicators.bb_lower:
            if current_price <= indicators.bb_lower:
                signals.append("BUY")
                confidence += 30
                reasoning.append("Price at lower Bollinger Band")
            elif current_price >= indicators.bb_upper:
                signals.append("SELL")
                confidence += 30
                reasoning.append("Price at upper Bollinger Band")
        
        # Moving Average Analysis
        if indicators.ema_12 and indicators.ema_26:
            if indicators.ema_12 > indicators.ema_26:
                signals.append("BUY")
                confidence += 15
                reasoning.append("EMA12 > EMA26 (bullish trend)")
            else:
                signals.append("SELL")
                confidence += 15
                reasoning.append("EMA12 < EMA26 (bearish trend)")
        
        # Determine final signal
        buy_signals = signals.count("BUY")
        sell_signals = signals.count("SELL")
        
        if buy_signals > sell_signals:
            signal_type = "BUY"
        elif sell_signals > buy_signals:
            signal_type = "SELL"
        else:
            signal_type = "HOLD"
            confidence = 0
        
        # Risk management - calculate stop loss and target
        stop_loss = None
        price_target = None
        
        if signal_type == "BUY":
            stop_loss = current_price * 0.98  # 2% stop loss
            price_target = current_price * 1.06  # 6% profit target
        elif signal_type == "SELL":
            stop_loss = current_price * 1.02  # 2% stop loss
            price_target = current_price * 0.94  # 6% profit target
        
        trade_signal = TradeSignal(
            symbol=symbol,
            signal_type=signal_type,
            confidence=min(confidence, 100),
            reasoning=" | ".join(reasoning) if reasoning else "No clear signals",
            price_target=price_target,
            stop_loss=stop_loss
        )
        
        await db.trade_signals.insert_one(trade_signal.dict())
        return trade_signal
        
    except Exception as e:
        logging.error(f"Error generating signal for {symbol}: {e}")
        return None

# Background task for data collection and analysis
async def trading_engine():
    """Main trading engine that runs continuously"""
    while data_collection_active:
        try:
            # Collect market data
            await fetch_crypto_data()
            await fetch_forex_data()
            await fetch_gold_data()
            
            # Get all unique symbols
            symbols = await db.market_data.distinct("symbol")
            
            for symbol in symbols:
                # Calculate technical indicators
                indicators = await calculate_technical_indicators(symbol)
                
                if indicators:
                    # Get current price
                    latest_data = await db.market_data.find_one(
                        {"symbol": symbol},
                        sort=[("timestamp", -1)]
                    )
                    
                    if latest_data:
                        current_price = latest_data['price']
                        
                        # Generate trading signal
                        signal = await generate_trade_signal(symbol, indicators, current_price)
                        
                        # Execute paper trades based on signals
                        if signal and signal.confidence > 60:
                            await execute_paper_trade(signal, current_price)
            
            # Wait before next cycle (5 minutes)
            await asyncio.sleep(300)
            
        except Exception as e:
            logging.error(f"Error in trading engine: {e}")
            await asyncio.sleep(60)

async def execute_paper_trade(signal: TradeSignal, current_price: float):
    """Execute paper trading based on signals"""
    try:
        # Get current portfolio
        portfolio = await db.portfolio.find_one(sort=[("updated_at", -1)])
        if not portfolio:
            portfolio = Portfolio().dict()
            await db.portfolio.insert_one(portfolio)
        
        # Simple position sizing (2% of available balance per trade)
        risk_amount = portfolio['available_balance'] * 0.02
        quantity = risk_amount / current_price
        
        if signal.signal_type == "BUY" and portfolio['available_balance'] >= risk_amount:
            # Execute buy order
            trade = PaperTrade(
                symbol=signal.symbol,
                trade_type="BUY",
                quantity=quantity,
                entry_price=current_price
            )
            
            # Update portfolio
            portfolio['available_balance'] -= risk_amount
            portfolio['positions'][signal.symbol] = portfolio['positions'].get(signal.symbol, 0) + quantity
            
            await db.paper_trades.insert_one(trade.dict())
            await db.portfolio.update_one(
                {"id": portfolio['id']},
                {"$set": portfolio}
            )
            
            logging.info(f"Paper BUY executed: {signal.symbol} @ {current_price} | Qty: {quantity}")
            
    except Exception as e:
        logging.error(f"Error executing paper trade: {e}")

# API Routes
@api_router.get("/")
async def root():
    return {"message": "HTF Trading Bot API v1.0"}

@api_router.post("/start-trading")
async def start_trading(background_tasks: BackgroundTasks):
    global data_collection_active
    if not data_collection_active:
        data_collection_active = True
        background_tasks.add_task(trading_engine)
        return {"message": "Trading bot started successfully"}
    return {"message": "Trading bot already running"}

@api_router.post("/stop-trading")
async def stop_trading():
    global data_collection_active
    data_collection_active = False
    return {"message": "Trading bot stopped"}

@api_router.get("/market-data/{symbol}")
async def get_market_data(symbol: str, limit: int = 100):
    cursor = db.market_data.find(
        {"symbol": symbol},
        sort=[("timestamp", -1)],
        limit=limit
    )
    data = await cursor.to_list(length=limit)
    
    # Remove MongoDB ObjectIds to make JSON serializable
    for item in data:
        if "_id" in item:
            del item["_id"]
    
    return data

@api_router.get("/signals", response_model=List[TradeSignal])
async def get_signals(limit: int = 50):
    cursor = db.trade_signals.find(
        sort=[("timestamp", -1)],
        limit=limit
    )
    signals = await cursor.to_list(length=limit)
    
    # Remove MongoDB ObjectIds and convert to TradeSignal objects
    clean_signals = []
    for signal in signals:
        if "_id" in signal:
            del signal["_id"]
        clean_signals.append(TradeSignal(**signal))
    
    return clean_signals

@api_router.get("/portfolio")
async def get_portfolio():
    portfolio = await db.portfolio.find_one(sort=[("updated_at", -1)])
    if not portfolio:
        portfolio = Portfolio().dict()
        await db.portfolio.insert_one(portfolio)
    
    # Remove MongoDB ObjectId to make it JSON serializable
    if "_id" in portfolio:
        del portfolio["_id"]
    
    return portfolio

@api_router.get("/trades", response_model=List[PaperTrade])
async def get_trades(limit: int = 100):
    cursor = db.paper_trades.find(
        sort=[("timestamp", -1)],
        limit=limit
    )
    trades = await cursor.to_list(length=limit)
    return [PaperTrade(**trade) for trade in trades]

@api_router.get("/indicators/{symbol}")
async def get_indicators(symbol: str, limit: int = 20):
    cursor = db.technical_indicators.find(
        {"symbol": symbol},
        sort=[("timestamp", -1)],
        limit=limit
    )
    indicators = await cursor.to_list(length=limit)
    return indicators

@api_router.get("/dashboard-stats")
async def get_dashboard_stats():
    # Get latest portfolio
    portfolio = await db.portfolio.find_one(sort=[("updated_at", -1)])
    
    # Count active positions
    active_positions = len(portfolio['positions']) if portfolio and portfolio['positions'] else 0
    
    # Get total trades count
    total_trades = await db.paper_trades.count_documents({})
    
    # Get recent signals count
    recent_signals = await db.trade_signals.count_documents({
        "timestamp": {"$gte": datetime.utcnow() - timedelta(hours=24)}
    })
    
    # Get market symbols count
    symbols_count = len(await db.market_data.distinct("symbol"))
    
    return {
        "total_balance": portfolio['total_balance'] if portfolio else 10000,
        "available_balance": portfolio['available_balance'] if portfolio else 10000,
        "total_pnl": portfolio['total_pnl'] if portfolio else 0,
        "active_positions": active_positions,
        "total_trades": total_trades,
        "recent_signals": recent_signals,
        "symbols_tracked": symbols_count,
        "bot_status": "RUNNING" if data_collection_active else "STOPPED"
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    global data_collection_active
    data_collection_active = False
    client.close()