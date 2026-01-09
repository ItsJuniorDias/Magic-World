import { create } from "zustand";
import {
  likeStory,
  unlikeStory,
  getLikedStories,
} from "@/services/liked";
import { getAnonymousUserId } from "@/utils/anonymousUser";

type LikedStore = {
  userId: string | null;
  likedIds: string[];
  init: () => Promise<void>;
  toggleLike: (data: {
    storyId: string;
    title: string;
    thumbnail: string;
    chapter: [];
  }) => Promise<void>;
  likedStories: {
    storyId: string;
    title: string;
    thumbnail: string;
    chapter: [];
    createdAt?: any;
  }[];
    loadLikedStories: () => Promise<void>;
};

export const useLikedStore = create<LikedStore>((set, get) => ({
  userId: null,
  likedStories: [],
  likedIds: [],

  init: async () => {
    const id = await getAnonymousUserId();
    const liked = await getLikedStories(id);

    set({
      userId: id,
      likedIds: liked.map((l: any) => l.storyId),
    });
  },

  loadLikedStories: async () => {
    const userId = await getAnonymousUserId();
    const stories = await getLikedStories(userId);

    set({
      userId,
      likedStories: stories,
      likedIds: stories.map((s) => s.storyId),
    });
  },

  toggleLike: async ({ storyId, title, thumbnail }) => {
    const { userId, likedIds } = get();

    if (!userId) return;

    const isLiked = likedIds.includes(storyId);

    if (isLiked) {
      await unlikeStory({ userId, storyId });

      set({
        likedIds: likedIds.filter((id) => id !== storyId),
      });
    } else {
      await likeStory({ userId, storyId, title, thumbnail });
      set({
        likedIds: [...likedIds, storyId],
      });
    }
  },
}));
