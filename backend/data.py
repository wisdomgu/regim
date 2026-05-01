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

def fetch_crypto(symbol: str = "BTC/USDT", days: int = 365) -> pd.DataFrame:
    yf_symbol = symbol.replace("/USDT", "-USD").replace("/", "-")
    period_map = {90: "3mo", 180: "6mo", 365: "1y", 730: "2y"}
    period = period_map.get(days, "1y")
    
    df = yf.download(yf_symbol, period=period, interval="1d", auto_adjust=True)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df[["Open", "High", "Low", "Close", "Volume"]]
    df = df.replace([np.inf, -np.inf], np.nan).dropna()
    return df

def fetch_intraday(ticker: str, days: int = 90) -> pd.DataFrame:
    crypto_tickers = {"BTC-USD", "ETH-USD", "BTC/USDT", "ETH/USDT"}
    
    if ticker.upper() in crypto_tickers:
        yf_symbol = ticker.upper().replace("/USDT", "-USD").replace("/", "-")
        intraday_days = min(days, 730)
        df = yf.download(yf_symbol, period=f"{intraday_days}d", interval="1h", auto_adjust=True)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        df = df[["Open", "High", "Low", "Close", "Volume"]]
        return df.replace([np.inf, -np.inf], np.nan).dropna()

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

def fetch_data(ticker: str = "SPY", period: str = "1y", interval: str = "1d") -> pd.DataFrame:
    crypto_tickers = {"BTC-USD", "ETH-USD", "BTC/USDT", "ETH/USDT"}
    if ticker.upper() in crypto_tickers:
        yf_symbol = ticker.upper().replace("/USDT", "-USD").replace("/", "-")
        days = {"3mo": 90, "6mo": 180, "1y": 365, "2y": 730}.get(period, 365)
        return fetch_crypto(yf_symbol.replace("-USD", "/USDT"), days)
    return fetch_equity(ticker, period, interval)