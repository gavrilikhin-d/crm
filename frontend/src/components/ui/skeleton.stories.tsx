import preview from "../../../.storybook/preview";
import { Skeleton } from "./skeleton";

const meta = preview.meta({
  component: Skeleton,
  tags: ["ai-generated"]
});

export const TextBlock = meta.story({
  render: () => (
    <div className="grid w-72 gap-3">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
});

export const AvatarRow = meta.story({
  render: () => (
    <div className="flex items-center gap-3">
      <Skeleton className="size-10 rounded-full" />
      <div className="grid flex-1 gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
});
