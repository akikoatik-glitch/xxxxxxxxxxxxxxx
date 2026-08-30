export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function WebSiteJsonLd({
  name,
  url,
  description
}: {
  name: string;
  url: string;
  description: string;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name,
        url,
        description,
        potentialAction: {
          "@type": "SearchAction",
          target: `${url}/predictions?q={search_term_string}`,
          "query-input": "required name=search_term_string"
        }
      }}
    />
  );
}

export function SportsEventJsonLd({
  name,
  startDate,
  location,
  homeTeam,
  awayTeam,
  url
}: {
  name: string;
  startDate: string;
  location: string;
  homeTeam: string;
  awayTeam: string;
  url: string;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "SportsEvent",
        name,
        startDate,
        eventStatus: "https://schema.org/EventScheduled",
        location: { "@type": "Place", name: location },
        competitor: [
          { "@type": "SportsTeam", name: homeTeam },
          { "@type": "SportsTeam", name: awayTeam }
        ],
        url
      }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: Array<{ name: string; url: string }> }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          item: item.url
        }))
      }}
    />
  );
}

export function ItemListJsonLd({ items }: { items: Array<{ name: string; url: string }> }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        numberOfItems: items.length,
        itemListElement: items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          url: item.url
        }))
      }}
    />
  );
}

export function SportsTeamJsonLd({
  name,
  url,
  sport = "Soccer",
  address
}: {
  name: string;
  url: string;
  sport?: string;
  address?: string;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "SportsTeam",
        name,
        sport,
        url,
        ...(address ? { arena: { "@type": "Place", name: address } } : {})
      }}
    />
  );
}
