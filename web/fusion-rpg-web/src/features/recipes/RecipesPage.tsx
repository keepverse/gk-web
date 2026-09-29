import { useRecipes, type RecipeItem } from "@/lib/bus";
import { Page } from "@/layouts/Page";
import { DataTable, EmptyState, HelpText, Panel, type DataTableColumn } from "@/ui";

const columns: DataTableColumn<RecipeItem>[] = [
  {
    key: "a",
    header: "A",
    cell: (row) => `${row.parentAName ?? row.parentA} (${row.parentA})`
  },
  {
    key: "b",
    header: "B",
    cell: (row) => `${row.parentBName ?? row.parentB} (${row.parentB})`
  },
  {
    key: "result",
    header: "Result",
    cell: (row) => `${row.resultName ?? row.result} (${row.result})`
  }
];

export function RecipesPage() {
  const recipes = useRecipes();

  return (
    <Page testId="page-recipes" title="Recipes" description="Fusion recipes from ChildToParents.">
      <Panel title="Fusion recipes" testId="panel-recipes">
        <HelpText>From ChildToParents. Almanac UI only — not combat SSOT.</HelpText>
        <DataTable
          columns={columns}
          rows={recipes.data ?? []}
          rowKey={(row) => `${row.parentA}-${row.parentB}-${row.result}`}
          empty={
            <EmptyState
              title="No recipes yet"
              hint="Hello / play a match to dump ChildToParents."
              className="mt-3"
            />
          }
        />
      </Panel>
    </Page>
  );
}
