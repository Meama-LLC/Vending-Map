-- ============================================
-- MEAMA PULSE — Supabase Setup
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Enable Realtime on vending_orders so the dashboard gets live updates
ALTER PUBLICATION supabase_realtime ADD TABLE vending_orders;

-- 2. Enable Row Level Security (allow public read for the dashboard)
ALTER TABLE vending_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE vending_order_items ENABLE ROW LEVEL SECURITY;

-- 3. Create read-only policies for anon users
CREATE POLICY "Allow public read vending_orders"
  ON vending_orders FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public read vending_order_items"
  ON vending_order_items FOR SELECT
  TO anon
  USING (true);

-- 4. (Optional) Create an index for faster today-queries
CREATE INDEX IF NOT EXISTS idx_vending_orders_created_at
  ON vending_orders (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vending_orders_vms_id
  ON vending_orders (vms_id);
