#!/usr/bin/env python3
"""
Example Usage - Cách sử dụng các modules đã refactor

Ví dụ này cho thấy cách dùng các modules độc lập với Input/Output rõ ràng
"""

import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

# Import modules với absolute import
from perpsdex.lighter.core.client import LighterClient
from perpsdex.lighter.core.market import MarketData
from perpsdex.lighter.core.order import OrderExecutor
from perpsdex.lighter.core.risk import RiskManager
from perpsdex.lighter.utils.calculator import Calculator
from perpsdex.lighter.utils.config import ConfigLoader

load_dotenv()


async def example_1_basic_order():
    """
    Example 1: Đặt lệnh đơn giản với parameters truyền vào
    
    KHÔNG CẦN CONFIG - Tất cả là input parameters
    """
    print("=" * 60)
    print("EXAMPLE 1: Basic Order (No Config)")
    print("=" * 60)
    
    # Step 1: Connect
    client = LighterClient(
        private_key=os.getenv('LIGHTER_PRIVATE_KEY'),
        api_key_index=0,
        account_index=int(os.getenv('ACCOUNT_INDEX', 0))
    )
    
    connect_result = await client.connect()
    if not connect_result['success']:
        print("❌ Connection failed")
        return
    
    # Step 2: Get price
    market_data = MarketData(client.get_order_api(), client.get_account_api())
    price_result = await market_data.get_price(market_id=1, symbol='BTC')
    
    if not price_result['success']:
        print("❌ Failed to get price")
        await client.close()
        return
    
    # Step 3: Place order với parameters rõ ràng
    order_executor = OrderExecutor(client.get_signer_client(), client.get_order_api())
    
    order_result = await order_executor.place_order(
        side='long',                  # Input: LONG hoặc SHORT
        entry_price=price_result['ask'],  # Input: Giá entry
        position_size_usd=10,         # Input: Size USD
        market_id=1,                  # Input: Market ID
        symbol='BTC',                 # Input: Symbol
        leverage=1                    # Input: Leverage
    )
    
    # Output
    if order_result['success']:
        print(f"\n✅ Order placed successfully!")
        print(f"   TX: {order_result['tx_hash']}")
        print(f"   Entry: ${order_result['entry_price']:,.2f}")
        print(f"   Size: {order_result['position_size']} BTC")
    else:
        print(f"❌ Order failed: {order_result['error']}")
    
    await client.close()


async def example_2_with_tp_sl():
    """
    Example 2: Đặt lệnh với TP/SL (dùng R:R ratio)
    
    Input parameters rõ ràng, không hardcode
    """
    print("\n" + "=" * 60)
    print("EXAMPLE 2: Order with TP/SL (R:R Ratio)")
    print("=" * 60)
    
    # Step 1: Connect
    client = LighterClient(
        private_key=os.getenv('LIGHTER_PRIVATE_KEY'),
        account_index=int(os.getenv('ACCOUNT_INDEX', 0))
    )
    
    await client.connect()
    
    # Step 2: Get price
    market_data = MarketData(client.get_order_api(), client.get_account_api())
    price_result = await market_data.get_price(market_id=1, symbol='BTC')
    entry_price = price_result['ask']
    
    # Step 3: Calculate TP/SL từ R:R ratio
    sl_percent = 3  # SL 3% từ entry
    sl_price = Calculator.calculate_sl_from_percent(entry_price, 'long', sl_percent)
    
    rr_ratio = [1, 2]  # Mất 1, Ăn 2
    tp_sl_calc = Calculator.calculate_tp_sl_from_rr_ratio(
        entry_price=entry_price,
        side='long',
        sl_price=sl_price,
        rr_ratio=rr_ratio
    )
    
    tp_price = tp_sl_calc['tp_price']
    
    print(f"\n📊 Calculated TP/SL:")
    print(f"   Entry: ${entry_price:,.2f}")
    print(f"   SL: ${sl_price:,.2f} (Risk: ${tp_sl_calc['risk_amount']:.2f})")
    print(f"   TP: ${tp_price:,.2f} (Reward: ${tp_sl_calc['reward_amount']:.2f})")
    print(f"   R:R: 1:{rr_ratio[1]/rr_ratio[0]}")
    
    # Step 4: Place entry order
    order_executor = OrderExecutor(client.get_signer_client(), client.get_order_api())
    order_result = await order_executor.place_order(
        side='long',
        entry_price=entry_price,
        position_size_usd=10,
        market_id=1,
        symbol='BTC'
    )
    
    if not order_result['success']:
        print(f"❌ Entry order failed: {order_result['error']}")
        await client.close()
        return
    
    # Step 5: Place TP/SL orders
    risk_manager = RiskManager(client.get_signer_client(), client.get_order_api())
    tp_sl_result = await risk_manager.place_tp_sl_orders(
        entry_price=entry_price,
        position_size=order_result['position_size'],
        side='long',
        tp_price=tp_price,
        sl_price=sl_price,
        market_id=1,
        symbol='BTC'
    )
    
    print(f"\n✅ Bracket order completed!")
    print(f"   Entry TX: {order_result['tx_hash']}")
    print(f"   TP Success: {tp_sl_result['tp_success']}")
    print(f"   SL Success: {tp_sl_result['sl_success']}")
    
    await client.close()


