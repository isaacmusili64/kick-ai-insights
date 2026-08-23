import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { postBySlug, postsNewestFirst } from "@/lib/blog-posts";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = postBySlug(params.slug);
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} — PitchModel` : "Blog — PitchModel" },
      {
        name: "description",
        content: loaderData?.description ?? "PitchModel blog",
      },
      { property: "og:title", content: loaderData?.title ?? "PitchModel blog" },
      {
        property: "og:description",
        content: loaderData?.description ?? "",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BlogPostPage,
});

function BlogPostPage() {
  const post = Route.useLoaderData();
  const others = postsNewestFirst().filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 pb-24">
      <Link to="/blog" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
        ← All posts
      </Link>

      <article className="space-y-6">
        <header className="space-y-3">
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <time dateTime={post.date}>
              {new Date(post.date + "T12:00:00").toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
            <span>·</span>
            <span>{post.readMinutes} min read</span>
          </div>
          <h1 className="text-3xl font-bold leading-tight">{post.title}</h1>
          <p className="text-base text-muted-foreground">{post.description}</p>
        </header>

        <div className="space-y-4 text-sm leading-relaxed text-foreground">
          {post.body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </article>

      {others.length ? (
        <section className="space-y-3 border-t border-border pt-8">
          <h2 className="text-sm font-bold">More from the blog</h2>
          <ul className="space-y-2">
            {others.map((p) => (
              <li key={p.slug}>
                <Link
                  to="/blog/$slug"
                  params={{ slug: p.slug }}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Questions?{" "}
        <Link to="/contact" className="font-medium text-foreground hover:underline">
          Contact us
        </Link>
        .
      </p>
    </main>
  );
}
