'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { fetchTranscript, fetchTranscriptForDuration, fetchMicActivity } from '../../services/highlightService'
import { ConversationData, createConversation } from '../../data/conversations'
import ConversationGrid from '../Card/ConversationGrid'

const POLL_MIC_INTERVAL = 100 // Poll every 100 ms
const INITIAL_POLL_INTERVAL = 5000
const MAX_POLL_INTERVAL = 20000

interface ConversationsManagerProps {
  idleThreshold: number
  conversations: ConversationData[]
  isAudioEnabled: boolean
  isSleeping: boolean
  addConversation: (conversations: ConversationData) => void
  onDeleteConversation: (id: string) => void
  onMicActivityChange: (activity: number) => void
  onUpdateConversation: (updatedConversation: ConversationData) => void
  searchQuery: string;
}

interface TranscriptSegment {
  timestamp: string;
  speaker: string;
  text: string;
}

function parseTranscript(transcript: string): TranscriptSegment[] {
  return transcript.split('\n').map(line => {
    const [timestamp, rest] = line.split(' - ');
    const [speaker, text] = rest.split(': ');
    return { timestamp, speaker, text };
  });
}

function deduplicateAndMergeTranscripts(newSegments: TranscriptSegment[], existingSegments: TranscriptSegment[]): TranscriptSegment[] {
  const allSegments = [...existingSegments, ...newSegments];
  const mergedSegments: TranscriptSegment[] = [];

  for (const segment of allSegments) {
    if (mergedSegments.length === 0) {
      mergedSegments.push(segment);
      continue;
    }

    const lastSegment = mergedSegments[mergedSegments.length - 1];
    if (lastSegment.speaker === segment.speaker) {
      // If the speakers are the same, merge the text
      const combinedText = `${lastSegment.text} ${segment.text}`;
      const uniqueSentences = Array.from(new Set(combinedText.split('.')))
        .filter(sentence => sentence.trim().length > 0)
        .join('. ');
      
      mergedSegments[mergedSegments.length - 1] = {
        ...lastSegment,
        text: uniqueSentences + '.',
      };
    } else {
      // If the speakers are different, add as a new segment
      mergedSegments.push(segment);
    }
  }

  return mergedSegments;
}

