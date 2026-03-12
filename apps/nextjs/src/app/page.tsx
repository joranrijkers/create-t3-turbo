import { Suspense } from "react";

import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { AuthShowcase } from "./_components/auth-showcase";
import {
  CreateHouseholdForm,
  HouseholdCardSkeleton,
  HouseholdList,
} from "./_components/posts";

export default function HomePage() {
  prefetch(trpc.household.all.queryOptions());

  return (
    <HydrateClient>
      <main className="container h-screen py-16">
        <div className="flex flex-col items-center justify-center gap-4">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            <span className="text-primary">Prikkr</span>
          </h1>
          <AuthShowcase />

          <CreateHouseholdForm />
          <div className="w-full max-w-2xl overflow-y-scroll">
            <Suspense
              fallback={
                <div className="flex w-full flex-col gap-4">
                  <HouseholdCardSkeleton />
                  <HouseholdCardSkeleton />
                  <HouseholdCardSkeleton />
                </div>
              }
            >
              <HouseholdList />
            </Suspense>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
