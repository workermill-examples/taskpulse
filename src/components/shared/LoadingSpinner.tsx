import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  variant?: "spinner" | "skeleton";
}

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-gray-800",
        className
      )}
    />
  );
}

export default function LoadingSpinner({
  size = "md",
  className,
  variant = "spinner",
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  if (variant === "skeleton") {
    const skeletonSizes = {
      sm: "h-4 w-24",
      md: "h-6 w-32",
      lg: "h-8 w-40",
    };

    return (
      <Skeleton
        className={cn(
          skeletonSizes[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-gray-600 border-t-gray-300",
        sizeClasses[size],
        className
      )}
    />
  );
}

// Export Skeleton as a separate component for table/card loading states
LoadingSpinner.Skeleton = Skeleton;