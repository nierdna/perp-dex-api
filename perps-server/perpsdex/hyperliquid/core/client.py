"""
Hyperliquid Client - Wrapper cho Hyperliquid Python SDK
"""

from typing import Optional, Dict, Any
from hyperliquid.info import Info
from hyperliquid.exchange import Exchange
from eth_account import Account


class HyperliquidClient:
    """
    Client để kết nối và tương tác với Hyperliquid DEX
    
    Sử dụng hyperliquid-python-sdk official
    """
    
    def __init__(self, private_key: str, testnet: bool = False, account_address: Optional[str] = None):
        """
        Khởi tạo Hyperliquid client
        
        Args:
            private_key: Private key (0x...)
            testnet: Sử dụng testnet hay mainnet (default: mainnet)
            account_address: Địa chỉ ví chính (Master/Vault) để query/trade. 
                           Nếu không có, sẽ dùng chính address của private_key.
        """
        self.private_key = private_key
        self.testnet = testnet
        
        # Tạo account từ private key (đây là Agent)
        self.account = Account.from_key(private_key)
        self.agent_address = self.account.address
        
        # Nếu có account_address (Master), dùng nó. Nếu không, Agent tự trade cho mình.
        self.address = account_address if account_address else self.agent_address
        
        # Xác định base URL
        if testnet:
            self.base_url = "https://api.hyperliquid-testnet.xyz"
        else:
            self.base_url = "https://api.hyperliquid.xyz"
        
        # Initialize Info API (read-only, không cần private key)
        self.info = Info(self.base_url, skip_ws=True)
        
        # Initialize Exchange API (trading, cần private key)
        # wallet: Account dùng để ký (Agent)
        # account_address: Account chịu trách nhiệm về tiền và vị thế (Master)
        self.exchange = Exchange(
            wallet=self.account,
            base_url=self.base_url,
            account_address=self.address
        )
        
        self._connected = False
    
    async def connect(self) -> Dict[str, Any]:
        """
        Test connection với Hyperliquid
        
        Returns:
            {"success": bool, "message": str, "address": str}
        """
        try:
            # Test bằng cách lấy user state
            user_state = self.info.user_state(self.address)
            
            if user_state is not None:
                self._connected = True
                
                # Lấy balance để verify
                balance_info = user_state.get("marginSummary", {})
                account_value = float(balance_info.get("accountValue", 0))
                
                return {
                    "success": True,
                    "message": f"Kết nối Hyperliquid thành công",
                    "address": self.address,
                    "agent_address": self.agent_address,
                    "account_value": account_value,
                    "testnet": self.testnet
                }
            else:
                return {
                    "success": False,
                    "message": "Không thể lấy user state từ Hyperliquid",
                    "address": self.address
                }
                
        except Exception as e:
            return {
                "success": False,
                "message": f"Lỗi kết nối Hyperliquid: {str(e)}",
                "error": str(e)
            }
    
    def get_info_api(self) -> Info:
        """Trả về Info API instance (market data)"""
        return self.info
    
    def get_exchange_api(self) -> Exchange:
        """Trả về Exchange API instance (trading)"""
        return self.exchange
    
    def get_address(self) -> str:
        """Trả về wallet address"""
        return self.address
    
    def is_connected(self) -> bool:
        """Kiểm tra connection status"""
        return self._connected
