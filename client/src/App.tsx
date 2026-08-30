import { useAuth } from "./hooks/useAuth";
import { AuthPage } from "./pages/AuthPage";
import { ClaimUsername } from "./pages/ClaimUsername";
import { Home } from "./pages/Home";
import "./App.css";

export default function App() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div className="page-container">
        <p className="tagline">Loading...</p>
      </div>
    );
  }

  if (!auth.user) {
    return <AuthPage auth={auth} />;
  }

  if (auth.needsUsername) {
    return <ClaimUsername auth={auth} />;
  }

  return <Home auth={auth} />;
}
