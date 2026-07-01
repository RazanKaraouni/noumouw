-- Seed child development parenting tips (CDC age bands).
-- Run in Supabase SQL editor after parenting_tips exists and
-- parenting_tips_category_check.sql has been applied.
--
-- submitted_by: Razan's auth.users id (change if inserting for another therapist).

INSERT INTO public.parenting_tips (
  title,
  content,
  category,
  age_range,
  submitted_by_role,
  submitted_by,
  status,
  approved_at
)
SELECT
  v.title,
  v.content,
  'child_development',
  v.age_range,
  'therapist',
  '29b58be6-3347-4820-b759-5a156fd78d62'::uuid,
  'approved',
  now()
FROM (
  VALUES
    (
      'Introducing Functional Mimicry Play',
      'Incorporate your toddler into simple daily chores by giving them a toy broom, a small rag, or plastic bowls. Imitating adult routines develops functional cognitive reasoning.',
      'by 18 Months'
    ),
    (
      'Building Independent Spatial Bilateral Control',
      'Give your child large plastic pegs to push into a pegboard, or chunky blocks to connect. Using both hands asymmetrically to stabilize and build builds complex motor networks.',
      'by 2 Years'
    ),
    (
      'Expanding Sensory-Motor Grading Skills',
      'Practice stamping feet like a heavy elephant and creeping quietly like a small mouse. This dynamic play teaches the brain to grade force and regulate physical impact.',
      'by 30 Months'
    ),
    (
      'Developing Dynamic Balance and Hopping',
      'Draw chalk lines or place tape on the floor for your child to practice stepping directly over. This builds single-leg stabilization balance necessary for skipping later.',
      'by 3 Years'
    ),
    (
      'Fostering Finger Isolation and Pre-Writing Grip',
      'Encourage play with modeling clay, squeezing spray bottles, or cutting safety paper. Strengthening the small muscles of the hand directly refines a mature pencil grasp.',
      'by 4 Years'
    ),
    (
      'Encouraging Directional Midline Crossing',
      'Set up games like beanbag tosses where the child must reach completely across their body to grab an item on the left and throw it to the right without moving their feet.',
      'by 5 Years'
    )
) AS v(title, content, age_range)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.parenting_tips existing
  WHERE existing.title = v.title
    AND existing.age_range = v.age_range
);

-- Verify
SELECT tip_id, title, category, age_range, status, created_at
FROM public.parenting_tips
WHERE title IN (
  'Introducing Functional Mimicry Play',
  'Building Independent Spatial Bilateral Control',
  'Expanding Sensory-Motor Grading Skills',
  'Developing Dynamic Balance and Hopping',
  'Fostering Finger Isolation and Pre-Writing Grip',
  'Encouraging Directional Midline Crossing'
)
ORDER BY age_range;
