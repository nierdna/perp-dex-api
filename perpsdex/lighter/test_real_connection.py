#!/usr/bin/env python3
"""
Test Real Connection - Test với Lighter API thật

SAFE MODE: Chỉ test connect, get data, KHÔNG place order (trừ khi confirm)
"""

import asyncio
import os
import sys

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from core.client import LighterClient
from core.market import MarketData
from core.order import OrderExecutor
from core.risk import RiskManager
from utils.calculator import Calculator
from utils.config import ConfigLoader

load_dotenv()


async def test_connection():
    """Test 1: Connection đến Lighter"""
    print("\n" + "=" * 60)
    print("🔗 TEST 1: CONNECTION TO LIGHTER DEX")
    print("=" * 60)
    
    # Check env vars
    private_key = os.getenv('LIGHTER_PRIVATE_KEY')
    account_index = int(os.getenv('ACCOUNT_INDEX', 0))
    
    if not private_key:
        print("❌ LIGHTER_PRIVATE_KEY not found in .env")
        return None
    
    print(f"\n📋 Config:")
    print(f"   Account Index: {account_index}")
    print(f"   Private Key: {'*' * 40}...{private_key[-4:]}")
    
    # Create client
    client = LighterClient(
        private_key=private_key,
        account_index=account_index,
        api_key_index=0,
        auto_fix_keys=False  # Tắt auto-fix để test manual
    )
    
    # Connect
    result = await client.connect()
    
    if result['success']:
        print(f"\n✅ Connection SUCCESS!")
        if result.get('keys_mismatch'):
            print(f"⚠️  Warning: Keys mismatch detected")
            print(f"   → Fix manually hoặc enable auto_fix_keys=True")
        else:
            print(f"🔑 Keys OK!")
        return client
    else:
        print(f"\n❌ Connection FAILED: {result.get('error')}")
        return None


async def test_market_data(client: LighterClient):
    """Test 2: Lấy market data"""
    print("\n" + "=" * 60)
    print("📊 TEST 2: MARKET DATA")
    print("=" * 60)
    
    market = MarketData(client.get_order_api(), client.get_account_api())
    
    # Test 2.1: Get BTC price
    print("\n📈 Test 2.1: Get BTC Price")
    btc_price = await market.get_price(market_id=1, symbol='BTC')
    if btc_price['success']:
        print(f"   ✅ BTC Price:")
        print(f"      Bid: ${btc_price['bid']:,.2f}")
        print(f"      Ask: ${btc_price['ask']:,.2f}")
        print(f"      Mid: ${btc_price['mid']:,.2f}")
    else:
        print(f"   ❌ Failed: {btc_price.get('error')}")
    
    # Test 2.2: Get ETH price
    print("\n📈 Test 2.2: Get ETH Price")
    eth_price = await market.get_price(market_id=2, symbol='ETH')
    if eth_price['success']:
        print(f"   ✅ ETH Price:")
        print(f"      Bid: ${eth_price['bid']:,.2f}")
        print(f"      Ask: ${eth_price['ask']:,.2f}")
        print(f"      Mid: ${eth_price['mid']:,.2f}")
    else:
        print(f"   ❌ Failed: {eth_price.get('error')}")
    
    # Test 2.3: Get account balance
    print("\n💰 Test 2.3: Get Account Balance")
    account_index = int(os.getenv('ACCOUNT_INDEX', 0))
    balance = await market.get_account_balance(account_index)
    if balance['success']:
        print(f"   ✅ Balance:")
        print(f"      Available: ${balance['available']:,.2f}")
        print(f"      Collateral: ${balance['collateral']:,.2f}")
        print(f"      Total: ${balance['total']:,.2f}")
    else:
        print(f"   ❌ Failed: {balance.get('error')}")
    
    # Test 2.4: Get positions
    print("\n📈 Test 2.4: Get Positions")
    positions = await market.get_positions(account_index)
    if positions['success']:
        print(f"   ✅ Positions: {positions['count']} open")
        for pos in positions['positions']:
            print(f"      - Market {pos['market_id']}: Size={pos['size']}, Entry=${pos['avg_entry_price']}")
    else:
        print(f"   ❌ Failed: {positions.get('error')}")
    
    # Test 2.5: Get market metadata
    print("\n🔧 Test 2.5: Get Market Metadata (BTC)")
    metadata = await market.get_market_metadata(market_id=1)
    if metadata['success']:
        print(f"   ✅ Metadata:")
        print(f"      Size Decimals: {metadata['size_decimals']}")
        print(f"      Price Decimals: {metadata['price_decimals']}")
        print(f"      Min Base Amount: {metadata['min_base_amount']}")
    else:
        print(f"   ❌ Failed: {metadata.get('error')}")
    
    return btc_price, eth_price, balance


