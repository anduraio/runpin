import { useEffect, useRef } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { clearApiKey, getApiKey } from "./api";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Routines from "./pages/Routines";
import Dashboard from "./pages/Dashboard";
import CreateJob from "./pages/CreateJob";
import JobDetail from "./pages/JobDetail";
import Schedules from "./pages/Schedules";
import Activity from "./pages/Activity";
import Guide from "./pages/Guide";

function Shell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const path = loc.pathname;
  const advancedOpen =
    path.startsWith("/advanced") ||
    path.startsWith("/jobs/") ||
    path === "/jobs";
  const activityActive =
    path.startsWith("/activity") || path.startsWith("/live");
  const menuRef = useRef<HTMLDetailsElement>(null);

  const closeMenu = () => {
    if (menuRef.current) menuRef.current.open = false;
  };

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const menu = menuRef.current;
      if (menu?.open && !menu.contains(e.target as Node)) closeMenu();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    closeMenu();
  }, [path]);

  const logout = () => {
    clearApiKey();
    window.location.href = "/login";
  };

  return (
    <div className="layout">
      <nav className="nav">
        <Link to="/app" className="brand">
          Runpin
        </Link>
        <Link to="/app" className={path === "/app" ? "active" : ""}>
          Home
        </Link>
        <Link
          to="/routines"
          className={path.startsWith("/routines") ? "active" : ""}
        >
          Routines
        </Link>
        <Link to="/activity" className={activityActive ? "active" : ""}>
          Activity
        </Link>
        <details
          ref={menuRef}
          className={`nav-dropdown ${advancedOpen ? "active" : ""}`}
        >
          <summary>Advanced</summary>
          <div className="nav-dropdown-menu" onClick={closeMenu}>
            <Link
              to="/advanced/jobs"
              className={path === "/advanced/jobs" ? "active" : ""}
            >
              Jobs
            </Link>
            <Link
              to="/advanced/jobs/new"
              className={path === "/advanced/jobs/new" ? "active" : ""}
            >
              New job (JSON)
            </Link>
            <Link
              to="/advanced/schedules"
              className={
                path.startsWith("/advanced/schedules") ? "active" : ""
              }
            >
              Schedules (cron)
            </Link>
          </div>
        </details>
        <span className="spacer" />
        <button className="linkish" onClick={logout}>
          Log out
        </button>
      </nav>
      {children}
    </div>
  );
}

function Private({ children }: { children: React.ReactNode }) {
  if (!getApiKey()) return <Navigate to="/login" replace />;
  return <Shell>{children}</Shell>;
}

function AdvancedBanner() {
  return (
    <div className="advanced-banner">
      Advanced — for API / JSON / cron users. Status lives on{" "}
      <Link to="/activity">Activity</Link>.
    </div>
  );
}

function CatchAll() {
  if (getApiKey()) return <Navigate to="/app" replace />;
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/guide" element={<Guide />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/app"
        element={
          <Private>
            <Home />
          </Private>
        }
      />
      <Route
        path="/routines"
        element={
          <Private>
            <Routines />
          </Private>
        }
      />
      <Route
        path="/activity"
        element={
          <Private>
            <Activity />
          </Private>
        }
      />
      <Route path="/live" element={<Navigate to="/activity" replace />} />
      <Route
        path="/advanced/jobs"
        element={
          <Private>
            <AdvancedBanner />
            <Dashboard />
          </Private>
        }
      />
      <Route
        path="/advanced/jobs/new"
        element={
          <Private>
            <AdvancedBanner />
            <CreateJob />
          </Private>
        }
      />
      <Route
        path="/advanced/schedules"
        element={
          <Private>
            <AdvancedBanner />
            <Schedules />
          </Private>
        }
      />
      {/* Shared job detail + legacy redirects */}
      <Route
        path="/jobs/:id"
        element={
          <Private>
            <JobDetail />
          </Private>
        }
      />
      <Route
        path="/jobs/new"
        element={<Navigate to="/advanced/jobs/new" replace />}
      />
      <Route path="/schedules" element={<Navigate to="/advanced/schedules" replace />} />
      <Route path="*" element={<CatchAll />} />
    </Routes>
  );
}
