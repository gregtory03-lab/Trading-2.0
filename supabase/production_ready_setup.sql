-- Edge Trade Hub
-- Production-ready Supabase bootstrap script
--
-- This script creates the database schema, RLS policies, storage bucket rules,
-- realtime publication membership, helper functions, and default platform settings
-- required by the current app codebase.
--
-- Non-SQL steps still required after this script:
-- 1. Deploy edge functions:
--    - get-vapid-public-key
--    - send-push-notification
--    - delete-account
-- 2. Set required Supabase secrets for those functions:
--    - VAPID_PUBLIC_KEY
--    - VAPID_PRIVATE_KEY
--    - SUPABASE_SERVICE_ROLE_KEY
-- 3. Promote your first admin after signup:
--    select public.make_user_admin('you@example.com');

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'app_role'
  ) then
    create type public.app_role as enum ('admin', 'user');
  else
    alter type public.app_role add value if not exists 'admin';
    alter type public.app_role add value if not exists 'user';
  end if;
end
$$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  first_name text,
  last_name text,
  date_of_birth date,
  phone_number text,
  address text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'pending',
  document_type text not null,
  front_document_url text,
  back_document_url text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  notes text
);

create table if not exists public.verification_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  question text not null,
  answer text,
  asked_by uuid,
  asked_at timestamptz not null default now(),
  answered_at timestamptz,
  status text not null default 'pending'
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  message text not null,
  admin_reply text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  replied_at timestamptz
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid not null,
  message text not null,
  sender_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  symbol text not null,
  balance numeric(20,8) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  crypto_symbol text not null,
  amount numeric(20,8) not null,
  price numeric(20,8),
  total_value numeric(20,8),
  status text not null default 'pending',
  details jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  admin_approved_at timestamptz,
  admin_approved_by uuid
);

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  logged_in_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  is_active boolean not null default true,
  user_agent text,
  ip_address text
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.vip_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  package_name text not null,
  deposit_amount numeric(20,2) not null default 0,
  bonus_amount numeric(20,2) not null default 0,
  status text not null default 'active',
  assigned_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

update public.kyc_submissions
set status = 'pending'
where status not in ('pending', 'approved', 'rejected', 'under_review');

update public.kyc_submissions
set document_type = 'passport'
where document_type not in ('passport', 'license', 'id');

update public.verification_questions
set status = case
  when nullif(btrim(coalesce(answer, '')), '') is not null then 'answered'
  else 'pending'
end
where status not in ('pending', 'answered')
   or status is null;

update public.support_messages
set status = case
  when nullif(btrim(coalesce(admin_reply, '')), '') is not null then 'replied'
  else 'pending'
end
where status not in ('pending', 'replied', 'closed')
   or status is null;

update public.chat_messages
set sender_type = 'user'
where sender_type not in ('user', 'admin', 'bot')
   or sender_type is null;

update public.transactions
set status = 'pending'
where status not in ('pending', 'completed', 'failed', 'cancelled')
   or status is null;

update public.transactions
set type = 'deposit'
where type not in ('buy', 'sell', 'exchange', 'withdraw', 'deposit')
   or type is null;

update public.vip_memberships
set status = 'active'
where status not in ('active', 'inactive', 'expired', 'cancelled')
   or status is null;

update public.wallet_balances
set symbol = upper(symbol)
where symbol <> upper(symbol);

update public.wallet_balances
set balance = 0
where balance < 0;

delete from public.user_roles ur
where not exists (
  select 1 from auth.users au where au.id = ur.user_id
);

delete from public.profiles p
where not exists (
  select 1 from auth.users au where au.id = p.user_id
);

delete from public.kyc_submissions ks
where not exists (
  select 1 from auth.users au where au.id = ks.user_id
);

update public.kyc_submissions ks
set reviewed_by = null
where reviewed_by is not null
  and not exists (
    select 1 from auth.users au where au.id = ks.reviewed_by
  );

delete from public.verification_questions vq
where not exists (
  select 1 from auth.users au where au.id = vq.user_id
);

