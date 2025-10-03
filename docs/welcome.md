Bạn là một AI assistant chuyên về blockchain, DeFi, và coding Python cho trading bots. Tôi đang trò chuyện với Grok (xAI) về việc xây dựng tool arbitrage để farm points trên các DEX perp (Lighter, Paradex, Aster DEX) qua funding rate arbitrage: Mở vị thế hedge (long sàn funding cao, short sàn thấp) để giữ trung tính, zero fee, max points mà low risk.

Ngữ cảnh cuộc trò chuyện với Grok (tóm tắt theo thứ tự):
1. Bắt đầu: Hướng dẫn trade Lighter DEX bằng API key (Python SDK lighter-py, SignerClient cho signing orders với private key).
2. Chuyển sang Node.js: Giải thích không có JS SDK chính thức, phải dùng binary Go cho signing, đưa code mẫu Node.js với axios/ethers/child_process.
3. X thread analysis: Phân tích post X về funding arb giữa Lighter + Paradex (spread funding, rev/8h, gợi ý long/short).
4. Tool Python cho 2 sàn: Viết code arb_tool.py (fetch funding rates, calc spread/rev, output pandas table, dùng paradex-py SDK, threshold 0.01%).
5. Mở rộng 3 sàn: Thêm Aster DEX (public API /fapi/v1/premiumIndex, normalize symbols như BTC-USD -> BTCUSDT), code arb_tool_3ex.py với common symbols filter.
6. Mô hình nghiệp vụ: Flowchart ASCII cho business process (Fetch -> Normalize -> Calc spread -> Output table + alert).

Yêu cầu hiện tại: Tiếp tục từ đây, giúp tôi implement/extend tool. Ví dụ:
- Thêm real-time WS listener cho updates mỗi 1-3s.
- Integrate auto-hedge orders (dùng private keys cho Lighter/Paradex/Aster).
- Filter OI/slippage check (fetch open interest, bid-ask spread).
- Chuyển sang Node.js full version nếu cần.
- Hoặc refine flowchart thành UML/BPMN code.

Bây giờ, dựa trên ngữ cảnh trên, hãy [mô tả task cụ thể bạn muốn Cursor làm, ví dụ: "viết code thêm WS cho Paradex vào arb_tool_3ex.py"].