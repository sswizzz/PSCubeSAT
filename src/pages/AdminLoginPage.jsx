import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/common/AuthLayout';
import { useAuth } from '../contexts/auth-api';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { loginAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const currentUser = await loginAdmin(email.trim().toLowerCase(), password);
      if (currentUser?.role !== 'admin') {
        throw new Error('Tài khoản không có quyền quản trị.');
      }
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Đăng nhập không thành công. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout variant="admin">
      <div className="admin-auth-header">
        <span className="admin-auth-kicker">Administration</span>
        <h1 className="auth-title">Đăng nhập quản trị</h1>
        <p className="auth-subtitle">Truy cập tổng quan lớp học, tài khoản và báo cáo hệ thống.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="admin-email">Email quản trị</label>
          <div className="auth-input-wrap">
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@ptit.edu.vn"
              autoComplete="username"
            />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="admin-password">Mật khẩu</label>
          <div className="auth-input-wrap">
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
        </div>

        {error && <div className="auth-error-text" role="alert">{error}</div>}

        <button type="submit" className="auth-submit-btn" disabled={submitting}>
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>

      <p className="auth-footer-text">
        Chưa có tài khoản quản trị? <Link to="/admin/signup">Tạo tài khoản mới</Link>
      </p>
    </AuthLayout>
  );
}
