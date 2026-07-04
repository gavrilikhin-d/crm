import preview from "../../../.storybook/preview";
import { Check } from "lucide-react";
import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "./avatar";

const meta = preview.meta({
  component: Avatar,
  tags: ["ai-generated"]
});

export const Fallback = meta.story({
  render: () => (
    <Avatar>
      <AvatarFallback>АП</AvatarFallback>
    </Avatar>
  )
});

export const WithBadge = meta.story({
  render: () => (
    <Avatar size="lg">
      <AvatarImage src="https://i.pravatar.cc/80?img=32" alt="Анна Петрова" />
      <AvatarFallback>АП</AvatarFallback>
      <AvatarBadge>
        <Check />
      </AvatarBadge>
    </Avatar>
  )
});

export const Group = meta.story({
  render: () => (
    <AvatarGroup>
      <Avatar>
        <AvatarFallback>АП</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>ИС</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+3</AvatarGroupCount>
    </AvatarGroup>
  )
});
