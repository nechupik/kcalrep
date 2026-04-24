import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { loadDiary, loadNorm, type DiaryEntry } from "@/lib/storage";
import type { MacroResult } from "@/lib/nutrition";
import { aggregateByDay, buildRecommendations } from "@/lib/analytics";

const formatShort = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const Stats = () => {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [norm, setNorm] = useState<MacroResult | null>(null);
  const [range, setRange] = useState<"week" | "month">("week");

  useEffect(() => {
    setEntries(loadDiary());
    setNorm(loadNorm());
  }, []);

  const days = range === "week" ? 7 : 30;
  const data = useMemo(
    () =>
      aggregateByDay(entries, days).map((d) => ({
        ...d,
        label: formatShort(d.date),
      })),
    [entries, days],
  );

  const activeDays = data.filter((d) => d.count > 0);
  const avgCal = activeDays.length
    ? Math.round(activeDays.reduce((a, d) => a + d.calories, 0) / activeDays.length)
    : 0;
  const avgProtein = activeDays.length
    ? Math.round(activeDays.reduce((a, d) => a + d.protein, 0) / activeDays.length)
    : 0;

  const recs = useMemo(() => buildRecommendations(entries, norm), [entries, norm]);

  return (
    <div className="min-h-screen">
      <AppHeader />

      <section className="container max-w-5xl pt-6 pb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl bg-gradient-violet p-2.5 shadow-soft">
            <BarChart3 className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Статистика</h1>
            <p className="text-sm text-muted-foreground">Анализ ваших приёмов пищи и рекомендации</p>
          </div>
        </div>

        <Tabs value={range} onValueChange={(v) => setRange(v as "week" | "month")} className="mb-6">
          <TabsList>
            <TabsTrigger value="week">Неделя</TabsTrigger>
            <TabsTrigger value="month">Месяц</TabsTrigger>
          </TabsList>

          <TabsContent value={range} className="mt-6 space-y-6">
            {/* Сводка */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryTile label="Активных дней" value={`${activeDays.length}`} suffix={`/ ${days}`} />
              <SummaryTile label="Средние ккал" value={`${avgCal}`} suffix={norm ? `/ ${norm.calories}` : ""} />
              <SummaryTile label="Средний белок" value={`${avgProtein}г`} suffix={norm ? `/ ${norm.protein}г` : ""} />
              <SummaryTile
                label="Всего записей"
                value={`${entries.filter((e) => data.some((d) => d.date === e.date)).length}`}
              />
            </div>

            {/* График калорий */}
            <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Калории по дням</h2>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    {norm && (
                      <ReferenceLine
                        y={norm.calories}
                        stroke="hsl(var(--accent))"
                        strokeDasharray="4 4"
                        label={{ value: "норма", fill: "hsl(var(--accent))", fontSize: 11, position: "right" }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="calories"
                      stroke="hsl(var(--macro-calories))"
                      strokeWidth={2.5}
                      dot={{ fill: "hsl(var(--macro-calories))", r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* График БЖУ */}
            <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-secondary" />
                <h2 className="font-semibold">Белки, жиры, углеводы (г)</h2>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Bar dataKey="protein" name="Белки" fill="hsl(var(--macro-protein))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="fat" name="Жиры" fill="hsl(var(--macro-fat))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="carbs" name="Углеводы" fill="hsl(var(--macro-carbs))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Рекомендации */}
        <div>
          <h2 className="text-xl font-bold mb-4">Рекомендации по питанию</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {recs.map((r, i) => (
              <RecommendationCard key={i} {...r} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

const SummaryTile = ({ label, value, suffix }: { label: string; value: string; suffix?: string }) => (
  <Card className="p-4 bg-card/80 backdrop-blur-sm border-border/50">
    <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">{label}</div>
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xl font-bold text-gradient-sunset">{value}</span>
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </div>
  </Card>
);

const RecommendationCard = ({
  level,
  title,
  text,
}: {
  level: "info" | "warn" | "good";
  title: string;
  text: string;
}) => {
  const cfg = {
    info: { Icon: Info, color: "text-tertiary", bg: "bg-tertiary/10", border: "border-tertiary/30" },
    warn: { Icon: AlertTriangle, color: "text-secondary", bg: "bg-secondary/10", border: "border-secondary/30" },
    good: { Icon: CheckCircle2, color: "text-macro-protein", bg: "bg-macro-protein/10", border: "border-macro-protein/30" },
  }[level];

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-4 flex gap-3`}>
      <cfg.Icon className={`h-5 w-5 shrink-0 mt-0.5 ${cfg.color}`} />
      <div>
        <div className="font-semibold text-sm mb-1">{title}</div>
        <div className="text-sm text-muted-foreground leading-relaxed">{text}</div>
      </div>
    </div>
  );
};

export default Stats;
