DROP POLICY IF EXISTS "owners insert own subscription" ON public.account_subscriptions;

CREATE POLICY "owners insert own free subscription"
ON public.account_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id
  AND plan = 'free'::subscription_plan
  AND status IN ('active','pending')
);