"""
Calculator - Các hàm tính toán cho trading
"""


class Calculator:
    """
    Tính toán các giá trị cho trading
    
    Tất cả methods là static - không cần state, chỉ input/output thuần túy
    """
    
    @staticmethod
    def calculate_position_size(usd_amount: float, price: float, decimals: int = 8) -> float:
        """
        Tính position size từ USD amount
        
        Input:
            - usd_amount: Số tiền USD muốn trade
            - price: Giá entry
            - decimals: Số thập phân (default: 8)
        
        Output:
            float: Position size (số lượng coin)
        
        Example:
            >>> Calculator.calculate_position_size(100, 65000)
            0.00153846
        """
        size = usd_amount / price
        return round(size, decimals)
    
    @staticmethod
    def calculate_tp_sl_from_percent(
        entry_price: float,
        side: str,
        tp_percent: float,
        sl_percent: float,
        leverage: float = 1.0
    ) -> dict:
        """
        Tính TP/SL từ % với leverage adjustment
        
        Input:
            - entry_price: Giá entry
            - side: 'long' hoặc 'short'
            - tp_percent: % TP (ROI, VD: 50 = +50%)
            - sl_percent: % SL (ROI, VD: 20 = -20%)
            - leverage: Đòn bẩy (default: 1)
        
        Output:
            dict: {
                'tp_price': float,
                'sl_price': float,
                'tp_percent_price': float,  # % thay đổi giá
                'sl_percent_price': float   # % thay đổi giá
            }
        
        Example:
            >>> Calculator.calculate_tp_sl_from_percent(65000, 'long', 50, 20, 5)
            {'tp_price': 71500, 'sl_price': 62400, ...}
        """
        is_long = side.lower() == 'long'
        
        # Adjust TP/SL theo leverage
        # VD: 50% ROI với 5x leverage = 10% price movement
        leverage_adj_tp = tp_percent / leverage
        leverage_adj_sl = abs(sl_percent) / leverage
        
        if is_long:
            tp_price = entry_price * (1 + leverage_adj_tp / 100)
            sl_price = entry_price * (1 - leverage_adj_sl / 100)
        else:
            tp_price = entry_price * (1 - leverage_adj_tp / 100)
            sl_price = entry_price * (1 + leverage_adj_sl / 100)
        
        return {
            'tp_price': tp_price,
            'sl_price': sl_price,
            'tp_percent_price': leverage_adj_tp,
            'sl_percent_price': leverage_adj_sl
        }
    
    @staticmethod
    def calculate_tp_sl_from_rr_ratio(
        entry_price: float,
        side: str,
        sl_price: float,
        rr_ratio: list
    ) -> dict:
        """
        Tính TP từ SL và R:R ratio
        
        Input:
            - entry_price: Giá entry
            - side: 'long' hoặc 'short'
            - sl_price: Giá SL đã xác định
            - rr_ratio: [risk, reward] VD: [1, 2] = mất 1 ăn 2
        
        Output:
            dict: {
                'tp_price': float,
                'risk_amount': float,  # $ risk
                'reward_amount': float  # $ reward
            }
        
        Example:
            >>> Calculator.calculate_tp_sl_from_rr_ratio(65000, 'long', 63000, [1, 2])
            {'tp_price': 69000, 'risk_amount': 2000, 'reward_amount': 4000}
        """
        is_long = side.lower() == 'long'
        risk_part, reward_part = rr_ratio[0], rr_ratio[1]
        ratio_multiplier = reward_part / risk_part
        
        # Tính risk (khoảng cách entry -> SL)
        if is_long:
            risk_amount = entry_price - sl_price
            tp_price = entry_price + (risk_amount * ratio_multiplier)
        else:
            risk_amount = sl_price - entry_price
            tp_price = entry_price - (risk_amount * ratio_multiplier)
        
        reward_amount = abs(tp_price - entry_price)
        
        return {
            'tp_price': tp_price,
            'risk_amount': risk_amount,
            'reward_amount': reward_amount
        }
    
    @staticmethod
    def calculate_sl_from_percent(
        entry_price: float,
        side: str,
        sl_percent: float
    ) -> float:
        """
        Tính SL price từ % distance
        
        Input:
            - entry_price: Giá entry
            - side: 'long' hoặc 'short'
            - sl_percent: % khoảng cách SL (VD: 3 = 3%)
        
        Output:
            float: SL price
        
        Example:
            >>> Calculator.calculate_sl_from_percent(65000, 'long', 3)
            63050
        """
        is_long = side.lower() == 'long'
        
        if is_long:
            return entry_price * (1 - sl_percent / 100)
        else:
            return entry_price * (1 + sl_percent / 100)
    
    @staticmethod
    def validate_sl_price(
        sl_price: float,
        entry_price: float,
        side: str,
        max_percent: float = 5.0
    ) -> dict:
        """
        Validate SL price và adjust nếu cần
        
        Input:
            - sl_price: Giá SL muốn đặt
            - entry_price: Giá entry
            - side: 'long' hoặc 'short'
            - max_percent: % tối đa cho phép (default: 5%)
        
        Output:
            dict: {
                'valid': bool,
                'adjusted_price': float,  # Giá đã adjust
                'original_percent': float,  # % ban đầu
                'adjusted_percent': float  # % sau adjust
            }
        
        Example:
            >>> Calculator.validate_sl_price(60000, 65000, 'long', 5)
            {'valid': False, 'adjusted_price': 61750, ...}
        """
        is_long = side.lower() == 'long'
        
        # Tính % hiện tại
        if is_long:
            current_percent = ((entry_price - sl_price) / entry_price) * 100
            min_sl_price = entry_price * (1 - max_percent / 100)
            adjusted_price = max(sl_price, min_sl_price)
        else:
            current_percent = ((sl_price - entry_price) / entry_price) * 100
            max_sl_price = entry_price * (1 + max_percent / 100)
            adjusted_price = min(sl_price, max_sl_price)
        
        # Tính % sau adjust
        if is_long:
            adjusted_percent = ((entry_price - adjusted_price) / entry_price) * 100
        else:
            adjusted_percent = ((adjusted_price - entry_price) / entry_price) * 100
        
        valid = abs(current_percent) <= max_percent
        
        return {
            'valid': valid,
            'adjusted_price': adjusted_price,
            'original_percent': current_percent,
            'adjusted_percent': adjusted_percent
        }
    
    @staticmethod
    def scale_to_int(value: float, decimals: int) -> int:
        """
        Scale số thập phân thành integer theo decimals
        
        Input:
            - value: Giá trị cần scale
            - decimals: Số decimals
        
        Output:
            int: Giá trị đã scale
        
        Example:
            >>> Calculator.scale_to_int(0.00153, 8)
            153000
        """
        return int(round(value * (10 ** decimals)))
    
    @staticmethod
    def calculate_rr_ratio(
        entry_price: float,
        tp_price: float,
        sl_price: float
    ) -> float:
        """
        Tính R:R ratio từ các giá
        
        Input:
            - entry_price: Giá entry
            - tp_price: Giá TP
            - sl_price: Giá SL
        
        Output:
            float: R:R ratio (VD: 2.0 = 1:2)
        
        Example:
            >>> Calculator.calculate_rr_ratio(65000, 69000, 63000)
            2.0
        """
        risk = abs(entry_price - sl_price)
        reward = abs(tp_price - entry_price)
        
        if risk == 0:
            return 0
        
        return reward / risk

