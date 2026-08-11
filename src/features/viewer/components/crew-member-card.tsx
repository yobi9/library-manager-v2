"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/shared/constants";
import { CREW_ROLE_AR_LABELS, type EssentialCrewRole } from "@/shared/constants/crew-roles";
import type { MediaItem } from "@/lib/frontend/api-media";
 
type CrewMember = NonNullable<MediaItem["crew"]>[number];

export function CrewMemberCard({ member }: { member: CrewMember }) {
  const [imgFailed, setImgFailed] = useState(false);
  const personId = member.person_id;
  const name = member.display_name ?? member.name ?? "";
  const roleKey = member.role as EssentialCrewRole | undefined;
  const roleDisplay = roleKey && CREW_ROLE_AR_LABELS[roleKey] 
    ? CREW_ROLE_AR_LABELS[roleKey] 
    : member.role ?? "";
  const hasPhoto = !!member.profile_path && !imgFailed && personId != null && personId !== "";

  const avatar = (
    <div className="bg-muted h-14 w-14 shrink-0 overflow-hidden rounded-full transition-opacity group-hover:opacity-80">
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
      {roleDisplay && (
        <span className="text-muted-foreground line-clamp-1 w-full text-center text-xs">
          {roleDisplay}
        </span>
      )}
    </>
  );

  const cardClasses = "group flex w-20 max-w-20 shrink-0 flex-col items-center gap-1.5 text-center";

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