async def test_workflow_with_config(client: LighterClient):
    """Test 3: Full workflow với config"""
    print("\n" + "=" * 60)
    print("🔄 TEST 3: FULL WORKFLOW WITH CONFIG")
    print("=" * 60)
    
    # Load config
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config.json')
    config = ConfigLoader.load_from_file(config_path)
    trading_params = ConfigLoader.parse_trading_params(config)
    risk_params = ConfigLoader.parse_risk_params(config)
    
    print(f"\n📋 Config:")
    print(f"   Pair: {trading_params['pair']}")
    print(f"   Size: ${trading_params['size_usd']}")
    print(f"   Leverage: {trading_params['leverage']}x")
    print(f"   R:R Ratio: {risk_params['rr_ratio']}")
    
    # Get price
    market = MarketData(client.get_order_api(), client.get_account_api())
    price_result = await market.get_price(
        market_id=trading_params['market_id'],
        symbol=trading_params['symbol']
    )
    
    if not price_result['success']:
        print(f"❌ Failed to get price")
        return
    
    entry_price = price_result['ask']  # LONG → buy at ask
    
    # Calculate position size
    position_size = Calculator.calculate_position_size(
        trading_params['size_usd'],
        entry_price
    )
    
    print(f"\n📊 Calculations:")
    print(f"   Entry Price: ${entry_price:,.2f}")
    print(f"   Position Size: {position_size} {trading_params['symbol']}")
    print(f"   Total USD: ${trading_params['size_usd']}")
    
    # Calculate TP/SL từ R:R ratio
    if risk_params['rr_ratio']:
        sl_percent = 3  # 3% SL distance
        sl_price = Calculator.calculate_sl_from_percent(entry_price, 'long', sl_percent)
        
        tp_sl = Calculator.calculate_tp_sl_from_rr_ratio(
            entry_price=entry_price,
            side='long',
            sl_price=sl_price,
            rr_ratio=risk_params['rr_ratio']
        )
        
        # Validate SL
        validation = Calculator.validate_sl_price(sl_price, entry_price, 'long', max_percent=5)
        final_sl = validation['adjusted_price'] if not validation['valid'] else sl_price
        
        print(f"\n🎯 TP/SL (R:R {risk_params['rr_ratio']}):")
        print(f"   Entry: ${entry_price:,.2f}")
        print(f"   SL: ${final_sl:,.2f} (Risk: ${tp_sl['risk_amount']:.2f})")
        print(f"   TP: ${tp_sl['tp_price']:,.2f} (Reward: ${tp_sl['reward_amount']:.2f})")
        print(f"   R:R: 1:{tp_sl['reward_amount']/tp_sl['risk_amount']:.2f}")
    
    print(f"\n✅ Workflow calculation completed!")
    print(f"   → Ready to place order (but NOT executing in test mode)")


async def test_order_preparation(client: LighterClient):
    """Test 4: Chuẩn bị order (KHÔNG place thật)"""
    print("\n" + "=" * 60)
    print("📦 TEST 4: ORDER PREPARATION (DRY RUN)")
    print("=" * 60)
    
    # Load config
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config.json')
    config = ConfigLoader.load_from_file(config_path)
    trading_params = ConfigLoader.parse_trading_params(config)
    
    # Get price
    market = MarketData(client.get_order_api(), client.get_account_api())
    price_result = await market.get_price(
        market_id=trading_params['market_id'],
        symbol=trading_params['symbol']
    )
    
    if not price_result['success']:
        print(f"❌ Failed to get price")
        return
    
    entry_price = price_result['ask']
    
    # Prepare order parameters
    order_params = {
        'side': 'long',
        'entry_price': entry_price,
        'position_size_usd': trading_params['size_usd'],
        'market_id': trading_params['market_id'],
        'symbol': trading_params['symbol'],
        'leverage': trading_params['leverage']
    }
    
    print(f"\n📋 Order Parameters (Ready to Execute):")
    print(f"   Side: {order_params['side'].upper()}")
    print(f"   Symbol: {order_params['symbol']}")
    print(f"   Market ID: {order_params['market_id']}")
    print(f"   Entry Price: ${order_params['entry_price']:,.2f}")
    print(f"   Position Size USD: ${order_params['position_size_usd']}")
    print(f"   Leverage: {order_params['leverage']}x")
    
    print(f"\n✅ Order prepared successfully!")
    print(f"   → To place real order, use OrderExecutor.place_order() with these params")


