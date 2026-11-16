import { Button } from "@/components/ui/button";

/** Downloads the current list as a CSV file (admins only — the server checks too). */
export function ExportButton({ href, label = "Export CSV" }: { href: string; label?: string }) {
  return (
    <Button variant="outline" asChild>
      {/* A plain link: the browser downloads the file the server sends back. */}
      <a href={href} download>
        {label}
      </a>
    </Button>
  );
}
