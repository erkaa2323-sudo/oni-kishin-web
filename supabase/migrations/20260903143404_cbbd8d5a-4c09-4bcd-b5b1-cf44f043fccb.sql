-- helpers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- roles enum
CREATE TYPE public.app_role AS ENUM ('owner','admin','moderator');

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- any staff role (owner/admin/moderator)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;

-- write-capable staff (owner/admin)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner','admin'));
$$;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "user_roles_select_own_or_staff" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "user_roles_owner_manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'display_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- members
CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpm_nickname text NOT NULL,
  cpm_id text NOT NULL CHECK (char_length(cpm_id) <= 40),
  role text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT ON public.members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_public_read_active" ON public.members FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "members_staff_read" ON public.members FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "members_admin_write" ON public.members FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX members_status_idx ON public.members(status);
CREATE TRIGGER members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- garage
CREATE TABLE public.garage_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model text NOT NULL,
  owner_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  owner_name text,
  category text,
  build text,
  image_path text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('published','draft','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT ON public.garage_vehicles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_vehicles TO authenticated;
GRANT ALL ON public.garage_vehicles TO service_role;
ALTER TABLE public.garage_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "garage_public_read_published" ON public.garage_vehicles FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "garage_staff_read" ON public.garage_vehicles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "garage_admin_write" ON public.garage_vehicles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX garage_status_idx ON public.garage_vehicles(status);
CREATE TRIGGER garage_updated_at BEFORE UPDATE ON public.garage_vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- music
CREATE TABLE public.music_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text,
  source_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('published','draft')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT ON public.music_tracks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.music_tracks TO authenticated;
GRANT ALL ON public.music_tracks TO service_role;
ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "music_public_read_published" ON public.music_tracks FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "music_staff_read" ON public.music_tracks FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "music_admin_write" ON public.music_tracks FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER music_updated_at BEFORE UPDATE ON public.music_tracks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- applications (submit-only for public)
CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpm_nickname text NOT NULL CHECK (char_length(cpm_nickname) BETWEEN 2 AND 40),
  cpm_id text NOT NULL CHECK (char_length(cpm_id) BETWEEN 1 AND 40),
  contact text NOT NULL CHECK (char_length(contact) BETWEEN 3 AND 200),
  message text CHECK (message IS NULL OR char_length(message) <= 1000),
  experience text CHECK (experience IS NULL OR char_length(experience) <= 200),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','accepted','rejected')),
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.applications TO anon;
GRANT INSERT, SELECT, UPDATE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "applications_public_submit" ON public.applications FOR INSERT TO anon, authenticated WITH CHECK (state = 'pending' AND reviewed_by IS NULL);
CREATE POLICY "applications_staff_read" ON public.applications FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "applications_staff_review" ON public.applications FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX applications_state_idx ON public.applications(state);
CREATE TRIGGER applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- meets
CREATE TABLE public.meets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  scheduled_at timestamptz,
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','live','ended','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT ON public.meets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meets TO authenticated;
GRANT ALL ON public.meets TO service_role;
ALTER TABLE public.meets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meets_public_read_live" ON public.meets FOR SELECT TO anon, authenticated USING (status IN ('scheduled','live'));
CREATE POLICY "meets_staff_read" ON public.meets FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "meets_admin_write" ON public.meets FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER meets_updated_at BEFORE UPDATE ON public.meets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- meet credentials (admins only, never public)
CREATE TABLE public.meet_credentials (
  meet_id uuid PRIMARY KEY REFERENCES public.meets(id) ON DELETE CASCADE,
  room_id text NOT NULL,
  room_password text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meet_credentials TO authenticated;
GRANT ALL ON public.meet_credentials TO service_role;
ALTER TABLE public.meet_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meet_credentials_admin_all" ON public.meet_credentials FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER meet_credentials_updated_at BEFORE UPDATE ON public.meet_credentials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- meet registrations (staff only)
CREATE TABLE public.meet_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meet_id uuid NOT NULL REFERENCES public.meets(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  cpm_nickname text NOT NULL,
  cpm_id text NOT NULL CHECK (char_length(cpm_id) <= 40),
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meet_registrations TO authenticated;
GRANT ALL ON public.meet_registrations TO service_role;
ALTER TABLE public.meet_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meet_registrations_staff_read" ON public.meet_registrations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "meet_registrations_admin_write" ON public.meet_registrations FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX meet_registrations_meet_idx ON public.meet_registrations(meet_id);
CREATE TRIGGER meet_registrations_updated_at BEFORE UPDATE ON public.meet_registrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ai config (staff only)
CREATE TABLE public.ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  prompt text,
  knowledge text,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_config TO authenticated;
GRANT ALL ON public.ai_config TO service_role;
ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_config_staff_read" ON public.ai_config FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "ai_config_admin_write" ON public.ai_config FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER ai_config_updated_at BEFORE UPDATE ON public.ai_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- audit logs (append-only)
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action text NOT NULL,
  target text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  result text NOT NULL DEFAULT 'success' CHECK (result IN ('success','failure','denied')),
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_staff_read" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "audit_staff_append" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND actor_id = auth.uid());
CREATE INDEX audit_created_idx ON public.audit_logs(created_at DESC);