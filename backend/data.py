import yfinance as yf
import ccxt
import pandas as pd
import numpy as np

def fetch_equity(ticker: str = "SPY", period: str = "1y", interval: str = "1d") -> pd.DataFrame:
    period_to_days = {
    "3mo": 90,
    "6mo": 180,
    "1y": 365,
    }

    days = period_to_days.get(period, 365)
    intraday_days = min(days, 730)
    df = yf.download(ticker, period=f"{intraday_days}d", interval=interval, auto_adjust=True)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df[["Open", "High", "Low", "Close", "Volume"]]
    df = df.replace([np.inf, -np.inf], np.nan).dropna()
    return df

def fetch_intraday(ticker: str, days: int = 90) -> pd.DataFrame:
    """Pull hourly OHLCV. yfinance supports hourly for last ~730 days."""
    crypto_tickers = {"BTC-USD", "ETH-USD", "BTC/USDT", "ETH/USDT"}
    if ticker.upper() in crypto_tickers:
        symbol = ticker.upper().replace("-", "/")
        if "/" not in symbol:
            symbol += "/USDT"
        exchange = ccxt.binance()
        since = exchange.parse8601(
            (pd.Timestamp.now() - pd.Timedelta(days=days)).strftime("%Y-%m-%dT00:00:00Z")
        )
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe="1h", since=since, limit=days * 24)
        df = pd.DataFrame(ohlcv, columns=["timestamp", "Open", "High", "Low", "Close", "Volume"])
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
        df = df.set_index("timestamp")
        df.index.name = "Date"
    else:
        for attempt in range(3):
            try:
                df = yf.download(ticker, period=f"{days}d", interval="1h", auto_adjust=True)
                if isinstance(df.columns, pd.MultiIndex):
                    df.columns = df.columns.get_level_values(0)
                df = df[["Open", "High", "Low", "Close", "Volume"]]
                df = df.replace([np.inf, -np.inf], np.nan).dropna()
                if len(df) > 100:
                    return df
            except Exception:
                continue
        return df

    return df.replace([np.inf, -np.inf], np.nan).dropna()

def fetch_crypto(symbol: str = "BTC/USDT", days: int = 365) -> pd.DataFrame:
    exchange = ccxt.binance()
    since = exchange.parse8601(
        (pd.Timestamp.now() - pd.Timedelta(days=days)).strftime("%Y-%m-%dT00:00:00Z")
    )
    ohlcv = exchange.fetch_ohlcv(symbol, timeframe="1d", since=since, limit=days)
    df = pd.DataFrame(ohlcv, columns=["timestamp", "Open", "High", "Low", "Close", "Volume"])
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
    df = df.set_index("timestamp")
    df.index.name = "Date"
    df = df.replace([np.inf, -np.inf], np.nan).dropna()
    return df

def fetch_data(ticker: str = "SPY", period: str = "1y", interval: str = "1d") -> pd.DataFrame:
    """Unified fetch — routes to equity or crypto based on ticker format."""
    crypto_tickers = {"BTC-USD", "ETH-USD", "BTC/USDT", "ETH/USDT"}
    if ticker.upper() in crypto_tickers:
        symbol = ticker.upper().replace("-", "/")
        if "/" not in symbol:
            symbol = symbol + "/USDT"
        days = {"3mo": 90, "6mo": 180, "1y": 365, "2y": 730}.get(period, 365)
        return fetch_crypto(symbol, days)
    return fetch_equity(ticker, period, interval)