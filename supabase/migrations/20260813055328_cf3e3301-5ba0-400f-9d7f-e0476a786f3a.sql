CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  plan text NOT NULL,
  amount_kes integer NOT NULL,
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  mpesa_receipt text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user_idx ON public.subscriptions (user_id, expires_at DESC);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.mpesa_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  plan text NOT NULL,
  amount_kes integer NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  checkout_request_id text,
  merchant_request_id text,
  mpesa_receipt text,
  result_desc text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mpesa_payments_checkout_idx ON public.mpesa_payments (checkout_request_id);
GRANT SELECT ON public.mpesa_payments TO authenticated;
GRANT ALL ON public.mpesa_payments TO service_role;
ALTER TABLE public.mpesa_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mpesa_payments_select_own" ON public.mpesa_payments FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.prediction_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id bigint NOT NULL,
  competition_code text NOT NULL,
  kickoff timestamptz NOT NULL,
  home_team text NOT NULL,
  away_team text NOT NULL,
  market text NOT NULL,
  pick text NOT NULL,
  probability numeric NOT NULL,
  expected_home_goals numeric,
  expected_away_goals numeric,
  status text NOT NULL DEFAULT 'pending',
  actual_home integer,
  actual_away integer,
  correct boolean,
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fixture_id, market)
);
CREATE INDEX prediction_log_kickoff_idx ON public.prediction_log (kickoff DESC);
GRANT SELECT ON public.prediction_log TO anon;
GRANT SELECT ON public.prediction_log TO authenticated;
GRANT ALL ON public.prediction_log TO service_role;
ALTER TABLE public.prediction_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prediction_log_public_read" ON public.prediction_log FOR SELECT TO anon, authenticated USING (true);