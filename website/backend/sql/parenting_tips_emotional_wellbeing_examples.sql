-- Emotional well-being tips: example_before / example_after hero cards.
-- Safe to re-run: updates existing rows; inserts only when title + age_range missing.
-- Run parenting_tips_examples.sql first if columns do not exist yet.

ALTER TABLE public.parenting_tips
  ADD COLUMN IF NOT EXISTS example_before text,
  ADD COLUMN IF NOT EXISTS example_after text;

WITH tip_data (
  title,
  content,
  age_range,
  example_before,
  example_after
) AS (
  VALUES
    (
      'Intentional Eye Contact for Co-Regulation',
      'Cradle your baby about 8 to 12 inches from your face and look directly into their eyes while speaking softly or smiling. This simple tracking builds secure emotional attachments and teaches early emotional regulation.',
      'by 2 Months',
      'Looking away or remaining completely expressionless when the alert baby looks at you.',
      'Holding them close, making direct eye contact, and nodding gently as they gaze at your face.'
    ),
    (
      'Mirroring Emotional Expressions',
      'Pay close attention to your baby''s facial expressions and mirror them back playfully. When they smile, smile back big; if they look surprised, open your eyes wide. This validates their early expressions and builds self-awareness.',
      'by 4 Months',
      'Maintaining a flat, distracted facial expression while feeding or playing with the infant.',
      'Exaggerating a wide smile and a happy gasp when the baby grins at you.'
    ),
    (
      'Responding Predictably to Emotional Distress',
      'Comfort your baby promptly when they cry or show frustration. Knowing that their emotional expressions bring a predictable, comforting caregiver builds a secure internal foundation of safety and resilience.',
      'by 6 Months',
      'Leaving the baby to cry long-term out of fear that comforting them will create bad habits.',
      'Picking up or stroking a crying baby immediately, using a soothing vocal tone to calm them.'
    ),
    (
      'Managing Separation Distress Predictably',
      'Always use a short, happy goodbye routine (like a consistent phrase and a wave) instead of sneaking away when leaving your child. This builds deep relational trust and reduces anxiety over transitions.',
      'by 9 Months',
      'Sneaking out of the nursery when the child turns their head to avoid seeing them cry.',
      'Giving a quick kiss, saying "Mommy always comes back!", waving goodbye, and exiting confidently.'
    ),
    (
      'Encouraging Object-Assisted Comfort',
      'Allow your child to use a specific soft blanket, stuffed animal, or transitional object during stressful transitions or sleep times. These objects provide a safe anchor for early self-soothing behaviors.',
      'by 12 Months',
      'Withholding a favorite blanket during a stressful daycare drop-off to force them to adapt quickly.',
      'Handing them their preferred plush toy right before putting them in their car seat for a long ride.'
    ),
    (
      'Identifying and Labeling Basic Emotions',
      'When your toddler shows a clear feeling, point it out explicitly to help them build their vocabulary. Say things like, "You are smiling! You feel happy," or "You are crying, you feel sad."',
      'by 18 Months',
      'Telling a crying toddler to "Stop making a fuss" without acknowledging what they are experiencing.',
      'Saying, "You are stamping your feet, you feel frustrated because the block tower fell down."'
    ),
    (
      'Validating Feelings Before Setting Boundaries',
      'Acknowledge your child''s emotional frustration before enforcing a rule. For example, tell them, "I see you are angry that we have to leave the park, but it is time to go home safely now."',
      'by 2 Years',
      'Yelling "Stop crying and get in the car right now!" when they protest leaving a play area.',
      'Saying, "It makes you sad to leave your friends, I know. Let''s hold hands and walk together."'
    ),
    (
      'Providing Simple Choices to Reduce Power Struggles',
      'Offer two acceptable choices to give your toddler a sense of personal autonomy and control. Letting them choose between two shirts or two healthy snacks significantly limits emotional defiance and meltdowns.',
      'by 30 Months',
      'Demanding "Put this green coat on right now" and getting into a long argument.',
      'Asking, "It is cold outside. Do you want to wear your green coat or your yellow jacket?"'
    ),
    (
      'Using a Designated "Calm-Down" Space',
      'Set up a cozy corner with pillows and soft books where your child can go voluntarily to rest when their emotions feel too big, rather than treating isolation like a harsh punishment.',
      'by 3 Years',
      'Banishing a screaming child to a dark isolation time-out corner as a punitive sentence.',
      'Saying, "Your body has a lot of big mad feelings right now. Let''s sit in the cozy corner together until you feel ready."'
    ),
    (
      'Teaching Slow, Regulated Deep Breathing',
      'Teach your child to take deep belly breaths when they feel tense or upset by prompting them to pretend to "smell a beautiful flower" and then "blow out a birthday candle."',
      'by 4 Years',
      'Shaking your head and telling an upset child to "Calm down!" without teaching them how.',
      'Taking a deep breath together and saying, "Let''s blow out the giant birthday candle together, ready? Pfffff."'
    ),
    (
      'Fostering Peer Empathy through Reflection',
      'Encourage your child to consider the perspectives of others during playtime conflicts or while reading stories. Ask them questions like, "Look at your friend''s face; how do you think they feel right now?"',
      'by 5 Years',
      'Telling your child "Say sorry right now" mechanically without discussing what happened.',
      'Saying, "When you snatched the truck, your brother started to cry. Look at his face, how do you think he feels?"'
    )
)
UPDATE public.parenting_tips AS pt
SET
  content = tip_data.content,
  example_before = tip_data.example_before,
  example_after = tip_data.example_after,
  category = 'emotional_wellbeing'
FROM tip_data
WHERE pt.title = tip_data.title
  AND pt.age_range = tip_data.age_range;

