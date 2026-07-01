import { getParentUserId } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import { getAllActivities } from '../models/activityModel.js';
import { loadActivitySuggestionContext } from '../services/activitySuggestionContextService.js';
import { explainTherapistAssignments } from '../services/assignmentExplainService.js';
import { answerParentAssistantQuestion } from '../services/parentAssistantChatService.js';
import { generateActivitySuggestion } from '../services/geminiActivityService.js';
import { resolveActivityDomain } from '../utils/resolveActivityDomain.js';

const VALID_GOALS = new Set([
  'cognitive',
  'motor',
  'social',
  'language',
  'auto',
  'based_on_whats_needed',
]);

export async function chatWithParentAssistant(req, res) {
  try {
    const parentUserId = getParentUserId(req);
    if (!parentUserId) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }

    const childId = Number(req.body?.child_id);
    if (!Number.isFinite(childId)) {
      return res.status(400).json({ message: 'child_id is required.' });
    }

    const question = String(req.body?.question || '').trim();
    if (!question) {
      return res.status(400).json({ message: 'question is required.' });
    }

    const result = await answerParentAssistantQuestion(
      parentUserId,
      childId,
      question,
    );

    return res.json({
      answer: result.answer,
      focus_domains: result.focus_domains,
      child_name: result.child_name,
      age_months: result.age_months,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) {
      console.error('[POST /api/parent/activities/chat]', err);
    }
    return sendErrorResponse(res, err, status);
  }
}

export async function explainAssignmentForParent(req, res) {
  try {
    const parentUserId = getParentUserId(req);
    if (!parentUserId) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }

    const childId = Number(req.body?.child_id);
    if (!Number.isFinite(childId)) {
      return res.status(400).json({ message: 'child_id is required.' });
    }

    const question = String(req.body?.question || '').trim();
    if (!question) {
      return res.status(400).json({ message: 'question is required.' });
    }

    const result = await explainTherapistAssignments(parentUserId, childId, question);

    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) {
      console.error('[POST /api/parent/activities/explain-assignment]', err);
    }
    return sendErrorResponse(res, err, status);
  }
}

export async function suggestActivityForParent(req, res) {
  try {
    const parentUserId = getParentUserId(req);
    if (!parentUserId) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }

    const childId = Number(req.body?.child_id);
    if (!Number.isFinite(childId)) {
      return res.status(400).json({ message: 'child_id is required.' });
    }

    const developmentGoal = String(req.body?.development_goal || 'auto')
      .trim()
      .toLowerCase();
    if (!VALID_GOALS.has(developmentGoal)) {
      return res.status(400).json({
        message:
          'Invalid development_goal. Use: cognitive, motor, social, language, or auto.',
      });
    }

    const mood = req.body?.mood;
    const availableTime = req.body?.available_time;
    if (!mood || !availableTime) {
      return res.status(400).json({
        message: 'mood and available_time are required.',
      });
    }

    const context = await loadActivitySuggestionContext(parentUserId, childId);

    const resolvedDomain = resolveActivityDomain(developmentGoal, {
      overdueMilestones: context.overdueMilestones,
      pendingAssignments: context.pendingAssignments,
    });

    const referenceActivities = (
      await getAllActivities({
        domain: resolvedDomain,
        childAgeMonths: context.ageMonths,
      })
    )
      .slice(0, 5)
      .map((a) => ({
        title: a.title,
        domain: a.domain,
        instructions: a.instructions,
      }));

    const activity = await generateActivitySuggestion({
      context,
      resolvedDomain,
      referenceActivities,
      mood,
      availableTime,
    });

    return res.json({
      activity,
      resolved_domain: resolvedDomain,
      context_summary: {
        age_months: context.ageMonths,
        overdue_count: context.overdueMilestones.length,
        pending_assignment_count: context.pendingAssignments.length,
        latest_risk_level: context.latestRiskLevel,
      },
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) {
      console.error('[POST /api/parent/activities/suggest]', err);
    }
    return sendErrorResponse(res, err, status);
  }
}
