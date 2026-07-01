-- Store parent date of birth from signup (age column may still be populated for legacy reads).
ALTER TABLE public.parents
  ADD COLUMN IF NOT EXISTS date_of_birth date;
