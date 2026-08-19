"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/shared/constants";
import type { MediaItem } from "@/lib/frontend/api-media";

type CastMember = NonNullable<MediaItem["cast"]>[number];

/**
 * عنصر عضو طاقم التمثيل في صفحة تفاصيل العنصر.
 *
 * - الهدف: عرض صورة الشخص واسمه ودوره في عنصر مضغوط خالٍ من أي إطار أو
 *   خلفية أو ظل (بلا هوية "بطاقة")، بأسلوب منصات العرض الاحترافية، مع
 *   رابط لصفحة الشخص عند توفر `person_id`.
 * - التعامل مع الصور: عند غياب `profile_path` أو فشل تحميل الصورة يُعرض
 *   الحرف الأول من الاسم بديلاً، لمنع ظهور أيقونات الصور المكسورة.
 * - الحجم: أفاتار موحد 56px يناسب شبكة الأفاتار المضغوطة (بلا شريط تمرير).
 *
 * @param member - بيانات عضو الطاقم القادمة من `MediaItem.cast` (ممثلون فقط).
 * @returns رابط أو حاوية div وفق توفر `person_id`.
 */
export function CastMemberCard({ member }: { member: CastMember }) {
  const [imgFailed, setImgFailed] = useState(false);
  const personId = member.person_id;
  const name = member.display_name ?? member.name ?? "";
  const character = member.character;
  const hasPhoto = !!member.profile_path && !imgFailed && personId != null && personId !== "";

  const avatar = (
    <div className="bg-muted h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-border/50 transition-opacity group-hover:opacity-80">
      {hasPhoto ? (
        <img
          src={`/api/images/${String(personId)}?type=person&w=192&h=192`}
          alt={name}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="text-muted-foreground flex h-full w-full items-center justify-center text-base font-bold">
          {(name || "?")[0]}
        </div>
      )}
    </div>
  );

  const body = (
    <>
      {avatar}
      {name && (
        <span className="group-hover:text-primary line-clamp-1 w-full text-center text-xs font-medium transition-colors">
          {name}
        </span>
      )}
      {character ? (
        <span className="text-muted-foreground line-clamp-1 w-full text-center text-xs">
          {character}
        </span>
      ) : null}
    </>
  );

  const cardClasses = "group flex w-12 sm:w-14 shrink-0 flex-col items-center gap-1.5 text-center";

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