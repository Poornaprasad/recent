"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";

import { useForm } from "react-hook-form";

import { z } from "zod";

import { Button } from "@/components/ui/button";

import {

  Card,

  CardContent,

  CardDescription,

  CardFooter,

  CardHeader,

  CardTitle,

} from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { useAuthStore } from "@/hooks/use-auth-store";

import Link from "next/link";

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

  const { setUser } = useAuthStore();

  const { toast } = useToast();

  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

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

      

      router.push("/dashboard");

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

    <Card className="w-full max-w-md shadow-2xl backdrop-blur-md bg-white/98 dark:bg-[#1e2d47]/98 border-white/30 dark:border-white/10 transition-all duration-300 hover:shadow-3xl">

      <CardHeader className="text-center space-y-4 pb-6">

        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-lg shadow-primary/20 transition-transform duration-300 hover:scale-105">

            <Workflow size={36} className="drop-shadow-sm" />

        </div>

        <div className="space-y-2">

          <CardTitle className="font-headline text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">

            {APP_NAME}

          </CardTitle>

          <CardDescription className="text-base">Sign in to access your account</CardDescription>

        </div>

      </CardHeader>

      <CardContent className="space-y-5">

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>

          <div className="space-y-2.5">

            <Label htmlFor="email" className="text-sm font-medium">Email</Label>

            <Input

              id="email"

              type="email"

              placeholder="name@thebarnesfirm.com"

              {...form.register("email")}

              autoComplete="email"

              disabled={isLoading}

              className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"

              aria-invalid={form.formState.errors.email ? "true" : "false"}

              aria-describedby={form.formState.errors.email ? "email-error" : undefined}

            />

            {form.formState.errors.email && (

              <p id="email-error" className="text-sm text-destructive" role="alert">

                {form.formState.errors.email.message}

              </p>

            )}

          </div>

          <div className="space-y-2.5">

            <Label htmlFor="password" className="text-sm font-medium">Password</Label>

            <div className="relative">

              <Input

                id="password"

                type={showPassword ? "text" : "password"}

                placeholder="Enter your password"

                {...form.register("password")}

                autoComplete="current-password"

                disabled={isLoading}

                className="h-11 pr-10 transition-all duration-200 focus:ring-2 focus:ring-primary/20"

                aria-invalid={form.formState.errors.password ? "true" : "false"}

                aria-describedby={form.formState.errors.password ? "password-error" : undefined}

              />

              <Button

                type="button"

                variant="ghost"

                size="icon"

                className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"

                onClick={() => setShowPassword(!showPassword)}

                disabled={isLoading}

                aria-label={showPassword ? "Hide password" : "Show password"}

              >

                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}

              </Button>

            </div>

            {form.formState.errors.password && (

              <p id="password-error" className="text-sm text-destructive" role="alert">

                {form.formState.errors.password.message}

              </p>

            )}

          </div>

          <Button 
            type="submit" 
            className="w-full h-11 font-semibold text-base shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02]" 
            disabled={isLoading}
          >

            {isLoading ? (

              <span className="flex items-center gap-2">

                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />

                Signing In...

              </span>

            ) : (

              "Sign In"

            )}

          </Button>

        </form>

      </CardContent>

      <CardFooter className="flex flex-col items-center pt-4">

        <p className="text-sm text-muted-foreground">

          Don&apos;t have an account?{" "}

          <Link href="/signup" className="font-semibold text-primary hover:text-primary/80 transition-colors underline-offset-4 hover:underline">

            Sign up

          </Link>

        </p>

      </CardFooter>

    </Card>

  );

}
