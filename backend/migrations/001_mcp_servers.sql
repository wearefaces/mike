-- Run this in Supabase SQL editor.
create table if not exists public.user_mcp_servers (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  url text not null,
  auth_token text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_mcp_servers_user
  on public.user_mcp_servers(user_id);
