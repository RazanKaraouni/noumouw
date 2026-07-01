-- Seed emotional well-being parenting tips (CDC age bands).
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
  'emotional_wellbeing',
  v.age_range,
  'therapist',
  '29b58be6-3347-4820-b759-5a156fd78d62'::uuid,
  'approved',
  now()
FROM (
  VALUES
    (
      'Intentional Eye Contact for Co-Regulation',
      'Cradle your baby about 8 to 12 inches from your face and look directly into their eyes while speaking softly or smiling. This simple tracking build secure emotional attachments and teaches early emotional regulation.',
      'by 2 Months'
    ),
    (
      'Mirroring Emotional Expressions',
      'Pay close attention to your baby''s facial expressions and mirror them back playfully. When they smile, smile back big; if they look surprised, open your eyes wide. This validates their early expressions and builds self-awareness.',
      'by 4 Months'
    ),
    (
      'Responding Predictably to Emotional Distress',
      'Comfort your baby promptly when they cry or show frustration. Knowing that their emotional expressions bring a predictable, comforting caregiver builds a secure internal foundation of safety and resilience.',
      'by 6 Months'
    ),
    (
      'Managing Separation Distress Predictably',
      'Always use a short, happy goodbye routine (like a consistent phrase and a wave) instead of sneaking away when leaving your child. This builds deep relational trust and reduces anxiety over transitions.',
      'by 9 Months'
    ),
    (
      'Encouraging Object-Assisted Comfort',
      'Allow your child to use a specific soft blanket, stuffed animal, or transitional object during stressful transitions or sleep times. These objects provide a safe anchor for early self-soothing behaviors.',
      'by 12 Months'
    ),
    (
      'Identifying and Labeling Basic Emotions',
      'When your toddler shows a clear feeling, point it out explicitly to help them build their vocabulary. Say things like, "You are smiling! You feel happy," or "You are crying, you feel sad."',
      'by 18 Months'
    ),
    (
      'Validating Feelings Before Setting Boundaries',
      'Acknowledge your child''s emotional frustration before enforcing a rule. For example, tell them, "I see you are angry that we have to leave the park, but it is time to go home safely now."',
      'by 2 Years'
    ),
    (
      'Providing Simple Choices to Reduce Power Struggles',
      'Offer two acceptable choices to give your toddler a sense of personal autonomy and control. Letting them choose between two shirts or two healthy snacks significantly limits emotional defiance and meltdowns.',
      'by 30 Months'
    ),
    (
      'Using a Designated "Calm-Down" Space',
      'Set up a cozy corner with pillows and soft books where your child can go voluntarily to rest when their emotions feel too big, rather than treating isolation like a harsh punishment.',
      'by 3 Years'
    ),
    (
      'Teaching Slow, Regulated Deep Breathing',
      'Teach your child to take deep belly breaths when they feel tense or upset by prompting them to pretend to "smell a beautiful flower" and then "blow out a birthday candle."',
      'by 4 Years'
    ),
    (
      'Fostering Peer Empathy through Reflection',
      'Encourage your child to consider the perspectives of others during playtime conflicts or while reading stories. Ask them questions like, "Look at your friend''s face; how do you think they feel right now?"',
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
WHERE category = 'emotional_wellbeing'
ORDER BY
  CASE age_range
    WHEN 'by 2 Months' THEN 1
    WHEN 'by 4 Months' THEN 2
    WHEN 'by 6 Months' THEN 3
    WHEN 'by 9 Months' THEN 4
    WHEN 'by 12 Months' THEN 5
    WHEN 'by 18 Months' THEN 6
    WHEN 'by 2 Years' THEN 7
    WHEN 'by 30 Months' THEN 8
    WHEN 'by 3 Years' THEN 9
    WHEN 'by 4 Years' THEN 10
    WHEN 'by 5 Years' THEN 11
    ELSE 99
  END;
