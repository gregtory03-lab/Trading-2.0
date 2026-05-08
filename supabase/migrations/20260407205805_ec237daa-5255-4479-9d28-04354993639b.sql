
CREATE TABLE public.vip_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  package_name TEXT NOT NULL,
  deposit_amount NUMERIC NOT NULL DEFAULT 0,
  bonus_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  assigned_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vip_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to vip_memberships"
ON public.vip_memberships
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own VIP membership"
ON public.vip_memberships
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_vip_memberships_updated_at
BEFORE UPDATE ON public.vip_memberships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
