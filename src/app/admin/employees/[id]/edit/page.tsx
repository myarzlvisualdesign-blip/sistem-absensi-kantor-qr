import { redirect } from 'next/navigation';

export default async function EmployeeEditAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/employees/${id}`);
}
