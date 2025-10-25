"""
Telegram Notifications
"""

import os
import aiohttp


class TelegramNotifier:
    """Telegram notification handler"""
    
    def __init__(self):
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.chat_id = os.getenv('TELEGRAM_CHAT_ID')
        self.enabled = os.getenv('TELEGRAM_ENABLED', 'false').lower() == 'true'
    
    async def send_message(self, message: str):
        """Send message to Telegram"""
        if not self.enabled or not self.bot_token or not self.chat_id:
            print(f"📱 Telegram disabled or not configured")
            return False
        
        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json={
                    'chat_id': self.chat_id,
                    'text': message,
                    'parse_mode': 'HTML'
                }) as response:
                    if response.status == 200:
                        print(f"✅ Telegram notification sent")
                        return True
                    else:
                        print(f"❌ Telegram failed: {response.status}")
                        return False
        except Exception as e:
            print(f"❌ Telegram error: {e}")
            return False

