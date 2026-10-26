import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, request } from '../contexts/auth-api';
import { LABS } from '../data/lab-metadata';
import { getLessonsForLab } from '../data/curriculum';
import DeviceManager from '../components/profile/DeviceManager';

const ROLE_LABEL = { admin: 'Quản trị viên', user: 'Học viên' };

function ProfileInfo({ user }) {
  return (
    <div className="card">
      <div className="card-header">Thông tin cá nhân</div>
      <div className="card-body" style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%', background: 'var(--brand-primary-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700,
          color: 'var(--brand-primary)', flexShrink: 0,
        }}>
          {(user.full_name || user.email)[0].toUpperCase()}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flex: 1 }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Họ và tên</div>
            <div style={{ fontWeight: 600 }}>{user.full_name || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Email</div>
            <div style={{ fontWeight: 600 }}>{user.email}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Vai trò</div>
            <div style={{ fontWeight: 600 }}>{ROLE_LABEL[user.role] || user.role}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Ngày tham gia</div>
            <div style={{ fontWeight: 600 }}>
              {user.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordForm() {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (newPassword.length < 6) return setError('Mật khẩu mới phải có ít nhất 6 ký tự');
    if (newPassword !== confirmPassword) return setError('Mật khẩu xác nhận không khớp');

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = {
    width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px',
    border: '1px solid var(--border-strong)', fontSize: '0.9rem',
  };

  return (
    <div className="card">
      <div className="card-header">Đổi mật khẩu</div>
      <div className="card-body">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '360px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Mật khẩu hiện tại</label>
            <input type="password" style={inputStyle} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Mật khẩu mới</label>
            <input type="password" style={inputStyle} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Xác nhận mật khẩu mới</label>
            <input type="password" style={inputStyle} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          {error && <div className="auth-error-text">⚠ {error}</div>}
          {success && <div style={{ color: 'var(--accent-green)', fontSize: '0.85rem', fontWeight: 600 }}>✅ Đã đổi mật khẩu thành công</div>}
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting} style={{ alignSelf: 'flex-start' }}>
            {submitting ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  );
}

function LearningProgress({ user }) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const currentUser = user || authUser;
  const [progressByLab, setProgressByLab] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request('/api/progress')
      .then((rows) => {
        const map = {};
        rows.forEach((r) => { map[r.lab_id] = r; });
        setProgressByLab(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const completedCount = LABS.filter((lab) => progressByLab[lab.id]?.completed_at).length;
  const isPrivileged = currentUser?.role === 'teacher' || currentUser?.role === 'admin';

  return (
    <div className="card">
      <div className="card-header">
        <span>Tiến độ học tập</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {completedCount}/{LABS.length} lab hoàn thành
        </span>
      </div>
      <div className="card-body">
        <div style={{ width: '100%', height: '6px', background: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{
            width: `${(completedCount / LABS.length) * 100}%`, height: '100%',
            background: 'var(--brand-primary)', transition: 'width 0.3s var(--ease-out)',
          }} />
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Đang tải tiến độ...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {LABS.map((lab) => {
              const p = progressByLab[lab.id];
              const done = Boolean(p?.completed_at);
              const previousLab = LABS.find((item) => item.id === lab.id - 1);
              const previousDone = previousLab ? Boolean(progressByLab[previousLab.id]?.completed_at) : true;
              const isLocked = !done && !isPrivileged && lab.id > 0 && !previousDone;

              let percent = 0;
              if (done) {
                percent = 100;
              } else if (!isLocked) {
                const lessons = getLessonsForLab(lab.id);
                let completedLessonsCount = 0;
                if (lab.id === 0) {
                  if (p?.video_watched || p?.lessons?.['overview']?.completed) completedLessonsCount++;
                  if (p?.doc_viewed || p?.lessons?.['document']?.completed) completedLessonsCount++;
                  if (p?.lessons?.['components']?.completed) completedLessonsCount++;
                } else {
                  completedLessonsCount = lessons.filter((l) => Boolean(p?.lessons?.[l.id]?.completed)).length;
                }
                percent = lessons.length > 0 ? Math.round((completedLessonsCount / lessons.length) * 100) : 0;
              }

              const status = done ? 'completed' : isLocked ? 'locked' : 'in-progress';
              const label = done ? 'Đã hoàn thành' : isLocked ? 'Đang khóa' : `Đang học (${percent}%)`;
              const icon = done ? '✅' : isLocked ? '🔒' : '⏳';

              return (
                <div
                  key={lab.id}
                  onClick={() => {
                    if (isLocked) return;
                    navigate(`/${lab.slug}`);
                  }}
                  title={isLocked ? 'Cần hoàn thành lab trước để mở khóa' : `Lab ${lab.id}: ${lab.title}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
                    borderRadius: '8px', cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.6 : 1,
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isLocked) e.currentTarget.style.background = 'var(--bg-surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isLocked) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                  <span style={{ fontSize: '1.2rem' }}>{lab.icon}</span>
                  <span style={{ flex: 1, fontWeight: 500, color: isLocked ? 'var(--text-muted)' : 'inherit' }}>
                    Lab {lab.id}: {lab.title}
                  </span>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: status === 'in-progress' ? 600 : 500,
                    color: status === 'completed'
                      ? 'var(--accent-green, #16a34a)'
                      : status === 'in-progress'
                      ? 'var(--brand-primary, #0a4174)'
                      : 'var(--text-muted)',
                  }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  if (loading || !user) return null;

  return (
    <div className="player-content" style={{ padding: '40px max(24px, calc((100vw - 1280px) / 2))', maxWidth: '1280px' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '24px' }}>Hồ sơ của tôi</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
        <ProfileInfo user={user} />
        <ChangePasswordForm />
        <LearningProgress user={user} />
        <DeviceManager />
      </div>
    </div>
  );
}
