import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center p-8" style={{ minHeight: "calc(100vh - 3.5rem)" }}>
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold text-pm-text mb-4">
          BusinessOS
        </h1>
        <p className="text-xl text-pm-muted mb-2">
          Project Management
        </p>
        <p className="text-sm text-pm-muted/70 mb-8 italic">
          Files as memory, AI as intelligence, UI as a window.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/projects"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            View Projects
          </Link>
          <Link
            href="/projects/new"
            className="px-6 py-3 bg-pm-card border border-pm-border hover:border-pm-muted text-pm-text rounded-lg font-medium transition-colors"
          >
            New Project
          </Link>
        </div>
      </div>
    </div>
  );
}
