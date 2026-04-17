-- Checkpoint 6: eater_ratings table for D43 private per-eater dish ratings
-- Tom: run this in Supabase SQL Editor before CC starts the screen build.
-- Verify by running: SELECT count(*) FROM eater_ratings;  -- should return 0.

CREATE TABLE IF NOT EXISTS eater_ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  rater_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (post_id, rater_user_id)
);

-- Index for the primary query pattern: "get all ratings for dishes in a meal event"
CREATE INDEX IF NOT EXISTS idx_eater_ratings_post_id ON eater_ratings (post_id);

-- Index for "get all ratings by a specific user" (useful for profile/stats)
CREATE INDEX IF NOT EXISTS idx_eater_ratings_rater ON eater_ratings (rater_user_id);

-- RLS policies for D43 visibility: rating visible only to the rater themselves
-- and to the cook (post author). Other users cannot see eater ratings.
ALTER TABLE eater_ratings ENABLE ROW LEVEL SECURITY;

-- Policy: users can read their own ratings
CREATE POLICY "Users can read own ratings"
  ON eater_ratings FOR SELECT
  USING (rater_user_id = auth.uid());

-- Policy: users can read ratings on their own posts (the cook sees who rated their dish)
CREATE POLICY "Post authors can read ratings on their posts"
  ON eater_ratings FOR SELECT
  USING (
    post_id IN (
      SELECT id FROM posts WHERE user_id = auth.uid()
    )
  );

-- Policy: users can insert their own ratings
CREATE POLICY "Users can insert own ratings"
  ON eater_ratings FOR INSERT
  WITH CHECK (rater_user_id = auth.uid());

-- Policy: users can update their own ratings
CREATE POLICY "Users can update own ratings"
  ON eater_ratings FOR UPDATE
  USING (rater_user_id = auth.uid())
  WITH CHECK (rater_user_id = auth.uid());

-- Policy: users can delete their own ratings
CREATE POLICY "Users can delete own ratings"
  ON eater_ratings FOR DELETE
  USING (rater_user_id = auth.uid());
