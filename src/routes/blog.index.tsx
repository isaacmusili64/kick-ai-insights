import { createFileRoute, Link } from "@tanstack/react-router";

import { postsNewestFirst } from "@/lib/blog-posts";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog — PitchModel" },
      {
        name: "description",
        content:
          "Explainers on the PitchModel football prediction engine, model edge and responsible use of statistical forecasts.",
      },
      { property: "og:title", content: "Blog — PitchModel" },
      {
        property: "og:description",
        content: "How the model works, how to read edge, and responsible use of predictions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const posts = postsNewestFirst();

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 pb-24">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Blog</p>
        <h1 className="mt-1 text-2xl font-bold">Notes from the model</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Short explainers on how PitchModel prices matches, reads edge and keeps a public track
          record. Not tip sheets.
        </p>
      </header>

      <ul className="space-y-4">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              to="/blog/$slug"
              params={{ slug: post.slug }}
              className="card-surface block space-y-2 p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <time dateTime={post.date}>
                  {new Date(post.date + "T12:00:00").toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </time>
                <span>·</span>
                <span>{post.readMinutes} min read</span>
                {post.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border px-2 py-0.5 font-semibold text-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <h2 className="text-lg font-bold text-foreground">{post.title}</h2>
              <p className="text-sm text-muted-foreground">{post.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
