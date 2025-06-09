
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
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({
        title: "Login Successful",
        description: "Welcome back, Admin!",
      });
      router.push("/admin/dashboard");
    } catch (error: any) {
      console.error("Firebase login error:", error);
      let errorMessage = "Login failed. Please check your credentials and try again.";
      // You can customize error messages based on Firebase error codes if needed
      // For example: if (error.code === 'auth/wrong-password') { ... }
      // if (error.code === 'auth/user-not-found') { ... }
      // if (error.code === 'auth/invalid-credential') { ... } // Covers both wrong password and user not found for newer SDKs
      
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
      // Optionally set form errors if you want to highlight specific fields
      form.setError("email", { type: "manual", message: " " }); // Add a space to trigger error display without specific message
      form.setError("password", { type: "manual", message: " " });
      form.setValue("password",""); // Clear password field
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
