import React from "react"
import { AnimatePresence, motion } from "framer-motion";
import ConversationCard from "./ConversationCard";
import CurrentConversationCard from "./CurrentConversationCard";
import { ConversationData } from "@/data/conversations";
import { 
  ONBOARDING_CURRENT_CARD,
  ONBOARDING_SAVED_CARD
} from "@/constants/appConstants"

interface ConversationGridProps {
  currentConversation: string
  conversations: ConversationData[]
  micActivity: number
  isAudioEnabled: boolean
  onDeleteConversation: (id: string) => void
  onSave: () => void
  onUpdate: (updatedConversation: ConversationData) => void
  searchQuery: string
}

const ConversationGrid: React.FC<ConversationGridProps> = ({
  currentConversation,
  conversations,
  micActivity,
  isAudioEnabled,
  onDeleteConversation,
  onSave,
  onUpdate,
  searchQuery,
}) => {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2">
      <div id={ONBOARDING_CURRENT_CARD}>
        <CurrentConversationCard
          transcript={currentConversation}
          micActivity={micActivity}
          isAudioEnabled={isAudioEnabled}
          onSave={onSave}
          searchQuery={searchQuery}
        />
      </div>
      <AnimatePresence>
        {conversations.map((conversation) => (
          <motion.div
            key={conversation.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
          >
            <div id={ONBOARDING_SAVED_CARD}>
              <ConversationCard 
                conversation={conversation}
                onUpdate={onUpdate}
                onDelete={onDeleteConversation}
                searchQuery={searchQuery}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ConversationGrid;