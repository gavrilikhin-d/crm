"use client";

import type { ReactNode, MouseEvent, KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

function StudentLink({
  studentId,
  className,
  children,
  stopPropagation
}: {
  studentId: string;
  className?: string;
  children: ReactNode;
  stopPropagation?: boolean;
}) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLSpanElement>) {
    if (stopPropagation) {
      event.stopPropagation();
    }
    router.push(`/students/${studentId}`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    if (stopPropagation) {
      event.stopPropagation();
    }
    router.push(`/students/${studentId}`);
  }

  if (stopPropagation) {
    return (
      <span
        role="link"
        tabIndex={0}
        className={cn("cursor-pointer hover:underline", className)}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {children}
      </span>
    );
  }

  return (
    <Link href={`/students/${studentId}`} className={cn("hover:underline", className)}>
      {children}
    </Link>
  );
}

export { StudentLink };
