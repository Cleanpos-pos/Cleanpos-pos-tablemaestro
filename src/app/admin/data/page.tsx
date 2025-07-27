
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Package, Tag } from "lucide-react";
import { getSyncedStripeProducts, type SyncedProduct } from "@/services/productService";
import { useToast } from "@/hooks/use-toast";

export default function StripeDataSyncPage() {
  const [products, setProducts] = useState<SyncedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedProducts = await getSyncedStripeProducts();
        setProducts(fetchedProducts);
        if (fetchedProducts.length === 0) {
            toast({
                title: "No Synced Products Found",
                description: "The Stripe extension may not be syncing data correctly. Check your webhook configuration in the Stripe dashboard.",
                variant: "destructive",
                duration: 10000,
            });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
        setError(errorMessage);
        toast({
          title: "Error Loading Stripe Data",
          description: `Could not retrieve products from Firestore: ${errorMessage}`,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [toast]);

  return (
    <div className="space-y-8">
        <h1 className="text-3xl font-headline text-foreground">Stripe Data Sync Status</h1>

        <Card className="shadow-lg rounded-xl">
            <CardHeader>
                <CardTitle className="font-headline flex items-center">
                    <Package className="mr-3 h-6 w-6 text-primary" />
                    Synced Products & Prices
                </CardTitle>
                <CardDescription className="font-body">
                    This page shows products and prices synced from Stripe to your Firestore database by the official Firebase Extension. If this list is empty, it indicates a configuration issue with your Stripe webhook.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-48">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="mt-4 font-body text-muted-foreground">Loading synced data from Firestore...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                        <AlertTriangle className="h-12 w-12 text-destructive" />
                        <h2 className="mt-4 text-xl font-headline text-destructive">Failed to Load Data</h2>
                        <p className="mt-2 font-body text-muted-foreground">{error}</p>
                    </div>
                ) : products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center p-4 rounded-lg bg-yellow-50 border border-yellow-300">
                        <AlertTriangle className="h-12 w-12 text-yellow-500" />
                        <h2 className="mt-4 text-xl font-headline text-yellow-700">No Synced Products Found in Firestore</h2>
                        <p className="mt-2 font-body text-yellow-600 max-w-2xl">
                            This means the Stripe Extension is not syncing data. Please verify your Stripe webhook configuration. Check the "Events" and "Logs" in your Stripe webhook dashboard for failures. Trigger a new sync by updating a product's description in Stripe.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {products.map(product => (
                            <div key={product.id} className="border p-4 rounded-md">
                                <h3 className="font-headline text-lg text-primary">{product.name}</h3>
                                <p className="text-sm text-muted-foreground">Product ID: {product.id}</p>
                                <p className="text-sm mt-1">{product.description}</p>
                                
                                <h4 className="font-body font-semibold mt-4 mb-2">Prices:</h4>
                                {product.prices.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Price ID</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Interval</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {product.prices.map(price => (
                                                <TableRow key={price.id}>
                                                    <TableCell><Badge variant="secondary">{price.id}</Badge></TableCell>
                                                    <TableCell>
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: price.currency }).format(price.unit_amount / 100)}
                                                    </TableCell>
                                                    <TableCell className="capitalize">{price.interval}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No active prices found for this product.</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
