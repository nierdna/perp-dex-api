"""
AsterClient - Connection and authentication for Aster DEX

Based on research from docs.asterdex.com:
- Authentication: HMAC SHA256 signing with secretKey
- API Key required for all endpoints
- Private key for order signing (TBD)
"""

import hashlib
import hmac
import time
import aiohttp
from typing import Optional, Dict, Any


class AsterClient:
    """
    Client for Aster DEX API
    
    Authentication Method (from docs):
    - HMAC SHA256 signing
    - API Key + Secret Key
    - Signature = HMAC-SHA256(secret_key, query_string)
    
    Input:
        - api_url: Base API URL (TBD - need to find from docs)
        - api_key: API key from Aster
        - secret_key: Secret key for signing
        - private_key: Private key for order signing (optional)
    """
    
    def __init__(
        self,
        api_url: str,
        api_key: str,
        secret_key: str,
        private_key: Optional[str] = None
    ):
        self.api_url = api_url.rstrip('/')
        self.api_key = api_key
        self.secret_key = secret_key
        self.private_key = private_key
        
        # HTTP session for connection pooling
        self.session: Optional[aiohttp.ClientSession] = None
        
        print(f"🔗 Initialized Aster client: {self.api_url}")
    
    async def _ensure_session(self):
        """Ensure HTTP session is created"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
    
    async def close(self):
        """Close HTTP session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    def _generate_signature(self, params: Dict[str, Any]) -> str:
        """
        Generate HMAC SHA256 signature
        
        Based on Aster docs:
        1. Sort params by key
        2. Create query string: key1=value1&key2=value2
        3. Sign with HMAC SHA256
        
        Input:
            params: Dictionary of request parameters
            
        Output:
            Hex signature string
        """
        # Sort parameters by key
        sorted_params = sorted(params.items())
        
        # Create query string
        query_string = '&'.join([f"{k}={v}" for k, v in sorted_params])
        
        # Generate HMAC SHA256 signature
        signature = hmac.new(
            self.secret_key.encode('utf-8'),
            query_string.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        signed: bool = False
    ) -> Dict:
        """
        Make HTTP request to Aster API
        
        Input:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            params: Request parameters
            signed: Whether to sign the request
            
        Output:
            Response JSON
        """
        await self._ensure_session()
        
        params = params or {}
        url = f"{self.api_url}{endpoint}"
        
        # Add timestamp for signed requests
        if signed:
            params['timestamp'] = int(time.time() * 1000)
            params['signature'] = self._generate_signature(params)
        
        # Add API key to headers
        headers = {
            'X-API-KEY': self.api_key,
            'Content-Type': 'application/json'
        }
        
        try:
            async with self.session.request(
                method,
                url,
                params=params if method == 'GET' else None,
                json=params if method in ['POST', 'PUT', 'DELETE'] else None,
                headers=headers
            ) as response:
                data = await response.json()
                
                if response.status != 200:
                    print(f"❌ API Error: {data}")
                    return {'success': False, 'error': data}
                
                return {'success': True, 'data': data}
                
        except Exception as e:
            print(f"❌ Request failed: {e}")
            return {'success': False, 'error': str(e)}
    
    async def test_connection(self) -> Dict:
        """
        Test connection to Aster API
        
        Output:
            {'success': bool, 'message': str}
        """
        try:
            # ✅ Use correct Aster API endpoint structure
            result = await self._request('GET', '/fapi/v1/ping', signed=False)
            
            if result['success']:
                return {
                    'success': True,
                    'message': 'Connected to Aster DEX successfully'
                }
            else:
                return {
                    'success': False,
                    'message': f"Connection failed: {result.get('error')}"
                }
                
        except Exception as e:
            return {
                'success': False,
                'message': f"Connection error: {str(e)}"
            }
    
    # TODO: Add more methods after researching API docs
    # - get_account_info()
    # - get_balance()
    # - get_positions()
    # - get_ticker()
    # - create_order()
    # - cancel_order()


# Placeholder for testing
if __name__ == "__main__":
    import asyncio
    
    async def test():
        client = AsterClient(
            api_url="https://api.aster.xyz",  # TBD: Find actual URL
            api_key="test_key",
            secret_key="test_secret"
        )
        
        result = await client.test_connection()
        print(result)
        
        await client.close()
    
    asyncio.run(test())

