-- XWhiz Lite — initial schema (mirrors prisma/schema.prisma)
-- Run in Supabase SQL editor or via `supabase db push`.

create extension if not exists "uuid-ossp";

create table if not exists "User" (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  name text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

-- drop legacy premium/billing columns if present
alter table "User" drop column if exists "stripeCustomerId";
alter table "User" drop column if exists "stripeSubscriptionId";
alter table "User" drop column if exists "subscriptionTier";
drop type if exists subscription_tier;

create table if not exists "WatchlistItem" (
  id uuid primary key default uuid_generate_v4(),
  "userId" uuid not null references "User"(id) on delete cascade,
  "matchId" text not null,
  "createdAt" timestamptz not null default now(),
  unique ("userId", "matchId")
);
create index if not exists watchlist_user_idx on "WatchlistItem"("userId");

create table if not exists "NewsletterSubscriber" (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  "createdAt" timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────
alter table "WatchlistItem" enable row level security;
alter table "NewsletterSubscriber" enable row level security;

drop policy if exists "watchlist_owner_all" on "WatchlistItem";
create policy "watchlist_owner_all" on "WatchlistItem"
  for all using (auth.uid()::text = "userId") with check (auth.uid()::text = "userId");

drop policy if exists "newsletter_public_insert" on "NewsletterSubscriber";
create policy "newsletter_public_insert" on "NewsletterSubscriber"
  for insert with check (true);