update public.verification_questions vq
set asked_by = null
where asked_by is not null
  and not exists (
    select 1 from auth.users au where au.id = vq.asked_by
  );

delete from public.support_messages sm
where not exists (
  select 1 from auth.users au where au.id = sm.user_id
);

delete from public.chat_messages cm
where not exists (
  select 1 from auth.users au where au.id = cm.user_id
);

delete from public.wallet_balances wb
where not exists (
  select 1 from auth.users au where au.id = wb.user_id
);

delete from public.transactions tx
where not exists (
  select 1 from auth.users au where au.id = tx.user_id
);

update public.transactions tx
set admin_approved_by = null
where admin_approved_by is not null
  and not exists (
    select 1 from auth.users au where au.id = tx.admin_approved_by
  );

delete from public.user_sessions us
where not exists (
  select 1 from auth.users au where au.id = us.user_id
);

delete from public.push_subscriptions ps
where not exists (
  select 1 from auth.users au where au.id = ps.user_id
);

delete from public.vip_memberships vm
where not exists (
  select 1 from auth.users au where au.id = vm.user_id
);

update public.vip_memberships vm
set assigned_by = null
where assigned_by is not null
  and not exists (
    select 1 from auth.users au where au.id = vm.assigned_by
  );

update public.platform_settings s
set updated_by = null
where updated_by is not null
  and not exists (
    select 1 from auth.users au where au.id = s.updated_by
  );

