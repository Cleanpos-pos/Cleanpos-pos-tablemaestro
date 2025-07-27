
import { db } from '@/config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export interface SyncedPrice {
    id: string;
    active: boolean;
    currency: string;
    description: string | null;
    type: 'one_time' | 'recurring';
    interval: string | null;
    interval_count: number | null;
    unit_amount: number;
}

export interface SyncedProduct {
    id: string;
    active: boolean;
    name: string;
    description: string;
    prices: SyncedPrice[];
}

/**
 * Fetches products and their prices that have been synced from Stripe
 * to Firestore by the Firebase Extension.
 * It checks both 'products' and 'subscription' collections.
 */
export const getSyncedStripeProducts = async (): Promise<SyncedProduct[]> => {
    const products: SyncedProduct[] = [];
    const collectionsToSearch = ['products', 'subscription'];

    for (const collectionName of collectionsToSearch) {
        try {
            const productsQuery = query(collection(db, collectionName), where('active', '==', true));
            const productsSnapshot = await getDocs(productsQuery);

            for (const productDoc of productsSnapshot.docs) {
                const productData = productDoc.data();
                const prices: SyncedPrice[] = [];

                const pricesQuery = query(collection(productDoc.ref, 'prices'), where('active', '==', true));
                const pricesSnapshot = await getDocs(pricesQuery);
                
                pricesSnapshot.forEach(priceDoc => {
                    const priceData = priceDoc.data();
                    prices.push({
                        id: priceDoc.id,
                        active: priceData.active,
                        currency: priceData.currency,
                        description: priceData.description || null,
                        type: priceData.type,
                        interval: priceData.interval || null,
                        interval_count: priceData.interval_count || null,
                        unit_amount: priceData.unit_amount || 0,
                    });
                });

                products.push({
                    id: productDoc.id,
                    active: productData.active,
                    name: productData.name,
                    description: productData.description,
                    prices: prices,
                });
            }
        } catch (error) {
            console.warn(`[productService] Could not query '${collectionName}' collection. It might not exist or there's a permissions issue. Error: ${error instanceof Error ? error.message : String(error)}`);
            // Continue to the next collection
        }
    }
    
    return products;
}
