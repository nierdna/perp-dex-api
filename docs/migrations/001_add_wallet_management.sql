-- Migration: Add wallet management and transfer tracking
-- Date: 2025-12-01

-- 1. Add balance column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS balance DECIMAL(20, 8) DEFAULT '0';

-- 2. Create user_wallets table
CREATE TABLE IF NOT EXISTS user_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    chain_key VARCHAR(50) NOT NULL,
    chain_type VARCHAR(50) NOT NULL,
    address VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_user_chain UNIQUE (user_id, chain_key),
    CONSTRAINT unique_address UNIQUE (address)
);

-- Create indexes for user_wallets
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_address ON user_wallets(address);

-- 3. Create wallet_transfer_history table
CREATE TABLE IF NOT EXISTS wallet_transfer_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(255) NOT NULL,
    from_user_id VARCHAR(255),
    to_user_id VARCHAR(255) NOT NULL,
    transferred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for wallet_transfer_history
CREATE INDEX IF NOT EXISTS idx_wallet_transfer_history_wallet_address ON wallet_transfer_history(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_transfer_history_to_user_id ON wallet_transfer_history(to_user_id);

-- 4. Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_wallets_updated_at BEFORE UPDATE ON user_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_transfer_history_updated_at BEFORE UPDATE ON wallet_transfer_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Add comments for documentation
COMMENT ON TABLE user_wallets IS 'Stores user wallet addresses for different chains';
COMMENT ON TABLE wallet_transfer_history IS 'Tracks wallet ownership transfers';
COMMENT ON COLUMN users.balance IS 'User balance in USD';
