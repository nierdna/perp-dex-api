#!/usr/bin/env python3
"""
Scan tất cả markets để tìm đúng market_id cho ETH
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from core.client import LighterClient
from core.market import MarketData

load_dotenv()


async def scan_markets():
    """Scan markets từ 1-10 để tìm ETH"""
    print("🔍 SCANNING LIGHTER MARKETS...")
    print("=" * 60)
    
    # Connect
    client = LighterClient(
        private_key=os.getenv('LIGHTER_PRIVATE_KEY'),
        account_index=int(os.getenv('ACCOUNT_INDEX', 0))
    )
    
    await client.connect()
    market = MarketData(client.get_order_api(), client.get_account_api())
    
    print("\n📊 Testing market IDs 1-50:")
    print("-" * 60)
    
    found_markets = []
    
    for market_id in range(1, 51):
        try:
            price = await market.get_price(market_id, symbol=f"Market{market_id}")
            if price['success']:
                mid_price = price['mid']
                
                # Guess pair từ giá
                guess = "Unknown"
                if 60000 < mid_price < 150000:
                    guess = "BTC 🔶"
                elif 3500 < mid_price < 5000:
                    guess = "ETH 💎"
                elif 100 < mid_price < 300:
                    guess = "SOL/BNB ⚡"
                elif 1 < mid_price < 100:
                    guess = "ARB/OP/... 🔵"
                elif mid_price < 1:
                    guess = "Stablecoin/Small 💵"
                
                found_markets.append({
                    'market_id': market_id,
                    'price': mid_price,
                    'guess': guess
                })
                
                print(f"✅ Market {market_id}: ${mid_price:,.2f} → {guess}")
            else:
                print(f"⏭️  Market {market_id}: Not found (skip)")
        except Exception as e:
            # Bỏ qua lỗi, tiếp tục scan
            pass
        
        await asyncio.sleep(0.3)  # Tránh rate limit
    
    await client.close()
    
    print("\n" + "=" * 60)
    print("✅ Scan completed!")
    print("=" * 60)
    
    print(f"\n📋 SUMMARY ({len(found_markets)} markets found):")
    print("-" * 60)
    
    # Group by guess
    btc_markets = [m for m in found_markets if 'BTC' in m['guess']]
    eth_markets = [m for m in found_markets if 'ETH' in m['guess']]
    sol_markets = [m for m in found_markets if 'SOL' in m['guess']]
    other_markets = [m for m in found_markets if m not in btc_markets + eth_markets + sol_markets]
    
    if btc_markets:
        print("\n🔶 BTC (~$60k-$150k):")
        for m in btc_markets:
            print(f"   Market {m['market_id']}: ${m['price']:,.2f}")
    
    if eth_markets:
        print("\n💎 ETH (~$3.5k-$5k):")
        for m in eth_markets:
            print(f"   Market {m['market_id']}: ${m['price']:,.2f}")
    
    if sol_markets:
        print("\n⚡ SOL/BNB (~$100-$300):")
        for m in sol_markets:
            print(f"   Market {m['market_id']}: ${m['price']:,.2f}")
    
    if other_markets:
        print("\n🔵 Other tokens:")
        for m in other_markets:
            print(f"   Market {m['market_id']}: ${m['price']:,.2f} - {m['guess']}")
    
    if not eth_markets:
        print("\n⚠️  KHÔNG TÌM THẤY ETH-USDT (giá ~$4,020)!")
        print("   → Lighter có thể chưa list ETH perp")
        print("   → Hoặc market_id > 50 (scan thêm nếu cần)")


if __name__ == "__main__":
    asyncio.run(scan_markets())

