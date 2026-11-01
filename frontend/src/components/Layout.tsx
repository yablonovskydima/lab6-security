import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark">
            <ShieldIcon />
          </span>
          Secure Lab
        </NavLink>
        <nav>
          {user ? (
            <>
              <NavLink to="/products">Products</NavLink>
              <NavLink to="/orders">My orders</NavLink>
              {user.role === 'admin' && (
                <>
                  <span className="nav-sep" />
                  <NavLink to="/admin/users">Users</NavLink>
                  <NavLink to="/admin/login-log">Login log</NavLink>
                  <NavLink to="/admin/products">Manage products</NavLink>
                  <NavLink to="/admin/orders">All orders</NavLink>
                </>
              )}
            </>
          ) : null}
        </nav>
        <div className="topbar-right">
          {user ? (
            <>
              <NavLink to="/profile" className="user-chip">
                <span className="avatar">{(user.full_name || user.email).charAt(0)}</span>
                <span className="email">{user.email}</span>
                {user.role === 'admin' && <span className="badge badge-admin">admin</span>}
              </NavLink>
              <button className="btn btn-ghost" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/register" className="btn btn-primary btn-sm">
                Sign up
              </NavLink>
            </>
          )}
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}

function ShieldIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
