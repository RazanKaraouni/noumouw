-- Seed screen time parenting tips (CDC age bands).
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
  'screen_time',
  v.age_range,
  'therapist',
  '29b58be6-3347-4820-b759-5a156fd78d62'::uuid,
  'approved',
  now()
FROM (
  VALUES
    (
      'Prioritizing Screen-Free Human Interaction',
      'Avoid all screen exposure (phones, tablets, TVs). Infants at this age require responsive face-to-face human interaction, eye contact, and vocal turn-taking to properly build early visual tracking systems and secure emotional attachments.',
      'by 2 Months'
    ),
    (
      'Keeping Screens Out of the Direct Visual Field',
      'Ensure that background TVs or tablets are turned off or kept completely out of your baby''s line of sight during their wakeful play windows. High-contrast flickering lights can disrupt an infant''s developing ability to sustain focused attention on physical toys.',
      'by 4 Months'
    ),
    (
      'Minimizing Background Media Disruption',
      'Keep background television turned off when your baby is playing in the room. Even if they aren''t looking directly at the screen, background media noise reduces the overall amount of parent-child vocal interaction, which is critical for language development.',
      'by 6 Months'
    ),
    (
      'Avoiding Screen Distractions During Solid Feeding',
      'Avoid using videos or phones to distract your infant during meal times. Feeding your baby while they are mesmerized by a screen prevents them from tuning into internal fullness cues and disrupts sensory exploration of food textures.',
      'by 9 Months'
    ),
    (
      'Limiting Media to Monitored Video Chats',
      'Maintain a zero-screen policy with the exception of interactive video chatting with distant family members. When video chatting, a caregiver should always sit with the baby to point, talk, and translate the on-screen faces into meaningful social interactions.',
      'by 12 Months'
    ),
    (
      'Choosing High-Quality Interactive Educational Media',
      'If you choose to introduce digital media at this stage, select high-quality educational programs designed for toddlers. Always view the content alongside your child to talk about what they see and help them connect digital concepts to the physical world.',
      'by 18 Months'
    ),
    (
      'Enforcing a Strict One-Hour Screen Limit',
      'Limit passive screen media exposure to a maximum of 1 hour per day of high-quality programming. Prioritize interactive apps or shows that encourage movement, singing, or problem-solving over fast-paced, passive cartoon viewing.',
      'by 2 Years'
    ),
    (
      'Establishing Distinct Screen-Free Boundaries',
      'Create clear rules around where screens can be used. Designate meal times, family play spaces, and the child''s bedroom as strictly screen-free zones to protect open communication, physical activity, and sleep quality.',
      'by 30 Months'
    ),
    (
      'Ending Screen Exposure One Hour Before Bed',
      'Turn off all digital displays at least 60 minutes before your child''s bedtime routine begins. The blue light emitted by tablets and smartphones suppresses natural melatonin release, making it significantly harder for a toddler''s brain to transition to sleep.',
      'by 3 Years'
    ),
    (
      'Using Screens for Active Creation, Not Just Viewing',
      'Guide your child toward media consumption that requires active thought and creation—such as drawing apps, music-making games, or slow-paced interactive storytelling—rather than endless auto-playing video feeds.',
      'by 4 Years'
    ),
    (
      'Balancing Digital Media with Physical Play',
      'Ensure that daily screen allocations do not displace essential healthy habits. Protect your child''s schedule to ensure they still achieve at least 60 minutes of active physical exercise, sufficient unstructured creative play, and 10 to 11 hours of sleep daily.',
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
WHERE category = 'screen_time'
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
