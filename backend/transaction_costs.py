"""
Transaction cost models for realistic execution simulation.
Implements Almgren-Chriss framework with regime-dependent parameters.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple
from dataclasses import dataclass
import scipy

@dataclass
class MarketParams:
    """Market microstructure parameters for cost modeling."""
    ticker: str
    daily_volume: float  # Average daily volume (shares)
    volatility: float    # Daily volatility (annualized)
    spread_bps: float    # Bid-ask spread in basis points
    tick_size: float     # Minimum price increment
    eta: float = 0.1     # Temporary impact coefficient
    gamma: float = 0.1   # Permanent impact coefficient


class TransactionCostModel:
    """
    Almgren-Chriss transaction cost model with regime-dependent parameters.
    
    Reference:
    Almgren, R., & Chriss, N. (2001). Optimal execution of portfolio transactions.
    Journal of Risk, 3, 5-39.
    """
    
    def __init__(self, ticker: str, price_data: pd.DataFrame):
        """
        Initialize cost model with historical data for calibration.
        
        Args:
            ticker: Asset ticker symbol
            price_data: DataFrame with columns ['Open', 'High', 'Low', 'Close', 'Volume']
        """
        self.ticker = ticker
        self.regime_spread_multipliers = None
        self.regime_drift = None
        self.params = self._calibrate_parameters(price_data)
        
    def _calibrate_parameters(self, data: pd.DataFrame) -> MarketParams:
        """
        Calibrate market impact parameters from historical data.
        
        In production, you'd estimate these from tick data or use literature values.
        For now, we use stylized facts:
        - Large cap equities: η ≈ 0.05-0.15, γ ≈ 0.05-0.10
        - Crypto: η ≈ 0.20-0.40, γ ≈ 0.10-0.20
        - Small cap: η ≈ 0.30-0.50, γ ≈ 0.15-0.25
        """
        
        avg_volume = data['Volume'].mean()
        volatility = data['Close'].pct_change().std() * np.sqrt(252)

        
        avg_range = (data['High'] - data['Low']).mean()
        avg_price = data['Close'].mean()
        spread_bps = (avg_range / avg_price) * 10000 * 0.5
        
        if self.ticker in ['SPY', 'QQQ', 'IWM']:
            eta, gamma = 0.10, 0.05  # Large cap ETFs
        elif self.ticker in ['BTC', 'ETH']:
            eta, gamma = 0.30, 0.15  # Crypto (higher impact)
        elif self.ticker in ['GLD', 'TLT']:
            eta, gamma = 0.12, 0.06  # Commodities/Bonds
        else:
            eta, gamma = 0.15, 0.08  # Default
        
        return MarketParams(
            ticker=self.ticker,
            daily_volume=avg_volume,
            volatility=volatility,
            spread_bps=spread_bps,
            tick_size=0.01,
            eta=eta,
            gamma=gamma
        )

    def measure_regime_spreads(self, data: pd.DataFrame, regimes: np.ndarray) -> Dict[int, float]:
        """Empirically measure spread widening by regime."""
        regime_spreads = {}
        
        for regime in [0, 1, 2, 3]:
            regime_mask = regimes == regime
            regime_data = data[regime_mask]
            
            avg_range = (regime_data['High'] - regime_data['Low']).mean()
            avg_price = regime_data['Close'].mean()
            regime_spreads[regime] = (avg_range / avg_price) * 10000 * 0.5
        
        bullish_spread = regime_spreads[3]
        return {k: v / bullish_spread for k, v in regime_spreads.items()}
    
    def measure_regime_drift(
        self,
        data: pd.DataFrame,
        regimes: np.ndarray
    ) -> Dict[int, float]:
        """
        Compute average return per regime (used for timing cost).
        """
        returns = data['Close'].pct_change()

        regime_drift = {}

        for regime in [0, 1, 2, 3]:
            mask = regimes == regime
            regime_returns = returns[mask]

            if len(regime_returns) == 0:
                regime_drift[regime] = 0.0
            else:
                regime_drift[regime] = regime_returns.mean()

        return regime_drift

    def compute_execution_cost(
        self,
        execution_schedule: List[float],
        total_shares: float,
        regime: int,
        intraday_prices: pd.DataFrame,
        spread_multipliers=None,
    ) -> Dict[str, float]:
        """
        Compute total execution cost for a given schedule.
        
        Args:
            execution_schedule: List of weights summing to 1.0 (e.g., [0.2, 0.2, 0.2, 0.2, 0.2, 0.0])
            total_shares: Total order size in shares
            regime: Current regime (0=bearish, 1=transition, 2=bullish)
            intraday_prices: DataFrame with hourly prices
            
        Returns:
            Dictionary with cost breakdown in basis points
        """

        if self.regime_spread_multipliers is None:
            raise ValueError("Regime spread multipliers not set")

        adjusted_spread = self.params.spread_bps * self.regime_spread_multipliers[regime]
        
        if self.regime_drift is None:
            raise ValueError("Regime drift not set")

        daily_drift = self.regime_drift.get(regime, 0.0)

        hourly_drift = daily_drift / len(execution_schedule)
        
        spread_cost = 0.0
        temp_impact_cost = 0.0
        perm_impact_cost = 0.0
        timing_cost = 0.0
        
        cumulative_shares = 0.0
        
        for t, weight in enumerate(execution_schedule):
            if weight == 0:
                continue
                
            shares_this_slice = total_shares * weight
            participation_rate = shares_this_slice / self.params.daily_volume
            
            spread_cost += 0.5 * adjusted_spread * weight
            
            temp_impact = (
                self.params.eta * 
                self.params.volatility * 
                np.sqrt(shares_this_slice / self.params.daily_volume) *
                (participation_rate ** 1.5)
            )
            temp_impact_bps = temp_impact * 10000
            temp_impact_cost += temp_impact_bps * weight
            
            perm_impact = self.params.gamma * (shares_this_slice / self.params.daily_volume)
            perm_impact_bps = perm_impact * 10000
            perm_impact_cost += perm_impact_bps * weight
            
            hours_waited = t
            timing_cost += hourly_drift * hours_waited * weight * 10000
            
            cumulative_shares += shares_this_slice
        
        total_cost = spread_cost + temp_impact_cost + perm_impact_cost + timing_cost
        
        return {
            'total_cost_bps': total_cost,
            'spread_cost_bps': spread_cost,
            'temporary_impact_bps': temp_impact_cost,
            'permanent_impact_bps': perm_impact_cost,
            'timing_cost_bps': timing_cost,
            'regime': regime,
            'participation_rate': total_shares / self.params.daily_volume,
        }
    
    def compare_strategies(
        self,
        total_shares: float,
        regime: int,
        intraday_prices: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Compare different execution strategies.
        
        Returns DataFrame with cost breakdown for:
        - TWAP (uniform)
        - Front-loaded (aggressive)
        - Back-loaded (passive)
        - Regime-aware (your strategy)
        """
        
        strategies = {
            'TWAP': [1/6] * 6,  # Uniform
            'Front-Loaded': [0.4, 0.3, 0.2, 0.1, 0.0, 0.0],  # Aggressive
            'Back-Loaded': [0.0, 0.0, 0.1, 0.2, 0.3, 0.4],  # Passive
            'Regime-Aware': self._get_regime_schedule(regime)  # Your method
        }
        
        results = []
        
        for name, schedule in strategies.items():
            costs = self.compute_execution_cost(
                schedule, total_shares, regime, intraday_prices
            )
            costs['strategy'] = name
            results.append(costs)
        
        return pd.DataFrame(results)
    
    def _get_regime_schedule(self, regime: int) -> List[float]:
        """
        Get execution schedule based on regime.
        
        Bullish: Front-load (catch the drift)
        Transition: Uniform (no edge)
        Bearish: Back-load (avoid adverse selection)
        """
        schedules = {
            0: [1/6, 1/6, 1/6, 1/6, 1/6, 1/6],        # Crash: TWAP (halt)
            1: [0.05, 0.10, 0.15, 0.20, 0.25, 0.25],  # Bearish: back-loaded
            2: [1/6, 1/6, 1/6, 1/6, 1/6, 1/6],        # Transition: TWAP
            3: [0.30, 0.25, 0.20, 0.15, 0.10, 0.00],  # Bullish: front-loaded
        }
        return schedules.get(regime, schedules[2])
    
    def set_regime_drift(self, drift: Dict[int, float]):
        self.regime_drift = drift

    def set_regime_spreads(self, spreads: Dict[int, float]):
        self.regime_spread_multipliers = spreads

