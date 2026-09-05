ALTER TABLE public.music_tracks
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

ALTER TABLE public.music_tracks
  ADD CONSTRAINT music_tracks_duration_check
  CHECK (duration_seconds IS NULL OR (duration_seconds > 0 AND duration_seconds <= 86400));

CREATE INDEX IF NOT EXISTS music_tracks_sort_idx ON public.music_tracks (sort_order, created_at DESC);