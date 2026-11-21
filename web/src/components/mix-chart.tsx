import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function MixChart({ data }: { data: { name: string; n: number }[] }) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} width={32} />
          <Tooltip />
          <Bar dataKey="n" fill="#115e4a" radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
