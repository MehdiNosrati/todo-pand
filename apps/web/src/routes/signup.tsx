import { Button, Card, Input } from "@pand/ui";
import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { authClient } from "./__root.js";

export default function SignupPage({ onNavigate }: { onNavigate?: (to: string) => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authClient.signUp.email({ name, email, password });
      if (res?.error) {
        setError(res.error.message ?? "Sign up failed");
      } else {
        await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
        await queryClient.invalidateQueries({ queryKey: ["core"] });
        onNavigate?.("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md pt-12">
      <Card>
        <h2 className="mb-4 text-xl font-bold text-slate-900">Create Account</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="name"
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            id="email"
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            id="password"
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating account..." : "Sign Up"}
          </Button>
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => onNavigate?.("/login")}
              className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              Already have an account? Sign in
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
