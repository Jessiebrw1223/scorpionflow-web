
ALTER TABLE public.account_subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS mp_preapproval_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_customer_email TEXT,
  ADD COLUMN IF NOT EXISTS mp_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_last_payment_id TEXT;

CREATE INDEX IF NOT EXISTS idx_account_subscriptions_mp_preapproval
  ON public.account_subscriptions(mp_preapproval_id)
  WHERE mp_preapproval_id IS NOT NULL;
