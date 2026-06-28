import { FC } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface DashboardChartsData {
  monthlyPurchases: { month: string; value: number }[];
  salesAnalytics: { month: string; value: number }[];
  pointsGrowth: { month: string; cumulative: number }[];
  cashbackHistory: { date: string; amountSol: number; mint: string }[];
}

const CARD: React.CSSProperties = {
  background: "var(--bg-elev)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 18,
};

const ChartCard: FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={CARD}>
    <h4 style={{ margin: "0 0 12px" }}>{title}</h4>
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
    </div>
  </div>
);

const axis = { stroke: "#9aa0b4", fontSize: 12 };
const grid = "#2a2a3c";

/** All four dashboard charts: purchases, sales, points growth, cashback. */
export const DashboardCharts: FC<{ data: DashboardChartsData }> = ({ data }) => (
  <div className="chart-grid">
    <ChartCard title="Monthly Purchases (SOL)">
      <BarChart data={data.monthlyPurchases}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} />
        <XAxis dataKey="month" {...axis} />
        <YAxis {...axis} />
        <Tooltip contentStyle={{ background: "#15151f", border: `1px solid ${grid}` }} />
        <Bar dataKey="value" fill="#7c5cff" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartCard>

    <ChartCard title="Sales Analytics (SOL)">
      <LineChart data={data.salesAnalytics}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} />
        <XAxis dataKey="month" {...axis} />
        <YAxis {...axis} />
        <Tooltip contentStyle={{ background: "#15151f", border: `1px solid ${grid}` }} />
        <Line type="monotone" dataKey="value" stroke="#2dd4bf" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartCard>

    <ChartCard title="Reward Points Growth">
      <AreaChart data={data.pointsGrowth}>
        <defs>
          <linearGradient id="pts" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.7} />
            <stop offset="100%" stopColor="#7c5cff" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} />
        <XAxis dataKey="month" {...axis} />
        <YAxis {...axis} />
        <Tooltip contentStyle={{ background: "#15151f", border: `1px solid ${grid}` }} />
        <Area type="monotone" dataKey="cumulative" stroke="#7c5cff" fill="url(#pts)" />
      </AreaChart>
    </ChartCard>

    <ChartCard title="Cashback History (SOL)">
      <BarChart data={data.cashbackHistory.map((c) => ({ date: c.date.slice(0, 10), amountSol: c.amountSol }))}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} />
        <XAxis dataKey="date" {...axis} />
        <YAxis {...axis} />
        <Tooltip contentStyle={{ background: "#15151f", border: `1px solid ${grid}` }} />
        <Bar dataKey="amountSol" fill="#2dd4bf" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartCard>
  </div>
);