class SlippageSimulator:
    """
    Simulate realistic slippage for backtest validation.
    
    Uses actual intraday price movements to estimate execution quality.
    """
    
    def __init__(self, hourly_data: pd.DataFrame):
        """
        Args:
            hourly_data: DataFrame with hourly OHLCV data
        """
        self.hourly_data = hourly_data
    
    def simulate_execution(
        self,
        date: str,
        execution_schedule: List[float],
        total_shares: float,
        side: str = 'buy'
    ) -> Dict[str, float]:
        """
        Simulate execution using actual intraday prices.
        
        Args:
            date: Trading date (YYYY-MM-DD)
            execution_schedule: Weights for each hour
            total_shares: Order size
            side: 'buy' or 'sell'
            
        Returns:
            Execution quality metrics vs VWAP benchmark
        """
        
        day_data = self.hourly_data[self.hourly_data.index.date == pd.to_datetime(date).date()]
        
        if len(day_data) < 6:
            return {'slippage_bps': np.nan, 'vwap_slippage_bps': np.nan}
        
        fills = []
        for hour_idx, weight in enumerate(execution_schedule):
            if weight == 0 or hour_idx >= len(day_data):
                continue
            
            hour_data = day_data.iloc[hour_idx]
            
            base_price = (hour_data['High'] + hour_data['Low']) / 2
            
            slippage_factor = weight * 0.5  
            price_range = hour_data['High'] - hour_data['Low']
            
            if side == 'buy':
                fill_price = base_price + slippage_factor * price_range
            else:
                fill_price = base_price - slippage_factor * price_range
            
            shares_filled = total_shares * weight
            fills.append({
                'price': fill_price,
                'shares': shares_filled,
                'hour': hour_idx
            })
        
        total_cost = sum(f['price'] * f['shares'] for f in fills)
        total_shares_filled = sum(f['shares'] for f in fills)
        avg_fill_price = total_cost / total_shares_filled if total_shares_filled > 0 else np.nan
        
        vwap = (day_data['Volume'] * day_data['Close']).sum() / day_data['Volume'].sum()
        arrival_price = day_data.iloc[0]['Open']
        
        if side == 'buy':
            slippage_bps = ((avg_fill_price - arrival_price) / arrival_price) * 10000
            vwap_slippage_bps = ((avg_fill_price - vwap) / vwap) * 10000
        else:
            slippage_bps = ((arrival_price - avg_fill_price) / arrival_price) * 10000
            vwap_slippage_bps = ((vwap - avg_fill_price) / vwap) * 10000
        
        return {
            'avg_fill_price': avg_fill_price,
            'arrival_price': arrival_price,
            'vwap': vwap,
            'slippage_bps': slippage_bps,
            'vwap_slippage_bps': vwap_slippage_bps,
            'total_shares_filled': total_shares_filled,
        }


