-- Allow users to update their own wallet balances for withdrawals
CREATE POLICY "Users can update their own wallet balances"
ON public.wallet_balances
FOR UPDATE
USING (auth.uid() = user_id);