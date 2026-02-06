-- Extend the module enum in user_module_access to include new modules
-- Check if the column uses an enum type, and if so, add new values

DO $$
BEGIN
  -- Try adding new enum values (will silently fail if they already exist)
  BEGIN ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'crm'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'missions'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'okr'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'medias'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'events'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'emails'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'statistiques'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'monitoring'; EXCEPTION WHEN others THEN NULL; END;
END
$$;
