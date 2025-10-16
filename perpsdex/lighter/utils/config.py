"""
ConfigLoader - Load và parse config từ JSON
"""

import json
import os


class ConfigLoader:
    """
    Load và parse config từ JSON file
    
    Config chỉ là 1 input option - không bắt buộc
    """
    
    # Mapping pair -> market_id (Lighter specific)
    # ⚠️ Lighter KHÔNG CÓ ETH-USDT! Chỉ có 66 pairs khác
    # Data từ scan ngày 2025-01-16
    PAIR_TO_MARKET_ID = {
        # Major tokens
        'BTC-USDT': 1,      # BTC @ $110,965
        'SOL-USDT': 2,      # SOL @ $192
        'BNB-USDT': 25,     # BNB @ $1,179
        
        # DeFi tokens
        'AAVE-USDT': 27,    # AAVE @ $239
        'UNI-USDT': 30,     # UNI @ $6.59
        'LINK-USDT': 8,     # LINK @ $18
        'LTC-USDT': 35,     # LTC @ $94
        'BCH-USDT': 58,     # BCH @ $521
        
        # Layer 1/2
        'AVAX-USDT': 9,     # AVAX @ $21
        'ARB-USDT': 50,     # ARB @ $0.33
        'OP-USDT': 55,      # OP @ $0.46
        'DOT-USDT': 11,     # DOT @ $3.12
        'APT-USDT': 31,     # APT @ $3.48
        'SUI-USDT': 16,     # SUI @ $2.67
        'NEAR-USDT': 10,    # NEAR @ $2.33
        'SEI-USDT': 32,     # SEI @ $0.21
        
        # Meme coins
        'DOGE-USDT': 3,     # DOGE @ $0.20
        'WIF-USDT': 5,      # WIF @ $0.55
        '1000PEPE-USDT': 4, # PEPE @ $0.01
        '1000SHIB-USDT': 17, # SHIB @ $0.01
        'POPCAT-USDT': 23,  # POPCAT @ $0.16
        'FARTCOIN-USDT': 21, # FARTCOIN @ $0.39
        
        # Alt tokens
        'XRP-USDT': 7,      # XRP @ $2.41
        'ADA-USDT': 39,     # ADA @ $0.67
        'TON-USDT': 12,     # TON @ $2.22
        'TRX-USDT': 43,     # TRX @ $0.32
        'HYPE-USDT': 24,    # HYPE @ $37
        'TAO-USDT': 13,     # TAO @ $397
        
        # Other tokens
        'PAXG-USDT': 48,    # PAX Gold @ $4,255
        'TRUMP-USDT': 15,   # TRUMP @ $6.06
        'GMX-USDT': 61,     # GMX @ $10.83
        'PENDLE-USDT': 37,  # PENDLE @ $3.30
        'JUP-USDT': 26,     # JUP @ $0.36
        'BERA-USDT': 20,    # BERA @ $1.84
        'VIRTUAL-USDT': 41, # VIRTUAL @ $0.79
        
        # Full list (66 tokens total, NO ETH!)
        # Check lighter_markets.json for complete list
    }
    
    @staticmethod
    def load_from_file(file_path: str) -> dict:
        """
        Load config từ JSON file
        
        Input:
            - file_path: Đường dẫn đến file config
        
        Output:
            dict: Config data hoặc {} nếu lỗi
        
        Example:
            >>> config = ConfigLoader.load_from_file('config.json')
        """
        try:
            if not os.path.exists(file_path):
                print(f"⚠️  Config file not found: {file_path}")
                return {}
            
            with open(file_path, 'r') as f:
                config = json.load(f)
            
            print(f"✅ Loaded config from {file_path}")
            return config
            
        except Exception as e:
            print(f"❌ Error loading config: {e}")
            return {}
    
    @staticmethod
    def parse_trading_params(config: dict) -> dict:
        """
        Parse trading parameters từ config
        
        Input:
            - config: Config dict
        
        Output:
            dict: {
                'pair': str,
                'symbol': str,
                'market_id': int,
                'size_usd': float,
                'leverage': float,
                'order_type': str,
                'limit_price': float/None,
            }
        
        Example:
            >>> params = ConfigLoader.parse_trading_params(config)
        """
        pair = config.get('pair', 'BTC-USDT')
        symbol = pair.split('-')[0]
        market_id = ConfigLoader.PAIR_TO_MARKET_ID.get(pair, 1)
        
        return {
            'pair': pair,
            'symbol': symbol,
            'market_id': market_id,
            'size_usd': float(config.get('size_usd', 100)),
            'leverage': float(config.get('leverage', 1)),
            'order_type': config.get('type', 'market'),
            'limit_price': config.get('set_price_limit'),
        }
    
    @staticmethod
    def parse_risk_params(config: dict) -> dict:
        """
        Parse risk management parameters từ config
        
        Input:
            - config: Config dict
        
        Output:
            dict: {
                'rr_ratio': list/None,  # [risk, reward]
                'tp_percent': float/None,
                'sl_percent': float/None,
                'use_rr_ratio': bool,
            }
        
        Example:
            >>> risk = ConfigLoader.parse_risk_params(config)
        """
        rr_ratio = config.get('rr_ratio')
        
        # Legacy support
        tp_percent = config.get('percent_take_profit')
        sl_percent = config.get('percent_stop_loss')
        
        # Determine if using R:R ratio
        use_rr_ratio = rr_ratio is not None and (tp_percent is None or sl_percent is None)
        
        return {
            'rr_ratio': rr_ratio,
            'tp_percent': tp_percent,
            'sl_percent': sl_percent,
            'use_rr_ratio': use_rr_ratio,
        }
    
    @staticmethod
    def parse_exchange_sides(config: dict) -> dict:
        """
        Parse exchange sides từ config (lighter: long, paradex: short, ...)
        
        Input:
            - config: Config dict
        
        Output:
            dict: {
                'lighter': 'long'/'short'/None,
                'paradex': 'long'/'short'/None,
            }
        
        Example:
            >>> sides = ConfigLoader.parse_exchange_sides(config)
        """
        perpdex = config.get('perpdex', {})
        
        return {
            'lighter': perpdex.get('lighter'),
            'paradex': perpdex.get('paradex'),
        }
    
    @staticmethod
    def get_market_id_for_pair(pair: str) -> int:
        """
        Lấy market_id từ pair
        
        Input:
            - pair: Pair string (VD: 'BTC-USDT')
        
        Output:
            int: Market ID (default: 1 nếu không tìm thấy)
        
        Example:
            >>> market_id = ConfigLoader.get_market_id_for_pair('ETH-USDT')
            2
        """
        return ConfigLoader.PAIR_TO_MARKET_ID.get(pair, 1)
    
    @staticmethod
    def add_pair_mapping(pair: str, market_id: int):
        """
        Thêm pair mapping mới
        
        Input:
            - pair: Pair string
            - market_id: Market ID
        
        Example:
            >>> ConfigLoader.add_pair_mapping('SOL-USDT', 3)
        """
        ConfigLoader.PAIR_TO_MARKET_ID[pair] = market_id
        print(f"✅ Added mapping: {pair} -> market_id {market_id}")

