-- Seed behavior guidance parenting tips (CDC age bands).
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
  'behavior_guidance',
  v.age_range,
  'therapist',
  '29b58be6-3347-4820-b759-5a156fd78d62'::uuid,
  'approved',
  now()
FROM (
  VALUES
    (
      'Establishing Proactive Visual and Vocal Distraction',
      'At this stage, challenging behaviors are signs of overstimulation or unmet needs. When a baby becomes fussy during a necessary transition (like a diaper change), shift their focus proactively by singing softly or moving a bright toy into their line of sight.',
      'by 2 Months'
    ),
    (
      'Shifting Focus from Unsafe Objects',
      'Babies are beginning to reach for everything. Use gentle redirection by smoothly swapping an unsafe or inappropriate object with a colorful, age-appropriate toy while maintaining a calm, neutral expression.',
      'by 4 Months'
    ),
    (
      'Using Consistent Verbal Cues for Boundaries',
      'Start using short, consistent phrases paired with a calm tone to guide behavior (e.g., saying "gentle hands" when they pull hair). Keeping the phrase identical every time helps their brain map the boundary early.',
      'by 6 Months'
    ),
    (
      'Reinforcing Positive Actions (Catching Good Behavior)',
      'Babies repeat behaviors that get attention. Intentionally label and praise safe, positive choices—like clapping when they drop a toy gently instead of throwing it—to reinforce that specific behavior.',
      'by 9 Months'
    ),
    (
      'Setting Simple Physical Boundaries Mirroring Words',
      'When your toddler acts out unsafe behavior (like hitting), say a firm "No hitting" while gently but decisively holding their hand still. Pairing the physical block with the verbal rule makes the boundary concrete.',
      'by 12 Months'
    ),
    (
      'Utilizing Simple Substitution Redirection',
      'Toddlers explore through dynamic actions. If they are throwing hard toys across the living room, redirect that urge to a safe alternative rather than just stopping them. Say, "We don''t throw blocks. Let''s throw these soft rolled socks into the basket instead."',
      'by 18 Months'
    ),
    (
      'Ignoring Minor Attention-Seeking Outbursts',
      'For minor, safe emotional displays meant purely to protest a boundary (like whining or dropping to the floor), look away and maintain neutral body language. Once they calm down for a brief moment, immediately re-engage with positive attention.',
      'by 2 Years'
    ),
    (
      'Stating What to Do Instead of What Not to Do',
      'Toddler brains take longer to process negative commands. Instead of saying "Don''t run!" where they focus heavily on the word "run," flip the phrasing to a direct instruction: "Please use your walking feet."',
      'by 30 Months'
    ),
    (
      'Using First/Then Structuring',
      'Clarify expectations during resistance by using a simple "First/Then" logical structure. Tell them, "First we put your blocks back in the box, then we can head outside to play on the swings."',
      'by 3 Years'
    ),
    (
      'Involving Children in Logical Consequences',
      'Connect consequences directly to the behavior so they learn real-world outcomes. If your child intentionally spills juice or knocks over a tower during play, calmly provide towels or blocks and say, "You spilled it, so let''s work together to clean it up now."',
      'by 4 Years'
    ),
    (
      'Collaborative Problem Solving for Recurring Issues',
      'When a specific behavior issue happens repeatedly (like refusing to get dressed), sit down during a calm moment and problem-solve together. Ask, "What can we do to make getting dressed easier tomorrow morning so we aren''t late?"',
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
WHERE category = 'behavior_guidance'
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
