import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-8xl font-black text-gradient">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold">Offside — page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-mute">
        The page you are looking for was substituted. Head back to the pitch.
      </p>
      <Link href="/" className="btn-accent mt-8">
        Back to home
      </Link>
    </div>
  );
}
