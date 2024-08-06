// services/highlightService.ts
'use client'
import Highlight from '@highlight-ai/app-runtime'
import { GeneratedPrompt, LLMMessage } from '../types/types'
import { loadConversations as loadConversationsFromLocalStorage } from '@/utils/localStorage'
import { ConversationData } from '@/data/conversations'

export const CONVERSATIONS_STORAGE_KEY = 'conversations'
export const AUTO_CLEAR_VALUE_KEY = 'autoClearValue'
export const AUTO_SAVE_SEC_KEY = 'autoSaveSec'
export const AUDIO_ENABLED_KEY = 'audioEnabled'
export const HAS_SEEN_ONBOARDING_KEY = 'hasSeenOnboarding'
declare global {
  interface Window {
    highlight: {
      internal: {
        getAudioSuperpowerEnabled: () => Promise<boolean>
        setAudioSuperpowerEnabled: (enabled: boolean) => Promise<void>
        getTextPrediction: (messages: LLMMessage[]) => Promise<string>
        openApp: (appId: string) => void
        sendConversationAsAttachment: (targetAppId: string, attachment: string) => Promise<void>
        requestAudioPermissionEvents: () => Promise<void>
      }
      appStorage: {
        isHydrated: () => boolean
        whenHydrated: () => Promise<boolean>
        all: () => Record<string, any>
        get: (key: string) => any
        set: (key: string, value: any) => void
        setAll: (value: Record<string, any>) => void
        delete: (key: string) => void
        clear: () => void
      }
    }
  }
}

// Public API functions
export const fetchTranscript = async (): Promise<string> => {
  try {
    const response = await Highlight.user.getAudio(true)
    return response
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return '';
  }
}

export const fetchTranscriptForDuration = async (durationInSeconds: number): Promise<string> => {
  try {
    const response = await Highlight.user.getAudioForDuration(durationInSeconds);
    return response;
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return '';
  }
};

export const fetchLongTranscript = async (): Promise<string | null> => {
  return await Highlight.user.getAudio(true)
}

export const fetchMicActivity = async (lastNumMs: number = 300): Promise<number> => {
  let activity = await Highlight.user.getMicActivity(lastNumMs)
  return activity
}

export const setAsrRealtime = async (isRealtime: boolean): Promise<void> => {
  await Highlight.user.setAsrRealtime(isRealtime)
}

export const fetchUserFacts = async (): Promise<any> => {
  return await Highlight.user.getFacts()
}

export const fetchScreenshot = async (): Promise<string> => {
  return await Highlight.user.getScreenshot()
}

export const fetchUserEmail = async (): Promise<string> => {
  return await Highlight.user.getEmail()
}

export const requestBackgroundPermission = () => {
  try {
    if (typeof window !== 'undefined' && window.highlight) {
      console
      return Highlight.permissions.requestBackgroundPermission()
    }
  } catch (error) {
    console.error('Error requesting background permission:', error)
  }
}

// Internal API functions
export const getAudioSuperPowerEnabled = async (): Promise<boolean> => {
  return await window.highlight.internal.getAudioSuperpowerEnabled()
}

export const setAudioSuperpowerEnabled = async (enabled: boolean): Promise<void> => {
  await window.highlight.internal.setAudioSuperpowerEnabled(enabled)
}

export const sendAttachmentAndOpen = async (
  targetAppId: string,
  attachment: string
): Promise<void> => {
  await openExternalApp()
  
  // Add a 2-second delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  await sendAttachment(targetAppId, attachment)
}

const openExternalApp = async (): Promise<void> => {
  if (typeof window !== 'undefined' && window.highlight && window.highlight.internal) {
    try {
      await Highlight.app.openApp('highlightchat')
      console.log('External app opened successfully')
    } catch (error) {
      console.error('Failed to open external app:', error)
    }
  } else {
    console.error('openApp function is not available')
  }
}

