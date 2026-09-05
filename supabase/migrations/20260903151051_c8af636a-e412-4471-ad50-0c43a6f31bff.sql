ALTER TABLE public.meets ADD COLUMN IF NOT EXISTS registration_closes_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS meet_registrations_unique_cpm
  ON public.meet_registrations (meet_id, lower(cpm_id));

-- Public, credential-free view of the current meet.
CREATE OR REPLACE FUNCTION public.meet_public_active()
RETURNS TABLE (
  id uuid,
  title text,
  scheduled_at timestamptz,
  registration_closes_at timestamptz,
  capacity integer,
  status text,
  registered_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.title, m.scheduled_at, m.registration_closes_at, m.capacity, m.status,
         (SELECT count(*)::int FROM public.meet_registrations r WHERE r.meet_id = m.id)
  FROM public.meets m
  WHERE m.status IN ('scheduled','live')
  ORDER BY m.scheduled_at NULLS LAST, m.created_at
  LIMIT 1;
$$;

-- Safe participant list: nickname only, never cpm_id or credentials.
CREATE OR REPLACE FUNCTION public.meet_participants(_meet_id uuid)
RETURNS TABLE (cpm_nickname text, registered_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.cpm_nickname, r.created_at
  FROM public.meet_registrations r
  JOIN public.meets m ON m.id = r.meet_id
  WHERE r.meet_id = _meet_id
    AND m.status IN ('scheduled','live')
  ORDER BY r.created_at;
$$;

-- Registration with server-enforced deadline, capacity and duplicate rules.
CREATE OR REPLACE FUNCTION public.meet_register(_meet_id uuid, _cpm_nickname text, _cpm_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.meets%ROWTYPE;
  taken int;
  nick text := btrim(_cpm_nickname);
  cid text := btrim(_cpm_id);
BEGIN
  IF length(nick) < 2 OR length(nick) > 32 OR length(cid) < 1 OR length(cid) > 40 THEN
    RETURN 'invalid';
  END IF;

  SELECT * INTO m FROM public.meets WHERE id = _meet_id FOR UPDATE;
  IF NOT FOUND OR m.status NOT IN ('scheduled','live') THEN
    RETURN 'no_active_meet';
  END IF;

  IF m.registration_closes_at IS NOT NULL AND m.registration_closes_at <= now() THEN
    RETURN 'registration_closed';
  END IF;
  IF m.scheduled_at IS NOT NULL AND m.registration_closes_at IS NULL AND m.scheduled_at <= now() THEN
    RETURN 'registration_closed';
  END IF;

  IF EXISTS (SELECT 1 FROM public.meet_registrations r
             WHERE r.meet_id = _meet_id AND lower(r.cpm_id) = lower(cid)) THEN
    RETURN 'duplicate';
  END IF;

  SELECT count(*) INTO taken FROM public.meet_registrations r WHERE r.meet_id = _meet_id;
  IF m.capacity IS NOT NULL AND taken >= m.capacity THEN
    RETURN 'meet_full';
  END IF;

  INSERT INTO public.meet_registrations (meet_id, cpm_nickname, cpm_id, verified)
  VALUES (_meet_id, nick, cid, false);

  RETURN 'registered';
EXCEPTION WHEN unique_violation THEN
  RETURN 'duplicate';
END;
$$;

REVOKE ALL ON FUNCTION public.meet_public_active() FROM public;
REVOKE ALL ON FUNCTION public.meet_participants(uuid) FROM public;
REVOKE ALL ON FUNCTION public.meet_register(uuid, text, text) FROM public;

GRANT EXECUTE ON FUNCTION public.meet_public_active() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meet_participants(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meet_register(uuid, text, text) TO anon, authenticated;