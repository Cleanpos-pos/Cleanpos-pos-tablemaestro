
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
import { Mail, Lock, UserPlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import Logo from "@/components/shared/Logo";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/config/firebase";
import Link from "next/link";

const signupFormSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string().min(6, { message: "Password must be at least 6 characters." })
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"], // path of error
});

export default function SignupForm() {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof signupFormSchema>>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof signupFormSchema>) {
    form.clearErrors();
    try {
      await createUserWithEmailAndPassword(auth, values.email, values.password);
      toast({
        title: "Sign Up Successful",
        description: "Your account has been created. Welcome!",
      });
      // When a new user signs up, we'll want to create their initial restaurant settings.
      // This will be handled in a subsequent step by a dedicated service or function.
      // For now, just redirect to the dashboard.
      router.push("/admin/dashboard");
    } catch (error: any) {
      let errorMessage = "Sign up failed. Please try again.";
      if (error && error.code) {
        if (error.code === 'auth/email-already-in-use') {
          errorMessage = "This email address is already in use. Please try a different email or login.";
          form.setError("email", { type: "manual", message: errorMessage });
        } else if (error.code === 'auth/weak-password') {
          errorMessage = "The password is too weak. Please choose a stronger password.";
          form.setError("password", { type: "manual", message: errorMessage });
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = "The email address is not valid.";
           form.setError("email", { type: "manual", message: errorMessage });
        }
      }
      toast({
        title: "Sign Up Failed",
        description: errorMessage,
        variant: "destructive",
      });
      if (error.code !== 'auth/email-already-in-use' && error.code !== 'auth/weak-password' && error.code !== 'auth/invalid-email') {
        // For generic errors, set error on both fields or a root error if supported
        form.setError("email", { type: "manual", message: " " }); 
        form.setError("password", { type: "manual", message: " " });
      }
      form.setValue("password","");
      form.setValue("confirmPassword","");
      console.error("Firebase signup error:", error);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <Card className="w-full max-w-md shadow-2xl rounded-xl form-interaction-animate">
        <CardHeader className="text-center p-8">
          <div className="inline-block mx-auto mb-6">
            <Logo size="lg" />
          </div>
          <CardTitle className="text-3xl font-headline">Create Your Account</CardTitle>
          <CardDescription className="font-body">
            Join Table Maestro V2 and manage your restaurant effortlessly.
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
                        <Input type="email" placeholder="e.g. manager@example.com" {...field} className="pl-10 font-body" />
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
                        <Input type="password" placeholder="•••••••• (min. 6 characters)" {...field} className="pl-10 font-body" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-body">Confirm Password</FormLabel>
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
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creating Account...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-5 w-5" /> Sign Up
                  </>
                )}
              </Button>
            </form>
          </Form>
          <p className="mt-6 text-center text-sm font-body text-muted-foreground">
            Already have an account?{" "}
            <Link href="/admin/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
