-- Seed parent self-care parenting tips (CDC age bands).
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
  'parent_self_care',
  v.age_range,
  'therapist',
  '29b58be6-3347-4820-b759-5a156fd78d62'::uuid,
  'approved',
  now()
FROM (
  VALUES
    (
      'Embracing the "Good Enough" Parent Standard',
      'Lower your expectations regarding housekeeping and non-essential tasks during these intensive first weeks. Shifting your focus from perfection to basic functional survival helps protect your mental energy and lowers postpartum stress.',
      'by 2 Months'
    ),
    (
      'Securing Micro-Breaks During Waking Play',
      'Take advantage of short independent play windows. When your baby is safely content on a clean play mat or in a bassinet for 5 minutes, step away to drink a warm beverage or practice deep breathing, rather than instantly rushing to do chores.',
      'by 4 Months'
    ),
    (
      'Establishing an Evening Cleansing Transition',
      'Create a clear, distinct ritual that marks the end of your parenting shift once your child is asleep. Spending even 10 minutes offline reading, taking a quiet shower, or stretching helps transition your nervous system out of active caregiving mode.',
      'by 6 Months'
    ),
    (
      'Normalizing and Accepting Help Without Guilt',
      'Separation anxiety peaks in babies now, making parents feel trapped. Intentionally practice handing your child to a trusted partner, family member, or friend for short intervals to normalize being apart, protecting your own emotional health.',
      'by 9 Months'
    ),
    (
      'Reclaiming Physical Identity Beyond Caregiving',
      'Now that your child is settling into predictable routines, reintroduce one small hobby or physical activity that belongs completely to your pre-parent identity. Protecting your personal interests preserves a healthy sense of self.',
      'by 12 Months'
    ),
    (
      'Practicing Emotional Self-Check-Ins During Toddler Tantrums',
      'Toddler behavior can be highly triggering. When an emotional outburst happens, place a hand on your chest and take two deep breaths before reacting. Co-regulating your own nervous system first prevents secondary parental burnout.',
      'by 18 Months'
    ),
    (
      'Setting Firm Boundaries on Your Personal Space',
      'It is healthy to teach a 2-year-old that parents have physical boundaries. Use simple language when you need a moment: "My body needs some space right now. I am going to sit right here on the couch for a few minutes."',
      'by 2 Years'
    ),
    (
      'Rewriting the Narrative of Parental Self-Sacrifice',
      'Remind yourself regularly that self-care is an essential component of healthcare, not an act of selfishness. Meeting your own basic rest and emotional needs models healthy boundary-setting and emotional regulation for your toddler.',
      'by 30 Months'
    ),
    (
      'Planning True Rest Breaks Over Productive Breaks',
      'When your preschooler is engaged in independent play or preschool, resist the urge to spend every single minute cleaning or organizing. Intentionally schedule "unproductive" windows dedicated purely to mental rest or physical stillness.',
      'by 3 Years'
    ),
    (
      'Seeking Out a Supportive Parenting Community',
      'Reduce social isolation by connecting with other parents navigating similar preschool milestones. Sharing your daily challenges and venting with a relatable peer group validates your feelings and lightens your psychological load.',
      'by 4 Years'
    ),
    (
      'Practicing Mindful Self-Compassion for Mistakes',
      'When a parenting moment doesn''t go well and you lose your patience, practice active self-compassion. Forgive yourself, acknowledge that parenting is challenging, and model a healthy repair dynamic by apologizing to your child later.',
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
WHERE category = 'parent_self_care'
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
