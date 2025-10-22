import { useState } from "react";
import { auth } from "../lib/firebase";
import { sendEmailVerification } from "firebase/auth";
import { Link } from "react-router-dom";

export default function VerifyEmail() {
  const [msg, setMsg] = useState("");

  async function resend() {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
    setMsg("Verification email sent. Check your inbox.");
  }

  return (
    <div className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Verify your email</h1>
      <p className="opacity-80">
        We sent a verification link to your email. After you verify, sign in again.
      </p>
      <button
        onClick={resend}
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white"
      >
        Resend verification email
      </button>
      {msg && <div className="text-sm text-emerald-400">{msg}</div>}

      <div className="text-sm opacity-80">
        Done verifying? <Link className="text-blue-400 underline" to="/sign-in">Return to sign in</Link>
      </div>
    </div>
  );
}
