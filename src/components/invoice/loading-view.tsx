import { Loader2 } from "lucide-react";

export function LoadingView() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] text-center bg-muted/40">
      <Loader2 className="w-16 h-16 animate-spin text-primary mb-4" />
      <h2 className="text-2xl font-semibold text-foreground">
        Analyzing your invoice...
      </h2>
      <p className="mt-2 text-muted-foreground">
        Our AI is extracting the data. This may take a few moments.
      </p>
    </div>
  );
}
