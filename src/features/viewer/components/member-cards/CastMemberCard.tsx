"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/shared/constants";
import type { MediaItem } from "@/lib/frontend/api-media";

type CastMember = NonNullable<MediaItem["cast"]>[number];

/**
 * عنصر نائب (placeholder) يُعرض عند غياب صورة الشخص أو فشل تحميلها.
 *
 * @param className - فئات CSS المطبّقة على العنصر الجذري للsvg.
 */
function PersonPlaceholder({ className = "h-full w-full" }) {
  return (
    <svg
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
    >
      <circle cx="60" cy="60" r="58" fill="var(--glass-bg)" stroke="var(--glass-border)" strokeWidth="1.5" />
      <circle cx="60" cy="48" r="14" fill="none" stroke="var(--muted-foreground)" strokeWidth="4" strokeLinecap="round" />
      <path d="M 38 78 Q 60 92 82 78" fill="none" stroke="var(--muted-foreground)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * عنصر عضو طاقم التمثيل في صفحة تفاصيل العنصر.
 *
 * يعرض صورة الشخص واسمه ودوره (character) في عنصر مضغوط بأسلوب منصات العرض
 * الاحترافية، مع رابط لصفحة الشخص عند توفر `person_id`.
 * عند غياب الصورة يُعرض `PersonPlaceholder` بدلاً منها.
 *
 * @param member - بيانات عضو الطاقم القادمة من `MediaItem.cast` (ممثلون فقط).
 * @returns رابط أو حاوية div وفق توفر `person_id`.
 */
export function CastMemberCard({ member }: { member: CastMember }) {
  const [imgFailed, setImgFailed] = useState(false);
  const personId = member.person_id;
  const name = member.display_name ?? member.name ?? "";
  const character = member.character;

  const hasPhoto = personId && member.profile_path && !imgFailed;

  const avatar = (
    <div className="bg-muted h-10 w-10 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-border shadow-sm relative transition-transform duration-200 group-hover:scale-105">
      {hasPhoto ? (
        <img
          src={`/api/images/${String(personId)}?type=person&w=192&h=192`}
          alt={name}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <PersonPlaceholder />
      )}
    </div>
  );

  const body = (
    <>
      {avatar}
      <div className="flex w-full flex-col items-center px-0.5 text-center">
        {name && (
          <span className="group-hover:underline group-hover:decoration-primary/50 w-full truncate text-[9px] font-medium leading-tight transition-all sm:text-xs">
            {name}
          </span>
        )}
        {character ? (
          <span className="mt-0.5 w-full truncate text-[8px] leading-tight text-muted-foreground sm:text-[10px]">
            {character}
          </span>
        ) : null}
      </div>
    </>
  );

  const cardClasses = "group flex w-11 shrink-0 flex-col items-center gap-1 text-center sm:w-16";

  if (personId == null || personId === "") {
    return <div className={cardClasses}>{body}</div>;
  }

  return (
    <Link
      href={ROUTES.PERSON_ITEMS(String(personId)) as import("next").Route}
      className={cardClasses}
    >
      {body}
    </Link>
  );
}