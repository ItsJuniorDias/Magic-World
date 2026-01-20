import Card from "@/components/card";
import Text from "@/components/text";
import { StatusBar } from "expo-status-bar";
import { FlatList, Platform, ScrollView, StyleSheet, View } from "react-native";

import { db } from "../../firebaseConfig";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useStoriesStore } from "@/store/useStoriesStore";

import { GoogleGenerativeAI } from "@google/generative-ai";

import { useLikedStore } from "@/store/useLikedStore";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStories } from "@/services/getStories";
import CardSkeleton from "@/components/card-skeleton";
import { uploadGeminiToCloudinary } from "@/services/generateURL";

const genAI = new GoogleGenerativeAI(
  process.env.EXPO_PUBLIC_GOOGLE_API_KEY || ""
);

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

const geminiImage = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-image", // Note o sufixo "-image"
});

export default function HomeScreen() {
  const router = useRouter();

  const [generatedStory, setGeneratedStory] = useState<any>(null);

  const likedIds = useLikedStore((s) => s.likedIds);
  const toggleLike = useLikedStore((s) => s.toggleLike);

  const loadLikedStories = useLikedStore((s) => s.loadLikedStories);

  const query = useQuery({ queryKey: ["stories"], queryFn: getStories });

  const incrementStoryViews = async (storyId: string) => {
    const storyRef = doc(db, "stories", storyId);

    // Atualiza no Firestore
    await updateDoc(storyRef, {
      views: increment(1),
    });

    // Atualiza localmente no Zustand (UX instantânea)
    useStoriesStore.setState((state) => ({
      stories: state.stories.map((story) =>
        story.id === storyId
          ? { ...story, views: (story.views ?? 0) + 1 }
          : story
      ),
    }));
  };

  async function generateStory() {
    const textResult = await geminiModel.generateContent(`
Write an original children’s saga-style story set in a magical adventure world.

Important character rules:
Each chapter must focus on different main characters (children, creatures, or heroes), with unique personalities, backgrounds, and motivations.
Do not reuse the same protagonist across chapters.
Characters may meet, influence events, or be connected by the same world or legend, but each chapter should feel like a new perspective.


Story guidelines:
Genre: mystery
Tone: Epic, immersive, mysterious
Style: Saga narrative
Audience: Children
World-building should feel magical, safe, and wondrous
Include discovery, courage, friendship, and mystery
Avoid violence or dark themes unsuitable for children


Narrative focus:
Chapter 1: Introduce the world through the eyes of the first character
Chapter 2: Expand the world with a new character from a different place or culture
Chapter 3: Reveal a deeper secret of the world through a third, unexpected character


Writing rules:
Rich descriptions and sensory details
Clear beginning, middle, and end for each chapter
Maintain continuity of the world while changing protagonists
Generate the story following a structured JSON format when requested.

Structure:
{
  category: "mystery",
  title: "",
  thumbnail: "",
  views: 0,
  id: "",
  chapter: [
    {
      locked: false,
      navigate: "/(storie)",
      storie: "",
      title: "",
      thumbnail: ""
    },
    {
      locked: true,
      navigate: "/(storie)",
      storie: "",
      title: "",
      thumbnail: ""
    },
    {
      locked: true,
      navigate: "/(storie)",
      storie: "",
      title: "",
      thumbnail: ""
    }
  ]
}
`);

    const cleaned = textResult.response
      .text()
      .replace(/```json|```/g, "")
      .trim();

    console.log("CLEANED JSON:", cleaned);

    const story = JSON.parse(cleaned);

    // Upload and set story thumbnail
    const storyImagePrompt = `Cover illustration for a children's mystery saga titled "${story.title}". The scene should be magical, safe, and wondrous, capturing the essence of discovery, courage, friendship, and mystery. Style: vibrant colors, whimsical details, and a touch of fantasy.`;

    const storyImageResult = await geminiImage.generateContent({
      contents: [{ role: "user", parts: [{ text: storyImagePrompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const storyImagePart =
      storyImageResult.response.candidates[0].content.parts.find(
        (p) => p.inlineData
      );

    if (storyImagePart) {
      const permanentUrl = await uploadGeminiToCloudinary(
        storyImagePart.inlineData.data
      );

      story.thumbnail = permanentUrl;
    }

    // Generate and upload thumbnails for each chapter
    for (let i = 0; i < story.chapter.length; i++) {
      const chapter = story.chapter[i];

      const imagePrompt = `Illustration for the chapter titled "${chapter.title}" in a children's mystery saga. The scene should be magical, safe, and wondrous, capturing the essence of discovery, courage, friendship, and mystery. Style: vibrant colors, whimsical details, and a touch of fantasy.`;

      const result = await geminiImage.generateContent({
        contents: [{ role: "user", parts: [{ text: imagePrompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      const imagePart = result.response.candidates[0].content.parts.find(
        (p) => p.inlineData
      );

      if (imagePart) {
        const permanentUrl = await uploadGeminiToCloudinary(
          imagePart.inlineData.data
        );

        story.chapter[i].thumbnail = permanentUrl;
      }
    }

    return story;
  }

  useEffect(() => {
    const load = async () => {
      try {
        // const story = await generateStory();
        // console.log("GENERATED STORY:", story);
        // const result = await addDoc(collection(db, "stories"), {
        //   ...story,
        //   createdAt: serverTimestamp(),
        // });
        // console.log(result, "STORY ADDED WITH ID");
      } catch (err) {
        console.error(err);
      }
    };

    load();
  }, []);

  // console.log(response, "RESPONSE FROM GEMINI");

  const renderItem = ({ item, variant }: any) => (
    <Card
      variant={variant}
      thumbnail={item.thumbnail}
      title={item.title}
      views={item.views}
      isFavorite={likedIds.includes(item.id)}
      onToggleFavorite={() => {
        toggleLike({
          storyId: item.id,
          title: item.title,
          thumbnail: item.thumbnail,
          chapter: item.chapter,
        });

        loadLikedStories();
      }}
      onPress={async () => {
        if (variant !== "category") {
          await incrementStoryViews(item.id);
        }

        router.push({
          pathname: item.chapter[0].navigate,
          params: {
            storie: item.chapter[0].storie,
            title: item.chapter[0].title,
            thumbnail: item.chapter[0].thumbnail,
            storyId: item.id,
            currentIndex: 0,
          },
        });
      }}
    />
  );

  // 🔥 Mais vistas
  const mostWatched = [...(query.data ?? [])].sort(
    (a, b) => (b.views ?? 0) - (a.views ?? 0)
  );

  // 🗂 Categoria (exemplo: Fairy Tale)
  const categoryStories = [
    {
      id: "1",
      title: "Children's Comic",
      chapter: [
        {
          navigate: "/(categories)",
        },
      ],
      thumbnail:
        "https://res.cloudinary.com/dqvujibkn/image/upload/v1767753186/Gemini_Generated_Image_mijilhmijilhmiji_1_frh7nh.png", // substitua pela sua imagem
    },
  ];

  // 🕒 Publicadas recentemente
  const recentlyPublished = [...(query.data ?? [])].sort(
    (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
  );

  const Section = ({
    title,
    data,
    variant,
  }: {
    title: string;
    data: any[];
    variant?: "default" | "category" | "recent";
  }) => (
    <View style={styles.section}>
      <Text
        title={title}
        fontFamily="bold"
        fontSize={24}
        color="#FFFFFF"
        style={{ marginBottom: 12, marginLeft: 24 }}
      />

      {query.isLoading ? (
        <FlatList
          data={[{}, {}, {}, {}, {}]}
          renderItem={() => <CardSkeleton variant={variant} />}
          horizontal
          keyExtractor={(item) => item.toString()}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 24 }}
        />
      ) : (
        <FlatList
          data={data}
          renderItem={(item) => renderItem({ ...item, variant })}
          horizontal
          initialNumToRender={10}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 24 }}
        />
      )}
    </View>
  );

  return (
    <>
      <StatusBar style="light" translucent />
      <ScrollView showsVerticalScrollIndicator={false} style={styles.container}>
        <Section
          title="Most Watched Stories"
          data={mostWatched}
          variant="default"
        />

        <Section title="Categories" data={categoryStories} variant="category" />

        <Section
          title="Recently Published"
          data={recentlyPublished}
          variant="recent"
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#15141A",
    paddingTop: Platform.OS === "ios" ? 8 : 24,
  },

  section: {
    marginBottom: 16,
  },
});
