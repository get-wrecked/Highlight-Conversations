import React, { useState } from "react";
import { ConversationData } from "@/data/conversations";
import { Button } from "@/components/ui/button";

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card"

  interface ConversationCardProps {
    conversation: ConversationData;
  }

const ConversationCard: React.FC<ConversationCardProps> = ({ conversation }) => {
  return (
    <Card className="w-full flex flex-col">
      <CardHeader>
        <CardTitle>{conversation.topic || 'Untitled Conversation'}</CardTitle>
        <CardDescription>{conversation.timestamp}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <div className="h-64 overflow-y-auto mb-4">
          <p>{conversation.transcript}</p>
        </div>
        <Button className="mt-auto bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))/0.9]">
          Prompt
        </Button>
      </CardContent>
    </Card>
  );
};

  export default ConversationCard;