import preview from "../../../.storybook/preview";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from "./table";

const meta = preview.meta({
  component: Table,
  tags: ["ai-generated"]
});

export const Payments = meta.story({
  render: () => (
    <Table>
      <TableCaption>Последние оплаты</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Ученик</TableHead>
          <TableHead>Занятий</TableHead>
          <TableHead className="text-right">Сумма</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Анна Петрова</TableCell>
          <TableCell>4</TableCell>
          <TableCell className="text-right">12 000 ₽</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Иван Смирнов</TableCell>
          <TableCell>1</TableCell>
          <TableCell className="text-right">3 500 ₽</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}>Итого</TableCell>
          <TableCell className="text-right">15 500 ₽</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
});
