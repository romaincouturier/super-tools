import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Target, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useCrmReports } from "@/hooks/useCrmBoard";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

const CrmReports = () => {
  const { data: reports, isLoading } = useCrmReports();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!reports) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Aucune donnée disponible</p>
      </div>
    );
  }

  const winRate =
    reports.wonCount + reports.lostCount > 0
      ? Math.round((reports.wonCount / (reports.wonCount + reports.lostCount)) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/crm">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Reporting CRM</h1>
          <p className="text-muted-foreground">Statistiques du pipeline commercial</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline ouvert</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.openCount}</div>
            <p className="text-xs text-muted-foreground">
              {reports.openValue.toLocaleString("fr-FR")} € en cours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventes gagnées</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{reports.wonCount}</div>
            <p className="text-xs text-muted-foreground">
              {reports.wonValue.toLocaleString("fr-FR")} € total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventes perdues</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{reports.lostCount}</div>
            <p className="text-xs text-muted-foreground">opportunités</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de conversion</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{winRate}%</div>
            <p className="text-xs text-muted-foreground">
              sur {reports.wonCount + reports.lostCount} clôturées
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cards per Column */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition par colonne</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reports.cardsPerColumn}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="columnName" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" name="Opportunités" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Breakdown by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition par catégorie de tag</CardTitle>
          </CardHeader>
          <CardContent>
            {reports.breakdownByCategory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun tag avec catégorie
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reports.breakdownByCategory}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ category, count }) => `${category}: ${count}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="category"
                    >
                      {reports.breakdownByCategory.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name, props) => [
                        `${value} opportunités (${props.payload.value.toLocaleString("fr-FR")} €)`,
                        props.payload.category,
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Résumé</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Métrique</th>
                  <th className="text-right py-2">Valeur</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2">Total opportunités</td>
                  <td className="text-right font-medium">{reports.totalCards}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Pipeline ouvert (valeur)</td>
                  <td className="text-right font-medium">
                    {reports.openValue.toLocaleString("fr-FR")} €
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Ventes gagnées (valeur)</td>
                  <td className="text-right font-medium text-green-600">
                    {reports.wonValue.toLocaleString("fr-FR")} €
                  </td>
                </tr>
                <tr>
                  <td className="py-2">Taux de conversion</td>
                  <td className="text-right font-medium">{winRate}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CrmReports;
