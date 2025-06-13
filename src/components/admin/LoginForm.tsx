
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import Logo from "@/components/shared/Logo";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/config/firebase"; // Import Firebase auth instance

const loginFormSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export default function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof loginFormSchema>) {
    form.clearErrors(); // Clear previous errors
    console.log("[LoginForm] Attempting login for email:", values.email);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({
        title: "Login Successful",
        description: "Welcome back, Admin!",
      });
      router.push("/admin/dashboard");
    } catch (error: any) {
      console.error("[LoginForm] Firebase login error raw object:", error);
      let errorMessage = "Login failed. Please check your credentials and try again."; // Default message
      let errorCategory = "generic";

      if (error && error.code) {
        console.log(`[LoginForm] Firebase login attempt failed with error code: ${error.code}`);
        if (error.code === 'auth/visibility-check-was-unavailable') {
          errorMessage = "Login check failed. This might be due to browser settings (e.g., blocked cookies if in an iframe) or network issues. Please ensure cookies are enabled for Firebase, try a different browser/incognito mode, and then retry logging in.";
          errorCategory = "visibility-check";
        } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-email') {
          errorMessage = "Invalid email or password. Please try again.";
          errorCategory = "invalid-credentials";
        } else if (error.code === 'auth/too-many-requests') {
          errorMessage = "Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.";
          errorCategory = "too-many-requests";
        } else if (error.code === 'auth/network-request-failed') {
          errorMessage = "Network error. Please check your internet connection and try again.";
          errorCategory = "network-error";
        } else if (error.code === 'auth/user-disabled') {
          errorMessage = "This user account has been disabled. Please contact support.";
          errorCategory = "user-disabled";
        } else if (error.code === 'auth/operation-not-allowed') {
          errorMessage = "Email/password sign-in is not enabled for this Firebase project. Please enable it in the Firebase console (Authentication > Sign-in method).";
          errorCategory = "operation-not-allowed";
        } else if (error.code === 'auth/missing-continue-uri') {
          errorMessage = "A continue URL must be provided in the request for certain operations.";
          errorCategory = "missing-continue-uri";
        }
      } else {
        console.log("[LoginForm] Firebase login attempt failed with an error that has no 'code' property or error object is null/undefined.");
      }

      console.log(`[LoginForm] Login error category determined as: ${errorCategory}, resulting message: "${errorMessage}"`);

      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
      if (errorCategory === "invalid-credentials" || errorCategory === "generic") {
        form.setError("email", { type: "manual", message: " " }); // Clear specific message to avoid redundancy with toast
        form.setError("password", { type: "manual", message: " " });// Clear specific message
      }
      form.setValue("password","");
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <Card className="w-full max-w-md shadow-2xl rounded-xl form-interaction-animate">
        <CardHeader className="text-center p-8">
          <div className="inline-block mx-auto mb-6">
            <Logo size="lg" />
          </div>
          <CardTitle className="text-3xl font-headline">Admin Login</CardTitle>
          <CardDescription className="font-body">
            Access the Table Maestro V2 dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-body">Email Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="email" placeholder="e.g. admin@example.com" {...field} className="pl-10 font-body" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-body">Password</FormLabel>
                    <FormControl>
                       <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="password" placeholder="••••••••" {...field} className="pl-10 font-body" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full font-body text-lg py-6 btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" disabled={form.formState.isSubmitting}>
                <LogIn className="mr-2 h-5 w-5" />
                {form.formState.isSubmitting ? "Logging In..." : "Log In"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
