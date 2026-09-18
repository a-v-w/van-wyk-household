"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useTransition } from "react";
import {
  archiveRecipe,
  saveRecipe,
  type RecipeFormState,
} from "@/app/actions/recipes";
import { Field, buttonClass, cn, inputClass } from "@/components/ui";

export type RecipeValues = {
  id: number | null;
  title: string;
  summary: string;
  servings: string;
  prepMinutes: string;
  ingredients: string;
  method: string;
  sourceUrl: string;
};

export function RecipeEditor({
  values,
  returnTo,
  canArchive = true,
}: {
  values: RecipeValues;
  /** Where Cancel and a successful save land. */
  returnTo: string;
  canArchive?: boolean;
}) {
  const router = useRouter();
  const [state, action, saving] = useActionState<RecipeFormState, FormData>(
    saveRecipe,
    undefined,
  );
  const [archiving, startArchive] = useTransition();

  useEffect(() => {
    if (state?.ok) router.push(returnTo);
  }, [state, router, returnTo]);

  return (
    <form action={action} className="flex flex-col gap-5">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <Field label="Name">
        <input
          id="title"
          name="title"
          required
          defaultValue={values.title}
          placeholder="Chicken pie"
          className={cn(inputClass, "font-semibold")}
        />
      </Field>

      <Field label="One-line summary" hint="Shown in the list of recipes.">
        <input
          id="summary"
          name="summary"
          defaultValue={values.summary}
          placeholder="Freezes well, feeds four"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Serves">
          <input
            id="servings"
            name="servings"
            defaultValue={values.servings}
            placeholder="4, or 2 adults and 2 children"
            className={inputClass}
          />
        </Field>
        <Field label="Time (minutes)">
          <input
            id="prepMinutes"
            name="prepMinutes"
            type="number"
            min={0}
            max={600}
            defaultValue={values.prepMinutes}
            className={cn(inputClass, "max-w-36")}
          />
        </Field>
      </div>

      <Field label="Ingredients" hint="One per line.">
        <textarea
          id="ingredients"
          name="ingredients"
          rows={7}
          defaultValue={values.ingredients}
          placeholder={"500 g chicken breast\n1 onion, chopped\n2 cups stock"}
          className={cn(inputClass, "resize-y font-mono text-[13px]")}
        />
      </Field>

      <Field
        label="Method"
        hint="One step per paragraph, or number them. They are numbered automatically in the kitchen."
      >
        <textarea
          id="method"
          name="method"
          rows={10}
          defaultValue={values.method}
          placeholder={
            "Heat the oven to 180°.\n\nFry the onion until soft, about five minutes.\n\nAdd the chicken and brown all over."
          }
          className={cn(inputClass, "resize-y")}
        />
      </Field>

      <Field label="Link" hint="Optional, if the recipe lives on a website.">
        <input
          id="sourceUrl"
          name="sourceUrl"
          defaultValue={values.sourceUrl}
          placeholder="example.com/chicken-pie"
          className={inputClass}
        />
      </Field>

      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className={buttonClass("primary")}
        >
          {saving ? "Saving…" : values.id ? "Save changes" : "Add the recipe"}
        </button>
        <button
          type="button"
          onClick={() => router.push(returnTo)}
          className={buttonClass("ghost")}
        >
          Cancel
        </button>
        {values.id && canArchive ? (
          <button
            type="button"
            disabled={archiving}
            onClick={() =>
              startArchive(async () => {
                await archiveRecipe(values.id as number);
                router.push(returnTo);
              })
            }
            className={buttonClass("danger", "md", "ml-auto")}
          >
            Archive
          </button>
        ) : null}
      </div>
    </form>
  );
}
