#!/usr/bin/env python3
"""Test Aster order placement"""
import asyncio
import sys
sys.path.insert(0, '/Users/levanmong/Desktop/LYNX_AI SOLUSTION/point-dex/perpsdex/aster')

from core.client import AsterClient
from core.order import OrderExecutor
from core.market import MarketData
import os
from dotenv import load_dotenv

load_dotenv()

async def test_order():
    """Test placing a BTC LONG order"""
    
    api_key = os.getenv('ASTER_API_KEY')
    secret_key = os.getenv('ASTER_SECRET_KEY')
    
    print(f"🔑 API Key: {api_key[:20]}...")
    print(f"🔑 Secret: {secret_key[:20]}...")
    
    # ✅ Correct order: api_url, api_key, secret_key
    client = AsterClient('https://fapi.asterdex.com', api_key, secret_key)
    
    # Test connection
    print("\n✅ Testing connection...")
    conn = await client.test_connection()
    print(f"Connection: {conn}")
    
    # Get price
    print("\n📊 Getting BTC price...")
    market = MarketData(client)
    price = await market.get_price('BTC-USDT')
    print(f"Price: {price}")
    
    # Place order
    print("\n⚡ Placing MARKET order...")
    executor = OrderExecutor(client)
    
    result = await executor.place_market_order(
        symbol='BTC-USDT',
        side='BUY',
        size=110,  # $110 USD
        leverage=5
    )
    
    print(f"\n📋 Result: {result}")
    
    await client.close()

if __name__ == '__main__':
    asyncio.run(test_order())

