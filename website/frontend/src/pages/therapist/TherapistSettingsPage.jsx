import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, GlassCard, Section, Btn } from '../../components/therapist/ui/TherapistUI';
import ThemeSettingRow from '../../components/layout/ThemeSettingRow.jsx';
import { therapistModel } from '../../models/therapistModel.js';
import { getUserFacingError } from '../../utils/errorFeedback.js';
import {
  PASSWORD_POLICY_HINT,
  validatePasswordChange,
} from '../../utils/passwordPolicy.js';

const PROFESSION_OPTIONS = ['Speech Therapy', 'Psychomotor Therapy'];

const EMPTY_PROFILE = {
  full_name: '',
  email: '',
  profession: '',
  bio: '',
  phone: '',
  address: '',
  years_of_experience: '',
  online_consultation: false,
};

function PasswordVisibilityToggle({ showPassword, onToggle, label }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="td-password-toggle"
      aria-label={showPassword ? `Hide ${label}` : `Show ${label}`}
    >
      {showPassword ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.58 10.58a2 2 0 1 0 2.83 2.83" />
          <path d="M16.68 16.67A8.94 8.94 0 0 1 12 18c-5 0-9-6-9-6a17.4 17.4 0 0 1 2.67-3.39" />
          <path d="M9.88 4.24A9.12 9.12 0 0 1 12 4c5 0 9 6 9 6a18.5 18.5 0 0 1-1.56 2.19" />
          <path d="M3 3l18 18" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.06 12.34a1 1 0 0 1 0-.68C3.42 8.1 7.36 4 12 4s8.58 4.1 9.94 7.66a1 1 0 0 1 0 .68C20.58 15.9 16.64 20 12 20s-8.58-4.1-9.94-7.66z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
  showPassword,
  onToggleVisibility,
}) {
  return (
    <div className="td-field">
      <label className="td-label" htmlFor={id}>
        {label}
      </label>
      <div className="td-password-wrap">
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          className="td-input"
          value={value}
          autoComplete={autoComplete}
          onChange={onChange}
          style={error ? { borderColor: 'var(--danger)' } : undefined}
        />
        <PasswordVisibilityToggle
          showPassword={showPassword}
          onToggle={onToggleVisibility}
          label={label.toLowerCase()}
        />
      </div>
      {error ? (
        <p className="td-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ProfileField({ id, label, children }) {
  return (
    <div className="td-field">
      <label className="td-label" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function TherapistSettingsPage() {
  const { therapist, logout, patchUser } = useAuth();
  const navigate = useNavigate();
  const name =
    therapist?.full_name ||
    `${therapist?.firstName || ''} ${therapist?.lastName || ''}`.trim() ||
    'Therapist';

  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [passwordError, setPasswordError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setOtpCode('');
    setOtpSent(false);
    setOtpEmail('');
    setOtpSuccess('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setFieldErrors({});
    setPasswordError('');
  };

  const closeProfileForm = () => {
    setShowProfileForm(false);
    setProfileError('');
    setProfileSuccess('');
    setProfileForm(EMPTY_PROFILE);
  };

  const openProfileForm = async () => {
    resetPasswordForm();
    setShowPasswordForm(false);
    setProfileError('');
    setProfileSuccess('');
    setShowProfileForm(true);
    setProfileLoading(true);
    try {
      const data = await therapistModel.account.getProfile();
      setProfileForm({
        full_name: data?.full_name || '',
        email: data?.email || '',
        profession: data?.profession || '',
        bio: data?.bio || '',
        phone: data?.phone || '',
        address: data?.address || '',
        years_of_experience:
          data?.years_of_experience == null ? '' : String(data.years_of_experience),
        online_consultation: Boolean(data?.online_consultation),
      });
    } catch (err) {
      setProfileError(getUserFacingError(err));
    } finally {
      setProfileLoading(false);
    }
  };

  const openPasswordForm = () => {
    closeProfileForm();
    resetPasswordForm();
    setShowPasswordForm(true);
  };

  const closePasswordForm = () => {
    resetPasswordForm();
    setShowPasswordForm(false);
  };

  const invalidateOtpIfSent = () => {
    if (!otpSent) return;
    setOtpSent(false);
    setOtpCode('');
    setOtpEmail('');
    setOtpSuccess('');
  };

  const clearFieldError = (key) => {
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setPasswordError('');
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileBusy(true);
    try {
      const updated = await therapistModel.account.updateProfile({
        full_name: profileForm.full_name,
        profession: profileForm.profession,
        bio: profileForm.bio,
        phone: profileForm.phone,
        address: profileForm.address,
        years_of_experience: profileForm.years_of_experience,
        online_consultation: profileForm.online_consultation,
      });
      patchUser({
        full_name: updated?.full_name || profileForm.full_name,
        email: updated?.email || profileForm.email,
      });
      setProfileSuccess('Profile updated successfully.');
      setShowProfileForm(false);
    } catch (err) {
      setProfileError(getUserFacingError(err));
    } finally {
      setProfileBusy(false);
    }
  };

  const handleSendOtp = async () => {
    setPasswordError('');
    setOtpSuccess('');

    const result = validatePasswordChange({ currentPassword, newPassword, confirmPassword });
    if (!result.valid) {
      setFieldErrors(result.errors);
      setPasswordError(result.message);
      return;
    }

    setFieldErrors({});
    setPasswordBusy(true);
    try {
      const data = await therapistModel.account.sendPasswordChangeOtp({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setOtpSent(true);
      setOtpEmail(data?.email || therapist?.email || '');
      setOtpSuccess(
        `A 6-digit verification code was sent to ${data?.email || therapist?.email || 'your email'}.`,
      );
    } catch (err) {
      setPasswordError(getUserFacingError(err));
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleResendOtp = async () => {
    setPasswordError('');
    setOtpSuccess('');
    setPasswordBusy(true);
    try {
      const data = await therapistModel.account.resendPasswordChangeOtp();
      setOtpSuccess(`A new verification code was sent to ${data?.email || otpEmail || 'your email'}.`);
    } catch (err) {
      setPasswordError(getUserFacingError(err));
    } finally {
      setPasswordBusy(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setOtpSuccess('');

    const result = validatePasswordChange({ currentPassword, newPassword, confirmPassword });
    if (!result.valid) {
      setFieldErrors(result.errors);
      setPasswordError(result.message);
      return;
    }

    if (!otpSent) {
      await handleSendOtp();
      return;
    }

    const normalizedOtp = otpCode.trim();
    if (!/^\d{6}$/.test(normalizedOtp)) {
      setPasswordError('Enter the 6-digit verification code from your email.');
      return;
    }

    setFieldErrors({});
    setPasswordBusy(true);
    try {
      await therapistModel.account.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
        otp_code: normalizedOtp,
      });
      logout();
      navigate('/login');
    } catch (err) {
      setPasswordError(getUserFacingError(err));
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your therapist account and appearance preferences." />

      <GlassCard style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 14, marginBottom: 10 }}>
          <span style={{ color: 'var(--muted)' }}>Name </span>
          {name}
        </p>
        <p style={{ fontSize: 14, marginBottom: 10 }}>
          <span style={{ color: 'var(--muted)' }}>Email </span>
          {therapist?.email || '—'}
        </p>
        <p style={{ fontSize: 14 }}>
          <span style={{ color: 'var(--muted)' }}>Therapist ID </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{therapist?.therapist_id || '—'}</span>
        </p>
      </GlassCard>

      <Section title="Account">
        <GlassCard>
          {!showProfileForm && !showPasswordForm ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Btn variant="primary" onClick={openProfileForm}>
                Edit profile
              </Btn>
              <Btn variant="primary" onClick={openPasswordForm}>
                Change password
              </Btn>
            </div>
          ) : null}

          {profileSuccess ? (
            <div className="td-alert td-alert-success" role="status" style={{ marginBottom: 16 }}>
              {profileSuccess}
            </div>
          ) : null}

          {showProfileForm ? (
            <>
              {profileError ? (
                <div className="td-alert td-alert-error" role="alert" style={{ marginBottom: 16 }}>
                  {profileError}
                </div>
              ) : null}

              {profileLoading ? (
                <p style={{ fontSize: 14, color: 'var(--muted)' }}>Loading profile…</p>
              ) : (
                <form autoComplete="off" onSubmit={handleProfileSubmit}>
                  <ProfileField id="profile-full-name" label="Full name">
                    <input
                      id="profile-full-name"
                      className="td-input"
                      value={profileForm.full_name}
                      required
                      onChange={(e) => setProfileForm((p) => ({ ...p, full_name: e.target.value }))}
                    />
                  </ProfileField>

                  <ProfileField id="profile-email" label="Email">
                    <input
                      id="profile-email"
                      className="td-input"
                      type="email"
                      value={profileForm.email}
                      disabled
                      readOnly
                    />
                  </ProfileField>

                  <ProfileField id="profile-profession" label="Profession">
                    <select
                      id="profile-profession"
                      className="td-input"
                      value={profileForm.profession}
                      required
                      onChange={(e) => setProfileForm((p) => ({ ...p, profession: e.target.value }))}
                    >
                      <option value="">Select profession</option>
                      {PROFESSION_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                      {profileForm.profession &&
                        !PROFESSION_OPTIONS.includes(profileForm.profession) && (
                          <option value={profileForm.profession}>{profileForm.profession}</option>
                        )}
                    </select>
                  </ProfileField>

                  <ProfileField id="profile-phone" label="Phone">
                    <input
                      id="profile-phone"
                      className="td-input"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </ProfileField>

                  <ProfileField id="profile-address" label="Address">
                    <input
                      id="profile-address"
                      className="td-input"
                      value={profileForm.address}
                      required
                      onChange={(e) => setProfileForm((p) => ({ ...p, address: e.target.value }))}
                    />
                  </ProfileField>

                  <ProfileField id="profile-years" label="Years of experience">
                    <input
                      id="profile-years"
                      className="td-input"
                      type="number"
                      min={0}
                      max={10}
                      value={profileForm.years_of_experience}
                      required
                      onChange={(e) =>
                        setProfileForm((p) => ({ ...p, years_of_experience: e.target.value }))
                      }
                    />
                  </ProfileField>

                  <ProfileField id="profile-bio" label="Bio">
                    <textarea
                      id="profile-bio"
                      className="td-input"
                      rows={3}
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))}
                      style={{ resize: 'vertical' }}
                    />
                  </ProfileField>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 16,
                      fontSize: 14,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(profileForm.online_consultation)}
                      onChange={(e) =>
                        setProfileForm((p) => ({ ...p, online_consultation: e.target.checked }))
                      }
                    />
                    Online consultation enabled
                  </label>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <Btn type="submit" variant="primary" disabled={profileBusy}>
                      {profileBusy ? 'Saving…' : 'Save profile'}
                    </Btn>
                    <Btn type="button" variant="ghost" onClick={closeProfileForm} disabled={profileBusy}>
                      Cancel
                    </Btn>
                  </div>
                </form>
              )}
            </>
          ) : null}

          {showPasswordForm ? (
            <>
              {passwordError ? (
                <div className="td-alert td-alert-error" role="alert" style={{ marginBottom: 16 }}>
                  {passwordError}
                </div>
              ) : null}

              {otpSuccess ? (
                <div className="td-alert td-alert-success" role="status" style={{ marginBottom: 16 }}>
                  {otpSuccess}
                </div>
              ) : null}

              <form autoComplete="off" onSubmit={handlePasswordSubmit}>
                <PasswordField
                  id="settings-current-password"
                  label="Current password"
                  value={currentPassword}
                  autoComplete="current-password"
                  showPassword={showCurrent}
                  onToggleVisibility={() => setShowCurrent((v) => !v)}
                  error={fieldErrors.currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    invalidateOtpIfSent();
                    clearFieldError('currentPassword');
                  }}
                />

                <PasswordField
                  id="settings-new-password"
                  label="New password"
                  value={newPassword}
                  autoComplete="new-password"
                  showPassword={showNew}
                  onToggleVisibility={() => setShowNew((v) => !v)}
                  error={fieldErrors.newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    invalidateOtpIfSent();
                    clearFieldError('newPassword');
                  }}
                />

                <PasswordField
                  id="settings-confirm-password"
                  label="Confirm new password"
                  value={confirmPassword}
                  autoComplete="new-password"
                  showPassword={showConfirm}
                  onToggleVisibility={() => setShowConfirm((v) => !v)}
                  error={fieldErrors.confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    invalidateOtpIfSent();
                    clearFieldError('confirmPassword');
                  }}
                />

                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
                  {PASSWORD_POLICY_HINT}
                </p>

                {otpSent ? (
                  <ProfileField id="settings-otp-code" label="Verification code">
                    <input
                      id="settings-otp-code"
                      className="td-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="6-digit code"
                      value={otpCode}
                      onChange={(e) => {
                        setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                        setPasswordError('');
                      }}
                    />
                  </ProfileField>
                ) : null}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <Btn type="submit" variant="primary" disabled={passwordBusy}>
                    {passwordBusy
                      ? otpSent
                        ? 'Updating…'
                        : 'Sending code…'
                      : otpSent
                        ? 'Update password'
                        : 'Send verification code'}
                  </Btn>
                  {otpSent ? (
                    <Btn
                      type="button"
                      variant="ghost"
                      onClick={handleResendOtp}
                      disabled={passwordBusy}
                    >
                      Resend code
                    </Btn>
                  ) : null}
                  <Btn type="button" variant="ghost" onClick={closePasswordForm} disabled={passwordBusy}>
                    Cancel
                  </Btn>
                </div>
              </form>
            </>
          ) : null}
        </GlassCard>
      </Section>

      <Section title="Appearance">
        <GlassCard>
          <ThemeSettingRow />
        </GlassCard>
      </Section>
    </div>
  );
}
