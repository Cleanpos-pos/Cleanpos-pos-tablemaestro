
"use client";

import SignupForm from "@/components/auth/SignupForm";
import { useSearchParams } from 'next/navigation';
import React from 'react';

// A simple wrapper to make reading search params client-side easier
function SignupPageContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  
  return <SignupForm selectedPlan={plan} />;
}


export default function SignupPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <SignupPageContent />
    </React.Suspense>
  );
}
