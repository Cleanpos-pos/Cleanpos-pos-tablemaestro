
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
import { Mail, Lock, LogIn, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import Logo from "@/components/shared/Logo";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
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

  const handlePasswordReset = async () => {
    const email = form.getValues("email");
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address in the field above to reset your password.",
        variant: "destructive",
      });
      form.setError("email", { message: "Email is required for password reset." });
      return;
    }
    
    // Manually trigger validation for the email field
    const emailValidationResult = await form.trigger("email");
    if (!emailValidationResult) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "Password Reset Email Sent",
        description: `If an account exists for ${email}, a password reset link has been sent. Please check your inbox.`,
      });
    } catch (error: any) {
      console.error("[LoginForm] Password reset error:", error);
      toast({
        title: "Password Reset Failed",
        description: "Could not send password reset email. The email address may not be registered. Please check the email and try again.",
        variant: "destructive",
      });
    }
  };


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
      
      if (error && error.code) {
        console.log(`[LoginForm] Firebase login attempt failed with error code: ${error.code}`);
        switch (error.code) {
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-email':
            errorMessage = "Invalid email or password. Please try again.";
            break;
          case 'auth/too-many-requests':
            errorMessage = "Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.";
            break;
          case 'auth/network-request-failed':
            errorMessage = "Network error. Please check your internet connection and try again.";
            break;
          case 'auth/user-disabled':
            errorMessage = "This user account has been disabled. Please contact support.";
            break;
          case 'auth/operation-not-allowed':
             errorMessage = "Email/password sign-in is not enabled for this Firebase project. Please enable it in the Firebase console (Authentication > Sign-in method).";
             break;
          default:
            // Keep the generic message for other unexpected Firebase errors
            break;
        }
      }

      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
      // Clear password field on any failed attempt for security
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
                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Log In"}
              </Button>
            </form>
          </Form>
          <div className="mt-6 text-center">
            <Button variant="link" onClick={handlePasswordReset} className="text-sm font-body text-muted-foreground px-0">
              Forgot Password?
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