const sendAttachment = async (
  targetAppId: string,
  attachment: string
): Promise<void> => {
  if (typeof window !== 'undefined' && window.highlight && window.highlight.internal) {
    try {
      await window.highlight.internal.sendConversationAsAttachment(targetAppId, attachment)
      console.log('Attachment sent successfully')
    } catch (error) {
      console.error('Error sending attachment:', error)
      throw error
    }
  } else {
    throw new Error('sendAttachment function is not available')
  }

}

interface ProcessedConversationData {
  topics: string[]
  summary: string
}

export const getTextPredictionFromHighlight = async (transcript: string): Promise<ProcessedConversationData> => {
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content:
        "Analyze the following conversation transcript and generate a JSON object containing the following fields: 'topics' (an array of main topics discussed), and 'summary' (a brief summary of the conversation). Ensure the output is valid JSON."
    },
    {
      role: 'user',
      content: transcript
    }
  ]

  return new Promise(async (resolve, reject) => {
    let accumulatedText = ''

    const predictionId = await window.highlight.internal.getTextPrediction(messages)

    const updateListener = (event: any) => {
      if (event.id === predictionId) {
        accumulatedText += event.text
      }
    }

    const doneListener = (event: any) => {
      if (event.id === predictionId) {
        Highlight.removeEventListener('onTextPredictionUpdate', updateListener)
        Highlight.removeEventListener('onTextPredictionDone', doneListener)

        try {
          // Parse the accumulated text as JSON
          const jsonStr = accumulatedText.replace(/^```json|```$/g, '').trim()
          const parsedData: ProcessedConversationData = JSON.parse(jsonStr)
          console.log('Parsed data:', parsedData)
          resolve(parsedData)
        } catch (error) {
          console.error('Error parsing JSON:', error)
          reject(new Error('Failed to parse LLM output as JSON'))
        }
      }
    }

    console.log('Adding event listeners')
    Highlight.addEventListener('onTextPredictionUpdate', updateListener)
    Highlight.addEventListener('onTextPredictionDone', doneListener)

    // Optional: Add a timeout
    const timeoutId = setTimeout(() => {
      console.log('Timeout reached')
      Highlight.removeEventListener('onTextPredictionUpdate', updateListener)
      Highlight.removeEventListener('onTextPredictionDone', doneListener)
      reject(new Error('Text prediction timed out'))
    }, 60000) // 60 second timeout

    // Clear timeout if prediction completes successfully
    const clearTimeoutOnCompletion = (event: any) => {
      if (event.id === predictionId) {
        clearTimeout(timeoutId)
        Highlight.removeEventListener('onTextPredictionDone', clearTimeoutOnCompletion)
      }
    }
    Highlight.addEventListener('onTextPredictionDone', clearTimeoutOnCompletion)
  })
}

const parsePrompts = (text: string): GeneratedPrompt[] => {
  return text
    .split('\n')
    .filter((line) => /^\d+\./.test(line))
    .map((line, index) => ({
      text: line.replace(/^\d+\.\s*/, '').trim(),
      index: index + 1
    }))
}

// Event listener functions
export const addContextListener = (listener: (event: any) => void): void => {
  Highlight.addEventListener('onContext', listener)
}

export const removeContextListener = (listener: (event: any) => void): void => {
  Highlight.removeEventListener('onContext', listener)
}

export const addTextPredictionUpdateListener = (listener: (event: any) => void): void => {
  Highlight.addEventListener('onTextPredictionUpdate', listener)
}

export const removeTextPredictionUpdateListener = (listener: (event: any) => void): void => {
  Highlight.removeEventListener('onTextPredictionUpdate', listener)
}

export const addTextPredictionDoneListener = (listener: (event: any) => void): void => {
  Highlight.addEventListener('onTextPredictionDone', listener)
}

export const removeTextPredictionDoneListener = (listener: (event: any) => void): void => {
  Highlight.removeEventListener('onTextPredictionDone', listener)
}

export const addAudioPermissionListener = (listener: (event: any) => void): void => {
  Highlight.app.addListener('onAudioPermissionUpdate', listener)
}

