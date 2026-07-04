import preview from "../../../.storybook/preview";
import { Search } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea
} from "./input-group";

const meta = preview.meta({
  component: InputGroup,
  tags: ["ai-generated"]
});

export const SearchInput = meta.story({
  render: () => (
    <InputGroup className="max-w-sm">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput placeholder="Найти ученика..." />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="sm">Поиск</InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
});

export const WithText = meta.story({
  render: () => (
    <InputGroup className="max-w-sm">
      <InputGroupInput defaultValue="120" />
      <InputGroupAddon align="inline-end">
        <InputGroupText>BYN</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  )
});

export const Textarea = meta.story({
  render: () => (
    <InputGroup className="max-w-sm">
      <InputGroupTextarea placeholder="Комментарий к занятию" />
    </InputGroup>
  )
});
