#!/usr/bin/env python3
"""
Bot Trading BTC (LONG/SHORT) sử dụng Lighter SDK chính thức
"""

import asyncio
import os
import json
from dotenv import load_dotenv
from lighter import SignerClient, OrderApi, AccountApi
from lighter.signer_client import create_api_key as generate_api_key

load_dotenv()

class LighterTradingBotSDK:
    """Bot Trading BTC (LONG/SHORT) sử dụng Lighter SDK"""
    
    def __init__(self, config=None):
        # Load config
        self.api_key = os.getenv('LIGHTER_PUBLIC_KEY')
        self.private_key = os.getenv('LIGHTER_PRIVATE_KEY')
        self.position_usd = float(os.getenv('BTC_POSITION_USD', '10.0'))
        self.leverage = float(os.getenv('BTC_LEVERAGE', '1.0'))
        self.account_index = int(os.getenv('ACCOUNT_INDEX', '0'))
        self.api_key_index = int(os.getenv('LIGHTER_API_KEY_INDEX', '0'))
        
        # Default pair
        self.pair = 'BTC-USDT'
        self.symbol = 'BTC'
        self.market_id = 1  # Default BTC market
        
        # Load config from JSON if provided
        if config:
            self.position_usd = config.get('size_usd', self.position_usd)
            self.leverage = config.get('leverage', self.leverage)
            self.order_type = config.get('type', 'market')  # market or limit
            self.set_price_limit = config.get('set_price_limit')
            
            # Pair and market_id mapping
            self.pair = config.get('pair', 'BTC-USDT')
            self.symbol = self.pair.split('-')[0]  # BTC, ETH, etc.
            
            # Map pair to market_id (Lighter specific)
            pair_to_market = {
                'BTC-USDT': 1,
                'ETH-USDT': 2,  # Cần verify với Lighter docs
            }
            self.market_id = pair_to_market.get(self.pair, 1)
            
            # R:R ratio support
            self.rr_ratio = config.get('rr_ratio')  # [risk, reward] format
            
            # Legacy percent support (for backward compatibility)
            self.percent_stop_loss = config.get('percent_stop_loss')
            self.percent_take_profit = config.get('percent_take_profit')
        
        print(f"🚀 Lighter Trading Bot (SDK Version) - {self.pair}")
        print(f"💰 Position Size: ${self.position_usd}")
        print(f"📊 Leverage: {self.leverage}x")
        print(f"🆔 Account Index: {self.account_index}")
        print(f"🔑 API Key Index: {self.api_key_index}")
        print(f"📈 Market ID: {self.market_id}")
        if hasattr(self, 'order_type'):
            print(f"📈 Order Type: {self.order_type}")
            if self.order_type == 'limit' and self.set_price_limit:
                print(f"🎯 Limit Price: ${self.set_price_limit}")
            
            # Display R:R ratio if available
            if hasattr(self, 'rr_ratio') and self.rr_ratio:
                print(f"⚖️  R:R Ratio: {self.rr_ratio[0]}:{self.rr_ratio[1]} (Mất {self.rr_ratio[0]}, Ăn {self.rr_ratio[1]})")
            
            # Display TP/SL if available
            if hasattr(self, 'percent_stop_loss') and self.percent_stop_loss is not None:
                print(f"🛡️ Stop Loss: {self.percent_stop_loss}%")
            if hasattr(self, 'percent_take_profit') and self.percent_take_profit is not None:
                print(f"🎯 Take Profit: {self.percent_take_profit}%")
        
        # Initialize clients
        self.signer_client = None
        self.order_api = None
        self.account_api = None
        self.keys_mismatch = False
    
    async def connect(self):
        """Kết nối đến Lighter"""
        try:
            print("\n🔗 Đang kết nối đến Lighter DEX...")
            
            # Create SignerClient với đúng parameters
            self.signer_client = SignerClient(
                url="https://mainnet.zklighter.elliot.ai",
                private_key=self.private_key,
                api_key_index=self.api_key_index,
                account_index=self.account_index
            )
            
            # Create API clients
            self.order_api = OrderApi(self.signer_client.api_client)
            self.account_api = AccountApi(self.signer_client.api_client)
            
            # Kiểm tra client/key trùng khớp với server
            client_check = self.signer_client.check_client()
            if client_check:
                print(f"⚠️  Warning: {client_check}")
                self.keys_mismatch = True
                # Thử auto-fix nếu có cung cấp L1 private key
                eth_priv = os.getenv('LIGHTER_L1_PRIVATE_KEY', '')
                auto_fix = os.getenv('LIGHTER_AUTO_FIX_API_KEY', 'false').lower() in ('1','true','yes')
                # Validate L1 key: 0x prefixed or raw hex, 32 bytes
                raw = eth_priv[2:] if eth_priv.startswith('0x') else eth_priv
                is_valid_len = len(raw) == 64
                is_hex = all(c in '0123456789abcdefABCDEF' for c in raw)
                if eth_priv and auto_fix and is_valid_len and is_hex:
                    print("🛠️  Attempting to rotate API key to match server...")
                    new_priv, new_pub, err = generate_api_key("")
                    if err:
                        print(f"❌ Failed to generate new API key: {err}")
                    else:
                        resp, err2 = await self.signer_client.change_api_key(eth_priv, new_pub)
                        if err2:
                            print(f"❌ Failed to change API key on server: {err2}")
                        else:
                            # cập nhật local key và tạo client lại
                            self.signer_client.api_key_dict[self.api_key_index] = new_priv
                            self.signer_client.create_client(self.api_key_index)
                            print("✅ Rotated API key successfully. Rechecking...")
                            again = self.signer_client.check_client()
                            if again:
                                print(f"⚠️  Still mismatch: {again}")
                            else:
                                print("✅ Keys match server now.")
                                self.keys_mismatch = False
                else:
                    if auto_fix:
                        print("❌ LIGHTER_L1_PRIVATE_KEY invalid format. Expect 32-byte hex (0x... or hex).")

            print("✅ Kết nối thành công đến Lighter DEX")
            return True
            
        except Exception as e:
            print(f"❌ Lỗi khi kết nối: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def get_price(self):
        """Lấy giá từ order book"""
        try:
            print(f"\n📈 Đang lấy giá {self.symbol}...")
            
            # Sử dụng OrderApi để lấy order book (hàm async -> cần await)
            order_book_data = await self.order_api.order_book_orders(market_id=self.market_id, limit=5)
            
            if order_book_data and order_book_data.bids and order_book_data.asks:
                best_bid = float(order_book_data.bids[0].price)
                best_ask = float(order_book_data.asks[0].price)
                mid_price = (best_bid + best_ask) / 2
                
                print(f"💰 Giá {self.symbol}:")
                print(f"   🟢 Bid: ${best_bid:,.2f}")
                print(f"   🔴 Ask: ${best_ask:,.2f}")
                print(f"   📊 Mid: ${mid_price:,.2f}")
                
                return {
                    'bid': best_bid,
                    'ask': best_ask,
                    'mid': mid_price
                }
            else:
                print(f"❌ Không lấy được giá {self.symbol}")
                return None
                
        except Exception as e:
            print(f"❌ Lỗi khi lấy giá: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def get_btc_price(self):
        """Legacy method for backward compatibility"""
        return await self.get_price()
    
    async def get_account_balance(self):
        """Lấy balance của account"""
        try:
            print("\n💰 Đang lấy account balance...")
            
            # Lấy account info bằng AccountApi (hàm async -> cần await)
            accounts_data = await self.account_api.account(by='index', value=str(self.account_index))
            
            if accounts_data and accounts_data.accounts and len(accounts_data.accounts) > 0:
                account = accounts_data.accounts[0]
                balance = float(account.available_balance)
                collateral = float(account.collateral)
                total_assets = float(account.total_asset_value)
                
                print(f"💰 Account Balance:")
                print(f"   💵 Available: ${balance:,.2f}")
                print(f"   🏦 Collateral: ${collateral:,.2f}")
                print(f"   📊 Total Assets: ${total_assets:,.2f}")
                
                return {
                    'available': balance,
                    'collateral': collateral,
                    'total': total_assets
                }
            else:
                print("❌ Không lấy được balance")
                return None
                
        except Exception as e:
            print(f"❌ Lỗi khi lấy balance: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def place_order(self, side, price_data):
        """Đặt lệnh chung cho LONG hoặc SHORT"""
        try:
            if self.keys_mismatch:
                return {'success': False, 'error': 'Keys mismatch with server. Fix keys before placing orders.'}

            if side not in ('long', 'short'):
                return {'success': False, 'error': 'Invalid side. Use long or short'}

            is_long = side == 'long'
            
            # Determine entry price based on order type
            if hasattr(self, 'order_type') and self.order_type == 'limit' and self.set_price_limit:
                entry_price = float(self.set_price_limit)
                print(f"🎯 Using limit price: ${entry_price}")
            else:
                entry_price = price_data['ask'] if is_long else price_data['bid']
                print(f"🎯 Using market price: ${entry_price}")
            
            position_size = round(self.position_usd / entry_price, 8)

            print(f"\n🎯 Đang đặt lệnh {side.upper()} ${self.position_usd} {self.symbol}...")
            print(f"📊 Order Details:")
            print(f"   💰 Position Size: {position_size} {self.symbol}")
            print(f"   💵 Entry Price: ${entry_price:,.2f}")
            print(f"   💸 Total Cost: ${self.position_usd:.2f}")

            # Lấy metadata market để scale đúng decimals
            details = await self.order_api.order_book_details(market_id=self.market_id)
            if not details or not details.order_book_details:
                return {'success': False, 'error': 'No market metadata'}
            ob = details.order_book_details[0]
            size_decimals = ob.size_decimals
            price_decimals = ob.price_decimals
            min_base_amount = float(ob.min_base_amount)

            market_index = self.market_id
            import time
            client_order_index = int(time.time() * 1000)

            # Scale theo decimals
            base_amount = max(position_size, min_base_amount)
            if position_size < min_base_amount:
                print(f"⚠️  Size adjusted: ${self.position_usd:.2f} → ${base_amount * entry_price:.2f} (min requirement)")
            base_amount_int = int(round(base_amount * (10 ** size_decimals)))
            price_int = int(round(entry_price * (10 ** price_decimals)))

            print(f"🔧 Decimals: size={size_decimals}, price={price_decimals}, min_base={min_base_amount}")
            print(f"🔧 Scaled: base_amount_int={base_amount_int}, price_int={price_int}")

            # is_ask: 0 = bid (buy), 1 = ask (sell)
            is_ask = 0 if is_long else 1
            order_type = self.signer_client.ORDER_TYPE_LIMIT
            time_in_force = self.signer_client.ORDER_TIME_IN_FORCE_GOOD_TILL_TIME
            reduce_only = False
            trigger_price = self.signer_client.NIL_TRIGGER_PRICE
            order_expiry = self.signer_client.DEFAULT_28_DAY_ORDER_EXPIRY

            created_order, send_resp, err = await self.signer_client.create_order(
                market_index,
                client_order_index,
                base_amount_int,
                price_int,
                is_ask,
                order_type,
                time_in_force,
                reduce_only,
                trigger_price,
                order_expiry,
            )

            if err is None and send_resp:
                print("✅ Đặt lệnh thành công!")
                print(f"📝 Tx Hash: {send_resp.tx_hash}")

                result = {
                    'success': True,
                    'order_id': getattr(created_order, 'client_order_index', None),
                    'entry_price': entry_price,
                    'position_size': base_amount,
                    'side': side,
                }
                
                # Auto place TP/SL orders (only if not null)
                if (hasattr(self, 'percent_stop_loss') and hasattr(self, 'percent_take_profit') and 
                    self.percent_stop_loss is not None and self.percent_take_profit is not None):
                    tp_sl_result = await self.place_tp_sl_orders(entry_price, base_amount, side)
                    result['tp_sl'] = tp_sl_result
                else:
                    print("⚠️  TP/SL set to null - skipping TP/SL orders")
                
                return result
            else:
                err_msg = err or getattr(send_resp, 'message', 'Unknown error') if send_resp else err or 'Unknown error'
                print(f"❌ Đặt lệnh thất bại: {err_msg}")
                return {'success': False, 'error': err_msg}

        except Exception as e:
            print(f"❌ Lỗi khi đặt lệnh {side}: {e}")
            return {'success': False, 'error': str(e)}

    async def place_long_order(self, price_data):
        """Đặt lệnh LONG"""
        return await self.place_order('long', price_data)

    async def place_short_order(self, price_data):
        """Đặt lệnh SHORT"""
        return await self.place_order('short', price_data)
    
    async def place_tp_sl_orders(self, entry_price, position_size, side):
        """Đặt Take Profit và Stop Loss orders tự động"""
        try:
            if not hasattr(self, 'percent_stop_loss') or not hasattr(self, 'percent_take_profit'):
                print("⚠️  Không có config TP/SL, bỏ qua")
                return {'success': True, 'tp_sl_placed': False}
            
            is_long = side == 'long'
            
            # Calculate TP/SL prices with leverage consideration
            # percent_take_profit: +50% = lãi 50% ROI (adjusted for leverage)
            # percent_stop_loss: -20% = lỗ 20% ROI (adjusted for leverage)
            leverage_adj_tp = self.percent_take_profit / self.leverage
            leverage_adj_sl = abs(self.percent_stop_loss) / self.leverage
            
            if is_long:
                tp_price = entry_price * (1 + leverage_adj_tp / 100)  # +50%/leverage
                sl_price = entry_price * (1 - leverage_adj_sl / 100)  # -20%/leverage
            else:
                tp_price = entry_price * (1 - leverage_adj_tp / 100)  # +50%/leverage khi giá giảm
                sl_price = entry_price * (1 + leverage_adj_sl / 100)  # -20%/leverage khi giá tăng
            
            # Validate SL price - Lighter is very strict, use tighter ranges
            if is_long:
                min_sl_price = entry_price * 0.95  # Max 5% drop only
                if sl_price < min_sl_price:
                    sl_price = min_sl_price
                    print(f"⚠️  SL price adjusted to minimum (5% drop): ${sl_price:,.2f}")
            else:
                max_sl_price = entry_price * 1.05  # Max 5% rise only
                if sl_price > max_sl_price:
                    sl_price = max_sl_price
                    print(f"⚠️  SL price adjusted to maximum (5% rise): ${sl_price:,.2f}")
            
            print(f"\n🎯 Đang đặt TP/SL orders...")
            print(f"   📈 Take Profit: ${tp_price:,.2f} (+{self.percent_take_profit}%)")
            print(f"   🛡️ Stop Loss: ${sl_price:,.2f} ({self.percent_stop_loss}%)")
            
            # Get market metadata
            details = await self.order_api.order_book_details(market_id=self.market_id)
            if not details or not details.order_book_details:
                return {'success': False, 'error': 'No market metadata for TP/SL'}
            
            ob = details.order_book_details[0]
            size_decimals = ob.size_decimals
            price_decimals = ob.price_decimals
            min_base_amount = float(ob.min_base_amount)
            
            # Scale position size
            base_amount = max(position_size, min_base_amount)
            base_amount_int = int(round(base_amount * (10 ** size_decimals)))
            
            results = []
            
            # Place Take Profit order
            import time
            tp_client_order_index = int(time.time() * 1000) + 1
            tp_price_int = int(round(tp_price * (10 ** price_decimals)))
            
            # TP order: opposite direction to close position
            tp_is_ask = 1 if is_long else 0  # LONG -> sell to close, SHORT -> buy to close
            
            tp_order, tp_resp, tp_err = await self.signer_client.create_order(
                self.market_id,  # market_index
                tp_client_order_index,
                base_amount_int,
                tp_price_int,
                tp_is_ask,
                self.signer_client.ORDER_TYPE_LIMIT,
                self.signer_client.ORDER_TIME_IN_FORCE_GOOD_TILL_TIME,
                True,  # reduce_only = True for TP/SL
                self.signer_client.NIL_TRIGGER_PRICE,
                self.signer_client.DEFAULT_28_DAY_ORDER_EXPIRY,
            )
            
            if tp_err is None and tp_resp:
                print(f"✅ Take Profit order placed: {tp_resp.tx_hash}")
                results.append({'type': 'tp', 'success': True, 'tx_hash': tp_resp.tx_hash})
            else:
                print(f"❌ Take Profit order failed: {tp_err}")
                results.append({'type': 'tp', 'success': False, 'error': tp_err})
            
            # Place Stop Loss order
            sl_client_order_index = int(time.time() * 1000) + 2
            sl_price_int = int(round(sl_price * (10 ** price_decimals)))
            
            # SL order: same direction as TP (to close position)
            sl_is_ask = tp_is_ask
            
            sl_order, sl_resp, sl_err = await self.signer_client.create_order(
                self.market_id,  # market_index
                sl_client_order_index,
                base_amount_int,
                sl_price_int,
                sl_is_ask,
                self.signer_client.ORDER_TYPE_LIMIT,
                self.signer_client.ORDER_TIME_IN_FORCE_GOOD_TILL_TIME,
                True,  # reduce_only = True for TP/SL
                self.signer_client.NIL_TRIGGER_PRICE,
                self.signer_client.DEFAULT_28_DAY_ORDER_EXPIRY,
            )
            
            if sl_err is None and sl_resp:
                print(f"✅ Stop Loss order placed: {sl_resp.tx_hash}")
                results.append({'type': 'sl', 'success': True, 'tx_hash': sl_resp.tx_hash})
            else:
                print(f"❌ Stop Loss order failed: {sl_err}")
                # Try with smaller SL percentage
                if "accidental price" in str(sl_err).lower():
                    print("🔄 Retrying with smaller SL percentage...")
                    retry_sl_price = entry_price * 0.98 if is_long else entry_price * 1.02  # 2% instead
                    retry_sl_price_int = int(round(retry_sl_price * (10 ** price_decimals)))
                    
                    sl_order2, sl_resp2, sl_err2 = await self.signer_client.create_order(
                        self.market_id,  # market_index
                        sl_client_order_index + 10,  # Different order index
                        base_amount_int,
                        retry_sl_price_int,
                        sl_is_ask,
                        self.signer_client.ORDER_TYPE_LIMIT,
                        self.signer_client.ORDER_TIME_IN_FORCE_GOOD_TILL_TIME,
                        True,  # reduce_only = True for TP/SL
                        self.signer_client.NIL_TRIGGER_PRICE,
                        self.signer_client.DEFAULT_28_DAY_ORDER_EXPIRY,
                    )
                    
                    if sl_err2 is None and sl_resp2:
                        print(f"✅ Stop Loss order placed (retry): {sl_resp2.tx_hash}")
                        results.append({'type': 'sl', 'success': True, 'tx_hash': sl_resp2.tx_hash})
                    else:
                        print(f"❌ Stop Loss retry also failed: {sl_err2}")
                        results.append({'type': 'sl', 'success': False, 'error': sl_err2})
                else:
                    results.append({'type': 'sl', 'success': False, 'error': sl_err})
            
            tp_success = any(r['type'] == 'tp' and r['success'] for r in results)
            sl_success = any(r['type'] == 'sl' and r['success'] for r in results)
            
            return {
                'success': True,
                'tp_sl_placed': True,
                'tp_success': tp_success,
                'sl_success': sl_success,
                'results': results
            }
            
        except Exception as e:
            print(f"❌ Lỗi khi đặt TP/SL: {e}")
            return {'success': False, 'error': str(e)}
    
    async def check_positions(self):
        """Kiểm tra positions hiện tại"""
        try:
            print("\n📈 Đang kiểm tra positions...")
            
            account_index = int(os.getenv('ACCOUNT_INDEX', '0'))
            # Dùng AccountApi để lấy account chi tiết và liệt kê positions
            accounts_data = await self.account_api.account(by='index', value=str(account_index))
            if accounts_data and accounts_data.accounts:
                account = accounts_data.accounts[0]
                positions = account.positions or []
                if positions:
                    print(f"📊 {len(positions)} positions đang mở:")
                    for pos in positions:
                        print(f"   - market_id={pos.market_id} size={pos.size} entry={pos.avg_entry_price}")
                else:
                    print("❌ Không có positions")
            else:
                print("❌ Không lấy được positions")
                
        except Exception as e:
            print(f"❌ Lỗi khi lấy positions: {e}")
    
    async def close(self):
        """Đóng kết nối"""
        if self.signer_client:
            await self.signer_client.close()
        print("🔌 Đã đóng kết nối")


async def main():
    """Main function"""
    print("🤖 LIGHTER TRADING BOT (SDK VERSION)")
    print("=" * 50)
    
    # Check API keys
    if not os.getenv('LIGHTER_PUBLIC_KEY') or not os.getenv('LIGHTER_PRIVATE_KEY'):
        print("❌ Thiếu API keys!")
        print("📝 Vui lòng thêm LIGHTER_PUBLIC_KEY và LIGHTER_PRIVATE_KEY vào .env file")
        return
    
    # Load config from JSON if exists
    config = None
    try:
        config_path = os.path.join(os.path.dirname(__file__), '..', 'config.json')
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = json.load(f)
            print(f"✅ Loaded config from {config_path}")
    except Exception as e:
        print(f"⚠️  Could not load config.json: {e}")
    
    bot = LighterTradingBotSDK(config=config)
    
    try:
        # Connect
        if not await bot.connect():
            print("❌ Không thể kết nối đến Lighter")
            return
        
        # Lấy giá
        price_data = await bot.get_price()
        if not price_data:
            print(f"❌ Không thể lấy giá {bot.symbol}")
            return
        
        # Lấy balance
        balance = await bot.get_account_balance()
        if not balance:
            print("⚠️  Không lấy được balance")
        
        # Check positions
        await bot.check_positions()

        # Hỏi chọn phía lệnh
        print("\n❓ Bạn muốn LONG hay SHORT? (long/short)")
        side = input("Nhập 'long' hoặc 'short': ").lower().strip()
        if side not in ('long', 'short'):
            print("❌ Lựa chọn không hợp lệ")
            return

        print("⚠️  Cảnh báo: Trading có rủi ro!")
        confirm = input("Nhập 'yes' để xác nhận: ").lower().strip()

        if confirm == 'yes':
            if side == 'long':
                result = await bot.place_long_order(price_data)
            else:
                result = await bot.place_short_order(price_data)

            if result['success']:
                print(f"\n🎉 THÀNH CÔNG!")
                print(f"📝 Order ID: {result['order_id']}")
                print(f"💰 Entry Price: ${result['entry_price']:,.2f}")
                print(f"📊 Position Size: {result['position_size']} {bot.symbol}")
            else:
                print(f"\n❌ THẤT BẠI! Lỗi: {result.get('error')}")
        else:
            print("❌ Đã hủy đặt lệnh")
            
    except KeyboardInterrupt:
        print("\n🛑 Dừng bởi người dùng")
    except Exception as e:
        print(f"\n❌ Lỗi: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await bot.close()


if __name__ == "__main__":
    asyncio.run(main())
