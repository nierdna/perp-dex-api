#!/usr/bin/env python3
"""
Check market details để xác định chính xác market là gì
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from core.client import LighterClient

load_dotenv()


async def check_market_details(market_ids):
    """Get chi tiết market metadata"""
    
    client = LighterClient(
        private_key=os.getenv('LIGHTER_PRIVATE_KEY'),
        account_index=int(os.getenv('ACCOUNT_INDEX', 0))
    )
    
    await client.connect()
    order_api = client.get_order_api()
    
    for market_id in market_ids:
        try:
            print(f"\n{'='*60}")
            print(f"📊 MARKET {market_id} DETAILS")
            print('='*60)
            
            # Get orderbook details
            details = await order_api.order_book_details(market_id=market_id)
            
            if details and details.order_book_details:
                ob = details.order_book_details[0]
                
                print(f"\n🔍 Metadata:")
                print(f"   Market ID: {market_id}")
                
                # Try to get all available fields
                for attr in dir(ob):
                    if not attr.startswith('_'):
                        try:
                            value = getattr(ob, attr)
                            if not callable(value):
                                print(f"   {attr}: {value}")
                        except:
                            pass
                
                print(f"\n📈 Size/Price Info:")
                print(f"   Size Decimals: {ob.size_decimals}")
                print(f"   Price Decimals: {ob.price_decimals}")
                print(f"   Min Base Amount: {ob.min_base_amount}")
                
            # Get current price
            order_book = await order_api.order_book_orders(market_id=market_id, limit=1)
            if order_book and order_book.bids and order_book.asks:
                bid = float(order_book.bids[0].price)
                ask = float(order_book.asks[0].price)
                print(f"\n💰 Current Price:")
                print(f"   Bid: ${bid:,.2f}")
                print(f"   Ask: ${ask:,.2f}")
                
        except Exception as e:
            print(f"❌ Error for market {market_id}: {e}")
    
    await client.close()


async def main():
    # Check market 48 (suspected ETH) và market 1 (BTC)
    await check_market_details([1, 48])
    
    print("\n" + "="*60)
    print("✅ Check completed!")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())

