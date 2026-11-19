import { openOwnerFrontDeskBranch } from "@/app/(dashboard)/select-workspace/actions";
import { CradleLiveBoard } from "@/components/features/cradle-live/cradle-live-board";
import { getCradleLiveData } from "@/lib/cradle-live/query";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { getOwnerFrontDeskBranches } from "@/lib/queries/front-desk-branch";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cradle Live 2.0 | Operations Wallboard" };

export default async function CradleLivePage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string }>;
}) {
  const [context, params] = await Promise.all([getFrontDeskContext(), searchParams]);
  const fixture = process.env.NODE_ENV === "development" && params.fixture === "populated";
  const [data, branches] = await Promise.all([
    fixture
      ? import("@/lib/cradle-live/fixture").then((m) =>
          m.createPopulatedCradleLiveFixture(context.branchName)
        )
      : getCradleLiveData(),
    context.role === "owner" && !fixture ? getOwnerFrontDeskBranches() : Promise.resolve([]),
  ]);
  return (
    <CradleLiveBoard initial={data} key={context.branchId}>
      {branches.length > 1 ? (
        <form action={openOwnerFrontDeskBranch} aria-label="Front desk branch">
          <input type="hidden" name="destination" value="live" />
          {branches.map((branch) => (
            <button
              key={branch.id}
              type="submit"
              name="branchId"
              value={branch.id}
              aria-pressed={branch.id === context.branchId}
              disabled={branch.id === context.branchId}
            >
              {branch.name}
            </button>
          ))}
        </form>
      ) : (
        <span aria-label="Current branch">{context.branchName}</span>
      )}
    </CradleLiveBoard>
  );
}
