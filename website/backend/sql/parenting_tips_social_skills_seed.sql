-- Seed social skills parenting tips (CDC age bands).
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
  'social_skills',
  v.age_range,
  'therapist',
  '29b58be6-3347-4820-b759-5a156fd78d62'::uuid,
  'approved',
  now()
FROM (
  VALUES
    (
      'Encouraging Responsive Vocal Turn-Taking',
      'When your baby makes pre-speech sounds (like cooing or sighing), wait patiently until they finish, then respond with a warm voice or a smile. This early turn-taking dynamic establishes the core foundational structure of all future two-way social conversations.',
      'by 2 Months'
    ),
    (
      'Mirroring Expressions to Teach Shared Emotion',
      'Engage in direct, front-facing play and exaggerate your facial expressions to match or respond to your baby''s mood. When they smile, smile back brightly; if they vocalize, give them an enthusiastic response. This build the early understanding of shared emotional states.',
      'by 4 Months'
    ),
    (
      'Using Peek-a-Boo for Interactive Play',
      'Play classic interactive games like peek-a-boo with a scarf or your hands. This repetitive game teaches infants how to anticipate responses, read human facial expressions, and engage in joyous, shared play moments with a partner.',
      'by 6 Months'
    ),
    (
      'Modeling Gestures for Non-Verbal Interaction',
      'Use clear physical gestures alongside your speech, such as waving "bye-bye," clapping when excited, or pointing out an object across the room. Consistently seeing these movements helps your child learn how to communicate intentions non-verbally before they can say words.',
      'by 9 Months'
    ),
    (
      'Building Joint Attention Through Pointing',
      'When your child points at an interesting object, look directly at it, name it, and then look back to smile at your child. This shared focus ("joint attention") is the essential link that connects their personal experiences with social connection.',
      'by 12 Months'
    ),
    (
      'Introducing Simple Back-and-Forth Passing Games',
      'Practice rolling a soft ball or sliding a toy car back and forth across the floor with your toddler. Simple passing games introduce the early, concrete concept of sharing space, trading turns, and cooperating with a play partner.',
      'by 18 Months'
    ),
    (
      'Supporting Parallel Play Opportunities',
      'Provide opportunities for your toddler to play alongside other children of a similar age, even if they don''t directly interact or share toys yet. "Parallel play" is a necessary developmental stage that helps toddlers feel secure and comfortable in a peer group.',
      'by 2 Years'
    ),
    (
      'Introducing the Vocabulary of Simple Sharing',
      'When playing together, model the language of sharing by narrative actions. Say things like, "Now it''s my turn to stack a block... now it''s your turn!" This structural approach helps them associate sharing with a fun, predictable routine rather than a loss of control.',
      'by 30 Months'
    ),
    (
      'Practicing Basic Cooperative Group Games',
      'Encourage simple group play with basic, collaborative rules—like Ring Around the Rosie, Duck Duck Goose, or building a single big tower together. This helps preschoolers practice following a shared goal and controlling impulses within a peer dynamic.',
      'by 3 Years'
    ),
    (
      'Prompting Verbal Conflict Resolution Strategies',
      'When minor play arguments happen over toys, guide your child to use simple phrases to express their needs instead of grabbing or pushing. Help them practice saying clear scripts like, "Can I play with that when you are finished?"',
      'by 4 Years'
    ),
    (
      'Cultivating Empathy Through Story Perspectives',
      'While reading storybooks, look at the illustrations together and ask questions about characters'' feelings (e.g., "Why do you think he looks sad? What could his friend do to help?"). This encourages your child to process and recognize perspective-taking in social contexts.',
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
WHERE category = 'social_skills'
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