def calibrate_impact_parameters(ticker: str, data: pd.DataFrame) -> Dict[str, float]:
    """
    Calibrate and return market impact parameters for a given asset.
    Useful for paper's methodology appendix.
    """
    model = TransactionCostModel(ticker, data)
    
    return {
        'ticker': ticker,
        'eta_temporary_impact': model.params.eta,
        'gamma_permanent_impact': model.params.gamma,
        'daily_volume': model.params.daily_volume,
        'volatility_annual': model.params.volatility,
        'spread_bps': model.params.spread_bps,
        'asset_class': 'equity' if ticker in ['SPY', 'QQQ', 'IWM', 'AAPL'] else 
                       'crypto' if ticker in ['BTC', 'ETH'] else 'other'
    }



def run_intraday_backtest_with_costs(
    ticker: str,
    regimes: np.ndarray,
    daily_data: pd.DataFrame,
    hourly_data: pd.DataFrame,
    n_bootstrap: int = 1000
) -> Dict:
    """
    Enhanced backtest using realistic transaction cost model.
    """
    
    cost_model = TransactionCostModel(ticker, daily_data)

    spread_mults = cost_model.measure_regime_spreads(daily_data, regimes)
    drift_per_regime = cost_model.measure_regime_drift(daily_data, regimes)

    cost_model.set_regime_spreads(spread_mults)
    cost_model.set_regime_drift(drift_per_regime)

    all_costs = {
        'regime_aware': [],
        'twap': [],
        'front_loaded': [],
        'back_loaded': []
    }
    
    regime_breakdown = {0: [], 1: [], 2: []}
    
    for date in daily_data.index[252:]: 
        regime_today = regimes[daily_data.index.get_loc(date)]
        
        day_hourly = hourly_data[hourly_data.index.date == date.date()]
        
        if len(day_hourly) < 6:
            continue
        
        notional = 1_000_000
        price = daily_data.loc[date, 'Close']
        shares = notional / price
        
        comparison = cost_model.compare_strategies(
            total_shares=shares,
            regime=regime_today,
            intraday_prices=day_hourly
        )
        
        for _, row in comparison.iterrows():
            strategy = row['strategy']
            if strategy in all_costs:
                all_costs[strategy].append(row['total_cost_bps'])
        
        regime_row = comparison[comparison['strategy'] == 'Regime-Aware'].iloc[0]
        regime_breakdown[regime_today].append(regime_row['total_cost_bps'])
    
    savings = np.array(all_costs['twap']) - np.array(all_costs['regime_aware'])
    
    bootstrap_means = []
    for _ in range(n_bootstrap):
        sample = np.random.choice(savings, size=len(savings), replace=True)
        bootstrap_means.append(np.mean(sample))
    
    ci_lower, ci_upper = np.percentile(bootstrap_means, [2.5, 97.5])
    
    from scipy import stats
    t_stat, p_value = stats.ttest_rel(all_costs['twap'], all_costs['regime_aware'])
    
    return {
        'mean_saving_bps': np.mean(savings),
        'median_saving_bps': np.median(savings),
        'ci_lower': ci_lower,
        'ci_upper': ci_upper,
        't_statistic': t_stat,
        'p_value': p_value,
        'n_trades': len(savings),
        
        'regime_breakdown': {
            'bearish': {
                'mean_cost_bps': np.mean(regime_breakdown[0]) if regime_breakdown[0] else np.nan,
                'n_days': len(regime_breakdown[0])
            },
            'transition': {
                'mean_cost_bps': np.mean(regime_breakdown[1]) if regime_breakdown[1] else np.nan,
                'n_days': len(regime_breakdown[1])
            },
            'bullish': {
                'mean_cost_bps': np.mean(regime_breakdown[2]) if regime_breakdown[2] else np.nan,
                'n_days': len(regime_breakdown[2])
            }
        },
        
        'cost_components': {
            'spread': cost_model.params.spread_bps,
            'eta': cost_model.params.eta,
            'gamma': cost_model.params.gamma,
            'daily_volume': cost_model.params.daily_volume,
            'volatility': cost_model.params.volatility
        }
    }