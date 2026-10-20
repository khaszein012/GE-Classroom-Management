-- Pin search_path on the redemptions_set_decided_at trigger function (advisor finding).
CREATE OR REPLACE FUNCTION public.redemptions_set_decided_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'pending' AND NEW.decided_at IS NULL THEN
    NEW.decided_at := now();
  END IF;
  RETURN NEW;
END;
$$;