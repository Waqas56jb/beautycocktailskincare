-- Allow 'sms' as a conversation channel (missed-call text-back + two-way SMS bot).
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query → Run).
-- Safe to run more than once.

alter table conversations drop constraint if exists conversations_channel_check;
alter table conversations
  add constraint conversations_channel_check
  check (channel in ('website','instagram','whatsapp','facebook','sms'));
