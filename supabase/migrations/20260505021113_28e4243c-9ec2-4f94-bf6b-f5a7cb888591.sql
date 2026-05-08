INSERT INTO public.platform_settings (key, value) VALUES
  ('wallet_address_btc',  '"bc1q56qxqrchf20qra4a0962fg7fqm54rvp9r7xhrl"'::jsonb),
  ('wallet_address_eth',  '"0xc2930d27a31cB1C25Cd6Bd96F858f0190CFdA5cB"'::jsonb),
  ('wallet_address_usdt', '"0xc2930d27a31cB1C25Cd6Bd96F858f0190CFdA5cB"'::jsonb),
  ('wallet_address_usdc', '"0xc2930d27a31cB1C25Cd6Bd96F858f0190CFdA5cB"'::jsonb)
ON CONFLICT (key) DO NOTHING;