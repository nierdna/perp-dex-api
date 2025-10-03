#!/usr/bin/env python3
"""
Bot LONG BTC sử dụng Lighter SDK chính thức
"""

import asyncio
import os
from dotenv import load_dotenv
from lighter import SignerClient, OrderApi, AccountApi
from lighter.signer_client import create_api_key as generate_api_key

load_dotenv()

class LighterLongBotSDK:
    """Bot LONG BTC sử dụng Lighter SDK"""
    
    def __init__(self):
        # Load config
        self.api_key = os.getenv('LIGHTER_PUBLIC_KEY')
        self.private_key = os.getenv('LIGHTER_PRIVATE_KEY')
        self.position_usd = float(os.getenv('BTC_POSITION_USD', '10.0'))
        self.leverage = float(os.getenv('BTC_LEVERAGE', '1.0'))
        self.account_index = int(os.getenv('ACCOUNT_INDEX', '0'))
        self.api_key_index = int(os.getenv('LIGHTER_API_KEY_INDEX', '0'))
        
        print("🚀 Lighter Long BTC Bot (SDK Version)")
        print(f"💰 Position Size: ${self.position_usd}")
        print(f"📊 Leverage: {self.leverage}x")
        print(f"🆔 Account Index: {self.account_index}")
        print(f"🔑 API Key Index: {self.api_key_index}")
        
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
    
    async def get_btc_price(self):
        """Lấy giá BTC từ order book"""
        try:
            print("\n📈 Đang lấy giá BTC...")
            
            # Sử dụng OrderApi để lấy order book (hàm async -> cần await)
            order_book_data = await self.order_api.order_book_orders(market_id=1, limit=5)
            
            if order_book_data and order_book_data.bids and order_book_data.asks:
                best_bid = float(order_book_data.bids[0].price)
                best_ask = float(order_book_data.asks[0].price)
                mid_price = (best_bid + best_ask) / 2
                
                print(f"💰 Giá BTC:")
                print(f"   🟢 Bid: ${best_bid:,.2f}")
                print(f"   🔴 Ask: ${best_ask:,.2f}")
                print(f"   📊 Mid: ${mid_price:,.2f}")
                
                return {
                    'bid': best_bid,
                    'ask': best_ask,
                    'mid': mid_price
                }
            else:
                print("❌ Không lấy được giá BTC")
                return None
                
        except Exception as e:
            print(f"❌ Lỗi khi lấy giá: {e}")
            import traceback
            traceback.print_exc()
            return None
    
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
    
    async def place_long_order(self, price_data):
        """Đặt lệnh LONG BTC"""
        try:
            if self.keys_mismatch:
                return {'success': False, 'error': 'Keys mismatch with server. Fix keys before placing orders.'}
            entry_price = price_data['ask']
            position_size_btc = round(self.position_usd / entry_price, 8)
            
            print(f"\n🎯 Đang đặt lệnh LONG ${self.position_usd} BTC...")
            print(f"📊 Order Details:")
            print(f"   💰 Position Size: {position_size_btc} BTC")
            print(f"   💵 Entry Price: ${entry_price:,.2f}")
            print(f"   💸 Total Cost: ${self.position_usd:.2f}")
            
            # Lấy metadata market để scale đúng decimals
            details = await self.order_api.order_book_details(market_id=1)
            if not details or not details.order_book_details:
                return {'success': False, 'error': 'No market metadata'}
            ob = details.order_book_details[0]
            size_decimals = ob.size_decimals
            price_decimals = ob.price_decimals
            min_base_amount = float(ob.min_base_amount)

            market_index = 1
            # Dùng client_order_index duy nhất (timestamp ms)
            import time
            client_order_index = int(time.time() * 1000)

            # Scale theo decimals
            base_amount = max(position_size_btc, min_base_amount)
            base_amount_int = int(round(base_amount * (10 ** size_decimals)))
            price_int = int(round(entry_price * (10 ** price_decimals)))

            print(f"🔧 Decimals: size={size_decimals}, price={price_decimals}, min_base={min_base_amount}")
            print(f"🔧 Scaled: base_amount_int={base_amount_int}, price_int={price_int}")
            is_ask = 0  # buy = bid
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
                print(f"✅ Đặt lệnh LONG thành công!")
                print(f"📝 Tx Hash: {send_resp.tx_hash}")
                
                return {
                    'success': True,
                    'order_id': getattr(created_order, 'client_order_index', None),
                    'entry_price': entry_price,
                    'position_size': base_amount
                }
            else:
                err_msg = err or getattr(send_resp, 'message', 'Unknown error') if send_resp else err or 'Unknown error'
                print(f"❌ Đặt lệnh thất bại: {err_msg}")
                return {'success': False, 'error': err_msg}
                
        except Exception as e:
            print(f"❌ Lỗi khi đặt lệnh: {e}")
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
    print("🤖 LIGHTER LONG BTC BOT (SDK VERSION)")
    print("=" * 50)
    
    # Check API keys
    if not os.getenv('LIGHTER_PUBLIC_KEY') or not os.getenv('LIGHTER_PRIVATE_KEY'):
        print("❌ Thiếu API keys!")
        print("📝 Vui lòng thêm LIGHTER_PUBLIC_KEY và LIGHTER_PRIVATE_KEY vào .env file")
        return
    
    bot = LighterLongBotSDK()
    
    try:
        # Connect
        if not await bot.connect():
            print("❌ Không thể kết nối đến Lighter")
            return
        
        # Lấy giá BTC
        price_data = await bot.get_btc_price()
        if not price_data:
            print("❌ Không thể lấy giá BTC")
            return
        
        # Lấy balance
        balance = await bot.get_account_balance()
        if not balance:
            print("⚠️  Không lấy được balance")
        
        # Check positions
        await bot.check_positions()
        
        # Hỏi xác nhận
        print(f"\n❓ Bạn có muốn đặt lệnh LONG ${bot.position_usd} BTC không?")
        print("⚠️  Cảnh báo: Trading có rủi ro!")
        
        confirm = input("Nhập 'yes' để xác nhận: ").lower().strip()
        
        if confirm == 'yes':
            result = await bot.place_long_order(price_data)
            
            if result['success']:
                print(f"\n🎉 THÀNH CÔNG!")
                print(f"📝 Order ID: {result['order_id']}")
                print(f"💰 Entry Price: ${result['entry_price']:,.2f}")
                print(f"📊 Position Size: {result['position_size']} BTC")
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
