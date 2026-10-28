import logo from '../../assets/logo.svg';

export default function AuthLayout({ children, variant = 'user' }) {
  return (
    <div className={`auth-shell${variant === 'admin' ? ' auth-shell--admin' : ''}`}>
      <div className={`auth-visual${variant === 'admin' ? ' auth-visual--admin' : ''}`}>
        <div className="auth-visual-inner">
          <span className="auth-badge">{variant === 'admin' ? 'CubeSAT Admin' : 'CubeSAT LMS'}</span>
          <img src={logo} alt="PTIT CubeSat LMS" className="auth-visual-logo" />
          <div className="auth-visual-copy">
            <h2>{variant === 'admin' ? 'Bảng điều khiển vận hành' : 'Học tập theo lớp'}</h2>
            <p>{variant === 'admin' ? 'Quản lý lớp, tài khoản và tiến độ học tập trong một góc nhìn thống nhất.' : 'Khám phá lộ trình học, thực hành và lab kiểm tra theo từng lớp.'}</p>
          </div>
        </div>
      </div>
      <div className={`auth-panel${variant === 'admin' ? ' auth-panel--admin' : ''}`}>
        <div className={`auth-form-wrap${variant === 'admin' ? ' auth-form-wrap--admin' : ''}`}>{children}</div>
      </div>
    </div>
  );
}
