// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom"; // <-- no BrowserRouter here
import RequireAuth from "./routes/RequireAuth";
import AppShell from "./components/AppShell";

import Dashboard from "./pages/Dashboard";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import Buildings from "./pages/Buildings";
import Units from "./pages/Units";
import Issues from "./pages/Issues";
import Payments from "./pages/Payments";
import Ratings from "./pages/Ratings";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Invitations from "./pages/Invitations";
import CashDrawerPage from "./pages/CashDrawer";
// lightweight placeholders
function Placeholder({ title }) {
  return <div className="card p-4">{title}</div>;
}
function AwaitApproval() {
  return (
    <div className="p-6 max-w-md mx-auto card">
      <h1 className="text-2xl font-semibold mb-2">Awaiting Approval</h1>
      <p>
        Your account is pending admin approval. Please contact building
        management.
      </p>
    </div>
  );
}
function AccountDisabled() {
  return (
    <div className="p-6 max-w-md mx-auto card">
      <h1 className="text-2xl font-semibold mb-2">Account Disabled</h1>
      <p>
        Your account is inactive. Please contact support or building management.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* public auth routes */}
      <Route path="/sign-up" element={<SignUp />} />
      <Route path="/sign-in" element={<SignIn />} />

      {/* gating feedback (public) */}
      <Route path="/await-approval" element={<AwaitApproval />} />
      <Route path="/account-disabled" element={<AccountDisabled />} />

      {/* protected routes under shared shell */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell>
              <Dashboard />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/buildings"
        element={
          <RequireAuth>
            <AppShell>
              <Buildings />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/units"
        element={
          <RequireAuth>
            <AppShell>
              <Units />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/cash"
        element={
          <RequireAuth>
            <AppShell>
              <CashDrawerPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/issues"
        element={
          <RequireAuth>
            <AppShell>
              <Issues />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/payments"
        element={
          <RequireAuth>
            <AppShell>
              <Payments />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/ratings"
        element={
          <RequireAuth>
            <AppShell>
              <Ratings />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <AppShell>
              <Profile />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <AppShell>
              <Settings />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/invitations"
        element={
          <RequireAuth>
            <AppShell>
              <Invitations />
            </AppShell>
          </RequireAuth>
        }
      />

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
