
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Save, MailCheck, Send, Loader2, AlertTriangle, ListChecks, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { EmailTemplateInput } from "@/lib/types";
import { useEffect, useState, useCallback } from "react";
import { getEmailTemplate, saveEmailTemplate, BOOKING_CONFIRMATION_TEMPLATE_ID, defaultBookingConfirmationTemplatePlaceholders } from "@/services/templateService";
import { auth } from "@/config/firebase";

const emailTemplateFormSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters.").max(200, "Subject too long."),
  body: z.string().min(20, "Body must be at least 20 characters.").max(5000, "Body too long."),
});

type EmailTemplateFormValues = z.infer<typeof emailTemplateFormSchema>;

const placeholderDescriptions: Record<string, string> = {
  '{{guestName}}': "The full name of the guest who made the booking.",
  '{{bookingDate}}': "The date of the reservation (e.g., July 26, 2024).",
  '{{bookingTime}}': "The time of the reservation (e.g., 07:00 PM).",
  '{{partySize}}': "The number of guests in the booking.",
  '{{restaurantName}}': "The name of your restaurant, as configured in settings.",
  '{{notes}}': "Any special notes or requests included with the booking. Use with {{#if notes}} ... {{/if}} for conditional display.",
};


export default function EmailTemplatePage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);

  const form = useForm<EmailTemplateFormValues>({
    resolver: zodResolver(emailTemplateFormSchema),
    defaultValues: {
      subject: "",
      body: "",
    },
  });

  const fetchTemplate = useCallback(async () => {
    if (!auth.currentUser) {
        console.log("[EmailTemplatePage] Fetch blocked: User not authenticated yet.");
        setIsUserAuthenticated(false);
        setIsLoading(false);
        form.reset({subject: "Please log in to manage templates", body: "Log in to view and edit the booking confirmation email template."});
        return;
    }
    setIsUserAuthenticated(true);
    setIsLoading(true);
    try {
      const template = await getEmailTemplate(BOOKING_CONFIRMATION_TEMPLATE_ID);
      form.reset({ subject: template.subject, body: template.body });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Error Loading Template",
        description: `Could not load the email template: ${errorMessage}`,
        variant: "destructive",
      });
      form.reset({ subject: "Error loading subject", body: "Error loading body" });
    } finally {
      setIsLoading(false);
    }
  }, [form, toast]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchTemplate();
      } else {
        setIsUserAuthenticated(false);
        setIsLoading(false);
        form.reset({subject: "Please log in", body: "Log in to manage email templates."});
      }
    });
    return () => unsubscribe();
  }, [fetchTemplate]);

  async function onSubmit(values: EmailTemplateFormValues) {
    if (!isUserAuthenticated) {
      toast({ title: "Not Authenticated", description: "Please log in to save the template.", variant: "destructive"});
      return;
    }
    setIsSaving(true);
    try {
      await saveEmailTemplate(BOOKING_CONFIRMATION_TEMPLATE_ID, values);
      toast({
        title: "Template Saved",
        description: "The booking confirmation email template has been updated.",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Save Failed",
        description: `Could not save the template: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  const handleSendTestEmail = () => {
    toast({
      title: "Test Email",
      description: "Send test email functionality is not yet implemented. Your template changes (if any) should be saved first.",
      duration: 5000,
    });
  };

  if (isLoading && isUserAuthenticated) { // Only show full page loader if we expect data
    return (
      <div className="flex justify-center items-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg font-body">Loading template...</p>
      </div>
    );
  }
  
  if (!isUserAuthenticated && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-headline mb-2">Authentication Required</h2>
        <p className="font-body text-muted-foreground">
          Please log in to manage email templates.
        </p>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-headline text-foreground">Customize Email Templates</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline flex items-center">
              <MailCheck className="mr-3 h-6 w-6 text-primary" />
              Booking Confirmation Email
            </CardTitle>
            <CardDescription className="font-body">
              Edit the content of the email sent to guests when their booking is confirmed.
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-body text-base">Email Subject</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Your booking at {{restaurantName}} is confirmed!" className="font-body" disabled={isLoading || isSaving || !isUserAuthenticated} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="body"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-body text-base">Email Body</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Enter your email content here. Use placeholders like {{guestName}}."
                          className="font-body min-h-[300px] lg:min-h-[400px] text-sm leading-relaxed"
                          disabled={isLoading || isSaving || !isUserAuthenticated}
                        />
                      </FormControl>
                       <FormDescription className="font-body text-xs">
                        Supports basic Handlebars-like syntax for placeholders.
                        For notes, use <code>{"{{#if notes}}Special Requests: {{notes}}{{/if}}"}</code> to conditionally show the section.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row justify-end gap-3 pt-6">
                <Button type="button" variant="outline" onClick={handleSendTestEmail} className="font-body w-full sm:w-auto btn-subtle-animate" disabled={isLoading || isSaving || !isUserAuthenticated}>
                  <Send className="mr-2 h-4 w-4" /> Send Test Email
                </Button>
                <Button type="submit" className="font-body w-full sm:w-auto btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading || isSaving || !isUserAuthenticated}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" /> Save Template
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>

        <Card className="lg:col-span-1 shadow-lg rounded-xl h-fit">
          <CardHeader>
            <CardTitle className="font-headline flex items-center">
              <ListChecks className="mr-3 h-6 w-6 text-primary" />
              Available Placeholders
            </CardTitle>
            <CardDescription className="font-body">
              Use these placeholders in your subject and body. They will be replaced with actual booking data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {defaultBookingConfirmationTemplatePlaceholders.map((placeholder) => (
                <li key={placeholder}>
                  <p className="font-mono text-sm text-accent bg-accent/10 px-2 py-1 rounded-md inline-block">{placeholder}</p>
                  <p className="text-xs text-muted-foreground font-body mt-1">{placeholderDescriptions[placeholder] || "No description available."}</p>
                </li>
              ))}
            </ul>
            <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-start">
                    <Info className="h-5 w-5 text-blue-600 mr-2 shrink-0 mt-0.5" />
                    <p className="text-xs font-body text-blue-700">
                        The actual replacement of these placeholders and email sending will occur when the booking confirmation process is triggered (e.g., from the booking form or admin panel).
                    </p>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
