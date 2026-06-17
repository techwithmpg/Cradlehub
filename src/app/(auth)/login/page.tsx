import { LoginForm } from "./login-form";

type LoginSearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: LoginSearchParams;
}) {
  const params = await searchParams;

  return (
    <LoginForm passwordUpdated={getSearchParam(params.passwordUpdated) === "true"} />
  );
}
