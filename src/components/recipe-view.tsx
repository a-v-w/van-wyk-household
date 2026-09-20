import { Chip, IconClock } from "@/components/ui";

/**
 * A recipe shaped for reading. The ingredient lines and method steps are
 * split on the server (see `@/lib/page-data/recipe-detail`), so this can
 * render on the client without touching `@/lib/recipes`.
 */
export type RecipeReading = {
  title: string;
  summary: string | null;
  servings: string | null;
  prepMinutes: number | null;
  ingredients: string[];
  steps: string[];
  /** The source link, only when it is one we are willing to render. */
  link: string | null;
};

/** The recipe as the person cooking reads it. Used on both sides of the app. */
export function RecipeView({ recipe }: { recipe: RecipeReading }) {
  const { ingredients, steps, link } = recipe;

  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl leading-tight font-extrabold tracking-tight">
          {recipe.title}
        </h1>
        {recipe.summary ? (
          <p className="text-[15px] text-ink-2">{recipe.summary}</p>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {recipe.servings ? <Chip>Serves {recipe.servings}</Chip> : null}
          {recipe.prepMinutes ? (
            <Chip>
              <IconClock size={13} />
              {recipe.prepMinutes} min
            </Chip>
          ) : null}
        </div>
      </header>

      {ingredients.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="label">Ingredients</h2>
          <ul className="flex flex-col gap-1.5">
            {ingredients.map((line, index) => (
              <li
                key={`${index}-${line}`}
                className="flex gap-2.5 text-[15px] leading-snug"
              >
                <span aria-hidden="true" className="text-accent">
                  •
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {steps.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="label">Method</h2>
          <ol className="flex flex-col gap-3">
            {steps.map((step, index) => (
              <li
                key={`${index}-${step.slice(0, 12)}`}
                className="flex gap-3 text-[15px] leading-relaxed"
              >
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-bold text-accent">
                  {index + 1}
                </span>
                <span className="whitespace-pre-line">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {link ? (
        <p className="text-sm">
          <a
            href={link}
            target="_blank"
            rel="noreferrer noopener"
            className="font-semibold text-accent underline underline-offset-2"
          >
            Open the original recipe
          </a>
        </p>
      ) : null}

      {ingredients.length === 0 && steps.length === 0 && !link ? (
        <p className="text-sm text-muted">
          Nothing written down for this one yet.
        </p>
      ) : null}
    </article>
  );
}
