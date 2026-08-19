"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/shared/constants";
import { CREW_ROLE_AR_LABELS, type EssentialCrewRole } from "@/shared/constants/crew-roles";
import type { MediaItem } from "@/lib/frontend/api-media";

type CrewMember = NonNullable<MediaItem["crew"]>[number];

export function CrewMemberCard({ member }: { member: CrewMember }) {
  const [imgFailed, setImgFailed] = useState(false);
  
  const personId = member.person_id ? String(member.person_id) : "";
  const name = member.display_name ?? member.name ?? "";
  const roleDisplay = CREW_ROLE_AR_LABELS[member.role as EssentialCrewRole] ?? member.role ?? "";
  const hasPhoto = member.profile_path && !imgFailed && personId;

  const content = (
    <>
      {/* الصورة: تصغير إضافي للموبايل (10 وهي تعادل 40 بكسل فقط) */}
      <div className="bg-muted h-10 w-10 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-border/50 transition-opacity group-hover:opacity-80 shadow-sm">
        {hasPhoto ? (
          <img
            src={`/api/images/${personId}?type=person&w=128&h=128`} // تقليل الحجم المطلوب للصورة لتسريع التحميل
            alt={name}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="text-muted-foreground flex h-full w-full items-center justify-center text-[10px] sm:text-base font-bold">
            {name ? name[0] : "?"}
          </div>
        )}
      </div>

      {/* اسم الشخص والدور: تصغير حجم الخط والتباعد */}
      <div className="flex flex-col w-full text-center px-0.5">
        {name && (
          <span className="group-hover:text-primary truncate w-full text-[9px] sm:text-xs font-medium leading-tight transition-colors">
            {name}
          </span>
        )}
        {roleDisplay && (
          <span className="text-muted-foreground truncate w-full text-[8px] sm:text-[10px] leading-tight mt-0.5">
            {roleDisplay}
          </span>
        )}
      </div>
    </>
  );

  // جعل العرض الإجمالي للكارت متناسق مع حجم الدائرة الصغير (w-11 تعادل 44 بكسل)
  const cardClasses = "group flex w-11 sm:w-16 shrink-0 flex-col items-center gap-1 text-center";

  if (!personId) {
    return <div className={cardClasses}>{content}</div>;
  }

  return (
    <Link href={ROUTES.PERSON_ITEMS(personId) as import("next").Route} className={cardClasses}>
      {content}
    </Link>
  );
}
