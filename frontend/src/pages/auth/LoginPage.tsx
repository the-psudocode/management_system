import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate login and navigate to dashboard
    navigate("/dashboard");
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="logo">
          <span>⚡</span> Brightloop
        </div>

        <h1>Welcome back!</h1>
        <p className="subtitle">Sign in to your Brightloop Billing account.</p>

        <form onSubmit={handleLogin}>
          <label>Email Address</label>
          <input
            type="email"
            placeholder="admin@brightloop.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="login-options">
            <label className="remember">
              <input type="checkbox" /> Remember me
            </label>
            <a href="#" onClick={(e) => e.preventDefault()}>
              Forgot password?
            </a>
          </div>

          <button type="submit">Sign In →</button>
        </form>

        <p className="footer">
          © 2026 Brightloop Software. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