do $$
begin
  if exists (select 1 from pg_class where oid = 'public.user_roles'::regclass) then
    with ranked as (
      select
        id,
        row_number() over (
          partition by user_id
          order by
            case when role = 'admin'::public.app_role then 0 else 1 end,
            created_at desc nulls last,
            id desc
        ) as rn
      from public.user_roles
    )
    delete from public.user_roles ur
    using ranked r
    where ur.id = r.id
      and r.rn > 1;
  end if;

  if exists (select 1 from pg_class where oid = 'public.vip_memberships'::regclass) then
    with ranked as (
      select
        id,
        row_number() over (
          partition by user_id
          order by updated_at desc nulls last, created_at desc nulls last, id desc
        ) as rn
      from public.vip_memberships
    )
    delete from public.vip_memberships vm
    using ranked r
    where vm.id = r.id
      and r.rn > 1;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_roles_user_id_key'
      and conrelid = 'public.user_roles'::regclass
  ) then
    alter table public.user_roles
      add constraint user_roles_user_id_key unique (user_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_roles_user_id_fkey'
      and conrelid = 'public.user_roles'::regclass
  ) then
    alter table public.user_roles
      add constraint user_roles_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_user_id_key'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_user_id_key unique (user_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_user_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'kyc_submissions_user_id_fkey'
      and conrelid = 'public.kyc_submissions'::regclass
  ) then
    alter table public.kyc_submissions
      add constraint kyc_submissions_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'kyc_submissions_reviewed_by_fkey'
      and conrelid = 'public.kyc_submissions'::regclass
  ) then
    alter table public.kyc_submissions
      add constraint kyc_submissions_reviewed_by_fkey
      foreign key (reviewed_by) references auth.users(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'verification_questions_user_id_fkey'
      and conrelid = 'public.verification_questions'::regclass
  ) then
    alter table public.verification_questions
      add constraint verification_questions_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'verification_questions_asked_by_fkey'
      and conrelid = 'public.verification_questions'::regclass
  ) then
    alter table public.verification_questions
      add constraint verification_questions_asked_by_fkey
      foreign key (asked_by) references auth.users(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'support_messages_user_id_fkey'
      and conrelid = 'public.support_messages'::regclass
  ) then
    alter table public.support_messages
      add constraint support_messages_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_messages_user_id_fkey'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
      add constraint chat_messages_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wallet_balances_user_id_symbol_key'
      and conrelid = 'public.wallet_balances'::regclass
  ) then
    alter table public.wallet_balances
      add constraint wallet_balances_user_id_symbol_key unique (user_id, symbol);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'wallet_balances_user_id_fkey'
      and conrelid = 'public.wallet_balances'::regclass
  ) then
    alter table public.wallet_balances
      add constraint wallet_balances_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_user_id_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_admin_approved_by_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_admin_approved_by_fkey
      foreign key (admin_approved_by) references auth.users(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_sessions_user_id_fkey'
      and conrelid = 'public.user_sessions'::regclass
  ) then
    alter table public.user_sessions
      add constraint user_sessions_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'push_subscriptions_user_id_endpoint_key'
      and conrelid = 'public.push_subscriptions'::regclass
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_user_id_endpoint_key unique (user_id, endpoint);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'push_subscriptions_user_id_fkey'
      and conrelid = 'public.push_subscriptions'::regclass
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vip_memberships_user_id_key'
      and conrelid = 'public.vip_memberships'::regclass
  ) then
    alter table public.vip_memberships
      add constraint vip_memberships_user_id_key unique (user_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'vip_memberships_user_id_fkey'
      and conrelid = 'public.vip_memberships'::regclass
  ) then
    alter table public.vip_memberships
      add constraint vip_memberships_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'vip_memberships_assigned_by_fkey'
      and conrelid = 'public.vip_memberships'::regclass
  ) then
    alter table public.vip_memberships
      add constraint vip_memberships_assigned_by_fkey
      foreign key (assigned_by) references auth.users(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_settings_updated_by_fkey'
      and conrelid = 'public.platform_settings'::regclass
  ) then
    alter table public.platform_settings
      add constraint platform_settings_updated_by_fkey
      foreign key (updated_by) references auth.users(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'kyc_submissions_status_check'
      and conrelid = 'public.kyc_submissions'::regclass
  ) then
    alter table public.kyc_submissions
      add constraint kyc_submissions_status_check
      check (status in ('pending', 'approved', 'rejected', 'under_review'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'kyc_submissions_document_type_check'
      and conrelid = 'public.kyc_submissions'::regclass
  ) then
    alter table public.kyc_submissions
      add constraint kyc_submissions_document_type_check
      check (document_type in ('passport', 'license', 'id'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'verification_questions_status_check'
      and conrelid = 'public.verification_questions'::regclass
  ) then
    alter table public.verification_questions
      add constraint verification_questions_status_check
      check (status in ('pending', 'answered'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_messages_status_check'
      and conrelid = 'public.support_messages'::regclass
  ) then
    alter table public.support_messages
      add constraint support_messages_status_check
      check (status in ('pending', 'replied', 'closed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_messages_message_check'
      and conrelid = 'public.support_messages'::regclass
  ) then
    alter table public.support_messages
      add constraint support_messages_message_check
      check (nullif(btrim(message), '') is not null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_messages_sender_type_check'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
      add constraint chat_messages_sender_type_check
      check (sender_type in ('user', 'admin', 'bot'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_messages_message_check'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
      add constraint chat_messages_message_check
      check (nullif(btrim(message), '') is not null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'wallet_balances_symbol_check'
      and conrelid = 'public.wallet_balances'::regclass
  ) then
    alter table public.wallet_balances
      add constraint wallet_balances_symbol_check
      check (symbol = upper(symbol) and char_length(symbol) between 2 and 15);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'wallet_balances_balance_check'
      and conrelid = 'public.wallet_balances'::regclass
  ) then
    alter table public.wallet_balances
      add constraint wallet_balances_balance_check
      check (balance >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_type_check'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_type_check
      check (type in ('buy', 'sell', 'exchange', 'withdraw', 'deposit'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_status_check'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_status_check
      check (status in ('pending', 'completed', 'failed', 'cancelled'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_amount_check'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_amount_check
      check (amount > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_price_check'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_price_check
      check (price is null or price >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_total_value_check'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_total_value_check
      check (total_value is null or total_value >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vip_memberships_package_name_check'
      and conrelid = 'public.vip_memberships'::regclass
  ) then
    alter table public.vip_memberships
      add constraint vip_memberships_package_name_check
      check (nullif(btrim(package_name), '') is not null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vip_memberships_deposit_amount_check'
      and conrelid = 'public.vip_memberships'::regclass
  ) then
    alter table public.vip_memberships
      add constraint vip_memberships_deposit_amount_check
      check (deposit_amount >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vip_memberships_bonus_amount_check'
      and conrelid = 'public.vip_memberships'::regclass
  ) then
    alter table public.vip_memberships
      add constraint vip_memberships_bonus_amount_check
      check (bonus_amount >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vip_memberships_status_check'
      and conrelid = 'public.vip_memberships'::regclass
  ) then
    alter table public.vip_memberships
      add constraint vip_memberships_status_check
      check (status in ('active', 'inactive', 'expired', 'cancelled'));
  end if;
end
$$;

create index if not exists idx_user_roles_user_id
  on public.user_roles (user_id);

create index if not exists idx_profiles_user_id
  on public.profiles (user_id);

create index if not exists idx_kyc_submissions_user_id
  on public.kyc_submissions (user_id);

create index if not exists idx_kyc_submissions_status
  on public.kyc_submissions (status);

create index if not exists idx_kyc_submissions_submitted_at
  on public.kyc_submissions (submitted_at desc);

create index if not exists idx_verification_questions_user_id
  on public.verification_questions (user_id);

create index if not exists idx_verification_questions_status
  on public.verification_questions (status);

create index if not exists idx_support_messages_user_id
  on public.support_messages (user_id);

create index if not exists idx_support_messages_status
  on public.support_messages (status);

create index if not exists idx_chat_messages_user_session_created
  on public.chat_messages (user_id, session_id, created_at);

create index if not exists idx_chat_messages_session_created
  on public.chat_messages (session_id, created_at);

create index if not exists idx_wallet_balances_user_id
  on public.wallet_balances (user_id);

create index if not exists idx_transactions_user_id
  on public.transactions (user_id);

create index if not exists idx_transactions_status
  on public.transactions (status);

create index if not exists idx_transactions_type
  on public.transactions (type);

create index if not exists idx_user_sessions_user_id
  on public.user_sessions (user_id);

create index if not exists idx_user_sessions_last_active
  on public.user_sessions (last_active_at desc);

create index if not exists idx_push_subscriptions_user_id
  on public.push_subscriptions (user_id);

create index if not exists idx_vip_memberships_status
  on public.vip_memberships (status);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_is_admin boolean := false;
begin
  if caller_id is null then
    return false;
  end if;

  select exists (
    select 1
    from public.user_roles
    where user_id = caller_id
      and role = 'admin'::public.app_role
  )
  into caller_is_admin;

  if caller_id <> _user_id and not caller_is_admin then
    return false;
  end if;

  return exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
end;
$$;

create or replace function public.get_user_role(user_id uuid)
returns public.app_role
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_is_admin boolean := false;
  resolved_role public.app_role;
begin
  if caller_id is null then
    return null;
  end if;

  select exists (
    select 1
    from public.user_roles
    where user_id = caller_id
      and role = 'admin'::public.app_role
  )
  into caller_is_admin;

  if caller_id <> user_id and not caller_is_admin then
    return null;
  end if;

  select role
  into resolved_role
  from public.user_roles
  where public.user_roles.user_id = get_user_role.user_id
  order by case when role = 'admin'::public.app_role then 0 else 1 end
  limit 1;

  return resolved_role;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, first_name, last_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  )
  on conflict (user_id) do update
    set first_name = coalesce(excluded.first_name, public.profiles.first_name),
        last_name = coalesce(excluded.last_name, public.profiles.last_name);

  delete from public.user_roles where user_id = new.id;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user');

  return new;
end;
$$;

create or replace function public.make_user_admin(user_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  select id
  into target_user_id
  from auth.users
  where lower(email) = lower(user_email)
  limit 1;

  if target_user_id is null then
    raise exception 'User % not found', user_email;
  end if;

  delete from public.user_roles where user_id = target_user_id;

  insert into public.user_roles (user_id, role)
  values (target_user_id, 'admin');
end;
$$;

create or replace function public.sync_verification_question_answer_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if nullif(btrim(coalesce(new.answer, '')), '') is not null then
    new.answer = btrim(new.answer);
    new.status = 'answered';
    new.answered_at = coalesce(new.answered_at, now());
  else
    new.answer = null;
    new.status = 'pending';
    new.answered_at = null;
  end if;

  return new;
end;
$$;

create or replace function public.sync_support_message_reply_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if nullif(btrim(coalesce(new.admin_reply, '')), '') is not null then
    new.admin_reply = btrim(new.admin_reply);
    if coalesce(new.status, 'pending') = 'pending' then
      new.status = 'replied';
    end if;
    new.replied_at = coalesce(new.replied_at, now());
  else
    new.admin_reply = null;
    if old.admin_reply is not null and new.status = 'replied' then
      new.status = 'pending';
      new.replied_at = null;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.sync_profile_verified_from_kyc()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_user_id uuid;
  is_verified boolean;
begin
  if tg_op = 'DELETE' then
    target_user_id := old.user_id;
  else
    target_user_id := new.user_id;
  end if;

  select exists (
    select 1
    from public.kyc_submissions
    where user_id = target_user_id
      and status = 'approved'
  )
  into is_verified;

  update public.profiles
  set verified = is_verified,
      updated_at = now()
  where user_id = target_user_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
before update on public.profiles
for each row
execute function public.update_updated_at_column();

drop trigger if exists trg_wallet_balances_updated on public.wallet_balances;
create trigger trg_wallet_balances_updated
before update on public.wallet_balances
for each row
execute function public.update_updated_at_column();

drop trigger if exists trg_transactions_updated on public.transactions;
create trigger trg_transactions_updated
before update on public.transactions
for each row
execute function public.update_updated_at_column();

drop trigger if exists trg_vip_memberships_updated on public.vip_memberships;
create trigger trg_vip_memberships_updated
before update on public.vip_memberships
for each row
execute function public.update_updated_at_column();

drop trigger if exists trg_platform_settings_updated on public.platform_settings;
create trigger trg_platform_settings_updated
before update on public.platform_settings
for each row
execute function public.update_updated_at_column();

drop trigger if exists trg_verification_questions_sync on public.verification_questions;
create trigger trg_verification_questions_sync
before insert or update on public.verification_questions
for each row
execute function public.sync_verification_question_answer_fields();

drop trigger if exists trg_support_messages_sync on public.support_messages;
create trigger trg_support_messages_sync
before update on public.support_messages
for each row
execute function public.sync_support_message_reply_fields();

drop trigger if exists trg_kyc_profile_verified on public.kyc_submissions;
create trigger trg_kyc_profile_verified
after insert or update or delete on public.kyc_submissions
for each row
execute function public.sync_profile_verified_from_kyc();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.user_roles enable row level security;
alter table public.platform_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.kyc_submissions enable row level security;
alter table public.verification_questions enable row level security;
alter table public.support_messages enable row level security;
alter table public.chat_messages enable row level security;
alter table public.wallet_balances enable row level security;
alter table public.transactions enable row level security;
alter table public.user_sessions enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.vip_memberships enable row level security;

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own
on public.user_roles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists user_roles_admin_select_all on public.user_roles;
create policy user_roles_admin_select_all
on public.user_roles
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists user_roles_admin_insert on public.user_roles;
create policy user_roles_admin_insert
on public.user_roles
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists user_roles_admin_update on public.user_roles;
create policy user_roles_admin_update
on public.user_roles
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists user_roles_admin_delete on public.user_roles;
create policy user_roles_admin_delete
on public.user_roles
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all
on public.profiles
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists kyc_select_own on public.kyc_submissions;
create policy kyc_select_own
on public.kyc_submissions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists kyc_insert_own on public.kyc_submissions;
create policy kyc_insert_own
on public.kyc_submissions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists kyc_admin_all on public.kyc_submissions;
create policy kyc_admin_all
on public.kyc_submissions
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists verification_questions_select_own on public.verification_questions;
create policy verification_questions_select_own
on public.verification_questions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists verification_questions_update_own on public.verification_questions;
create policy verification_questions_update_own
on public.verification_questions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists verification_questions_admin_all on public.verification_questions;
create policy verification_questions_admin_all
on public.verification_questions
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists support_messages_insert_own on public.support_messages;
create policy support_messages_insert_own
on public.support_messages
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists support_messages_select_own on public.support_messages;
create policy support_messages_select_own
on public.support_messages
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists support_messages_admin_all on public.support_messages;
create policy support_messages_admin_all
on public.support_messages
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists chat_messages_select_own on public.chat_messages;
create policy chat_messages_select_own
on public.chat_messages
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists chat_messages_insert_own on public.chat_messages;
create policy chat_messages_insert_own
on public.chat_messages
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists chat_messages_update_own_user_only on public.chat_messages;
create policy chat_messages_update_own_user_only
on public.chat_messages
for update
to authenticated
using (auth.uid() = user_id and sender_type = 'user')
with check (auth.uid() = user_id and sender_type = 'user');

drop policy if exists chat_messages_delete_own_user_only on public.chat_messages;
create policy chat_messages_delete_own_user_only
on public.chat_messages
for delete
to authenticated
using (auth.uid() = user_id and sender_type = 'user');

drop policy if exists chat_messages_admin_all on public.chat_messages;
create policy chat_messages_admin_all
on public.chat_messages
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists wallet_balances_select_own on public.wallet_balances;
create policy wallet_balances_select_own
on public.wallet_balances
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists wallet_balances_insert_own on public.wallet_balances;
create policy wallet_balances_insert_own
on public.wallet_balances
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists wallet_balances_update_own on public.wallet_balances;
create policy wallet_balances_update_own
on public.wallet_balances
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists wallet_balances_admin_all on public.wallet_balances;
create policy wallet_balances_admin_all
on public.wallet_balances
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists transactions_select_own on public.transactions;
create policy transactions_select_own
on public.transactions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists transactions_insert_own on public.transactions;
create policy transactions_insert_own
on public.transactions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists transactions_admin_all on public.transactions;
create policy transactions_admin_all
on public.transactions
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists user_sessions_select_own on public.user_sessions;
create policy user_sessions_select_own
on public.user_sessions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists user_sessions_insert_own on public.user_sessions;
create policy user_sessions_insert_own
on public.user_sessions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists user_sessions_update_own on public.user_sessions;
create policy user_sessions_update_own
on public.user_sessions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists user_sessions_admin_all on public.user_sessions;
create policy user_sessions_admin_all
on public.user_sessions
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists push_subscriptions_manage_own on public.push_subscriptions;
create policy push_subscriptions_manage_own
on public.push_subscriptions
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists push_subscriptions_admin_select on public.push_subscriptions;
create policy push_subscriptions_admin_select
on public.push_subscriptions
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists vip_memberships_select_own on public.vip_memberships;
create policy vip_memberships_select_own
on public.vip_memberships
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists vip_memberships_admin_all on public.vip_memberships;
create policy vip_memberships_admin_all
on public.vip_memberships
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists platform_settings_select_all on public.platform_settings;
create policy platform_settings_select_all
on public.platform_settings
for select
using (true);

drop policy if exists platform_settings_admin_insert on public.platform_settings;
create policy platform_settings_admin_insert
on public.platform_settings
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists platform_settings_admin_update on public.platform_settings;
create policy platform_settings_admin_update
on public.platform_settings
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists platform_settings_admin_delete on public.platform_settings;
create policy platform_settings_admin_delete
on public.platform_settings
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-documents',
  'kyc-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists storage_kyc_docs_user_insert on storage.objects;
create policy storage_kyc_docs_user_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'kyc-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists storage_kyc_docs_user_select on storage.objects;
create policy storage_kyc_docs_user_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'kyc-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists storage_kyc_docs_admin_select on storage.objects;
create policy storage_kyc_docs_admin_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'kyc-documents'
  and public.has_role(auth.uid(), 'admin')
);

alter table public.profiles replica identity full;
alter table public.kyc_submissions replica identity full;
alter table public.support_messages replica identity full;
alter table public.chat_messages replica identity full;
alter table public.wallet_balances replica identity full;
alter table public.transactions replica identity full;
alter table public.user_sessions replica identity full;
alter table public.vip_memberships replica identity full;
alter table public.platform_settings replica identity full;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication p
      join pg_publication_rel pr on pr.prpubid = p.oid
      where p.pubname = 'supabase_realtime'
        and pr.prrelid = 'public.profiles'::regclass
    ) then
      alter publication supabase_realtime add table public.profiles;
    end if;

    if not exists (
      select 1
      from pg_publication p
      join pg_publication_rel pr on pr.prpubid = p.oid
      where p.pubname = 'supabase_realtime'
        and pr.prrelid = 'public.kyc_submissions'::regclass
    ) then
      alter publication supabase_realtime add table public.kyc_submissions;
    end if;

    if not exists (
      select 1
      from pg_publication p
      join pg_publication_rel pr on pr.prpubid = p.oid
      where p.pubname = 'supabase_realtime'
        and pr.prrelid = 'public.support_messages'::regclass
    ) then
      alter publication supabase_realtime add table public.support_messages;
    end if;

    if not exists (
      select 1
      from pg_publication p
      join pg_publication_rel pr on pr.prpubid = p.oid
      where p.pubname = 'supabase_realtime'
        and pr.prrelid = 'public.chat_messages'::regclass
    ) then
      alter publication supabase_realtime add table public.chat_messages;
    end if;

    if not exists (
      select 1
      from pg_publication p
      join pg_publication_rel pr on pr.prpubid = p.oid
      where p.pubname = 'supabase_realtime'
        and pr.prrelid = 'public.wallet_balances'::regclass
    ) then
      alter publication supabase_realtime add table public.wallet_balances;
    end if;

    if not exists (
      select 1
      from pg_publication p
      join pg_publication_rel pr on pr.prpubid = p.oid
      where p.pubname = 'supabase_realtime'
        and pr.prrelid = 'public.transactions'::regclass
    ) then
      alter publication supabase_realtime add table public.transactions;
    end if;

    if not exists (
      select 1
      from pg_publication p
      join pg_publication_rel pr on pr.prpubid = p.oid
      where p.pubname = 'supabase_realtime'
        and pr.prrelid = 'public.user_sessions'::regclass
    ) then
      alter publication supabase_realtime add table public.user_sessions;
    end if;

    if not exists (
      select 1
      from pg_publication p
      join pg_publication_rel pr on pr.prpubid = p.oid
      where p.pubname = 'supabase_realtime'
        and pr.prrelid = 'public.vip_memberships'::regclass
    ) then
      alter publication supabase_realtime add table public.vip_memberships;
    end if;

    if not exists (
      select 1
      from pg_publication p
      join pg_publication_rel pr on pr.prpubid = p.oid
      where p.pubname = 'supabase_realtime'
        and pr.prrelid = 'public.platform_settings'::regclass
    ) then
      alter publication supabase_realtime add table public.platform_settings;
    end if;
  end if;
end
$$;

insert into public.platform_settings (key, value)
values
  ('min_trading_balance_usd', '500'::jsonb),
  ('wallet_address_btc', '"bc1q56qxqrchf20qra4a0962fg7fqm54rvp9r7xhrl"'::jsonb),
  ('wallet_address_eth', '"0xc2930d27a31cB1C25Cd6Bd96F858f0190CFdA5cB"'::jsonb),
  ('wallet_address_usdt', '"0xc2930d27a31cB1C25Cd6Bd96F858f0190CFdA5cB"'::jsonb),
  ('wallet_address_usdc', '"0xc2930d27a31cB1C25Cd6Bd96F858f0190CFdA5cB"'::jsonb)
on conflict (key) do nothing;

revoke execute on function public.update_updated_at_column() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.make_user_admin(text) from public, anon, authenticated;
revoke execute on function public.sync_verification_question_answer_fields() from public, anon, authenticated;
revoke execute on function public.sync_support_message_reply_fields() from public, anon, authenticated;
revoke execute on function public.sync_profile_verified_from_kyc() from public, anon, authenticated;
revoke execute on function public.get_user_role(uuid) from public, anon;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.get_user_role(uuid) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
