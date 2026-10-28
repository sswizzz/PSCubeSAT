import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loginDestination } from '../contexts/auth-session';
import AuthLayout from '../components/common/AuthLayout';
import { EyeIcon } from '../components/common/AuthIcons';
import GoogleSignIn from '../components/common/GoogleSignIn';
import { useAuth } from '../contexts/auth-api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    /** @type {Record<string, string>} */
    const next = {};
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Email không hợp lệ';
    if (!password) next.password = 'Vui lòng nhập mật khẩu';
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const currentUser = await login(email.trim().toLowerCase(), password, remember);
      if (currentUser?.role === 'admin') {
        throw new Error('Tài khoản quản trị chỉ được đăng nhập từ trang quản trị.');
      }
      navigate(loginDestination(location.state?.from), { replace: true });
    } catch (err) {
      setErrors({ password: err.message || 'Đăng nhập không thành công.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="auth-title">Chào mừng trở lại</h1>
      <p className="auth-subtitle">Vui lòng đăng nhập để truy cập Dashboard</p>

      <GoogleSignIn remember={remember} />

      <div className="auth-divider">Hoặc</div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <div className={`auth-input-wrap ${errors.email ? 'has-error' : ''}`}>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="yourname@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {errors.email && <div className="auth-error-text">⚠ {errors.email}</div>}
        </div>

        <div className="auth-field">
          <label htmlFor="password">Mật khẩu</label>
          <div className={`auth-input-wrap ${errors.password ? 'has-error' : ''}`}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="auth-toggle-visibility"
              onClick={() => setShowPassword((v) => !v)}
              aria-label="Hiện/ẩn mật khẩu"
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
          {errors.password && <div className="auth-error-text">⚠ {errors.password}</div>}
        </div>

        <div className="auth-row-between">
          <label className="auth-checkbox">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Lưu thiết bị này
          </label>
          <a href="#">Quên mật khẩu ?</a>
        </div>

        <button type="submit" className="auth-submit-btn" disabled={submitting}>
          {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>

      <p className="auth-footer-text">
        Bạn là người dùng mới? <Link to="/signup" state={location.state}>Tạo tài khoản mới ngay</Link>
      </p>
    </AuthLayout>
  );
}
