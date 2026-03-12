import { Suspense } from "react";
import { useForm } from "@tanstack/react-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import type { RouterOutputs } from "@prikkr/api";
import { CreateHouseholdSchema } from "@prikkr/db/schema";
import { cn } from "@prikkr/ui";
import { Button } from "@prikkr/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@prikkr/ui/field";
import { Input } from "@prikkr/ui/input";
import { toast } from "@prikkr/ui/toast";

import { AuthShowcase } from "~/component/auth-showcase";
import { useTRPC } from "~/lib/trpc";

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    const { trpc, queryClient } = context;
    void queryClient.prefetchQuery(trpc.household.all.queryOptions());
  },
  component: RouteComponent,
});

function RouteComponent() {
  return (
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
  );
}

function CreateHouseholdForm() {
  const trpc = useTRPC();

  const queryClient = useQueryClient();
  const createHousehold = useMutation(
    trpc.household.create.mutationOptions({
      onSuccess: async () => {
        form.reset();
        await queryClient.invalidateQueries(trpc.household.pathFilter());
      },
      onError: (err) => {
        toast.error(
          err.data?.code === "UNAUTHORIZED"
            ? "Je moet ingelogd zijn om een huishouden aan te maken"
            : "Aanmaken mislukt",
        );
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      name: "",
    },
    validators: {
      onSubmit: CreateHouseholdSchema,
    },
    onSubmit: (data) => createHousehold.mutate(data.value),
  });

  return (
    <form
      className="w-full max-w-2xl"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field
          name="name"
          children={(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldContent>
                  <FieldLabel htmlFor={field.name}>
                    Naam van het huishouden
                  </FieldLabel>
                </FieldContent>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={isInvalid}
                  placeholder="bijv. Studentenhuis de Wetering"
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        />
      </FieldGroup>
      <Button type="submit">Aanmaken</Button>
    </form>
  );
}

function HouseholdList() {
  const trpc = useTRPC();
  const { data: households } = useSuspenseQuery(
    trpc.household.all.queryOptions(),
  );

  if (households.length === 0) {
    return (
      <div className="relative flex w-full flex-col gap-4">
        <HouseholdCardSkeleton pulse={false} />
        <HouseholdCardSkeleton pulse={false} />
        <HouseholdCardSkeleton pulse={false} />

        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10">
          <p className="text-2xl font-bold text-white">Nog geen huishoudens</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {households.map((h) => {
        return <HouseholdCard key={h.id} household={h} />;
      })}
    </div>
  );
}

function HouseholdCard(props: {
  household: RouterOutputs["household"]["all"][number];
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const deleteHousehold = useMutation(
    trpc.household.delete.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.household.pathFilter());
      },
      onError: (err) => {
        toast.error(
          err.data?.code === "UNAUTHORIZED"
            ? "Je moet ingelogd zijn om een huishouden te verwijderen"
            : "Verwijderen mislukt",
        );
      },
    }),
  );

  return (
    <div className="bg-muted flex flex-row rounded-lg p-4">
      <div className="grow">
        <h2 className="text-primary text-2xl font-bold">
          {props.household.name}
        </h2>
        <p className="mt-2 text-sm">Code: {props.household.inviteCode}</p>
      </div>
      <div>
        <Button
          variant="ghost"
          className="text-primary cursor-pointer text-sm font-bold uppercase hover:bg-transparent hover:text-white"
          onClick={() => deleteHousehold.mutate({ householdId: props.household.id })}
        >
          Verwijder
        </Button>
      </div>
    </div>
  );
}

function HouseholdCardSkeleton(props: { pulse?: boolean }) {
  const { pulse = true } = props;
  return (
    <div className="bg-muted flex flex-row rounded-lg p-4">
      <div className="grow">
        <h2
          className={cn(
            "bg-primary w-1/4 rounded-sm text-2xl font-bold",
            pulse && "animate-pulse",
          )}
        >
          &nbsp;
        </h2>
        <p
          className={cn(
            "mt-2 w-1/3 rounded-sm bg-current text-sm",
            pulse && "animate-pulse",
          )}
        >
          &nbsp;
        </p>
      </div>
    </div>
  );
}
