
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, MailCheck, Send, Loader2, AlertTriangle, ListChecks, Info, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { EmailTemplateInput } from "@/lib/types";
import React, { useEffect, useState, useCallback } from "react";
import { 
  getEmailTemplate, 
  saveEmailTemplate, 
  BOOKING_ACCEPTED_TEMPLATE_ID,
  defaultBookingAcceptedPlaceholders,
  NO_AVAILABILITY_TEMPLATE_ID,
  defaultNoAvailabilityPlaceholders,
  WAITING_LIST_TEMPLATE_ID,
  defaultWaitingListPlaceholders
} from "@/services/templateService";
import { auth } from "@/config/firebase";
import { sendTestEmailAction } from "@/app/actions/emailActions"; // Import the server action
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


const emailTemplateFormSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters.").max(200, "Subject too long."),
  body: z.string().min(20, "Body must be at least 20 characters.").max(5000, "Body too long."),
});

type EmailTemplateFormValues = z.infer<typeof emailTemplateFormSchema>;

interface TemplateConfig {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  defaultPlaceholders: string[];
  placeholderDetails: Record<string, string>;
}

const commonPlaceholderDetails: Record<string, string> = {
  '{{guestName}}': "The full name of the guest.",
  '{{restaurantName}}': "The name of your restaurant, as configured in settings.",
};

const templateConfigurations: TemplateConfig[] = [
  {
    id: BOOKING_ACCEPTED_TEMPLATE_ID,
    label: "Booking Accepted",
    description: "Email sent when a guest's booking is confirmed.",
    icon: MailCheck,
    defaultPlaceholders: defaultBookingAcceptedPlaceholders,
    placeholderDetails: {
      ...commonPlaceholderDetails,
      '{{bookingDate}}': "The date of the reservation (e.g., July 26, 2024).",
      '{{bookingTime}}': "The time of the reservation (e.g., 07:00 PM).",
      '{{partySize}}': "The number of guests in the booking.",
      '{{notes}}': "Any special notes or requests. Use {{#if notes}} ... {{/if}} for conditional display.",
    }
  },
  {
    id: NO_AVAILABILITY_TEMPLATE_ID,
    label: "No Availability",
    description: "Email sent when a requested booking slot is not available.",
    icon: FileText,
    defaultPlaceholders: defaultNoAvailabilityPlaceholders,
    placeholderDetails: {
        ...commonPlaceholderDetails,
        '{{requestedDate}}': "The originally requested date for the booking.",
        '{{requestedTime}}': "The originally requested time for the booking.",
        '{{requestedPartySize}}': "The originally requested party size.",
    }
  },
  {
    id: WAITING_LIST_TEMPLATE_ID,
    label: "Waiting List Confirmation",
    description: "Email sent when a guest is added to the waiting list.",
    icon: ListChecks,
    defaultPlaceholders: defaultWaitingListPlaceholders,
    placeholderDetails: {
        ...commonPlaceholderDetails,
        '{{requestedDate}}': "The date the guest wishes to dine.",
        '{{requestedTime}}': "The approximate time the guest wishes to dine.",
        '{{partySize}}': "The number of guests in their party.",
        '{{estimatedWaitTime}}': "An estimated wait time (e.g., '30-45 minutes').",
    }
  }
];

