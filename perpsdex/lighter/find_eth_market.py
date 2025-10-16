#!/usr/bin/env python3
"""
Tìm market có symbol = "ETH"
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from core.client import LighterClient

load_dotenv()


async def find_eth_market():
    """Scan markets để tìm symbol ETH"""
    
    print("🔍 TÌM ETH MARKET...")
    print("=" * 60)
    
    client = LighterClient(
        private_key=os.getenv('LIGHTER_PRIVATE_KEY'),
        account_index=int(os.getenv('ACCOUNT_INDEX', 0))
    )
    
    await client.connect()
    order_api = client.get_order_api()
    
    found_markets = {}
    
    print("\n📊 Scanning markets 1-100 for symbols...")
    
    for market_id in range(1, 101):
        try:
            details = await order_api.order_book_details(market_id=market_id)
            
            if details and details.order_book_details:
                ob = details.order_book_details[0]
                symbol = getattr(ob, 'symbol', 'Unknown')
                
                if symbol not in found_markets:
                    found_markets[symbol] = []
                found_markets[symbol].append(market_id)
                
                # Print ETH, BTC, hoặc major tokens
                if symbol in ['ETH', 'BTC', 'SOL', 'AVAX', 'ARB', 'OP', 'MATIC']:
                    order_book = await order_api.order_book_orders(market_id=market_id, limit=1)
                    if order_book and order_book.bids and order_book.asks:
                        price = float(order_book.asks[0].price)
                        print(f"✅ Market {market_id}: {symbol} @ ${price:,.2f}")
                else:
                    # Chỉ print ngắn gọn
                    if market_id % 10 == 0:
                        print(f"   ... scanning {market_id}/100")
                
        except Exception as e:
            pass
        
        await asyncio.sleep(0.2)
    
    await client.close()
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 FOUND SYMBOLS:")
    print("=" * 60)
    
    for symbol in sorted(found_markets.keys()):
        markets = found_markets[symbol]
        if symbol in ['ETH', 'BTC', 'SOL', 'AVAX', 'ARB', 'OP', 'MATIC', 'LINK']:
            print(f"\n{symbol}:")
            for mid in markets:
                print(f"   Market {mid}")
    
    # Highlight ETH
    if 'ETH' in found_markets:
        print("\n" + "=" * 60)
        print(f"✅ ETH MARKET FOUND: {found_markets['ETH']}")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("❌ KHÔNG TÌM THẤY ETH MARKET!")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(find_eth_market())