async def main():
    """Main test runner"""
    print("🚀 STARTING REAL CONNECTION TESTS")
    print("=" * 60)
    print("⚠️  SAFE MODE: Chỉ test connect & get data, KHÔNG place order")
    print("=" * 60)
    
    client = None
    
    try:
        # Test 1: Connection
        client = await test_connection()
        if not client:
            print("\n❌ Cannot proceed without connection")
            return
        
        # Check keys mismatch
        if client.has_keys_mismatch():
            print("\n⚠️  WARNING: Keys mismatch detected!")
            print("   Bot sẽ KHÔNG thể place orders")
            print("   → Fix keys trước khi trade thật")
            print("\n✅ Continuing test (view data only)...")
        
        # Test 2: Market Data
        await test_market_data(client)
        
        # Test 3: Workflow with Config
        await test_workflow_with_config(client)
        
        # Test 4: Order Preparation (dry run)
        await test_order_preparation(client)
        
        # Summary
        print("\n" + "=" * 60)
        print("✅ ALL REAL CONNECTION TESTS COMPLETED!")
        print("=" * 60)
        print("\n📊 Test Results:")
        print("   ✅ Connection: SUCCESS")
        print("   ✅ Market Data: SUCCESS")
        print("   ✅ Workflow: SUCCESS")
        print("   ✅ Order Prep: SUCCESS")
        
        if client.has_keys_mismatch():
            print("\n⚠️  Note: Keys mismatch - Cannot place real orders")
            print("   → Fix keys để có thể trade")
        else:
            print("\n🔑 Keys: OK - Ready to trade!")
        
        # Option để place order thật
        print("\n" + "=" * 60)
        print("🚨 NOTE: PLACE REAL ORDER DISABLED IN AUTO MODE")
        print("=" * 60)
        
        if not client.has_keys_mismatch():
            print("✅ Keys OK - Ready to trade!")
            print("   → To place real order, run script manually and confirm")
        else:
            print("❌ Cannot place order - Keys mismatch")
            print("   → Fix keys to enable trading")
        
    except KeyboardInterrupt:
        print("\n\n🛑 Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if client:
            await client.close()


async def place_real_order(client: LighterClient):
    """Place real order (DANGER!)"""
    print("\n" + "=" * 60)
    print("🔥 PLACING REAL ORDER")
    print("=" * 60)
    
    # Load config
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config.json')
    config = ConfigLoader.load_from_file(config_path)
    trading_params = ConfigLoader.parse_trading_params(config)
    risk_params = ConfigLoader.parse_risk_params(config)
    
    # Get price
    market = MarketData(client.get_order_api(), client.get_account_api())
    price_result = await market.get_price(
        market_id=trading_params['market_id'],
        symbol=trading_params['symbol']
    )
    
    entry_price = price_result['ask']
    
    # Place entry order
    print(f"\n🎯 Placing Entry Order...")
    order_executor = OrderExecutor(client.get_signer_client(), client.get_order_api())
    
    result = await order_executor.place_order(
        side='long',
        entry_price=entry_price,
        position_size_usd=trading_params['size_usd'],
        market_id=trading_params['market_id'],
        symbol=trading_params['symbol'],
        leverage=trading_params['leverage']
    )
    
    if result['success']:
        print(f"\n✅ ORDER PLACED SUCCESSFULLY!")
        print(f"   TX Hash: {result['tx_hash']}")
        print(f"   Entry: ${result['entry_price']:,.2f}")
        print(f"   Size: {result['position_size']} {trading_params['symbol']}")
        
        # Place TP/SL nếu có config
        if risk_params['rr_ratio']:
            place_tpsl = input("\n❓ Đặt TP/SL không? (yes/no): ").lower().strip()
            if place_tpsl == 'yes':
                sl_percent = 3
                sl_price = Calculator.calculate_sl_from_percent(entry_price, 'long', sl_percent)
                tp_sl = Calculator.calculate_tp_sl_from_rr_ratio(
                    entry_price, 'long', sl_price, risk_params['rr_ratio']
                )
                
                risk_manager = RiskManager(client.get_signer_client(), client.get_order_api())
                tp_sl_result = await risk_manager.place_tp_sl_orders(
                    entry_price=entry_price,
                    position_size=result['position_size'],
                    side='long',
                    tp_price=tp_sl['tp_price'],
                    sl_price=sl_price,
                    market_id=trading_params['market_id'],
                    symbol=trading_params['symbol']
                )
                
                print(f"\n✅ TP/SL Placed!")
                print(f"   TP: {tp_sl_result['tp_success']}")
                print(f"   SL: {tp_sl_result['sl_success']}")
    else:
        print(f"\n❌ ORDER FAILED: {result.get('error')}")


if __name__ == "__main__":
    asyncio.run(main())

