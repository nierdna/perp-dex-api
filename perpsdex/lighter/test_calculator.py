#!/usr/bin/env python3
"""
Test Calculator - Pure functions (không cần connection)
"""

import sys
import os

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import Calculator
from utils.calculator import Calculator


def test_calculator():
    """Test tất cả functions của Calculator"""
    
    print("=" * 60)
    print("🧮 TESTING CALCULATOR MODULE")
    print("=" * 60)
    
    entry_price = 65000
    
    # Test 1: Calculate position size
    print("\n📊 Test 1: Calculate Position Size")
    size = Calculator.calculate_position_size(
        usd_amount=100,
        price=entry_price
    )
    print(f"   Input: $100 at ${entry_price:,.0f}")
    print(f"   Output: {size} BTC")
    assert size > 0, "Position size phải > 0"
    print("   ✅ PASS")
    
    # Test 2: Calculate TP/SL from percent
    print("\n📊 Test 2: Calculate TP/SL from Percent")
    tp_sl_percent = Calculator.calculate_tp_sl_from_percent(
        entry_price=entry_price,
        side='long',
        tp_percent=50,  # +50% ROI
        sl_percent=20,  # -20% ROI
        leverage=5
    )
    print(f"   Input: Entry ${entry_price:,.0f}, TP=50% ROI, SL=20% ROI, Leverage=5x")
    print(f"   Output:")
    print(f"      TP Price: ${tp_sl_percent['tp_price']:,.2f}")
    print(f"      SL Price: ${tp_sl_percent['sl_price']:,.2f}")
    print(f"      TP % Price Move: {tp_sl_percent['tp_percent_price']:.2f}%")
    print(f"      SL % Price Move: {tp_sl_percent['sl_percent_price']:.2f}%")
    assert tp_sl_percent['tp_price'] > entry_price, "TP phải > entry cho LONG"
    assert tp_sl_percent['sl_price'] < entry_price, "SL phải < entry cho LONG"
    print("   ✅ PASS")
    
    # Test 3: Calculate TP from SL + R:R ratio [1, 2]
    print("\n📊 Test 3: Calculate TP/SL from R:R Ratio [1, 2]")
    sl_price = 63000
    tp_sl_rr = Calculator.calculate_tp_sl_from_rr_ratio(
        entry_price=entry_price,
        side='long',
        sl_price=sl_price,
        rr_ratio=[1, 2]  # Mất 1, Ăn 2
    )
    print(f"   Input:")
    print(f"      Entry: ${entry_price:,.0f}")
    print(f"      SL: ${sl_price:,.0f}")
    print(f"      R:R Ratio: [1, 2] (Mất 1, Ăn 2)")
    print(f"   Output:")
    print(f"      TP Price: ${tp_sl_rr['tp_price']:,.2f}")
    print(f"      Risk Amount: ${tp_sl_rr['risk_amount']:,.2f}")
    print(f"      Reward Amount: ${tp_sl_rr['reward_amount']:,.2f}")
    print(f"      Actual R:R: 1:{tp_sl_rr['reward_amount']/tp_sl_rr['risk_amount']:.1f}")
    assert tp_sl_rr['tp_price'] > entry_price, "TP phải > entry"
    assert abs(tp_sl_rr['reward_amount'] / tp_sl_rr['risk_amount'] - 2.0) < 0.01, "R:R phải = 2.0"
    print("   ✅ PASS")
    
    # Test 4: Calculate SL from percent
    print("\n📊 Test 4: Calculate SL from Percent Distance")
    sl_calc = Calculator.calculate_sl_from_percent(
        entry_price=entry_price,
        side='long',
        sl_percent=3  # 3% drop
    )
    print(f"   Input: Entry ${entry_price:,.0f}, Side=LONG, SL=3%")
    print(f"   Output: ${sl_calc:,.2f}")
    expected_sl = entry_price * 0.97
    assert abs(sl_calc - expected_sl) < 1, f"SL phải ≈ ${expected_sl:,.2f}"
    print("   ✅ PASS")
    
    # Test 5: Validate SL price
    print("\n📊 Test 5: Validate SL Price (Max 5%)")
    risky_sl = 60000  # ~7.7% drop - quá xa!
    validation = Calculator.validate_sl_price(
        sl_price=risky_sl,
        entry_price=entry_price,
        side='long',
        max_percent=5.0
    )
    print(f"   Input: SL=${risky_sl:,.0f}, Entry=${entry_price:,.0f}, Max=5%")
    print(f"   Output:")
    print(f"      Valid: {validation['valid']}")
    print(f"      Original %: {validation['original_percent']:.2f}%")
    print(f"      Adjusted Price: ${validation['adjusted_price']:,.2f}")
    print(f"      Adjusted %: {validation['adjusted_percent']:.2f}%")
    assert not validation['valid'], "SL 7.7% phải invalid"
    assert validation['adjusted_percent'] <= 5.0, "Adjusted phải <= 5%"
    print("   ✅ PASS")
    
    # Test 6: Scale to int
    print("\n📊 Test 6: Scale to Integer (Decimals)")
    value = 0.00153846
    decimals = 8
    scaled = Calculator.scale_to_int(value, decimals)
    print(f"   Input: {value} with {decimals} decimals")
    print(f"   Output: {scaled}")
    assert scaled == 153846, f"Scaled phải = 153846"
    print("   ✅ PASS")
    
    # Test 7: Calculate R:R ratio
    print("\n📊 Test 7: Calculate R:R Ratio from Prices")
    tp_price = 69000
    sl_price = 63000
    rr = Calculator.calculate_rr_ratio(entry_price, tp_price, sl_price)
    print(f"   Input: Entry=${entry_price:,.0f}, TP=${tp_price:,.0f}, SL=${sl_price:,.0f}")
    print(f"   Output: R:R = 1:{rr:.2f}")
    expected_rr = (69000 - 65000) / (65000 - 63000)  # 4000 / 2000 = 2.0
    assert abs(rr - expected_rr) < 0.01, f"R:R phải ≈ {expected_rr}"
    print("   ✅ PASS")
    
    # Summary
    print("\n" + "=" * 60)
    print("✅ TẤT CẢ 7 TESTS ĐỀU PASS!")
    print("=" * 60)
    print("\n💡 Calculator module hoạt động hoàn hảo!")
    print("   - Tất cả functions đều có Input/Output rõ ràng")
    print("   - Không hardcode, không phụ thuộc config")
    print("   - Pure functions, dễ test, dễ tái sử dụng")


if __name__ == "__main__":
    test_calculator()

