import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchTranscript, fetchMicActivity, setSegmentStatusCallback } from '../../services/audioService';
import { ConversationData, mockConversations } from '../../data/conversations';
import ConversationGrid from '../Card/ConversationGrid';
import { v4 as uuidv4 } from 'uuid';

const POLL_MIC_INTERVAL = 100; // Poll every 100 ms
const POLL_TRANSCRIPT_INTERVAL = 29000; // Poll every 29 seconds
const IDLE_THRESHOLD = 150; // 15 seconds (150 * 100ms) of low activity to consider conversation ended

interface ConversationsManagerProps {
  onMicActivityChange: (activity: number) => void;
}

const ConversationsManager: React.FC<ConversationsManagerProps> = ({ onMicActivityChange }) => {
  const [currentConversation, setCurrentConversation] = useState('');
  const [conversations, setConversations] = useState<ConversationData[]>(mockConversations);
  const [micActivity, setMicActivity] = useState(0);
  const idleCountRef = useRef(0);

  const pollMicActivity = useCallback(async () => {
    const activity = await fetchMicActivity();
    setMicActivity(activity);
    onMicActivityChange(activity);

    if (activity <= 1) {
      idleCountRef.current += 1;
    } else {
      idleCountRef.current = 0;
    }

    if (idleCountRef.current >= IDLE_THRESHOLD && currentConversation.trim()) {
      const newConversation = createConversation(currentConversation);
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversation('');
      idleCountRef.current = 0;
    }
  }, [onMicActivityChange, currentConversation]);

  const pollTranscription = useCallback(async () => {
    const transcript = await fetchTranscript();

    if (transcript) {
      setCurrentConversation(prev => prev.trim() + ' ' + transcript.trim());
    }
  }, []);

  // Effect for polling mic activity
  useEffect(() => {
    const intervalId = setInterval(pollMicActivity, POLL_MIC_INTERVAL);
    return () => clearInterval(intervalId);
  }, [pollMicActivity]);

  // Effect for polling transcription
  useEffect(() => {
    const intervalId = setInterval(pollTranscription, POLL_TRANSCRIPT_INTERVAL);
    return () => clearInterval(intervalId);
  }, [pollTranscription]);

  useEffect(() => {
    console.log("Setting segment status callback inside conversations manager");
    try {
      setSegmentStatusCallback((current, total) => {
        console.log("Segments: ", current, total);
      });
    } catch (error) {
      console.error("Error setting segment status callback:", error);
    }
  }, []);

  return (
    <ConversationGrid
      currentConversation={currentConversation}
      conversations={conversations}
      micActivity={micActivity}
    />
  );
};

const createConversation = (transcript: string): ConversationData => {
  let uuid = uuidv4();
  return {
    id: uuid,
    summary: transcript.slice(0, 50),
    topic: uuid.slice(0, 4),
    transcript: transcript,
    timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
  };
};

export default ConversationsManager;
