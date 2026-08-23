// src/features/viewer/components/audio-player/audio-player.tsx

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { AudioPlayerProps } from "./types";
import { Button } from "@/shared/components/ui/button";

/**
 * تنسيق مدة بالثواني إلى صيغة `م:ث` (مثال: 04:05).
 *
 * @param time - عدد الثواني.
 * @returns نص التنسيق الجاهز للعرض.
 */
function formatTime(time: number): string {
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * مشغل الصوت المدمج في صفحة الألبوم (Album Player).
 *
 * - الهدف: تشغيل قائمة مقاطع (playlist) داخل الصفحة نفسها مع أزرار
 *   سابق/تالي، انتقال تلقائي عند انتهاء المقطع، وشريط تقدم/صوت.
 * - مصدر البث: `/api/media/{id}/stream` (يدعم Range ويبث الصوت والفيديو).
 * - التحكم مركزي: المكوّن مُتحكم به من الأعلى عبر `currentIndex`
 *   ويُخطِر بالطلب عبر `onTrackChange`. عند تغيير المصدر يُعاد تحميل
 *   المقطع، وتُعاد ضبط شريط التقدم عبر أحداث العنصر (`loadstart`)،
 *   ويُشغَّل تلقائياً بعد اكتمال التحميل (`canplay`) باستثناء التحميل الأول.
 *
 * @param tracks - قائمة مقاطع الألبوم.
 * @param currentIndex - فهرس المقطع النشط حالياً.
 * @param onTrackChange - معرّف يُستدعى لطلب تغيير المقطع النشط.
 * @returns مشغل صوتي مدمج، أو `null` إذا كانت القائمة فارغة.
 */
export function AudioPlayer({ tracks, currentIndex, onTrackChange }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const didMountRef = useRef(false);
  const shouldAutoplayRef = useRef(false);

  const currentTrack = tracks[currentIndex] ?? null;
  const src = currentTrack ? `/api/media/${currentTrack.id}/stream` : undefined;

  // طلب تشغيل تلقائي لأي مقطع جديد يُختار بعد التحميل الأول (نقر صف/سابق/تالي/تقدم تلقائي).
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    shouldAutoplayRef.current = true;
  }, [src]);

  /**
   * إعادة ضبط شريط التقدم عند بدء تحميل مصدر جديد (تغيير المقطع).
   */
  const handleLoadStart = useCallback(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
    }
  }, [volume, muted]);

  /**
   * تشغيل تلقائي بعد جاهزية المقطع، إذا كان الاختيار يتطلب ذلك.
   */
  const handleCanPlay = useCallback(() => {
    if (shouldAutoplayRef.current && audioRef.current) {
      shouldAutoplayRef.current = false;
      audioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  }, []);

  /**
   * تبديل تشغيل/إيقاف المقطع الحالي.
   */
  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) audioRef.current.volume = val;
    setMuted(val === 0);
  }, []);

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !muted;
      setMuted(!muted);
    }
  }, [muted]);

  /**
   * معالج نهاية المقطع: الانتقال إلى المقطع التالي، أو الإيقاف عند الأخير.
   */
  const handleEnded = useCallback(() => {
    if (currentIndex < tracks.length - 1) {
      onTrackChange(currentIndex + 1);
    } else {
      setIsPlaying(false);
    }
  }, [currentIndex, tracks.length, onTrackChange]);

  if (!currentTrack) return null;

  return (
    <div className="mx-auto w-full max-w-3xl rounded-xl bg-black/80 p-6 text-white shadow-2xl backdrop-blur-sm">
      <audio
        ref={audioRef}
        src={src}
        onLoadStart={handleLoadStart}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        preload="metadata"
      />
      <div className="mb-4 text-center text-xl font-bold text-white/90">{currentTrack.title}</div>
      <div className="flex flex-col gap-4">
        {/* شريط التقدم */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/60">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="accent-primary h-1 flex-1 cursor-pointer rounded-full bg-white/20"
          />
          <span className="text-sm text-white/60">{formatTime(duration)}</span>
        </div>

        {/* أزرار التحكم */}
        <div className="flex items-center justify-center gap-6">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onTrackChange(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            aria-label="المقطع السابق"
            className="text-white/70 hover:bg-transparent hover:text-white disabled:opacity-30 [&_svg]:size-5"
          >
            <SkipBack />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (audioRef.current) audioRef.current.currentTime = 0;
            }}
            aria-label="إعادة المقطع"
            className="text-white/70 hover:bg-transparent hover:text-white [&_svg]:size-5"
          >
            <RotateCcw />
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={togglePlay}
            aria-label={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
            className="h-12 w-12 rounded-full shadow-lg transition-transform hover:scale-105 [&_svg]:size-6"
          >
            {isPlaying ? <Pause /> : <Play />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (audioRef.current) audioRef.current.currentTime = duration;
            }}
            aria-label="إنهاء المقطع"
            className="text-white/70 hover:bg-transparent hover:text-white [&_svg]:size-5"
          >
            <RotateCw />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onTrackChange(Math.min(tracks.length - 1, currentIndex + 1))}
            disabled={currentIndex === tracks.length - 1}
            aria-label="المقطع التالي"
            className="text-white/70 hover:bg-transparent hover:text-white disabled:opacity-30 [&_svg]:size-5"
          >
            <SkipForward />
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleMute}
              aria-label="كتم الصوت"
              className="text-white/70 hover:bg-transparent hover:text-white [&_svg]:size-5"
            >
              {muted ? <VolumeX /> : <Volume2 />}
            </Button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              className="accent-primary h-1 w-20 cursor-pointer rounded-full bg-white/20"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
