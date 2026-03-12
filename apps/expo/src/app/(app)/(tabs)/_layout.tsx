import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAppTheme } from "~/hooks/useAppTheme";

export default function AppTabsLayout() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.tabBarBorder,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("tabs.home"),
          tabBarLabel: t("tabs.home"),
          tabBarAccessibilityLabel: t("tabs.home"),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="maaltijdplan"
        options={{
          title: t("tabs.mealPlan"),
          tabBarLabel: t("tabs.mealPlan"),
          tabBarAccessibilityLabel: t("tabs.mealPlan"),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-week" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recepten"
        options={{
          title: t("tabs.recipes"),
          tabBarLabel: t("tabs.recipes"),
          tabBarAccessibilityLabel: t("tabs.recipes"),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="book-open" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="boodschappen"
        options={{
          title: t("tabs.groceries"),
          tabBarLabel: t("tabs.groceries"),
          tabBarAccessibilityLabel: t("tabs.groceries"),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profiel"
        options={{
          title: t("tabs.settings"),
          tabBarLabel: t("tabs.settings"),
          tabBarAccessibilityLabel: t("tabs.settings"),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