export const requestAudioPermissionEvents = async (): Promise<void> => {
  if (typeof window !== 'undefined' && window.highlight && window.highlight.internal) {
    try {
      await window.highlight.internal.requestAudioPermissionEvents()
      console.log('Audio permission events requested successfully')
    } catch (error) {
      console.error('Error sending audio permission request:', error)
      throw error
    }
  } else {
    throw new Error('request audio permission is not available')
  }
}

export const setupSimpleAudioPermissionListener = () => {
  console.log('Setting up simple audio permission listener');
  Highlight.app.addListener('onAudioPermissionUpdate', (event: any) => {
    console.log('Audio permission event received:', event);
    // If you know the exact structure of the event, you can log specific properties
    // For example, if there's a hasPermission property:
    // console.log('Audio permission changed:', event.hasPermission);
  });
};


// export const addSleepListener = (listener: () => void): void => {
//   Highlight.addEventListener('onSleep', listener);
// };

// export const removeSleepListener = (listener: () => void): void => {
//   Highlight.removeEventListener('onSleep', listener);
// };

// export const addWakeListener = (listener: () => void): void => {
//   Highlight.addEventListener('onWake', listener);
// };

// export const removeWakeListener = (listener: () => void): void => {
//   Highlight.removeEventListener('onWake', listener);
// };

// App Storage functions
const isBrowser = typeof window !== 'undefined'
const getAppStorage = () => (isBrowser ? window.highlight.appStorage : null)

export const saveToAppStorage = async (key: string, value: any): Promise<void> => {
  const appStorage = getAppStorage()
  if (appStorage) {
    await appStorage.whenHydrated()
    appStorage.set(key, value)
  }
}

export const loadFromAppStorage = async (key: string, defaultValue: any): Promise<any> => {
  const appStorage = getAppStorage()
  if (appStorage) {
    await appStorage.whenHydrated()
    const value = appStorage.get(key)
    return value !== undefined ? value : defaultValue
  }
  return defaultValue
}

export const removeFromAppStorage = async (key: string): Promise<void> => {
  const appStorage = getAppStorage()
  if (appStorage) {
    await appStorage.whenHydrated()
    appStorage.delete(key)
  }
}

export const clearAppStorage = async (): Promise<void> => {
  const appStorage = getAppStorage()
  if (appStorage) {
    await appStorage.whenHydrated()
    appStorage.clear()
  }
}

// Type-specific app storage functions
export const saveNumberInAppStorage = async (key: string, value: number): Promise<void> => {
  const appStorage = getAppStorage()
  if (appStorage) {
    await appStorage.whenHydrated()
    appStorage.set(key, value)
  }
}

export const saveBooleanInAppStorage = async (key: string, value: boolean): Promise<void> => {
  const appStorage = getAppStorage()
  if (appStorage) {
    await appStorage.whenHydrated()
    appStorage.set(key, value)
  }
}

export const saveStringInAppStorage = async (key: string, value: string): Promise<void> => {
  const appStorage = getAppStorage()
  if (appStorage) {
    await appStorage.whenHydrated()
    appStorage.set(key, value)
  }
}

export const saveConversationsInAppStorage = async (conversations: ConversationData[]): Promise<void> => {
  if (conversations.length === 0) {
    console.warn('Attempting to save an empty conversations array. This might be unintended')
    return
  }
  const appStorage = getAppStorage()
  if (appStorage) {
    await appStorage.whenHydrated()
    const serializedConversations = conversations.map((conv) => ({
      ...conv,
      timestamp: conv.timestamp.toISOString()
    }))
    appStorage.set(CONVERSATIONS_STORAGE_KEY, serializedConversations)
  } else {
    console.error('AppStorage not available. Unable to save conversations.')
  }
}

