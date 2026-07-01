export const validateUuidParam = (paramName) => (req, res, next) => {
  const value = req.params[paramName];
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!value || !uuidRegex.test(value)) {
    return res.status(400).json({ message: `Invalid ${paramName}.` });
  }
  next();
};

export const validateMessageBody = (req, res, next) => {
  const content = req.body?.content;
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ message: 'Message content is required.' });
  }
  if (content.trim().length > 5000) {
    return res.status(400).json({ message: 'Message content is too long.' });
  }
  req.body.content = content.trim();
  next();
};

export const validateEnsureRoomBody = (req, res, next) => {
  const therapistId = req.body?.therapist_id;
  if (!therapistId || typeof therapistId !== 'string') {
    return res.status(400).json({ message: 'therapist_id is required.' });
  }
  next();
};

