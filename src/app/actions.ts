"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, matchPlayers, matches, members, rsvps } from "@/db";
import { getMatchBundle } from "@/lib/data";
import { formatK } from "@/lib/text";
import type { ActionState } from "@/lib/schemas";

const rsvpSchema = z.object({
  matchId: z.number().int().positive(),
  memberId: z.number().int().positive(),
  going: z.boolean(),
  eat: z.boolean(),
  /** Đội tự chọn ở sân; bỏ trống = giữ nguyên. */
  team: z.enum(["A", "B"]).nullable().optional(),
});

/** Điểm danh (công khai – ai có link đều bấm được, giống vote trong nhóm Zalo). */
export async function castRsvp(input: z.input<typeof rsvpSchema>): Promise<ActionState> {
  const p = rsvpSchema.safeParse(input);
  if (!p.success) return { error: "Dữ liệu không hợp lệ" };
  const { matchId, memberId, going, eat } = p.data;
  // Không đá thì không có đội
  const team = going ? p.data.team : null;

  const [[m], [mem]] = await Promise.all([
    db.select().from(matches).where(eq(matches.id, matchId)),
    db.select().from(members).where(and(eq(members.id, memberId), eq(members.active, true))),
  ]);
  if (!m) return { error: "Không tìm thấy trận" };
  if (m.cancelled) return { error: "Trận đã huỷ" };
  if (!m.voting || m.published) return { error: "Đã khoá điểm danh" };
  if (!mem) return { error: "Không tìm thấy thành viên" };

  await db
    .insert(rsvps)
    .values({ matchId, memberId, going, eat, team: team ?? null })
    .onConflictDoUpdate({
      target: [rsvps.matchId, rsvps.memberId],
      set: { going, eat, ...(team !== undefined ? { team } : {}), updatedAt: new Date() },
    });
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `${mem.name}: ${going ? "Đá" : "Không đá"} · ${eat ? "Ăn" : "Không ăn"}`,
  };
}

const declareSchema = z.object({
  matchId: z.number().int().positive(),
  memberId: z.number().int().positive(),
  team: z.enum(["A", "B"]),
});

/** Người đá tự chọn đội khi vào đóng tiền (chỉ được chọn 1 lần, sửa lại thì nhờ admin). */
export async function declareTeam(input: z.input<typeof declareSchema>): Promise<ActionState> {
  const p = declareSchema.safeParse(input);
  if (!p.success) return { error: "Dữ liệu không hợp lệ" };
  const { matchId, memberId, team } = p.data;
  const b = await getMatchBundle(matchId);
  if (!b || !b.match.published) return { error: "Trận chưa công bố" };
  const me = b.players.find((x) => x.memberId === memberId);
  if (!me?.pending) return { error: "Bạn đã có đội rồi – cần đổi thì nhờ admin" };
  const size = team === "A" ? b.match.sizeA : b.match.sizeB;
  const taken = b.players.filter((x) => x.team === team).length;
  if (size != null && taken >= size) return { error: "Đội này đã đủ người – kiểm tra lại hoặc nhờ admin" };

  const c = b.split.players.find((x) => x.memberId === memberId);
  await db
    .update(matchPlayers)
    .set({ team, pending: false })
    .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.memberId, memberId)));
  revalidatePath("/", "layout");
  return { ok: true, message: c?.choices ? `Số tiền của bạn: ${formatK(c.choices[team])}` : "Đã chọn đội" };
}
