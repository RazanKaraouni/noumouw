import {
  findUserByAnyId,
  getChildrenForParentUserId,
  getParentByUserId,
  getParentsDirectory,
  reactivateParentById,
  upsertUser,
} from '../models/userModel.js';
import {
  ageYearsFromDateOfBirth,
  parseParentDateOfBirth,
} from '../utils/parentAge.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import { getAdminId } from '../utils/authContext.js';
import { writeModerationAudit } from '../services/moderationAuditService.js';
import { queueModerationNotification } from '../services/moderationNotifyService.js';
import { suspendParentAccount } from '../services/parentSuspensionService.js';
import { sendAccountReactivationEmail } from '../services/moderationEmailService.js';
import { clearSuspensionArtifacts } from '../services/accountReactivationService.js';
import { deleteParentAccount } from '../services/parentDeletionService.js';

export const listUsers = async (req, res) => {
  try {
    const limitRaw = req.query.limit;
    const offsetRaw = req.query.offset;
    const limit =
      limitRaw != null && limitRaw !== '' ? Number.parseInt(String(limitRaw), 10) : undefined;
    const offset =
      offsetRaw != null && offsetRaw !== '' ? Number.parseInt(String(offsetRaw), 10) : undefined;
    const users = await getParentsDirectory(
      limit != null && !Number.isNaN(limit) ? { limit, offset } : {},
    );
    res.json(users);
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};

export const getParentChildren = async (req, res) => {
  try {
    const identifier = req.params.parent_id;
    const parent = await findUserByAnyId(identifier);
    if (!parent?.user_id) {
      return res.status(404).json({ message: 'Parent not found.' });
    }
    const children = await getChildrenForParentUserId(parent.user_id);
    return res.json(children);
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
};

export const suspendParent = async (req, res) => {
  try {
    const parent = await findUserByAnyId(req.params.parent_id);
    if (!parent?.parent_id) {
      return res.status(404).json({ message: 'Parent not found.' });
    }
    const reason = 'Suspended from Parents directory';
    const updated = await suspendParentAccount(parent.user_id, reason);
    queueModerationNotification({
      userId: parent.user_id,
      action: 'suspend',
      reason,
    });
    await writeModerationAudit({
      event_type: 'parent_suspended',
      adminId: getAdminId(req),
      targetTable: 'parents',
      targetId: parent.parent_id,
      metadata: {
        user_id: parent.user_id,
        user_name: parent.full_name,
        user_email: parent.email,
        subject_role: 'parent',
        reason,
      },
    });
    return res.json(updated);
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
};

export const reactivateParent = async (req, res) => {
  try {
    const parent = await findUserByAnyId(req.params.parent_id);
    if (!parent?.parent_id) {
      return res.status(404).json({ message: 'Parent not found.' });
    }
    const updated = await reactivateParentById(parent.parent_id);
    await clearSuspensionArtifacts({
      email: updated?.email,
      userId: updated?.user_id,
    });
    if (updated?.email) {
      sendAccountReactivationEmail({
        toEmail: updated.email,
        userName: updated.full_name,
        role: 'parent',
      });
    }
    return res.json(updated);
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
};

export const getMyProfile = async (req, res) => {
  try {
    const parentUserId = req.auth?.parentUserId;
    if (!parentUserId) {
      return res.status(403).json({ message: 'Parent access only.' });
    }

    const user = await getParentByUserId(parentUserId);
    if (!user) {
      return res.status(404).json({ message: 'Parent profile not found.' });
    }

    return res.json(user);
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
};

export const createOrUpdateUser = async (req, res) => {
  try {
    const {
      user_id,
      full_name,
      email,
      gender,
      age,
      date_of_birth,
      address,
      profile_image_url,
    } = req.body;

    if (!user_id || !email) {
      return res.status(400).json({ message: 'user_id and email are required.' });
    }

    const authenticatedUserId = req.auth?.parentUserId;
    if (!authenticatedUserId || String(authenticatedUserId) !== String(user_id)) {
      return res.status(403).json({ message: 'You can only update your own profile.' });
    }

    const parsedDob = parseParentDateOfBirth(date_of_birth);
    const payload = {
      user_id,
      full_name: full_name ?? null,
      email,
      gender: gender ?? null,
      address: address ?? null,
      profile_image_url: profile_image_url ?? null,
    };
    if (parsedDob) {
      payload.date_of_birth = parsedDob;
      payload.age = ageYearsFromDateOfBirth(parsedDob);
    } else if (age != null && age !== '') {
      payload.age = age;
    }

    const user = await upsertUser(payload);

    res.status(200).json(user);
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};

export const deleteUser = async (req, res) => {
  try {
    const identifier = req.params.parent_id || req.params.id;
    if (!identifier) return res.status(400).json({ message: 'parent_id is required.' });

    const parentRef = await findUserByAnyId(identifier);
    if (!parentRef) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const deletedParent = await deleteParentAccount({
      parentId: parentRef.parent_id,
      userId: parentRef.user_id,
    });

    await writeModerationAudit({
      event_type: 'parent_deleted',
      adminId: getAdminId(req),
      targetTable: 'parents',
      targetId: deletedParent.parent_id,
      metadata: {
        user_id: deletedParent.user_id,
        user_name: deletedParent.full_name,
        user_email: deletedParent.email,
        subject_role: 'parent',
        reason: 'Deleted from Parents directory',
      },
    });
    return res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return sendErrorResponse(res, err, status);
  }
};
