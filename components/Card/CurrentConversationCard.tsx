// components/CurrentConversationCard.tsx
import React, { useRef, useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import styles from "@/styles/CurrentConversationCard.module.css"
import useScrollGradient from "@/hooks/useScrollGradient"
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardIcon, SaveIcon } from '@/components/ui/icons'
import { Tooltip, TooltipState, TooltipType } from "@/components/Tooltip/Tooltip"
import { Button } from "@/components/ui/button"
import { formatTranscript } from '@/data/conversations'

const highlightText = (text: string, query: string) => {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return parts.map((part, i) => 
    part.toLowerCase() === query.toLowerCase() ? 
      <span key={i} className="bg-yellow-200 text-black">{part}</span> : part
  );
};

interface CurrentConversationCardProps {
  transcript: string;
  micActivity: number;
  isAudioEnabled: boolean;
  onSave: () => void
  searchQuery: string;
}

const CurrentConversationCard: React.FC<CurrentConversationCardProps> = ({
  transcript,
  micActivity,
  isAudioEnabled,
  onSave,
  searchQuery,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { showTopGradient, showBottomGradient } = useScrollGradient(scrollRef)

  const [isActive, setIsActive] = useState(false);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const borderClass = isActive ? styles.activeBorder : styles.inactiveBorder;

  const skeletonCorner = "rounded-lg";

  const isSaveDisabled = transcript.trim().length === 0;

  const [transcriptKey, setTranscriptKey] = useState(0);

  useEffect(() => {
    setTranscriptKey(prevKey => prevKey + 1);
  }, [transcript]);

  useEffect(() => {
    if (micActivity > 0) {
      setIsActive(true);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    } else {
      // Start a timer to set isActive to false after 1.5 second of inactivity
      if (!inactivityTimerRef.current) {
        inactivityTimerRef.current = setTimeout(() => {
          setIsActive(false);
          inactivityTimerRef.current = null;
        }, 1500);
      }
    }

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [micActivity]);

  const [copyTooltipState, setCopyTooltipState] = useState<TooltipState>('idle');
  const [saveTooltipState, setSaveTooltipState] = useState<TooltipState>('idle');

  const handleCopyTranscript = () => {
    if (isSaveDisabled) return
    navigator.clipboard.writeText(transcript)
      .then(() => {
        setCopyTooltipState('success');
        setTimeout(() => setCopyTooltipState('hiding'), 1500); // Start hiding after 1.5s
        setTimeout(() => setCopyTooltipState('idle'), 1700); // Set to idle after fade out
      })
      .catch((error) => {
        console.error("Failed to copy transcript:", error);
      });
  };

  const handleSaveTranscript = () => {
    onSave()
    setSaveTooltipState('success');
    setTimeout(() => setSaveTooltipState('hiding'), 1500); // Start hiding after 1.5s
    setTimeout(() => setSaveTooltipState('idle'), 1700); // Set to idle after fade out
  }

  return (
    <Card className={`w-full h-[432px] border-2 ${borderClass} transition-all duration-300 bg-background-100 relative flex flex-col`}>
      <CardHeader className="flex flex-row items-baseline justify-between">
        <CardTitle>Current Conversation</CardTitle>
        <div className="relative">
          <button
            onClick={handleCopyTranscript}
            onMouseEnter={() => !isSaveDisabled && setCopyTooltipState('active')}
            onMouseLeave={() => !isSaveDisabled && setCopyTooltipState('idle')}
            className={`text-muted-foreground transition-colors duration-200 flex items-center justify-center
              ${isSaveDisabled
                ? 'text-muted-foreground/40 cursor-not-allowed'
                : 'hover:text-brand'
              }`}
          >
            <ClipboardIcon width={24} height={24} className="" />
          </button>
          {!isSaveDisabled && <Tooltip type="copy" state={copyTooltipState} />}
        </div>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0 flex flex-col">
        {isAudioEnabled ? (
          <div className="flex flex-col h-full">
            <div className="space-y-2 mb-2 px-6">
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <p>Listening ...</p>
                <div className="animate-spin h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full"></div>
              </div>
            </div>
            <div className="relative flex-grow overflow-hidden">
              {showTopGradient && (
                <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-background-100 to-transparent z-10 pointer-events-none"></div>
              )}
              {showBottomGradient && (
                <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background-100 to-transparent z-10 pointer-events-none"></div>
              )}
              <div className="h-full overflow-y-auto custom-scrollbar px-6" ref={scrollRef}>
                <AnimatePresence mode="wait">
                  {!transcript ? (
                    <motion.div
                      key="listening"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-2 flex flex-col justify-start"
                    >
                      <Skeleton className={`h-24 w-full ${skeletonCorner}`} />
                      <Skeleton className={`h-4 w-full ${skeletonCorner}`} />
                      <Skeleton className={`h-4 w-[80%] ${skeletonCorner}`} />
                      <Skeleton className={`h-4 w-[60%] ${skeletonCorner}`} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`transcript-${transcriptKey}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="pb-4"
                    >
                      <p className="select-text pb-0 text-[15px] text-foreground leading-relaxed whitespace-pre-wrap">{highlightText(formatTranscript(transcript, 'CardTranscript'), searchQuery)}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full px-6">
            <p className="text-center text-muted-foreground max-w-sm">
              Microphone input is disabled. Please enable it to receive transcripts of your conversations.
            </p>
          </div>
        )}
      </CardContent>
      <div className="px-4 pb-4 pt-2">
        <Button
          onClick={handleSaveTranscript}
          disabled={isSaveDisabled}
          className={`w-full flex items-center justify-center rounded-lg p-2 text-[15px] font-semibold transition-colors duration-200 bg-background text-foreground hover:bg-background hover:text-brand
            ${isSaveDisabled ? 'cursor-not-allowed' : ''}`}
        >
          <span className="flex items-center gap-2">
            Save
            <SaveIcon width={24} height={24} viewBox={"0 0 20 20"} className="" />
          </span>
        </Button>
      </div>
    </Card>
  )
}

export default CurrentConversationCard;