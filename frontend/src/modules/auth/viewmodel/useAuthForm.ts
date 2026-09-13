import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, changeSchema } from "../model/auth";
import { useAuth } from "./AuthProvider";
export function useLoginViewModel() {
  const auth = useAuth();
  const [error, setError] = useState("");
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  return {
    form,
    error,
    submit: form.handleSubmit(async (v) => {
      try {
        setError("");
        await auth.signIn(v.email, v.password);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in failed");
      }
    }),
  };
}
export function useChangeViewModel() {
  const auth = useAuth();
  const [error, setError] = useState("");
  const form = useForm({
    resolver: zodResolver(changeSchema),
    defaultValues: { oldPassword: "", newPassword: "", confirmPassword: "" },
  });
  return {
    form,
    error,
    submit: form.handleSubmit(async (v) => {
      try {
        setError("");
        await auth.change(v.oldPassword, v.newPassword);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Password change failed");
      }
    }),
  };
}
