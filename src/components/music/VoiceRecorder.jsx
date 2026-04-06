import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Mic, Square, Play, Trash2, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function VoiceRecorder({ value, onChange, disabled, maxSeconds = 10 }) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(maxSeconds);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = e => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setUploading(true);
      const file = new File([blob], "voice_intro.webm", { type: "audio/webm" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(file_url);
      setUploading(false);
    };
    mediaRef.current = recorder;
    recorder.start();
    setRecording(true);
    setTimeLeft(maxSeconds);
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed++;
      setTimeLeft(maxSeconds - elapsed);
      if (elapsed >= maxSeconds) stopRecording();
    }, 1000);
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    setRecording(false);
    setTimeLeft(maxSeconds);
  };

  const playPreview = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  };

  return (
    <div>
      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        <Mic className="w-3 h-3 text-primary" /> Voice Intro (optional, max {maxSeconds}s)
      </Label>
      <div className="mt-1 flex items-center gap-2 flex-wrap">
        {!value && !recording && !uploading && !disabled && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={startRecording}
            className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 h-8 text-xs"
          >
            <Mic className="w-3.5 h-3.5" /> Record Intro
          </Button>
        )}
        {recording && (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={stopRecording}
            className="gap-1.5 h-8 text-xs animate-pulse"
          >
            <Square className="w-3.5 h-3.5" /> Stop ({timeLeft}s)
          </Button>
        )}
        {uploading && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
          </span>
        )}
        {value && !uploading && (
          <>
            <audio ref={audioRef} src={value} preload="none" className="hidden" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={playPreview}
              className="gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10 h-8 text-xs"
            >
              <Play className="w-3.5 h-3.5" /> Preview Voice
            </Button>
            {!disabled && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange("")}
                className="gap-1 text-muted-foreground hover:text-destructive h-8 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </Button>
            )}
            <span className="text-[10px] text-green-400">✓ Voice intro recorded</span>
          </>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">
        Voice intro plays first, then you trigger music in Spotify / Apple Music.
      </p>
    </div>
  );
}