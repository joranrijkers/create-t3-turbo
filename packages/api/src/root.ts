import { authRouter } from "./router/auth";
import { attendanceRouter } from "./router/attendance";
import { householdRouter } from "./router/household";
import { ingredientRouter } from "./router/ingredient";
import { mealPlanRouter } from "./router/mealPlan";
import { notificationsRouter } from "./router/notifications";
import { recipeRouter } from "./router/recipe";
import { shoppingListRouter } from "./router/shoppingList";
import { userPreferencesRouter } from "./router/userPreferences";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  attendance: attendanceRouter,
  household: householdRouter,
  ingredient: ingredientRouter,
  mealPlan: mealPlanRouter,
  notifications: notificationsRouter,
  recipe: recipeRouter,
  shoppingList: shoppingListRouter,
  userPreferences: userPreferencesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
