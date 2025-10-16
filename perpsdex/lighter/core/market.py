"""
MarketData - Lấy dữ liệu thị trường
"""


class MarketData:
    """
    Lấy thông tin thị trường từ Lighter
    
    Input:
        - order_api: OrderApi instance
        - account_api: AccountApi instance
    
    Methods:
        - get_price(market_id, symbol): Lấy giá từ order book
        - get_order_book(market_id, limit): Lấy order book đầy đủ
        - get_market_metadata(market_id): Lấy metadata (decimals, min_amount)
        - get_account_balance(account_index): Lấy balance
        - get_positions(account_index): Lấy positions
    """
    
    def __init__(self, order_api, account_api):
        self.order_api = order_api
        self.account_api = account_api
    
    async def get_price(self, market_id: int, symbol: str = None) -> dict:
        """
        Lấy giá từ order book
        
        Input:
            - market_id: ID của market (1=BTC, 2=ETH, ...)
            - symbol: Tên symbol để hiển thị (optional)
        
        Output:
            dict: {
                'bid': float,
                'ask': float,
                'mid': float,
                'success': bool,
                'error': str (nếu có)
            }
        """
        try:
            symbol_display = symbol or f"Market {market_id}"
            print(f"\n📈 Đang lấy giá {symbol_display}...")
            
            # Lấy order book
            order_book_data = await self.order_api.order_book_orders(market_id=market_id, limit=5)
            
            if order_book_data and order_book_data.bids and order_book_data.asks:
                best_bid = float(order_book_data.bids[0].price)
                best_ask = float(order_book_data.asks[0].price)
                mid_price = (best_bid + best_ask) / 2
                
                print(f"💰 Giá {symbol_display}:")
                print(f"   🟢 Bid: ${best_bid:,.2f}")
                print(f"   🔴 Ask: ${best_ask:,.2f}")
                print(f"   📊 Mid: ${mid_price:,.2f}")
                
                return {
                    'success': True,
                    'bid': best_bid,
                    'ask': best_ask,
                    'mid': mid_price
                }
            else:
                print(f"❌ Không lấy được giá {symbol_display}")
                return {
                    'success': False,
                    'error': 'No order book data'
                }
                
        except Exception as e:
            print(f"❌ Lỗi khi lấy giá: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_order_book(self, market_id: int, limit: int = 10) -> dict:
        """
        Lấy order book đầy đủ
        
        Input:
            - market_id: ID của market
            - limit: Số lượng orders mỗi side
        
        Output:
            dict: {
                'success': bool,
                'bids': list,
                'asks': list,
                'error': str (nếu có)
            }
        """
        try:
            order_book_data = await self.order_api.order_book_orders(market_id=market_id, limit=limit)
            
            if order_book_data:
                return {
                    'success': True,
                    'bids': order_book_data.bids,
                    'asks': order_book_data.asks
                }
            else:
                return {
                    'success': False,
                    'error': 'No order book data'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_market_metadata(self, market_id: int) -> dict:
        """
        Lấy market metadata (decimals, min_amount, ...)
        
        Input:
            - market_id: ID của market
        
        Output:
            dict: {
                'success': bool,
                'size_decimals': int,
                'price_decimals': int,
                'min_base_amount': float,
                'error': str (nếu có)
            }
        """
        try:
            details = await self.order_api.order_book_details(market_id=market_id)
            
            if details and details.order_book_details:
                ob = details.order_book_details[0]
                return {
                    'success': True,
                    'size_decimals': ob.size_decimals,
                    'price_decimals': ob.price_decimals,
                    'min_base_amount': float(ob.min_base_amount),
                    'market_id': market_id
                }
            else:
                return {
                    'success': False,
                    'error': 'No market metadata'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_account_balance(self, account_index: int) -> dict:
        """
        Lấy balance của account
        
        Input:
            - account_index: Index của account
        
        Output:
            dict: {
                'success': bool,
                'available': float,
                'collateral': float,
                'total': float,
                'error': str (nếu có)
            }
        """
        try:
            print("\n💰 Đang lấy account balance...")
            
            accounts_data = await self.account_api.account(by='index', value=str(account_index))
            
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
                    'success': True,
                    'available': balance,
                    'collateral': collateral,
                    'total': total_assets
                }
            else:
                print("❌ Không lấy được balance")
                return {
                    'success': False,
                    'error': 'No account data'
                }
                
        except Exception as e:
            print(f"❌ Lỗi khi lấy balance: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_positions(self, account_index: int) -> dict:
        """
        Lấy positions hiện tại
        
        Input:
            - account_index: Index của account
        
        Output:
            dict: {
                'success': bool,
                'positions': list[dict],
                'count': int,
                'error': str (nếu có)
            }
        """
        try:
            print("\n📈 Đang kiểm tra positions...")
            
            accounts_data = await self.account_api.account(by='index', value=str(account_index))
            
            if accounts_data and accounts_data.accounts:
                account = accounts_data.accounts[0]
                positions = account.positions or []
                
                if positions:
                    print(f"📊 {len(positions)} positions đang mở:")
                    positions_list = []
                    for pos in positions:
                        pos_data = {
                            'market_id': pos.market_id,
                            'size': float(pos.size) if hasattr(pos, 'size') else 0,
                            'avg_entry_price': float(pos.avg_entry_price) if hasattr(pos, 'avg_entry_price') else 0,
                        }
                        positions_list.append(pos_data)
                        print(f"   - market_id={pos_data['market_id']} size={pos_data['size']} entry={pos_data['avg_entry_price']}")
                    
                    return {
                        'success': True,
                        'positions': positions_list,
                        'count': len(positions_list)
                    }
                else:
                    print("❌ Không có positions")
                    return {
                        'success': True,
                        'positions': [],
                        'count': 0
                    }
            else:
                print("❌ Không lấy được positions")
                return {
                    'success': False,
                    'error': 'No account data'
                }
                
        except Exception as e:
            print(f"❌ Lỗi khi lấy positions: {e}")
            return {
                'success': False,
                'error': str(e)
            }

