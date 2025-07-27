
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, MessageSquare, Loader2, Bug, Lightbulb, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ForumPost, ForumPostInput } from "@/lib/types";
import { useEffect, useState, useCallback } from "react";
import { createForumPostAction, getMyForumPostsAction } from "@/app/actions/forumActions";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

const forumPostSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters long.").max(100, "Title is too long."),
  content: z.string().min(20, "Please provide more details.").max(5000, "Content is too long."),
  type: z.enum(['bug', 'feature'], { required_error: "You must select a post type." }),
});

type ForumPostFormValues = z.infer<typeof forumPostSchema>;

export default function ForumPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [posts, setPosts] = useState<ForumPost[]>([]);

  const form = useForm<ForumPostFormValues>({
    resolver: zodResolver(forumPostSchema),
    defaultValues: {
      title: "",
      content: "",
      type: "feature",
    },
  });

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const myPosts = await getMyForumPostsAction();
      setPosts(myPosts);
    } catch (error) {
      console.error("Failed to fetch forum posts:", error);
      toast({
        title: "Error",
        description: `Could not load your posts: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  async function onSubmit(values: ForumPostFormValues) {
    setIsSubmitting(true);
    try {
      const result = await createForumPostAction(values);
      if (result.success) {
        toast({
          title: "Post Submitted",
          description: "Thank you for your feedback! Your post has been submitted.",
        });
        form.reset();
        await fetchPosts(); // Refresh the list of posts
      } else {
        toast({
          title: "Submission Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const statusColors: Record<ForumPost['status'], string> = {
    open: "bg-blue-500",
    "in-progress": "bg-yellow-500 text-yellow-900",
    closed: "bg-green-500",
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-headline text-foreground">Feedback Forum</h1>
      <p className="text-muted-foreground font-body">
        Have a bug to report or an idea for a new feature? Let us know here!
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 shadow-lg rounded-xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader>
                <CardTitle className="font-headline flex items-center">
                  <MessageSquare className="mr-3 h-6 w-6 text-primary" />
                  Submit Your Feedback
                </CardTitle>
                <CardDescription className="font-body">
                  Your suggestions help us improve Table Maestro for everyone.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type of Feedback</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a type..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="feature"><Lightbulb className="mr-2 h-4 w-4 inline-block" />Feature Request</SelectItem>
                          <SelectItem value="bug"><Bug className="mr-2 h-4 w-4 inline-block" />Bug Report</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Add support for split payments" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Details</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the bug or feature in detail. What did you expect to happen? What happened instead?"
                          className="min-h-[150px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" /> Submit Feedback
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
              <History className="mr-3 h-6 w-6 text-primary" />
              Your Submission History
            </CardTitle>
            <CardDescription className="font-body">
              A list of your previously submitted feedback.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading posts...
              </div>
            ) : posts.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">You haven't submitted any feedback yet.</p>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {posts.map(post => (
                  <div key={post.id} className="p-3 border rounded-md bg-muted/30">
                    <div className="flex justify-between items-start">
                      <p className="font-semibold text-sm truncate pr-2">{post.title}</p>
                       <Badge className={`${statusColors[post.status]} text-white capitalize text-xs`}>{post.status}</Badge>
                    </div>
                    <div className="flex justify-between items-end mt-2">
                      <p className="text-xs text-muted-foreground capitalize">
                        {post.type === 'bug' ? <Bug className="inline h-3 w-3 mr-1" /> : <Lightbulb className="inline h-3 w-3 mr-1" />}
                        {post.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(post.createdAt))} ago
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