export default function EmailTemplatePage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState<string>(templateConfigurations[0].id);
  const [currentPlaceholders, setCurrentPlaceholders] = useState<string[]>(templateConfigurations[0].defaultPlaceholders);
  const [currentPlaceholderDetails, setCurrentPlaceholderDetails] = useState<Record<string, string>>(templateConfigurations[0].placeholderDetails);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [isTestEmailDialogOpen, setIsTestEmailDialogOpen] = useState(false);


  const form = useForm<EmailTemplateFormValues>({
    resolver: zodResolver(emailTemplateFormSchema),
    defaultValues: {
      subject: "",
      body: "",
    },
  });

  const fetchTemplate = useCallback(async (templateIdToFetch: string) => {
    if (!auth.currentUser) {
      console.log(`[EmailTemplatePage] Fetch blocked for ${templateIdToFetch}: User not authenticated yet.`);
      setIsUserAuthenticated(false);
      setIsLoading(false);
      form.reset({ subject: "Please log in to manage templates", body: "Log in to view and edit email templates." });
      return;
    }
    setIsUserAuthenticated(true);
    setIsLoading(true);
    try {
      const template = await getEmailTemplate(templateIdToFetch);
      form.reset({ subject: template.subject, body: template.body });
      const config = templateConfigurations.find(tc => tc.id === templateIdToFetch);
      setCurrentPlaceholders(config?.defaultPlaceholders || []);
      setCurrentPlaceholderDetails(config?.placeholderDetails || {});
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
        setTestEmailAddress(user.email || ""); // Pre-fill test email with user's email
        fetchTemplate(currentTemplateId); 
      } else {
        setIsUserAuthenticated(false);
        setIsLoading(false);
        form.reset({subject: "Please log in", body: "Log in to manage email templates."});
      }
    });
    return () => unsubscribe();
  }, [fetchTemplate, currentTemplateId]); 

  const handleTabChange = (newTemplateId: string) => {
    setCurrentTemplateId(newTemplateId);
    if (isUserAuthenticated) {
      fetchTemplate(newTemplateId);
    } else {
      const config = templateConfigurations.find(tc => tc.id === newTemplateId);
      setCurrentPlaceholders(config?.defaultPlaceholders || []);
      setCurrentPlaceholderDetails(config?.placeholderDetails || {});
      form.reset({subject: "Please log in", body: "Log in to manage email templates for this type."});
    }
  };

  async function onSubmit(values: EmailTemplateFormValues) {
    if (!isUserAuthenticated) {
      toast({ title: "Not Authenticated", description: "Please log in to save the template.", variant: "destructive"});
      return;
    }
    setIsSaving(true);
    try {
      await saveEmailTemplate(currentTemplateId, values);
      toast({
        title: "Template Saved",
        description: `The "${templateConfigurations.find(t=>t.id === currentTemplateId)?.label}" email template has been updated.`,
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

  const handleActualSendTestEmail = async () => {
    if (!isUserAuthenticated) {
      toast({ title: "Not Authenticated", description: "Please log in.", variant: "destructive" });
      return;
    }
    if (!testEmailAddress) {
      toast({ title: "Recipient Missing", description: "Please enter an email address to send the test to.", variant: "destructive" });
      return;
    }
    if (!currentTemplateId) {
        toast({ title: "Template Error", description: "No template selected to send.", variant: "destructive" });
        return;
    }

    setIsSendingTest(true);
    setIsTestEmailDialogOpen(false); // Close dialog before sending

    // Save current form state before sending test, in case of unsaved changes
    // This is optional, or you could prompt the user to save first.
    // For simplicity, we'll send with the current *loaded* or *saved* template content.
    // If you want to send with *unsaved* form content, you'd pass form.getValues()
    // to the action, which would require the action to accept subject/body directly.
    // For now, it fetches the saved template.

    toast({
      title: `Sending Test Email...`,
      description: `For template: "${templateConfigurations.find(t => t.id === currentTemplateId)?.label}" to ${testEmailAddress}. Please wait.`,
    });

    try {
      const result = await sendTestEmailAction(currentTemplateId, testEmailAddress);
      if (result.success) {
        toast({
          title: "Test Email Sent!",
          description: result.message,
        });
      } else {
        toast({
          title: "Test Email Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown client-side error occurred.";
      toast({
        title: "Test Email Error",
        description: `Could not send test email: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsSendingTest(false);
    }
  };
  
  const ActiveIcon = templateConfigurations.find(t => t.id === currentTemplateId)?.icon || MailCheck;


  if (isLoading && isUserAuthenticated) {
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
      
      <Tabs value={currentTemplateId} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto sm:h-10">
          {templateConfigurations.map(template => (
            <TabsTrigger key={template.id} value={template.id} className="font-body py-2 sm:py-1.5">
              <template.icon className="mr-2 h-4 w-4 hidden sm:inline-block" />
              {template.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {templateConfigurations.map(template => (
          <TabsContent key={template.id} value={template.id}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-2 shadow-lg rounded-xl">
                <CardHeader>
                  <CardTitle className="font-headline flex items-center">
                    <ActiveIcon className="mr-3 h-6 w-6 text-primary" />
                    Edit: {template.label}
                  </CardTitle>
                  <CardDescription className="font-body">
                    {template.description} Ensure your Brevo API key is in `.env` and sender email is configured in Brevo and in `sendEmailFlow.ts`.
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
                              <Input {...field} placeholder="Enter email subject" className="font-body" disabled={isLoading || isSaving || !isUserAuthenticated} />
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
                                className="font-body min-h-[300px] lg:min-h-[350px] text-sm leading-relaxed"
                                disabled={isLoading || isSaving || !isUserAuthenticated}
                              />
                            </FormControl>
                            <FormDescription className="font-body text-xs">
                              Supports basic placeholder syntax.
                              Use <code>{"{{#if fieldName}}Content with {{fieldName}}{{/if}}"}</code> for conditional display of optional fields.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row justify-end gap-3 pt-6">
                       <AlertDialog open={isTestEmailDialogOpen} onOpenChange={setIsTestEmailDialogOpen}>
                        <AlertDialogTrigger asChild>
                           <Button type="button" variant="outline" className="font-body w-full sm:w-auto btn-subtle-animate" disabled={isLoading || isSaving || isSendingTest || !isUserAuthenticated}>
                             <Send className="mr-2 h-4 w-4" /> Send Test Email
                           </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="font-headline">Send Test Email</AlertDialogTitle>
                            <AlertDialogDescription className="font-body">
                              Enter the email address to send a test of the "{templateConfigurations.find(t=>t.id === currentTemplateId)?.label}" template to.
                              The template content used will be the **last saved version**.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <Input 
                            type="email"
                            placeholder="recipient@example.com"
                            value={testEmailAddress}
                            onChange={(e) => setTestEmailAddress(e.target.value)}
                            className="font-body mt-2"
                          />
                          <AlertDialogFooter>
                            <AlertDialogCancel className="font-body">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleActualSendTestEmail} className="font-body" disabled={isSendingTest}>
                              {isSendingTest ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : "Send Test"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <Button type="submit" className="font-body w-full sm:w-auto btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading || isSaving || isSendingTest || !isUserAuthenticated}>
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
                    For the "{template.label}" template.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {currentPlaceholders.length > 0 ? (
                    <ul className="space-y-3">
                      {currentPlaceholders.map((placeholder) => (
                        <li key={placeholder}>
                          <p className="font-mono text-sm text-accent bg-accent/10 px-2 py-1 rounded-md inline-block">{placeholder}</p>
                          <p className="text-xs text-muted-foreground font-body mt-1">{currentPlaceholderDetails[placeholder] || "No description available."}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="font-body text-muted-foreground">No specific placeholders for this template type, or they are still loading.</p>
                  )}
                   <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="flex items-start">
                          <Info className="h-5 w-5 text-blue-600 mr-2 shrink-0 mt-0.5" />
                          <p className="text-xs font-body text-blue-700">
                              The "Send Test Email" feature uses the **last saved version** of the template.
                              Ensure your Brevo API key is correctly set in the `.env` file (requires server restart after adding/changing).
                              The sender email is currently hardcoded in `sendEmailFlow.ts` as `{DEFAULT_SENDER_EMAIL}`; ensure this is a verified sender in your Brevo account.
                          </p>
                      </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