export const deleteAllConversationsInAppStorage = async (): Promise<void> => {
  const appStorage = getAppStorage()
  if (appStorage) {
    await appStorage.whenHydrated()
    appStorage.delete(CONVERSATIONS_STORAGE_KEY)
    console.log('Deleted conversations: ', appStorage.get(CONVERSATIONS_STORAGE_KEY))
  }
}

// Type-specific app storage retrieval functions
export const getNumberFromAppStorage = async (key: string, defaultValue: number): Promise<number> => {
  const appStorage = getAppStorage()
  if (appStorage) {
    await appStorage.whenHydrated()
    const value = appStorage.get(key)
    return typeof value === 'number' ? value : defaultValue
  }
  return defaultValue
}

export const getBooleanFromAppStorage = async (key: string, defaultValue: boolean): Promise<boolean> => {
  const appStorage = getAppStorage()
  if (appStorage) {
    await appStorage.whenHydrated()
    const value = appStorage.get(key)
    return typeof value === 'boolean' ? value : defaultValue
  }
  return defaultValue
}

export const getStringFromAppStorage = async (key: string, defaultValue: string): Promise<string> => {
  const appStorage = getAppStorage()
  if (appStorage) {
    await appStorage.whenHydrated()
    const value = appStorage.get(key)
    return typeof value === 'string' ? value : defaultValue
  }
  return defaultValue
}

export const getConversationsFromAppStorage = async (): Promise<ConversationData[]> => {
  const appStorage = getAppStorage()
  if (appStorage) {
    await appStorage.whenHydrated()
    const serializedConversations = appStorage.get(CONVERSATIONS_STORAGE_KEY)
    if (Array.isArray(serializedConversations)) {
      return serializedConversations.map((conv) => ({
        ...conv,
        timestamp: new Date(conv.timestamp)
      }))
    }
  }
  return []
}

// Add this constant to your file
const MIGRATION_COMPLETED_KEY = 'migrationCompleted'

export const migrateFromLocalStorageToAppStorage = async (): Promise<void> => {
  const appStorage = getAppStorage()
  if (appStorage) {
    await appStorage.whenHydrated()

    // Check if migration has already been completed
    const migrationCompleted = await getBooleanFromAppStorage(MIGRATION_COMPLETED_KEY, false)
    if (migrationCompleted) {
      console.log('Migration already completed. Skipping.')
      return
    }

    // Check if there's anything to migrate
    const keysToCheck = [CONVERSATIONS_STORAGE_KEY, AUTO_CLEAR_VALUE_KEY, AUTO_SAVE_SEC_KEY, AUDIO_ENABLED_KEY]
    const hasDataToMigrate = keysToCheck.some((key) => localStorage.getItem(key) !== null)

    if (!hasDataToMigrate) {
      console.log('No data to migrate. Marking migration as completed.')
      await saveBooleanInAppStorage(MIGRATION_COMPLETED_KEY, true)
      return
    }

    // Perform migration
    const conversations = loadConversationsFromLocalStorage()
    if (conversations.length > 0) {
      await saveConversationsInAppStorage(conversations)
      console.log(`Migrated conversations from LocalStorage to AppStorage`)
      localStorage.removeItem(CONVERSATIONS_STORAGE_KEY)
    }

    await migrateNumber(AUTO_CLEAR_VALUE_KEY)
    await migrateNumber(AUTO_SAVE_SEC_KEY)
    await migrateBoolean(AUDIO_ENABLED_KEY)

    // Mark migration as completed
    await saveBooleanInAppStorage(MIGRATION_COMPLETED_KEY, true)

    console.log('Migration from LocalStorage to AppStorage complete')
  }
}

// Helper functions remain the same
async function migrateNumber(key: string): Promise<void> {
  const value = localStorage.getItem(key)
  if (value !== null) {
    await saveNumberInAppStorage(key, Number(value))
    localStorage.removeItem(key)
  }
}

async function migrateBoolean(key: string): Promise<void> {
  const value = localStorage.getItem(key)
  if (value !== null) {
    await saveBooleanInAppStorage(key, value === 'true')
    localStorage.removeItem(key)
  }
}
