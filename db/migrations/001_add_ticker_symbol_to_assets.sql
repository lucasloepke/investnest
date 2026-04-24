-- Migration #001: Add optional ticker_symbol column to assets table
-- Supports feature #13: Stock Ticker API integration with Assets page
-- ticker_symbol is nullable — only Investment-type assets that the user
-- links to a real stock/ETF will have this set.

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS ticker_symbol VARCHAR(20) DEFAULT NULL;
