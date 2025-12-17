"""
LighterClient - Quản lý connection và API keys
"""

import os
from lighter import SignerClient, OrderApi, AccountApi
from lighter.signer_client import create_api_key as generate_api_key


class LighterClient:
    """
    Quản lý connection đến Lighter DEX
    
    Input:
        - private_key: API private key
        - api_key_index: Index của API key (default: 0)
        - account_index: Index của account (default: 0)
        - url: Lighter API URL (default: mainnet)
        - auto_fix_keys: Có tự động fix key mismatch không (default: False)
        - l1_private_key: L1 private key để auto-fix (optional)
    
    Output:
        - signer_client: SignerClient instance
        - order_api: OrderApi instance
        - account_api: AccountApi instance
        - keys_mismatch: Boolean - có lỗi key không
    """
    
    def __init__(
        self,
        private_key: str,
        api_key_index: int = 0,
        account_index: int = 0,
        url: str = "https://mainnet.zklighter.elliot.ai",
        auto_fix_keys: bool = False,
        l1_private_key: str = None
    ):
        self.private_key = private_key
        self.api_key_index = api_key_index
        self.account_index = account_index
        self.url = url
        self.auto_fix_keys = auto_fix_keys
        self.l1_private_key = l1_private_key
        
        # Client instances
        self.signer_client = None
        self.order_api = None
        self.account_api = None
        self.keys_mismatch = False
    
    async def connect(self) -> dict:
        """
        Kết nối đến Lighter DEX
        
        Returns:
            dict: {
                'success': bool,
                'keys_mismatch': bool,
                'error': str (nếu có)
            }
        """
        try:
            print("\n🔗 Đang kết nối đến Lighter DEX...")
            
            # Create SignerClient
            # Prepare keys dict for SDK
            api_private_keys = {}
            if self.private_key:
                api_private_keys[self.api_key_index] = self.private_key

            self.signer_client = SignerClient(
                url=self.url,
                api_private_keys=api_private_keys,
                account_index=self.account_index
            )
            
            # Create API clients
            self.order_api = OrderApi(self.signer_client.api_client)
            self.account_api = AccountApi(self.signer_client.api_client)
            
            # Check key mismatch
            client_check = self.signer_client.check_client()
            if client_check:
                print(f"⚠️  Warning: {client_check}")
                self.keys_mismatch = True
                
                # Auto-fix nếu có L1 key
                if self.auto_fix_keys and self.l1_private_key:
                    fix_result = await self._auto_fix_keys()
                    if fix_result['success']:
                        self.keys_mismatch = False
                        print("✅ Keys fixed successfully")
                    else:
                        print(f"❌ Auto-fix failed: {fix_result.get('error')}")
            
            print("✅ Kết nối thành công đến Lighter DEX")
            
            return {
                'success': True,
                'keys_mismatch': self.keys_mismatch,
            }
            
        except Exception as e:
            print(f"❌ Lỗi khi kết nối: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _auto_fix_keys(self) -> dict:
        """
        Tự động fix key mismatch bằng cách rotate API key
        
        Returns:
            dict: {'success': bool, 'error': str}
        """
        try:
            # Validate L1 key format
            raw = self.l1_private_key[2:] if self.l1_private_key.startswith('0x') else self.l1_private_key
            is_valid_len = len(raw) == 64
            is_hex = all(c in '0123456789abcdefABCDEF' for c in raw)
            
            if not (is_valid_len and is_hex):
                return {
                    'success': False,
                    'error': 'L1 private key invalid format. Expect 32-byte hex (0x... or hex)'
                }
            
            print("🛠️  Attempting to rotate API key to match server...")
            
            # Generate new API key
            new_priv, new_pub, err = generate_api_key("")
            if err:
                return {'success': False, 'error': f'Failed to generate new API key: {err}'}
            
            # Change key on server
            resp, err2 = await self.signer_client.change_api_key(self.l1_private_key, new_pub)
            if err2:
                return {'success': False, 'error': f'Failed to change API key on server: {err2}'}
            
            # Update local client
            self.signer_client.api_key_dict[self.api_key_index] = new_priv
            self.signer_client.create_client(self.api_key_index)
            
            # Recheck
            again = self.signer_client.check_client()
            if again:
                return {'success': False, 'error': f'Still mismatch: {again}'}
            
            return {'success': True}
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    async def close(self):
        """Đóng kết nối"""
        if self.signer_client:
            await self.signer_client.close()
        print("🔌 Đã đóng kết nối")
    
    def get_signer_client(self):
        """Lấy SignerClient instance"""
        return self.signer_client
    
    def get_order_api(self):
        """Lấy OrderApi instance"""
        return self.order_api
    
    def get_account_api(self):
        """Lấy AccountApi instance"""
        return self.account_api
    
    def has_keys_mismatch(self) -> bool:
        """Check có lỗi key mismatch không"""
        return self.keys_mismatch

