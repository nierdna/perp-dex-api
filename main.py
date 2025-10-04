#!/usr/bin/env python3
"""
Main entry point cho PerpsDEX Trading Bot
Đọc config.json và điều hướng đến các DEX tương ứng
"""

import asyncio
import json
import os
import sys
from pathlib import Path

def load_config():
    """Load config từ perpsdex/config.json"""
    config_path = Path(__file__).parent / "perpsdex" / "config.json"
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        return config
    except FileNotFoundError:
        print(f"❌ Không tìm thấy config file: {config_path}")
        return None
    except json.JSONDecodeError as e:
        print(f"❌ Lỗi parse JSON: {e}")
        return None

async def run_lighter_bot(config):
    """Chạy Lighter bot"""
    try:
        # Import và chạy Lighter trading bot
        sys.path.append(str(Path(__file__).parent / "perpsdex" / "lighter"))
        from trading_sdk import LighterTradingBotSDK
        
        print("🚀 Khởi động Lighter Trading Bot...")
        bot = LighterTradingBotSDK(config)
        
        # Config đã được load trong __init__
        
        # Connect
        if not await bot.connect():
            print("❌ Không thể kết nối đến Lighter")
            return False
        
        # Lấy giá BTC
        price_data = await bot.get_btc_price()
        if not price_data:
            print("❌ Không thể lấy giá BTC")
            return False
        
        # Lấy balance
        balance = await bot.get_account_balance()
        if not balance:
            print("⚠️  Không lấy được balance")
        
        # Check positions
        await bot.check_positions()
        
        # Xác định hướng từ config
        direction = config.get('perpdex', {}).get('lighter', 'long')
        print(f"\n📊 Direction từ config: {direction.upper()}")
        
        # Đặt lệnh (đã xác nhận ở main)
        if direction == 'long':
            result = await bot.place_long_order(price_data)
        else:
            result = await bot.place_short_order(price_data)
        
        if result['success']:
            print(f"\n🎉 THÀNH CÔNG!")
            print(f"📝 Order ID: {result['order_id']}")
            print(f"💰 Entry Price: ${result['entry_price']:,.2f}")
            print(f"📊 Position Size: {result['position_size']} BTC")
            print(f"📈 Direction: {result['side'].upper()}")
            
            # Hiển thị kết quả TP/SL
            if 'tp_sl' in result:
                tp_sl = result['tp_sl']
                if tp_sl.get('tp_sl_placed'):
                    print(f"\n🛡️ TP/SL Orders:")
                    if tp_sl.get('tp_success'):
                        print(f"   ✅ Take Profit: Placed")
                    if tp_sl.get('sl_success'):
                        print(f"   ✅ Stop Loss: Placed")
                else:
                    print(f"⚠️  TP/SL không được đặt")
        else:
            print(f"\n❌ THẤT BẠI! Lỗi: {result.get('error')}")
        
        await bot.close()
        return True
        
    except ImportError as e:
        print(f"❌ Không thể import Lighter bot: {e}")
        return False
    except Exception as e:
        print(f"❌ Lỗi khi chạy Lighter bot: {e}")
        import traceback
        traceback.print_exc()
        return False

async def run_paradex_bot(config):
    """Chạy Paradex bot (TODO: chưa implement)"""
    print("🚧 Paradex bot chưa được implement")
    return False

async def run_aster_bot(config):
    """Chạy Aster bot (TODO: chưa implement)"""
    print("🚧 Aster bot chưa được implement")
    return False

async def main():
    """Main function"""
    print("🤖 PERPSDEX TRADING BOT")
    print("=" * 50)
    
    # Load config
    config = load_config()
    if not config:
        return
    
    print(f"📋 Config loaded:")
    print(f"   💰 Size USD: ${config.get('size_usd', 'N/A')}")
    print(f"   📊 Leverage: {config.get('leverage', 'N/A')}x")
    print(f"   📈 Order Type: {config.get('type', 'N/A')}")
    print(f"   🎯 Pair: {config.get('pair', 'N/A')}")
    
    # Hiển thị các DEX có sẵn
    perpdex_config = config.get('perpdex', {})
    available_dex = list(perpdex_config.keys())
    
    print(f"\n🔍 Available DEX platforms: {', '.join(available_dex)}")
    
    # Hiển thị chiến lược
    print(f"\n📊 Trading Strategy:")
    for dex, direction in perpdex_config.items():
        print(f"   {dex.upper()}: {direction.upper()}")
    
    # Hỏi xác nhận 1 lần duy nhất
    print(f"\n❓ Bạn có muốn chạy trading strategy này không?")
    print("⚠️  Cảnh báo: Trading có rủi ro!")
    confirm = input("Nhập 'yes' để xác nhận: ").lower().strip()
    
    if confirm != 'yes':
        print("❌ Đã hủy trading strategy")
        return
    
    print(f"\n🚀 Đang khởi động TẤT CẢ bots đồng thời...")
    
    # Chạy tất cả bots song song
    tasks = []
    for dex_name in available_dex:
        if dex_name == 'lighter':
            tasks.append(run_lighter_bot(config))
        elif dex_name == 'paradex':
            tasks.append(run_paradex_bot(config))
        elif dex_name == 'aster':
            tasks.append(run_aster_bot(config))
        else:
            print(f"⚠️  DEX '{dex_name}' chưa được hỗ trợ, bỏ qua")
    
    if tasks:
        # Chạy tất cả tasks đồng thời
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Hiển thị kết quả
        print(f"\n📋 Kết quả:")
        for i, (dex_name, result) in enumerate(zip(available_dex, results)):
            if isinstance(result, Exception):
                print(f"   ❌ {dex_name}: Lỗi - {result}")
            elif result:
                print(f"   ✅ {dex_name}: Thành công")
            else:
                print(f"   ⚠️  {dex_name}: Không hoàn thành")
    else:
        print("❌ Không có DEX nào để chạy")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Dừng bởi người dùng")
    except Exception as e:
        print(f"\n❌ Lỗi: {e}")
        import traceback
        traceback.print_exc()