const ConversationsManager: React.FC<ConversationsManagerProps> = ({
  idleThreshold,
  conversations,
  isAudioEnabled,
  isSleeping,
  addConversation,
  onMicActivityChange,
  onDeleteConversation,
  onUpdateConversation,
  searchQuery
}) => {
  const [currentConversationParts, setCurrentConversationParts] = useState<string[]>([])
  const [micActivity, setMicActivity] = useState(0)
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityTimeRef = useRef(Date.now())
  const lastTranscriptTimeRef = useRef<number>(Date.now())
  const [pollInterval, setPollInterval] = useState(INITIAL_POLL_INTERVAL) // Start with a short interval
  const initialPollIntervalRef = useRef(INITIAL_POLL_INTERVAL)
  const maxPollIntervalRef = useRef(MAX_POLL_INTERVAL)
  const isPollingRef = useRef(false)
  const [lastProcessedTimestamp, setLastProcessedTimestamp] = useState(Date.now());
  const [processedSegments, setProcessedSegments] = useState<TranscriptSegment[]>([]);


  // Function to get the current conversation as a string
  const getCurrentConversationString = useCallback((reversed: boolean = true) => {
    return reversed 
      ? currentConversationParts.join(' ') 
      : [...currentConversationParts].reverse().join(' ')
  }, [currentConversationParts])

  const saveCurrentConversation = useCallback((forceSave: boolean = false) => {
    const conversationString = getCurrentConversationString(false) // Get in chronological order
    if (forceSave || conversationString.trim().length >= 1) {
      const newConversation = createConversation(conversationString)
      addConversation(newConversation)
      setCurrentConversationParts([]) // Clear the current conversation
    }
  }, [getCurrentConversationString, addConversation])

  // Check last known mic activity and trigger save if past idle threshold 
  useEffect(() => {
    if (isSleeping) { return }

    const checkIdleTime = () => {
      const currentTime = Date.now()
      const idleTime = currentTime - lastActivityTimeRef.current

      if (idleTime >= idleThreshold * 1000) {
        saveCurrentConversation()
        lastActivityTimeRef.current = currentTime
      }
    }

    const idleCheckInterval = setInterval(checkIdleTime, 1000)

    return () => {
      clearInterval(idleCheckInterval)
    }
  }, [isSleeping, idleThreshold, saveCurrentConversation])

  // Poll Mic Activity and make time stamp of last mic activity
  const pollMicActivity = useCallback(async () => {
    if (isSleeping) return;
    if (!isAudioEnabled) {
      setMicActivity(0)
      return;
    }
    const activity = await fetchMicActivity(300)
    setMicActivity(activity)
    onMicActivityChange(activity)

    if (activity > 1) {
      lastActivityTimeRef.current = Date.now()
    }
  }, [isSleeping, isAudioEnabled, onMicActivityChange])

  const handleSave = useCallback((didTapSaveButton: boolean = false) => {
    setCurrentConversationParts(currentConversationParts)
    saveCurrentConversation(didTapSaveButton)
  }, [saveCurrentConversation, currentConversationParts])

  // Poll Highlight api for transcripts
  // const pollTranscription = useCallback(async () => {
  //   if (isSleeping || !isAudioEnabled || isPollingRef.current) {
  //     return;
  //   }

  //   isPollingRef.current = true;
  //   const currentTime = Date.now();
  //   const timeSinceLastTranscript = (currentTime - lastTranscriptTimeRef.current) / 1000;
    
  //   try {
  //     const transcript = await fetchTranscript()
  //     if (transcript) {
  //       console.log(`[${new Date().toISOString()}] Received transcript after ${timeSinceLastTranscript.toFixed(2)} seconds:`, transcript)
  //       setCurrentConversationParts(prevParts => {
  //         if (transcript.trim() && (prevParts.length === 0 || transcript.trim() !== prevParts[0])) {
  //           setPollInterval(prev => Math.min(prev * 1.5, maxPollIntervalRef.current))
  //           return [transcript.trim(), ...prevParts]
  //         }
  //         return prevParts
  //       })
  //       lastActivityTimeRef.current = currentTime
  //       lastTranscriptTimeRef.current = currentTime
  //     } else {
  //       console.log(`[${new Date().toISOString()}] No new transcript received. Time since last transcript: ${timeSinceLastTranscript.toFixed(2)} seconds`)
  //       setPollInterval(prev => Math.max(prev / 1.2, initialPollIntervalRef.current))
  //     }
  //   } catch (error) {
  //     console.error(`[${new Date().toISOString()}] Error fetching transcript after ${timeSinceLastTranscript.toFixed(2)} seconds:`, error)
  //     setPollInterval(prev => Math.max(prev / 1.1, initialPollIntervalRef.current))
  //   } finally {
  //     isPollingRef.current = false;
  //   }
  // }, [isSleeping, isAudioEnabled])
  const pollTranscription = useCallback(async () => {
    if (isSleeping || !isAudioEnabled || isPollingRef.current) {
      return;
    }
  
    isPollingRef.current = true;
    const currentTime = Date.now();
    const timeSinceLastTranscript = (currentTime - lastTranscriptTimeRef.current) / 1000;
    
    try {
      // Use the long audio version (2 hours)
      const transcript = await fetchTranscript() // 2 hours in seconds
      if (transcript) {
        console.log(`[${new Date().toISOString()}] Received transcript after ${timeSinceLastTranscript.toFixed(2)} seconds:`, transcript);
        
        // Parse the transcript into segments
        const newSegments = parseTranscript(transcript);
  
        // Deduplicate and merge the new segments with existing ones
        const mergedSegments = deduplicateAndMergeTranscripts(newSegments, processedSegments);
  
        if (mergedSegments.length > processedSegments.length) {
          setProcessedSegments(mergedSegments);
          
          // Update the conversation parts
          setCurrentConversationParts(mergedSegments.map(segment => `${segment.speaker}: ${segment.text}`));
  
          lastActivityTimeRef.current = currentTime;
          lastTranscriptTimeRef.current = currentTime;
          setPollInterval(prev => Math.min(prev * 1.5, maxPollIntervalRef.current));
        } else {
          console.log(`[${new Date().toISOString()}] No new unique transcript data.`);
          setPollInterval(prev => Math.max(prev / 1.2, initialPollIntervalRef.current));
        }
      } else {
        console.log(`[${new Date().toISOString()}] No transcript received. Time since last transcript: ${timeSinceLastTranscript.toFixed(2)} seconds`);
        setPollInterval(prev => Math.max(prev / 1.2, initialPollIntervalRef.current));
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error fetching transcript after ${timeSinceLastTranscript.toFixed(2)} seconds:`, error);
      setPollInterval(prev => Math.max(prev / 1.1, initialPollIntervalRef.current));
    } finally {
      isPollingRef.current = false;
    }
  }, [isSleeping, isAudioEnabled, processedSegments]);

  // Effect for polling mic activity
  useEffect(() => {
    const intervalId = setInterval(pollMicActivity, POLL_MIC_INTERVAL)
    return () => clearInterval(intervalId)
  }, [pollMicActivity])

  // Effect for polling transcription
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const schedulePoll = () => {
      timeoutId = setTimeout(() => {
        pollTranscription().then(schedulePoll);
      }, pollInterval);
    };

    schedulePoll();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [pollTranscription, pollInterval]);

  return (
    <ConversationGrid
      currentConversation={getCurrentConversationString()} // Pass reversed (latest on top)
      conversations={conversations}
      micActivity={micActivity}
      isAudioEnabled={isAudioEnabled}
      onDeleteConversation={onDeleteConversation}
      onSave={() => handleSave(true)}
      onUpdate={onUpdateConversation}
      searchQuery={searchQuery} // Pass searchQuery to ConversationGrid
    />
  )
}

export default ConversationsManager