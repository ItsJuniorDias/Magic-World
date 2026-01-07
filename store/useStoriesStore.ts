import { create } from "zustand";

export type StoryItem = {
  id: string;
  title: string;
  views: number;
  thumbnail: string;
  storie: string;
};

type StoriesState = {
  stories: StoryItem[];
  addStory: (story: StoryItem) => void;
  removeStory: (id: string) => void;
};

export const useStoriesStore = create<StoriesState>((set) => ({
  stories: [],

  addStory: (story) =>
    set((state) => ({
      stories: [...state.stories, story],
    })),

  removeStory: (id) =>
    set((state) => ({
      stories: state.stories.filter((item) => item.id !== id),
    })),
}));
