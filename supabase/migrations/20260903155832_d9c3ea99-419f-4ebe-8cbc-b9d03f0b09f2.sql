CREATE UNIQUE INDEX IF NOT EXISTS user_roles_single_owner_idx
  ON public.user_roles ((role)) WHERE role = 'owner'::app_role;

CREATE OR REPLACE FUNCTION public.owner_exists()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.claim_first_owner()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN 'unauthenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner'::app_role) THEN
    RETURN 'already_bootstrapped';
  END IF;

  BEGIN
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'owner'::app_role);
  EXCEPTION WHEN unique_violation THEN
    RETURN 'already_bootstrapped';
  END;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target, severity, result, detail)
  VALUES (_uid, 'owner', 'bootstrap.first_owner', 'user_roles', 'critical', 'success',
          'First owner role granted through one-time bootstrap.');

  RETURN 'granted';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_first_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_exists() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_owner() TO authenticated;