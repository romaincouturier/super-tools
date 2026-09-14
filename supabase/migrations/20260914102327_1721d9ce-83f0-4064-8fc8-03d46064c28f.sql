UPDATE public.order_items
SET game_type = 'formation',
    updated_at = now()
WHERE game_type IS NULL
  AND block_reason LIKE '[Formation]%';