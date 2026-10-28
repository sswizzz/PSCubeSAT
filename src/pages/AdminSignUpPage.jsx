import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/common/AuthLayout';
import { useAuth } from '../contexts/auth-api';

export default function AdminSignUpPage() {
  const navigate = useNavigate();
  const { registerAdmin } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Vui lòng nhập tên quản trị viên.');
      return;
    }
    if (form.password.length < 6) {
      setError('Mật khẩu phải tối thiểu 6 ký tự.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Xác nhận mật khẩu không khớp.');
      return;
    }

    setSubmitting(true);
    try {
      await registerAdmin(form.email.trim().toLowerCase(), form.password, form.name.trim());
      navigate('/admin/dashboard', { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Tạo tài khoản quản trị không thành công.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout variant="admin">
      <div className="admin-auth-header">
        <span className="admin-auth-kicker">Create account</span>
        <h1 className="auth-title">Khởi tạo quản trị</h1>
        <p className="auth-subtitle">Thiết lập tài khoản quản trị cho hệ thống học tập.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="admin-name">Tên quản trị</label>
          <div className="auth-input-wrap">
            <input id="admin-name" name="name" value={form.name} onChange={handleChange} placeholder="Nguyễn Văn A" autoComplete="name" />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="admin-email">Email</label>
          <div className="auth-input-wrap">
            <input id="admin-email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="admin@ptit.edu.vn" autoComplete="username" />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="admin-password">Mật khẩu</label>
          <div className="auth-input-wrap">
            <input id="admin-password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="••••••••" autoComplete="new-password" />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="admin-confirm-password">Xác nhận mật khẩu</label>
          <div className="auth-input-wrap">
            <input id="admin-confirm-password" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder="••••••••" autoComplete="new-password" />
          </div>
        </div>

        {error && <div className="auth-error-text" role="alert">{error}</div>}

        <button type="submit" className="auth-submit-btn" disabled={submitting}>
          {submitting ? 'Đang tạo…' : 'Tạo tài khoản'}
        </button>
      </form>

      <p className="auth-footer-text">
        Đã có tài khoản? <Link to="/admin/login">Đăng nhập ngay</Link>
      </p>
    </AuthLayout>
  );
}
