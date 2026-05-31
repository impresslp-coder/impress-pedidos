-- ============================================================
-- Migración: flag de tapa/contratapa en pedidos
-- Correr en Supabase > SQL Editor
-- ============================================================

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS imprimir_tapas BOOLEAN DEFAULT FALSE;
