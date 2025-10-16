#!/usr/bin/env python3
"""
Lấy HẾT tất cả markets từ Lighter và export ra file
"""

import asyncio
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from core.client import LighterClient

load_dotenv()


async def get_all_markets():
    """Scan tất cả markets và lấy thông tin"""
    
    print("🔍 ĐANG LẤY TẤT CẢ MARKETS TỪ LIGHTER...")
    print("=" * 60)
    
    client = LighterClient(
        private_key=os.getenv('LIGHTER_PRIVATE_KEY'),
        account_index=int(os.getenv('ACCOUNT_INDEX', 0))
    )
    
    await client.connect()
    order_api = client.get_order_api()
    
    all_markets = []
    
    print("\n📊 Scanning markets 1-200...")
    
    for market_id in range(1, 201):
        try:
            # Get market details
            details = await order_api.order_book_details(market_id=market_id)
            
            if details and details.order_book_details:
                ob = details.order_book_details[0]
                symbol = getattr(ob, 'symbol', 'Unknown')
                status = getattr(ob, 'status', 'unknown')
                
                # Get current price
                try:
                    order_book = await order_api.order_book_orders(market_id=market_id, limit=1)
                    if order_book and order_book.bids and order_book.asks:
                        bid = float(order_book.bids[0].price)
                        ask = float(order_book.asks[0].price)
                        mid = (bid + ask) / 2
                    else:
                        bid = ask = mid = 0
                except:
                    bid = ask = mid = 0
                
                market_info = {
                    'market_id': market_id,
                    'symbol': symbol,
                    'status': status,
                    'bid': bid,
                    'ask': ask,
                    'mid': mid,
                    'size_decimals': ob.size_decimals,
                    'price_decimals': ob.price_decimals,
                    'min_base_amount': float(ob.min_base_amount),
                }
                
                all_markets.append(market_info)
                
                # Print progress
                if status == 'active' and mid > 0:
                    print(f"✅ Market {market_id:3d}: {symbol:8s} @ ${mid:,.2f} ({status})")
                elif market_id % 20 == 0:
                    print(f"   ... scanned {market_id}/200")
                
        except Exception as e:
            # Market không tồn tại hoặc lỗi
            if market_id % 20 == 0:
                print(f"   ... scanned {market_id}/200")
            pass
        
        await asyncio.sleep(0.15)  # Tránh rate limit
    
    await client.close()
    
    # Filter active markets only
    active_markets = [m for m in all_markets if m['status'] == 'active' and m['mid'] > 0]
    
    # Sort by symbol
    active_markets.sort(key=lambda x: x['symbol'])
    
    # Save to JSON
    output_file = os.path.join(os.path.dirname(__file__), 'lighter_markets.json')
    with open(output_file, 'w') as f:
        json.dump(active_markets, f, indent=2)
    
    print(f"\n" + "=" * 60)
    print(f"✅ Scan completed! Found {len(active_markets)} active markets")
    print(f"💾 Saved to: {output_file}")
    print("=" * 60)
    
    # Summary by category
    print("\n📋 MARKETS SUMMARY:")
    print("-" * 60)
    
    major_tokens = {}
    for m in active_markets:
        symbol = m['symbol']
        if symbol not in major_tokens:
            major_tokens[symbol] = []
        major_tokens[symbol].append(m)
    
    # Print organized
    print(f"\n🔶 MAJOR TOKENS ({len(major_tokens)} unique symbols):")
    for symbol in sorted(major_tokens.keys()):
        markets = major_tokens[symbol]
        if len(markets) == 1:
            m = markets[0]
            print(f"   {symbol:8s} → Market {m['market_id']:3d} @ ${m['mid']:,.2f}")
        else:
            print(f"   {symbol:8s} → Markets {[m['market_id'] for m in markets]}")
    
    # Generate config mapping
    print(f"\n" + "=" * 60)
    print("📝 PAIR_TO_MARKET_ID MAPPING (for config.py):")
    print("=" * 60)
    print("\nPAIR_TO_MARKET_ID = {")
    for symbol in sorted(major_tokens.keys()):
        markets = major_tokens[symbol]
        if len(markets) == 1:
            m = markets[0]
            print(f"    '{symbol}-USDT': {m['market_id']},  # {symbol} @ ${m['mid']:,.2f}")
    print("}")
    
    # Check if ETH exists
    if 'ETH' in major_tokens:
        eth_markets = major_tokens['ETH']
        print(f"\n✅ ETH FOUND!")
        for m in eth_markets:
            print(f"   Market {m['market_id']}: ${m['mid']:,.2f}")
    else:
        print(f"\n❌ ETH NOT FOUND on Lighter DEX")
        print(f"   → Lighter chỉ support: {', '.join(sorted(major_tokens.keys())[:10])}")
    
    return active_markets


if __name__ == "__main__":
    asyncio.run(get_all_markets())

