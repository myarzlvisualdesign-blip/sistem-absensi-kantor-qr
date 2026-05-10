import { redirect } from 'next/navigation';

export default async function AttendanceEditAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/attendance/${id}`);
}
