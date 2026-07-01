import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authModel } from '../models/authModel.js';
import { getErrorMessage } from '../utils/errorMessages.js';
import ThemeToggle from '../components/layout/ThemeToggle.jsx';
import BrandLogo from '../components/layout/BrandLogo.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authModel.login(email, password);
      login(data.token, data.user);
      const redirectTo = data.user?.role === 'therapist' ? '/therapist/dashboard' : '/overview';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <ThemeToggle compact className="theme-toggle theme-toggle--floating" />
      <div className="login-page__inner">
        <div className="login-page__brand">
          <BrandLogo subtitle="Web Portal" compact />
        </div>

        <div className="login-card">
          <h2 className="login-card__title">Sign in</h2>
          <p className="login-card__desc">
            Enter your admin or therapist credentials to continue
          </p>

          {error ? <div className="login-error">{error}</div> : null}

          <form onSubmit={handleSubmit} autoComplete="off">
            <div className="login-field">
              <label className="login-label" htmlFor="noumouw-login-email">
                Email address
              </label>
              <input
                id="noumouw-login-email"
                type="email"
                name="noumouw-login-email"
                className="login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="enter email"
                autoComplete="off"
                readOnly
                onFocus={(e) => e.target.removeAttribute('readonly')}
                required
              />
            </div>

            <div className="login-field login-field--last">
              <label className="login-label" htmlFor="noumouw-login-password">
                Password
              </label>
              <div className="login-input-wrap">
                <input
                  id="noumouw-login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="noumouw-login-password"
                  className="login-input login-input--password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="enter password"
                  autoComplete="new-password"
                  readOnly
                  onFocus={(e) => e.target.removeAttribute('readonly')}
                  required
                />
                <button
                  type="button"
                  className="login-toggle-password"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M10.58 10.58a2 2 0 1 0 2.83 2.83" />
                      <path d="M16.68 16.67A8.94 8.94 0 0 1 12 18c-5 0-9-6-9-6a17.4 17.4 0 0 1 2.67-3.39" />
                      <path d="M9.88 4.24A9.12 9.12 0 0 1 12 4c5 0 9 6 9 6a18.5 18.5 0 0 1-1.56 2.19" />
                      <path d="M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2.06 12.34a1 1 0 0 1 0-.68C3.42 8.1 7.36 4 12 4s8.58 4.1 9.94 7.66a1 1 0 0 1 0 .68C20.58 15.9 16.64 20 12 20s-8.58-4.1-9.94-7.66z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="login-submit">
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
