# Hyperliquid Paper Trader

A real-time **Forward Testing / Paper Trading** system for Hyperliquid.
This tool allows you to simulate trades against live market data using WebSockets, supporting multiple strategies/portfolios.

## Features

- 🔌 **Real-time**: Connects to Hyperliquid WebSocket (`trades` channel).
- ⚡ **Multi-Strategy**: Manage multiple independent portfolios (e.g., `SWING_01`, `SCALP_02`).
- 📊 **Database**: Persists trade history and balances in PostgreSQL.
- 🚀 **REST API**: Manage trades via HTTP endpoints.
- 📑 **Swagger UI**: Interactive API documentation.

## Prerequisites

- Node.js (v18+)
- PostgreSQL Database

## Installation

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Configure Environment**:
    Copy `.env.example` to `.env` and update credentials.
    ```bash
    cp .env.example .env
    ```
    
    **`.env`**:
    ```ini
    DATABASE_URL=postgresql://user:password@localhost:5432/hyperliquid_bot
    SYMBOL=BTC
    PORT=3000
    ```

3.  **Database Setup**:
    Ensure your PostgreSQL server is running and the database (e.g., `hyperliquid_bot`) exists. The tables (`strategies`, `positions`) will be auto-created on start.

## Usage

### Start Server
```bash
npm run start
# OR for development (watch mode)
npm run dev
```

### API Documentation (Swagger)
Open your browser and navigate to:
[http://localhost:3000/api-docs](http://localhost:3000/api-docs)

### CLI (Optional)
The server logs trade activities and PnL updates to the console.

## API Endpoints

- **POST** `/api/strategies`: Initialize a new strategy wallet.
- **POST** `/api/order`: Place a paper trade.
- **GET** `/api/strategies/:id`: Get balance and history.
