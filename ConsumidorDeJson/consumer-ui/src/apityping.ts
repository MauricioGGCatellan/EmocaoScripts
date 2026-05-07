import type { EmoData } from "./converter"

export type Content = {
    content: string
}

type ComputationalThinkingGame = {
    name: string
    levels: Content[]
}

type StorytellingGame = {
    name: string
    Scenes: Content[]
}

type QuizGame = {
    name: string
    Questions: Content[]
}

type StandardGame = {
    name: string
}

type ReverseStorytellingGame = {
    name: string
    SpeechBubbles: Content[]
}

export type StandardResult = {
    Game: StandardGame[]
}

export type QuizResult = {
    Game: QuizGame[]
}

export type ComputationalThinkingResult = {
    Game: ComputationalThinkingGame[] 
} 

export type StorytellingResult = {
    Game: StorytellingGame[]
}

export type ReverseStorytellingResult = {
    Game: ReverseStorytellingGame[]
}

export type APIResult = {
  res: EmoData[],
  err: string
};