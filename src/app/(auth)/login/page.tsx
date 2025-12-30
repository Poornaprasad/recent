
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/hooks/use-auth-store";
import { APP_NAME } from "@/lib/constants";
import { Eye, EyeOff, Workflow } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseJsonResponse, handleApiError } from "@/lib/utils/api-helpers";
import type { User } from "@/lib/domain/types";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuthStore();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Get redirect URL from query params
  const redirectUrl = searchParams.get('redirect') || '/dashboard';

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      if (!response.ok) {
        const error = await handleApiError(response);
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: error.message || "Invalid email or password.",
        });
        return;
      }

      const result = await parseJsonResponse<{ 
        user: User; 
        token: string; 
        refreshToken?: string; 
        tokenExpiry: number;
      }>(response);

      // Set user in auth store (role comes from database)
      if (!result.user || !result.token) {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: "Invalid response from server.",
        });
        return;
      }

      // Set user and tokens in auth store
      setUser(result.user);
      useAuthStore.getState().setTokens(result.token, result.refreshToken, result.tokenExpiry);

      // Redirect to the original URL or dashboard
      router.push(decodeURIComponent(redirectUrl));
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "An error occurred. Please try again.";
      
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-2xl backdrop-blur-sm bg-white/95 dark:bg-[#1e2d47]/95 border-white/20">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Workflow size={32} />
        </div>
        <CardTitle className="font-headline text-3xl">{APP_NAME}</CardTitle>
        <CardDescription>Sign in to access your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="@thebarnesfirm.com"
              {...form.register("email")}
              autoComplete="email"
              disabled={isLoading}
              aria-invalid={form.formState.errors.email ? "true" : "false"}
              aria-describedby={form.formState.errors.email ? "email-error" : undefined}
            />
            {form.formState.errors.email && (
              <p id="email-error" className="text-sm text-destructive" role="alert">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="•••••••••••"
                {...form.register("password")}
                autoComplete="current-password"
                disabled={isLoading}
                aria-invalid={form.formState.errors.password ? "true" : "false"}
                aria-describedby={form.formState.errors.password ? "password-error" : undefined}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            </div>
            {form.formState.errors.password && (
              <p id="password-error" className="text-sm text-destructive" role="alert">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full font-semibold" disabled={isLoading}>
            {isLoading ? "Signing In..." : "Sign In"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
