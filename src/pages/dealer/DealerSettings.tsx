import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Moon, Sun, Monitor } from "lucide-react";
import { NotificationPreferences } from "@/components/NotificationPreferences";

type ThemeMode = "light" | "dark" | "system";

export default function DealerSettings() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem("theme") as ThemeMode) || "system";
  });

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      localStorage.setItem("theme", "system");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, [theme]);

  const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun; description: string }[] = [
    { value: "light", label: "Hell", icon: Sun, description: "Helles Design" },
    { value: "dark", label: "Dunkel", icon: Moon, description: "Dunkles Design" },
    { value: "system", label: "System", icon: Monitor, description: "Systemeinstellung verwenden" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          Einstellungen
        </h1>
        <p className="text-muted-foreground">
          Verwalten Sie Ihre persönlichen Einstellungen und Benachrichtigungen
        </p>
      </div>

      {/* Theme / Dark Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Erscheinungsbild
          </CardTitle>
          <CardDescription>
            Wählen Sie Ihr bevorzugtes Farbschema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  theme === option.value
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <option.icon className={`w-5 h-5 ${theme === option.value ? "text-primary" : "text-muted-foreground"}`} />
                <div className="text-left">
                  <p className={`font-medium ${theme === option.value ? "text-primary" : ""}`}>
                    {option.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences (existing component) */}
      <NotificationPreferences />
    </div>
  );
}
