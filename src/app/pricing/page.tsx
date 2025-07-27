
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import Link from "next/link";
import Logo from "@/components/shared/Logo";

const plans = [
  {
    name: "Basic",
    price: "$49",
    pricePeriod: "/ month",
    description: "Perfect for small restaurants getting started.",
    features: [
      "Booking Management",
      "Table Management",
      "Customer Database",
      "Basic Analytics",
    ],
    cta: "Get Started",
    href: "/signup?plan=basic",
  },
  {
    name: "Pro",
    price: "$99",
    pricePeriod: "/ month",
    description: "For growing restaurants that need more power and features.",
    features: [
      "Everything in Basic",
      "AI Waitlist Assistant",
      "Advanced Analytics",
      "Email Customization",
      "Priority Support",
    ],
    cta: "Choose Pro",
    href: "/signup?plan=pro",
    isPopular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    pricePeriod: "",
    description: "Tailored solutions for large chains and franchises.",
    features: [
      "Everything in Pro",
      "Dedicated Account Manager",
      "Custom Integrations",
      "API Access",
      "On-site Training",
    ],
    cta: "Contact Us",
    href: "/contact",
  },
];

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="p-4 border-b">
        <div className="container mx-auto">
           <Logo href="/" />
        </div>
      </header>
      <main className="flex-grow">
        <section className="py-12 md:py-20 bg-muted/30">
          <div className="container mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-headline text-foreground">
              Find the Perfect Plan for Your Restaurant
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto font-body">
              Whether you're just starting out or running a multi-location enterprise, we have a plan that fits your needs.
            </p>
          </div>
        </section>

        <section className="py-12 md:py-20">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan) => (
                <Card
                  key={plan.name}
                  className={`flex flex-col shadow-lg rounded-xl transition-transform duration-300 hover:scale-105 ${plan.isPopular ? 'border-primary border-2 ring-4 ring-primary/10' : ''}`}
                >
                  <CardHeader className="text-center">
                    {plan.isPopular && (
                        <div className="mb-4">
                            <span className="inline-block bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full uppercase">Most Popular</span>
                        </div>
                    )}
                    <CardTitle className="text-3xl font-headline">{plan.name}</CardTitle>
                    <CardDescription className="font-body h-12">{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <div className="text-center mb-6">
                      <span className="text-5xl font-bold font-headline">{plan.price}</span>
                      <span className="text-muted-foreground font-body">{plan.pricePeriod}</span>
                    </div>
                    <ul className="space-y-4">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center font-body">
                          <Check className="h-5 w-5 text-green-500 mr-3 shrink-0" />
                          <span className="text-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button asChild className="w-full text-lg py-6 btn-subtle-animate" variant={plan.isPopular ? "default" : "outline"}>
                      <Link href={plan.href}>{plan.cta}</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="text-center py-6 text-muted-foreground text-sm font-body border-t">
        <p>&copy; {new Date().getFullYear()} Table Maestro V2. All rights reserved.</p>
      </footer>
    </div>
  );
}
