DELETE FROM public.group_matching_groups g
WHERE NOT EXISTS (SELECT 1 FROM public.group_matching_members m WHERE m.group_id = g.id);