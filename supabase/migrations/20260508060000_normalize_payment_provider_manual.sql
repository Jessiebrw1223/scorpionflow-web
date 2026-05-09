-- Normalización post-migración Mercado Pago.
-- Objetivo: Stripe queda fuera del flujo comercial actual; los planes no vinculados
-- a un preapproval real de Mercado Pago se consideran manuales.

ALTER TABLE public.account_subscriptions
  ALTER COLUMN payment_provider SET DEFAULT 'manual';

UPDATE public.account_subscriptions
SET
  payment_provider = 'manual',
  updated_at = now()
WHERE payment_provider = 'stripe'
  AND mp_preapproval_id IS NULL;

UPDATE public.account_subscriptions
SET
  plan = 'free',
  status = 'active',
  payment_provider = 'manual',
  mp_preapproval_id = NULL,
  mp_customer_email = NULL,
  cancel_at_period_end = false,
  updated_at = now()
WHERE payment_provider = 'mercadopago'
  AND status IN ('rejected', 'expired', 'cancelled');