INSERT INTO public.parenting_tips (
  title,
  content,
  category,
  age_range,
  submitted_by_role,
  submitted_by,
  status,
  approved_at,
  example_before,
  example_after
)
SELECT
  tip_data.title,
  tip_data.content,
  'emotional_wellbeing',
  tip_data.age_range,
  'therapist',
  '29b58be6-3347-4820-b759-5a156fd78d62'::uuid,
  'approved',
  now(),
  tip_data.example_before,
  tip_data.example_after
FROM (
  VALUES
    (
      'Intentional Eye Contact for Co-Regulation',
      'Cradle your baby about 8 to 12 inches from your face and look directly into their eyes while speaking softly or smiling. This simple tracking builds secure emotional attachments and teaches early emotional regulation.',
      'by 2 Months',
      'Looking away or remaining completely expressionless when the alert baby looks at you.',
      'Holding them close, making direct eye contact, and nodding gently as they gaze at your face.'
    ),
    (
      'Mirroring Emotional Expressions',
      'Pay close attention to your baby''s facial expressions and mirror them back playfully. When they smile, smile back big; if they look surprised, open your eyes wide. This validates their early expressions and builds self-awareness.',
      'by 4 Months',
      'Maintaining a flat, distracted facial expression while feeding or playing with the infant.',
      'Exaggerating a wide smile and a happy gasp when the baby grins at you.'
    ),
    (
      'Responding Predictably to Emotional Distress',
      'Comfort your baby promptly when they cry or show frustration. Knowing that their emotional expressions bring a predictable, comforting caregiver builds a secure internal foundation of safety and resilience.',
      'by 6 Months',
      'Leaving the baby to cry long-term out of fear that comforting them will create bad habits.',
      'Picking up or stroking a crying baby immediately, using a soothing vocal tone to calm them.'
    ),
    (
      'Managing Separation Distress Predictably',
      'Always use a short, happy goodbye routine (like a consistent phrase and a wave) instead of sneaking away when leaving your child. This builds deep relational trust and reduces anxiety over transitions.',
      'by 9 Months',
      'Sneaking out of the nursery when the child turns their head to avoid seeing them cry.',
      'Giving a quick kiss, saying "Mommy always comes back!", waving goodbye, and exiting confidently.'
    ),
    (
      'Encouraging Object-Assisted Comfort',
      'Allow your child to use a specific soft blanket, stuffed animal, or transitional object during stressful transitions or sleep times. These objects provide a safe anchor for early self-soothing behaviors.',
      'by 12 Months',
      'Withholding a favorite blanket during a stressful daycare drop-off to force them to adapt quickly.',
      'Handing them their preferred plush toy right before putting them in their car seat for a long ride.'
    ),
    (
      'Identifying and Labeling Basic Emotions',
      'When your toddler shows a clear feeling, point it out explicitly to help them build their vocabulary. Say things like, "You are smiling! You feel happy," or "You are crying, you feel sad."',
      'by 18 Months',
      'Telling a crying toddler to "Stop making a fuss" without acknowledging what they are experiencing.',
      'Saying, "You are stamping your feet, you feel frustrated because the block tower fell down."'
    ),
    (
      'Validating Feelings Before Setting Boundaries',
      'Acknowledge your child''s emotional frustration before enforcing a rule. For example, tell them, "I see you are angry that we have to leave the park, but it is time to go home safely now."',
      'by 2 Years',
      'Yelling "Stop crying and get in the car right now!" when they protest leaving a play area.',
      'Saying, "It makes you sad to leave your friends, I know. Let''s hold hands and walk together."'
    ),
    (
      'Providing Simple Choices to Reduce Power Struggles',
      'Offer two acceptable choices to give your toddler a sense of personal autonomy and control. Letting them choose between two shirts or two healthy snacks significantly limits emotional defiance and meltdowns.',
      'by 30 Months',
      'Demanding "Put this green coat on right now" and getting into a long argument.',
      'Asking, "It is cold outside. Do you want to wear your green coat or your yellow jacket?"'
    ),
    (
      'Using a Designated "Calm-Down" Space',
      'Set up a cozy corner with pillows and soft books where your child can go voluntarily to rest when their emotions feel too big, rather than treating isolation like a harsh punishment.',
      'by 3 Years',
      'Banishing a screaming child to a dark isolation time-out corner as a punitive sentence.',
      'Saying, "Your body has a lot of big mad feelings right now. Let''s sit in the cozy corner together until you feel ready."'
    ),
    (
      'Teaching Slow, Regulated Deep Breathing',
      'Teach your child to take deep belly breaths when they feel tense or upset by prompting them to pretend to "smell a beautiful flower" and then "blow out a birthday candle."',
      'by 4 Years',
      'Shaking your head and telling an upset child to "Calm down!" without teaching them how.',
      'Taking a deep breath together and saying, "Let''s blow out the giant birthday candle together, ready? Pfffff."'
    ),
    (
      'Fostering Peer Empathy through Reflection',
      'Encourage your child to consider the perspectives of others during playtime conflicts or while reading stories. Ask them questions like, "Look at your friend''s face; how do you think they feel right now?"',
      'by 5 Years',
      'Telling your child "Say sorry right now" mechanically without discussing what happened.',
      'Saying, "When you snatched the truck, your brother started to cry. Look at his face, how do you think he feels?"'
    )
) AS tip_data(title, content, age_range, example_before, example_after)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.parenting_tips existing
  WHERE existing.title = tip_data.title
    AND existing.age_range = tip_data.age_range
);

-- Verify
SELECT title, age_range, example_before IS NOT NULL AS has_before, example_after IS NOT NULL AS has_after
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
