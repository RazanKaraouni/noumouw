-- Seed autism support parenting tips (CDC age bands).
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
  'autism_support',
  v.age_range,
  'therapist',
  '29b58be6-3347-4820-b759-5a156fd78d62'::uuid,
  'approved',
  now()
FROM (
  VALUES
    (
      'Observing and Supporting Social-Visual Tracking',
      'Watch for how your baby tracks your face and responds to environmental sounds. Early interaction is deeply rooted in mutual gaze; if you notice consistent avoidance of eye contact or a lack of orienting toward your voice, flag it for early observation while continuing to engage in close-up, front-facing play.',
      'by 2 Months'
    ),
    (
      'Tracking Early Social Smiling and Reciprocity',
      'At this stage, infants typically offer spontaneous "social smiles" in response to your face or voice. If your baby rarely smiles back, or smiles only at objects rather than people, increase interactive face-to-face play (like peek-a-boo) to actively encourage social and emotional engagement.',
      'by 4 Months'
    ),
    (
      'Monitoring Vocal Receptivity and Sound Sharing',
      'Infants should begin reacting to their name and engaging in vocal back-and-forth tennis matches (cooing and babbling in response to you). A persistent lack of response to their name, or a lack of interest in vocal turn-taking, warrants gentle monitoring and proactive, simplified language modeling.',
      'by 6 Months'
    ),
    (
      'Assessing Joint Attention and Gaze Alternation',
      'Look for "joint attention"—the ability to look at an object you point to, and then look back at you to share the experience. If your baby doesn''t follow your gaze or point, or doesn''t look at you to see your reaction when a toy makes a sound, deliberately bring toys close to your eyes to bridge their attention back to you.',
      'by 9 Months'
    ),
    (
      'Observing Proto-Imperative Pointing and Gestures',
      'By one year, children typically point to show you something they want or find interesting, wave goodbye, or shake their head. A lack of functional gestures, or a habit of taking your hand and using it as a mechanical tool to operate an item without looking at your face, is a classic pattern that benefits from structured communication support.',
      'by 12 Months'
    ),
    (
      'Evaluating Functional vs. Repetitive Object Play',
      'Monitor how your toddler interacts with toys. While exploring parts of objects is normal, look out for exclusive, repetitive play—like spinning car wheels continuously, lining blocks up in rigid rows for hours, or becoming intensely distressed if an item is moved out of order—and gently mirror then expand their play routines.',
      'by 18 Months'
    ),
    (
      'Encouraging Imitation and Monitoring Sensory Patterns',
      'Watch for pretend play (like feeding a doll) and physical imitation. Also note hyper- or hypo-reactivity to sensory stimuli, such as intense distress from everyday sounds (vacuum, blender), avoiding specific textures, or repetitive body movements like hand-flapping or toe-walking. Focus on creating predictable environments to ease transitions.',
      'by 2 Years'
    ),
    (
      'Supporting Transitions and Managing Rigid Routines',
      'Neurodivergent children often experience high anxiety during unstructured changes. If your child exhibits intense resistance, prolonged meltdowns, or extreme rigidity if a specific driving route or daily routine changes slightly, utilize a visual first-then schedule to make upcoming events visually concrete and predictable.',
      'by 30 Months'
    ),
    (
      'Facilitating Functional Language and Addressing Echolalia',
      'Notice if your child uses language primarily to communicate needs, or if they mostly repeat phrases, movie lines, or scripts mechanically without clear communicative intent (echolalia). Validate their echoed phrases as a desire to connect, and model simple, functional scripts they can use immediately (e.g., "Help please").',
      'by 3 Years'
    ),
    (
      'Navigating Social Peer Play and Parallel Play Integration',
      'At four, children usually seek out peer interactions. If your child consistently retreats to isolated play, ignores peers entirely, or exhibits intense distress when asked to share space, support them by scaffolding "parallel play"—playing with similar toys side-by-side without forcing direct interaction until they feel secure.',
      'by 4 Years'
    ),
    (
      'Supporting Emotional Regulation and Preventing Melt-downs',
      'Differentiate between a behavioral tantrum and an autistic meltdown, which is an involuntary neurological overload from sensory or emotional exhaustion. When a meltdown occurs, stop all verbal demands, dim the lights, minimize noise, and offer a safe, low-stimulation environment for their nervous system to recover completely.',
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
WHERE category = 'autism_support'
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
