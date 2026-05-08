-- Add admin full access policies to all tables

-- kyc_submissions: Admin full access
CREATE POLICY "Admins have full access to kyc_submissions"
ON public.kyc_submissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- profiles: Admin full access
CREATE POLICY "Admins have full access to profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- support_messages: Admin full access
CREATE POLICY "Admins have full access to support_messages"
ON public.support_messages
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- transactions: Admin full access
CREATE POLICY "Admins have full access to transactions"
ON public.transactions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_sessions: Admin full access
CREATE POLICY "Admins have full access to user_sessions"
ON public.user_sessions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- verification_questions: Admin full access
CREATE POLICY "Admins have full access to verification_questions"
ON public.verification_questions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- wallet_balances: Admin full access
CREATE POLICY "Admins have full access to wallet_balances"
ON public.wallet_balances
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- prices: Admin full access
CREATE POLICY "Admins have full access to prices"
ON public.prices
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));