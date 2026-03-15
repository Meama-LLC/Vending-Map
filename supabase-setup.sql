-- ============================================
-- MEAMA Live Orders — Supabase Setup
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable Realtime on all order tables (skip if already enabled)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE vending_orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE meama_collect_orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE b2b_orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE franchise_orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable RLS + read policies for all order tables
DO $$ BEGIN
  ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "anon_read_orders" ON orders FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "anon_read_order_items" ON order_items FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE meama_collect_orders ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "anon_read_collect_orders" ON meama_collect_orders FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE meama_collect_order_items ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "anon_read_collect_items" ON meama_collect_order_items FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE b2b_orders ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "anon_read_b2b_orders" ON b2b_orders FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE b2b_order_items ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "anon_read_b2b_items" ON b2b_order_items FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE franchise_orders ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "anon_read_franchise_orders" ON franchise_orders FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE franchise_order_items ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "anon_read_franchise_items" ON franchise_order_items FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE daily_revenue ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "anon_read_daily_revenue" ON daily_revenue FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- vending_orders already has RLS + policy from earlier setup

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collect_orders_created_at ON meama_collect_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_created_at ON b2b_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_franchise_orders_created_at ON franchise_orders (created_at DESC);
