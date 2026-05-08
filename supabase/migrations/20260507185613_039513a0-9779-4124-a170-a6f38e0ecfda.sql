
-- ===== Roles =====
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT role FROM public.user_roles WHERE user_roles.user_id = get_user_role.user_id LIMIT 1 $$;

CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Only admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Only admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Only admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

-- ===== updated_at trigger =====
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ===== Profiles =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  phone_number TEXT,
  address TEXT,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Admins full access profiles" ON public.profiles FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Handle new user =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'first_name', NEW.raw_user_meta_data ->> 'last_name');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== KYC =====
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('kyc-documents','kyc-documents',false,10485760, ARRAY['image/jpeg','image/png','application/pdf']);

CREATE TABLE public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','under_review')),
  document_type TEXT NOT NULL CHECK (document_type IN ('passport','license','id')),
  front_document_url TEXT,
  back_document_url TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  notes TEXT
);
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own kyc" ON public.kyc_submissions FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Users insert own kyc" ON public.kyc_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Admins full kyc" ON public.kyc_submissions FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- KYC storage policies
CREATE POLICY "Users can upload own kyc docs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read own kyc docs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins read all kyc docs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='kyc-documents' AND has_role(auth.uid(),'admin'));

-- ===== Verification questions =====
CREATE TABLE public.verification_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  asked_by UUID REFERENCES auth.users(id),
  asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','answered'))
);
ALTER TABLE public.verification_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own vq" ON public.verification_questions FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Users update own vq" ON public.verification_questions FOR UPDATE TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Admins full vq" ON public.verification_questions FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ===== Support messages (legacy) =====
CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  admin_reply TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  replied_at TIMESTAMPTZ
);
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own sm" ON public.support_messages FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Users view own sm" ON public.support_messages FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Admins full sm" ON public.support_messages FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ===== Chat messages =====
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id UUID NOT NULL,
  message TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user','admin','bot')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own chat" ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Users insert own chat" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Users update own user chat" ON public.chat_messages FOR UPDATE TO authenticated USING (auth.uid()=user_id AND sender_type='user');
CREATE POLICY "Users delete own user chat" ON public.chat_messages FOR DELETE USING (auth.uid()=user_id AND sender_type='user');
CREATE POLICY "Admins full chat" ON public.chat_messages FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- ===== Wallet balances =====
CREATE TABLE public.wallet_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  balance NUMERIC(20,8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);
ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own wb" ON public.wallet_balances FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Users update own wb" ON public.wallet_balances FOR UPDATE TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Admins full wb" ON public.wallet_balances FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_wb_updated BEFORE UPDATE ON public.wallet_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.wallet_balances REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_balances;

-- ===== Transactions =====
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy','sell','exchange','withdraw','deposit')),
  crypto_symbol TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  price NUMERIC,
  total_value NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','cancelled')),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  admin_approved_at TIMESTAMPTZ,
  admin_approved_by UUID
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tx" ON public.transactions FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Users insert own tx" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Admins full tx" ON public.transactions FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_tx_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);

-- ===== User sessions =====
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  user_agent TEXT,
  ip_address TEXT
);
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own session" ON public.user_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Users update own session" ON public.user_sessions FOR UPDATE TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Users view own session" ON public.user_sessions FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Admins view all sessions" ON public.user_sessions FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete sessions" ON public.user_sessions FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
ALTER TABLE public.user_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;

-- ===== Push subscriptions =====
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push" ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Admins read push" ON public.push_subscriptions FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));

-- ===== VIP memberships =====
CREATE TABLE public.vip_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  package_name TEXT NOT NULL,
  deposit_amount NUMERIC NOT NULL DEFAULT 0,
  bonus_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  assigned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vip_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own vip" ON public.vip_memberships FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Admins full vip" ON public.vip_memberships FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_vip_updated BEFORE UPDATE ON public.vip_memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Platform settings =====
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view settings" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "Admins insert settings" ON public.platform_settings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update settings" ON public.platform_settings FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete settings" ON public.platform_settings FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_ps_updated BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.platform_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_settings;

INSERT INTO public.platform_settings (key, value) VALUES
  ('min_trading_balance_usd', '500'::jsonb),
  ('wallet_address_btc',  '"bc1q56qxqrchf20qra4a0962fg7fqm54rvp9r7xhrl"'::jsonb),
  ('wallet_address_eth',  '"0xc2930d27a31cB1C25Cd6Bd96F858f0190CFdA5cB"'::jsonb),
  ('wallet_address_usdt', '"0xc2930d27a31cB1C25Cd6Bd96F858f0190CFdA5cB"'::jsonb),
  ('wallet_address_usdc', '"0xc2930d27a31cB1C25Cd6Bd96F858f0190CFdA5cB"'::jsonb);

-- ===== Make admin function =====
CREATE OR REPLACE FUNCTION public.make_user_admin(user_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email=user_email;
  IF target_user_id IS NULL THEN RAISE EXCEPTION 'User % not found', user_email; END IF;
  DELETE FROM public.user_roles WHERE user_id=target_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (target_user_id, 'admin');
END; $$;
