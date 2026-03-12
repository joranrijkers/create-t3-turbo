import { NextResponse } from "next/server";
import { eq, inArray } from "@prikkr/db";
import {
  Attendance,
  HouseholdMember,
  MealPlan,
  PushToken,
} from "@prikkr/db/schema";
import { Expo } from "expo-server-sdk";

import { db } from "@prikkr/db/client";

const DAY_LABELS = [
  "zondag",
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
];

/**
 * Cron endpoint: send push notifications to users who haven't responded to tomorrow's meals.
 * Secure with CRON_SECRET header: Authorization: Bearer <CRON_SECRET>
 * Vercel Cron: add to vercel.json or use dashboard to call GET/POST this URL with the header.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expo = new Expo();
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 1);
  const dateStr = targetDate.toISOString().slice(0, 10);
  const dayLabel =
    DAY_LABELS[targetDate.getDay()] ?? targetDate.toLocaleDateString("nl-NL", { weekday: "long" });

  try {
    const plans = await db
      .select({
        id: MealPlan.id,
        householdId: MealPlan.householdId,
        date: MealPlan.date,
        mealType: MealPlan.mealType,
      })
      .from(MealPlan)
      .where(eq(MealPlan.date, dateStr));

    const userIdsToNotify = new Set<string>();

    for (const plan of plans) {
      const members = await db
        .select({ userId: HouseholdMember.userId })
        .from(HouseholdMember)
        .where(eq(HouseholdMember.householdId, plan.householdId));
      const responded = await db
        .select({ userId: Attendance.userId })
        .from(Attendance)
        .where(eq(Attendance.mealPlanId, plan.id));
      const respondedIds = new Set(responded.map((r) => r.userId));
      for (const m of members) {
        if (!respondedIds.has(m.userId)) {
          userIdsToNotify.add(m.userId);
        }
      }
    }

    if (userIdsToNotify.size === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    const tokens = await db
      .select({ expoPushToken: PushToken.expoPushToken })
      .from(PushToken)
      .where(inArray(PushToken.userId, [...userIdsToNotify]));

    const title = "Prikkr";
    const body = `Je hebt nog niet gereageerd op het avondeten voor ${dayLabel}. Geef aan of je mee eet!`;
    const messages = tokens
      .filter((t) => Expo.isExpoPushToken(t.expoPushToken))
      .map((t) => ({
        to: t.expoPushToken,
        sound: "default" as const,
        title,
        body,
      }));

    if (messages.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }

    return NextResponse.json({
      ok: true,
      sent: messages.length,
      date: dateStr,
    });
  } catch (err) {
    console.error("[attendance-reminder]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
