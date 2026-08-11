import {
  ESSENTIAL_CREW_ROLES,
  CREW_ROLE_PRIORITY,
  type EssentialCrewRole,
} from "@/shared/constants/crew-roles";
import type { MediaItem } from "@/lib/frontend/api-media";

type CrewMember = NonNullable<MediaItem["crew"]>[number];

/**
 * تصفية طاقم العمل بحيث يظهر أول شخص لكل دور أساسي فقط (حسب `ESSENTIAL_CREW_ROLES`)،
 * مع ترتيب النتيجة حسب أولوية العرض في `CREW_ROLE_PRIORITY`.
 *
 * @param crew - مصفوفة أعضاء طاقم العمل من الاستجابة (قد تتكرر الأدوار).
 * @returns مصفوفة جديدة تضم أول عضو لكل دور أساسي، مرتبة حسب الأولوية.
 */
export function getUniqueCrewByRole(crew: CrewMember[]): CrewMember[] {
  const seen = new Set<string>();
  const result: CrewMember[] = [];
  for (const member of crew) {
    const role = member.role;
    if (role && ESSENTIAL_CREW_ROLES.includes(role as EssentialCrewRole)) {
      if (!seen.has(role)) {
        seen.add(role);
        result.push(member);
      }
    }
  }
  // ترتيب حسب الأولوية
  result.sort((a, b) => {
    const pa = CREW_ROLE_PRIORITY[a.role as keyof typeof CREW_ROLE_PRIORITY] ?? 999;
    const pb = CREW_ROLE_PRIORITY[b.role as keyof typeof CREW_ROLE_PRIORITY] ?? 999;
    return pa - pb;
  });
  return result;
}
