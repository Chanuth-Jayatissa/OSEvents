import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  user_id: string;
  google_id: string;
  email: string;
  name: string;
  picture: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  login: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  token: null,
  login: async () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("eventos_token"));
  const [isLoading, setIsLoading] = useState(true);

  // On mount or token change, fetch user profile
  useEffect(() => {
    if (token) {
      fetchUser(token);
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const fetchUser = async (jwt: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        // Token expired or invalid
        localStorage.removeItem("eventos_token");
        setToken(null);
        setUser(null);
      }
    } catch {
      // Backend not reachable
      console.error("Auth check failed — backend may be down");
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    try {
      const res = await fetch("/api/auth/google/login");
      const data = await res.json();
      // Redirect to Google consent screen
      window.location.href = data.url;
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const logout = () => {
    localStorage.removeItem("eventos_token");
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  };

  // Handle OAuth callback — store token from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackToken = params.get("token");
    if (callbackToken) {
      localStorage.setItem("eventos_token", callbackToken);
      setToken(callbackToken);
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