async def example_3_with_config():
    """
    Example 3: Sử dụng config.json (config CHỈ LÀ 1 INPUT)
    
    Config là optional, không bắt buộc
    """
    print("\n" + "=" * 60)
    print("EXAMPLE 3: Using Config File (Config as Input)")
    print("=" * 60)
    
    # Step 1: Load config (optional input)
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config.json')
    config = ConfigLoader.load_from_file(config_path)
    
    # Parse config
    trading_params = ConfigLoader.parse_trading_params(config)
    risk_params = ConfigLoader.parse_risk_params(config)
    
    print(f"\n📋 Config loaded:")
    print(f"   Pair: {trading_params['pair']}")
    print(f"   Size: ${trading_params['size_usd']}")
    print(f"   Leverage: {trading_params['leverage']}x")
    print(f"   R:R Ratio: {risk_params['rr_ratio']}")
    
    # Step 2: Connect
    client = LighterClient(
        private_key=os.getenv('LIGHTER_PRIVATE_KEY'),
        account_index=int(os.getenv('ACCOUNT_INDEX', 0))
    )
    await client.connect()
    
    # Step 3: Get price
    market_data = MarketData(client.get_order_api(), client.get_account_api())
    price_result = await market_data.get_price(
        market_id=trading_params['market_id'],
        symbol=trading_params['symbol']
    )
    
    if not price_result['success']:
        await client.close()
        return
    
    entry_price = price_result['ask']
    
    # Step 4: Place order với config params
    order_executor = OrderExecutor(client.get_signer_client(), client.get_order_api())
    order_result = await order_executor.place_order(
        side='long',  # Có thể lấy từ config.perpdex.lighter
        entry_price=entry_price,
        position_size_usd=trading_params['size_usd'],
        market_id=trading_params['market_id'],
        symbol=trading_params['symbol'],
        leverage=trading_params['leverage']
    )
    
    print(f"\n✅ Order from config: {order_result.get('tx_hash', 'Failed')}")
    
    await client.close()


async def example_4_calculator_only():
    """
    Example 4: Sử dụng Calculator độc lập (pure functions)
    
    Không cần connection, chỉ tính toán
    """
    print("\n" + "=" * 60)
    print("EXAMPLE 4: Calculator Only (No Connection)")
    print("=" * 60)
    
    entry_price = 65000
    
    # Calculate position size
    position_size = Calculator.calculate_position_size(
        usd_amount=100,
        price=entry_price
    )
    print(f"\n💰 Position Size: {position_size} BTC (${100} at ${entry_price})")
    
    # Calculate TP/SL from percent
    tp_sl_percent = Calculator.calculate_tp_sl_from_percent(
        entry_price=entry_price,
        side='long',
        tp_percent=50,  # +50% ROI
        sl_percent=20,  # -20% ROI
        leverage=5
    )
    print(f"\n📊 TP/SL (Percent method):")
    print(f"   TP: ${tp_sl_percent['tp_price']:,.2f}")
    print(f"   SL: ${tp_sl_percent['sl_price']:,.2f}")
    
    # Calculate TP from SL + R:R ratio
    sl_price = 63000
    tp_sl_rr = Calculator.calculate_tp_sl_from_rr_ratio(
        entry_price=entry_price,
        side='long',
        sl_price=sl_price,
        rr_ratio=[1, 2]
    )
    print(f"\n📊 TP/SL (R:R method):")
    print(f"   Entry: ${entry_price:,.2f}")
    print(f"   SL: ${sl_price:,.2f}")
    print(f"   TP: ${tp_sl_rr['tp_price']:,.2f}")
    print(f"   Risk: ${tp_sl_rr['risk_amount']:.2f}")
    print(f"   Reward: ${tp_sl_rr['reward_amount']:.2f}")
    print(f"   R:R Ratio: {Calculator.calculate_rr_ratio(entry_price, tp_sl_rr['tp_price'], sl_price):.2f}")
    
    # Validate SL
    risky_sl = 60000  # 7.7% drop
    validation = Calculator.validate_sl_price(risky_sl, entry_price, 'long', max_percent=5)
    print(f"\n🛡️ SL Validation:")
    print(f"   Original SL: ${risky_sl:,.2f} ({validation['original_percent']:.2f}%)")
    print(f"   Valid: {validation['valid']}")
    print(f"   Adjusted SL: ${validation['adjusted_price']:,.2f} ({validation['adjusted_percent']:.2f}%)")


async def main():
    """Chạy tất cả examples"""
    # Example 1: Basic order (no config)
    # await example_1_basic_order()
    
    # Example 2: Order với TP/SL
    # await example_2_with_tp_sl()
    
    # Example 3: Sử dụng config
    # await example_3_with_config()
    
    # Example 4: Calculator only (không cần connect)
    await example_4_calculator_only()
    
    print("\n" + "=" * 60)
    print("✅ All examples completed!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

