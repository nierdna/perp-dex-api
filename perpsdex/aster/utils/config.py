"""
ConfigLoader - Load configuration for Aster trading

TODO: Update with actual Aster market mappings
"""

import json
import os
from typing import Dict, Optional


class ConfigLoader:
    """
    Load trading configuration
    
    Methods:
        - load_config(path): Load from JSON
        - get_market_id(symbol): Map symbol to market ID
    """
    
    @staticmethod
    def load_config(config_path: str) -> Dict:
        """
        Load config từ JSON file
        
        Input:
            config_path: Path to config.json
            
        Output:
            Dictionary with config
        """
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Config file not found: {config_path}")
        
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        return config
    
    @staticmethod
    def get_market_id(symbol: str) -> str:
        """
        Map trading pair to Aster market ID
        
        TODO: Research actual Aster market IDs
        For now, return symbol as-is
        
        Input:
            symbol: Trading pair (e.g., 'BTC-USDT')
            
        Output:
            Market ID string
        """
        # TODO: Create proper mapping after researching Aster API
        # For now, just return the symbol
        return symbol.upper()
    
    @staticmethod
    def get_all_markets() -> Dict[str, str]:
        """
        Get all supported markets
        
        TODO: Load from aster_markets.json after research
        
        Output:
            Dict mapping symbols to market IDs
        """
        # TODO: Implement after API research
        return {
            'BTC-USDT': 'BTC-USDT',
            'ETH-USDT': 'ETH-USDT',
            'SOL-USDT': 'SOL-USDT',
            'BNB-USDT': 'BNB-USDT',
            # ... more pairs
        }


# Placeholder market data file
def create_placeholder_markets_json():
    """Create placeholder aster_markets.json"""
    markets = {
        "last_updated": "2025-01-17",
        "total_markets": 0,
        "markets": []
    }
    
    markets_file = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        'aster_markets.json'
    )
    
    with open(markets_file, 'w') as f:
        json.dump(markets, f, indent=2)
    
    print(f"✅ Created placeholder: {markets_file}")


if __name__ == "__main__":
    create_placeholder_markets_json()

