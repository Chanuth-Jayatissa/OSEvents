import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icosahedron from "@/components/Icosahedron";

/**
 * OAuth callback page — receives the JWT token from the URL query param,
 * stores it in localStorage, and redirects to the main app.
 */
const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const error = params.get("error");

    if (token) {
      localStorage.setItem("eventos_token", token);
      // Small delay for the AuthContext to pick up the token
      setTimeout(() => navigate("/"), 500);
    } else if (error) {
      console.error("Auth error:", error);
      navigate("/login");
    } else {
      navigate("/login");
    }
  }, [navigate]);

  return (
    <div className="h-screen bg-background flex flex-col items-center justify-center gap-4">
      <Icosahedron size={48} spinning />
      <p className="text-sm text-muted-foreground font-mono">Authenticating...</p>
    </div>
  );
};

export default AuthCallback;
