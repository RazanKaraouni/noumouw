-- Seed sleep parenting tips (CDC age bands).
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
  'sleep',
  v.age_range,
  'therapist',
  '29b58be6-3347-4820-b759-5a156fd78d62'::uuid,
  'approved',
  now()
FROM (
  VALUES
    (
      'Distinguishing Day from Night (Circadian Alignment)',
      'Expose your baby to bright, natural sunlight during wakeful daytime hours, and keep the environment dim, quiet, and low-stimulation during nighttime waking. This builds early neurological pathways for melatonin production.',
      'by 2 Months'
    ),
    (
      'Pausing Before Responding to Sleep Grunts',
      'When your baby makes brief noises or grunts between sleep cycles, pause for a minute before intervening. Infants frequently experience active sleep states, and a brief delay prevents accidentally waking them up fully.',
      'by 4 Months'
    ),
    (
      'Putting Baby Down Drowsy But Awake',
      'Place your baby into their crib when they are heavy-lidded and calm, but still conscious. Developing this habit allows them to map the crib environment to the initial transition of falling asleep, facilitating self-soothing during nighttime rousings.',
      'by 6 Months'
    ),
    (
      'Managing Behavioral Regression from Motor Milestones',
      'Infants learning to sit up or crawl often practice these movements in their cribs at night. Keep middle-of-the-night interactions extremely minimal, boring, and dark to avoid reinforcing these developmental practices as midnight playtime.',
      'by 9 Months'
    ),
    (
      'Structuring Predictable Daytime Nap Boundaries',
      'Establish a consistent routine for daytime naps to stabilize their internal clock. Avoid over-tiredness by matching nap windows to predictable awake intervals, ensuring the last nap wraps up at least 4 hours before bedtime.',
      'by 12 Months'
    ),
    (
      'Addressing Toddler Separation Anxiety at Bedtime',
      'Separation anxiety peaks again around this stage, leading to bedtime stalling or crying. Reassure them with a confident, brief check-in phrase (e.g., "You are safe, I am right outside") rather than changing sleep locations or staying until they fall asleep.',
      'by 18 Months'
    ),
    (
      'Maintaining Crib Safety Against Early Escapes',
      'If your toddler begins experimenting with climbing the crib rails, use a sleep sack to safely restrict their leg span, or lower the mattress to its lowest point. Delaying the transition to a toddler bed keeps their environment physically contained and secure.',
      'by 2 Years'
    ),
    (
      'Standardizing a Multi-Step Visual Sleep Routine',
      'Use a short, visual schedule chart (e.g., bath, pajamas, story, bed) to guide your toddler through wind-down expectations. Predictable steps lower autonomic arousal and clear up resistance by making the final transition to bed expected.',
      'by 30 Months'
    ),
    (
      'Using an Okay-to-Wake Light Indicator',
      'Toddlers cannot tell time and often wake up early demanding interaction. Introduce a color-changing clock that turns a specific color (like green) when it is officially morning, teaching them to stay quietly in their room until the light changes.',
      'by 3 Years'
    ),
    (
      'Setting a Firm Bound on Bedtime Stalling Requests',
      'Preschoolers frequently request extra water, hugs, or trips to the bathroom to delay sleep. Introduce a physical "Bedtime Pass" system where they get one pass per night for a legitimate request; once exchanged, no further call-outs are answered.',
      'by 4 Years'
    ),
    (
      'Processing Daytime Fears Outside of the Bedroom',
      'If your child expresses fear of the dark or monsters at bedtime, address these themes during bright daylight hours through play or storytelling. Keeping bedtime conversations entirely focused on relaxation prevents anxious thoughts from being linked with the bedroom environment.',
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
WHERE category = 'sleep'
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
